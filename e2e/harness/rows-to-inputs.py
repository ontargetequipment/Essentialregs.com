#!/usr/bin/env python3
"""
Fixture inputs from DATABASE ROWS instead of the importer's output (16 Oct 2026).

build-fixtures.py wants the importer's reg*_parsed.json files and an overlay;
when those are not at hand (the first build's scratchpad is gone) the same
inputs can be made from rows of public.provisions. Pull them as positional
JSON arrays, one file per batch, with exactly these columns in this order:

  select json_agg(json_build_array(id, citation, title, parent_id, sort_order, full_text,
    ai_summary, summary_status, reviewed_by, reviewed_at, source_url, last_verified_date,
    is_public, summary_model, summary_generated_at) order by sort_order)
  from public.provisions where ...;

and save each result's array to <rows-dir>/<name>.json. Every *.json in the
directory is read; a file named reg7_pad.json may hold text-only rows (the
first six columns) that are added as pending, locked filler so a reader has
body around the rows that matter. The subscriber's Regulation 7 reader needs
more than the public rows (RLS hides nothing from the mock's subscriber), so
a faithful reader pulls at least the ancestors of every public row plus the
sections around them; the whole of Regulation 7 (2,182 rows) is not needed.

  python3 -I e2e/harness/rows-to-inputs.py <rows-dir> e2e/harness/generated/inputs
  python3 e2e/harness/build-fixtures.py \
    --gp05 e2e/harness/generated/inputs/reggp05_parsed.json \
    --reg7 e2e/harness/generated/inputs/reg7_parsed.json \
    --overlay e2e/harness/generated/inputs/overlay.json \
    --docs-dir e2e/harness/generated/inputs/docs

Writes reggp05_parsed.json, reg7_parsed.json, docs/reg<key>_parsed.json (one
per other document: at least its root row, so the indexes list it) and
overlay.json, whose `rows` carry the production summary, review, source and
is_public columns for every row pulled, so the mock's public set is the
database's. Rows outside GP05 and Regulation 7 that the specs pin (the four
older sample rows, GP12 VI.A.1) go in with their document's root. The rows
are the paid corpus: keep them under generated/ (git-ignored).
"""

import json
import os
import re
import sys

COLS = ["id", "citation", "title", "parent_id", "sort_order", "full_text", "ai_summary", "summary_status",
        "reviewed_by", "reviewed_at", "source_url", "last_verified_date", "is_public", "summary_model",
        "summary_generated_at"]
OVERLAY_COLS = ["ai_summary", "summary_status", "reviewed_by", "reviewed_at", "source_url", "last_verified_date",
                "is_public", "summary_model", "summary_generated_at"]


def kind_of(row_id):
    if "-top-REG-" in row_id:
        return "root"
    if "-PART-" in row_id or re.match(r"^sec-[^-]+-P-[^-]+$", row_id):
        return "part"
    if "-APPENDIX-" in row_id or "-ATTACHMENT-" in row_id:
        return "appendix"
    return "item"


def reg_key_of(row_id):
    return re.match(r"^sec-([^-]+)-", row_id).group(1)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    src, out = sys.argv[1], sys.argv[2]
    rows = {}
    pad = os.path.join(src, "reg7_pad.json")
    for name in sorted(os.listdir(src)):
        path = os.path.join(src, name)
        if not name.endswith(".json") or path == pad:
            continue
        for arr in load(path):
            rows[arr[0]] = dict(zip(COLS, arr))
    # Text-only padding rows (Regulation 7 Sections I.A, I.B and the rest of I.C and I.D): pending, no summary, locked.
    for arr in load(pad) if os.path.exists(pad) else []:
        if arr[0] in rows:
            continue
        r = dict(zip(COLS[:6], arr))
        r.update({"ai_summary": None, "summary_status": "pending", "reviewed_by": None, "reviewed_at": None,
                  "source_url": None, "last_verified_date": None, "is_public": False, "summary_model": None,
                  "summary_generated_at": None})
        rows[arr[0]] = r

    by_reg = {}
    for r in rows.values():
        by_reg.setdefault(reg_key_of(r["id"]), []).append(r)

    def parsed(r):
        return {"id": r["id"], "citation": r["citation"], "title": r["title"], "parent_id": r["parent_id"],
                "sort_order": r["sort_order"], "full_text": r["full_text"] or "", "kind": kind_of(r["id"])}

    os.makedirs(os.path.join(out, "docs"), exist_ok=True)
    for key, rs in by_reg.items():
        rs.sort(key=lambda r: (r["sort_order"], r["id"]))
        data = [parsed(r) for r in rs]
        if key == "gp05":
            path = os.path.join(out, "reggp05_parsed.json")
        elif key == "7":
            path = os.path.join(out, "reg7_parsed.json")
        else:
            path = os.path.join(out, "docs", f"reg{key}_parsed.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    overlay = {"rows": {r["id"]: {c: r[c] for c in OVERLAY_COLS} for r in rows.values()}}
    with open(os.path.join(out, "overlay.json"), "w", encoding="utf-8") as f:
        json.dump(overlay, f, ensure_ascii=False)
    print(f"{len(rows)} rows across {len(by_reg)} documents -> {out}")


if __name__ == "__main__":
    main()
