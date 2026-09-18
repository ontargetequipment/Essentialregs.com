"""Unit tests for pipeline/embed.py — chunking, hashing, batching, planning.

No network and no database: everything here runs on in-memory rows.
    python -m pytest pipeline/test_embed.py -q
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import embed  # noqa: E402
from embed import (  # noqa: E402
    CHUNK_OVERLAP_CHARS, MAX_CHUNK_CHARS, RunStats, batch_chunks, build_chunks,
    content_hash, plan_work, split_body, strip_html, vector_literal,
)

MODEL = "voyage-3.5-lite"


def row(pid="sec-7-B-I-C", text="<p>Owners shall inspect tanks.</p>", summary="Inspect tanks.",
        parent_id="sec-7-B-I", status="approved", juris="state"):
    return {"id": pid, "citation": "I.C.", "title": "Tanks", "parent_id": parent_id,
            "full_text": text, "ai_summary": summary, "summary_status": status,
            "jurisdiction_level": juris, "sort_order": 1}


# --- split_body -----------------------------------------------------------

def test_short_body_is_single_piece():
    assert split_body("short text") == ["short text"]


def test_long_body_chunks_with_overlap_and_covers_everything():
    words = [f"w{i}" for i in range(4000)]
    body = " ".join(words)                      # ~20k chars
    pieces = split_body(body)
    assert len(pieces) > 1
    assert all(len(p) <= MAX_CHUNK_CHARS for p in pieces)
    # every word appears in at least one piece, in order
    joined = " ".join(pieces)
    for w in words:
        assert w in joined
    # consecutive pieces overlap: the tail of piece i appears in piece i+1
    for a, b in zip(pieces, pieces[1:]):
        tail = a[-(CHUNK_OVERLAP_CHARS // 3):]
        assert tail.split()[-1] in b


def test_split_breaks_on_whitespace_not_mid_word():
    body = " ".join(["abcdefghij"] * 2000)
    for p in split_body(body):
        assert not p.startswith("bcdef")        # never starts mid-word
        assert p == p.strip()


# --- build_chunks ---------------------------------------------------------

def test_chunk0_has_header_summary_and_text():
    [c] = build_chunks(row(), {"id": "sec-7-B-I", "citation": "I.", "full_text": "<b>Applicability.</b> Storage tanks."}, MODEL)
    assert c.chunk_index == 0
    assert "Colorado regulation 7: I.C. — Tanks" in c.text
    assert "Under I.: Applicability. Storage tanks." in c.text
    assert "Summary: Inspect tanks." in c.text
    assert "Text: Owners shall inspect tanks." in c.text


def test_rejected_summary_is_excluded():
    [c] = build_chunks(row(status="rejected"), None, MODEL)
    assert "Summary:" not in c.text


def test_federal_header_and_only_chunk0_carries_summary():
    long_text = " ".join(["compressor"] * 3000)
    chunks = build_chunks(row(pid="sec-oooob-5390", text=long_text, juris="federal"), None, MODEL)
    assert len(chunks) > 1
    assert chunks[0].text.startswith("Federal regulation OOOOB:")
    assert "Summary:" in chunks[0].text
    assert all("Summary:" not in c.text for c in chunks[1:])
    assert all(c.text.startswith("Federal regulation OOOOB:") for c in chunks)
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_empty_text_still_yields_one_chunk():
    [c] = build_chunks(row(text="", summary=""), None, MODEL)
    assert c.chunk_index == 0 and "I.C." in c.text


# --- hashing --------------------------------------------------------------

def test_hash_is_stable_and_sensitive_to_text_and_model():
    a = content_hash("x", MODEL)
    assert a == content_hash("x", MODEL)
    assert a != content_hash("y", MODEL)
    assert a != content_hash("x", "voyage-3.5")


def test_plan_skips_unchanged_and_reembeds_changed():
    r1, r2 = row(pid="sec-7-A-1"), row(pid="sec-7-A-2")
    c1 = build_chunks(r1, None, MODEL)[0]
    existing = {(c1.provision_id, 0): c1.text_hash,          # unchanged
                ("sec-7-A-2", 0): "stale-hash"}               # changed
    stats = RunStats()
    todo, counts = plan_work([r1, r2], {}, existing, MODEL, force=False, stats=stats)
    assert [c.provision_id for c in todo] == ["sec-7-A-2"]
    assert stats.provisions_skipped_unchanged == 1
    assert counts == {"sec-7-A-1": 1, "sec-7-A-2": 1}


def test_force_reembeds_everything():
    r1 = row()
    c1 = build_chunks(r1, None, MODEL)[0]
    stats = RunStats()
    todo, _ = plan_work([r1], {}, {(c1.provision_id, 0): c1.text_hash}, MODEL, force=True, stats=stats)
    assert len(todo) == 1 and stats.provisions_skipped_unchanged == 0


def test_row_that_gained_a_chunk_is_reembedded():
    r = row(text=" ".join(["tank"] * 3000))
    chunks = build_chunks(r, None, MODEL)
    existing = {(chunks[0].provision_id, 0): chunks[0].text_hash}   # only chunk 0 on record
    todo, _ = plan_work([r], {}, existing, MODEL, force=False, stats=RunStats())
    assert len(todo) == len(chunks)


# --- batching / misc ------------------------------------------------------

def test_batches_respect_text_and_char_limits(monkeypatch):
    monkeypatch.setattr(embed, "VOYAGE_BATCH_TEXTS", 3)
    monkeypatch.setattr(embed, "VOYAGE_BATCH_CHARS", 25)
    chunks = [embed.Chunk(f"p{i}", 0, "x" * 10, "h") for i in range(7)]
    batches = list(batch_chunks(chunks))
    assert [len(b) for b in batches] == [2, 2, 2, 1]        # 25 chars → 2 texts of 10


def test_fetch_provisions_pages_on_id_and_dedupes(monkeypatch):
    """Paging on sort_order (non-unique across regs) returned duplicate rows in
    the first full-corpus run; ensure we page on id and drop repeats."""
    monkeypatch.setattr(embed, "DB_PAGE_SIZE", 2)
    pages = [[row(pid="sec-1-A"), row(pid="sec-1-B")],
             [row(pid="sec-1-B"), row(pid="sec-1-C")],   # overlap as PostgREST can return
             [row(pid="sec-1-D")]]
    orders: list[str] = []

    class Q:
        def __init__(self): self.i = None
        def select(self, *_): return self
        def like(self, *_): return self
        def order(self, col): orders.append(col); return self
        def range(self, start, end): self.i = start // 2; return self
        def execute(self):
            class R: data = pages[self.i] if self.i < len(pages) else []
            return R()

    class C:
        def table(self, *_): return Q()

    got = [r["id"] for r in embed.fetch_provisions(C(), None, None)]
    assert got == ["sec-1-A", "sec-1-B", "sec-1-C", "sec-1-D"]
    assert set(orders) == {"id"}


def test_upsert_collapses_duplicate_keys():
    calls = []

    class T:
        def upsert(self, rows, on_conflict): calls.append(rows); return self
        def execute(self): return None

    class C:
        def table(self, *_): return T()

    rows = [{"provision_id": "p", "chunk_index": 0, "v": 1},
            {"provision_id": "p", "chunk_index": 0, "v": 2},
            {"provision_id": "q", "chunk_index": 0, "v": 3}]
    embed.upsert_embeddings(C(), rows)
    sent = [r for batch in calls for r in batch]
    assert [(r["provision_id"], r["v"]) for r in sent] == [("p", 2), ("q", 3)]


def test_existing_hashes_pages_without_id_lists(monkeypatch):
    """Never put provision-id lists in the URL: a 500-id in.(...) filter of
    long ids returned HTTP 400. The index is paged straight through instead."""
    pages = [[{"provision_id": "sec-7-A", "chunk_index": 0, "chunk_text_hash": "h1"},
              {"provision_id": "sec-7-B", "chunk_index": 0, "chunk_text_hash": "h2"}],
             []]
    used: list[str] = []

    class Q:
        def __init__(self): self.i = 0
        def select(self, *_): return self
        def like(self, *_): used.append("like"); return self
        def in_(self, *_): used.append("in_"); return self
        def order(self, *_): return self
        def range(self, start, end): self.i = start // 1000; return self
        def execute(self):
            class R: data = pages[self.i] if self.i < len(pages) else []
            return R()

    class C:
        def table(self, *_): return Q()

    got = embed.fetch_existing_hashes(C(), ["sec-7-A", "sec-7-Z"], reg="7")
    assert got == {("sec-7-A", 0): "h1"}          # only ids in scope are kept
    assert "in_" not in used and "like" in used


def test_parent_lookups_use_small_id_batches(monkeypatch):
    monkeypatch.setattr(embed, "IN_BATCH", 3)
    sizes: list[int] = []

    class Q:
        def select(self, *_): return self
        def in_(self, col, vals): sizes.append(len(vals)); return self
        def execute(self):
            class R: data = []
            return R()

    class C:
        def table(self, *_): return Q()

    embed.fetch_parents(C(), [f"p{i}" for i in range(7)])
    assert sizes == [3, 3, 1]


def test_vector_literal_format():
    assert vector_literal([0.5, -1.0, 2]) == "[0.5,-1.0,2.0]"


def test_strip_html():
    assert strip_html("<p>a&nbsp;b</p>  <br>c") == "a b c"


def test_dry_run_estimate_never_needs_voyage_key(monkeypatch):
    monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "x")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "y")
    calls = {}

    class FakeClient:  # minimal stand-in for the supabase client
        pass

    def fake_fetch(client, reg, limit):
        return [row(pid="sec-7-A-1"), row(pid="sec-7-A-2", text=" ".join(["tank"] * 3000))]

    monkeypatch.setattr(embed, "make_supabase_client", lambda: FakeClient())
    monkeypatch.setattr(embed, "fetch_provisions", fake_fetch)
    monkeypatch.setattr(embed, "fetch_parents", lambda c, ids: {})
    monkeypatch.setattr(embed, "fetch_existing_hashes", lambda c, ids, reg=None: {})
    monkeypatch.setattr(embed, "VoyageClient",
                        lambda *a, **k: calls.setdefault("voyage", True) and (_ for _ in ()).throw(AssertionError("Voyage called in dry run")))
    rc = embed.main(["--dry-run", "--reg", "7"])
    assert rc == 0 and "voyage" not in calls
