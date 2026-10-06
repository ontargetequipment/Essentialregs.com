"""Mocked-client tests for the chained run (run_chain.py), the import
trigger, the budget, the guard checks and the approval paths.

Everything runs on the in-memory fakes from test_review.py: a fake
supabase-py client that records every write, and a fake Anthropic client
whose batches answer the writer with summary text and the reviewer with
JSON verdicts. No network, no database, no paid call.
"""

from __future__ import annotations

import json
import re
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import budget as budget_module  # noqa: E402
import embed  # noqa: E402
import import_ccr as ic  # noqa: E402
import review  # noqa: E402
import run_chain  # noqa: E402
import summarize as sz  # noqa: E402
import summary_guard  # noqa: E402
from test_review import FakeSupabase, _Batch, _Item, _Message, _Outcome, _corrected, _fail, _pass  # noqa: E402

LONG = ("The owner or operator must keep records of each inspection for five years and make them "
        "available to the Division on request. ") * 3


def _rows():
    """A small regulation with four leaves and one parent."""
    return [
        {"id": "sec-gp03-top-REG-gp03", "citation": "GP03", "title": "General Permit 3", "parent_id": None,
         "full_text": "<p>General permit GP03</p>", "sort_order": 0, "ai_summary": None,
         "summary_status": "pending", "summary_original": None, "summary_model": None,
         "reviewed_by": None, "reviewed_at": None, "summary_generated_at": None, "updated_at": "2026-10-01T00:00:00+00:00"},
        {"id": "sec-gp03-I", "citation": "I.", "title": "Conditions", "parent_id": "sec-gp03-top-REG-gp03",
         "full_text": "<p>The permittee must comply with one of the following conditions:</p>", "sort_order": 1,
         "ai_summary": "Old parent summary that will be regenerated.", "summary_status": "approved",
         "summary_original": None, "summary_model": "claude-sonnet-4-5",
         "reviewed_by": "Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, 2026-10-05)",
         "reviewed_at": "2026-10-05T00:00:00+00:00", "summary_generated_at": "2026-10-01T00:00:00+00:00",
         "updated_at": "2026-10-01T00:00:00+00:00"},
    ] + [
        {"id": f"sec-gp03-I-{letter}", "citation": f"I.{letter}.", "title": "", "parent_id": "sec-gp03-I",
         "full_text": f"<p>Condition {letter}. {LONG}</p>", "sort_order": i + 2, "ai_summary": None,
         "summary_status": "pending", "summary_original": None, "summary_model": None,
         "reviewed_by": None, "reviewed_at": None, "summary_generated_at": None, "updated_at": "2026-10-01T00:00:00+00:00"}
        for i, letter in enumerate("ABCD")
    ]


class ChainBatches:
    """Routes each batch request to the writer answers (plain text) or the
    reviewer answers (JSON verdicts) by the request's shape; the reviewer's
    answers may be a list so the second review can answer differently."""

    def __init__(self, writer: dict, reviewer: dict, parent):
        self.writer = writer
        self.reviewer = reviewer
        self.parent = parent
        self.created: list[_Batch] = []
        self.canceled: list[str] = []
        self.retrieved: list[str] = []
        self.n = 0

    def create(self, requests):
        self.n += 1
        batch = _Batch(f"msgbatch_{self.n}", list(requests))
        self.created.append(batch)
        return batch

    def retrieve(self, batch_id):
        self.retrieved.append(batch_id)
        batch = next(b for b in self.created if b.id == batch_id)
        batch.processing_status = "ended"
        return batch

    def cancel(self, batch_id):
        self.canceled.append(batch_id)

    def results(self, batch_id):
        batch = next(b for b in self.created if b.id == batch_id)
        for req in batch.requests:
            pid = self.parent.custom_id_map[req["custom_id"]]
            if "output_config" in req["params"]:
                answer = self.reviewer.get(pid, _pass())
                if isinstance(answer, list):
                    answer = answer.pop(0) if answer else _pass()
                yield _Item(req["custom_id"], _Outcome(_Message(json.dumps(answer))))
            else:
                answer = self.writer.get(pid, f"Summary of {pid}: records are kept for five years.")
                if isinstance(answer, list):
                    answer = answer.pop(0)
                yield _Item(req["custom_id"], _Outcome(_Message(answer, i=2000, o=120)))


class ChainMessages:
    def __init__(self, writer, reviewer, parent):
        self.batches = ChainBatches(writer, reviewer, parent)
        self.count_calls = 0

    def count_tokens(self, **kwargs):
        self.count_calls += 1
        return types.SimpleNamespace(input_tokens=1500)

    def create(self, **kwargs):
        raise AssertionError("sync path not used by these tests")


class ChainAnthropic:
    def __init__(self, writer: dict, reviewer: dict):
        self.custom_id_map: dict[str, str] = {}
        self.messages = ChainMessages(writer, reviewer, self)


class FakeVoyage:
    def __init__(self, api_key, model):
        self.calls = 0

    def embed(self, texts, input_type="document"):
        self.calls += 1
        return [[0.1] * 4 for _ in texts], 100 * len(texts)


def _run(db, writer, reviewer, argv, monkeypatch, tmp_path, anthropic=None):
    fake = anthropic or ChainAnthropic(writer, reviewer)
    monkeypatch.setattr(sz, "make_supabase_client", lambda: db)
    monkeypatch.setattr(sz, "FAILED_LOG_PATH", tmp_path / "failed.jsonl")
    monkeypatch.setattr(review, "FAILED_LOG_PATH", tmp_path / "review_failed.jsonl")
    monkeypatch.setattr(run_chain, "OUT_DIR", tmp_path / "out")
    monkeypatch.setattr(run_chain, "REPORT_MD_PATH", tmp_path / "out" / "chain_report.md")
    monkeypatch.setattr(run_chain, "REPORT_JSON_PATH", tmp_path / "out" / "chain_report.json")
    monkeypatch.setattr(run_chain, "STATE_PATH", tmp_path / "out" / "chain_state.json")
    monkeypatch.setattr(sz.time, "sleep", lambda s: None)
    monkeypatch.setattr(review.time, "sleep", lambda s: None)
    monkeypatch.setattr(embed, "VoyageClient", FakeVoyage)
    monkeypatch.setattr(embed, "FAILED_LOG_PATH", tmp_path / "embed_failed.jsonl")
    monkeypatch.setattr(embed, "recompute_neighbors", lambda client, ids, start_after=None: len(ids or []))
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "VOYAGE_API_KEY"):
        monkeypatch.setenv(k, "x")
    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=lambda api_key: fake))
    real_make = sz.make_custom_id

    def tracking_make(pid, used):
        cid = real_make(pid, used)
        fake.custom_id_map[cid] = pid
        return cid
    monkeypatch.setattr(sz, "make_custom_id", tracking_make)
    rc = run_chain.main(argv)
    report = json.loads((tmp_path / "out" / "chain_report.json").read_text())
    return rc, fake, report


class _EmbedDb(FakeSupabase):
    """FakeSupabase plus the provision_embeddings table the embed stage reads
    and writes (upsert / delete are enough)."""

    def __init__(self, rows):
        super().__init__(rows)
        self.tables["provision_embeddings"] = []
        self.embedded: list = []

    def table(self, name):
        if name == "provision_embeddings":
            return _EmbTable(self)
        return super().table(name)


class _EmbTable:
    def __init__(self, db):
        self.db = db
        self.op = None
        self.payload = None

    def select(self, *a, **k):
        return self

    def like(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def range(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def gt(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def upsert(self, payload, **k):
        self.op, self.payload = "upsert", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        if self.op == "upsert":
            self.db.embedded.extend(self.payload)
        return types.SimpleNamespace(data=[])


# --------------------------------------------------------------------------
# The chained run
# --------------------------------------------------------------------------

def test_chain_summarizes_reviews_and_embeds_in_one_run(monkeypatch, tmp_path):
    db = _EmbedDb(_rows())
    reviewer = {"sec-gp03-I-B": _corrected("Condition B: records must be kept for five years and shown to the Division on request.")}
    rc, fake, report = _run(db, {}, reviewer, ["--reg", "gp03", "--sample-dir", str(tmp_path / "docs"), "--label", "gp03", "--seed", "1"],
                            monkeypatch, tmp_path)
    assert rc == 0
    # every written summary went pending first, then through the reviewer
    for letter in "ACD":
        row = db.row(f"sec-gp03-I-{letter}")
        assert row["summary_status"] == "approved" and "automated pipeline" in row["reviewed_by"]
    b = db.row("sec-gp03-I-B")
    assert b["summary_status"] == "approved" and b["ai_summary"].startswith("Condition B: records must")
    assert b["summary_original"].startswith("Summary of sec-gp03-I-B")
    # pending was written before approval: the first update on every row set it
    first_updates = {}
    for table, op, payload, ids in db.writes:
        if table == "provisions" and op == "update" and ids:
            first_updates.setdefault(ids[0], payload)
    assert all(first_updates[f"sec-gp03-I-{l}"]["summary_status"] == "pending" for l in "ABCD")
    assert report["counts"]["written"] == 4 and report["counts"]["review_pass"] == 3 and report["counts"]["review_corrected"] == 1
    assert report["counts"]["embedded"] == 4 and report["counts"]["still_pending"] == 0
    # two batches: one writer, one reviewer; nothing cancelled
    assert len(fake.messages.batches.created) == 2 and not fake.messages.batches.canceled
    assert "Budget: $10.00 per regulation" in (tmp_path / "out" / "chain_report.md").read_text()
    # the sample document names the ancestor text the reviewer saw
    sample = (tmp_path / "docs" / "gp03_chain_sample_40.md").read_text()
    assert "spot-check sample" in sample and "[sec-gp03-I]" in sample and "sec-gp03-I-B" in sample
    assert "Reviewer's reasons" in sample


def test_chain_regenerates_a_failed_row_once_and_lists_a_second_fail_at_the_top(monkeypatch, tmp_path):
    db = _EmbedDb(_rows())
    writer = {"sec-gp03-I-C": ["First try for C.", "Second try for C, rewritten."],
              "sec-gp03-I-D": ["First try for D.", "Second try for D."]}
    reviewer = {"sec-gp03-I-C": [_fail("describes the wrong thing"), _pass()],
                "sec-gp03-I-D": [_fail("cannot verify"), _fail("still cannot verify")]}
    rc, fake, report = _run(db, writer, reviewer, ["--reg", "gp03"], monkeypatch, tmp_path)
    assert rc == 0
    assert db.row("sec-gp03-I-C")["summary_status"] == "approved"
    assert db.row("sec-gp03-I-C")["ai_summary"] == "Second try for C, rewritten."
    assert db.row("sec-gp03-I-D")["summary_status"] == "pending"
    assert db.row("sec-gp03-I-D")["ai_summary"] == "Second try for D."
    assert report["counts"]["review_fail"] == 2 and report["counts"]["regenerated"] == 2
    assert report["counts"]["review2_pass"] == 1 and report["counts"]["review2_fail"] == 1
    assert [p["id"] for p in report["still_pending"]] == ["sec-gp03-I-D"]
    assert "failed review twice" in report["still_pending"][0]["reason"]
    md = (tmp_path / "out" / "chain_report.md").read_text()
    assert md.index("Rows still pending after this run (1)") < md.index("## Counts")
    assert "sec-gp03-I-D" in md.split("## Counts")[0]
    # four batches: write, review, regenerate, review2
    assert len(fake.messages.batches.created) == 4


def test_chain_dry_run_estimates_and_writes_nothing(monkeypatch, tmp_path):
    db = _EmbedDb(_rows())
    rc, fake, report = _run(db, {}, {}, ["--reg", "gp03", "--dry-run"], monkeypatch, tmp_path)
    assert rc == 0
    assert not fake.messages.batches.created and not db.writes
    assert report["run"]["mode"] == "dry run"
    est = report["budget"]["estimates"]["gp03"]
    assert set(est) == {"summarize", "review", "regenerate", "embed"} and sum(est.values()) < 10


def test_chain_stops_before_any_paid_call_when_the_estimate_passes_the_budget(monkeypatch, tmp_path):
    db = _EmbedDb(_rows())
    rc, fake, report = _run(db, {}, {}, ["--reg", "gp03", "--approved-budget", "0.001"], monkeypatch, tmp_path)
    assert rc == 2
    assert not fake.messages.batches.created and not db.writes
    assert "No paid call was made" in report["run"]["stopped"] and "gp03" in report["run"]["stopped"]
    assert "approved_budget workflow input" in report["budget"]["source"]
    md = (tmp_path / "out" / "chain_report.md").read_text()
    assert "Budget: $0.00 per regulation" in md.split("\n")[2] or "Budget: $0.00" in md


def test_chain_stops_during_the_run_when_actual_spend_passes_the_budget(monkeypatch, tmp_path):
    """The estimate fits (the fake counts 1,500 tokens a row) but the writer
    batch reports far more usage than estimated: the run records the spend
    after the batch, sees the regulation over budget, and stops before the
    review stage -- the written rows stay pending and are listed."""
    db = _EmbedDb(_rows())
    big = _Message("Huge summary of the row that cost a fortune.", i=3_000_000, o=1_000_000)
    fake = ChainAnthropic({f"sec-gp03-I-{l}": big.content[0].text for l in "ABCD"}, {})
    real_results = fake.messages.batches.results

    def expensive_results(batch_id):
        for item in real_results(batch_id):
            if "output_config" not in next(r for r in fake.messages.batches.created if r.id == batch_id).requests[0]["params"]:
                item.result.message.usage = big.usage
            yield item
    fake.messages.batches.results = expensive_results
    rc, fake, report = _run(db, {}, {}, ["--reg", "gp03"], monkeypatch, tmp_path, anthropic=fake)
    assert rc == 2
    assert "actual spend passed the budget" in report["run"]["stopped"]
    assert report["budget"]["spent"]["gp03"]["summarize"] > 10
    # written as pending, never reviewed, listed at the top
    assert all(db.row(f"sec-gp03-I-{l}")["summary_status"] == "pending" for l in "ABCD")
    assert len(report["still_pending"]) == 4 and "stopped on the budget" in report["still_pending"][0]["reason"]
    assert len(fake.messages.batches.created) == 1   # the writer batch only; no reviewer batch


def test_chain_resume_consumes_paid_batches_without_submitting(monkeypatch, tmp_path):
    """Run 1 dies after the writer batch was submitted (simulated by a
    retrieve that raises). Run 2 with --resume-batches consumes that batch,
    submits only the review batch, and finishes."""
    db = _EmbedDb(_rows())
    fake = ChainAnthropic({}, {})
    real_retrieve = fake.messages.batches.retrieve

    def dying_retrieve(batch_id):
        raise RuntimeError("runner lost")
    fake.messages.batches.retrieve = dying_retrieve
    with pytest.raises(RuntimeError):
        _run(db, {}, {}, ["--reg", "gp03"], monkeypatch, tmp_path, anthropic=fake)
    state = json.loads((tmp_path / "out" / "chain_state.json").read_text())
    assert state["batches"]["summarize"] == ["msgbatch_1"]
    assert not [w for w in db.writes if w[2].get("ai_summary")]      # nothing written (the root's empty summary was cleared)
    fake.messages.batches.retrieve = real_retrieve
    rc, fake, report = _run(db, {}, {}, ["--reg", "gp03", "--resume-batches", "summarize=msgbatch_1"],
                            monkeypatch, tmp_path, anthropic=fake)
    assert rc == 0
    assert len(fake.messages.batches.created) == 2       # the original writer batch + one review batch, no resubmission
    assert all(db.row(f"sec-gp03-I-{l}")["summary_status"] == "approved" for l in "ABCD")
    assert report["counts"]["written"] == 4 and report["run"]["resume"] == "summarize=msgbatch_1"


def test_chain_regenerates_ancestors_whose_prompt_holds_the_descendants(monkeypatch, tmp_path):
    db = _EmbedDb(_rows())
    ids = tmp_path / "ids.txt"
    ids.write_text("sec-gp03-I-A\n")
    anc = tmp_path / "anc.txt"
    anc.write_text("sec-gp03-I\nsec-gp03-top-REG-gp03\n")
    rc, fake, report = _run(db, {}, {}, ["--ids-file", str(ids), "--ancestor-ids-file", str(anc), "--skip-embed"],
                            monkeypatch, tmp_path)
    assert rc == 0
    written = set(report["written_ids"])
    assert written == {"sec-gp03-I-A", "sec-gp03-I"}        # the root has no summary of its own: skipped
    assert any("sec-gp03-top-REG-gp03: no summary of its own" in n for n in report["notes"])
    parent = db.row("sec-gp03-I")
    assert parent["summary_status"] == "approved" and parent["summary_original"] == "Old parent summary that will be regenerated."


def test_an_empty_ids_file_selects_nothing(monkeypatch, tmp_path):
    """An import that changed nothing hands the chain an empty id list; that
    must select nothing, never fall through to a whole-corpus scan."""
    db = _EmbedDb(_rows())
    ids = tmp_path / "ids.txt"
    ids.write_text("")
    rc, fake, report = _run(db, {}, {}, ["--ids-file", str(ids), "--skip-embed"], monkeypatch, tmp_path)
    assert rc == 0 and report["counts"]["selected"] == 0
    assert not fake.messages.batches.created and not db.writes
    assert any("empty" in n for n in report["notes"])


def test_parse_resume_spec():
    assert run_chain.parse_resume("summarize=a,b;review=c") == {"summarize": ["a", "b"], "review": ["c"]}
    assert run_chain.parse_resume(None) == {}
    with pytest.raises(ValueError):
        run_chain.parse_resume("nope=a")


# --------------------------------------------------------------------------
# The import trigger (item 2)
# --------------------------------------------------------------------------

def _prow(pid, parent, order, text):
    return {"id": pid, "citation": pid, "title": "", "parent_id": parent, "sort_order": order, "full_text": text}


def test_letters_or_digits_change_triggers_regeneration_and_markup_does_not():
    assert ic.text_letters_digits_changed("<p>within 30 days</p>", "<p>within 60 days</p>")
    assert ic.text_letters_digits_changed("<p>may comply</p>", "<p>must comply</p>")
    # markup only: a new link, a [sic] marker
    assert not ic.text_letters_digits_changed(
        '<p>See <span class="xref" data-target="sec-7-B-I">Section I.</span> of Part B.</p>',
        "<p>See Section I. of Part B.</p>")
    assert not ic.text_letters_digits_changed(
        '<p>are is<span class="er-sic" title="Printed this way in the official document."> [sic]</span> subject</p>',
        "<p>are is subject</p>")
    # whitespace and punctuation only: the reader sees the same words
    assert not ic.text_letters_digits_changed("<p>Owners  shall, inspect.</p>", "<p>Owners shall inspect</p>")


def test_apply_plan_lists_changed_rows_and_their_ancestors(tmp_path):
    parsed = [_prow("sec-9-A", None, 1, "<p>Part A</p>"),
              _prow("sec-9-A-I", "sec-9-A", 2, "<p>Section I</p>"),
              _prow("sec-9-A-I-1", "sec-9-A-I", 3, "<p>within 60 days</p>"),            # letters/digits changed
              _prow("sec-9-A-I-2", "sec-9-A-I", 4, '<p>See <a href="/regulations/7">Reg 7</a>.</p>'),  # markup only
              _prow("sec-9-A-II", "sec-9-A", 5, "<p>brand new section</p>")]            # new
    db = [_prow("sec-9-A", None, 1, "<p>Part A</p>"),
          _prow("sec-9-A-I", "sec-9-A", 2, "<p>Section I</p>"),
          _prow("sec-9-A-I-1", "sec-9-A-I", 3, "<p>within 30 days</p>"),
          _prow("sec-9-A-I-2", "sec-9-A-I", 4, "<p>See Reg 7.</p>")]
    c = ic.classify_apply(parsed, db)
    assert c["markup_only"] == {"sec-9-A-I-1": False, "sec-9-A-I-2": True}
    args = types.SimpleNamespace(reg="9", parsed=str(tmp_path / "p.json"), db=str(tmp_path / "d.json"),
                                 out_dir=str(tmp_path / "apply"), execute=False, yes=False, batch_bytes=150_000)
    (tmp_path / "p.json").write_text(json.dumps(parsed))
    (tmp_path / "d.json").write_text(json.dumps(db))
    ic.cmd_apply(args)
    regen = (tmp_path / "apply" / "summary_regen_ids.txt").read_text().split()
    anc = (tmp_path / "apply" / "summary_regen_ancestor_ids.txt").read_text().split()
    assert regen == ["sec-9-A-I-1", "sec-9-A-II"]            # the markup-only row is not regenerated
    assert anc == ["sec-9-A", "sec-9-A-I"]                     # ancestors of both, document order, no duplicates
    plan = json.loads((tmp_path / "apply" / "plan.json").read_text())
    by_id = {p["id"]: p for p in plan}
    assert by_id["sec-9-A-I-2"]["markup_only"] is True and by_id["sec-9-A-I-1"]["markup_only"] is False
    actions = ic._execute_write_plan(c, today="2026-10-06", now_iso="2026-10-06T00:00:00+00:00")
    updates = {a["id"]: a["payload"] for a in actions if a["op"] == "update"}
    assert updates["sec-9-A-I-1"]["summary_status"] == "pending"
    assert "summary_status" not in updates["sec-9-A-I-2"]


# --------------------------------------------------------------------------
# The guard checks (item 4)
# --------------------------------------------------------------------------

def _guard_rows(now):
    old = (now - timedelta(hours=30)).isoformat()
    fresh = (now - timedelta(hours=2)).isoformat()
    return [
        {"id": "sec-1-A", "summary_status": "pending", "ai_summary": "x", "summary_generated_at": old, "updated_at": old,
         "reviewed_by": None, "reviewed_at": None},                                   # stale -> hit
        {"id": "sec-1-B", "summary_status": "pending", "ai_summary": "x", "summary_generated_at": fresh, "updated_at": fresh,
         "reviewed_by": None, "reviewed_at": None},                                   # fresh -> fine
        {"id": "sec-1-C", "summary_status": "pending", "ai_summary": None, "summary_generated_at": None, "updated_at": old,
         "reviewed_by": None, "reviewed_at": None},                                   # structural, no summary -> fine
        {"id": "sec-1-D", "summary_status": "pending", "ai_summary": "x", "summary_generated_at": None, "updated_at": old,
         "reviewed_by": None, "reviewed_at": None},                                   # stale by updated_at, allow-listed
        {"id": "sec-1-E", "summary_status": "approved", "ai_summary": "x", "summary_generated_at": old, "updated_at": old,
         "reviewed_by": "brody@example.com", "reviewed_at": old},                     # outside the pipeline -> hit
        {"id": "sec-1-F", "summary_status": "edited", "ai_summary": "x", "summary_generated_at": old, "updated_at": old,
         "reviewed_by": "Claude (AI second-pass review; summary corrected, automated pipeline, m, d)", "reviewed_at": None},  # no date -> hit
        {"id": "sec-1-G", "summary_status": "approved", "ai_summary": "x", "summary_generated_at": old, "updated_at": old,
         "reviewed_by": "Claude (AI second-pass review, automated pipeline, m, d)", "reviewed_at": old},   # fine
        {"id": "sec-1-H", "summary_status": "approved", "ai_summary": "x", "summary_generated_at": old, "updated_at": old,
         "reviewed_by": None, "reviewed_at": old},                                    # null reviewer -> hit
    ]


def test_each_guard_check_counts_exactly_its_defect():
    now = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)
    db = FakeSupabase(_guard_rows(now))
    res = summary_guard.run_checks(db, now=now, allowlist={"sec-1-D": "cannot be verified: text over the cap"})
    assert res["summary_pending_over_24h"]["ids"] == ["sec-1-A"]
    assert res["summary_pending_over_24h"]["allowlisted"] == ["sec-1-D (cannot be verified: text over the cap)"]
    assert res["approved_outside_pipeline"]["ids"] == ["sec-1-E", "sec-1-H"]
    assert res["approved_without_review_date"]["ids"] == ["sec-1-F"]
    lines = summary_guard.format_results(res)
    assert lines[0].startswith("GUARD,summary_pending_over_24h,1,*** CHECK ***")
    assert any(l.startswith("GUARD,approved_outside_pipeline,2,*** CHECK ***") for l in lines)
    assert any(l.startswith("GUARD,approved_without_review_date,1,*** CHECK ***") for l in lines)


def test_guard_checks_are_zero_on_a_clean_corpus_and_page_past_1000_rows(monkeypatch):
    now = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)
    rows = [{"id": f"sec-1-{i:05d}", "summary_status": "approved", "ai_summary": "x",
             "summary_generated_at": None, "updated_at": None,
             "reviewed_by": "Claude (AI second-pass review, automated pipeline, m, d)", "reviewed_at": "2026-10-05T00:00:00+00:00"}
            for i in range(2500)]
    rows.append({"id": "sec-1-zzz", "summary_status": "approved", "ai_summary": "x", "summary_generated_at": None,
                 "updated_at": None, "reviewed_by": "hand", "reviewed_at": "2026-10-05T00:00:00+00:00"})
    db = FakeSupabase(rows)
    res = summary_guard.run_checks(db, now=now, allowlist={})
    assert res["approved_outside_pipeline"]["ids"] == ["sec-1-zzz"]       # row 2,501: only reachable by paging
    assert res["summary_pending_over_24h"]["count"] == 0 and res["approved_without_review_date"]["count"] == 0


def test_allowlist_is_read_from_the_qa_sql_file():
    allow = summary_guard.read_allowlist()
    assert isinstance(allow, dict) and "__none__" not in allow
    text = summary_guard.QA_SQL_PATH.read_text()
    for check in ("summary_pending_over_24h", "approved_outside_pipeline", "approved_without_review_date"):
        assert f"'{check}'" in text
    assert "'approved_without_ai_review'" not in text        # the looser check 21 is gone
    assert "pending_allowlist (id, reason) as (" in text


# --------------------------------------------------------------------------
# Selections past 1,000 rows (item 8b)
# --------------------------------------------------------------------------

class CappedSupabase(FakeSupabase):
    """PostgREST never returns more than 1,000 rows for one request: a
    selection that does not page sees a silently cut result."""

    CAP = 1000

    def table(self, name):
        q = super().table(name)
        real_execute = q.execute

        def capped_execute():
            res = real_execute()
            if isinstance(res.data, list) and len(res.data) > self.CAP:
                res.data = res.data[:self.CAP]
            return res
        q.execute = capped_execute
        return q


def _many(n):
    rows = []
    for i in range(n):
        rows.append({"id": f"sec-7-B-{i:05d}", "citation": f"{i}", "title": "", "parent_id": None,
                     "full_text": f"<p>{LONG}</p>", "sort_order": i, "ai_summary": "A summary.",
                     "summary_status": "pending", "summary_original": None, "summary_model": "m",
                     "reviewed_by": None, "reviewed_at": None, "jurisdiction_level": "state"})
    return rows


def test_every_row_selection_pages_past_the_postgrest_cap():
    n = 2345
    db = CappedSupabase(_many(n))
    assert len(sz.fetch_meta(db, None)) == n
    assert len(sz.fetch_meta(db, "7")) == n
    assert len(list(sz.iter_candidates(db, "7", True, None))) == n
    assert len(list(sz.iter_candidates(db, None, True, None, parent_ids=set(r["id"] for r in db.tables["provisions"])))) == n
    assert len(list(sz.iter_candidates(db, None, True, None, ids=[r["id"] for r in db.tables["provisions"]]))) == n
    assert len(list(review.iter_candidates(db, None, None))) == n
    assert len(list(review.iter_candidates(db, "7", None))) == n
    assert len(list(review.iter_candidates(db, None, None, ids=[r["id"] for r in db.tables["provisions"]]))) == n
    rows, info = review.select_audit_sample(db, 50, 1, population="all")
    assert info["eligible"] == 0        # pending rows are not eligible -- but the scan itself paged
    for r in db.tables["provisions"]:
        r["summary_status"] = "approved"
        r["reviewed_by"] = "Claude (x, automated pipeline)"
    rows, info = review.select_audit_sample(db, 50, 1, population="pipeline")
    assert info["eligible"] == n and len(rows) == 50
    assert len(embed.fetch_provisions(db, "7", None)) == n
    assert len(embed.fetch_provisions(db, None, None, ids=[r["id"] for r in db.tables["provisions"]])) == n
    assert len(ic.fetch_export_rows(db, "7")) == n
    assert len(ic.fetch_all_provision_ids(db)) == n


# --------------------------------------------------------------------------
# No code path other than review.py approves a summary (item 1)
# --------------------------------------------------------------------------

REPO = Path(__file__).resolve().parent.parent
APPROVAL_RE = re.compile(r"""summary_status["']?\s*[:=]\s*["'](approved|edited)["']""")


def test_only_review_py_sets_summary_status_approved_or_edited():
    """Every file in the repo that writes summary_status = approved/edited
    is pipeline/review.py, its tests, or the database trigger that forbids
    it elsewhere. The September hand SQL under docs/imports is historical
    (it would be refused by the trigger today) and is listed here so a new
    one cannot hide among them."""
    allowed = {
        "pipeline/review.py",
        "pipeline/test_review.py", "pipeline/test_run_chain.py", "pipeline/test_dbclient.py",
        "supabase/migrations/20261006090000_summary_approval_only_by_pipeline.sql",
    }
    historical_sql = {
        "docs/imports/2026-09-19/batch4_02_approvals.sql",
        "docs/site/sample_rows_2026-09-19.sql",
    }
    offenders = []
    for path in REPO.rglob("*"):
        if not path.is_file() or path.suffix not in {".py", ".ts", ".tsx", ".sql", ".js", ".mjs"}:
            continue
        rel = path.relative_to(REPO).as_posix()
        if rel.startswith(("node_modules/", ".next/", "supabase/migrations_archive/")) or "/node_modules/" in rel:
            continue
        if ".test." in path.name or path.name.startswith("test_"):
            continue    # test fixtures build approved rows; they are not write paths
        text = path.read_text(encoding="utf-8", errors="ignore")
        if APPROVAL_RE.search(text) or re.search(r"summary_status\s*=\s*'(approved|edited)'", text):
            if rel in allowed or rel in historical_sql:
                continue
            # SQL that only READS the status (where/filter) is fine; a SET is not
            if path.suffix == ".sql" and not re.search(r"set\s+summary_status\s*=\s*'(approved|edited)'", text, re.I):
                continue
            offenders.append(rel)
    assert offenders == [], f"summary_status approved/edited is written outside review.py: {offenders}"
    actions = (REPO / "src/app/admin/review/actions.ts").read_text()
    assert "approveSummary" not in actions and "saveEditAndApprove" not in actions
    assert '"approved"' not in actions and '"edited"' not in actions
    assert "sendBackToPending" in actions and "rejectSummary" in actions and "saveEditForReview" in actions


def test_the_trigger_migration_refuses_approval_without_the_pipeline_stamp():
    sql = (REPO / "supabase/migrations/20261006090000_summary_approval_only_by_pipeline.sql").read_text()
    assert "create trigger provisions_summary_approval_only_by_pipeline" in sql
    assert "not ilike '%automated pipeline%'" in sql and "reviewed_at is null" in sql
    assert "raise exception" in sql


# --------------------------------------------------------------------------
# The monthly audit writes nothing (item 5)
# --------------------------------------------------------------------------

def test_monthly_audit_samples_pipeline_reviewed_rows_and_writes_nothing(monkeypatch, tmp_path):
    from test_review import FakeAnthropic
    rows = _rows()
    for r in rows:
        if r["id"] != "sec-gp03-top-REG-gp03":
            r["ai_summary"] = r["ai_summary"] or "A reviewed summary."
            r["summary_status"] = "approved"
            r["reviewed_by"] = "Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, 2026-10-05)"
            r["reviewed_at"] = "2026-10-05T00:00:00+00:00"
    rows[2]["reviewed_by"] = "a September hand pass"       # not eligible for the pipeline population
    db = FakeSupabase(rows)
    answers = {r["id"]: _corrected("Would correct this.") for r in rows}
    fake = FakeAnthropic(answers)
    monkeypatch.setattr(sz, "make_supabase_client", lambda: db)
    monkeypatch.setattr(review, "FAILED_LOG_PATH", tmp_path / "review_failed.jsonl")
    monkeypatch.setattr(review, "OUT_DIR", tmp_path / "out")
    monkeypatch.setattr(review, "REPORT_MD_PATH", tmp_path / "out" / "review_report.md")
    monkeypatch.setattr(review, "REPORT_JSON_PATH", tmp_path / "out" / "review_report.json")
    monkeypatch.setattr(review.time, "sleep", lambda s: None)
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"):
        monkeypatch.setenv(k, "x")
    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(Anthropic=lambda api_key: fake))
    real_make = sz.make_custom_id

    def tracking_make(pid, used):
        cid = real_make(pid, used)
        fake.custom_id_map[cid] = pid
        return cid
    monkeypatch.setattr(sz, "make_custom_id", tracking_make)
    rc = review.main(["--audit", "100", "--audit-population", "pipeline", "--seed", "202610", "--max-cost", "1", "--execute"])
    assert rc == 0
    report = json.loads((tmp_path / "out" / "review_report.json").read_text())
    assert report["audit"]["population"] == "pipeline" and report["audit"]["eligible"] == 4
    assert report["counts"]["selected"] == 4 and report["counts"]["corrected"] == 4
    assert not db.writes                                     # nothing written, ever
    assert all(r["ai_summary"] != "Would correct this." for r in db.tables["provisions"])
    rate = report["counts"]["corrected"] / report["counts"]["selected"]
    assert rate == 1.0


# --------------------------------------------------------------------------
# Standing budget constant is read by every stage (item 6)
# --------------------------------------------------------------------------

def test_every_stage_reads_the_one_budget_constant():
    assert budget_module.STANDING_BUDGET_USD == 10.0
    for module in (sz, review, embed, run_chain):
        assert getattr(module, "budget_module") is budget_module
    assert budget_module.budget_from_args(None).usd_per_reg == budget_module.STANDING_BUDGET_USD
