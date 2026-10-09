"""Unit tests for pipeline/embed.py — chunking, hashing, batching, planning.

No network and no database: everything here runs on in-memory rows.
    python -m pytest pipeline/test_embed.py -q
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import embed  # noqa: E402
from embed import (
    cap_summary,  # noqa: E402
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


def test_summary_cap_cuts_at_a_sentence_boundary():
    from embed import SUMMARY_EMBED_CHARS, cap_summary
    short = "Inspect tanks. Report leaks."
    assert cap_summary(short) == short
    s1 = "A" * 300 + ". "            # sentence 1 ends at 301
    s2 = "B" * 250 + "! "            # sentence 2 ends at 553
    s3 = "C" * 200 + "."             # would run past 600
    capped = cap_summary(s1 + s2 + s3)
    assert capped == (s1 + s2).strip()
    assert len(capped) <= SUMMARY_EMBED_CHARS
    # a decimal point is not a sentence end
    assert cap_summary("x" * 590 + " 3.5 pct " + "y" * 100).endswith("x" * 590) is False
    # no sentence end and no clause end inside the window: last word break, never mid-word
    words = " ".join(["word"] * 200)
    capped = cap_summary(words)
    assert len(capped) <= SUMMARY_EMBED_CHARS and not capped.endswith("wor") and capped.endswith("word")
    # a closing quote or paren after the period stays with the sentence
    assert cap_summary("P" * 595 + ".) " + "Q" * 50) == "P" * 595 + ".)"


def test_summary_cap_falls_back_to_a_clause_boundary():
    # one long sentence of semicolon-separated triggers (ECMC 912.b.(1)): cut at
    # the last "; " inside the window, not inside a clause or a word
    clause = "any size spill that impacts or threatens waters, a public water system, or a residence; "  # 88
    summary = clause * 20
    capped = cap_summary(summary)
    assert capped.endswith("residence;")
    assert len(capped) <= 600
    assert summary.startswith(capped)
    assert capped == (clause * 6).strip()


def test_short_summary_yields_one_chunk():
    [c] = build_chunks(row(summary="Inspect tanks. Report leaks."), None, MODEL)
    assert c.chunk_index == 0 and "Summary: Inspect tanks. Report leaks." in c.text


def test_long_summary_adds_a_full_summary_chunk():
    long_summary = ("First sentence about storage vessels. " * 30).strip()   # ~1,100 chars
    parent = {"id": "sec-7-B-I", "citation": "I.", "full_text": "Applicability. Storage tanks."}
    chunks = build_chunks(row(summary=long_summary), parent, MODEL)
    assert [c.chunk_index for c in chunks] == [0, 1]
    c0, c1 = chunks
    embedded = c0.text.split("Summary: ", 1)[1].split("\nText:", 1)[0]
    assert len(embedded) <= 600
    assert embedded.endswith("vessels.")
    assert embedded == long_summary[: len(embedded)]
    assert "Text: Owners shall inspect tanks." in c0.text
    # the last chunk is the whole summary alone, with a self-describing header
    assert c1.text == f"Colorado regulation 7: I.C. — Tanks\nSummary: {long_summary}"
    assert "Text:" not in c1.text and "Under I.:" not in c1.text
    # chunk 0's hash ignores the tail past the cap; the summary chunk's does not
    chunks2 = build_chunks(row(summary=long_summary + " Trailing sentence that is past the cap."), parent, MODEL)
    assert chunks2[0].text_hash == c0.text_hash
    assert chunks2[1].text_hash != c1.text_hash


def test_long_summary_chunk_comes_after_the_text_chunks():
    long_text = " ".join(["compressor"] * 3000)
    long_summary = ("Compressors are inspected monthly. " * 30).strip()
    chunks = build_chunks(row(pid="sec-oooob-5390", text=long_text, summary=long_summary, juris="federal"), None, MODEL)
    assert len(chunks) >= 3
    assert "Summary:" in chunks[0].text and "Text:" in chunks[0].text
    assert all("Summary:" not in c.text and "Text:" in c.text for c in chunks[1:-1])
    assert chunks[-1].text == f"Federal regulation OOOOB: I.C. — Tanks\nSummary: {long_summary}"
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_rejected_long_summary_adds_no_chunk():
    [c] = build_chunks(row(status="rejected", summary="x. " * 400), None, MODEL)
    assert "Summary:" not in c.text


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
        def upsert(self, rows, on_conflict, returning=None): calls.append(rows); return self
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


def test_upsert_splits_page_on_statement_timeout(monkeypatch):
    """A page that hits the 8s statement timeout (57014) is halved and retried
    instead of failing the run."""
    monkeypatch.setattr(embed, "UPSERT_PAGE_SIZE", 4)
    sizes: list[int] = []

    class T:
        def __init__(self): self.rows = None
        def upsert(self, rows, on_conflict, returning=None): self.rows = rows; return self
        def execute(self):
            sizes.append(len(self.rows))
            if len(self.rows) > 2:
                raise RuntimeError("{'code': '57014', 'message': 'canceling statement due to statement timeout'}")
            return None

    class C:
        def table(self, *_): return T()

    rows = [{"provision_id": f"p{i}", "chunk_index": 0} for i in range(4)]
    embed.upsert_embeddings(C(), rows)
    assert sizes == [4, 2, 2]


# --- neighbour rebuild: adaptive batches + resume -------------------------

def _timeout():
    return RuntimeError("{'message': 'canceling statement due to statement timeout', 'code': '57014'}")


class _RpcClient:
    """Stub Supabase client whose `recompute_provision_neighbors` RPC fails
    according to `fail(batch, call_no)`; records every batch it was sent."""
    def __init__(self, fail):
        self.fail = fail
        self.calls: list[list[str]] = []
        self.ok: list[list[str]] = []

    def rpc(self, name, params):
        assert name == "recompute_provision_neighbors"
        batch = list(params["target_ids"])
        self.calls.append(batch)
        exc = self.fail(batch, len(self.calls))
        outer = self

        class R:
            def execute(self_inner):
                if exc is not None:
                    raise exc
                outer.ok.append(batch)

                class D:
                    data = len(batch) * 5
                return D()
        return R()


def _quiet(monkeypatch, batch=8, grow_after=2, max_retries=1):
    monkeypatch.setattr(embed, "NEIGHBOR_BATCH_IDS", batch)
    monkeypatch.setattr(embed, "NEIGHBOR_GROW_AFTER", grow_after)
    monkeypatch.setattr(embed, "NEIGHBOR_MAX_RETRIES", max_retries)
    monkeypatch.setattr(embed.time, "sleep", lambda *_: None)


def test_neighbors_halve_on_timeout_and_cover_every_id_once(monkeypatch):
    """Batches over the cache's comfort size (here 2) hit 57014; the loop
    halves and keeps going instead of retrying the same size and aborting."""
    _quiet(monkeypatch, batch=8, grow_after=100)
    ids = [f"p{i:02d}" for i in range(20)]
    c = _RpcClient(lambda b, _n: _timeout() if len(b) > 2 else None)
    total = embed.recompute_neighbors(c, ids)
    assert [len(b) for b in c.calls][:4] == [8, 4, 2, 2]
    assert max(len(b) for b in c.ok) == 2
    assert [i for b in c.ok for i in b] == ids          # every id exactly once, in order
    assert total == 20 * 5


def test_neighbors_grow_back_after_clean_streak(monkeypatch):
    """One cold timeout halves the batch; after NEIGHBOR_GROW_AFTER clean
    batches the size doubles back up to the ceiling."""
    _quiet(monkeypatch, batch=8, grow_after=2)
    ids = [f"p{i:02d}" for i in range(40)]
    c = _RpcClient(lambda b, n: _timeout() if n == 1 else None)
    embed.recompute_neighbors(c, ids)
    assert [len(b) for b in c.calls] == [8, 4, 4, 8, 8, 8, 8]
    assert [i for b in c.ok for i in b] == ids


def test_neighbors_single_id_timeout_raises_with_resume_point(monkeypatch):
    """A batch that is already one id cannot be halved: it is retried with
    backoff, then the run fails naming the last id that did complete so the
    rerun can --start-after it."""
    _quiet(monkeypatch, batch=2, max_retries=2)
    ids = ["a", "b", "c", "d"]
    c = _RpcClient(lambda b, _n: _timeout() if "c" in b else None)
    with pytest.raises(RuntimeError) as ei:
        embed.recompute_neighbors(c, ids)
    msg = str(ei.value)
    assert "--start-after b" in msg
    assert "starting at c (size 1)" in msg
    assert [len(b) for b in c.calls] == [2, 2, 1, 1, 1]  # ab ok; cd halves; c retried 1+2 times
    assert [i for b in c.ok for i in b] == ["a", "b"]


def test_neighbors_non_timeout_error_is_retried_then_raised(monkeypatch):
    _quiet(monkeypatch, batch=4, max_retries=2)
    ids = ["a", "b", "c", "d"]
    boom = RuntimeError("connection reset")
    c = _RpcClient(lambda b, n: boom if n == 1 else None)
    assert embed.recompute_neighbors(c, ids) == 20
    assert [len(b) for b in c.calls] == [4, 4]           # same size, not halved

    c2 = _RpcClient(lambda b, n: boom)
    with pytest.raises(RuntimeError) as ei:
        embed.recompute_neighbors(c2, ids)
    assert "failed 3 times" in str(ei.value)
    assert "rerun --neighbors-only from the start" in str(ei.value)


def test_neighbors_start_after_filters_server_side(monkeypatch):
    """--start-after becomes a `provision_id > X` filter on the id fetch, so a
    rerun never re-pages (or re-computes) the rows already done."""
    _quiet(monkeypatch, batch=4)
    filters: list[tuple] = []

    class Q:
        def __init__(self): self.after = None
        def select(self, *_): return self
        def eq(self, *_): return self
        def gt(self, col, val): filters.append((col, val)); self.after = val; return self
        def order(self, *_): return self
        def range(self, *_): return self
        def execute(self):
            rows = [{"provision_id": i} for i in ["a", "b", "c", "d", "e"] if self.after is None or i > self.after]

            class R: data = rows
            return R()

    class C(_RpcClient):
        def table(self, *_): return Q()

    c = C(lambda b, n: None)
    embed.recompute_neighbors(c, None, start_after="b")
    assert filters == [("provision_id", "b")]
    assert [i for b in c.ok for i in b] == ["c", "d", "e"]

    filters.clear()
    c = C(lambda b, n: None)
    embed.recompute_neighbors(c, None)
    assert filters == []
    assert [i for b in c.ok for i in b] == ["a", "b", "c", "d", "e"]


def test_neighbors_progress_line_names_last_completed_id(monkeypatch, capsys):
    _quiet(monkeypatch, batch=2)
    ids = ["a", "b", "c", "d", "e"]
    embed.recompute_neighbors(_RpcClient(lambda b, n: None), ids, log_every=2)
    out = capsys.readouterr().out
    assert "neighbours: 4/5 provisions  batch=2  last=d" in out
    assert "neighbours: 5/5 provisions  batch=2  last=e" in out
    assert "final batch 2" in out


def test_start_after_requires_neighbors_only():
    args = embed.parse_args(["--neighbors-only", "--start-after", "sec-gp09-IX-B"])
    assert args.start_after == "sec-gp09-IX-B"
    with pytest.raises(SystemExit):
        embed.parse_args(["--start-after", "sec-gp09-IX-B"])


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

    def fake_fetch(client, reg, limit, ids=None):
        return [row(pid="sec-7-A-1"), row(pid="sec-7-A-2", text=" ".join(["tank"] * 3000))]

    monkeypatch.setattr(embed, "make_supabase_client", lambda: FakeClient())
    monkeypatch.setattr(embed, "fetch_provisions", fake_fetch)
    monkeypatch.setattr(embed, "fetch_parents", lambda c, ids: {})
    monkeypatch.setattr(embed, "fetch_existing_hashes", lambda c, ids, reg=None: {})
    monkeypatch.setattr(embed, "VoyageClient",
                        lambda *a, **k: calls.setdefault("voyage", True) and (_ for _ in ()).throw(AssertionError("Voyage called in dry run")))
    rc = embed.main(["--dry-run", "--reg", "7"])
    assert rc == 0 and "voyage" not in calls


# --- strip rule: link markup never changes the embedded text (7 Oct 2026) --

def test_link_markup_is_unwrapped_without_a_space():
    plain = "<p>Engines may be subject to 40 CFR Part 63, Subpart ZZZZ (Subpart ZZZZ). See Section II.C.1.</p>"
    linked = ('<p>Engines may be subject to 40 CFR Part 63, <a class="xref-external-reg" href="/regulations/zzzz">'
              'Subpart ZZZZ</a> (<a class="xref-external-reg" href="/regulations/zzzz">Subpart ZZZZ</a>). '
              'See <span class="xref" data-target="sec-7-B-II-C-1">Section II.C.1</span>.</p>')
    assert strip_html(linked) == strip_html(plain)
    # the legacy rule put a space where each tag was, so the two differed
    assert embed.strip_html_legacy(linked) != embed.strip_html_legacy(plain)
    assert "( Subpart" in embed.strip_html_legacy(linked)


def test_method_anchor_is_unwrapped_so_a_relink_does_not_rehash():
    # The Test Methods re-link (9 Oct 2026) wraps "Method 21" in an
    # xref-method anchor; the embedded text, and so the hash, must not move.
    before = '<p>Conduct annual EPA Method 21 (August 3, 2017) inspections; see Methods 1\u20134.</p>'
    after = ('<p>Conduct annual <a class="xref-method" href="/test-methods/method-21">EPA Method 21</a> '
             '(August 3, 2017) inspections; see <a class="xref-method" href="/test-methods/method-1">Methods 1</a>'
             '\u2013<a class="xref-method" href="/test-methods/method-4">4</a>.</p>')
    assert embed.strip_html(after) == embed.strip_html(before)
    assert embed.strip_html(after) == "Conduct annual EPA Method 21 (August 3, 2017) inspections; see Methods 1\u20134."


def test_sic_marker_span_is_unwrapped_and_other_tags_still_separate():
    html = ('<p>Break<span class="er-sic" title="Printed this way."> [sic]</span> specific fuel</p>'
            '<table><tr><td>NO<sub>X</sub></td><td>g/hp-hr</td></tr></table>')
    text = strip_html(html)
    assert "Break [sic] specific fuel" in text
    assert "NO X g/hp-hr" in text          # cells and sub/sup still separated by a space


def test_markup_only_change_keeps_the_hash_and_plan_skips_it():
    before = row(text="<p>Owners shall comply with Subpart ZZZZ of Part 63, Section II.C.1.</p>")
    after = row(text=('<p>Owners shall comply with <a class="xref-external-reg" href="/regulations/zzzz">'
                      'Subpart ZZZZ</a> of Part 63, <span class="xref" data-target="x">Section II.C.1</span>.</p>'))
    [c_before] = build_chunks(before, None, MODEL)
    [c_after] = build_chunks(after, None, MODEL)
    assert c_before.text_hash == c_after.text_hash
    todo, _ = plan_work([after], {}, {(c_before.provision_id, 0): c_before.text_hash}, MODEL,
                        force=False, stats=RunStats())
    assert todo == []


def test_parent_link_markup_does_not_change_the_child_hash():
    parent_plain = {"id": "sec-7-B-I", "citation": "I.", "full_text": "<p>Part B applies to Regulation 7 sources.</p>"}
    parent_linked = {"id": "sec-7-B-I", "citation": "I.",
                     "full_text": '<p>Part B applies to <a class="xref-external-reg" href="/regulations/7">Regulation 7</a> sources.</p>'}
    child = row()
    assert build_chunks(child, parent_plain, MODEL)[0].text_hash == build_chunks(child, parent_linked, MODEL)[0].text_hash


# --- --rehash planning ---------------------------------------------------

def test_plan_rehash_classifies_legacy_current_and_stale():
    linked = row(pid="sec-7-A-1", text='<p>See (<a class="xref-external-reg" href="/regulations/8">Regulation 8</a>).</p>')
    plain = row(pid="sec-7-A-2", text="<p>No links here.</p>")
    changed = row(pid="sec-7-A-3", text="<p>Text that changed since it was embedded.</p>")
    never = row(pid="sec-7-A-4")
    legacy_hash = build_chunks(linked, None, MODEL, strip=embed.strip_html_legacy)[0].text_hash
    new_hash = build_chunks(linked, None, MODEL)[0].text_hash
    assert legacy_hash != new_hash
    plain_hash = build_chunks(plain, None, MODEL)[0].text_hash
    assert build_chunks(plain, None, MODEL, strip=embed.strip_html_legacy)[0].text_hash == plain_hash
    existing = {("sec-7-A-1", 0): legacy_hash, ("sec-7-A-2", 0): plain_hash, ("sec-7-A-3", 0): "something-else"}
    plan = embed.plan_rehash([linked, plain, changed, never], {}, existing, MODEL)
    assert plan.updates == [("sec-7-A-1", 0, legacy_hash, new_hash)]
    assert plan.current == 1
    assert plan.stale == [("sec-7-A-3", 0), ("sec-7-A-4", 0)]
    # after the rewrite, a normal plan finds nothing to embed for the linked row
    todo, _ = plan_work([linked, plain], {}, {("sec-7-A-1", 0): new_hash, ("sec-7-A-2", 0): plain_hash}, MODEL,
                        force=False, stats=RunStats())
    assert todo == []


def test_apply_rehash_batches_through_the_rpc_and_matches_on_the_old_hash(monkeypatch):
    monkeypatch.setattr(embed, "REHASH_BATCH", 2)
    calls: list[dict] = []

    class R:
        def __init__(self, data): self.data = data
        def execute(self): return self

    class C:
        def rpc(self, name, params):
            assert name == "provision_embeddings_rehash"
            calls.append(params)
            return R(len(params["changes"]))

    n = embed.apply_rehash(C(), [("a", 0, "o1", "n1"), ("b", 1, "o2", "n2"), ("c", 0, "o3", "n3")])
    assert n == 3
    assert [len(c["changes"]) for c in calls] == [2, 1]
    assert calls[0]["changes"][0] == {"provision_id": "a", "chunk_index": 0, "old_hash": "o1", "new_hash": "n1"}


def test_rehash_needs_no_voyage_key_and_excludes_force(monkeypatch):
    args = embed.parse_args(["--rehash", "--dry-run"])
    assert args.rehash and args.dry_run
    with pytest.raises(SystemExit):
        embed.parse_args(["--rehash", "--force"])
