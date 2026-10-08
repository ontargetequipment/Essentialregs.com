"""changelog_sources.py: the version each source holds, and what an executed
import tells /changelog (source_version_changed only when the manifest's
version differs from the recorded one; otherwise the run's text_updated /
added / removed rows become transcription_corrected; the snapshot is
refreshed last). Fake client, no network."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

import changelog_sources as cs

MANIFEST = {
    "sources": {
        "7": {"kind": "sos", "ccr": "5 CCR 1001-9", "ruleVersionId": "12621", "effective_date": "2026-07-15"},
        "oooob": {"kind": "ecfr", "title": "40", "part": "60", "subpart": "OOOOb", "as_of": "2026-09-10"},
        "cdphe_gp": {"kind": "cdphe_gp", "permits": {"gp01": {"docid": "11306933", "issuance": "6", "date": "2025-07-23"}}},
        "odd": {"kind": "sos", "ccr": "x"},
    }
}


class _Q:
    def __init__(self, client, table, kind, payload=None):
        self.client, self.table, self.kind, self.payload = client, table, kind, payload
        self.filters: list[tuple] = []

    def eq(self, c, v):
        self.filters.append(("eq", c, v))
        return self

    def like(self, c, v):
        self.filters.append(("like", c, v))
        return self

    def gte(self, c, v):
        self.filters.append(("gte", c, v))
        return self

    def execute(self):
        self.client.calls.append({"table": self.table, "kind": self.kind, "payload": self.payload, "filters": self.filters})
        if self.kind == "select":
            return _R(self.client.recorded.get(self.table, []))
        if self.kind == "update":
            return _R([{"id": i} for i in range(self.client.update_matches)])
        if self.kind == "rpc":
            return _R({"rows": 12, "computed_at": "2026-10-07T12:00:00+00:00", "compute_ms": 1900})
        return _R([])


class _R:
    def __init__(self, data):
        self.data = data


class _T:
    def __init__(self, client, name):
        self.client, self.name = client, name

    def select(self, *a):
        return _Q(self.client, self.name, "select")

    def insert(self, payload):
        return _Q(self.client, self.name, "insert", payload)

    def update(self, payload):
        return _Q(self.client, self.name, "update", payload)


class FakeClient:
    def __init__(self, recorded=None, update_matches=2):
        self.calls: list[dict] = []
        self.recorded = recorded or {}
        self.update_matches = update_matches

    def table(self, name):
        return _T(self, name)

    def rpc(self, name, params=None):
        return _Q(self, f"rpc:{name}", "rpc", params)


NOW = datetime(2026, 10, 7, 12, 0, tzinfo=timezone.utc)


class SourceVersionOfTests(unittest.TestCase):
    def test_the_three_kinds_and_the_unknowns(self):
        self.assertEqual(cs.source_version_of(MANIFEST, "7"),
                         {"version": "effective 2026-07-15 (SOS ruleVersionId 12621)", "effective_date": "2026-07-15"})
        self.assertEqual(cs.source_version_of(MANIFEST, "oooob"), {"version": "eCFR as of 2026-09-10", "effective_date": "2026-09-10"})
        self.assertEqual(cs.source_version_of(MANIFEST, "gp01"),
                         {"version": "issuance 6, 2025-07-23 (CDPHE docid 11306933)", "effective_date": "2025-07-23"})
        self.assertEqual(cs.source_version_of(MANIFEST, "GP01")["effective_date"], "2025-07-23")
        self.assertIsNone(cs.source_version_of(MANIFEST, "gp99"))
        self.assertIsNone(cs.source_version_of(MANIFEST, "odd"))  # no effective date: unusable
        self.assertIsNone(cs.source_version_of({}, "7"))

    def test_version_note_names_both_versions(self):
        self.assertEqual(cs.version_note("7", "effective 2026-07-15 (SOS ruleVersionId 12621)", "effective 2026-10-01 (SOS ruleVersionId 12900)"),
                         "Source version changed for 7: effective 2026-07-15 (SOS ruleVersionId 12621) -> effective 2026-10-01 (SOS ruleVersionId 12900)")
        self.assertEqual(cs.root_id_for("gp12"), "sec-gp12-top-REG-gp12")


class FinalizeTests(unittest.TestCase):
    def test_unchanged_version_relabels_the_run_and_refreshes(self):
        client = FakeClient(recorded={"source_versions": [{"version": "effective 2026-07-15 (SOS ruleVersionId 12621)", "effective_date": "2026-07-15"}]})
        out = cs.finalize_import_changelog(client, "7", "2026-10-07T11:00:00+00:00", MANIFEST, now=NOW)
        self.assertFalse(out["version_changed"])
        self.assertEqual(out["relabelled"], {"text_updated": 2, "added": 2, "removed": 2})
        self.assertEqual(out["snapshot"]["rows"], 12)
        kinds = [(c["table"], c["kind"]) for c in client.calls]
        self.assertEqual(kinds[0], ("source_versions", "select"))
        self.assertEqual(kinds[1:4], [("provision_changes", "update")] * 3)
        self.assertEqual(kinds[-1], ("rpc:refresh_changelog_snapshot", "rpc"))
        # Nothing was logged and the recorded version stands.
        self.assertFalse(any(c["kind"] == "insert" for c in client.calls))
        for c in client.calls[1:4]:
            self.assertEqual(c["payload"], {"change_type": "transcription_corrected"})
            self.assertIn(("like", "provision_id", "sec-7-%"), c["filters"])
            self.assertIn(("gte", "created_at", "2026-10-07T11:00:00+00:00"), c["filters"])
        self.assertEqual(sorted(f[2] for c in client.calls[1:4] for f in c["filters"] if f[0] == "eq"), ["added", "removed", "text_updated"])

    def test_changed_version_logs_one_row_against_the_root_and_keeps_the_run_regulatory(self):
        client = FakeClient(recorded={"source_versions": [{"version": "effective 2025-11-14 (SOS ruleVersionId 11999)", "effective_date": "2025-11-14"}]})
        out = cs.finalize_import_changelog(client, "7", "2026-10-07T11:00:00+00:00", MANIFEST, now=NOW)
        self.assertTrue(out["version_changed"])
        self.assertEqual(out["relabelled"], {"text_updated": 0, "added": 0, "removed": 0})
        logged = [c for c in client.calls if c["table"] == "provision_changes"]
        self.assertEqual(len(logged), 1)
        self.assertEqual(logged[0]["kind"], "insert")
        self.assertEqual(logged[0]["payload"]["provision_id"], "sec-7-top-REG-7")
        self.assertEqual(logged[0]["payload"]["change_type"], "source_version_changed")
        self.assertEqual(logged[0]["payload"]["note"],
                         "Source version changed for 7: effective 2025-11-14 (SOS ruleVersionId 11999) -> effective 2026-07-15 (SOS ruleVersionId 12621)")
        recorded = next(c for c in client.calls if c["table"] == "source_versions" and c["kind"] == "update")
        self.assertEqual(recorded["payload"]["version"], "effective 2026-07-15 (SOS ruleVersionId 12621)")
        self.assertEqual(recorded["payload"]["effective_date"], "2026-07-15")
        self.assertIn(("eq", "reg_key", "7"), recorded["filters"])
        self.assertEqual(client.calls[-1]["table"], "rpc:refresh_changelog_snapshot")

    def test_first_record_is_written_without_claiming_a_change(self):
        client = FakeClient()
        out = cs.finalize_import_changelog(client, "gp01", "2026-10-07T11:00:00+00:00", MANIFEST, now=NOW)
        self.assertFalse(out["version_changed"])
        first = next(c for c in client.calls if c["table"] == "source_versions" and c["kind"] == "insert")
        self.assertEqual(first["payload"]["reg_key"], "gp01")
        self.assertEqual(first["payload"]["version"], "issuance 6, 2025-07-23 (CDPHE docid 11306933)")
        self.assertFalse(any(c["table"] == "provision_changes" and c["kind"] == "insert" for c in client.calls))
        # The run's rows are still re-labelled: an agency change is never claimed on a first record.
        self.assertEqual(out["relabelled"]["text_updated"], 2)

    def test_no_manifest_entry_means_no_agency_change(self):
        client = FakeClient()
        out = cs.finalize_import_changelog(client, "gp99", "2026-10-07T11:00:00+00:00", MANIFEST, refresh=False, now=NOW)
        self.assertFalse(out["version_changed"])
        self.assertIsNone(out["new"])
        self.assertIsNone(out["snapshot"])
        self.assertFalse(any(c["kind"] == "insert" for c in client.calls))
        self.assertFalse(any(c["kind"] == "rpc" for c in client.calls))
        self.assertEqual(sum(out["relabelled"].values()), 6)


if __name__ == "__main__":
    unittest.main()
