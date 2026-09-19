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
                "gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12")

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
            r'<a class="xref-external-reg"(?: data-provision-id="sec-cp-[^"]*")?'
            r' href="/regulations/(?:cp|9|24|30|jjjj|iiii|zzzz|gp\d\d)">(.*?)</a>'
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
        text = "used in Commission Regulation No. 3, Part B, Section III.B.5.d. and Regulation No. 27, Part B, Section II.A.6."
        html, buckets = ic.link_citations(text, "30", {"sec-30-top-REG-30"}, set(ic.CORPUS_REGS))
        self.assertIn('href="/regulations/3">Regulation No. 3</a>', html)
        self.assertEqual(dict(buckets[ic.BUCKET_OTHER_REG]), {"Regulation No. 27, Part B, Section II.A.6.": 1})
        self.assertEqual(dict(buckets[ic.BUCKET_UNPARSEABLE]), {})

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
