#!/usr/bin/env python3
"""The chained run: summarize -> review -> (regenerate what failed, once,
and review it again) -> embed. One run, one report, one budget.

Owner decision (Brody, 5 Oct 2026): review is part of how a regulation gets
onto the site. No summary reaches a customer labelled "AI reviewed" without
passing through pipeline/review.py, and nobody has to ask for it. Until this
run existed the review was a separate workflow someone had to remember to
start, which is why 19,000 summaries needed a catch-up pass in October 2026.

What one run does, for the rows it selects (the same selection flags as
summarize.py: --reg / --limit / --force / --parents / --ids / --ids-file, plus
--ancestor-ids-file from the importer):

  1. summarize  -- summarize.run_batch writes every summary as PENDING and
                   returns exactly the ids it wrote;
  2. review     -- review.run_reviews on exactly those ids: pass -> approved,
                   corrected -> approved with the corrected text, fail ->
                   still pending;
  3. regenerate -- the rows the reviewer failed are regenerated once
                   (summarize.run_batch on those ids) and reviewed again;
                   rows that fail twice stay pending and are listed at the
                   TOP of the report;
  4. embed      -- embed.py on the rows the run wrote (changed chunks only),
                   so Ask and the related panel see the new text;
  5. report     -- pipeline/out/chain_report.md + .json (the budget at the
                   top, the still-pending rows next, then counts, costs by
                   regulation and stage, the batch ids for a resume, and
                   every corrected row with before / after / reasons), and
                   the 40-row spot-check sample for the Cowork session
                   (--sample-dir docs/imports/<date>): 20 pass, 20 corrected,
                   seeded, each with the ancestor text the reviewer saw.

The budget (budget.py, STANDING_BUDGET_USD = $10 per regulation per run
across all three stages, overridable only by --approved-budget, which the
report prints at the top): before the first paid call the run estimates all
three stages plus a regeneration allowance per regulation; any regulation
over the budget stops the run with nothing submitted (exit 2). During the
run every stage records actual spend per regulation; passing the budget
cancels the remaining batches and leaves the remaining rows pending.

Resume (the stage 2b lesson): every stage's batch ids are written to
pipeline/out/chain_state.json as soon as they are submitted. A run that dies
after submitting is re-run with the same selection flags and
--resume-batches "summarize=msgbatch_a,msgbatch_b;review=msgbatch_c;..."
(the stage names are summarize, review, regenerate, review2): each named
stage consumes its batches instead of submitting, pays nothing, and the
stages after it run normally. The database client reconnects by itself
(dbclient.py).

--dry-run: selection and the estimate only; no paid call, no write.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

import budget as budget_module  # noqa: E402
import embed  # noqa: E402
import review  # noqa: E402
import summarize as sz  # noqa: E402

PIPELINE_DIR = Path(__file__).resolve().parent
OUT_DIR = PIPELINE_DIR / "out"
REPORT_MD_PATH = OUT_DIR / "chain_report.md"
REPORT_JSON_PATH = OUT_DIR / "chain_report.json"
STATE_PATH = OUT_DIR / "chain_state.json"

STAGES = ("summarize", "review", "regenerate", "review2", "embed")
REGEN_ALLOWANCE = 0.15          # share of (summarize + review) reserved for the regenerate-and-review-again round
PLACEHOLDER_SUMMARY_WORDS = 120  # the review estimate before any summary exists
SAMPLE_SIZE = 40
SAMPLE_TEXT_CHARS = 1200
SAMPLE_ANCESTOR_CHARS = 700


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

def parse_resume(spec: Optional[str]) -> dict[str, list[str]]:
    """"summarize=a,b;review=c" -> {"summarize": ["a", "b"], "review": ["c"]}."""
    out: dict[str, list[str]] = {}
    for part in (spec or "").split(";"):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            raise ValueError(f"resume spec {part!r} must be stage=batch_id[,batch_id]")
        stage, ids = part.split("=", 1)
        stage = stage.strip()
        if stage not in STAGES:
            raise ValueError(f"unknown stage {stage!r}; stages are {', '.join(STAGES)}")
        out[stage] = [b.strip() for b in ids.split(",") if b.strip()]
    return out


def select_ancestor_rows(client, ancestor_ids: list[str], meta: dict, children_index: dict) -> tuple[list[dict], list[str]]:
    """The ancestor rows to regenerate after an import: those that have a
    summary of their own and whose prompt actually holds the descendants'
    bodies (not outline mode). Returns (rows, skipped ids with reasons)."""
    rows: list[dict] = []
    skipped: list[str] = []
    for start in range(0, len(ancestor_ids), sz.DB_PAGE_SIZE):
        chunk = ancestor_ids[start:start + sz.DB_PAGE_SIZE]
        q = (client.table("provisions")
             .select("id, citation, title, parent_id, full_text, sort_order, ai_summary")
             .in_("id", chunk))
        by_id = {r["id"]: r for r in (q.execute().data or [])}
        for pid in chunk:
            row = by_id.get(pid)
            if row is None:
                skipped.append(f"{pid}: not found")
                continue
            if not row.get("ai_summary"):
                skipped.append(f"{pid}: no summary of its own (heading-only row)")
                continue
            result = sz.build_prompt(row, meta, children_index)
            if result.outline_mode:
                skipped.append(f"{pid}: descendants shown as an outline only; their text is not in its input")
                continue
            rows.append(row)
    return rows, skipped


def select_rows(client, args, meta: dict, children_index: dict) -> tuple[list[dict], list[str], list[str]]:
    """(rows, explicit ids or None, ancestor notes)."""
    if args.ids_file:
        ids = sz.load_ids_file(args.ids_file)
    elif args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
    else:
        ids = None
    rows = list(sz.iter_candidates(client, args.reg, args.force, args.limit, ids=ids,
                                   parent_ids=set(children_index) if args.parents else None,
                                   longer_than=args.longer_than))
    notes: list[str] = []
    if args.ancestor_ids_file:
        ancestor_ids = [a for a in sz.load_ids_file(args.ancestor_ids_file) if a not in {r["id"] for r in rows}]
        anc_rows, skipped = select_ancestor_rows(client, ancestor_ids, meta, children_index)
        rows.extend(anc_rows)
        notes.append(f"{len(anc_rows)} ancestor rows added (summaries written from the provision plus its descendants)")
        notes.extend(f"ancestor skipped: {s}" for s in skipped)
        ids = (ids or []) + [r["id"] for r in anc_rows]
    return rows, ids, notes


# --------------------------------------------------------------------------
# Estimates
# --------------------------------------------------------------------------

def estimate_all_stages(client_anthropic, rows: list[dict], meta: dict, children_index: dict,
                        writer_model: str, review_model: str, budget: budget_module.Budget,
                        explicit: bool) -> dict:
    """Every stage's estimate per regulation, before the first paid call:
    summarize (count_tokens on the real prompts), review (count_tokens on the
    review prompt with a placeholder summary of PLACEHOLDER_SUMMARY_WORDS),
    a regeneration allowance (REGEN_ALLOWANCE of the two), and embed
    (text size at the Voyage rate). Returns the per-row prompts so the
    stages need not rebuild them."""
    prompts: dict[str, sz.PromptResult] = {}
    for row in rows:
        result = sz.prompt_for_row(row, meta, children_index, explicit)
        if result is not None:
            prompts[row["id"]] = result
    sz.estimate_into_budget(client_anthropic, writer_model, prompts, budget)
    placeholder = " ".join(["word"] * PLACEHOLDER_SUMMARY_WORDS) + "."
    reviews = []
    for row in rows:
        if row["id"] not in prompts:
            continue
        r = dict(row)
        r["ai_summary"] = placeholder
        reviews.append(review.build_review_input(r, meta, children_index))
    review.estimate_into_budget(client_anthropic, reviews, review_model, budget)
    for reg in list(budget.estimates):
        base = budget.estimates[reg].get("summarize", 0.0) + budget.estimates[reg].get("review", 0.0)
        budget.estimate(reg, "regenerate", base * REGEN_ALLOWANCE)
    for row in rows:
        chars = len(sz.strip_html(row.get("full_text") or "")) + 700
        budget.estimate(sz.reg_key_of(row["id"]) or "?", "embed", embed.estimate_cost(embed.DEFAULT_MODEL, embed.estimate_tokens(chars)))
    return prompts


# --------------------------------------------------------------------------
# State (for resume)
# --------------------------------------------------------------------------

def write_state(state: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


# --------------------------------------------------------------------------
# Stages
# --------------------------------------------------------------------------

def stage_summarize(client_anthropic, client_supabase, rows, meta, children_index, model, budget,
                    explicit: bool, regenerated: bool, resume: Optional[list[str]], poll_interval: int,
                    state: dict, stage_name: str) -> sz.RunStats:
    stats = sz.RunStats()
    print(f"\n=== Stage {stage_name}: {len(rows)} rows, writer {model} ===")
    # batch ids are recorded as they are created: the state file is what a
    # resume reads if the run dies while polling.
    real_create = client_anthropic.messages.batches.create

    def recording_create(**kwargs):
        batch = real_create(**kwargs)
        state["batches"].setdefault(stage_name, []).append(batch.id)
        write_state(state)
        return batch
    client_anthropic.messages.batches.create = recording_create
    try:
        sz.run_batch(client_anthropic, client_supabase, rows, meta, model, stats, poll_interval,
                     regenerated=regenerated, children_index=children_index, explicit_ids=explicit,
                     budget=budget, resume_batches=resume)
    finally:
        client_anthropic.messages.batches.create = real_create
    print(f"  written (pending): {len(stats.written_ids)}; failed: {stats.failed}; skipped short: {stats.skipped_short}")
    return stats


def stage_review(client_anthropic, client_supabase, ids: list[str], meta, children_index, model, effort,
                 budget, resume: Optional[list[str]], poll_interval: int, state: dict, stage_name: str) -> review.RunStats:
    stats = review.RunStats()
    print(f"\n=== Stage {stage_name}: {len(ids)} rows, reviewer {model} ===")
    rows = list(review.iter_candidates(client_supabase, None, None, ids=ids))
    reviews = []
    for row in rows:
        r = review.build_review_input(row, meta, children_index)
        stats.note_selected(r)
        reviews.append(r)
    rows_by_id = {r["id"]: r for r in rows}
    if not reviews:
        print("  nothing pending to review")
        return stats
    real_create = client_anthropic.messages.batches.create

    def recording_create(**kwargs):
        batch = real_create(**kwargs)
        state["batches"].setdefault(stage_name, []).append(batch.id)
        write_state(state)
        return batch
    client_anthropic.messages.batches.create = recording_create
    try:
        for reg in list(budget.estimates):
            budget.estimates[reg].pop("review", None)   # run_reviews re-adds the exact figure for this stage
        refused = review.run_reviews(client_anthropic, client_supabase, reviews, rows_by_id, model, effort, stats,
                                     execute=True, budget=budget, poll_interval=poll_interval, resume_batches=resume)
    finally:
        client_anthropic.messages.batches.create = real_create
    if refused:
        stats.budget_stopped = refused
    print(f"  pass: {stats.passed}; corrected: {stats.corrected}; fail: {stats.failed}; API errors: {stats.api_errors}")
    return stats


def stage_embed(client_supabase, ids: list[str], budget) -> embed.RunStats:
    print(f"\n=== Stage embed: {len(ids)} rows ===")
    args = argparse.Namespace(reg=None, limit=None, force=False, dry_run=False, show=0,
                              model=embed.DEFAULT_MODEL, skip_neighbors=False, neighbors_only=False,
                              ids=",".join(ids), approved_budget=None, start_after=None, budget=budget)
    stats = embed.RunStats()
    rc = embed.run(args, client=client_supabase, stats=stats)
    print(f"  embedded {stats.provisions_embedded} provisions ({stats.chunks_embedded} chunks); rc={rc}")
    return stats


# --------------------------------------------------------------------------
# Report and sample
# --------------------------------------------------------------------------

def _review_rows_section(stats: review.RunStats, heading: str) -> list[str]:
    md = [f"## {heading} ({len(stats.corrected_rows)})", ""]
    for row in stats.corrected_rows:
        md.append(f"### {row['id']}")
        md.append("")
        md.append(f"**Before:** {row['before']}")
        md.append("")
        md.append(f"**After:** {row['after']}")
        md.append("")
        for c in row["changes"]:
            md.append(f"- {c['reason']}" + (f" (\"{c['before']}\" -> \"{c['after']}\")" if c["before"] or c["after"] else ""))
        md.append("")
    return md


def build_report(args, budget, started_at: str, notes: list[str], s1: Optional[sz.RunStats], r1: Optional[review.RunStats],
                 s2: Optional[sz.RunStats], r2: Optional[review.RunStats], e: Optional[embed.RunStats],
                 state: dict, still_pending: list[dict], stopped: Optional[str], dry_run: bool) -> tuple[str, dict]:
    now = datetime.now(timezone.utc).isoformat()
    counts = {
        "selected": state.get("selected", 0),
        "written": len(s1.written_ids) if s1 else 0,
        "skipped_short": s1.skipped_short if s1 else 0,
        "write_failed": s1.failed if s1 else 0,
        "review_pass": r1.passed if r1 else 0,
        "review_corrected": r1.corrected if r1 else 0,
        "review_fail": r1.failed if r1 else 0,
        "review_api_errors": r1.api_errors if r1 else 0,
        "regenerated": len(s2.written_ids) if s2 else 0,
        "review2_pass": r2.passed if r2 else 0,
        "review2_corrected": r2.corrected if r2 else 0,
        "review2_fail": r2.failed if r2 else 0,
        "embedded": e.provisions_embedded if e else 0,
        "still_pending": len(still_pending),
    }
    data = {
        "run": {"started_at": started_at, "finished_at": now, "mode": "dry run" if dry_run else "execute",
                "label": args.label, "writer_model": args.model, "review_model": args.review_model,
                "effort": args.effort, "review_prompt_version": review.REVIEW_PROMPT_VERSION,
                "selection": {"reg": args.reg, "ids": args.ids, "ids_file": args.ids_file,
                              "ancestor_ids_file": args.ancestor_ids_file, "limit": args.limit,
                              "force": args.force, "parents": args.parents},
                "resume": args.resume_batches, "stopped": stopped},
        "budget": {"usd_per_reg": budget.usd_per_reg, "source": budget.source,
                   "estimates": budget.estimates, "spent": budget.spent, "total_spent": budget.total_spent()},
        "counts": counts,
        "batches": state.get("batches", {}),
        "still_pending": still_pending,
        "notes": notes,
        "written_ids": s1.written_ids if s1 else [],
        "review": {"corrected": r1.corrected_rows, "failed": r1.failed_rows, "passed_ids": r1.passed_rows,
                   "cost": r1.cost(args.review_model)} if r1 else None,
        "review2": {"corrected": r2.corrected_rows, "failed": r2.failed_rows, "passed_ids": r2.passed_rows,
                    "cost": r2.cost(args.review_model)} if r2 else None,
    }
    md: list[str] = []
    md.append(f"# Chained run report -- {'DRY RUN (no paid call, nothing written)' if dry_run else 'execute'}"
              + (f" -- {args.label}" if args.label else ""))
    md.append("")
    md.extend(budget.header_lines())
    md.append(f"- Writer `{args.model}`; reviewer `{args.review_model}` (effort {args.effort}, prompt version "
              f"`{review.REVIEW_PROMPT_VERSION}`); started {started_at}, finished {now}")
    if stopped:
        md.append(f"- **{stopped}**")
    md.append("")
    md.append(f"## Rows still pending after this run ({len(still_pending)})")
    md.append("")
    if still_pending:
        md.append("These failed the reviewer twice (or could not be written or reviewed) and need a decision, "
                  "not another run; until then the site shows them as \"AI-generated · not yet reviewed\" and "
                  "corpus QA check 25 (summary_pending_over_24h) will name them after 24 hours.")
        md.append("")
        for p in still_pending:
            md.append(f"- `{p['id']}`: {p['reason']}")
    else:
        md.append("None: every summary this run wrote was reviewed and approved (as written or corrected).")
    md.append("")
    md.append("## Counts")
    md.append("")
    md.append("| stage | rows |")
    md.append("|---|---:|")
    md.append(f"| selected | {counts['selected']:,} |")
    md.append(f"| 1. summarize: written as pending | {counts['written']:,} |")
    md.append(f"| 1. summarize: skipped (headings-only) | {counts['skipped_short']:,} |")
    md.append(f"| 1. summarize: not written (hedging / cut off / API error) | {counts['write_failed']:,} |")
    md.append(f"| 2. review: pass -> approved | {counts['review_pass']:,} |")
    md.append(f"| 2. review: corrected -> approved | {counts['review_corrected']:,} |")
    md.append(f"| 2. review: fail -> regenerated once | {counts['review_fail']:,} |")
    md.append(f"| 2. review: API errors (still pending) | {counts['review_api_errors']:,} |")
    md.append(f"| 3. regenerated | {counts['regenerated']:,} |")
    md.append(f"| 4. second review: pass / corrected / fail | {counts['review2_pass']:,} / {counts['review2_corrected']:,} / {counts['review2_fail']:,} |")
    md.append(f"| 5. embedded | {counts['embedded']:,} |")
    md.append("")
    md.append("## Cost by regulation and stage")
    md.append("")
    md.extend(budget.table_lines())
    md.append("")
    md.append(f"Total spent this run: ${budget.total_spent():,.4f} (estimate before the first call: ${budget.total_estimated():,.2f}).")
    md.append("")
    if state.get("batches"):
        md.append("## Batches (for a resume)")
        md.append("")
        spec = ";".join(f"{stage}={','.join(ids)}" for stage, ids in state["batches"].items() if ids)
        md.append(f"`--resume-batches \"{spec}\"` with the same selection inputs consumes these without paying again.")
        md.append("")
    if notes:
        md.append("## Notes")
        md.append("")
        md.extend(f"- {n}" for n in notes)
        md.append("")
    if r1:
        md.extend(_review_rows_section(r1, "Corrected rows (first review)"))
        md.append(f"## Failed rows (first review) -- regenerated once ({len(r1.failed_rows)})")
        md.append("")
        md.extend(f"- `{f['id']}`: {f['reason']}" for f in r1.failed_rows)
        md.append("")
    if r2:
        md.extend(_review_rows_section(r2, "Corrected rows (second review, after regeneration)"))
    return "\n".join(md), data


def write_report(md: str, data: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_MD_PATH.write_text(md, encoding="utf-8")
    REPORT_JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _official_text(row: dict, meta: dict, children_index: dict) -> str:
    parts = [f"[{row['id']}] {sz.strip_html(row.get('full_text') or '')}"]
    for d in sz.build_descendants(row, meta, children_index):
        parts.append(f"[{d['id']}] {d['text']}")
    text = "  ".join(parts)
    return text[:SAMPLE_TEXT_CHARS] + ("…" if len(text) > SAMPLE_TEXT_CHARS else "")


def _ancestor_lines(row: dict, meta: dict) -> list[str]:
    lines, _info = sz.build_ancestor_block(row, meta)
    out = []
    for line in lines[1:]:
        out.append(line[:SAMPLE_ANCESTOR_CHARS] + ("…" if len(line) > SAMPLE_ANCESTOR_CHARS else ""))
    return out


def build_sample(client_supabase, meta: dict, children_index: dict, r1: review.RunStats,
                 r2: Optional[review.RunStats], seed: int, label: str, run_url: str) -> str:
    """The 40-row spot-check document: 20 passes and 20 corrections drawn
    with `seed`, each with the text above the provision as the reviewer saw
    it, the official text, the summary (before and after for a correction)
    and the reviewer's reasons. Fewer when the run had fewer."""
    passed = list(r1.passed_rows) + (list(r2.passed_rows) if r2 else [])
    corrected = list(r1.corrected_rows) + (list(r2.corrected_rows) if r2 else [])
    rng = random.Random(seed)
    pass_ids = sorted(passed)
    rng.shuffle(pass_ids)
    pass_ids = pass_ids[:SAMPLE_SIZE // 2]
    corr_rows = sorted(corrected, key=lambda r: r["id"])
    rng.shuffle(corr_rows)
    corr_rows = corr_rows[:SAMPLE_SIZE // 2]
    want = set(pass_ids) | {r["id"] for r in corr_rows}
    rows_by_id: dict[str, dict] = {}
    ids = sorted(want)
    for start in range(0, len(ids), sz.DB_PAGE_SIZE):
        chunk = ids[start:start + sz.DB_PAGE_SIZE]
        q = client_supabase.table("provisions").select("id, citation, title, parent_id, full_text, ai_summary, summary_original, summary_status, reviewed_by").in_("id", chunk)
        for row in q.execute().data or []:
            rows_by_id[row["id"]] = row
    md = [f"# {label}: {len(pass_ids) + len(corr_rows)}-row spot-check sample", "",
          f"Drawn with seed {seed} from the rows this chained run reviewed (`pipeline/run_chain.py`, reviewer "
          f"prompt version {review.REVIEW_PROMPT_VERSION}): {len(pass_ids)} the reviewer passed and {len(corr_rows)} it "
          f"corrected. For each: the text above the provision as the reviewer saw it (every ancestor, first "
          f"{SAMPLE_ANCESTOR_CHARS} characters each), the official text (provision plus descendants, first "
          f"{SAMPLE_TEXT_CHARS} characters), the summary and, for a correction, the summary before with the "
          f"reviewer's reasons. For the Cowork spot-check: check each live summary against the official text."
          + (f" Workflow run: {run_url}" if run_url else ""), ""]
    n = 0
    for pid in pass_ids:
        row = rows_by_id.get(pid)
        if not row:
            continue
        n += 1
        md += [f"## {n}. `{pid}` -- pass", "", "**Text above the provision:**", ""]
        md += [f"> {line}" for line in _ancestor_lines(row, meta)] or ["> (none: a top-level row)"]
        md += ["", "**Official text (provision and descendants):**", "", f"> {_official_text(row, meta, children_index)}", "",
               "**Summary (live, passed as written):**", "", row.get("ai_summary") or "", ""]
    for c in corr_rows:
        row = rows_by_id.get(c["id"])
        if not row:
            continue
        n += 1
        md += [f"## {n}. `{c['id']}` -- corrected", "", "**Text above the provision:**", ""]
        md += [f"> {line}" for line in _ancestor_lines(row, meta)] or ["> (none: a top-level row)"]
        md += ["", "**Official text (provision and descendants):**", "", f"> {_official_text(row, meta, children_index)}", "",
               "**Summary before (as written):**", "", c["before"], "", "**Summary after (live):**", "", c["after"], "",
               "**Reviewer's reasons:**", ""]
        md += [f"- {ch['reason']}" + (f" (\"{ch['before']}\" -> \"{ch['after']}\")" if ch["before"] or ch["after"] else "")
               for ch in c["changes"]]
        md.append("")
    return "\n".join(md)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Summarize, review, regenerate once, embed: one run, one report, one budget.",
                                formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--reg", default=None, help="Regulation id prefix (7, gp03, oooob). Omit for all.")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--force", action="store_true", help="Regenerate rows that already have a summary.")
    p.add_argument("--parents", action="store_true", help="Phase 0 selector (rows with a summary and children). Implies --force.")
    p.add_argument("--longer-than", type=int, default=None, metavar="CHARS")
    p.add_argument("--ids", default=None, help="Comma-separated exact ids (always regenerated).")
    p.add_argument("--ids-file", default=None, help="File of ids, one per line (the importer's summary_regen_ids.txt).")
    p.add_argument("--ancestor-ids-file", default=None,
                   help="File of ancestor ids (the importer's summary_regen_ancestor_ids.txt): regenerated when they "
                        "have a summary and their prompt holds the descendants' text.")
    p.add_argument("--model", default=sz.DEFAULT_MODEL, help="Writer model.")
    p.add_argument("--review-model", default=review.DEFAULT_MODEL, help="Reviewer model (a separate call).")
    p.add_argument("--effort", default=review.DEFAULT_EFFORT, choices=["low", "medium", "high"])
    p.add_argument("--approved-budget", type=float, default=None, metavar="USD",
                   help=f"Owner-approved budget per regulation for THIS run, replacing the standing ${budget_module.STANDING_BUDGET_USD:.0f} rule.")
    p.add_argument("--dry-run", action="store_true", help="Select and estimate only: no paid call, no write.")
    p.add_argument("--resume-batches", default=None, metavar="SPEC",
                   help='"summarize=id,id;review=id;regenerate=id;review2=id": consume these instead of submitting.')
    p.add_argument("--poll-interval", type=int, default=sz.POLL_INTERVAL_SECONDS)
    p.add_argument("--sample-dir", default=None, help="Directory for the spot-check sample (e.g. docs/imports/2026-10-06).")
    p.add_argument("--seed", type=int, default=None, help="Sample seed (default: today's date as YYYYMMDD).")
    p.add_argument("--label", default="", help="Short label for the report and sample file names (e.g. gp03).")
    p.add_argument("--run-url", default=os.environ.get("CHAIN_RUN_URL", ""), help="Workflow run URL for the sample header.")
    p.add_argument("--skip-embed", action="store_true", help="Do not run the embed stage (tests).")
    args = p.parse_args(argv)
    if args.ids_file and (args.reg or args.limit is not None or args.ids):
        p.error("--ids-file is mutually exclusive with --reg, --limit and --ids.")
    if args.parents and (args.ids or args.ids_file):
        p.error("--parents is mutually exclusive with --ids and --ids-file.")
    if args.parents:
        args.force = True
    return args


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    started_at = datetime.now(timezone.utc).isoformat()
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    if not args.dry_run:
        required += ["ANTHROPIC_API_KEY"]
        if not args.skip_embed:
            required += ["VOYAGE_API_KEY"]
    sz.require_env(required)
    resume = parse_resume(args.resume_batches)

    client_supabase = sz.make_supabase_client()
    client_anthropic = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        client_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    for path in (sz.FAILED_LOG_PATH, review.FAILED_LOG_PATH):
        if path.exists() and not args.dry_run:
            path.unlink()

    budget = budget_module.budget_from_args(args.approved_budget)
    for line in budget.header_lines():
        print(line)

    meta_reg = None if (args.ids_file or args.ids or args.ancestor_ids_file) else args.reg
    print(f"Fetching metadata{f' for reg {meta_reg}' if meta_reg else ' (all regulations)'}...")
    meta = sz.fetch_meta(client_supabase, meta_reg)
    children_index = sz.build_children_index(meta)
    rows, ids, notes = select_rows(client_supabase, args, meta, children_index)
    explicit = bool(ids)
    regenerated = bool(args.parents or ids)
    print(f"  {len(rows):,} candidate rows.")
    state = {"started_at": started_at, "selected": len(rows), "batches": {}, "label": args.label}
    write_state(state)

    s1 = r1 = s2 = r2 = e = None
    still_pending: list[dict] = []
    stopped: Optional[str] = None

    if not rows:
        print("Nothing to do.")
        md, data = build_report(args, budget, started_at, notes + ["no rows selected"], s1, r1, s2, r2, e, state,
                                still_pending, stopped, args.dry_run)
        write_report(md, data)
        return 0

    # The estimate for every stage, before any paid call.
    estimate_all_stages(client_anthropic, rows, meta, children_index, args.model, args.review_model, budget, explicit)
    over = budget.over_estimate()
    print("Estimate by regulation: " + ", ".join(f"{reg} ${budget.estimated(reg):,.2f}" for reg in sorted(budget.estimates)))
    if over:
        stopped = budget.stop_message_estimate(over)
        print(stopped, file=sys.stderr)
        md, data = build_report(args, budget, started_at, notes, s1, r1, s2, r2, e, state, still_pending, stopped, args.dry_run)
        write_report(md, data)
        return 2
    if args.dry_run:
        md, data = build_report(args, budget, started_at, notes, s1, r1, s2, r2, e, state, still_pending, None, True)
        write_report(md, data)
        print(f"DRY RUN: {len(rows):,} rows; estimate within budget; nothing submitted, nothing written. Report: {REPORT_MD_PATH}")
        return 0

    # Stage 1: summarize (writes pending). The summarize estimate was made
    # above; run_batch would add it again, so it is cleared first.
    for reg in list(budget.estimates):
        budget.estimates[reg].pop("summarize", None)
    s1 = stage_summarize(client_anthropic, client_supabase, rows, meta, children_index, args.model, budget,
                         explicit, regenerated, resume.get("summarize"), args.poll_interval, state, "summarize")
    if s1.budget_stopped:
        stopped = s1.budget_stopped
    for pid in s1.failed_ids:
        if pid not in s1.written_ids:
            still_pending.append({"id": pid, "reason": "summary not written (see failed.jsonl: hedging, cut off, or an API error)"})

    # Stage 2: review exactly what was written.
    if s1.written_ids and not stopped:
        r1 = stage_review(client_anthropic, client_supabase, s1.written_ids, meta, children_index, args.review_model,
                          args.effort, budget, resume.get("review"), args.poll_interval, state, "review")
        if r1.budget_stopped:
            stopped = r1.budget_stopped
        for f in r1.failed_rows:
            if "canceled" in f["reason"] or "timeout" in f["reason"]:
                still_pending.append({"id": f["id"], "reason": f"review not completed: {f['reason']}"})
        api_error_ids = [pid for pid in s1.written_ids if pid not in r1.passed_rows
                         and pid not in {c["id"] for c in r1.corrected_rows} and pid not in {f["id"] for f in r1.failed_rows}]
        for pid in api_error_ids:
            still_pending.append({"id": pid, "reason": "review API error (see review_failed.jsonl); still pending"})

        # Stage 3 and 4: regenerate the reviewer's fails once, review again.
        fail_ids = [f["id"] for f in r1.failed_rows if "canceled" not in f["reason"] and "timeout" not in f["reason"]]
        if fail_ids and not stopped:
            fail_rows = [r for r in rows if r["id"] in set(fail_ids)]
            s2 = stage_summarize(client_anthropic, client_supabase, fail_rows, meta, children_index, args.model, budget,
                                 True, True, resume.get("regenerate"), args.poll_interval, state, "regenerate")
            if s2.budget_stopped:
                stopped = s2.budget_stopped
            not_rewritten = [pid for pid in fail_ids if pid not in s2.written_ids]
            for pid in not_rewritten:
                first = next(f["reason"] for f in r1.failed_rows if f["id"] == pid)
                still_pending.append({"id": pid, "reason": f"failed review ({first}); regeneration did not produce a summary"})
            if s2.written_ids and not stopped:
                r2 = stage_review(client_anthropic, client_supabase, s2.written_ids, meta, children_index, args.review_model,
                                  args.effort, budget, resume.get("review2"), args.poll_interval, state, "review2")
                if r2.budget_stopped:
                    stopped = r2.budget_stopped
                for f in r2.failed_rows:
                    first = next((x["reason"] for x in r1.failed_rows if x["id"] == f["id"]), "")
                    still_pending.append({"id": f["id"], "reason": f"failed review twice: first \"{first}\"; after regeneration \"{f['reason']}\""})
                for pid in s2.written_ids:
                    if pid not in r2.passed_rows and pid not in {c["id"] for c in r2.corrected_rows} \
                            and pid not in {f["id"] for f in r2.failed_rows}:
                        still_pending.append({"id": pid, "reason": "second review API error; still pending"})
            elif s2.written_ids and stopped:
                for pid in s2.written_ids:
                    still_pending.append({"id": pid, "reason": "regenerated but not reviewed: the run stopped on the budget"})
    elif s1.written_ids and stopped:
        for pid in s1.written_ids:
            still_pending.append({"id": pid, "reason": "written but not reviewed: the run stopped on the budget"})

    # Stage 5: embed what the run wrote.
    written = list(dict.fromkeys((s1.written_ids if s1 else []) + (s2.written_ids if s2 else [])))
    if written and not args.skip_embed:
        e = stage_embed(client_supabase, written, budget)
        if e.budget_stopped:
            stopped = stopped or e.budget_stopped

    md, data = build_report(args, budget, started_at, notes, s1, r1, s2, r2, e, state, still_pending, stopped, False)
    write_report(md, data)
    print(f"\nReport: {REPORT_MD_PATH}")
    if args.sample_dir and r1 is not None:
        seed = args.seed or int(datetime.now(timezone.utc).strftime("%Y%m%d"))
        sample = build_sample(client_supabase, meta, children_index, r1, r2, seed,
                              args.label or (args.reg or "chain"), args.run_url)
        sample_dir = Path(args.sample_dir)
        sample_dir.mkdir(parents=True, exist_ok=True)
        name = f"{(args.label or args.reg or 'chain').replace('/', '_')}_chain_sample_{SAMPLE_SIZE}.md"
        (sample_dir / name).write_text(sample, encoding="utf-8")
        print(f"Sample: {sample_dir / name}")
    print("\n".join(budget.table_lines()))
    print(f"Still pending after this run: {len(still_pending)}")
    # The guard checks, printed at the end of every run so a run that leaves
    # a guard above 0 says so in its own log (summary_guard.py; the same
    # three checks corpus_qa.sql runs in CI and the daily workflow).
    try:
        import summary_guard
        print("\n".join(summary_guard.format_results(summary_guard.run_checks(client_supabase))))
    except Exception as exc:  # noqa: BLE001 -- the guard is informational here; CI and the daily run enforce it
        print(f"  summary guard could not run: {exc}", file=sys.stderr)
    if stopped:
        print(stopped, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
