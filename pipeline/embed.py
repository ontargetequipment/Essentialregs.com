#!/usr/bin/env python3
"""Semantic embeddings for essentialregs.com provisions (Voyage AI + pgvector).

For every provision in scope this builds an embedding input from the
citation, title, immediate parent's opening words, the tag-stripped
full_text, and the plain-English ai_summary; embeds it with Voyage AI
(voyage-3.5-lite, 1024 dims); and upserts the vectors into
`provision_embeddings`. Long rows are split into overlapping chunks, and
chunk 0 always carries the summary. Every chunk is content-hashed so
re-runs only re-embed rows whose text or summary actually changed.

After the embeddings are written it calls the `recompute_provision_neighbors`
RPC (supabase/migrations/006_neighbors_rpc.sql) so the "Related provisions"
panel (`provision_neighbors`) is refreshed for the rows touched.

Designed to run in GitHub Actions (see .github/workflows/embed.yml), same
env/secret pattern as summarize.py.

Examples:
    # Count tokens and quote the cost. Calls nothing, writes nothing.
    python pipeline/embed.py --dry-run

    # Embed Reg 7 only (rows whose content hash changed, or never embedded).
    python pipeline/embed.py --reg 7

    # Whole corpus, resumable (unchanged rows are skipped automatically).
    python pipeline/embed.py

    # Re-embed everything in Reg 3 regardless of hashes.
    python pipeline/embed.py --reg 3 --force

    # Only refresh the related-provisions table, no API calls at all.
    python pipeline/embed.py --neighbors-only

    # Same, but resume a rebuild that died part-way (id from the failed run's log).
    python pipeline/embed.py --neighbors-only --start-after sec-gp09-IX-B

Required environment variables:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    VOYAGE_API_KEY          (not needed for --dry-run or --neighbors-only)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

PIPELINE_DIR = Path(__file__).resolve().parent
FAILED_LOG_PATH = PIPELINE_DIR / "embed_failed.jsonl"

# --- Model ---------------------------------------------------------------
DEFAULT_MODEL = "voyage-3.5-lite"
EMBED_DIMS = 1024
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
# Published USD per million tokens. Update if Voyage changes pricing.
MODEL_RATES = {
    "voyage-3.5-lite": 0.02,
    "voyage-3.5": 0.06,
    "voyage-3-large": 0.18,
    "voyage-law-2": 0.12,
}
FALLBACK_RATE = 0.06

# --- Chunking (characters; ~4 chars per token on legal English) ----------
CHARS_PER_TOKEN = 3.8            # for dry-run estimates only; real runs use API usage
MAX_CHUNK_CHARS = 6000           # ≈1,500 tokens
CHUNK_OVERLAP_CHARS = 600        # ≈150 tokens
PARENT_TEXT_CHARS = 300          # opening words of the immediate parent shown for scope
MIN_BODY_CHARS = 1               # rows with no text at all still get embedded (title + summary)

# --- Batching ------------------------------------------------------------
VOYAGE_BATCH_TEXTS = 128         # texts per request (API max 1000)
VOYAGE_BATCH_CHARS = 400_000     # ≈100k tokens per request, well under the 1M-token cap
DB_PAGE_SIZE = 500
UPSERT_PAGE_SIZE = 25            # each row is also an HNSW insert; 100 rows crossed the 8s cap
IN_BATCH = 40                    # ids per in.(...) filter; long ids must fit the request URL
NEIGHBOR_BATCH_IDS = 25          # PostgREST caps each call at 8s; ~25 anchors ≈ 1s warm, well under
NEIGHBOR_GROW_AFTER = 8          # consecutive successes at a halved size before doubling back up
NEIGHBOR_MAX_RETRIES = 5         # retries of a batch that cannot be halved further (size 1) or a non-timeout error
NEIGHBOR_RETRY_SLEEP = 2         # seconds; doubled on every retry of the same batch
NEIGHBOR_LOG_EVERY = 40          # batches between progress lines (~1,000 provisions at full size)
MAX_RETRIES = 6

TAG_RE = re.compile(r"<[^>]+>")
NBSP_RE = re.compile(r"&nbsp;")
WS_RE = re.compile(r"\s+")


# --------------------------------------------------------------------------
# Text helpers (kept in sync with summarize.py)
# --------------------------------------------------------------------------

def strip_html(html: Optional[str]) -> str:
    text = TAG_RE.sub(" ", html or "")
    text = NBSP_RE.sub(" ", text)
    text = WS_RE.sub(" ", text).strip()
    return text


def reg_key_of(provision_id: str) -> Optional[str]:
    m = re.match(r"^sec-([^-]+)-", provision_id or "")
    return m.group(1).lower() if m else None


def estimate_tokens(chars: int) -> int:
    return int(chars / CHARS_PER_TOKEN) + 1


# --------------------------------------------------------------------------
# Chunk building
# --------------------------------------------------------------------------

@dataclass
class Chunk:
    provision_id: str
    chunk_index: int
    text: str
    text_hash: str


def content_hash(text: str, model: str) -> str:
    """sha256 over the exact text sent to Voyage plus the model name, so a
    model change re-embeds everything and an unchanged row is skipped."""
    h = hashlib.sha256()
    h.update(model.encode("utf-8"))
    h.update(b"\x00")
    h.update(text.encode("utf-8"))
    return h.hexdigest()


def split_body(body: str, max_chars: int = MAX_CHUNK_CHARS,
               overlap: int = CHUNK_OVERLAP_CHARS) -> list[str]:
    """Splits `body` into pieces of at most `max_chars`, each overlapping
    the previous by ~`overlap` chars, breaking on whitespace where possible.
    Returns [body] when it already fits. Never returns an empty list."""
    if len(body) <= max_chars:
        return [body]
    if overlap >= max_chars:
        raise ValueError("overlap must be smaller than max_chars")
    pieces: list[str] = []
    start = 0
    n = len(body)
    while start < n:
        end = min(start + max_chars, n)
        if end < n:
            # back up to the last whitespace inside the window (but not too far)
            cut = body.rfind(" ", start + max_chars // 2, end)
            if cut > start:
                end = cut
        piece = body[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return pieces


def build_header(provision: dict, parent: Optional[dict]) -> str:
    """Citation/title plus the reg key and the parent's opening words —
    included in every chunk so a mid-document chunk still knows what it is."""
    lines = []
    reg = reg_key_of(provision["id"])
    juris = provision.get("jurisdiction_level") or ""
    scope = f"{'Colorado' if juris == 'state' else 'Federal' if juris == 'federal' else juris}"
    if reg:
        scope += f" regulation {reg.upper() if reg.startswith('oooo') else reg}"
    lines.append(f"{scope}: {provision.get('citation') or ''} — {provision.get('title') or ''}".strip())
    if parent:
        parent_text = strip_html(parent.get("full_text"))[:PARENT_TEXT_CHARS]
        if parent_text:
            lines.append(f"Under {parent.get('citation') or ''}: {parent_text}")
    return "\n".join(lines)


def build_chunks(provision: dict, parent: Optional[dict], model: str) -> list[Chunk]:
    header = build_header(provision, parent)
    summary = (provision.get("ai_summary") or "").strip()
    if provision.get("summary_status") == "rejected":
        summary = ""
    body = strip_html(provision.get("full_text"))

    pieces = split_body(body) if body else [""]
    chunks: list[Chunk] = []
    for i, piece in enumerate(pieces):
        parts = [header]
        if i == 0 and summary:
            parts.append(f"Summary: {summary}")
        if piece:
            parts.append(f"Text: {piece}")
        text = "\n".join(parts)
        chunks.append(Chunk(provision["id"], i, text, content_hash(text, model)))
    return chunks


# --------------------------------------------------------------------------
# Supabase access
# --------------------------------------------------------------------------

def make_supabase_client():
    from supabase import create_client

    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def fetch_provisions(client, reg: Optional[str], limit: Optional[int]) -> list[dict]:
    like_prefix = f"sec-{reg.lower()}-" if reg else None
    cols = "id, citation, title, parent_id, full_text, ai_summary, summary_status, jurisdiction_level, sort_order"
    # Page on `id`, never on sort_order: sort_order is only unique within one
    # regulation, and paging a whole-corpus query on a column with ties lets
    # PostgREST hand back the same row twice and skip another (the duplicate
    # (provision_id, chunk_index) pairs that broke the first full run).
    rows: list[dict] = []
    seen: set[str] = set()
    start = 0
    while True:
        q = client.table("provisions").select(cols)
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        q = q.order("id").range(start, start + DB_PAGE_SIZE - 1)
        page = q.execute().data or []
        for r in page:
            if r["id"] not in seen:
                seen.add(r["id"])
                rows.append(r)
        if limit is not None and len(rows) >= limit:
            return rows[:limit]
        if len(page) < DB_PAGE_SIZE:
            return rows
        start += DB_PAGE_SIZE


def fetch_parents(client, parent_ids: Iterable[str]) -> dict[str, dict]:
    """Parents are looked up by id list, which PostgREST puts in the request
    URL. Ids like 'sec-7-B-III-C-4-c-(ii)-(A)-(1)' are long, and 500 of them
    exceeded the URL limit (HTTP 400 'Bad Request') on the first full-corpus
    run -- hence the small IN_BATCH."""
    ids = sorted({p for p in parent_ids if p})
    out: dict[str, dict] = {}
    for i in range(0, len(ids), IN_BATCH):
        chunk = ids[i:i + IN_BATCH]
        rows = (client.table("provisions").select("id, citation, full_text")
                .in_("id", chunk).execute().data or [])
        for r in rows:
            out[r["id"]] = r
    return out


def fetch_existing_hashes(client, ids: list[str], reg: Optional[str] = None
                          ) -> dict[tuple[str, int], str]:
    """(provision_id, chunk_index) -> chunk_text_hash for rows already embedded.

    Reads the (small, three-column) embeddings index straight through in
    pages -- optionally narrowed to one regulation's id prefix -- instead of
    sending id lists in the URL, then keeps only the ids in scope."""
    wanted = set(ids)
    out: dict[tuple[str, int], str] = {}
    like_prefix = f"sec-{reg.lower()}-" if reg else None
    start = 0
    while True:
        q = (client.table("provision_embeddings")
             .select("provision_id, chunk_index, chunk_text_hash"))
        if like_prefix:
            q = q.like("provision_id", f"{like_prefix}%")
        q = q.order("provision_id").order("chunk_index").range(start, start + 1000 - 1)
        rows = q.execute().data or []
        for r in rows:
            if r["provision_id"] in wanted:
                out[(r["provision_id"], r["chunk_index"])] = r["chunk_text_hash"]
        if len(rows) < 1000:
            return out
        start += 1000


def vector_literal(vec: list[float]) -> str:
    # pgvector's text input format; PostgREST casts it on insert.
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


def _upsert_page(client, page: list[dict]) -> None:
    """One upsert call. Every row also has to be slotted into the HNSW index,
    which is what makes big pages slow; a page that still hits PostgREST's
    8-second statement timeout is split in half and retried, down to single
    rows, rather than failing the run."""
    try:
        client.table("provision_embeddings").upsert(
            page, on_conflict="provision_id,chunk_index", returning="minimal"
        ).execute()
    except Exception as exc:  # noqa: BLE001
        if len(page) == 1 or "57014" not in str(exc):
            raise
        mid = len(page) // 2
        print(f"  upsert of {len(page)} rows timed out; retrying as {mid} + {len(page) - mid}")
        _upsert_page(client, page[:mid])
        _upsert_page(client, page[mid:])


def upsert_embeddings(client, rows: list[dict]) -> None:
    # Defensive: Postgres rejects an upsert that touches the same key twice
    # in one statement, so collapse any duplicate (provision_id, chunk_index).
    uniq: dict[tuple[str, int], dict] = {}
    for r in rows:
        uniq[(r["provision_id"], r["chunk_index"])] = r
    rows = list(uniq.values())
    for i in range(0, len(rows), UPSERT_PAGE_SIZE):
        _upsert_page(client, rows[i:i + UPSERT_PAGE_SIZE])


def delete_stale_chunks(client, provision_id: str, keep_upto: int) -> None:
    """A row that used to need 3 chunks and now needs 1: drop chunk_index > 0."""
    (client.table("provision_embeddings").delete()
     .eq("provision_id", provision_id).gt("chunk_index", keep_upto).execute())


def fetch_embedded_ids(client, start_after: Optional[str] = None) -> list[str]:
    """Every provision that has a chunk-0 embedding, sorted. With `start_after`
    only ids strictly greater than it (in the database's own ordering, the same
    one the neighbour loop walks) -- the resume point for a rebuild that died
    part-way through."""
    ids: list[str] = []
    start = 0
    while True:
        q = client.table("provision_embeddings").select("provision_id").eq("chunk_index", 0)
        if start_after is not None:
            q = q.gt("provision_id", start_after)
        rows = (q.order("provision_id").range(start, start + 1000 - 1).execute().data or [])
        ids.extend(r["provision_id"] for r in rows)
        if len(rows) < 1000:
            return ids
        start += 1000


def _is_statement_timeout(exc: Exception) -> bool:
    return "57014" in str(exc)


def _resume_hint(last_done: Optional[str]) -> str:
    if last_done is None:
        return "no batch completed; rerun --neighbors-only from the start"
    return f"resume with: --neighbors-only --start-after {last_done}"


def recompute_neighbors(client, ids: Optional[list[str]], start_after: Optional[str] = None,
                        log_every: int = NEIGHBOR_LOG_EVERY) -> int:
    """Calls the SQL-side neighbour builder in adaptive batches. None = every
    embedded provision (optionally only those after `start_after`).

    Never sends the whole corpus in one RPC: PostgREST enforces an 8-second
    statement timeout per call (the `authenticator` role's setting). Each
    anchor costs an HNSW probe plus heap reads, and once the index and the
    vector heap outgrow shared_buffers a cold stretch of the corpus can take
    ~0.8 s per anchor. So the batch size adapts: a 57014 halves the batch and
    retries the same ids at once (the pages it did read are now warm); after
    NEIGHBOR_GROW_AFTER clean batches it doubles back toward NEIGHBOR_BATCH_IDS.
    Only a batch that is already a single id is retried at the same size, with
    backoff, before the run is abandoned -- and the error names the last id
    completed so the rerun can `--start-after` it instead of starting over.
    """
    if ids is None:
        ids = fetch_embedded_ids(client, start_after=start_after)
    elif start_after is not None:
        # Explicit id lists are already sorted the way the DB sorts them
        # (callers pass fetch_* output); Python's ordering is only a fallback.
        ids = [i for i in ids if i > start_after]
    n = len(ids)
    total = 0
    pos = 0
    size = NEIGHBOR_BATCH_IDS
    min_size = size
    streak = 0
    retries = 0
    batches = 0
    halvings = 0
    last_done: Optional[str] = start_after
    t0 = time.monotonic()
    if start_after is not None:
        print(f"  resuming after {start_after}: {n:,} provisions to do")
    while pos < n:
        batch = ids[pos:pos + size]
        try:
            res = client.rpc("recompute_provision_neighbors", {"target_ids": batch}).execute()
        except Exception as exc:  # noqa: BLE001
            if _is_statement_timeout(exc) and len(batch) > 1:
                size = len(batch) // 2
                min_size = min(min_size, size)
                halvings += 1
                streak = 0
                print(f"  neighbour batch of {len(batch)} (from {batch[0]}) hit the statement "
                      f"timeout; halving to {size}")
                continue
            retries += 1
            if retries > NEIGHBOR_MAX_RETRIES:
                raise RuntimeError(
                    f"neighbour batch starting at {batch[0]} (size {len(batch)}) failed "
                    f"{retries} times: {exc}. {n - pos:,} of {n:,} provisions left; "
                    f"{_resume_hint(last_done)}") from exc
            wait = NEIGHBOR_RETRY_SLEEP * (2 ** (retries - 1))
            kind = "statement timeout on a single id" if _is_statement_timeout(exc) else f"error: {exc}"
            print(f"  neighbour batch of {len(batch)} (from {batch[0]}): {kind}; "
                  f"retry {retries}/{NEIGHBOR_MAX_RETRIES} in {wait}s")
            time.sleep(wait)
            continue
        total += int(res.data or 0)
        pos += len(batch)
        last_done = batch[-1]
        batches += 1
        retries = 0
        streak += 1
        if size < NEIGHBOR_BATCH_IDS and streak >= NEIGHBOR_GROW_AFTER:
            size = min(size * 2, NEIGHBOR_BATCH_IDS)
            streak = 0
        if batches % log_every == 0 or pos == n:
            print(f"  neighbours: {pos:,}/{n:,} provisions  batch={size}  last={last_done}  "
                  f"elapsed={time.monotonic() - t0:,.0f}s")
    print(f"  neighbour rebuild: {n:,} provisions in {batches:,} batches, {halvings} halvings, "
          f"smallest batch {min_size}, final batch {size}, {time.monotonic() - t0:,.0f}s")
    return total


# --------------------------------------------------------------------------
# Voyage AI
# --------------------------------------------------------------------------

class VoyageClient:
    def __init__(self, api_key: str, model: str):
        import httpx

        self.model = model
        self._http = httpx.Client(
            timeout=httpx.Timeout(120.0, connect=15.0),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )

    def embed(self, texts: list[str], input_type: str = "document") -> tuple[list[list[float]], int]:
        """Returns (vectors, total_tokens). Retries 429/5xx with backoff."""
        payload = {"input": texts, "model": self.model, "input_type": input_type,
                   "output_dimension": EMBED_DIMS, "truncation": True}
        delay = 2.0
        for attempt in range(1, MAX_RETRIES + 1):
            resp = self._http.post(VOYAGE_URL, content=json.dumps(payload))
            if resp.status_code == 200:
                data = resp.json()
                vectors = [item["embedding"] for item in sorted(data["data"], key=lambda d: d["index"])]
                tokens = int((data.get("usage") or {}).get("total_tokens") or 0)
                return vectors, tokens
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES:
                retry_after = resp.headers.get("retry-after")
                wait = float(retry_after) if retry_after else delay
                print(f"  Voyage {resp.status_code}; retrying in {wait:.0f}s "
                      f"(attempt {attempt}/{MAX_RETRIES})"
                      + (" -- if this keeps happening on a new account, add a payment "
                         "method in the Voyage dashboard to lift the starter rate limit"
                         if resp.status_code == 429 else ""))
                time.sleep(wait)
                delay = min(delay * 2, 60.0)
                continue
            raise RuntimeError(f"Voyage API error {resp.status_code}: {resp.text[:500]}")
        raise RuntimeError("Voyage API: retries exhausted")


def batch_chunks(chunks: list[Chunk]) -> Iterable[list[Chunk]]:
    batch: list[Chunk] = []
    chars = 0
    for c in chunks:
        if batch and (len(batch) >= VOYAGE_BATCH_TEXTS or chars + len(c.text) > VOYAGE_BATCH_CHARS):
            yield batch
            batch, chars = [], 0
        batch.append(c)
        chars += len(c.text)
    if batch:
        yield batch


# --------------------------------------------------------------------------
# Run stats + reporting
# --------------------------------------------------------------------------

@dataclass
class RunStats:
    provisions_seen: int = 0
    provisions_embedded: int = 0
    provisions_skipped_unchanged: int = 0
    chunks_embedded: int = 0
    chunks_multi: int = 0          # provisions that needed >1 chunk
    tokens: int = 0
    estimated: bool = False
    requests: int = 0
    failed: int = 0
    neighbors_written: int = 0
    touched_ids: list[str] = field(default_factory=list)


def estimate_cost(model: str, tokens: int) -> float:
    return tokens / 1_000_000 * MODEL_RATES.get(model, FALLBACK_RATE)


def print_report(stats: RunStats, model: str, dry_run: bool) -> None:
    cost = estimate_cost(model, stats.tokens)
    mode = "DRY RUN (estimated, no API calls made)" if dry_run else "live"
    print("\n" + "=" * 62)
    print(f"Embedding run -- model={model} mode={mode}")
    print("=" * 62)
    print(f"{'Provisions in scope':40}{stats.provisions_seen:>12,}")
    print(f"{'Provisions embedded':40}{stats.provisions_embedded:>12,}")
    print(f"{'Provisions skipped (unchanged hash)':40}{stats.provisions_skipped_unchanged:>12,}")
    print(f"{'Chunks embedded':40}{stats.chunks_embedded:>12,}")
    print(f"{'  of which from multi-chunk rows':40}{stats.chunks_multi:>12,}")
    print(f"{'API requests':40}{stats.requests:>12,}")
    print(f"{'Tokens' + (' (estimated)' if stats.estimated else ''):40}{stats.tokens:>12,}")
    print(f"{'Cost (USD)':40}{'$' + format(cost, ',.4f'):>12}")
    print(f"{'Failed provisions':40}{stats.failed:>12,}")
    print(f"{'Neighbor rows written':40}{stats.neighbors_written:>12,}")
    print("=" * 62)
    if stats.failed:
        print(f"Failures logged to {FAILED_LOG_PATH}; re-run without --force to retry them.")


def log_failure(provision_id: str, reason: str) -> None:
    FAILED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with FAILED_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"id": provision_id, "reason": reason,
                            "at": datetime.now(timezone.utc).isoformat()}) + "\n")


# --------------------------------------------------------------------------
# Main pipeline
# --------------------------------------------------------------------------

def plan_work(provisions: list[dict], parents: dict[str, dict], existing: dict[tuple[str, int], str],
              model: str, force: bool, stats: RunStats) -> tuple[list[Chunk], dict[str, int]]:
    """Builds chunks for every provision and decides which need embedding.
    Returns (chunks_to_embed, chunk_count_per_provision)."""
    todo: list[Chunk] = []
    counts: dict[str, int] = {}
    for p in provisions:
        stats.provisions_seen += 1
        chunks = build_chunks(p, parents.get(p.get("parent_id") or ""), model)
        counts[p["id"]] = len(chunks)
        if len(chunks) > 1:
            stats.chunks_multi += len(chunks)
        unchanged = (not force) and all(
            existing.get((c.provision_id, c.chunk_index)) == c.text_hash for c in chunks
        )
        if unchanged:
            stats.provisions_skipped_unchanged += 1
            continue
        todo.extend(chunks)
    return todo, counts


def run(args: argparse.Namespace) -> int:
    model = args.model
    stats = RunStats()
    client = make_supabase_client()

    if args.neighbors_only:
        print("Recomputing related-provision neighbours for the whole corpus (no API calls)...")
        stats.neighbors_written = recompute_neighbors(client, None, start_after=args.start_after)
        print(f"  {stats.neighbors_written:,} neighbour rows written.")
        return 0

    print(f"Fetching provisions{f' for reg {args.reg}' if args.reg else ' (all regulations)'}"
          f"{f' (limit {args.limit})' if args.limit else ''}...")
    provisions = fetch_provisions(client, args.reg, args.limit)
    print(f"  {len(provisions):,} rows.")
    parents = fetch_parents(client, (p.get("parent_id") for p in provisions))
    existing = {} if args.force else fetch_existing_hashes(client, [p["id"] for p in provisions], args.reg)
    print(f"  {len(existing):,} existing embedding chunks found for these rows.")

    todo, counts = plan_work(provisions, parents, existing, model, args.force, stats)
    print(f"  {stats.provisions_skipped_unchanged:,} provisions unchanged; "
          f"{len(todo):,} chunks to embed across "
          f"{len({c.provision_id for c in todo}):,} provisions.")

    if not todo:
        print("Nothing to embed.")
    elif args.dry_run:
        stats.estimated = True
        for c in todo:
            stats.tokens += estimate_tokens(len(c.text))
        stats.chunks_embedded = len(todo)
        stats.provisions_embedded = len({c.provision_id for c in todo})
        stats.requests = sum(1 for _ in batch_chunks(todo))
        if args.show:
            for c in todo[:args.show]:
                print(f"\n--- {c.provision_id} chunk {c.chunk_index} ({len(c.text):,} chars) ---")
                print(c.text[:1500])
    else:
        voyage = VoyageClient(os.environ["VOYAGE_API_KEY"], model)
        if FAILED_LOG_PATH.exists():
            FAILED_LOG_PATH.unlink()
        done_ids: set[str] = set()
        for batch in batch_chunks(todo):
            try:
                vectors, tokens = voyage.embed([c.text for c in batch])
            except Exception as exc:  # noqa: BLE001
                for pid in {c.provision_id for c in batch}:
                    log_failure(pid, str(exc))
                stats.failed += len({c.provision_id for c in batch})
                print(f"  batch of {len(batch)} failed: {exc}")
                continue
            stats.requests += 1
            stats.tokens += tokens
            now = datetime.now(timezone.utc).isoformat()
            rows = [{
                "provision_id": c.provision_id,
                "chunk_index": c.chunk_index,
                "chunk_text_hash": c.text_hash,
                "embedding": vector_literal(v),
                "model": model,
                "created_at": now,
            } for c, v in zip(batch, vectors)]
            upsert_embeddings(client, rows)
            stats.chunks_embedded += len(rows)
            for c in batch:
                done_ids.add(c.provision_id)
            print(f"  embedded {stats.chunks_embedded:,}/{len(todo):,} chunks "
                  f"({stats.tokens:,} tokens so far)")
        # drop chunks beyond the current count for rows that shrank
        for pid in done_ids:
            delete_stale_chunks(client, pid, counts[pid] - 1)
        stats.provisions_embedded = len(done_ids)
        stats.touched_ids = sorted(done_ids)

    if not args.dry_run and not args.skip_neighbors:
        ids = None if (args.reg is None and args.limit is None) else stats.touched_ids
        if ids is None or ids:
            print("Recomputing related-provision neighbours"
                  f"{' for the whole corpus' if ids is None else f' for {len(ids):,} rows'}...")
            stats.neighbors_written = recompute_neighbors(client, ids)

    print_report(stats, model, args.dry_run)
    return 1 if stats.failed else 0


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Embed essentialregs.com provisions with Voyage AI into pgvector.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--reg", default=None,
                        help="Limit to one regulation's id prefix, e.g. 7, 3, 26, oooob.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Stop after this many provisions (test runs).")
    parser.add_argument("--force", action="store_true",
                        help="Re-embed even when the content hash is unchanged.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Count tokens and quote the cost; call nothing, write nothing.")
    parser.add_argument("--show", type=int, default=0,
                        help="With --dry-run: print the first N chunk texts.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Voyage model id.")
    parser.add_argument("--skip-neighbors", action="store_true",
                        help="Do not recompute provision_neighbors after embedding.")
    parser.add_argument("--neighbors-only", action="store_true",
                        help="Only recompute provision_neighbors for the whole corpus.")
    parser.add_argument("--start-after", default=None, metavar="PROVISION_ID",
                        help="With --neighbors-only: skip ids up to and including this one "
                             "(the 'last=' id from a failed run's log) instead of starting over.")
    args = parser.parse_args(argv)
    if args.start_after is not None and not args.neighbors_only:
        parser.error("--start-after only applies to --neighbors-only")
    return args


def require_env(names: list[str]) -> None:
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        print(f"Missing required environment variable(s): {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    if not (args.dry_run or args.neighbors_only):
        required.append("VOYAGE_API_KEY")
    require_env(required)
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
