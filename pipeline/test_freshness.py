"""
Tests for freshness.py. All network access is stubbed via Fetcher.fixtures_dir
and per-call fixture_name overrides -- nothing here touches the network.

Run with: python3 -m pytest -q test_freshness.py
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import freshness as fr

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def make_manifest(**overrides):
    base = json.loads((Path(__file__).resolve().parent / "sources" / "manifest.json").read_text())
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# SOS parsing
# ---------------------------------------------------------------------------


def test_parse_sos_page_extracts_rule_version_and_date():
    html = FIXTURES.joinpath("sos_3.html").read_text()
    rvid, eff = fr.parse_sos_page(html)
    assert rvid == "12619"
    assert eff == "07/15/2026"


def test_parse_sos_page_missing_openrulewindow_returns_none():
    html = FIXTURES.joinpath("sos_3_broken.html").read_text()
    rvid, eff = fr.parse_sos_page(html)
    assert rvid is None
    assert eff is None


def test_check_sos_unchanged():
    manifest = make_manifest()
    entry = manifest["sources"]["3"]
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_sos("3", entry, fetcher)
    # sos_3.html carries the same ruleVersionId (12619) as the manifest entry.
    assert result.status == fr.STATUS_OK
    assert result.ours == "12619"
    assert "12619" in result.theirs


def test_check_sos_changed():
    manifest = make_manifest()
    entry = dict(manifest["sources"]["3"])
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    fetcher.register_fixture(
        fr.SOS_URL_TMPL.format(ruleId=entry["ruleId"], deptID=entry["deptID"], agencyID=entry["agencyID"]),
        "sos_3_changed.html",
    )
    # check_sos always looks up fixture_name=f"sos_{key}.html"; use a distinct
    # key so it resolves to the "changed" fixture file directly instead.
    entry_changed_key = "3_changed"
    result = fr.check_sos(entry_changed_key, entry, fetcher)
    assert result.status == fr.STATUS_CHANGED
    assert result.ours == "12619"
    assert "13001" in result.theirs


def test_check_sos_error_on_unparseable_page():
    manifest = make_manifest()
    entry = manifest["sources"]["3"]
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_sos("3_broken", entry, fetcher)
    assert result.status == fr.STATUS_ERROR


def test_check_sos_fetch_error_is_reported_not_raised():
    manifest = make_manifest()
    entry = manifest["sources"]["3"]
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    # No fixture registered/named for this key -> FileNotFoundError inside get_text,
    # which check_sos must catch and turn into an ERROR result rather than raising.
    result = fr.check_sos("does_not_exist", entry, fetcher)
    assert result.status == fr.STATUS_ERROR
    assert "fetch error" in result.detail


# ---------------------------------------------------------------------------
# eCFR
# ---------------------------------------------------------------------------


def test_check_ecfr_unchanged():
    entry = {"title": "40", "part": "60", "subpart": "OOOOa", "as_of": "2026-09-11"}
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_ecfr("ooooa_unchanged", entry, fetcher)
    assert result.status == fr.STATUS_OK
    assert result.theirs == "2026-09-11"


def test_check_ecfr_changed():
    entry = {"title": "40", "part": "60", "subpart": "OOOOa", "as_of": "2026-09-11"}
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_ecfr("ooooa_changed", entry, fetcher)
    assert result.status == fr.STATUS_CHANGED
    assert result.theirs == "2026-10-02"


def test_check_ecfr_empty_versions_is_error():
    entry = {"title": "40", "part": "60", "subpart": "OOOOa", "as_of": "2026-09-11"}
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_ecfr("ooooa_empty", entry, fetcher)
    assert result.status == fr.STATUS_ERROR


def test_check_ecfr_fetch_error_is_reported_not_raised():
    entry = {"title": "40", "part": "60", "subpart": "OOOOa", "as_of": "2026-09-11"}
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_ecfr("no_such_fixture", entry, fetcher)
    assert result.status == fr.STATUS_ERROR
    assert "fetch error" in result.detail


# ---------------------------------------------------------------------------
# CDPHE general permits
# ---------------------------------------------------------------------------


def test_parse_cdphe_page_extracts_all_docids():
    html = FIXTURES.joinpath("cdphe_gp_unchanged.html").read_text()
    live = fr.parse_cdphe_page(html)
    assert live["gp01"] == "11306933"
    assert live["gp12"] == "63372084"
    assert len(live) == 11


def test_check_cdphe_gp_unchanged():
    manifest = make_manifest()
    entry = manifest["sources"]["cdphe_gp"]
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    fetcher.register_fixture(entry["page_url"], "cdphe_gp_unchanged.html")
    results = fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    assert len(results) == 11
    assert all(r.status == fr.STATUS_OK for r in results)


def test_check_cdphe_gp_changed_missing_and_new_permit():
    manifest = make_manifest()
    entry = manifest["sources"]["cdphe_gp"]
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    fetcher.register_fixture(entry["page_url"], "cdphe_gp_changed.html")
    results = fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    by_key = {r.key: r for r in results}

    # gp03's docid changed upstream.
    assert by_key["cdphe_gp:gp03"].status == fr.STATUS_CHANGED
    assert by_key["cdphe_gp:gp03"].theirs == "99999999"

    # gp09 vanished from the page entirely.
    assert by_key["cdphe_gp:gp09"].status == fr.STATUS_CHANGED
    assert by_key["cdphe_gp:gp09"].theirs == "missing"

    # gp01, gp02, gp05..gp08, gp10..gp12 are unchanged.
    for gp in ["gp01", "gp02", "gp05", "gp06", "gp07", "gp08", "gp10", "gp11", "gp12"]:
        assert by_key[f"cdphe_gp:{gp}"].status == fr.STATUS_OK

    # gp13 is new on the page and not yet in the manifest.
    assert "cdphe_gp:gp13" in by_key
    assert by_key["cdphe_gp:gp13"].status == fr.STATUS_CHANGED


def test_check_cdphe_gp_fetch_error_reports_all_permits_as_error():
    manifest = make_manifest()
    entry = manifest["sources"]["cdphe_gp"]
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    # No fixture registered under entry["page_url"] and the default fixture
    # name won't exist either -> every permit should come back as an error,
    # not raise.
    fetcher.fixtures_dir = FIXTURES / "does_not_exist_dir"
    results = fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    assert len(results) == 11
    assert all(r.status == fr.STATUS_ERROR for r in results)


# ---------------------------------------------------------------------------
# Orchestration / exit codes
# ---------------------------------------------------------------------------


def test_run_check_and_render_report_all_ok(tmp_path):
    manifest = {
        "sources": {
            "3": {
                "kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "12619",
                "effective_date": "2026-07-15",
            }
        }
    }
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    results = fr.run_check(manifest, fetcher)
    assert len(results) == 1
    assert results[0].status == fr.STATUS_OK
    report = fr.render_report(results)
    assert "No changes detected." in report
    assert "|" in report  # markdown table present


def test_run_check_detects_change_across_kinds():
    manifest = {
        "sources": {
            "3": {
                "kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "OLD-VERSION",
                "effective_date": "2020-01-01",
            }
        }
    }
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    results = fr.run_check(manifest, fetcher)
    assert results[0].status == fr.STATUS_CHANGED
    report = fr.render_report(results)
    assert "changed" in report.lower()


def test_cmd_check_exit_code_1_on_change(tmp_path, capsys):
    manifest = {
        "sources": {
            "3": {
                "kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "OLD-VERSION",
                "effective_date": "2020-01-01",
            }
        }
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    args = fr.build_arg_parser().parse_args(
        ["check", "--manifest", str(manifest_path), "--fixtures", str(FIXTURES)]
    )
    exit_code = fr.cmd_check(args)
    assert exit_code == 1


def test_cmd_check_exit_code_0_when_unchanged(tmp_path):
    manifest = {
        "sources": {
            "3": {
                "kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "12619",
                "effective_date": "2026-07-15",
            }
        }
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    args = fr.build_arg_parser().parse_args(
        ["check", "--manifest", str(manifest_path), "--fixtures", str(FIXTURES)]
    )
    exit_code = fr.cmd_check(args)
    assert exit_code == 0


def test_cmd_check_exit_code_0_when_only_errors(tmp_path):
    # A source that can't be reached should not fail the job by itself.
    manifest = {
        "sources": {
            "ghost": {
                "kind": "sos", "ccr": "5 CCR 9999-9", "ruleId": "0",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "1",
                "effective_date": "2020-01-01",
            }
        }
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    args = fr.build_arg_parser().parse_args(
        ["check", "--manifest", str(manifest_path), "--fixtures", str(FIXTURES)]
    )
    exit_code = fr.cmd_check(args)
    assert exit_code == 0


def test_cmd_check_writes_step_summary(tmp_path):
    manifest = {
        "sources": {
            "3": {
                "kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "12619",
                "effective_date": "2026-07-15",
            }
        }
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    summary_path = tmp_path / "summary.md"
    args = fr.build_arg_parser().parse_args(
        [
            "check",
            "--manifest", str(manifest_path),
            "--fixtures", str(FIXTURES),
            "--step-summary", str(summary_path),
        ]
    )
    fr.cmd_check(args)
    assert summary_path.exists()
    assert "Source freshness report" in summary_path.read_text()


# ---------------------------------------------------------------------------
# --update-manifest
# ---------------------------------------------------------------------------


def test_update_manifest_sos_writes_new_rule_version(tmp_path):
    manifest = {
        "sources": {
            "3": {
                "kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337",
                "deptID": "16", "agencyID": "7", "ruleVersionId": "OLD-VERSION",
                "effective_date": "2020-01-01",
            }
        }
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    args = fr.build_arg_parser().parse_args(
        ["--update-manifest", "3", "--manifest", str(manifest_path), "--fixtures", str(FIXTURES)]
    )
    exit_code = fr.cmd_update_manifest(args)
    assert exit_code == 0
    updated = json.loads(manifest_path.read_text())
    assert updated["sources"]["3"]["ruleVersionId"] == "12619"
    assert updated["sources"]["3"]["effective_date"] == "2026-07-15"


def test_update_manifest_unknown_key_errors(tmp_path):
    manifest = {"sources": {}}
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    args = fr.build_arg_parser().parse_args(
        ["--update-manifest", "nope", "--manifest", str(manifest_path), "--fixtures", str(FIXTURES)]
    )
    exit_code = fr.cmd_update_manifest(args)
    assert exit_code == 2


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
