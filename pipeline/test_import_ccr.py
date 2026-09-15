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


if __name__ == "__main__":
    unittest.main()
