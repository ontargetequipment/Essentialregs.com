#!/usr/bin/env python3
"""A Supabase client that reconnects when the database host drops the
connection, and replays the request it was making.

Why this exists. On 6 Oct 2026 the stage 2b re-review (11,917 rows, 12 paid
batches) died while writing batch 8: the database host closes an HTTP/2
connection after 10,000 requests (`httpx.RemoteProtocolError:
ConnectionTerminated`), and the write loop in review.py did not reconnect.
The rows were only recovered because every batch had already been paid for
and `--resume-batch` could consume them later. Every write loop in the
pipeline (summarize, review, embed, the chained run) now goes through this
wrapper, so a dropped connection costs one reconnect, not a run.

How it works. `ReconnectingClient` holds a real supabase-py client made by a
factory and hands out *recorded* query chains instead of the client's own
builders: `client.table("provisions").update(p).eq("id", pid).execute()`
records [table, update, eq] and replays the chain on the live client inside
`execute()`. When the replay raises a transport error (connection closed,
reset, refused, timed out -- `httpx.TransportError` and the builtin
`ConnectionError`), the factory is called again for a fresh client (a fresh
HTTP/2 session) and the same chain is replayed, up to RECONNECT_ATTEMPTS
times with a short backoff. HTTP status errors (a 4xx from PostgREST) are
not retried: they are answers, not dropped connections.

Replaying a write that the server may already have applied is safe for the
writes the pipeline makes: every UPDATE sets the same values again, and a
GOAWAY/ConnectionTerminated happens when the request is being sent, before
the server has processed it.

The wrapper is generic over anything with `.table()` and `.rpc()`, so the
unit tests wrap their in-memory fake client the same way and inject a
dropped connection (test_dbclient.py)."""

from __future__ import annotations

import sys
import time
from typing import Any, Callable, Optional

RECONNECT_ATTEMPTS = 3          # replays after the first failure
RECONNECT_BACKOFF_SECONDS = 1.0  # doubled on every further attempt


def is_connection_error(exc: BaseException) -> bool:
    """A dropped, reset, refused or timed-out connection -- the errors a
    reconnect can cure. HTTP status errors are never connection errors."""
    try:
        import httpx
    except ImportError:  # pragma: no cover - httpx is a supabase-py dependency
        httpx = None
    if httpx is not None:
        if isinstance(exc, httpx.HTTPStatusError):
            return False
        if isinstance(exc, httpx.TransportError):
            return True
    if isinstance(exc, ConnectionError):   # builtin: ConnectionResetError, BrokenPipeError, ...
        return True
    text = f"{type(exc).__name__}: {exc}"
    return any(mark in text for mark in ("ConnectionTerminated", "RemoteProtocolError",
                                         "ConnectionReset", "Connection reset", "GOAWAY"))


class _Step:
    """An attribute looked up on a recorded chain. Calling it records a
    method call; looking an attribute up on it records a property access
    (postgrest's `not_` is a property, so `.not_.is_("x", "null")` is an
    attribute access followed by a call)."""

    __slots__ = ("_chain", "_name")

    def __init__(self, chain: "RecordedChain", name: str):
        self._chain = chain
        self._name = name

    def __call__(self, *args, **kwargs) -> "RecordedChain":
        self._chain._steps.append(("call", self._name, args, kwargs))
        return self._chain

    def __getattr__(self, attr: str):
        self._chain._steps.append(("attr", self._name, (), {}))
        return _Step(self._chain, attr)


class RecordedChain:
    """The query builder stand-in: records every call and attribute access,
    replays them on the live client in execute()."""

    def __init__(self, client: "ReconnectingClient", first: tuple):
        self._client = client
        self._steps: list[tuple] = [first]

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        if name == "execute":
            return self._execute
        return _Step(self, name)

    def _execute(self, *args, **kwargs):
        return self._client.replay(self._steps + [("call", "execute", args, kwargs)])

    @property
    def steps(self) -> list[tuple]:
        return list(self._steps)


class ReconnectingClient:
    def __init__(self, factory: Callable[[], Any], attempts: int = RECONNECT_ATTEMPTS,
                 backoff: float = RECONNECT_BACKOFF_SECONDS, sleep: Callable[[float], None] = time.sleep):
        self._factory = factory
        self._client = factory()
        self._attempts = attempts
        self._backoff = backoff
        self._sleep = sleep
        self.reconnects = 0
        self.requests = 0

    # -- the supabase-py surface the pipeline uses ---------------------------
    def table(self, name: str) -> RecordedChain:
        return RecordedChain(self, ("call", "table", (name,), {}))

    def from_(self, name: str) -> RecordedChain:
        return RecordedChain(self, ("call", "from_", (name,), {}))

    def rpc(self, name: str, params: Optional[dict] = None, **kwargs) -> RecordedChain:
        return RecordedChain(self, ("call", "rpc", (name, params), kwargs))

    @property
    def raw(self):
        """The live underlying client (for code that needs something the
        recorder does not cover). Not retried."""
        return self._client

    # -- replay --------------------------------------------------------------
    def reconnect(self) -> None:
        self._client = self._factory()
        self.reconnects += 1

    def replay(self, steps: list[tuple]):
        delay = self._backoff
        attempt = 0
        while True:
            try:
                obj = self._client
                for kind, name, args, kwargs in steps:
                    obj = getattr(obj, name)
                    if kind == "call":
                        obj = obj(*args, **kwargs)
                self.requests += 1
                return obj
            except Exception as exc:  # noqa: BLE001 - only connection errors are retried
                if not is_connection_error(exc) or attempt >= self._attempts:
                    raise
                attempt += 1
                print(f"  database connection dropped ({type(exc).__name__}: {exc}); "
                      f"reconnecting (attempt {attempt} of {self._attempts})...", file=sys.stderr)
                self._sleep(delay)
                delay *= 2
                self.reconnect()


def make_reconnecting_client(url: str, key: str) -> ReconnectingClient:
    """The pipeline's one way to a database client: supabase-py behind the
    reconnecting wrapper."""
    from supabase import create_client

    return ReconnectingClient(lambda: create_client(url, key))
