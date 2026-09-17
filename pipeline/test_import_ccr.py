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


if __name__ == "__main__":
    unittest.main()
