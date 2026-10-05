#!/usr/bin/env python3
"""Automated AI second-pass review of pending summaries (essentialregs.com).

Every summary on the site carries a badge: "AI reviewed · <date>" when
summary_status is approved or edited, "AI-generated · not yet reviewed" while
it is pending. "AI reviewed" means a separate automated review checked the
summary against the official text and corrected what was wrong (owner
decision, 4 Oct 2026); until this step existed that second pass was done by
hand in chat sessions. This is the repeatable version.

What it does, per pending row (ai_summary set, summary_status = 'pending'):

  1. Rebuilds the exact text the summarizer would be given today --
     summarize.build_prompt(): regulation and parent chain, the parent
     paragraph excerpt, the provision's own text (same MAX_PROMPT_WORDS
     truncation) and every descendant in reading order (full bodies up to
     CHILD_TEXT_WORDS, an outline past that). The official text is the only
     source of truth the reviewer gets; nothing else is added.
  2. Asks a reviewer model (a separate call from the one that wrote the
     summary; see --model) for a structured verdict:
       pass       every statement supported, every number/date/threshold/
                  citation/unit matches, nothing asserted to be absent,
                  no advice beyond the text;
       corrected  specific errors or omissions that change meaning; the
                  reviewer supplies a corrected summary that changes only
                  what is needed, with a one-line reason per change;
       fail       not fixable with small edits, or the text given is too
                  truncated to verify. Anything malformed also counts as
                  fail. The row stays pending and goes in the report.
  3. With --execute, writes:
       pass       summary_status='approved', reviewed_at=now,
                  reviewed_by='Claude (AI second-pass review, automated
                  pipeline, <model>, <YYYY-MM-DD>)', a provision_changes
                  row 'summary_approved';
       corrected  summary_original = coalesce(existing, old ai_summary),
                  ai_summary = corrected text, summary_status='approved',
                  reviewed_by='Claude (AI second-pass review; summary
                  corrected, automated pipeline, <model>, <YYYY-MM-DD>)',
                  a provision_changes row 'summary_edited' whose note is
                  the reviewer's reasons (notes never reach the public
                  changelog: changelog_public() returns counts only);
       fail       no change.
     Approved, edited and rejected rows are never selected, so re-running
     picks up exactly the rows a previous run did not finish -- the same
     resumability as summarize.py. Writes are conditional on the row still
     being pending, so a row an admin approved meanwhile is left alone.
  4. Writes a report (pipeline/out/review_report.md + .json): counts by
     verdict and regulation, every corrected row with before/after/reasons,
     every failed row with its reason, token usage and cost, the model and
     prompt used.

Without --execute this is a dry run: no paid call, no write. It still reads
the real rows and prints the row count by regulation, the token count
(client.messages.count_tokens, a free endpoint, when ANTHROPIC_API_KEY is
set; a character-based estimate otherwise -- the report says which), the
expected output tokens, the batch price for each model option and how many
rows exceed the truncation limit.

--rereview (Oct 2026) selects the OTHER population: approved or edited rows
with a summary whose reviewed_by does not contain "automated pipeline" --
the hand second passes of September 2026, which this reviewer audited at a
41% would-correct rate. Same text, same prompt, same validation; the writes
differ: pass sets reviewed_by to the pipeline stamp and reviewed_at to now
(nothing else changes; no provision_changes row, since the summary did not
change); corrected works exactly as above; fail sets summary_status back to
'pending' and leaves the summary text alone, so the row shows "not yet
reviewed" until it is regenerated or reviewed again, and it is listed in
the report. Before the first write, every selected row's current summary,
summary_original, status and reviewer are copied into
archive.summary_review_snapshot_rereview through the
snapshot_summaries_for_rereview RPC (migration 20261005023100); a row
already in the snapshot is not overwritten.

Examples:
    python pipeline/review.py --dry-run                 # everything pending, cost quote
    python pipeline/review.py --reg gp12 --limit 15 --execute
    python pipeline/review.py --ids sec-7-B-I-B-7,sec-3-A-I-B-2 --execute
    python pipeline/review.py --resume-batch msgbatch_abc --execute   # consume a batch a timed-out run left behind
    python pipeline/review.py --rereview --dry-run      # the hand-approved rows: count and cost quote
    python pipeline/review.py --rereview --reg gp01,gp02,3,7 --execute --max-cost 5

Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY always; ANTHROPIC_API_KEY
for --execute (and, optionally, for exact token counts in a dry run).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

import summarize as sz  # noqa: E402  -- the summarizer's prompt assembly is reused as is

PIPELINE_DIR = Path(__file__).resolve().parent
OUT_DIR = PIPELINE_DIR / "out"
FAILED_LOG_PATH = PIPELINE_DIR / "review_failed.jsonl"
REPORT_MD_PATH = OUT_DIR / "review_report.md"
REPORT_JSON_PATH = OUT_DIR / "review_report.json"

DB_PAGE_SIZE = sz.DB_PAGE_SIZE
BATCH_MAX_REQUESTS = sz.BATCH_MAX_REQUESTS
POLL_INTERVAL_SECONDS = sz.POLL_INTERVAL_SECONDS
MAX_POLL_SECONDS = sz.MAX_POLL_SECONDS

# The reviewer. Sonnet 5.5 is a different and stronger model than the
# Sonnet 4.5 that wrote every pending summary, and at batch rates ($1 in /
# $5 out per million) it is cheaper per token than Sonnet 4.5 ($1.50 / $7.50)
# even after its tokenizer's ~30% larger counts. See MODEL_OPTIONS for the
# alternatives the dry run quotes.
DEFAULT_MODEL = "claude-sonnet-5-5"
DEFAULT_EFFORT = "low"      # models that take output_config.effort (thinking on) -- the dry run quotes this
TEMPERATURE = 0             # models that still take temperature (Sonnet 4.5 family and older)
REVIEW_MAX_TOKENS = 8000    # JSON verdict (<= ~900 tokens) plus room for adaptive thinking on 5.x models; a cut-off answer is a fail
COUNT_TOKENS_WORKERS = 6
COUNT_TOKENS_RETRIES = 4

# Standard (non-batch) USD per million tokens, from
# https://platform.claude.com/docs/en/about-claude/pricing (fetched 4 Oct
# 2026). The Message Batches API is 50% off both numbers, applied in
# estimate_cost(). Every batch here goes through the Batches API.
MODEL_RATES: dict[str, dict[str, float]] = {
    "claude-sonnet-4-5": {"in": 3.00, "out": 15.00},
    "claude-sonnet-4-6": {"in": 3.00, "out": 15.00},
    "claude-sonnet-5": {"in": 2.00, "out": 10.00},
    "claude-sonnet-5-5": {"in": 2.00, "out": 10.00},
    "claude-opus-5": {"in": 5.00, "out": 25.00},
    "claude-opus-5-5": {"in": 4.00, "out": 20.00},
    "claude-haiku-4-5": {"in": 1.00, "out": 5.00},
}
PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing (Batch processing table, read 4 Oct 2026)"

# Prompt caching (owner approval, 5 Oct 2026). The system prompt (~2,500
# tokens, identical for every row) is sent as a cached block with a 1-hour
# TTL, so across a batch most rows read it from the cache instead of paying
# full input price for it. Multipliers on the model's input rate, from the
# pricing page: a 1-hour cache write bills 2x, a cache read 0.1x; the batch
# discount applies to both. Hits inside a concurrent batch are best-effort,
# so the report states the measured share of input served from the cache.
SYSTEM_CACHE_TTL = "1h"
CACHE_WRITE_MULTIPLIER_1H = 2.0
CACHE_READ_MULTIPLIER = 0.1

# The options a dry run prices side by side. `tokenizer` names the model
# whose count_tokens figure applies: Claude 4.7 and later use a tokenizer
# that produces roughly 30% more tokens for the same text, so Sonnet 5.5 and
# Opus 5.5 share a count and Sonnet 4.5 has its own.
MODEL_OPTIONS: list[dict] = [
    {"model": "claude-sonnet-4-5", "tokenizer": "claude-sonnet-4-5",
     "note": "the summarizer's own model (temperature 0, no thinking)"},
    {"model": "claude-sonnet-5-5", "tokenizer": "claude-sonnet-5-5",
     "note": "recommended: a different, stronger model; adaptive thinking at effort low"},
    {"model": "claude-opus-5-5", "tokenizer": "claude-sonnet-5-5",
     "note": "strongest option; adaptive thinking at effort low"},
]

# Models that still accept `temperature` (and have no thinking). Everything
# else is a 4.7+ / 5.x model: temperature is rejected (400), thinking is on,
# and output_config.effort is the depth control.
TEMPERATURE_MODEL_PREFIXES = (
    "claude-sonnet-4-5", "claude-sonnet-4-6", "claude-haiku-4-5",
    "claude-opus-4-5", "claude-opus-4-6", "claude-3-",
)

# Dry-run output allowance per row. A pass verdict is ~120 tokens of JSON
# and a correction ~400; roughly one row in five was corrected in the hand
# passes. Thinking models spend output tokens on reasoning too (effort low).
EST_OUTPUT_TOKENS_PLAIN = 250
EST_OUTPUT_TOKENS_THINKING = 900
# The structured-output schema and its system addition are not in the
# count_tokens figure (counted on system + messages only); allow for them.
SCHEMA_TOKEN_ALLOWANCE = 350
# Character-based fallback when no API key is available for count_tokens.
CHARS_PER_TOKEN_OLD = 3.8   # Sonnet 4.5 tokenizer, prose with citations
CHARS_PER_TOKEN_NEW = 2.9   # 4.7+ tokenizer (~30% more tokens)

# A correction must stay a correction: longer than this many times the
# original (plus a 40-word allowance for a missing threshold or clause)
# and it is a rewrite, which the spec says is not this step's job.
CORRECTION_MAX_GROWTH = 1.5
CORRECTION_GROWTH_ALLOWANCE_WORDS = 40

VERDICTS = ("pass", "corrected", "fail")

# Structured output: the response is constrained to this schema
# (output_config.format), so a well-formed reply is JSON of this shape.
# Everything is still validated strictly in validate_verdict() -- a
# malformed reply is a fail, never a write.
VERDICT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "description": "Every statement in the summary that is wrong, unsupported, or claims the text is silent when it is not. Empty when the verdict is pass.",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string", "description": "The summary's words, quoted."},
                    "problem": {"type": "string", "description": "What the official text actually says, or that it says nothing of the kind."},
                },
                "required": ["claim", "problem"],
                "additionalProperties": False,
            },
        },
        "verdict": {"type": "string", "enum": list(VERDICTS)},
        "corrected_summary": {
            "type": "string",
            "description": "Only for verdict corrected: the full corrected summary, changing only what is needed. Empty string otherwise.",
        },
        "changes": {
            "type": "array",
            "description": "Only for verdict corrected: one entry per change. Empty otherwise.",
            "items": {
                "type": "object",
                "properties": {
                    "before": {"type": "string"},
                    "after": {"type": "string"},
                    "reason": {"type": "string", "description": "One line, pointing at the text."},
                },
                "required": ["before", "after", "reason"],
                "additionalProperties": False,
            },
        },
        "fail_reason": {
            "type": "string",
            "description": "Only for verdict fail: why the summary cannot be fixed with small edits, or what is truncated. Empty string otherwise.",
        },
    },
    "required": ["findings", "verdict", "corrected_summary", "changes", "fail_reason"],
    "additionalProperties": False,
}

REVIEW_SYSTEM_PROMPT = (
    "You are the second-pass reviewer for essentialregs.com, which publishes "
    "plain-English summaries of regulatory provisions. You check one summary "
    "against the official text it summarizes. The text you are given -- the "
    "provision's own words plus the provisions inside it, with the regulation "
    "and parent lines for orientation -- is the only source of truth. Use no "
    "other knowledge of this regulation: never judge a statement by what the "
    "regulation usually says, what a term usually means elsewhere, or what "
    "you believe the rule to be. If the text does not say it, the summary "
    "may not say it.\n\n"
    "Return one of three verdicts.\n\n"
    "pass: every statement in the summary is supported by the text; every "
    "number, date, deadline, threshold, percentage, citation, unit, named "
    "party and geographic qualifier matches the text exactly; the summary "
    "does not say that anything is absent, not shown, not specified, "
    "unclear or not stated when the text (including the provisions inside "
    "it) states it; and the summary adds no requirement, exception, advice, "
    "example or scope beyond what the text says; and the summary carries no "
    "Markdown markup. Wording you would phrase "
    "differently is not an error. Style, sentence order, emphasis, "
    "plain-English paraphrase of legal terms, and leaving out a detail that "
    "does not change the meaning all pass. If the only changes you would "
    "make are stylistic, the verdict is pass.\n\n"
    "corrected: the summary contains one or more specific errors or "
    "omissions that change its meaning -- a wrong or invented number, date, "
    "unit, threshold or party; a requirement, exception or cross-reference "
    "the text does not state; a condition read the wrong way round; a claim "
    "that the text is silent on something it states (for a provision with "
    "provisions inside it, a summary that says the text \"does not show\" or "
    "\"does not specify\" something those provisions state is an error to "
    "correct); or a missing threshold or condition without which a sentence "
    "misleads. Supply the complete corrected summary. Change only what is "
    "needed to make it accurate and keep the original sentences and wording "
    "everywhere else; do not rewrite for style, do not reorder, do not add "
    "detail the original did not need. List every change as before / after "
    "with a one-line reason that points at the text. The corrected summary "
    "must be plain prose with no markdown, no lists and no headings, and "
    "must itself follow every rule above: nothing that is not in the text, "
    "no statement that something is absent when the text or the provisions "
    "inside it state it.\n\n"
    "Stray Markdown markers in the summary -- ** or __ around a word, a "
    "leading # or list marker, backticks -- are also an error, because the "
    "summary is shown as plain text. When they are the only problem, return "
    "corrected with the markers removed and nothing else changed: the "
    "corrected summary is the current one, word for word, without the "
    "markers, with a single change whose reason is \"stray Markdown markers "
    "removed\".\n\n"
    "fail: the summary cannot be made accurate with small edits -- it "
    "describes the wrong thing, or most of its statements are unsupported "
    "-- or the text you were given is marked as truncated or shown only as "
    "an outline, so the statements that depend on the missing part cannot "
    "be verified. Give the reason.\n\n"
    "Compare literally: a threshold of 500 horsepower passes only if the "
    "text says 500 horsepower; \"the Division\" and \"the Commission\" are "
    "different parties; \"may\" and \"must\" are different duties. The "
    "summary is written for a compliance person who is not a lawyer, so "
    "plain everyday wording is expected and is not a defect. The summary "
    "may describe the provision together with the provisions listed inside "
    "it; that is how it is meant to work. A summary that reports an "
    "equation as not shown is correct when the text lists variables "
    "without a formula. The regulation and parent lines above the "
    "provision, and the parent paragraph, are part of the text you are "
    "given: a summary may say where the provision sits and connect it to "
    "that context -- a requirement listed under a rule headed \"Form 2A ... "
    "Application\" may be said to be part of the Form 2A application; a "
    "condition under \"an engine is exempt if:\" may be said to give an "
    "exemption. Do not correct a summary for stating that context. A "
    "summary of one provision inside a list -- one condition, one item, one "
    "paragraph among several joined by \"and\" or \"or\" -- describes that "
    "provision; it need not repeat the other items or say that they exist. "
    "Saying the result follows \"if\" or \"when\" the condition holds, or "
    "applies \"only\" when it holds, is not a claim that the condition is "
    "sufficient by itself, and rewriting it as \"this is one of several "
    "conditions\" is not a correction; it is an error only when the summary "
    "says in words that nothing else is required. Spelling out the direct "
    "effect of what the text says in everyday words is paraphrase, not an "
    "addition: a form \"considered as\" or \"treated as\" sulfur dioxide is "
    "subject to the sulfur dioxide requirements, a thing \"deemed\" X is X, "
    "and a summary may say so, as long as it adds no number, date, party, "
    "threshold, exception or requirement of its own. Tense (\"is\" / \"will "
    "be\") and voice are style.\n\n"
    "Three allowances. These are about plain English; nothing in them "
    "loosens the rules above on numbers, dates, thresholds, citations, "
    "scope, parties, conditions and exceptions, which must still match the "
    "text, or on asserting what the text does not say.\n\n"
    "1. Acronyms and agency names. A correct expansion of an acronym or "
    "short name the text uses is not an error and must not be removed or "
    "abbreviated: \"volatile organic compounds (VOC)\", \"maximum allowable "
    "operating pressure (MAOP)\", \"Colorado Parks and Wildlife (CPW)\", "
    "\"Reasonably Available Control Technology (RACT)\", \"CEDRI (the EPA's "
    "Compliance and Emissions Data Reporting Interface)\". This holds "
    "whether the text uses the acronym, the full term or both, and whether "
    "the summary expands an acronym the text only abbreviates or pairs an "
    "acronym with a term the text spells out. It is an error only if the "
    "expansion is wrong or contradicts the text (the text names a "
    "different body or a different term). Do not return corrected to "
    "remove, shorten or re-abbreviate a correct expansion.\n\n"
    "2. Illustrative examples. An example clearly marked as one -- "
    "\"like\", \"such as\", \"for example\", \"e.g.\" -- is not an error when "
    "it is consistent with the text and does not narrow or widen what the "
    "provision covers: \"natural causes (like lightning)\" for \"natural "
    "phenomena\", \"a control device (like a combustor or flare)\" for \"a "
    "control device\". It is an error when the text gives its own list and "
    "the summary's example is not on it, or when the example changes the "
    "scope (the text covers one kind of device and the example suggests "
    "any). Likewise \"including\" or \"such as\" before some items does not "
    "claim the list is complete, so it correctly renders \"including, but "
    "not limited to\"; wording that does claim completeness "
    "(\"specifically\", \"namely\", \"the following\") where the text says "
    "the list is not exhaustive is still an error.\n\n"
    "3. Source typos. Never change a summary to reproduce an evident typo "
    "or misspelling in the official text (\"trionyl chloride\" for thionyl "
    "chloride, a doubled or dropped letter). The summary uses the correct "
    "word; a summary that already does is not in error on that point.\n\n"
    "Everything else is unchanged. Style-only rewrites are a pass.\n\n"
    "Answer with the JSON object only."
)

REVIEW_PROMPT_VERSION = hashlib.sha1(
    (REVIEW_SYSTEM_PROMPT + json.dumps(VERDICT_SCHEMA, sort_keys=True)).encode("utf-8")
).hexdigest()[:10]

REVIEWED_BY_PASS = "Claude (AI second-pass review, automated pipeline, {model}, {date})"
REVIEWED_BY_CORRECTED = "Claude (AI second-pass review; summary corrected, automated pipeline, {model}, {date})"


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

CANDIDATE_COLUMNS = ("id, citation, title, parent_id, full_text, sort_order, "
                     "ai_summary, summary_original, summary_status, summary_model, reviewed_by")

# A reviewed_by containing this marks a row this pipeline already reviewed
# (both REVIEWED_BY_* stamps carry it). The audit and --rereview select the
# rows that do NOT carry it: summaries approved before this step existed,
# by the hand second passes in chat sessions.
PIPELINE_REVIEWED_BY_MARK = "automated pipeline"
AUDIT_EXCLUDE_REVIEWED_BY = PIPELINE_REVIEWED_BY_MARK
AUDIT_STATUSES = ("approved", "edited")
REREVIEW_STATUSES = AUDIT_STATUSES


def is_rereview_row(row: dict) -> bool:
    """An approved/edited row with a summary whose reviewed_by does not
    contain the pipeline mark (a missing reviewed_by counts as not
    containing it). The Python side of the --rereview selection; the
    status and summary filters run in the query."""
    if row.get("summary_status") not in REREVIEW_STATUSES or not row.get("ai_summary"):
        return False
    return PIPELINE_REVIEWED_BY_MARK.lower() not in (row.get("reviewed_by") or "").lower()


def _status_filter(q, rereview: bool):
    if rereview:
        return q.in_("summary_status", list(REREVIEW_STATUSES))
    return q.eq("summary_status", "pending")


def iter_candidates(client, reg: Optional[str], limit: Optional[int],
                    ids: Optional[list[str]] = None, rereview: bool = False):
    """Yields the rows this step may touch, ordered by (sort_order, id),
    paginated. Normal mode: ai_summary set AND summary_status = 'pending';
    approved, edited and rejected rows are excluded by the query itself,
    and every write re-checks the status, so an approved row is never
    selected or changed. `rereview` mode: ai_summary set, summary_status
    approved or edited, and reviewed_by NOT containing "automated
    pipeline" (is_rereview_row) -- the hand-approved rows, each selected
    once because a pass or correction stamps it with the mark. `ids`
    narrows to those ids (still filtered the same way); `reg` narrows to
    one regulation's id prefix, or to several given as a comma-separated
    list ("gp01,gp02,..."), taken in that order; `limit` stops early."""
    regs = [r.strip() for r in (reg or "").split(",") if r.strip()]
    if not ids and len(regs) > 1:
        yielded = 0
        for one in regs:
            remaining = None if limit is None else limit - yielded
            if remaining is not None and remaining <= 0:
                return
            for row in iter_candidates(client, one, remaining, rereview=rereview):
                yield row
                yielded += 1
        return
    keep = is_rereview_row if rereview else (lambda row: True)
    if ids:
        rows_by_id: dict[str, dict] = {}
        for chunk_start in range(0, len(ids), DB_PAGE_SIZE):
            chunk = ids[chunk_start:chunk_start + DB_PAGE_SIZE]
            q = _status_filter(client.table("provisions").select(CANDIDATE_COLUMNS).in_("id", chunk), rereview)
            q = q.not_.is_("ai_summary", "null")
            for row in q.execute().data or []:
                if keep(row):
                    rows_by_id[row["id"]] = row
        skipped = [i for i in ids if i not in rows_by_id]
        if skipped:
            what = "not hand-approved" if rereview else "not pending"
            print(f"  NOTE: {len(skipped)} id(s) from --ids are {what} (or not found) "
                  f"and are left alone: {', '.join(skipped[:20])}"
                  f"{' ...' if len(skipped) > 20 else ''}", file=sys.stderr)
        yielded = 0
        for provision_id in ids:
            row = rows_by_id.get(provision_id)
            if row is None:
                continue
            yield row
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        return

    like_prefix = f"sec-{reg.lower()}-" if reg else None
    start = 0
    yielded = 0
    while True:
        q = _status_filter(client.table("provisions").select(CANDIDATE_COLUMNS), rereview)
        q = q.not_.is_("ai_summary", "null")
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        q = q.order("sort_order").order("id").range(start, start + DB_PAGE_SIZE - 1)
        rows = q.execute().data or []
        for row in rows:
            if not keep(row):
                continue
            yield row
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        if len(rows) < DB_PAGE_SIZE:
            return
        start += DB_PAGE_SIZE


# --------------------------------------------------------------------------
# Re-review snapshot
# --------------------------------------------------------------------------

SNAPSHOT_RPC = "snapshot_summaries_for_rereview"
SNAPSHOT_CHUNK = 1000


def snapshot_for_rereview(client, ids: list[str], run_label: str) -> int:
    """Copies every selected row's current ai_summary, summary_original,
    status, reviewer and model into archive.summary_review_snapshot_rereview
    (server side, through the service-role RPC of migration 20261005023100)
    before the first write of a --rereview run. Rows already in the
    snapshot are not overwritten, so the table always holds the text as it
    stood before the first re-review touched the row. Returns the number of
    rows newly snapshotted. Raises on any RPC error: the run must not write
    without its snapshot."""
    added = 0
    for start in range(0, len(ids), SNAPSHOT_CHUNK):
        chunk = ids[start:start + SNAPSHOT_CHUNK]
        res = client.rpc(SNAPSHOT_RPC, {"p_ids": chunk, "p_run_label": run_label}).execute()
        data = getattr(res, "data", None)
        added += int(data) if isinstance(data, (int, float, str)) and str(data).strip() != "" else 0
    return added


# --------------------------------------------------------------------------
# Audit selection (read-only)
# --------------------------------------------------------------------------


def allocate_sample(sizes: dict[str, int], n: int) -> dict[str, int]:
    """How many rows to draw from each regulation for an n-row sample
    spread across regulations: one from every regulation that has any
    (largest first when n is smaller than the number of regulations), the
    rest in proportion to each regulation's remaining size, largest
    remainders first. Never more than a regulation has."""
    regs = sorted(r for r, c in sizes.items() if c > 0)
    total = sum(sizes[r] for r in regs)
    if n >= total:
        return {r: sizes[r] for r in regs}
    alloc = {r: 0 for r in regs}
    if n < len(regs):
        for r in sorted(regs, key=lambda r: (-sizes[r], r))[:n]:
            alloc[r] = 1
        return {r: c for r, c in alloc.items() if c}
    for r in regs:
        alloc[r] = 1
    remaining = n - len(regs)
    rest = {r: sizes[r] - 1 for r in regs}
    rest_total = sum(rest.values())
    quotas = {r: (remaining * rest[r] / rest_total) if rest_total else 0.0 for r in regs}
    for r in regs:
        alloc[r] += int(quotas[r])
    left = n - sum(alloc.values())
    for r in sorted(regs, key=lambda r: (-(quotas[r] - int(quotas[r])), -sizes[r], r)):
        if left <= 0:
            break
        if alloc[r] < sizes[r]:
            alloc[r] += 1
            left -= 1
    return alloc


def select_audit_sample(client, n: int, seed: int, reg: Optional[str] = None,
                        exclude_reviewed_by: str = AUDIT_EXCLUDE_REVIEWED_BY) -> tuple[list[dict], dict]:
    """A seeded random sample of n approved/edited rows with a summary whose
    reviewed_by does not contain `exclude_reviewed_by`, spread across
    regulations (allocate_sample). Read-only. Returns (rows in sample
    order, info for the report)."""
    eligible: dict[str, list[str]] = {}
    like_prefix = f"sec-{reg.lower()}-" if reg else None
    start = 0
    while True:
        q = (client.table("provisions").select("id, reviewed_by, summary_status")
             .in_("summary_status", list(AUDIT_STATUSES))
             .not_.is_("ai_summary", "null"))
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        q = q.order("id").range(start, start + sz.META_PAGE_SIZE - 1)
        page = q.execute().data or []
        for row in page:
            if exclude_reviewed_by.lower() in (row.get("reviewed_by") or "").lower():
                continue
            eligible.setdefault(sz.reg_key_of(row["id"]) or "?", []).append(row["id"])
        if len(page) < sz.META_PAGE_SIZE:
            break
        start += sz.META_PAGE_SIZE

    sizes = {r: len(v) for r, v in eligible.items()}
    alloc = allocate_sample(sizes, n)
    rng = random.Random(seed)
    picked: list[str] = []
    for r in sorted(alloc):
        picked.extend(rng.sample(sorted(eligible[r]), alloc[r]))

    rows_by_id: dict[str, dict] = {}
    for chunk_start in range(0, len(picked), DB_PAGE_SIZE):
        chunk = picked[chunk_start:chunk_start + DB_PAGE_SIZE]
        q = (client.table("provisions").select(CANDIDATE_COLUMNS + ", reviewed_by")
             .in_("id", chunk).in_("summary_status", list(AUDIT_STATUSES)))
        for row in q.execute().data or []:
            rows_by_id[row["id"]] = row
    rows = [rows_by_id[i] for i in picked if i in rows_by_id]
    info = {"requested": n, "seed": seed, "eligible": sum(sizes.values()),
            "eligible_by_reg": dict(sorted(sizes.items())), "allocation": dict(sorted(alloc.items())),
            "exclude_reviewed_by": exclude_reviewed_by, "statuses": list(AUDIT_STATUSES)}
    return rows, info


def select_audit_ids(client, ids: list[str]) -> tuple[list[dict], dict]:
    """Audit mode on explicit ids (read-only, like select_audit_sample):
    the approved/edited rows among `ids` that have a summary, in the order
    given, whatever their reviewed_by (so a row the pipeline already
    stamped can be re-checked too). Ids that are not approved/edited or
    not found are reported and left out."""
    rows_by_id: dict[str, dict] = {}
    for chunk_start in range(0, len(ids), DB_PAGE_SIZE):
        chunk = ids[chunk_start:chunk_start + DB_PAGE_SIZE]
        q = (client.table("provisions").select(CANDIDATE_COLUMNS)
             .in_("id", chunk).in_("summary_status", list(AUDIT_STATUSES))
             .not_.is_("ai_summary", "null"))
        for row in q.execute().data or []:
            rows_by_id[row["id"]] = row
    skipped = [i for i in ids if i not in rows_by_id]
    if skipped:
        print(f"  NOTE: {len(skipped)} id(s) from --audit-ids are not approved/edited with a summary "
              f"(or not found) and are left out: {', '.join(skipped[:20])}"
              f"{' ...' if len(skipped) > 20 else ''}", file=sys.stderr)
    rows = [rows_by_id[i] for i in ids if i in rows_by_id]
    sizes: dict[str, int] = {}
    for r in rows:
        reg = sz.reg_key_of(r["id"]) or "?"
        sizes[reg] = sizes.get(reg, 0) + 1
    info = {"requested": len(ids), "seed": None, "eligible": len(rows), "ids": [r["id"] for r in rows],
            "skipped_ids": skipped, "eligible_by_reg": dict(sorted(sizes.items())),
            "allocation": dict(sorted(sizes.items())),
            "exclude_reviewed_by": "(none: explicit ids)", "statuses": list(AUDIT_STATUSES)}
    return rows, info


# --------------------------------------------------------------------------
# Input assembly (parity with the summarizer) and request building
# --------------------------------------------------------------------------

@dataclass
class ReviewInput:
    provision_id: str
    prompt: str                   # the user turn: official text block + current summary
    system: str                   # REVIEW_SYSTEM_PROMPT
    summary: str                  # the summary under review, exactly as stored
    text_result: sz.PromptResult  # the summarizer's assembly of the official text
    chars: int = 0


def build_official_text(provision: dict, meta: dict, children_index: dict) -> sz.PromptResult:
    """The official text exactly as the summarizer assembles it today:
    summarize.build_prompt() (regulation line, parent chain, parent
    paragraph excerpt, provision text with the MAX_PROMPT_WORDS cap, and
    every descendant with the CHILD_TEXT_WORDS budget / outline fallback).
    Reused rather than copied so the two can never drift apart."""
    return sz.build_prompt(provision, meta, children_index)


def build_review_input(provision: dict, meta: dict, children_index: dict) -> ReviewInput:
    text = build_official_text(provision, meta, children_index)
    summary = (provision.get("ai_summary") or "").strip()
    prompt = (
        "OFFICIAL TEXT (the only source of truth; assembled exactly as the "
        "summary's author saw it):\n\n"
        f"{text.prompt}\n\n"
        "CURRENT SUMMARY (under review):\n"
        f"{summary}"
    )
    return ReviewInput(
        provision_id=provision["id"],
        prompt=prompt,
        system=REVIEW_SYSTEM_PROMPT,
        summary=summary,
        text_result=text,
        chars=len(prompt) + len(REVIEW_SYSTEM_PROMPT),
    )


def supports_temperature(model: str) -> bool:
    return model.startswith(TEMPERATURE_MODEL_PREFIXES)


def request_params(review: ReviewInput, model: str, effort: str = DEFAULT_EFFORT) -> dict:
    """The Messages API params for one review, usable for messages.create,
    messages.count_tokens (minus output_config) and a Batches request.
    Temperature for the models that take it; output_config.effort for the
    4.7+/5.x models, where temperature is rejected and thinking is on."""
    params: dict = {
        "model": model,
        "max_tokens": REVIEW_MAX_TOKENS,
        # The system prompt is the same for every row: one cached block, 1h TTL.
        "system": [{"type": "text", "text": review.system,
                    "cache_control": {"type": "ephemeral", "ttl": SYSTEM_CACHE_TTL}}],
        "messages": [{"role": "user", "content": review.prompt}],
        "output_config": {"format": {"type": "json_schema", "schema": VERDICT_SCHEMA}},
    }
    if supports_temperature(model):
        params["temperature"] = TEMPERATURE
    else:
        params["output_config"]["effort"] = effort
    return params


def sampling_description(model: str, effort: str) -> str:
    if supports_temperature(model):
        return f"temperature={TEMPERATURE}"
    return f"adaptive thinking, output_config.effort={effort} (temperature is not a parameter on this model)"


# --------------------------------------------------------------------------
# Verdict validation
# --------------------------------------------------------------------------

@dataclass
class Verdict:
    verdict: str                     # pass | corrected | fail
    corrected_summary: str = ""
    changes: list[dict] = field(default_factory=list)
    findings: list[dict] = field(default_factory=list)
    reason: str = ""                 # fail reason (model's, or the validator's)

    @property
    def reasons_note(self) -> str:
        return "; ".join(c["reason"] for c in self.changes)


def _message_text(message) -> str:
    return "".join(
        getattr(block, "text", "") for block in getattr(message, "content", [])
        if getattr(block, "type", None) == "text"
    ).strip()


def parse_verdict_text(raw: str) -> dict:
    """json.loads with the one tolerance the structured-output path never
    needs but a plain-text model might: a JSON object wrapped in a code
    fence. Raises ValueError for anything else."""
    s = (raw or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    try:
        data = json.loads(s)
    except json.JSONDecodeError as exc:
        raise ValueError(f"not JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("JSON is not an object")
    return data


def _normalize(text: str) -> str:
    return sz.WS_RE.sub(" ", (text or "")).strip()


PARAGRAPH_BREAK_RE = re.compile(r"\n\s*\n")


def _normalize_paragraphs(text: str) -> str:
    """Whitespace normalized inside each paragraph, paragraphs kept: the
    reader shows a blank line in a summary as a paragraph break
    (summaryPanelHtml), so a correction keeps the summary's paragraphs. A
    single line break inside a paragraph becomes a space."""
    paragraphs = [_normalize(p) for p in PARAGRAPH_BREAK_RE.split((text or "").strip())]
    return "\n\n".join(p for p in paragraphs if p)


# Stray Markdown in a summary (the site shows summaries as plain text). Only
# unambiguous markers: ** and __word__ emphasis, backticks, and a heading or
# list marker at the start of a line. A lone * is left alone (the summaries
# use it as a footnote marker, "... 2,000 hp.*", WHOLE_ANSWER_RE), and so is a
# run of underscores that is a form blank ("____") or part of a name.
MARKDOWN_MARKER_RE = re.compile(r"\*\*|(?<![\w_])__(?=[^\s_])|(?<=[^\s_])__(?![\w_])|`|(?:^|(?<=\n))[ \t]*(?:#{1,6}|[-*+])[ \t]+")


def has_markdown_markers(text: str) -> bool:
    return bool(MARKDOWN_MARKER_RE.search(text or ""))


def strip_markdown_markers(text: str) -> str:
    """The summary with its stray Markdown markers removed and nothing else
    changed (whitespace normalized)."""
    return _normalize(MARKDOWN_MARKER_RE.sub("", text or ""))


def _is_markdown_only_change(before: str, after: str) -> bool:
    """True when `after` is `before` with Markdown markers removed (and
    `before` had some)."""
    return has_markdown_markers(before) and strip_markdown_markers(before) == _normalize(after)


MARKDOWN_ONLY_REASON = "stray Markdown markers removed"

# Allowance 1 (prompt version 2, Oct 2026) in the validator: a "correction"
# whose every change only shortens the summary by taking out words -- an
# acronym's expansion, or the acronym next to its term -- for a reason that
# speaks of abbreviation or expansion is not a correction. The reviewer
# found nothing else wrong, so the verdict becomes pass. A reason that says
# the expansion is wrong (names a different body, contradicts the text) is
# a real correction and is left alone; so is any change that adds or
# substitutes words.
ACRONYM_REASON_RE = re.compile(r"acronym|abbreviat|expan[ds]|spell(?:s|ed)? out|short(?:ened)? form|initialism", re.I)
ACRONYM_REAL_ERROR_RE = re.compile(r"\bwrong|incorrect|contradict|different|mis-?nam|is not the|does not stand|not what", re.I)
WORD_RE = re.compile(r"[A-Za-z0-9§.%/-]+")


def _words(text: str) -> list[str]:
    return [w.strip(".,;:").lower() for w in WORD_RE.findall(text or "")]


def _is_subsequence(short: list[str], long: list[str]) -> bool:
    it = iter(long)
    return all(any(w == x for x in it) for w in short)


def _is_acronym_pairing_removal(before: str, after: str, reason: str) -> bool:
    """True when `after` is `before` with words removed only (no word added
    or changed) and the reason is about an acronym / abbreviation /
    expansion rather than about the expansion being wrong."""
    if not ACRONYM_REASON_RE.search(reason or "") or ACRONYM_REAL_ERROR_RE.search(reason or ""):
        return False
    b, a = _words(before), _words(after)
    if not b or len(a) >= len(b):
        return False
    return _is_subsequence(a, b)


ACRONYM_ONLY_REASON = ("validator: the reviewer's only changes removed a correct acronym "
                       "expansion or pairing, which prompt version 2 allows; treated as pass")


def _pass_checks(review: ReviewInput, findings: list[dict], has_descendants: bool) -> Optional[Verdict]:
    """The two reasons a pass is not approved (returns the fail), or None."""
    if has_descendants and sz.is_hedging(review.summary):
        return Verdict("fail", findings=findings,
                       reason="reviewer passed a summary that says the text is silent "
                              "about something, on a provision with descendants")
    if has_markdown_markers(review.summary):
        # The prompt makes stray Markdown a correction ("markers removed,
        # nothing else changed"); a pass here would approve markup the
        # reader shows as literal asterisks. Not approved; the next run
        # retries it.
        return Verdict("fail", findings=findings,
                       reason="reviewer passed a summary that carries stray Markdown markers")
    return None


def validate_verdict(data: object, review: ReviewInput, stop_reason: Optional[str] = None) -> Verdict:
    """Strict validation. Returns a Verdict whose .verdict is one of
    VERDICTS; anything malformed becomes verdict 'fail' with the reason in
    .reason (the row stays pending and is listed in the report).

    Rules beyond shape:
      - stop_reason max_tokens or refusal -> fail (the answer is not whole).
      - pass on a hedging summary for a provision WITH descendants -> fail
        (the text's children state what the summary says is absent; the
        reviewer should have corrected it, so the row is not approved).
      - corrected needs a non-empty corrected summary that differs from the
        current one, is whole (ends in terminal punctuation), carries no
        markdown, does not hedge when the provision has descendants, is not
        a rewrite (word growth cap), and has at least one change with a
        non-empty reason.
      - fail needs a reason (defaults to 'unspecified')."""
    if stop_reason == "max_tokens":
        return Verdict("fail", reason="malformed output: answer cut off at max_tokens")
    if stop_reason == "refusal":
        return Verdict("fail", reason="model refusal")
    if not isinstance(data, dict):
        return Verdict("fail", reason="malformed output: not a JSON object")
    verdict = data.get("verdict")
    if verdict not in VERDICTS:
        return Verdict("fail", reason=f"malformed output: verdict {verdict!r}")

    findings = data.get("findings")
    if findings is None:
        findings = []
    if not isinstance(findings, list) or not all(isinstance(f, dict) for f in findings):
        return Verdict("fail", reason="malformed output: findings is not a list of objects")
    findings = [{"claim": str(f.get("claim", "")), "problem": str(f.get("problem", ""))} for f in findings]

    has_descendants = review.text_result.descendant_count > 0

    if verdict == "pass":
        return _pass_checks(review, findings, has_descendants) or Verdict("pass", findings=findings)

    if verdict == "fail":
        reason = _normalize(str(data.get("fail_reason") or "")) or "unspecified"
        return Verdict("fail", findings=findings, reason=reason)

    # corrected
    corrected = data.get("corrected_summary")
    if not isinstance(corrected, str):
        return Verdict("fail", findings=findings, reason="malformed output: corrected_summary is not a string")
    raw_corrected = sz.strip_wrapper_tags(corrected).strip()
    if not raw_corrected:
        return Verdict("fail", findings=findings, reason="malformed output: corrected verdict with an empty corrected_summary")
    # Markdown and line breaks are tested on the raw text, before whitespace
    # is normalized away: a summary is one plain paragraph.
    # Markdown is tested on the raw text. Paragraph breaks are allowed (the
    # reader renders a blank line as a new paragraph, and multi-paragraph
    # summaries exist); a numbered or bulleted line is not.
    if has_markdown_markers(raw_corrected) or re.search(r"(?:^|\n)\s*\d+\.\s", raw_corrected):
        return Verdict("fail", findings=findings, reason="malformed output: corrected_summary contains markdown")
    corrected = _normalize_paragraphs(raw_corrected)
    if _normalize(corrected) == _normalize(review.summary):
        return Verdict("fail", findings=findings, reason="malformed output: corrected_summary is identical to the current summary")
    if not sz.is_whole(corrected):
        return Verdict("fail", findings=findings, reason="malformed output: corrected_summary does not end in terminal punctuation")
    if has_descendants and sz.is_hedging(corrected):
        return Verdict("fail", findings=findings, reason="corrected summary still says the text is silent, on a provision with descendants")
    orig_words = len(review.summary.split())
    if len(corrected.split()) > orig_words * CORRECTION_MAX_GROWTH + CORRECTION_GROWTH_ALLOWANCE_WORDS:
        return Verdict("fail", findings=findings,
                       reason=f"correction is a rewrite ({len(corrected.split())} words from {orig_words})")
    changes = data.get("changes")
    if not isinstance(changes, list) or not changes or not all(isinstance(c, dict) for c in changes):
        return Verdict("fail", findings=findings, reason="malformed output: corrected verdict without a changes list")
    clean_changes = []
    for c in changes:
        reason = _normalize(str(c.get("reason") or ""))
        if not reason:
            return Verdict("fail", findings=findings, reason="malformed output: a change has no reason")
        clean_changes.append({"before": _normalize(str(c.get("before") or "")),
                              "after": _normalize(str(c.get("after") or "")),
                              "reason": reason})
    # A correction that claims to be Markdown-only (every change is a
    # markers-removed change, or every reason says so) must be exactly the
    # current summary without its markers: nothing else may change.
    claims_markdown_only = all(
        _is_markdown_only_change(c["before"], c["after"]) or "markdown" in c["reason"].lower()
        for c in clean_changes)
    if claims_markdown_only and _normalize(corrected) != strip_markdown_markers(review.summary):
        return Verdict("fail", findings=findings,
                       reason="Markdown-only correction changed more than the markers")
    # Allowance 1: every change only strips a correct acronym expansion or
    # pairing -> the summary is right as it stands; the verdict is pass
    # (subject to the same checks a pass gets).
    if all(_is_acronym_pairing_removal(c["before"], c["after"], c["reason"]) for c in clean_changes):
        return _pass_checks(review, findings, has_descendants) or Verdict(
            "pass", findings=findings, reason=ACRONYM_ONLY_REASON)
    return Verdict("corrected", corrected_summary=corrected, changes=clean_changes, findings=findings)


def verdict_from_message(message, review: ReviewInput) -> Verdict:
    """Message -> Verdict, including the parse step (a parse error is a
    malformed-output fail)."""
    stop_reason = getattr(message, "stop_reason", None)
    if stop_reason in ("max_tokens", "refusal"):
        return validate_verdict(None, review, stop_reason=stop_reason)
    raw = _message_text(message)
    if not raw:
        return Verdict("fail", reason="malformed output: empty response")
    try:
        data = parse_verdict_text(raw)
    except ValueError as exc:
        return Verdict("fail", reason=f"malformed output: {exc}")
    return validate_verdict(data, review, stop_reason=stop_reason)


# --------------------------------------------------------------------------
# Writes
# --------------------------------------------------------------------------

def reviewed_by_for(verdict: str, model: str, date: Optional[str] = None) -> str:
    date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    template = REVIEWED_BY_CORRECTED if verdict == "corrected" else REVIEWED_BY_PASS
    return template.format(model=model, date=date)


def _update_if_status(client, provision_id: str, payload: dict, statuses: tuple[str, ...]) -> bool:
    """UPDATE ... WHERE id = ? AND summary_status IN statuses. Returns
    whether a row was updated. PostgREST returns the updated rows, so an
    empty list means the row's status changed since it was selected (an
    admin got there first) and nothing was written."""
    q = client.table("provisions").update(payload).eq("id", provision_id)
    if len(statuses) == 1:
        q = q.eq("summary_status", statuses[0])
    else:
        q = q.in_("summary_status", list(statuses))
    res = q.execute()
    data = getattr(res, "data", None)
    if data is None:
        return True  # client did not return representation; assume written
    return len(data) > 0


def _update_if_pending(client, provision_id: str, payload: dict) -> bool:
    return _update_if_status(client, provision_id, payload, ("pending",))


def apply_verdict(client, row: dict, review: ReviewInput, verdict: Verdict, model: str,
                  date: Optional[str] = None, rereview: bool = False) -> str:
    """Performs the writes for one verdict. Returns what happened:
    'approved', 'corrected', 'failed' (no write), 'failed_to_pending'
    (--rereview: status set back to pending, text untouched) or
    'skipped_not_pending' (the row's status changed since selection; in
    --rereview, it is no longer approved/edited).

    Normal mode writes only where the row is still pending. --rereview
    writes only where it is still approved/edited: pass stamps reviewed_by
    and reviewed_at and changes nothing else (no provision_changes row --
    the summary did not change); corrected is the same write as normal
    mode; fail sets summary_status = 'pending'."""
    guard = REREVIEW_STATUSES if rereview else ("pending",)
    now = datetime.now(timezone.utc).isoformat()
    if verdict.verdict == "fail":
        if not rereview:
            return "failed"
        if not _update_if_status(client, row["id"], {"summary_status": "pending"}, guard):
            return "skipped_not_pending"
        return "failed_to_pending"
    if verdict.verdict == "pass":
        payload = {
            "reviewed_at": now,
            "reviewed_by": reviewed_by_for("pass", model, date),
        }
        if not rereview:
            payload["summary_status"] = "approved"
        if not _update_if_status(client, row["id"], payload, guard):
            return "skipped_not_pending"
        if not rereview:
            client.table("provision_changes").insert({
                "provision_id": row["id"],
                "change_type": "summary_approved",
                "note": f"AI second-pass review (automated pipeline, {model}): pass",
            }).execute()
        return "approved"

    # corrected: keep the prior text in summary_original unless a reviewer
    # already preserved one there (never overwrite an existing value).
    payload = {
        "ai_summary": verdict.corrected_summary,
        "summary_original": row.get("summary_original") or row.get("ai_summary"),
        "summary_status": "approved",
        "reviewed_at": now,
        "reviewed_by": reviewed_by_for("corrected", model, date),
    }
    if not _update_if_status(client, row["id"], payload, guard):
        return "skipped_not_pending"
    client.table("provision_changes").insert({
        "provision_id": row["id"],
        "change_type": "summary_edited",
        "note": f"AI second-pass review (automated pipeline, {model}): {verdict.reasons_note}",
    }).execute()
    return "corrected"


# --------------------------------------------------------------------------
# Cost
# --------------------------------------------------------------------------

def rate_for(model: str) -> dict:
    """Exact model id first, then the longest known id the given one extends
    (a dated snapshot such as claude-sonnet-4-5-20250929), then the
    summarizer's table / fallback."""
    if model in MODEL_RATES:
        return MODEL_RATES[model]
    for key in sorted(MODEL_RATES, key=len, reverse=True):
        if model.startswith(key + "-"):
            return MODEL_RATES[key]
    return sz.rate_for(model)


def estimate_cost(model: str, input_tokens: int, output_tokens: int, batch: bool = True,
                  cache_creation_tokens: int = 0, cache_read_tokens: int = 0) -> float:
    """USD for the given usage. `input_tokens` is the uncached input (what
    the API reports in usage.input_tokens); cached system-prompt tokens
    come separately as 1h cache writes (2x input rate) and cache reads
    (0.1x). The batch discount halves all of it."""
    rates = rate_for(model)
    discount = 0.5 if batch else 1.0
    inp = (input_tokens
           + cache_creation_tokens * CACHE_WRITE_MULTIPLIER_1H
           + cache_read_tokens * CACHE_READ_MULTIPLIER) / 1_000_000 * rates["in"]
    return (inp + (output_tokens / 1_000_000) * rates["out"]) * discount


def estimate_tokens_by_chars(chars: int, model: str) -> int:
    cpt = CHARS_PER_TOKEN_OLD if supports_temperature(model) else CHARS_PER_TOKEN_NEW
    return int(chars / cpt)


def expected_output_tokens(model: str) -> int:
    return EST_OUTPUT_TOKENS_PLAIN if supports_temperature(model) else EST_OUTPUT_TOKENS_THINKING


def count_tokens_api(client_anthropic, review: ReviewInput, model: str) -> int:
    """client.messages.count_tokens on system + messages (the free endpoint;
    output_config is left out and SCHEMA_TOKEN_ALLOWANCE covers it).
    Retries 429/5xx with backoff."""
    delay = 2.0
    for attempt in range(COUNT_TOKENS_RETRIES + 1):
        try:
            res = client_anthropic.messages.count_tokens(
                model=model, system=review.system,
                messages=[{"role": "user", "content": review.prompt}],
            )
            return int(res.input_tokens) + SCHEMA_TOKEN_ALLOWANCE
        except Exception as exc:  # noqa: BLE001
            status = getattr(exc, "status_code", None)
            if attempt == COUNT_TOKENS_RETRIES or status not in (None, 429, 500, 502, 503, 529):
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def estimate_run_cost(client_anthropic, reviews: list[ReviewInput], model: str) -> tuple[float, str]:
    """Batch-price estimate for submitting `reviews` to `model`: input
    tokens from the free count_tokens endpoint (a character estimate for
    rows it fails on, or with no client) plus expected_output_tokens per
    row. Returns (usd, method)."""
    if client_anthropic is not None:
        counted = count_tokens_many(client_anthropic, reviews, model)
        est_in = sum(c if c is not None else estimate_tokens_by_chars(r.chars, model) + SCHEMA_TOKEN_ALLOWANCE
                     for c, r in zip(counted, reviews))
        method = "count_tokens"
    else:
        est_in = sum(estimate_tokens_by_chars(r.chars, model) + SCHEMA_TOKEN_ALLOWANCE for r in reviews)
        method = "character estimate"
    est_out = expected_output_tokens(model) * len(reviews)
    return estimate_cost(model, est_in, est_out, batch=True), method


def count_tokens_many(client_anthropic, reviews: list[ReviewInput], model: str,
                      workers: int = COUNT_TOKENS_WORKERS) -> list[Optional[int]]:
    """Counts every review's input for `model`, in parallel. None where the
    endpoint failed for that row (the caller estimates those by chars)."""
    def one(review: ReviewInput) -> Optional[int]:
        try:
            return count_tokens_api(client_anthropic, review, model)
        except Exception as exc:  # noqa: BLE001
            print(f"  count_tokens failed for {review.provision_id}: {exc}", file=sys.stderr)
            return None
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(one, reviews))


# --------------------------------------------------------------------------
# Run state + report
# --------------------------------------------------------------------------

@dataclass
class RunStats:
    selected: int = 0
    passed: int = 0
    corrected: int = 0
    failed: int = 0
    skipped_not_pending: int = 0
    api_errors: int = 0
    input_tokens: int = 0            # uncached input, as the API reports it
    output_tokens: int = 0
    cache_creation_tokens: int = 0   # system prompt written to the cache (1h TTL, 2x)
    cache_read_tokens: int = 0       # system prompt served from the cache (0.1x)
    batches_submitted: int = 0
    truncated_rows: int = 0      # provision text over MAX_PROMPT_WORDS
    outline_rows: int = 0        # descendants shown as an outline (over CHILD_TEXT_WORDS)
    with_descendants: int = 0
    by_reg: dict = field(default_factory=dict)          # reg -> {selected, pass, corrected, fail}
    corrected_rows: list = field(default_factory=list)  # dicts: id, reg, before, after, changes
    failed_rows: list = field(default_factory=list)     # dicts: id, reg, reason
    passed_rows: list = field(default_factory=list)     # ids
    batch_ids: list = field(default_factory=list)

    def reg_bucket(self, provision_id: str) -> dict:
        reg = sz.reg_key_of(provision_id) or "?"
        return self.by_reg.setdefault(reg, {"selected": 0, "pass": 0, "corrected": 0, "fail": 0})

    def note_selected(self, review: ReviewInput) -> None:
        self.selected += 1
        self.reg_bucket(review.provision_id)["selected"] += 1
        if review.text_result.truncated:
            self.truncated_rows += 1
        if review.text_result.outline_mode:
            self.outline_rows += 1
        if review.text_result.descendant_count:
            self.with_descendants += 1

    def note_outcome(self, review: ReviewInput, verdict: Verdict, outcome: str) -> None:
        bucket = self.reg_bucket(review.provision_id)
        reg = sz.reg_key_of(review.provision_id) or "?"
        if outcome == "skipped_not_pending":
            self.skipped_not_pending += 1
            return
        if verdict.verdict == "pass":
            self.passed += 1
            bucket["pass"] += 1
            self.passed_rows.append(review.provision_id)
        elif verdict.verdict == "corrected":
            self.corrected += 1
            bucket["corrected"] += 1
            self.corrected_rows.append({
                "id": review.provision_id, "reg": reg,
                "before": review.summary, "after": verdict.corrected_summary,
                "changes": verdict.changes, "findings": verdict.findings,
            })
        else:
            self.failed += 1
            bucket["fail"] += 1
            self.failed_rows.append({"id": review.provision_id, "reg": reg,
                                     "reason": verdict.reason, "findings": verdict.findings,
                                     "set_pending": outcome == "failed_to_pending"})

    def add_usage(self, usage) -> None:
        self.input_tokens += getattr(usage, "input_tokens", 0) or 0
        self.output_tokens += getattr(usage, "output_tokens", 0) or 0
        self.cache_creation_tokens += getattr(usage, "cache_creation_input_tokens", 0) or 0
        self.cache_read_tokens += getattr(usage, "cache_read_input_tokens", 0) or 0

    @property
    def total_input_tokens(self) -> int:
        """Everything the model read: uncached + cache writes + cache reads."""
        return self.input_tokens + self.cache_creation_tokens + self.cache_read_tokens

    @property
    def cache_read_share(self) -> float:
        """Share of all input tokens that were served from the cache (0..1)."""
        total = self.total_input_tokens
        return (self.cache_read_tokens / total) if total else 0.0

    def cost(self, model: str, batch: bool = True) -> float:
        return estimate_cost(model, self.input_tokens, self.output_tokens, batch=batch,
                             cache_creation_tokens=self.cache_creation_tokens,
                             cache_read_tokens=self.cache_read_tokens)


def log_failure(provision_id: str, reason: str) -> None:
    FAILED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with FAILED_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"id": provision_id, "reason": reason,
                            "at": datetime.now(timezone.utc).isoformat()}) + "\n")


def build_report(stats: RunStats, model: str, effort: str, execute: bool,
                 dry_run_quote: Optional[dict] = None, started_at: Optional[str] = None,
                 audit: Optional[dict] = None, rereview: bool = False,
                 snapshot: Optional[dict] = None) -> tuple[str, dict]:
    """(markdown, json-able dict) for this run. With `audit` (the sample
    info from select_audit_sample) the report is an audit report: nothing
    was written, and corrected rows are listed as would-correct. With
    `rereview` the selection was the hand-approved rows and a fail set the
    row back to pending; `snapshot` says what was archived first."""
    now = datetime.now(timezone.utc).isoformat()
    actual_cost = stats.cost(model, batch=True)
    if audit is not None:
        mode = ("AUDIT of approved summaries -- reviewer called, NOTHING written to the database"
                if execute else "AUDIT dry run (no API call billed, no write)")
    elif rereview:
        mode = ("RE-REVIEW of hand-approved summaries -- execute"
                if execute else "RE-REVIEW of hand-approved summaries -- dry run (no API call billed, no write)")
    else:
        mode = "execute" if execute else "dry run (no API call billed, no write)"
    data = {
        "run": {
            "started_at": started_at, "finished_at": now,
            "mode": mode,
            "selection": "audit" if audit is not None else ("rereview" if rereview else "pending"),
            "snapshot": snapshot,
            "model": model,
            "sampling": sampling_description(model, effort),
            "prompt_version": REVIEW_PROMPT_VERSION,
            "system_prompt": REVIEW_SYSTEM_PROMPT,
            "output_schema": VERDICT_SCHEMA,
            "pricing_source": PRICING_SOURCE,
        },
        "counts": {
            "selected": stats.selected, "pass": stats.passed, "corrected": stats.corrected,
            "fail": stats.failed, "skipped_not_pending": stats.skipped_not_pending,
            "api_errors": stats.api_errors,
            "truncated_rows": stats.truncated_rows, "outline_rows": stats.outline_rows,
            "with_descendants": stats.with_descendants,
        },
        "by_regulation": dict(sorted(stats.by_reg.items(), key=lambda kv: (-kv[1]["selected"], kv[0]))),
        "usage": {"input_tokens": stats.input_tokens, "output_tokens": stats.output_tokens,
                  "cache_creation_input_tokens": stats.cache_creation_tokens,
                  "cache_read_input_tokens": stats.cache_read_tokens,
                  "total_input_tokens": stats.total_input_tokens,
                  "cache_read_share": round(stats.cache_read_share, 4),
                  "cost_usd_batch": round(actual_cost, 4), "batches": stats.batch_ids},
        "corrected": stats.corrected_rows,
        "failed": stats.failed_rows,
        "passed_ids": stats.passed_rows,
        "dry_run_quote": dry_run_quote,
        "audit": audit,
    }

    md: list[str] = []
    md.append(f"# AI second-pass review report -- {data['run']['mode']}")
    md.append("")
    md.append(f"- Model: `{model}` ({data['run']['sampling']}); prompt version `{REVIEW_PROMPT_VERSION}`")
    md.append(f"- Started {started_at}, finished {now}")
    md.append("")
    if audit is not None:
        md.append(f"- Audit sample: {audit['requested']} requested, seed {audit['seed']}, from "
                  f"{audit['eligible']:,} {'/'.join(audit['statuses'])} rows whose reviewed_by does not contain "
                  f"\"{audit['exclude_reviewed_by']}\"; allocation by regulation: "
                  + ", ".join(f"{k}={v}" for k, v in audit["allocation"].items()))
        md.append("")
    md.append("## Counts")
    md.append("")
    md.append("| verdict | rows |")
    md.append("|---|---:|")
    if audit is not None:
        md.append(f"| sampled (approved, audited) | {stats.selected:,} |")
        md.append(f"| pass (reviewer finds no error) | {stats.passed:,} |")
        md.append(f"| corrected (reviewer would correct; NOT written) | {stats.corrected:,} |")
        md.append(f"| fail (reviewer cannot verify or fix; NOT written) | {stats.failed:,} |")
    elif rereview:
        md.append(f"| selected (approved/edited, not yet reviewed by the pipeline) | {stats.selected:,} |")
        md.append(f"| pass -> reviewed_by/reviewed_at stamped, text unchanged | {stats.passed:,} |")
        md.append(f"| corrected -> approved with new text | {stats.corrected:,} |")
        md.append(f"| fail -> set back to pending (text unchanged) | {stats.failed:,} |")
        if snapshot:
            md.append(f"| rows snapshotted to archive before the first write | {snapshot.get('added', 0):,} "
                      f"(of {snapshot.get('selected', 0):,} selected; the rest were already in the snapshot) |")
    else:
        md.append(f"| selected (pending with a summary) | {stats.selected:,} |")
        md.append(f"| pass -> approved | {stats.passed:,} |")
        md.append(f"| corrected -> approved with new text | {stats.corrected:,} |")
        md.append(f"| fail (stays pending) | {stats.failed:,} |")
    md.append(f"| skipped: no longer pending at write time | {stats.skipped_not_pending:,} |")
    md.append(f"| API errors (stay pending) | {stats.api_errors:,} |")
    md.append(f"| rows whose provision text exceeds {sz.MAX_PROMPT_WORDS:,} words (truncated) | {stats.truncated_rows:,} |")
    md.append(f"| rows whose descendants exceed {sz.CHILD_TEXT_WORDS:,} words (outline only) | {stats.outline_rows:,} |")
    md.append(f"| rows with descendants in the text | {stats.with_descendants:,} |")
    md.append("")
    md.append("## By regulation")
    md.append("")
    md.append("| reg | selected | pass | corrected | fail |")
    md.append("|---|---:|---:|---:|---:|")
    for reg, b in data["by_regulation"].items():
        md.append(f"| {reg} | {b['selected']:,} | {b['pass']:,} | {b['corrected']:,} | {b['fail']:,} |")
    md.append("")
    md.append("## Usage and cost")
    md.append("")
    if execute:
        md.append(f"- Input tokens: {stats.total_input_tokens:,} in all -- {stats.input_tokens:,} uncached, "
                  f"{stats.cache_creation_tokens:,} written to the cache ({SYSTEM_CACHE_TTL} TTL), "
                  f"{stats.cache_read_tokens:,} read from the cache "
                  f"(**{stats.cache_read_share:.1%} of input was cache reads**); "
                  f"output tokens: {stats.output_tokens:,}")
        md.append(f"- Actual cost at batch rates: ${actual_cost:,.4f} (cache writes at "
                  f"{CACHE_WRITE_MULTIPLIER_1H:g}x and reads at {CACHE_READ_MULTIPLIER:g}x the input rate; "
                  f"{PRICING_SOURCE})")
        if stats.batch_ids:
            md.append(f"- Batches: {', '.join(stats.batch_ids)}")
    if dry_run_quote:
        q = dry_run_quote
        md.append(f"- Token count method: {q['method']}")
        md.append(f"- Expected output tokens per row: {EST_OUTPUT_TOKENS_PLAIN} (no-thinking models), "
                  f"{EST_OUTPUT_TOKENS_THINKING} (thinking models at effort {effort})")
        md.append("")
        md.append("| model | tokenizer | input tokens | output tokens (est.) | batch $/M in | batch $/M out | batch cost, no cache hits | batch cost, full cache hits | note |")
        md.append("|---|---|---:|---:|---:|---:|---:|---:|---|")
        for opt in q["options"]:
            md.append(f"| {opt['model']} | {opt['tokenizer']} | {opt['input_tokens']:,} | {opt['output_tokens']:,} "
                      f"| ${opt['batch_in_per_m']:.2f} | ${opt['batch_out_per_m']:.2f} | **${opt['cost_usd']:,.2f}** "
                      f"| ${opt.get('cost_usd_with_cache_hits', opt['cost_usd']):,.2f} | {opt['note']} |")
        md.append("")
        md.append(f"- Prices: {PRICING_SOURCE}; the Batches API is 50% off the standard input and output rates. "
                  f"The system prompt ({', '.join(f'{k}: {v:,} tokens' for k, v in (q.get('system_prompt_tokens') or {}).items())}) "
                  f"is sent as a cached block ({SYSTEM_CACHE_TTL} TTL); 'full cache hits' assumes one write and a cache "
                  f"read on every other row. Hits inside a batch are best-effort, so the real figure lies between the two.")
    md.append("")
    corrected_heading = ("Rows the reviewer would correct (NOT changed)" if audit is not None
                         else "Corrected rows")
    md.append(f"## {corrected_heading} ({len(stats.corrected_rows)})")
    md.append("")
    for row in stats.corrected_rows:
        md.append(f"### {row['id']}")
        md.append("")
        md.append(f"**{'Current summary' if audit is not None else 'Before'}:** {row['before']}")
        md.append("")
        md.append(f"**{'Reviewer would write' if audit is not None else 'After'}:** {row['after']}")
        md.append("")
        for c in row["changes"]:
            md.append(f"- {c['reason']}" + (f" (\"{c['before']}\" -> \"{c['after']}\")" if c["before"] or c["after"] else ""))
        md.append("")
    md.append(f"## Failed rows ({len(stats.failed_rows)})"
              + (" -- NOT changed" if audit is not None
                 else " -- set back to pending, summary text unchanged" if rereview
                 else " -- still pending"))
    md.append("")
    for row in stats.failed_rows:
        md.append(f"- `{row['id']}`: {row['reason']}")
    md.append("")
    return "\n".join(md), data


def write_report(md: str, data: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_MD_PATH.write_text(md, encoding="utf-8")
    REPORT_JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# --------------------------------------------------------------------------
# Dry run
# --------------------------------------------------------------------------

def dry_run_quote(reviews: list[ReviewInput], client_anthropic, effort: str) -> dict:
    """Token counts and batch prices for every MODEL_OPTIONS entry. With an
    Anthropic client the free count_tokens endpoint is used once per
    distinct tokenizer; otherwise a characters-per-token estimate."""
    counts_by_tokenizer: dict[str, list[int]] = {}
    method_parts: list[str] = []
    tokenizers = sorted({opt["tokenizer"] for opt in MODEL_OPTIONS})
    for tok in tokenizers:
        if client_anthropic is not None:
            print(f"Counting input tokens with the API (free endpoint) for tokenizer {tok}: {len(reviews):,} rows...")
            counted = count_tokens_many(client_anthropic, reviews, tok)
            fallback = sum(1 for c in counted if c is None)
            counts = [c if c is not None else estimate_tokens_by_chars(r.chars, tok)
                      for c, r in zip(counted, reviews)]
            method_parts.append(
                f"{tok}: messages.count_tokens on system + user turn, plus {SCHEMA_TOKEN_ALLOWANCE} "
                f"tokens per row for the output schema"
                + (f" ({fallback} rows fell back to a character estimate after API errors)" if fallback else ""))
        else:
            counts = [estimate_tokens_by_chars(r.chars, tok) for r in reviews]
            cpt = CHARS_PER_TOKEN_OLD if supports_temperature(tok) else CHARS_PER_TOKEN_NEW
            method_parts.append(f"{tok}: character estimate at {cpt} chars/token (no ANTHROPIC_API_KEY, so no count_tokens call)")
        counts_by_tokenizer[tok] = counts

    # The system prompt's own size per tokenizer (count_tokens on the system
    # prompt plus a one-word user turn), for the "with cache hits" figure:
    # every row after the first reads it from the cache instead of paying
    # full input price.
    system_tokens: dict[str, int] = {}
    for tok in tokenizers:
        if client_anthropic is not None and reviews:
            probe = ReviewInput(provision_id="_system_probe", prompt="x", system=reviews[0].system,
                                summary="", text_result=reviews[0].text_result)
            try:
                system_tokens[tok] = max(0, count_tokens_api(client_anthropic, probe, tok) - SCHEMA_TOKEN_ALLOWANCE)
            except Exception as exc:  # noqa: BLE001
                print(f"  count_tokens failed for the system prompt ({tok}): {exc}", file=sys.stderr)
                system_tokens[tok] = estimate_tokens_by_chars(len(REVIEW_SYSTEM_PROMPT), tok)
        else:
            system_tokens[tok] = estimate_tokens_by_chars(len(REVIEW_SYSTEM_PROMPT), tok)

    options = []
    for opt in MODEL_OPTIONS:
        input_tokens = sum(counts_by_tokenizer[opt["tokenizer"]])
        output_tokens = expected_output_tokens(opt["model"]) * len(reviews)
        rates = rate_for(opt["model"])
        sys_tok = system_tokens[opt["tokenizer"]]
        n = len(reviews)
        # Full cache hits: one write of the system prompt, n-1 reads, the rest uncached.
        cached_reads = sys_tok * max(0, n - 1)
        uncached = max(0, input_tokens - sys_tok * n)
        options.append({
            "model": opt["model"], "tokenizer": opt["tokenizer"], "note": opt["note"],
            "input_tokens": input_tokens, "output_tokens": output_tokens,
            "system_prompt_tokens": sys_tok,
            "batch_in_per_m": rates["in"] / 2, "batch_out_per_m": rates["out"] / 2,
            "cost_usd": round(estimate_cost(opt["model"], input_tokens, output_tokens, batch=True), 4),
            "cost_usd_with_cache_hits": round(estimate_cost(
                opt["model"], uncached, output_tokens, batch=True,
                cache_creation_tokens=sys_tok if n else 0, cache_read_tokens=cached_reads), 4),
        })
    return {"method": "; ".join(method_parts), "rows": len(reviews), "options": options,
            "system_prompt_tokens": system_tokens,
            "per_row_input_tokens": {tok: counts for tok, counts in counts_by_tokenizer.items()}}


# --------------------------------------------------------------------------
# Batch execution
# --------------------------------------------------------------------------

def submit_batches(client_anthropic, reviews: list[ReviewInput], model: str, effort: str,
                   stats: RunStats) -> tuple[list[tuple[object, list[str]]], dict[str, str]]:
    """Submits every review through the Batches API, BATCH_MAX_REQUESTS per
    batch, all up front (the Phase 0 pilot showed a single batch can wait
    over an hour to start; submitting them together makes the wall clock
    the slowest batch rather than the sum). Returns [(batch, custom_ids)]
    and the custom_id -> provision id map."""
    custom_id_map: dict[str, str] = {}
    requests = []
    for review in reviews:
        custom_id = sz.make_custom_id(review.provision_id, custom_id_map)
        requests.append({"custom_id": custom_id, "params": request_params(review, model, effort)})
    pending: list[tuple[object, list[str]]] = []
    for start in range(0, len(requests), BATCH_MAX_REQUESTS):
        chunk = requests[start:start + BATCH_MAX_REQUESTS]
        print(f"Submitting batch of {len(chunk)} reviews ({start + 1}-{start + len(chunk)} of {len(requests)})...")
        batch = client_anthropic.messages.batches.create(requests=chunk)
        stats.batches_submitted += 1
        stats.batch_ids.append(batch.id)
        print(f"  batch id: {batch.id} (processing_status '{batch.processing_status}')")
        pending.append((batch, [r["custom_id"] for r in chunk]))
    return pending, custom_id_map


def consume_batch(client_anthropic, client_supabase, batch_id: str, custom_id_map: dict[str, str],
                  reviews_by_id: dict[str, ReviewInput], rows_by_id: dict[str, dict],
                  model: str, stats: RunStats, execute: bool, rereview: bool = False) -> None:
    """Validates and (with execute) writes every result of one ended batch."""
    for item in client_anthropic.messages.batches.results(batch_id):
        provision_id = custom_id_map.get(item.custom_id)
        if provision_id is None or provision_id not in reviews_by_id:
            print(f"  WARNING: result {item.custom_id} does not match a selected row; skipped.", file=sys.stderr)
            continue
        review = reviews_by_id[provision_id]
        outcome = item.result
        if outcome.type != "succeeded":
            detail = getattr(getattr(outcome, "error", None), "message", outcome.type)
            stats.api_errors += 1
            log_failure(provision_id, f"{outcome.type}: {detail}")
            continue
        message = outcome.message
        stats.add_usage(message.usage)
        verdict = verdict_from_message(message, review)
        handle_verdict(client_supabase, rows_by_id[provision_id], review, verdict, model, stats, execute,
                       rereview=rereview)


def handle_verdict(client_supabase, row: dict, review: ReviewInput, verdict: Verdict, model: str,
                   stats: RunStats, execute: bool, rereview: bool = False) -> str:
    if execute:
        outcome = apply_verdict(client_supabase, row, review, verdict, model, rereview=rereview)
    else:
        outcome = {"pass": "approved", "corrected": "corrected",
                   "fail": "failed_to_pending" if rereview else "failed"}[verdict.verdict]
    if verdict.verdict == "fail":
        log_failure(review.provision_id, verdict.reason)
    stats.note_outcome(review, verdict, outcome)
    return outcome


def poll_batches(client_anthropic, client_supabase, pending, custom_id_map, reviews_by_id, rows_by_id,
                 model: str, stats: RunStats, execute: bool, poll_interval: int,
                 max_cost: Optional[float] = None, rereview: bool = False) -> None:
    """Polls until every batch ends and consumes each one. `execute` is
    whether verdicts are WRITTEN (False in audit mode: the reviewer is
    called, nothing is written)."""
    print(f"Polling {len(pending)} batch(es) every {poll_interval}s...")
    deadline = time.monotonic() + MAX_POLL_SECONDS
    while pending:
        still_pending = []
        for batch, custom_ids in pending:
            batch = client_anthropic.messages.batches.retrieve(batch.id)
            if batch.processing_status != "ended":
                still_pending.append((batch, custom_ids))
                continue
            counts = batch.request_counts
            print(f"  batch {batch.id} done: succeeded={counts.succeeded} errored={counts.errored} "
                  f"canceled={counts.canceled} expired={counts.expired}")
            consume_batch(client_anthropic, client_supabase, batch.id, custom_id_map, reviews_by_id,
                          rows_by_id, model, stats, execute, rereview=rereview)
            spent = stats.cost(model, batch=True)
            print(f"  spend so far: ${spent:,.4f}")
            if max_cost is not None and spent > max_cost and still_pending:
                print(f"  STOP: spend ${spent:,.4f} passed the cap ${max_cost:,.2f}; cancelling the remaining batches.")
                for other, other_ids in still_pending:
                    try:
                        client_anthropic.messages.batches.cancel(other.id)
                    except Exception as exc:  # noqa: BLE001
                        print(f"  cancel failed for {other.id}: {exc}", file=sys.stderr)
                    for cid in other_ids:
                        pid = custom_id_map.get(cid, cid)
                        log_failure(pid, "canceled: spend cap reached")
                        stats.api_errors += 1
                return
        pending = still_pending
        if not pending:
            break
        if time.monotonic() > deadline:
            for batch, custom_ids in pending:
                print(f"  WARNING: batch {batch.id} did not finish within {MAX_POLL_SECONDS}s -- "
                      f"its rows stay pending; consume it later with --resume-batch {batch.id}.")
                for cid in custom_ids:
                    log_failure(custom_id_map.get(cid, cid), f"batch poll timeout ({batch.id})")
                    stats.api_errors += 1
            break
        time.sleep(poll_interval)


def run_sync(client_anthropic, client_supabase, reviews: list[ReviewInput], rows_by_id: dict[str, dict],
             model: str, effort: str, stats: RunStats, execute: bool, rereview: bool = False) -> None:
    """Single synchronous calls (2x the batch price). For small tests only."""
    for review in reviews:
        params = request_params(review, model, effort)
        temperature = params.pop("temperature", None)
        try:
            if temperature is not None:
                message = client_anthropic.messages.create(extra_body={"temperature": temperature}, **params)
            else:
                message = client_anthropic.messages.create(**params)
        except Exception as exc:  # noqa: BLE001
            stats.api_errors += 1
            log_failure(review.provision_id, str(exc))
            continue
        stats.add_usage(message.usage)
        verdict = verdict_from_message(message, review)
        handle_verdict(client_supabase, rows_by_id[review.provision_id], review, verdict, model, stats, execute,
                       rereview=rereview)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automated AI second-pass review of pending summaries.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--reg", default=None,
                        help="Limit to one regulation's id prefix (7, 3, 26, gp12, oooob, ...), or several "
                             "comma-separated (gp01,gp02,...). Omit for all.")
    parser.add_argument("--ids", default=None,
                        help="Comma-separated exact provision ids. Only the ones that are pending are reviewed.")
    parser.add_argument("--limit", type=int, default=None, help="Stop after this many rows.")
    parser.add_argument("--execute", action="store_true",
                        help="Make the paid calls and write the verdicts. Without it: dry run, no "
                             "paid call, no write (count_tokens, a free endpoint, is used when an "
                             "API key is present).")
    parser.add_argument("--dry-run", action="store_true", help="Explicit alias for not passing --execute.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Reviewer model id.")
    parser.add_argument("--effort", default=DEFAULT_EFFORT, choices=["low", "medium", "high"],
                        help="output_config.effort for models with thinking (ignored for temperature models).")
    parser.add_argument("--sync", action="store_true",
                        help="Synchronous Messages calls instead of the Batches API (2x price; small tests).")
    parser.add_argument("--max-cost", type=float, default=None, metavar="USD",
                        help="Refuse to submit when the estimate exceeds this, and cancel the remaining "
                             "batches once actual spend passes it.")
    parser.add_argument("--resume-batch", default=None, metavar="ID[,ID]",
                        help="Consume the results of batches a previous run submitted but did not finish "
                             "polling (the rows must still be pending and in scope). No new submission.")
    parser.add_argument("--poll-interval", type=int, default=POLL_INTERVAL_SECONDS)
    parser.add_argument("--show", type=int, default=0, help="Dry run: print the first N review prompts.")
    parser.add_argument("--audit", type=int, default=None, metavar="N",
                        help="AUDIT MODE: review a seeded random sample of N approved/edited rows whose "
                             "reviewed_by does not contain 'automated pipeline', spread across regulations. "
                             "Writes NOTHING to the database, only the report; with --execute the reviewer "
                             "is called (paid), without it a cost quote. Ignores --ids/--limit.")
    parser.add_argument("--seed", type=int, default=20261005, help="Audit mode: random seed for the sample.")
    parser.add_argument("--rereview", action="store_true",
                        help="RE-REVIEW MODE: select approved/edited rows whose reviewed_by does not contain "
                             "'automated pipeline' (the hand passes) instead of pending rows. With --execute: "
                             "every selected row is snapshotted to archive.summary_review_snapshot_rereview "
                             "first; pass stamps reviewed_by/reviewed_at, corrected writes as usual, fail sets "
                             "summary_status back to 'pending' and leaves the text alone. --reg/--ids/--limit "
                             "apply. Not combinable with --audit.")
    parser.add_argument("--audit-ids", default=None, metavar="ID[,ID]",
                        help="AUDIT MODE on exact ids: review these approved/edited rows (whatever their "
                             "reviewed_by) and write NOTHING; the report lists would-corrects. For re-checking "
                             "specific rows after a prompt change. Ignores --audit/--seed/--ids/--limit/--reg.")
    args = parser.parse_args(argv)
    if args.audit_ids:
        args.audit = 0   # audit mode, selection by ids
    if args.rereview and args.audit is not None:
        parser.error("--rereview and --audit/--audit-ids are different selections; pass one.")
    return args


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    execute = bool(args.execute) and not args.dry_run
    started_at = datetime.now(timezone.utc).isoformat()

    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    if execute:
        required.append("ANTHROPIC_API_KEY")
    sz.require_env(required)

    client_supabase = sz.make_supabase_client()
    client_anthropic = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        client_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    if FAILED_LOG_PATH.exists():
        FAILED_LOG_PATH.unlink()

    audit_info: Optional[dict] = None
    ids = [i.strip() for i in args.ids.split(",") if i.strip()] if args.ids and args.audit is None else None
    meta_reg = None if (ids or args.audit is not None or (args.reg and "," in args.reg)) else args.reg
    print(f"Fetching parent/citation metadata{f' for reg {meta_reg}' if meta_reg else ' (all regulations)'}...")
    meta = sz.fetch_meta(client_supabase, meta_reg)
    children_index = sz.build_children_index(meta)
    print(f"  {len(meta):,} rows loaded; {len(children_index):,} have children.")

    if args.audit_ids:
        audit_ids = [i.strip() for i in args.audit_ids.split(",") if i.strip()]
        print(f"AUDIT on {len(audit_ids)} explicit id(s). Nothing will be written to the database.")
        rows, audit_info = select_audit_ids(client_supabase, audit_ids)
        print(f"  {len(rows):,} approved/edited rows found.")
    elif args.audit is not None:
        print(f"AUDIT: sampling {args.audit} approved rows (seed {args.seed}) whose reviewed_by does not "
              f"contain '{AUDIT_EXCLUDE_REVIEWED_BY}'. Nothing will be written to the database.")
        rows, audit_info = select_audit_sample(client_supabase, args.audit, args.seed,
                                               reg=args.reg if args.reg and "," not in args.reg else None)
        print(f"  {audit_info['eligible']:,} eligible rows; {len(rows):,} sampled across "
              f"{len(audit_info['allocation'])} regulations.")
    else:
        what = ("approved/edited rows with a summary whose reviewed_by does not contain "
                f"'{PIPELINE_REVIEWED_BY_MARK}' (RE-REVIEW)" if args.rereview else "pending rows with a summary")
        print(f"Selecting {what}"
              f"{f' ({len(ids)} explicit id(s))' if ids else ''}"
              f"{f' (limit {args.limit})' if args.limit else ''}...")
        rows = list(iter_candidates(client_supabase, args.reg, args.limit, ids=ids, rereview=args.rereview))
        print(f"  {len(rows):,} rows selected.")
    # Verdicts are written only on a real (execute) run that is not an audit.
    write = execute and audit_info is None
    rereview = bool(args.rereview)
    snapshot_info: Optional[dict] = None
    if not rows:
        print("Nothing to review.")
        md, data = build_report(RunStats(), args.model, args.effort, execute, started_at=started_at,
                                audit=audit_info, rereview=rereview)
        write_report(md, data)
        return 0

    stats = RunStats()
    reviews: list[ReviewInput] = []
    for row in rows:
        review = build_review_input(row, meta, children_index)
        stats.note_selected(review)
        reviews.append(review)
    reviews_by_id = {r.provision_id: r for r in reviews}
    rows_by_id = {r["id"]: r for r in rows}

    print(f"  by regulation: " + ", ".join(f"{k}={v['selected']}" for k, v in
                                           sorted(stats.by_reg.items(), key=lambda kv: -kv[1]['selected'])))
    print(f"  {stats.truncated_rows} rows have provision text over {sz.MAX_PROMPT_WORDS:,} words (truncated); "
          f"{stats.outline_rows} have descendants shown as an outline (over {sz.CHILD_TEXT_WORDS:,} words).")

    for review in reviews[:args.show]:
        print(f"\n--- {review.provision_id} ---\n{review.prompt[:3000]}\n")

    if not execute:
        quote = dry_run_quote(reviews, client_anthropic, args.effort)
        md, data = build_report(stats, args.model, args.effort, execute=False,
                                dry_run_quote=quote, started_at=started_at, audit=audit_info, rereview=rereview)
        write_report(md, data)
        print("\n" + "=" * 72)
        print(f"DRY RUN -- {len(reviews):,} "
              f"{'sampled approved' if audit_info else 'hand-approved (re-review)' if rereview else 'pending'} rows; "
              f"no paid call made, nothing written.")
        print("=" * 72)
        print(f"Token count method: {quote['method']}")
        for opt in quote["options"]:
            print(f"  {opt['model']:<20} in={opt['input_tokens']:>12,} out(est)={opt['output_tokens']:>10,} "
                  f"batch ${opt['batch_in_per_m']:.2f}/${opt['batch_out_per_m']:.2f} per M  "
                  f"=> ${opt['cost_usd']:,.2f} (no cache hits) / ${opt['cost_usd_with_cache_hits']:,.2f} "
                  f"(full cache hits)   {opt['note']}")
        print(f"Report: {REPORT_MD_PATH}")
        if args.max_cost is not None:
            chosen = next((o for o in quote["options"] if o["model"] == args.model), None)
            if chosen and chosen["cost_usd"] > args.max_cost:
                print(f"NOTE: the estimate for {args.model} (${chosen['cost_usd']:,.2f}) exceeds --max-cost "
                      f"${args.max_cost:,.2f}; an --execute run would refuse to submit.")
        return 0

    # --execute -----------------------------------------------------------
    print(f"Reviewer: {args.model} ({sampling_description(args.model, args.effort)}); "
          f"prompt version {REVIEW_PROMPT_VERSION}"
          f"{'; AUDIT: verdicts are NOT written' if not write else ''}"
          f"{'; RE-REVIEW: fail sets the row back to pending' if rereview and write else ''}")
    if rereview and write:
        # Snapshot before the first write, whichever path follows (a resumed
        # batch writes too). An RPC error aborts the run: no write without
        # its snapshot.
        label = f"review.py --rereview {args.model} {started_at}"
        print(f"Snapshotting {len(rows):,} selected rows to archive.summary_review_snapshot_rereview "
              f"({SNAPSHOT_RPC})...")
        added = snapshot_for_rereview(client_supabase, [r["id"] for r in rows], label)
        snapshot_info = {"rpc": SNAPSHOT_RPC, "table": "archive.summary_review_snapshot_rereview",
                         "selected": len(rows), "added": added, "run_label": label}
        print(f"  {added:,} rows newly snapshotted ({len(rows) - added:,} were already in the snapshot).")
    if args.resume_batch:
        batch_ids = [b.strip() for b in args.resume_batch.split(",") if b.strip()]
        custom_id_map: dict[str, str] = {}
        for review in reviews:
            sz.make_custom_id(review.provision_id, custom_id_map)
        for batch_id in batch_ids:
            batch = client_anthropic.messages.batches.retrieve(batch_id)
            if batch.processing_status != "ended":
                print(f"  batch {batch_id} is still '{batch.processing_status}'; try again later.")
                continue
            stats.batch_ids.append(batch_id)
            consume_batch(client_anthropic, client_supabase, batch_id, custom_id_map, reviews_by_id,
                          rows_by_id, args.model, stats, execute=write, rereview=rereview)
    elif args.sync:
        run_sync(client_anthropic, client_supabase, reviews, rows_by_id, args.model, args.effort, stats,
                 execute=write, rereview=rereview)
    else:
        if args.max_cost is not None:
            est, method = estimate_run_cost(client_anthropic, reviews, args.model)
            print(f"Estimated cost ({method} input, {expected_output_tokens(args.model)} output tokens per row): "
                  f"${est:,.2f}; cap ${args.max_cost:,.2f}")
            if est > args.max_cost:
                print(f"Refusing to submit: estimated ${est:,.2f} exceeds --max-cost ${args.max_cost:,.2f}.",
                      file=sys.stderr)
                md, data = build_report(stats, args.model, args.effort, execute=True, started_at=started_at,
                                        audit=audit_info, rereview=rereview, snapshot=snapshot_info)
                data["run"]["mode"] = f"refused: estimate ${est:,.2f} over --max-cost ${args.max_cost:,.2f}"
                write_report(md, data)
                return 2
        pending, custom_id_map = submit_batches(client_anthropic, reviews, args.model, args.effort, stats)
        poll_batches(client_anthropic, client_supabase, pending, custom_id_map, reviews_by_id, rows_by_id,
                     args.model, stats, execute=write, poll_interval=args.poll_interval, max_cost=args.max_cost,
                     rereview=rereview)

    md, data = build_report(stats, args.model, args.effort, execute=True, started_at=started_at,
                            audit=audit_info, rereview=rereview, snapshot=snapshot_info)
    write_report(md, data)
    cost = stats.cost(args.model, batch=not args.sync)
    print("\n" + "=" * 72)
    print(f"Review run -- model={args.model} mode={'sync' if args.sync else 'batch'}"
          f"{' AUDIT (nothing written)' if not write else ''}")
    print("=" * 72)
    print(f"{'Rows selected':40}{stats.selected:>10,}")
    print(f"{'pass -> stamped, text unchanged' if rereview else 'pass -> approved':40}{stats.passed:>10,}")
    print(f"{'corrected -> approved (new text)':40}{stats.corrected:>10,}")
    print(f"{'fail (set back to pending)' if rereview else 'fail (still pending)':40}{stats.failed:>10,}")
    print(f"{'skipped (status changed meanwhile)' if rereview else 'skipped (no longer pending)':40}"
          f"{stats.skipped_not_pending:>10,}")
    print(f"{'API errors (still pending)':40}{stats.api_errors:>10,}")
    print(f"{'Input tokens (uncached)':40}{stats.input_tokens:>10,}")
    print(f"{'Cache write tokens (' + SYSTEM_CACHE_TTL + ')':40}{stats.cache_creation_tokens:>10,}")
    print(f"{'Cache read tokens':40}{stats.cache_read_tokens:>10,}")
    print(f"{'Cache reads, share of all input':40}{format(stats.cache_read_share, '.1%'):>10}")
    print(f"{'Output tokens':40}{stats.output_tokens:>10,}")
    print(f"{'Cost (USD)':40}{'$' + format(cost, ',.4f'):>10}")
    print("=" * 72)
    print(f"Report: {REPORT_MD_PATH}")
    if (stats.failed or stats.api_errors) and write:
        if rereview:
            print(f"Failures logged to {FAILED_LOG_PATH}; failed rows are now pending (text unchanged) and "
                  f"are picked up by the normal pending review or by regeneration; API-error rows are "
                  f"still hand-approved and are selected again by the next --rereview run.")
        else:
            print(f"Failures logged to {FAILED_LOG_PATH}; those rows stay pending and are selected again next run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
