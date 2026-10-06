#!/usr/bin/env python3
"""The writer proof (ReviewBuiltIn item 3): regenerate the same provisions
with the OLD and the NEW writer instructions, without writing to the
database, and let the reviewer score both sets in audit mode.

Selection: provisions the pipeline reviewer corrected in October 2026
(reviewed_by contains "summary corrected, automated pipeline", reviewed_at
in October), spread across groups -- the general permits, Regulation 3,
Regulation 7, a federal subpart (oooob) and ECMC -- a seeded sample per
group. Rows whose provision text exceeds the OLD 6,000-word cap or whose
descendants are shown as an outline are left out: both writers would be
summarizing a cut text and the reviewer would fail both.

For every selected row, two writer requests go out in one batch (the old
system prompt with the old parent-excerpt user prompt, legacy_writer.py; the
new system prompt with the ancestor block, summarize.py). The answers are
NOT written anywhere; they are put through the same guards the real run
uses (wrapper tags stripped, hedging and cut-off noted) and then reviewed by
review.py's reviewer with the same prompt and validator, in one batch of
2 x N requests. The reviewer gets, for each arm, exactly the text it gets
in production (the ancestor block, the provision, the descendants) plus the
generated summary. Nothing in the database changes.

Report (pipeline/out/writer_proof.md + .json): the would-correct rate for
each arm (corrected + fail over reviewed), the pass / corrected / fail
counts per group, the ten most common remaining reasons under the new
writer (keyword tally), every row with both summaries and the reviewer's
verdicts, and the actual cost. --dry-run quotes the cost from the free
count_tokens endpoint and stops; --max-cost refuses to submit above it.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

import legacy_writer  # noqa: E402
import review  # noqa: E402
import summarize as sz  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "out"
REPORT_MD = OUT_DIR / "writer_proof.md"
REPORT_JSON = OUT_DIR / "writer_proof.json"

ARMS = ("old", "new")
DEFAULT_GROUPS = "gp:30,3:30,7:30,oooob:30,ecmc:30"
CORRECTED_MARK = "summary corrected, automated pipeline"

REASON_BUCKETS: list[tuple[str, str]] = [
    ("party named differently", r"the Division|the Commission|Administrator|Director|\boperator|\bparty\b|names no|not name|does not name|\bwho\b|applicant|permittee|agency|\bEPA\b|CDPHE|\bowner|manufacturer"),
    ("statement the text does not make", r"not in the text|unsupported|does not say|says nothing|not stated|does not state|not mention|no mention|never (says|mentions|states)|not supported|nothing about|text (does|says) not|does not (describe|call|specify|give|provide|indicate|use)"),
    ("wrong term or paraphrase", r"says '|says \"|uses '|uses \"|, not '|, not \"|rather than|instead of|\bnot '|\bnot \"|wording|\bterm\b|\bword\b"),
    ("citation or cross-reference", r"§|\bcites?\b|cross-?ref|section [IVX0-9]|rule \d|paragraph \(|refers to|reference|table \d|incorporat"),
    ("option presented as a duty", r"\bmay\b|\bmust\b|\bshall\b|\bshould\b|option|alternative|mandatory|discretion|required to|not require|\ballow|\bduty\b|obligat"),
    ("dropped condition or exception", r"condition|exception|exempt|unless|provided that|qualifi|omit|left out|missing|dropped|notwithstanding|only (when|if|where)|as applicable|subject to|except\b"),
    ("limit from a parent paragraph", r"parent|ancestor|chapeau"),
    ("date, deadline or timing", r"deadline|due date|\bdate\b|calendar day|\bdays\b|\bmonths\b|within \d|\b(19|20)\d{2}\b|annual|timing|effective date|\bperiod\b"),
    ("number, threshold or unit", r"threshold|percent|%|\btons\b|\bfeet\b|horsepower|\bhp\b|minimum|maximum|no more than|exceed|\blimit\b|\brate\b"),
    ("scope wider", r"widen|broad|wider|generaliz|\bevery\b|\ball\b|\bany\b|statewide"),
    ("scope narrower", r"narrow|limited to|\bonly to\b|restrict|\bjust\b|solely"),
    ("acronym expansion", r"acronym|abbreviat|expan[ds]|without expanding|spell(s|ed)? out"),
    ("list presented as complete", r"not limited to|exhaustive|namely|\bspecifically\b|the only"),
    ("purpose or rationale added", r"purpose|rationale|because|\bwhy\b|intent|in order to|explain"),
    ("added at least / only / any", r"'at least'|\"at least\"|'only'|\"only\"|'any'|\"any\"|'all'|\"all\""),
    ("stray Markdown", r"stray markdown"),
]


def bucket_reasons(reasons: list[str]) -> Counter:
    c: Counter = Counter()
    for r in reasons:
        hit = False
        for name, pat in REASON_BUCKETS:
            if re.search(pat, r, re.I):
                c[name] += 1
                hit = True
        if not hit:
            c["other"] += 1
    return c


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

def parse_groups(spec: str) -> list[tuple[str, int]]:
    out = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        key, n = part.split(":")
        out.append((key.strip(), int(n)))
    return out


def group_of(provision_id: str, groups: list[tuple[str, int]]) -> Optional[str]:
    reg = sz.reg_key_of(provision_id) or ""
    for key, _n in groups:
        if key == "gp" and reg.startswith("gp"):
            return "gp"
        if reg == key:
            return key
    return None


def select_corrected_rows(client, groups: list[tuple[str, int]], seed: int, since: str,
                          until: str) -> tuple[list[dict], dict]:
    """A seeded sample per group of rows the pipeline corrected between
    `since` and `until`: approved/edited, reviewed_by containing
    CORRECTED_MARK. Returns (rows with the candidate columns, info)."""
    eligible: dict[str, list[str]] = {}
    start = 0
    while True:
        q = (client.table("provisions").select("id, reviewed_by, reviewed_at")
             .in_("summary_status", ["approved", "edited"])
             .not_.is_("ai_summary", "null")
             .gte("reviewed_at", since).lt("reviewed_at", until))
        page = q.order("id").range(start, start + sz.META_PAGE_SIZE - 1).execute().data or []
        for row in page:
            if CORRECTED_MARK not in (row.get("reviewed_by") or ""):
                continue
            g = group_of(row["id"], groups)
            if g:
                eligible.setdefault(g, []).append(row["id"])
        if len(page) < sz.META_PAGE_SIZE:
            break
        start += sz.META_PAGE_SIZE
    rng = random.Random(seed)
    picked: list[str] = []
    for key, n in groups:
        ids = sorted(eligible.get(key, []))
        rng.shuffle(ids)
        picked.extend(ids[:n])
    rows_by_id: dict[str, dict] = {}
    for s in range(0, len(picked), sz.DB_PAGE_SIZE):
        chunk = picked[s:s + sz.DB_PAGE_SIZE]
        q = client.table("provisions").select(review.CANDIDATE_COLUMNS).in_("id", chunk)
        for row in q.execute().data or []:
            rows_by_id[row["id"]] = row
    rows = [rows_by_id[i] for i in picked if i in rows_by_id]
    info = {"groups": dict(groups), "seed": seed, "since": since, "until": until,
            "eligible_by_group": {k: len(v) for k, v in sorted(eligible.items())}}
    return rows, info


# --------------------------------------------------------------------------
# Writer and reviewer requests
# --------------------------------------------------------------------------

def writer_params(result: sz.PromptResult, model: str) -> dict:
    return {"model": model, "max_tokens": sz.MAX_TOKENS, "temperature": sz.TEMPERATURE,
            "system": result.system, "messages": [{"role": "user", "content": result.prompt}]}


def build_arms(rows: list[dict], meta: dict, children_index: dict) -> tuple[dict[str, dict[str, sz.PromptResult]], list[str]]:
    """{pid: {"old": PromptResult, "new": PromptResult}} and the ids left out."""
    arms: dict[str, dict[str, sz.PromptResult]] = {}
    left_out: list[str] = []
    for row in rows:
        old = legacy_writer.legacy_build_prompt(row, meta, children_index)
        new = sz.build_prompt(row, meta, children_index)
        if old.truncated or new.truncated or old.outline_mode or new.outline_mode or new.body_word_count < sz.MIN_WORDS:
            left_out.append(row["id"])
            continue
        arms[row["id"]] = {"old": old, "new": new}
    return arms, left_out


def submit_and_collect(client_anthropic, requests: list[dict], poll_interval: int) -> dict[str, object]:
    """Submits `requests` in batches of BATCH_MAX_REQUESTS, polls, returns
    {custom_id: message or None} with usage left on the messages."""
    pending = []
    for start in range(0, len(requests), sz.BATCH_MAX_REQUESTS):
        chunk = requests[start:start + sz.BATCH_MAX_REQUESTS]
        batch = client_anthropic.messages.batches.create(requests=chunk)
        print(f"  submitted batch {batch.id} ({len(chunk)} requests)")
        pending.append(batch)
    results: dict[str, object] = {}
    deadline = time.monotonic() + sz.MAX_POLL_SECONDS
    while pending:
        still = []
        for batch in pending:
            b = client_anthropic.messages.batches.retrieve(batch.id)
            if b.processing_status != "ended":
                still.append(b)
                continue
            for item in client_anthropic.messages.batches.results(b.id):
                results[item.custom_id] = item.result.message if item.result.type == "succeeded" else None
        pending = still
        if pending:
            if time.monotonic() > deadline:
                raise RuntimeError("batch poll timeout")
            time.sleep(poll_interval)
    return results


def tally(verdicts: dict[str, dict[str, review.Verdict]], arm: str, rows: list[dict], groups) -> dict:
    counts = {"reviewed": 0, "pass": 0, "corrected": 0, "fail": 0}
    by_group: dict[str, dict] = {}
    for row in rows:
        v = verdicts.get(row["id"], {}).get(arm)
        if v is None:
            continue
        g = group_of(row["id"], groups) or "?"
        bucket = by_group.setdefault(g, {"reviewed": 0, "pass": 0, "corrected": 0, "fail": 0})
        for b in (counts, bucket):
            b["reviewed"] += 1
            b[v.verdict] += 1
    counts["would_correct_rate"] = ((counts["corrected"] + counts["fail"]) / counts["reviewed"]) if counts["reviewed"] else 0.0
    for b in by_group.values():
        b["would_correct_rate"] = ((b["corrected"] + b["fail"]) / b["reviewed"]) if b["reviewed"] else 0.0
    return {"counts": counts, "by_group": by_group}


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Old vs new writer instructions, scored by the reviewer; read-only.")
    p.add_argument("--groups", default=DEFAULT_GROUPS, help="group:count, comma-separated (gp = every general permit).")
    p.add_argument("--seed", type=int, default=20261006)
    p.add_argument("--since", default="2026-10-01T00:00:00Z")
    p.add_argument("--until", default="2026-11-01T00:00:00Z")
    p.add_argument("--writer-model", default=sz.DEFAULT_MODEL)
    p.add_argument("--review-model", default=review.DEFAULT_MODEL)
    p.add_argument("--effort", default=review.DEFAULT_EFFORT, choices=["low", "medium", "high"])
    p.add_argument("--max-cost", type=float, default=3.0, help="Refuse to submit above this estimate (USD).")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--execute", action="store_true")
    p.add_argument("--poll-interval", type=int, default=sz.POLL_INTERVAL_SECONDS)
    p.add_argument("--arms", default="old,new", help="Which writers to run (old,new).")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    execute = args.execute and not args.dry_run
    sz.require_env(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] + (["ANTHROPIC_API_KEY"] if execute else []))
    client_supabase = sz.make_supabase_client()
    client_anthropic = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        client_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    started = datetime.now(timezone.utc).isoformat()
    groups = parse_groups(args.groups)
    arms_wanted = [a for a in args.arms.split(",") if a in ARMS]

    print("Fetching metadata (all regulations)...")
    meta = sz.fetch_meta(client_supabase, None)
    children_index = sz.build_children_index(meta)
    rows, info = select_corrected_rows(client_supabase, groups, args.seed, args.since, args.until)
    print(f"  eligible by group: {info['eligible_by_group']}; selected {len(rows)}")
    arms, left_out = build_arms(rows, meta, children_index)
    rows = [r for r in rows if r["id"] in arms]
    print(f"  {len(rows)} rows in the proof ({len(left_out)} left out: over the old cap, outline mode or headings-only)")

    # --- estimate -----------------------------------------------------------
    writer_tokens = 0
    for pid, pair in arms.items():
        for arm in arms_wanted:
            writer_tokens += (sz.count_request_tokens(client_anthropic, args.writer_model, pair[arm])
                              if client_anthropic else sz.estimate_request_tokens(pair[arm]))
    n_writer = len(arms) * len(arms_wanted)
    writer_cost = sz.estimate_cost(args.writer_model, writer_tokens, sz.EST_OUTPUT_TOKENS * n_writer, batch=True)
    # reviewer: the review prompt with a placeholder summary
    placeholder = " ".join(["word"] * 120) + "."
    reviews_est = []
    for row in rows:
        r = dict(row)
        r["ai_summary"] = placeholder
        reviews_est.append(review.build_review_input(r, meta, children_index))
    ceiling, method, floor = review.estimate_run_cost(client_anthropic, reviews_est, args.review_model)
    review_cost = floor * len(arms_wanted)
    total = writer_cost + review_cost
    print(f"Estimate: writer ${writer_cost:,.2f} ({n_writer} requests) + reviewer ${review_cost:,.2f} "
          f"({len(reviews_est) * len(arms_wanted)} requests, {method}) = ${total:,.2f}; cap ${args.max_cost:,.2f}")
    data = {"run": {"started_at": started, "mode": "execute" if execute else "dry run", "writer_model": args.writer_model,
                    "review_model": args.review_model, "effort": args.effort, "review_prompt_version": review.REVIEW_PROMPT_VERSION,
                    "selection": info, "rows": len(rows), "left_out": left_out, "arms": arms_wanted},
            "estimate": {"writer_usd": writer_cost, "review_usd": review_cost, "total_usd": total, "method": method}}
    if total > args.max_cost:
        print(f"Refusing: estimate ${total:,.2f} exceeds --max-cost ${args.max_cost:,.2f}.", file=sys.stderr)
        _write(data, [f"# Writer proof -- refused: estimate ${total:,.2f} over ${args.max_cost:,.2f}"])
        return 2
    if not execute:
        _write(data, [f"# Writer proof -- dry run", "", f"{len(rows)} rows; estimate ${total:,.2f}."])
        print("DRY RUN: nothing submitted.")
        return 0

    # --- writers ------------------------------------------------------------
    custom_map: dict[str, str] = {}
    requests = []
    for pid, pair in arms.items():
        for arm in arms_wanted:
            cid = sz.make_custom_id(f"{arm}__{pid}", custom_map)
            requests.append({"custom_id": cid, "params": writer_params(pair[arm], args.writer_model)})
    print(f"Submitting {len(requests)} writer requests...")
    w_results = submit_and_collect(client_anthropic, requests, args.poll_interval)
    summaries: dict[str, dict[str, str]] = {}
    writer_usage = {"in": 0, "out": 0}
    writer_notes: dict[str, dict[str, str]] = {}
    for cid, message in w_results.items():
        key = custom_map[cid]
        arm, pid = key.split("__", 1)
        if message is None:
            writer_notes.setdefault(pid, {})[arm] = "writer API error"
            continue
        writer_usage["in"] += message.usage.input_tokens
        writer_usage["out"] += message.usage.output_tokens
        text = sz.strip_wrapper_tags(sz._message_text(message))
        note = []
        if sz.is_hedging(text):
            note.append("hedging")
        if sz.is_cut_off(text, getattr(message, "stop_reason", None)):
            note.append("cut off")
        if note:
            writer_notes.setdefault(pid, {})[arm] = ", ".join(note)
        summaries.setdefault(pid, {})[arm] = text
    writer_cost_actual = sz.estimate_cost(args.writer_model, writer_usage["in"], writer_usage["out"], batch=True)
    print(f"  writer done: {len(summaries)} rows, ${writer_cost_actual:,.4f}")

    # --- reviewer -----------------------------------------------------------
    reviews: dict[str, review.ReviewInput] = {}
    r_requests = []
    r_map: dict[str, str] = {}
    for pid, by_arm in summaries.items():
        row = next(r for r in rows if r["id"] == pid)
        for arm, text in by_arm.items():
            if not text:
                continue
            r = dict(row)
            r["ai_summary"] = text
            ri = review.build_review_input(r, meta, children_index)
            key = f"{arm}__{pid}"
            reviews[key] = ri
            cid = sz.make_custom_id(key, r_map)
            r_requests.append({"custom_id": cid, "params": review.request_params(ri, args.review_model, args.effort)})
    print(f"Submitting {len(r_requests)} reviewer requests...")
    r_results = submit_and_collect(client_anthropic, r_requests, args.poll_interval)
    r_stats = review.RunStats()
    verdicts: dict[str, dict[str, review.Verdict]] = {}
    for cid, message in r_results.items():
        key = r_map[cid]
        arm, pid = key.split("__", 1)
        if message is None:
            continue
        r_stats.add_usage(message.usage, sz.reg_key_of(pid))
        verdicts.setdefault(pid, {})[arm] = review.verdict_from_message(message, reviews[key])
    review_cost_actual = r_stats.cost(args.review_model)
    print(f"  reviewer done: ${review_cost_actual:,.4f}")

    # --- report -------------------------------------------------------------
    results = {arm: tally(verdicts, arm, rows, groups) for arm in arms_wanted}
    reasons_new = [c["reason"] for pid in verdicts for v in [verdicts[pid].get("new")] if v
                   for c in (v.changes if v.verdict == "corrected" else [{"reason": v.reason}])]
    reasons_old = [c["reason"] for pid in verdicts for v in [verdicts[pid].get("old")] if v
                   for c in (v.changes if v.verdict == "corrected" else [{"reason": v.reason}])]
    data.update({
        "results": results,
        "cost": {"writer_usd": writer_cost_actual, "review_usd": review_cost_actual,
                 "total_usd": writer_cost_actual + review_cost_actual,
                 "writer_usage": writer_usage, "review_cache_read_share": r_stats.cache_read_share},
        "remaining_reasons_new": bucket_reasons(reasons_new).most_common(),
        "remaining_reasons_old": bucket_reasons(reasons_old).most_common(),
        "rows": [{
            "id": row["id"], "group": group_of(row["id"], groups),
            "summaries": summaries.get(row["id"], {}),
            "writer_notes": writer_notes.get(row["id"], {}),
            "verdicts": {arm: {"verdict": v.verdict, "reason": v.reason, "changes": v.changes,
                               "corrected_summary": v.corrected_summary}
                         for arm, v in verdicts.get(row["id"], {}).items()},
        } for row in rows],
    })
    md = [f"# Writer proof -- old vs new writer instructions (read-only), {started[:10]}", "",
          f"- {len(rows)} provisions the reviewer corrected in October 2026 (seed {args.seed}; groups {info['groups']}; "
          f"eligible {info['eligible_by_group']}; {len(left_out)} left out as over the old 6,000-word cap, outline mode or headings-only)",
          f"- Writer `{args.writer_model}` (temperature 0, batch); reviewer `{args.review_model}` (effort {args.effort}, "
          f"prompt version {review.REVIEW_PROMPT_VERSION}, audit mode: nothing written)",
          f"- Cost: writer ${writer_cost_actual:,.4f} + reviewer ${review_cost_actual:,.4f} = "
          f"**${writer_cost_actual + review_cost_actual:,.4f}** (estimate was ${total:,.2f}; cap ${args.max_cost:,.2f})",
          "", "## Would-correct rate", "", "| writer | reviewed | pass | corrected | fail | would-correct rate |", "|---|---:|---:|---:|---:|---:|"]
    for arm in arms_wanted:
        c = results[arm]["counts"]
        md.append(f"| {arm} | {c['reviewed']} | {c['pass']} | {c['corrected']} | {c['fail']} | **{c['would_correct_rate']:.1%}** |")
    md += ["", "## By group", "", "| group | " + " | ".join(f"{arm}: would-correct" for arm in arms_wanted) + " |",
           "|---|" + "---:|" * len(arms_wanted)]
    for key, _n in groups:
        cells = []
        for arm in arms_wanted:
            b = results[arm]["by_group"].get(key)
            cells.append(f"{b['would_correct_rate']:.1%} ({b['corrected'] + b['fail']}/{b['reviewed']})" if b else "-")
        md.append(f"| {key} | " + " | ".join(cells) + " |")
    md += ["", "## Most common remaining reasons (new writer, keyword tally over the reviewer's reasons)", ""]
    md += [f"- {name}: {n}" for name, n in bucket_reasons(reasons_new).most_common(10)]
    md += ["", "## Most common reasons (old writer)", ""]
    md += [f"- {name}: {n}" for name, n in bucket_reasons(reasons_old).most_common(10)]
    md += ["", "## Rows", ""]
    for r in data["rows"]:
        md.append(f"### {r['id']} ({r['group']})")
        for arm in arms_wanted:
            v = r["verdicts"].get(arm, {})
            md.append(f"- **{arm}** -> {v.get('verdict', 'no verdict')}" + (f" ({r['writer_notes'][arm]})" if arm in r["writer_notes"] else ""))
            md.append(f"  - summary: {r['summaries'].get(arm, '(none)')}")
            if v.get("verdict") == "corrected":
                for ch in v["changes"]:
                    md.append(f"  - reason: {ch['reason']}")
            elif v.get("verdict") == "fail":
                md.append(f"  - fail: {v.get('reason')}")
        md.append("")
    _write(data, md)
    for arm in arms_wanted:
        c = results[arm]["counts"]
        print(f"{arm}: reviewed {c['reviewed']}, pass {c['pass']}, corrected {c['corrected']}, fail {c['fail']}, "
              f"would-correct {c['would_correct_rate']:.1%}")
    print(f"Report: {REPORT_MD}")
    return 0


def _write(data: dict, md: list[str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text("\n".join(md), encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
