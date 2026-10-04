"""source_dates.py: the reader's version-note dates are generated from the manifest, never typed."""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import source_dates as sd  # noqa: E402
import freshness as fr  # noqa: E402

FIXTURES = HERE / "fixtures"


def test_build_source_dates_maps_each_kind():
    manifest = {"sources": {
        "7": {"kind": "sos", "ruleVersionId": "1", "effective_date": "2026-07-15"},
        "oooob": {"kind": "ecfr", "as_of": "2026-09-10"},
        "cdphe_gp": {"kind": "cdphe_gp", "permits": {"GP12": {"docid": "1", "date": "2026-05-28"}, "gp01": {"docid": "2", "date": "2025-07-23"},
                                                     "gp99": {"docid": "3"}}},
        "nodate": {"kind": "sos", "ruleVersionId": "9"},
        "odd": {"kind": "something_else", "date": "2020-01-01"},
    }}
    assert sd.build_source_dates(manifest) == {
        "7": {"kind": "effective", "date": "2026-07-15"},
        "gp01": {"kind": "issued", "date": "2025-07-23"},
        "gp12": {"kind": "issued", "date": "2026-05-28"},
        "oooob": {"kind": "as_of", "date": "2026-09-10"},
    }


def test_render_is_deterministic_and_well_formed(tmp_path):
    manifest = {"sources": {"7": {"kind": "sos", "effective_date": "2026-07-15"},
                            "cdphe_gp": {"kind": "cdphe_gp", "permits": {"gp01": {"date": "2025-07-23"}}}}}
    out = sd.write_source_dates(manifest, tmp_path / "x" / "source-dates.generated.ts")
    text = out.read_text(encoding="utf-8")
    assert text.startswith("// GENERATED FILE")
    assert '"7": { kind: "effective", date: "2026-07-15" },' in text
    assert '"gp01": { kind: "issued", date: "2025-07-23" },' in text
    assert text.endswith("};\n")
    assert sd.render_ts(sd.build_source_dates(manifest)) == text


def test_committed_file_matches_the_committed_manifest():
    """The same check scripts/source-dates.test.ts makes from the TypeScript side."""
    manifest = json.loads(sd.DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    assert sd.DEFAULT_OUT.read_text(encoding="utf-8") == sd.render_ts(sd.build_source_dates(manifest))
    assert sd.main(["--check"]) == 0


def test_check_flag_reports_a_stale_file(tmp_path, capsys):
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps({"sources": {"7": {"kind": "sos", "effective_date": "2026-07-15"}}}))
    out = tmp_path / "gen.ts"
    assert sd.main(["--manifest", str(manifest_path), "--out", str(out), "--check"]) == 1
    assert sd.main(["--manifest", str(manifest_path), "--out", str(out)]) == 0
    assert sd.main(["--manifest", str(manifest_path), "--out", str(out), "--check"]) == 0
    manifest_path.write_text(json.dumps({"sources": {"7": {"kind": "sos", "effective_date": "2027-01-01"}}}))
    assert sd.main(["--manifest", str(manifest_path), "--out", str(out), "--check"]) == 1
    assert "stale" in capsys.readouterr().err


def test_update_manifest_regenerates_the_reader_dates(tmp_path):
    manifest = {"sources": {"3": {"kind": "sos", "ccr": "5 CCR 1001-5", "ruleId": "2337", "deptID": "16", "agencyID": "7",
                                  "ruleVersionId": "OLD", "effective_date": "2020-01-01"}}}
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    dates_path = tmp_path / "dates.ts"
    args = fr.build_arg_parser().parse_args(["--update-manifest", "3", "--manifest", str(manifest_path),
                                             "--fixtures", str(FIXTURES), "--source-dates", str(dates_path)])
    assert fr.cmd_update_manifest(args) == 0
    assert '"3": { kind: "effective", date: "2026-07-15" },' in dates_path.read_text(encoding="utf-8")


def test_update_manifest_of_a_temporary_manifest_writes_no_reader_dates(tmp_path):
    args = fr.build_arg_parser().parse_args(["--update-manifest", "3", "--manifest", str(tmp_path / "m.json")])
    assert fr.source_dates_output(args, tmp_path / "m.json") is None
    args = fr.build_arg_parser().parse_args(["--update-manifest", "3"])
    assert fr.source_dates_output(args, fr.DEFAULT_MANIFEST) == sd.DEFAULT_OUT
    args = fr.build_arg_parser().parse_args(["--update-manifest", "3", "--source-dates", ""])
    assert fr.source_dates_output(args, fr.DEFAULT_MANIFEST) is None
