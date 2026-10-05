#!/usr/bin/env python3
"""Prints a compact summary of a review run from its report JSON
(pipeline/out/review_report.json, written by review.py).

The review workflow prints the full report markdown into the job log, and on
a large run that log is longer than the GitHub API returns, so the counts and
cost at the top of the report fall off. This summary is printed as the job's
last step (and by the "Review report summary" workflow for any past run's
artifact): mode, model, counts, actual cost, the table by regulation and every
failed row with its reason. With --ids it also prints the before / after /
reasons of those corrected rows.

    python pipeline/review_summary.py pipeline/out/review_report.json
    python pipeline/review_summary.py report.json --ids sec-7-B-I-D-4,sec-gp01-I-A
"""

from __future__ import annotations

import argparse
import json
import sys


def summarize(data: dict, ids: list[str] | None = None) -> str:
    run, counts, usage = data.get("run", {}), data.get("counts", {}), data.get("usage", {})
    out = ["=== REVIEW RUN SUMMARY ===",
           f"mode: {run.get('mode')}",
           f"model: {run.get('model')} ({run.get('sampling')}); prompt version {run.get('prompt_version')}",
           f"started {run.get('started_at')} finished {run.get('finished_at')}",
           "counts: " + ", ".join(f"{k}={v}" for k, v in counts.items()),
           f"usage: input_tokens={usage.get('input_tokens')} output_tokens={usage.get('output_tokens')} "
           f"cost_usd_batch={usage.get('cost_usd_batch')} batches={','.join(usage.get('batches') or [])}",
           f"cache: cache_read_input_tokens={usage.get('cache_read_input_tokens', 0)} "
           f"cache_creation_input_tokens={usage.get('cache_creation_input_tokens', 0)} "
           f"total_input_tokens={usage.get('total_input_tokens', usage.get('input_tokens'))} "
           f"cache_read_share={usage.get('cache_read_share', 0.0):.1%}"]
    if data.get("audit"):
        a = data["audit"]
        out.append(f"audit: requested={a.get('requested')} seed={a.get('seed')} eligible={a.get('eligible')} "
                   f"exclude_reviewed_by={a.get('exclude_reviewed_by')!r}")
    out.append("by regulation (reg selected pass corrected fail):")
    for reg, b in (data.get("by_regulation") or {}).items():
        out.append(f"  {reg} {b.get('selected')} {b.get('pass')} {b.get('corrected')} {b.get('fail')}")
    failed = data.get("failed") or []
    out.append(f"failed rows ({len(failed)}):")
    for row in failed:
        out.append(f"  {row.get('id')}: {row.get('reason')}")
    if ids:
        wanted = set(ids)
        for row in data.get("corrected") or []:
            if row.get("id") in wanted:
                out.append(f"--- {row['id']} (corrected)")
                out.append(f"before: {row.get('before')}")
                out.append(f"after: {row.get('after')}")
                for c in row.get("changes") or []:
                    out.append(f"  reason: {c.get('reason')}")
    out.append("=== END SUMMARY ===")
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("report_json")
    ap.add_argument("--ids", default="", help="Comma-separated ids whose correction details to print.")
    args = ap.parse_args(argv)
    try:
        with open(args.report_json, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"No report at {args.report_json}.")
        return 0
    print(summarize(data, [i.strip() for i in args.ids.split(",") if i.strip()]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
