#!/usr/bin/env python3
"""AI plain-English summary generation for essentialregs.com provisions.

Reads rows from the Supabase `provisions` table whose `ai_summary` is NULL
(or every row in scope, with --force), builds a citation-aware prompt for
each from the regulation root, the parent chain, and the provision's own
sanitized text, and generates a 2-5 sentence plain-English summary with
Claude. Writes `ai_summary`, `summary_model`, and `summary_generated_at`
back to the row.

Designed to run in GitHub Actions (see .github/workflows/summarize.yml),
where both Supabase and api.anthropic.com are reachable. Uses the
Anthropic Message Batches API by default (50% cheaper, no rate-limit
juggling); pass --sync for small interactive test runs.

Examples:
    # See what would be sent, without calling the API or writing anything.
    python pipeline/summarize.py --dry-run --limit 5

    # Spot-check: summarize the first 25 unsummarized rows of Reg 7.
    python pipeline/summarize.py --reg 7 --limit 25

    # Full run, every regulation, resumable (already-summarized rows are
    # skipped automatically).
    python pipeline/summarize.py

    # Regenerate every summary in Reg 3 from scratch.
    python pipeline/summarize.py --reg 3 --force

Required environment variables (all three, unless --dry-run — see below):
    ANTHROPIC_API_KEY
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

--dry-run still needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (it reads
real rows to print real prompts/estimates) but never needs, and never
requires, ANTHROPIC_API_KEY — no Anthropic call is made in dry-run mode.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

PIPELINE_DIR = Path(__file__).resolve().parent
FAILED_LOG_PATH = PIPELINE_DIR / "failed.jsonl"

DB_PAGE_SIZE = 200          # rows fetched per Supabase page while scanning candidates
META_PAGE_SIZE = 1000       # rows fetched per page when building the id->citation/parent map
MIN_WORDS = 25              # tag-stripped word count below this = headings-only, skip
MAX_PROMPT_WORDS = 6000     # cap on the provision's own text included in the prompt
PARENT_TEXT_CHARS = 400     # chars of the immediate parent paragraph shown for scoping
MAX_TOKENS = 400
TEMPERATURE = 0
DEFAULT_MODEL = "claude-sonnet-4-5"
BATCH_MAX_REQUESTS = 1000   # Anthropic Message Batches API limit per batch
POLL_INTERVAL_SECONDS = 20
MAX_POLL_SECONDS = 6 * 60 * 60  # matches the workflow's 6h job timeout

# Published per-million-token USD rates (standard, non-batch pricing).
# The Message Batches API is 50% off both numbers -- applied in estimate_cost().
# Update this table if Anthropic changes pricing or you pass a new --model.
MODEL_RATES = {
    "claude-sonnet-4-5": {"in": 3.00, "out": 15.00},
    "claude-sonnet-4-5-20250929": {"in": 3.00, "out": 15.00},
    "claude-sonnet-4-20250514": {"in": 3.00, "out": 15.00},
    "claude-3-7-sonnet-20250219": {"in": 3.00, "out": 15.00},
    "claude-haiku-4-5": {"in": 1.00, "out": 5.00},
    "claude-haiku-4-5-20251001": {"in": 1.00, "out": 5.00},
    "claude-3-5-haiku-20241022": {"in": 0.80, "out": 4.00},
}
FALLBACK_RATE = {"in": 3.00, "out": 15.00}

TAG_RE = re.compile(r"<[^>]+>")
NBSP_RE = re.compile(r"&nbsp;")
WS_RE = re.compile(r"\s+")

SYSTEM_PROMPT = (
    "You are explaining a legal/regulatory provision to an EHS or compliance "
    "person at a Colorado oil & gas operator who is NOT a lawyer and does "
    "not want to wade through legal language. Write 2-5 short sentences in "
    "plain, everyday English, the way you'd explain it out loud to a "
    "coworker: who it applies to, what it requires or prohibits, and any "
    "key thresholds, dates, or numbers. Avoid legal jargon and formal "
    "throat-clearing like 'this provision' or 'this is a definitional "
    "provision' -- just say what it means. Spell out an acronym the first "
    "time you use it, but ONLY expand an acronym the way this regulation "
    "itself defines it -- never from general knowledge or what the acronym "
    "usually means elsewhere. Two you will see often in this regulation: "
    "MFCE means midstream fuel combustion equipment; AIMM means approved "
    "instrument monitoring method. \"The Division\" means the Colorado Air "
    "Pollution Control Division (part of CDPHE), not any other agency (e.g. "
    "not COGCC) unless the text itself says otherwise.\n\n"
    "Never state a date, deadline, number, threshold, percentage, or "
    "geographic qualifier (e.g. a specific county) that is not literally "
    "present in the text given to you -- not from context, not from what "
    "the rest of the regulation usually says, not from general knowledge of "
    "this regulation. If the text says a duty or deadline continues "
    "'thereafter' or similar open-ended language, say that -- do not invent "
    "an end date. Never assert a cross-reference, exception, or \"state-only\" "
    "designation that is not explicitly stated in the text.\n\n"
    "If the text you are given appears to start mid-sentence or mid-clause "
    "(e.g. it opens with a lowercase word, a dangling clause, or a fragment "
    "that doesn't stand alone), do not guess at what the missing opening "
    "words might be from context or general knowledge. Say plainly that the "
    "provision's beginning (e.g. its applicability or effective-date clause) "
    "is not shown in the available text, and summarize only what is "
    "actually present.\n\n"
    "Scope the summary by the paragraph's OWN words plus its immediate "
    "parent paragraph -- nothing wider. Never carry an equipment list, an "
    "applicability date, or a scope qualifier down from the section heading "
    "or the subpart title into a sub-paragraph. For example, a paragraph "
    "under \"(c) storage vessel affected facilities\" is about storage "
    "vessels only, even when the section heading above it also lists "
    "compressors and pumps. The \"Under:\" lines and \"Parent paragraph "
    "text:\" are there to tell you what this paragraph hangs off of, not to "
    "be folded into it.\n\n"
    "In federal CFR text (40 CFR parts, e.g. the OOOO subparts), the body "
    "that approves, receives, or is notified is \"the Administrator\" (the "
    "EPA Administrator) unless the text itself names someone else. Never "
    "write \"the Division\" in a federal CFR summary -- that term belongs to "
    "the Colorado regulations -- and never mention Colorado, CDPHE, or any "
    "state or state agency unless the text you were given mentions it.\n\n"
    "Do not invent illustrative examples for a defined term -- if the text "
    "defines something without examples, don't supply your own. Do not "
    "expand an acronym unless the text in front of you expands it; leave "
    "CEDRI, subpart letters, and anything else the text only abbreviates "
    "exactly as written.\n\n"
    "eCFR equations are images and do not survive text extraction, so a "
    "provision may say something like \"calculated as follows:\" and then "
    "list only the variable definitions with no formula. When that happens, "
    "say the equation itself is not shown in the available text and "
    "describe only what the variables represent -- never reconstruct or "
    "recite an equation that isn't there.\n\n"
    "Never add requirements that are not in the text. If a section is "
    "purely a definition or administrative detail, say that plainly in one "
    "sentence. No preamble, no markdown, no bullet lists -- output only the "
    "summary."
)


# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------

def strip_html(html: str) -> str:
    """Tag-stripped plain text, mirroring src/lib/regulation.ts's stripHtml
    (minus the truncation -- callers here need the full text to count and
    cap words themselves)."""
    text = TAG_RE.sub(" ", html or "")
    text = NBSP_RE.sub(" ", text)
    text = WS_RE.sub(" ", text).strip()
    return text


def kind_of(provision_id: str) -> str:
    """Mirrors kindOf() in src/lib/regulation.ts -- provision "kind" is
    encoded in the id, there is no separate column."""
    if "-top-REG-" in provision_id:
        return "reg"
    if "-PART-" in provision_id:
        return "part"
    if "-APPENDIX-" in provision_id:
        return "appendix"
    return "item"


# --------------------------------------------------------------------------
# Supabase access
# --------------------------------------------------------------------------

def make_supabase_client():
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def fetch_meta(client, reg: Optional[str]) -> dict[str, dict]:
    """Fetches id/parent_id/citation/title/full_text for every provision in
    scope, to build the regulation-root + parent-chain context for prompts.
    Scoped to one regulation's id prefix when --reg is given; otherwise the
    whole table, paginated past PostgREST's row cap.

    full_text is included so build_prompt can show the immediate parent
    paragraph's opening words -- a sub-paragraph like "(1) ..." often only
    makes sense against its parent's scoping clause, and without it the
    model tends to reach further up to the section heading and pull in
    equipment or dates that don't apply."""
    meta: dict[str, dict] = {}
    like_prefix = f"sec-{reg.lower()}-" if reg else None
    start = 0
    while True:
        q = client.table("provisions").select("id, parent_id, citation, title, full_text")
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        q = q.order("sort_order").range(start, start + META_PAGE_SIZE - 1)
        rows = q.execute().data or []
        for row in rows:
            meta[row["id"]] = row
        if len(rows) < META_PAGE_SIZE:
            break
        start += META_PAGE_SIZE
    return meta


def load_ids_file(path: str) -> list[str]:
    """Reads a --ids-file: one provision id per line, blank lines and lines
    starting with '#' ignored. Order is preserved (deduplicated, first
    occurrence wins) -- this is what pipeline/import_ccr.py apply's
    summary_regen_ids.txt looks like. Feeds the exact same iter_candidates
    ids= code path as --ids."""
    ids: list[str] = []
    seen: set[str] = set()
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s not in seen:
            seen.add(s)
            ids.append(s)
    return ids


def iter_candidates(client, reg: Optional[str], force: bool, limit: Optional[int],
                     ids: Optional[list[str]] = None):
    """Yields full candidate rows (id, citation, title, parent_id, full_text,
    sort_order), ordered by sort_order, paginated DB_PAGE_SIZE at a time,
    stopping once --limit rows have been yielded.

    When `ids` is given, this targets exactly those provision ids (e.g. a
    specific list of rows flagged by a review pass) -- ignores --reg and the
    "ai_summary IS NULL" gate entirely, since asking for a row by id is
    itself the intent to regenerate it regardless of --force."""
    if ids:
        rows_by_id: dict[str, dict] = {}
        for chunk_start in range(0, len(ids), DB_PAGE_SIZE):
            chunk = ids[chunk_start:chunk_start + DB_PAGE_SIZE]
            q = (client.table("provisions")
                 .select("id, citation, title, parent_id, full_text, sort_order")
                 .in_("id", chunk))
            for row in q.execute().data or []:
                rows_by_id[row["id"]] = row
        missing = [i for i in ids if i not in rows_by_id]
        if missing:
            print(f"  WARNING: {len(missing)} id(s) from --ids not found in the "
                  f"database: {', '.join(missing)}", file=sys.stderr)
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
    columns = "id, citation, title, parent_id, full_text, sort_order"
    while True:
        q = client.table("provisions").select(columns)
        if like_prefix:
            q = q.like("id", f"{like_prefix}%")
        if not force:
            q = q.is_("ai_summary", "null")
        q = q.order("sort_order").range(start, start + DB_PAGE_SIZE - 1)
        rows = q.execute().data or []
        for row in rows:
            yield row
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        if len(rows) < DB_PAGE_SIZE:
            return
        start += DB_PAGE_SIZE


def write_summary(client, provision_id: str, summary: str, model: str) -> None:
    client.table("provisions").update(
        {
            "ai_summary": summary,
            "summary_model": model,
            "summary_generated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", provision_id).execute()


def clear_summary_as_too_short(client, provision_id: str) -> None:
    """Headings-only rows: ensure ai_summary (and its provenance columns)
    are NULL rather than leaving a stale placeholder from a previous
    --force run of a since-shortened row."""
    client.table("provisions").update(
        {"ai_summary": None, "summary_model": None, "summary_generated_at": None}
    ).eq("id", provision_id).execute()


# --------------------------------------------------------------------------
# Prompt building
# --------------------------------------------------------------------------

@dataclass
class PromptResult:
    prompt: str
    body_word_count: int          # tag-stripped word count of the provision's own text
    prompt_word_count: int        # words actually included in the prompt (post-cap)
    truncated: bool


def build_context(provision: dict, meta: dict[str, dict]) -> tuple[Optional[dict], list[dict]]:
    """Walks parent_id from `provision` up to the regulation root. Returns
    (root, chain) where root is the id-'-top-REG-' ancestor (citation +
    title shown once, up front) and chain is the ancestors in between --
    typically the Part/Appendix and any nested items -- in top-down order,
    per the spec's "regulation root ... + the parent chain's citations/
    titles (walk parent_id up to the part)"."""
    root: Optional[dict] = None
    chain: list[dict] = []
    seen: set[str] = set()
    current = provision.get("parent_id")
    while current and current not in seen:
        seen.add(current)
        node = meta.get(current)
        if not node:
            break
        if kind_of(current) == "reg":
            root = node
            break
        chain.append(node)
        current = node.get("parent_id")
    chain.reverse()
    return root, chain


def build_prompt(provision: dict, meta: dict[str, dict]) -> PromptResult:
    root, chain = build_context(provision, meta)
    stripped = strip_html(provision["full_text"])
    words = stripped.split()
    body_word_count = len(words)
    truncated = body_word_count > MAX_PROMPT_WORDS
    used_words = words[:MAX_PROMPT_WORDS] if truncated else words
    body_text = " ".join(used_words)

    lines: list[str] = []
    if root:
        lines.append(f"Regulation: {root['citation']} — {root['title']}")
    for node in chain:
        lines.append(f"Under: {node['citation']} — {node['title']}")
    lines.append(f"Provision: {provision['citation']} — {provision['title']}")

    # The immediate parent's opening words, so the model can scope this
    # paragraph against what it actually hangs off of rather than reaching
    # up to the section heading. Only the nearest ancestor below the
    # regulation root -- the root's own text is a document title, and its
    # citation/title already appear on the "Regulation:" line above.
    parent_excerpt = ""
    if chain:
        parent_stripped = strip_html(chain[-1].get("full_text") or "")
        if parent_stripped:
            parent_excerpt = parent_stripped[:PARENT_TEXT_CHARS]
            if len(parent_stripped) > PARENT_TEXT_CHARS:
                parent_excerpt += "…"
    if parent_excerpt:
        lines.append("")
        lines.append(f"Parent paragraph text ({chain[-1]['citation']}):")
        lines.append(parent_excerpt)

    lines.append("")
    lines.append("Provision text:")
    lines.append(body_text)
    if truncated:
        lines.append(
            f"\n[Note: provision text truncated to the first "
            f"{MAX_PROMPT_WORDS:,} of {body_word_count:,} words.]"
        )

    return PromptResult(
        prompt="\n".join(lines),
        body_word_count=body_word_count,
        prompt_word_count=len(used_words),
        truncated=truncated,
    )


# --------------------------------------------------------------------------
# Cost estimation
# --------------------------------------------------------------------------

def rate_for(model: str) -> dict:
    return MODEL_RATES.get(model, FALLBACK_RATE)


def estimate_cost(model: str, input_tokens: int, output_tokens: int, batch: bool) -> float:
    rates = rate_for(model)
    discount = 0.5 if batch else 1.0
    cost = (input_tokens / 1_000_000) * rates["in"] * discount
    cost += (output_tokens / 1_000_000) * rates["out"] * discount
    return cost


# --------------------------------------------------------------------------
# Run stats + reporting
# --------------------------------------------------------------------------

@dataclass
class RunStats:
    processed: int = 0
    skipped_short: int = 0
    failed: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    batches_submitted: int = 0

    def add_usage(self, usage) -> None:
        self.input_tokens += getattr(usage, "input_tokens", 0) or 0
        self.output_tokens += getattr(usage, "output_tokens", 0) or 0


def print_report(stats: RunStats, model: str, batch: bool, dry_run: bool) -> None:
    cost = estimate_cost(model, stats.input_tokens, stats.output_tokens, batch=batch)
    mode = "DRY RUN (estimated, no API calls made)" if dry_run else (
        "batch" if batch else "sync"
    )
    print("\n" + "=" * 60)
    print(f"Summary generation run -- model={model} mode={mode}")
    print("=" * 60)
    print(f"{'Rows processed (summarized)':38}{stats.processed:>12,}")
    print(f"{'Rows skipped (headings-only, <'+str(MIN_WORDS)+' words)':38}{stats.skipped_short:>12,}")
    print(f"{'Rows failed':38}{stats.failed:>12,}")
    print(f"{'Input tokens':38}{stats.input_tokens:>12,}")
    print(f"{'Output tokens':38}{stats.output_tokens:>12,}")
    print(f"{'Estimated cost (USD)':38}{'$' + format(cost, ',.4f'):>12}")
    print("=" * 60)
    if stats.batches_submitted:
        print(f"Batches submitted: {stats.batches_submitted}")
    if stats.failed:
        print(f"Failures logged to {FAILED_LOG_PATH} -- they will be retried "
              f"automatically on the next run (rows without --force are always "
              f"re-selected while ai_summary is still NULL).")


def log_failure(custom_id: str, reason: str) -> None:
    FAILED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with FAILED_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "id": custom_id,
            "reason": reason,
            "at": datetime.now(timezone.utc).isoformat(),
        }) + "\n")


# --------------------------------------------------------------------------
# Anthropic calls
# --------------------------------------------------------------------------

def run_sync(client_anthropic, client_supabase, rows: list[dict], meta: dict, model: str,
             stats: RunStats, dry_run: bool) -> None:
    for provision in rows:
        result = build_prompt(provision, meta)
        if result.body_word_count < MIN_WORDS:
            stats.skipped_short += 1
            if not dry_run:
                clear_summary_as_too_short(client_supabase, provision["id"])
            continue

        if dry_run:
            print(f"--- {provision['id']} ({provision['citation']}) ---")
            print(result.prompt[:2000])
            print(f"[prompt words: {result.prompt_word_count}"
                  f"{' (truncated from ' + str(result.body_word_count) + ')' if result.truncated else ''}]\n")
            est_in = int(result.prompt_word_count * 1.35) + 250
            stats.input_tokens += est_in
            stats.output_tokens += 120
            stats.processed += 1
            continue

        try:
            message = client_anthropic.messages.create(
                model=model,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": result.prompt}],
            )
        except Exception as exc:  # noqa: BLE001 -- log and keep going
            stats.failed += 1
            log_failure(provision["id"], str(exc))
            continue

        summary_text = "".join(
            block.text for block in message.content if getattr(block, "type", None) == "text"
        ).strip()
        stats.add_usage(message.usage)
        if not summary_text:
            stats.failed += 1
            log_failure(provision["id"], "empty response")
            continue

        write_summary(client_supabase, provision["id"], summary_text, model)
        stats.processed += 1


CUSTOM_ID_INVALID_RE = re.compile(r"[^a-zA-Z0-9_-]")
CUSTOM_ID_MAX_LEN = 64


def make_custom_id(provision_id: str, used: dict[str, str]) -> str:
    """Build an Anthropic Batches API-safe custom_id for provision_id.

    custom_id must match ^[a-zA-Z0-9_-]{1,64}$, but provision ids can
    contain other characters -- e.g. citation ids like
    'sec-7-B-I-C-1-e-(i)' contain parentheses -- and can exceed 64 chars
    (e.g. 'sec-7-B-III-C-4-c-(ii)-(A)-(1)'). Confirmed against the live
    corpus, 859 ids across all regs contain disallowed characters. This
    sanitizes the id and, when the sanitized form is too long or collides
    with a *different* provision id already placed in `used`, truncates it
    and appends a short content hash of the original id to keep it unique.

    `used` maps custom_id -> provision_id and is mutated in place so the
    caller can look the original provision id back up when reading batch
    results (never write a summary under the sanitized id itself).
    """
    sanitized = CUSTOM_ID_INVALID_RE.sub("_", provision_id) or "_"
    candidate = sanitized

    def collides(cid: str) -> bool:
        return cid in used and used[cid] != provision_id

    if len(candidate) > CUSTOM_ID_MAX_LEN or collides(candidate):
        suffix = "_" + hashlib.sha1(provision_id.encode("utf-8")).hexdigest()[:8]
        candidate = sanitized[:CUSTOM_ID_MAX_LEN - len(suffix)] + suffix
        # Vanishingly unlikely, but keep colliding even after the hash
        # (e.g. two different provision ids happen to share the same
        # truncated-prefix + hash) deterministically unique too.
        n = 0
        base = candidate
        while collides(candidate):
            n += 1
            extra = f"_{n}"
            candidate = base[:CUSTOM_ID_MAX_LEN - len(extra)] + extra

    used[candidate] = provision_id
    return candidate


def run_batch(client_anthropic, client_supabase, rows: list[dict], meta: dict, model: str,
              stats: RunStats, poll_interval: int) -> None:
    """Batch mode is only ever invoked for real runs (main() routes --dry-run
    and --sync through run_sync instead), so every row here either gets
    submitted to the Anthropic Batches API or is skipped as headings-only
    and cleared in the database."""
    batch_requests = []
    # custom_id (Batches API, ^[a-zA-Z0-9_-]{1,64}$) -> real provision id.
    # Provision ids can contain parentheses (e.g. citation-derived ids like
    # 'sec-7-B-I-C-1-e-(i)') and can exceed 64 chars, so the custom_id sent
    # to Anthropic is a sanitized/possibly-hashed stand-in -- always map
    # back through this dict before writing a summary or logging a failure.
    custom_id_map: dict[str, str] = {}

    for provision in rows:
        result = build_prompt(provision, meta)
        if result.body_word_count < MIN_WORDS:
            stats.skipped_short += 1
            clear_summary_as_too_short(client_supabase, provision["id"])
            continue
        custom_id = make_custom_id(provision["id"], custom_id_map)
        batch_requests.append({
            "custom_id": custom_id,
            "params": {
                "model": model,
                "max_tokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": result.prompt}],
            },
        })

    if not batch_requests:
        return

    for chunk_start in range(0, len(batch_requests), BATCH_MAX_REQUESTS):
        chunk = batch_requests[chunk_start:chunk_start + BATCH_MAX_REQUESTS]
        print(f"Submitting batch of {len(chunk)} requests "
              f"({chunk_start + 1}-{chunk_start + len(chunk)} of {len(batch_requests)})...")
        batch = client_anthropic.messages.batches.create(requests=chunk)
        stats.batches_submitted += 1
        print(f"  batch id: {batch.id} -- polling every {poll_interval}s "
              f"(processing_status starts as '{batch.processing_status}')")

        deadline = time.monotonic() + MAX_POLL_SECONDS
        while True:
            batch = client_anthropic.messages.batches.retrieve(batch.id)
            if batch.processing_status == "ended":
                break
            if time.monotonic() > deadline:
                print(f"  WARNING: batch {batch.id} did not finish within "
                      f"{MAX_POLL_SECONDS}s -- leaving remaining rows for next run.")
                for req in chunk:
                    provision_id = custom_id_map.get(req["custom_id"], req["custom_id"])
                    log_failure(provision_id, "batch poll timeout")
                    stats.failed += 1
                break
            time.sleep(poll_interval)

        if batch.processing_status != "ended":
            continue

        counts = batch.request_counts
        print(f"  done: succeeded={counts.succeeded} errored={counts.errored} "
              f"canceled={counts.canceled} expired={counts.expired}")

        for item in client_anthropic.messages.batches.results(batch.id):
            custom_id = item.custom_id
            # Always resolve back to the real provision id -- never write a
            # summary (or log a failure) under the sanitized custom_id.
            provision_id = custom_id_map.get(custom_id, custom_id)
            result = item.result
            if result.type == "succeeded":
                message = result.message
                summary_text = "".join(
                    block.text for block in message.content
                    if getattr(block, "type", None) == "text"
                ).strip()
                stats.add_usage(message.usage)
                if not summary_text:
                    stats.failed += 1
                    log_failure(provision_id, "empty response")
                    continue
                write_summary(client_supabase, provision_id, summary_text, model)
                stats.processed += 1
            else:
                stats.failed += 1
                error_detail = getattr(getattr(result, "error", None), "message", result.type)
                log_failure(provision_id, f"{result.type}: {error_detail}")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate plain-English AI summaries for essentialregs.com provisions.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--reg", default=None,
        help="Limit to one regulation's id prefix, e.g. 7, 3, 26, oooob. "
             "Omit to run against every regulation. Ignored if --ids-file is given.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Stop after this many candidate rows (for test runs). Ignored if --ids-file is given.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regenerate summaries even for rows that already have one "
             "(default: only rows where ai_summary IS NULL). Not needed "
             "alongside --ids, which always regenerates the listed rows.",
    )
    parser.add_argument(
        "--ids", default=None,
        help="Comma-separated list of exact provision ids to regenerate "
             "(e.g. from a review report flagging specific rows). Ignores "
             "the ai_summary IS NULL gate -- every listed id is always "
             "processed, --force is not needed. Also pass --reg so the "
             "parent/citation metadata lookup is scoped to that regulation "
             "rather than the whole corpus.",
    )
    parser.add_argument(
        "--ids-file", default=None,
        help="Path to a text file of provision ids, one per line (as produced by "
             "pipeline/import_ccr.py apply's summary_regen_ids.txt) -- summarize "
             "exactly this set, in file order, via the same code path as --ids. "
             "Blank lines and lines starting with '#' are ignored. Mutually "
             "exclusive with --reg, --limit, and --ids. Normally combined with "
             "--force so a `changed` row's stale summary is actually regenerated "
             "(--force is not required, though, since --ids-file rows ignore the "
             "ai_summary IS NULL gate just like --ids).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Build and print prompts + token/cost estimates for every "
             "candidate row. Never calls the Anthropic API and never writes "
             "to the database. Still reads Supabase to select real rows.",
    )
    parser.add_argument(
        "--sync", action="store_true",
        help="Use single synchronous Messages API calls instead of the "
             "Message Batches API. Simpler for small test runs; costs 2x "
             "the batch price.",
    )
    parser.add_argument(
        "--model", default=DEFAULT_MODEL,
        help="Anthropic model id to use.",
    )
    parser.add_argument(
        "--poll-interval", type=int, default=POLL_INTERVAL_SECONDS,
        help="Seconds between batch status polls (batch mode only).",
    )
    return parser.parse_args(argv)


def require_env(names: list[str]) -> None:
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        print(f"Missing required environment variable(s): {', '.join(missing)}",
              file=sys.stderr)
        sys.exit(1)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)

    if args.ids_file and (args.reg or args.limit is not None or args.ids):
        print("--ids-file is mutually exclusive with --reg, --limit, and --ids.",
              file=sys.stderr)
        return 1

    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    if not args.dry_run:
        required.append("ANTHROPIC_API_KEY")
    require_env(required)

    client_supabase = make_supabase_client()
    client_anthropic = None
    if not args.dry_run:
        import anthropic
        client_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Fresh failed.jsonl per run so the workflow artifact reflects only this
    # run's failures; a row that failed is naturally retried on the next run
    # because it's still selected by "ai_summary IS NULL" (unless --force).
    if not args.dry_run and FAILED_LOG_PATH.exists():
        FAILED_LOG_PATH.unlink()

    # --ids-file may span more than one regulation in principle, so build
    # context metadata across the whole table (cheap -- see fetch_meta)
    # rather than scoping to a single --reg prefix.
    meta_reg = None if args.ids_file else args.reg

    print(f"Fetching parent/citation metadata"
          f"{f' for reg {meta_reg}' if meta_reg else ' (all regulations)'}...")
    meta = fetch_meta(client_supabase, meta_reg)
    print(f"  {len(meta):,} rows loaded for context lookups.")

    if args.ids_file:
        ids = load_ids_file(args.ids_file)
    elif args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
    else:
        ids = None

    print("Fetching candidate rows"
          f"{f' ({len(ids)} explicit id(s))' if ids else ''}"
          f"{f' (limit {args.limit})' if args.limit and not ids else ''}"
          f"{' [force: regenerating existing summaries too]' if args.force and not ids else ''}...")
    rows = list(iter_candidates(client_supabase, args.reg, args.force, args.limit, ids=ids))
    print(f"  {len(rows):,} candidate rows.")

    if not rows:
        print("Nothing to do.")
        return 0

    stats = RunStats()
    if args.sync or args.dry_run:
        run_sync(client_anthropic, client_supabase, rows, meta, args.model, stats, args.dry_run)
    else:
        run_batch(client_anthropic, client_supabase, rows, meta, args.model, stats,
                   args.poll_interval)

    print_report(stats, args.model, batch=not (args.sync or args.dry_run), dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
