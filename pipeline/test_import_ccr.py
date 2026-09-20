#!/usr/bin/env python3
"""Unit tests for import_ccr.py's Supabase-touching paths (`export` and
`apply --execute`) using stub/fake client objects — no network access and no
real `supabase` package required. Run from the `pipeline/` directory:

    python -m unittest test_import_ccr -v

These are the only paths in import_ccr.py that talk to a live database, and
per pipeline/README.md they're only ever exercised in GitHub Actions (no
network to Supabase from this sandbox) — hence testing the paging and
payload/ordering logic here against stubs rather than live.
"""

from __future__ import annotations

import os
import sys
import types
import json
import re
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import import_ccr as ic  # noqa: E402


# ---------------------------------------------------------------------------
# HTML escaping — full_text is rendered client-side with
# dangerouslySetInnerHTML, so literal '&', '<', '>' in the source text must
# be entity-escaped before cross-reference markup is inserted around them.
# ---------------------------------------------------------------------------

class EscapeHtmlTextTests(unittest.TestCase):
    def test_escapes_amp_lt_gt(self):
        self.assertEqual(
            ic.escape_html_text("flow rate of < 60 grams/hour & > 2 tpy"),
            "flow rate of &lt; 60 grams/hour &amp; &gt; 2 tpy",
        )

    def test_amp_escaped_before_lt_gt_no_double_escaping(self):
        # '&' must be replaced first so that the '&' introduced by escaping
        # '<'/'>' is never itself re-escaped into '&amp;lt;' etc.
        self.assertEqual(ic.escape_html_text("<"), "&lt;")
        self.assertEqual(ic.escape_html_text(">"), "&gt;")
        self.assertEqual(ic.escape_html_text("&lt;"), "&amp;lt;")

    def test_quotes_are_left_alone(self):
        self.assertEqual(ic.escape_html_text('He said "hi" & left.'), 'He said "hi" &amp; left.')

    def test_plain_text_unchanged(self):
        self.assertEqual(ic.escape_html_text("no special chars here"), "no special chars here")


class RenderTableHtmlEscapingTests(unittest.TestCase):
    def test_cells_and_caption_are_escaped(self):
        table = {
            "caption": "Table 2 – Storage Tank Inspections",
            "rows": [
                ["Threshold (tpy)", "Frequency"],
                ["> 2 and < 12", "Semi-annually & quarterly"],
            ],
        }
        html = ic.render_table_html(table)
        self.assertIn("&gt; 2 and &lt; 12", html)
        self.assertIn("Semi-annually &amp; quarterly", html)
        self.assertNotIn("> 2 and < 12", html)
        # The table's own markup tags must still be real tags, not escaped.
        self.assertIn("<table", html)
        self.assertIn("<td>", html)


class LinkCitationsAfterEscapingTests(unittest.TestCase):
    """Escaping runs on plain text before link_citations() wraps citations in
    <span>/<a> markup -- confirms that order doesn't break citation
    matching (citations never contain '&', '<' or '>')."""

    def test_citation_still_linked_after_escaping_surrounding_text(self):
        # sec-7-B-I marks Part B as a "roman-numeral" part for
        # _default_parts_order's own-part-first resolution of a bare
        # "Section II.E.3." citation -- see import_ccr._default_parts_order.
        known_ids = {"sec-7-B-I", "sec-7-B-II-E-3", "sec-7-B-II-E-1"}
        text = "flow rate of < 60 grams/hour, see Section II.E.3. for details & more."
        escaped = ic.escape_html_text(text)
        linked, _buckets = ic.link_citations(escaped, "7", known_ids, set(), "B", "sec-7-B-II-E-1")
        self.assertIn("&lt; 60 grams/hour", linked)
        self.assertIn("&amp; more", linked)
        self.assertIn('<span class="xref" data-target="sec-7-B-II-E-3">', linked)


# ---------------------------------------------------------------------------
# `export` / fetch_export_rows — paging stub
# ---------------------------------------------------------------------------

class _StubExportTable:
    """Records every `.range()` call and serves pages by slicing an
    in-memory, already id-sorted row list — enough surface to exercise
    fetch_export_rows' select().like().order().range().execute() chain."""

    def __init__(self, rows: list[dict]):
        self.rows = rows
        self.range_calls: list[tuple[int, int]] = []
        self.like_calls: list[tuple[str, str]] = []
        self._start = 0
        self._end = 0

    def select(self, cols):
        self.selected_cols = cols
        return self

    def like(self, col, pattern):
        self.like_calls.append((col, pattern))
        return self

    def order(self, col):
        self.order_col = col
        return self

    def range(self, start, end):
        self._start, self._end = start, end
        self.range_calls.append((start, end))
        return self

    def execute(self):
        page = self.rows[self._start:self._end + 1]
        return SimpleNamespace(data=page)


class _StubExportClient:
    def __init__(self, rows: list[dict]):
        self._table = _StubExportTable(rows)

    def table(self, name):
        assert name == "provisions"
        return self._table


def _row(pid: str) -> dict:
    return {
        "id": pid, "citation": pid, "title": pid, "parent_id": None,
        "sort_order": 0, "full_text": "x",
    }


class FetchExportRowsTests(unittest.TestCase):
    def test_pages_until_short_page(self):
        rows = [_row(f"sec-7-A-{i:03d}") for i in range(7)]
        client = _StubExportClient(rows)
        out = ic.fetch_export_rows(client, "7", page_size=3)
        self.assertEqual([r["id"] for r in out], [r["id"] for r in rows])
        # 3 pages: [0-2] (3 rows), [3-5] (3 rows), [6-8] (1 row, short -> stop)
        self.assertEqual(client._table.range_calls, [(0, 2), (3, 5), (6, 8)])

    def test_exact_multiple_takes_one_extra_empty_round_trip(self):
        rows = [_row(f"sec-7-A-{i:03d}") for i in range(6)]
        client = _StubExportClient(rows)
        out = ic.fetch_export_rows(client, "7", page_size=3)
        self.assertEqual(len(out), 6)
        # Last full page (3 rows, not < page_size) forces one more (empty) page.
        self.assertEqual(client._table.range_calls, [(0, 2), (3, 5), (6, 8)])

    def test_empty_table(self):
        client = _StubExportClient([])
        out = ic.fetch_export_rows(client, "7", page_size=1000)
        self.assertEqual(out, [])
        self.assertEqual(client._table.range_calls, [(0, 999)])

    def test_like_pattern_is_lowercased_reg_prefix(self):
        client = _StubExportClient([])
        ic.fetch_export_rows(client, "OOOOb", page_size=10)
        self.assertEqual(client._table.like_calls, [("id", "sec-oooob-%")])

    def test_reads_only_the_documented_columns(self):
        client = _StubExportClient([])
        ic.fetch_export_rows(client, "7", page_size=10)
        self.assertEqual(client._table.selected_cols, ic.EXPORT_COLUMNS)
        self.assertEqual(
            set(c.strip() for c in ic.EXPORT_COLUMNS.split(",")),
            {"id", "citation", "title", "parent_id", "sort_order", "full_text"},
        )


# ---------------------------------------------------------------------------
# `apply --execute` — classification + payload/ordering logic
# ---------------------------------------------------------------------------

REG = "T"
ROOT = f"sec-{REG}-top-REG-{REG}"
PART_A = f"sec-{REG}-P-A"


def _prow(pid, parent_id, sort_order, full_text, citation=None, title=None):
    return {
        "id": pid, "citation": citation or pid, "title": title or pid,
        "parent_id": parent_id, "sort_order": sort_order, "full_text": full_text,
    }


def _build_classification():
    """One id of each class: identical, changed, new, obsolete — with a
    parent (PART_A) that is itself `identical`, so ordering assertions cover
    a parent-before-children case as well as same-class runs."""
    parsed = [
        _prow(PART_A, ROOT, 10, "Part A"),
        _prow(f"sec-{REG}-A-I", PART_A, 20, "same text"),           # identical
        _prow(f"sec-{REG}-A-II", PART_A, 30, "NEW visible text"),   # changed
        _prow(f"sec-{REG}-A-III", PART_A, 40, "brand new provision"),  # new
    ]
    db = [
        _prow(PART_A, ROOT, 10, "Part A"),
        _prow(f"sec-{REG}-A-I", PART_A, 20, "same text"),
        _prow(f"sec-{REG}-A-II", PART_A, 30, "OLD text"),
        _prow(f"sec-{REG}-A-OLD", PART_A, 25, "obsolete provision"),  # obsolete
    ]
    return ic.classify_apply(parsed, db)


class ClassifyApplyExecuteFixtureTests(unittest.TestCase):
    """Sanity-checks the fixture itself classifies the way the test names
    below assume, before trusting the payload/ordering assertions built on
    top of it."""

    def test_classes(self):
        c = _build_classification()
        self.assertEqual(set(c["identical"]), {PART_A, f"sec-{REG}-A-I"})
        self.assertEqual(c["changed"], [f"sec-{REG}-A-II"])
        self.assertEqual(c["new"], [f"sec-{REG}-A-III"])
        self.assertEqual(c["obsolete"], [f"sec-{REG}-A-OLD"])


NOW_ISO = "2026-09-15T12:00:00+00:00"


class ExecuteWritePlanTests(unittest.TestCase):
    """`identical`/`changed` rows must become one `update` action each (never
    an `upsert`, which -- per cmd_apply_execute's docstring -- evaluates the
    INSERT row, with every omitted NOT NULL column set to NULL, before it
    even checks the ON CONFLICT branch); `new` rows become `insert` actions
    batched up to the chunk cap."""

    def test_global_sort_order_preserved_across_shapes(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        ids_in_order = []
        for action in actions:
            if action["op"] == "insert":
                ids_in_order.extend(p["id"] for p in action["payloads"])
            else:
                ids_in_order.append(action["id"])
        self.assertEqual(
            ids_in_order,
            [PART_A, f"sec-{REG}-A-I", f"sec-{REG}-A-II", f"sec-{REG}-A-III"],
            "rows must be emitted in ascending sort_order regardless of class "
            "(a new parent must always precede any child that references it)",
        )

    def test_no_action_is_ever_an_upsert(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        self.assertTrue(actions)
        for action in actions:
            self.assertIn(action["op"], ("insert", "update"))

    def test_identical_and_changed_are_update_ops(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        update_ids = {a["id"] for a in actions if a["op"] == "update"}
        self.assertEqual(update_ids, {PART_A, f"sec-{REG}-A-I", f"sec-{REG}-A-II"})

    def test_identical_payload_omits_untouched_columns(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        identical_payloads = [
            a["payload"] for a in actions if a["op"] == "update" and a["shape"] == "identical"
        ]
        self.assertEqual(len(identical_payloads), 2)
        for payload in identical_payloads:
            self.assertEqual(
                set(payload.keys()), {"citation", "title", "parent_id", "sort_order", "updated_at"},
                "an `identical` row's UPDATE payload must only carry columns the SQL "
                "path's UPDATE SET clause touches for that class -- no `id` (that's "
                "the .eq() match key, not a SET column) and no jurisdiction_level/"
                "issuing_body/source_url/last_verified_date/is_public/full_text/"
                "summary_status/ai_summary",
            )

    def test_changed_payload_has_full_text_and_summary_reset_but_not_jurisdiction(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        changed = [a for a in actions if a["op"] == "update" and a["shape"] == "changed"]
        self.assertEqual(len(changed), 1)
        payload = changed[0]["payload"]
        self.assertEqual(payload["full_text"], "NEW visible text")
        self.assertEqual(payload["summary_status"], "pending")
        self.assertIsNone(payload["reviewed_by"])
        self.assertIsNone(payload["reviewed_at"])
        self.assertIsNone(payload["summary_original"])
        self.assertEqual(payload["updated_at"], NOW_ISO)
        for col in ("id", "jurisdiction_level", "issuing_body", "source_url", "last_verified_date", "is_public"):
            self.assertNotIn(col, payload, f"changed rows must never overwrite {col} on an existing row")
        self.assertNotIn("ai_summary", payload)

    def test_new_payload_has_every_not_null_column(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        new_rows = [p for a in actions if a["op"] == "insert" for p in a["payloads"]]
        self.assertEqual(len(new_rows), 1)
        row = new_rows[0]
        for col in (
            "id", "citation", "title", "jurisdiction_level", "issuing_body",
            "parent_id", "full_text", "source_url", "last_verified_date",
            "is_public", "summary_status", "sort_order",
        ):
            self.assertIn(col, row)
        self.assertEqual(row["jurisdiction_level"], "state")
        self.assertEqual(row["issuing_body"], "CDPHE-APCD")
        self.assertEqual(row["last_verified_date"], "2026-09-15")
        self.assertIs(row["is_public"], False)
        self.assertNotIn("ai_summary", row)

    def test_no_payload_ever_touches_ai_summary(self):
        c = _build_classification()
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=100)
        for action in actions:
            payloads = action["payloads"] if action["op"] == "insert" else [action["payload"]]
            for row in payloads:
                self.assertNotIn("ai_summary", row)

    def test_insert_chunk_never_exceeds_cap(self):
        c = _build_classification()
        for action in ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, chunk_size=1):
            if action["op"] == "insert":
                self.assertLessEqual(len(action["payloads"]), 1)

    def test_chunk_size_cap_enforced(self):
        # 250 synthetic `new` rows -> insert chunks of 100, 100, 50 at the default cap.
        parsed = [_prow(f"sec-{REG}-A-{i:04d}", PART_A, 100 + i, f"text {i}") for i in range(250)]
        db: list[dict] = []
        c = ic.classify_apply(parsed, db)
        self.assertEqual(len(c["new"]), 250)
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO)
        sizes = [len(a["payloads"]) for a in actions if a["op"] == "insert"]
        self.assertEqual(sizes, [100, 100, 50])
        self.assertTrue(all(n <= ic.EXECUTE_CHUNK for n in sizes))

    def test_parent_before_child_holds_for_real_reg7_data(self):
        """Integration-style check against the actual committed Reg 7
        parse/DB export (skipped if not present in this checkout): for
        every action in emission order, track which ids have been written
        so far, and assert every row's parent_id was already written (or
        is the regulation root, which is never itself new/changed/
        identical in a from-scratch corpus) before that row is."""
        parsed_path = os.path.join(os.path.dirname(__file__), "out", "reg7_parsed.json")
        db_path = os.path.join(os.path.dirname(__file__), "out", "reg7_db.json")
        if not (os.path.exists(parsed_path) and os.path.exists(db_path)):
            self.skipTest("pipeline/out/reg7_parsed.json and reg7_db.json not present in this checkout")
        import json as _json
        with open(parsed_path, encoding="utf-8") as f:
            parsed = _json.load(f)
        with open(db_path, encoding="utf-8") as f:
            db = _json.load(f)
        c = ic.classify_apply(parsed, db)
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO)

        parent_of = {row["id"]: row["parent_id"] for row in parsed}
        written: set[str] = set(c["obsolete"])  # untouched by this plan; parents can't depend on them here
        # Any id NOT in identical/changed/new (i.e. already-existing rows this
        # plan leaves alone, such as an ancestor further up an obsolete
        # chain) is assumed already present in the DB before this run starts.
        already_in_db = set(c["db_by_id"]) - set(c["obsolete"])
        written |= already_in_db - (set(c["identical"]) | set(c["changed"]) | set(c["new"]))

        for action in actions:
            # A multi-row INSERT is one Postgres statement that applies its
            # rows in order (immediate, non-deferred FK checks fire per row
            # as the statement executes), so within one insert batch a later
            # row may legitimately depend on an earlier row in that SAME
            # batch -- check and record row-by-row, not batch-by-batch.
            ids_this_step = (
                [p["id"] for p in action["payloads"]] if action["op"] == "insert" else [action["id"]]
            )
            for pid in ids_this_step:
                parent = parent_of.get(pid)
                if parent is not None:
                    self.assertIn(
                        parent, written,
                        f"{pid}'s parent {parent} must be written (or already exist) before {pid} itself",
                    )
                written.add(pid)


# ---------------------------------------------------------------------------
# `apply --execute` end-to-end against a fake `supabase` module
# ---------------------------------------------------------------------------

class _FakeQuery:
    def __init__(self, table, kind, payload=None):
        self.table = table
        self.kind = kind
        self.payload = payload
        self.ids = None
        self.eq_id = None

    def in_(self, col, ids):
        self.ids = list(ids)
        return self

    def eq(self, col, val):
        assert col == "id"
        self.eq_id = val
        return self

    def execute(self):
        call = {
            "table": self.table.name, "kind": self.kind, "payload": self.payload,
            "ids": self.ids, "id": self.eq_id,
        }
        self.table.client.calls.append(call)
        fail_at = self.table.client.fail_at_call
        if fail_at is not None and len(self.table.client.calls) == fail_at:
            raise RuntimeError(f"simulated failure on call #{fail_at}")
        if self.kind == "update":
            if self.eq_id in self.table.client.no_match_ids:
                return SimpleNamespace(data=[])
            return SimpleNamespace(data=[{"id": self.eq_id, **self.payload}])
        return SimpleNamespace(data=self.payload if isinstance(self.payload, list) else [])


class _FakeTable:
    def __init__(self, name, client):
        self.name = name
        self.client = client

    def insert(self, payload):
        return _FakeQuery(self, "insert", payload)

    def update(self, payload):
        return _FakeQuery(self, "update", payload)

    def delete(self):
        return _FakeQuery(self, "delete")


class _FakeClient:
    def __init__(self, fail_at_call=None, no_match_ids=frozenset()):
        self.calls: list[dict] = []
        self.fail_at_call = fail_at_call
        self.no_match_ids = no_match_ids  # ids whose .update().eq() simulates "matched zero rows"
        self._tables: dict[str, _FakeTable] = {}

    def table(self, name):
        return self._tables.setdefault(name, _FakeTable(name, self))


class _FakeSupabaseModuleCtx:
    """Installs a fake `supabase` module (with `create_client`) into
    sys.modules for the duration of the `with` block, so
    `cmd_apply_execute`'s `from supabase import create_client` resolves to
    the fake without the real `supabase` package being installed."""

    def __init__(self, client: "_FakeClient"):
        self.client = client
        self._had_real = "supabase" in sys.modules
        self._prior = sys.modules.get("supabase")

    def __enter__(self):
        fake_mod = types.ModuleType("supabase")
        fake_mod.create_client = lambda url, key: self.client
        sys.modules["supabase"] = fake_mod
        return self.client

    def __exit__(self, *exc):
        if self._had_real:
            sys.modules["supabase"] = self._prior
        else:
            sys.modules.pop("supabase", None)
        return False


class CmdApplyExecuteEndToEndTests(unittest.TestCase):
    def setUp(self):
        self._env_patch = {"SUPABASE_URL": "https://stub.example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "stub-key"}
        self._old_env = {k: os.environ.get(k) for k in self._env_patch}
        os.environ.update(self._env_patch)

    def tearDown(self):
        for k, v in self._old_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def _args(self, yes=True):
        return SimpleNamespace(yes=yes)

    def test_refuses_without_yes(self):
        c = _build_classification()
        with self.assertRaises(SystemExit):
            ic.cmd_apply_execute(self._args(yes=False), c, {f"sec-{REG}-A-OLD": PART_A}, "2026-09-15")

    def test_refuses_without_env(self):
        os.environ.pop("SUPABASE_URL")
        c = _build_classification()
        with self.assertRaises(SystemExit):
            ic.cmd_apply_execute(self._args(yes=True), c, {f"sec-{REG}-A-OLD": PART_A}, "2026-09-15")

    def test_full_run_order_and_payloads(self):
        c = _build_classification()
        ancestor_for = {f"sec-{REG}-A-OLD": PART_A}
        fake = _FakeClient()
        with _FakeSupabaseModuleCtx(fake):
            ic.cmd_apply_execute(self._args(yes=True), c, ancestor_for, "2026-09-15")

        # No call is ever an upsert -- identical/changed go through update(),
        # new rows through insert().
        self.assertFalse(any(call["kind"] == "upsert" for call in fake.calls))

        kinds = [(call["table"], call["kind"]) for call in fake.calls]
        # Every provisions update/insert precedes every provision_changes
        # insert, which precedes every provisions delete (rule 3/4 — deletes
        # last).
        provisions_writes = [i for i, k in enumerate(kinds) if k[0] == "provisions" and k[1] in ("update", "insert")]
        first_note_insert = next(i for i, k in enumerate(kinds) if k == ("provision_changes", "insert"))
        first_delete = next(i for i, k in enumerate(kinds) if k == ("provisions", "delete"))
        self.assertLess(max(provisions_writes), first_note_insert)
        self.assertLess(first_note_insert, first_delete)

        # The removal note lands on the resolved surviving ancestor with the
        # right change_type, and the delete covers exactly the obsolete id.
        note_call = next(call for call in fake.calls if call["kind"] == "insert" and call["table"] == "provision_changes")
        self.assertEqual(note_call["payload"]["provision_id"], PART_A)
        # 'provision_removed' is not a valid change_type per the DB check
        # constraint -- removal notes are logged as 'text_updated' (see
        # build_provision_change_insert / pipeline/out/apply_reg7/finish.sql).
        self.assertEqual(note_call["payload"]["change_type"], "text_updated")

        delete_call = next(call for call in fake.calls if call["kind"] == "delete")
        self.assertEqual(delete_call["ids"], [f"sec-{REG}-A-OLD"])

        # No provisions write ever carries ai_summary; identical-class
        # updates never carry full_text or an `id` column.
        update_calls = [call for call in fake.calls if call["table"] == "provisions" and call["kind"] == "update"]
        insert_calls = [call for call in fake.calls if call["table"] == "provisions" and call["kind"] == "insert"]
        for call in update_calls:
            self.assertNotIn("ai_summary", call["payload"])
            self.assertNotIn("jurisdiction_level", call["payload"])
            self.assertNotIn("id", call["payload"])
        for call in insert_calls:
            for row in call["payload"]:
                self.assertNotIn("ai_summary", row)
        identical_ids = {PART_A, f"sec-{REG}-A-I"}
        for call in update_calls:
            if call["id"] in identical_ids:
                self.assertNotIn("full_text", call["payload"])
                self.assertNotIn("summary_status", call["payload"])
        insert_ids = {row["id"] for call in insert_calls for row in call["payload"]}
        self.assertEqual(insert_ids, {f"sec-{REG}-A-III"})
        for row in insert_calls[0]["payload"]:
            self.assertIn("jurisdiction_level", row)
            self.assertIn("full_text", row)

    def test_failed_write_aborts_before_later_writes(self):
        c = _build_classification()
        ancestor_for = {f"sec-{REG}-A-OLD": PART_A}
        # Fail on the very first call (the first identical/changed update) —
        # nothing after it (notes, deletes) should ever be attempted.
        fake = _FakeClient(fail_at_call=1)
        with _FakeSupabaseModuleCtx(fake):
            with self.assertRaises(RuntimeError):
                ic.cmd_apply_execute(self._args(yes=True), c, ancestor_for, "2026-09-15")
        self.assertEqual(len(fake.calls), 1)
        self.assertFalse(any(call["kind"] == "delete" for call in fake.calls))
        self.assertFalse(any(call["table"] == "provision_changes" for call in fake.calls))

    def test_update_matching_zero_rows_aborts(self):
        c = _build_classification()
        ancestor_for = {f"sec-{REG}-A-OLD": PART_A}
        # PART_A's update "succeeds" (no exception) but matches no row --
        # PostgREST's own convention for an UPDATE whose WHERE matched
        # nothing. This must still abort the run with a non-zero exit.
        fake = _FakeClient(no_match_ids={PART_A})
        with _FakeSupabaseModuleCtx(fake):
            with self.assertRaises(SystemExit) as ctx:
                ic.cmd_apply_execute(self._args(yes=True), c, ancestor_for, "2026-09-15")
        self.assertNotEqual(ctx.exception.code, 0)
        self.assertFalse(any(call["kind"] == "delete" for call in fake.calls))
        self.assertFalse(any(call["table"] == "provision_changes" for call in fake.calls))


# ---------------------------------------------------------------------------
# Empty-DB path — a regulation not yet in the database at all (`db=[]`):
# diff/apply must classify every parsed id as `new`, with zero `obsolete`
# and zero parent-id mismatches, and every downstream step (plan/stats/SQL/
# --execute) must run cleanly against that. See pipeline/README.md's
# "make the CCR importer handle a regulation not yet in the database".
# ---------------------------------------------------------------------------

EMPTY_DB_REG = "Z"
EMPTY_DB_ROOT = f"sec-{EMPTY_DB_REG}-top-REG-{EMPTY_DB_REG}"
EMPTY_DB_PART_A = f"sec-{EMPTY_DB_REG}-P-A"


def _empty_db_parsed_fixture() -> list[dict]:
    return [
        _prow(EMPTY_DB_ROOT, None, 0, "Regulation Z"),
        _prow(EMPTY_DB_PART_A, EMPTY_DB_ROOT, 10, "Part A"),
        _prow(f"sec-{EMPTY_DB_REG}-A-I", EMPTY_DB_PART_A, 20, "some text"),
        _prow(f"sec-{EMPTY_DB_REG}-A-II", EMPTY_DB_PART_A, 30, "more text"),
    ]


class EmptyDbPathTests(unittest.TestCase):
    def test_classify_apply_everything_new_no_obsolete(self):
        parsed = _empty_db_parsed_fixture()
        c = ic.classify_apply(parsed, [])
        self.assertEqual(set(c["new"]), {r["id"] for r in parsed})
        self.assertEqual(c["identical"], [])
        self.assertEqual(c["changed"], [])
        self.assertEqual(c["obsolete"], [])

    def test_fetch_export_rows_for_reg_not_yet_in_db_is_empty_list(self):
        # `export` on a regulation with no rows yet must write `[]`, not
        # error or return something falsy-but-not-a-list.
        client = _StubExportClient([])
        out = ic.fetch_export_rows(client, EMPTY_DB_REG)
        self.assertEqual(out, [])
        self.assertIsInstance(out, list)

    def test_execute_write_plan_is_pure_inserts_no_updates_no_deletes(self):
        parsed = _empty_db_parsed_fixture()
        c = ic.classify_apply(parsed, [])
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO)
        self.assertTrue(actions)
        self.assertTrue(all(a["op"] == "insert" for a in actions))
        inserted_ids = {p["id"] for a in actions for p in a["payloads"]}
        self.assertEqual(inserted_ids, {r["id"] for r in parsed})
        # Root-before-child ordering must still hold with nothing pre-existing.
        order = [p["id"] for a in actions for p in a["payloads"]]
        self.assertLess(order.index(EMPTY_DB_ROOT), order.index(EMPTY_DB_PART_A))
        self.assertLess(order.index(EMPTY_DB_PART_A), order.index(f"sec-{EMPTY_DB_REG}-A-I"))

    def test_execute_write_plan_new_payloads_use_reg_meta(self):
        # A reg present in REG_META (here, "22") must get ITS metadata on
        # every inserted row, not the state/CDPHE-APCD fallback.
        parsed = [
            _prow("sec-22-top-REG-22", None, 0, "Regulation 22"),
            _prow("sec-22-P-A", "sec-22-top-REG-22", 10, "Part A"),
        ]
        c = ic.classify_apply(parsed, [])
        meta = ic.REG_META["22"]
        actions = ic._execute_write_plan(c, today="2026-09-15", now_iso=NOW_ISO, meta=meta)
        rows = [p for a in actions for p in a["payloads"]]
        self.assertEqual(len(rows), 2)
        for row in rows:
            self.assertEqual(row["jurisdiction_level"], meta["jurisdiction_level"])
            self.assertEqual(row["issuing_body"], meta["issuing_body"])
            self.assertEqual(row["source_url"], meta["source_url"])

    def test_build_upsert_statement_from_empty_db_new_rows(self):
        # The SQL-generation path (cmd_apply, without --execute) must also
        # build a valid statement when every row is `new`.
        parsed = _empty_db_parsed_fixture()
        c = ic.classify_apply(parsed, [])
        upsert_rows = []
        for pid in c["new"]:
            row = c["parsed_by_id"][pid]
            upsert_rows.append(dict(
                id=pid, sort_order=row["sort_order"], touch_full_text=True,
                values_sql=ic._row_values_sql(
                    row, "state", "CDPHE-APCD", ic.SOURCE_URL_DEFAULT, "2026-09-15", False, "pending",
                ),
            ))
        stmt = ic.build_upsert_statement(upsert_rows)
        self.assertIn("INSERT INTO provisions", stmt)
        self.assertIn("ON CONFLICT (id) DO UPDATE", stmt)
        for r in parsed:
            self.assertIn(r["id"], stmt)

    def test_cmd_apply_execute_end_to_end_empty_db_is_pure_inserts(self):
        parsed = _empty_db_parsed_fixture()
        c = ic.classify_apply(parsed, [])
        fake = _FakeClient()
        env_patch = {"SUPABASE_URL": "https://stub.example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "stub-key"}
        old_env = {k: os.environ.get(k) for k in env_patch}
        os.environ.update(env_patch)
        try:
            with _FakeSupabaseModuleCtx(fake):
                ic.cmd_apply_execute(SimpleNamespace(yes=True, reg=EMPTY_DB_REG), c, {}, "2026-09-15")
        finally:
            for k, v in old_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

        self.assertTrue(fake.calls)
        self.assertTrue(all(call["table"] == "provisions" and call["kind"] == "insert" for call in fake.calls))
        inserted_ids = {row["id"] for call in fake.calls for row in call["payload"]}
        self.assertEqual(inserted_ids, {r["id"] for r in parsed})

# ---------------------------------------------------------------------------
# Reg 8 (5 CCR 1001-10) additions: statement-of-basis SECTIONS inside
# ordinary parts (SOB_SECTION_CONFIG), tightly packed sibling lists
# (SIBLING_CHAIN_REGS), reg-scoped extra table captions / uncaptioned
# tables, and the Reg 8 KNOWN_LABEL_FIXES entries.
# ---------------------------------------------------------------------------

class Reg8ConfigTests(unittest.TestCase):
    def test_reg8_in_corpus_and_meta(self):
        self.assertEqual(ic.CORPUS_REGS["8"], "8")
        meta = ic.REG_META["8"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 8")
        self.assertEqual(meta["root_title"], "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10")

    def test_reg8_has_no_sob_part_but_four_sob_sections(self):
        self.assertNotIn("8", ic.SOB_PART_CONFIG)
        self.assertEqual(ic.SOB_SECTION_CONFIG["8"], {"A": "II", "B": "VII", "C": "II", "E": "VI"})
        # Additive: none of the baselined regulations picks up a section map.
        for reg in ("3", "7", "22", "26"):
            self.assertNotIn(reg, ic.SOB_SECTION_CONFIG)
            self.assertNotIn(reg, ic.SIBLING_CHAIN_REGS)
            self.assertNotIn(reg, ic.TABLE_CAPTION_EXTRA_RE)
            self.assertNotIn(reg, ic.UNCAPTIONED_TABLES)

    def test_reg8_label_fixes_each_hit_exactly_once_in_source(self):
        src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_8.txt")
        if not os.path.exists(src):
            self.skipTest("sources/REG_8.txt not present")
        with open(src, encoding="utf-8") as fh:
            lines, _ = ic.clean_pages(fh.read())
        _, applied = ic.apply_known_label_fixes("8", lines)
        self.assertEqual(len(applied), 39)
        for fix in applied:
            self.assertEqual(fix["hits"], 1, fix)


class SobSectionGuardTests(unittest.TestCase):
    """Inside a configured statement-of-basis SECTION, bare roman lines and
    labels rooted at an earlier section are body text; compound labels rooted
    at the SOB section itself (any depth) are still markers."""

    LINES = [
        "PART B          Asbestos Control",
        "",
        "I.     Definitions",
        "",
        "I.A.   Something.",
        "",
        "VII.     Statements of Basis, Specific Statutory Authority and Purpose for Part B",
        "",
        "VII.A.   Amendment to Section II (June 1, 1996)",
        "",
        "The Commission determines:",
        "",
        "I.      EPA established national standards for asbestos.",
        "",
        "II.     The federal rules discussed in (I) are performance-based.",
        "",
        "III.B. of this regulation was also revised.",
        "",
        "VII.B.   Revisions (September 19, 1996)",
        "",
        "        VII.B.1. Senate Bill 01-121",
        "",
        "                VII.B.1.a.       Single Family Residential Dwellings",
        "",
        "MM. and LLL were incorporated by reference.",
        "",
    ]

    def _citations(self, reg):
        markers, _ = ic.scan_markers(self.LINES, set(), reg)
        return [ic.tokens_to_citation(m["tokens"]) for m in markers if m["type"] == "item"]

    def test_reg8_guard_keeps_entries_and_nested_items_only(self):
        self.assertEqual(
            self._citations("8"),
            ["I.", "I.A.", "VII.", "VII.A.", "VII.B.", "VII.B.1.", "VII.B.1.a."],
        )

    def test_unconfigured_reg_is_unchanged_and_mis_reads_the_inner_list(self):
        # Documents WHY the guard exists: without it the inner "I."/"II."
        # findings list and the wrapped "III.B."/"MM." lines are accepted as
        # structure (the "I." collides with Part B's real Section I).
        cites = self._citations("26")
        self.assertIn("MM.", cites)
        self.assertEqual(cites.count("I."), 2)


class SiblingChainTests(unittest.TestCase):
    LINES = [
        "PART B          Asbestos Control",
        "",
        "I.     Incorporated Materials, Definitions, and Acronyms",
        "",
        "I.A.   Incorporated Materials",
        "",
        "       I.A.1.   United States Environmental Protection Agency's rules.",
        "",
        "       I.A.2.   Another incorporated document.",
        "",
        "I.C.   Acronyms",
        "",
        "I.C.1.      ABIH     American Board of Industrial Hygiene, Suite 300 ,",
        "            Lansing, MI 48917-4876",
        "I.C.2.      ACBM     asbestos-containing building material",
        "I.C.3.      CCR      Code of Colorado Regulations",
        "I.C.4.      CDPHE    Colorado Department of Public Health and Environment",
        "",
    ]

    def _citations(self, reg):
        markers, _ = ic.scan_markers(self.LINES, set(), reg)
        return [ic.tokens_to_citation(m["tokens"]) for m in markers if m["type"] == "item"]

    def test_reg8_accepts_packed_next_siblings_including_after_regulations(self):
        cites = self._citations("8")
        for c in ("I.C.1.", "I.C.2.", "I.C.3.", "I.C.4."):
            self.assertIn(c, cites)

    def test_other_regs_unchanged(self):
        cites = self._citations("26")
        self.assertIn("I.C.1.", cites)
        self.assertNotIn("I.C.2.", cites)

    def test_label_ordinal_and_next_sibling(self):
        self.assertEqual(ic._label_ordinal("digit", "12"), 12)
        self.assertEqual(ic._label_ordinal("lower", "b"), 2)
        self.assertEqual(ic._label_ordinal("upper", "AA"), 27)
        self.assertEqual(ic._label_ordinal("paren_roman", "iv"), 4)
        self.assertIsNone(ic._label_ordinal("roman", "IIII"))
        last = [("roman", "I"), ("upper", "C"), ("digit", "1")]
        self.assertTrue(ic._is_next_sibling([("roman", "I"), ("upper", "C"), ("digit", "2")], last))
        self.assertFalse(ic._is_next_sibling([("roman", "I"), ("upper", "C"), ("digit", "3")], last))
        self.assertFalse(ic._is_next_sibling([("roman", "I"), ("upper", "D"), ("digit", "2")], last))
        self.assertFalse(ic._is_next_sibling([("roman", "II")], [("roman", "I")]))  # depth-1 never chains
        self.assertFalse(ic._is_next_sibling(last, None))


class TableCaptionExtraTests(unittest.TestCase):
    def test_period_caption_only_for_reg8_and_is_whitespace_normalized(self):
        line = "      Table 1.         LIST OF HIGH-RISK POLLUTANTS"
        self.assertEqual(ic._table_caption_key(line, "8"), "Table 1. LIST OF HIGH-RISK POLLUTANTS")
        self.assertIsNone(ic._table_caption_key(line, "26"))
        self.assertIsNone(ic._table_caption_key(line, None))

    def test_standard_captions_unchanged_for_every_reg(self):
        for reg in ("7", "22", "26", "8", None):
            self.assertEqual(ic._table_caption_key("Table 2 – Storage Tank Inspections", reg),
                             "Table 2 – Storage Tank Inspections")
            self.assertEqual(ic._table_caption_key("  TABLE 1  ", reg), "TABLE 1")
            self.assertIsNone(ic._table_caption_key("Table A-5 of Subpart A, 40 CFR 98.253", reg))


class UncaptionedTableInPlaceTests(unittest.TestCase):
    def test_flattened_block_is_replaced_in_place(self):
        lines = [
            "PART B          Asbestos Control",
            "",
            "III.     Abatement",
            "",
            "III.G.   Permits",
            "",
            "        III.G.1. Fees",
            "",
            "            III.G.1.c. The fee schedule is as follows:",
            "",
            "                     Permit Fee for Projects",
            "              1-30 days      $400.00      $180.00",
            "              31-90 days     $800.00      $300.00",
            "",
            "              Permits are valid for a maximum of one year.",
            "",
        ]
        markers, _ = ic.scan_markers(lines, set(), "8")
        tables = {"Permit Fee for Projects": {"caption": "Permit Fee for Projects",
                                              "rows": [["Project Length", "Fee"], ["1-30 days", "$400.00"]]}}
        provisions, order, _, hits = ic.build_provisions("8", lines, markers, tables)
        row = provisions["sec-8-B-III-G-1-c"]
        self.assertEqual(hits["used"], 1)
        self.assertEqual(
            row["full_text"],
            "<p>The fee schedule is as follows:</p>"
            '<div class="doc-table-wrap"><div class="doc-table-caption">Permit Fee for Projects</div>'
            '<table class="doc-table"><thead><tr><th>Project Length</th><th>Fee</th></tr></thead>'
            "<tbody><tr><td>1-30 days</td><td>$400.00</td></tr></tbody></table></div>"
            "<p>Permits are valid for a maximum of one year.</p>",
        )

    def test_other_reg_keeps_flattened_text(self):
        lines = ["PART B  X", "", "III.  A", "", "III.G.   Permits", "", "  III.G.1. Fees", "",
                 "     III.G.1.c. Schedule:", "", "        Permit Fee for Projects", "        1-30 days $400.00", ""]
        markers, _ = ic.scan_markers(lines, set(), "26")
        tables = {"Permit Fee for Projects": {"caption": "Permit Fee for Projects", "rows": [["a", "b"]]}}
        provisions, _, _, hits = ic.build_provisions("26", lines, markers, tables)
        self.assertEqual(hits["used"], 0)
        self.assertNotIn("doc-table", provisions["sec-26-B-III-G-1-c"]["full_text"])


class ProgramSubpartAliasTests(unittest.TestCase):
    """link_citations step 1.2: "NSPS Subpart IIII" / "NESHAP Subpart ZZZZ"
    (no "40 CFR Part NN" prefix) link to the federal engine subparts once
    they are corpus regulations; other program+subpart mentions are only
    counted, and a fully-cited form is not double-wrapped."""

    TEXT = ("Engines must meet NSPS Subpart IIII and NESHAP Subpart ZZZZ; NSPS Subpart Dc boilers are "
            "excluded; see also 40 CFR Part 60, Subpart JJJJ.")

    def test_links_and_buckets(self):
        html, buckets = ic.link_citations(self.TEXT, "gp06", {"sec-gp06-top-REG-gp06"}, set(ic.CORPUS_REGS), "")
        self.assertIn('href="/regulations/iiii">NSPS Subpart IIII</a>', html)
        self.assertIn('href="/regulations/zzzz">NESHAP Subpart ZZZZ</a>', html)
        self.assertIn('href="/regulations/jjjj">40 CFR Part 60, Subpart JJJJ</a>', html)
        self.assertEqual(html.count("<a "), 3)
        self.assertEqual(dict(buckets[ic.BUCKET_CFR]), {"NSPS Subpart Dc": 1})

    def test_not_in_corpus_only_counts(self):
        corpus = set(ic.CORPUS_REGS) - {"iiii"}
        html, buckets = ic.link_citations("see NSPS Subpart IIII.", "gp06", {"sec-gp06-top-REG-gp06"}, corpus, "")
        self.assertNotIn("<a ", html)
        self.assertEqual(dict(buckets[ic.BUCKET_CFR]), {"NSPS Subpart IIII": 1})


class DottedCfrCitationTests(unittest.TestCase):
    TEXT = "see 40 C.F.R. Part 63, Subpart M and 40 C. F. R. Part 63, Subparts F and 40 CFR Part 60, Subpart OOOOb."

    def test_reg8_recognizes_dotted_forms(self):
        html, buckets = ic.link_citations(self.TEXT, "8", {"sec-8-top-REG-8"}, set(ic.CORPUS_REGS), "A")
        self.assertEqual(
            dict(buckets[ic.BUCKET_CFR]),
            {"40 C.F.R. Part 63, Subpart M": 1, "40 C. F. R. Part 63, Subparts F": 1},
        )
        self.assertIn('href="/regulations/oooob">40 CFR Part 60, Subpart OOOOb</a>', html)

    def test_other_regs_keep_the_undotted_tokenizer(self):
        self.assertNotIn("7", ic.CFR_DOTTED_REGS)
        html, buckets = ic.link_citations(self.TEXT, "7", {"sec-7-top-REG-7"}, set(ic.CORPUS_REGS), "A")
        self.assertEqual(dict(buckets[ic.BUCKET_CFR]), {})
        self.assertIn('href="/regulations/oooob">40 CFR Part 60, Subpart OOOOb</a>', html)



# ---------------------------------------------------------------------------
# Reg 1 — a regulation with NO "PART X" headings (REG_META `no_parts`), whose
# statement of basis is a top-level SECTION ("X.") rather than a part, and
# whose own appendices are printed inside that section. Fixture-driven: a
# miniature source in the exact pdftotext -layout shape of REG_1.txt.
# ---------------------------------------------------------------------------

_REG1_MINI = """\
    Outline of Regulation

    I.        Applicability and General Provisions

    II.       Smoke and Opacity Requirements

    X.        Statement of Basis, Specific Statutory Authority, and Purpose

    I.        Applicability and General Provisions

    I.A.      Applicability

        I.A.1.   The provisions of this Regulation Number 1 are applicable to both new and existing
                 sources. See Section II.A.1. of this regulation.

II.     Smoke and Opacity Requirements

II.A.   Stationary Sources

        II.A.1. No owner or operator of a source shall exceed 20% opacity.

X.               Statement of Basis, Specific Statutory Authority, and Purpose

Following are compilations of previously adopted versions.

Section II.A.1 – Smoke and Opacity.

II. The commission concluded that these emissions are significant.

X.A.    Adopted: August 11, 1977

RATIONALE FOR THE PROMULGATION. Revisions to Section II.A.1. of Regulation Number 1.

1.      A restarted inner list item.

2.      Another one.

X.B.    Adopted January 19, 1985

Revisions concerning Alfalfa Dehydration Plant Drum Dryers.

1.      A restarted inner list item again.

APPENDIX A

Method for Measuring Opacity from Fugitive Particulate Emission Sources

       a.      Principle and Applicability

X.C.    Adopted: August 15, 2024

Revision to Regulation Number 1 related to the Repeal of Carbon Monoxide.
"""


class Reg1NoPartsTests(unittest.TestCase):
    def _parse(self, text=_REG1_MINI):
        lines, seams = ic.clean_pages(text)
        start = ic.find_body_start_no_parts(lines)
        lines = lines[start:]
        markers, _audit = ic.scan_markers(lines, {i - start for i in seams if i >= start}, "1")
        provisions, order, unresolved, _ = ic.build_provisions("1", lines, markers, {})
        return [provisions[i] for i in order], unresolved

    def test_reg1_is_configured_as_part_less(self):
        self.assertTrue(ic.reg_has_no_parts("1"))
        for other in ("3", "7", "22", "26", "oooob"):
            self.assertFalse(ic.reg_has_no_parts(other))
        self.assertEqual(ic._sob_scope("1"), (None, "X"))
        self.assertEqual(ic._sob_scope("7"), ("C", None))
        self.assertEqual(ic.CORPUS_REGS["1"], "1")
        self.assertEqual(ic.REG_META["1"]["root_citation"], "Code of Colorado Regulations · Regulation Number 1")

    def test_provision_id_omits_part_segment_only_for_no_part(self):
        self.assertEqual(ic.provision_id("1", ic.NO_PART, "I-A-1"), "sec-1-I-A-1")
        self.assertEqual(ic.provision_id("7", "B", "I-A-1"), "sec-7-B-I-A-1")
        self.assertEqual(ic.provision_id("1", ic.NO_PART, "APPENDIX-A"), "sec-1-APPENDIX-A")

    def test_body_start_skips_the_outline_copy(self):
        lines, _ = ic.clean_pages(_REG1_MINI)
        start = ic.find_body_start_no_parts(lines)
        self.assertTrue(lines[start].strip().startswith("I.        Applicability"))
        # The outline's own "I." line is earlier and is NOT the body start.
        self.assertGreater(start, 0)
        self.assertNotIn("Outline", "".join(lines[start:]))
        # No outline at all -> 0 (scan everything).
        self.assertEqual(ic.find_body_start_no_parts(["I.   Only once", "text"]), 0)

    def test_ids_parents_and_kinds(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(
            [r["id"] for r in rows],
            ["sec-1-top-REG-1", "sec-1-I", "sec-1-I-A", "sec-1-I-A-1", "sec-1-II", "sec-1-II-A",
             "sec-1-II-A-1", "sec-1-X", "sec-1-X-A", "sec-1-X-B", "sec-1-APPENDIX-A", "sec-1-X-C"],
        )
        self.assertNotIn("sec-1-P-A", by_id)  # no fabricated part rows
        self.assertFalse(any(r["kind"] == "part" for r in rows))
        self.assertEqual(by_id["sec-1-I"]["parent_id"], "sec-1-top-REG-1")
        self.assertEqual(by_id["sec-1-X"]["parent_id"], "sec-1-top-REG-1")
        self.assertEqual(by_id["sec-1-I-A-1"]["parent_id"], "sec-1-I-A")
        self.assertEqual(by_id["sec-1-X-A"]["parent_id"], "sec-1-X")
        self.assertEqual(by_id["sec-1-I"]["kind"], "section")
        self.assertEqual(by_id["sec-1-X-A"]["citation"], "X.A.")
        self.assertEqual(by_id["sec-1-APPENDIX-A"]["parent_id"], "sec-1-top-REG-1")
        # Every parent resolves; ids unique.
        self.assertEqual(len(by_id), len(rows))
        for r in rows:
            self.assertTrue(r["parent_id"] is None or r["parent_id"] in by_id, r["id"])

    def test_section_scoped_sob_entries_and_inner_items_off(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        # The undated preamble (with its stray "II." and "Section II.A.1 –"
        # lines) is the body of the section row, not new markers.
        self.assertIn("The commission concluded", by_id["sec-1-X"]["full_text"])
        self.assertNotIn("sec-1-X-II", by_id)
        # Both "Adopted:" and "Adopted <date>" openers are accepted.
        self.assertTrue(by_id["sec-1-X-A"]["full_text"].startswith("<p>Adopted: August 11, 1977</p>"))
        self.assertTrue(by_id["sec-1-X-B"]["full_text"].startswith("<p>Adopted January 19, 1985</p>"))
        # inner_items False: the restarted "1." / "2." lists stay inside their entry.
        self.assertNotIn("sec-1-X-A-1", by_id)
        self.assertIn("A restarted inner list item.", by_id["sec-1-X-A"]["full_text"])
        self.assertIn("Another one.", by_id["sec-1-X-A"]["full_text"])

    def test_appendix_inside_sob_section_is_closed_by_next_entry(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        app = by_id["sec-1-APPENDIX-A"]
        self.assertEqual(app["kind"], "appendix")
        # Title on the line after a blank is recovered into the heading.
        self.assertEqual(app["title"], "Appendix A — Method for Measuring Opacity from Fugitive Particulate Emission Sources")
        self.assertIn("Principle and Applicability", app["full_text"])
        # X.C. after the appendix is its own entry, not swallowed by the appendix.
        self.assertIn("sec-1-X-C", by_id)
        self.assertNotIn("Repeal of Carbon Monoxide", app["full_text"])
        self.assertIn("Repeal of Carbon Monoxide", by_id["sec-1-X-C"]["full_text"])

    def test_same_reg_citations_resolve_without_a_part(self):
        rows, unresolved = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertIn('<span class="xref" data-target="sec-1-II-A-1">Section II.A.1.</span>', by_id["sec-1-I-A-1"]["full_text"])
        self.assertIn('data-target="sec-1-top-REG-1">Regulation Number 1</span>', by_id["sec-1-I-A-1"]["full_text"])
        # SOB prose citing a body section resolves into the body too.
        self.assertIn('data-target="sec-1-II-A-1">Section II.A.1.</span>', by_id["sec-1-X-A"]["full_text"])
        self.assertEqual(ic._roman_part_letters("1", set(by_id)), [ic.NO_PART])
        self.assertEqual(ic._default_parts_order(ic.NO_PART, "1", set(by_id)), [ic.NO_PART])
        self.assertEqual(ic._target_bucket_label("1", "sec-1-II-A-1"), "Section II. (no parts in this regulation)")
        self.assertEqual(ic._target_bucket_label("1", "sec-1-APPENDIX-A"), "appendix")
        # No-op for a part-ful reg's labels.
        self.assertEqual(ic._target_bucket_label("7", "sec-7-B-I-A"), "under Part B")

    def test_historical_bucket_for_missing_top_level(self):
        rows, _ = self._parse()
        known = {r["id"] for r in rows}
        target, bucket = ic._resolve_cite("V.A.5.c.", "1", known, [ic.NO_PART])
        self.assertIsNone(target)
        self.assertEqual(bucket, ic.BUCKET_HISTORICAL)
        target, bucket = ic._resolve_cite("II.A.9.", "1", known, [ic.NO_PART])
        self.assertIsNone(target)
        self.assertEqual(bucket, ic.BUCKET_UNPARSEABLE)
        target, _ = ic._resolve_cite("II.A.1.", "1", known, [ic.NO_PART])
        self.assertEqual(target, "sec-1-II-A-1")


class Reg1KnownFixesTests(unittest.TestCase):
    def test_label_fixes_rewrite_only_their_line(self):
        lines = [
            "              II.A.6.a Emissions from fireplaces, fireplace inserts and stoves, provided such devices",
            "                II.A.6.b. Fugitive dust: As used in this Regulation Number 1",
            "                 VI.F.1.a.        Test method,",
            "                 VI.F.1.a.       An equal or greater air quality benefit than that required in this",
            "                   III.D.2.(iv)        Control Measures and Operating Procedures",
            "             IV.B.4.d.            Natural Gas Desulfurization",
            "                                 III.D.2.j.(iv)(C) other equivalent methods or techniques approved by the",
        ]
        out, applied = ic.apply_known_label_fixes("1", lines)
        self.assertEqual({a["old_label"]: a["hits"] for a in applied},
                         {"II.A.6.a": 1, "III.D.2.(iv)": 1, "IV.B.4.d.": 1, "III.D.2.j.(iv)(C)": 1, "VI.F.1.a.": 1})
        self.assertTrue(out[0].strip().startswith("II.A.6.a. Emissions"))
        self.assertEqual(out[1], lines[1])
        self.assertEqual(out[2], lines[2])  # the REAL VI.F.1.a. is untouched
        self.assertTrue(out[3].strip().startswith("VI.F.2.a.       An equal"))
        self.assertTrue(out[4].strip().startswith("III.D.2.d.(iv)        Control"))
        self.assertTrue(out[5].strip().startswith("VI.B.4.d.            Natural"))
        self.assertTrue(out[6].strip().startswith("III.D.2.i.(iv)(C) other"))
        self.assertEqual(len(out[0]) - len(out[0].lstrip()), 14)  # indent preserved

    def test_text_fixes_restore_superscripts_and_drop_orphan_line(self):
        lines = [
            "                                  PE=0.5(FI)-0.26",
            "                 III.A.1.c.       0.1 lbs. per 106 BTU heat input for fuel burning equipment of greater than",
            "                           500x10 BTU per hour or more.",
            "                                 6",
            "                                  PE = 3.59(P)0.62",
            "                                 6",  # a second lone "6" NOT after the guard line: untouched
        ]
        out, applied = ic.apply_known_text_fixes("1", lines)
        hits = {a["old_label"]: a["hits"] for a in applied}
        self.assertEqual(hits["PE=0.5(FI)-0.26"], 1)
        self.assertEqual(hits["PE = 3.59(P)0.62"], 1)
        self.assertEqual(hits["6"], 1)
        self.assertEqual(out[0].strip(), "PE = 0.5(FI)^-0.26")
        self.assertIn("per 10^6 BTU", out[1])
        self.assertIn("500x10^6 BTU per hour or more.", out[2])
        self.assertEqual(out[3], "")
        self.assertEqual(out[4].strip(), "PE = 3.59(P)^0.62")
        self.assertEqual(out[5], lines[5])
        # No-op for every other regulation.
        self.assertEqual(ic.apply_known_text_fixes("26", lines), (lines, []))

    def test_known_continuation_line_is_skipped_as_marker(self):
        lines = [
            "        IV.D.2. The owner or operator of each fluid bed catalytic cracking unit",
            "",
            "        IV.D.3. Exemptions:",
            "",
            "                IV.D.3.a.       The owner or operator of a fluid bed catalytic cracking unit described in",
            "                        IV.D.2. may apply to the division for an exemption from continuous emission",
            "                        monitoring requirements listed in subsection IV.D.2.",
        ]
        skip, applied = ic.find_known_continuation_lines("1", lines)
        self.assertEqual(skip, {5})
        self.assertEqual(applied[0]["hits"], 1)
        self.assertEqual(applied[0]["old_label"], "IV.D.2.")
        # (the fixture starts mid-section, so the gap-fill self-heal also
        # synthesizes "IV." and "IV.D." — filtered out here)
        markers, _ = ic.scan_markers(lines, set(), "1", skip)
        cites = [ic.tokens_to_citation(m["tokens"]) for m in markers if not m.get("synthetic")]
        self.assertEqual(cites, ["IV.D.2.", "IV.D.3.", "IV.D.3.a."])
        # Without the skip set the wrapped citation is (wrongly) a second IV.D.2. marker.
        markers2, _ = ic.scan_markers(lines, set(), "1")
        self.assertEqual([ic.tokens_to_citation(m["tokens"]) for m in markers2 if not m.get("synthetic")],
                         ["IV.D.2.", "IV.D.3.", "IV.D.3.a.", "IV.D.2."])
        self.assertEqual(ic.find_known_continuation_lines("26", lines), (set(), []))


# ---------------------------------------------------------------------------
# Reg 2 (Odor Emission, 5 CCR 1001-4) — the additive config/branches added
# for it: REG_CYCLE_AB (lower -> paren_digit nesting), the combined
# "Code of Colorado Regulations <page>" footer, KNOWN_LABEL_FIXES["2"],
# SOB_PART_CONFIG["2"] and REG_META["2"]["part_intro_text"].
# ---------------------------------------------------------------------------

REG2_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_2.txt")


class Reg2CycleTests(unittest.TestCase):
    def test_cycle_override_only_for_reg_2(self):
        self.assertEqual(ic.cycle_ab_for("2"), ["roman", "upper", "digit", "lower", "paren_digit"])
        for reg in ("3", "7", "22", "26", None, ""):
            self.assertIs(ic.cycle_ab_for(reg), ic.CYCLE_AB)

    def test_paren_digit_under_lower_tokenizes_fully_for_reg_2(self):
        tokens, consumed = ic.tokenize_by_cycle("IV.A.3.c.(1) Rigid covers", ic.cycle_ab_for("2"))
        self.assertEqual([r for _, r in tokens], ["IV", "A", "3", "c", "1"])
        self.assertEqual(tokens[-1][0], "paren_digit")
        self.assertEqual("IV.A.3.c.(1) Rigid covers"[consumed:], " Rigid covers")
        self.assertEqual(ic.tokens_to_id_suffix(tokens), "IV-A-3-c-(1)")
        self.assertEqual(ic.tokens_to_citation(tokens), "IV.A.3.c.(1).")

    def test_default_cycle_still_stops_at_lower_before_paren_digit(self):
        # Unchanged behaviour for every other regulation: paren_roman is the
        # next depth after lower, so "(1)" is NOT consumed under CYCLE_AB.
        tokens, _ = ic.tokenize_by_cycle("IV.A.3.c.(1) Rigid covers", ic.CYCLE_AB)
        self.assertEqual([r for _, r in tokens], ["IV", "A", "3", "c"])

    def test_scan_markers_emits_paren_digit_items_for_reg_2(self):
        lines = [
            "PART B HOUSED COMMERCIAL SWINE FEEDING OPERATIONS",
            "",
            "IV. Technology Requirements",
            "",
            "IV.A. Anaerobic Vessels",
            "",
            "       IV.A.3. All Anaerobic Vessels",
            "",
            "               IV.A.3.c. Approved covers include the following:",
            "",
            "                       IV.A.3.c.(1) Rigid covers, such as geodesic domes.",
            "",
            "                       IV.A.3.c.(2) Synthetic covers made of polypropylene.",
        ]
        markers, _audit = ic.scan_markers(lines, set(), "2")
        cites = [ic.tokens_to_citation(m["tokens"]) for m in markers if m["type"] == "item"]
        self.assertEqual(cites, ["IV.", "IV.A.", "IV.A.3.", "IV.A.3.c.", "IV.A.3.c.(1).", "IV.A.3.c.(2)."])
        # Same lines scanned as Reg 7: the "(1)"/"(2)" lines are not markers.
        markers7, _ = ic.scan_markers(lines, set(), "7")
        cites7 = [ic.tokens_to_citation(m["tokens"]) for m in markers7 if m["type"] == "item"]
        self.assertEqual(cites7, ["IV.", "IV.A.", "IV.A.3.", "IV.A.3.c."])

    def test_resolve_cite_paren_digit_for_reg_2(self):
        known = {"sec-2-B-I", "sec-2-B-IV-A-3-g-(1)", "sec-2-B-IV-A-3-g-(3)"}
        target, bucket = ic._resolve_cite("IV.A.3.g.(1)", "2", known, ["B"])
        self.assertEqual((target, bucket), ("sec-2-B-IV-A-3-g-(1)", ""))
        linked, buckets = ic.link_citations(
            "listed in Section IV.A.3.g.(1) through IV.A.3.g.(3).", "2", known, set(ic.CORPUS_REGS), "B", "sec-2-B-I")
        self.assertIn('data-target="sec-2-B-IV-A-3-g-(1)"', linked)
        self.assertIn('data-target="sec-2-B-IV-A-3-g-(3)"', linked)
        self.assertEqual(sum(sum(c.values()) for c in buckets.values()), 0)


class Reg2FooterTests(unittest.TestCase):
    def test_combined_footer_line_is_stripped_at_page_bottom(self):
        raw = (
            "PART A GENERAL PROVISIONS\n\nI. Some text that wraps\n\n\n"
            "Code of Colorado Regulations                                   1\n"
            "\x0c"
            "II. More text on page two.\n\n"
            "Code of Colorado Regulations                                   2\n"
        )
        lines, seams = ic.clean_pages(raw)
        self.assertFalse(any(ln.startswith("Code of Colorado Regulations") for ln in lines))
        self.assertEqual(lines[-1], "II. More text on page two.")
        self.assertIn(lines.index("II. More text on page two."), seams)

    def test_footer_regex_requires_whole_line_with_page_number(self):
        self.assertIsNotNone(ic._FOOTER_CCR_PAGE_RE.match("Code of Colorado Regulations   45"))
        self.assertIsNone(ic._FOOTER_CCR_PAGE_RE.match("Code of Colorado Regulations"))
        self.assertIsNone(ic._FOOTER_CCR_PAGE_RE.match("as published in the Code of Colorado Regulations 5 CCR 1001-4"))
        self.assertIsNone(ic._FOOTER_CCR_PAGE_RE.match("CODE OF COLORADO REGULATIONS 5 CCR 1001-9"))


class Reg2LabelFixTests(unittest.TestCase):
    def test_lowercase_l_roman_labels_are_rewritten(self):
        lines = [
            "              l.A. For areas used predominantly for residential or commercial purposes",
            "    ll. For the purposes of this Part A of Regulation Number 2, two odor measurements shall",
            "    lll. For the purposes of this Part A of Regulation Number 2, personnel for evaluating",
            "lV. An instrument, device, or technique designated by the Colorado Air Pollution Control",
            "    unrelated line l.A. that must not be touched",
        ]
        out, applied = ic.apply_known_label_fixes("2", lines)
        self.assertTrue(out[0].startswith("              I.A. For areas"))
        self.assertTrue(out[1].startswith("    II. For the purposes"))
        self.assertTrue(out[2].startswith("    III. For the purposes"))
        self.assertTrue(out[3].startswith("IV. An instrument"))
        self.assertEqual(out[4], lines[4])
        hits = {a["old_label"]: a["hits"] for a in applied}
        self.assertEqual(hits["l.A."], 1)
        self.assertEqual(hits["ll."], 1)
        self.assertEqual(hits["lll."], 1)
        self.assertEqual(hits["lV."], 1)
        self.assertEqual(hits["l.B."], 0)  # not present in this fixture

    def test_misnumbered_part_b_labels_are_rewritten(self):
        lines = [
            "               VI.E.1.e The Division's preliminary determination of approval,",
            "               VII.B.2.b. Reopenings under this Section VIII.B., Part B, of this Regulation",
            "               X.A.1.a. An initial compliance test within 180 days after a permit",
            "               X.B.2.f. The operating conditions existing at the time of sampling",
            "               X.A.1.a. Testing for concentration of off-site odor emissions; and",
        ]
        out, applied = ic.apply_known_label_fixes("2", lines)
        self.assertTrue(out[0].lstrip().startswith("VI.E.1.e. The Division's"))
        self.assertTrue(out[1].lstrip().startswith("VIII.B.2.b. Reopenings"))
        self.assertTrue(out[2].lstrip().startswith("X.A.2.a. An initial compliance"))
        self.assertTrue(out[3].lstrip().startswith("X.B.1.f. The operating"))
        self.assertEqual(out[4], lines[4])  # the REAL X.A.1.a. is untouched
        self.assertTrue(all(a["hits"] <= 1 for a in applied))

    def test_every_reg_2_fix_hits_exactly_once_on_the_real_source(self):
        if not os.path.exists(REG2_TXT):
            self.skipTest("sources/REG_2.txt not present in this checkout")
        raw = open(REG2_TXT, encoding="utf-8").read()
        lines, _ = ic.clean_pages(raw)
        _, applied = ic.apply_known_label_fixes("2", lines)
        self.assertEqual(len(applied), 10)
        for a in applied:
            self.assertEqual(a["hits"], 1, a)


class Reg2SobPartTests(unittest.TestCase):
    def test_config_and_meta(self):
        cfg = ic.SOB_PART_CONFIG["2"]
        self.assertEqual((cfg["letter"], cfg["top_family"], cfg["inner_items"]), ("C", "roman_seq", False))
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted February 19, 1999"))
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted: May 16, 2013"))
        self.assertIsNone(cfg["top_opener_re"].match("Typically, the date selected"))
        self.assertEqual(ic.CORPUS_REGS["2"], "2")
        meta = ic.REG_META["2"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 2")
        self.assertEqual(meta["root_title"], "ODOR EMISSION 5 CCR 1001-4")

    def test_part_c_top_entries_only_no_inner_items(self):
        lines = [
            "PART C STATEMENT OF BASIS, SPECIFIC STATUTORY AUTHORITY, AND PURPOSE",
            "",
            "I. Adopted February 19, 1999",
            "",
            "Background",
            "",
            "The definitions hinge on the effective date of this amendment to Regulation Number",
            "2. Typically, the date selected for existing sources is the effective date.",
            "",
            "II. Adopted December 14, 2006",
            "",
            "SB 06-114:",
            "",
            "1. Allows anaerobic process wastewater vessels to be operated with technologies.",
            "",
            "2. Requires a housed commercial swine feeding operation to submit information.",
            "",
            "The Commission concludes that applicability has not been modified pursuant to SB 06-",
            "114.",
            "",
            "III. Adopted June 19, 2008",
            "",
            "IV. Adopted: May 16, 2013",
            "",
            "(I) No federal requirements are applicable.",
        ]
        markers, _ = ic.scan_markers(lines, set(), "2")
        items = [ic.tokens_to_citation(m["tokens"]) for m in markers if m["type"] == "item"]
        self.assertEqual(items, ["I.", "II.", "III.", "IV."])


class Reg2PartIntroTextTests(unittest.TestCase):
    LINES = [
        "PART A GENERAL PROVISIONS",
        "",
        "Pursuant to Section 25-7-109(2)(d), C.R.S., the following Emission Regulations are issued:",
        "",
        "I. No person shall cause odors in excess of the following limits:",
        "",
        "PART B HOUSED COMMERCIAL SWINE FEEDING OPERATIONS",
        "",
        "I. Applicability",
    ]

    def test_reg_2_part_row_keeps_lead_in_paragraph(self):
        markers, _ = ic.scan_markers(self.LINES, set(), "2")
        provisions, order, _unres, _tables = ic.build_provisions("2", self.LINES, markers, {})
        part_a = provisions["sec-2-P-A"]
        self.assertEqual(part_a["title"], "PART A — GENERAL PROVISIONS")
        self.assertTrue(part_a["full_text"].startswith("PART A — GENERAL PROVISIONS<p>Pursuant to Section 25-7-109(2)(d)"))
        self.assertTrue(part_a["full_text"].endswith("are issued:</p>"))
        # A part with no lead-in text stays a plain heading row.
        self.assertEqual(provisions["sec-2-P-B"]["full_text"], "PART B — HOUSED COMMERCIAL SWINE FEEDING OPERATIONS")
        # The section after the lead-in still gets its own text.
        self.assertIn("No person shall cause odors", provisions["sec-2-A-I"]["full_text"])

    def test_other_regs_part_rows_unchanged(self):
        markers, _ = ic.scan_markers(self.LINES, set(), "7")
        provisions, _order, _unres, _tables = ic.build_provisions("7", self.LINES, markers, {})
        self.assertEqual(provisions["sec-7-P-A"]["full_text"], "PART A — GENERAL PROVISIONS")


class Reg2FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(REG2_TXT):
            raise unittest.SkipTest("sources/REG_2.txt not present in this checkout")
        (cls.rows, cls.unresolved, _th, _nt, cls.dupes, cls.fixes, _an, _audit) = ic.parse_reg("2", REG2_TXT, None)
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_row_counts_and_structure(self):
        self.assertEqual(len(self.rows), 310)
        self.assertEqual(self.dupes, [])
        self.assertEqual([r["id"] for r in self.rows if r["kind"] == "part"], ["sec-2-P-A", "sec-2-P-B", "sec-2-P-C"])
        secs_a = [r["citation"] for r in self.rows if r["parent_id"] == "sec-2-P-A"]
        secs_b = [r["citation"] for r in self.rows if r["parent_id"] == "sec-2-P-B"]
        secs_c = [r["citation"] for r in self.rows if r["parent_id"] == "sec-2-P-C"]
        self.assertEqual(secs_a, ["I.", "II.", "III.", "IV.", "V."])
        self.assertEqual(secs_b, [ic.int_to_roman(i) + "." for i in range(1, 15)])
        self.assertEqual(secs_c, ["I.", "II.", "III.", "IV."])
        self.assertTrue(all(r["parent_id"] in self.by_id for r in self.rows if r["parent_id"]))

    def test_label_fixes_all_hit_once_and_fixed_rows_exist(self):
        self.assertTrue(all(f["hits"] == 1 for f in self.fixes))
        for pid in ("sec-2-A-I-A", "sec-2-A-I-B", "sec-2-A-I-C-2", "sec-2-A-II", "sec-2-A-III", "sec-2-A-IV",
                    "sec-2-B-VI-E-1-e", "sec-2-B-VIII-B-2-b", "sec-2-B-X-A-2-a", "sec-2-B-X-B-1-f",
                    "sec-2-B-IV-A-3-c-(1)", "sec-2-B-IX-A-1-c-(9)", "sec-2-B-IX-B-4-d-(1)"):
            self.assertIn(pid, self.by_id)
        self.assertNotIn("sec-2-C-I-2", self.by_id)
        self.assertNotIn("sec-2-C-II-114", self.by_id)

    def test_no_page_furniture_and_no_external_links(self):
        for r in self.rows:
            self.assertNotRegex(r["full_text"], r"Code of Colorado Regulations\s+\d")
        self.assertEqual(self.unresolved["historical"], {})
        self.assertEqual(self.unresolved["cfr"], {})
        # Corpus merge: "Regulation Number 6" (Part B IX.A.5.a., carcass
        # incineration) used to sit here while Reg 6 was outside CORPUS_REGS;
        # it now resolves to /regulations/6, so only the WQCC's Regulation
        # Number 61 (not an AQCC regulation) is left unlinked.
        self.assertEqual(set(self.unresolved["other_reg"]), {"Regulation Number 61"})
        self.assertTrue(any('href="/regulations/6"' in r["full_text"] for r in self.rows))


# ---------------------------------------------------------------------------
# Reg 6 — flat incorporation-by-reference Part A (FLAT_ENTRY_PART_CONFIG),
# bare "PART X" headings, Part-A statements of basis, and "Subpart Xx" linking.
# ---------------------------------------------------------------------------

_REG6_FIXTURE = """\
    PART A

    Federal Register Regulations Adopted by Reference

    The regulations listed below were adopted by the Commission. Table 1 lists
    the exceptions.

                                                   TABLE 1

   40 CFR Part 60 Subpart*                                      Section(s)

               A                   60.8(b)(2) and (b)(3).

              Da                   60.45a.

*And any other section which 40 CFR Part 60 specifically states will not be delegated.

Subpart A     General Provisions. 40 CFR Part 60, Subpart A (July 1, 2025). (See Part B of this
Regulation Number 6 for Additional Requirements Regarding Modifications)

Subpart Cf     Emission Guidelines for Landfills. 40 CFR Part 60, Subpart Cf (July 1, 2025).

Designated facilities previously subject to either 40 CFR
Subpart Cc or WWW are subject instead to Subpart Cf as of the effective date.

Subpart Da     Standards of Performance for Electric Utility Steam Generators. 40 CFR Part 60,
       Subpart Da (July 1, 2025).

APPENDIX A to Part 60 Test Methods. 40 CFR Part 60 (July 1, 2023).

STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE (For Part A)

I.      Adopted: June 20, 1996

Basis text for the first entry.

1.      First inner item.

2.      Second inner item.

II.       Adopted February 20, 1997

Basis text for the second entry, citing Subparts A, Da, and ZZZZ of Part A and
40 CFR Part 75, Subparts A through H.

1.      Restarted inner list.

PART B

Non-Federal NSPS for Specific Facilities and Sources

I.     GENERAL PROVISIONS

I.A.   Subpart A (General Provisions) of Regulation Number 6, Part A is incorporated by reference.

I.B.   ICE shall meet the standard in 40 CFR Part 60, Subparts IIII or JJJJ.
"""


class Reg6FlatEntryPartTests(unittest.TestCase):
    """Parses the fixture above through the same clean/scan/build path
    parse_reg uses (no PDF, so no pdfplumber table — the raw table lines are
    kept as paragraphs in that degraded case)."""

    @classmethod
    def setUpClass(cls):
        lines, seams = ic.clean_pages(_REG6_FIXTURE)
        start = ic.find_body_start(lines, "6")
        lines = lines[start:]
        seams = {i - start for i in seams if i >= start}
        markers, _audit = ic.scan_markers(lines, seams, "6")
        provisions, order, unresolved, _hits = ic.build_provisions("6", lines, markers, {})
        cls.rows = [provisions[i] for i in order]
        cls.by_id = provisions
        cls.unresolved = unresolved

    def test_bare_part_headings_get_their_title_from_the_next_line(self):
        self.assertEqual(self.by_id["sec-6-P-A"]["title"], "PART A — Federal Register Regulations Adopted by Reference")
        self.assertEqual(self.by_id["sec-6-P-B"]["title"], "PART B — Non-Federal NSPS for Specific Facilities and Sources")

    def test_find_body_start_only_honours_bare_part_a_for_a_configured_reg(self):
        lines, _ = ic.clean_pages(_REG6_FIXTURE)
        self.assertEqual(lines[ic.find_body_start(lines, "6")].strip(), "PART A")
        self.assertEqual(ic.find_body_start(lines, "26"), 0)
        self.assertEqual(ic.find_body_start(lines), 0)

    def test_part_a_rows_in_printed_order(self):
        ids = [r["id"] for r in self.rows if r["parent_id"] == "sec-6-P-A"]
        self.assertEqual(ids, [
            "sec-6-A-INTRO", "sec-6-A-TABLE-1", "sec-6-A-SUBPART-A", "sec-6-A-SUBPART-Cf",
            "sec-6-A-SUBPART-Da", "sec-6-A-P60-APP-A", "sec-6-A-SOB", "sec-6-A-I", "sec-6-A-II",
        ])

    def test_intro_owns_the_unlabeled_paragraphs(self):
        r = self.by_id["sec-6-A-INTRO"]
        self.assertEqual(r["citation"], "Introduction")
        self.assertEqual(r["title"], "Introduction")
        self.assertIn("The regulations listed below were adopted", r["full_text"])
        self.assertNotIn("Federal Register Regulations Adopted by Reference", r["full_text"])

    def test_subpart_entry_title_and_text(self):
        r = self.by_id["sec-6-A-SUBPART-Da"]
        self.assertEqual(r["citation"], "Subpart Da")
        self.assertEqual(r["title"], "Subpart Da — Standards of Performance for Electric Utility Steam Generators")
        self.assertIn("(July 1, 2025)", r["full_text"])
        self.assertEqual(r["kind"], "entry")

    def test_wrapped_subpart_continuation_is_not_an_entry(self):
        # "Subpart Cc or WWW are subject..." is a hard-wrapped continuation
        # line (indent 0, but mid-paragraph and lowercase after the code).
        self.assertNotIn("sec-6-A-SUBPART-Cc", self.by_id)
        self.assertNotIn("sec-6-A-SUBPART-WWW", self.by_id)
        self.assertIn("Subpart Cc or WWW are subject", self.by_id["sec-6-A-SUBPART-Cf"]["full_text"].replace("</span>", ""))

    def test_federal_appendix_entry_is_not_a_reg_appendix(self):
        r = self.by_id["sec-6-A-P60-APP-A"]
        self.assertEqual(r["citation"], "Appendix A to Part 60")
        self.assertEqual(r["title"], "Appendix A to Part 60 — Test Methods")
        self.assertEqual(r["parent_id"], "sec-6-P-A")
        self.assertFalse(any("-APPENDIX-" in i for i in self.by_id))

    def test_table_row_without_pdf_keeps_raw_lines_and_footnote(self):
        r = self.by_id["sec-6-A-TABLE-1"]
        self.assertEqual(r["citation"], "Table 1")
        self.assertIn("60.45a.", r["full_text"])
        self.assertIn("*And any other section", r["full_text"])

    def test_sob_heading_row_then_roman_seq_entries_undivided(self):
        import re
        self.assertEqual(re.sub(r"<[^>]+>", "", self.by_id["sec-6-A-SOB"]["full_text"]),
                         "STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE (For Part A)")
        one, two = self.by_id["sec-6-A-I"], self.by_id["sec-6-A-II"]
        self.assertEqual((one["parent_id"], one["kind"]), ("sec-6-P-A", "section"))
        self.assertTrue(one["full_text"].startswith("<p>Adopted: June 20, 1996</p>"))
        self.assertIn("<p>1. First inner item.</p><p>2. Second inner item.</p>", one["full_text"])
        self.assertTrue(two["full_text"].startswith("<p>Adopted February 20, 1997</p>"))
        self.assertIn("<p>1. Restarted inner list.</p>", two["full_text"])
        self.assertFalse(any(i.startswith("sec-6-A-I-") or i.startswith("sec-6-A-II-") for i in self.by_id))

    def test_part_b_is_an_ordinary_nested_part(self):
        self.assertEqual(self.by_id["sec-6-B-I"]["title"], "I. GENERAL PROVISIONS")
        self.assertEqual(self.by_id["sec-6-B-I-A"]["parent_id"], "sec-6-B-I")

    def test_subpart_mentions_link_to_entry_rows(self):
        ia = self.by_id["sec-6-B-I-A"]["full_text"]
        self.assertIn('<span class="xref" data-target="sec-6-A-SUBPART-A">Subpart A</span>', ia)
        two = self.by_id["sec-6-A-II"]["full_text"]
        self.assertIn('<span class="xref" data-target="sec-6-A-SUBPART-A">Subparts A</span>', two)
        self.assertIn('<span class="xref" data-target="sec-6-A-SUBPART-Da">Da</span>', two)
        self.assertNotIn("SUBPART-ZZZZ", two)
        # "40 CFR Part 75, Subparts A through H" names Part 75's subparts, not ours.
        self.assertIn("40 CFR Part 75, Subparts A through H", two)

    def test_cfr_part_60_subpart_citation_links_to_own_entry(self):
        ib = self.by_id["sec-6-B-I-B"]["full_text"]
        # Singular "Subpart" form only is claimed by CFR_RE; the plural list is
        # linked by the flat-subpart step (IIII has no entry here -> plain).
        self.assertIn("40 CFR Part 60, Subparts IIII or JJJJ", ib.replace('<span class="xref" data-target="sec-6-P-A">', "").replace("</span>", ""))
        da = self.by_id["sec-6-A-SUBPART-Da"]["full_text"]
        self.assertIn('<span class="xref" data-target="sec-6-A-SUBPART-Da">40 CFR Part 60, Subpart Da</span>', da)
        self.assertEqual(self.unresolved[ic.BUCKET_CFR].get("40 CFR Part 60, Subpart Da", 0), 0)

    def test_flat_config_is_a_no_op_for_other_regs(self):
        html, buckets = ic.link_citations("see Subpart A and 40 CFR Part 60, Subpart Da here", "26",
                                          {"sec-26-A-SUBPART-A", "sec-26-A-SUBPART-Da"}, set(ic.CORPUS_REGS))
        self.assertNotIn("<span", html)
        self.assertEqual(buckets[ic.BUCKET_CFR]["40 CFR Part 60, Subpart Da"], 1)


class Reg6MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["6"], "6")
        m = ic.REG_META["6"]
        self.assertEqual(m["root_title"], "STANDARDS OF PERFORMANCE FOR NEW STATIONARY SOURCES 5 CCR 1001-8")
        self.assertEqual(m["root_citation"], "Code of Colorado Regulations · Regulation Number 6")
        self.assertEqual((m["jurisdiction_level"], m["issuing_body"]), ("state", "CDPHE-APCD"))
        self.assertEqual(ic.SOB_PART_CONFIG["6"]["letter"], "A")
        self.assertFalse(ic.SOB_PART_CONFIG["6"]["inner_items"])


# ---------------------------------------------------------------------------
# ECMC (2 CCR 404-1) — the "rule_series" family: no PART headings, "N00
# SERIES" top level, "NNN." rules, a lettered/numbered/lettered/roman ladder,
# 100-Series definitions with no printed labels, and APPENDIX blocks. See
# ECMC_BRIEF.md.
# ---------------------------------------------------------------------------

_ECMC_FIXTURE = """\
100 SERIES DEFINITIONS

WIDGET means a small mechanical device used in Operations.

GADGET used to describe an ancillary tool that supports a Widget.

200 SERIES GENERAL PROVISIONS

201. SAMPLE RULE FOR TESTING AND
VERIFICATION

a.     Introductory text referencing Rule 201.a.(1) and the 200 Series.

       (1)   First item, see Table 201-1.

             A.     Nested item under A.

                    i.     Bare roman item under A. — lexically identical to
                    a 9th plain letter, disambiguated by indentation only.

b.     Second top-level item.

202. DRIFT TEST RULE

a.     Intro text before a lettered list.

       (1)    First item introducing a lettered list.

             A.     Item A printed at the ordinary column.

                   B.     Item B printed several columns deeper, simulating
                   a page-break reflow — must still be A's sibling, not
                   A's child.

       (4)    A numbered item.

             (5)    Item (5) printed several columns deeper, simulating a
                   page-break reflow — must still be (4)'s sibling, not
                   (4)'s child.

APPENDIX I     SAMPLE APPENDIX

Some appendix text mentioning Appendix I and Rule 201.
"""


class RuleSeriesFamilyTests(unittest.TestCase):
    """Synthetic-fixture coverage for parse_reg_rule_series / link_citations_ecmc."""

    @classmethod
    def setUpClass(cls):
        raw_lines = _ECMC_FIXTURE.split("\n")
        cls.rows, cls.order, cls.unresolved, cls.table_hits = ic.parse_reg_rule_series(
            "ecmc", raw_lines, {}
        )
        cls.by_id = {pid: cls.rows[pid] for pid in cls.order}

    def test_series_rule_and_appendix_ids(self):
        self.assertIn("sec-ecmc-top-REG-ecmc", self.by_id)
        self.assertIn("sec-ecmc-S-100", self.by_id)
        self.assertIn("sec-ecmc-S-200", self.by_id)
        self.assertEqual(self.by_id["sec-ecmc-S-200"]["citation"], "200 Series")
        self.assertIn("sec-ecmc-201", self.by_id)
        self.assertEqual(self.by_id["sec-ecmc-201"]["parent_id"], "sec-ecmc-S-200")
        self.assertIn("sec-ecmc-APPENDIX-I", self.by_id)
        self.assertEqual(self.by_id["sec-ecmc-APPENDIX-I"]["parent_id"], "sec-ecmc-top-REG-ecmc")

    def test_wrapped_rule_title_joined(self):
        self.assertIn("SAMPLE RULE FOR TESTING AND VERIFICATION", self.by_id["sec-ecmc-201"]["title"])

    def test_ladder_ids_and_bare_roman_depth_by_indent(self):
        for pid, expected_parent in [
            ("sec-ecmc-201-a", "sec-ecmc-201"),
            ("sec-ecmc-201-a-(1)", "sec-ecmc-201-a"),
            ("sec-ecmc-201-a-(1)-A", "sec-ecmc-201-a-(1)"),
            ("sec-ecmc-201-a-(1)-A-i", "sec-ecmc-201-a-(1)-A"),
            ("sec-ecmc-201-b", "sec-ecmc-201"),
        ]:
            self.assertIn(pid, self.by_id, pid)
            self.assertEqual(self.by_id[pid]["parent_id"], expected_parent, pid)
        self.assertEqual(self.by_id["sec-ecmc-201-a-(1)-A-i"]["citation"], "201.a.(1).A.i.")

    def test_definitions_one_row_per_term_no_printed_labels(self):
        widget = self.by_id["sec-ecmc-100-DEF-WIDGET"]
        self.assertEqual(widget["title"], "WIDGET")
        self.assertEqual(widget["citation"], "100 Series — WIDGET")
        self.assertEqual(widget["parent_id"], "sec-ecmc-S-100")
        self.assertIn("small mechanical device", widget["full_text"])
        self.assertIn("sec-ecmc-100-DEF-GADGET", self.by_id)  # "used to" opener

    def test_same_reg_cross_references_link(self):
        intro = self.by_id["sec-ecmc-201-a"]["full_text"]
        self.assertIn('data-target="sec-ecmc-201-a-(1)"', intro)
        self.assertIn('data-target="sec-ecmc-S-200"', intro)
        appendix_text = self.by_id["sec-ecmc-APPENDIX-I"]["full_text"]
        self.assertIn('data-target="sec-ecmc-APPENDIX-I"', appendix_text)
        self.assertIn('data-target="sec-ecmc-201"', appendix_text)

    def test_no_duplicate_ids_and_every_parent_resolves(self):
        self.assertEqual(len(self.order), len(set(self.order)))
        for pid in self.order:
            parent = self.by_id[pid]["parent_id"]
            self.assertTrue(parent is None or parent in self.by_id, pid)

    def test_drifted_indent_sibling_not_nested_one_level_deep(self):
        # Post-import review (2026-09-18): a page break or a wrapped
        # heading can reflow the next label a few columns deeper than its
        # true siblings printed ("D." at column 11, then "E." at column 14
        # after a page break, in Rule 406.e.(4) of the real source) --
        # confirmed to wrongly nest the drifted label one level deeper
        # under its own sibling. "B." here is deliberately printed several
        # columns to the right of "A." to reproduce that drift; it must
        # still land as A's SIBLING (same depth, same parent), not A's
        # child.
        self.assertIn("sec-ecmc-202-a-(1)-A", self.by_id)
        self.assertIn("sec-ecmc-202-a-(1)-B", self.by_id)
        self.assertEqual(
            self.by_id["sec-ecmc-202-a-(1)-B"]["parent_id"],
            self.by_id["sec-ecmc-202-a-(1)-A"]["parent_id"],
        )
        self.assertEqual(self.by_id["sec-ecmc-202-a-(1)-B"]["citation"], "202.a.(1).B.")

    def test_drifted_paren_digit_sibling_not_nested_one_level_deep(self):
        # Same drift pattern, one level up: a paren-digit item ("(4)" ->
        # "(5)") drifted deeper by a page break must stay (4)'s sibling,
        # not become nested under it (a real confirmed instance:
        # "205.c.(4).(5)").
        self.assertIn("sec-ecmc-202-a-(4)", self.by_id)
        self.assertIn("sec-ecmc-202-a-(5)", self.by_id)
        self.assertEqual(
            self.by_id["sec-ecmc-202-a-(5)"]["parent_id"],
            self.by_id["sec-ecmc-202-a-(4)"]["parent_id"],
        )
        self.assertEqual(self.by_id["sec-ecmc-202-a-(5)"]["citation"], "202.a.(5).")

    def test_unresolved_table_reference_bucketed_not_dropped(self):
        # No PDF in this fixture, so "Table 201-1" can't resolve to a
        # rendered table — it must land in a bucket (proving the linker
        # SAW it), not silently vanish from both the text and every bucket.
        total_unresolved = sum(sum(c.values()) for c in self.unresolved.values())
        self.assertGreaterEqual(total_unresolved, 1)


ECMC_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "ECMC.txt")
ECMC_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "ECMC.pdf")


class EcmcFullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present).
    No --pdf here (table extraction is slow on a 675-page PDF and is
    exercised separately by the `parse` CLI run that produced
    out/ecmc_parsed.json) — these assertions don't depend on table HTML."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(ECMC_TXT):
            raise unittest.SkipTest("sources/ECMC.txt not present in this checkout")
        (cls.rows, cls.unresolved, _th, _nt, cls.dupes, cls.fixes, _an, _audit) = ic.parse_reg(
            "ecmc", ECMC_TXT, None
        )
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_row_counts_and_no_duplicates(self):
        # 225 "NNN. TITLE" headings confirmed by grep (paragraph-initial,
        # excluding the one wrapped-citation false positive at line 670 —
        # see ECMC_BRIEF.md gate A / REPORT.md); the brief's estimate of 232
        # does not match the current in-force text.
        self.assertEqual(sum(1 for r in self.rows if r["kind"] == "section"), 225)
        self.assertEqual(sum(1 for r in self.rows if r["kind"] == "series"), 14)
        self.assertEqual(sum(1 for r in self.rows if r["kind"] == "appendix"), 4)
        # Appendix VI prints its own "APPENDIX VI  PUBLIC WATER SYSTEMS"
        # heading, then its body text ITSELF opens with "Appendix VI: List
        # of Public Water Systems..." — a second, genuine match of the same
        # appendix-heading pattern for the SAME appendix, not a distinct
        # appendix; the two are correctly merged into one
        # `sec-ecmc-APPENDIX-VI` row (see REPORT.md).
        self.assertEqual(self.dupes, ["sec-ecmc-APPENDIX-VI"])
        self.assertTrue(all(r["parent_id"] in self.by_id for r in self.rows if r["parent_id"]))

    def test_label_fixes_all_hit_once(self):
        self.assertTrue(all(f["hits"] == 1 for f in self.fixes))

    def test_key_ids_present(self):
        for rid in ("sec-ecmc-604", "sec-ecmc-604-a", "sec-ecmc-604-a-(3)-A",
                    "sec-ecmc-100-DEF-ANNULUS", "sec-ecmc-S-600", "sec-ecmc-APPENDIX-IX"):
            self.assertIn(rid, self.by_id, rid)

    def test_no_page_furniture_leaks(self):
        for r in self.rows:
            self.assertNotRegex(r["full_text"], r"CODE OF COLORADO REGULATIONS")


class EcmcMetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["ecmc"], "ecmc")
        m = ic.REG_META["ecmc"]
        self.assertEqual(m["family"], "rule_series")
        self.assertEqual(m["jurisdiction_level"], "state")
        self.assertEqual(m["issuing_body"], "ECMC")
        self.assertIn("2 CCR 404-1", m["root_citation"])


# ---------------------------------------------------------------------------
# Common Provisions Regulation (5 CCR 1001-2, reg key "cp") additions:
# no_parts (Reg 1's mechanism, no new code), the unlabeled term-definitions
# section (TERM_DEFINITIONS_SECTION), the section-scoped SOB family
# (SOB_PART_CONFIG["cp"]), and the by-NAME cross-regulation resolver
# (COMMON_PROVISIONS_RE / _cp_known_ids / _emit_cp_section_list).
# ---------------------------------------------------------------------------

REGCP_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_CP.txt")
REGCP_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_CP.pdf")

_REGCP_MINI = """\
    Outline of Regulation

    I.        Definitions, Statement of Intent, and General Provisions Applicable to All Emission Control
              Regulations Adopted by the Colorado Air Quality Control Commission

    II.       General

    III.      (State Only) Civil Penalties

    IV.       Reserved

    V.        Statements of Basis, Specific Statutory Authority, and Purpose

    I.     Definitions, Statement of Intent, and General Provisions Applicable to All Emission Control
    Regulations Adopted by the Colorado Air Quality Control Commission

    I.A.      Applicability

    Emission control regulations adopted by the Commission apply throughout Colorado.

I.G.    Definitions

The following words and phrases shall have the following meanings.

ABSOLUTE VAPOR PRESSURE

The pressure relative to an absolute vacuum that a confined vapor exerts at a given temperature.

AIR POLLUTANT

Any fume, smoke, particulate matter, vapor, or gas that is emitted into the atmosphere.

II.     General

II.A.   To Control Emissions Leaving Colorado

Sources shall not discharge air pollutants that unreasonably interfere with attainment in other states.

III.     (State Only) Civil Penalties

III.A.

Any person who violates this regulation may be subject to a civil penalty of up to a specified amount.

III.B.   Annual adjustment

        III.B.1. Beginning in 2021, the Commission shall annually adjust the amount of the maximum
                 civil penalty.

IV.      Reserved

V.      Statements of Basis, Specific Statutory Authority and Purpose

V.A.    Adopted December 14, 1978 - Definitions

Rationale and Justification for Revisions to the Common Provisions Regulation.

1.      A restarted inner finding.

2.      Another one.

V.B.    Adopted June 5, 1980 — Abbreviations and Definitions

As defined in Section I.G. of this regulation.
"""


class RegCpConfigTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["cp"], "cp")
        meta = ic.REG_META["cp"]
        self.assertTrue(meta["no_parts"])
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Common Provisions Regulation")
        self.assertEqual(meta["root_title"], "COMMON PROVISIONS REGULATION 5 CCR 1001-2")
        self.assertTrue(ic.reg_has_no_parts("cp"))

    def test_sob_section_scoped_letter_dated_config(self):
        cfg = ic.SOB_PART_CONFIG["cp"]
        self.assertEqual(cfg["section"], "V")
        self.assertEqual(cfg["top_family"], "letter_dated")
        self.assertEqual(cfg["roman_prefix"], "V")
        self.assertFalse(cfg["inner_items"])
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted December 14, 1978 - Definitions"))
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted: October 21, 2021"))
        self.assertEqual(ic._sob_scope("cp"), (None, "V"))

    def test_dotted_path_labels_are_the_ordinary_cycle_no_new_capability(self):
        # BATCH3_BRIEF.md flags CP's full-dotted-path subsection labels
        # ("I.A.", "II.C.2.a.") as a "new label style" to check — confirmed
        # this is exactly what tokenize_by_cycle already does for every
        # other regulation (a compound label tokenizes depth-by-depth
        # regardless of indent), so no REG_META flag or cycle override was
        # needed; this test pins that down.
        tokens, consumed = ic.tokenize_by_cycle("II.C.2.a. Specifies", ic.cycle_ab_for("cp"))
        self.assertEqual([r for _, r in tokens], ["II", "C", "2", "a"])
        self.assertEqual(ic.tokens_to_id_suffix(tokens), "II-C-2-a")
        self.assertEqual(ic.cycle_ab_for("cp"), ic.CYCLE_AB)  # no per-reg override registered


class TermDefinitionsSectionTests(unittest.TestCase):
    def test_only_cp_is_configured(self):
        self.assertEqual(ic.TERM_DEFINITIONS_SECTION["cp"], [("roman", "I"), ("upper", "G")])
        for other in ("1", "2", "3", "7", "22", "26", "8", "ecmc"):
            self.assertNotIn(other, ic.TERM_DEFINITIONS_SECTION)

    def test_match_term_heading_line_requires_isolated_all_caps_line(self):
        lines = [
            "The following words and phrases shall have the following meanings.",
            "",
            "ABSOLUTE VAPOR PRESSURE",
            "",
            "The pressure relative to an absolute vacuum.",
            "",
            "CONTROL DEVICE (STATIONARY)",
            "",
            "A device that controls emissions.",
            "",
            "II.     General",
        ]
        self.assertIsNone(ic._match_term_heading_line(lines, 0, None))
        self.assertEqual(ic._match_term_heading_line(lines, 2, None), "ABSOLUTE VAPOR PRESSURE")
        self.assertEqual(ic._match_term_heading_line(lines, 6, None), "CONTROL DEVICE (STATIONARY)")
        # Not paragraph-initial (no blank line before) -> not a term.
        self.assertIsNone(ic._match_term_heading_line(lines, 4, None))
        # A real roman-numeral marker line matches the all-caps shape too by
        # itself, but is never handed to this matcher in practice (see
        # scan_markers: it's only reached when tokenize_by_cycle found no
        # ordinary compound label at all, and "II." always does).
        self.assertIsNone(ic._match_term_heading_line(["", "not upper case", ""], 1, None))


class RegCpMiniParseTests(unittest.TestCase):
    def _parse(self, text=_REGCP_MINI, corpus_regs=None):
        lines, seams = ic.clean_pages(text)
        start = ic.find_body_start_no_parts(lines)
        lines = lines[start:]
        markers, _audit = ic.scan_markers(lines, {i - start for i in seams if i >= start}, "cp")
        provisions, order, unresolved, _ = ic.build_provisions("cp", lines, markers, {})
        return [provisions[i] for i in order], unresolved

    def test_ids_parents_and_kinds(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        expected = [
            "sec-cp-top-REG-cp", "sec-cp-I", "sec-cp-I-A", "sec-cp-I-G",
            "sec-cp-I-G-1", "sec-cp-I-G-2", "sec-cp-II", "sec-cp-II-A",
            "sec-cp-III", "sec-cp-III-A", "sec-cp-III-B", "sec-cp-III-B-1",
            "sec-cp-IV", "sec-cp-V", "sec-cp-V-A", "sec-cp-V-B",
        ]
        self.assertEqual([r["id"] for r in rows], expected)
        self.assertNotIn("sec-cp-P-A", by_id)  # no fabricated part rows
        self.assertFalse(any(r["kind"] == "part" for r in rows))
        for r in rows:
            self.assertTrue(r["parent_id"] is None or r["parent_id"] in by_id, r["id"])
        self.assertEqual(len(by_id), len(rows))  # unique ids

    def test_term_definitions_become_their_own_rows(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        t1, t2 = by_id["sec-cp-I-G-1"], by_id["sec-cp-I-G-2"]
        self.assertEqual(t1["kind"], "definition")
        self.assertEqual(t1["citation"], "I.G.1.")
        self.assertEqual(t1["title"], "I.G.1. ABSOLUTE VAPOR PRESSURE")
        self.assertEqual(t1["parent_id"], "sec-cp-I-G")
        self.assertIn("<p>ABSOLUTE VAPOR PRESSURE</p>", t1["full_text"])
        self.assertIn("<p>The pressure relative to an absolute vacuum", t1["full_text"])
        self.assertEqual(t2["title"], "I.G.2. AIR POLLUTANT")
        # The section heading row itself keeps only its own intro text, not
        # the definitions (which are now their own sibling rows).
        self.assertIn("following meanings", by_id["sec-cp-I-G"]["full_text"])
        self.assertNotIn("ABSOLUTE VAPOR PRESSURE", by_id["sec-cp-I-G"]["full_text"])

    def test_state_only_parenthetical_kept_in_part_iii_title(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(by_id["sec-cp-III"]["title"], "III. (State Only) Civil Penalties")

    def test_reserved_section_is_heading_only(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(by_id["sec-cp-IV"]["kind"], "section")
        self.assertEqual(by_id["sec-cp-IV"]["full_text"], "IV. Reserved")

    def test_label_only_item_with_no_same_line_title(self):
        # "III.A." is printed with nothing else on its own line — no title
        # text, just the label — matching Reg 1's plain compound-item shape.
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(by_id["sec-cp-III-A"]["title"], "III.A.")
        self.assertIn("subject to a civil penalty", by_id["sec-cp-III-A"]["full_text"])

    def test_section_scoped_sob_inner_items_off(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertNotIn("sec-cp-V-A-1", by_id)
        self.assertIn("A restarted inner finding.", by_id["sec-cp-V-A"]["full_text"])
        self.assertIn("Another one.", by_id["sec-cp-V-A"]["full_text"])
        self.assertTrue(by_id["sec-cp-V-A"]["full_text"].startswith(
            "<p>Adopted December 14, 1978 - Definitions</p>"))

    def test_self_reference_to_common_provisions_and_own_section(self):
        rows, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertIn(
            '<span class="xref" data-target="sec-cp-top-REG-cp">Common Provisions Regulation</span>',
            by_id["sec-cp-V-A"]["full_text"],
        )
        self.assertIn(
            '<span class="xref" data-target="sec-cp-I-G">Section I.G.</span>',
            by_id["sec-cp-V-B"]["full_text"],
        )


class CommonProvisionsCrossRefTests(unittest.TestCase):
    """COMMON_PROVISIONS_RE / _cp_known_ids / _emit_cp_section_list — the
    by-NAME cross-regulation resolver used by every OTHER AQCC regulation to
    link "Common Provisions Regulation" mentions to `cp`. `_CP_KNOWN_IDS_CACHE`
    is a module-level cache; every test here sets and restores it so no test
    order dependency leaks into the real end-to-end parses elsewhere in this
    file (or vice versa)."""

    def setUp(self):
        self._saved_cache = ic._CP_KNOWN_IDS_CACHE
        ic._CP_KNOWN_IDS_CACHE = {"sec-cp-top-REG-cp", "sec-cp-I-G", "sec-cp-II-C"}

    def tearDown(self):
        ic._CP_KNOWN_IDS_CACHE = self._saved_cache

    def test_regex_matches_every_confirmed_printed_form(self):
        for text, name in [
            ("as defined in the Common Provisions Regulation, Section I.G. except",
             "Common Provisions Regulation"),
            ("in accordance with AQCC Common Provisions Regulation Section II.C.",
             "Common Provisions Regulation"),
            ("the Commission's Common Provisions (5 C.C.R. 1001-2) shall apply",
             "Common Provisions"),
            ("consistent with the Common Provisions regulation.",
             "Common Provisions regulation"),
        ]:
            m = ic.COMMON_PROVISIONS_RE.search(text)
            self.assertIsNotNone(m, text)
            self.assertEqual(text[m.start():m.start() + len(name)], name)

    def test_bare_mention_links_to_cp_root_from_another_reg(self):
        html = "The term is as defined in the Common Provisions Regulation."
        out, buckets = ic.link_citations(html, "1", {"sec-1-top-REG-1"}, ic.CORPUS_REGS)
        self.assertIn(
            '<a class="xref-external-reg" data-provision-id="sec-cp-top-REG-cp" '
            'href="/regulations/cp">Common Provisions Regulation</a>', out,
        )
        self.assertEqual(sum(buckets[b].total() if hasattr(buckets[b], "total") else sum(buckets[b].values())
                              for b in ic.ALL_BUCKETS), 0)

    def test_mention_with_section_links_both_root_and_section(self):
        html = "as defined in the Common Provisions Regulation, Section I.G. except that"
        out, _ = ic.link_citations(html, "1", set(), ic.CORPUS_REGS)
        self.assertIn('data-provision-id="sec-cp-top-REG-cp"', out)
        self.assertIn('data-provision-id="sec-cp-I-G" href="/regulations/cp">Section I.G.</a>', out)

    def test_section_with_no_comma_before_keyword_still_resolves(self):
        html = "in accordance with AQCC Common Provisions Regulation Section II.C."
        out, _ = ic.link_citations(html, "26", set(), ic.CORPUS_REGS)
        self.assertIn('data-provision-id="sec-cp-II-C" href="/regulations/cp">Section II.C.</a>', out)

    def test_unresolvable_section_falls_back_to_bucket_only(self):
        html = "the Common Provisions Regulation, Section IX.Z. governs this"
        out, buckets = ic.link_citations(html, "1", set(), ic.CORPUS_REGS)
        self.assertIn('data-provision-id="sec-cp-top-REG-cp"', out)
        self.assertNotIn("<a", out.split("</a>", 1)[1])  # "Section IX.Z." itself is left as plain text
        self.assertIn("IX.Z.", sum(buckets.values(), ic.Counter()))

    def test_no_op_when_cp_not_in_corpus(self):
        html = "as defined in the Common Provisions Regulation, Section I.G. except"
        corpus_without_cp = {k: v for k, v in ic.CORPUS_REGS.items() if k != "cp"}
        out, buckets = ic.link_citations(html, "1", set(), corpus_without_cp)
        self.assertEqual(out, html)  # byte-identical: no link, no other change
        self.assertEqual(buckets[ic.BUCKET_OTHER_REG]["Common Provisions Regulation"], 1)

    def test_self_reference_uses_same_reg_span_not_external_anchor(self):
        html = "revisions to the Common Provisions Regulation, Section I.G. hereby adopted"
        cp_known = {"sec-cp-top-REG-cp", "sec-cp-I-G"}
        out, _ = ic.link_citations(html, "cp", cp_known, ic.CORPUS_REGS)
        self.assertIn('<span class="xref" data-target="sec-cp-top-REG-cp">Common Provisions Regulation</span>', out)
        self.assertIn('<span class="xref" data-target="sec-cp-I-G">Section I.G.</span>', out)
        self.assertNotIn("xref-external-reg", out)


@unittest.skipUnless(os.path.exists(REGCP_TXT), "sources/REG_CP.txt not present in this checkout")
class RegCpEndToEndTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pdf = REGCP_PDF if os.path.exists(REGCP_PDF) else None
        (cls.rows, cls.unresolved, cls.table_hits, cls.n_tables, cls.dupes,
         cls.fixes, cls.anomalies, cls.audit) = ic.parse_reg("cp", REGCP_TXT, pdf)
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_top_level_sections_and_counts(self):
        for sec, title in [
            ("sec-cp-I", None),
            ("sec-cp-II", "II. General"),
            ("sec-cp-III", "III. (State Only) Civil Penalties"),
            ("sec-cp-IV", "IV. Reserved"),
            ("sec-cp-V", "V. Statements of Basis, Specific Statutory Authority and Purpose"),
        ]:
            self.assertIn(sec, self.by_id, sec)
            if title:
                self.assertEqual(self.by_id[sec]["title"], title)
        self.assertEqual(self.dupes, [])
        self.assertTrue(all(r["parent_id"] is None or r["parent_id"] in self.by_id for r in self.rows))

    def test_definitions_section_has_123_term_rows(self):
        defs = [r for r in self.rows if r["kind"] == "definition"]
        self.assertEqual(len(defs), 123)
        self.assertTrue(all(r["parent_id"] == "sec-cp-I-G" for r in defs))
        self.assertEqual(defs[0]["title"], "I.G.1. ABSOLUTE VAPOR PRESSURE")
        self.assertEqual(defs[-1]["title"], "I.G.123. WOOD RESIDUE")

    def test_statement_of_basis_has_22_dated_entries_a_through_v(self):
        import re as _re
        sob = sorted(
            (r for r in self.rows if _re.match(r"^sec-cp-V-[A-Z]+$", r["id"])),
            key=lambda r: r["sort_order"],
        )
        self.assertEqual([r["id"][-1] for r in sob], list("ABCDEFGHIJKLMNOPQRSTUV"))
        self.assertTrue(sob[0]["full_text"].startswith("<p>Adopted December 14, 1978"))
        self.assertTrue(sob[-1]["full_text"].startswith("<p>Adopted October 17, 2025"))

    def test_civil_penalty_table_rendered(self):
        row = self.by_id["sec-cp-III-B-3"]
        self.assertIn('<table class="doc-table">', row["full_text"])
        self.assertIn("Maximum civil penalty", row["full_text"])
        self.assertGreaterEqual(self.table_hits["used"], 1)

    def test_no_repeated_paragraph_prefixes(self):
        # Gate C: the first 50 chars of any paragraph must not recur >=3x
        # inside the same row (the Reg 3 Part F / OOOOb fused-row heuristic).
        import re as _re
        from collections import Counter as _Counter
        flagged = []
        for r in self.rows:
            paras = _re.findall(r"<p>(.*?)</p>", r["full_text"], _re.S)
            prefixes = _Counter(p[:50] for p in paras)
            flagged.extend((r["id"], pre) for pre, c in prefixes.items() if c >= 3)
        self.assertEqual(flagged, [])

    def test_no_page_furniture_leaks(self):
        for r in self.rows:
            self.assertNotRegex(r["full_text"], r"CODE OF COLORADO REGULATIONS")
            self.assertNotRegex(r["full_text"], r"^Air Quality Control Commission$")


class CrossRefNoOpProofTests(unittest.TestCase):
    """The no-op proof BATCH3_BRIEF.md requires: Reg 1/2/26 parse
    byte-identically to their baselines with the four new batch-3
    regulations ("cp", "9", "24", "30") absent from CORPUS_REGS, and, with
    them present, every difference is a new external-reg link to one of
    those four (either the generic `<a class="xref-external-reg"
    href="/regulations/{9,24,30,cp}">` form REG_NUM_RE produces, or cp's own
    `<a ... data-provision-id="sec-cp-...">` form). Runs against the real
    sources/out fixtures when present; skips (rather than fails) otherwise,
    since those baseline files are build artifacts, not checked-in fixtures
    every clone of this repo carries."""

    # Every reg added AFTER the reg1/2/26 baselines were captured (batch 3
    # plus the general permits and the federal engine subparts) -- their
    # only permitted effect on Reg 1/2/26 output is new links to themselves.
    NEW_REGS = ("cp", "9", "24", "30", "jjjj", "iiii", "zzzz",
                "gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12",
                "p191", "p192", "p194", "p195", "p199",
                "p190", "p193", "p196")

    BASELINE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
    SOURCES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources")

    def _paths(self, reg):
        return (
            os.path.join(self.SOURCES_DIR, f"REG_{reg}.txt"),
            os.path.join(self.SOURCES_DIR, f"REG_{reg}.pdf"),
            os.path.join(self.BASELINE_DIR, f"reg{reg.lower()}_baseline.json"),
        )

    def test_reg1_reg2_reg26_are_byte_identical_with_new_regs_absent(self):
        import json as _json
        for reg in ("1", "2", "26"):
            txt, pdf, baseline = self._paths(reg)
            if not (os.path.exists(txt) and os.path.exists(baseline)):
                self.skipTest(f"sources/REG_{reg}.txt or baseline not present in this checkout")
            corpus_without_new = {k: v for k, v in ic.CORPUS_REGS.items() if k not in self.NEW_REGS}
            saved_corpus = ic.CORPUS_REGS
            saved_cache = ic._CP_KNOWN_IDS_CACHE
            try:
                ic.CORPUS_REGS = corpus_without_new
                ic._CP_KNOWN_IDS_CACHE = None
                result = ic.parse_reg(reg, txt, pdf if os.path.exists(pdf) else None)
            finally:
                ic.CORPUS_REGS = saved_corpus
                ic._CP_KNOWN_IDS_CACHE = saved_cache
            out = _json.dumps(result[0], ensure_ascii=False, indent=1)
            with open(baseline, encoding="utf-8") as fh:
                base = fh.read()
            self.assertEqual(out, base, f"reg {reg} not byte-identical with the post-baseline regs absent from CORPUS_REGS")

    def test_reg1_reg2_reg26_diffs_are_only_new_links_to_the_four_new_regs(self):
        import json as _json
        import re as _re
        tag_re = _re.compile(
            r'<a class="xref-external-reg"(?: data-provision-id="sec-(?:cp|p19[0-9])-[^"]*")?'
            r' href="/regulations/(?:cp|9|24|30|jjjj|iiii|zzzz|gp\d\d|p19[0-9])">(.*?)</a>'
        )
        new_link_counts = {reg: 0 for reg in ("1", "2", "26")}
        for reg in ("1", "2", "26"):
            txt, pdf, baseline = self._paths(reg)
            if not (os.path.exists(txt) and os.path.exists(baseline)):
                self.skipTest(f"sources/REG_{reg}.txt or baseline not present in this checkout")
            result = ic.parse_reg(reg, txt, pdf if os.path.exists(pdf) else None)
            with open(baseline, encoding="utf-8") as fh:
                base_rows = {r["id"]: r for r in _json.load(fh)}
            new_rows = {r["id"]: r for r in result[0]}
            self.assertEqual(set(base_rows), set(new_rows))
            for rid, base_row in base_rows.items():
                new_text = new_rows[rid]["full_text"]
                if new_text == base_row["full_text"]:
                    continue
                stripped, n = tag_re.subn(lambda m: m.group(1), new_text)
                self.assertEqual(stripped, base_row["full_text"], rid)
                self.assertGreaterEqual(n, 1, rid)
                new_link_counts[reg] += n
        # Sanity-check against the per-reg new-link counts the agents each
        # reported (cp: 24, 9: 11, 24: 2, 30: 0 links into reg1/2/26): the
        # union total should be in that neighborhood, not wildly off.
        self.assertGreater(sum(new_link_counts.values()), 0, new_link_counts)


class Step1Point1CorpusGateTests(unittest.TestCase):
    """PHMSA_BRIEF.md step 1: prove step 1.1 ("49 CFR Part 192" / "49 CFR
    192.605(b)") in link_citations() is gated on corpus membership, and that
    it never competes with step 1 (which only ever matches "40 CFR ..."). No
    new parsing of p191/p192 themselves -- this only exercises the citing
    side, against text a Colorado regulation (Reg 7) might contain."""

    TEXT = "See 49 CFR Part 192 and 49 CFR 192.605(b) for the federal minimum standard, and 40 CFR Part 60 too."

    def test_49_cfr_part_192_is_a_plain_cfr_bucket_hit_when_p192_not_in_corpus(self):
        corpus_without_p19x = set(ic.CORPUS_REGS) - {"p191", "p192"}
        html, buckets = ic.link_citations(self.TEXT, "7", {"sec-7-top-REG-7"}, corpus_without_p19x)
        self.assertNotIn("xref-external-reg", html)
        self.assertIn("49 CFR Part 192", buckets[ic.BUCKET_CFR])
        self.assertIn("49 CFR 192.605(b)", buckets[ic.BUCKET_CFR])

    def test_49_cfr_part_192_links_to_p192_once_it_is_in_corpus(self):
        html, buckets = ic.link_citations(self.TEXT, "7", {"sec-7-top-REG-7"}, set(ic.CORPUS_REGS))
        self.assertIn('<a class="xref-external-reg" href="/regulations/p192">49 CFR Part 192</a>', html)
        self.assertIn('data-provision-id="sec-p192-192.605"', html)
        self.assertNotIn("49 CFR Part 192", buckets[ic.BUCKET_CFR])
        self.assertNotIn("49 CFR 192.605(b)", buckets[ic.BUCKET_CFR])

    def test_40_cfr_part_60_is_unaffected_by_step_1_1(self):
        # Step 1 (40 CFR) and step 1.1 (49 CFR) must never compete for the
        # same span; "40 CFR Part 60" gets the exact same treatment (same
        # bucket membership, same count) whether or not p191/p192 are in
        # the corpus -- step 1.1 only ever fires on "49 CFR ...".
        html_with, buckets_with = ic.link_citations(self.TEXT, "7", {"sec-7-top-REG-7"}, set(ic.CORPUS_REGS))
        html_without, buckets_without = ic.link_citations(
            self.TEXT, "7", {"sec-7-top-REG-7"}, set(ic.CORPUS_REGS) - {"p191", "p192"})
        self.assertEqual(html_with.count("40 CFR Part 60"), html_without.count("40 CFR Part 60"))
        self.assertEqual(dict(buckets_with[ic.BUCKET_CFR]).get("40 CFR Part 60"),
                          dict(buckets_without[ic.BUCKET_CFR]).get("40 CFR Part 60"))


class Cfr49DottedFormsTests(unittest.TestCase):
    """ECMC (sources/ECMC.txt) is the only Colorado document that cites 49
    CFR, and it never writes the plain "49 CFR" form CFR_TITLE_PART_RE
    originally accepted -- always dotted/spaced "C.F.R."/"C. F. R.", with a
    "§"/"§§" before the section number, including a "§§ X or Y" two-item
    list (each item resolving on its own) and a bare "§ 195 Subpart A"
    part+subpart-letter cite with no section number at all. See lines
    399-406, 848-853 and 26141-26147 of sources/ECMC.txt for the real text
    these are drawn from."""

    def _corpus(self):
        return set(ic.CORPUS_REGS)

    def test_dotted_single_section_links_when_in_corpus(self):
        text = "pursuant to 49 C.F.R. § 192.243 and 49 C.F.R. § 195.234, in existence"
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p192" '
            'data-provision-id="sec-p192-192.243">49 C.F.R. § 192.243</a>',
            html,
        )
        # Batch B put Part 195 in the corpus too, so BOTH halves of this
        # real ECMC sentence now link (Batch A's version of this test
        # asserted 195.234 stayed a plain cfr-bucket hit -- that is exactly
        # the behaviour change this batch is for). Nothing lands in the
        # bucket; a part still out of corpus does -- see the 193/196 tests.
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p195" '
            'data-provision-id="sec-p195-195.234">49 C.F.R. § 195.234</a>',
            html,
        )
        self.assertEqual(html.count("xref-external-reg"), 2)
        self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0)

    def test_dotted_single_section_bucketed_when_not_in_corpus(self):
        text = "pursuant to 49 C.F.R. § 192.243, in existence"
        corpus_without_p19x = self._corpus() - {"p191", "p192", "p194", "p195", "p199"}
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, corpus_without_p19x)
        self.assertNotIn("xref-external-reg", html)
        self.assertIn("49 C.F.R. § 192.243", buckets[ic.BUCKET_CFR])

    def test_spaced_dotted_c_f_r_form(self):
        # "49 C. F. R." (space after every dot) -- the CFR_RE_DOTTED
        # comment's own example of a print variant this style of regex has
        # to tolerate.
        text = "as required by 49 C. F. R. Part 192."
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertIn('<a class="xref-external-reg" href="/regulations/p192">49 C. F. R. Part 192</a>', html)

    def test_double_section_sign_list_each_resolves_independently(self):
        # Part 198 is not in the corpus, 192 is. Only the 192.8 half should
        # link; the 198.2 half stays plain text and lands in the cfr bucket;
        # the shared "49 C.F.R. §§ " and " or " connective text is untouched
        # either way. (Batch A wrote this with 195.2 as the out-of-corpus
        # half, Batch B with 193.2; both are in the corpus now, so Part 198
        # plays that role.)
        text = "pursuant to 49 C.F.R. §§ 198.2 or 192.8. 49 C.F.R. §§ 198.2 or 192.8 and 4 C.C.R."
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p192" '
            'data-provision-id="sec-p192-192.8">192.8</a>',
            html,
        )
        self.assertIn("49 C.F.R. §§ ", html)  # prefix left as plain text
        self.assertIn(" or ", html)  # connective left as plain text
        self.assertIn("198.2", buckets[ic.BUCKET_CFR])
        self.assertNotIn("192.8", buckets[ic.BUCKET_CFR])

    def test_double_section_sign_list_both_halves_in_corpus_after_batch_b(self):
        """The real ECMC sentence: "49 C.F.R. §§ 195.2 or 192.8". Both parts
        are in the corpus now, so both halves link, each to its own reg."""
        text = "pursuant to 49 C.F.R. §§ 195.2 or 192.8 and 4 C.C.R."
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p195" '
            'data-provision-id="sec-p195-195.2">195.2</a>',
            html,
        )
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p192" '
            'data-provision-id="sec-p192-192.8">192.8</a>',
            html,
        )
        self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0)

    def test_double_section_sign_list_both_out_of_corpus(self):
        # (Batch C put 193/196 in the corpus; 198 and DOT's Part 7 stay out.)
        text = "pursuant to 49 C.F.R. §§ 198.2 or 7.29."
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertNotIn("xref-external-reg", html)
        self.assertIn("198.2", buckets[ic.BUCKET_CFR])
        self.assertIn("7.29", buckets[ic.BUCKET_CFR])

    def test_bare_part_subpart_letter_deep_links_to_the_subpart_row(self):
        # "49 C.F.R. § 195 Subpart A" -- ECMC's CRUDE OIL TRANSFER LINE
        # definition. Batch A left this in the cfr bucket because 195 was
        # not in the corpus. Batch B imports Part 195 AND resolves the
        # printed subpart letter to the subpart row parse_ecfr_part emits
        # (`sec-p195-PART-A`).
        text = (
            "pursuant to 49 C.F.R. § 195 Subpart A, and that transfers crude oil"
        )
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p195" '
            'data-provision-id="sec-p195-PART-A">49 C.F.R. § 195 Subpart A</a>',
            html,
        )
        self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0)

    def test_bare_part_subpart_of_a_part_not_in_corpus_stays_bucketed(self):
        # (193 was the stand-in until Batch C imported it; 198 stays out.)
        text = "pursuant to 49 C.F.R. § 198 Subpart D, and that transfers crude oil"
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertNotIn("xref-external-reg", html)
        self.assertIn("49 C.F.R. § 198 Subpart D", buckets[ic.BUCKET_CFR])

    def test_bare_part_subpart_letter_links_if_that_part_were_ever_in_corpus(self):
        # Same shape, but naming a part that IS in the corpus -- proves the
        # bare part+subpart-letter form links like any other bare "Part N"
        # cite once its part is imported (it just never fires for real in
        # this corpus today, since 191/192 are never printed with a bare
        # "Subpart" letter in ECMC).
        text = "pursuant to 49 C.F.R. § 192 Subpart A, and that transfers crude oil"
        html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, self._corpus())
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p192" '
            'data-provision-id="sec-p192-PART-A">49 C.F.R. § 192 Subpart A</a>',
            html,
        )

    def test_undotted_49_cfr_forms_still_work(self):
        # Regression: the original plain "49 CFR Part 192" / "49 CFR
        # 192.605(b)" forms (no dots, no §) must still work exactly as
        # before this change.
        text = "See 49 CFR Part 192 and 49 CFR 192.605(b) for the standard."
        html, buckets = ic.link_citations(text, "7", {"sec-7-top-REG-7"}, self._corpus())
        self.assertIn('<a class="xref-external-reg" href="/regulations/p192">49 CFR Part 192</a>', html)
        self.assertIn('data-provision-id="sec-p192-192.605"', html)


class BatchBPhmsaTouchpointTests(unittest.TestCase):
    """49 CFR Parts 194/195/199 (Batch B) reach the CCR importer through the
    same four config surfaces Parts 191/192 did in Batch A."""

    KEYS = ("p194", "p195", "p199")

    def test_corpus_and_ecfr_dispatch_sets(self):
        for k in self.KEYS:
            self.assertEqual(ic.CORPUS_REGS[k], k)
            self.assertIn(k, ic.ECFR_REGS)

    def test_reg_meta_is_federal_phmsa(self):
        expected = {
            "p194": ("194", "49 CFR Part 194",
                     "49 CFR Part 194 \u2014 Response Plans for Onshore Oil Pipelines"),
            "p195": ("195", "49 CFR Part 195",
                     "49 CFR Part 195 \u2014 Transportation of Hazardous Liquids by Pipeline"),
            "p199": ("199", "49 CFR Part 199",
                     "49 CFR Part 199 \u2014 Drug and Alcohol Testing"),
        }
        for k, (part, cite, title) in expected.items():
            meta = ic.REG_META[k]
            self.assertEqual(meta["jurisdiction_level"], "federal", k)
            self.assertEqual(meta["issuing_body"], "PHMSA", k)
            self.assertEqual(meta["source_url"],
                             f"https://www.ecfr.gov/current/title-49/part-{part}", k)
            self.assertEqual(meta["root_citation"], cite, k)
            self.assertEqual(meta["root_title"], title, k)

    def test_title_part_map_has_all_eight_pipeline_parts_and_no_40_cfr_entry(self):
        self.assertEqual(
            ic.CFR_TITLE_PART_TO_REGKEY,
            {("49", "191"): "p191", ("49", "192"): "p192",
             ("49", "194"): "p194", ("49", "195"): "p195", ("49", "199"): "p199",
             ("49", "190"): "p190", ("49", "193"): "p193", ("49", "196"): "p196"},
        )
        self.assertFalse([k for k in ic.CFR_TITLE_PART_TO_REGKEY if k[0] != "49"])

    def test_40_cfr_subpart_map_is_untouched(self):
        self.assertEqual(
            ic.CFR_SUBPART_TO_REGKEY,
            {"OOOOA": "ooooa", "OOOOB": "oooob", "OOOOC": "ooooc",
             "JJJJ": "jjjj", "IIII": "iiii", "ZZZZ": "zzzz"},
        )

    def test_the_four_ecmc_citation_forms_all_resolve(self):
        """The four 49 CFR forms ECMC actually prints (see the Batch A
        merge-and-prove): a dotted section, a two-item list, a second
        dotted section, and a bare part+subpart."""
        corpus = set(ic.CORPUS_REGS)
        for text, want in (
            ("49 C.F.R. \u00a7 195.2", 'data-provision-id="sec-p195-195.2"'),
            ("49 C.F.R. \u00a7 195.234", 'data-provision-id="sec-p195-195.234"'),
            ("49 C.F.R. \u00a7 195.410", 'data-provision-id="sec-p195-195.410"'),
            ("49 C.F.R. \u00a7 195 Subpart A", 'data-provision-id="sec-p195-PART-A"'),
        ):
            html, buckets = ic.link_citations_ecmc(
                text, {"sec-ecmc-top-REG-ecmc"}, corpus, {})
            self.assertIn(want, html, text)
            self.assertIn('href="/regulations/p195"', html, text)
            self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0, text)

    def test_49_cfr_194_and_199_link_too(self):
        corpus = set(ic.CORPUS_REGS)
        for text, reg, deep in (
            ("49 CFR Part 194", "p194", None),
            ("49 CFR 194.105", "p194", "sec-p194-194.105"),
            ("49 CFR Part 199", "p199", None),
            ("49 C.F.R. \u00a7 199.3", "p199", "sec-p199-199.3"),
        ):
            html, _ = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, corpus)
            self.assertIn(f'href="/regulations/{reg}"', html, text)
            if deep:
                self.assertIn(f'data-provision-id="{deep}"', html, text)

    def test_the_new_keys_are_a_no_op_while_out_of_corpus(self):
        corpus = set(ic.CORPUS_REGS) - {"p194", "p195", "p199"}
        for text in ("49 CFR Part 195", "49 C.F.R. \u00a7 195.2",
                     "49 C.F.R. \u00a7 195 Subpart A", "49 CFR Part 199"):
            html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, corpus)
            self.assertNotIn("xref-external-reg", html, text)
            self.assertGreaterEqual(sum(buckets[ic.BUCKET_CFR].values()), 1, text)

    def test_40_cfr_citations_are_unaffected_by_the_new_keys(self):
        with_new = set(ic.CORPUS_REGS)
        without_new = with_new - {"p194", "p195", "p199"}
        text = "See 40 CFR Part 60, Subpart OOOOb and 40 CFR Part 63, Subpart ZZZZ."
        a, ba = ic.link_citations(text, "7", {"sec-7-top-REG-7"}, with_new)
        b, bb = ic.link_citations(text, "7", {"sec-7-top-REG-7"}, without_new)
        self.assertEqual(a, b)
        self.assertEqual(ba, bb)


class Cfr49EcmcOwnLinkerTests(unittest.TestCase):
    """ECMC uses its own independent linker, link_citations_ecmc() (a
    different function from link_citations, used by every numbered CCR
    reg) -- so the 49 CFR handling has to be proven through THAT function
    too, not just link_citations, or it would never actually fire for the
    one document that needs it. See sources/ECMC.txt lines 399-406,
    848-853 and 26141-26147 for the real printed text these mirror."""

    def _corpus(self):
        return set(ic.CORPUS_REGS)

    def test_ecmc_dotted_section_links_via_its_own_linker(self):
        text = (
            "Administration pursuant to 49 C.F.R. § 192.243 and 49 C.F.R. § "
            "195.234, in existence as of the date of this regulation"
        )
        html, buckets = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, self._corpus(), {})
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p192" '
            'data-provision-id="sec-p192-192.243">49 C.F.R. § 192.243</a>',
            html,
        )
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p195" '
            'data-provision-id="sec-p195-195.234">49 C.F.R. § 195.234</a>',
            html,
        )

    def test_ecmc_double_section_list_via_its_own_linker(self):
        text = "pursuant to 49 C.F.R. §§ 195.2 or 192.8. 49 C.F.R. §§ 195.2 or 192.8 and"
        html, buckets = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, self._corpus(), {})
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p192" '
            'data-provision-id="sec-p192-192.8">192.8</a>',
            html,
        )
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p195" '
            'data-provision-id="sec-p195-195.2">195.2</a>',
            html,
        )
        self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0)

    def test_ecmc_bare_part_subpart_via_its_own_linker(self):
        text = "pursuant to 49 C.F.R. § 195 Subpart A, and that transfers crude oil"
        html, buckets = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, self._corpus(), {})
        self.assertIn(
            '<a class="xref-external-reg" href="/regulations/p195" '
            'data-provision-id="sec-p195-PART-A">49 C.F.R. § 195 Subpart A</a>',
            html,
        )
        self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0)

    def test_ecmc_49_cfr_not_in_corpus_stays_bucketed_via_its_own_linker(self):
        text = "pursuant to 49 C.F.R. § 192.243, in existence"
        corpus_without_p19x = self._corpus() - {"p191", "p192", "p194", "p195", "p199"}
        html, buckets = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, corpus_without_p19x, {})
        self.assertNotIn("xref-external-reg", html)
        self.assertIn("49 C.F.R. § 192.243", buckets[ic.BUCKET_CFR])


# ---------------------------------------------------------------------------
# Reg 9 (5 CCR 1001-11) — a part-less regulation (like Reg 1) whose body ALSO
# prints every level bare rather than compound (BARE_LADDER_REGS — see that
# frozenset's own comment): "A." not "II.A.", "1." not "II.A.1.". This
# fixture keeps every top-level roman section (I.-IX., in strict sequence,
# since `_bare_ladder_tokens` needs each one to be the previous one's
# immediate next sibling) but trims IV.-VIII. to bare headings.
# ---------------------------------------------------------------------------

_REG9_MINI = """\
    I.        Scope

    This regulation applies to all open burning activity throughout the state.

    II.       Definitions

    The following definitions apply for the purposes of this Regulation Number 9.

    A.        Agricultural Open Burning

              The open burning of cover vegetation for agricultural purposes.

    B.        Air Curtain Destructor (ACD)

              An open burning device using a curtain of air.

C.    Authorized Local Agency

      A local agency delegated authority to issue permits.

D.    Broadcast Burn

      Controlled application of fire to wildland fuels.

E.    Class I Area

      An area listed in another regulation.

F.    Clean Lumber

      Wood or wood products that have been cut or shaped.

G.    Fuel Treatment

      Manipulation of wildland fuels to reduce fire risk.

H.    General Open Burn

      A planned fire below the prescribed fire de minimis threshold.

I.    Land Manager

      Any federal, state, local or private person or entity that administers land.

J.    Monitoring

      Observing and recording smoke from prescribed fire.

III.   Open Burning Permit Requirements

A.     No person shall conduct any open burning activity without a permit.

B.     The following activities are exempt from the permit requirement:

       1.         Noncommercial burning of private household trash.

       2.         Fires used for noncommercial cooking.

IV.    General Open Burning Permit

V.    Planned Ignition Fire Permits

VI.    Unplanned Ignition Fire Permits

VII.   Additional Requirements for Significant Users of Prescribed Fire

VIII.   Fees for Open Burning and Prescribed Fire

IX.     Statement of Basis, Specific Statutory Authority and Purpose

A.      Adopted January 17, 2002

This Statement of Basis complies with the Colorado Administrative Procedures Act.

1.      A restarted inner list item that must NOT become sec-9-IX-A-1.

B.      Adopted December 19, 2002

Another statement of basis entry, adopted without inner items.

C.      February 19, 2015

A bare-date entry with no "Adopted" keyword at all.

D.      Adopted Feb. 15, 2024

An abbreviated-month entry.

APPENDIX A        DE MINIMIS PRESCRIBED FIRE PROJECTS

Some proposed planned ignition prescribed fire projects may emit low smoke.

APPENDIX B ESTIMATING PM10 EMISSIONS FOR THE PURPOSE OF DETERMINING WHETHER
     A LANDOWNER/MANAGER IS A SIGNIFICANT USER OF PRESCRIBED FIRE

TABLE I EXAMPLE BURNS

FUEL TYPE     THRESHOLD
Grass         10 acres

Example Calculations follow the table above.
"""

_REG9_TABLES_STUB = {
    "TABLE I EXAMPLE BURNS": {
        "caption": "TABLE I EXAMPLE BURNS",
        "rows": [["FUEL TYPE", "THRESHOLD"], ["Grass", "10 acres"]],
    },
}


class Reg9BareLadderTests(unittest.TestCase):
    def _parse(self, text=_REG9_MINI, tables=None):
        lines, seams = ic.clean_pages(text)
        start = ic.find_body_start_no_parts(lines)
        lines = lines[start:]
        markers, audit = ic.scan_markers(lines, {i - start for i in seams if i >= start}, "9")
        provisions, order, unresolved, table_hits = ic.build_provisions(
            "9", lines, markers, tables if tables is not None else _REG9_TABLES_STUB,
        )
        return [provisions[i] for i in order], unresolved, audit, table_hits

    def test_reg9_is_configured_as_bare_ladder_and_part_less(self):
        self.assertTrue(ic.reg_has_no_parts("9"))
        self.assertIn("9", ic.BARE_LADDER_REGS)
        for other in ("1", "2", "3", "7", "22", "26"):
            self.assertNotIn(other, ic.BARE_LADDER_REGS)
        self.assertEqual(ic.CORPUS_REGS["9"], "9")
        self.assertEqual(ic._sob_scope("9"), (None, "IX"))
        self.assertEqual(ic.REG_META["9"]["root_citation"], "Code of Colorado Regulations · Regulation Number 9")
        self.assertEqual(
            ic.REG_META["9"]["root_title"],
            "OPEN BURNING, PRESCRIBED FIRE, AND PERMITTING 5 CCR 1001-11",
        )

    def test_bare_letter_that_is_also_a_valid_roman_numeral_stays_a_definition(self):
        # Section II's Land Manager definition is bare "I." — lexically a
        # valid roman numeral, but it must resolve as the 9th definitions
        # letter (sec-9-II-I), never a spurious new top-level "Section I."
        # colliding with the real sec-9-I (Scope). Same trap for "H."/"J."
        # (not romans) sanity-checked alongside it.
        rows, _, _, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertIn("sec-9-II-I", by_id)
        self.assertIn("Land Manager", by_id["sec-9-II-I"]["full_text"])
        self.assertEqual(by_id["sec-9-II-I"]["parent_id"], "sec-9-II")
        self.assertNotIn("sec-9-I-I", by_id)
        # Exactly one "sec-9-I" row exists (Section I, Scope) — Land Manager
        # did not fuse into it or spawn a second top-level "I.".
        self.assertEqual(sum(1 for r in rows if r["id"] == "sec-9-I"), 1)
        self.assertIn("Scope", by_id["sec-9-I"]["full_text"])
        self.assertEqual(by_id["sec-9-II-H"]["parent_id"], "sec-9-II")
        self.assertEqual(by_id["sec-9-II-J"]["parent_id"], "sec-9-II")

    def test_bare_ladder_ids_parents_and_no_fabricated_parts(self):
        rows, _, _, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        self.assertFalse(any(r["kind"] == "part" for r in rows))
        self.assertNotIn("sec-9-P-A", by_id)
        for rid in ("sec-9-I", "sec-9-II", "sec-9-III", "sec-9-IX"):
            self.assertEqual(by_id[rid]["parent_id"], "sec-9-top-REG-9")
        self.assertEqual(by_id["sec-9-III-B-1"]["parent_id"], "sec-9-III-B")
        self.assertEqual(by_id["sec-9-III-B-2"]["parent_id"], "sec-9-III-B")
        self.assertEqual(by_id["sec-9-III-A"]["citation"], "III.A.")
        # Every parent resolves; every id unique.
        self.assertEqual(len(by_id), len(rows))
        for r in rows:
            self.assertTrue(r["parent_id"] is None or r["parent_id"] in by_id, r["id"])

    def test_bare_ladder_tokens_unit_behavior(self):
        bl = ic._bare_ladder_tokens
        # Bootstrap: only "I." opens the document.
        self.assertEqual(bl("I.   Scope", []), ([("roman", "I")], 2))
        self.assertEqual(bl("A.   Not first", []), ([], 0))
        # Sibling of the deepest open level.
        chain = [("roman", "II"), ("upper", "H")]
        toks, consumed = bl("I.   Land Manager", chain)
        self.assertEqual(toks, [("roman", "II"), ("upper", "I")])
        # First child of a new, one-level-deeper list.
        chain = [("roman", "III"), ("upper", "B")]
        toks, consumed = bl("1.   First item", chain)
        self.assertEqual(toks, [("roman", "III"), ("upper", "B"), ("digit", "1")])
        # Sibling of an ancestor closes every level below it.
        chain = [("roman", "IV"), ("upper", "D"), ("digit", "12")]
        toks, consumed = bl("V.   Next section", chain)
        self.assertEqual(toks, [("roman", "V")])
        # A non-matching, non-continuing line isn't a marker at all.
        self.assertEqual(bl("This is body text.", chain), ([], 0))

    def test_sob_implicit_section_prefix_and_openers(self):
        rows, _, _, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        # Ids nest under the section root, not a bare `sec-9-A` colliding
        # with Section II's own definitions letter A.
        for rid in ("sec-9-IX-A", "sec-9-IX-B", "sec-9-IX-C", "sec-9-IX-D"):
            self.assertIn(rid, by_id)
            self.assertEqual(by_id[rid]["parent_id"], "sec-9-IX")
        self.assertNotEqual(by_id["sec-9-IX-A"]["id"], by_id["sec-9-II-A"]["id"])
        self.assertEqual(by_id["sec-9-IX-A"]["citation"], "IX.A.")
        # "Adopted <full month>", bare-date, and "Adopted <abbreviated month>"
        # openers are all accepted (see REG9_SOB_OPENER_RE).
        self.assertTrue(by_id["sec-9-IX-A"]["full_text"].startswith("<p>Adopted January 17, 2002</p>"))
        self.assertTrue(by_id["sec-9-IX-C"]["full_text"].startswith("<p>February 19, 2015</p>"))
        self.assertTrue(by_id["sec-9-IX-D"]["full_text"].startswith("<p>Adopted Feb. 15, 2024</p>"))
        # inner_items False: the restarted "1." list stays inside the entry.
        self.assertNotIn("sec-9-IX-A-1", by_id)
        self.assertIn("must NOT become sec-9-IX-A-1", by_id["sec-9-IX-A"]["full_text"])

    def test_appendix_heading_continuation_not_duplicated(self):
        rows, _, _, _ = self._parse()
        by_id = {r["id"]: r for r in rows}
        app_a = by_id["sec-9-APPENDIX-A"]
        self.assertEqual(app_a["title"], "Appendix A — DE MINIMIS PRESCRIBED FIRE PROJECTS")
        self.assertEqual(app_a["parent_id"], "sec-9-top-REG-9")
        app_b = by_id["sec-9-APPENDIX-B"]
        self.assertEqual(
            app_b["title"],
            "Appendix B — ESTIMATING PM10 EMISSIONS FOR THE PURPOSE OF DETERMINING WHETHER "
            "A LANDOWNER/MANAGER IS A SIGNIFICANT USER OF PRESCRIBED FIRE",
        )
        # The continuation line folded into the title must NOT ALSO appear
        # as the appendix's own first body paragraph (see
        # APPENDIX_HEADING_DEDUP_REGS).
        self.assertNotIn(
            "<p>A LANDOWNER/MANAGER IS A SIGNIFICANT USER OF PRESCRIBED FIRE</p>",
            app_b["full_text"],
        )

    def test_appendix_table_splice_renders_and_trims_raw_dump(self):
        rows, _, _, table_hits = self._parse()
        by_id = {r["id"]: r for r in rows}
        app_b = by_id["sec-9-APPENDIX-B"]
        self.assertIn('<div class="doc-table-caption">TABLE I EXAMPLE BURNS</div>', app_b["full_text"])
        self.assertIn("<td>Grass</td><td>10 acres</td>", app_b["full_text"])
        # The raw pdftotext dump of the table is gone, replaced by the
        # rendered table; the prose after it survives untouched.
        self.assertNotIn("FUEL TYPE     THRESHOLD", app_b["full_text"])
        self.assertIn("Example Calculations follow the table above.", app_b["full_text"])
        self.assertEqual(table_hits["used"], 1)
        self.assertIn("TABLE I EXAMPLE BURNS", table_hits["captions_used"])

    def test_reg9_appendix_table_caption_regex(self):
        self.assertIsNone(ic._table_caption_key("TABLE I EXAMPLE BURNS", "1"))
        self.assertEqual(ic._table_caption_key("TABLE I EXAMPLE BURNS", "9"), "TABLE I EXAMPLE BURNS")
        self.assertEqual(
            ic._table_caption_key("TABLE II   SOURCES", "9"),
            "TABLE II SOURCES",
        )

    def test_bare_ladder_is_a_noop_for_other_regs(self):
        # tokenize_by_cycle keeps handling every non-bare-ladder reg exactly
        # as before: a bare "A." (no roman prefix) still produces zero
        # tokens under the ordinary compound cycle.
        self.assertEqual(ic.tokenize_by_cycle("A.   Some heading", ic.cycle_ab_for("7")), ([], 0))
        self.assertEqual(ic.tokenize_by_cycle("A.   Some heading", ic.cycle_ab_for("26")), ([], 0))


REG24_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_24.txt")
REG24_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_24.pdf")


class Reg24MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["24"], "24")
        meta = ic.REG_META["24"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 24")
        self.assertEqual(
            meta["root_title"],
            "CONTROL OF EMISSIONS FROM VOLATILE ORGANIC COMPOUNDS AND "
            "PETROLEUM LIQUIDS STORAGE AND PETROLEUM PROCESSING AND "
            "REFINING 5 CCR 1001-28",
        )


class Reg24SobPartTests(unittest.TestCase):
    """Part C's top level is a bare-dated roman_seq sequence like Reg 26's,
    but (unlike Reg 26) needs inner_items off: entry I's own narrative wraps
    "...became a new Regulation Number\\n26. The upstream oil and gas..."
    onto a line start, which is a valid CYCLE_C_INNER digit token
    ("Number" is deliberately not in _label_position_plausible's
    disqualifying set) and, with inner items on, was accepted as a spurious
    marker that swallowed the rest of entry I's ~23,000 characters of text.
    """

    def test_config(self):
        cfg = ic.SOB_PART_CONFIG["24"]
        self.assertEqual((cfg["letter"], cfg["top_family"], cfg["inner_items"]), ("C", "roman_seq", False))
        self.assertIsNotNone(cfg["top_opener_re"].match("April 20, 2023"))
        self.assertIsNotNone(cfg["top_opener_re"].match("April 15-17, 2026 (Revisions to Part B, Section VI.)"))

    def test_wrapped_regulation_number_digit_is_not_a_spurious_item(self):
        lines = [
            "PART C        Statements of Basis, Specific Statutory Authority and Purpose",
            "",
            "I.        April 20, 2023",
            "",
            "The Commission reorganized Regulation Number 7 into four",
            "regulations: Part B became Regulation Number 24; and Part E became Regulation Number",
            "26. The upstream oil and gas intensity moved to Regulation Number 7.",
            "",
            "II.     April 15-17, 2026 (Revisions to Part B, Section VI.)",
            "",
            "This is the second entry.",
        ]
        markers, _ = ic.scan_markers(lines, set(), "24")
        provisions, order, _unres, _tables = ic.build_provisions("24", lines, markers, {})
        # Exactly two SOB rows, one per top-level roman entry -- no
        # "sec-24-C-I-26" item spun off from the wrapped "26." line.
        ids = [i for i in order if i.startswith("sec-24-P-C") is False and "-C-" in i]
        self.assertEqual(sorted(k for k in provisions if k.startswith("sec-24-C-")), ["sec-24-C-I", "sec-24-C-II"])
        self.assertIn("The upstream oil and gas intensity moved", provisions["sec-24-C-I"]["full_text"])
        self.assertIn("This is the second entry.", provisions["sec-24-C-II"]["full_text"])


class Reg24AppendixTests(unittest.TestCase):
    """Appendix A is printed inside Part A; Appendices B and C are printed
    inside Part B -- same "Appendix <Letter> <title...>" shape (and the same
    owner-part-scoped id / root-parented row) as Reg 7/22/26's appendices."""

    def test_appendix_ids_and_owner_parts(self):
        lines = [
            "PART A        Applicability and General Provisions",
            "",
            "I.     Applicability",
            "",
            "I.A.   Some provision text.",
            "",
            "Appendix A Colorado Ozone Nonattainment or Attainment Maintenance Areas",
            "",
            "I.      Chronology of Attainment Status",
            "",
            "1978            Denver 1-hour Ozone Nonattainment Area designation.",
            "",
            "PART B      Storage, Transfer, and Disposal of Volatile Organic Compounds",
            "",
            "I.  General Requirements",
            "",
            "I.A.    Some other provision text.",
            "",
            "Appendix B Criteria for Control of Vapors from Gasoline Transfer to Storage",
            "Tanks",
            "",
            "I.     Drop Tube Specifications.",
            "",
            "PART C        Statements of Basis, Specific Statutory Authority and Purpose",
            "",
            "I.        April 20, 2023",
            "",
            "Some SOB narrative.",
        ]
        markers, _ = ic.scan_markers(lines, set(), "24")
        provisions, order, _unres, _tables = ic.build_provisions("24", lines, markers, {})
        self.assertIn("sec-24-A-APPENDIX-A", provisions)
        self.assertIn("sec-24-B-APPENDIX-B", provisions)
        self.assertEqual(provisions["sec-24-A-APPENDIX-A"]["parent_id"], "sec-24-top-REG-24")
        self.assertEqual(provisions["sec-24-B-APPENDIX-B"]["parent_id"], "sec-24-top-REG-24")
        self.assertIn("Denver 1-hour Ozone Nonattainment", provisions["sec-24-A-APPENDIX-A"]["full_text"])
        self.assertIn("Drop Tube Specifications", provisions["sec-24-B-APPENDIX-B"]["full_text"])
        # The appendix's own internal roman list ("I. Chronology...") is
        # kept as one undivided blob, not split into further item rows.
        self.assertNotIn("sec-24-A-APPENDIX-A-I", provisions)


class Reg24FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(REG24_TXT):
            raise unittest.SkipTest("sources/REG_24.txt not present in this checkout")
        (cls.rows, cls.unresolved, _th, _nt, cls.dupes, cls.fixes, _an, _audit) = ic.parse_reg("24", REG24_TXT, None)
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_row_counts_and_structure(self):
        self.assertEqual(len(self.rows), 415)
        kinds = {}
        for r in self.rows:
            kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
        self.assertEqual(kinds["root"], 1)
        self.assertEqual(kinds["part"], 3)
        self.assertEqual(kinds["appendix"], 3)
        # Part A (I, II), Part B (I-VII), Part C's own two SOB entries.
        self.assertEqual(kinds["section"], 11)

    def test_no_duplicate_ids_and_every_parent_resolves(self):
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), len(set(ids)))
        id_set = set(ids)
        for r in self.rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], id_set)

    def test_sob_part_c_two_undivided_entries(self):
        self.assertEqual(self.by_id["sec-24-C-I"]["citation"], "I.")
        self.assertEqual(self.by_id["sec-24-C-II"]["citation"], "II.")
        # No spurious "26." item split out of entry I's wrapped citation.
        self.assertNotIn("sec-24-C-I-26", self.by_id)
        self.assertGreater(len(self.by_id["sec-24-C-I"]["full_text"]), 15000)

    def test_appendices_present_with_expected_owners(self):
        self.assertEqual(self.by_id["sec-24-A-APPENDIX-A"]["parent_id"], "sec-24-top-REG-24")
        self.assertEqual(self.by_id["sec-24-B-APPENDIX-B"]["parent_id"], "sec-24-top-REG-24")
        self.assertEqual(self.by_id["sec-24-B-APPENDIX-C"]["parent_id"], "sec-24-top-REG-24")

    def test_no_repeated_paragraph_prefix_within_a_row(self):
        import re
        from collections import Counter
        for r in self.rows:
            paras = re.findall(r"<p>(.*?)</p>", r["full_text"], re.S)
            counts = Counter(p[:50] for p in paras)
            for prefix, n in counts.items():
                self.assertLess(n, 3, f"{r['id']!r} repeats paragraph prefix {prefix!r} {n} times")

    def test_regulation_number_24_self_reference_links_to_root(self):
        text = self.by_id["sec-24-C-I"]["full_text"]
        self.assertIn('data-target="sec-24-top-REG-24"', text)


# ---------------------------------------------------------------------------
# Reg 30 — Toxic Air Contaminants (5 CCR 1001-34). Standard Part A/B/C shape
# (Part C is a roman_seq statement of basis like Reg 2/26's), but with its
# own Appendix A / Appendix B physically printed INSIDE Part C between the
# dated SOB entries, headed "Appendix <L>: <title>" (colon, unlike every
# other regulation's "Appendix <L> <title>" or bare "APPENDIX <L>"), and
# containing tables with no "Table N" caption of their own.
# ---------------------------------------------------------------------------

REG30_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_30.txt")
REG30_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_30.pdf")


class Reg30MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["30"], "30")
        meta = ic.REG_META["30"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["source_url"], "https://cdphe.colorado.gov/aqcc-regulations")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 30")
        self.assertEqual(meta["root_title"], "TOXIC AIR CONTAMINANTS 5 CCR 1001-34")
        self.assertNotIn("no_parts", meta)

    def test_sob_part_config(self):
        cfg = ic.SOB_PART_CONFIG["30"]
        self.assertEqual((cfg["letter"], cfg["top_family"]), ("C", "roman_seq"))
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted: January 17, 2025"))
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted April 17, 2026"))
        self.assertIsNone(cfg["top_opener_re"].match("Existing data concerning toxic air contaminants"))


class Reg30LabelFixTests(unittest.TestCase):
    def test_stray_space_before_g_iv_is_rewritten(self):
        lines = [
            "                   III.D.1. g.(iv) Notice of Applicability after a stationary source",
            "                           modifies: If a stationary source's forecasted actual",
        ]
        out, applied = ic.apply_known_label_fixes("30", lines)
        self.assertTrue(out[0].lstrip().startswith("III.D.1.g.(iv) Notice of Applicability"))
        self.assertEqual(out[1], lines[1])
        hits = {a["old_label"]: a["hits"] for a in applied}
        self.assertEqual(hits["III.D.1. g.(iv)"], 1)

    def test_every_reg_30_fix_hits_exactly_once_on_the_real_source(self):
        if not os.path.exists(REG30_TXT):
            self.skipTest("sources/REG_30.txt not present in this checkout")
        raw = open(REG30_TXT, encoding="utf-8").read()
        lines, _ = ic.clean_pages(raw)
        _, applied = ic.apply_known_label_fixes("30", lines)
        self.assertEqual(len(applied), 1)
        for a in applied:
            self.assertEqual(a["hits"], 1, a)


class Reg30PartCSobAndColonAppendixTests(unittest.TestCase):
    """Fixture in the exact pdftotext -layout shape of REG_30.txt's Part C:
    a roman_seq statement of basis whose own Appendix A / Appendix B are
    physically printed INSIDE it, between the dated entries, each headed
    "Appendix <L>: <title>" (colon-separated, no space before the colon) —
    the shape no other corpus regulation uses."""

    LINES = [
        "PART C        Statements of Basis, Specific Statutory Authority and Purpose",
        "",
        "I.      Adopted: January 17, 2025",
        "",
        "Findings that informed the identification.",
        "",
        "APPENDICES, BY PART",
        "",
        "Part B:",
        "",
        "Appendix A: Priority Toxic Air Contaminants",
        "",
        "CAS Number               Toxic Air Contaminant                       Date Identified",
        "",
        "71432                    Benzene                                     1/17/2025",
        "",
        "II.     Adopted: September 19, 2025",
        "",
        "Basis for the proposed benchmarks.",
        "",
        "Appendix B: Chronic Health-Protective Benchmarks for Priority Toxic Air",
        "Contaminants",
        "",
        "Table Notes:",
        "",
        "1.    Each chronic health-protective benchmark is in units of micrograms per cubic",
        "      meter.",
        "",
        "Proposed Chronic Health-Protective Benchmarks",
        "as of September 19, 2025.",
        "",
        "CAS       Priority Toxic",
        "Number    Contaminant",
        "",
        "71432     Benzene             0.13",
        "",
        "III.    Adopted: April 17, 2026",
        "",
        "Later findings.",
        "",
    ]

    def _tables(self):
        return {
            "Priority Toxic Air Contaminants": {
                "caption": "Priority Toxic Air Contaminants",
                "rows": [["CAS Number", "Toxic Air Contaminant", "Date Identified"],
                         ["71432", "Benzene", "1/17/2025"]],
            },
            "Chronic Health-Protective Benchmarks for Priority Toxic Air Contaminants": {
                "caption": "Chronic Health-Protective Benchmarks for Priority Toxic Air Contaminants",
                "rows": [["CAS Number", "Priority Toxic Contaminant"], ["71432", "Benzene"]],
            },
        }

    def _parse(self):
        markers, _ = ic.scan_markers(self.LINES, set(), "30")
        return ic.build_provisions("30", self.LINES, markers, self._tables())

    def test_part_c_top_entries_are_three_separate_rows(self):
        provisions, order, _, _ = self._parse()
        top_ids = [pid for pid in order if pid in ("sec-30-C-I", "sec-30-C-II", "sec-30-C-III")]
        self.assertEqual(top_ids, ["sec-30-C-I", "sec-30-C-II", "sec-30-C-III"])
        self.assertIn("Adopted: January 17, 2025", provisions["sec-30-C-I"]["full_text"])
        self.assertIn("Adopted: April 17, 2026", provisions["sec-30-C-III"]["full_text"])
        # The appendix content must not have been swallowed into (or split)
        # the entries either side of it.
        self.assertNotIn("Appendix", provisions["sec-30-C-I"]["full_text"])
        self.assertNotIn("Appendix", provisions["sec-30-C-III"]["full_text"])

    def test_appendices_get_their_own_rows_with_colon_heading(self):
        provisions, order, _, _ = self._parse()
        self.assertIn("sec-30-C-APPENDIX-A", provisions)
        self.assertIn("sec-30-C-APPENDIX-B", provisions)
        a = provisions["sec-30-C-APPENDIX-A"]
        self.assertEqual(a["citation"], "Appendix A")
        self.assertEqual(a["title"], "Appendix A — Priority Toxic Air Contaminants")
        self.assertEqual(a["parent_id"], "sec-30-top-REG-30")  # always root, not Part C
        b = provisions["sec-30-C-APPENDIX-B"]
        # Wrapped second line of the heading ("Contaminants") must be folded
        # into the title, not duplicated as the row's own first paragraph.
        self.assertEqual(
            b["title"],
            "Appendix B — Chronic Health-Protective Benchmarks for Priority Toxic Air Contaminants",
        )
        self.assertNotIn("<p>Contaminants</p>", b["full_text"])
        self.assertIn("Table Notes:", b["full_text"])
        self.assertIn('doc-table-caption">Priority Toxic Air Contaminants<', a["full_text"])
        self.assertIn(
            'doc-table-caption">Chronic Health-Protective Benchmarks for Priority Toxic Air Contaminants<',
            b["full_text"],
        )
        # Appendix rows are printed in document order, between the SOB
        # entries either side of them.
        i_idx = order.index("sec-30-C-I")
        a_idx = order.index("sec-30-C-APPENDIX-A")
        ii_idx = order.index("sec-30-C-II")
        b_idx = order.index("sec-30-C-APPENDIX-B")
        iii_idx = order.index("sec-30-C-III")
        self.assertTrue(i_idx < a_idx < ii_idx < b_idx < iii_idx)

    def test_other_regs_unaffected_by_colon_appendix_regex(self):
        # A no-op check: no existing regulation's appendix heading contains
        # a colon, so the optional `:?` this reg needed never fires for them.
        m = ic.re.match(r"^(?:Appendix|APPENDIX)\s+([A-Z])\b:?(?:\s+(\S.*))?$",
                         "Appendix A Colorado Ozone Nonattainment or Attainment Maintenance Areas")
        self.assertEqual(m.group(1), "A")
        self.assertEqual(m.group(2), "Colorado Ozone Nonattainment or Attainment Maintenance Areas")


class Reg30TableCaptionExtraTests(unittest.TestCase):
    def test_period_caption_only_for_reg30_and_reg8(self):
        line = "          Table 1. Approved Chemical Fume Suppressants and Surface Tensions"
        self.assertEqual(ic._table_caption_key(line, "30"),
                          "Table 1. Approved Chemical Fume Suppressants and Surface Tensions")
        self.assertIsNone(ic._table_caption_key(line, "26"))
        self.assertIsNone(ic._table_caption_key(line, None))

    def test_bare_digit_captions_still_work_unaided(self):
        # "Table 1" / "Table 2" (Reg 30's engine/turbine CO tables) are
        # already handled by the general TABLE_CAPTION_RE — no reg-specific
        # config needed for them.
        self.assertEqual(ic._table_caption_key("          Table 1", "30"), "Table 1")
        self.assertEqual(ic._table_caption_key("              Table 2", "30"), "Table 2")


class Reg30RegNoAbbreviationTests(unittest.TestCase):
    def test_regulation_no_dot_links_a_corpus_reg(self):
        # Batch 5 put Regulation Number 27 into the corpus; the "not in
        # corpus" half of this test now holds 27 out explicitly (the same
        # text links it when 27 is present — see the next test).
        text = "used in Commission Regulation No. 3, Part B, Section III.B.5.d. and Regulation No. 27, Part B, Section II.A.6."
        html, buckets = ic.link_citations(text, "30", {"sec-30-top-REG-30"}, set(ic.CORPUS_REGS) - {"27"})
        self.assertIn('href="/regulations/3">Regulation No. 3</a>', html)
        self.assertEqual(dict(buckets[ic.BUCKET_OTHER_REG]), {"Regulation No. 27, Part B, Section II.A.6.": 1})
        self.assertEqual(dict(buckets[ic.BUCKET_UNPARSEABLE]), {})

    def test_regulation_no_dot_27_links_once_27_is_in_corpus(self):
        text = "used in Commission Regulation No. 3, Part B, Section III.B.5.d. and Regulation No. 27, Part B, Section II.A.6."
        html, buckets = ic.link_citations(text, "30", {"sec-30-top-REG-30"}, set(ic.CORPUS_REGS))
        self.assertIn('href="/regulations/27">Regulation No. 27</a>', html)
        self.assertEqual(dict(buckets[ic.BUCKET_OTHER_REG]), {})

    def test_regulation_number_keyword_form_unaffected(self):
        html, buckets = ic.link_citations(
            "as required by Regulation Number 26.", "30", {"sec-30-top-REG-30"}, set(ic.CORPUS_REGS)
        )
        self.assertIn('href="/regulations/26">Regulation Number 26</a>', html)
        self.assertEqual(dict(buckets[ic.BUCKET_OTHER_REG]), {})


class Reg30UncaptionedAppendixTableTests(unittest.TestCase):
    def test_to_end_flag_consumes_the_whole_block_past_internal_blanks(self):
        # Reg 8's UNCAPTIONED_TABLES entries have no blank line inside their
        # flattened dump, so the default "run to the next blank line" cut is
        # correct for them; Reg 30's Appendix A/B dumps DO have blank lines
        # inside (a wrapped cell followed by pdftotext's usual paragraph
        # gap), so `to_end: True` must run the replacement to the end of
        # `own_lines` instead of stopping at the first one.
        own_lines = [
            "CAS Number               Toxic Air Contaminant                       Date Identified",
            "",
            "71432                    Benzene                                     1/17/2025",
            "",
            "18540299                 Chromium Compounds, Hexavalent              1/17/2025",
        ]
        tables_by_caption = {"Priority Toxic Air Contaminants": {"caption": "x", "rows": [["a", "b"]]}}
        hits = {"used": 0, "captions_used": []}
        out = ic._swap_uncaptioned_table(own_lines, "sec-30-C-APPENDIX-A", "30", tables_by_caption, hits)
        self.assertEqual(out, ["", ic._TABLE_SENTINEL + "Priority Toxic Air Contaminants", ""])
        self.assertEqual(hits["used"], 1)

    def test_no_op_for_a_row_with_no_matching_entry(self):
        own_lines = ["Some unrelated paragraph.", ""]
        hits = {"used": 0, "captions_used": []}
        out = ic._swap_uncaptioned_table(own_lines, "sec-30-B-III-B-1", "30", {}, hits)
        self.assertEqual(out, own_lines)
        self.assertEqual(hits["used"], 0)


class Reg30SobPartAppendixClosingTests(unittest.TestCase):
    """The generic appendix-closing fix (scan_markers): an appendix printed
    inside the SAME part as a PART-scoped statement of basis (Reg 30's Part
    C) must be closed by the next top-level SOB entry, not swallow it — the
    same behavior Reg 1 already has for its SECTION-scoped statement of
    basis, extended to cover the part-scoped shape too."""

    def test_appendix_between_two_sob_entries_does_not_swallow_the_second(self):
        lines = [
            "PART C        Statements of Basis, Specific Statutory Authority and Purpose",
            "",
            "I.      Adopted: January 17, 2025",
            "",
            "Appendix A: Priority Toxic Air Contaminants",
            "",
            "71432                    Benzene                                     1/17/2025",
            "",
            "II.     Adopted: September 19, 2025",
            "",
            "Basis text for the second entry.",
            "",
        ]
        markers, _ = ic.scan_markers(lines, set(), "30")
        provisions, order, _, _ = ic.build_provisions("30", lines, markers, {})
        self.assertIn("sec-30-C-II", provisions)
        self.assertIn("Basis text for the second entry.", provisions["sec-30-C-II"]["full_text"])
        self.assertNotIn("Basis text for the second entry.", provisions["sec-30-C-APPENDIX-A"]["full_text"])
        self.assertNotIn("Adopted: September 19, 2025", provisions["sec-30-C-APPENDIX-A"]["full_text"])


class Reg30FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(REG30_TXT):
            raise unittest.SkipTest("sources/REG_30.txt not present in this checkout")
        pdf = REG30_PDF if os.path.exists(REG30_PDF) else None
        (cls.rows, cls.unresolved, _th, _nt, cls.dupes, cls.fixes, _an, _audit) = ic.parse_reg(
            "30", REG30_TXT, pdf
        )
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_no_duplicate_ids(self):
        self.assertEqual(self.dupes, [])

    def test_label_fixes_all_hit_once(self):
        self.assertTrue(all(f["hits"] == 1 for f in self.fixes), self.fixes)

    def test_parts_and_appendices_present(self):
        for pid in ("sec-30-top-REG-30", "sec-30-P-A", "sec-30-P-B", "sec-30-P-C",
                    "sec-30-A-I", "sec-30-B-I", "sec-30-B-II", "sec-30-B-III",
                    "sec-30-C-I", "sec-30-C-II", "sec-30-C-III",
                    "sec-30-C-APPENDIX-A", "sec-30-C-APPENDIX-B",
                    "sec-30-B-III-D-1-g-(iv)"):
            self.assertIn(pid, self.by_id, pid)

    def test_every_parent_resolves(self):
        for r in self.rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], self.by_id, r["id"])

    def test_no_page_furniture_leaks(self):
        for r in self.rows:
            self.assertNotRegex(r["full_text"], r"CODE OF COLORADO REGULATIONS")

    def test_appendix_tables_rendered(self):
        a_text = self.by_id["sec-30-C-APPENDIX-A"]["full_text"]
        b_text = self.by_id["sec-30-C-APPENDIX-B"]["full_text"]
        for text in (a_text, b_text):
            self.assertIn("doc-table-wrap", text)
        self.assertIn("Benzene", a_text)
        self.assertIn("0.13", b_text)  # Benzene's cancer chronic health-protective benchmark


# ---------------------------------------------------------------------------
# GP01-GP12 — the eleven APCD General Construction Permits. Same shape as
# Reg 1/cp (`no_parts`, full compound-path labels), plus three gated
# additions: GP12's missing-trailing-dot labels (also needed sporadically by
# GP01/02/06/07/08/11 — see FAMILY_REGEX_NO_TRAILING_DOT), GP12/GP02's
# Attachment A/B all-digit-ladder items, and the corpus-wide "GPnn mention"
# resolver plus the "Condition(s)" xref keyword (gp-only).
# ---------------------------------------------------------------------------

GP_SOURCES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources")


def _gp_paths(key):
    base = key.upper()
    return (
        os.path.join(GP_SOURCES_DIR, f"{base}.txt"),
        os.path.join(GP_SOURCES_DIR, f"{base}.pdf"),
    )


class GeneralPermitMetaTests(unittest.TestCase):
    def test_all_eleven_keys_in_corpus_and_meta(self):
        self.assertEqual(set(ic.GP_KEYS), {
            "gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08",
            "gp09", "gp10", "gp11", "gp12",
        })
        self.assertNotIn("gp04", ic.GP_KEYS)
        for k in ic.GP_KEYS:
            self.assertEqual(ic.CORPUS_REGS.get(k), k)
            meta = ic.REG_META.get(k)
            self.assertIsNotNone(meta, k)
            self.assertTrue(meta.get("no_parts"), k)
            self.assertTrue(meta.get("page_of_total_footer"), k)
            self.assertTrue(meta.get("toc_has_page_leaders"), k)
            self.assertTrue(meta.get("labels_without_trailing_dot"), k)
            self.assertEqual(meta["jurisdiction_level"], "state")
            self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
            self.assertEqual(meta["root_citation"], f"APCD General Permit {k.upper()}")
            self.assertIn(k.upper(), meta["root_title"])

    def test_gp12_attachments_config(self):
        self.assertEqual(ic.REG_META["gp12"]["attachments"], ("A", "B"))

    def test_gp02_attachments_config(self):
        self.assertEqual(ic.REG_META["gp02"]["attachments"], ("A",))

    def test_attachments_is_a_noop_for_non_gp_regs(self):
        for reg in ("1", "2", "3", "7", "22", "26", "cp", "9"):
            self.assertFalse(ic.REG_META.get(reg, {}).get("attachments"), reg)
            self.assertFalse(ic.REG_META.get(reg, {}).get("labels_without_trailing_dot"), reg)


class Gp12LabelsWithoutTrailingDotTests(unittest.TestCase):
    """Unit coverage for FAMILY_REGEX_NO_TRAILING_DOT / family_regex_for,
    independent of the real GP12 source file."""

    def test_missing_trailing_dot_tokenizes_fully(self):
        cycle = ic.cycle_ab_for("gp12")
        fam = ic.family_regex_for("gp12")
        tokens, consumed = ic.tokenize_by_cycle("I.A.3.a   Some condition text", cycle, fam)
        self.assertEqual(tokens, [("roman", "I"), ("upper", "A"), ("digit", "3"), ("lower", "a")])
        self.assertEqual("I.A.3.a"[0:consumed], "I.A.3.a")

    def test_deep_compact_paren_without_trailing_dot(self):
        cycle = ic.cycle_ab_for("gp12")
        fam = ic.family_regex_for("gp12")
        tokens, consumed = ic.tokenize_by_cycle("I.A.8.a.(i)   Releasing emissions", cycle, fam)
        self.assertEqual(
            tokens,
            [("roman", "I"), ("upper", "A"), ("digit", "8"), ("lower", "a"), ("paren_roman", "i")],
        )

    def test_dotted_label_still_parses_identically(self):
        # A fully-dotted label (the top-level section shape GP12 itself
        # still uses, and every ordinary regulation's shape) is unaffected:
        # the literal dot is always preferred over the lookahead.
        fam = ic.family_regex_for("gp12")
        tokens, consumed = ic.tokenize_by_cycle("II.A.6.  Some text", ic.cycle_ab_for("gp12"), fam)
        self.assertEqual(tokens, [("roman", "II"), ("upper", "A"), ("digit", "6")])

    def test_family_regex_for_is_a_noop_for_other_regs(self):
        self.assertIs(ic.family_regex_for("7"), ic.FAMILY_REGEX)
        self.assertIs(ic.family_regex_for("cp"), ic.FAMILY_REGEX)
        self.assertIs(ic.family_regex_for(None), ic.FAMILY_REGEX)
        self.assertIs(ic.family_regex_for("gp12"), ic.FAMILY_REGEX_NO_TRAILING_DOT)


class ConditionKeywordTests(unittest.TestCase):
    def test_condition_keyword_only_gated_for_gp(self):
        self.assertIs(ic._bare_section_re("gp01"), ic.SECTION_OR_CONDITION_RE)
        self.assertIs(ic._bare_section_re("7"), ic.SECTION_RE)
        self.assertIs(ic._bare_section_re(None), ic.SECTION_RE)

    def test_condition_citation_links_for_a_gp_reg(self):
        known_ids = {"sec-gp01-top-REG-gp01", "sec-gp01-II-A-6"}
        html, buckets = ic.link_citations(
            "Failure to comply with Condition II.A.6. is a violation.",
            "gp01", known_ids, ic.CORPUS_REGS, own_part=ic.NO_PART,
        )
        self.assertIn('<span class="xref" data-target="sec-gp01-II-A-6">Condition II.A.6.</span>', html)

    def test_condition_keyword_does_not_link_for_a_non_gp_reg(self):
        # "Condition" is plain English prose for every non-GP regulation —
        # confirming the keyword really is gated, not just usually unused.
        known_ids = {"sec-7-top-REG-7", "sec-7-B-II-A-6"}
        html, buckets = ic.link_citations(
            "Condition II.A.6. of the permit does not apply here.",
            "7", known_ids, ic.CORPUS_REGS, own_part="B",
        )
        self.assertNotIn("xref", html)

    def test_condition_dangling_words_gated(self):
        self.assertEqual(ic._condition_dangling_words("gp01"), ("Condition",))
        self.assertEqual(ic._condition_dangling_words("7"), ())


class GpMentionResolverTests(unittest.TestCase):
    def test_self_mention_links_to_own_root(self):
        known_ids = {"sec-gp01-top-REG-gp01"}
        html, buckets = ic.link_citations(
            "This general permit is not registered to GP01 prior to the effective date.",
            "gp01", known_ids, set(ic.CORPUS_REGS),
        )
        self.assertIn('<span class="xref" data-target="sec-gp01-top-REG-gp01">GP01</span>', html)

    def test_cross_mention_links_when_target_in_corpus(self):
        html, buckets = ic.link_citations(
            "This engine is registered under GP02 and subject to that permit.",
            "gp01", set(), set(ic.CORPUS_REGS),
        )
        self.assertIn('<a class="xref-external-reg" href="/regulations/gp02">GP02</a>', html)

    def test_hyphenated_and_general_permit_phrase_forms(self):
        html, buckets = ic.link_citations(
            "See General Permit GP02 and GP-07 for details.",
            "gp01", set(), set(ic.CORPUS_REGS),
        )
        self.assertIn('href="/regulations/gp02">GP02</a>', html)
        self.assertIn('href="/regulations/gp07">GP-07</a>', html)

    def test_mention_of_reg_not_yet_in_corpus_is_bucketed_not_linked(self):
        html, buckets = ic.link_citations(
            "See GP03 for land development projects.",
            "gp01", set(), set(),  # empty corpus_regs: nothing is "in the corpus" yet
        )
        self.assertNotIn("xref", html)
        self.assertEqual(buckets[ic.BUCKET_OTHER_REG]["GP03"], 1)

    def test_gp_mention_regex_is_a_noop_for_a_reg_with_no_gp_text(self):
        # Reg 1/26/cp never mention "GPnn" at all (see REPORT.md's no-op
        # proof) — this just documents the regex itself finds nothing to
        # claim in ordinary prose that merely contains "GP" as letters.
        self.assertIsNone(ic.GP_MENTION_RE.search("The GP is not a citation marker by itself."))
        self.assertIsNone(ic.GP_MENTION_RE.search("GP13 is out of range."))
        self.assertIsNone(ic.GP_MENTION_RE.search("GP00 is out of range."))


class AttachmentDigitLadderTests(unittest.TestCase):
    """Unit coverage for the GP12/GP02 Attachment A/B all-digit ladder,
    independent of the real source files."""

    def test_attachment_digit_cycle_nests_arbitrarily_deep(self):
        tokens, consumed = ic.tokenize_by_cycle("7.7.2.1.   Some sentence", ic.ATTACHMENT_DIGIT_CYCLE)
        self.assertEqual(tokens, [("digit", "7"), ("digit", "7"), ("digit", "2"), ("digit", "1")])

    def test_attachment_heading_regex(self):
        m = ic.re.match(r"^\s*Attachment\s+([A-Z])\s*:\s*(\S.*)$", "   Attachment A: Alternative Operating Scenarios")
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "A")


class GeneralPermitFullParseTests(unittest.TestCase):
    """One full parse per permit against the real source files (skipped
    when a source isn't present in this checkout) — Gate A (structure vs
    the printed Table of Contents), Gate E (0 duplicate ids, 0 orphans,
    every label sequence contiguous)."""

    EXPECTED_TOP_SECTIONS = {
        "gp01": 9, "gp02": 11, "gp03": 4, "gp05": 9, "gp06": 10,
        "gp07": 8, "gp08": 9, "gp09": 9, "gp10": 9, "gp11": 8, "gp12": 12,
    }
    EXPECTED_ROW_COUNT = {
        "gp01": 103, "gp02": 210, "gp03": 59, "gp05": 111, "gp06": 174,
        "gp07": 124, "gp08": 119, "gp09": 251, "gp10": 254, "gp11": 129, "gp12": 540,
    }

    _CACHE: dict = {}

    def _parse(self, key):
        # Cached across test methods in this class (and pdf=None — no
        # pdfplumber table extraction) since several methods each re-check
        # every one of the eleven permits; the table-recovery path itself
        # is covered separately by the CLI runs in out/gpNN_parsed.json.
        if key not in self._CACHE:
            txt, _pdf = _gp_paths(key)
            if not os.path.exists(txt):
                self.skipTest(f"sources/{key.upper()}.txt not present in this checkout")
            GeneralPermitFullParseTests._CACHE[key] = ic.parse_reg(key, txt, None)
        return self._CACHE[key]

    def test_every_permit_structure_and_row_count(self):
        for key, n_sections in self.EXPECTED_TOP_SECTIONS.items():
            with self.subTest(key=key):
                rows, unresolved, table_hits, n_tables, dupes, fixes, anomalies, audit = self._parse(key)
                self.assertEqual(dupes, [], key)
                self.assertEqual(len(rows), self.EXPECTED_ROW_COUNT[key], key)
                ids = [r["id"] for r in rows]
                self.assertEqual(len(ids), len(set(ids)), key)
                id_set = set(ids)
                for r in rows:
                    if r["parent_id"] is not None:
                        self.assertIn(r["parent_id"], id_set, (key, r["id"]))
                top_sections = [
                    r for r in rows
                    if r["kind"] == "section" and "ATTACHMENT" not in r["id"]
                ]
                self.assertEqual(len(top_sections), n_sections, key)
                expected_citations = [f"{ic.int_to_roman(i)}." for i in range(1, n_sections + 1)]
                self.assertEqual([r["citation"] for r in top_sections], expected_citations, key)
                root = next(r for r in rows if r["kind"] == "root")
                self.assertEqual(root["id"], f"sec-{key}-top-REG-{key}")
                self.assertEqual(root["citation"], f"APCD General Permit {key.upper()}")

    def test_no_page_furniture_leaks(self):
        for key in self.EXPECTED_TOP_SECTIONS:
            with self.subTest(key=key):
                rows, *_ = self._parse(key)
                for r in rows:
                    self.assertNotRegex(r["full_text"], r"Page \d+ of \d+", (key, r["id"]))

    def test_no_repeated_paragraph_prefix_within_a_row(self):
        import re as _re
        from collections import Counter as _Counter
        for key in self.EXPECTED_TOP_SECTIONS:
            with self.subTest(key=key):
                rows, *_ = self._parse(key)
                for r in rows:
                    paras = _re.findall(r"<p>(.*?)</p>", r["full_text"], _re.S)
                    counts = _Counter(p[:50] for p in paras)
                    for prefix, n in counts.items():
                        self.assertLess(n, 3, f"{key}/{r['id']!r} repeats {prefix!r} {n}x")

    def test_no_giant_fused_rows(self):
        for key in self.EXPECTED_TOP_SECTIONS:
            with self.subTest(key=key):
                rows, *_ = self._parse(key)
                longest = max(len(r["full_text"]) for r in rows)
                self.assertLess(longest, 15000, key)

    def test_gp12_attachments_present_as_children(self):
        rows, *_ = self._parse("gp12")
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(by_id["sec-gp12-ATTACHMENT-A"]["kind"], "appendix")
        self.assertEqual(by_id["sec-gp12-ATTACHMENT-A"]["parent_id"], "sec-gp12-top-REG-gp12")
        self.assertEqual(by_id["sec-gp12-ATTACHMENT-A-1"]["parent_id"], "sec-gp12-ATTACHMENT-A")
        self.assertEqual(by_id["sec-gp12-ATTACHMENT-A-3-1"]["parent_id"], "sec-gp12-ATTACHMENT-A-3")
        self.assertIn("sec-gp12-ATTACHMENT-B", by_id)

    def test_gp02_attachment_present_as_children(self):
        rows, *_ = self._parse("gp02")
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(by_id["sec-gp02-ATTACHMENT-A"]["kind"], "appendix")
        self.assertIn("sec-gp02-ATTACHMENT-A-1", by_id)

    def test_gp12_no_trailing_dot_labels_parse_to_ordinary_ids(self):
        rows, *_ = self._parse("gp12")
        by_id = {r["id"]: r for r in rows}
        for suffix in ("I-A", "I-A-3", "I-A-3-a", "I-A-8-a", "I-A-8-a-(i)"):
            self.assertIn(f"sec-gp12-{suffix}", by_id, suffix)

    def test_gp_mention_self_links_appear_in_real_text(self):
        rows, *_ = self._parse("gp01")
        by_id = {r["id"]: r for r in rows}
        any_link = any('data-target="sec-gp01-top-REG-gp01"' in r["full_text"] for r in rows)
        self.assertTrue(any_link)


class GeneralPermitNoOpProofTests(unittest.TestCase):
    """The no-op proof GP_BRIEF.md requires: Reg 1/26/cp parse
    byte-identically to the PRE-batch-gp baselines (produced by the
    ORIGINAL importer), both with the eleven gp keys present in
    CORPUS_REGS and absent from it — trivially satisfied here since none
    of REG_1.txt/REG_26.txt/REG_CP.txt ever mentions "GPnn" (confirmed by
    grep), so the corpus-wide GP-mention resolver never produces a new
    link for them and every other GP addition is reg-gated to the eleven
    gp keys. Skips (rather than fails) when the baseline fixtures aren't
    present in this checkout."""

    OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

    def _check(self, reg, baseline_name, txt_name, pdf_name):
        import json as _json
        txt = os.path.join(GP_SOURCES_DIR, txt_name)
        pdf = os.path.join(GP_SOURCES_DIR, pdf_name)
        baseline = os.path.join(self.OUT_DIR, baseline_name)
        if not (os.path.exists(txt) and os.path.exists(baseline)):
            self.skipTest(f"{txt_name} or {baseline_name} not present in this checkout")
        with open(baseline, encoding="utf-8") as fh:
            base = fh.read()

        saved_corpus = dict(ic.CORPUS_REGS)
        try:
            result = ic.parse_reg(reg, txt, pdf if os.path.exists(pdf) else None)
            out_present = __import__("json").dumps(result[0], ensure_ascii=False, indent=1)
            ic.CORPUS_REGS = {k: v for k, v in saved_corpus.items() if k not in ic.GP_KEYS}
            result_absent = ic.parse_reg(reg, txt, pdf if os.path.exists(pdf) else None)
            out_absent = _json.dumps(result_absent[0], ensure_ascii=False, indent=1)
        finally:
            ic.CORPUS_REGS = saved_corpus
        self.assertEqual(out_present, base, f"{reg}: not byte-identical with gp keys PRESENT")
        self.assertEqual(out_absent, base, f"{reg}: not byte-identical with gp keys ABSENT")

    def test_reg1_noop(self):
        self._check("1", "reg1_prebatch_gp.json", "REG_1.txt", "REG_1.pdf")

    def test_reg26_noop(self):
        self._check("26", "reg26_prebatch_gp.json", "REG_26.txt", "REG_26.pdf")

    def test_cp_noop(self):
        self._check("cp", "regcp_prebatch_gp.json", "REG_CP.txt", "REG_CP.pdf")


if __name__ == "__main__":
    unittest.main()


# ---------------------------------------------------------------------------
# Markup-only `changed` rows keep their review state (added after batch 4:
# re-importing an existing reg once new regs join the corpus only adds xref
# markup, and that must not throw reviewed/corrected summaries back to
# `pending`).
# ---------------------------------------------------------------------------
class MarkupOnlyChangedKeepsReviewStateTests(unittest.TestCase):
    def _classify(self):
        parsed = [
            _prow(PART_A, ROOT, 10, "Part A"),
            _prow(f"sec-{REG}-A-I", PART_A, 20,
                  '<p>See <span class="xref" data-target="sec-7-B-I">Section I.</span> of Part B.</p>'),  # markup-only
            _prow(f"sec-{REG}-A-II", PART_A, 30, "<p>NEW visible text</p>"),  # real change
        ]
        db = [
            _prow(PART_A, ROOT, 10, "Part A"),
            _prow(f"sec-{REG}-A-I", PART_A, 20, "<p>See Section I. of Part B.</p>"),
            _prow(f"sec-{REG}-A-II", PART_A, 30, "<p>OLD text</p>"),
        ]
        return ic.classify_apply(parsed, db)

    def test_classification_marks_markup_only(self):
        c = self._classify()
        self.assertEqual(c["changed"], [f"sec-{REG}-A-I", f"sec-{REG}-A-II"])
        self.assertTrue(c["markup_only"][f"sec-{REG}-A-I"])
        self.assertFalse(c["markup_only"][f"sec-{REG}-A-II"])

    def test_execute_plan_markup_only_replaces_text_but_keeps_review_columns(self):
        c = self._classify()
        actions = ic._execute_write_plan(c, today="2026-09-19", now_iso=NOW_ISO)
        by_id = {a["id"]: a for a in actions if a["op"] == "update"}
        mo = by_id[f"sec-{REG}-A-I"]["payload"]
        real = by_id[f"sec-{REG}-A-II"]["payload"]
        self.assertIn("full_text", mo)
        self.assertIn('data-target="sec-7-B-I"', mo["full_text"])
        for col in ("summary_status", "reviewed_by", "reviewed_at", "summary_original", "ai_summary"):
            self.assertNotIn(col, mo, f"markup-only update must not touch {col}")
        self.assertEqual(real["summary_status"], "pending")
        self.assertIsNone(real["reviewed_by"])
        self.assertIsNone(real["summary_original"])
        self.assertNotIn("ai_summary", real)

    def test_execute_changed_fields_default_still_resets(self):
        row = _prow(f"sec-{REG}-A-II", PART_A, 30, "<p>x</p>")
        self.assertEqual(ic._execute_changed_fields(row, NOW_ISO)["summary_status"], "pending")
        self.assertNotIn("summary_status", ic._execute_changed_fields(row, NOW_ISO, markup_only=True))

    def test_sql_path_markup_chunk_has_its_own_set_clause(self):
        c = self._classify()
        rows = []
        for pid in c["changed"]:
            row = c["parsed_by_id"][pid]
            rows.append(dict(
                id=pid, sort_order=row["sort_order"],
                touch_full_text="markup" if c["markup_only"][pid] else True,
                values_sql=ic._row_values_sql(row, "state", "CDPHE-APCD", ic.SOURCE_URL_DEFAULT, "2026-09-19", False, "pending"),
            ))
        rows.sort(key=lambda r: (r["sort_order"], r["id"]))
        chunks = ic.chunk_upsert_rows(rows, 150_000)
        self.assertEqual([t for t, _ in chunks], ["markup", True])
        markup_stmt = ic.build_upsert_statement(chunks[0][1])
        full_stmt = ic.build_upsert_statement(chunks[1][1])
        self.assertIn("full_text = EXCLUDED.full_text", markup_stmt)
        self.assertNotIn("summary_status = 'pending'", markup_stmt)
        self.assertNotIn("reviewed_by = NULL", markup_stmt)
        self.assertIn("summary_status = 'pending'", full_stmt)
        self.assertIn("reviewed_by = NULL", full_stmt)


    def test_link_inserted_flush_against_punctuation_is_markup_only(self):
        # Reg 6 IX.C on the batch-4 re-import: the new Common Provisions link
        # sits flush against the following period. Stripping tags to a space
        # produced "Regulation ." != "Regulation." and a false visible change.
        parsed = [_prow(f"sec-{REG}-A-I", PART_A, 20,
                        '<p>consistent with the <a class="xref-external-reg" href="/regulations/cp">Common Provisions Regulation</a>. The Division</p>')]
        db = [_prow(f"sec-{REG}-A-I", PART_A, 20, "<p>consistent with the Common Provisions Regulation. The Division</p>")]
        c = ic.classify_apply(parsed, db)
        self.assertEqual(c["changed"], [f"sec-{REG}-A-I"])
        self.assertTrue(c["markup_only"][f"sec-{REG}-A-I"])


class BatchCPhmsaTouchpointTests(unittest.TestCase):
    """49 CFR Parts 190/193/196 (Batch C) reach the CCR importer through the
    same four config surfaces Parts 191/192 (Batch A) and 194/195/199
    (Batch B) did. No Colorado source cites any of the three (grepped
    sources/*.txt: zero hits for 49 CFR 190/193/196), so the merge-and-prove
    for ECMC / Reg 26 / Reg 30 / Reg 7 is byte-identical -- see
    REPORT_batchC.md."""

    KEYS = ("p190", "p193", "p196")

    def test_corpus_and_ecfr_dispatch_sets(self):
        for k in self.KEYS:
            self.assertEqual(ic.CORPUS_REGS[k], k)
            self.assertIn(k, ic.ECFR_REGS)
        self.assertNotIn("p198", ic.CORPUS_REGS)
        self.assertNotIn(("49", "198"), ic.CFR_TITLE_PART_TO_REGKEY)

    def test_reg_meta_is_federal_phmsa(self):
        expected = {
            "p190": ("190", "49 CFR Part 190",
                     "49 CFR Part 190 \u2014 Pipeline Safety Enforcement and Regulatory Procedures"),
            "p193": ("193", "49 CFR Part 193",
                     "49 CFR Part 193 \u2014 Liquefied Natural Gas Facilities: Federal Safety Standards"),
            "p196": ("196", "49 CFR Part 196",
                     "49 CFR Part 196 \u2014 Protection of Underground Pipelines From Excavation Activity"),
        }
        for k, (part, cite, title) in expected.items():
            meta = ic.REG_META[k]
            self.assertEqual(meta["jurisdiction_level"], "federal", k)
            self.assertEqual(meta["issuing_body"], "PHMSA", k)
            self.assertEqual(meta["source_url"],
                             f"https://www.ecfr.gov/current/title-49/part-{part}", k)
            self.assertEqual(meta["root_citation"], cite, k)
            self.assertEqual(meta["root_title"], title, k)

    def test_reg_meta_matches_the_ecfr_importer(self):
        import import_ecfr as ie
        for k in self.KEYS:
            self.assertEqual(ic.REG_META[k]["root_title"], ie.SUBPART_META[k]["root_title"], k)
            self.assertEqual(ic.REG_META[k]["root_citation"], ie.SUBPART_META[k]["root_citation"], k)
            self.assertEqual(ic.REG_META[k]["source_url"], ie.SUBPART_META[k]["url"], k)

    def test_49_cfr_190_193_196_link_through_both_linkers(self):
        corpus = set(ic.CORPUS_REGS)
        for text, reg, deep in (
            ("49 CFR Part 190", "p190", None),
            ("49 CFR 190.223", "p190", "sec-p190-190.223"),
            ("49 C.F.R. \u00a7 190.223(a)", "p190", "sec-p190-190.223"),
            ("49 C.F.R. \u00a7 190 Subpart B", "p190", "sec-p190-PART-B"),
            ("49 CFR Part 193", "p193", None),
            ("49 C.F.R. \u00a7 193.2007", "p193", "sec-p193-193.2007"),
            ("49 CFR part 196", "p196", None),
            ("49 C.F.R. \u00a7 196.103", "p196", "sec-p196-196.103"),
        ):
            html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, corpus)
            self.assertIn(f'href="/regulations/{reg}"', html, text)
            if deep:
                self.assertIn(f'data-provision-id="{deep}"', html, text)
            self.assertEqual(sum(buckets[ic.BUCKET_CFR].values()), 0, text)
            html2, buckets2 = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, corpus, {})
            self.assertIn(f'href="/regulations/{reg}"', html2, text)
            self.assertEqual(sum(buckets2[ic.BUCKET_CFR].values()), 0, text)

    def test_part_198_stays_bucketed(self):
        corpus = set(ic.CORPUS_REGS)
        for text in ("49 CFR Part 198", "49 C.F.R. \u00a7 198.37", "49 CFR part 198, subpart D"):
            html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, corpus)
            self.assertNotIn("xref-external-reg", html, text)
            self.assertGreaterEqual(sum(buckets[ic.BUCKET_CFR].values()), 1, text)

    def test_the_new_keys_are_a_no_op_while_out_of_corpus(self):
        corpus = set(ic.CORPUS_REGS) - set(self.KEYS)
        for text in ("49 CFR Part 190", "49 C.F.R. \u00a7 193.2007",
                     "49 C.F.R. \u00a7 190 Subpart B", "49 CFR Part 196"):
            html, buckets = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, corpus)
            self.assertNotIn("xref-external-reg", html, text)
            self.assertGreaterEqual(sum(buckets[ic.BUCKET_CFR].values()), 1, text)

    def test_40_cfr_and_batch_ab_citations_are_unaffected_by_the_new_keys(self):
        with_new = set(ic.CORPUS_REGS)
        without_new = with_new - set(self.KEYS)
        text = ("See 40 CFR Part 60, Subpart OOOOb, 40 CFR Part 63, Subpart ZZZZ, "
                "49 C.F.R. \u00a7\u00a7 195.2 or 192.8 and 49 C.F.R. \u00a7 195 Subpart A.")
        a, ba = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, with_new)
        b, bb = ic.link_citations(text, "ecmc", {"sec-ecmc-top-REG-ecmc"}, without_new)
        self.assertEqual(a, b)
        self.assertEqual(ba, bb)
        a2, _ = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, with_new, {})
        b2, _ = ic.link_citations_ecmc(text, {"sec-ecmc-top-REG-ecmc"}, without_new, {})
        self.assertEqual(a2, b2)

    def test_parse_dispatch_requires_xml_not_pdf_for_the_new_keys(self):
        """cmd_parse hands p190/p193/p196 to import_ecfr (which needs an XML
        path); the CCR path's "--pdf is required" guard must not fire."""
        class _A:
            reg, pdf, txt, xml, out = "p196", None, None, None, None
        with self.assertRaises(SystemExit) as cm:
            ic.cmd_parse(_A())
        self.assertIn("whole-part document", str(cm.exception))


class DuplicateMarkerKeepsBothParagraphsTests(unittest.TestCase):
    """Reg 7 prints "VI.D.3.a.(iii)" twice for two different paragraphs.
    build_provisions used to let the second marker's row overwrite the
    first's, and parse_ccr's de-dup pass then appended the survivor to
    itself — the first paragraph was lost and the row read "X. X."."""

    @unittest.skipUnless(os.path.exists("sources/REG_7.txt") and os.path.exists("sources/REG_7.pdf"), "REG_7 sources not present")
    def test_reg7_vi_d_3_a_iii_carries_both_printed_paragraphs(self):
        import subprocess, tempfile
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "reg7.json")
            subprocess.run([sys.executable, "import_ccr.py", "parse", "--reg", "7", "--pdf", "sources/REG_7.pdf",
                            "--txt", "sources/REG_7.txt", "--out", out], check=True, capture_output=True)
            data = json.load(open(out, encoding="utf-8"))
            rows = data["provisions"] if isinstance(data, dict) else data
        row = next(r for r in rows if r["id"] == "sec-7-B-VI-D-3-a-(iii)")
        text = re.sub(r"<[^>]+>", " ", row["full_text"])
        self.assertIn("permanently disconnected, if applicable", text)
        self.assertEqual(text.count("date and duration of any period"), 1)
        self.assertLess(text.index("permanently disconnected"), text.index("date and duration"))


# ---------------------------------------------------------------------------
# Reg 11 — Motor Vehicle Emissions Inspection Program (5 CCR 1001-13).
# Standard Part A-H shape (Part H a roman_seq statement of basis with a
# topic opener, not a date), plus four shapes new to the corpus: Part A's
# Section II definitions numbered BARE ("1." .. "61.", no "II." prefix —
# BARE_DIGIT_CHILD_SECTIONS); Part F's whitespace-aligned, ruling-free
# emissions-limit tables (LAYOUT_TEXT_TABLES); a 2,100-line Appendix A that
# is itself an outlined technical document with decimal sections, lettered
# items, six ATTACHMENTs and unlabeled headings (APPENDIX_LADDERS); and a
# six-line PART heading (REG_META part_heading_max_lines).
# ---------------------------------------------------------------------------

REG11_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_11.txt")
REG11_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_11.pdf")


class Reg11MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["11"], "11")
        meta = ic.REG_META["11"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["source_url"], "https://cdphe.colorado.gov/aqcc-regulations")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 11")
        self.assertEqual(meta["root_title"], "MOTOR VEHICLE EMISSIONS INSPECTION PROGRAM 5 CCR 1001-13")
        self.assertNotIn("no_parts", meta)
        self.assertTrue(meta["part_intro_text"])
        self.assertEqual(meta["part_heading_max_lines"], 6)

    def test_sob_part_config_topic_opener(self):
        cfg = ic.SOB_PART_CONFIG["11"]
        self.assertEqual((cfg["letter"], cfg["top_family"]), ("H", "roman_seq"))
        self.assertIsNotNone(cfg["top_opener_re"].match("AMENDMENTS TO PART A - E"))
        self.assertIsNotNone(cfg["top_opener_re"].match("AMENDMENTS"))
        self.assertIsNotNone(cfg["top_opener_re"].match("REVISIONS TO PART C (VIII) AND PART F (III)"))
        self.assertIsNone(cfg["top_opener_re"].match("Adopted: January 17, 2025"))
        self.assertIsNone(cfg["top_opener_re"].match("The Commission concluded"))
        self.assertNotIn("inner_items", cfg)  # Part H's only inner list (entry II, 1.-10.) never restarts

    def test_new_config_dicts_are_reg_11_scoped(self):
        self.assertEqual(set(ic.APPENDIX_LADDERS), {"11"})
        self.assertEqual(ic.APPENDIX_LADDERS["11"], frozenset({"A"}))
        self.assertEqual(set(ic.BARE_DIGIT_CHILD_SECTIONS), {"11"})
        self.assertEqual(ic.BARE_DIGIT_CHILD_SECTIONS["11"], {("A", "II"): "definition"})
        self.assertEqual(set(ic.LAYOUT_TEXT_TABLES), {"11"})
        self.assertEqual([e["row_id"] for e in ic.LAYOUT_TEXT_TABLES["11"]],
                         ["sec-11-F-I-A", "sec-11-F-II-A", "sec-11-F-II-A", "sec-11-F-III-C", "sec-11-F-III-D",
                          "sec-11-H-APPENDIX-A-2.11-F"])
        self.assertIn("11", ic.APPENDIX_HEADING_DEDUP_REGS)
        for reg in ("1", "2", "3", "7", "9", "26", "30", "cp"):
            self.assertNotIn(reg, ic.APPENDIX_LADDERS)
            self.assertNotIn(reg, ic.BARE_DIGIT_CHILD_SECTIONS)
            self.assertNotIn(reg, ic.LAYOUT_TEXT_TABLES)
            self.assertEqual(ic.REG_META.get(reg, {}).get("part_heading_max_lines", 3), 3)


class Reg11LabelFixTests(unittest.TestCase):
    PART_H = [
        "XII.   AMENDMENTS",
        "",
        "ADOPTED DECEMBER 19, 2002",
        "",
        "Basis and Purpose",
        "",
        "XII.   AMENDMENTS",
        "",
        "ADOPTED SEPTEMBER 18, 2003",
        "",
        "Basis and Purpose",
        "",
        "XIII.   AMENDMENTS",
        "",
        "ADOPTED DECEMBER 18, 2003",
        "",
        "The purpose of this revision is to postpone the change in emissions standards",
        "",
        "XV.     AMENDMENTS",
        "",
        "ADOPTED DECEMBER 18, 2003",
    ]

    def test_next_line_prefix_picks_the_right_identical_label_line(self):
        out, applied = ic.apply_known_label_fixes("11", list(self.PART_H))
        self.assertEqual(out[0], "XII.   AMENDMENTS")     # the real XII is untouched
        self.assertEqual(out[6], "XIII.   AMENDMENTS")    # second XII -> XIII
        self.assertEqual(out[12], "XIV.   AMENDMENTS")    # printed XIII -> XIV
        self.assertEqual(out[18], "XV.     AMENDMENTS")
        hits = {(a["old_label"], a["new_label"]): a["hits"] for a in applied}
        self.assertEqual(hits[("XII.", "XIII.")], 1)
        self.assertEqual(hits[("XIII.", "XIV.")], 1)

    def test_next_line_prefix_is_optional_and_a_no_op_when_absent(self):
        """An entry without `next_line_prefix` still rewrites EVERY matching
        line, exactly as before (existing regs' fixes never set it)."""
        saved = ic.KNOWN_LABEL_FIXES
        try:
            ic.KNOWN_LABEL_FIXES = {"zz": [dict(old_label="XII.", new_label="XIII.", match_prefix="XII.   AMENDMENTS",
                                                line_hint=1, note="")]}
            out, applied = ic.apply_known_label_fixes("zz", list(self.PART_H))
        finally:
            ic.KNOWN_LABEL_FIXES = saved
        self.assertEqual(out[0], "XIII.   AMENDMENTS")
        self.assertEqual(out[6], "XIII.   AMENDMENTS")
        self.assertEqual(applied[0]["hits"], 2)

    def test_lower_case_l_typo_in_part_d(self):
        lines = ["       Ill.D.3. That the repair facility be adequately equipped and maintain a level of",
                 "                diagnostic and repair equipment necessary to perform emissions related"]
        out, applied = ic.apply_known_label_fixes("11", lines)
        self.assertTrue(out[0].lstrip().startswith("III.D.3. That the repair facility"))
        self.assertEqual(out[0][:7], " " * 7)
        self.assertEqual({a["old_label"]: a["hits"] for a in applied}["Ill.D.3."], 1)

    def test_every_reg_11_fix_hits_exactly_once_on_the_real_source(self):
        if not os.path.exists(REG11_TXT):
            self.skipTest("sources/REG_11.txt not present in this checkout")
        raw = open(REG11_TXT, encoding="utf-8").read()
        lines, _ = ic.clean_pages(raw, "11")
        _, applied = ic.apply_known_label_fixes("11", lines)
        self.assertEqual(len(applied), 3)
        for a in applied:
            self.assertEqual(a["hits"], 1, a)
        _, tapplied = ic.apply_known_text_fixes("11", lines)
        self.assertEqual(len(tapplied), 1)
        self.assertEqual(tapplied[0]["hits"], 1)


class Reg11BareDigitDefinitionsTests(unittest.TestCase):
    """Part A's Section II definitions list in the exact REG_11.txt shape:
    bare "N." labels, a wrapped continuation line that starts with "82."
    (the tail of "40 CFR Part\\n82.") and the next compound-labelled
    section closing the list."""

    LINES = [
        "PART A        General Provisions",
        "",
        "I.     APPLICABILITY",
        "",
        "Subject to the provisions described in Sections I.A and I.B of this Part A.",
        "",
        "II.   DEFINITIONS",
        "",
        "1.    “Accreditation” means certification that the instrument and instrument",
        "      manufacturer meet the operating criteria specifications.",
        "",
        "2.    “Air Intake Systems” are those systems that allow for the induction of ambient air",
        "      (to include preheated air) into the engine combustion chamber.",
        "",
        "3.    “Chlorofluorocarbon” (CFC) is a class I stratospheric ozone depleting compound as",
        "      listed in Appendix A, final rule vol.57.mp 147 Federal Register, 40 CFR Part",
        "      82.",
        "",
        "5.    “Skipped” is not the next ordinal and must stay body text of item 3.",
        "",
        "4.    \"Contractor\" shall have the same meaning as set forth in Section 42-4-304(5), C.R.S.",
        "",
        "III.   EXEMPTION FROM SECTION 42-4-314, C.R.S.",
        "",
        "III.A. The following persons are exempt.",
        "",
    ]

    def _parse(self, reg):
        markers, _ = ic.scan_markers(self.LINES, set(), reg, None)
        provisions, order, _u, _t = ic.build_provisions(reg, self.LINES, markers, {})
        return provisions, order

    def test_each_definition_is_its_own_row_under_section_ii(self):
        prov, order = self._parse("11")
        for n in (1, 2, 3, 4):
            self.assertIn(f"sec-11-A-II-{n}", prov, order)
        r1 = prov["sec-11-A-II-1"]
        self.assertEqual(r1["citation"], "II.1.")
        self.assertEqual(r1["title"], "II.1. Accreditation")
        self.assertEqual(r1["kind"], "definition")
        self.assertEqual(r1["parent_id"], "sec-11-A-II")
        self.assertTrue(r1["full_text"].startswith("<p>“Accreditation” means certification"))
        self.assertEqual(prov["sec-11-A-II-4"]["title"], "II.4. Contractor")  # straight quotes too
        # "82." is a wrapped continuation (not next in sequence): stays in item 3.
        self.assertNotIn("sec-11-A-II-82", prov)
        self.assertIn("40 CFR Part 82.", re.sub(r"<[^>]+>", "", prov["sec-11-A-II-3"]["full_text"]))
        # "5." out of sequence: body text of item 3, not a row.
        self.assertNotIn("sec-11-A-II-5", prov)
        self.assertIn("5. “Skipped”", re.sub(r"<[^>]+>", "", prov["sec-11-A-II-3"]["full_text"]))
        # The list closes at the next compound-labelled section.
        self.assertIn("sec-11-A-III", prov)
        self.assertIn("sec-11-A-III-A", prov)
        self.assertEqual(prov["sec-11-A-III-A"]["parent_id"], "sec-11-A-III")
        self.assertEqual(prov["sec-11-A-II"]["kind"], "section")

    def test_no_op_for_a_regulation_without_the_config(self):
        prov, _ = self._parse("26")
        self.assertNotIn("sec-26-A-II-1", prov)
        self.assertIn("Accreditation", prov["sec-26-A-II"]["full_text"])  # fused, as before

    def test_citation_into_the_bare_digit_section_resolves(self):
        known = {"sec-11-top-REG-11", "sec-11-P-A", "sec-11-A-II", "sec-11-A-II-40", "sec-11-A-I", "sec-11-P-H"}
        html, buckets = ic.link_citations("an objection from the US EPA in Part A, Section II.40. and Part A, Section I.",
                                          "11", known, ic.CORPUS_REGS, "H", "sec-11-H-XXIX")
        self.assertIn('<span class="xref" data-target="sec-11-A-II-40">Section II.40.</span>', html)
        self.assertIn('<span class="xref" data-target="sec-11-A-I">Section I.</span>', html)
        self.assertFalse(any(buckets.values()))
        # a missing definition number is still unparseable, never historical
        _, buckets = ic.link_citations("see Part A, Section II.99.", "11", known, ic.CORPUS_REGS, "H", "sec-11-H-XXIX")
        self.assertEqual(dict(buckets[ic.BUCKET_UNPARSEABLE]), {"II.99.": 1})
        # and a reg without the config keeps the old (unparseable) result even if such an id existed
        html, buckets = ic.link_citations("see Section II.40. here", "26", {"sec-26-top-REG-26", "sec-26-A-II", "sec-26-A-II-40"},
                                          ic.CORPUS_REGS, "A", "sec-26-A-I")
        self.assertNotIn("xref", html)
        self.assertEqual(dict(buckets[ic.BUCKET_UNPARSEABLE]), {"II.40.": 1})


class Reg11LayoutTextTableTests(unittest.TestCase):
    HEAVY = [
        "       Maximum Concentration Limits for Heavy-Duty Vehicles",
        "          Model Year                Percent Carbon               Parts/million",
        "                                      Monoxide                   Hydrocarbon",
        "        1967 and earlier                 7.0                        1500",
        "             1968                        6.5                        1200",
        "             1978                        5.5                        1000",
        "Heavy-Duty Vehicles (1979 and Newer Greater Than 8500 lbs. GVWR) Subject to Idle",
        "Short Test(s)",
        "",
        "",
        "         Model Year                Percent Carbon            Parts/million",
        "                                     Monoxide                Hydrocarbon",
        "",
        "            1979                          4.0                    800",
        "       1986 and newer                     2.0                    300",
        "",
    ]

    def test_parse_layout_text_table_merges_two_header_lines_by_column(self):
        rows = ic._parse_layout_text_table(self.HEAVY[1:6], header_lines=2)
        self.assertEqual(rows[0], ["Model Year", "Percent Carbon Monoxide", "Parts/million Hydrocarbon"])
        self.assertEqual(rows[1], ["1967 and earlier", "7.0", "1500"])
        self.assertEqual(rows[3], ["1978", "5.5", "1000"])

    def test_swap_replaces_both_blocks_in_printed_order_and_stops_at_prose(self):
        tables, hits = {}, {"used": 0, "captions_used": []}
        out = ic._swap_layout_text_tables(list(self.HEAVY), "sec-11-F-II-A", "11", tables, hits)
        caps = [e["caption"] for e in ic.LAYOUT_TEXT_TABLES["11"] if e["row_id"] == "sec-11-F-II-A"]
        self.assertEqual(hits["captions_used"], caps)
        sentinels = [ln for ln in out if ln.startswith(ic._TABLE_SENTINEL)]
        self.assertEqual(len(sentinels), 2)
        # The one-cell sub-caption line ends the first block and survives as prose.
        self.assertIn("Heavy-Duty Vehicles (1979 and Newer Greater Than 8500 lbs. GVWR) Subject to Idle", out)
        self.assertEqual(tables[caps[0]]["rows"][-1], ["1978", "5.5", "1000"])
        self.assertEqual(tables[caps[1]]["rows"][1], ["1979", "4.0", "800"])
        self.assertEqual(tables[caps[1]]["rows"][-1], ["1986 and newer", "2.0", "300"])
        # Rendered through the same path as pdfplumber tables.
        html = ic.render_table_html(tables[caps[1]])
        self.assertIn("<th>Percent Carbon Monoxide</th>", html)
        self.assertIn("<td>1986 and newer</td><td>2.0</td><td>300</td>", html)

    def test_no_op_for_other_rows_and_regs(self):
        tables, hits = {}, {"used": 0, "captions_used": []}
        self.assertEqual(ic._swap_layout_text_tables(list(self.HEAVY), "sec-11-F-II-B", "11", tables, hits), self.HEAVY)
        self.assertEqual(ic._swap_layout_text_tables(list(self.HEAVY), "sec-11-F-II-A", "26", tables, hits), self.HEAVY)
        self.assertEqual(hits["used"], 0)
        self.assertEqual(tables, {})


class Reg11AppendixLadderTests(unittest.TestCase):
    """Appendix A in the exact REG_11.txt shape (decimal sections, lettered
    and numbered items, a wrapped "0.5 liters" continuation, a wrapped
    "(1)." continuation, six attachments, an attachment with restarted
    decimals, one with unlabeled headings only, and Appendix B after)."""

    LINES = [
        "PART H        Statements of Basis, Specific Statutory Authority and Purpose",
        "",
        "I.      AMENDMENTS TO PART A - E",
        "",
        "ADOPTED MARCH 21, 1996",
        "",
        "The amendments were adopted.",
        "",
        "APPENDIX A          Technical Specifications",
        "",
        "Revised Sept 09, 1994",
        "",
        "INTRODUCTION",
        "",
        "The Colorado AIR Program is in the process of modifying its current program.",
        "",
        "1.0   GENERAL",
        "",
        "1.1   Design Goals",
        "",
        "      The specifications that have been developed are designed utilizing a personal",
        "      computer system.",
        "",
        "1.2   Manuals",
        "",
        "      A.     Reference Operating Instructions",
        "",
        "      B.    Quarterly (90 days) examination, calibration, and routine maintenance of",
        "            the analyzer and sampling systems, sample hose (1) and sample probes",
        "            (1). Maintain the extra consumable inventory upon examination.",
        "",
        "             1.     control each of the analyzer functions;",
        "",
        "             2.     examine and obtain values from all of the analyzer sensors;",
        "",
        "                    a.     All equipment and software submitted for certification",
        "                           must be the full and current configuration.",
        "",
        "      C.    Instruct all certified inspectors.",
        "",
        "2.0    CONSTRUCTION DESIGN",
        "",
        "2.1    Automatic Calibrations",
        "",
        "       The analyzer shall limit gas usage to no more than 3.5 liters (or",
        "       0.5 liters in 24 hours) if the calibration gas valve(s) is/are not shut off.",
        "",
        "       2.1.1 Temperature Control",
        "",
        "             Analyzer components shall have their internal temperatures controlled.",
        "",
        "2.3    Skipped minor (2.2 is missing) stays body text",
        "",
        "ATTACHMENT I        PDF 1000 Scanner",
        "",
        "This document is incorporated by reference.",
        "",
        "ATTACHMENT II Colorado Automobile Dealers Transient Mode Test Analyzer",
        "System",
        "",
        "This document is incorporated by reference.",
        "",
        "ATTACHMENT III Specifications for Colorado 97 Analyzer",
        "",
        "INTRODUCTION",
        "",
        "Colorado's current enhanced I/M program contains a two-speed idle component.",
        "",
        "1.0   GENERAL",
        "",
        "It is expected that the Colorado 97 software will be upgraded.",
        "",
        "1.1   Design Goals",
        "",
        "      The specifications are designed utilizing a personal computer system.",
        "",
        "Vehicle Inspection Report – Passing Form",
        "Vehicle Inspection Report – Failing Form",
        "ATTACHMENT IV         Specifications for Colorado On-Board Diagnostic (OBD) Stand-",
        "Alone Analyzer",
        "",
        "INTRODUCTION",
        "",
        "This document contains specifications for manufacturers.",
        "",
        "Design Goals",
        "",
        "The CO-OBD-TAS must be designed and constructed to provide reliable service.",
        "",
        "   •   Initiate the inspection by collecting and entering the vehicle identification",
        "       information;",
        "",
        "Pass/Fail Requirement",
        "",
        "The CO-OBD-TAS shall fail vehicles for the following reasons:",
        "",
        "Design Goals",
        "",
        "A second heading with the same text gets a numbered slug.",
        "",
        "ATTACHMENT V “Colorado Approved” Calibration Span Gas Label Samples",
        "",
        "",
        "APPENDIX B        Standards and Specifications for Calibration/Span Gas",
        "Suppliers [Repealed eff. 11/30/2014]",
        "",
        "Editor's Notes",
        "",
        "History",
        "Entire rule eff. 08/30/2007.",
    ]
    # the page-seam index for the "Failing Form" line (clean_pages strips the
    # blank run at the end of the page the "Passing Form" caption closes)
    SEAMS = {LINES.index("Vehicle Inspection Report – Failing Form")}

    @classmethod
    def setUpClass(cls):
        markers, _ = ic.scan_markers(cls.LINES, cls.SEAMS, "11", None)
        cls.prov, cls.order, _u, cls.hits = ic.build_provisions("11", cls.LINES, markers, {})

    def T(self, suffix):
        return self.prov[f"sec-11-H-APPENDIX-A{('-' + suffix) if suffix else ''}"]

    def test_appendix_row_keeps_only_its_own_lead_in(self):
        a = self.T("")
        self.assertEqual(a["parent_id"], "sec-11-top-REG-11")
        self.assertEqual(a["kind"], "appendix")
        self.assertEqual(a["full_text"], "Appendix A — Technical Specifications<p>Revised Sept 09, 1994</p>")
        self.assertEqual([i for i in self.order if self.prov[i]["parent_id"] == a["id"]],
                         ["sec-11-H-APPENDIX-A-INTRODUCTION", "sec-11-H-APPENDIX-A-1.0", "sec-11-H-APPENDIX-A-2.0",
                          "sec-11-H-APPENDIX-A-ATT-I", "sec-11-H-APPENDIX-A-ATT-II", "sec-11-H-APPENDIX-A-ATT-III",
                          "sec-11-H-APPENDIX-A-ATT-IV", "sec-11-H-APPENDIX-A-ATT-V"])

    def test_unlabeled_heading_rows(self):
        intro = self.T("INTRODUCTION")
        self.assertEqual((intro["citation"], intro["title"], intro["kind"]), ("INTRODUCTION", "INTRODUCTION", "item"))
        self.assertTrue(intro["full_text"].startswith("INTRODUCTION<p>The Colorado AIR Program"))
        self.assertNotIn("sec-11-H-APPENDIX-A-REVISED-SEPT", "".join(self.order))  # a dated line is not a heading

    def test_decimal_sections_and_nesting(self):
        self.assertEqual(self.T("1.0")["title"], "1.0. GENERAL")
        self.assertEqual(self.T("1.0")["kind"], "section")
        self.assertEqual(self.T("1.0")["full_text"], "1.0. GENERAL")
        s11 = self.T("1.1")
        self.assertEqual((s11["citation"], s11["title"], s11["kind"], s11["parent_id"]),
                         ("1.1.", "1.1. Design Goals", "item", "sec-11-H-APPENDIX-A-1.0"))
        self.assertTrue(s11["full_text"].startswith("1.1. Design Goals<p>The specifications that have been developed"))
        self.assertEqual(self.T("2.1.1")["parent_id"], "sec-11-H-APPENDIX-A-2.1")
        self.assertEqual(self.T("2.1.1")["citation"], "2.1.1.")
        # "0.5 liters ..." is a wrapped continuation, "2.3" is out of sequence (no 2.2): both body text.
        self.assertNotIn("sec-11-H-APPENDIX-A-0.5", self.prov)
        self.assertNotIn("sec-11-H-APPENDIX-A-2.3", self.prov)
        self.assertIn("0.5 liters in 24 hours", self.T("2.1")["full_text"])
        self.assertIn("2.3 Skipped minor", self.T("2.1.1")["full_text"])

    def test_lettered_numbered_and_lower_items_under_a_decimal_section(self):
        a = self.T("1.2-A")
        self.assertEqual((a["citation"], a["title"], a["parent_id"]), ("1.2.A.", "1.2.A. Reference Operating Instructions", "sec-11-H-APPENDIX-A-1.2"))
        b = self.T("1.2-B")
        self.assertEqual(b["title"], "1.2.B.")
        self.assertTrue(b["full_text"].startswith("<p>Quarterly (90 days)"))
        self.assertNotIn("sec-11-H-APPENDIX-A-1.2-B-(1)", self.prov)  # "(1). Maintain" is a wrapped line
        self.assertIn("(1). Maintain the extra", b["full_text"])
        self.assertEqual(self.T("1.2-B-1")["parent_id"], "sec-11-H-APPENDIX-A-1.2-B")
        self.assertEqual(self.T("1.2-B-2")["citation"], "1.2.B.2.")
        self.assertEqual(self.T("1.2-B-2-a")["citation"], "1.2.B.2.a.")
        self.assertEqual(self.T("1.2-B-2-a")["parent_id"], "sec-11-H-APPENDIX-A-1.2-B-2")
        self.assertEqual(self.T("1.2-C")["parent_id"], "sec-11-H-APPENDIX-A-1.2")  # closes the digit/lower levels

    def test_attachments(self):
        i = self.T("ATT-I")
        self.assertEqual((i["citation"], i["title"], i["kind"], i["parent_id"]),
                         ("Attachment I", "Attachment I — PDF 1000 Scanner", "appendix", "sec-11-H-APPENDIX-A"))
        self.assertEqual(i["full_text"], "Attachment I — PDF 1000 Scanner<p>This document is incorporated by reference.</p>")
        self.assertEqual(self.T("ATT-II")["title"], "Attachment II — Colorado Automobile Dealers Transient Mode Test Analyzer System")
        self.assertTrue(self.T("ATT-II")["full_text"].endswith("<p>This document is incorporated by reference.</p>"))
        # hyphen-wrapped title joins without a space
        self.assertEqual(self.T("ATT-IV")["title"], "Attachment IV — Specifications for Colorado On-Board Diagnostic (OBD) Stand-Alone Analyzer")
        self.assertEqual(self.T("ATT-V")["full_text"], "Attachment V — “Colorado Approved” Calibration Span Gas Label Samples")

    def test_attachment_restarts_the_decimal_outline_under_its_own_prefix(self):
        self.assertEqual(self.T("ATT-III-INTRODUCTION")["parent_id"], "sec-11-H-APPENDIX-A-ATT-III")
        self.assertEqual(self.T("ATT-III-1.0")["parent_id"], "sec-11-H-APPENDIX-A-ATT-III")
        self.assertEqual(self.T("ATT-III-1.0")["title"], "1.0. GENERAL")
        self.assertTrue(self.T("ATT-III-1.0")["full_text"].startswith("1.0. GENERAL<p>It is expected"))
        self.assertEqual(self.T("ATT-III-1.1")["parent_id"], "sec-11-H-APPENDIX-A-ATT-III-1.0")
        # figure captions at a page end / seam are heading-only rows
        self.assertEqual(self.T("ATT-III-VEHICLE-INSPECTION-REPORT-PASSING-FORM")["full_text"], "Vehicle Inspection Report – Passing Form")
        self.assertEqual(self.T("ATT-III-VEHICLE-INSPECTION-REPORT-FAILING-FORM")["full_text"], "Vehicle Inspection Report – Failing Form")
        self.assertNotIn("Vehicle Inspection Report", self.T("ATT-III-1.1")["full_text"])

    def test_unlabeled_headings_only_attachment(self):
        kids = [i for i in self.order if self.prov[i]["parent_id"] == "sec-11-H-APPENDIX-A-ATT-IV"]
        self.assertEqual(kids, ["sec-11-H-APPENDIX-A-ATT-IV-INTRODUCTION", "sec-11-H-APPENDIX-A-ATT-IV-DESIGN-GOALS",
                                "sec-11-H-APPENDIX-A-ATT-IV-PASS-FAIL-REQUIREMENT", "sec-11-H-APPENDIX-A-ATT-IV-DESIGN-GOALS-2"])
        dg = self.T("ATT-IV-DESIGN-GOALS")
        self.assertEqual(dg["citation"], "Design Goals")
        self.assertIn("<p>• Initiate the inspection", dg["full_text"])  # bullets stay as paragraphs

    def test_appendix_b_and_sob_unaffected(self):
        b = self.prov["sec-11-H-APPENDIX-B"]
        self.assertEqual(b["title"], "Appendix B — Standards and Specifications for Calibration/Span Gas Suppliers [Repealed eff. 11/30/2014]")
        self.assertTrue(b["full_text"].startswith(b["title"] + "<p>Editor's Notes</p>"))
        self.assertEqual(self.prov["sec-11-H-I"]["parent_id"], "sec-11-P-H")
        # nothing from Appendix B's body was scanned as a ladder unit
        self.assertFalse(any("APPENDIX-B-" in i for i in self.order))

    def test_ladder_is_a_no_op_for_a_regulation_without_the_config(self):
        markers, _ = ic.scan_markers(self.LINES, self.SEAMS, "26", None)
        prov, order, _u, _t = ic.build_provisions("26", self.LINES, markers, {})
        self.assertFalse(any("APPENDIX-A-" in i for i in order))
        self.assertIn("1.1 Design Goals", prov["sec-26-H-APPENDIX-A"]["full_text"])


class Reg11DorRegulationTests(unittest.TestCase):
    def test_dor_regulation_1_is_not_linked_to_aqcc_reg_1(self):
        known = {"sec-11-top-REG-11"}
        text = "licensing as prescribed by C.R.S., AQCC Regulation 11, and DOR Regulation 1. In order to"
        html, buckets = ic.link_citations(text, "11", known, ic.CORPUS_REGS, "H", "sec-11-H-APPENDIX-A-ATT-V-AUDITING-REQUIREMENTS")
        self.assertIn('<span class="xref" data-target="sec-11-top-REG-11">Regulation 11</span>', html)
        self.assertNotIn("xref-external-reg", html)
        self.assertEqual(dict(buckets[ic.BUCKET_OTHER_REG]), {"DOR Regulation 1": 1})
        # an ordinary mention of Regulation 1 still links
        html, buckets = ic.link_citations("see AQCC Regulation Number 1 for opacity", "11", known, ic.CORPUS_REGS, "A", "sec-11-A-I")
        self.assertIn('<a class="xref-external-reg" href="/regulations/1">Regulation Number 1</a>', html)


class Reg11PartHeadingTests(unittest.TestCase):
    LINES = [
        "PART D       Qualification and Licensing of Emissions Mechanics, Emissions",
        "Inspectors, and Clean Screen Inspectors; Licensing of Emissions Inspection and",
        "Readjustment Stations, Inspection-Only Stations, Inspection-Only Facilities,",
        "Fleets, Motor Vehicle Dealer Test Facilities, Enhanced Inspection Centers;",
        "Qualification of Clean Screen Inspection Sites; and Registration of Emissions",
        "Related Repair Facilities and Technicians",
        "",
        "I.   LICENSING OF EMISSIONS INSPECTION AND READJUSTMENT STATIONS",
        "",
        "I.A.   Text of the first item.",
    ]

    def test_six_line_part_heading_is_kept_whole(self):
        markers, _ = ic.scan_markers(self.LINES, set(), "11", None)
        prov, order, _u, _t = ic.build_provisions("11", self.LINES, markers, {})
        self.assertTrue(prov["sec-11-P-D"]["title"].endswith("and Registration of Emissions Related Repair Facilities and Technicians"))
        self.assertEqual(prov["sec-11-P-D"]["full_text"], prov["sec-11-P-D"]["title"])  # no intro paragraph invented
        self.assertIn("sec-11-D-I-A", prov)

    def test_default_cap_unchanged_for_other_regs(self):
        markers, _ = ic.scan_markers(self.LINES, set(), "26", None)
        heading = next(m for m in markers if m["type"] == "part")["heading"]
        self.assertTrue(heading.endswith("Enhanced Inspection Centers;"))


class Reg11FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present).
    Runs in a subprocess so the pdfplumber walk's memory is released."""

    @classmethod
    def setUpClass(cls):
        if not (os.path.exists(REG11_TXT) and os.path.exists(REG11_PDF)):
            raise unittest.SkipTest("sources/REG_11.* not present in this checkout")
        import subprocess, tempfile
        cls.tmp = tempfile.TemporaryDirectory()
        out = os.path.join(cls.tmp.name, "reg11.json")
        subprocess.run([sys.executable, "import_ccr.py", "parse", "--reg", "11", "--pdf", REG11_PDF,
                        "--txt", REG11_TXT, "--out", out], check=True, capture_output=True,
                       cwd=os.path.dirname(os.path.abspath(__file__)))
        cls.rows = json.load(open(out, encoding="utf-8"))
        cls.unresolved = json.load(open(out.replace(".json", "_unresolved.json"), encoding="utf-8"))
        cls.by_id = {r["id"]: r for r in cls.rows}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_row_counts_and_kinds(self):
        self.assertEqual(len(self.rows), 715)
        kinds = {}
        for r in self.rows:
            kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
        self.assertEqual(kinds, {"root": 1, "part": 8, "section": 92, "item": 545, "definition": 61, "appendix": 8})

    def test_no_duplicate_ids_every_parent_resolves_no_giant_rows(self):
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), len(set(ids)))
        for r in self.rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], self.by_id)
        longest = max(self.rows, key=lambda r: len(r["full_text"]))
        self.assertLess(len(longest["full_text"]), 15000, longest["id"])

    def test_parts_and_top_level_sections(self):
        top = [r["citation"] for r in self.rows if r["parent_id"] == "sec-11-top-REG-11"]
        self.assertEqual(top, [f"PART {l}" for l in "ABCDEFGH"] + ["Appendix A", "Appendix B"])
        per_part = {"A": 5, "B": 11, "C": 12, "D": 9, "E": 1, "F": 7, "G": 4, "H": 37}
        for letter, n in per_part.items():
            secs = [r for r in self.rows if re.fullmatch(rf"sec-11-{letter}-[IVXL]+", r["id"])]
            self.assertEqual(len(secs), n, letter)
        self.assertTrue(self.by_id["sec-11-P-D"]["title"].endswith("Related Repair Facilities and Technicians"))
        self.assertIn("<p>In order for a vehicle (owner) to obtain a Certificate of Emissions Compliance", self.by_id["sec-11-P-F"]["full_text"])
        self.assertIn("<p>Effective April 1, 2027", self.by_id["sec-11-P-G"]["full_text"])
        self.assertIn("THIS PART E DESCRIBES THE GROUNDS UPON WHICH THE LICENSE OF", self.by_id["sec-11-E-I"]["full_text"])

    def test_part_h_thirty_seven_entries_with_the_two_misprints_corrected(self):
        entries = [r for r in self.rows if re.fullmatch(r"sec-11-H-[IVXL]+", r["id"])]
        self.assertEqual([r["citation"] for r in entries], [f"{ic.int_to_roman(n)}." for n in range(1, 38)])
        self.assertIn("ADOPTED DECEMBER 19, 2002", self.by_id["sec-11-H-XII"]["full_text"])
        self.assertIn("ADOPTED SEPTEMBER 18, 2003", self.by_id["sec-11-H-XIII"]["full_text"])
        self.assertIn("ADOPTED DECEMBER 18, 2003", self.by_id["sec-11-H-XIV"]["full_text"])
        self.assertIn("postpone the change in emissions standards", self.by_id["sec-11-H-XIV"]["full_text"])
        self.assertIn("ADOPTED November 19-21, 2025", self.by_id["sec-11-H-XXXVII"]["full_text"])
        # entry II's ten-item inner list, and no other inner rows anywhere in Part H
        self.assertEqual([r["id"] for r in self.rows if r["id"].startswith("sec-11-H-II-")],
                         [f"sec-11-H-II-{n}" for n in range(1, 11)])
        inner = [r["id"] for r in self.rows if re.match(r"sec-11-H-[IVXL]+-", r["id"]) and "APPENDIX" not in r["id"]]
        self.assertEqual(len(inner), 10)

    def test_part_a_definitions(self):
        defs = [r for r in self.rows if r["parent_id"] == "sec-11-A-II"]
        self.assertEqual([r["citation"] for r in defs], [f"II.{n}." for n in range(1, 62)])
        self.assertTrue(all(r["kind"] == "definition" for r in defs))
        self.assertEqual(self.by_id["sec-11-A-II-24"]["title"], "II.24. Division")
        self.assertIn("Air Pollution Control Division", self.by_id["sec-11-A-II-24"]["full_text"])
        self.assertEqual(self.by_id["sec-11-A-II-30"]["title"], "II.30. Executive Director of the Department of Revenue")
        self.assertEqual(self.by_id["sec-11-A-II-61"]["title"], "II.61. Zero Gas")
        self.assertIn("40 CFR Part 82.", re.sub(r"<[^>]+>", "", self.by_id["sec-11-A-II-12"]["full_text"]))
        self.assertIn("sec-11-A-III", self.by_id)

    def test_part_d_iii_d_3_label_fix_row(self):
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-11-D-III-D"],
                         ["III.D.1.", "III.D.2.", "III.D.3.", "III.D.4.", "III.D.5."])
        self.assertIn("adequately equipped", self.by_id["sec-11-D-III-D-3"]["full_text"])

    def test_part_f_tables_round_trip(self):
        t = self.by_id["sec-11-F-I-A"]["full_text"]
        self.assertIn("<th>Model Year</th><th>Percent Carbon Monoxide</th><th>Parts/million Hydrocarbon</th>", t)
        self.assertIn("<td>1970 and earlier</td><td>3.5</td><td>1000</td>", t)
        self.assertIn("<td>1981 and newer</td><td>1.2</td><td>220</td>", t)
        t = self.by_id["sec-11-F-II-A"]["full_text"]
        self.assertEqual(t.count('<table class="doc-table">'), 2)
        self.assertIn("<td>1967 and earlier</td><td>7.0</td><td>1500</td>", t)
        self.assertIn("<td>1978</td><td>5.5</td><td>1000</td></tr></tbody></table>", t)
        self.assertIn("<p>Heavy-Duty Vehicles (1979 and Newer Greater Than 8500 lbs. GVWR) Subject to Idle Short Test(s)</p>", t)
        self.assertIn("<td>1986 and newer</td><td>2.0</td><td>300</td>", t)
        t = self.by_id["sec-11-F-III-C"]["full_text"]
        self.assertIn("<th>MODEL YEAR</th><th>HC</th><th>CO</th><th>NOx</th>", t)
        self.assertIn("<td>1982</td><td>3.5</td><td>45.0</td><td>4.0</td>", t)
        self.assertIn("<td>2000 and newer</td><td>0.6</td><td>15.0</td><td>1.5</td>", t)
        t = self.by_id["sec-11-F-III-D"]["full_text"]
        self.assertIn("<td>2007 and newer</td><td>0.6</td><td>15.0</td><td>1.5</td>", t)
        self.assertEqual(t.count("<tr>"), 27)
        t = self.by_id["sec-11-H-APPENDIX-A-2.11-F"]["full_text"]
        self.assertIn("<td>HC ppm</td><td>0-400</td><td>±12ppm</td>", t)
        # nothing of the flattened dump survives as prose
        self.assertNotIn("1000 1971", re.sub(r"<[^>]+>", " ", self.by_id["sec-11-F-I-A"]["full_text"]))

    def test_appendix_a_outline(self):
        kids = [r["id"] for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A"]
        self.assertEqual(kids, ["sec-11-H-APPENDIX-A-INTRODUCTION", "sec-11-H-APPENDIX-A-1.0", "sec-11-H-APPENDIX-A-2.0",
                                "sec-11-H-APPENDIX-A-3.0"] + [f"sec-11-H-APPENDIX-A-ATT-{r}" for r in ("I", "II", "III", "IV", "V", "VI")])
        self.assertEqual(self.by_id["sec-11-H-APPENDIX-A"]["full_text"], "Appendix A — Technical Specifications<p>Revised Sept 09, 1994</p>")
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A-1.0"],
                         [f"1.{n}." for n in range(1, 10)])
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A-2.0"],
                         [f"2.{n}." for n in range(1, 20)])
        self.assertEqual(self.by_id["sec-11-H-APPENDIX-A-2.8.1"]["parent_id"], "sec-11-H-APPENDIX-A-2.8")
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A-2.11"],
                         [f"2.11.{c}." for c in "ABCDEFGHIJK"])
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A-2.14"],
                         [f"2.14.{n}." for n in range(1, 14)])
        self.assertEqual(self.by_id["sec-11-H-APPENDIX-A-2.13-D-4-a"]["parent_id"], "sec-11-H-APPENDIX-A-2.13-D-4")
        self.assertEqual(self.by_id["sec-11-H-APPENDIX-A-ATT-IV"]["title"], "Attachment IV — Specifications for Colorado 97 Analyzer")
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A-ATT-IV-3.0"],
                         ["3.1.", "3.2.", "3.3.", "3.4.", "3.5."])
        att_v = [r for r in self.rows if r["parent_id"] == "sec-11-H-APPENDIX-A-ATT-V"]
        self.assertEqual(len(att_v), 28)
        self.assertEqual(att_v[0]["citation"], "INTRODUCTION")
        self.assertEqual(att_v[-1]["citation"], "Certification Requirements")
        self.assertEqual(self.by_id["sec-11-H-APPENDIX-A-ATT-VI"]["full_text"],
                         "Attachment VI — “Colorado Approved” Calibration Span Gas Label Samples")
        self.assertTrue(self.by_id["sec-11-H-APPENDIX-B"]["full_text"].startswith(
            "Appendix B — Standards and Specifications for Calibration/Span Gas Suppliers [Repealed eff. 11/30/2014]<p>Editor's Notes</p>"))

    def test_no_repeated_paragraph_prefix_within_a_row(self):
        from collections import Counter
        for r in self.rows:
            paras = re.findall(r"<p>(.*?)</p>", r["full_text"], re.S)
            counts = Counter(p[:50] for p in paras)
            for prefix, n in counts.items():
                self.assertLess(n, 3, f"{r['id']!r} repeats paragraph prefix {prefix!r} {n} times")

    def test_cross_references(self):
        self.assertIn('data-target="sec-11-top-REG-11"', self.by_id["sec-11-H-I"]["full_text"])
        self.assertIn('data-target="sec-11-A-II-40"', self.by_id["sec-11-H-XXIX"]["full_text"])
        self.assertIn('<span class="xref" data-target="sec-11-C-II-C">', self.by_id["sec-11-F-VII"]["full_text"])
        self.assertEqual(self.unresolved["other_reg"], [["DOR Regulation 1", 1]])
        self.assertNotIn("xref-external-reg", json.dumps(self.rows))  # Reg 11 cites no other corpus regulation
        self.assertEqual(dict(self.unresolved["cfr"])["40 CFR Part 51"], 2)
        self.assertEqual(sorted(t for t, _ in self.unresolved["unparseable"]),
                         ["I.A.10t", "III.A.2", "III.B.2", "IX.C."])
        self.assertEqual(self.unresolved["historical"], [])


# ---------------------------------------------------------------------------
# Regulation Number 12 — Reduction of Diesel Vehicle Emissions (5 CCR
# 1001-15), Batch 5. Standard AQCC Part/Section shape (Parts A-D, D = roman_seq
# statement of basis with a topic-line opener), plus three gated additions:
# the bare dotted lower-roman fifth level / dotted capital sixth level
# (REG_CYCLE_AB["12"] + FAMILY_REGEX["bare_lroman"]), "Part X, <citation>"
# cross-references with no "Section" keyword (PART_COMMA_CITATION_REGS), and
# the whole-line KNOWN_CONTINUATION_LINES match. Every one is a no-op for
# every other regulation (see CrossRefNoOpProof-style assertions below).
# ---------------------------------------------------------------------------

REG12_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_12.txt")
REG12_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_12.pdf")


class Reg12MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["12"], "12")
        self.assertNotIn("12", ic.ECFR_REGS)
        meta = ic.REG_META["12"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["source_url"], "https://cdphe.colorado.gov/aqcc-regulations")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 12")
        self.assertEqual(meta["root_title"], "REDUCTION OF DIESEL VEHICLE EMISSIONS 5 CCR 1001-15")
        self.assertNotIn("no_parts", meta)
        self.assertNotIn("family", meta)

    def test_sob_part_config(self):
        cfg = ic.SOB_PART_CONFIG["12"]
        self.assertEqual((cfg["letter"], cfg["top_family"]), ("D", "roman_seq"))
        self.assertFalse(cfg["inner_items"])
        for opener in ("Amendment to Parts A and B, and Creation of this Part D",
                       "Amendments to Parts B and D", "AMENDMENTS TO PARTS A, B, C, and D", "AMENDMENTS"):
            self.assertIsNotNone(cfg["top_opener_re"].match(opener), opener)
        # an inner "I." factor list item / a date line must not open an entry
        for text in ("Existing data concerning diesel emissions", "Adopted January 15, 1998",
                     "Amend the regulation"):
            self.assertIsNone(cfg["top_opener_re"].match(text), text)

    def test_dotted_cfr_gate_includes_12_only_additively(self):
        self.assertIn("12", ic.CFR_DOTTED_REGS)
        self.assertIn("8", ic.CFR_DOTTED_REGS)
        self.assertNotIn("26", ic.CFR_DOTTED_REGS)


class Reg12BareLowerRomanCycleTests(unittest.TestCase):
    """REG_CYCLE_AB["12"]: depth 5 is a dotted lower roman ("I.D.2.a.i."),
    depth 6 a dotted capital ("I.D.7.d.ii.A.")."""

    def test_cycle_and_family_regex(self):
        self.assertEqual(ic.cycle_ab_for("12"), ["roman", "upper", "digit", "lower", "bare_lroman", "upper"])
        self.assertEqual(ic.cycle_ab_for("26"), ic.CYCLE_AB)
        self.assertEqual(ic.cycle_ab_for(None), ic.CYCLE_AB)
        self.assertIn("bare_lroman", ic.FAMILY_REGEX)
        self.assertIn("bare_lroman", ic.FAMILY_REGEX_NO_TRAILING_DOT)
        self.assertNotIn("bare_lroman", ic.CYCLE_AB)
        self.assertNotIn("bare_lroman", ic.CYCLE_C_INNER)

    def test_depth_five_and_six_tokenize_and_display_as_printed(self):
        cyc = ic.cycle_ab_for("12")
        toks, n = ic.tokenize_by_cycle("I.D.2.a.ii. The date of the transfer", cyc)
        self.assertEqual(toks, [("roman", "I"), ("upper", "D"), ("digit", "2"), ("lower", "a"), ("bare_lroman", "ii")])
        self.assertEqual(n, len("I.D.2.a.ii."))
        self.assertEqual(ic.tokens_to_citation(toks), "I.D.2.a.ii.")
        self.assertEqual(ic.tokens_to_id_suffix(toks), "I-D-2-a-ii")
        toks, n = ic.tokenize_by_cycle("II.C.1.b.i.A.    Range: 0-100 percent opacity", cyc)
        self.assertEqual(toks[-2:], [("bare_lroman", "i"), ("upper", "A")])
        self.assertEqual(ic.tokens_to_citation(toks), "II.C.1.b.i.A.")
        self.assertEqual(ic.tokens_to_id_suffix(toks), "II-C-1-b-i-A")

    def test_bare_lroman_is_roman_validated(self):
        cyc = ic.cycle_ab_for("12")
        # "I.D.7.d.iv." is valid; a non-roman letter run at depth 5 stops the walk
        toks, _ = ic.tokenize_by_cycle("I.D.7.d.iv. Air pollution control equipment", cyc)
        self.assertEqual(toks[-1], ("bare_lroman", "iv"))
        toks, _ = ic.tokenize_by_cycle("I.D.7.d.ix.x. text", cyc)  # "ix" ok, then "x" -> upper fails
        self.assertEqual(toks[-1], ("bare_lroman", "ix"))
        toks, _ = ic.tokenize_by_cycle("I.D.7.d.vv. text", cyc)  # "vv" is not a roman numeral
        self.assertEqual(toks[-1], ("lower", "d"))

    def test_depth_four_lettered_i_is_still_a_lower_token(self):
        # Reg 12's own "II.A.2.i." is the 9th lettered item, not a roman one.
        toks, _ = ic.tokenize_by_cycle("II.A.2.i. Notwithstanding the provisions", ic.cycle_ab_for("12"))
        self.assertEqual(toks[-1], ("lower", "i"))
        self.assertEqual(ic._label_ordinal("lower", "i"), 9)
        self.assertEqual(ic._label_ordinal("bare_lroman", "iv"), 4)
        self.assertIsNone(ic._label_ordinal("bare_lroman", "vv"))

    def test_other_regulations_unaffected(self):
        # Under plain CYCLE_AB the same line stops at depth 4 exactly as before.
        toks, n = ic.tokenize_by_cycle("I.D.2.a.ii. The date", ic.CYCLE_AB)
        self.assertEqual(toks[-1], ("lower", "a"))
        self.assertEqual(n, len("I.D.2.a."))
        self.assertEqual(ic._citation_to_id_suffix("I.D.2.a.ii.", ic.cycle_ab_for("12")), "I-D-2-a-ii")
        self.assertIsNone(ic._citation_to_id_suffix("I.D.2.a.ii.", ic.CYCLE_AB))


class Reg12LabelFixTests(unittest.TestCase):
    def test_each_fix_rewrites_only_its_label(self):
        lines = [
            "IV. B.   Test Site and Vehicle Parameters",
            "        I.D.4    Any new heavy-duty diesel vehicle of model year 2014 or newer having a gross vehicle",
            "                        I.D.2.b.iii         Any new heavy-duty diesel vehicle having a GVWR of twenty six",
            "                                     II.C.1.b.i.F     Peak Hold Feature",
            "                            II.D.2.e.i        Provision for field checking the accuracy of the dynamometer’s",
            "                      III C.4.b.vi.    Reserved",
            "IV. B.   something else entirely",  # a different line must not be rewritten
        ]
        out, applied = ic.apply_known_label_fixes("12", lines)
        self.assertTrue(out[0].startswith("IV.B.   Test Site"))
        self.assertTrue(out[1].lstrip().startswith("I.D.4.    Any new heavy-duty"))
        self.assertTrue(out[2].lstrip().startswith("I.D.2.b.iii.         Any new"))
        self.assertTrue(out[3].lstrip().startswith("II.C.1.b.i.F.     Peak Hold"))
        self.assertTrue(out[4].lstrip().startswith("II.D.2.e.i.        Provision"))
        self.assertTrue(out[5].lstrip().startswith("III.C.4.b.vi.    Reserved"))
        self.assertEqual(out[6], lines[6])
        self.assertEqual(len(out[2]) - len(out[2].lstrip()), len(lines[2]) - len(lines[2].lstrip()))
        self.assertEqual({a["old_label"]: a["hits"] for a in applied},
                         {"IV. B.": 1, "I.D.4": 1, "I.D.2.b.iii": 1, "II.C.1.b.i.F": 1, "II.D.2.e.i": 1,
                          "III C.4.b.vi.": 1})

    def test_every_reg_12_fix_hits_exactly_once_on_the_real_source(self):
        if not os.path.exists(REG12_TXT):
            self.skipTest("sources/REG_12.txt not present in this checkout")
        raw = open(REG12_TXT, encoding="utf-8").read()
        lines, _ = ic.clean_pages(raw, "12")
        _, applied = ic.apply_known_label_fixes("12", lines)
        self.assertEqual(len(applied), 6)
        for a in applied:
            self.assertEqual(a["hits"], 1, a)
        _, cont = ic.find_known_continuation_lines("12", lines)
        self.assertEqual(len(cont), 3)
        for a in cont:
            self.assertEqual(a["hits"], 1, a)

    def test_anomaly_documented_not_corrected(self):
        self.assertEqual([a["label"] for a in ic.KNOWN_LABEL_ANOMALIES["12"]], ["I.D.7.d.ii.F."])


class Reg12WholeLineContinuationTests(unittest.TestCase):
    def test_whole_line_matches_only_the_bare_citation_line(self):
        lines = [
            "      I.B.16. “Opacity meter” means an optical instrument",
            "        specifications set out in SAE J1667 ... as provided in Part A,",
            "        I.B.16.",
            "      I.B.16. “Diesel Opacity Inspection” means an inspection",
        ]
        skip, applied = ic.find_known_continuation_lines("12", lines)
        self.assertIn(2, skip)
        self.assertNotIn(0, skip)
        self.assertNotIn(3, skip)
        hit = next(a for a in applied if a["old_label"] == "I.B.16.")
        self.assertEqual(hit["hits"], 1)

    def test_prefix_entries_keep_prefix_semantics(self):
        # Reg 1's entry (no whole_line) still matches by prefix, unchanged.
        lines = ["IV.D.2. may apply to the division for an exemption from continuous emission monitoring"]
        skip, applied = ic.find_known_continuation_lines("1", lines)
        self.assertEqual(skip, {0})
        self.assertEqual(applied[0]["hits"], 1)


class Reg12PartCommaCitationTests(unittest.TestCase):
    KNOWN = {"sec-12-top-REG-12", "sec-12-P-A", "sec-12-P-B", "sec-12-A-I", "sec-12-A-IV", "sec-12-A-IV-C",
             "sec-12-A-IV-C-5", "sec-12-A-VII", "sec-12-B-I", "sec-12-B-II", "sec-12-B-II-C",
             "sec-12-B-I-D", "sec-12-B-I-D-2", "sec-12-B-I-D-2-a", "sec-12-B-I-D-2-a-i"}

    def test_gate(self):
        self.assertEqual(ic.PART_COMMA_CITATION_REGS, frozenset({"12"}))

    def test_part_comma_citation_links_against_that_part(self):
        html, buckets = ic.link_citations(
            "tested according to the procedures in Part A, IV.C.5. and the standards of Part A, VII. as well",
            "12", self.KNOWN, set(ic.CORPUS_REGS), own_part="B")
        self.assertIn('<span class="xref" data-target="sec-12-P-A">Part A</span>, '
                      '<span class="xref" data-target="sec-12-A-IV-C-5">IV.C.5.</span>', html)
        self.assertIn('<span class="xref" data-target="sec-12-A-VII">VII.</span>', html)
        self.assertEqual(sum(sum(c.values()) for c in buckets.values()), 0)

    def test_depth_five_target_and_no_section_keyword_needed(self):
        html, _ = ic.link_citations("pursuant to Part B, I.D.2.a.i., unless such transfer", "12",
                                    self.KNOWN, set(ic.CORPUS_REGS), own_part="B")
        self.assertIn('<span class="xref" data-target="sec-12-B-I-D-2-a-i">I.D.2.a.i.</span>', html)

    def test_missing_target_is_bucketed_not_linked(self):
        html, buckets = ic.link_citations("pursuant to Part A, I.D.4., or unless", "12",
                                          self.KNOWN, set(ic.CORPUS_REGS), own_part="A")
        self.assertIn('<span class="xref" data-target="sec-12-P-A">Part A</span>, I.D.4., or', html)
        self.assertEqual(buckets[ic.BUCKET_UNPARSEABLE]["I.D.4."], 1)

    def test_explicit_section_keyword_form_still_takes_priority(self):
        html, _ = ic.link_citations("see Part B, Section II.C. for meters", "12",
                                    self.KNOWN, set(ic.CORPUS_REGS), own_part="A")
        self.assertIn('<span class="xref" data-target="sec-12-B-II-C">Section II.C.</span>', html)
        self.assertEqual(html.count("sec-12-B-II-C"), 1)

    def test_no_op_for_other_regulations(self):
        known = {"sec-26-top-REG-26", "sec-26-P-B", "sec-26-B-II", "sec-26-B-II-C"}
        text = "the requirements of Part B, II.C. of this regulation"
        html, buckets = ic.link_citations(text, "26", known, set(ic.CORPUS_REGS), own_part="A")
        self.assertIn('<span class="xref" data-target="sec-26-P-B">Part B</span>, II.C. of', html)
        self.assertNotIn("sec-26-B-II-C", html)


class Reg12MiniParseTests(unittest.TestCase):
    """Fixture in the exact pdftotext -layout shape of REG_12.txt: a Part B
    nested to depth six, a Part C of sentence-as-heading sections and a
    Part D roman_seq statement of basis with topic-line openers, a
    wrapped-heading entry, and restarting inner lists."""

    LINES = [
        "PART B           DIESEL OPACITY INSPECTION PROGRAM",
        "",
        "I.      General Provisions",
        "",
        "I.D.   Conditions for Issuance of Certification of Emissions Control",
        "",
        "       I.D.2.   For new diesel motor vehicles being registered for the first time.",
        "",
        "                I.D.2.a. For light-duty vehicles, such certification shall expire on the earliest of:",
        "",
        "                        I.D.2.a.i.       The anniversary of the day of the issuance of such certification",
        "                                  when such vehicle has reached its fourth model year.",
        "",
        "                        I.D.2.a.ii.         The date of the transfer of ownership if such date is within twelve",
        "                                  months before such certification would expire, pursuant to Part B,",
        "                                  I.D.2.a.i., unless such transfer of ownership is a transfer from the lessor",
        "                                  to the lessee.",
        "",
        "       I.D.7.   A “Certification of Diesel Smoke Opacity Waiver” shall be issued if:",
        "",
        "                I.D.7.d. Emissions related repairs:",
        "",
        "                        I.D.7.d.ii.       Replacements, repairs and adjustments to the following systems",
        "                                  shall qualify as emissions related repairs:",
        "",
        "                                I.D.7.d.ii.A.     Air intake systems",
        "",
        "                                I.D.7.d.ii.B.      Fuel system components, including fuel injection pumps,",
        "                                          injectors and related components.",
        "",
        "                        I.D.7.d.iii.       The expenditure for smoke reduction activities does not include",
        "                                  the opacity inspection or reinspection fee(s).",
        "",
        "II.     Test Equipment Requirements",
        "",
        "Standards and procedures for the operation of the Division-approved smoke opacity meters.",
        "",
        "II.A.   Approval of Required Test Equipment",
        "",
        "PART C      STANDARDS FOR VISIBLE POLLUTANTS FROM DIESEL ENGINE POWERED",
        "VEHICLES (Operating on Roads, Streets and Highways)",
        "",
        "I.      No person shall emit or cause to be emitted into the atmosphere from any diesel-powered motor",
        "        vehicle operating in the program area of any air contaminant exceeding twenty percent (20%)",
        "        opacity measured over five (5) seconds.",
        "",
        "II.     This standard shall apply to motor vehicles intended, designed, and manufactured primarily for",
        "        travel or use in transporting person, property, auxiliary equipment, and/or cargo over roads.",
        "",
        "III.    Enforcement of these emission standards shall be by peace officers and environmental officers",
        "        pursuant to the authority of 42-4-412, or 42-4-413 C.R.S., within program boundaries.",
        "",
        "PART D           STATEMENT OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE",
        "",
        "I.      Amendment to Parts A and B, and Creation of this Part D",
        "",
        "Adopted January 15, 1998",
        "",
        "Basis and Purpose",
        "",
        "Regulation Number12 establishes programs for Diesel Opacity Inspections. See Part B, I.D.2.a.ii.",
        "",
        "1.      A first numbered finding.",
        "",
        "2.      A second numbered finding.",
        "",
        "II.     Amendments to Parts B and D",
        "",
        "Adopted January 11, 2001",
        "",
        "Basis and Purpose",
        "",
        "1.      A restarted numbered list inside entry II.",
        "",
        "I.      Existing data concerning diesel emissions — an inner factor list, not an entry.",
        "",
        "II.     Input from the scientific community — also inner.",
        "",
        "XI.     AMENDMENTS",
        "",
        "Adopted January 16, 2025",
        "",
        "         a.      These rules are based upon reasonably available, validated methodologies.",
        "",
        "         b.      Evidence in the record supports the finding.",
        "",
        "III.    AMENDMENTS TO PARTS A, B, C, and D",
        "",
        "Adopted September 18, 2003",
        "",
        "Third real entry (XI. above was out of sequence and must be inner text of II).",
        "",
    ]

    @classmethod
    def setUpClass(cls):
        markers, _ = ic.scan_markers(cls.LINES, set(), "12")
        provisions, order, cls.unresolved, _ = ic.build_provisions("12", cls.LINES, markers, {})
        cls.rows = [provisions[pid] for pid in order]
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_deep_rows_exist_with_printed_citations(self):
        for pid, cite in (("sec-12-B-I-D-2-a-i", "I.D.2.a.i."), ("sec-12-B-I-D-2-a-ii", "I.D.2.a.ii."),
                          ("sec-12-B-I-D-7-d-ii-A", "I.D.7.d.ii.A."), ("sec-12-B-I-D-7-d-ii-B", "I.D.7.d.ii.B."),
                          ("sec-12-B-I-D-7-d-iii", "I.D.7.d.iii.")):
            self.assertIn(pid, self.by_id, pid)
            self.assertEqual(self.by_id[pid]["citation"], cite)
        self.assertEqual(self.by_id["sec-12-B-I-D-7-d-ii-A"]["parent_id"], "sec-12-B-I-D-7-d-ii")
        self.assertEqual(self.by_id["sec-12-B-I-D-7-d-ii-A"]["title"], "I.D.7.d.ii.A. Air intake systems")
        self.assertIn("injectors and related components", self.by_id["sec-12-B-I-D-7-d-ii-B"]["full_text"])

    def test_wrapped_citation_line_stays_body_text(self):
        # The "I.D.2.a.i., unless ..." continuation is in KNOWN_CONTINUATION_LINES
        # but scan_markers only honours skip_candidates handed to it; here the
        # generic guards alone must not have split I.D.2.a.ii. — check it is
        # a single row containing its whole sentence.
        text = self.by_id["sec-12-B-I-D-2-a-ii"]["full_text"]
        self.assertIn("to the lessee", text)
        self.assertIn('data-target="sec-12-B-I-D-2-a-i">I.D.2.a.i.</span>', text)

    def test_sentence_headed_part_c_sections(self):
        for pid in ("sec-12-C-I", "sec-12-C-II", "sec-12-C-III"):
            self.assertIn(pid, self.by_id)
            self.assertEqual(self.by_id[pid]["kind"], "section")
            self.assertEqual(self.by_id[pid]["parent_id"], "sec-12-P-C")
        self.assertIn("peace officers and environmental officers", self.by_id["sec-12-C-III"]["full_text"])
        self.assertIn("within program boundaries", self.by_id["sec-12-C-III"]["full_text"])
        self.assertIn("(Operating on Roads, Streets and Highways)", self.by_id["sec-12-P-C"]["title"])

    def test_section_heading_with_lead_paragraph(self):
        text = self.by_id["sec-12-B-II"]["full_text"]
        self.assertTrue(text.startswith("<p>Test Equipment Requirements</p><p>Standards and procedures"))
        self.assertIn("sec-12-B-II-A", self.by_id)

    def test_sob_entries_are_single_rows_in_order(self):
        entries = [r["id"] for r in self.rows if r["parent_id"] == "sec-12-P-D"]
        self.assertEqual(entries, ["sec-12-D-I", "sec-12-D-II", "sec-12-D-III"])
        self.assertNotIn("sec-12-D-XI", self.by_id)
        self.assertNotIn("sec-12-D-I-1", self.by_id)
        self.assertNotIn("sec-12-D-II-1", self.by_id)
        one = self.by_id["sec-12-D-I"]["full_text"]
        self.assertTrue(one.startswith('<p>Amendment to Parts A and B, and Creation of this <span class="xref" '
                                       'data-target="sec-12-P-D">Part D</span></p><p>Adopted January 15, 1998</p>'),
                        one[:160])
        self.assertIn("<p>2. A second numbered finding.</p>", one)
        two = self.by_id["sec-12-D-II"]["full_text"]
        self.assertIn("Existing data concerning diesel emissions", two)
        self.assertIn("<p>XI. AMENDMENTS</p>", two)
        self.assertIn("<p>b. Evidence in the record supports the finding.</p>", two)
        self.assertIn("Third real entry", self.by_id["sec-12-D-III"]["full_text"])

    def test_cross_part_citation_from_sob_resolves_to_depth_five(self):
        self.assertIn('<span class="xref" data-target="sec-12-B-I-D-2-a-ii">I.D.2.a.ii.</span>',
                      self.by_id["sec-12-D-I"]["full_text"])


class Reg12FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(REG12_TXT):
            raise unittest.SkipTest("sources/REG_12.txt not present in this checkout")
        pdf = REG12_PDF if os.path.exists(REG12_PDF) else None
        (cls.rows, cls.unresolved, _th, _nt, cls.dupes, cls.fixes, cls.anomalies, _audit) = ic.parse_reg(
            "12", REG12_TXT, pdf
        )
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_no_duplicate_ids(self):
        self.assertEqual(self.dupes, [])

    def test_label_fixes_all_hit_once(self):
        self.assertEqual(len(self.fixes), 9)  # 6 label fixes + 3 continuation lines
        self.assertTrue(all(f["hits"] == 1 for f in self.fixes), self.fixes)

    def test_structure(self):
        parts = [r["id"] for r in self.rows if r["kind"] == "part"]
        self.assertEqual(parts, ["sec-12-P-A", "sec-12-P-B", "sec-12-P-C", "sec-12-P-D"])
        secs = {}
        for r in self.rows:
            if r["kind"] == "section":
                secs.setdefault(r["parent_id"], []).append(r["citation"])
        self.assertEqual(secs["sec-12-P-A"], ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII."])
        self.assertEqual(secs["sec-12-P-B"], ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII."])
        self.assertEqual(secs["sec-12-P-C"], ["I.", "II.", "III."])
        self.assertEqual(secs["sec-12-P-D"], [f"{ic.int_to_roman(n)}." for n in range(1, 12)])
        self.assertFalse(any(r["kind"] == "appendix" for r in self.rows))
        root = self.by_id["sec-12-top-REG-12"]
        self.assertEqual(root["title"], "REDUCTION OF DIESEL VEHICLE EMISSIONS 5 CCR 1001-15")

    def test_fixed_labels_and_deep_rows(self):
        for pid in ("sec-12-A-IV-B", "sec-12-A-IV-B-1", "sec-12-A-I-D-4", "sec-12-B-I-D-2-b-iii", "sec-12-B-II-C-1-b-i-F",
                    "sec-12-B-II-D-2-e-i", "sec-12-B-III-C-4-b-vi", "sec-12-B-III-C-4-b-viii-C",
                    "sec-12-B-I-D-7-d-ii-G", "sec-12-B-II-C-1-b-vii"):
            self.assertIn(pid, self.by_id, pid)
        self.assertEqual(self.by_id["sec-12-A-IV-B"]["title"], "IV.B. Test Site and Vehicle Parameters")
        self.assertEqual(self.by_id["sec-12-B-III-C-4-b-vi"]["full_text"], "III.C.4.b.vi. Reserved")
        # the documented E gap: D, F, G with no E
        kids = [r["citation"] for r in self.rows if r["parent_id"] == "sec-12-B-I-D-7-d-ii"]
        self.assertEqual(kids, ["I.D.7.d.ii.A.", "I.D.7.d.ii.B.", "I.D.7.d.ii.C.", "I.D.7.d.ii.D.",
                                "I.D.7.d.ii.F.", "I.D.7.d.ii.G."])
        self.assertEqual([a["label"] for a in self.anomalies], ["I.D.7.d.ii.F."])

    def test_continuation_lines_kept_in_their_rows(self):
        iv_c_5 = self.by_id["sec-12-A-IV-C-5"]["full_text"]
        self.assertIn("as provided in", iv_c_5)
        self.assertIn('data-target="sec-12-A-I-B-16">I.B.16.</span>', iv_c_5)
        self.assertIn("shall be issued a completed CEC", iv_c_5)
        self.assertNotIn("completed CEC", self.by_id["sec-12-A-I-B-16"]["full_text"])
        self.assertIn("to the lessee", self.by_id["sec-12-B-I-D-2-a-ii"]["full_text"])
        self.assertIn("to the lessee", self.by_id["sec-12-B-I-D-2-b-ii"]["full_text"])

    def test_every_parent_resolves_and_ids_extend_parents(self):
        for r in self.rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], self.by_id, r["id"])
            if r["kind"] == "item":
                self.assertTrue(r["id"].startswith(r["parent_id"] + "-"), r["id"])

    def test_no_page_furniture_leaks(self):
        for r in self.rows:
            self.assertNotRegex(r["full_text"], r"CODE OF COLORADO REGULATIONS|\d\s*Air Quality Control Commission")

    def test_sob_entries(self):
        entries = [r for r in self.rows if r["parent_id"] == "sec-12-P-D"]
        self.assertEqual(len(entries), 11)
        dates = ["January 15, 1998", "January 11, 2001", "September 18, 2003", "October 21, 2004",
                 "March 18, 2005", "November 16, 2006", "October 20, 2011", "August 15, 2013",
                 "August 18, 2016", "October 18, 2018", "January 16, 2025"]
        for e, d in zip(entries, dates):
            self.assertIn(f"<p>Adopted {d}</p>", e["full_text"], e["id"])
        self.assertFalse(any((r["parent_id"] or "").startswith("sec-12-D-") for r in self.rows))

    def test_opacity_limits_verbatim(self):
        self.assertIn("twenty percent (20%) opacity measured over five (5) seconds", self.by_id["sec-12-C-I"]["full_text"])
        self.assertIn("shall not exceed twenty percent (20%) opacity measured over 5 seconds",
                      self.by_id["sec-12-A-VII"]["full_text"])

    def test_cross_references(self):
        self.assertIn('<span class="xref" data-target="sec-12-B-II-C">II.C.</span>',
                      self.by_id["sec-12-A-I-B-16"]["full_text"])
        self.assertEqual(self.unresolved[ic.BUCKET_CFR]["40 C.F.R. Part 85, Subpart V"], 2)
        self.assertIn('data-target="sec-12-A-I-D-4">I.D.4.</span>', self.by_id["sec-12-A-II-A-2-h"]["full_text"])
        self.assertEqual(dict(self.unresolved[ic.BUCKET_UNPARSEABLE]), {"I.V.C.5": 1, "I.D.5.": 1, "VII.by": 1})
        self.assertEqual(self.unresolved[ic.BUCKET_OTHER_REG], {})
        self.assertEqual(self.unresolved[ic.BUCKET_HISTORICAL], {})
        for r in self.rows:
            for t in re.findall(r'data-target="([^"]+)"', r["full_text"]):
                self.assertIn(t, self.by_id, (r["id"], t))
            self.assertNotIn("xref-external-reg", r["full_text"])


# ---------------------------------------------------------------------------
# Batch 5 — Regulation Number 25 (Control of Emissions from Surface Coating,
# Solvents, Asphalt, Graphic Arts and Printing, and Pharmaceuticals, 5 CCR
# 1001-29). Standard AQCC Part A/B/C shape (Part C = roman_seq statement of
# basis with bare-date openers like Reg 26/24), plus five gated additions:
# `top_after_terminal` (SOB_PART_CONFIG), SIBLING_CHAIN_REGS /
# LIST_OR_SIBLING_REGS, ITEM_TABLE_SPLICE_REGS / MULTI_CAPTION_PAGE_REGS and
# the UNCAPTIONED_TABLES `spans` / `stop_prefix` / `header_rows` / `compact`
# keys, and the APPENDIX_FIGURES map placeholders — every one keyed to "25".
# ---------------------------------------------------------------------------

REG25_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_25.txt")
REG25_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_25.pdf")


class Reg25MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["25"], "25")
        self.assertNotIn("25", ic.ECFR_REGS)
        meta = ic.REG_META["25"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["source_url"], "https://cdphe.colorado.gov/aqcc-regulations")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 25")
        self.assertEqual(
            meta["root_title"],
            "CONTROL OF EMISSIONS FROM SURFACE COATING, SOLVENTS, ASPHALT, "
            "GRAPHIC ARTS AND PRINTING, AND PHARMACEUTICALS 5 CCR 1001-29",
        )
        self.assertNotIn("no_parts", meta)
        self.assertNotIn("family", meta)

    def test_sob_part_config(self):
        cfg = ic.SOB_PART_CONFIG["25"]
        self.assertEqual((cfg["letter"], cfg["top_family"]), ("C", "roman_seq"))
        self.assertIs(cfg["top_opener_re"], ic.DATE_START_RE)
        self.assertFalse(cfg["inner_items"])
        self.assertTrue(cfg["top_after_terminal"])
        self.assertIsNotNone(cfg["top_opener_re"].match("December 18-20, 2024 (Revisions to Part A"))
        self.assertIsNone(cfg["top_opener_re"].match("The Commission adopted revisions"))
        # the new key is set nowhere else
        for reg, other in ic.SOB_PART_CONFIG.items():
            if reg != "25":
                self.assertNotIn("top_after_terminal", other, reg)

    def test_gated_sets_name_only_the_expected_regs(self):
        self.assertEqual(ic.SIBLING_CHAIN_REGS, frozenset({"8", "25"}))
        self.assertEqual(ic.LIST_OR_SIBLING_REGS, frozenset({"25"}))
        # Batch 5 merge: Reg 27 shares the set (strict mode); Reg 25 keeps merge_continuations.
        self.assertEqual(ic.ITEM_TABLE_SPLICE_REGS, frozenset({"25", "27"}))
        self.assertEqual(ic.ITEM_TABLE_SPLICE_MODE["25"], "merge_continuations")
        self.assertEqual(ic.MULTI_CAPTION_PAGE_REGS, frozenset({"25"}))
        self.assertEqual(ic.APPENDIX_SEAM_BREAK_REGS, frozenset({"25"}))
        self.assertEqual(set(ic.APPENDIX_FIGURES), {"25"})
        self.assertIn("25", ic.APPENDIX_HEADING_DEDUP_REGS)
        self.assertNotIn("25", ic.APPENDIX_TABLE_SPLICE_REGS)
        for entry in ic.UNCAPTIONED_TABLES["8"] + ic.UNCAPTIONED_TABLES["30"]:
            for key in ("spans", "stop_prefix", "header_rows", "compact"):
                self.assertNotIn(key, entry)

    def test_regulation_number_25_links_from_another_reg(self):
        text = "Part C became Regulation Number 25; Part D remained in Regulation Number 7."
        linked, _b = ic.link_citations(text, "26", {"sec-26-top-REG-26"}, ic.CORPUS_REGS, "C", "sec-26-C-I")
        self.assertIn('<a class="xref-external-reg" href="/regulations/25">Regulation Number 25</a>', linked)

    def test_regulation_number_25_is_bucketed_while_out_of_corpus(self):
        corpus = {k: v for k, v in ic.CORPUS_REGS.items() if k != "25"}
        text = "Part C became Regulation Number 25."
        linked, buckets = ic.link_citations(text, "26", {"sec-26-top-REG-26"}, corpus, "C", "sec-26-C-I")
        self.assertNotIn("/regulations/25", linked)
        self.assertEqual(buckets[ic.BUCKET_OTHER_REG]["Regulation Number 25"], 1)


class Reg25SobTopAfterTerminalTests(unittest.TestCase):
    """REG_25.txt lines 6280-6284: entry II is printed directly under entry
    I's last line ("...in the most cost-effective manner.") with no blank
    line, marker line or page seam before it."""

    LINES = [
        "PART C         Statements of Basis, Specific Statutory Authority and Purpose",
        "",
        "I.      April 20, 2023",
        "This Statement of Basis complies with the requirements of the State Administrative Procedure Act.",
        "",
        "(IV) The rules are the most cost-effective alternative to achieve the necessary reduction",
        "in air pollution and provide the regulated entity flexibility.",
        "(V) The selected regulatory alternative will maximize the air quality benefits of regulation",
        "in the most cost-effective manner.",
        "II.     December 18-20, 2024 (Revisions to Part A, Section II.C.2. and Part B,",
        "        Sections I.L.6., I.O.5., and I.P.)",
        "",
        "This Statement of Basis complies with the requirements of the State Administrative Procedure Act.",
        "",
        "III.    November 19-21, 2025 (Revisions to Part B, Section I.Q. and Repeal of Part",
        "        B, Section IV.C.)",
        "",
        "This Statement of Basis complies with the requirements of the State Administrative Procedure Act.",
    ]

    def _ids(self, reg):
        markers, _audit = ic.scan_markers(self.LINES, set(), reg)
        provisions, order, _u, _t = ic.build_provisions(reg, self.LINES, markers, {})
        return [pid for pid in order if pid.startswith(f"sec-{reg}-C-")], provisions

    def test_reg25_finds_all_three_entries(self):
        ids, provisions = self._ids("25")
        self.assertEqual(ids, ["sec-25-C-I", "sec-25-C-II", "sec-25-C-III"])
        self.assertIn("cost-effective manner.", provisions["sec-25-C-I"]["full_text"])
        self.assertNotIn("December 18-20", provisions["sec-25-C-I"]["full_text"])
        self.assertTrue(provisions["sec-25-C-II"]["full_text"].startswith("<p>December 18-20, 2024"))

    def test_same_shape_without_the_flag_fuses_entries_as_before(self):
        # Reg 26 has the identical family/opener but not the flag: entry II
        # stays fused (the pre-existing behaviour, deliberately unchanged).
        ids, _p = self._ids("26")
        self.assertEqual(ids, ["sec-26-C-I"])


class Reg25ListOrSiblingTests(unittest.TestCase):
    """A "; or" (or a bare wrapped "or" after a ";") directly before the
    open marker's immediate next sibling is a paragraph boundary for Reg 25
    only — `_label_position_plausible` alone rejects every non-seam line
    that ends in "or"."""

    LINES = [
        "PART B    Surface Coating",
        "",
        "I.     Surface Coating Operations",
        "",
        "I.A.   General Provisions",
        "",
        "       I.A.5. Compliance with the emission limitations shall be achieved by:",
        "",
        "           I.A.5.a.      Use of coatings with proportions of VOC less than or equal",
        "                  to the maximums specified by the applicable section of this",
        "                  regulation; or",
        "           I.A.5.b.      Use of the specified equipment and procedures prescribed",
        "                  by the applicable section of this regulation; or",
        "",
        "           I.A.5.c.       Use of an alternative means of control which satisfies the",
        "                  requirements of Section I.A.5.e.;",
        "                  or",
        "           I.A.5.d.      Use of crossline averaging.",
        "",
        "           I.A.5.e.       The design, operation and efficiency of any capture system",
        "                  shall be approved by the Division.",
    ]

    def _ids(self, reg):
        markers, _audit = ic.scan_markers(self.LINES, set(), reg)
        return [ic.tokens_to_citation(m["tokens"]) for m in markers if m["type"] == "item"]

    def test_prev_is_list_or_helper(self):
        self.assertTrue(ic._prev_is_list_or(["regulation; or", "I.A.5.b. x"], 1))
        self.assertTrue(ic._prev_is_list_or(["regulation, or", "I.A.5.b. x"], 1))
        self.assertTrue(ic._prev_is_list_or(["requirements;", "     or", "I.A.5.d. x"], 2))
        self.assertFalse(ic._prev_is_list_or(["subject to Sections I.A.5.a. or", "I.A.5.b. x"], 1))
        self.assertFalse(ic._prev_is_list_or(["requirements", "or", "I.A.5.d. x"], 2))
        self.assertFalse(ic._prev_is_list_or(["I.A.5.b. x"], 0))

    def test_reg25_accepts_siblings_after_list_or(self):
        self.assertEqual(self._ids("25"), ["I.", "I.A.", "I.A.5.", "I.A.5.a.", "I.A.5.b.", "I.A.5.c.", "I.A.5.d.", "I.A.5.e."])

    def test_other_regs_keep_rejecting_labels_after_or(self):
        for reg in ("7", "26", "8"):
            self.assertNotIn("I.A.5.b.", self._ids(reg), reg)
            self.assertNotIn("I.A.5.d.", self._ids(reg), reg)

    def test_wrapped_citation_list_ending_or_still_rejected_for_reg25(self):
        lines = [
            "PART B    Surface Coating",
            "",
            "I.     Surface Coating Operations",
            "",
            "       I.A.5. Sources must comply with the emission limitations of this section",
            "              and with the requirements of Sections I.A.5.a. or",
            "              I.A.6. and Part A, Section II.D., as applicable.",
            "",
            "       I.A.7. Recordkeeping.",
        ]
        markers, _audit = ic.scan_markers(lines, set(), "25")
        cites = [ic.tokens_to_citation(m["tokens"]) for m in markers if m["type"] == "item"]
        self.assertEqual(cites, ["I.", "I.A.", "I.A.5.", "I.A.7."])  # "I.A." is the gap-filled level


class Reg25LabelFixTests(unittest.TestCase):
    def test_the_three_fixes_rewrite_only_their_own_line(self):
        lines = [
            "                zxsdaI.A.5.d.(iv) The crossline averaging shall be met on a daily",
            "                      weighted average.",
            "          II.F.5.b The owner or operator of operations that use solvents that utilize a",
            "                  control device must operate and maintain the control device",
            "              IV.B.1.a.(vi “Heatset” means any lithographic or letterpress",
            "                     printing operation where printing inks are set by the",
            "              IV.B.1.a.(v) “Fountain solution” means a mixture of water,",
        ]
        out, applied = ic.apply_known_label_fixes("25", lines)
        self.assertTrue(out[0].lstrip().startswith("I.A.5.d.(iv) The crossline averaging"))
        self.assertTrue(out[2].lstrip().startswith("II.F.5.b. The owner or operator"))
        self.assertTrue(out[4].lstrip().startswith("IV.B.1.a.(vi) “Heatset” means"))
        self.assertEqual(out[0][:16], lines[0][:16])  # indent preserved
        for i in (1, 3, 5, 6):
            self.assertEqual(out[i], lines[i])
        hits = {a["old_label"]: a["hits"] for a in applied}
        self.assertEqual(hits, {"zxsdaI.A.5.d.(iv)": 1, "II.F.5.b": 1, "IV.B.1.a.(vi": 1})

    def test_every_reg_25_fix_hits_exactly_once_on_the_real_source(self):
        if not os.path.exists(REG25_TXT):
            self.skipTest("sources/REG_25.txt not present in this checkout")
        raw = open(REG25_TXT, encoding="utf-8").read()
        lines, _ = ic.clean_pages(raw)
        _, applied = ic.apply_known_label_fixes("25", lines)
        self.assertEqual(len(applied), 3)
        for a in applied:
            self.assertEqual(a["hits"], 1, a)

    def test_anomalies_documented(self):
        labels = {a["label"] for a in ic.KNOWN_LABEL_ANOMALIES["25"]}
        self.assertEqual(labels, {"I.L.1.c.(xv)", "I.L.1.c.(x)"})


class Reg25UncaptionedTableOptionsTests(unittest.TestCase):
    def test_stop_prefix_ends_the_replaced_block_before_the_footnote(self):
        own_lines = [
            "For refrigerated chillers operated below 0°C., the following requirements apply:",
            "",
            "DEGREASER WIDTH                *CALORIES/HR METER OF                BTU/HR FOOT OF",
            "Less than 1.1 meters (3.5      165                                  200",
            "Greater than 3.0 meters (10 500                                     600",
            "* Kilocalories (1 Kilocalorie = 4184.0 joules)",
            "",
            "For refrigerated chillers operating above 0°C., there shall be at least 415 Calories/Hr.",
        ]
        cap = "Minimum cooling capacities for refrigerated freeboard chillers"
        hits = {"used": 0, "captions_used": []}
        out = ic._swap_uncaptioned_table(own_lines, "sec-25-B-APPENDIX-D", "25",
                                         {cap: {"caption": cap, "rows": [["a"]]}}, hits)
        self.assertEqual(out, own_lines[:2] + ["", ic._TABLE_SENTINEL + cap, ""] + own_lines[5:])
        self.assertEqual(hits["used"], 1)

    def test_drop_repeated_leading_rows_drops_the_whole_header_block(self):
        first = [["Coating category", "Air dried", None], [None, "kg VOC/l", "lb VOC/gal"], ["Camouflage", "0.80", "6.67"]]
        cont = [["Coating category", "Air dried", None], [None, "kg VOC/l", "lb VOC/gal"], ["Metallic", "0.80", "6.67"]]
        self.assertEqual(ic._drop_repeated_leading_rows(first, cont), [["Metallic", "0.80", "6.67"]])
        # a one-row header is still just one row dropped
        self.assertEqual(ic._drop_repeated_leading_rows([["h", "h2"], ["x", "1"]], [["h", "h2"], ["y", "2"]]), [["y", "2"]])
        self.assertEqual(ic._drop_repeated_leading_rows([], [["h"]]), [["h"]])

    def test_merge_header_rows_joins_column_wise(self):
        rows = [
            ["Industrial Finishing Categories", "", "Lb VOC per", "", "", "Lb VOC per", "", "Kg VOC per\nLiter of Solids"],
            [None, None, "Gallon Coating", None, None, "Gallon of", None, None],
            [None, None, "less water", None, None, "Solids", None, None],
            ["Can Industry", None, None, None, None, None, None, None],
            ["End sealing compound", "3.7", None, None, "7.4", None, None, "0.88"],
        ]
        merged = ic._merge_header_rows(rows, 3)
        self.assertEqual(merged[0], ["Industrial Finishing Categories", "", "Lb VOC per Gallon Coating less water", "",
                                     "", "Lb VOC per Gallon of Solids", "", "Kg VOC per Liter of Solids"])
        self.assertEqual(merged[1:], rows[3:])
        self.assertEqual(ic._merge_header_rows(rows, 1), rows)
        compact = [[c for c in r if (c or "").strip()] for r in merged]
        self.assertEqual(compact[1], ["Can Industry"])
        self.assertEqual(compact[2], ["End sealing compound", "3.7", "7.4", "0.88"])

    def test_reg25_uncaptioned_entries_are_unique_and_well_formed(self):
        entries = ic.UNCAPTIONED_TABLES["25"]
        captions = [e["caption"] for e in entries]
        self.assertEqual(len(captions), len(set(captions)))
        self.assertEqual(len(entries), 14)
        for e in entries:
            self.assertTrue(e["row_id"].startswith("sec-25-"))
            self.assertTrue(bool(e.get("to_end")) != bool(e.get("stop_prefix")), e["row_id"])
        tracking = next(e for e in entries if e["row_id"] == "sec-25-C-I")
        self.assertEqual(tracking["spans"], [(p, 0) for p in range(121, 132)])
        appx_e = next(e for e in entries if e["row_id"] == "sec-25-B-APPENDIX-E")
        self.assertEqual((appx_e["spans"], appx_e["header_rows"], appx_e["compact"]), ([(118, 0), (119, 0)], 3, True))


class Reg25ItemTableSpliceTests(unittest.TestCase):
    """Two tables in one item row, and a reprinted continuation caption."""

    T3 = "Table 3 – Motor vehicle materials VOC content limits"
    T4 = "Table 4 – Automotive coatings VOC content limits"
    TABLES = {
        T3: {"caption": T3, "rows": [["Coating Category", "kg", "lbs"], ["Motor vehicle cavity\nwax", "0.65", "5.4"],
                                     ["Motor vehicle sealer", "0.65", "5.4"]]},
        T4: {"caption": T4, "rows": [["Coating Category", "g/l", "lbs"], ["Adhesion promoter", "540", "4.5"],
                                     ["Clear coating", "250", "2.1"]]},
    }
    OWN = [
        "                material, then the most stringent emission limitation applies.",
        "",
        "               Table 3 – Motor vehicle materials VOC content limits",
        "",
        "               Coating Category          kg VOC/liter coating   lbs VOC/gal coating",
        "",
        "               Motor vehicle cavity              0.65                    5.4",
        "               wax",
        "",
        "               Motor vehicle sealer              0.65                    5.4",
        "               Table 3 – Motor vehicle materials VOC content limits",
        "",
        "               Coating Category          kg VOC/liter coating   lbs VOC/gal coating",
        "               Motor vehicle sealer              0.65                    5.4",
        "",
        "",
        "                 Table 4 – Automotive coatings VOC content limits",
        "",
        "                 Coating Category           grams/liter          lbs/gallon (minus",
        "                 Adhesion promoter                     540                4.5",
        "                 Clear coating                         250                2.1",
        "",
        "    A closing paragraph.",
    ]

    def test_splice_with_merge_continuations(self):
        hits = {"used": 0, "captions_used": []}
        out = ic._splice_appendix_tables(list(self.OWN), "25", self.TABLES, hits, merge_continuations=True)
        sentinels = [ln for ln in out if ln.startswith(ic._TABLE_SENTINEL)]
        self.assertEqual(sentinels, [ic._TABLE_SENTINEL + self.T3, ic._TABLE_SENTINEL + self.T4])
        self.assertEqual(hits["captions_used"], [self.T3, self.T4])
        text = " ".join(ln for ln in out if not ln.startswith(ic._TABLE_SENTINEL))
        self.assertNotIn("Motor vehicle", text)
        self.assertNotIn("Adhesion promoter", text)
        self.assertNotIn("Coating Category", text)
        self.assertIn("most stringent emission limitation applies", text)
        self.assertIn("A closing paragraph.", text)

    def test_without_merge_a_reprinted_caption_is_a_second_table(self):
        # the Reg 9 behaviour, unchanged
        hits = {"used": 0, "captions_used": []}
        out = ic._splice_appendix_tables(list(self.OWN), "9", self.TABLES, hits)
        # the reprinted caption line, printed right under the last data row,
        # is eaten by the wrapped-cell loop and its page's dump stays as text
        self.assertEqual(hits["captions_used"], [self.T3, self.T4])
        self.assertIn("               Coating Category          kg VOC/liter coating   lbs VOC/gal coating", out)

    def test_item_branch_uses_the_splice_only_for_reg25(self):
        lines = [
            "PART B    Surface Coating",
            "",
            "I.     Surface Coating Operations",
            "",
            "       I.P.4. Limits",
            "",
            "         I.P.4.d.     If more than one emission limitation applies to a specific",
            "                material, then the most stringent emission limitation applies.",
        ] + self.OWN[1:]
        for reg, expect_t4 in (("25", True), ("7", False)):
            markers, _a = ic.scan_markers(lines, set(), reg)
            provisions, _o, _u, hits = ic.build_provisions(reg, lines, markers, self.TABLES)
            text = provisions[f"sec-{reg}-B-I-P-4-d"]["full_text"]
            self.assertIn(self.T3, text, reg)
            self.assertEqual(self.T4 in text, expect_t4, reg)
            self.assertEqual("A closing paragraph." in text, expect_t4, reg)
            self.assertEqual(text.count('<table class="doc-table">'), 2 if expect_t4 else 1, reg)


class Reg25AppendixFigureTests(unittest.TestCase):
    def test_placeholder_inserted_after_each_map_title_only_for_that_row(self):
        paras = ["II. Maps", "Denver Metropolitan Area and North Front Range (2008 Ozone NAAQS)",
                 "Denver Metropolitan Area and North Front Range and  northern Weld County (2015 ozone NAAQS)"]
        out = ic._insert_figure_placeholders(paras, "25", "sec-25-A-APPENDIX-A")
        self.assertEqual(len(out), 5)
        self.assertTrue(out[2].startswith(ic._FIGURE_SENTINEL))
        self.assertTrue(out[4].startswith(ic._FIGURE_SENTINEL))
        self.assertIn("page 16", out[4])
        self.assertEqual(ic._insert_figure_placeholders(paras, "25", "sec-25-B-APPENDIX-D"), paras)
        self.assertEqual(ic._insert_figure_placeholders(paras, "26", "sec-26-A-APPENDIX-A"), paras)

    def test_placeholder_html_shape_matches_the_ecfr_convention(self):
        html = ic._figure_placeholder_html("Map not reproduced — see REG_25.pdf page 15: <x>")
        self.assertTrue(html.startswith('<p class="figure-omitted">[Map not reproduced'))
        self.assertIn("&lt;x&gt;", html)

    def test_seam_break_splits_the_appendix_at_page_boundaries(self):
        lines = [
            "PART A        Applicability and General Provisions",
            "",
            "I.     Applicability",
            "",
            "Appendix A Colorado Ozone Nonattainment or Attainment Maintenance Areas",
            "",
            "I.      Chronology of Attainment Status",
            "",
            "12/31/2021 EPA modification of the 9 county Denver Metropolitan Area 8-hour ozone",
            "      nonattainment designation (2015 NAAQS) to include the portion of northern Weld",
            "      County defined in Part A",
            "II.   Maps",
            "",
            "Denver Metropolitan Area and North Front Range (2008 Ozone NAAQS)",
            "Denver Metropolitan Area and North Front Range and northern Weld County",
            "(2015 ozone NAAQS)",
            "",
            "PART B    Surface Coating",
            "",
            "I.     Surface Coating Operations",
        ]
        seams = {11, 14}
        for reg in ("25", "26"):
            markers, _a = ic.scan_markers(lines, seams, reg)
            provisions, _o, _u, _h = ic.build_provisions(reg, lines, markers, {}, seams)
            text = provisions[f"sec-{reg}-A-APPENDIX-A"]["full_text"]
            if reg == "25":
                self.assertIn("</p><p>II. Maps</p><p>Denver Metropolitan Area and North Front Range (2008 Ozone NAAQS)</p>"
                              '<p class="figure-omitted">', text)
                self.assertEqual(text.count("figure-omitted"), 2)
            else:
                self.assertIn("Part A</span> II. Maps</p>", text)
                self.assertNotIn("figure-omitted", text)

    def test_build_provisions_seam_starts_defaults_to_none(self):
        # the new optional parameter must not change any call that omits it
        import inspect
        sig = inspect.signature(ic.build_provisions)
        self.assertIs(sig.parameters["seam_starts"].default, None)


class Reg25FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(REG25_TXT) or not os.path.exists(REG25_PDF):
            raise unittest.SkipTest("sources/REG_25.* not present in this checkout")
        (cls.rows, cls.unresolved, cls.table_hits, cls.n_tables, cls.dupes, cls.fixes, cls.anomalies,
         cls.audit) = ic.parse_reg("25", REG25_TXT, REG25_PDF)
        cls.by_id = {r["id"]: r for r in cls.rows}

    def test_structure(self):
        top = [r["id"] for r in self.rows if r["parent_id"] == "sec-25-top-REG-25"]
        self.assertEqual(top, ["sec-25-P-A", "sec-25-A-APPENDIX-A", "sec-25-P-B",
                               "sec-25-B-APPENDIX-D", "sec-25-B-APPENDIX-E", "sec-25-P-C"])
        self.assertEqual([r["id"] for r in self.rows if r["parent_id"] == "sec-25-P-A"], ["sec-25-A-I", "sec-25-A-II"])
        self.assertEqual([r["id"] for r in self.rows if r["parent_id"] == "sec-25-P-B"],
                         ["sec-25-B-I", "sec-25-B-II", "sec-25-B-III", "sec-25-B-IV", "sec-25-B-V"])
        self.assertEqual([r["id"] for r in self.rows if r["parent_id"] == "sec-25-P-C"],
                         ["sec-25-C-I", "sec-25-C-II", "sec-25-C-III"])
        self.assertEqual(self.by_id["sec-25-B-I"]["title"], "I. Surface Coating Operations")
        self.assertEqual(self.by_id["sec-25-top-REG-25"]["title"], ic.REG_META["25"]["root_title"])

    def test_sob_entries_are_three_undivided_rows(self):
        c_rows = [r for r in self.rows if r["id"].startswith("sec-25-C-") ]
        self.assertEqual([r["id"] for r in c_rows], ["sec-25-C-I", "sec-25-C-II", "sec-25-C-III"])
        self.assertTrue(self.by_id["sec-25-C-I"]["full_text"].startswith("<p>April 20, 2023"))
        self.assertTrue(self.by_id["sec-25-C-II"]["full_text"].startswith("<p>December 18-20, 2024"))
        self.assertTrue(self.by_id["sec-25-C-III"]["full_text"].startswith("<p>November 19-21, 2025"))
        self.assertIn("Regulation 7 rule-history tracking table", self.by_id["sec-25-C-I"]["full_text"])
        for r in self.rows:
            self.assertLess(len(r["full_text"]), 20000, r["id"])

    def test_duplicates_fixes_anomalies(self):
        self.assertEqual(self.dupes, ["sec-25-B-I-L-1-c-(xv)"])
        self.assertTrue(all(f["hits"] == 1 for f in self.fixes), self.fixes)
        self.assertEqual(len(self.fixes), 3)
        xv = re.sub(r"<[^>]+>", " ", self.by_id["sec-25-B-I-L-1-c-(xv)"]["full_text"])
        self.assertIn("High-Performance Architectural Coating", xv)
        self.assertIn("Metallic Coating", xv)
        self.assertNotIn("sec-25-B-I-L-1-c-(x)", self.by_id)
        self.assertIn("sec-25-B-I-L-1-c-(xxvi)", self.by_id)

    def test_recovered_labels_present(self):
        for pid in ("sec-25-B-I-A-5-d-(iv)", "sec-25-B-II-F-5-b", "sec-25-B-IV-B-1-a-(vi)",
                    "sec-25-B-I-A-5-b", "sec-25-B-I-O-3-a-(iii)-(C)", "sec-25-B-IV-A-3-a-(v)",
                    "sec-25-B-I-N-4-a-(ii)", "sec-25-B-I-N-4-a-(ii)-(A)", "sec-25-B-I-N-4-a-(ii)-(B)",
                    "sec-25-B-IV-B-1-a-(v)", "sec-25-B-V-B-4-b", "sec-25-B-I-Q-2-mmmm"):
            self.assertIn(pid, self.by_id, pid)
        self.assertTrue(self.by_id["sec-25-B-I-A-5-b"]["full_text"].startswith("<p>Use of the specified equipment"))

    def test_every_parent_resolves_and_no_furniture(self):
        for r in self.rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], self.by_id, r["id"])
            self.assertNotRegex(r["full_text"], r"CODE OF COLORADO REGULATIONS")

    def test_all_nineteen_tables_rendered(self):
        self.assertEqual(self.n_tables, 19)
        self.assertEqual(self.table_hits["used"], 19)
        t1 = self.by_id["sec-25-B-I-L-2-b-(ii)"]["full_text"]
        t2 = self.by_id["sec-25-B-I-L-2-b-(iii)"]["full_text"]
        self.assertEqual(t1.count('<table class="doc-table">'), 1)
        self.assertEqual(t1.count("<tr>"), 26)   # 2 header rows + 24 coating categories
        self.assertEqual(t2.count("<tr>"), 27)   # 2 header rows + 25 (14 on page 41 + 11 on page 42)
        self.assertIn("<td>Drum coating, reconditioned, interior</td><td>1.17</td><td>9.78</td><td>1.17</td><td>9.78</td>", t1)
        self.assertIn("<td>Pan backing</td><td>0.42</td><td>3.5</td><td>0.42</td><td>3.5</td>", t2)
        self.assertNotIn("Electric-insulating varnish 0.80", re.sub(r"<[^>]+>", " ", t1))
        p4d = self.by_id["sec-25-B-I-P-4-d"]["full_text"]
        self.assertEqual(p4d.count('<table class="doc-table">'), 2)
        self.assertIn("Table 4 – Automotive coatings VOC content limits", p4d)
        self.assertIn("<td>Truck bedliner coating</td><td>310</td><td>2.6</td>", p4d)
        self.assertNotIn("lubricating wax/compound</p>", p4d)
        t5 = self.by_id["sec-25-B-I-Q-3-a-(ii)"]["full_text"]
        self.assertEqual(t5.count("<tr>"), 58)   # header + 57 coating types
        self.assertIn("<td>Maskants – bonding maskant</td><td>1230</td>", t5)
        for pid, cell in (("sec-25-B-I-B-3", "<td>Prime application, flashoff area, and oven</td><td>0.23</td><td>1.9</td>"),
                          ("sec-25-B-I-C-3", "<td>Three-piece can side-seam spray</td><td>0.66</td><td>5.5</td>"),
                          ("sec-25-B-I-K-3", "<td>Vinyl Coating Line</td><td>0.45</td><td>3.8</td>"),
                          ("sec-25-B-V-B-1", "<td>Greater than 300(Greater than 5.8)</td><td>-25°C(-13°F)</td>"),
                          ("sec-25-B-APPENDIX-D", "<td>Greater than 3.0 meters (10</td><td>500</td><td>600</td>"),
                          ("sec-25-B-APPENDIX-E", "<td>Three-piece can side-seam spray</td><td>5.5</td><td>21.7</td><td>2.61</td>"),
                          ("sec-25-C-I", "<td>1995</td><td>Dec. 21</td>")):
            self.assertIn(cell, self.by_id[pid]["full_text"], pid)
        appx_e = self.by_id["sec-25-B-APPENDIX-E"]["full_text"]
        self.assertIn("<th>Lb VOC per Gallon Coating less water</th>", appx_e)
        self.assertIn("<tr><td>Can Industry</td></tr>", appx_e)
        # the footnotes after Appendix D's and V.B.1.'s tables survive as text
        self.assertIn("* Kilocalories (1 Kilocalorie = 4184.0 joules)", self.by_id["sec-25-B-APPENDIX-D"]["full_text"])
        self.assertIn("**But not including the maximum value of the range.", self.by_id["sec-25-B-V-B-1"]["full_text"])
        self.assertIn("The Commission also made typographical", self.by_id["sec-25-C-I"]["full_text"])
        # the tracking table is one table with 25 dated rule rows
        tracking = self.by_id["sec-25-C-I"]["full_text"]
        self.assertEqual(tracking.count('<table class="doc-table">'), 1)
        self.assertEqual(len(re.findall(r"<tr><td>(?:19|20)\d\d</td>", tracking)), 25)

    def test_appendix_rows(self):
        a = self.by_id["sec-25-A-APPENDIX-A"]["full_text"]
        self.assertEqual(a.count('<p class="figure-omitted">'), 2)
        self.assertIn("<p>II. Maps</p>", a)
        d = self.by_id["sec-25-B-APPENDIX-D"]["full_text"]
        self.assertTrue(d.startswith("Appendix D — Minimum Cooling Capacities for Refrigerated Freeboard Chillers on Vapor Degreasers<p>The specifications"))
        self.assertNotIn("<p>Vapor Degreasers</p>", d)

    def test_cross_references(self):
        joined = "".join(r["full_text"] for r in self.rows)
        for reg in ("3", "7", "22", "24", "26"):
            self.assertIn(f'href="/regulations/{reg}"', joined, reg)
        self.assertIn('<span class="xref" data-target="sec-25-B-I-A-5-d">Section I.A.5.d.</span>', joined)
        # Batch 5 merge: Reg 27 is in the corpus, so the one "Regulation
        # Number 27" mention (sec-25-C-I) is now an anchor, not a bucket hit.
        self.assertIn('<a class="xref-external-reg" href="/regulations/27">Regulation Number 27</a>',
                      self.by_id["sec-25-C-I"]["full_text"])
        self.assertNotIn("Regulation Number 27", self.unresolved[ic.BUCKET_OTHER_REG])
        self.assertEqual(self.unresolved[ic.BUCKET_CFR]["40 CFR Part 60"], 10)
        for r in self.rows:
            for target in re.findall(r'data-target="([^"]+)"', r["full_text"]):
                self.assertIn(target, self.by_id, (r["id"], target))


# ---------------------------------------------------------------------------
# Batch 5 — Regulation Number 27 (GHG Emissions and Energy Management for
# Manufacturing, 5 CCR 1001-31). See BATCH5_BRIEF.md and REPORT.md.
# ---------------------------------------------------------------------------

REG27_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_27.txt")
REG27_PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources", "REG_27.pdf")


class Reg27MetaTests(unittest.TestCase):
    def test_corpus_and_meta_entries(self):
        self.assertEqual(ic.CORPUS_REGS["27"], "27")
        meta = ic.REG_META["27"]
        self.assertEqual(meta["jurisdiction_level"], "state")
        self.assertEqual(meta["issuing_body"], "CDPHE-APCD")
        self.assertEqual(meta["source_url"], "https://cdphe.colorado.gov/aqcc-regulations")
        self.assertEqual(meta["root_citation"], "Code of Colorado Regulations · Regulation Number 27")
        self.assertEqual(meta["root_title"],
                         "GREENHOUSE GAS EMISSIONS AND ENERGY MANAGEMENT FOR MANUFACTURING 5 CCR 1001-31")
        self.assertNotIn("no_parts", meta)
        self.assertTrue(meta["seam_standalone_line_breaks"])
        self.assertTrue(meta["triple_letter_labels"])
        # Both flags are Reg 27's alone (clean_pages / family_regex_for are
        # byte-identical elsewhere).
        for reg, m in ic.REG_META.items():
            if reg != "27":
                self.assertNotIn("seam_standalone_line_breaks", m, reg)
                self.assertNotIn("triple_letter_labels", m, reg)

    def test_triple_letter_labels_tokenize_only_for_reg_27(self):
        self.assertIs(ic.family_regex_for("27"), ic.FAMILY_REGEX_TRIPLE_UPPER)
        for reg in ("30", "26", "7", "3", "22", "1", "cp", "9", None):
            self.assertIs(ic.family_regex_for(reg), ic.FAMILY_REGEX, reg)
        self.assertIs(ic.family_regex_for("gp12"), ic.FAMILY_REGEX_NO_TRAILING_DOT)
        line = "II.AAA. “Process” means a specific operation at an EITE stationary source"
        toks, consumed = ic.tokenize_by_cycle(line, ic.CYCLE_AB, ic.family_regex_for("27"))
        self.assertEqual(toks, [("roman", "II"), ("upper", "AAA")])
        self.assertEqual(line[consumed:].strip(), "“Process” means a specific operation at an EITE stationary source")
        # "II.III." is the 61st term ("Residential building unit"), an upper
        # token at depth 2, not a second roman numeral.
        toks, _ = ic.tokenize_by_cycle("II.III.   “Residential building unit” means", ic.CYCLE_AB, ic.family_regex_for("27"))
        self.assertEqual(toks, [("roman", "II"), ("upper", "III")])
        self.assertEqual(ic.tokens_to_id_suffix(toks), "II-III")
        # the plain table (every other reg) stops at two letters, as before
        toks, _ = ic.tokenize_by_cycle(line, ic.CYCLE_AB)
        self.assertEqual(toks, [("roman", "II")])
        # the variant is otherwise the same table
        for fam in ic.FAMILY_REGEX:
            if fam != "upper":
                self.assertIs(ic.FAMILY_REGEX_TRIPLE_UPPER[fam], ic.FAMILY_REGEX[fam])

    def test_sob_part_config(self):
        cfg = ic.SOB_PART_CONFIG["27"]
        self.assertEqual((cfg["letter"], cfg["top_family"]), ("E", "roman_seq"))
        self.assertIs(cfg["inner_items"], False)
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted: October 22, 2021"))
        self.assertIsNotNone(cfg["top_opener_re"].match("Adopted: December 18-20, 2024"))
        self.assertIsNone(cfg["top_opener_re"].match("(Removed from Regulation Number 22"))

    def test_regulation_number_27_links_from_other_regs(self):
        html, buckets = ic.link_citations(
            "as defined and established in Regulation Number 27, Part D to achieve",
            "7", {"sec-7-top-REG-7"}, set(ic.CORPUS_REGS))
        self.assertIn('<a class="xref-external-reg" href="/regulations/27">Regulation Number 27</a>', html)
        self.assertEqual(dict(buckets[ic.BUCKET_OTHER_REG]), {})
        # ...and stays a bucket hit while 27 is held out of the corpus.
        html2, buckets2 = ic.link_citations(
            "as defined and established in Regulation Number 27, Part D to achieve",
            "7", {"sec-7-top-REG-7"}, set(ic.CORPUS_REGS) - {"27"})
        self.assertNotIn("/regulations/27", html2)
        self.assertEqual(dict(buckets2[ic.BUCKET_OTHER_REG]), {"Regulation Number 27, Part D": 1})

    def test_self_reference_links_to_root(self):
        html, _ = ic.link_citations("the requirements of Regulation Number 27 continue to apply",
                                    "27", {"sec-27-top-REG-27"}, set(ic.CORPUS_REGS))
        self.assertIn('<span class="xref" data-target="sec-27-top-REG-27">Regulation Number 27</span>', html)

    def test_table_configs_are_reg_27_only(self):
        # Batch 5 merge: Reg 25 shares the set (merge_continuations mode); Reg 27 keeps strict.
        self.assertEqual(ic.ITEM_TABLE_SPLICE_REGS, frozenset({"25", "27"}))
        self.assertEqual(ic.ITEM_TABLE_SPLICE_MODE["27"], "strict")
        self.assertEqual(set(ic.TABLE_CAPTION_PINS), {"27"})
        self.assertEqual([c for c, _p, _i in ic.TABLE_CAPTION_PINS["27"]], ["Table 2", "Table 3", "Table 4"])
        self.assertEqual([e["row_id"] for e in ic.UNCAPTIONED_TABLES["27"]], ["sec-27-E-IV"])
        self.assertIn("end_prefix", ic.UNCAPTIONED_TABLES["27"][0])
        self.assertNotIn("27", ic.TABLE_CAPTION_EXTRA_RE)
        self.assertNotIn("27", ic.APPENDIX_TABLE_SPLICE_REGS)


class Reg27LabelFixTests(unittest.TestCase):
    def test_i_a_1_d_is_rewritten_to_ii_a_1_d(self):
        lines = [
            "                 I.A.1.d. The difference in metric tons of CO2e between the GEMM 2 facility’s GEMM 2",
            "                          annual GHG emissions requirement for 2030 and its GEMM 2 annual GHG",
        ]
        out, applied = ic.apply_known_label_fixes("27", lines)
        self.assertTrue(out[0].lstrip().startswith("II.A.1.d. The difference in metric tons"))
        self.assertEqual(len(out[0]) - len(out[0].lstrip()), 17)  # indent kept
        self.assertEqual(out[1], lines[1])
        hits = {a["old_label"]: a["hits"] for a in applied}
        self.assertEqual(hits["I.A.1.d."], 1)
        self.assertEqual(hits["II.D.1"], 0)

    def test_ii_d_1_gains_its_trailing_period(self):
        lines = ["        II.D.1   Each manufacturing stationary source and midstream segment company must designate"]
        out, applied = ic.apply_known_label_fixes("27", lines)
        self.assertTrue(out[0].lstrip().startswith("II.D.1.   Each manufacturing"))
        toks, _ = ic.tokenize_by_cycle(out[0].strip(), ic.CYCLE_AB)
        self.assertEqual(toks, [("roman", "II"), ("upper", "D"), ("digit", "1")])

    def test_every_reg_27_fix_hits_exactly_once_on_the_real_source(self):
        if not os.path.exists(REG27_TXT):
            self.skipTest("sources/REG_27.txt not present in this checkout")
        raw = open(REG27_TXT, encoding="utf-8").read()
        lines, _ = ic.clean_pages(raw, "27")
        _, applied = ic.apply_known_label_fixes("27", lines)
        self.assertEqual(len(applied), 2)
        for a in applied:
            self.assertEqual(a["hits"], 1, a)


class Reg27SeamStandaloneLineBreakTests(unittest.TestCase):
    """REG_META["27"]["seam_standalone_line_breaks"]: a page that opens with a
    one-line paragraph gets a paragraph break at the seam; a page that opens
    with a wrapped continuation does not; every other reg is untouched."""

    PAGE1 = "PART E   Statements\n\nsome prose that ends here.\n\n\n   12\n"
    PAGE2_HEADING = "CODE OF COLORADO REGULATIONS   5 CCR 1001-31\nAir Quality Control Commission\n\n\nPurpose\n\nIn 2021 the Commission adopted.\n"
    PAGE2_WRAP = "CODE OF COLORADO REGULATIONS   5 CCR 1001-31\nAir Quality Control Commission\n\n\nbetween.\nnext paragraph line one\n"

    def test_heading_at_page_top_gets_a_break_for_reg_27(self):
        lines, seams = ic.clean_pages(self.PAGE1 + ic.FF + self.PAGE2_HEADING, "27")
        self.assertEqual(lines, ["PART E   Statements", "", "some prose that ends here.", "",
                                 "Purpose", "", "In 2021 the Commission adopted."])
        self.assertEqual(seams, {4})  # the real first line, not the inserted blank
        self.assertEqual(ic.split_into_paragraphs(lines[2:]),
                         ["some prose that ends here.", "Purpose", "In 2021 the Commission adopted."])

    def test_wrapped_last_line_at_page_top_is_still_joined_for_reg_27(self):
        lines, seams = ic.clean_pages(self.PAGE1 + ic.FF + self.PAGE2_WRAP, "27")
        self.assertEqual(lines[2:], ["some prose that ends here.", "between.", "next paragraph line one"])
        self.assertEqual(seams, {3})

    def test_single_line_page_gets_a_break_for_reg_27(self):
        lines, seams = ic.clean_pages(self.PAGE1 + ic.FF + "Air Quality Control Commission\n\nOnly line\n\n\n", "27")
        self.assertEqual(lines[2:], ["some prose that ends here.", "", "Only line"])
        self.assertEqual(seams, {4})

    def test_no_break_after_a_blank_line(self):
        # The previous page's last surviving line is never blank (trailing
        # blanks are stripped), but the guard is explicit: nothing doubles up.
        lines, _ = ic.clean_pages("a.\n\n" + ic.FF + "B\n\nc", "27")
        self.assertEqual(lines, ["a.", "", "B", "", "c"])

    def test_other_regs_unchanged(self):
        text = self.PAGE1 + ic.FF + self.PAGE2_HEADING
        for reg in ("30", "26", "7", "3", "22", "1", "cp", "ecmc", None):
            lines, seams = ic.clean_pages(text, reg)
            self.assertEqual(lines, ["PART E   Statements", "", "some prose that ends here.",
                                     "Purpose", "", "In 2021 the Commission adopted."], reg)
            self.assertEqual(seams, {3}, reg)


class Reg27StrictTableSpliceTests(unittest.TestCase):
    """`_splice_appendix_tables(strict=True)` — the ITEM_TABLE_SPLICE_REGS
    path: wrapped first-column keys match by their first physical line, the
    table ends at the first non-key paragraph, a page seam bounds a key row's
    continuation run, and prose before/after every table survives."""

    TABLE5 = {"caption": "Table 5", "rows": [
        ["GEMM 2 Facility\nPercent\nContribution", "GEMM 2 Annual GHG Emissions Requirement in 2030 and\nbeyond"],
        ["30% or greater", "6% less than the GEMM 2 facility GHG baseline emissions"],
        ["At least 20% but\nless than 30%", "5% less than the GEMM 2 facility GHG baseline emissions"],
    ]}
    OWN = [
        "        intro sentence mentioning Table 5.",
        "",
        "                                  Table 5",
        "",
        "                GEMM 2 Facility       GEMM 2 Annual GHG Emissions Requirement in 2030 and",
        "                   Percent                                beyond",
        "                 Contribution",
        "",
        "                 30% or greater         6% less than the GEMM 2 facility GHG baseline emissions",
        "",
        "                At least 20% but",
        "                 less than 30%          5% less than the GEMM 2 facility GHG baseline emissions",
        "",
        "Prose after the table that must survive.",
        "second line of that prose.",
    ]

    def test_strict_mode_keeps_prose_after_the_table(self):
        hits = {"used": 0, "captions_used": []}
        out = ic._splice_appendix_tables(list(self.OWN), "27", {"Table 5": self.TABLE5}, hits, strict=True)
        self.assertEqual(hits["captions_used"], ["Table 5"])
        paras = ic.split_into_paragraphs(out)
        self.assertEqual(paras, ["intro sentence mentioning Table 5.",
                                 ic._TABLE_SENTINEL + "Table 5",
                                 "Prose after the table that must survive. second line of that prose."])

    def test_non_strict_mode_is_the_old_behaviour(self):
        # Multi-line keys never match a single line in the old (Reg 9) mode,
        # so the "At least 20% but" rows are left behind as prose — exactly
        # what the strict flag exists to fix; the old path itself is unchanged.
        hits = {"used": 0, "captions_used": []}
        out = ic._splice_appendix_tables(list(self.OWN), "27", {"Table 5": self.TABLE5}, hits)
        paras = ic.split_into_paragraphs(out)
        self.assertEqual(paras[1], ic._TABLE_SENTINEL + "Table 5")
        self.assertTrue(paras[2].startswith("At least 20% but less than 30%"))

    def test_seam_bounds_a_key_rows_continuation_run(self):
        table = {"caption": "TABLE 1", "rows": [["Facility Name", "x"], ["Yuma Ethanol, LLC", "55,500"]]}
        own = ["TABLE 1", "", "Facility Name       x", "", "Yuma Ethanol, LLC        55,500",
               "In establishing the criteria the Commission considered", "more of that paragraph.", "", "Next."]
        hits = {"used": 0, "captions_used": []}
        # Without the seam the page-top paragraph reads as a wrapped cell...
        out = ic._splice_appendix_tables(list(own), "27", {"TABLE 1": table}, hits, strict=True)
        self.assertEqual(ic.split_into_paragraphs(out), [ic._TABLE_SENTINEL + "TABLE 1", "Next."])
        # ...and with it (index 5 starts a new page) the paragraph survives.
        out = ic._splice_appendix_tables(list(own), "27", {"TABLE 1": table}, hits, strict=True, seam_starts={5})
        self.assertEqual(ic.split_into_paragraphs(out),
                         [ic._TABLE_SENTINEL + "TABLE 1",
                          "In establishing the criteria the Commission considered more of that paragraph.", "Next."])

    def test_unrecovered_caption_is_left_as_text(self):
        hits = {"used": 0, "captions_used": []}
        out = ic._splice_appendix_tables(list(self.OWN), "27", {}, hits, strict=True)
        self.assertEqual(out, self.OWN)
        self.assertEqual(hits["used"], 0)


class Reg27UncaptionedEndPrefixTests(unittest.TestCase):
    def test_end_prefix_replaces_only_the_block_between_the_markers(self):
        own = ["prose before.", "", "                 DE = (CP + GL) x GE", "                 where:",
               "Step 1:    Displaced electricity emissions   DE   CP = CHP electricity production", "", "",
               "                 AD = DT / DU x AT", "Step 6:    Direct stationary avoided emissions   AD",
               "                 AT = Total avoided emissions", "", "", "Transparency", "", "prose after."]
        caption = ic.UNCAPTIONED_TABLES["27"][0]["caption"]
        hits = {"used": 0, "captions_used": []}
        out = ic._swap_uncaptioned_table(own, "sec-27-E-IV", "27", {caption: {"caption": caption, "rows": [["a"]]}}, hits)
        self.assertEqual(ic.split_into_paragraphs(out),
                         ["prose before.", ic._TABLE_SENTINEL + caption, "Transparency", "prose after."])
        self.assertEqual(hits["used"], 1)

    def test_end_prefix_missing_leaves_the_row_untouched(self):
        own = ["prose before.", "", "DE = (CP + GL) x GE", "no end marker here", "", "prose after."]
        caption = ic.UNCAPTIONED_TABLES["27"][0]["caption"]
        hits = {"used": 0, "captions_used": []}
        out = ic._swap_uncaptioned_table(list(own), "sec-27-E-IV", "27", {caption: {"caption": caption, "rows": [["a"]]}}, hits)
        self.assertEqual(out, own)
        self.assertEqual(hits["used"], 0)

    def test_other_rows_and_regs_untouched(self):
        own = ["DE = (CP + GL) x GE", "AT = Total avoided emissions"]
        caption = ic.UNCAPTIONED_TABLES["27"][0]["caption"]
        tables = {caption: {"caption": caption, "rows": [["a"]]}}
        hits = {"used": 0, "captions_used": []}
        self.assertEqual(ic._swap_uncaptioned_table(list(own), "sec-27-E-I", "27", tables, hits), own)
        self.assertEqual(ic._swap_uncaptioned_table(list(own), "sec-27-E-IV", "30", tables, hits), own)
        self.assertEqual(hits["used"], 0)


class Reg27FullParseTests(unittest.TestCase):
    """End-to-end parse of the real source (skipped when it's not present)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(REG27_TXT):
            raise unittest.SkipTest("sources/REG_27.txt not present in this checkout")
        pdf = REG27_PDF if os.path.exists(REG27_PDF) else None
        (cls.rows, cls.unresolved, cls.table_hits, cls.n_tables, cls.dupes, cls.fixes, _an, _audit) = ic.parse_reg(
            "27", REG27_TXT, pdf
        )
        cls.by_id = {r["id"]: r for r in cls.rows}
        cls.has_pdf = pdf is not None

    @staticmethod
    def _visible(html):
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))

    def test_row_counts_and_structure(self):
        kinds = {}
        for r in self.rows:
            kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
        self.assertEqual(kinds, {"root": 1, "part": 5, "section": 23, "item": 384})
        self.assertEqual(len(self.rows), 413)
        parts = [r["id"] for r in self.rows if r["kind"] == "part"]
        self.assertEqual(parts, [f"sec-27-P-{p}" for p in "ABCDE"])
        top = {p: [r["citation"] for r in self.rows if r["parent_id"] == f"sec-27-P-{p}"] for p in "ABCDE"}
        self.assertEqual(top, {
            "A": ["I.", "II.", "III."], "B": ["I.", "II.", "III.", "IV.", "V."],
            "C": ["I.", "II.", "III.", "IV.", "V.", "VI."], "D": ["I.", "II.", "III.", "IV."],
            "E": ["I.", "II.", "III.", "IV.", "V."],
        })
        root = self.by_id["sec-27-top-REG-27"]
        self.assertEqual(root["title"], ic.REG_META["27"]["root_title"])

    def test_no_duplicate_ids_and_every_parent_resolves(self):
        self.assertEqual(self.dupes, [])
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), len(set(ids)))
        for r in self.rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], self.by_id, r["id"])
            if r["kind"] == "item":
                self.assertTrue(r["id"].startswith(r["parent_id"] + "-"), r["id"])

    def test_label_fixes_all_hit_once(self):
        self.assertEqual(len(self.fixes), 2)
        self.assertTrue(all(f["hits"] == 1 for f in self.fixes), self.fixes)
        # II.A.1.d. sits under II.A.1. with its three siblings; nothing under I.A.1. but a/b.
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-27-B-II-A-1"],
                         ["II.A.1.a.", "II.A.1.b.", "II.A.1.c.", "II.A.1.d."])
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-27-B-I-A-1"],
                         ["I.A.1.a.", "I.A.1.b."])
        self.assertEqual([r["citation"] for r in self.rows if r["parent_id"] == "sec-27-D-II-D"],
                         ["II.D.1.", "II.D.2.", "II.D.3."])
        self.assertIn("Each manufacturing stationary source and midstream segment company must designate",
                      self.by_id["sec-27-D-II-D-1"]["full_text"])

    def test_definitions_one_row_per_term(self):
        defs = [r for r in self.rows if r["parent_id"] == "sec-27-A-II"]
        self.assertEqual(len(defs), 69)
        self.assertEqual(defs[0]["id"], "sec-27-A-II-A")
        self.assertEqual(defs[51]["id"], "sec-27-A-II-ZZ")
        self.assertEqual(defs[52]["id"], "sec-27-A-II-AAA")
        self.assertEqual(defs[-1]["id"], "sec-27-A-II-QQQ")
        self.assertTrue(self.by_id["sec-27-A-II-AAA"]["full_text"].startswith("<p>“Process” means"))
        self.assertTrue(self.by_id["sec-27-A-II-III"]["full_text"].startswith("<p>“Residential building unit” means"))
        self.assertTrue(self.by_id["sec-27-A-II-QQQ"]["full_text"].startswith("<p>“Verifiable” means"))
        self.assertNotIn("“Process” means", self.by_id["sec-27-A-II-ZZ"]["full_text"])
        self.assertTrue(self.by_id["sec-27-A-II-B"]["full_text"].startswith("<p>“2030 social cost of GHGs” means"))
        self.assertIn("$89 per metric ton of carbon dioxide", self.by_id["sec-27-A-II-B"]["full_text"])
        self.assertIn("$33,000 per metric ton of nitrous oxide", self.by_id["sec-27-A-II-B"]["full_text"])

    def test_sob_part_e_five_undivided_entries(self):
        entries = [r for r in self.rows if r["parent_id"] == "sec-27-P-E"]
        self.assertEqual([r["citation"] for r in entries], ["I.", "II.", "III.", "IV.", "V."])
        for r, opener in zip(entries, ("Adopted: October 22, 2021", "Adopted: July 21, 2022",
                                       "Adopted: April 20, 2023", "Adopted: October 20, 2023",
                                       "Adopted: December 18-20, 2024")):
            self.assertTrue(r["full_text"].startswith(f"<p>{opener}</p>"), r["id"])
        self.assertEqual([r["id"] for r in self.rows if r["id"].startswith("sec-27-E-")],
                         [e["id"] for e in entries])
        # the restarting inner lists stay inside the entries as paragraphs
        self.assertIn("<p>1. CO2 must be captured onsite at a GEMM 2 facility.", self.by_id["sec-27-E-IV"]["full_text"])
        # ...and the citation-shaped wrapped line "...starting in\n2027. The
        # facility must certify..." (line 3751) is body text, not a "2027." row.
        self.assertIn("for each compliance period starting in 2027. The facility must certify",
                      self.by_id["sec-27-E-IV"]["full_text"])

    def test_page_top_headings_are_their_own_paragraphs(self):
        for eid, heading in (("sec-27-E-II", "Specific Statutory Authority"), ("sec-27-E-IV", "Purpose"),
                             ("sec-27-E-IV", "Transparency"), ("sec-27-E-I", "Points of Compliance"),
                             ("sec-27-E-V", "Basis"), ("sec-27-E-IV", "State-Managed GHG Reduction Fund")):
            self.assertIn(f"<p>{heading}</p>", self.by_id[eid]["full_text"], (eid, heading))
        # ...and a paragraph that merely wraps across a page break is still whole.
        self.assertIn("many of the facilities were somewhere in between.", self.by_id["sec-27-E-IV"]["full_text"])

    def test_tables(self):
        if not self.has_pdf:
            self.skipTest("REG_27.pdf not present")
        self.assertEqual(self.n_tables, 8)
        self.assertEqual(self.table_hits["used"], 8)
        for rid, cap in (("sec-27-B-I-A-1-a", "Table 1"), ("sec-27-B-I-A-2", "Table 2"), ("sec-27-B-I-A-3", "Table 3"),
                         ("sec-27-B-I-A-4", "Table 4"), ("sec-27-B-I-A-5", "Table 5")):
            self.assertIn(f'<div class="doc-table-caption">{cap}</div>', self.by_id[rid]["full_text"], rid)
        t3 = self.by_id["sec-27-B-I-A-3"]["full_text"]
        self.assertIn("<td>1.50% less than the GEMM 2 facility GHG baseline emissions</td>", t3)
        self.assertIn("<td>8% less than the GEMM 2 facility GHG baseline emissions</td>", t3)
        t4 = self.by_id["sec-27-B-I-A-4"]["full_text"]
        self.assertIn("<td>12.5% less than the GEMM 2 facility GHG baseline emissions</td>", t4)
        t5 = self.by_id["sec-27-B-I-A-5"]["full_text"]
        self.assertIn("<td>At least 5% but less than 10%</td><td>3% less than", t5)
        self.assertNotIn("<p>At least", t5)  # no leftover flattened rows
        e4 = self.by_id["sec-27-E-IV"]["full_text"]
        self.assertEqual(e4.count('<table class="doc-table">'), 3)
        self.assertIn("<td>Suncor Energy USA, Commerce City</td><td>951,898</td><td>951,898</td>", e4)
        self.assertIn("<td>Western Sugar Cooperative</td><td>81,981</td><td>109,141</td>", e4)
        self.assertIn("<td>JBS Swift Beef Company, Greeley</td><td>1.75%</td><td>15.5%</td>", e4)
        self.assertIn("<td>Step 2:</td><td>Displaced thermal emissions</td><td>DT</td><td>DT = CT / TP x TE where:", e4)
        # prose after each of the three tables is intact, in order
        i1 = e4.index("<p>In establishing the GHG reduction criteria")
        i2 = e4.index("<p>Notwithstanding the above, the Commission recognized")
        i3 = e4.index("<p>In line with the Commission’s commitment to equitable representation")
        self.assertLess(e4.index("Yuma Ethanol, LLC"), i1)
        self.assertLess(i1, e4.index("Yuma Ethanol</td>"))
        self.assertLess(e4.index("Yuma Ethanol</td>"), i2)
        self.assertLess(i2, e4.index("Step 6:"))
        self.assertLess(e4.index("Step 6:"), i3)
        self.assertNotIn("DT = C T / T P x T E", e4)  # pdftotext's garbled subscripts are gone
        self.assertEqual(self._visible(e4).count("Facility Name"), 2)

    def test_no_page_furniture_leaks(self):
        for r in self.rows:
            self.assertNotRegex(r["full_text"], r"CODE OF COLORADO REGULATIONS")
            self.assertNotRegex(r["full_text"], r"Air Quality Control Commission</p>")

    def test_cross_references(self):
        self.assertIn('<a class="xref-external-reg" href="/regulations/22">Regulation Number 22</a>',
                      self.by_id["sec-27-A-I-B"]["full_text"])
        self.assertIn('<span class="xref" data-target="sec-27-top-REG-27">Regulation Number 27</span>',
                      self.by_id["sec-27-A-I-B"]["full_text"])
        self.assertIn('<span class="xref" data-target="sec-27-B-IV">Section IV.</span>',
                      self.by_id["sec-27-B-I-A"]["full_text"])
        self.assertIn('<span class="xref" data-target="sec-27-B-I-A-1">Sections I.A.1.</span>',
                      self.by_id["sec-27-B-I-A-5"]["full_text"])
        # Batch 5 merge: Reg 25 is in the corpus, so the one "Regulation
        # Number 25" mention (sec-27-E-III, the April 2023 reorganisation
        # statement) is now an anchor, not a bucket hit.
        self.assertIn('<a class="xref-external-reg" href="/regulations/25">Regulation Number 25</a>',
                      self.by_id["sec-27-E-III"]["full_text"])
        self.assertEqual(dict(self.unresolved["other_reg"]), {})
        self.assertEqual(set(self.unresolved["cfr"]), {"40 CFR Part 98", "40 CFR Part 98, Subpart A"})
        for r in self.rows:
            for tgt in re.findall(r'data-target="([^"]+)"', r["full_text"]):
                self.assertIn(tgt, self.by_id, (r["id"], tgt))

    def test_no_repeated_paragraph_prefix_within_a_row(self):
        for r in self.rows:
            paras = re.findall(r"<p>(.*?)</p>", r["full_text"])
            seen = {}
            for p in paras:
                key = self._visible(p)[:50]
                seen[key] = seen.get(key, 0) + 1
            for key, n in seen.items():
                if n >= 3:
                    # the one legitimate repeat: three separate formulas in entry I
                    self.assertEqual((r["id"], key, n), ("sec-27-E-I", "The calculation is as follows:", 3))
