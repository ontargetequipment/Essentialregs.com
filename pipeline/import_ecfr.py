#!/usr/bin/env python3
"""
eCFR importer for essentialregs.com.

Parses the eCFR "enhanced display" PDF prints of 40 CFR Part 60 Subparts
OOOOa, OOOOb and OOOOc (`pdftotext -layout` output) into the same
`provisions` row shape the CCR importer (`pipeline/import_ccr.py`) produces
-- {id, citation, title, parent_id, sort_order, full_text, kind} -- so the
existing diff/apply machinery in import_ccr.py works unchanged.

This module is self-contained (does not import from import_ccr.py) because
another session edits import_ccr.py concurrently; the two are wired together
by a single tiny dispatch hook at the bottom of import_ccr.py's `parse`
subcommand (see IMPORTER_SPEC.md / pipeline/README.md).

Id scheme (new, deeper granularity than the 40 whole-section rows currently
in the DB for OOOOb):
    Root:      sec-oooob-top-REG-oooob
    Section:   sec-oooob-60.5397b
    Paragraph: sec-oooob-60.5397b-(g)
               sec-oooob-60.5397b-(g)-(1)
               sec-oooob-60.5397b-(g)-(1)-(i)
               sec-oooob-60.5397b-(g)-(1)-(i)-(A)
    Table:     sec-oooob-TABLE-1  (kind "appendix")

CFR paragraph-label cycle: (a) -> (1) -> (i) -> (A) -> (1) -> (i) -> ...
(alpha, digit, lower-roman, upper-alpha, then digit/roman alternating).

Subcommand:
    parse --reg oooob --pdf pipeline/sources/OOOOb.pdf \
          --txt pipeline/sources/OOOOb.txt --out pipeline/out/oooob_parsed.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

FF = "\x0c"  # form-feed: pdftotext -layout emits exactly one per PDF page

# --------------------------------------------------------------------------
# Regulation metadata
# --------------------------------------------------------------------------

# Canonical reg keys used by this module / the CLI --reg flag: oooob / ooooa / ooooc.
SUBPART_LETTER = {"oooob": "b", "ooooa": "a", "ooooc": "c"}
SUBPART_CODE = {"oooob": "OOOOb", "ooooa": "OOOOa", "ooooc": "OOOOc"}
ECFR_URL = {
    "oooob": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOb",
    "ooooa": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOa",
    "ooooc": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOc",
}
# All three subparts are in the corpus (cross-linkable to one another).
CORPUS_REGS = {"oooob", "ooooa", "ooooc"}
LETTER_TO_REG = {v: k for k, v in SUBPART_LETTER.items()}


def _norm_reg(reg: str) -> str:
    r = reg.lower()
    if r in ("oooob",):
        return "oooob"
    if r in ("ooooa",):
        return "ooooa"
    if r in ("ooooc",):
        return "ooooc"
    raise ValueError(f"unknown eCFR reg key: {reg!r} (expected oooob/ooooa/ooooc)")


# --------------------------------------------------------------------------
# Page furniture stripping
# --------------------------------------------------------------------------

HEADER1_RE = re.compile(r"\(up to date as of \d{1,2}/\d{1,2}/\d{4}\)\s*$")
HEADER1_ANYWHERE_RE = re.compile(r"\(up to date as of \d{1,2}/\d{1,2}/\d{4}\)")
FOOTER_RE = re.compile(r"\(enhanced display\)\s+page \d+ of \d+\s*$")
BANNER_RE = re.compile(r"^This content is from the eCFR and is authoritative but unofficial\.\s*$")
AMEND_NOTE_RE = re.compile(r"^\[\d+\s+FR\s+\d+.*\]\s*$")


def strip_page_furniture(raw: str) -> list[str]:
    """Removes the running header block (3 lines: 'up to date as of ...',
    the right-justified current-position line, the truncated subject-title
    line), the footer line ('... (enhanced display) page N of M'), and the
    one-time eCFR disclaimer banner. Positional, not content-based, for the
    header/footer lines (their middle-line content is arbitrary per page) --
    see pipeline/IMPORTER_SPEC.md discussion / this module's docstring.
    """
    pages = raw.split(FF)
    out: list[str] = []
    for page in pages:
        lines = page.split("\n")
        i = 0
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i < len(lines) and HEADER1_RE.search(lines[i]):
            del lines[i : i + 3]
        elif i < len(lines) and HEADER1_ANYWHERE_RE.search(lines[i]):
            # Rare pdftotext layout hiccup: the running-position header (line
            # 2 of the usual 3-line block) gets merged onto the same
            # physical line as line 1, and the truncated-title line (3) picks
            # up the tail of that merge -- 2 physical lines carry the whole
            # header block instead of 3. The header content lost this way is
            # itself furniture (a repeat of the section citation already
            # printed properly in the body); nothing unique is lost.
            del lines[i : i + 2]
        j = len(lines) - 1
        while j >= 0 and not lines[j].strip():
            j -= 1
        if j >= 0 and FOOTER_RE.search(lines[j]):
            del lines[j]
        lines = [ln for ln in lines if not BANNER_RE.match(ln.strip()) and not AMEND_NOTE_RE.match(ln.strip())]
        out.extend(lines)
    return out


def find_page_leaks(text: str) -> bool:
    """True if page furniture leaked into rendered text (used by tests / the
    audit)."""
    return bool(
        re.search(r"enhanced display|up to date as of|eCFR and is authoritative", text, re.I)
    )


# --------------------------------------------------------------------------
# Body / TOC boundary
# --------------------------------------------------------------------------

BODY_HEADING_RE = re.compile(r"^Subpart OOOO[ABCabc]—")
SOURCE_LINE_RE = re.compile(r"^\s*Source:\s")
SECTION_LINE_RE = re.compile(r"^§\s*60\.(\d{3,5})([a-c])\b(.*)$")
RANGE_RESERVED_RE = re.compile(
    r"^§§\s*60\.(\d{3,5}[a-c])-60\.(\d{3,5}[a-c])\s*\[Reserved\]\s*$"
)
TABLE_CAPTION_RE = re.compile(
    r"^Table\s+(\d+)\s+to\s+Subpart\s+OOOO[ABCabc]\s+of\s+Part\s+60—(.*)$"
)


def find_body_start(lines: list[str]) -> tuple[int, int]:
    """Returns (toc_prelude_end, body_start): the index of the real "Subpart
    OOOOx—..." heading (with em dash) that starts the operative text --
    everything before it (the intro block + table of contents) must not
    create rows -- and the index of the first line after the following
    "Source:" line (and its trailing blanks). That first line is usually a
    "§" section heading, but for OOOOc it can be a centered ALL-CAPS group
    heading ("INTRODUCTION") that itself precedes the first section --
    stopping only at "§" would silently drop it, so the block scanner (which
    recognizes group headings itself) is left to handle whatever comes
    first.
    """
    heading_idx = None
    for i, ln in enumerate(lines):
        if BODY_HEADING_RE.match(ln):
            heading_idx = i  # keep looking; take the LAST match (real body, not any earlier mention)
    if heading_idx is None:
        raise ValueError("could not find the operative 'Subpart OOOOx—...' heading")
    j = heading_idx
    while j < len(lines) and not SOURCE_LINE_RE.match(lines[j]):
        j += 1
    k = j + 1
    while k < len(lines) and not lines[k].strip():
        k += 1
    return heading_idx, k


def extract_toc(lines: list[str], toc_end: int) -> tuple[dict[str, str], dict[str, str]]:
    """Parses the table-of-contents block (lines[0:toc_end]) into:
    - toc_sections: {"60.5397b": "full joined heading text"} (for the
      "missing sections" audit -- these must NOT become rows themselves)
    - toc_groups: {NORMALIZED upper-case text: pretty-cased text} for
      structural group headings (OOOOc's "Introduction", "Model Rule --
      Definitions", etc.) that also recur, in ALL CAPS and centered, in the
      body -- used only to give those body headings nicer display casing.
    """
    toc_sections: dict[str, str] = {}
    toc_groups: dict[str, str] = {}
    i = 0
    # Skip the intro "Subpart OOOOx <title...>" block up to the first
    # "§"/"Table"/group-heading line.
    while i < toc_end and not lines[i].strip().lstrip().startswith(("§", "Table")):
        stripped = lines[i].strip()
        if stripped and not stripped.startswith(("Subpart ", "Which ", "Construction", "commenced")) and i > 0:
            # heuristic: once we've moved past the very first heading lines,
            # treat non-blank non-continuation lines as potential group
            # headers even this early (rare); harmless if unused.
            pass
        i += 1
    while i < toc_end:
        raw = lines[i]
        stripped = raw.strip()
        if not stripped:
            i += 1
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        m = SECTION_LINE_RE.match(stripped) or re.match(r"^§§\s*60\.(\d{3,5}[a-c])", stripped)
        if stripped.startswith("§"):
            # Join wrapped continuation lines (indented further right, not
            # themselves starting a new "§"/"Table" entry).
            buf = [stripped]
            j = i + 1
            while j < toc_end:
                nxt = lines[j]
                nstripped = nxt.strip()
                if not nstripped:
                    break
                nindent = len(nxt) - len(nxt.lstrip(" "))
                if nindent <= indent or nstripped.startswith(("§", "Table")):
                    break
                buf.append(nstripped)
                j += 1
            full = " ".join(buf)
            full = re.sub(r"\s+", " ", full).strip()
            secm = re.search(r"60\.\d{3,5}[a-c]", full)
            if secm:
                toc_sections[secm.group(0)] = full
            i = j
            continue
        if stripped.startswith("Table"):
            i += 1
            continue
        # A standalone group heading line (OOOOc's "Introduction" etc.)
        norm = re.sub(r"\s+", " ", stripped).strip().upper()
        if norm and not norm.startswith("SUBPART ") and 2 <= len(norm.split()) <= 8:
            toc_groups[norm] = re.sub(r"\s+", " ", stripped).strip()
        i += 1
    return toc_sections, toc_groups


GROUP_HEADING_RE = re.compile(r"^[A-Z][A-Z0-9 ,.'—/()&-]{3,80}$")


def is_group_heading_line(raw_line: str) -> bool:
    stripped = raw_line.strip()
    if not stripped or stripped.startswith(("§", "[")) or stripped.upper().startswith("TABLE"):
        return False
    indent = len(raw_line) - len(raw_line.lstrip(" "))
    # Real group headings are horizontally centered (observed indent 29-51
    # across all 3 subparts); a merged all-caps abbreviation fragment inside
    # a normal paragraph continuation (e.g. a stray "CFR." from a wrapped
    # "40 CFR 71.2 40\nCFR." page-seam artifact) sits at ordinary paragraph
    # indentation (<=23) and must not be mistaken for one.
    if indent < 25:
        return False
    if len(stripped) < 6:
        return False
    if not GROUP_HEADING_RE.match(stripped):
        return False
    # Must contain at least one letter and be mostly uppercase (not a
    # sentence in title case, not all-numeric).
    letters = [c for c in stripped if c.isalpha()]
    if not letters:
        return False
    return all(c == c.upper() for c in letters)


# --------------------------------------------------------------------------
# CFR paragraph-label cycle: (a) -> (1) -> (i) -> (A) -> (1) -> (i) -> ...
# --------------------------------------------------------------------------

_ROMAN_VALUES = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
_ROMAN_TABLE = [
    (1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"),
    (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i"),
]


def _roman_to_int(s: str) -> int:
    s = s.lower()
    total = 0
    prev = 0
    for ch in reversed(s):
        v = _ROMAN_VALUES.get(ch, 0)
        total += v if v >= prev else -v
        prev = max(prev, v)
    return total


def _int_to_roman(n: int) -> str:
    out = []
    for val, sym in _ROMAN_TABLE:
        while n >= val:
            out.append(sym)
            n -= val
    return "".join(out)


def _next_base26(s: str) -> str:
    """'a'->'b', ..., 'z'->'aa', 'az'->'ba' (base-26, no letter I/O skipped --
    CFR alpha lists just use plain a..z)."""
    chars = list(s.lower())
    i = len(chars) - 1
    while i >= 0:
        if chars[i] != "z":
            chars[i] = chr(ord(chars[i]) + 1)
            return "".join(chars)
        chars[i] = "a"
        i -= 1
    return "a" + "".join(chars)


def family_for_depth(depth: int) -> str:
    order = ["alpha", "digit", "roman", "ALPHA"]
    if depth <= 4:
        return order[depth - 1]
    idx = depth - 5
    return "digit" if idx % 2 == 0 else "roman"


def first_of_family(family: str) -> str:
    return {"alpha": "a", "digit": "1", "roman": "i", "ALPHA": "A"}[family]


def next_of_family(family: str, value: str) -> str:
    if family == "alpha":
        return _next_base26(value)
    if family == "ALPHA":
        return _next_base26(value).upper()
    if family == "digit":
        return str(int(value) + 1)
    if family == "roman":
        return _int_to_roman(_roman_to_int(value) + 1)
    raise ValueError(family)


def shape_matches(family: str, value: str) -> bool:
    if family == "alpha":
        return bool(re.fullmatch(r"[a-z]{1,3}", value))
    if family == "ALPHA":
        return bool(re.fullmatch(r"[A-Z]{1,3}", value))
    if family == "digit":
        return bool(re.fullmatch(r"[0-9]{1,3}", value))
    if family == "roman":
        return bool(re.fullmatch(r"[ivxlcdm]{1,6}", value))
    return False


# --------------------------------------------------------------------------
# HTML escaping
# --------------------------------------------------------------------------


def escape_html_text(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# --------------------------------------------------------------------------
# Paragraph joining
# --------------------------------------------------------------------------


def join_lines(raw_lines: list[str]) -> str:
    words = [ln.strip() for ln in raw_lines if ln.strip()]
    text = " ".join(words)
    return re.sub(r"\s+", " ", text).strip()


def split_paragraphs(raw_lines: list[str]) -> list[str]:
    """Splits a buffer of raw (unstripped) lines into paragraphs on blank
    lines, joining wrapped lines within a paragraph with a single space."""
    paras: list[list[str]] = [[]]
    for ln in raw_lines:
        if ln.strip() == "":
            if paras[-1]:
                paras.append([])
        else:
            paras[-1].append(ln)
    if not paras[-1]:
        paras.pop()
    return [join_lines(p) for p in paras if p]


HEADING_LEAD_RE = re.compile(
    r"^(?P<head>[A-Z][A-Za-z0-9,'&/-]*(?:\s+[A-Za-z0-9,'&/-]+){0,5})\.\s+(?=[A-Z(“])"
)


def split_heading_from_text(paragraph_text: str) -> tuple[str | None, str]:
    """If a paragraph opens with a short heading-style lead-in ("General
    requirements.", "Scope.") immediately followed by a full sentence,
    returns (heading_phrase, rest_of_paragraph); else (None, paragraph_text).
    The heading words are always kept IN the returned text (rest includes
    nothing removed -- caller decides what to do with the heading for the
    title; the original paragraph text is left intact for full_text)."""
    m = HEADING_LEAD_RE.match(paragraph_text)
    if not m:
        return None, paragraph_text
    head = m.group("head")
    if len(head) > 48 or head.upper() == head:
        return None, paragraph_text
    return head, paragraph_text


# --------------------------------------------------------------------------
# Marker (paragraph-label) scanning within one section's body
# --------------------------------------------------------------------------

MARKER_RE = re.compile(r"^\(([a-zA-Z0-9]{1,4})\)(\s+\S.*|\s*)$")
TOL = 2
MIN_CHILD_DELTA = 3


class _Level:
    __slots__ = ("indent", "family", "value", "row_id", "depth")

    def __init__(self, indent, family, value, row_id, depth):
        self.indent = indent
        self.family = family
        self.value = value
        self.row_id = row_id
        self.depth = depth


def _try_marker(stack: list[_Level], indent: int, label: str):
    """Returns ('sibling', family) / ('push', family) / None."""
    while stack and indent < stack[-1].indent - TOL:
        stack.pop()
    if stack and abs(indent - stack[-1].indent) <= TOL:
        fam = stack[-1].family
        if shape_matches(fam, label) and label == next_of_family(fam, stack[-1].value):
            return ("sibling", fam)
    parent_indent = stack[-1].indent if stack else -1
    if indent > parent_indent + MIN_CHILD_DELTA - TOL:
        new_depth = len(stack) + 1
        fam = family_for_depth(new_depth)
        if shape_matches(fam, label) and label == first_of_family(fam):
            return ("push", fam)
    return None


def parse_section_body(
    section_id: str,
    body_lines: list[str],
) -> tuple[list[dict], dict[str, list[str]]]:
    """Parses one section's body (everything after the "§ ..." heading, up to
    but not including the next section/table/reserved-range marker) into a
    list of provision-row skeletons {id, parent_id, label_path, kind:"item"}
    in document order, plus a dict id -> list of raw paragraph lines (the
    node's own text buffer, i.e. everything before its first child)."""
    rows: list[dict] = []
    buffers: dict[str, list[str]] = defaultdict(list)
    stack: list[_Level] = []
    current_id = section_id

    for raw in body_lines:
        stripped = raw.strip()
        indent = len(raw) - len(raw.lstrip(" "))
        m = MARKER_RE.match(stripped) if stripped else None
        accepted = None
        label = None
        if m:
            label = m.group(1)
            accepted = _try_marker(stack, indent, label)
        if accepted is None:
            buffers[current_id].append(raw)
            continue
        kind, fam = accepted
        if kind == "sibling":
            stack.pop()
        parent_id = stack[-1].row_id if stack else section_id
        new_id = f"{parent_id}-({label})"
        depth = len(stack) + 1
        stack.append(_Level(indent, fam, label, new_id, depth))
        current_id = new_id
        rows.append({"id": new_id, "parent_id": parent_id, "label": label, "depth": depth})
        rest = m.group(2).strip()
        if rest:
            buffers[new_id].append(rest)
    return rows, buffers


# --------------------------------------------------------------------------
# Table extraction (from pdftotext -layout column alignment -- pdfplumber's
# default line-based table detection does not find these borderless federal
# register tables reliably; see the module-level audit notes in the CLI
# output for the ones that need manual review).
# --------------------------------------------------------------------------


def _tokenize_columns(line: str) -> list[tuple[int, str]]:
    out = []
    for m in re.finditer(r"\S(?:.*?\S)?(?=\s{2,}|$)", line):
        text = m.group(0).strip()
        if text:
            out.append((m.start(), text))
    return out


def rows_from_layout_block(raw_lines: list[str]) -> list[list[str]]:
    """Best-effort table reconstruction from whitespace-aligned columns.
    Clusters token start-columns using the most common column count as the
    canonical grid, assigns every token (including wrapped header/body
    fragments on their own lines) to the nearest canonical column, and
    merges rows that don't fill the grid into the header (if before the
    first full row) or the previous body row (if after)."""
    tokenized = [_tokenize_columns(ln) for ln in raw_lines if ln.strip()]
    tokenized = [t for t in tokenized if t]
    if not tokenized:
        return []
    counts = Counter(len(t) for t in tokenized)
    ncols = counts.most_common(1)[0][0]
    if ncols < 2:
        ncols = max(len(t) for t in tokenized)
    # Canonical column starts: from the first row that has exactly ncols tokens.
    canon = None
    for t in tokenized:
        if len(t) == ncols:
            canon = [c for c, _ in t]
            break
    if canon is None:
        canon = [c for c, _ in tokenized[0]]
        ncols = len(canon)

    def nearest_col(pos: int) -> int:
        return min(range(len(canon)), key=lambda i: abs(canon[i] - pos))

    header_rows: list[dict[int, list[str]]] = []
    body_rows: list[dict[int, list[str]]] = []
    seen_full = False
    for tokens in tokenized:
        row: dict[int, list[str]] = {}
        for pos, text in tokens:
            ci = nearest_col(pos)
            row.setdefault(ci, []).append(text)
        is_full = len(row) >= max(2, ncols - 1)
        if not seen_full:
            header_rows.append(row)
            if is_full:
                seen_full = True
        else:
            if is_full or not body_rows:
                body_rows.append(row)
            else:
                for ci, texts in row.items():
                    body_rows[-1].setdefault(ci, []).extend(texts)

    def merge(rows: list[dict[int, list[str]]]) -> list[str]:
        merged: dict[int, list[str]] = defaultdict(list)
        for row in rows:
            for ci, texts in row.items():
                merged[ci].extend(texts)
        return [" ".join(merged.get(ci, [])).strip() for ci in range(ncols)]

    header = merge(header_rows) if header_rows else []
    out = [header] if header else []
    for row in body_rows:
        out.append([" ".join(row.get(ci, [])).strip() for ci in range(ncols)])
    return out


def render_table_html(caption: str, rows: list[list[str]]) -> str:
    cap = escape_html_text(caption)
    if not rows:
        return f'<div class="doc-table-wrap"><div class="doc-table-caption">{cap}</div></div>'
    header, body_rows = rows[0], rows[1:]

    def cell(c):
        return escape_html_text((c or "").replace("\n", " ").strip())

    thead = "<tr>" + "".join(f"<th>{cell(c)}</th>" for c in header) + "</tr>"
    tbody = "".join("<tr>" + "".join(f"<td>{cell(c)}</td>" for c in row) + "</tr>" for row in body_rows)
    return (
        '<div class="doc-table-wrap">'
        f'<div class="doc-table-caption">{cap}</div>'
        f'<table class="doc-table"><thead>{thead}</thead><tbody>{tbody}</tbody></table>'
        "</div>"
    )


# --------------------------------------------------------------------------
# Cross-reference linking
# --------------------------------------------------------------------------

BUCKET_CFR = "cfr_not_in_corpus"          # CFR parts/sections not in our corpus (Part 60 subpart A GP, other parts)
BUCKET_OTHER_SUBPART = "other_subpart"    # "subpart X of this part" where X isn't OOOOa/b/c
BUCKET_UNPARSEABLE = "unparseable"        # same-subpart ref we recognized but couldn't resolve to a parsed id
ALL_BUCKETS = [BUCKET_CFR, BUCKET_OTHER_SUBPART, BUCKET_UNPARSEABLE]

_PAREN = r"\([a-zA-Z0-9]{1,4}\)"
_CHAIN = rf"(?:{_PAREN})+"

NUMREF_RE = re.compile(
    r"(?P<sym1>§§?\s*)(?:40\s*CFR\s+)?(?P<part1>\d{1,3})\.(?P<num1>\d{1,4})(?P<suf1>[a-cA-C]?)(?P<par1>(?:\([a-zA-Z0-9]{1,4}\))*)"
    r"|(?:40\s*CFR\s+)(?P<part2>\d{1,3})\.(?P<num2>\d{1,4})(?P<suf2>[a-cA-C]?)(?P<par2>(?:\([a-zA-Z0-9]{1,4}\))*)"
    r"|\b(?P<part3>\d{1,3})\.(?P<num3>\d{1,4})(?P<suf3>[a-c])(?P<par3>(?:\([a-zA-Z0-9]{1,4}\))*)"
)
_REL_LIST_SEP = r"(?:\s*,\s*(?:and\s+|or\s+|through\s+)?|\s+and\s+|\s+or\s+|\s+through\s+)"
RELREF_RE = re.compile(
    r"(?P<relword>paragraphs?)\s+(?P<rellist>"
    + _CHAIN + r"(?:" + _REL_LIST_SEP + _CHAIN + r")*"
    + r")\s+of\s+this\s+(?P<relscope>section|paragraph)"
)
SUBPART_REF_RE = re.compile(r"\bsubpart\s+([A-Za-z0-9]+)\s+of\s+this\s+part\b")
PART_REF_RE = re.compile(r"\bpart\s+(\d{1,3})\b(?:,?\s*subpart\s+([A-Za-z0-9]+))?", re.I)

CHAIN_TOKEN_RE = re.compile(r"(?:\([a-zA-Z0-9]{1,4}\))+")


def resolve_chain_list(list_str: str, base_id: str, known_ids: set) -> list[tuple[int, int, str, str | None]]:
    """Tokenizes a run like "(b)(1) through (3)" (already stripped of the
    leading 'paragraph(s)'/trailing 'of this section') and resolves each
    token to a full id, reusing the previous full chain's leading segments
    for a bare trailing paren (the "(b)(1) through (3)" -> (b)(3) shorthand).
    """
    last_full: list[str] | None = None
    out = []
    for m in CHAIN_TOKEN_RE.finditer(list_str):
        token = m.group(0)
        parens = re.findall(r"\([a-zA-Z0-9]{1,4}\)", token)
        if len(parens) < (len(last_full) if last_full else 0) and last_full:
            chain = last_full[: len(last_full) - len(parens)] + parens
        else:
            chain = parens
        last_full = chain
        target = None
        cand = list(chain)
        while cand:
            tid = base_id + "".join(f"-{p}" for p in cand)
            if tid in known_ids:
                target = tid
                break
            cand = cand[:-1]
        out.append((m.start(), m.end(), token, target))
    return out


def link_citations(
    text: str,
    own_reg: str,
    own_section_id: str,
    own_paragraph_id: str,
    known_ids: set,
    corpus_regs: set,
    unresolved: dict,
) -> str:
    out = []
    last = 0
    for m in re.finditer(f"{NUMREF_RE.pattern}|{RELREF_RE.pattern}|{SUBPART_REF_RE.pattern}|{PART_REF_RE.pattern}", text):
        out.append(text[last : m.start()])
        last = m.end()
        gd = m.groupdict()
        if gd.get("num1") or gd.get("num2") or gd.get("num3"):
            part = gd.get("part1") or gd.get("part2") or gd.get("part3")
            num = gd.get("num1") or gd.get("num2") or gd.get("num3")
            suf = (gd.get("suf1") or gd.get("suf2") or gd.get("suf3") or "").lower()
            parens = gd.get("par1") or gd.get("par2") or gd.get("par3") or ""
            matched_text = m.group(0)
            # Only the 53xx-54xx range is OOOOa/b/c's own numbering; other
            # Part 60 subparts also use letter-suffixed sections (e.g.
            # subpart Kb's "§ 60.112b") that happen to end in the same
            # letters and must NOT be mistaken for our corpus.
            in_range = num.isdigit() and 5300 <= int(num) <= 5499
            if part == "60" and suf in ("a", "b", "c") and in_range:
                target_reg = LETTER_TO_REG[suf]
                sec_num = f"60.{num}{suf}"
                if target_reg == own_reg:
                    base_id = f"sec-{own_reg}-{sec_num}"
                    chain = re.findall(r"\([a-zA-Z0-9]{1,4}\)", parens)
                    tid = None
                    cand = list(chain)
                    while True:
                        candidate = base_id + "".join(f"-{p}" for p in cand)
                        if candidate in known_ids:
                            tid = candidate
                            break
                        if not cand:
                            break
                        cand = cand[:-1]
                    if tid:
                        out.append(f'<span class="xref" data-target="{tid}">{matched_text}</span>')
                    else:
                        out.append(matched_text)
                        unresolved[BUCKET_UNPARSEABLE][matched_text.strip()] += 1
                elif target_reg in corpus_regs:
                    out.append(
                        f'<a class="xref-external-reg" href="/regulations/{target_reg}">{matched_text}</a>'
                    )
                else:
                    out.append(matched_text)
                    unresolved[BUCKET_OTHER_SUBPART][matched_text.strip()] += 1
            else:
                out.append(matched_text)
                unresolved[BUCKET_CFR][matched_text.strip()] += 1
            continue
        if gd.get("rellist"):
            scope = gd["relscope"]
            base_id = own_section_id if scope == "section" else own_paragraph_id
            rellist_text = gd["rellist"]
            tokens = resolve_chain_list(rellist_text, base_id, known_ids)
            pieces = []
            pos = 0
            for s, e, token, target in tokens:
                pieces.append(rellist_text[pos:s])
                if target:
                    pieces.append(f'<span class="xref" data-target="{target}">{token}</span>')
                else:
                    pieces.append(token)
                    unresolved[BUCKET_UNPARSEABLE][f"paragraph {token} of this {scope}"] += 1
                pos = e
            pieces.append(rellist_text[pos:])
            new_list = "".join(pieces)
            out.append(f"{gd['relword']} {new_list} of this {scope}")
            continue
        if m.group(0).lower().startswith("subpart") and re.match(SUBPART_REF_RE, m.group(0)):
            sm = SUBPART_REF_RE.match(m.group(0))
            code = sm.group(1)
            candidate_reg = None
            for reg_key, letter_code in SUBPART_CODE.items():
                if code.upper() == letter_code.upper():
                    candidate_reg = reg_key
                    break
            if candidate_reg == own_reg:
                out.append(m.group(0))
            elif candidate_reg and candidate_reg in corpus_regs:
                out.append(
                    m.group(0).replace(
                        f"subpart {code}",
                        f'<a class="xref-external-reg" href="/regulations/{candidate_reg}">subpart {code}</a>',
                    )
                )
            else:
                out.append(m.group(0))
                unresolved[BUCKET_OTHER_SUBPART][m.group(0).strip()] += 1
            continue
        # PART_REF (generic "part NN[, subpart X]")
        pm = PART_REF_RE.match(m.group(0))
        if pm:
            partnum = pm.group(1)
            if partnum == "60" and not pm.group(2):
                out.append(m.group(0))
            else:
                out.append(m.group(0))
                unresolved[BUCKET_CFR][m.group(0).strip()] += 1
            continue
        out.append(m.group(0))
    out.append(text[last:])
    return "".join(out)


# --------------------------------------------------------------------------
# Main parse
# --------------------------------------------------------------------------

DEFINITIONS_RE = re.compile(r"definitions? appl", re.I)


def parse_ecfr(reg: str, pdf_path: str | None, txt_path: str) -> tuple[list[dict], dict]:
    reg = _norm_reg(reg)
    suffix = SUBPART_LETTER[reg]
    raw = Path(txt_path).read_text(encoding="utf-8")
    lines = strip_page_furniture(raw)
    toc_end, body_start = find_body_start(lines)
    toc_sections, toc_groups = extract_toc(lines, toc_end)

    # Root title: the em-dash heading text, joined across wrapped lines, up
    # to (not including) the blank line before "Source:".
    heading_lines = []
    i = toc_end
    while i < len(lines) and not SOURCE_LINE_RE.match(lines[i]):
        if lines[i].strip():
            heading_lines.append(lines[i].strip())
        i += 1
    heading_text = " ".join(heading_lines)
    heading_text = re.sub(r"\s+", " ", heading_text).strip()
    heading_text = heading_text.replace(f"Subpart OOOO{suffix}—", f"Subpart OOOO{suffix} — ")
    root_id = f"sec-{reg}-top-REG-{reg}"
    root_citation = f"40 CFR Part 60 Subpart OOOO{suffix}"
    root_title = f"40 CFR Part 60 {heading_text}"

    rows: list[dict] = []
    sort_order = 0

    def next_sort():
        nonlocal sort_order
        v = sort_order
        sort_order += 10
        return v

    rows.append(
        {
            "id": root_id,
            "citation": root_citation,
            "title": root_title,
            "parent_id": None,
            "sort_order": next_sort(),
            "full_text": root_title,
            "kind": "root",
        }
    )

    body_lines = lines[body_start:]

    # Split the body into ordered blocks: section / range-reserved / table /
    # group-heading. Everything else is content belonging to the current
    # block.
    Block = dict
    blocks: list[Block] = []
    cur = None
    current_group_id = root_id

    def flush():
        if cur is not None:
            blocks.append(cur)

    idx = 0
    group_counter = 0
    while idx < len(body_lines):
        raw_line = body_lines[idx]
        stripped = raw_line.strip()
        # Real section/table/reserved-range headings always start flush at
        # column 0 in this layout; a "§ 60.5386b(a), ..." cross-reference
        # can otherwise start a wrapped continuation LINE and look
        # identical once stripped -- indentation disambiguates them.
        at_col0 = not raw_line[:1].isspace() if raw_line else False
        m_sec = SECTION_LINE_RE.match(stripped) if at_col0 else None
        if m_sec:
            # A real section heading's remainder is empty (heading wraps to
            # the next line), "[Reserved]", or starts with an uppercase
            # question word ("What"/"How"/...). A cross-reference wrapped to
            # the start of a line -- "§ 60.5416b(a)(1)(ii) and (iii), ..." --
            # instead continues with "(" or a lowercase/punctuation
            # continuation of the citing sentence; reject those.
            rest = m_sec.group(3).strip()
            if rest and not (rest == "[Reserved]" or rest[0:1].isupper()):
                m_sec = None
        m_range = RANGE_RESERVED_RE.match(stripped) if at_col0 else None
        m_table = TABLE_CAPTION_RE.match(stripped) if at_col0 else None
        if m_range:
            flush()
            cur = {
                "type": "range_reserved",
                "num1": m_range.group(1),
                "num2": m_range.group(2),
                "text": stripped,
                "lines": [],
                "parent": current_group_id,
            }
            idx += 1
            continue
        if m_table:
            flush()
            cap_lines = [stripped]
            idx += 1
            while idx < len(body_lines) and body_lines[idx].strip() and not body_lines[idx].strip().startswith(("§", "Table")):
                # caption continues until blank line
                nxt = body_lines[idx].strip()
                cap_lines.append(nxt)
                idx += 1
            cur = {
                "type": "table",
                "num": int(m_table.group(1)),
                "caption": re.sub(r"\s+", " ", " ".join(cap_lines)).strip(),
                "lines": [],
                "parent": root_id,
            }
            continue
        if m_sec:
            flush()
            num = f"60.{m_sec.group(1)}{m_sec.group(2)}"
            first_rest = m_sec.group(3).strip()
            head_lines = [first_rest] if first_rest else []
            idx += 1
            is_reserved_oneline = first_rest.strip() == "[Reserved]"
            already_complete = bool(first_rest) and (first_rest.endswith("?") or is_reserved_oneline)
            if not is_reserved_oneline and not already_complete:
                while idx < len(body_lines):
                    nxt = body_lines[idx]
                    nstripped = nxt.strip()
                    head_lines.append(nstripped)
                    idx += 1
                    if nstripped.endswith("?"):
                        break
                    if not nstripped:
                        break
            heading = re.sub(r"\s+", " ", " ".join(h for h in head_lines if h)).strip()
            cur = {
                "type": "section",
                "num": num,
                "heading": heading,
                "lines": [],
                "parent": current_group_id,
            }
            continue
        if is_group_heading_line(raw_line):
            flush()
            group_counter += 1
            norm = re.sub(r"\s+", " ", stripped).strip().upper()
            pretty = toc_groups.get(norm, stripped.title().replace("Of", "of").replace("To", "to"))
            gid = f"sec-{reg}-heading-{group_counter}"
            cur = {"type": "heading", "id": gid, "text": pretty, "lines": [], "parent": root_id}
            current_group_id = gid
            idx += 1
            continue
        if cur is not None:
            cur["lines"].append(raw_line)
        idx += 1
    flush()

    toc_seen_nums = set(toc_sections.keys())
    body_seen_nums = set()
    unresolved: dict = {b: Counter() for b in ALL_BUCKETS}
    duplicate_ids: list[str] = []
    by_id: dict[str, dict] = {}

    def add_row(row: dict):
        # Two different markers occasionally compute the same id -- this
        # corpus has at least one case (60.5401b's "(i) Repair requirements"
        # paragraph, with its whole (1)-(6) sub-list, is printed twice in
        # the source PDF text back to back). The `id` column is a primary
        # key, so the output can't carry two rows with the same id: keep the
        # FIRST occurrence's citation/parent/title and append the later
        # occurrence's text as trailing paragraphs, matching import_ccr.py's
        # parse_reg() dedup policy.
        existing = by_id.get(row["id"])
        if existing is not None:
            duplicate_ids.append(row["id"])
            existing["full_text"] += row["full_text"]
            return
        by_id[row["id"]] = row
        rows.append(row)

    for block in blocks:
        if block["type"] == "heading":
            add_row(
                {
                    "id": block["id"],
                    "citation": block["text"],
                    "title": block["text"],
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": block["text"],
                    "kind": "heading",
                }
            )
        elif block["type"] == "range_reserved":
            body_seen_nums.add(f"60.{block['num1']}")
            rid = f"sec-{reg}-60.{block['num1']}-60.{block['num2']}"
            add_row(
                {
                    "id": rid,
                    "citation": f"§§ 60.{block['num1']}-60.{block['num2']}",
                    "title": f"§§ 60.{block['num1']}-60.{block['num2']} [Reserved]",
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": f"§§ 60.{block['num1']}-60.{block['num2']} [Reserved]",
                    "kind": "heading",
                }
            )
        elif block["type"] == "table":
            rid = f"sec-{reg}-TABLE-{block['num']}"
            table_rows = rows_from_layout_block(block["lines"])
            html = render_table_html(block["caption"], table_rows)
            add_row(
                {
                    "id": rid,
                    "citation": f"Table {block['num']} to Subpart OOOO{suffix} of Part 60",
                    "title": block["caption"],
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": html,
                    "kind": "appendix",
                    "_table_rows": table_rows,
                }
            )
        elif block["type"] == "section":
            sec_id = f"sec-{reg}-{block['num']}"
            body_seen_nums.add(block["num"])
            heading = block["heading"]
            citation = f"§ {block['num']}"
            title = f"{citation} {heading}".strip()
            if heading == "[Reserved]":
                add_row(
                    {
                        "id": sec_id,
                        "citation": citation,
                        "title": title,
                        "parent_id": block["parent"],
                        "sort_order": next_sort(),
                        "full_text": title,
                        "kind": "heading",
                    }
                )
                continue
            if DEFINITIONS_RE.search(heading):
                paras = split_paragraphs(block["lines"])
                full_text = "".join(f"<p>{escape_html_text(p)}</p>" for p in paras) if paras else ""
                add_row(
                    {
                        "id": sec_id,
                        "citation": citation,
                        "title": title,
                        "parent_id": block["parent"],
                        "sort_order": next_sort(),
                        "full_text": full_text or title,
                        "kind": "section" if full_text else "heading",
                        "_own_section_id": sec_id,
                        "_raw_paragraphs": paras,
                    }
                )
                continue
            marker_rows, buffers = parse_section_body(sec_id, block["lines"])
            chapeau_paras = split_paragraphs(buffers.get(sec_id, []))
            chapeau_text = "".join(f"<p>{escape_html_text(p)}</p>" for p in chapeau_paras)
            add_row(
                {
                    "id": sec_id,
                    "citation": citation,
                    "title": title,
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": chapeau_text if chapeau_text else title,
                    "kind": "section" if chapeau_text else "heading",
                    "_own_section_id": sec_id,
                    "_raw_paragraphs": chapeau_paras,
                }
            )
            for mr in marker_rows:
                paras = split_paragraphs(buffers.get(mr["id"], []))
                heading_word, _ = split_heading_from_text(paras[0]) if paras else (None, None)
                item_citation = citation + "".join(
                    f"({p})" for p in re.findall(r"-\(([a-zA-Z0-9]{1,4})\)", mr["id"][len(sec_id):])
                )
                item_title = item_citation
                if heading_word:
                    item_title = f"{item_citation} {heading_word}"
                full_text = "".join(f"<p>{escape_html_text(p)}</p>" for p in paras)
                add_row(
                    {
                        "id": mr["id"],
                        "citation": item_citation,
                        "title": item_title,
                        "parent_id": mr["parent_id"],
                        "sort_order": next_sort(),
                        "full_text": full_text if full_text else item_title,
                        "kind": "item" if full_text else "heading",
                        "_own_section_id": sec_id,
                        "_raw_paragraphs": paras,
                    }
                )

    known_ids = {r["id"] for r in rows}
    for row in rows:
        own_section_id = row.pop("_own_section_id", row["id"])
        row.pop("_raw_paragraphs", None)
        row.pop("_table_rows", None)
        if row["kind"] not in ("section", "item"):
            # Heading-type rows' full_text is plain text = their title (per
            # IMPORTER_SPEC "heading-type rows: plain text, no tags"); it
            # often IS the row's own citation, which must not self-link.
            # Table HTML is already rendered and not prose to re-scan.
            continue
        row["full_text"] = link_citations(
            row["full_text"], reg, own_section_id, row["id"], known_ids, CORPUS_REGS, unresolved
        )

    missing_sections = sorted(toc_seen_nums - body_seen_nums)
    extra_sections = sorted(body_seen_nums - toc_seen_nums)
    toc_title_mismatches = []
    for num in sorted(toc_seen_nums & body_seen_nums):
        sec_id = f"sec-{reg}-{num}"
        body_row = next((r for r in rows if r["id"] == sec_id), None)
        if body_row:
            toc_norm = re.sub(r"\s+", " ", toc_sections[num]).strip()
            body_norm = re.sub(r"\s+", " ", body_row["title"]).strip()
            if toc_norm != body_norm and not (
                toc_norm.startswith(body_norm[:40]) or body_norm.startswith(toc_norm[:40])
            ):
                toc_title_mismatches.append((num, toc_norm, body_norm))

    report = {
        "reg": reg,
        "n_sections_toc": len(toc_seen_nums),
        "n_sections_body": len(body_seen_nums),
        "missing_sections": missing_sections,
        "extra_sections": extra_sections,
        "toc_title_mismatches": toc_title_mismatches,
        "duplicate_ids": duplicate_ids,
        "unresolved": unresolved,
        "n_group_headings": group_counter,
        "n_tables": sum(1 for b in blocks if b["type"] == "table"),
    }
    return rows, report


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def cmd_parse(args):
    txt_path = args.txt or str(Path(args.pdf).with_suffix(".txt"))
    rows, report = parse_ecfr(args.reg, args.pdf, txt_path)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    kind_counts = Counter(r["kind"] for r in rows)
    print(f"Parsed {len(rows)} provisions for {args.reg} -> {out_path}")
    print(f"  by kind: {dict(kind_counts)}")
    print(f"  sections: TOC {report['n_sections_toc']}, body {report['n_sections_body']}")
    if report["missing_sections"]:
        print(f"  WARNING: {len(report['missing_sections'])} TOC sections missing from body: {report['missing_sections']}")
    if report["duplicate_ids"]:
        print(f"  WARNING: duplicate ids: {report['duplicate_ids']}")
    total_unresolved = sum(sum(c.values()) for c in report["unresolved"].values())
    print(f"  unresolved reference mentions: {total_unresolved}")
    for bucket in ALL_BUCKETS:
        ctr = report["unresolved"][bucket]
        if not ctr:
            continue
        print(f"  bucket '{bucket}': {len(ctr)} distinct, {sum(ctr.values())} mentions; top 5:")
        for text, cnt in ctr.most_common(5):
            print(f"    {cnt:4d}  {text}")

    report_path = out_path.with_name(out_path.stem + "_report.json")
    serializable_report = dict(report)
    serializable_report["unresolved"] = {
        b: sorted(c.items(), key=lambda kv: -kv[1]) for b, c in report["unresolved"].items()
    }
    report_path.write_text(json.dumps(serializable_report, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_parse = sub.add_parser("parse", help="Parse an eCFR subpart's pdftotext output into provisions JSON.")
    p_parse.add_argument("--reg", required=True, help="oooob / ooooa / ooooc")
    p_parse.add_argument("--pdf", required=True)
    p_parse.add_argument("--txt", default=None, help="Defaults to --pdf with .txt extension.")
    p_parse.add_argument("--out", required=True)
    p_parse.set_defaults(func=cmd_parse)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
