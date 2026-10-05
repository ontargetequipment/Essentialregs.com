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


class FakeSupabase:
    def __init__(self, provisions: list[dict]):
        self.tables = {"provisions": [dict(r) for r in provisions], "provision_changes": []}
        self.writes: list = []
        self.queries: list = []

    def table(self, name):
        return _Query(self, name)

    def row(self, provision_id: str) -> dict:
        return next(r for r in self.tables["provisions"] if r["id"] == provision_id)

    @property
    def changes(self):
        return self.tables["provision_changes"]


# --------------------------------------------------------------------------
# Fake Anthropic
# --------------------------------------------------------------------------

class _Usage:
    def __init__(self, i=1000, o=100):
        self.input_tokens = i
        self.output_tokens = o


class _Block:
    type = "text"

    def __init__(self, text):
        self.text = text


class _Message:
    def __init__(self, text, stop_reason="end_turn", i=1000, o=100):
        self.content = [_Block(text)]
        self.stop_reason = stop_reason
        self.usage = _Usage(i, o)


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
    ours = review.build_official_text(row, meta, idx)
    theirs = sz.build_prompt(row, meta, idx)
    assert ours.prompt == theirs.prompt
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
    theirs = sz.build_prompt(db.row("sec-7-B-I-C-2"), *_meta(db))
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
    assert p["messages"][0]["content"] == r.prompt and p["system"] == review.REVIEW_SYSTEM_PROMPT


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
    ({**_corrected("Owners must inspect engines above 400 hp quarterly.\nRecords for five years.")}, "markdown"),
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
                                "api_errors": 0, "truncated_rows": 0, "outline_rows": 0, "with_descendants": 1}
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
    # count_tokens (free) was used once per row per distinct tokenizer, and the
    # schema allowance added
    tokenizers = {o["tokenizer"] for o in review.MODEL_OPTIONS}
    assert len(fake.messages.count_calls) == 3 * len(tokenizers)
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


def test_markdown_only_correction_that_changes_anything_else_is_a_fail():
    db = _md_db()
    r = _review_for(db, "sec-3-A-I-B-33")
    v = review.validate_verdict(_md_only("Modification means any change that increases emissions."), r)
    assert v.verdict == "fail" and "more than the markers" in v.reason


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
    assert fake.messages.batches.created[0].requests[0]["params"]["system"] == review.REVIEW_SYSTEM_PROMPT


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
