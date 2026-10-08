"""Unit tests for pipeline/review.py -- the automated AI second-pass review.

Everything runs against in-memory stubs: a fake supabase-py client that
answers the exact query chains review.py builds and records every write,
and a fake Anthropic client whose batches return canned verdicts. No
network, no database, no paid call.

Covers: selection (pending-only, approved never selected, --ids filtering,
reg prefix, limit, pagination), input assembly parity with the summarizer,
each verdict's writes, malformed output, resumability (rows a run failed on
are selected again; a run that submitted a batch can consume it later), and
the dry-run quote.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import review  # noqa: E402
import summarize as sz  # noqa: E402


# --------------------------------------------------------------------------
# Fake Supabase
# --------------------------------------------------------------------------

class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    """Enough of supabase-py's query builder for review.py and the
    summarizer helpers it calls (fetch_meta): select/eq/like/in_/not_.is_/
    order/range, update/insert, execute."""

    def __init__(self, db: "FakeSupabase", table: str):
        self.db = db
        self.table_name = table
        self.op = "select"
        self.payload = None
        self.filters: list = []
        self.orders: list = []
        self.rng = None
        self._negate = False

    # --- building ----------------------------------------------------------
    def select(self, cols):
        self.op = "select"
        self.cols = cols
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self

    def insert(self, payload):
        self.op = "insert"
        self.payload = payload
        return self

    @property
    def not_(self):
        self._negate = True
        return self

    def is_(self, col, val):
        neg = self._negate
        self._negate = False
        assert val == "null"
        self.filters.append(lambda r: (r.get(col) is not None) if neg else (r.get(col) is None))
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def like(self, col, pattern):
        prefix = pattern.rstrip("%")
        self.filters.append(lambda r: str(r.get(col, "")).startswith(prefix))
        return self

    def in_(self, col, values):
        vals = set(values)
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def order(self, col):
        self.orders.append(col)
        return self

    def range(self, start, end):
        self.rng = (start, end)
        return self

    # --- executing ---------------------------------------------------------
    def _matching(self):
        rows = [r for r in self.db.tables[self.table_name] if all(f(r) for f in self.filters)]
        if self.orders:
            rows.sort(key=lambda r: tuple((r.get(c) is None, r.get(c) or 0 if c == "sort_order" else r.get(c) or "")
                                          for c in self.orders))
        return rows

    def execute(self):
        self.db.queries.append(self)
        if self.op == "select":
            rows = self._matching()
            if self.rng:
                rows = rows[self.rng[0]:self.rng[1] + 1]
            return _Result([dict(r) for r in rows])
        if self.op == "update":
            rows = self._matching()
            for r in rows:
                r.update(self.payload)
            self.db.writes.append((self.table_name, "update", dict(self.payload), [r["id"] for r in rows]))
            return _Result([dict(r) for r in rows])
        if self.op == "insert":
            self.db.tables.setdefault(self.table_name, []).append(dict(self.payload))
            self.db.writes.append((self.table_name, "insert", dict(self.payload), None))
            return _Result([dict(self.payload)])
        raise AssertionError(self.op)


class _Rpc:
    def __init__(self, db: "FakeSupabase", name: str, params: dict):
        self.db, self.name, self.params = db, name, params

    def execute(self):
        assert self.name == "snapshot_summaries_for_rereview", self.name
        ids = set(self.params["p_ids"])
        have = {r["id"] for r in self.db.tables["archive_snapshot"]}
        added = 0
        for r in self.db.tables["provisions"]:
            if r["id"] in ids and r["id"] not in have:        # on conflict (id) do nothing
                self.db.tables["archive_snapshot"].append({
                    k: r.get(k) for k in ("id", "ai_summary", "summary_original", "summary_status",
                                          "reviewed_by", "reviewed_at", "summary_model")}
                    | {"run_label": self.params.get("p_run_label")})
                added += 1
        self.db.rpc_calls.append((self.name, dict(self.params), len(self.db.writes)))
        return _Result(added)


class FakeSupabase:
    def __init__(self, provisions: list[dict]):
        self.tables = {"provisions": [dict(r) for r in provisions], "provision_changes": [],
                       "archive_snapshot": []}
        self.writes: list = []
        self.queries: list = []
        self.rpc_calls: list = []       # (name, params, number of writes made before the call)

    def table(self, name):
        return _Query(self, name)

    def rpc(self, name, params):
        return _Rpc(self, name, params)

    def row(self, provision_id: str) -> dict:
        return next(r for r in self.tables["provisions"] if r["id"] == provision_id)

    @property
    def changes(self):
        return self.tables["provision_changes"]


# --------------------------------------------------------------------------
# Fake Anthropic
# --------------------------------------------------------------------------

class _Usage:
    def __init__(self, i=1000, o=100, cache_read=0, cache_create=0):
        self.input_tokens = i
        self.output_tokens = o
        self.cache_read_input_tokens = cache_read
        self.cache_creation_input_tokens = cache_create


class _Block:
    type = "text"

    def __init__(self, text):
        self.text = text


class _Message:
    def __init__(self, text, stop_reason="end_turn", i=1000, o=100, cache_read=0, cache_create=0):
        self.content = [_Block(text)]
        self.stop_reason = stop_reason
        self.usage = _Usage(i, o, cache_read, cache_create)


class _Outcome:
    def __init__(self, message=None, type_="succeeded", error=None):
        self.type = type_
        self.message = message
        self.error = error


class _Item:
    def __init__(self, custom_id, outcome):
        self.custom_id = custom_id
        self.result = outcome


class _Counts:
    succeeded = errored = canceled = expired = 0


class _Batch:
    def __init__(self, batch_id, requests):
        self.id = batch_id
        self.processing_status = "in_progress"
        self.request_counts = _Counts()
        self.requests = requests


class FakeBatches:
    """answers: provision id -> JSON text (or a _Message / _Outcome) the
    batch returns for that row."""

    def __init__(self, answers: dict, parent: "FakeAnthropic"):
        self.answers = answers
        self.parent = parent
        self.created: list[_Batch] = []
        self.canceled: list[str] = []
        self.n = 0

    def create(self, requests):
        self.n += 1
        batch = _Batch(f"msgbatch_{self.n}", list(requests))
        self.created.append(batch)
        return batch

    def retrieve(self, batch_id):
        batch = next(b for b in self.created if b.id == batch_id)
        batch.processing_status = "ended"
        return batch

    def cancel(self, batch_id):
        self.canceled.append(batch_id)

    def results(self, batch_id):
        batch = next(b for b in self.created if b.id == batch_id)
        for req in batch.requests:
            pid = self.parent.custom_id_map[req["custom_id"]]
            answer = self.answers.get(pid)
            if isinstance(answer, _Outcome):
                yield _Item(req["custom_id"], answer)
            elif isinstance(answer, _Message):
                yield _Item(req["custom_id"], _Outcome(answer))
            else:
                text = answer if isinstance(answer, str) else json.dumps(answer)
                yield _Item(req["custom_id"], _Outcome(_Message(text)))


class FakeMessages:
    def __init__(self, answers, parent):
        self.batches = FakeBatches(answers, parent)
        self.count_calls: list[dict] = []
        self.create_calls: list[dict] = []

    def count_tokens(self, **kwargs):
        self.count_calls.append(kwargs)
        return type("R", (), {"input_tokens": 1234})()

    def create(self, **kwargs):
        self.create_calls.append(kwargs)
        for removed in ("temperature", "top_p", "top_k"):
            assert removed not in kwargs, f"{removed} must go through extra_body on anthropic 1.x"
        raise AssertionError("sync path not used by these tests")


class FakeAnthropic:
    def __init__(self, answers: dict):
        self.messages = FakeMessages(answers, self)
        self.custom_id_map: dict[str, str] = {}


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

LONG = ("The owner or operator must keep records of each inspection for five years and make them "
        "available to the Division on request. ") * 3

PENDING_PASS = "pass-row"


def _rows():
    """A small regulation: root, part, a parent with two children, a leaf,
    and one approved and one rejected row that must never be touched."""
    return [
        {"id": "sec-7-top-REG-7", "citation": "Regulation 7", "title": "Oil and gas", "parent_id": None,
         "full_text": "<p>Regulation Number 7</p>", "sort_order": 0, "ai_summary": None,
         "summary_status": "pending", "summary_original": None, "summary_model": None},
        {"id": "sec-7-B-PART-B", "citation": "Part B", "title": "Oil and gas", "parent_id": "sec-7-top-REG-7",
         "full_text": "<p>Part B</p>", "sort_order": 1, "ai_summary": None,
         "summary_status": "pending", "summary_original": None, "summary_model": None},
        {"id": "sec-7-B-I-C", "citation": "I.C.", "title": "Inspections", "parent_id": "sec-7-B-PART-B",
         "full_text": "<p>Owners must comply with one of the following:</p>", "sort_order": 2,
         "ai_summary": "Owners must inspect every 500 hp engine quarterly and keep records for five years.",
         "summary_status": "pending", "summary_original": None, "summary_model": "claude-sonnet-4-5"},
        {"id": "sec-7-B-I-C-1", "citation": "I.C.1.", "title": "", "parent_id": "sec-7-B-I-C",
         "full_text": "<p>Inspect every engine rated above 400 horsepower once per calendar quarter.</p>",
         "sort_order": 3, "ai_summary": "Quarterly inspections of engines above 400 hp.",
         "summary_status": "approved", "summary_original": None, "summary_model": "claude-sonnet-4-5",
         "reviewed_by": "Claude (AI second-pass review, per owner instruction 2026-09-14)"},
        {"id": "sec-7-B-I-C-2", "citation": "I.C.2.", "title": "", "parent_id": "sec-7-B-I-C",
         "full_text": f"<p>{LONG}</p>", "sort_order": 4,
         "ai_summary": "Keep inspection records for five years and show them to the Division when asked.",
         "summary_status": "pending", "summary_original": "an original a reviewer kept",
         "summary_model": "claude-sonnet-4-5"},
        {"id": "sec-7-B-I-D", "citation": "I.D.", "title": "Rejected", "parent_id": "sec-7-B-PART-B",
         "full_text": f"<p>{LONG}</p>", "sort_order": 5, "ai_summary": "Rejected summary.",
         "summary_status": "rejected", "summary_original": None, "summary_model": "claude-sonnet-4-5"},
        {"id": "sec-3-A-I-B", "citation": "I.B.", "title": "Reg 3 row", "parent_id": None,
         "full_text": f"<p>{LONG}</p>", "sort_order": 6, "ai_summary": "Reg 3 summary about records.",
         "summary_status": "pending", "summary_original": None, "summary_model": "claude-sonnet-4-5"},
        {"id": "sec-3-A-I-C", "citation": "I.C.", "title": "No summary yet", "parent_id": None,
         "full_text": f"<p>{LONG}</p>", "sort_order": 7, "ai_summary": None,
         "summary_status": "pending", "summary_original": None, "summary_model": None},
    ]


@pytest.fixture
def db():
    return FakeSupabase(_rows())


def _meta(db):
    meta = sz.fetch_meta(db, None)
    return meta, sz.build_children_index(meta)


def _review_for(db, provision_id):
    meta, idx = _meta(db)
    return review.build_review_input(db.row(provision_id), meta, idx)


def _pass():
    return {"findings": [], "verdict": "pass", "corrected_summary": "", "changes": [], "fail_reason": ""}


def _corrected(text, reason="the text says 400 horsepower, not 500"):
    return {"findings": [{"claim": "500 hp", "problem": "text says above 400 horsepower"}],
            "verdict": "corrected", "corrected_summary": text,
            "changes": [{"before": "500 hp", "after": "above 400 hp", "reason": reason}], "fail_reason": ""}


def _fail(reason="summary describes the wrong provision"):
    return {"findings": [], "verdict": "fail", "corrected_summary": "", "changes": [], "fail_reason": reason}


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

def test_selection_is_pending_rows_with_a_summary_only(db):
    ids = [r["id"] for r in review.iter_candidates(db, None, None)]
    assert ids == ["sec-7-B-I-C", "sec-7-B-I-C-2", "sec-3-A-I-B"]
    # never: approved, rejected, or pending-without-a-summary
    assert "sec-7-B-I-C-1" not in ids and "sec-7-B-I-D" not in ids and "sec-3-A-I-C" not in ids


def test_selection_by_reg_prefix_and_limit(db):
    assert [r["id"] for r in review.iter_candidates(db, "7", None)] == ["sec-7-B-I-C", "sec-7-B-I-C-2"]
    assert [r["id"] for r in review.iter_candidates(db, "3", None)] == ["sec-3-A-I-B"]
    assert [r["id"] for r in review.iter_candidates(db, None, 1)] == ["sec-7-B-I-C"]


def test_selection_by_ids_drops_approved_and_unknown(db, capsys):
    ids = [r["id"] for r in review.iter_candidates(
        db, None, None, ids=["sec-7-B-I-C-1", "sec-3-A-I-B", "sec-7-B-I-C", "sec-does-not-exist"])]
    # file order, approved row and unknown id left alone
    assert ids == ["sec-3-A-I-B", "sec-7-B-I-C"]
    err = capsys.readouterr().err
    assert "sec-7-B-I-C-1" in err and "sec-does-not-exist" in err


def test_selection_paginates_past_the_page_size(monkeypatch):
    rows = []
    for i in range(review.DB_PAGE_SIZE * 2 + 7):
        rows.append({"id": f"sec-9-A-{i:04d}", "citation": str(i), "title": "", "parent_id": None,
                     "full_text": f"<p>{LONG}</p>", "sort_order": i, "ai_summary": "s",
                     "summary_status": "pending" if i % 3 else "approved", "summary_original": None,
                     "summary_model": "m"})
    fake = FakeSupabase(rows)
    got = [r["id"] for r in review.iter_candidates(fake, None, None)]
    expected = [r["id"] for r in rows if r["summary_status"] == "pending"]
    assert got == expected
    assert len(got) > review.DB_PAGE_SIZE


def test_selection_carries_the_columns_the_writes_need(db):
    row = next(review.iter_candidates(db, "7", 1))
    for col in ("ai_summary", "summary_original", "summary_status", "full_text", "parent_id", "sort_order"):
        assert col in row


# --------------------------------------------------------------------------
# Input assembly parity with the summarizer
# --------------------------------------------------------------------------

def test_official_text_is_byte_identical_to_the_summarizer_prompt(db):
    meta, idx = _meta(db)
    row = db.row("sec-7-B-I-C")
    ours, info = review.build_official_text(row, meta, idx)
    block, _ = review.build_ancestor_block(row, meta)
    theirs = sz.build_prompt(row, meta, idx, context_block=block)
    assert ours.prompt == theirs.prompt
    # Since 6 Oct 2026 the writer's own prompt IS the reviewer's text: the
    # same ancestor block, no separate parent excerpt anywhere.
    plain = sz.build_prompt(row, meta, idx)
    assert plain.prompt == ours.prompt
    assert "Parent paragraph text" not in ours.prompt
    assert review.ANCESTOR_BLOCK_HEADING in ours.prompt and info["shown"] >= 1
    assert ours.descendant_count == theirs.descendant_count == 2
    assert ours.truncated == theirs.truncated
    assert ours.outline_mode == theirs.outline_mode


def test_review_prompt_holds_the_text_block_and_the_current_summary(db):
    r = _review_for(db, "sec-7-B-I-C")
    assert r.prompt.startswith("OFFICIAL TEXT")
    assert "Provisions inside this one" in r.prompt
    assert "above 400 horsepower" in r.prompt                 # descendant body present
    assert r.prompt.rstrip().endswith(db.row("sec-7-B-I-C")["ai_summary"])
    assert r.system == review.REVIEW_SYSTEM_PROMPT
    # nothing else: no regulation hint, no summarizer system prompt
    assert sz.SYSTEM_PROMPT not in r.prompt and sz.SYSTEM_PROMPT not in r.system


def test_truncation_rule_is_the_summarizers(monkeypatch, db):
    monkeypatch.setattr(sz, "MAX_PROMPT_WORDS", 10)
    r = _review_for(db, "sec-7-B-I-C-2")
    assert r.text_result.truncated
    assert "truncated to the first 10" in r.prompt
    meta, idx = _meta(db)
    theirs = sz.build_prompt(db.row("sec-7-B-I-C-2"), meta, idx,
                             context_block=review.build_ancestor_block(db.row("sec-7-B-I-C-2"), meta)[0])
    assert theirs.prompt in r.prompt


def test_outline_rule_is_the_summarizers(monkeypatch, db):
    monkeypatch.setattr(sz, "CHILD_TEXT_WORDS", 5)
    r = _review_for(db, "sec-7-B-I-C")
    assert r.text_result.outline_mode
    assert "bodies omitted for length" in r.prompt


# --------------------------------------------------------------------------
# Request params
# --------------------------------------------------------------------------

def test_request_params_temperature_model(db):
    r = _review_for(db, "sec-3-A-I-B")
    p = review.request_params(r, "claude-sonnet-4-5")
    assert p["temperature"] == 0 and "effort" not in p["output_config"]
    assert p["output_config"]["format"]["type"] == "json_schema"
    assert p["messages"][0]["content"] == r.prompt and p["system"][0]["text"] == review.REVIEW_SYSTEM_PROMPT


def test_request_params_thinking_model(db):
    r = _review_for(db, "sec-3-A-I-B")
    p = review.request_params(r, "claude-sonnet-5-5", effort="low")
    assert "temperature" not in p
    assert p["output_config"]["effort"] == "low"
    assert p["output_config"]["format"]["schema"] == review.VERDICT_SCHEMA


# --------------------------------------------------------------------------
# Verdict validation
# --------------------------------------------------------------------------

def test_pass_verdict(db):
    r = _review_for(db, "sec-3-A-I-B")
    v = review.validate_verdict(_pass(), r)
    assert v.verdict == "pass"


def test_pass_on_hedging_summary_with_descendants_is_a_fail(db):
    db.row("sec-7-B-I-C")["ai_summary"] = "Owners must comply; the text does not show what the methods are."
    r = _review_for(db, "sec-7-B-I-C")
    v = review.validate_verdict(_pass(), r)
    assert v.verdict == "fail" and "silent" in v.reason


def test_pass_on_hedging_leaf_is_left_to_the_reviewer(db):
    db.row("sec-3-A-I-B")["ai_summary"] = "The equation itself is not stated in the available text."
    r = _review_for(db, "sec-3-A-I-B")
    assert review.validate_verdict(_pass(), r).verdict == "pass"


def test_corrected_verdict(db):
    r = _review_for(db, "sec-7-B-I-C")
    v = review.validate_verdict(_corrected(
        "Owners must inspect every engine above 400 hp quarterly and keep records for five years."), r)
    assert v.verdict == "corrected"
    assert v.corrected_summary.startswith("Owners must inspect every engine above 400 hp")
    assert v.reasons_note == "the text says 400 horsepower, not 500"


@pytest.mark.parametrize("data, needle", [
    ("not json at all", "not JSON"),
    ("[1, 2]", "not an object"),
    ({"verdict": "maybe"}, "verdict"),
    ({**_pass(), "findings": "none"}, "findings"),
    ({**_corrected(""), }, "empty corrected_summary"),
    ({**_corrected("Owners must inspect every 500 hp engine quarterly and keep records for five years.")},
     "identical"),
    ({**_corrected("Owners must inspect engines above 400 hp quarterly")}, "terminal punctuation"),
    ({**_corrected("- Owners must inspect engines above 400 hp quarterly.")}, "markdown"),
    ({**_corrected("Owners must inspect engines above 400 hp quarterly.\n1. Records for five years.")}, "markdown"),
    ({**_corrected("Owners must inspect engines above 400 hp quarterly."), "changes": []}, "changes"),
    ({**_corrected("Owners must inspect engines above 400 hp quarterly.", reason="")}, "no reason"),
    ({**_corrected(("Owners must inspect engines above 400 hp quarterly. " * 12).strip())}, "rewrite"),
    ({**_corrected("Owners must comply with the methods; the text does not specify them.")}, "silent"),
])
def test_malformed_or_invalid_output_is_a_fail(db, data, needle):
    r = _review_for(db, "sec-7-B-I-C")
    if isinstance(data, str):
        v = review.verdict_from_message(_Message(data), r)
    else:
        v = review.validate_verdict(data, r)
    assert v.verdict == "fail", v
    assert needle.lower() in v.reason.lower(), v.reason


def test_cut_off_and_refusal_are_fails(db):
    r = _review_for(db, "sec-3-A-I-B")
    assert review.verdict_from_message(_Message(json.dumps(_pass()), stop_reason="max_tokens"), r).verdict == "fail"
    assert review.verdict_from_message(_Message("", stop_reason="refusal"), r).reason == "model refusal"
    assert "empty" in review.verdict_from_message(_Message(""), r).reason


def test_fail_verdict_keeps_the_models_reason(db):
    r = _review_for(db, "sec-3-A-I-B")
    v = review.validate_verdict(_fail("text truncated"), r)
    assert v.verdict == "fail" and v.reason == "text truncated"
    assert review.validate_verdict(_fail(""), r).reason == "unspecified"


def test_code_fenced_json_is_tolerated(db):
    r = _review_for(db, "sec-3-A-I-B")
    v = review.verdict_from_message(_Message("```json\n" + json.dumps(_pass()) + "\n```"), r)
    assert v.verdict == "pass"


# --------------------------------------------------------------------------
# Writes per verdict
# --------------------------------------------------------------------------

def test_pass_writes_approved_reviewed_by_and_a_change_row(db):
    r = _review_for(db, "sec-3-A-I-B")
    out = review.apply_verdict(db, db.row("sec-3-A-I-B"), r, review.Verdict("pass"), "claude-sonnet-5-5",
                               date="2026-10-05")
    assert out == "approved"
    row = db.row("sec-3-A-I-B")
    assert row["summary_status"] == "approved"
    assert row["reviewed_by"] == "Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, 2026-10-05)"
    assert row["reviewed_at"]
    assert row["ai_summary"] == "Reg 3 summary about records."       # text untouched
    assert row["summary_original"] is None                           # untouched
    assert db.changes == [{"provision_id": "sec-3-A-I-B", "change_type": "summary_approved",
                           "note": "AI second-pass review (automated pipeline, claude-sonnet-5-5): pass"}]


def test_corrected_writes_new_text_keeps_original_and_logs_reasons(db):
    r = _review_for(db, "sec-7-B-I-C")
    v = review.validate_verdict(_corrected(
        "Owners must inspect every engine above 400 hp quarterly and keep records for five years."), r)
    out = review.apply_verdict(db, db.row("sec-7-B-I-C"), r, v, "claude-sonnet-5-5", date="2026-10-05")
    assert out == "corrected"
    row = db.row("sec-7-B-I-C")
    assert row["ai_summary"] == "Owners must inspect every engine above 400 hp quarterly and keep records for five years."
    assert row["summary_original"] == "Owners must inspect every 500 hp engine quarterly and keep records for five years."
    assert row["summary_status"] == "approved"
    assert row["reviewed_by"] == ("Claude (AI second-pass review; summary corrected, automated pipeline, "
                                  "claude-sonnet-5-5, 2026-10-05)")
    assert db.changes[0]["change_type"] == "summary_edited"
    assert db.changes[0]["note"].endswith("the text says 400 horsepower, not 500")


def test_corrected_never_overwrites_an_existing_summary_original(db):
    r = _review_for(db, "sec-7-B-I-C-2")
    v = review.validate_verdict(_corrected(
        "Keep inspection records for five years and make them available to the Division on request."), r)
    review.apply_verdict(db, db.row("sec-7-B-I-C-2"), r, v, "m")
    assert db.row("sec-7-B-I-C-2")["summary_original"] == "an original a reviewer kept"


def test_fail_writes_nothing(db):
    before = json.dumps(db.tables, sort_keys=True)
    r = _review_for(db, "sec-3-A-I-B")
    assert review.apply_verdict(db, db.row("sec-3-A-I-B"), r, review.Verdict("fail", reason="x"), "m") == "failed"
    assert json.dumps(db.tables, sort_keys=True) == before
    assert db.writes == []


def test_write_is_skipped_when_the_row_is_no_longer_pending(db):
    r = _review_for(db, "sec-3-A-I-B")
    db.row("sec-3-A-I-B")["summary_status"] = "approved"   # an admin got there first
    db.row("sec-3-A-I-B")["reviewed_by"] = "admin@example.com"
    out = review.apply_verdict(db, db.row("sec-3-A-I-B"), r, review.Verdict("pass"), "m")
    assert out == "skipped_not_pending"
    assert db.row("sec-3-A-I-B")["reviewed_by"] == "admin@example.com"
    assert db.changes == []


def test_every_reviewed_by_satisfies_corpus_qa_check_21():
    for verdict in ("pass", "corrected"):
        assert review.reviewed_by_for(verdict, "claude-sonnet-5-5").startswith("Claude (")


# --------------------------------------------------------------------------
# End to end through the batch path (execute), resumability
# --------------------------------------------------------------------------

def _run(db, answers, argv, monkeypatch, tmp_path):
    fake_anthropic = FakeAnthropic(answers)
    monkeypatch.setattr(sz, "make_supabase_client", lambda: db)
    monkeypatch.setattr(review, "FAILED_LOG_PATH", tmp_path / "review_failed.jsonl")
    monkeypatch.setattr(review, "OUT_DIR", tmp_path / "out")
    monkeypatch.setattr(review, "REPORT_MD_PATH", tmp_path / "out" / "review_report.md")
    monkeypatch.setattr(review, "REPORT_JSON_PATH", tmp_path / "out" / "review_report.json")
    monkeypatch.setattr(review.time, "sleep", lambda s: None)
    monkeypatch.setenv("SUPABASE_URL", "x")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")

    import types
    fake_module = types.SimpleNamespace(Anthropic=lambda api_key: fake_anthropic)
    monkeypatch.setitem(sys.modules, "anthropic", fake_module)

    # make_custom_id is deterministic; mirror it so the fake batch can map back
    real_make = sz.make_custom_id

    def tracking_make(pid, used):
        cid = real_make(pid, used)
        fake_anthropic.custom_id_map[cid] = pid
        return cid
    monkeypatch.setattr(sz, "make_custom_id", tracking_make)

    rc = review.main(argv)
    report = json.loads((tmp_path / "out" / "review_report.json").read_text())
    return rc, fake_anthropic, report


def test_execute_batch_end_to_end(db, monkeypatch, tmp_path):
    answers = {
        "sec-7-B-I-C": _corrected("Owners must inspect every engine above 400 hp quarterly and keep records for five years."),
        "sec-7-B-I-C-2": _pass(),
        "sec-3-A-I-B": "this is not json",
    }
    rc, fake, report = _run(db, answers, ["--execute"], monkeypatch, tmp_path)
    assert rc == 0
    assert report["counts"] == {"selected": 3, "pass": 1, "corrected": 1, "fail": 1, "skipped_not_pending": 0,
                                "api_errors": 0, "restored": 0, "corrected_same": 0, "corrected_different": 0,
                                "truncated_rows": 0, "outline_rows": 0, "with_descendants": 1}
    assert report["by_regulation"]["7"] == {"selected": 2, "pass": 1, "corrected": 1, "fail": 0}
    assert report["by_regulation"]["3"] == {"selected": 1, "pass": 0, "corrected": 0, "fail": 1}
    assert db.row("sec-7-B-I-C")["summary_status"] == "approved"
    assert db.row("sec-7-B-I-C-2")["summary_status"] == "approved"
    assert db.row("sec-3-A-I-B")["summary_status"] == "pending"           # fail: no change
    assert db.row("sec-7-B-I-C-1")["reviewed_by"].startswith("Claude (AI second-pass review, per owner")  # approved row untouched
    assert db.row("sec-7-B-I-D")["summary_status"] == "rejected"
    assert report["usage"]["input_tokens"] == 3000 and report["usage"]["output_tokens"] == 300
    assert report["failed"][0]["id"] == "sec-3-A-I-B" and "malformed" in report["failed"][0]["reason"]
    assert report["corrected"][0]["before"].startswith("Owners must inspect every 500 hp")
    assert report["run"]["model"] == review.DEFAULT_MODEL and report["run"]["prompt_version"] == review.REVIEW_PROMPT_VERSION
    # the batch request carried the structured-output schema and the right sampling control
    params = fake.messages.batches.created[0].requests[0]["params"]
    assert params["output_config"]["format"]["schema"] == review.VERDICT_SCHEMA
    assert params["output_config"]["effort"] == "low" and "temperature" not in params
    assert (tmp_path / "review_failed.jsonl").read_text().count("\n") == 1


def test_rerun_selects_only_what_the_first_run_left_pending(db, monkeypatch, tmp_path):
    answers = {"sec-7-B-I-C": _fail("cannot verify"), "sec-7-B-I-C-2": _pass(), "sec-3-A-I-B": _pass()}
    _run(db, answers, ["--execute"], monkeypatch, tmp_path)
    assert [r["id"] for r in review.iter_candidates(db, None, None)] == ["sec-7-B-I-C"]
    # second run: the failed row gets another go and nothing approved is re-selected
    rc, fake, report = _run(db, {"sec-7-B-I-C": _pass()}, ["--execute"], monkeypatch, tmp_path)
    assert report["counts"]["selected"] == 1 and report["counts"]["pass"] == 1
    assert len(fake.messages.batches.created[0].requests) == 1
    assert list(review.iter_candidates(db, None, None)) == []
    # exactly one summary_approved change row per approved row
    assert sorted(c["provision_id"] for c in db.changes) == ["sec-3-A-I-B", "sec-7-B-I-C", "sec-7-B-I-C-2"]


def test_resume_batch_consumes_a_batch_a_timed_out_run_left(db, monkeypatch, tmp_path):
    """First run: the poll deadline passes before the batch ends. Nothing is
    written, the rows stay pending, and the log names the batch. Second run
    with --resume-batch consumes the same batch and writes the verdicts."""
    answers = {"sec-7-B-I-C": _pass(), "sec-7-B-I-C-2": _pass(), "sec-3-A-I-B": _pass()}

    class NeverEnds(FakeBatches):
        def retrieve(self, batch_id):
            b = next(x for x in self.created if x.id == batch_id)
            if not getattr(self, "allow_end", False):
                b.processing_status = "in_progress"
                return b
            return super().retrieve(batch_id)

    monkeypatch.setattr(review, "MAX_POLL_SECONDS", -1)
    fake_holder = {}

    def build(answers_):
        fa = FakeAnthropic(answers_)
        fa.messages.batches = NeverEnds(answers_, fa)
        fake_holder["fa"] = fa
        return fa
    import types
    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=lambda api_key: build(answers)))
    monkeypatch.setattr(sz, "make_supabase_client", lambda: db)
    monkeypatch.setattr(review, "FAILED_LOG_PATH", tmp_path / "f.jsonl")
    monkeypatch.setattr(review, "OUT_DIR", tmp_path / "out")
    monkeypatch.setattr(review, "REPORT_MD_PATH", tmp_path / "out" / "r.md")
    monkeypatch.setattr(review, "REPORT_JSON_PATH", tmp_path / "out" / "r.json")
    monkeypatch.setattr(review.time, "sleep", lambda s: None)
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"):
        monkeypatch.setenv(k, "x")
    real_make = sz.make_custom_id

    def tracking_make(pid, used):
        cid = real_make(pid, used)
        fake_holder["fa"].custom_id_map[cid] = pid
        return cid
    monkeypatch.setattr(sz, "make_custom_id", tracking_make)

    assert review.main(["--execute"]) == 0
    assert all(r["summary_status"] == "pending" for r in db.tables["provisions"] if r["id"] in answers)
    log = (tmp_path / "f.jsonl").read_text()
    assert "batch poll timeout (msgbatch_1)" in log and log.count("\n") == 3
    first = fake_holder["fa"]

    # resume: same fake batch store, now allowed to end
    first.messages.batches.allow_end = True
    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=lambda api_key: first))
    assert review.main(["--execute", "--resume-batch", "msgbatch_1"]) == 0
    assert all(db.row(i)["summary_status"] == "approved" for i in answers)
    assert len(first.messages.batches.created) == 1      # no new submission


def test_api_errors_leave_the_row_pending(db, monkeypatch, tmp_path):
    err = _Outcome(type_="errored", error=type("E", (), {"message": "overloaded"})())
    answers = {"sec-7-B-I-C": err, "sec-7-B-I-C-2": _pass(), "sec-3-A-I-B": _pass()}
    rc, fake, report = _run(db, answers, ["--execute", "--reg", "7"], monkeypatch, tmp_path)
    assert report["counts"]["api_errors"] == 1 and report["counts"]["selected"] == 2
    assert db.row("sec-7-B-I-C")["summary_status"] == "pending"
    assert db.row("sec-3-A-I-B")["summary_status"] == "pending"       # out of --reg scope, untouched


# --------------------------------------------------------------------------
# Dry run
# --------------------------------------------------------------------------

def test_dry_run_makes_no_batch_and_no_write_and_quotes_every_option(db, monkeypatch, tmp_path):
    before = json.dumps(db.tables, sort_keys=True)
    rc, fake, report = _run(db, {}, ["--dry-run"], monkeypatch, tmp_path)
    assert rc == 0
    assert fake.messages.batches.created == [] and fake.messages.create_calls == []
    assert json.dumps(db.tables, sort_keys=True) == before
    assert report["run"]["mode"].startswith("dry run")
    quote = report["dry_run_quote"]
    assert quote["rows"] == 3
    assert [o["model"] for o in quote["options"]] == [o["model"] for o in review.MODEL_OPTIONS]
    # count_tokens (free) was used once per row per distinct tokenizer (plus one
    # probe per tokenizer for the system prompt's own size), and the schema
    # allowance added
    tokenizers = {o["tokenizer"] for o in review.MODEL_OPTIONS}
    assert len(fake.messages.count_calls) == (3 + 1) * len(tokenizers)
    for o in quote["options"]:
        assert o["input_tokens"] == 3 * (1234 + review.SCHEMA_TOKEN_ALLOWANCE)
        assert o["cost_usd"] == round(review.estimate_cost(o["model"], o["input_tokens"], o["output_tokens"]), 4)
    assert "count_tokens" in quote["method"]
    assert (tmp_path / "out" / "review_report.md").exists()
    assert not (tmp_path / "review_failed.jsonl").exists()


def test_dry_run_without_api_key_estimates_by_characters(db, monkeypatch, tmp_path):
    monkeypatch.setattr(sz, "make_supabase_client", lambda: db)
    monkeypatch.setattr(review, "OUT_DIR", tmp_path)
    monkeypatch.setattr(review, "REPORT_MD_PATH", tmp_path / "r.md")
    monkeypatch.setattr(review, "REPORT_JSON_PATH", tmp_path / "r.json")
    monkeypatch.setattr(review, "FAILED_LOG_PATH", tmp_path / "f.jsonl")
    monkeypatch.setenv("SUPABASE_URL", "x")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert review.main(["--dry-run"]) == 0
    report = json.loads((tmp_path / "r.json").read_text())
    assert "character estimate" in report["dry_run_quote"]["method"]
    assert report["dry_run_quote"]["options"][0]["input_tokens"] > 0


def test_batch_prices_are_half_the_standard_rates():
    assert review.estimate_cost("claude-sonnet-4-5", 1_000_000, 1_000_000) == pytest.approx(1.50 + 7.50)
    assert review.estimate_cost("claude-sonnet-5-5", 1_000_000, 1_000_000) == pytest.approx(1.00 + 5.00)
    assert review.estimate_cost("claude-opus-5-5", 1_000_000, 1_000_000) == pytest.approx(2.00 + 10.00)
    assert review.estimate_cost("claude-sonnet-4-5-20250929", 1_000_000, 0) == pytest.approx(1.50)


def test_max_cost_refuses_to_submit(db, monkeypatch, tmp_path):
    rc, fake, report = _run(db, {}, ["--execute", "--max-cost", "0.000001"], monkeypatch, tmp_path)
    assert rc == 2
    assert fake.messages.batches.created == []
    assert all(r["summary_status"] != "approved" or r["id"] == "sec-7-B-I-C-1" for r in db.tables["provisions"])


# --------------------------------------------------------------------------
# Stray Markdown (owner instruction, 5 Oct 2026): a summary whose only
# problem is Markdown markers is "corrected" with the markers removed and
# nothing else changed.
# --------------------------------------------------------------------------

def _md_db():
    rows = _rows()
    rows.append({"id": "sec-3-A-I-B-33", "citation": "I.B.33.", "title": "Modification", "parent_id": None,
                 "full_text": f"<p>{LONG}</p>", "sort_order": 8,
                 "ai_summary": "**Modification** means any physical change that increases emissions.",
                 "summary_status": "pending", "summary_original": "older text kept by a reviewer",
                 "summary_model": "claude-sonnet-4-5"})
    return FakeSupabase(rows)


def _md_only(after="Modification means any physical change that increases emissions."):
    return {"findings": [{"claim": "**Modification**", "problem": "stray Markdown"}], "verdict": "corrected",
            "corrected_summary": after,
            "changes": [{"before": "**Modification**", "after": "Modification",
                         "reason": "stray Markdown markers removed"}],
            "fail_reason": ""}


@pytest.mark.parametrize("text, has", [
    ("**Modification** means x.", True),
    ("a __bold__ b.", True),
    ("use `code` here.", True),
    ("- a list item.", True),
    ("# A heading", True),
    ("Applies to engines over 2,000 hp.*", False),     # footnote star
    ("Fill in ______ and sign.", False),               # form blank
    ("snake_case_name stays.", False),
])
def test_markdown_marker_detection(text, has):
    assert review.has_markdown_markers(text) is has


def test_markdown_only_correction_is_accepted():
    db = _md_db()
    r = _review_for(db, "sec-3-A-I-B-33")
    v = review.validate_verdict(_md_only(), r)
    assert v.verdict == "corrected"
    assert v.corrected_summary == "Modification means any physical change that increases emissions."
    assert v.reasons_note == "stray Markdown markers removed"


def test_markdown_only_correction_that_also_changes_wording_is_an_ordinary_correction():
    """Until 6 Oct 2026 this was a fail ("Markdown-only correction changed
    more than the markers"), which kept sec-11-H-APPENDIX-A-2.15-C,
    sec-21-A-II-E and sec-21-A-II-I pending twice. Now it is an ordinary
    correction under the ordinary limits, with the wording change recorded
    as a change of its own."""
    db = _md_db()
    r = _review_for(db, "sec-3-A-I-B-33")
    v = review.validate_verdict(_md_only("Modification means any change that increases emissions."), r)
    assert v.verdict == "corrected"
    assert v.corrected_summary == "Modification means any change that increases emissions."
    assert v.changes[-1]["reason"] == review.MARKDOWN_PLUS_WORDING_REASON
    assert v.changes[-1]["before"] == review.strip_markdown_markers(r.summary)
    # the ordinary limits still apply: a rewrite is still a fail
    long = " ".join(["Modification means any change that increases emissions and much more besides."] * 6)
    assert review.validate_verdict(_md_only(long), r).verdict == "fail"


def test_a_real_correction_may_also_drop_markdown():
    db = _md_db()
    r = _review_for(db, "sec-3-A-I-B-33")
    data = _md_only("Modification means any physical change that increases or adds emissions.")
    data["changes"] = [{"before": "**Modification**", "after": "Modification", "reason": "stray Markdown markers removed"},
                       {"before": "increases emissions", "after": "increases or adds emissions",
                        "reason": "the text also covers a pollutant not emitted before"}]
    assert review.validate_verdict(data, r).verdict == "corrected"


def test_pass_on_a_summary_with_markdown_is_not_approved():
    db = _md_db()
    r = _review_for(db, "sec-3-A-I-B-33")
    v = review.validate_verdict(_pass(), r)
    assert v.verdict == "fail" and "Markdown" in v.reason


def test_corrected_text_that_keeps_markdown_is_a_fail():
    db = _md_db()
    r = _review_for(db, "sec-3-A-I-B-33")
    v = review.validate_verdict(_md_only("**Modification** means any physical change that adds emissions."), r)
    assert v.verdict == "fail" and "markdown" in v.reason.lower()


def test_markdown_only_correction_end_to_end_keeps_summary_original(monkeypatch, tmp_path):
    db = _md_db()
    rc, fake, report = _run(db, {"sec-3-A-I-B-33": _md_only()}, ["--execute", "--ids", "sec-3-A-I-B-33"],
                            monkeypatch, tmp_path)
    row = db.row("sec-3-A-I-B-33")
    assert row["ai_summary"] == "Modification means any physical change that increases emissions."
    assert row["summary_status"] == "approved"
    assert row["summary_original"] == "older text kept by a reviewer"       # never overwritten
    assert row["reviewed_by"].startswith("Claude (AI second-pass review; summary corrected, automated pipeline")
    assert db.changes[-1]["change_type"] == "summary_edited"
    assert db.changes[-1]["note"].endswith("stray Markdown markers removed")


def test_prompt_states_the_markdown_rule():
    assert "Stray Markdown markers" in review.REVIEW_SYSTEM_PROMPT
    assert "nothing else changed" in review.REVIEW_SYSTEM_PROMPT


# --------------------------------------------------------------------------
# Several regulations in one run
# --------------------------------------------------------------------------

def test_reg_accepts_a_comma_separated_list_in_order(db):
    assert [r["id"] for r in review.iter_candidates(db, "3,7", None)] == ["sec-3-A-I-B", "sec-7-B-I-C", "sec-7-B-I-C-2"]
    assert [r["id"] for r in review.iter_candidates(db, "3,7", 2)] == ["sec-3-A-I-B", "sec-7-B-I-C"]


# --------------------------------------------------------------------------
# Audit mode: approved rows, read-only
# --------------------------------------------------------------------------

def test_allocate_sample_spreads_and_sums():
    sizes = {"7": 1000, "3": 500, "gp01": 3, "p190": 1, "ecmc": 2000}
    alloc = review.allocate_sample(sizes, 200)
    assert sum(alloc.values()) == 200
    assert all(alloc[r] >= 1 for r in sizes)                 # every regulation represented
    assert all(alloc[r] <= sizes[r] for r in sizes)
    assert alloc["ecmc"] > alloc["7"] > alloc["3"] > alloc["gp01"]
    assert review.allocate_sample({"a": 3, "b": 2}, 10) == {"a": 3, "b": 2}   # n over the population
    assert sum(review.allocate_sample(sizes, 3).values()) == 3                # fewer slots than regs


def _audit_db():
    rows = _rows()
    for i in range(30):
        rows.append({"id": f"sec-8-A-{i:03d}", "citation": f"{i}.", "title": "", "parent_id": None,
                     "full_text": f"<p>{LONG}</p>", "sort_order": 100 + i, "ai_summary": f"Reg 8 summary {i}.",
                     "summary_status": "approved" if i % 5 else "edited", "summary_original": None,
                     "summary_model": "claude-sonnet-4-5",
                     "reviewed_by": ("Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, 2026-10-05)"
                                     if i < 10 else "Claude (AI second-pass review, full text read, per owner instruction 2026-09-20)")})
    return FakeSupabase(rows)


def test_audit_sample_excludes_pipeline_reviewed_and_non_approved_rows():
    db = _audit_db()
    rows, info = review.select_audit_sample(db, 8, seed=1)
    ids = [r["id"] for r in rows]
    assert len(ids) == 8 and len(set(ids)) == 8
    for r in rows:
        assert r["summary_status"] in ("approved", "edited")
        assert "automated pipeline" not in (r.get("reviewed_by") or "")
    assert info["eligible"] == 21          # 20 hand-reviewed reg 8 rows + the approved reg 7 row
    assert set(info["allocation"]) == {"7", "8"}
    # seeded: the same sample every time
    assert [r["id"] for r in review.select_audit_sample(db, 8, seed=1)[0]] == ids
    assert [r["id"] for r in review.select_audit_sample(db, 8, seed=2)[0]] != ids


def test_audit_execute_writes_nothing_and_reports_would_correct_rows(monkeypatch, tmp_path):
    db = _audit_db()
    before = json.dumps(db.tables, sort_keys=True)
    sample, _ = review.select_audit_sample(db, 6, seed=7)
    answers = {r["id"]: _pass() for r in sample}
    target = sample[0]["id"]
    answers[target] = {"findings": [], "verdict": "corrected",
                       "corrected_summary": db.row(target)["ai_summary"].rstrip(".") + " for five years.",
                       "changes": [{"before": "x", "after": "y", "reason": "the text says five years"}],
                       "fail_reason": ""}
    rc, fake, report = _run(db, answers, ["--audit", "6", "--seed", "7", "--execute"], monkeypatch, tmp_path)
    assert rc == 0
    assert db.writes == [] and json.dumps(db.tables, sort_keys=True) == before   # NOTHING written
    assert report["run"]["mode"].startswith("AUDIT")
    assert report["counts"]["selected"] == 6 and report["counts"]["corrected"] == 1 and report["counts"]["pass"] == 5
    would = report["corrected"][0]
    assert would["id"] == target and would["before"] == db.row(target)["ai_summary"]
    assert would["changes"][0]["reason"] == "the text says five years"
    assert report["audit"]["seed"] == 7 and report["audit"]["exclude_reviewed_by"] == "automated pipeline"
    md = (tmp_path / "out" / "review_report.md").read_text()
    assert "Rows the reviewer would correct (NOT changed)" in md and "Current summary" in md
    # the batch went out with the same reviewer prompt
    assert fake.messages.batches.created[0].requests[0]["params"]["system"][0]["text"] == review.REVIEW_SYSTEM_PROMPT


def test_audit_dry_run_makes_no_batch(monkeypatch, tmp_path):
    db = _audit_db()
    rc, fake, report = _run(db, {}, ["--audit", "5", "--dry-run"], monkeypatch, tmp_path)
    assert rc == 0 and fake.messages.batches.created == [] and db.writes == []
    assert report["dry_run_quote"]["rows"] == 5
    assert report["run"]["mode"].startswith("AUDIT dry run")


def test_audit_respects_the_spend_cap(monkeypatch, tmp_path):
    db = _audit_db()
    rc, fake, report = _run(db, {}, ["--audit", "5", "--execute", "--max-cost", "0.000001"], monkeypatch, tmp_path)
    assert rc == 2 and fake.messages.batches.created == [] and db.writes == []


# --------------------------------------------------------------------------
# Paragraph breaks (5 Oct 2026 run): the reader shows a blank line in a
# summary as a new paragraph, so a correction keeps the summary's paragraphs.
# --------------------------------------------------------------------------

def _para_db():
    rows = _rows()
    rows.append({"id": "sec-8-B-III-E", "citation": "III.E.", "title": "Notification", "parent_id": None,
                 "full_text": f"<p>{LONG}</p>", "sort_order": 9,
                 "ai_summary": "Anyone abating asbestos must notify the Division.\n\nRecords are kept for three years.",
                 "summary_status": "pending", "summary_original": None, "summary_model": "claude-sonnet-4-5"})
    return FakeSupabase(rows)


def test_correction_keeps_paragraph_breaks():
    db = _para_db()
    r = _review_for(db, "sec-8-B-III-E")
    data = _corrected("Anyone abating asbestos must notify the Division.\n\nRecords are kept   for five years.",
                      reason="the text says five years")
    v = review.validate_verdict(data, r)
    assert v.verdict == "corrected"
    assert v.corrected_summary == "Anyone abating asbestos must notify the Division.\n\nRecords are kept for five years."


def test_a_single_line_break_inside_a_paragraph_becomes_a_space():
    assert review._normalize_paragraphs("a\nb\n\n\n c  d ") == "a b\n\nc d"


def test_paragraph_breaks_alone_are_not_a_correction():
    db = _para_db()
    r = _review_for(db, "sec-8-B-III-E")
    data = _corrected("Anyone abating asbestos must notify the Division. Records are kept for three years.")
    v = review.validate_verdict(data, r)
    assert v.verdict == "fail" and "identical" in v.reason


def test_paragraph_correction_end_to_end(monkeypatch, tmp_path):
    db = _para_db()
    data = _corrected("Anyone abating asbestos must notify the Division in writing.\n\nRecords are kept for three years.",
                      reason="the text says in writing")
    _run(db, {"sec-8-B-III-E": data}, ["--execute", "--ids", "sec-8-B-III-E"], monkeypatch, tmp_path)
    row = db.row("sec-8-B-III-E")
    assert row["summary_status"] == "approved"
    assert row["ai_summary"] == "Anyone abating asbestos must notify the Division in writing.\n\nRecords are kept for three years."


def test_review_summary_prints_counts_cost_regs_and_failures():
    import review_summary
    data = {"run": {"mode": "execute", "model": "claude-sonnet-5-5", "sampling": "effort low", "prompt_version": "x"},
            "counts": {"selected": 3, "pass": 1, "corrected": 1, "fail": 1},
            "usage": {"input_tokens": 10, "output_tokens": 2, "cost_usd_batch": 0.12, "batches": ["b1"]},
            "by_regulation": {"7": {"selected": 3, "pass": 1, "corrected": 1, "fail": 1}},
            "failed": [{"id": "sec-7-x", "reason": "truncated"}],
            "corrected": [{"id": "sec-7-y", "before": "old.", "after": "new.", "changes": [{"reason": "r"}]}]}
    text = review_summary.summarize(data, ["sec-7-y"])
    assert "cost_usd_batch=0.12" in text and "  7 3 1 1 1" in text and "sec-7-x: truncated" in text
    assert "before: old." in text and "after: new." in text and text.endswith("=== END SUMMARY ===")


# --------------------------------------------------------------------------
# Prompt version 2 (Oct 2026): the three plain-English allowances
# --------------------------------------------------------------------------

def test_prompt_version_2_states_the_three_allowances_and_keeps_the_strict_rules():
    p = review.REVIEW_SYSTEM_PROMPT
    assert "1. Acronyms and agency names" in p and "volatile organic compounds (VOC)" in p
    assert "2. Illustrative examples" in p and "does not narrow or widen" in p
    assert "3. Source typos" in p and "trionyl chloride" in p
    # the strict core is untouched
    assert "Compare literally" in p and "\"may\" and \"must\" are different duties" in p
    assert "If the text does not say it, the summary may not say it." in p
    # the old sentence that forbade expanding an acronym the text only abbreviates is gone
    assert "one the text only abbreviates may not be expanded" not in p
    assert review.REVIEW_PROMPT_VERSION != "4c41cd5622"      # version 1 (PRs #52-#56)


@pytest.mark.parametrize("before,after,reason,expected", [
    ("equipment leaks of volatile organic compounds (VOC)", "equipment leaks of VOC",
     "The text only abbreviates VOC and does not expand it.", True),
    ("Colorado Parks and Wildlife (CPW)", "CPW", "The text only abbreviates CPW and never expands it.", True),
    ("maximum allowable operating pressure (MAOP)", "maximum allowable operating pressure",
     "The text spells out the term and never uses the acronym MAOP.", True),
    ("CEDRI (the EPA's Compliance and Emissions Data Reporting Interface)", "CEDRI",
     "The text only abbreviates CEDRI and does not expand it.", True),
    # a wrong expansion is a real correction
    ("the Air Quality Control Commission (AQCC)", "the Division",
     "The text names the Division, a different party; the acronym expansion is wrong.", False),
    # words added or substituted: not a removal
    ("exceeding MAOP plus 6 psig", "exceeding the maximum allowable operating pressure plus 6 psig",
     "Follows from removing the acronym; the text uses the full term.", False),
    # a removal for a non-acronym reason is a real correction
    ("inspect every 500 hp engine quarterly", "inspect every engine quarterly",
     "The text sets no horsepower threshold.", False),
])
def test_acronym_pairing_removal_detection(before, after, reason, expected):
    assert review._is_acronym_pairing_removal(before, after, reason) is expected


def _acr_db():
    rows = _rows()
    rows.append({"id": "sec-6-A-SUBPART-VVa", "citation": "Subpart VVa", "title": "", "parent_id": None,
                 "full_text": "<p>Standards of performance for equipment leaks of VOC.</p>", "sort_order": 50,
                 "ai_summary": "This subpart sets standards for equipment leaks of volatile organic compounds (VOC) at affected facilities.",
                 "summary_status": "pending", "summary_original": None, "summary_model": "claude-sonnet-4-5"})
    return FakeSupabase(rows)


def test_correction_that_only_strips_a_correct_expansion_is_a_pass():
    db = _acr_db()
    rv = _review_for(db, "sec-6-A-SUBPART-VVa")
    data = {"findings": [{"claim": "volatile organic compounds (VOC)", "problem": "text only says VOC"}],
            "verdict": "corrected",
            "corrected_summary": "This subpart sets standards for equipment leaks of VOC at affected facilities.",
            "changes": [{"before": "equipment leaks of volatile organic compounds (VOC)", "after": "equipment leaks of VOC",
                         "reason": "The text only abbreviates VOC and does not expand it."}],
            "fail_reason": ""}
    v = review.validate_verdict(data, rv)
    assert v.verdict == "pass" and v.reason == review.ACRONYM_ONLY_REASON and v.corrected_summary == ""


def test_correction_with_a_real_error_beside_an_expansion_removal_stays_corrected():
    db = _acr_db()
    rv = _review_for(db, "sec-6-A-SUBPART-VVa")
    data = {"findings": [], "verdict": "corrected",
            "corrected_summary": "This subpart sets standards for equipment leaks of VOC at affected facilities after 2007.",
            "changes": [{"before": "volatile organic compounds (VOC)", "after": "VOC",
                         "reason": "The text only abbreviates VOC."},
                        {"before": "at affected facilities", "after": "at affected facilities after 2007",
                         "reason": "The text limits the standard to facilities constructed after 2007."}],
            "fail_reason": ""}
    assert review.validate_verdict(data, rv).verdict == "corrected"


def test_acronym_only_pass_still_fails_on_markdown():
    db = _acr_db()
    db.row("sec-6-A-SUBPART-VVa")["ai_summary"] = "This subpart sets standards for **equipment leaks** of volatile organic compounds (VOC)."
    rv = _review_for(db, "sec-6-A-SUBPART-VVa")
    data = {"findings": [], "verdict": "corrected",
            "corrected_summary": "This subpart sets standards for equipment leaks of VOC.",
            "changes": [{"before": "volatile organic compounds (VOC)", "after": "VOC",
                         "reason": "The text only abbreviates VOC."}], "fail_reason": ""}
    v = review.validate_verdict(data, rv)
    assert v.verdict == "fail" and "Markdown" in v.reason


# --------------------------------------------------------------------------
# --rereview: the hand-approved rows (Oct 2026)
# --------------------------------------------------------------------------

PIPELINE_STAMP = "Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, 2026-10-05)"
HAND_STAMP = "Claude (AI second-pass review, full text read, per owner instruction 2026-09-20)"


def _rereview_db():
    rows = _rows()
    for i in range(6):
        rows.append({"id": f"sec-8-A-{i:03d}", "citation": f"{i}.", "title": "", "parent_id": None,
                     "full_text": f"<p>{LONG}</p>", "sort_order": 100 + i, "ai_summary": f"Reg 8 summary {i}.",
                     "summary_status": "edited" if i == 1 else "approved",
                     "summary_original": "kept original" if i == 2 else None,
                     "summary_model": "claude-sonnet-4-5",
                     "reviewed_by": PIPELINE_STAMP if i >= 4 else (None if i == 3 else HAND_STAMP),
                     "reviewed_at": "2026-09-20T00:00:00+00:00"})
    return FakeSupabase(rows)


def test_rereview_selects_hand_approved_and_edited_rows_only():
    db = _rereview_db()
    ids = [r["id"] for r in review.iter_candidates(db, None, None, rereview=True)]
    # the approved reg 7 row (hand stamp) + reg 8 rows 0-3 (hand stamp, edited, kept original, null reviewed_by)
    assert ids == ["sec-7-B-I-C-1", "sec-8-A-000", "sec-8-A-001", "sec-8-A-002", "sec-8-A-003"]
    for r in review.iter_candidates(db, None, None, rereview=True):
        assert r["summary_status"] in ("approved", "edited") and r["ai_summary"]
        assert "automated pipeline" not in (r.get("reviewed_by") or "")
    # pending, rejected and pipeline-stamped rows never appear
    assert not {"sec-7-B-I-C", "sec-7-B-I-D", "sec-8-A-004", "sec-8-A-005"} & set(ids)
    # reg prefix, limit, ids and the comma list still work
    assert [r["id"] for r in review.iter_candidates(db, "8", 2, rereview=True)] == ["sec-8-A-000", "sec-8-A-001"]
    assert [r["id"] for r in review.iter_candidates(db, "8,7", None, rereview=True)][-1] == "sec-7-B-I-C-1"
    picked = [r["id"] for r in review.iter_candidates(db, None, None, ids=["sec-8-A-004", "sec-7-B-I-C", "sec-8-A-001"],
                                                      rereview=True)]
    assert picked == ["sec-8-A-001"]
    # the normal selection is unchanged
    assert [r["id"] for r in review.iter_candidates(db, None, None)] == ["sec-7-B-I-C", "sec-7-B-I-C-2", "sec-3-A-I-B"]


def test_is_rereview_row():
    assert review.is_rereview_row({"summary_status": "approved", "ai_summary": "x", "reviewed_by": HAND_STAMP})
    assert review.is_rereview_row({"summary_status": "edited", "ai_summary": "x", "reviewed_by": None})
    assert not review.is_rereview_row({"summary_status": "approved", "ai_summary": "x", "reviewed_by": PIPELINE_STAMP})
    assert not review.is_rereview_row({"summary_status": "pending", "ai_summary": "x", "reviewed_by": HAND_STAMP})
    assert not review.is_rereview_row({"summary_status": "approved", "ai_summary": None, "reviewed_by": HAND_STAMP})


def test_rereview_pass_stamps_reviewer_and_date_and_nothing_else():
    db = _rereview_db()
    rv = _review_for(db, "sec-8-A-001")      # an 'edited' row
    before = dict(db.row("sec-8-A-001"))
    out = review.apply_verdict(db, db.row("sec-8-A-001"), rv, review.Verdict("pass"), "claude-sonnet-5-5",
                               date="2026-10-06", rereview=True)
    row = db.row("sec-8-A-001")
    assert out == "approved"
    assert row["reviewed_by"] == "Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, 2026-10-06)"
    assert row["reviewed_at"] != before["reviewed_at"]
    assert row["summary_status"] == "edited" and row["ai_summary"] == before["ai_summary"]
    assert row["summary_original"] == before["summary_original"]
    assert db.changes == []                  # the summary did not change: no changelog row
    # stamped rows drop out of the next re-review selection
    assert "sec-8-A-001" not in [r["id"] for r in review.iter_candidates(db, None, None, rereview=True)]


def test_rereview_fail_sets_pending_and_leaves_the_text_alone():
    db = _rereview_db()
    rv = _review_for(db, "sec-8-A-000")
    before = dict(db.row("sec-8-A-000"))
    out = review.apply_verdict(db, db.row("sec-8-A-000"), rv, review.Verdict("fail", reason="cannot verify"),
                               "claude-sonnet-5-5", rereview=True)
    row = db.row("sec-8-A-000")
    assert out == "failed_to_pending"
    assert row["summary_status"] == "pending"
    assert row["ai_summary"] == before["ai_summary"] and row["summary_original"] == before["summary_original"]
    assert db.changes == []
    # it is now a normal pending row, and no longer a re-review row
    assert "sec-8-A-000" in [r["id"] for r in review.iter_candidates(db, None, None)]
    assert "sec-8-A-000" not in [r["id"] for r in review.iter_candidates(db, None, None, rereview=True)]
    # normal mode: fail still writes nothing
    db2 = _rereview_db()
    assert review.apply_verdict(db2, db2.row("sec-7-B-I-C"), _review_for(db2, "sec-7-B-I-C"),
                                review.Verdict("fail", reason="x"), "m") == "failed"
    assert db2.writes == []


def test_rereview_corrected_writes_as_today():
    db = _rereview_db()
    rv = _review_for(db, "sec-8-A-002")      # has a summary_original already
    v = review.Verdict("corrected", corrected_summary="Reg 8 summary 2, for five years.",
                       changes=[{"before": "x", "after": "y", "reason": "the text says five years"}])
    out = review.apply_verdict(db, db.row("sec-8-A-002"), rv, v, "claude-sonnet-5-5", date="2026-10-06", rereview=True)
    row = db.row("sec-8-A-002")
    assert out == "corrected"
    assert row["ai_summary"] == "Reg 8 summary 2, for five years." and row["summary_original"] == "kept original"
    assert row["summary_status"] == "approved"
    assert row["reviewed_by"].startswith("Claude (AI second-pass review; summary corrected, automated pipeline")
    assert db.changes[0]["change_type"] == "summary_edited" and "five years" in db.changes[0]["note"]
    # a corrected row without a summary_original gets the prior text
    rv3 = _review_for(db, "sec-8-A-003")
    review.apply_verdict(db, db.row("sec-8-A-003"), rv3, v, "claude-sonnet-5-5", rereview=True)
    assert db.row("sec-8-A-003")["summary_original"] == "Reg 8 summary 3."


def test_rereview_write_is_skipped_when_the_row_is_no_longer_approved():
    db = _rereview_db()
    rv = _review_for(db, "sec-8-A-000")
    row = db.row("sec-8-A-000")
    row["summary_status"] = "rejected"       # an admin rejected it after selection
    for verdict in (review.Verdict("pass"), review.Verdict("fail", reason="x"),
                    review.Verdict("corrected", corrected_summary="New.", changes=[{"before": "", "after": "", "reason": "r"}])):
        assert review.apply_verdict(db, row, rv, verdict, "m", rereview=True) == "skipped_not_pending"
    assert db.row("sec-8-A-000")["summary_status"] == "rejected" and db.changes == []


def test_rereview_execute_snapshots_every_selected_row_before_the_first_write(monkeypatch, tmp_path):
    db = _rereview_db()
    selected = [r["id"] for r in review.iter_candidates(db, None, None, rereview=True)]
    pre = {r["id"]: dict(r) for r in db.tables["provisions"]}
    answers = {
        "sec-7-B-I-C-1": _pass(),
        "sec-8-A-000": _fail("the text is shown only as an outline"),
        "sec-8-A-001": _pass(),
        "sec-8-A-002": {"findings": [], "verdict": "corrected", "corrected_summary": "Reg 8 summary 2, for five years.",
                        "changes": [{"before": "x", "after": "y", "reason": "the text says five years"}], "fail_reason": ""},
        "sec-8-A-003": "not json at all",
    }
    rc, fake, report = _run(db, answers, ["--rereview", "--execute"], monkeypatch, tmp_path)
    assert rc == 0
    # snapshot: one RPC call, every selected id, made before any write
    assert [c[0] for c in db.rpc_calls] == ["snapshot_summaries_for_rereview"]
    name, params, writes_before = db.rpc_calls[0]
    assert sorted(params["p_ids"]) == sorted(selected) and writes_before == 0
    assert "--rereview" in params["p_run_label"]
    snap = {r["id"]: r for r in db.tables["archive_snapshot"]}
    assert set(snap) == set(selected)
    for pid in selected:
        assert snap[pid]["ai_summary"] == pre[pid]["ai_summary"]
        assert snap[pid]["summary_status"] == pre[pid]["summary_status"]
        assert snap[pid]["reviewed_by"] == pre[pid].get("reviewed_by")
    assert report["run"]["snapshot"]["added"] == len(selected) and report["run"]["selection"] == "rereview"
    # outcomes
    assert report["counts"]["selected"] == 5 and report["counts"]["pass"] == 2
    assert report["counts"]["corrected"] == 1 and report["counts"]["fail"] == 2
    assert db.row("sec-7-B-I-C-1")["reviewed_by"].startswith("Claude (AI second-pass review, automated pipeline")
    assert db.row("sec-7-B-I-C-1")["summary_status"] == "approved"
    assert db.row("sec-8-A-001")["summary_status"] == "edited"
    assert db.row("sec-8-A-000")["summary_status"] == "pending" and db.row("sec-8-A-000")["ai_summary"] == "Reg 8 summary 0."
    assert db.row("sec-8-A-003")["summary_status"] == "pending"      # malformed answer = fail = pending
    assert db.row("sec-8-A-002")["ai_summary"].endswith("five years.")
    assert all(f["set_pending"] for f in report["failed"])
    # untouched: pending rows, the rejected row, the pipeline-stamped rows
    for pid in ("sec-7-B-I-C", "sec-7-B-I-C-2", "sec-3-A-I-B", "sec-7-B-I-D", "sec-8-A-004", "sec-8-A-005"):
        assert db.row(pid) == pre[pid]
    # only one changelog row: the correction
    assert [c["change_type"] for c in db.changes] == ["summary_edited"]
    md = (tmp_path / "out" / "review_report.md").read_text()
    assert "RE-REVIEW" in md and "set back to pending" in md
    # a second re-review run finds nothing: passes are stamped, fails are pending
    rc2, fake2, report2 = _run(db, {}, ["--rereview", "--execute"], monkeypatch, tmp_path)
    assert report2["counts"]["selected"] == 0 and fake2.messages.batches.created == []
    assert len(db.rpc_calls) == 1          # no snapshot call when nothing is selected
    # the failed rows are now ordinary pending rows for the normal review
    assert sorted(r["id"] for r in review.iter_candidates(db, "8", None)) == ["sec-8-A-000", "sec-8-A-003"]


def test_rereview_dry_run_makes_no_snapshot_no_batch_no_write(monkeypatch, tmp_path):
    db = _rereview_db()
    before = json.dumps(db.tables, sort_keys=True)
    rc, fake, report = _run(db, {}, ["--rereview", "--dry-run"], monkeypatch, tmp_path)
    assert rc == 0 and fake.messages.batches.created == [] and db.writes == [] and db.rpc_calls == []
    assert json.dumps(db.tables, sort_keys=True) == before
    assert report["dry_run_quote"]["rows"] == 5 and report["run"]["mode"].startswith("RE-REVIEW")
    assert report["by_regulation"]["8"]["selected"] == 4 and report["by_regulation"]["7"]["selected"] == 1


def test_rereview_and_audit_are_exclusive():
    with pytest.raises(SystemExit):
        review.parse_args(["--rereview", "--audit", "5"])


def test_rereview_snapshot_failure_aborts_before_any_write(monkeypatch, tmp_path):
    db = _rereview_db()

    class Boom:
        def execute(self):
            raise RuntimeError("function snapshot_summaries_for_rereview does not exist")
    monkeypatch.setattr(db, "rpc", lambda name, params: Boom())
    with pytest.raises(RuntimeError):
        _run(db, {"sec-8-A-000": _pass()}, ["--rereview", "--execute"], monkeypatch, tmp_path)
    assert db.writes == []


def test_audit_ids_reviews_exact_approved_rows_and_writes_nothing(monkeypatch, tmp_path, capsys):
    db = _rereview_db()
    before = json.dumps(db.tables, sort_keys=True)
    # a hand-approved row, a pipeline-stamped row (allowed: explicit ids), a pending row and an unknown id
    ids = "sec-8-A-004,sec-8-A-000,sec-7-B-I-C,sec-nope"
    answers = {"sec-8-A-004": _pass(),
               "sec-8-A-000": {"findings": [], "verdict": "corrected", "corrected_summary": "Reg 8 summary 0, for five years.",
                               "changes": [{"before": "x", "after": "y", "reason": "the text says five years"}], "fail_reason": ""}}
    rc, fake, report = _run(db, answers, ["--audit-ids", ids, "--execute"], monkeypatch, tmp_path)
    assert rc == 0
    assert db.writes == [] and db.rpc_calls == [] and json.dumps(db.tables, sort_keys=True) == before
    assert report["run"]["mode"].startswith("AUDIT") and report["counts"]["selected"] == 2
    assert report["audit"]["ids"] == ["sec-8-A-004", "sec-8-A-000"] and report["audit"]["skipped_ids"] == ["sec-7-B-I-C", "sec-nope"]
    assert report["counts"]["pass"] == 1 and report["corrected"][0]["id"] == "sec-8-A-000"
    assert "left out" in capsys.readouterr().err


def test_audit_ids_and_rereview_are_exclusive():
    with pytest.raises(SystemExit):
        review.parse_args(["--rereview", "--audit-ids", "sec-x"])


def test_prompt_version_2_keeps_context_and_single_condition_clarifications():
    p = review.REVIEW_SYSTEM_PROMPT
    assert "part of the Form 2A application" in p
    assert "not a claim that the condition is sufficient by itself" in p
    assert "Spelling out the direct effect" in p


# --------------------------------------------------------------------------
# Prompt caching of the system prompt (owner approval, 5 Oct 2026)
# --------------------------------------------------------------------------

def test_system_prompt_is_one_cached_block_with_a_one_hour_ttl(db):
    r = _review_for(db, "sec-7-B-I-C")
    for model in ("claude-sonnet-5-5", "claude-sonnet-4-5"):
        p = review.request_params(r, model)
        assert p["system"] == [{"type": "text", "text": review.REVIEW_SYSTEM_PROMPT,
                                "cache_control": {"type": "ephemeral", "ttl": "1h"}}]
        assert review.SYSTEM_CACHE_TTL == "1h"
    # the user turn (the per-row text) is not cached
    assert "cache_control" not in json.dumps(p["messages"])


def test_cost_counts_cache_writes_at_2x_and_reads_at_a_tenth():
    base = review.estimate_cost("claude-sonnet-5-5", 1_000_000, 0)                       # $1.00 batch
    assert review.estimate_cost("claude-sonnet-5-5", 0, 0, cache_creation_tokens=1_000_000) == pytest.approx(base * 2)
    assert review.estimate_cost("claude-sonnet-5-5", 0, 0, cache_read_tokens=1_000_000) == pytest.approx(base * 0.1)
    assert review.estimate_cost("claude-sonnet-5-5", 1_000_000, 1_000_000) == pytest.approx(1.00 + 5.00)  # unchanged


def test_run_stats_accumulate_cache_tokens_and_share():
    s = review.RunStats()
    s.add_usage(_Usage(i=700, o=100, cache_read=2500, cache_create=0))
    s.add_usage(_Usage(i=700, o=100, cache_read=0, cache_create=2500))
    s.add_usage(_Usage(i=700, o=100))                                   # a usage without cache fields
    assert (s.input_tokens, s.cache_read_tokens, s.cache_creation_tokens) == (2100, 2500, 2500)
    assert s.total_input_tokens == 7100 and s.cache_read_share == pytest.approx(2500 / 7100)
    assert s.cost("claude-sonnet-5-5") == pytest.approx(review.estimate_cost(
        "claude-sonnet-5-5", 2100, 300, cache_creation_tokens=2500, cache_read_tokens=2500))


def test_report_and_run_summary_state_cache_reads(db, monkeypatch, tmp_path, capsys):
    answers = {"sec-7-B-I-C": _Message(json.dumps(_pass()), i=700, o=100, cache_create=2500),
               "sec-7-B-I-C-2": _Message(json.dumps(_pass()), i=700, o=100, cache_read=2500),
               "sec-3-A-I-B": _Message(json.dumps(_pass()), i=700, o=100, cache_read=2500)}
    rc, fake, report = _run(db, answers, ["--execute"], monkeypatch, tmp_path)
    u = report["usage"]
    assert u["input_tokens"] == 2100 and u["cache_read_input_tokens"] == 5000 and u["cache_creation_input_tokens"] == 2500
    assert u["total_input_tokens"] == 9600 and u["cache_read_share"] == pytest.approx(5000 / 9600, abs=1e-4)
    assert u["cost_usd_batch"] == pytest.approx(review.estimate_cost(
        "claude-sonnet-5-5", 2100, 300, cache_creation_tokens=2500, cache_read_tokens=5000), abs=1e-4)
    md = (tmp_path / "out" / "review_report.md").read_text()
    assert "52.1% of input was cache reads" in md and "5,000 read from the cache" in md
    out = capsys.readouterr().out
    assert "Cache read tokens" in out and "52.1%" in out
    # the compact run summary carries the same figures
    import review_summary
    text = review_summary.summarize(report)
    assert "cache_read_input_tokens=5000" in text and "cache_read_share=52.1%" in text


def test_spend_cap_counts_cached_tokens(db, monkeypatch, tmp_path):
    # the cap check must see the whole input, not only the uncached part
    s = review.RunStats()
    s.add_usage(_Usage(i=0, o=0, cache_read=10_000_000))
    assert s.cost("claude-sonnet-5-5") == pytest.approx(1.00)


def test_dry_run_quotes_the_full_cache_hit_figure_too(db, monkeypatch, tmp_path):
    rc, fake, report = _run(db, {}, ["--dry-run"], monkeypatch, tmp_path)
    for o in report["dry_run_quote"]["options"]:
        assert 0 < o["cost_usd_with_cache_hits"] <= o["cost_usd"]
        assert o["system_prompt_tokens"] > 0
    md = (tmp_path / "out" / "review_report.md").read_text()
    assert "full cache hits" in md


def test_output_allowance_is_the_measured_figure_plus_margin():
    # 220/row measured on the 200-row audit (5 Oct 2026); the allowance must
    # cover it without the pre-run guess of 900 that over-quoted by 3x.
    assert 220 <= review.EST_OUTPUT_TOKENS_THINKING <= 400
    assert review.expected_output_tokens("claude-sonnet-5-5") == review.EST_OUTPUT_TOKENS_THINKING
    assert review.expected_output_tokens("claude-sonnet-4-5") == review.EST_OUTPUT_TOKENS_PLAIN



# --------------------------------------------------------------------------
# Ancestor context (owner instruction, 5 Oct 2026, after the stage-1 check)
# --------------------------------------------------------------------------

APEN_GP = (" A revised APEN must be filed: (Reference:  Regulation Number 3 , Part A,  Section II.C. ) ")
APEN_PARENT = " Annually by April 30th of the year following a significant increase in emissions as follows: "
APEN_ROW = (" For volatile organic compounds and nitrogen oxides sources in ozone non-attainment areas, a change in "
            "annual actual emissions of one ton per year or more or five percent, whichever is greater, above the "
            "level reported on the last APEN submitted to the Division; or ")
APEN_BEFORE = ("The permit requires you to submit an updated Air Pollutant Emission Notice (APEN) by April 30 if your "
               "facility is in an ozone non-attainment area and your annual actual emissions of VOC or NOx increased by "
               "1 tpy or more, or by 5 percent, whichever is greater, compared to the emissions level in your last APEN. "
               "This applies only when that increase qualifies as a \"significant increase\" under the permit's definition.")
GP07_PARENT = ("The owner or operator not subject to Conditions I.B. or I.C. or I.D. of this permit must track potential "
               "emissions from all insignificant activities at the facility on an annual basis to demonstrate compliance "
               "with the facility emission limitations indicated below. An inventory of each insignificant activity and "
               "associated emission calculations must be made available to the Division for inspection upon request. For "
               "the purposes of this condition, insignificant activities are defined as any activity or equipment which "
               "emits any amount of a regulated pollutant but does not require an APEN or is permit exempt. Note that for "
               "reclassifications of an existing nonattainment area, the limit applies for the existing classification "
               "until the effective date of reclassification. ( Regulation Number 3 , Part B.  Section III.E. ) ")
GP07_ROW = ("Facilities located in an area classified as serious nonattainment for ozone, total potential point source "
            "emissions from the facility, including all permitted emissions and potential to emit from all insignificant "
            "activities, must be less than:  Volatile Organic Compounds (VOC): 50 tons per year  Nitrogen Oxides (NOx): "
            "50 tons per year  Carbon Monoxide (CO): 100 tons per year ")
GP07_BEFORE = ("The permit requires facilities in a serious ozone nonattainment area to keep total potential point source "
               "emissions (permitted plus all insignificant activities) below 50 tpy VOC, 50 tpy NOx, and 100 tpy CO. The "
               "owner or operator must track insignificant-activity emissions annually and make the inventory and "
               "calculations available to the Division on request.")


def _ctx_rows():
    """The two production chains from the stage-1 spot check, as rows."""
    def row(pid, parent, cite, title, text, order, summary=None, status="approved", reviewed_by=HAND_STAMP):
        return {"id": pid, "citation": cite, "title": title, "parent_id": parent, "full_text": f"<p>{text}</p>",
                "sort_order": order, "ai_summary": summary, "summary_status": status, "summary_original": None,
                "summary_model": "claude-sonnet-4-5", "reviewed_by": reviewed_by if summary else None,
                "reviewed_at": "2026-09-20T00:00:00+00:00"}
    return [
        row("sec-gp01-top-REG-gp01", None, "APCD General Permit GP01",
            "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Condensate Storage Tank Batteries — GP01 Issuance 6, July 23, 2025",
            "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Condensate Storage Tank Batteries — GP01 Issuance 6, July 23, 2025", 0),
        row("sec-gp01-VIII", "sec-gp01-top-REG-gp01", "VIII.", "VIII. General Permit Terms and Administration",
            "VIII. General Permit Terms and Administration", 680),
        row("sec-gp01-VIII-C", "sec-gp01-VIII", "VIII.C.", "VIII.C. General Terms", "VIII.C. General Terms", 710),
        row("sec-gp01-VIII-C-1", "sec-gp01-VIII-C", "VIII.C.1.", "VIII.C.1.", APEN_GP, 720),
        row("sec-gp01-VIII-C-1-a", "sec-gp01-VIII-C-1", "VIII.C.1.a.", "VIII.C.1.a.", APEN_PARENT, 730),
        row("sec-gp01-VIII-C-1-a-(ii)", "sec-gp01-VIII-C-1-a", "VIII.C.1.a.(ii).", "VIII.C.1.a.(ii).", APEN_ROW, 750, APEN_BEFORE),
        row("sec-gp07-top-REG-gp07", None, "APCD General Permit GP07",
            "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Hydrocarbon Liquid Loadout — GP07 Issuance 4, July 23, 2025",
            "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Hydrocarbon Liquid Loadout — GP07 Issuance 4, July 23, 2025", 0),
        row("sec-gp07-II", "sec-gp07-top-REG-gp07", "II.", "II. Operating Terms and Conditions", "II. Operating Terms and Conditions", 130),
        row("sec-gp07-II-B", "sec-gp07-II", "II.B.", "II.B. Facility-Wide Emission Limitation Requirements",
            "II.B. Facility-Wide Emission Limitation Requirements", 210),
        row("sec-gp07-II-B-1", "sec-gp07-II-B", "II.B.1.", "II.B.1.", GP07_PARENT, 220),
        row("sec-gp07-II-B-1-b", "sec-gp07-II-B-1", "II.B.1.b.", "II.B.1.b.", GP07_ROW, 240, GP07_BEFORE),
    ]


def test_apen_row_sees_the_grandparent_duty_and_the_parent_timing():
    db = FakeSupabase(_ctx_rows())
    r = _review_for(db, "sec-gp01-VIII-C-1-a-(ii)")
    block = r.prompt.split(review.ANCESTOR_BLOCK_HEADING)[1].split("\nProvision text:")[0]
    # every ancestor, root first, each labelled with its id, the parent last
    ids = re.findall(r"^\[(sec-[^\]]+)\]", block, re.M)
    assert ids == ["sec-gp01-top-REG-gp01", "sec-gp01-VIII", "sec-gp01-VIII-C", "sec-gp01-VIII-C-1", "sec-gp01-VIII-C-1-a"]
    assert "A revised APEN must be filed" in block                  # the grandparent's duty
    assert "Annually by April 30th" in block                        # the parent's timing
    assert review.CUT_MARKER not in block and r.ancestors["cut"] is False
    # the summarizer's silently cut parent excerpt is gone
    assert "Parent paragraph text" not in r.prompt and "…" not in block
    # the summary under review is the one that must keep "revised APEN"
    assert r.summary == APEN_BEFORE


def test_gp07_row_sees_the_whole_parent_including_upon_request():
    db = FakeSupabase(_ctx_rows())
    r = _review_for(db, "sec-gp07-II-B-1-b")
    block = r.prompt.split(review.ANCESTOR_BLOCK_HEADING)[1].split("\nProvision text:")[0]
    assert "made available to the Division for inspection upon request" in block     # past PARENT_TEXT_CHARS (400)
    assert "not subject to Conditions I.B. or I.C. or I.D." in block
    import legacy_writer
    assert len(sz.strip_html(db.row("sec-gp07-II-B-1")["full_text"])) > legacy_writer.LEGACY_PARENT_TEXT_CHARS
    assert review.CUT_MARKER not in block


@pytest.mark.parametrize("text,limit,expect_cut,ends_with", [
    ("Short sentence.", 100, False, "Short sentence."),
    ("First sentence is here. Second sentence is longer and goes on. Third one.", 65, True, "Second sentence is longer and goes on. " + review.CUT_MARKER),
    ("word " * 100, 60, True, review.CUT_MARKER),
])
def test_honest_cut_cuts_at_a_sentence_end_and_marks_it(text, limit, expect_cut, ends_with):
    out, cut = review.honest_cut(text, limit)
    assert cut is expect_cut and out.endswith(ends_with)
    if cut:
        assert len(out) <= limit + len(review.CUT_MARKER) + 1
    else:
        assert review.CUT_MARKER not in out


def test_honest_cut_falls_back_to_a_word_boundary_when_no_sentence_end_is_late_enough():
    text = "A. " + "x" * 200 + " y" * 50          # sentence end far too early (<60% of the limit)
    out, cut = review.honest_cut(text, 120)
    assert cut and out.endswith(review.CUT_MARKER) and not out.startswith("A. " + review.CUT_MARKER)


def test_ancestor_block_trims_the_farthest_first_and_never_the_parent(monkeypatch):
    rows = _ctx_rows()
    long = ("This ancestor paragraph is long and keeps going with more words. " * 40)   # ~2,600 chars
    for pid in ("sec-gp01-VIII", "sec-gp01-VIII-C", "sec-gp01-VIII-C-1", "sec-gp01-VIII-C-1-a"):
        next(r for r in rows if r["id"] == pid)["full_text"] = f"<p>{long}</p>"
    db = FakeSupabase(rows)
    meta, _ = _meta(db)
    row = db.row("sec-gp01-VIII-C-1-a-(ii)")
    # per-ancestor cap first: each is cut at ~1,500 chars, honestly marked
    lines, info = review.build_ancestor_block(row, meta)
    assert info["cut"] is True
    for line in lines[1:]:
        if line.startswith("[sec-"):
            assert len(line) <= review.ANCESTOR_EXCERPT_CHARS + 120
    # total cap: 4 x 1,500 + root > 6,000 -> the farthest are shrunk to 200, then dropped; the parent keeps 1,500
    monkeypatch.setattr(sz, "ANCESTOR_BLOCK_CHARS", 2500)   # the one copy lives in summarize.py
    lines, info = review.build_ancestor_block(row, meta)
    parent_line = next(l for l in lines if l.startswith("[sec-gp01-VIII-C-1-a]"))
    assert len(parent_line) > 1400 and parent_line.endswith(review.CUT_MARKER)
    assert info["omitted"] >= 1 and any("farther ancestor" in l and "omitted" in l for l in lines)
    assert sum(len(l) for l in lines if l.startswith("[sec-")) <= 2500 + 120
    shown = [l.split("]")[0][1:] for l in lines if l.startswith("[sec-")]
    assert shown[-1] == "sec-gp01-VIII-C-1-a"                      # the parent is always the last and present
    assert "sec-gp01-top-REG-gp01" not in shown                      # the root went first
    # the order of trimming: whatever remains is a contiguous tail of the chain ending at the parent
    full = ["sec-gp01-top-REG-gp01", "sec-gp01-VIII", "sec-gp01-VIII-C", "sec-gp01-VIII-C-1", "sec-gp01-VIII-C-1-a"]
    assert full[-len(shown):] == shown


def test_prompt_version_3_states_the_context_rules():
    p = review.REVIEW_SYSTEM_PROMPT
    assert "A statement supported by any ancestor shown is supported" in p
    assert "[excerpt cut]" in p and "change it only if the visible text contradicts it" in p
    assert "must not replace a specific, supported duty" in p
    assert "a limit an ancestor places on the duty" in p and "widens the scope" in p
    assert "Text above this provision" in p
    assert review.REVIEW_PROMPT_VERSION not in ("4c41cd5622", "6a8ff2ce6c", "9ace8f1496")


# --------------------------------------------------------------------------
# Snapshot text as the input: --audit-ids --from-snapshot and --redo-corrections-since
# --------------------------------------------------------------------------

class _RpcAny:
    """rpc() for the snapshot readers: the fake db keeps the snapshot in
    tables['archive_snapshot'] and the live rows in tables['provisions']."""

    def __init__(self, db, name, params):
        self.db, self.name, self.params = db, name, params

    def execute(self):
        self.db.rpc_calls.append((self.name, dict(self.params), len(self.db.writes)))
        snap = self.db.tables["archive_snapshot"]
        if self.name == "rereview_snapshot_text":
            ids = set(self.params["p_ids"])
            return _Result([{"id": s["id"], "ai_summary": s["ai_summary"], "snapshot_at": "x"} for s in snap if s["id"] in ids])
        if self.name == "rereview_corrected_between":
            out = []
            for s in snap:
                live = self.db.row(s["id"])
                until = self.params.get("p_until")
                if ("summary corrected, automated pipeline" in (live.get("reviewed_by") or "")
                        and (live.get("reviewed_at") or "") >= self.params["p_since"]
                        and (until is None or (live.get("reviewed_at") or "") < until)
                        and live["summary_status"] in ("approved", "edited")):
                    out.append({"id": s["id"], "before_summary": s["ai_summary"], "live_summary": live["ai_summary"],
                                "reviewed_at": live["reviewed_at"]})
            lo = self.params.get("p_offset") or 0
            return _Result(out[lo:lo + (self.params.get("p_limit") or 500)])
        return _Rpc(self.db, self.name, self.params).execute()


def _stage1_db():
    """After stage 1: the two context rows were corrected (live text is the
    bad correction, snapshot holds the before text) and one reg 8 row passed."""
    rows = _ctx_rows()
    rows.append({"id": "sec-8-A-000", "citation": "0.", "title": "", "parent_id": None, "full_text": f"<p>{LONG}</p>",
                 "sort_order": 100, "ai_summary": "Reg 8 summary 0.", "summary_status": "approved",
                 "summary_original": None, "summary_model": "claude-sonnet-4-5", "reviewed_by": PIPELINE_STAMP,
                 "reviewed_at": "2026-10-05T04:45:00+00:00"})
    db = FakeSupabase(rows)
    db.rpc = lambda name, params: _RpcAny(db, name, params)
    bad_apen = ("The permit requires action annually by April 30 of the year following a significant increase in "
                "emissions, if your facility is a VOC or NOx source in an ozone non-attainment area.")
    bad_gp07 = GP07_BEFORE.replace("available to the Division on request", "available to the Division for inspection")
    for pid, before, live in (("sec-gp01-VIII-C-1-a-(ii)", APEN_BEFORE, bad_apen), ("sec-gp07-II-B-1-b", GP07_BEFORE, bad_gp07)):
        db.tables["archive_snapshot"].append({"id": pid, "ai_summary": before, "summary_original": None,
                                              "summary_status": "approved", "reviewed_by": HAND_STAMP,
                                              "reviewed_at": "2026-09-20T00:00:00+00:00", "summary_model": "m",
                                              "run_label": "review.py --rereview claude-sonnet-5-5 2026-10-05T04:39"})
        r = db.row(pid)
        r.update({"ai_summary": live, "summary_original": before,
                  "reviewed_by": "Claude (AI second-pass review; summary corrected, automated pipeline, claude-sonnet-5-5, 2026-10-05)",
                  "reviewed_at": "2026-10-05T04:44:00+00:00"})
    db.tables["archive_snapshot"].append({"id": "sec-8-A-000", "ai_summary": "Reg 8 summary 0.", "summary_original": None,
                                          "summary_status": "approved", "reviewed_by": HAND_STAMP, "reviewed_at": "x",
                                          "summary_model": "m", "run_label": "review.py --rereview ..."})
    return db


def test_audit_ids_from_snapshot_reviews_the_before_text_and_writes_nothing(monkeypatch, tmp_path):
    db = _stage1_db()
    before = json.dumps(db.tables, sort_keys=True)
    answers = {"sec-gp01-VIII-C-1-a-(ii)": _pass(), "sec-gp07-II-B-1-b": _pass()}
    rc, fake, report = _run(db, answers, ["--audit-ids", "sec-gp01-VIII-C-1-a-(ii),sec-gp07-II-B-1-b", "--from-snapshot", "--execute"],
                            monkeypatch, tmp_path)
    assert rc == 0 and db.writes == [] and json.dumps(db.tables, sort_keys=True) == before
    # the reviewer was given the BEFORE text, not the live correction
    sent = {fake.custom_id_map[q["custom_id"]]: q["params"]["messages"][0]["content"]
            for q in fake.messages.batches.created[0].requests}
    assert sent["sec-gp01-VIII-C-1-a-(ii)"].rstrip().endswith(APEN_BEFORE)
    assert sent["sec-gp07-II-B-1-b"].rstrip().endswith(GP07_BEFORE)
    assert "A revised APEN must be filed" in sent["sec-gp01-VIII-C-1-a-(ii)"]
    assert report["audit"]["from_snapshot"] is True and report["counts"]["pass"] == 2


def test_redo_restores_the_original_on_pass_and_writes_new_corrections(monkeypatch, tmp_path):
    db = _stage1_db()
    new_gp07 = GP07_BEFORE.replace("The owner or operator must track",
                                   "An owner or operator not subject to Conditions I.B., I.C. or I.D. must track")
    answers = {
        "sec-gp01-VIII-C-1-a-(ii)": _pass(),                                   # earlier correction withdrawn
        "sec-gp07-II-B-1-b": {"findings": [], "verdict": "corrected", "corrected_summary": new_gp07,
                              "changes": [{"before": "The owner or operator", "after": "An owner or operator not subject to Conditions I.B., I.C. or I.D.",
                                           "reason": "Parent paragraph II.B.1. limits the tracking duty."}], "fail_reason": ""},
    }
    rc, fake, report = _run(db, answers, ["--redo-corrections-since", "2026-10-05T04:38:00Z", "--execute"], monkeypatch, tmp_path)
    assert rc == 0
    assert report["counts"]["selected"] == 2                                   # the passed reg 8 row is not selected
    assert report["counts"] | {} == report["counts"]
    assert (report["counts"]["restored"], report["counts"]["corrected_different"], report["counts"]["corrected_same"],
            report["counts"]["fail"]) == (1, 1, 0, 0)
    apen = db.row("sec-gp01-VIII-C-1-a-(ii)")
    assert apen["ai_summary"] == APEN_BEFORE                                    # restored
    assert apen["summary_original"] == APEN_BEFORE                               # never overwritten
    assert apen["reviewed_by"].startswith("Claude (AI second-pass review, automated pipeline")
    assert apen["summary_status"] == "approved"
    gp07 = db.row("sec-gp07-II-B-1-b")
    assert gp07["ai_summary"] == new_gp07 and "on request" in gp07["ai_summary"]
    assert gp07["reviewed_by"].startswith("Claude (AI second-pass review; summary corrected")
    # one provision_changes row per changed live text
    assert sorted(c["provision_id"] for c in db.changes) == ["sec-gp01-VIII-C-1-a-(ii)", "sec-gp07-II-B-1-b"]
    assert any("original summary restored" in c["note"] for c in db.changes)
    # the snapshot's before text is untouched
    assert [s["ai_summary"] for s in db.tables["archive_snapshot"] if s["id"] == "sec-gp01-VIII-C-1-a-(ii)"] == [APEN_BEFORE]
    assert [c[0] for c in db.rpc_calls] == ["rereview_corrected_between"]        # no new snapshot call in redo mode
    md = (tmp_path / "out" / "review_report.md").read_text()
    assert "REDO" in md and "original summary restored" in md


def test_redo_same_correction_writes_no_change_row_and_fail_goes_pending(monkeypatch, tmp_path):
    db = _stage1_db()
    same = db.row("sec-gp07-II-B-1-b")["ai_summary"]                           # the reviewer writes the stage-1 text again
    answers = {
        "sec-gp07-II-B-1-b": {"findings": [], "verdict": "corrected", "corrected_summary": same,
                              "changes": [{"before": "x", "after": "y", "reason": "r"}], "fail_reason": ""},
        "sec-gp01-VIII-C-1-a-(ii)": _fail("cannot verify"),
    }
    rc, fake, report = _run(db, answers, ["--redo-corrections-since", "2026-10-05T04:38:00Z", "--execute"], monkeypatch, tmp_path)
    assert report["counts"]["corrected_same"] == 1 and report["counts"]["fail"] == 1
    assert db.row("sec-gp07-II-B-1-b")["ai_summary"] == same and db.changes == []
    assert db.row("sec-gp07-II-B-1-b")["reviewed_at"] != "2026-10-05T04:44:00+00:00"
    apen = db.row("sec-gp01-VIII-C-1-a-(ii)")
    assert apen["summary_status"] == "pending" and apen["ai_summary"].startswith("The permit requires action")


def test_redo_dry_run_writes_nothing_and_flags_are_exclusive(monkeypatch, tmp_path):
    db = _stage1_db()
    before = json.dumps(db.tables, sort_keys=True)
    rc, fake, report = _run(db, {}, ["--redo-corrections-since", "2026-10-05T04:38:00Z", "--dry-run"], monkeypatch, tmp_path)
    assert rc == 0 and db.writes == [] and json.dumps(db.tables, sort_keys=True) == before
    assert report["dry_run_quote"]["rows"] == 2 and report["run"]["mode"].startswith("REDO")
    for argv in (["--redo-corrections-since", "x", "--rereview"], ["--redo-corrections-since", "x", "--audit", "5"],
                 ["--from-snapshot"]):
        with pytest.raises(SystemExit):
            review.parse_args(argv)


def test_pre_submit_estimate_returns_ceiling_and_cache_floor(db):
    reviews = [_review_for(db, pid) for pid in ("sec-7-B-I-C", "sec-7-B-I-C-2", "sec-3-A-I-B")]
    ceiling, method, floor = review.estimate_run_cost(None, reviews, "claude-sonnet-5-5")
    assert method == "character estimate" and 0 < floor < ceiling
    # the floor is the ceiling with the system prompt read from the cache on every row but the first
    sys_tok = review.estimate_tokens_by_chars(len(review.REVIEW_SYSTEM_PROMPT), "claude-sonnet-5-5")
    saved = review.estimate_cost("claude-sonnet-5-5", sys_tok * 3, 0) - review.estimate_cost(
        "claude-sonnet-5-5", 0, 0, cache_creation_tokens=sys_tok, cache_read_tokens=sys_tok * 2)
    assert ceiling - floor == pytest.approx(saved, abs=1e-9)


def test_redo_selection_pages_and_honours_until(monkeypatch):
    db = _stage1_db()
    monkeypatch.setattr(review, "REDO_PAGE", 1)                 # force two pages for the two corrected rows
    rows = review.select_redo_candidates(db, "2026-10-05T04:38:00Z")
    assert sorted(r["id"] for r in rows) == ["sec-gp01-VIII-C-1-a-(ii)", "sec-gp07-II-B-1-b"]
    assert len([c for c in db.rpc_calls if c[0] == "rereview_corrected_between"]) == 3   # 1 + 1 + empty page
    # a row the first redo already re-corrected (later reviewed_at) is outside the until bound
    db.row("sec-gp07-II-B-1-b")["reviewed_at"] = "2026-10-05T05:50:00+00:00"
    rows = review.select_redo_candidates(db, "2026-10-05T04:38:00Z", "2026-10-05T05:45:00Z")
    assert [r["id"] for r in rows] == ["sec-gp01-VIII-C-1-a-(ii)"]
    assert review.parse_args(["--redo-corrections-since", "a", "--redo-until", "b"]).redo_until == "b"


# --------------------------------------------------------------------------
# Prompt version 4 (6 Oct 2026, ReviewBuiltIn item 8c): a correct expansion
# or standard name stays even when the provision itself does not define it.
# Two production rows the v3 reviewer got wrong are the fixtures.
# --------------------------------------------------------------------------

def _expansion_rows():
    return [
        {"id": "sec-ecmc-top-REG-ecmc", "citation": "2 CCR 404-1", "title": "ECMC rules", "parent_id": None,
         "full_text": "<p>Rules and regulations of the Energy and Carbon Management Commission</p>", "sort_order": 0,
         "ai_summary": None, "summary_status": "pending", "summary_original": None, "summary_model": None},
        {"id": "sec-ecmc-309", "citation": "Rule 309", "title": "Rule 309. Wildlife", "parent_id": "sec-ecmc-top-REG-ecmc",
         "full_text": "<p>Rule 309. WILDLIFE RESOURCES</p>", "sort_order": 1,
         "ai_summary": None, "summary_status": "pending", "summary_original": None, "summary_model": None},
        {"id": "sec-ecmc-309-e-(6)", "citation": "309.e.(6)", "title": "", "parent_id": "sec-ecmc-309",
         "full_text": "<p>CPW Consultation Outcomes.</p>", "sort_order": 2,
         "ai_summary": None, "summary_status": "pending", "summary_original": None, "summary_model": None},
        # Production row sec-ecmc-309-e-(6)-A, as corrected on 6 Oct 2026 by the
        # v3 reviewer: "Comprehensive Area Plan" turned back into "CAP" although
        # Rule 314 of the same regulation is titled Comprehensive Area Plans.
        {"id": "sec-ecmc-309-e-(6)-A", "citation": "309.e.(6).A.", "title": "309.e.(6).A.", "parent_id": "sec-ecmc-309-e-(6)",
         "full_text": "<p>If the Director agrees that the conditions of approval or denial as recommended by CPW are necessary and "
                      "reasonable to Avoid, Minimize, or Mitigate Adverse Impacts to Wildlife Resources, the Director will "
                      "incorporate CPW’s recommended conditions into the Director’s Recommendation on an Oil and Gas "
                      "Development Plan, Form 2A, or CAP.</p>", "sort_order": 3,
         "ai_summary": "If the Director agrees that conditions recommended by Colorado Parks and Wildlife (CPW) are necessary "
                       "and reasonable to avoid, minimize, or mitigate adverse impacts to wildlife resources, the Director "
                       "will include those conditions in the Director's Recommendation on an Oil and Gas Development Plan, "
                       "Form 2A, or Comprehensive Area Plan.",
         "summary_status": "pending", "summary_original": None, "summary_model": "claude-sonnet-4-5"},
        {"id": "sec-oooob-top-REG-oooob", "citation": "40 CFR 60 Subpart OOOOb", "title": "OOOOb", "parent_id": None,
         "full_text": "<p>Subpart OOOOb</p>", "sort_order": 10,
         "ai_summary": None, "summary_status": "pending", "summary_original": None, "summary_model": None},
        {"id": "sec-oooob-60.5360b", "citation": "§ 60.5360b", "title": "§ 60.5360b Am I subject to this subpart?",
         "parent_id": "sec-oooob-top-REG-oooob", "full_text": "<p>Am I subject to this subpart?</p>", "sort_order": 11,
         "ai_summary": None, "summary_status": "pending", "summary_original": None, "summary_model": None},
        # Production row sec-oooob-60.5360b-(c): "Title V operating permit" was
        # removed although 40 CFR parts 70 and 71 are the Title V permit programs.
        {"id": "sec-oooob-60.5360b-(c)", "citation": "§ 60.5360b(c)", "title": "§ 60.5360b(c) Exemption",
         "parent_id": "sec-oooob-60.5360b",
         "full_text": "<p>Exemption. You are exempt from the obligation to obtain a permit under 40 CFR part 70 or 40 CFR part 71, "
                      "provided you are not otherwise required by law to obtain a permit under 40 CFR 70.3(a) or 40 CFR 71.3(a). "
                      "Notwithstanding the previous sentence, you must continue to comply with the provisions of this subpart.</p>",
         "sort_order": 12,
         "ai_summary": "You are exempt from having to get a federal Title V operating permit (under 40 CFR parts 70 or 71) "
                       "unless some other law already requires you to get one under 40 CFR 70.3(a) or 71.3(a). Even if you're "
                       "exempt from the permit, you still must comply with all the requirements in this subpart.",
         "summary_status": "pending", "summary_original": None, "summary_model": "claude-sonnet-4-5"},
    ]


def test_prompt_version_4_keeps_correct_expansions_and_standard_names():
    p = review.REVIEW_SYSTEM_PROMPT
    assert "defined elsewhere in the same regulation or is the ordinary name of the cited program" in p
    assert "Comprehensive Area Plan" in p and "CAP" in p and "Rule 314" in p
    assert "Title V operating permit" in p and "40 CFR part 70 or part 71" in p
    assert "That the provision's own text does not define the term is not a reason to remove it" in p
    # and the Markdown-plus-wording rule
    assert "it is then an ordinary correction" in p


def test_fixture_cap_expansion_reverted_to_acronym_is_treated_as_pass():
    """The exact change the v3 reviewer made on sec-ecmc-309-e-(6)-A, with
    its exact reason: the validator now reads it as allowance 1 (a correct
    expansion turned back into its acronym) and the verdict is pass."""
    db = FakeSupabase(_expansion_rows())
    r = _review_for(db, "sec-ecmc-309-e-(6)-A")
    before = r.summary
    after = before.replace("Comprehensive Area Plan", "CAP")
    data = {"findings": [{"claim": "Comprehensive Area Plan", "problem": "the text says CAP"}],
            "verdict": "corrected", "corrected_summary": after,
            "changes": [{"before": "Comprehensive Area Plan", "after": "CAP",
                         "reason": "The text only says \"CAP\" and does not define it, so the expansion is unsupported."}],
            "fail_reason": ""}
    v = review.validate_verdict(data, r)
    assert v.verdict == "pass" and v.reason == review.ACRONYM_ONLY_REASON
    assert review._is_expansion_to_acronym("Comprehensive Area Plan", "CAP")
    assert review._is_expansion_to_acronym("Comprehensive Area Plan (CAP)", "CAP")
    assert not review._is_expansion_to_acronym("Comprehensive Area Plan", "Oil and Gas Location")


def test_fixture_title_v_name_is_in_the_prompt_and_a_wrong_expansion_still_corrects():
    """sec-oooob-60.5360b-(c): the prompt names "Title V operating permit" for
    a 40 CFR part 70/71 permit as a standard name to keep (the validator
    cannot know program names; the rule is the prompt's). A reason that says
    the expansion is WRONG still goes through as a correction."""
    db = FakeSupabase(_expansion_rows())
    r = _review_for(db, "sec-oooob-60.5360b-(c)")
    assert "Title V operating permit" in review.REVIEW_SYSTEM_PROMPT
    assert "40 CFR part 70 or 40 CFR part 71" in r.prompt
    wrong = r.summary.replace("Title V", "Title IV")
    data = {"findings": [], "verdict": "corrected", "corrected_summary": r.summary.replace("Title V operating permit", "permit"),
            "changes": [{"before": "Title V operating permit", "after": "permit",
                         "reason": "The expansion is wrong: parts 70 and 71 are not Title IV"}], "fail_reason": ""}
    v = review.validate_verdict(data, r)
    assert v.verdict == "corrected"
    assert wrong != r.summary


def test_cited_sibling_paragraphs_are_shown_to_the_reviewer():
    meta = {
        "sec-x-top-REG-x": {"id": "sec-x-top-REG-x", "parent_id": None, "citation": "X", "full_text": "<p>X</p>", "sort_order": 0},
        "sec-x-60.5417": {"id": "sec-x-60.5417", "parent_id": "sec-x-top-REG-x", "citation": "§ 60.5417", "full_text": "<p>You must meet this section.</p>", "sort_order": 10},
        "sec-x-60.5417-(a)": {"id": "sec-x-60.5417-(a)", "parent_id": "sec-x-60.5417", "citation": "§ 60.5417(a)", "full_text": "<p>For each control device used for § 60.5380 install monitoring per (c) through (g).</p>", "sort_order": 20},
        "sec-x-60.5417-(e)": {"id": "sec-x-60.5417-(e)", "parent_id": "sec-x-60.5417", "citation": "§ 60.5417(e)", "full_text": "<p>Valid data points must be available for 75 percent of the operating hours.</p>", "sort_order": 30},
        "sec-x-60.5417-(g)": {"id": "sec-x-60.5417-(g)", "parent_id": "sec-x-60.5417", "citation": "§ 60.5417(g)", "full_text": "<p>A deviation occurs when the criteria in (g)(1) through (6) are met.</p>", "sort_order": 40,
                              "ai_summary": "A deviation occurs when valid monitoring data are available for less than 75 percent of the operating hours in a day (paragraph (e) requires valid data for 75 percent); paragraphs (c) through (g) reach devices through paragraph (a) and the standard in § 60.5380; see paragraph (h)."},
        "sec-x-60.5417-(g)-(4)": {"id": "sec-x-60.5417-(g)-(4)", "parent_id": "sec-x-60.5417-(g)", "citation": "§ 60.5417(g)(4)", "full_text": "<p>A deviation occurs when the monitoring data are not available for at least 75 percent of the operating hours in a day.</p>", "sort_order": 50},
        "sec-x-60.5380": {"id": "sec-x-60.5380", "parent_id": "sec-x-top-REG-x", "citation": "§ 60.5380", "full_text": "<p>The centrifugal compressor standard.</p>", "sort_order": 5},
    }
    for r in meta.values():
        r.setdefault("title", r["citation"])
    row = meta["sec-x-60.5417-(g)"]
    rows = review.cited_rows(row, row["ai_summary"], meta)
    ids = [r["id"] for r in rows]
    # (e) and (a) are siblings, § 60.5380 another section; (c)..(f) do not exist;
    # (g) itself and (g)(4) (a descendant) are already in the official text; (h) does not exist
    assert ids == ["sec-x-60.5417-(e)", "sec-x-60.5417-(a)", "sec-x-60.5380"]
    inp = review.build_review_input(row, meta, sz.build_children_index(meta))
    assert "OTHER PROVISIONS OF THIS REGULATION THE SUMMARY CITES" in inp.prompt
    assert "[sec-x-60.5417-(e)] § 60.5417(e): Valid data points must be available for 75 percent" in inp.prompt
    assert inp.prompt.index("OTHER PROVISIONS") < inp.prompt.index("CURRENT SUMMARY")
    # a summary that cites nothing adds no block
    plain = dict(row, ai_summary="A deviation occurs when the criteria are met.")
    assert "OTHER PROVISIONS" not in review.build_review_input(plain, meta, sz.build_children_index(meta)).prompt
    # CCR-shaped ids are left alone
    assert review.cited_rows({"id": "sec-7-B-I-A-1", "parent_id": None}, "see paragraph (a)", meta) == []
