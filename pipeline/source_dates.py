#!/usr/bin/env python3
"""
source_dates.py -- the dates the reader needs, generated from the manifest.

The cross-regulation preview popup (src/components/RegulationReader.tsx)
tells a reader when the document they are reading predates the current text
of the regulation it cites ("GP01 was issued 07/23/2025; shown is the
current Regulation 7, effective 07/15/2026. Numbering may differ."). Those
dates are never typed by hand in src/: this script reads
pipeline/sources/manifest.json (the one record of what version of each
source we hold) and writes src/lib/source-dates.generated.ts, one entry per
imported document:

    sos       -> kind "effective", the rule's effective_date
    ecfr      -> kind "as_of",     the eCFR as_of date
    cdphe_gp  -> one entry per permit (gp01 ...), kind "issued", its date

`freshness.py --update-manifest KEY` runs this after it rewrites the
manifest, so a re-import that records a new version updates the reader's
dates in the same commit. scripts/source-dates.test.ts fails whenever the
generated file and the manifest disagree, so a forgotten regeneration
cannot reach main.

    python pipeline/source_dates.py            # rewrite src/lib/source-dates.generated.ts
    python pipeline/source_dates.py --check    # exit 1 if the file is stale (no write)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "sources" / "manifest.json"
DEFAULT_OUT = HERE.parent / "src" / "lib" / "source-dates.generated.ts"

KIND_BY_SOURCE = {"sos": "effective", "ecfr": "as_of"}


def build_source_dates(manifest: dict) -> dict[str, dict[str, str]]:
    """{document key: {"kind": ..., "date": "YYYY-MM-DD"}} from a loaded
    manifest. Keys are the reg keys provision ids carry ("7", "gp01",
    "oooob"); a source with no usable date is left out rather than guessed."""
    out: dict[str, dict[str, str]] = {}
    for key, entry in (manifest.get("sources") or {}).items():
        kind = entry.get("kind")
        if kind == "sos":
            date = entry.get("effective_date")
            if date:
                out[key] = {"kind": "effective", "date": date}
        elif kind == "ecfr":
            date = entry.get("as_of")
            if date:
                out[key] = {"kind": "as_of", "date": date}
        elif kind == "cdphe_gp":
            for gp, permit in (entry.get("permits") or {}).items():
                date = (permit or {}).get("date")
                if date:
                    out[gp.lower()] = {"kind": "issued", "date": date}
    return dict(sorted(out.items()))


def render_ts(dates: dict[str, dict[str, str]]) -> str:
    lines = [
        "// GENERATED FILE -- do not edit by hand.",
        "// Written by `python pipeline/source_dates.py` from pipeline/sources/manifest.json",
        "// (`freshness.py --update-manifest KEY` runs it). scripts/source-dates.test.ts",
        "// fails when this file and the manifest disagree.",
        "",
        "/** How a document's date is to be read: a rule's effective date, a permit's issuance date, an eCFR as-of date. */",
        'export type SourceDateKind = "effective" | "issued" | "as_of";',
        "export type SourceDate = { readonly kind: SourceDateKind; readonly date: string };",
        "",
        "/** The version of each imported document we hold, by reg key, dates ISO (YYYY-MM-DD). */",
        "export const SOURCE_DATES: Readonly<Record<string, SourceDate>> = {",
    ]
    for key, v in dates.items():
        lines.append(f'  {json.dumps(key)}: {{ kind: {json.dumps(v["kind"])}, date: {json.dumps(v["date"])} }},')
    lines.append("};")
    return "\n".join(lines) + "\n"


def write_source_dates(manifest: dict, out_path: Path = DEFAULT_OUT) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_ts(build_source_dates(manifest)), encoding="utf-8")
    return out_path


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    p.add_argument("--out", default=str(DEFAULT_OUT))
    p.add_argument("--check", action="store_true", help="exit 1 when the generated file is not what the manifest gives; write nothing")
    args = p.parse_args(argv)
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    expected = render_ts(build_source_dates(manifest))
    out = Path(args.out)
    if args.check:
        current = out.read_text(encoding="utf-8") if out.exists() else ""
        if current != expected:
            print(f"{out} is stale: run `python pipeline/source_dates.py`", file=sys.stderr)
            return 1
        print(f"{out} matches {args.manifest}")
        return 0
    write_source_dates(manifest, out)
    print(f"Wrote {out} ({len(build_source_dates(manifest))} documents)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
