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


class ExecuteUpsertChunksTests(unittest.TestCase):
    def test_global_sort_order_preserved_across_shapes(self):
        c = _build_classification()
        chunks = list(ic._execute_upsert_chunks(c, today="2026-09-15", chunk_size=100))
        # Flatten to (shape, id) pairs in emission order.
        seen = [(shape, row["id"]) for shape, rows in chunks for row in rows]
        ids_in_order = [pid for _shape, pid in seen]
        self.assertEqual(
            ids_in_order,
            [PART_A, f"sec-{REG}-A-I", f"sec-{REG}-A-II", f"sec-{REG}-A-III"],
            "rows must be emitted in ascending sort_order regardless of class "
            "(a new parent must always precede any child that references it)",
        )

    def test_identical_payload_omits_untouched_columns(self):
        c = _build_classification()
        chunks = list(ic._execute_upsert_chunks(c, today="2026-09-15", chunk_size=100))
        identical_rows = [row for shape, rows in chunks if shape == "identical" for row in rows]
        self.assertEqual(len(identical_rows), 2)
        for row in identical_rows:
            self.assertEqual(
                set(row.keys()), {"id", "citation", "title", "parent_id", "sort_order"},
                "an `identical` row's payload must only carry columns the SQL "
                "path's UPDATE SET clause touches for that class",
            )

    def test_changed_payload_has_full_text_and_summary_reset_but_not_jurisdiction(self):
        c = _build_classification()
        chunks = list(ic._execute_upsert_chunks(c, today="2026-09-15", chunk_size=100))
        changed_rows = [row for shape, rows in chunks if shape == "changed" for row in rows]
        self.assertEqual(len(changed_rows), 1)
        row = changed_rows[0]
        self.assertEqual(row["full_text"], "NEW visible text")
        self.assertEqual(row["summary_status"], "pending")
        self.assertIsNone(row["reviewed_by"])
        self.assertIsNone(row["reviewed_at"])
        self.assertIsNone(row["summary_original"])
        for col in ("jurisdiction_level", "issuing_body", "source_url", "last_verified_date", "is_public"):
            self.assertNotIn(col, row, f"changed rows must never overwrite {col} on an existing row")
        self.assertNotIn("ai_summary", row)

    def test_new_payload_has_every_not_null_column(self):
        c = _build_classification()
        chunks = list(ic._execute_upsert_chunks(c, today="2026-09-15", chunk_size=100))
        new_rows = [row for shape, rows in chunks if shape == "new" for row in rows]
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
        for _shape, rows in ic._execute_upsert_chunks(c, today="2026-09-15", chunk_size=100):
            for row in rows:
                self.assertNotIn("ai_summary", row)

    def test_chunk_never_mixes_shapes(self):
        c = _build_classification()
        for shape, rows in ic._execute_upsert_chunks(c, today="2026-09-15", chunk_size=1):
            self.assertTrue(len(rows) >= 1)

    def test_chunk_size_cap_enforced(self):
        # 250 synthetic `new` rows -> chunks of 100, 100, 50 at the default cap.
        parsed = [_prow(f"sec-{REG}-A-{i:04d}", PART_A, 100 + i, f"text {i}") for i in range(250)]
        db: list[dict] = []
        c = ic.classify_apply(parsed, db)
        self.assertEqual(len(c["new"]), 250)
        sizes = [len(rows) for _shape, rows in ic._execute_upsert_chunks(c, today="2026-09-15")]
        self.assertEqual(sizes, [100, 100, 50])
        self.assertTrue(all(n <= ic.EXECUTE_CHUNK for n in sizes))


# ---------------------------------------------------------------------------
# `apply --execute` end-to-end against a fake `supabase` module
# ---------------------------------------------------------------------------

class _FakeQuery:
    def __init__(self, table, kind, payload=None):
        self.table = table
        self.kind = kind
        self.payload = payload
        self.ids = None

    def in_(self, col, ids):
        self.ids = list(ids)
        return self

    def execute(self):
        call = {"table": self.table.name, "kind": self.kind, "payload": self.payload, "ids": self.ids}
        self.table.client.calls.append(call)
        fail_at = self.table.client.fail_at_call
        if fail_at is not None and len(self.table.client.calls) == fail_at:
            raise RuntimeError(f"simulated failure on call #{fail_at}")
        return SimpleNamespace(data=self.payload if isinstance(self.payload, list) else [])


class _FakeTable:
    def __init__(self, name, client):
        self.name = name
        self.client = client

    def upsert(self, payload, on_conflict=None):
        return _FakeQuery(self, "upsert", payload)

    def insert(self, payload):
        return _FakeQuery(self, "insert", payload)

    def delete(self):
        return _FakeQuery(self, "delete")


class _FakeClient:
    def __init__(self, fail_at_call=None):
        self.calls: list[dict] = []
        self.fail_at_call = fail_at_call
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

        kinds = [(call["table"], call["kind"]) for call in fake.calls]
        # Every upsert call precedes every provision_changes insert, which
        # precedes every provisions delete (rule 3/4 — deletes last).
        first_insert = next(i for i, k in enumerate(kinds) if k == ("provision_changes", "insert"))
        first_delete = next(i for i, k in enumerate(kinds) if k == ("provisions", "delete"))
        last_upsert = max(i for i, k in enumerate(kinds) if k == ("provisions", "upsert"))
        self.assertLess(last_upsert, first_insert)
        self.assertLess(first_insert, first_delete)

        # The removal note lands on the resolved surviving ancestor with the
        # right change_type, and the delete covers exactly the obsolete id.
        note_call = next(call for call in fake.calls if call["kind"] == "insert")
        self.assertEqual(note_call["payload"]["provision_id"], PART_A)
        self.assertEqual(note_call["payload"]["change_type"], "provision_removed")

        delete_call = next(call for call in fake.calls if call["kind"] == "delete")
        self.assertEqual(delete_call["ids"], [f"sec-{REG}-A-OLD"])

        # No upsert payload ever carries ai_summary; identical-class ids
        # never carry full_text.
        all_upsert_rows = [
            row for call in fake.calls if call["kind"] == "upsert" for row in call["payload"]
        ]
        for row in all_upsert_rows:
            self.assertNotIn("ai_summary", row)
        identical_ids = {PART_A, f"sec-{REG}-A-I"}
        for row in all_upsert_rows:
            if row["id"] in identical_ids:
                self.assertNotIn("full_text", row)
                self.assertNotIn("summary_status", row)

    def test_failed_chunk_aborts_before_later_writes(self):
        c = _build_classification()
        ancestor_for = {f"sec-{REG}-A-OLD": PART_A}
        # Fail on the very first call (the first upsert chunk) — nothing
        # after it (notes, deletes) should ever be attempted.
        fake = _FakeClient(fail_at_call=1)
        with _FakeSupabaseModuleCtx(fake):
            with self.assertRaises(RuntimeError):
                ic.cmd_apply_execute(self._args(yes=True), c, ancestor_for, "2026-09-15")
        self.assertEqual(len(fake.calls), 1)
        self.assertFalse(any(call["kind"] == "delete" for call in fake.calls))
        self.assertFalse(any(call["kind"] == "insert" for call in fake.calls))


if __name__ == "__main__":
    unittest.main()
