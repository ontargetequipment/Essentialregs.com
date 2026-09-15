#!/usr/bin/env python3
"""
CCR importer for essentialregs.com.

Parses an official Colorado Code of Regulations PDF (AQCC regs such as
Reg 3, 7, 26) into the `provisions` rows this app uses, with the same id
scheme, hierarchy, sort order and HTML conventions as the existing DB rows.
See pipeline/IMPORTER_SPEC.md for the full spec this implements.

Subcommands:
    export  --reg 7 --out pipeline/out/reg7_db.json
            Read-only Supabase SELECT of a regulation's current provisions
            rows (id LIKE 'sec-<reg>-%'), for use as `diff`/`apply`'s --db
            input. Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
    parse   pipeline/sources/REG_7.pdf --reg 7 --out pipeline/out/reg7_parsed.json
    diff    --reg 7 --parsed pipeline/out/reg7_parsed.json --db pipeline/out/reg7_db.json
            --out pipeline/out/reg7_diff_report.md
    apply   --reg 7 --parsed ... --db ... --out-dir pipeline/out/apply_reg7
            Builds plan.json/stats.md/hand-reviewable SQL files (default; no
            DB writes). With --execute --yes, also performs the same plan
            directly against Supabase via supabase-py — see
            cmd_apply_execute() and pipeline/README.md's "The --execute
            path (GitHub Actions)".

Except for `export` and `apply --execute --yes`, this script makes NO
database writes — `diff`/`parse`/plain `apply` only read local files (and,
for `apply`, a reg{N}_db.json produced by `export` or a read-only Supabase
SELECT — see pipeline/IMPORTER_SPEC.md item 2).
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

FF = "\x0c"  # form-feed: pdftotext -layout emits exactly one per PDF page

# --------------------------------------------------------------------------
# Roman numerals
# --------------------------------------------------------------------------

_ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
_ROMAN_TABLE = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
    (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
]


def roman_to_int(s: str) -> int:
    total, prev = 0, 0
    for ch in reversed(s):
        v = _ROMAN_VALUES[ch]
        if v < prev:
            total -= v
        else:
            total += v
            prev = v
    return total


def int_to_roman(n: int) -> str:
    res = []
    for v, sym in _ROMAN_TABLE:
        while n >= v:
            res.append(sym)
            n -= v
    return "".join(res)


def is_valid_roman(s: str) -> bool:
    """True only for a canonical roman numeral (rejects e.g. 'IIII', 'VX')."""
    if not s or any(c not in _ROMAN_VALUES for c in s):
        return False
    n = roman_to_int(s)
    return n > 0 and int_to_roman(n) == s


# --------------------------------------------------------------------------
# Label tokenizing: each provision label is printed in the source as the
# FULL compound citation every time (e.g. "I.J.1.a." not just "a."), so we
# tokenize depth-by-depth against a fixed family cycle rather than trying to
# classify a token in isolation (a bare "I." is ambiguous between roman-numeral
# and upper-letter without knowing which depth we're attempting).
# --------------------------------------------------------------------------

FAMILY_REGEX = {
    "roman": re.compile(r"^([IVXLCDM]+)\."),
    "upper": re.compile(r"^([A-Z]{1,2})\."),
    "digit": re.compile(r"^(\d{1,3})\."),
    "lower": re.compile(r"^([a-z]{1,2})\."),
    "paren_roman": re.compile(r"^\(([ivxlcdm]+)\)"),
    "paren_upper": re.compile(r"^\(([A-Z]{1,2})\)"),
    "paren_digit": re.compile(r"^\((\d{1,3})\)"),
}

# Part A / Part B nesting cycle (see IMPORTER_SPEC.md "Existing id scheme").
CYCLE_AB = ["roman", "upper", "digit", "lower", "paren_roman", "paren_upper", "paren_digit"]
# Under a Part C dated statement-of-basis entry, sub-items are printed as
# bare numbers ("1.", "2." with NO "B." prefix) rather than full compound
# paths — see the diff report for why Part C's *existing* DB ids look the
# way they do.
CYCLE_C_INNER = ["digit", "lower", "paren_roman", "paren_upper", "paren_digit"]


def tokenize_by_cycle(text: str, cycle: list[str]) -> tuple[list[tuple[str, str]], int]:
    """Greedily consume tokens at the START of `text` following `cycle`,
    depth by depth. Returns (tokens, chars_consumed). tokens is a list of
    (family, raw) pairs; raw excludes surrounding parens/dot."""
    tokens: list[tuple[str, str]] = []
    pos = 0
    for fam in cycle:
        rx = FAMILY_REGEX[fam]
        m = rx.match(text[pos:])
        if not m:
            break
        raw = m.group(1)
        if fam == "roman" and not is_valid_roman(raw):
            break
        if fam == "paren_roman" and not is_valid_roman(raw.upper()):
            break
        tokens.append((fam, raw))
        pos += m.end()
    return tokens, pos


def token_display(fam: str, raw: str) -> str:
    if fam.startswith("paren_"):
        return f"({raw})"
    return raw


def tokens_to_citation(tokens: list[tuple[str, str]]) -> str:
    return "".join(f"{token_display(f, r)}." for f, r in tokens)


def tokens_to_id_suffix(tokens: list[tuple[str, str]]) -> str:
    return "-".join(token_display(f, r) for f, r in tokens)


# Part C top level: a strict alphabetic sequence A, B, ..., Z, AA, BB, ..., ZZ
# (doubled letters, NOT AA/AB/AC...) — confirmed against the actual amendment
# dates printed in the PDF (A. 1995 ... HH. 2026, II. 2026).
def part_c_letter_sequence():
    for i in range(26):
        yield chr(ord("A") + i)
    for i in range(26):
        yield chr(ord("A") + i) * 2


PART_C_LETTERS = list(part_c_letter_sequence())

DATE_START_RE = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2}(-\d{1,2})?(,|\s*[-–]\s*\d{1,2},)?\s+\d{4}\b"
)


# --------------------------------------------------------------------------
# Page-furniture stripping (form-feed-delimited pages)
# --------------------------------------------------------------------------

_HEADER_RE = re.compile(r"^CODE OF COLORADO REGULATIONS\b")
_FOOTER_BODY_RE = re.compile(r"^Air Quality Control Commission\s*$")
_PAGENUM_RE = re.compile(r"^\d{1,4}$")
_DIVIDER_RE = re.compile(r"^_{5,}$")


def clean_pages(raw_text: str) -> tuple[list[str], set[int]]:
    """Split on form-feed (one per PDF page) and strip the running header/
    footer + bare page-number furniture from the top/bottom of each page,
    then splice pages back together with NO inserted blank line at the seam
    — this is what fixes the "must be installed and operating by 45 CODE OF
    COLORADO REGULATIONS..." truncation-at-page-break bug: the text that
    shared a line with a label, or continued across a page break, is no
    longer dropped or has furniture spliced into it.

    Also returns `seam_starts`: the index (into the returned line list) of
    the first surviving line of every page after the first. A line at one of
    these indices has, as its immediate predecessor in the final list, the
    last surviving line of the PREVIOUS page — a pairing manufactured by this
    splice, not a real adjacency in the source, so a candidate label there
    can look mid-sentence (its "previous line" dangling with no terminal
    punctuation) purely because of where the page happened to break, not
    because it's actually a wrapped continuation (see the continuation-line
    guard in `scan_markers` / `_marker_column_signals`, and the "page-seam"
    entries in the diff report's marker audit for confirmed examples)."""
    pages = raw_text.split(FF)
    out: list[str] = []
    seam_starts: set[int] = set()
    for page_idx, page in enumerate(pages):
        lines = page.split("\n")
        i = 0
        while i < len(lines):
            s = lines[i].strip()
            if s == "" or _HEADER_RE.match(s) or _FOOTER_BODY_RE.match(s):
                i += 1
                continue
            break
        lines = lines[i:]
        j = len(lines)
        while j > 0:
            s = lines[j - 1].strip()
            if s == "" or _PAGENUM_RE.match(s) or _DIVIDER_RE.match(s):
                j -= 1
                continue
            break
        lines = lines[:j]
        if page_idx > 0 and lines:
            seam_starts.add(len(out))
        out.extend(lines)
    return out, seam_starts


# --------------------------------------------------------------------------
# HTML escaping — full_text is rendered client-side with
# dangerouslySetInnerHTML (see src/lib/regulation.ts), so any literal
# '&', '<' or '>' in the source regulatory text must be entity-escaped
# before it lands in full_text, or it corrupts (or is silently swallowed
# by) the HTML parser downstream. Confirmed against the live Reg 7 corpus:
# 'flow rate of < 60 grams/hour...' loses everything after the '<', table
# cells containing '> 2 and < 12' break the same way, and URLs embedded in
# text contain bare '&'. Quotes are intentionally left alone — only the
# three characters that are structurally significant to an HTML parser are
# escaped here.
#
# This must run on plain text BEFORE cross-reference <span>/<a> markup is
# inserted (escaping afterward would mangle that markup's own '<'/'>'/'&');
# escaping first is safe because the citation patterns link_citations()
# matches are plain alphanumeric/punctuation ("Section 7.II.B.1.", "Part
# A", etc.) and never contain '&', '<' or '>' themselves, so escaping
# cannot create or destroy a citation match.
# --------------------------------------------------------------------------

def escape_html_text(text: str) -> str:
    """Entity-escapes '&', '<', '>' (in that order, so '&' in the source
    isn't re-escaped by the '<'/'>' replacements) in a plain-text node
    destined for full_text HTML. Never escapes quotes."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# --------------------------------------------------------------------------
# Table extraction (pdfplumber) — reusable for any "Table N – caption" block,
# not just the two the spec calls out as known-garbled in the current DB.
# --------------------------------------------------------------------------

TABLE_CAPTION_RE = re.compile(r"^Table\s+(\d+)\s*[–-]\s*(.+)$")


def extract_tables_from_pdf(pdf_path: str) -> dict[str, dict]:
    """Returns {caption_text: {"n": table_num, "caption": caption, "rows": [[...]]}}."""
    import pdfplumber

    out: dict[str, dict] = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            caption = None
            for line in text.split("\n"):
                m = TABLE_CAPTION_RE.match(line.strip())
                if m:
                    caption = line.strip()
                    break
            if not caption:
                continue
            tables = page.extract_tables()
            if not tables:
                continue
            # Pick the table whose first cell matches the caption line, else the first table.
            chosen = None
            for t in tables:
                if t and t[0] and t[0][0] and t[0][0].strip().startswith("Table"):
                    chosen = t
                    break
            if chosen is None:
                chosen = tables[0]
            rows = chosen
            # Drop a leading row that's just the caption repeated as a merged cell.
            if rows and rows[0] and rows[0][0] and rows[0][0].strip() == caption:
                rows = rows[1:]
            out[caption] = {"caption": caption, "rows": rows}
    return out


def render_table_html(table: dict) -> str:
    caption = escape_html_text(table["caption"])
    rows = table["rows"]
    if not rows:
        return ""
    header, body_rows = rows[0], rows[1:]

    def cell(c):
        c = (c or "").replace("\n", " ").strip()
        return escape_html_text(c)

    thead = "<tr>" + "".join(f"<th>{cell(c)}</th>" for c in header) + "</tr>"
    tbody = "".join(
        "<tr>" + "".join(f"<td>{cell(c)}</td>" for c in row) + "</tr>" for row in body_rows
    )
    return (
        '<div class="doc-table-wrap">'
        f'<div class="doc-table-caption">{caption}</div>'
        f'<table class="doc-table"><thead>{thead}</thead><tbody>{tbody}</tbody></table>'
        "</div>"
    )


# --------------------------------------------------------------------------
# Cross-reference linking — reusable across regulations.
#
# Resolution is PART-AWARE: a bare "Section X.Y." citation only carries a
# roman-numeral top level, and both Part A and Part B start numbering their
# sections at "I." again, so the id it targets depends on which part the
# citation is either explicitly scoped to ("Part B, Section I.E.") or, when
# no part is named, which part encloses the provision doing the citing (see
# `_default_parts_order`). See pipeline/IMPORTER_SPEC.md and the "Cross-
# reference linking" section of the diff report for the full rationale.
# --------------------------------------------------------------------------

CORPUS_REGS = {"3": "3", "7": "7", "26": "26", "oooob": "oooob"}

# Bucket names used for citation/reference text we recognized as
# reference-shaped but could not (or must not) turn into a link.
BUCKET_HISTORICAL = "historical"     # former structure (renumbered away; Part D/E/F, old roman Part-C sections, romans beyond the current highest section)
BUCKET_OTHER_REG = "other_reg"       # another regulation number not in the corpus
BUCKET_CFR = "cfr"                   # a CFR part/subpart not in the corpus
BUCKET_UNPARSEABLE = "unparseable"   # reference-shaped text that didn't tokenize, or a claimed-valid-part target that's still missing
ALL_BUCKETS = [BUCKET_HISTORICAL, BUCKET_OTHER_REG, BUCKET_CFR, BUCKET_UNPARSEABLE]

# A citation "piece" is a compound label like "I.A.3." or "I.D.3.b.(x)" or the
# compact-paren form "I.D.3.b.(x)(A)". The trailing plain-letter/digit segment
# (and only that LAST one) may omit its dot when the citation ends a sentence
# mid-clause with no punctuation of its own (e.g. "Section I.A is to provide"
# — no comma, no period at that point in the source at all).
_CITATION_TOKEN = (
    r"[IVXLCDM]+\."
    r"(?:[A-Za-z0-9]{1,3}\.)*"
    r"(?:[A-Za-z0-9]{1,3})?"
    r"(?:\([ivxlcdmA-Z0-9]{1,4}\)\.?)*"
)
CITATION_RE = re.compile(_CITATION_TOKEN)

# A run of one or more citations following "Section(s)", joined by comma,
# "and", "or", "through", or an en-dash/hyphen range — e.g. "I.A.3., I.A.4.,
# and I.A.5." / "I.D.3.b.(x) through I.D.3.b.(xii)" / "I.D.3.b.(x) – (xii)".
# Each citation found inside the matched list gets its own span (see
# `_emit_section_list`); the separators themselves are never linked.
_LIST_SEP = r"(?:\s*,\s*(?:and\s+|or\s+|through\s+)?|\s+and\s+|\s+or\s+|\s+through\s+|\s*[–—-]\s*)"
_CITATION_LIST = r"(?:" + _CITATION_TOKEN + r"(?:" + _LIST_SEP + _CITATION_TOKEN + r")*)"

# Bare "Section(s) <list>" (no leading "Part"/"Regulation Number").
SECTION_RE = re.compile(r"\b(Sections?)\s+(" + _CITATION_LIST + r")")
# "Part X[, Section(s) <list>]" — the part may be this regulation's own, or a
# former part (D, E, F, ...) that no longer exists.
PART_RE = re.compile(r"\bPart\s+([A-Z])\b(?:,\s*(Sections?)\s+(" + _CITATION_LIST + r"))?")
# "Regulation Number N[, Part X[, Section(s) <list>]]" or
# "Regulation Number N[, Section(s) <list>]" (no Part named).
REG_NUM_RE = re.compile(
    r"\bRegulation\s+Number\s+(?P<num>\d+)\b"
    r"(?:,\s*Part\s+(?P<part>[A-Z])\b(?:,\s*(?P<kw_p>Sections?)\s+(?P<seclist_p>" + _CITATION_LIST + r"))?"
    r"|,\s*(?P<kw_np>Sections?)\s+(?P<seclist_np>" + _CITATION_LIST + r"))?"
)
BARE_REG_RE = re.compile(r"\bRegulation\s+(?:Number\s+)?(\d+)\b")
CFR_RE = re.compile(r"\b40\s+CFR\s+Part\s+(\d+)(?:,\s*Subpart\s+([A-Za-z0-9]+))?")
# "Section I.E.3.a.(i) or (ii)" / "... and (iii)" — a bare trailing paren that
# names a sibling of the citation just linked (optional nicety; see spec item 2).
_SIBLING_FRAG_RE = re.compile(r"\A\s*(?:or|and)\s+(\([ivxlcdmA-Z0-9]{1,4}\))")


def _citation_to_id_suffix(citation: str, cycle=CYCLE_AB) -> str | None:
    """Turn a printed citation like 'I.A.3.' or 'I.D.3.b.(x)' into the
    dash-joined id suffix ('I-A-3'), tokenizing the same way the main parser
    does. Returns None if it doesn't fully tokenize. Tolerates a missing
    trailing dot on the last plain segment (see `_CITATION_TOKEN`) by
    normalizing it back on before tokenizing."""
    norm = citation if citation.endswith((".", ")")) else citation + "."
    tokens, consumed = tokenize_by_cycle(norm, cycle)
    remainder = norm[consumed:]
    if remainder not in ("", "."):
        return None
    if not tokens:
        return None
    return tokens_to_id_suffix(tokens)


def _default_parts_order(own_part: str | None, reg: str, known_ids: set[str]) -> list[str]:
    """Which part(s) to try, in order, for a same-reg "Section X.Y." citation
    that is NOT preceded by an explicit "Part Z,". Parts A and B both number
    their own sections starting at "I." (rule 1b): a provision in A or B
    tries its own part first, then the other. Parts whose own top-level
    sections are lettered rather than roman (Part C: "Statements of Basis")
    can never be the target of a roman-numeral citation (rule 3) — a
    provision there, or one with no clear enclosing part at all, tries B
    then A, since Part C's prose describes revisions to A/B."""
    roman_parts = [p for p in ("A", "B") if f"sec-{reg}-{p}-I" in known_ids]
    if own_part in roman_parts:
        return [own_part] + [p for p in roman_parts if p != own_part]
    return list(reversed(roman_parts))


def _resolve_cite(cite: str, reg: str, known_ids: set[str], parts_order: list[str]) -> tuple[str | None, str]:
    """Try to resolve one citation against `parts_order`, in order. Returns
    (target_id, "") on success, or (None, bucket) naming why it failed:
    BUCKET_HISTORICAL when the citation's own top-level roman numeral isn't a
    section of EITHER current Part A or Part B (Reg 7 was renumbered; a
    higher/former roman numeral like "XII." or "XVII." can only mean the old
    structure), else BUCKET_UNPARSEABLE (a top level that does exist, but
    this exact sub-path doesn't — or the text didn't tokenize at all)."""
    tokens, consumed = tokenize_by_cycle(cite if cite.endswith((".", ")")) else cite + ".", CYCLE_AB)
    suffix = _citation_to_id_suffix(cite)
    if suffix is None or not tokens:
        return None, BUCKET_UNPARSEABLE
    top_raw = tokens[0][1]
    for part in parts_order:
        target = f"sec-{reg}-{part}-{suffix}"
        if target in known_ids:
            return target, ""
    exists_top = any(f"sec-{reg}-{p}-{top_raw}" in known_ids for p in ("A", "B"))
    return None, (BUCKET_HISTORICAL if not exists_top else BUCKET_UNPARSEABLE)


def _sibling_target(base_target: str, new_paren_inner: str) -> str | None:
    """'sec-7-B-I-E-3-a-(i)' + 'ii' -> 'sec-7-B-I-E-3-a-(ii)' — only when the
    base target itself ends in a paren component (so "(ii)" is genuinely a
    sibling of "(i)", not an unrelated deeper/shallower level)."""
    m = re.match(r"^(.*)-\([ivxlcdmA-Z0-9]{1,4}\)$", base_target)
    if not m:
        return None
    return f"{m.group(1)}-({new_paren_inner})"


def _maybe_link_sibling(html_text: str, after: int, base_target: str, known_ids: set[str],
                         pieces: list[tuple[int, int, str]]) -> None:
    tail = html_text[after:after + 24]
    m = _SIBLING_FRAG_RE.match(tail)
    if not m:
        return
    frag_text = m.group(1)
    sib_target = _sibling_target(base_target, frag_text[1:-1])
    if sib_target and sib_target in known_ids:
        pieces.append((after + m.start(1), after + m.end(1), f'<span class="xref" data-target="{sib_target}">{frag_text}</span>'))


def _emit_section_list(html_text: str, keyword_start: int, keyword: str, list_start: int, list_text: str,
                        parts_order: list[str], pieces: list[tuple[int, int, str]], buckets: dict[str, Counter],
                        reg: str, known_ids: set[str]) -> None:
    """Link every citation found inside `list_text` (the captured run after
    "Section(s)") individually. Matching the existing DB convention: the
    FIRST citation's span text includes the "Section"/"Sections" keyword
    (e.g. "Sections I."), every later citation in the same list is wrapped
    bare (just "III.", "IV.", ...) with the separators left as plain text.
    If the first citation fails to resolve, the keyword is left as plain
    text rather than attached to a later citation's span."""
    matches = list(CITATION_RE.finditer(list_text))
    keyword_used = False
    for idx, cm in enumerate(matches):
        cite = cm.group(0)
        abs_start = list_start + cm.start()
        abs_end = list_start + cm.end()
        target, bucket = _resolve_cite(cite, reg, known_ids, parts_order)
        if target:
            if not keyword_used and idx == 0:
                pieces.append((keyword_start, abs_end, f'<span class="xref" data-target="{target}">{keyword} {cite}</span>'))
            else:
                pieces.append((abs_start, abs_end, f'<span class="xref" data-target="{target}">{cite}</span>'))
            keyword_used = True
            if idx == len(matches) - 1:
                _maybe_link_sibling(html_text, abs_end, target, known_ids, pieces)
        else:
            buckets[bucket][cite] += 1


def _link_part_clause(html_text: str, letter_start: int, letter_end: int, letter: str,
                       keyword: str | None, kw_start: int | None, seclist_text: str | None, seclist_start: int | None,
                       pieces: list[tuple[int, int, str]], buckets: dict[str, Counter], reg: str, known_ids: set[str]) -> None:
    part_target = f"sec-{reg}-P-{letter}"
    if part_target not in known_ids:
        # A former part (Reg 7: D, E, F) that no longer exists.
        buckets[BUCKET_HISTORICAL][f"Part {letter}"] += 1
        if seclist_text:
            for cm in CITATION_RE.finditer(seclist_text):
                buckets[BUCKET_HISTORICAL][cm.group(0)] += 1
        return
    # The part exists — link "Part X" as its own span regardless of whether a
    # Section list follows (matching the DB convention: "Regulation Number
    # 7, Part B, Section V." carries three independent spans, not one).
    kw_pos = html_text.rfind("Part", max(0, letter_start - 6), letter_start)
    span_start = kw_pos if kw_pos != -1 else letter_start
    pieces.append((span_start, letter_end, f'<span class="xref" data-target="{part_target}">Part {letter}</span>'))
    if seclist_text is None:
        return
    part_is_roman = f"sec-{reg}-{letter}-I" in known_ids
    if not part_is_roman:
        # This part's own sections are lettered (Part C), not roman — a
        # roman-numeral "Section" citation naming it can only be a reference
        # to the regulation's former structure (rule 3); never resolve it
        # here, and never silently fall back to another part either.
        for cm in CITATION_RE.finditer(seclist_text):
            buckets[BUCKET_HISTORICAL][cm.group(0)] += 1
        return
    _emit_section_list(html_text, kw_start, keyword, seclist_start, seclist_text, [letter], pieces, buckets, reg, known_ids)


def link_citations(html_text: str, reg: str, known_ids: set[str], corpus_regs: set[str],
                    own_part: str | None = None, own_id: str | None = None) -> tuple[str, dict[str, Counter]]:
    """Find cross-references in `html_text` (plain text at this point — call
    BEFORE other HTML is added, i.e. on the assembled paragraph text, and
    call it exactly once per paragraph) and wrap them in the app's xref
    spans/links.

    - Same-regulation citations ("Section I.A.3.", ranges with "through",
      lists, "Part B", bare "Regulation Number 7") become
      <span class="xref" data-target="...">...</span> IF AND ONLY IF the
      target id exists in `known_ids` (the ids this parse run produced for
      `reg`) — otherwise left as plain text and counted in `buckets`.
      Resolution of a bare "Section X.Y." is part-aware: an explicit
      "Part Z, Section X.Y." always uses Z; otherwise the citing provision's
      own part (`own_part`) is tried first — see `_default_parts_order`.
    - Another regulation in the corpus ("Regulation Number 26") becomes
      <a class="xref-external-reg" href="/regulations/...">Regulation Number
      26</a> (bare — a trailing ", Part X, Section Y" on THAT regulation is
      left as plain text; linking it against our own `known_ids` would point
      at the wrong regulation's Part X, so deeper cross-reg targets remain a
      later improvement per IMPORTER_SPEC.md).
    - Anything else that looks like a regulation/CFR/section reference but
      can't be resolved is left as plain text and counted into `buckets`
      (see BUCKET_* above) rather than a single flat counter, so the report
      can separate "this doesn't exist anywhere" (historical) from "that's
      someone else's regulation" from genuine parser gaps.

    Returns (new_html, buckets).
    """
    buckets: dict[str, Counter] = {b: Counter() for b in ALL_BUCKETS}
    pieces: list[tuple[int, int, str]] = []  # (start, end, replacement)
    claimed: list[tuple[int, int]] = []

    def is_claimed(s: int, e: int) -> bool:
        return any(s < ce and e > cs for cs, ce in claimed)

    def claim(s: int, e: int) -> None:
        claimed.append((s, e))

    default_order = _default_parts_order(own_part, reg, known_ids)

    # 1) "40 CFR Part NN, Subpart XXXX" — only OOOOb is in the corpus today.
    for m in CFR_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        subpart = m.group(2)
        if subpart and subpart.upper() == "OOOOB" and "oooob" in corpus_regs:
            pieces.append((m.start(), m.end(), f'<a class="xref-external-reg" href="/regulations/oooob">{m.group(0)}</a>'))
        else:
            buckets[BUCKET_CFR][m.group(0)] += 1

    # 2) "Regulation Number N[, Part X[, Section(s) list]]" / "..., Section(s) list".
    for m in REG_NUM_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        num = m.group("num")
        part = m.group("part")
        keyword = m.group("kw_p") or m.group("kw_np")
        seclist = m.group("seclist_p") or m.group("seclist_np")
        num_span = (m.start(), m.end("num"))

        if num != reg:
            if num in corpus_regs:
                # Bare "Regulation Number N" only — a trailing Part/Section
                # on THAT regulation is left unlinked (see docstring).
                pieces.append((num_span[0], num_span[1], f'<a class="xref-external-reg" href="/regulations/{num}">Regulation Number {num}</a>'))
            else:
                buckets[BUCKET_OTHER_REG][m.group(0)] += 1
            continue

        # num == reg: a self-reference. "Regulation Number 7" always links to
        # the root as its own span (rule 1); Part/Section, if present, are
        # independently linked to their own more specific targets.
        root_target = f"sec-{reg}-top-REG-{reg}"
        if root_target in known_ids:
            pieces.append((num_span[0], num_span[1], f'<span class="xref" data-target="{root_target}">Regulation Number {num}</span>'))
        else:
            buckets[BUCKET_UNPARSEABLE]["Regulation Number " + num] += 1

        if part is not None:
            _link_part_clause(html_text, m.start("part"), m.end("part"), part,
                               keyword, m.start("kw_p") if keyword else None,
                               seclist, m.start("seclist_p") if seclist else None,
                               pieces, buckets, reg, known_ids)
        elif seclist is not None:
            _emit_section_list(html_text, m.start("kw_np"), keyword, m.start("seclist_np"), seclist,
                                default_order, pieces, buckets, reg, known_ids)

    # 3) "Part X[, Section(s) list]" not already claimed above.
    for m in PART_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        letter, keyword, seclist = m.group(1), m.group(2), m.group(3)
        _link_part_clause(html_text, m.start(1), m.end(1), letter,
                           keyword, m.start(2) if keyword else None,
                           seclist, m.start(3) if seclist else None,
                           pieces, buckets, reg, known_ids)

    # 4) bare "Section(s) list" not already claimed above — resolved against
    #    the citing provision's own part (see `_default_parts_order`).
    for m in SECTION_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        keyword, seclist = m.group(1), m.group(2)
        _emit_section_list(html_text, m.start(1), keyword, m.start(2), seclist, default_order, pieces, buckets, reg, known_ids)

    # 5) bare "Regulation N" / "Regulation Number N" not already matched above.
    for m in BARE_REG_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        num = m.group(1)
        if num == reg:
            target = f"sec-{reg}-top-REG-{reg}"
            if target in known_ids:
                pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
            else:
                buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1
        elif num in corpus_regs:
            pieces.append((m.start(), m.end(), f'<a class="xref-external-reg" href="/regulations/{num}">{m.group(0)}</a>'))
        else:
            buckets[BUCKET_OTHER_REG][m.group(0)] += 1

    # Apply replacements left-to-right; drop any accidental overlaps (keep
    # whichever piece was inserted first / starts earliest) so we never nest
    # a span inside another span or corrupt surrounding markup.
    pieces.sort(key=lambda p: (p[0], p[1]))
    filtered: list[tuple[int, int, str]] = []
    last_end = -1
    for s, e, r in pieces:
        if s < last_end:
            continue
        filtered.append((s, e, r))
        last_end = e
    out = []
    cursor = 0
    for s, e, r in filtered:
        out.append(html_text[cursor:s])
        out.append(r)
        cursor = e
    out.append(html_text[cursor:])
    return "".join(out), buckets


# --------------------------------------------------------------------------
# Paragraph assembly
# --------------------------------------------------------------------------


# A handful of pdftotext extraction glitches confirmed by spot-checking
# against the source PDF (not parser bugs — the raw pdftotext -layout output
# itself drops these characters in a small number of places, e.g. line 8166
# "III.C.3.           State Only) Statewide:" is missing its opening paren).
_MISSING_OPEN_PAREN_RE = re.compile(r"(?<!\()\bState Only\)")


def fix_known_pdf_glitches(text: str) -> str:
    return _MISSING_OPEN_PAREN_RE.sub("(State Only)", text)


# --------------------------------------------------------------------------
# Known per-regulation SOURCE-TEXT label typos (confirmed by reading the
# actual printed PDF, not a pdftotext artifact) — applied to the cleaned
# lines BEFORE marker scanning ever sees them. Each fix is matched by its
# (wrong) label PLUS enough of the following words to be unique in the whole
# document, so it can only ever rewrite the one intended line and can never
# misfire onto an unrelated occurrence of the same bare label elsewhere. See
# the diff report's "Source-text corrections and anomalies" section.
# --------------------------------------------------------------------------

KNOWN_LABEL_FIXES: dict[str, list[dict]] = {
    "7": [
        dict(
            old_label="I.H.5.a.",
            new_label="I.H.6.a.",
            match_prefix="I.H.5.a. Beginning January 1, 2017, or February 14, 2023, if located in",
            line_hint=1520,
            note=(
                'Printed as "I.H.5.a." directly under the "I.H.6. Monitoring and '
                'recordkeeping" heading, immediately followed by "I.H.6.a.(i)" through '
                '"(iii)" and then "I.H.6.b." — the printed "I.H.5.a." is a source-text '
                'typo for "I.H.6.a." (its real parent, I.H.5, is a separate, already-'
                'complete provision earlier on the page).'
            ),
        ),
        dict(
            old_label="VII.A.20.",
            new_label="VIII.A.20.",
            match_prefix="VII.A.20.     “Measurement strategy” means the strategy that describes how an",
            line_hint=13933,
            note=(
                'Printed as "VII.A.20." sitting between "VIII.A.19." and "VIII.A.21." in '
                'the Part B Section VIII definitions list — collides with the real, '
                'unrelated "VII.A.20." (“Oil and natural gas compression segment”) '
                'in Section VII’s own definitions. A source-text typo for "VIII.A.20."'
            ),
        ),
    ],
}

# Documented but deliberately NOT auto-corrected: the source PDF really does
# print this exact label twice in a row for two different paragraphs. There
# is no way to tell from the source which one is "really" (iii) and which
# should be renumbered, so both paragraphs are kept, merged into one row (the
# existing duplicate-marker merge behavior — see `parse_reg`), exactly as
# printed, rather than guessing a renumbering.
KNOWN_LABEL_ANOMALIES: dict[str, list[dict]] = {
    "7": [
        dict(
            label="VI.D.3.a.(iii)",
            line_hint=12675,
            note=(
                'The label "VI.D.3.a.(iii)" is printed twice in a row for two different '
                'paragraphs: line ~12672 ("...permanently disconnected, if applicable.") '
                'and line ~12675 ("The date and duration of any period where the air '
                'pollution control equipment is not operating."). Both paragraphs are '
                'kept, merged into one row `sec-7-B-VI-D-3-a-(iii)`, in printed order — '
                'not renumbered.'
            ),
        ),
    ],
}


def apply_known_label_fixes(reg: str, lines: list[str]) -> tuple[list[str], list[dict]]:
    """Rewrites the label at the START of any line matching one of
    KNOWN_LABEL_FIXES[reg] (old_label + match_prefix) from its printed
    (wrong) label to the corrected one. Returns (new_lines, applied) where
    `applied` records, for every configured fix, how many lines it actually
    rewrote (`hits`) — this should be exactly 1 for every fix; 0 or >1 means
    the source text no longer matches what was hand-verified and the fix
    needs re-review rather than firing blindly."""
    fixes = KNOWN_LABEL_FIXES.get(reg, [])
    if not fixes:
        return lines, []
    out = list(lines)
    applied: list[dict] = []
    for fix in fixes:
        hits = 0
        for i, ln in enumerate(out):
            stripped = ln.strip()
            if stripped.startswith(fix["match_prefix"]):
                indent = len(ln) - len(ln.lstrip(" "))
                rest = ln.lstrip(" ")[len(fix["old_label"]):]
                out[i] = (" " * indent) + fix["new_label"] + rest
                hits += 1
        applied.append(dict(
            old_label=fix["old_label"], new_label=fix["new_label"],
            line_hint=fix["line_hint"], note=fix["note"], hits=hits,
        ))
    return out, applied


def join_paragraph_lines(lines: list[str]) -> str:
    words = []
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        words.append(ln)
    text = " ".join(words)
    text = re.sub(r"\s+", " ", text).strip()
    return fix_known_pdf_glitches(text)


def split_into_paragraphs(lines: list[str]) -> list[str]:
    """Split a list of raw (unstripped) lines into paragraphs on blank lines,
    joining wrapped lines within a paragraph with a single space."""
    paras: list[list[str]] = [[]]
    for ln in lines:
        if ln.strip() == "":
            if paras[-1]:
                paras.append([])
        else:
            paras[-1].append(ln)
    return [join_paragraph_lines(p) for p in paras if p]


# --------------------------------------------------------------------------
# Marker scan — a single sequential pass over the cleaned lines that finds
# every PART / Appendix / provision-label line and records its position.
# Text assembly (what belongs to each marker) happens in a second pass using
# "everything between this marker and the next one, of any kind" — which is
# correct because the source is printed in strict pre-order (a label's own
# text always precedes its first child in the document).
# --------------------------------------------------------------------------


def _label_position_plausible(lines: list[str], idx: int, last_marker_line: int | None) -> bool:
    """A genuine label line is preceded by a paragraph boundary: either a
    blank line, a line ending in terminal punctuation, or another label line
    (heading chained directly into its first child, e.g. "I.  Applicability"
    -> "I.A.  ..." with no body text in between). Anything else means we're
    looking at a citation-shaped fragment that happens to start a wrapped
    continuation line mid-sentence (confirmed instance: Reg 7 line ~3107,
    "...not already controlled under Sections\nI.D. or II.C.1.b. must be in
    compliance..." — "I.D." here is NOT a new label)."""
    if idx == 0:
        return True
    prev = lines[idx - 1].strip()
    if prev == "":
        return True
    words = prev.split()
    last_word = words[-1].strip(".,;:") if words else ""
    if last_word.rstrip("s") in ("Section", "Part", "Regulation") or last_word == "or":
        return False
    if last_word in ("and", "through") and ("Section" in prev or "Sections" in prev):
        # "...pursuant to Sections X.Y. and" / "...Sections X.Y.(i) through"
        # wrapping to a citation on the next line — still a citation-list
        # continuation, just with the trigger word earlier in the line
        # rather than at the very end.
        # The previous line dangles on a word that grammatically demands a
        # citation next ("...subject to Section" / "...pursuant to Part" /
        # "...Sections X.Y. or") — what follows is that citation's TARGET,
        # not a new label (confirmed instances: Reg 7 "...intensity
        # operators subject to Section" / "VIII.B.1. must achieve..." and
        # "...subject to Sections II.C.1.a. or" / "II.C.1.b. and
        # constructed..." — neither continuation is a new provision).
        # Everything else is accepted here; requiring the previous line to
        # additionally end in terminal punctuation or itself be a marker
        # line rejected too many genuine tightly-wrapped lists (e.g. a line
        # ending "...tons per year; and" immediately followed by a real
        # next sibling label) to be worth the small number of other false
        # positives it would additionally catch.
        return False
    return True


_TERMINAL_PUNCT = (".", ":", ";")
_COLUMN_TOLERANCE = 2


def _prev_line_signals(lines: list[str], idx: int, last_marker_line: int | None) -> dict:
    """Signals about the line immediately before `idx`: whether it's blank,
    whether it IS itself the previous marker's own line (a heading chained
    straight into its first child with no body text between), and whether it
    ends in terminal punctuation."""
    if idx == 0:
        return dict(prev="", prev_blank=True, prev_is_marker_line=False, prev_ends_terminal=True)
    prev = lines[idx - 1].strip()
    return dict(
        prev=prev,
        prev_blank=prev == "",
        prev_is_marker_line=(idx - 1 == last_marker_line),
        prev_ends_terminal=bool(prev) and prev[-1] in _TERMINAL_PUNCT,
    )


def _marker_column_signals(lines: list[str], idx: int, indent: int, tokens: list, rest: str,
                            part: str, last_marker_line: int | None, col_stats: dict,
                            seam_starts: set[int] | None = None,
                            last_marker_tokens: list | None = None) -> dict:
    """The continuation-line guard from IMPORTER_SPEC.md, layered on top of
    `_label_position_plausible`'s dangling-word check. Reliable signals in
    `-layout` output:

      1. column tracking — a real label at a given depth, within a Part, is
         printed at (about) the same left-indent every time. `col_stats`
         accumulates the indent of every marker this scan has already
         ACCEPTED at (part, depth); `learned` is the most common one seen so
         far (None until at least one has been accepted — the first
         confident marker at a depth defines it, and it's refined as more
         accepted markers come in, so one early marker printed a couple of
         characters off-column can't permanently mislearn it).
      2. paragraph-boundary — a real label is preceded by a blank line, or
         directly follows another label's own line (heading chained into its
         first child — including a heading whose OWN text wraps onto more
         than one physical line before its first child starts, e.g. Reg 7's
         "VI. (State Only) Oil and Natural Gas Pre-Production, Early
         Production and\nProduction Operations" immediately followed by
         "VI.A. Definitions" with no blank line at all: `tokens` being
         exactly one level deeper than, and a strict extension of, the last
         ACCEPTED marker's own tokens makes this a structural "first child of
         the currently open marker" match, confident regardless of what the
         previous physical line's last word happens to be); a continuation
         line directly follows a non-blank, non-marker line that ISN'T that
         pattern.
      3. a citation-shaped token that consumes the WHOLE physical line (the
         common case for a wrapped mid-sentence citation printed alone on
         its own line), or whose previous non-blank line ends without
         terminal punctuation, is a continuation — UNLESS `idx` is a page
         seam (see `clean_pages`): the "previous line" there is really the
         tail of the previous page, spliced on with no blank line by design
         (the truncation-bug fix), so it can dangle with no terminal
         punctuation for a genuine label purely because of where the page
         happened to break, not because anything continues into it.

    `continuation` is True only when the column has deviated from its
    depth's learned column AND at least one of the weaker corroborating
    signals (2)/(3) also points to "continuation" — column deviation alone
    is never enough by itself (a real label can legitimately land a few
    characters off column across a page-break reflow; see the audit in the
    diff report for confirmed examples of both directions)."""
    depth = len(tokens)
    sig = _prev_line_signals(lines, idx, last_marker_line)
    is_seam = seam_starts is not None and idx in seam_starts
    is_first_child_of_open_marker = (
        last_marker_tokens is not None
        and depth == len(last_marker_tokens) + 1
        and tuple(tokens[:len(last_marker_tokens)]) == tuple(last_marker_tokens)
    )
    confident_prev = sig["prev_blank"] or sig["prev_is_marker_line"] or is_first_child_of_open_marker
    whole_line_only = rest.strip() == ""
    lacks_terminal = (not confident_prev) and not sig["prev_ends_terminal"] and not is_seam
    ctr = col_stats.get((part, depth))
    learned = ctr.most_common(1)[0][0] if ctr else None
    column_deviates = learned is not None and abs(indent - learned) > _COLUMN_TOLERANCE
    continuation = column_deviates and (whole_line_only or lacks_terminal)
    return dict(
        indent=indent, depth=depth, learned=learned, column_deviates=column_deviates,
        confident_prev=confident_prev, whole_line_only=whole_line_only,
        lacks_terminal=lacks_terminal, continuation=continuation, is_seam=is_seam,
        is_first_child_of_open_marker=is_first_child_of_open_marker,
    )


def _record_accepted_column(col_stats: dict, part: str, depth: int, indent: int) -> None:
    col_stats.setdefault((part, depth), Counter())[indent] += 1


def scan_markers(lines: list[str], seam_starts: set[int] | None = None) -> tuple[list[dict], list[dict]]:
    """Returns (markers, marker_audit). `marker_audit` records every A/B-part
    label candidate flagged by the continuation-line guard (column deviation
    and/or a previous line lacking terminal punctuation) — whether it was
    ultimately accepted as a real label or rejected as a continuation — for
    the diff report's audit section."""
    markers: list[dict] = []
    current_part = None
    appendix_active = None
    emitted: dict[tuple, set] = defaultdict(set)
    partc_next_idx = 0
    ab_stack: dict[str, list[tuple[str, str]]] = {}  # part letter -> current open token chain
    last_marker_line: int | None = None
    col_stats: dict[tuple, Counter] = {}
    marker_audit: list[dict] = []

    for idx, raw_line in enumerate(lines):
        stripped = raw_line.strip()
        if stripped == "":
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))

        m = re.match(r"^PART\s+([A-Z])\s+(\S.*)$", raw_line)
        if m and indent == 0:
            letter, heading = m.group(1), m.group(2).strip()
            current_part = letter
            appendix_active = None
            emitted[("part", letter)] = set()
            markers.append({"line": idx, "type": "part", "letter": letter, "heading": heading})
            last_marker_line = idx
            continue

        m = re.match(r"^Appendix\s+([A-Z])\s+(\S.*)$", raw_line)
        if m and indent == 0:
            letter, heading = m.group(1), m.group(2).strip()
            appendix_active = letter
            markers.append({
                "line": idx, "type": "appendix", "letter": letter, "heading": heading,
                "owner_part": current_part,
            })
            last_marker_line = idx
            continue

        if appendix_active is not None:
            # Everything until the next marker is one undivided blob for this
            # appendix (matches how the current DB stores it; see diff report
            # for the content-omission bug this recovers).
            continue

        if current_part == "C":
            ns = ("part", "C")
            nxt = PART_C_LETTERS[partc_next_idx] if partc_next_idx < len(PART_C_LETTERS) else None
            m2 = re.match(r"^([A-Z]{1,2})\.\s+(.*)$", stripped)
            if indent == 0 and m2 and nxt and m2.group(1) == nxt and DATE_START_RE.match(m2.group(2)):
                disp = (nxt,)
                emitted[ns] = {disp}
                partc_next_idx += 1
                markers.append({
                    "line": idx, "type": "item", "ns": ns,
                    "tokens": [("upper", nxt)], "consumed": len(nxt) + 1,
                })
                last_marker_line = idx
                continue
            if partc_next_idx > 0 and _label_position_plausible(lines, idx, last_marker_line):
                cur_letter = PART_C_LETTERS[partc_next_idx - 1]
                tokens, consumed = tokenize_by_cycle(stripped, CYCLE_C_INNER)
                if tokens:
                    rest = stripped[consumed:]
                    if rest == "" or rest[0] == " ":
                        disp = (cur_letter,) + tuple(token_display(f, r) for f, r in tokens)
                        if disp[:-1] in emitted[ns]:
                            emitted[ns].add(disp)
                            full_tokens = [("upper", cur_letter)] + tokens
                            markers.append({
                                "line": idx, "type": "item", "ns": ns,
                                "tokens": full_tokens, "consumed": consumed,
                            })
                            last_marker_line = idx
                            continue
            continue

        if current_part in ("A", "B"):
            ns = ("part", current_part)
            tokens, consumed = tokenize_by_cycle(stripped, CYCLE_AB)
            if tokens:
                rest = stripped[consumed:]
                if rest == "" or rest[0] == " ":
                    depth = len(tokens)
                    dangling_ok = _label_position_plausible(lines, idx, last_marker_line)
                    colsig = _marker_column_signals(
                        lines, idx, indent, tokens, rest, current_part, last_marker_line, col_stats,
                        seam_starts, ab_stack.get(current_part),
                    )
                    accept_candidate = dangling_ok and not colsig["continuation"]
                    audit_entry = None
                    if colsig["column_deviates"] or colsig["lacks_terminal"]:
                        audit_entry = {
                            "line_no": idx + 1, "part": current_part,
                            "citation": tokens_to_citation(tokens), "indent": indent,
                            "depth": depth, "learned_column": colsig["learned"],
                            "column_deviates": colsig["column_deviates"],
                            "lacks_terminal": colsig["lacks_terminal"],
                            "whole_line_only": colsig["whole_line_only"],
                            "confident_prev": colsig["confident_prev"],
                            "is_seam": colsig["is_seam"],
                            "dangling_ok": dangling_ok,
                            "accepted": False,
                            "context": stripped[:90],
                        }
                        marker_audit.append(audit_entry)
                    if accept_candidate:
                        disp = tuple(token_display(f, r) for f, r in tokens)
                        parent_disp = disp[:-1]
                        if len(disp) == 1 or parent_disp in emitted[ns]:
                            emitted[ns].add(disp)
                            ab_stack[current_part] = tokens
                            _record_accepted_column(col_stats, current_part, depth, indent)
                            if audit_entry is not None:
                                audit_entry["accepted"] = True
                            markers.append({
                                "line": idx, "type": "item", "ns": ns,
                                "tokens": tokens, "consumed": consumed,
                            })
                            last_marker_line = idx
                            continue
                        # Parent not (yet) known. This is almost always a false
                        # positive (an inline "Section X.Y." reference that
                        # happened to start a wrapped line) — but occasionally a
                        # genuine source-text labeling slip. Only self-heal when
                        # the ACTUAL current chain (not just "some" historical
                        # ancestor) is a strict prefix — i.e. we're going deeper
                        # under the item we just emitted — since that's the one
                        # situation where "no such parent yet" reliably means
                        # "gap", not "coincidental citation". (The Reg 7
                        # "I.H.5.a." / "I.H.6.a." labeling slip that used to rely
                        # on this path is now corrected upstream by
                        # KNOWN_LABEL_FIXES before scanning ever sees it; this
                        # remains as a general safety net for undiscovered gaps.)
                        stack = ab_stack.get(current_part, [])
                        if len(disp) > len(stack) + 1 and tuple(stack) == tuple(t for t in tokens[: len(stack)]):
                            for d in range(len(stack), len(disp) - 1):
                                partial = tokens[: d + 1]
                                partial_disp = disp[: d + 1]
                                emitted[ns].add(partial_disp)
                                markers.append({
                                    "line": idx, "type": "item", "ns": ns,
                                    "tokens": list(partial), "consumed": 0,
                                    "synthetic": True,
                                })
                            emitted[ns].add(disp)
                            ab_stack[current_part] = tokens
                            _record_accepted_column(col_stats, current_part, depth, indent)
                            if audit_entry is not None:
                                audit_entry["accepted"] = True
                            markers.append({
                                "line": idx, "type": "item", "ns": ns,
                                "tokens": tokens, "consumed": consumed,
                            })
                            last_marker_line = idx
                            continue
            continue

    return markers, marker_audit


def marker_own_lines(lines: list[str], markers: list[dict], i: int) -> list[str]:
    start = markers[i]["line"] + 1
    end = markers[i + 1]["line"] if i + 1 < len(markers) else len(lines)
    return lines[start:end]


# --------------------------------------------------------------------------
# Build provisions from markers
# --------------------------------------------------------------------------


def build_provisions(reg: str, lines: list[str], markers: list[dict], tables_by_caption: dict[str, dict]):
    """Two passes: first assemble every provision's RAW (unlinked) paragraphs
    — this is what determines every id, parent, and the full set of ids that
    will exist — then, once that full set is known, run cross-reference
    linking over each provision's paragraphs. Doing this in one pass would
    make every forward reference (e.g. Part A text citing Part B, which is
    parsed later) spuriously "unresolved" just because of processing order,
    not because the target doesn't exist.
    """
    provisions: dict[str, dict] = {}
    order: list[str] = []
    # id -> ("heading", plain_text, table_html) | ("paras", [plain_para, ...], table_html)
    pending: dict[str, tuple] = {}
    sort = {"n": 0}
    table_hits = {"used": 0, "captions_used": []}

    def next_sort():
        sort["n"] += 10
        return sort["n"]

    root_id = f"sec-{reg}-top-REG-{reg}"
    provisions[root_id] = dict(
        id=root_id, citation=f"Regulation {reg}", title=f"Regulation {reg}",
        parent_id=None, sort_order=0, full_text=f"Regulation {reg}", kind="root",
    )
    order.append(root_id)

    part_root_id = {}

    for i, mk in enumerate(markers):
        if mk["type"] == "part":
            letter, heading = mk["letter"], mk["heading"]
            pid = f"sec-{reg}-P-{letter}"
            citation = f"PART {letter}"
            title = f"{citation} — {heading}"
            provisions[pid] = dict(
                id=pid, citation=citation, title=title, parent_id=root_id,
                sort_order=next_sort(), full_text=escape_html_text(title), kind="part",
            )
            order.append(pid)
            part_root_id[letter] = pid
            continue

        if mk["type"] == "appendix":
            letter, heading, owner = mk["letter"], mk["heading"], mk["owner_part"]
            aid = f"sec-{reg}-{owner}-APPENDIX-{letter}"
            citation = f"Appendix {letter}"
            title = f"{citation} — {heading}"
            own_lines = marker_own_lines(lines, markers, i)
            paras = split_into_paragraphs(own_lines)
            provisions[aid] = dict(
                id=aid, citation=citation, title=title, parent_id=root_id,
                sort_order=next_sort(), full_text="", kind="appendix",
            )
            pending[aid] = ("appendix", paras, title, "", owner, aid)
            order.append(aid)
            continue

        # type == "item"
        ns = mk["ns"]
        tokens = mk["tokens"]
        part_letter = ns[1]
        suffix = tokens_to_id_suffix(tokens)
        item_id = f"sec-{reg}-{part_letter}-{suffix}"
        citation = tokens_to_citation(tokens)
        if len(tokens) == 1:
            parent_id = part_root_id.get(part_letter, f"sec-{reg}-P-{part_letter}")
        else:
            parent_suffix = tokens_to_id_suffix(tokens[:-1])
            parent_id = f"sec-{reg}-{part_letter}-{parent_suffix}"

        own_lines = marker_own_lines(lines, markers, i)
        if mk.get("synthetic"):
            # A gap-filled intermediate level (see scan_markers) — it owns no
            # text of its own; the real content belongs to the deeper marker
            # that triggered the gap-fill, which shares this same line index.
            inline_text = ""
        else:
            inline_rest_line = lines[mk["line"]][:]
            inline_text = fix_known_pdf_glitches(inline_rest_line.strip()[mk["consumed"]:].strip())

        # count non-blank lines contributing text, beyond the marker's own line
        extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]

        # Table injection: cut own_lines at a "Table N - ..." caption line;
        # everything from there to the end of this marker's span is raw
        # pdftotext table garbage, replaced with the pdfplumber-rendered table.
        table_html = ""
        cut_idx = None
        for li, ln in enumerate(own_lines):
            cm = TABLE_CAPTION_RE.match(ln.strip())
            if cm:
                cut_idx = li
                caption_text = ln.strip()
                table = tables_by_caption.get(caption_text)
                if table:
                    table_html = render_table_html(table)
                    table_hits["used"] += 1
                    table_hits["captions_used"].append(caption_text)
                break
        if cut_idx is not None:
            own_lines = own_lines[:cut_idx]
            extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]

        kind = "section" if len(tokens) == 1 else "item"

        if not extra_nonblank:
            # Heading-type: entire own text fit on the marker's own physical
            # line (or there is none) -> plain text, label included, no <p>.
            text = f"{citation} {inline_text}".strip() if inline_text else citation
            pending[item_id] = ("heading", text, citation, table_html, part_letter, item_id)
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=text, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind=kind,
            )
        else:
            all_lines = ([inline_text] if inline_text else []) + own_lines
            paras = split_into_paragraphs(all_lines)
            pending[item_id] = ("paras", paras, citation, table_html, part_letter, item_id)
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=citation, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind=kind,
            )
        order.append(item_id)

    # Second pass: now that every id exists, link cross-references.
    known_ids = set(provisions.keys())
    unresolved_all: dict[str, Counter] = {b: Counter() for b in ALL_BUCKETS}

    def _merge(buckets: dict[str, Counter]) -> None:
        for b, ctr in buckets.items():
            unresolved_all[b].update(ctr)

    for pid, entry in pending.items():
        kindtag = entry[0]
        if kindtag == "heading":
            _, text, citation, table_html, own_part, own_id = entry
            escaped = escape_html_text(text)
            linked, buckets = link_citations(escaped, reg, known_ids, CORPUS_REGS, own_part, own_id)
            _merge(buckets)
            provisions[pid]["full_text"] = linked + table_html
        elif kindtag == "paras":
            _, paras, citation, table_html, own_part, own_id = entry
            rendered = []
            for p in paras:
                escaped = escape_html_text(p)
                linked, buckets = link_citations(escaped, reg, known_ids, CORPUS_REGS, own_part, own_id)
                _merge(buckets)
                rendered.append(f"<p>{linked}</p>")
            provisions[pid]["full_text"] = "".join(rendered) + table_html
        elif kindtag == "appendix":
            _, paras, title, table_html, own_part, own_id = entry
            rendered = []
            for p in paras:
                escaped = escape_html_text(p)
                linked, buckets = link_citations(escaped, reg, known_ids, CORPUS_REGS, own_part, own_id)
                _merge(buckets)
                rendered.append(f"<p>{linked}</p>")
            body_html = "".join(rendered)
            escaped_title = escape_html_text(title)
            provisions[pid]["full_text"] = escaped_title if not paras else escaped_title + body_html

    return provisions, order, unresolved_all, table_hits


def find_body_start(lines: list[str]) -> int:
    for i, l in enumerate(lines):
        if l.startswith("PART A") and (len(l) - len(l.lstrip(" "))) == 0:
            return i
    return 0


def parse_reg(reg: str, txt_path: str, pdf_path: str | None):
    raw = Path(txt_path).read_text(encoding="utf-8")
    lines, seam_starts = clean_pages(raw)
    lines, label_fixes_applied = apply_known_label_fixes(reg, lines)
    start = find_body_start(lines)
    lines = lines[start:]
    seam_starts = {i - start for i in seam_starts if i >= start}

    tables_by_caption: dict[str, dict] = {}
    if pdf_path:
        try:
            tables_by_caption = extract_tables_from_pdf(pdf_path)
        except Exception as exc:  # pdfplumber optional at parse time
            print(f"warning: table extraction failed: {exc}", file=sys.stderr)

    markers, marker_audit = scan_markers(lines, seam_starts)
    provisions, order, unresolved, table_hits = build_provisions(reg, lines, markers, tables_by_caption)

    # De-duplicate: two different markers occasionally compute the same id —
    # either a genuine source-text labeling duplicate (two real items printed
    # with the same citation; confirmed instances in Reg 7: "VI.D.3.a.(iii)"
    # and "VII.A.20." each appear twice, describing two different things), or
    # a citation-shaped false positive that slipped past scan_markers' guards
    # (a dangling reference like "...required in\nIII.C.5.b.(iv)(A)(2) and
    # the..." with no recognizable "Section"/"Sections"/"or" cue before the
    # line break). Either way the DB's `id` column is a primary key, so the
    # output can't carry two rows with the same id: keep the FIRST
    # occurrence's citation/parent/title and append every later occurrence's
    # text as trailing paragraphs, rather than silently dropping content.
    seen: dict[str, dict] = {}
    result: list[dict] = []
    duplicate_ids: list[str] = []
    for pid in order:
        row = provisions[pid]
        if pid in seen:
            duplicate_ids.append(pid)
            seen[pid]["full_text"] += row["full_text"]
            continue
        seen[pid] = row
        result.append(row)

    anomalies = KNOWN_LABEL_ANOMALIES.get(reg, [])
    return result, unresolved, table_hits, len(tables_by_caption), duplicate_ids, label_fixes_applied, anomalies, marker_audit


# --------------------------------------------------------------------------
# CLI: parse
# --------------------------------------------------------------------------


def cmd_parse(args):
    (result, unresolved, table_hits, n_tables_found, duplicate_ids,
     label_fixes_applied, anomalies, marker_audit) = parse_reg(args.reg, args.txt, args.pdf)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")

    kind_counts = Counter(r["kind"] for r in result)
    print(f"Parsed {len(result)} provisions for Reg {args.reg} -> {out_path}")
    print(f"  by kind: {dict(kind_counts)}")
    if label_fixes_applied:
        print("  known label fixes applied:")
        for f in label_fixes_applied:
            status = "OK" if f["hits"] == 1 else f"WARNING: {f['hits']} hits (expected 1)"
            print(f"    {f['old_label']} -> {f['new_label']} (line ~{f['line_hint']}): {status}")
    if duplicate_ids:
        print(f"  WARNING: {len(duplicate_ids)} id(s) were produced by more than one marker "
              f"and merged (see report): {duplicate_ids}")
    n_col = sum(1 for a in marker_audit if a["column_deviates"])
    n_lack = sum(1 for a in marker_audit if a["lacks_terminal"])
    n_rejected = sum(1 for a in marker_audit if not a["accepted"])
    print(f"  marker candidates flagged by continuation-line guard: {len(marker_audit)} "
          f"(column-deviating: {n_col}, prev-line-lacks-terminal-punct: {n_lack}); "
          f"rejected as continuations: {n_rejected}")
    print(f"  tables found in PDF: {n_tables_found}; tables rendered/injected: {table_hits['used']}")
    if table_hits["captions_used"]:
        print(f"  injected: {table_hits['captions_used']}")
    total_unresolved = sum(sum(ctr.values()) for ctr in unresolved.values())
    total_distinct = sum(len(ctr) for ctr in unresolved.values())
    print(f"  unresolved reference texts (distinct): {total_distinct}, total mentions: {total_unresolved}")
    for bucket in ALL_BUCKETS:
        ctr = unresolved[bucket]
        if not ctr:
            continue
        print(f"  bucket '{bucket}': {len(ctr)} distinct, {sum(ctr.values())} mentions; top 5:")
        for text, cnt in ctr.most_common(5):
            print(f"    {cnt:4d}  {text}")

    # Save unresolved list + duplicate-id list alongside for the diff step to
    # reuse without re-parsing. Grouped by bucket (see BUCKET_* / ALL_BUCKETS)
    # so a reviewer can tell "this doesn't exist anymore" (historical) apart
    # from "that's someone else's regulation" from a genuine parser gap.
    unresolved_path = out_path.with_name(out_path.stem + "_unresolved.json")
    unresolved_grouped = {
        bucket: sorted(unresolved[bucket].items(), key=lambda kv: -kv[1])
        for bucket in ALL_BUCKETS
    }
    unresolved_path.write_text(
        json.dumps(unresolved_grouped, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    dupes_path = out_path.with_name(out_path.stem + "_duplicate_ids.json")
    dupes_path.write_text(json.dumps(duplicate_ids, ensure_ascii=False, indent=1), encoding="utf-8")

    corrections_path = out_path.with_name(out_path.stem + "_corrections.json")
    corrections_path.write_text(
        json.dumps({"label_fixes": label_fixes_applied, "anomalies": anomalies}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    audit_path = out_path.with_name(out_path.stem + "_marker_audit.json")
    audit_path.write_text(json.dumps(marker_audit, ensure_ascii=False, indent=1), encoding="utf-8")


# --------------------------------------------------------------------------
# CLI: diff
# --------------------------------------------------------------------------

PAGE_LEAK_PATTERNS = [
    re.compile(r"CODE OF COLORADO REGULATIONS"),
    re.compile(r"Air Quality Control Commission"),
    re.compile(r"\b\d{1,4}\s*CODE OF COLORADO"),
]


def find_page_leaks(text: str) -> bool:
    return any(p.search(text) for p in PAGE_LEAK_PATTERNS)


_FURNITURE_COMPARE_RE = re.compile(r"CODE OF COLORADO REGULATIONS\s*5\s*CCR\s*1001-9|Air Quality Control Commission")


def _norm_for_compare(s: str) -> str:
    """Whitespace/page-furniture-insensitive normalization used ONLY for the
    diff's identical/truncation classification — never for the stored output."""
    s = re.sub(r"<[^>]+>", "", s or "")
    s = _FURNITURE_COMPARE_RE.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def _nospace(s: str) -> str:
    return re.sub(r"\s+", "", s)


_XREF_SPAN_RE = re.compile(r'<span class="xref" data-target="([^"]*)">(.*?)</span>')
_EXT_ANCHOR_RE = re.compile(r'<a class="xref-external-reg"[^>]*>')
_STRIP_XREF_SPAN_RE = re.compile(r'<span class="xref"[^>]*>.*?</span>')
_BARE_SECTION_RE = re.compile(r'\bSections?\s+([IVXLCDM]+)\b')


def _extract_xrefs(text: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2)) for m in _XREF_SPAN_RE.finditer(text or "")]


def _target_bucket_label(reg: str, target: str) -> str:
    prefix = f"sec-{reg}-"
    if not target.startswith(prefix):
        return "other"
    rest = target[len(prefix):]
    if rest.startswith("top-"):
        return "top (Regulation root)"
    if rest.startswith("P-"):
        return f"Part {rest[2:]} (bare part reference)"
    return f"under Part {rest.split('-', 1)[0]}"


def _xref_report_section(reg: str, parsed: list[dict], db: list[dict], parsed_by_id: dict, db_by_id: dict,
                          both: set, unresolved_buckets: dict[str, list]) -> list[str]:
    """Builds the "Cross-reference linking" section of the diff report (see
    IMPORTER_SPEC.md and spec item 6 of the part-aware-linking task)."""
    known_ids = set(parsed_by_id)
    lines: list[str] = ["## Cross-reference linking\n"]

    # 1) Total spans/anchors, parsed vs DB, and a by-target-part breakdown.
    parsed_xrefs = [xr for r in parsed for xr in _extract_xrefs(r.get("full_text") or "")]
    db_xrefs = [xr for r in db for xr in _extract_xrefs(r.get("full_text") or "")]
    parsed_ext = sum(len(_EXT_ANCHOR_RE.findall(r.get("full_text") or "")) for r in parsed)
    db_ext = sum(len(_EXT_ANCHOR_RE.findall(r.get("full_text") or "")) for r in db)

    lines.append(f"- `<span class=\"xref\">` spans — parsed: **{len(parsed_xrefs)}**, DB: **{len(db_xrefs)}**")
    lines.append(f"- `<a class=\"xref-external-reg\">` anchors — parsed: **{parsed_ext}**, DB: **{db_ext}**")
    lines.append("")

    lines.append("### Spans by target part\n")
    lines.append("| target | parsed | DB |")
    lines.append("|---|---|---|")
    parsed_by_bucket = Counter(_target_bucket_label(reg, t) for t, _ in parsed_xrefs)
    db_by_bucket = Counter(_target_bucket_label(reg, t) for t, _ in db_xrefs)
    for label in sorted(set(parsed_by_bucket) | set(db_by_bucket)):
        lines.append(f"| {label} | {parsed_by_bucket.get(label, 0)} | {db_by_bucket.get(label, 0)} |")
    lines.append("")

    # 2) Unresolved, by bucket (top 15 each) — from the parse-step sidecar file.
    lines.append("### Unresolved references, by bucket (top 15 each)\n")
    bucket_titles = {
        BUCKET_HISTORICAL: "Historical (former structure — Reg 7 was renumbered; these no longer exist in current Parts A/B/C)",
        BUCKET_OTHER_REG: "Other regulation not in corpus",
        BUCKET_CFR: "CFR part/subpart not in corpus",
        BUCKET_UNPARSEABLE: "Unparseable / genuine parser gap",
    }
    if not unresolved_buckets:
        lines.append("_none recorded (run `parse` first to generate the sidecar file)_\n")
    for bucket in ALL_BUCKETS:
        items = unresolved_buckets.get(bucket, [])
        total_mentions = sum(c for _, c in items)
        lines.append(f"**{bucket_titles.get(bucket, bucket)}** — {len(items)} distinct, {total_mentions} mentions\n")
        if items:
            lines.append("| citation text | count |")
            lines.append("|---|---|")
            for text, cnt in items[:15]:
                safe = str(text).replace("|", "\\|")
                lines.append(f"| {safe} | {cnt} |")
        else:
            lines.append("_none_")
        lines.append("")

    # 3) Remaining citation-shaped "Section ..." text not wrapped in any span
    #    at all — includes bucketed-but-left-plain text above, plus anything
    #    our own regexes never even attempted (e.g. a bare roman numeral with
    #    no trailing period at all, "Section XII imposes...").
    remaining_total = 0
    remaining_non_historical = 0
    for r in parsed:
        stripped = _STRIP_XREF_SPAN_RE.sub(" ", r.get("full_text") or "")
        for m in _BARE_SECTION_RE.finditer(stripped):
            remaining_total += 1
            roman = m.group(1)
            exists_top = any(f"sec-{reg}-{p}-{roman}" in known_ids for p in ("A", "B"))
            if exists_top:
                remaining_non_historical += 1
    lines.append(
        f"### Remaining unwrapped \"Section...\" text\n\n"
        f"- Total: **{remaining_total}**\n"
        f"- Excluding ones whose roman numeral doesn't exist in current Part A/B at all "
        f"(historical, expected to stay unlinked): **{remaining_non_historical}**\n"
    )

    # 4) Reviewer spot-check: 10 random linked Part B paragraphs, 5 from Part C.
    def _sample_linked(prefix: str, n: int, seed: int) -> list[dict]:
        pool = [r for r in parsed if r["id"].startswith(prefix) and 'class="xref"' in (r.get("full_text") or "")]
        rng = random.Random(seed)
        return rng.sample(pool, min(n, len(pool)))

    lines.append("### 10 random linked paragraphs from Part B\n")
    for r in _sample_linked(f"sec-{reg}-B-", 10, 101):
        lines.append(f"- `{r['id']}`: {(r['full_text'] or '')[:400]}")
    lines.append("")

    lines.append("### 5 random linked paragraphs from Part C\n")
    for r in _sample_linked(f"sec-{reg}-C-", 5, 102):
        lines.append(f"- `{r['id']}`: {(r['full_text'] or '')[:400]}")
    lines.append("")

    # 5) Where the DB linked a citation's text to a different target than the
    #    new parse does, for the same provision — shows where the OLD
    #    importer (or the old Part C roman-numeral id scheme) pointed
    #    elsewhere. A human decides which target is actually right by reading
    #    the source PDF; see the writeup accompanying this report.
    lines.append("### DB xref target vs parsed xref target, same provision & citation text\n")
    diffs = []
    for pid in sorted(both):
        d_map = {text: target for target, text in _extract_xrefs(db_by_id[pid].get("full_text") or "")}
        p_map = {text: target for target, text in _extract_xrefs(parsed_by_id[pid].get("full_text") or "")}
        for text, d_target in d_map.items():
            p_target = p_map.get(text)
            if p_target and p_target != d_target:
                diffs.append((pid, text, d_target, p_target))
    lines.append(f"({len(diffs)} such (provision, citation text) pairs found)\n")
    rng = random.Random(103)
    sample = rng.sample(diffs, min(10, len(diffs)))
    if sample:
        lines.append("| provision | citation text | DB target | parsed target |")
        lines.append("|---|---|---|---|")
        for pid, text, d_target, p_target in sample:
            lines.append(f"| `{pid}` | {text} | `{d_target}` | `{p_target}` |")
    else:
        lines.append("_none found_")
    lines.append("")
    lines.append(
        "**Reviewed by hand against the source PDF** (Reg 7, 2026-09-14 print):\n\n"
        "- `sec-7-C-DD`, \"Sections III.C.4.\" and \"Section I.A.\": the source text is "
        "\"...Revisions to **Part A**, Section I.A. and **Part B**, Sections III.C.4....\" — "
        "the explicit Part A/Part B on each item makes the **parsed** targets "
        "(`sec-7-A-I-A`, `sec-7-B-III-C-4`) correct; DB's `sec-7-C-I` / `sec-7-C-III-C-4` are "
        "leftover ids from the old roman-numbered Part C scheme and don't exist under the "
        "current (relettered) Part C at all.\n"
        "- `sec-7-C-CC`, \"Sections I.A.1.c.\" and \"II.C.\": same pattern — "
        "\"Revisions to **Part A**, Sections I.A.1.c. and II.C. and Part B...\" — both items "
        "belong to the stated Part A, so **parsed**'s `sec-7-A-I-A-1-c` / `sec-7-A-II-C` are "
        "correct; DB's `sec-7-C-I` / `sec-7-C-II` are again stale old-Part-C ids.\n"
        "- `sec-7-A-II-B`, \"Sections I.L.\": the source reads \"...the hydrocarbon threshold "
        "in **Part B**, Sections I.L....\" inside a Part A provision — DB ignored the explicit "
        "\"Part B\" and linked to this provision's own Part A Section I (`sec-7-A-I`, wrong); "
        "**parsed** correctly honors the stated Part B (`sec-7-B-I-L`).\n"
        "- `sec-7-B-III-C-4-d-(vi)-(A)`, \"Sections III.C.4.d.(i)\": DB collapsed the citation "
        "to its parent, `sec-7-B-III-C-4-d` (dropping the \"(i)\"); **parsed**'s "
        "`sec-7-B-III-C-4-d-(i)` matches the printed citation exactly and is correct.\n"
        "- `sec-7-C-X`, \"Section II.B.\": a bare topic heading (\"Air Pollution Control "
        "Equipment: Section II.B.\") inside a Part C statement-of-basis entry with no part "
        "stated — DB's `sec-7-C-II` is an old-scheme id that doesn't exist under the current "
        "lettered Part C; **parsed**'s `sec-7-B-II-B` (Part B tried first per rule 1c) is at "
        "least a real, existing section, though a human should still eyeball whether II.B is "
        "the exact intended target for this particular topic label.\n\n"
        "In every case above the new parser's target is at least as correct as, and usually "
        "clearly better than, the DB's — the DB's Part-C-roman-numeral ids are artifacts of "
        "the pre-relettering id scheme (IMPORTER_SPEC.md's approved Part C lettering fix) and "
        "don't resolve to anything under the current schema.\n"
    )

    return lines


def cmd_diff(args):
    parsed = json.loads(Path(args.parsed).read_text(encoding="utf-8"))
    db = json.loads(Path(args.db).read_text(encoding="utf-8"))

    parsed_by_id = {r["id"]: r for r in parsed}
    db_by_id = {r["id"]: r for r in db}

    parsed_ids = set(parsed_by_id)
    db_ids = set(db_by_id)
    both = parsed_ids & db_ids
    only_db = sorted(db_ids - parsed_ids)
    only_parsed = sorted(parsed_ids - db_ids)

    def strip_tags(s: str) -> str:
        return re.sub(r"<[^>]+>", "", s or "")

    # Classification (whitespace/page-furniture-insensitive; a hyphenation-
    # tolerant space-stripped comparison decides the truncation bucket, since
    # the DB's un-normalized text sometimes has a stray space around a
    # line-wrapped hyphen, e.g. "8- hour" vs the correctly-rejoined "8-hour").
    identical, truncation_suffix, different = [], [], []
    for pid in sorted(both):
        p_norm = _norm_for_compare(parsed_by_id[pid]["full_text"] or "")
        d_norm = _norm_for_compare(db_by_id[pid]["full_text"] or "")
        if p_norm == d_norm:
            identical.append(pid)
            continue
        p_ns, d_ns = _nospace(p_norm), _nospace(d_norm)
        if d_ns and p_ns.endswith(d_ns) and d_ns != p_ns:
            truncation_suffix.append(pid)
        else:
            different.append(pid)

    # For "different" rows, check whether the DB's text actually reappears
    # verbatim-ish on a NEARBY sibling id in our parse — strong evidence of an
    # amendment-driven renumbering (an item inserted/removed mid-list shifts
    # every numbered id after it) rather than a parser defect.
    by_parent: dict[str, list[str]] = defaultdict(list)
    for r in parsed:
        by_parent[r.get("parent_id") or ""].append(r["id"])

    shifted_examples = []
    for pid in different:
        parent = db_by_id[pid].get("parent_id")
        siblings = by_parent.get(parent, [])
        d_ns = _nospace(_norm_for_compare(db_by_id[pid]["full_text"] or ""))
        if not d_ns or len(d_ns) < 20:
            continue
        for sib in siblings:
            if sib == pid:
                continue
            sib_ns = _nospace(_norm_for_compare(parsed_by_id[sib]["full_text"]))
            if d_ns == sib_ns or (len(d_ns) > 30 and d_ns in sib_ns):
                shifted_examples.append((pid, sib))
                break

    # Parent-mismatch check among ids present in both.
    parent_mismatches = [
        pid for pid in sorted(both)
        if (parsed_by_id[pid].get("parent_id") or None) != (db_by_id[pid].get("parent_id") or None)
    ]

    # Page-furniture leaks in the DB (evidence the OLD importer didn't strip these).
    db_leaks = [r["id"] for r in db if find_page_leaks(r.get("full_text") or "")]

    # Unresolved cross-references, grouped by bucket — reuse the sidecar file
    # from `parse` if present (see "Cross-reference linking" section below).
    unresolved_path = Path(args.parsed).with_name(Path(args.parsed).stem + "_unresolved.json")
    unresolved_buckets: dict[str, list] = {}
    if unresolved_path.exists():
        unresolved_buckets = json.loads(unresolved_path.read_text(encoding="utf-8"))

    dupes_path = Path(args.parsed).with_name(Path(args.parsed).stem + "_duplicate_ids.json")
    duplicate_ids = json.loads(dupes_path.read_text(encoding="utf-8")) if dupes_path.exists() else []

    corrections_path = Path(args.parsed).with_name(Path(args.parsed).stem + "_corrections.json")
    corrections: dict = {"label_fixes": [], "anomalies": []}
    if corrections_path.exists():
        corrections = json.loads(corrections_path.read_text(encoding="utf-8"))

    audit_path = Path(args.parsed).with_name(Path(args.parsed).stem + "_marker_audit.json")
    marker_audit: list = []
    if audit_path.exists():
        marker_audit = json.loads(audit_path.read_text(encoding="utf-8"))

    # Lowercase-start count in parsed output.
    lowercase_start = []
    for r in parsed:
        plain = strip_tags(r["full_text"]).strip()
        if plain and plain[0].islower():
            lowercase_start.append(r["id"])

    # 15 random side-by-side samples among ids in both.
    rng = random.Random(7)
    sample_pool = sorted(both)
    samples = rng.sample(sample_pool, min(15, len(sample_pool)))

    lines = []
    lines.append(f"# Reg {args.reg} import diff report\n")
    lines.append(f"- Parsed rows: **{len(parsed)}**")
    lines.append(f"- DB rows: **{len(db)}**")
    lines.append(f"- Ids in both: **{len(both)}**")
    lines.append(f"- Ids only in DB (parser gap or DB junk): **{len(only_db)}**")
    lines.append(f"- Ids only in parsed (parser found something DB doesn't have): **{len(only_parsed)}**")
    lines.append(f"- Text identical: **{len(identical)}**")
    lines.append(f"- Text where DB is a suffix of parsed (truncation confirmed): **{len(truncation_suffix)}**")
    lines.append(f"- Text different (neither identical nor a clean truncation): **{len(different)}**")
    lines.append(f"  - of which text also found verbatim on a nearby sibling id (amendment-driven renumbering, not a parser bug): **{len(shifted_examples)}**")
    lines.append(f"- parent_id mismatches among shared ids: **{len(parent_mismatches)}**")
    lines.append(f"- DB rows with page-furniture leaked into full_text: **{len(db_leaks)}**")
    lines.append(f"- Parsed rows whose full_text starts with a lowercase letter: **{len(lowercase_start)}**")
    lines.append("")

    lines.append("## Ids only in DB\n")
    if only_db:
        lines.append(f"({len(only_db)} total)\n")
        for i in only_db:
            lines.append(f"- `{i}`")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Ids only in parsed\n")
    if only_parsed:
        lines.append(f"({len(only_parsed)} total)\n")
        for i in only_parsed:
            lines.append(f"- `{i}`")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Duplicate ids in the parsed output (two markers, one id — merged)\n")
    lines.append(
        "Every id below was produced by more than one marker during parsing. This script "
        "keeps the first occurrence's citation/parent/title and appends the later "
        "occurrence's text as trailing paragraphs so no content is silently dropped. As of "
        "this run, the only expected entry is `sec-7-B-VI-D-3-a-(iii)` — the source PDF "
        "really does print that exact label twice in a row for two different paragraphs "
        "(see \"Source-text corrections and anomalies\" below). The two other duplicates "
        "seen in earlier runs (`sec-7-B-II-J-1-c`, `sec-7-B-III-C-5-b-(iv)-(A)-(2)`, both "
        "citation-shaped continuation-line false positives) and the label-typo collision "
        "(`sec-7-B-VII-A-20`) are fixed — see the same section and the marker audit below. "
        "Anything else appearing here is new and should be reviewed by hand.\n"
    )
    if duplicate_ids:
        for i in duplicate_ids:
            lines.append(f"- `{i}`")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Source-text corrections and anomalies\n")
    lines.append(
        "Confirmed by reading the actual printed PDF (not a pdftotext artifact). Fixes are "
        "applied to the raw lines before marker scanning, matched by (old label + enough "
        "of the following words to be unique in the document) so they can't misfire.\n"
    )
    label_fixes = corrections.get("label_fixes", [])
    if label_fixes:
        lines.append("### Label typos corrected\n")
        lines.append("| line ~ | printed (wrong) | corrected to | hits | note |")
        lines.append("|---|---|---|---|---|")
        for f in label_fixes:
            status = "OK (1)" if f["hits"] == 1 else f"**{f['hits']}** — needs review"
            note = f["note"].replace("|", "\\|")
            lines.append(f"| {f['line_hint']} | `{f['old_label']}` | `{f['new_label']}` | {status} | {note} |")
        lines.append("")
    anomalies = corrections.get("anomalies", [])
    if anomalies:
        lines.append("### Anomalies documented, not auto-corrected\n")
        for a in anomalies:
            note = a["note"]
            lines.append(f"- `{a['label']}` (line ~{a['line_hint']}): {note}")
        lines.append("")

    lines.append("## Marker column / continuation-line audit\n")
    lines.append(
        "Every Part A/B label candidate flagged by the continuation-line guard (its column "
        "deviates by more than 2 characters from the learned column for its depth, and/or "
        "its previous non-blank line lacks terminal punctuation), whether ultimately "
        "accepted as a real label or rejected as a continuation. See IMPORTER_SPEC.md and "
        "`_marker_column_signals` for the rule.\n"
    )
    n_col = sum(1 for a in marker_audit if a.get("column_deviates"))
    n_lack = sum(1 for a in marker_audit if a.get("lacks_terminal"))
    n_rejected = sum(1 for a in marker_audit if not a.get("accepted"))
    n_kept = len(marker_audit) - n_rejected
    lines.append(
        f"- Flagged candidates: **{len(marker_audit)}** "
        f"(column-deviating: **{n_col}**, prev-line-lacks-terminal-punctuation: **{n_lack}**)\n"
        f"- Rejected as continuations: **{n_rejected}**\n"
        f"- Kept as real labels despite the flag: **{n_kept}**\n"
    )
    if marker_audit:
        lines.append("| line | citation | part | indent | learned col | col dev | lacks term. | page seam | accepted |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
        for a in sorted(marker_audit, key=lambda a: a["line_no"]):
            lines.append(
                f"| {a['line_no']} | `{a['citation']}` | {a['part']} | {a['indent']} | "
                f"{a['learned_column']} | {a['column_deviates']} | {a['lacks_terminal']} | "
                f"{a.get('is_seam', False)} | {a['accepted']} |"
            )
    else:
        lines.append("_none recorded (run `parse` first to generate the sidecar file)_")
    lines.append("")

    lines.append("## parent_id mismatches\n")
    if parent_mismatches:
        for i in parent_mismatches[:100]:
            lines.append(f"- `{i}`: db parent=`{db_by_id[i].get('parent_id')}` parsed parent=`{parsed_by_id[i].get('parent_id')}`")
        if len(parent_mismatches) > 100:
            lines.append(f"- … and {len(parent_mismatches) - 100} more")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## DB rows with page-furniture leaks (first 30)\n")
    for i in db_leaks[:30]:
        lines.append(f"- `{i}`")
    if not db_leaks:
        lines.append("_none_")
    lines.append("")

    lines.append("## Truncation-confirmed rows (DB text is a suffix of parsed text) — first 30\n")
    for i in truncation_suffix[:30]:
        lines.append(f"- `{i}`")
    if len(truncation_suffix) > 30:
        lines.append(f"- … and {len(truncation_suffix) - 30} more")
    lines.append("")

    lines.append("## Different (not identical, not a clean truncation) — first 40\n")
    for i in different[:40]:
        lines.append(f"- `{i}`")
    if len(different) > 40:
        lines.append(f"- … and {len(different) - 40} more")
    lines.append("")

    lines.append("## Likely amendment-driven renumbering (DB text found on a nearby sibling id)\n")
    lines.append(
        "The current source PDF has clearly been amended since the DB was last populated "
        "(dates change, e.g. Reg 7 II.A.2's EPA Method 21 citation goes from `(August 3, 2017)` "
        "in the source PDF to no date at all in some DB rows; definitions get inserted "
        "alphabetically, shifting every subsequent sequentially-numbered definition — e.g. DB's "
        "`sec-7-B-I-B-24` is `\"New\"` but the current PDF's `I.B.24` is `\"Natural gas transmission "
        "and storage segment\"`, a term inserted earlier in the list, pushing `\"New\"` down to "
        "`I.B.25`). The rows below are where the DB's stored text for id X is not what's at X in "
        "the new parse, but IS found (word salad aside) on a nearby sibling id — i.e. content that "
        "moved, not content that's wrong.\n"
    )
    if shifted_examples:
        lines.append(f"({len(shifted_examples)} of the {len(different)} 'different' rows)\n")
        for pid, sib in shifted_examples[:40]:
            lines.append(f"- `{pid}` (DB) → now at `{sib}` (parsed)")
        if len(shifted_examples) > 40:
            lines.append(f"- … and {len(shifted_examples) - 40} more")
    else:
        lines.append("_none detected_")
    lines.append("")

    lines.extend(_xref_report_section(args.reg, parsed, db, parsed_by_id, db_by_id, both, unresolved_buckets))

    lines.append("## Lowercase-start rows in parsed output (first 30)\n")
    for i in lowercase_start[:30]:
        plain = strip_tags(parsed_by_id[i]["full_text"]).strip()
        lines.append(f"- `{i}`: {plain[:80]!r}")
    if len(lowercase_start) > 30:
        lines.append(f"- … and {len(lowercase_start) - 30} more")
    lines.append("")

    lines.append("## 15 random side-by-side samples\n")
    for i in samples:
        d_text = (db_by_id[i]["full_text"] or "")[:200]
        p_text = (parsed_by_id[i]["full_text"] or "")[:200]
        lines.append(f"### `{i}`")
        lines.append(f"- DB:     `{d_text}`")
        lines.append(f"- Parsed: `{p_text}`")
        lines.append("")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote diff report -> {out_path}")
    print(f"both={len(both)} only_db={len(only_db)} only_parsed={len(only_parsed)} "
          f"identical={len(identical)} truncation={len(truncation_suffix)} different={len(different)}")


# --------------------------------------------------------------------------
# CLI: export — read-only Supabase SELECT producing reg{N}_db.json, so the
# whole re-import pipeline (export -> parse -> diff -> apply) can run
# end-to-end in GitHub Actions from just the committed PDF, with no manual
# "run this SELECT via the Supabase MCP tool" step. Requires SUPABASE_URL /
# SUPABASE_SERVICE_ROLE_KEY (same convention as summarize.py and
# cmd_apply_execute) but only ever SELECTs -- it makes no writes.
# --------------------------------------------------------------------------

EXPORT_PAGE_SIZE = 1000
EXPORT_COLUMNS = "id, citation, title, parent_id, sort_order, full_text"


def fetch_export_rows(client, reg: str, page_size: int = EXPORT_PAGE_SIZE) -> list[dict]:
    """Pages through every `provisions` row whose id matches `sec-<reg>-%`,
    ordered by id, `page_size` rows at a time via `.range()` -- the same
    paging pattern as summarize.py's fetch_meta/iter_candidates (PostgREST
    caps a single response's row count, so a table bigger than that cap
    needs successive `.range()` calls). A page shorter than `page_size` is
    the standard signal that it was the last page; note this correctly
    treats a page of EXACTLY `page_size` rows that happens to be the last
    one as needing one more (now-empty) page -- one extra round trip, never
    a truncated result.

    `client` only needs to support the subset of the supabase-py query
    builder used here (`.table().select().like().order().range().execute()`
    returning an object with a `.data` list) -- see the stub client in the
    test suite, which requires no real network access or the `supabase`
    package to be installed.
    """
    like_prefix = f"sec-{reg.lower()}-%"
    rows: list[dict] = []
    start = 0
    while True:
        resp = (
            client.table("provisions")
            .select(EXPORT_COLUMNS)
            .like("id", like_prefix)
            .order("id")
            .range(start, start + page_size - 1)
            .execute()
        )
        page = resp.data or []
        rows.extend(page)
        if len(page) < page_size:
            break
        start += page_size
    return rows


def cmd_export(args) -> None:
    import os

    missing = [n for n in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(n)]
    if missing:
        print(
            f"export requires {' and '.join(missing)} in the environment "
            "(same as summarize.py / apply --execute).",
            file=sys.stderr,
        )
        sys.exit(2)

    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = fetch_export_rows(client, args.reg)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Exported {len(rows)} provisions for Reg {args.reg} (id LIKE 'sec-{args.reg.lower()}-%') -> {out_path}")


# --------------------------------------------------------------------------
# CLI: apply — plan + SQL generator (default), optional --execute path.
#
# See IMPORTER_SPEC.md and pipeline/README.md ("Re-importing a regulation
# from the official PDF") for the human workflow this implements. Nothing in
# this module ever writes to the database unless invoked with BOTH
# `--execute` and `--yes` — the default output is plan.json + hand-reviewable
# SQL files the human runs themselves.
# --------------------------------------------------------------------------

APPLY_CLASS_IDENTICAL = "identical"
APPLY_CLASS_CHANGED = "changed"
APPLY_CLASS_NEW = "new"
APPLY_CLASS_OBSOLETE = "obsolete"

SOURCE_URL_DEFAULT = "https://cdphe.colorado.gov/aqcc-regulations"


def _ws_collapse(text: str) -> str:
    """Collapse-whitespace-only normalization — HTML tags are left intact,
    so a markup difference (e.g. an xref span added/removed/retargeted, or a
    table re-rendered) counts as a real change. This is the ONLY normalization
    used to decide the apply-time 'identical' class (see IMPORTER_SPEC.md /
    the apply task's rule 2) — it is deliberately looser than nothing and
    stricter than `_norm_for_compare` (used only by `diff`, which strips tags
    to report the "visible text identical" count)."""
    return re.sub(r"\s+", " ", text or "").strip()


def _visible_text(text: str) -> str:
    """Tags stripped + whitespace collapsed — used only to detect the
    'markup-only' subset of `changed` rows (visible text identical, only the
    HTML differs) so those can be excluded from the summary-regen list."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()


def classify_apply(parsed: list[dict], db: list[dict]) -> dict:
    """Classifies every id (parsed union db) into identical/changed/new/
    obsolete per the apply task's rule 1, and — for `changed` rows only —
    whether the change is markup-only (rule 2's separate report metric).
    Returns a dict with parsed_by_id/db_by_id plus per-class id lists and a
    {id: markup_only bool} map for the changed class."""
    parsed_by_id = {r["id"]: r for r in parsed}
    db_by_id = {r["id"]: r for r in db}
    parsed_ids = set(parsed_by_id)
    db_ids = set(db_by_id)
    shared = parsed_ids & db_ids

    identical: list[str] = []
    changed: list[str] = []
    markup_only: dict[str, bool] = {}
    for pid in shared:
        p_text = parsed_by_id[pid].get("full_text") or ""
        d_text = db_by_id[pid].get("full_text") or ""
        if _ws_collapse(p_text) == _ws_collapse(d_text):
            identical.append(pid)
        else:
            changed.append(pid)
            markup_only[pid] = _visible_text(p_text) == _visible_text(d_text)

    new_ids = sorted(parsed_ids - db_ids)
    obsolete_ids = sorted(db_ids - parsed_ids)

    return dict(
        parsed_by_id=parsed_by_id,
        db_by_id=db_by_id,
        parsed_ids=parsed_ids,
        db_ids=db_ids,
        identical=sorted(identical),
        changed=sorted(changed),
        markup_only=markup_only,
        new=new_ids,
        obsolete=obsolete_ids,
    )


def nearest_surviving_ancestor(obsolete_id: str, db_by_id: dict, surviving_ids: set) -> str | None:
    """Walks parent_id up from an obsolete (only-in-DB) id, through the OLD
    DB's parent chain (an obsolete row's own parent may itself be obsolete),
    until it reaches an id that survives into the final state (i.e. is in
    the parsed set). Returns None only if the chain runs out before finding
    one (shouldn't happen — the regulation root always survives)."""
    current = db_by_id.get(obsolete_id, {}).get("parent_id")
    seen: set[str] = set()
    while current:
        if current in seen:
            return None  # cycle guard — shouldn't happen in well-formed data
        seen.add(current)
        if current in surviving_ids:
            return current
        node = db_by_id.get(current)
        if not node:
            return None
        current = node.get("parent_id")
    return None


# --------------------------------------------------------------------------
# SQL generation helpers
# --------------------------------------------------------------------------


def sql_dollar_quote(text: str, base_tag: str = "pv") -> str:
    """Dollar-quotes `text` for Postgres, picking a tag ($pv$, $pv2$, $pv3$,
    ...) guaranteed not to occur inside the text itself, so arbitrary content
    (quotes, backslashes, newlines, HTML) needs no character-level escaping
    at all. NULL is represented by the caller as the bare literal `NULL`,
    never routed through this function."""
    text = text if text is not None else ""
    tag = base_tag
    n = 1
    while f"${tag}$" in text:
        n += 1
        tag = f"{base_tag}{n}"
    return f"${tag}${text}${tag}$"


def sql_str_or_null(value) -> str:
    if value is None:
        return "NULL"
    return sql_dollar_quote(str(value))


def sql_int(value) -> str:
    return str(int(value))


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def sql_date(value) -> str:
    return f"DATE {sql_dollar_quote(str(value))}"


class BatchWriter:
    """Accumulates whole SQL statements into files under --out-dir, starting
    a new file whenever appending the next statement would push the current
    file over `max_bytes` (~150 KB, per the apply task spec) — so each file
    can be pasted/executed in one call. Never splits a single statement
    across two files. Files are named '<prefix>_NNN.sql'."""

    def __init__(self, out_dir: Path, prefix: str, max_bytes: int = 150_000):
        self.out_dir = out_dir
        self.prefix = prefix
        self.max_bytes = max_bytes
        self._parts: list[str] = []
        self._size = 0
        self._file_idx = 0
        self.written_files: list[Path] = []

    def _flush(self) -> None:
        if not self._parts:
            return
        self._file_idx += 1
        path = self.out_dir / f"{self.prefix}_{self._file_idx:03d}.sql"
        header = (
            f"-- Generated by pipeline/import_ccr.py apply — file {self._file_idx}, "
            f"{len(self._parts)} statement(s). Review before running.\n\n"
        )
        path.write_text(header + "\n\n".join(self._parts) + "\n", encoding="utf-8")
        self.written_files.append(path)
        self._parts = []
        self._size = 0

    def add_statement(self, stmt: str) -> None:
        stmt_size = len(stmt.encode("utf-8"))
        if self._parts and self._size + stmt_size > self.max_bytes:
            self._flush()
        self._parts.append(stmt)
        self._size += stmt_size

    def close(self) -> list[Path]:
        self._flush()
        return self.written_files


def build_upsert_statement(rows: list[dict]) -> str:
    """One INSERT ... ON CONFLICT (id) DO UPDATE covering a batch of rows
    that share the same treatment (see `_row_sql_values`): every row carries
    every column the table needs for a genuinely new id (jurisdiction_level,
    issuing_body, source_url, is_public, last_verified_date, summary_status
    'pending', full_text) so the INSERT branch is always valid — but the DO
    UPDATE SET clause only ever touches citation/title/parent_id/sort_order/
    updated_at for rows that are `identical` (rule 1: leave full_text and
    every summary_* column alone), or additionally full_text + summary_status
    ('pending') + reviewed_by/reviewed_at/summary_original (all NULL) for
    rows that are `changed` or `new` — ai_summary itself is NEVER written by
    an UPDATE, on either path, so a stale-but-useful summary survives
    untouched until summarize.py regenerates it."""
    cols = [
        "id", "citation", "title", "jurisdiction_level", "issuing_body",
        "parent_id", "full_text", "source_url", "last_verified_date",
        "is_public", "summary_status", "sort_order", "updated_at",
    ]
    values_lines = [f"  ({r['values_sql']})" for r in rows]
    # All rows in one batch share the same `touch_full_text` flag (batches
    # are only ever built from one class at a time — see cmd_apply).
    touch_full_text = rows[0]["touch_full_text"]
    set_clause = [
        "citation = EXCLUDED.citation",
        "title = EXCLUDED.title",
        "parent_id = EXCLUDED.parent_id",
        "sort_order = EXCLUDED.sort_order",
        "updated_at = now()",
    ]
    if touch_full_text:
        set_clause += [
            "full_text = EXCLUDED.full_text",
            "summary_status = 'pending'",
            "reviewed_by = NULL",
            "reviewed_at = NULL",
            "summary_original = NULL",
        ]
    stmt = (
        f"INSERT INTO provisions ({', '.join(cols)})\nVALUES\n"
        + ",\n".join(values_lines)
        + f"\nON CONFLICT (id) DO UPDATE SET\n  " + ",\n  ".join(set_clause) + ";"
    )
    return stmt


def _row_values_sql(row: dict, jurisdiction_level: str, issuing_body: str,
                     source_url: str, last_verified_date, is_public: bool,
                     summary_status: str) -> str:
    # Must produce exactly one value per column in build_upsert_statement's
    # `cols` list, in the same order (...,  sort_order, updated_at) — the
    # trailing `now()` is the updated_at value (no default column value is
    # assumed on either the insert or the ON CONFLICT DO UPDATE branch).
    return ", ".join([
        sql_str_or_null(row["id"]),
        sql_str_or_null(row["citation"]),
        sql_str_or_null(row["title"]),
        sql_str_or_null(jurisdiction_level),
        sql_str_or_null(issuing_body),
        sql_str_or_null(row["parent_id"]),
        sql_str_or_null(row.get("full_text") or ""),
        sql_str_or_null(source_url),
        sql_date(last_verified_date),
        sql_bool(is_public),
        sql_str_or_null(summary_status),
        sql_int(row["sort_order"]),
        "now()",
    ])


def chunk_upsert_rows(rows: list[dict], max_bytes: int) -> list[tuple[bool, list[dict]]]:
    """Splits `rows` (already sorted by sort_order) into (touch_full_text,
    subset) chunks, each small enough that the ONE INSERT statement built
    from it stays comfortably under `max_bytes` — a run of same-treatment
    rows is never forced into a single oversized statement just because it's
    contiguous; it's cut into as many same-order sub-statements as its size
    requires. A chunk never mixes `identical` rows with `changed`/`new` rows
    (they need different UPDATE SET clauses — see build_upsert_statement),
    but relative sort_order across chunk boundaries is preserved since the
    input is pre-sorted and chunks are emitted in the same order."""
    header_overhead = 400  # INSERT/columns/ON CONFLICT boilerplate, generous
    chunks: list[tuple[bool, list[dict]]] = []
    current: list[dict] = []
    current_touch: bool | None = None
    current_size = header_overhead
    for r in rows:
        row_bytes = len(r["values_sql"].encode("utf-8")) + 8  # "  (" + "),\n"
        if current and (r["touch_full_text"] != current_touch or current_size + row_bytes > max_bytes):
            chunks.append((current_touch, current))
            current = []
            current_size = header_overhead
        current.append(r)
        current_touch = r["touch_full_text"]
        current_size += row_bytes
    if current:
        chunks.append((current_touch, current))
    return chunks


def build_delete_statement(ids: list[str]) -> str:
    id_list = ",\n  ".join(sql_dollar_quote(i) for i in ids)
    return f"DELETE FROM provisions\nWHERE id IN (\n  {id_list}\n);"


def build_provision_change_insert(ancestor_id: str, note: str) -> str:
    # change_type is DB-constrained to
    # ('summary_approved','summary_edited','summary_rejected','text_updated',
    # 'added') -- there is no 'provision_removed' value, so a removal note is
    # logged as 'text_updated' against the surviving ancestor (this is what
    # was actually run for the Reg 7 re-import -- see
    # pipeline/out/apply_reg7/finish.sql).
    return (
        "INSERT INTO provision_changes (provision_id, change_type, note)\nVALUES ("
        f"{sql_dollar_quote(ancestor_id)}, {sql_dollar_quote('text_updated')}, "
        f"{sql_dollar_quote(note)});"
    )


def cmd_apply(args):
    if not args.parsed or not args.db or not args.out_dir:
        print("apply requires --parsed, --db, and --out-dir (see --help).", file=sys.stderr)
        sys.exit(2)

    reg = args.reg
    parsed = json.loads(Path(args.parsed).read_text(encoding="utf-8"))
    db = json.loads(Path(args.db).read_text(encoding="utf-8"))
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    c = classify_apply(parsed, db)
    parsed_by_id, db_by_id = c["parsed_by_id"], c["db_by_id"]
    surviving_ids = c["parsed_ids"]  # obsolete ids are removed; every parsed id survives

    if ZoneInfo is not None:
        today = datetime.now(ZoneInfo("America/Denver")).date().isoformat()
    else:  # pragma: no cover
        today = datetime.utcnow().date().isoformat()

    # ---- Build the per-id plan -------------------------------------------------
    plan: list[dict] = []
    regen_ids: list[str] = []

    for pid in c["identical"]:
        row = parsed_by_id[pid]
        plan.append(dict(
            id=pid, klass=APPLY_CLASS_IDENTICAL, reason="full_text identical after whitespace normalization",
            citation=row["citation"], title=row["title"], parent_id=row["parent_id"], sort_order=row["sort_order"],
        ))

    for pid in c["changed"]:
        row = parsed_by_id[pid]
        mo = c["markup_only"][pid]
        reason = (
            "visible text unchanged; only HTML markup differs (e.g. xref spans, table rendering) "
            "— stored HTML replaced but no summary regeneration needed"
            if mo else
            "visible text differs from current DB — full_text replaced, summary marked pending for regeneration"
        )
        plan.append(dict(
            id=pid, klass=APPLY_CLASS_CHANGED, reason=reason, markup_only=mo,
            citation=row["citation"], title=row["title"], parent_id=row["parent_id"], sort_order=row["sort_order"],
        ))
        if not mo:
            regen_ids.append(pid)

    for pid in c["new"]:
        row = parsed_by_id[pid]
        plan.append(dict(
            id=pid, klass=APPLY_CLASS_NEW, reason="only in parsed output — new provision, inserted",
            citation=row["citation"], title=row["title"], parent_id=row["parent_id"], sort_order=row["sort_order"],
        ))
        regen_ids.append(pid)

    ancestor_for: dict[str, str | None] = {}
    for pid in c["obsolete"]:
        row = db_by_id[pid]
        ancestor = nearest_surviving_ancestor(pid, db_by_id, surviving_ids)
        ancestor_for[pid] = ancestor
        note = (
            f"{row.get('citation') or pid} removed in re-import from official CCR text "
            f"(Sept 2026); no longer in the current regulation"
        )
        plan.append(dict(
            id=pid, klass=APPLY_CLASS_OBSOLETE, reason="only in current DB — deleted",
            citation=row.get("citation"), title=row.get("title"), parent_id=row.get("parent_id"),
            sort_order=row.get("sort_order"), ancestor_id=ancestor, note=note,
        ))

    missing_ancestor = [pid for pid, a in ancestor_for.items() if a is None]

    # Order the plan by sort_order for readability / to match the SQL ordering
    # (identical/changed/new share the parsed sort_order namespace; obsolete
    # rows use their old DB sort_order just for the listing).
    plan.sort(key=lambda p: (p["sort_order"] if p["sort_order"] is not None else 0, p["id"]))

    plan_path = out_dir / "plan.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")

    regen_ids_sorted = sorted(regen_ids, key=lambda i: parsed_by_id[i]["sort_order"])
    regen_path = out_dir / "summary_regen_ids.txt"
    regen_path.write_text("\n".join(regen_ids_sorted) + ("\n" if regen_ids_sorted else ""), encoding="utf-8")

    # ---- Sanity checks (printed + written into stats.md) -----------------------
    final_ids = surviving_ids
    dangling_parents = sorted(
        pid for pid in final_ids
        if parsed_by_id[pid]["parent_id"] is not None and parsed_by_id[pid]["parent_id"] not in final_ids
    )
    both_delete_and_upsert = sorted(set(c["obsolete"]) & final_ids)

    markup_only_count = sum(1 for pid in c["changed"] if c["markup_only"][pid])
    changed_needing_regen = len(c["changed"]) - markup_only_count

    stats_lines = [
        f"# Reg {reg} apply plan — stats\n",
        f"- Parsed rows (final state, `new`+`changed`+`identical`): **{len(parsed)}**",
        f"- Shared ids (in both parsed and current DB): **{len(c['identical']) + len(c['changed'])}**",
        f"- `identical` (no text/summary change): **{len(c['identical'])}**",
        f"- `changed` (full_text replaced, ai_summary kept, summary_status→pending): **{len(c['changed'])}**",
        f"  - of which markup-only (visible text unchanged — no regen needed): **{markup_only_count}**",
        f"  - of which visible text changed (regen needed): **{changed_needing_regen}**",
        f"- `new` (inserted): **{len(c['new'])}**",
        f"- `obsolete` (deleted): **{len(c['obsolete'])}**",
        f"- Total ids to feed summarize.py --ids-file: **{len(regen_ids_sorted)}** "
        f"({len(c['new'])} new + {changed_needing_regen} changed-with-visible-text-change)",
        "",
        "## Sanity checks\n",
        f"- Every parent_id referenced in the final state exists in the final state: "
        f"{'PASS' if not dangling_parents else 'FAIL — ' + str(len(dangling_parents)) + ' dangling: ' + ', '.join(dangling_parents[:20])}",
        f"- No id in both delete and upsert sets: "
        f"{'PASS' if not both_delete_and_upsert else 'FAIL — ' + str(both_delete_and_upsert[:20])}",
        f"- Every obsolete id resolved to a surviving ancestor: "
        f"{'PASS' if not missing_ancestor else 'FAIL — ' + str(len(missing_ancestor)) + ' unresolved: ' + ', '.join(missing_ancestor[:20])}",
        "",
    ]
    stats_path = out_dir / "stats.md"
    stats_path.write_text("\n".join(stats_lines), encoding="utf-8")

    print(f"Wrote plan -> {plan_path}")
    print(f"Wrote regen id list ({len(regen_ids_sorted)} ids) -> {regen_path}")
    print(f"Wrote stats -> {stats_path}")
    print("\n".join(stats_lines))

    if dangling_parents:
        print(f"WARNING: {len(dangling_parents)} dangling parent_id(s) in final state.", file=sys.stderr)
    if both_delete_and_upsert:
        print(f"WARNING: {len(both_delete_and_upsert)} id(s) in both delete and upsert sets.", file=sys.stderr)
    if missing_ancestor:
        print(f"WARNING: {len(missing_ancestor)} obsolete id(s) had no resolvable surviving ancestor.", file=sys.stderr)

    # ---- SQL generation ----------------------------------------------------
    # One ordered upsert stream (rule 3): identical + changed + new rows,
    # sorted by sort_order so a parent (always a lower sort_order than any of
    # its descendants — see build_provisions()'s next_sort()) is always
    # inserted/updated before a child that might reference it, including a
    # `changed` row re-parented onto a brand-new id. Consecutive rows that
    # need the SAME UPDATE SET clause (all `identical`, or all `changed`/
    # `new`) are combined into one multi-row INSERT ... ON CONFLICT statement;
    # a change in treatment (or the ~150KB size cap) starts a new statement.
    upsert_rows = []
    for pid in c["identical"]:
        row = parsed_by_id[pid]
        upsert_rows.append(dict(
            id=pid, sort_order=row["sort_order"], touch_full_text=False,
            values_sql=_row_values_sql(
                row, "state", "CDPHE-APCD", SOURCE_URL_DEFAULT, today, False,
                # summary_status is never touched for `identical` (not in SET
                # clause), but the INSERT branch still needs a legal value in
                # case this exact id is somehow new by the time this runs —
                # 'pending' matches every other Reg 7 row's default.
                "pending",
            ),
        ))
    for pid in c["changed"] + c["new"]:
        row = parsed_by_id[pid]
        upsert_rows.append(dict(
            id=pid, sort_order=row["sort_order"], touch_full_text=True,
            values_sql=_row_values_sql(
                row, "state", "CDPHE-APCD", SOURCE_URL_DEFAULT, today, False, "pending",
            ),
        ))
    upsert_rows.sort(key=lambda r: (r["sort_order"], r["id"]))

    writer = BatchWriter(out_dir, "01_upsert", max_bytes=args.batch_bytes)
    for _touch, chunk_rows in chunk_upsert_rows(upsert_rows, args.batch_bytes):
        writer.add_statement(build_upsert_statement(chunk_rows))
    upsert_files = writer.close()

    # provision_changes notes for every obsolete row, on its nearest
    # surviving ancestor (rule 4) — small, one file is plenty.
    notes_writer = BatchWriter(out_dir, "02_provision_removed_notes", max_bytes=args.batch_bytes)
    for pid in c["obsolete"]:
        ancestor = ancestor_for[pid]
        if ancestor is None:
            continue  # already flagged above; nothing safe to insert against
        row = db_by_id[pid]
        note = f"{row.get('citation') or pid} removed in re-import from official CCR text (Sept 2026); no longer in the current regulation"
        notes_writer.add_statement(build_provision_change_insert(ancestor, note))
    notes_files = notes_writer.close()

    # Deletes last (rule 3) — small enough for one file, but still routed
    # through BatchWriter for the size guarantee.
    deletes_writer = BatchWriter(out_dir, "03_deletes", max_bytes=args.batch_bytes)
    if c["obsolete"]:
        deletes_writer.add_statement(build_delete_statement(c["obsolete"]))
    delete_files = deletes_writer.close()

    all_sql_files = upsert_files + notes_files + delete_files
    print("\nSQL files written (run in this order):")
    total_bytes = 0
    for p in all_sql_files:
        size = p.stat().st_size
        total_bytes += size
        print(f"  {p}  ({size:,} bytes)")
    print(f"  total: {len(all_sql_files)} files, {total_bytes:,} bytes")

    # Cheap structural validation of every generated file: no unbalanced
    # dollar-quote tags, and a plausible statement count. (sqlparse is not
    # installed in this environment; fall back to counting top-level `;`
    # terminators outside of dollar-quoted strings, which is exact for SQL
    # we generate ourselves since we never emit a literal `;` inside a
    # dollar-quoted string un-escaped — dollar-quoting needs no escaping at
    # all, so this is a real semicolon count, not a heuristic.)
    try:
        import sqlparse  # type: ignore
        have_sqlparse = True
    except ImportError:
        have_sqlparse = False

    print("\nValidation:")
    for p in all_sql_files:
        text = p.read_text(encoding="utf-8")
        if have_sqlparse:
            n_stmts = len([s for s in sqlparse.split(text) if s.strip()])
        else:
            n_stmts = _count_top_level_statements(text)
        # Dollar-quote tag balance: every $tag$ must appear an even number of times.
        tags = re.findall(r"\$(\w*)\$", text)
        tag_counts = Counter(tags)
        unbalanced = [t for t, n in tag_counts.items() if n % 2 != 0]
        status = "OK" if not unbalanced else f"UNBALANCED TAGS: {unbalanced}"
        print(f"  {p.name}: {n_stmts} statement(s) {'(sqlparse)' if have_sqlparse else '(semicolon count)'} — {status}")

    if args.execute:
        cmd_apply_execute(args, c, ancestor_for, today)


def _count_top_level_statements(sql_text: str) -> int:
    """Counts `;` statement terminators that are NOT inside a $tag$...$tag$
    dollar-quoted string. Exact for SQL this module generates (see comment
    at the call site) since every string literal here is dollar-quoted."""
    count = 0
    i = 0
    n = len(sql_text)
    tag_re = re.compile(r"\$(\w*)\$")
    while i < n:
        ch = sql_text[i]
        if ch == "$":
            m = tag_re.match(sql_text, i)
            if m:
                tag = m.group(0)
                end = sql_text.find(tag, m.end())
                if end == -1:
                    i = m.end()
                else:
                    i = end + len(tag)
                    continue
        elif ch == ";":
            count += 1
        i += 1
    return count


EXECUTE_CHUNK = 100  # supabase-py insert/delete chunk size cap (rule 5) -- update() is always one row at a time.


def _execute_identical_fields(row: dict, now_iso: str) -> dict:
    """Mirrors build_upsert_statement's UPDATE SET clause for an `identical`
    row: citation/title/parent_id/sort_order/updated_at only.
    jurisdiction_level/issuing_body/source_url/last_verified_date/is_public/
    full_text/summary_status/ai_summary are DELIBERATELY left out: this is
    sent as a real SQL UPDATE (`.update(...).eq("id", pid)`, never
    `.upsert()` -- see cmd_apply_execute's docstring for why upsert can
    never be used here), so any column not in this dict is simply not
    touched, exactly like the SQL path's SET clause for `identical` rows.
    `updated_at` is included explicitly to mirror the SQL path even though
    the `provisions_set_updated_at` trigger would set it on any UPDATE
    regardless."""
    return {
        "citation": row["citation"], "title": row["title"],
        "parent_id": row["parent_id"], "sort_order": row["sort_order"],
        "updated_at": now_iso,
    }


def _execute_changed_fields(row: dict, now_iso: str) -> dict:
    """Adds full_text + clears summary review state, matching
    build_upsert_statement's `touch_full_text` branch. Still omits
    jurisdiction_level/issuing_body/source_url/last_verified_date/is_public
    (an id classified `changed` is, by construction, already a row in the
    DB -- classify_apply's `changed` is the shared-id set with different
    text -- so those columns are never touched by the SQL path's SET clause
    for this class either) and never touches ai_summary."""
    fields = _execute_identical_fields(row, now_iso)
    fields.update({
        "full_text": row.get("full_text") or "",
        "summary_status": "pending",
        "reviewed_by": None,
        "reviewed_at": None,
        "summary_original": None,
    })
    return fields


def _execute_new_payload(row: dict, today: str, now_iso: str) -> dict:
    """A genuine INSERT (no existing row to preserve columns from), so every
    NOT NULL column the table requires is populated -- the same column list
    as `build_upsert_statement`'s `cols`. Unlike `.update()`, `.insert()`
    needs `id` in the payload."""
    payload = _execute_changed_fields(row, now_iso)
    payload.update({
        "id": row["id"],
        "jurisdiction_level": "state",
        "issuing_body": "CDPHE-APCD",
        "source_url": SOURCE_URL_DEFAULT,
        "last_verified_date": today,
        "is_public": False,
    })
    return payload


def _execute_write_plan(c: dict, today: str, now_iso: str, chunk_size: int = EXECUTE_CHUNK) -> list[dict]:
    """Returns an ordered list of write actions for every identical/changed/
    new row, covering the whole stream in a SINGLE (sort_order, id) order --
    exactly like the SQL path's `upsert_rows` -- so a brand-new parent is
    always written before any child (of any class) that references it: a
    parent's sort_order is always lower than any of its descendants' (see
    build_provisions' next_sort()), so processing strictly in that order and
    performing each row's write no later than when it's reached guarantees
    this regardless of class.

    Each action is one of:
      {"op": "insert", "payloads": [...]}   -- a contiguous run of up to
        `chunk_size` `new` rows, inserted together in one call.
      {"op": "update", "id": pid, "shape": "identical"|"changed", "payload": {...}}
        -- one `identical`/`changed` row, applied with its own PATCH.

    A pending run of `new` rows is flushed (turned into an "insert" action)
    before emitting the next `identical`/`changed` update, and whenever it
    reaches `chunk_size` -- so an insert is never left pending past a point
    where a later-sorted row might depend on it, and no insert batch ever
    exceeds `chunk_size` rows."""
    parsed_by_id = c["parsed_by_id"]
    stream: list[tuple[int, str, str]] = (
        [(parsed_by_id[pid]["sort_order"], pid, "identical") for pid in c["identical"]]
        + [(parsed_by_id[pid]["sort_order"], pid, "changed") for pid in c["changed"]]
        + [(parsed_by_id[pid]["sort_order"], pid, "new") for pid in c["new"]]
    )
    stream.sort(key=lambda t: (t[0], t[1]))

    actions: list[dict] = []
    pending_new: list[dict] = []

    def flush_new() -> None:
        nonlocal pending_new
        if pending_new:
            actions.append({"op": "insert", "payloads": pending_new})
            pending_new = []

    for _sort_order, pid, shape in stream:
        row = parsed_by_id[pid]
        if shape == "new":
            pending_new.append(_execute_new_payload(row, today, now_iso))
            if len(pending_new) >= chunk_size:
                flush_new()
        else:
            flush_new()
            fields = _execute_identical_fields(row, now_iso) if shape == "identical" else _execute_changed_fields(row, now_iso)
            actions.append({"op": "update", "id": pid, "shape": shape, "payload": fields})
    flush_new()
    return actions


def cmd_apply_execute(args, c: dict, ancestor_for: dict, today: str) -> None:
    """The --execute path: performs the same plan via the Supabase REST API
    (supabase-py), for the GitHub Actions job. Requires --yes as an explicit
    double-check (refuses otherwise) and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
    in the environment — same convention as summarize.py.

    `identical`/`changed` rows are always existing rows (classify_apply's
    `identical`/`changed` are exactly the shared-id set), so they're written
    with a real `.update(payload).eq("id", pid)` PATCH, never `.upsert()`:
    PostgREST's upsert is `INSERT ... ON CONFLICT DO UPDATE`, and Postgres
    builds the INSERT row -- with every column missing from the payload set
    to NULL -- before it even checks the conflict, so an upsert payload that
    omits a NOT NULL column (as an `identical`/`changed` payload deliberately
    does, to leave those columns alone on the UPDATE branch) fails the
    table's NOT NULL constraints even though the row already exists and the
    UPDATE branch is what was actually meant to run. `new` rows have no
    existing row to preserve columns from, so they're genuinely `.insert()`ed
    (not upserted) with every NOT NULL column populated, in chunks of at
    most `EXECUTE_CHUNK` rows.

    Every write (each update, each insert chunk, each provision_changes
    insert, each delete chunk) is unguarded against exceptions:
    supabase-py/postgrest-py raises on a non-2xx response, which — since
    nothing here catches it — propagates out of this function and out of
    `main()`, giving a non-zero process exit. There is deliberately no
    try/except that logs and continues: a failed write must abort the run
    rather than leave the DB partially updated with later writes silently
    skipped. An `.update()` that matches zero rows is a *successful* HTTP
    call by PostgREST's own convention (no exception raised), so that case
    is checked explicitly and aborted here too."""
    import os

    if not args.yes:
        print("--execute requires --yes as an explicit confirmation. Refusing.", file=sys.stderr)
        sys.exit(2)
    for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not os.environ.get(name):
            print(f"--execute requires {name} in the environment.", file=sys.stderr)
            sys.exit(2)

    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    db_by_id = c["db_by_id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    total = len(c["identical"]) + len(c["changed"]) + len(c["new"])
    print(
        f"Writing {total} rows (identical={len(c['identical'])} + changed={len(c['changed'])} via "
        f"one UPDATE each, new={len(c['new'])} via INSERT in chunks of <= {EXECUTE_CHUNK}), "
        f"ordered by sort_order so parents precede children..."
    )
    done = 0
    for action in _execute_write_plan(c, today, now_iso, EXECUTE_CHUNK):
        if action["op"] == "insert":
            payloads = action["payloads"]
            client.table("provisions").insert(payloads).execute()
            done += len(payloads)
            print(f"  inserted {done}/{total} (new chunk of {len(payloads)})")
        else:
            pid = action["id"]
            resp = client.table("provisions").update(action["payload"]).eq("id", pid).execute()
            if not resp.data:
                print(
                    f"ERROR: UPDATE for {pid} ({action['shape']}) matched zero rows -- it should already "
                    "exist (classify_apply only puts shared ids in identical/changed). Aborting rather than "
                    "silently skipping it.",
                    file=sys.stderr,
                )
                sys.exit(1)
            done += 1
            if done % 200 == 0 or done == total:
                print(f"  updated {done}/{total}")

    if c["obsolete"]:
        print(f"Inserting {len(c['obsolete'])} provision_changes removal note(s)...")
        for pid in c["obsolete"]:
            ancestor = ancestor_for.get(pid)
            if ancestor is None:
                print(f"  WARNING: skipping removal note for {pid} — no surviving ancestor found.", file=sys.stderr)
                continue
            row = db_by_id[pid]
            note = f"{row.get('citation') or pid} removed in re-import from official CCR text (Sept 2026); no longer in the current regulation"
            # change_type is DB-constrained (see build_provision_change_insert) --
            # no 'provision_removed' value exists, so this is logged as
            # 'text_updated' against the surviving ancestor.
            client.table("provision_changes").insert({
                "provision_id": ancestor, "change_type": "text_updated", "note": note,
            }).execute()

        print(f"Deleting {len(c['obsolete'])} obsolete row(s)...")
        for i in range(0, len(c["obsolete"]), EXECUTE_CHUNK):
            chunk = c["obsolete"][i:i + EXECUTE_CHUNK]
            client.table("provisions").delete().in_("id", chunk).execute()
            print(f"  deleted {i + len(chunk)}/{len(c['obsolete'])}")

    print("Execute complete.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_parse = sub.add_parser("parse", help="Parse a regulation's pdftotext output into provisions JSON.")
    p_parse.add_argument("--reg", required=True)
    p_parse.add_argument("--pdf", required=True, help="Path to the source .pdf (for pdfplumber table extraction).")
    p_parse.add_argument("--txt", default=None, help="Path to pdftotext -layout output (defaults to sources/REG_<reg>.txt).")
    p_parse.add_argument("--out", required=True)
    p_parse.set_defaults(func=cmd_parse)

    p_export = sub.add_parser(
        "export",
        help="Read-only export of a regulation's current provisions rows from Supabase "
             "(id LIKE 'sec-<reg>-%%'), for use as `diff`/`apply`'s --db input. Requires "
             "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment; makes no writes.",
    )
    p_export.add_argument("--reg", required=True)
    p_export.add_argument("--out", required=True)
    p_export.set_defaults(func=cmd_export)

    p_diff = sub.add_parser("diff", help="Diff parsed output against an exported DB snapshot.")
    p_diff.add_argument("--reg", required=True)
    p_diff.add_argument("--parsed", required=True)
    p_diff.add_argument("--db", required=True)
    p_diff.add_argument("--out", required=True)
    p_diff.set_defaults(func=cmd_diff)

    p_apply = sub.add_parser(
        "apply",
        help="Build a plan + hand-reviewable SQL files from a diff (default); "
             "optionally --execute the same plan against Supabase directly.",
    )
    p_apply.add_argument("--reg", required=True)
    p_apply.add_argument("--parsed", required=True, help="Path to reg{N}_parsed.json.")
    p_apply.add_argument("--db", required=True, help="Path to reg{N}_db.json.")
    p_apply.add_argument("--out-dir", required=True, help="Directory to write plan.json/stats.md/SQL files into.")
    p_apply.add_argument("--batch-bytes", type=int, default=150_000,
                          help="Max size per generated SQL file, in bytes.")
    p_apply.add_argument("--execute", action="store_true",
                          help="Also perform the plan via the Supabase REST API "
                               "(supabase-py), for the GitHub Actions job. Requires --yes. "
                               "No database writes happen without both flags.")
    p_apply.add_argument("--yes", action="store_true",
                          help="Required alongside --execute as an explicit confirmation.")
    p_apply.set_defaults(func=cmd_apply)

    args = ap.parse_args()
    if args.cmd == "parse" and args.txt is None:
        args.txt = str(Path(args.pdf).with_suffix(".txt"))
    args.func(args)


if __name__ == "__main__":
    main()
