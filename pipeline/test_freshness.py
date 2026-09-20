"""
Tests for freshness.py. All network access is stubbed via Fetcher.fixtures_dir
and per-call fixture_name overrides -- nothing here touches the network.

Run with: python3 -m pytest -q test_freshness.py
"""

from __future__ import annotations

import json
import re
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


def test_parse_cdphe_page_reads_docid_from_the_labelled_anchor_not_the_next_link():
    # The live page lists each permit as <a href="...docid=N">General Permit
    # GPnn</a>, so the docid comes BEFORE the label. A forward scan from the
    # label returned the next link's docid (GP01 -> GP02's document, GP02 -> a
    # form) and reported every permit as changed on every run.
    html = (
        '<li><a href="https://oitco.hylandcloud.com/CDPHERMPOP/DocPop/DocPop.aspx?docid=11306933">'
        "General Permit GP01</a>: Condensate Storage Tank Batteries.</li>"
        '<li><a href="https://oitco.hylandcloud.com/POP/DocPop/DocPop.aspx?docid=5309717">'
        "Facility-wide Emissions Inventory (Form APCD-102)</a></li>"
        '<li><a href="https://oitco.hylandcloud.com/CDPHERMPOP/DocPop/DocPop.aspx?docid=11306935">'
        "GP02: Natural Gas Fired Engines.</a></li>"
        "<p>The GP12 replaces GP09 and GP10.</p>"
    )
    assert fr.parse_cdphe_page(html) == {"gp01": "11306933", "gp02": "11306935"}


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


# ---------------------------------------------------------------------------
# p191/p192 (subpart: null) -- URL and source label built without &subpart=
# ---------------------------------------------------------------------------


def test_ecfr_versions_url_omits_subpart_when_absent():
    assert fr.ecfr_versions_url("49", "192") == (
        "https://www.ecfr.gov/api/versioner/v1/versions/title-49.json?part=192"
    )
    assert fr.ecfr_versions_url("49", "192", None) == (
        "https://www.ecfr.gov/api/versioner/v1/versions/title-49.json?part=192"
    )


def test_ecfr_versions_url_includes_subpart_when_present():
    assert fr.ecfr_versions_url("40", "60", "OOOOa") == (
        "https://www.ecfr.gov/api/versioner/v1/versions/title-40.json?part=60&subpart=OOOOa"
    )


def test_ecfr_full_url_omits_subpart_when_absent():
    assert fr.ecfr_full_url("2026-09-19", "49", "192") == (
        "https://www.ecfr.gov/api/versioner/v1/full/2026-09-19/title-49.xml?part=192"
    )


def test_check_ecfr_p192_url_has_no_subpart_param(tmp_path):
    entry = {"title": "49", "part": "192", "subpart": None, "as_of": "2026-09-17"}
    url = fr.ecfr_versions_url("49", "192", None)
    fixture = tmp_path / "ecfr_p192.json"
    fixture.write_text(json.dumps({"content_versions": [{"date": "2026-09-17"}]}))
    fetcher = fr.Fetcher(fixtures_dir=tmp_path)
    fetcher.register_fixture(url, "ecfr_p192.json")
    result = fr.check_ecfr("p192", entry, fetcher)
    assert result.status == fr.STATUS_OK
    assert "&subpart=" not in url


def test_check_ecfr_p192_source_label_has_no_subpart():
    entry = {"title": "49", "part": "192", "subpart": None, "as_of": "2026-09-17"}
    fetcher = fr.Fetcher(fixtures_dir=Path("/does/not/exist"))
    result = fr.check_ecfr("p192", entry, fetcher)
    # Fetch fails (no fixture registered), but the label is built before the
    # fetch and is asserted on the ERROR result regardless.
    assert result.source == "eCFR 49 CFR Part 192"
    assert result.status == fr.STATUS_ERROR


@pytest.mark.parametrize("key, part", [("p194", "194"), ("p195", "195"), ("p199", "199")])
def test_batch_b_manifest_entries(key, part):
    """Batch B: 49 CFR Parts 194/195/199 are registered in the manifest the
    same way Parts 191/192 were -- kind ecfr, title 49, no subpart."""
    entry = make_manifest()["sources"][key]
    assert entry["kind"] == "ecfr"
    assert entry["title"] == "49"
    assert entry["part"] == part
    assert entry["subpart"] is None
    assert entry["as_of"] == "2026-09-17"
    assert entry["xml_sha256"] is None


@pytest.mark.parametrize("key, part", [("p194", "194"), ("p195", "195"), ("p199", "199")])
def test_batch_b_ecfr_url_and_label_omit_subpart(key, part):
    entry = make_manifest()["sources"][key]
    url = fr.ecfr_versions_url(entry["title"], entry["part"], entry.get("subpart"))
    assert "&subpart=" not in url
    assert f"part={part}" in url or f"/{part}" in url
    fetcher = fr.Fetcher(fixtures_dir=Path("/does/not/exist"))
    result = fr.check_ecfr(key, entry, fetcher)
    assert result.source == f"eCFR 49 CFR Part {part}"


@pytest.mark.parametrize("key, part", [("p190", "190"), ("p193", "193"), ("p196", "196")])
def test_batch_c_manifest_entries(key, part):
    """Batch C: 49 CFR Parts 190/193/196 -- same shape as p191 (kind ecfr,
    title 49, subpart null, as_of 2026-09-17, xml_sha256 null)."""
    entry = make_manifest()["sources"][key]
    assert entry["kind"] == "ecfr"
    assert entry["title"] == "49"
    assert entry["part"] == part
    assert entry["subpart"] is None
    assert entry["as_of"] == "2026-09-17"
    assert entry["xml_sha256"] is None
    assert entry == dict(make_manifest()["sources"]["p191"], part=part)


@pytest.mark.parametrize("key, part", [("p190", "190"), ("p193", "193"), ("p196", "196")])
def test_batch_c_ecfr_url_and_label_omit_subpart(key, part):
    entry = make_manifest()["sources"][key]
    url = fr.ecfr_versions_url(entry["title"], entry["part"], entry.get("subpart"))
    assert "&subpart=" not in url
    assert "None" not in url
    assert f"part={part}" in url or f"/{part}" in url
    fetcher = fr.Fetcher(fixtures_dir=Path("/does/not/exist"))
    result = fr.check_ecfr(key, entry, fetcher)
    assert result.source == f"eCFR 49 CFR Part {part}"


def test_all_eight_pipeline_parts_are_in_the_manifest_and_198_is_not():
    keys = {k for k in make_manifest()["sources"] if k.startswith("p19")}
    assert keys == {"p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"}


def test_every_ecfr_manifest_entry_has_a_checkable_url():
    """No manifest entry may build a URL with a literal 'None' in it -- the
    bug the subpart-optional helpers were added for."""
    for key, entry in make_manifest()["sources"].items():
        if entry.get("kind") != "ecfr":
            continue
        url = fr.ecfr_versions_url(entry["title"], entry["part"], entry.get("subpart"))
        assert "None" not in url, key


def test_check_ecfr_subpart_source_label_unchanged():
    entry = {"title": "40", "part": "60", "subpart": "OOOOa", "as_of": "2026-09-11"}
    fetcher = fr.Fetcher(fixtures_dir=FIXTURES)
    result = fr.check_ecfr("ooooa_unchanged", entry, fetcher)
    assert result.source == "eCFR 40 CFR 60 subpart OOOOa"


# ---------------------------------------------------------------------------
# CDPHE HTTP 403 -> STATUS_BLOCKED (distinct from STATUS_ERROR)
# ---------------------------------------------------------------------------


def _cdphe_entry():
    return {
        "page_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "permits": {
            "gp01": {"docid": "11306933", "issuance": "6", "date": "2025-07-23"},
            "gp02": {"docid": "11306935", "issuance": "4", "date": "2025-07-23"},
        },
    }


def test_check_cdphe_gp_403_is_status_blocked_not_error():
    import urllib.error

    entry = _cdphe_entry()
    fetcher = fr.Fetcher()
    fetcher.register_error(entry["page_url"], urllib.error.HTTPError(entry["page_url"], 403, "Forbidden", None, None))
    results = fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    # One line for the whole page, not one per permit.
    assert len(results) == 1
    assert results[0].status == fr.STATUS_BLOCKED
    assert results[0].status != fr.STATUS_ERROR
    assert "CDPHE blocked the runner, HTTP 403" in results[0].detail


def test_check_cdphe_gp_non_403_http_error_is_still_status_error():
    import urllib.error

    entry = _cdphe_entry()
    fetcher = fr.Fetcher()
    fetcher.register_error(entry["page_url"], urllib.error.HTTPError(entry["page_url"], 500, "Server Error", None, None))
    results = fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    # A non-403 error is reported per-permit, as before.
    assert len(results) == 2
    assert all(r.status == fr.STATUS_ERROR for r in results)
    assert all(r.status != fr.STATUS_BLOCKED for r in results)


def test_check_cdphe_gp_other_exception_is_still_status_error():
    entry = _cdphe_entry()
    fetcher = fr.Fetcher()
    fetcher.register_error(entry["page_url"], ConnectionError("boom"))
    results = fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    assert len(results) == 2
    assert all(r.status == fr.STATUS_ERROR for r in results)


def test_check_cdphe_gp_uses_browser_like_headers_not_bot_ua():
    calls = []

    class RecordingFetcher(fr.Fetcher):
        def get_text(self, url, fixture_name=None, headers=None):
            calls.append(headers)
            raise FileNotFoundError("no fixture")

    entry = _cdphe_entry()
    fetcher = RecordingFetcher()
    fr.check_cdphe_gp("cdphe_gp", entry, fetcher)
    assert len(calls) == 1
    assert calls[0] == fr.CDPHE_BROWSER_HEADERS
    assert calls[0]["User-Agent"] != fr.USER_AGENT
    assert "Chrome" in calls[0]["User-Agent"]
    assert "Accept-Language" in calls[0]


def test_check_sos_and_ecfr_still_use_bot_user_agent():
    # SOS/eCFR fetches must be unaffected by the CDPHE browser-header change.
    assert fr.USER_AGENT.startswith("EssentialRegsFreshnessBot")


# ---------------------------------------------------------------------------
# render_report -- "N unchanged · M not checked (blocked)" reads clean
# ---------------------------------------------------------------------------


def test_render_report_blocked_only_reads_clean_not_as_error():
    results = [
        fr.CheckResult("3", "sos", "12619", "12619", fr.STATUS_OK),
        fr.CheckResult("7", "sos", "12621", "12621", fr.STATUS_OK),
        fr.CheckResult("cdphe_gp", "CDPHE general air permits page", "11 permits", "?",
                       fr.STATUS_BLOCKED, "not checked (CDPHE blocked the runner, HTTP 403)"),
    ]
    report = fr.render_report(results)
    assert "2 unchanged · 1 not checked (blocked)." in report
    assert "No changes detected." not in report
    assert "could not be checked" not in report  # that phrasing is for STATUS_ERROR only


def test_render_report_all_ok_still_says_no_changes_detected_when_nothing_blocked():
    results = [fr.CheckResult("3", "sos", "12619", "12619", fr.STATUS_OK)]
    report = fr.render_report(results)
    assert "No changes detected." in report


def test_render_report_blocked_does_not_affect_exit_code(tmp_path):
    manifest = {
        "sources": {
            "cdphe_gp": {
                "kind": "cdphe_gp",
                "page_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
                "permits": {"gp01": {"docid": "1", "issuance": "1", "date": "2020-01-01"}},
            }
        }
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))

    class BlockedFetcher(fr.Fetcher):
        def get_text(self, url, fixture_name=None, headers=None):
            import urllib.error
            raise urllib.error.HTTPError(url, 403, "Forbidden", None, None)

    manifest_loaded = fr.load_manifest(manifest_path)
    results = fr.run_check(manifest_loaded, BlockedFetcher())
    assert results[0].status == fr.STATUS_BLOCKED
    assert not any(r.status == fr.STATUS_CHANGED for r in results)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))


# ---------------------------------------------------------------------------
# Batch 5: AQCC Regs 11 / 12 / 25 / 27 -- SOS entries in the shape of "30"
# ---------------------------------------------------------------------------

BATCH5_SOS = {
    "11": ("5 CCR 1001-13", "2346", "12430", "2026-03-02"),
    "12": ("5 CCR 1001-15", "2348", "11881", "2025-03-17"),
    "25": ("5 CCR 1001-29", "3410", "12376", "2026-01-14"),
    "27": ("5 CCR 1001-31", "3412", "11838", "2025-02-14"),
}


@pytest.mark.parametrize("key", sorted(BATCH5_SOS))
def test_batch5_manifest_entries(key):
    """Batch 5: Regs 11/12/25/27 are registered like "30" -- kind sos, the
    CDPHE dept/agency ids, a ruleId, a ruleVersionId and an ISO effective
    date, and nothing else."""
    ccr, rule_id, rvid, eff = BATCH5_SOS[key]
    entry = make_manifest()["sources"][key]
    assert set(entry) == set(make_manifest()["sources"]["30"])
    assert entry["kind"] == "sos"
    assert entry["ccr"] == ccr
    assert entry["ruleId"] == rule_id
    assert entry["deptID"] == "16"
    assert entry["agencyID"] == "7"
    assert entry["ruleVersionId"] == rvid
    assert entry["effective_date"] == eff
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["effective_date"])


@pytest.mark.parametrize("key", sorted(BATCH5_SOS))
def test_batch5_sos_url_and_label(key):
    """check_sos builds the SOS URL from the entry's ruleId and labels the
    result with its CCR cite; no fixture is registered so the fetch fails,
    but the label is built before the fetch and asserted on the ERROR result."""
    entry = make_manifest()["sources"][key]
    fetcher = fr.Fetcher(fixtures_dir=Path("/does/not/exist"))
    result = fr.check_sos(key, entry, fetcher)
    assert result.source == f"SOS {BATCH5_SOS[key][0]}"
    assert result.ours == BATCH5_SOS[key][2]
    assert result.status == fr.STATUS_ERROR
    assert f"ruleId={BATCH5_SOS[key][1]}" in fr.SOS_URL_TMPL.format(
        ruleId=entry["ruleId"], deptID=entry["deptID"], agencyID=entry["agencyID"])


def test_batch5_rule_ids_and_ccr_cites_are_unique_across_sos_entries():
    sos = {k: v for k, v in make_manifest()["sources"].items() if v.get("kind") == "sos"}
    rule_ids = [v["ruleId"] for v in sos.values()]
    ccrs = [v["ccr"] for v in sos.values()]
    assert len(rule_ids) == len(set(rule_ids))
    assert len(ccrs) == len(set(ccrs))
