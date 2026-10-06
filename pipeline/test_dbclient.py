"""Tests for pipeline/dbclient.py (the reconnecting Supabase client) and
pipeline/budget.py (the standing spending rule), with mocked clients.

The dropped-connection case is the one that killed the stage 2b re-review
on 6 Oct 2026: the database host closes an HTTP/2 connection after 10,000
requests (httpx.RemoteProtocolError: ConnectionTerminated). Here a fake
client raises exactly that on a chosen request; the wrapper must reconnect
(call the factory again) and replay the same query chain so the write
lands, and must NOT retry an HTTP status error.
"""

from __future__ import annotations

import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import budget as budget_module  # noqa: E402
import dbclient  # noqa: E402
import summarize as sz  # noqa: E402
from test_review import FakeSupabase, _rows  # noqa: E402


class DroppingClient:
    """Wraps a FakeSupabase so that the Nth execute() raises a connection
    error (once), the way the host's GOAWAY surfaces in httpx."""

    def __init__(self, db: FakeSupabase, drop_on: int, exc: Exception):
        self.db = db
        self.drop_on = drop_on
        self.exc = exc
        self.calls = 0
        self.dropped = False

    def table(self, name):
        return _Guard(self, self.db.table(name))

    def rpc(self, name, params=None):
        return _Guard(self, self.db.rpc(name, params))


class _Guard:
    def __init__(self, owner: DroppingClient, inner):
        self._owner = owner
        self._inner = inner

    def __getattr__(self, name):
        attr = getattr(self._inner, name)
        if name == "execute":
            def execute(*a, **k):
                self._owner.calls += 1
                if self._owner.calls == self._owner.drop_on and not self._owner.dropped:
                    self._owner.dropped = True
                    raise self._owner.exc
                return attr(*a, **k)
            return execute
        if callable(attr):
            def call(*a, **k):
                res = attr(*a, **k)
                return _Guard(self._owner, res) if res is self._inner or hasattr(res, "execute") else res
            return call
        return _Guard(self._owner, attr) if hasattr(attr, "execute") else attr


def _wrapped(db: FakeSupabase, drop_on: int, exc: Exception):
    made: list[DroppingClient] = []

    def factory():
        # every reconnect makes a fresh client over the same data; the
        # dropped flag lives on the first one so the retry succeeds
        c = DroppingClient(db, drop_on if not made else 10**9, exc)
        made.append(c)
        return c

    client = dbclient.ReconnectingClient(factory, sleep=lambda s: None)
    return client, made


def test_dropped_connection_reconnects_and_replays_the_write():
    db = FakeSupabase(_rows())
    client, made = _wrapped(db, drop_on=1, exc=httpx.RemoteProtocolError("ConnectionTerminated"))
    res = client.table("provisions").update({"summary_status": "approved", "reviewed_by": "Claude (x, automated pipeline)"}) \
        .eq("id", "sec-7-B-I-C").eq("summary_status", "pending").execute()
    assert res.data and res.data[0]["id"] == "sec-7-B-I-C"
    assert db.row("sec-7-B-I-C")["summary_status"] == "approved"
    assert client.reconnects == 1 and len(made) == 2
    # exactly one write landed (the replay, not a duplicate)
    assert sum(1 for w in db.writes if w[1] == "update") == 1


def test_connection_reset_and_timeout_are_retried_too():
    for exc in (ConnectionResetError("reset by peer"), httpx.ReadTimeout("timed out"),
                httpx.ConnectError("refused")):
        db = FakeSupabase(_rows())
        client, _ = _wrapped(db, drop_on=1, exc=exc)
        rows = client.table("provisions").select("id").eq("id", "sec-3-A-I-B").execute().data
        assert [r["id"] for r in rows] == ["sec-3-A-I-B"]
        assert client.reconnects == 1


def test_http_status_errors_are_not_retried():
    db = FakeSupabase(_rows())
    req = httpx.Request("PATCH", "https://x.supabase.co/rest/v1/provisions")
    err = httpx.HTTPStatusError("400", request=req, response=httpx.Response(400, request=req))
    client, made = _wrapped(db, drop_on=1, exc=err)
    with pytest.raises(httpx.HTTPStatusError):
        client.table("provisions").select("id").execute()
    assert client.reconnects == 0 and len(made) == 1


def test_gives_up_after_the_attempt_limit():
    db = FakeSupabase(_rows())
    calls = {"n": 0}

    class AlwaysDown:
        def table(self, name):
            return self

        def __getattr__(self, name):
            return lambda *a, **k: self

        def execute(self):
            calls["n"] += 1
            raise httpx.RemoteProtocolError("ConnectionTerminated")

    client = dbclient.ReconnectingClient(lambda: AlwaysDown(), attempts=2, sleep=lambda s: None)
    with pytest.raises(httpx.RemoteProtocolError):
        client.table("provisions").select("id").execute()
    assert calls["n"] == 3 and client.reconnects == 2


def test_recorded_chain_replays_property_access_and_calls_in_order():
    db = FakeSupabase(_rows())
    client = dbclient.ReconnectingClient(lambda: db, sleep=lambda s: None)
    chain = client.table("provisions").select("id, ai_summary").not_.is_("ai_summary", "null").eq("summary_status", "pending")
    kinds = [(k, n) for k, n, _a, _kw in chain.steps]
    assert kinds == [("call", "table"), ("call", "select"), ("attr", "not_"), ("call", "is_"), ("call", "eq")]
    ids = sorted(r["id"] for r in chain.execute().data)
    assert ids == ["sec-3-A-I-B", "sec-7-B-I-C", "sec-7-B-I-C-2"]


def test_summarizer_review_and_embed_use_the_reconnecting_client(monkeypatch):
    """Every write loop goes through the wrapper: make_supabase_client in
    summarize.py (review.py calls the same one) and embed.py both return a
    ReconnectingClient."""
    import embed

    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    fake = FakeSupabase(_rows())
    import supabase as supabase_pkg
    monkeypatch.setattr(supabase_pkg, "create_client", lambda url, key: fake)
    c1 = sz.make_supabase_client()
    c2 = embed.make_supabase_client()
    assert isinstance(c1, dbclient.ReconnectingClient) and isinstance(c2, dbclient.ReconnectingClient)
    assert c1.table("provisions").select("id").eq("id", "sec-3-A-I-B").execute().data[0]["id"] == "sec-3-A-I-B"


def test_review_write_loop_survives_a_dropped_connection_mid_batch(monkeypatch, tmp_path):
    """End to end through review.main: the 2nd database request of the
    write phase drops; the run reconnects, every verdict is written, and the
    report counts every row."""
    import review
    from test_review import FakeAnthropic, _pass, _corrected

    db = FakeSupabase(_rows())
    wrapped, made = _wrapped(db, drop_on=4, exc=httpx.RemoteProtocolError("ConnectionTerminated"))   # 1 meta page, 1 selection page, then the writes
    answers = {
        "sec-7-B-I-C": _corrected("Owners must inspect every engine above 400 hp quarterly and keep records for five years."),
        "sec-7-B-I-C-2": _pass(),
        "sec-3-A-I-B": _pass(),
    }
    fake_anthropic = FakeAnthropic(answers)
    monkeypatch.setattr(sz, "make_supabase_client", lambda: wrapped)
    monkeypatch.setattr(review, "FAILED_LOG_PATH", tmp_path / "review_failed.jsonl")
    monkeypatch.setattr(review, "OUT_DIR", tmp_path / "out")
    monkeypatch.setattr(review, "REPORT_MD_PATH", tmp_path / "out" / "review_report.md")
    monkeypatch.setattr(review, "REPORT_JSON_PATH", tmp_path / "out" / "review_report.json")
    monkeypatch.setattr(review.time, "sleep", lambda s: None)
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"):
        monkeypatch.setenv(k, "x")
    import types
    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=lambda api_key: fake_anthropic))
    real_make = sz.make_custom_id

    def tracking_make(pid, used):
        cid = real_make(pid, used)
        fake_anthropic.custom_id_map[cid] = pid
        return cid
    monkeypatch.setattr(sz, "make_custom_id", tracking_make)

    rc = review.main(["--execute"])
    assert rc == 0
    assert wrapped.reconnects == 1 and made[0].dropped
    assert db.row("sec-7-B-I-C")["summary_status"] == "approved"
    assert db.row("sec-7-B-I-C-2")["summary_status"] == "approved"
    assert db.row("sec-3-A-I-B")["summary_status"] == "approved"


# --------------------------------------------------------------------------
# budget.py -- the standing rule
# --------------------------------------------------------------------------

def test_standing_budget_is_ten_dollars_per_regulation_from_one_constant():
    assert budget_module.STANDING_BUDGET_USD == 10.0
    b = budget_module.budget_from_args(None)
    assert b.usd_per_reg == 10.0 and b.source == "standing rule"
    b2 = budget_module.budget_from_args(25)
    assert b2.usd_per_reg == 25.0 and "approved_budget" in b2.source
    assert "$10.00 per regulation" in b.header_lines()[0]


def test_estimate_over_budget_names_the_regulation_and_asks_for_approval():
    b = budget_module.Budget()
    b.estimate("7", "summarize", 4.0)
    b.estimate("7", "review", 5.0)
    b.estimate("7", "embed", 0.01)
    b.estimate("gp03", "summarize", 0.2)
    assert b.over_estimate() == []
    b.estimate("7", "review", 1.5)
    over = b.over_estimate()
    assert over == [("7", pytest.approx(10.51))]
    msg = b.stop_message_estimate(over)
    assert "No paid call was made" in msg and "approved_budget" in msg and "7: $10.51" in msg


def test_spend_is_tracked_per_regulation_and_stage():
    b = budget_module.Budget(usd_per_reg=1.0)
    b.set_spent("3", "summarize", 0.4)
    b.set_spent("3", "review", 0.5)
    b.spend("3", "embed", 0.05)
    assert b.exceeded() == []
    b.set_spent("3", "review", 0.6)
    assert b.exceeded() == [("3", pytest.approx(1.05))]
    assert "remaining rows stay pending" in b.stop_message_spend(b.exceeded())
    table = "\n".join(b.table_lines())
    assert "| 3 |" in table and "$1.00" in table
