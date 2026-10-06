#!/usr/bin/env python3
"""The summary guard checks, in Python, against the live database through
the pipeline's own client (paged past PostgREST's 1,000-row cap).

The canonical checks are 19, 21 and 25 in scripts/corpus_qa.sql (the qa
job on every pull request and the daily Summary guard workflow both run
that file through psql). This module evaluates the same three predicates so
that (a) the chained run can print them at the end of every run -- a run
that leaves a guard above 0 says so in its own log -- and (b) the checks
have mocked-client unit tests (test_run_chain.py). The pending allow-list is
read from the SQL file's `pending_allowlist` CTE so there is exactly one
list.

    python pipeline/summary_guard.py            # prints the three counts and ids, exit 1 when any is above 0
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

import summarize as sz  # noqa: E402

QA_SQL_PATH = Path(__file__).resolve().parent.parent / "scripts" / "corpus_qa.sql"
PIPELINE_MARK = "automated pipeline"
PENDING_HOURS = 24
PAGE = 1000

CHECKS = ("summary_pending_over_24h", "approved_outside_pipeline", "approved_without_review_date")


def read_allowlist(sql_path: Path = QA_SQL_PATH) -> dict[str, str]:
    """id -> reason from the pending_allowlist CTE in scripts/corpus_qa.sql
    (the placeholder entry '__none__' is ignored)."""
    text = sql_path.read_text(encoding="utf-8") if sql_path.exists() else ""
    m = re.search(r"pending_allowlist \(id, reason\) as \(\s*values\s*(.*?)\n\),", text, re.S)
    out: dict[str, str] = {}
    if not m:
        return out
    for pid, reason in re.findall(r"\('([^']+)',\s*'((?:[^']|'')*)'\)", m.group(1)):
        if pid != "__none__":
            out[pid] = reason.replace("''", "'")
    return out


def _page_all(client, build):
    """Pages a select built by `build(q)` past the cap, ordered by id."""
    rows: list[dict] = []
    start = 0
    while True:
        q = build(client.table("provisions").select("id, summary_status, reviewed_by, reviewed_at, ai_summary, summary_generated_at, updated_at"))
        page = q.order("id").range(start, start + PAGE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        start += PAGE


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def run_checks(client, now: Optional[datetime] = None, allowlist: Optional[dict[str, str]] = None) -> dict:
    """{check: {"count": n, "ids": [...], "allowlisted": [...]}} for the
    three guard checks."""
    now = now or datetime.now(timezone.utc)
    allow = read_allowlist() if allowlist is None else allowlist
    approved = _page_all(client, lambda q: q.in_("summary_status", ["approved", "edited"]))
    pending = _page_all(client, lambda q: q.eq("summary_status", "pending").not_.is_("ai_summary", "null"))

    outside = sorted(r["id"] for r in approved
                     if PIPELINE_MARK.lower() not in (r.get("reviewed_by") or "").lower())
    no_date = sorted(r["id"] for r in approved if not r.get("reviewed_at"))
    cutoff = now - timedelta(hours=PENDING_HOURS)
    stale: list[str] = []
    allowlisted: list[str] = []
    for r in pending:
        ts = _parse_ts(r.get("summary_generated_at")) or _parse_ts(r.get("updated_at"))
        if ts is not None and ts < cutoff:
            if r["id"] in allow:
                allowlisted.append(f"{r['id']} ({allow[r['id']]})")
            else:
                stale.append(r["id"])
    return {
        "summary_pending_over_24h": {"count": len(stale), "ids": sorted(stale), "allowlisted": sorted(allowlisted)},
        "approved_outside_pipeline": {"count": len(outside), "ids": outside},
        "approved_without_review_date": {"count": len(no_date), "ids": no_date},
    }


def format_results(results: dict) -> list[str]:
    lines = []
    for name in CHECKS:
        r = results[name]
        verdict = "as expected" if r["count"] == 0 else "*** CHECK ***"
        ids = ", ".join(r["ids"][:30]) + (" ..." if len(r["ids"]) > 30 else "")
        lines.append(f"GUARD,{name},{r['count']},{verdict},0" + (f",Rows: {ids}" if ids else ""))
        if r.get("allowlisted"):
            lines.append(f"  allow-listed (still pending): {'; '.join(r['allowlisted'])}")
    return lines


def main(argv: Optional[list[str]] = None) -> int:
    sz.require_env(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
    client = sz.make_supabase_client()
    results = run_checks(client)
    print("\n".join(format_results(results)))
    out = Path(__file__).resolve().parent / "out"
    out.mkdir(parents=True, exist_ok=True)
    (out / "summary_guard.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    return 1 if any(results[c]["count"] for c in CHECKS) else 0


if __name__ == "__main__":
    sys.exit(main())
