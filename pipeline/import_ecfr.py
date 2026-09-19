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

try:
    import pdfplumber  # only required when a SUBPART_META entry uses table_algorithm="pdfplumber"
except ImportError:  # pragma: no cover
    pdfplumber = None

FF = "\x0c"  # form-feed: pdftotext -layout emits exactly one per PDF page

# --------------------------------------------------------------------------
# Regulation metadata
# --------------------------------------------------------------------------

# Canonical reg keys used by this module / the CLI --reg flag.
#
# SUBPART_META drives everything that used to be hard-wired per-OOOO-subpart:
# which CFR part it lives in (60 or 63), its subpart code as printed
# ("OOOOb", "JJJJ", "ZZZZ", ...), its letter suffix (non-empty only for the
# OOOOa/b/c family -- JJJJ/IIII/ZZZZ sections carry no trailing letter), the
# numeric section-number range that is "this subpart's own numbering" for the
# cross-reference resolver, the eCFR URL, and whether "Table N to this
# subpart" inline references get linked to the table row (see
# `enable_table_ref_links` below -- OFF for OOOOa/b/c so their byte-identical
# baselines are untouched by a capability added for the new subparts).
SUBPART_META: dict[str, dict] = {
    "ooooa": dict(
        part=60, code="OOOOa", suffix="a", sections=(5300, 5499),
        url="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOa",
        enable_table_ref_links=False, table_algorithm="v1",
    ),
    "oooob": dict(
        part=60, code="OOOOb", suffix="b", sections=(5300, 5499),
        url="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOb",
        enable_table_ref_links=False, table_algorithm="v1",
    ),
    "ooooc": dict(
        part=60, code="OOOOc", suffix="c", sections=(5300, 5499),
        url="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOc",
        enable_table_ref_links=False, table_algorithm="v1",
    ),
    "jjjj": dict(
        part=60, code="JJJJ", suffix="", sections=(4230, 4248),
        url="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-JJJJ",
        enable_table_ref_links=True, table_algorithm="xml",
    ),
    "iiii": dict(
        part=60, code="IIII", suffix="", sections=(4200, 4219),
        url="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-IIII",
        enable_table_ref_links=True, table_algorithm="xml",
    ),
    "zzzz": dict(
        part=63, code="ZZZZ", suffix="", sections=(6580, 6675),
        url="https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-63/subpart-ZZZZ",
        enable_table_ref_links=True, table_algorithm="xml",
    ),
}

# --------------------------------------------------------------------------
# Whole-PART documents (49 CFR Parts 191 / 192), parsed from the eCFR
# versioner XML rather than from the PDF print.
# --------------------------------------------------------------------------
#
# These are a different KIND of document from the six subparts above: the
# unit of import is a whole CFR part (a <DIV5 TYPE="PART">), the structure
# comes from the XML's own DIV6/DIV8/DIV9 nesting instead of from
# pdftotext -layout indentation, and the CFR title is 49, not 40. Rather
# than fork the module, they are registered in the SAME SUBPART_META dict
# with two extra keys:
#
#   document="part"  -> parse_ecfr() is not used; parse_ecfr_part() is, and
#                       link_citations() switches to its 49-CFR rule set.
#   source="xml"     -> the primary source file is the .xml, not the .txt.
#
# Everything downstream (row shape, id scheme, resolve_chain_list, the CFR
# paragraph-label cycle, render_xml_table_html, the diff/apply machinery)
# is shared with the subpart path. Every key the subpart code reads
# (`part`, `code`, `suffix`, `sections`, `url`, `enable_table_ref_links`,
# `table_algorithm`) is present here too, so no existing lookup needs a
# `.get(...)` default -- and `document`/`title` are read only through
# `.get(...)`, so the six subpart entries need no new keys at all and their
# byte-identical baselines are untouched.
PART_META: dict[str, dict] = {
    "p191": dict(
        title=49, part=191, code="", suffix="", sections=(1, 99),
        url="https://www.ecfr.gov/current/title-49/part-191",
        enable_table_ref_links=False, table_algorithm="xml",
        document="part", source="xml", has_subparts=False,
        root_citation="49 CFR Part 191",
        root_title=(
            "49 CFR Part 191 — Transportation of Natural and Other Gas by Pipeline; "
            "Annual, Incident, and Other Reporting"
        ),
    ),
    "p192": dict(
        title=49, part=192, code="", suffix="", sections=(1, 1099),
        url="https://www.ecfr.gov/current/title-49/part-192",
        enable_table_ref_links=False, table_algorithm="xml",
        document="part", source="xml", has_subparts=True,
        root_citation="49 CFR Part 192",
        root_title=(
            "49 CFR Part 192 — Transportation of Natural and Other Gas by Pipeline: "
            "Minimum Federal Safety Standards"
        ),
    ),
    "p194": dict(
        title=49, part=194, code="", suffix="", sections=(1, 199),
        url="https://www.ecfr.gov/current/title-49/part-194",
        enable_table_ref_links=False, table_algorithm="xml",
        document="part", source="xml", has_subparts=True,
        root_citation="49 CFR Part 194",
        root_title="49 CFR Part 194 — Response Plans for Onshore Oil Pipelines",
    ),
    "p195": dict(
        title=49, part=195, code="", suffix="", sections=(1, 999),
        url="https://www.ecfr.gov/current/title-49/part-195",
        enable_table_ref_links=False, table_algorithm="xml",
        document="part", source="xml", has_subparts=True,
        root_citation="49 CFR Part 195",
        root_title="49 CFR Part 195 — Transportation of Hazardous Liquids by Pipeline",
    ),
    "p199": dict(
        title=49, part=199, code="", suffix="", sections=(1, 299),
        url="https://www.ecfr.gov/current/title-49/part-199",
        enable_table_ref_links=False, table_algorithm="xml",
        document="part", source="xml", has_subparts=True,
        root_citation="49 CFR Part 199",
        root_title="49 CFR Part 199 — Drug and Alcohol Testing",
    ),
}
SUBPART_META.update(PART_META)

# A 49 CFR section number resolves to a reg by its PART prefix (191.x ->
# p191, 192.x -> p192) -- not by the 40 CFR section-number-range trick,
# which exists only because three subparts share one numeric range.
CFR_PART_TO_REGKEY: dict[str, str] = {"49-191": "p191", "49-192": "p192", "49-194": "p194", "49-195": "p195", "49-199": "p199"}

# Derived, backward-compatible views used throughout the module (kept as
# plain module-level dicts -- as before -- so nothing downstream needs to
# know about SUBPART_META directly).
SUBPART_LETTER = {k: v["suffix"] for k, v in SUBPART_META.items()}
SUBPART_CODE = {k: v["code"] for k, v in SUBPART_META.items()}
ECFR_URL = {k: v["url"] for k, v in SUBPART_META.items()}
# All six subparts are in the corpus (cross-linkable to one another).
CORPUS_REGS = set(SUBPART_META.keys())
# Letter -> reg, for the OOOOa/b/c family only (the only one with a letter).
LETTER_TO_REG = {v["suffix"]: k for k, v in SUBPART_META.items() if v["suffix"]}


def _norm_reg(reg: str) -> str:
    r = reg.lower()
    if r in SUBPART_META:
        return r
    raise ValueError(f"unknown eCFR reg key: {reg!r} (expected one of {sorted(SUBPART_META)})")


def _resolve_target_reg(part: str, num: str, suf: str) -> str | None:
    """Given a parsed CFR cite's part number (string, e.g. "60"/"63"), its
    section number (string digits) and lowercased optional letter suffix,
    returns the reg key whose OWN numbering that citation falls inside, or
    None if it isn't this corpus's own numbering at all.

    OOOOa/b/c share one numeric range (5300-5499 of Part 60) and are told
    apart only by their letter suffix -- the ORIGINAL, unchanged rule.
    JJJJ/IIII/ZZZZ carry no letter suffix and are told apart by their own
    section-number range within their CFR part instead.
    """
    if not num.isdigit():
        return None
    n = int(num)
    if part == "60" and suf in ("a", "b", "c") and 5300 <= n <= 5499:
        return LETTER_TO_REG[suf]
    if suf == "":
        for key, meta in SUBPART_META.items():
            # Whole-PART documents (49 CFR 191/192) are resolved by
            # `_resolve_target_reg_49` instead -- they must never be reachable
            # from a 40 CFR subpart's citation scan, or a stray "§ 192.605" in
            # a Part 60/63 document would silently link to the pipeline part.
            if meta.get("document") == "part":
                continue
            if meta["suffix"] == "" and str(meta["part"]) == part:
                lo, hi = meta["sections"]
                if lo <= n <= hi:
                    return key
    return None


def _resolve_target_reg_49(part: str, num: str) -> str | None:
    """Title-49 counterpart of `_resolve_target_reg`: a section number in a
    whole-part document resolves purely by its part prefix (191.5 -> p191,
    192.605 -> p192), because each part IS one document. Returns None for
    every other 49 CFR part (190, 193, 195, 196, 199, 1.97, ...)."""
    if not num.isdigit():
        return None
    return CFR_PART_TO_REGKEY.get(f"49-{part}")


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

# The OOOO-only default (kept exactly as before, both for backward
# compatibility with callers that don't pass a `heading_re` and for the
# existing tests, which exercise this regex with OOOOb-shaped sample text).
BODY_HEADING_RE = re.compile(r"^Subpart OOOO[ABCabc]—")
SOURCE_LINE_RE = re.compile(r"^\s*Source:\s")
# Section numbers: Part 60/63, 3-5 digits, an OPTIONAL letter suffix (only
# OOOOa/b/c's numbering ever has one -- JJJJ/IIII/ZZZZ sections are bare).
# Group numbering (1=num, 2=suffix, 3=rest-of-line) is unchanged from the
# original OOOO-only regex so every downstream `.group(N)` call still works.
SECTION_LINE_RE = re.compile(r"^§\s*(?:60|63)\.(\d{3,5})([a-c]?)\b(.*)$")
RANGE_RESERVED_RE = re.compile(
    r"^§§\s*(?:60|63)\.(\d{3,5}[a-c]?)-(?:60|63)\.(\d{3,5}[a-c]?)\s*\[Reserved\]\s*$"
)
# Table numbers can be alphanumeric ("Table 1a" in ZZZZ); the caption and
# code/part are subpart-specific, so this is built per-subpart at parse time
# (see `parse_ecfr`) -- this module-level version is the OOOO-only default,
# kept for anything that still imports the bare name.
TABLE_CAPTION_RE = re.compile(
    r"^Table\s+(\d+)\s+to\s+Subpart\s+OOOO[ABCabc]\s+of\s+Part\s+60—(.*)$"
)


def find_body_start(lines: list[str], heading_re: re.Pattern | None = None) -> tuple[int, int]:
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
    heading_re = heading_re or BODY_HEADING_RE
    heading_idx = None
    for i, ln in enumerate(lines):
        if heading_re.match(ln):
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
            secm = re.search(r"(?:60|63)\.\d{3,5}[a-c]?", full)
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
        if shape_matches(fam, label) and label == stack[-1].value:
            # The same label printed again at the same level: a reprinted
            # paragraph (the eCFR prints 60.5401b(i) twice). Treat it as a
            # sibling so it gets its own row/buffer (and its children nest
            # under it) instead of being swallowed as text of the previous
            # item; add_row() then drops it if it is an exact reprint.
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
    # Text buffers are keyed by the buffer key, which equals the row id
    # except when the same id is produced a second time in one section
    # (the eCFR prints 60.5401b's whole paragraph (i) twice): the repeat
    # gets its own "<id>#dup<n>" buffer so the two printed copies can be
    # compared -- and an exact reprint dropped -- in add_row(), instead of
    # both copies silently accumulating under one key.
    seen_ids: dict[str, int] = {}

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
        n_seen = seen_ids.get(new_id, 0)
        seen_ids[new_id] = n_seen + 1
        buffer_key = new_id if n_seen == 0 else f"{new_id}#dup{n_seen}"
        current_id = buffer_key
        rows.append({"id": new_id, "parent_id": parent_id, "label": label, "depth": depth, "buffer_key": buffer_key})
        rest = m.group(2).strip()
        if rest:
            buffers[buffer_key].append(rest)
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


# Marks a physical line's first (leftmost) column as the start of a NEW
# logical table row: a top-level enumerator ("1.", "a.", "(1)") or a "§"
# citation -- the two row-key styles actually used across JJJJ/IIII/ZZZZ's
# tables (numbered-item tables like "Table 6 ... Continuous Compliance", and
# "§ 60.1 / § 63.1 ..." General Provisions applicability tables).
_ROW_ANCHOR_RE = re.compile(r"^(?:\d{1,3}[.)]\s|[A-Za-z][.)]\s|§§?\s?\d)")


def _dedupe_repeated_runs(lines: list[str], min_run: int = 3) -> list[str]:
    """Drops the SECOND-and-later occurrence of any run of >= `min_run`
    consecutive non-blank lines (compared by stripped text) that reappears
    verbatim later in `lines` -- the eCFR print reprints a table's running
    header, and sometimes its applicable footnotes too, at every page break
    the table spans (see `rows_from_layout_block_v2`'s docstring). A run
    this long recurring byte-for-byte is page furniture, never a coincidence
    of real table data (which does legitimately repeat short single values
    like "Yes"/"N/A" -- those are left alone since they're far shorter than
    `min_run`)."""
    n = len(lines)
    stripped = [ln.strip() for ln in lines]
    seen_at: dict[tuple[str, ...], int] = {}
    drop = [False] * n
    i = 0
    while i <= n - min_run:
        window = tuple(stripped[i : i + min_run])
        if all(window):
            if window in seen_at and not any(drop[i : i + min_run]):
                start2 = seen_at[window]
                length = min_run
                while (
                    i + length < n
                    and start2 + length < n
                    and stripped[i + length]
                    and stripped[i + length] == stripped[start2 + length]
                ):
                    length += 1
                for k in range(i, i + length):
                    drop[k] = True
                i += length
                continue
            seen_at.setdefault(window, i)
        i += 1
    return [ln for idx, ln in enumerate(lines) if not drop[idx]]


def rows_from_layout_block_v2(raw_lines: list[str]) -> list[list[str]]:
    """A second table-reconstruction strategy for tables where v1's "full
    row = new row" rule breaks down: several of JJJJ/IIII/ZZZZ's tables wrap
    EVERY column's text across many physical lines at once (a single long
    numbered entry spanning 20-180 printed lines), so nearly every physical
    line looks "full" under v1 and each becomes its own bogus row -- a table
    reduced to word soup (see the Gate-H notes in REPORT.md). Here a new row
    starts only when the FIRST column carries a new anchor (its own top-level
    enumerator or "§" citation); every other line -- including a running
    header block re-printed at each page break in the source PDF, dropped
    here by exact match against the lines that formed the real header -- is
    a continuation merged into the current row, regardless of how many
    columns it happens to fill.

    Not every table in this corpus has such a column: for a table whose
    lead column is plain prose with no enumerator or citation (e.g. JJJJ's
    Table 1, an emission-limits table with an ordinary heading row and
    short, non-wrapping body rows), no anchor is ever found and this
    function returns v1's result unchanged -- v1 already handles that shape
    correctly, and the anchor rule would otherwise misfire.

    A long table's applicable footnotes are sometimes ALSO reprinted at the
    bottom of every page it spans (not just the header row) -- e.g. JJJJ's
    Table 2. `_dedupe_repeated_runs` drops those repeats first.
    """
    # The canonical column grid is voted on from the UN-deduped lines: a
    # reprinted header/footnote run is exactly the kind of full-width,
    # every-column-present line that (correctly) dominates that vote, and
    # de-duplicating first would instead leave the vote to whichever
    # partial wrap-width happens to be most common among what's left.
    tokenized_all = [_tokenize_columns(ln) for ln in raw_lines if ln.strip()]
    tokenized_all = [t for t in tokenized_all if t]
    if not tokenized_all:
        return []
    counts = Counter(len(t) for t in tokenized_all)
    ncols = counts.most_common(1)[0][0]
    if ncols < 2:
        ncols = max(len(t) for t in tokenized_all)
    canon = None
    for t in tokenized_all:
        if len(t) == ncols:
            canon = [c for c, _ in t]
            break
    if canon is None:
        canon = [c for c, _ in tokenized_all[0]]
        ncols = len(canon)

    deduped_lines = _dedupe_repeated_runs(raw_lines)
    tokenized_lines = [(ln, _tokenize_columns(ln)) for ln in deduped_lines if ln.strip()]
    tokenized_lines = [(ln, t) for ln, t in tokenized_lines if t]
    if not tokenized_lines:
        return []

    def nearest_col(pos: int) -> int:
        return min(range(len(canon)), key=lambda i: abs(canon[i] - pos))

    header_raw_lines: set[str] = set()
    header_rows: list[dict[int, list[str]]] = []
    body_rows: list[dict[int, list[str]]] = []
    started = False
    for raw_ln, tokens in tokenized_lines:
        stripped = raw_ln.strip()
        if started and stripped in header_raw_lines:
            continue  # the running header, re-printed at a page break
        row: dict[int, list[str]] = {}
        for pos, text in tokens:
            ci = nearest_col(pos)
            row.setdefault(ci, []).append(text)
        col0 = " ".join(row.get(0, [])).strip()
        anchored = bool(col0) and bool(_ROW_ANCHOR_RE.match(col0))
        if not started:
            if anchored:
                started = True
                body_rows.append(row)
            else:
                header_rows.append(row)
                header_raw_lines.add(stripped)
        elif anchored:
            body_rows.append(row)
        elif body_rows:
            for ci, texts in row.items():
                body_rows[-1].setdefault(ci, []).extend(texts)
        else:
            header_rows.append(row)

    if not started:
        # No row-anchor column in this table at all -- v1's rule fits better.
        return rows_from_layout_block(raw_lines)

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


# --------------------------------------------------------------------------
# Table reconstruction, algorithm 3: pdfplumber word coordinates.
#
# `page.extract_tables()` was tried first (both the default "lines" ruling-
# based strategy and the "text" whitespace-based strategy) and both fail on
# these tables: the eCFR "enhanced display" print draws no table grid at all
# for these borderless tables (confirmed by inspecting `page.lines`/
# `page.rects` on ZZZZ's Table 1a page -- the handful of line segments
# present are text underlines, not a ruling), so the "lines" strategy
# returns near-empty single-column junk; "text" strategy has no column
# hints to anchor on and instead treats the WHOLE page (including running
# header/prose text) as one table, shredding individual words into cells.
#
# What DOES help is that pdfplumber gives every word's exact (x0, top) in
# PDF points, instead of `pdftotext -layout`'s column positions, which are
# reconstructed from an assumed fixed character width and can drift by a
# character or two between pages of the same PDF (different font subset
# metrics, kerning) -- exactly the failure `v2` shows on a table that spans
# a page break (e.g. ZZZZ Table 1a): a column boundary computed as "the
# most common token count's positions" across BOTH pages' text ends up
# slightly wrong for one of them, and `nearest_col` then assigns some of
# that page's tokens to the wrong column, bleeding two columns' text
# together in one cell.
#
# The fix: locate the table's own words directly from the PDF (real
# coordinates, page-break-proof) and reconstruct rows/columns straight from
# those coordinates rather than re-deriving a text grid. A first version of
# this re-rendered the words as one synthetic `pdftotext -layout`-shaped
# text block and handed it to the already-proven `rows_from_layout_block_v2`
# -- that fixed the page-break column-drift problem but exposed a SECOND,
# more fundamental one: these tables' first (label) column mixes two
# hierarchy levels -- top-level numbered entries ("1. 4SRB stationary
# RICE...", "2. ...") AND lettered/roman sub-items ("a. Reduce...",
# "b. Limit...", "i. ...") that are themselves the CONTENT of that numbered
# entry's neighboring columns, not separate table rows. `v2`'s row-anchor
# regex (shared with ordinary CFR paragraph parsing, where "(a)" genuinely
# does start a new nested provision) breaks a new row on EVERY digit- or
# letter-numbered marker, so a numbered row's own lettered sub-options end
# up smeared across whatever row happened to be open, corrupted by
# whichever OTHER column's wrapped text a synthetic single-line-of-text
# rendering happened to interleave them with -- the "word soup" the
# coordinator flagged.
#
# The fix used here: derive this table's own column x-positions by
# clustering its actual words' x0 coordinates (gap-based 1-D clustering,
# specific to this table, not the whole page or a fixed character grid),
# assign every word on every physical PDF line to its nearest column by
# that table's own geometry, and start a NEW row only when column 0 (the
# label column) begins with a TOP-LEVEL digit marker ("1.", "2.", ...) --
# a letter/roman marker in that same column is treated as part of the
# still-open row and its words are appended into the columns they actually
# fall under. A repeated header row on a page-break continuation is then
# dropped by exact-text comparison against the table's own header row.
# --------------------------------------------------------------------------

_HEADER_BAND_TOP = 45.0   # points from page top; the eCFR running header sits at ~19-31pt
_FOOTER_BAND_TOP = 735.0  # the "(enhanced display) page N of M" footer sits at ~749pt on an 792pt-tall page


def _pdf_body_words(pdf) -> list[dict]:
    """Every word on every page of `pdf` (a pdfplumber.PDF), excluding the
    running header/footer bands, tagged with its page index, in reading
    order. Computed once per document and reused for every table."""
    out: list[dict] = []
    for pi, page in enumerate(pdf.pages):
        for w in page.extract_words():
            if w["top"] < _HEADER_BAND_TOP or w["top"] > _FOOTER_BAND_TOP:
                continue
            w = dict(w)
            w["page"] = pi
            out.append(w)
    return out


def _norm_alnum(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _find_word_index(words: list[dict], key: str, start: int = 0) -> int | None:
    """Finds the index of the word at which the normalized (lowercased,
    alnum-only) concatenation of consecutive words' text -- scanning
    forward from `start` -- first contains the (also normalized) `key`.
    Returns the index of the FIRST word contributing to that match, or None
    if `key` never appears. This is how a table's caption is located in the
    word stream without depending on exact spacing/punctuation, which
    pdfplumber's own text extraction renders inconsistently around small
    inter-word gaps (e.g. "Table 1a to..." sometimes comes out "1ato")."""
    key = _norm_alnum(key)
    if not key:
        return None
    buf = ""
    idxs: list[int] = []
    keep = len(key) + 80
    for i in range(start, len(words)):
        t = _norm_alnum(words[i]["text"])
        if not t:
            continue
        buf += t
        idxs.extend([i] * len(t))
        if len(buf) > keep:
            drop = len(buf) - keep
            buf = buf[drop:]
            idxs = idxs[drop:]
        pos = buf.find(key)
        if pos != -1:
            return idxs[pos]
    return None


def _caption_search_key(kind: str, num: str, code: str, part: int) -> str:
    return f"{kind}{num}toSubpart{code}ofPart{part}"


_ROW_TOP_LEVEL_RE = re.compile(r"^\d{1,3}[.)]\s")


def _cluster_columns(sel_words: list[dict], gap: float = 8.0) -> list[float]:
    """Gap-based 1-D clustering of this table's own words' x0 coordinates
    into column centers: sorted distinct x0s, starting a new column
    whenever the gap to the previous one exceeds `gap` points. Specific to
    THIS table's word set (its own font size / column widths), not the
    whole page or a fixed character grid."""
    xs = sorted(set(round(w["x0"], 1) for w in sel_words if w["text"].strip()))
    if not xs:
        return []
    bins: list[list[float]] = [[xs[0]]]
    for x in xs[1:]:
        if x - bins[-1][-1] > gap:
            bins.append([x])
        else:
            bins[-1].append(x)
    return [sum(b) / len(b) for b in bins]


def rows_from_pdfplumber_table(
    words: list[dict], start_idx: int, end_idx: int
) -> list[list[str]] | None:
    """Reconstructs table rows/columns from the pdfplumber word range
    `words[start_idx:end_idx]` (already located and bounded by caption
    search -- see `parse_ecfr`) using this table's own real word
    coordinates: words are clustered into physical PDF lines (page +
    rounded `top`) and assigned to columns by this table's own x0
    clustering (`_cluster_columns`); a new row starts only when column 0
    begins with a TOP-LEVEL digit marker ("1.", "2.", ...) -- a
    letter/roman sub-marker in that column is folded into the still-open
    row instead of starting a spurious new one. A header row repeated
    verbatim on a page-break continuation is dropped. Returns None if
    there are no words in range, or fewer than 2 columns/rows result (the
    caller falls back to `v2` on the original text lines in that case).
    """
    sel = words[start_idx:end_idx]
    if not sel:
        return None
    lines_map: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for w in sel:
        lines_map[(w["page"], round(w["top"] / 3.0) * 3)].append(w)
    phys_lines = [sorted(lines_map[k], key=lambda w: w["x0"]) for k in sorted(lines_map.keys())]
    if not phys_lines:
        return None
    # Derive canonical column x-positions from the table's HEADER block --
    # the physical lines before the first top-level-numbered data row --
    # rather than from every wrapped body line. A multi-line body cell's
    # later lines can drift toward a neighboring column's x-range (ragged
    # wrap indentation), which fragments a whole-table clustering into
    # spurious extra columns; the header's own lines are short, few, and
    # consistently left-aligned per column, so they anchor the real column
    # positions cleanly.
    first_row_li = None
    for li, lw in enumerate(phys_lines):
        if lw and re.match(r"^\d{1,3}[.)]$", lw[0]["text"]):
            first_row_li = li
            break
    header_words = [w for lw in phys_lines[:first_row_li] for w in lw] if first_row_li else []
    col_centers = _cluster_columns(header_words, gap=15.0) if header_words else _cluster_columns(sel)
    if not col_centers:
        return None
    ncols = len(col_centers)

    # A table continued on the next PDF page repeats its header block
    # verbatim (same physical lines, word-for-word) before the data
    # resumes; none of those repeated header lines start with a top-level
    # digit marker, so without this check they would silently fold into
    # whatever data row was still open when the page turned. Recognize an
    # exact repeat of one of the header block's own physical lines (by its
    # word sequence) and drop it rather than appending it to the open row.
    header_line_texts = {tuple(w["text"] for w in lw) for lw in phys_lines[:first_row_li]} if first_row_li else set()

    def col_for(x0: float) -> int:
        best_i, best_d = 0, None
        for i, c in enumerate(col_centers):
            d = abs(x0 - c)
            if best_d is None or d < best_d:
                best_d, best_i = d, i
        return best_i

    rows: list[list[str]] = []
    cur: list[list[str]] | None = None
    for li, line_words in enumerate(phys_lines):
        if first_row_li and li >= first_row_li and tuple(w["text"] for w in line_words) in header_line_texts:
            continue
        by_col: dict[int, list[str]] = defaultdict(list)
        for w in line_words:
            by_col[col_for(w["x0"])].append(w["text"])
        col0_text = " ".join(by_col.get(0, []))
        if cur is None or _ROW_TOP_LEVEL_RE.match(col0_text):
            if cur is not None:
                rows.append([" ".join(c).strip() for c in cur])
            cur = [[] for _ in range(ncols)]
        for ci in range(ncols):
            if ci in by_col:
                cur[ci].extend(by_col[ci])
    if cur is not None:
        rows.append([" ".join(c).strip() for c in cur])
    rows = [r for r in rows if any(c.strip() for c in r)]
    if len(rows) > 1:
        header_key = tuple(_norm_text(c) for c in rows[0])
        deduped = [rows[0]]
        for r in rows[1:]:
            if tuple(_norm_text(c) for c in r) == header_key:
                continue
            deduped.append(r)
        rows = deduped
    if len(rows) < 2 or ncols < 2:
        return None
    return rows


def _pdfplumber_rows_are_soup(rows: list[list[str]]) -> bool:
    """A quality gate on `rows_from_pdfplumber_table`'s output: the header-
    derived column clustering is reliable for tables whose columns stay put
    across pages, but a table long enough to be re-paginated (e.g. printed
    across a magazine-style two-column page break) throws off that single
    set of canonical x-positions, producing far too many spurious columns
    and/or cells that are really several unrelated cells concatenated
    together -- the same "word soup" failure mode this algorithm exists to
    avoid, just from a different cause. Flags that pattern so the caller
    falls back to `v2` (a coarser reconstruction, but not a worse one) for
    that table, rather than accepting oversplit/overmerged output."""
    if not rows:
        return True
    ncols = max(len(r) for r in rows)
    if ncols > 5:
        return True
    cells = [c for r in rows for c in r if c.strip()]
    if not cells:
        return True
    long_cells = sum(1 for c in cells if len(c) > 300)
    if (long_cells / len(cells)) > 0.25:
        return True
    # A clean reconstruction has exactly ONE top-level digit marker per data
    # row's own label column (that IS the row boundary). If a row's own
    # label cell contains a SECOND top-level marker later in its text, two
    # (or more) numbered items were merged into one row -- the digit-anchor
    # row split missed a page-break/reflow-shifted marker and the row is
    # soup even though the column count and cell lengths look reasonable.
    markers: list[int] = []
    for row in rows[1:]:
        label_cell = row[0] if row else ""
        if len(re.findall(r"(?<![\d.])\d{1,3}[.)]\s", label_cell)) > 1:
            return True
        m0 = re.match(r"^(\d{1,3})[.)]\s", label_cell)
        if m0:
            markers.append(int(m0.group(1)))
    # A clean table's rows carry the top-level item numbers in strictly
    # increasing order (1, 2, 3, ...); a merge that silently swallowed one
    # numbered item into the previous row, or duplicated/reordered one,
    # breaks that -- a cheap, effective soup signal that a column/cell-
    # length check alone does not catch (a merged row can still look
    # "normal" width- and length-wise).
    if markers and any(b <= a for a, b in zip(markers, markers[1:])):
        return True
    return False


# --------------------------------------------------------------------------
# Table reconstruction, algorithm 4: eCFR XML (the actual fix).
#
# The pdfplumber word-coordinate approach (algorithm 3, still in this file
# but no longer used by any of the three regs after this) fixed the TOC-
# mislocation bug and the digit-vs-letter row-anchor confusion, but could
# not reliably recover column geometry across a table that reflows over
# many PDF pages -- see Gate H in REPORT.md for the honest account. The
# eCFR "full text" XML for the same as-of-date sidesteps the whole PDF
# layout problem: every table is real `<TABLE class="gpo_table">` markup
# with `<THEAD>`/`<TBODY>`/`<TFOOT>` rows and `<TD>`/`<TH>` cells, already
# correctly segmented by the government's own typesetting -- there is
# nothing to reconstruct. This algorithm is gated to jjjj/iiii/zzzz via
# `SUBPART_META[...]["table_algorithm"] = "xml"`; OOOO stays on `"v1"` and
# reads no XML at all.
# --------------------------------------------------------------------------

_XML_INLINE_TAGS = {"sup", "sub", "br"}

# Emphasis mapping used ONLY by the whole-part (49 CFR 191/192) path, which
# passes emphasis=True. The six 40 CFR subparts keep the original behaviour
# (every non-sup/sub/br tag dropped, its text kept) so their byte-identical
# table HTML is untouched -- see the `emphasis` parameter below.
#   <I>            italic (defined terms, "see", math variables)
#   <E T="nn">     GPO typographic code: 01/03/04/7462 italic, 52 superscript
#                  (footnote reference), 54 subscript (variable subscript)
#   <SU>           superscript (ft<SU>3</SU>)
#   <FR>           printed fraction ("10 <FR>3/4</FR> inches") -- plain text
_XML_EMPHASIS_TAGS = {"I": "i", "SU": "sup", "SUB": "sub"}
_XML_E_TYPE_TO_TAG = {"01": "i", "03": "i", "04": "i", "7462": "i", "52": "sup", "54": "sub"}


def _xml_inline_html(el, emphasis: bool = False) -> str:
    """Serializes an XML element's mixed content (its own text, children's
    text, and tail text) to a safe inline HTML fragment: `<sup>`/`<sub>`/
    `<br>` are kept (recursively, so nested markup inside them survives
    too); an `<E T="...">` typographic-emphasis wrapper (or any other tag
    this corpus doesn't otherwise use) is dropped but its text is kept, so
    "Table 1<E T=\"01\">a</E>" becomes plain "Table 1a", not "Table 1"."""
    out: list[str] = []
    if el.text:
        out.append(escape_html_text(el.text))
    for child in el:
        tag = child.tag.lower()
        emph_tag = None
        if emphasis:
            if child.tag == "E":
                emph_tag = _XML_E_TYPE_TO_TAG.get(child.get("T") or "")
            else:
                emph_tag = _XML_EMPHASIS_TAGS.get(child.tag)
        if tag in _XML_INLINE_TAGS:
            if tag == "br":
                out.append("<br/>")
            else:
                out.append(f"<{tag}>{_xml_inline_html(child, emphasis)}</{tag}>")
        elif emph_tag:
            out.append(f"<{emph_tag}>{_xml_inline_html(child, emphasis)}</{emph_tag}>")
        else:
            out.append(_xml_inline_html(child, emphasis))
        if child.tail:
            out.append(escape_html_text(child.tail))
    return "".join(out)


def _xml_cell_text(el) -> str:
    """Plain-text (no markup) rendering of a cell, for the proof output and
    for the row/col shape a caller might want to sanity-check -- collapses
    all whitespace, same normalization the rest of this module uses."""
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def load_xml_tables(xml_path: str) -> dict[str, dict]:
    """Parses the eCFR full-text XML and returns, for every `<DIV9 N="Table
    ... to Subpart ... of Part ...">` block, a dict keyed by the SAME
    normalized-caption key `_caption_search_key`/`_norm_alnum` produce from
    the PDF-derived caption text, so a table block found while parsing the
    PDF/txt (ids, structure, everything else) can be matched to its real
    XML markup by caption alone. Each entry carries the HEAD text, the
    lead-in `<P>` (if the eCFR print has one, e.g. "As stated in §§
    63.6600 and 63.6640, you must comply with the following ..."), and the
    list of `<TABLE>` elements under that caption in document order (more
    than one only if the eCFR print itself splits one caption's data across
    multiple `<TABLE>`s, which the caller concatenates in order)."""
    import xml.etree.ElementTree as ET

    root = ET.parse(xml_path).getroot()
    out: dict[str, dict] = {}
    for div9 in root.iter("DIV9"):
        n = div9.get("N", "")
        if not n.lower().startswith("table"):
            continue
        head_el = div9.find("HEAD")
        caption = _xml_cell_text(head_el) if head_el is not None else n
        p_el = div9.find("P")
        lead_in = _xml_cell_text(p_el) if p_el is not None else None
        tables = div9.findall(".//TABLE")
        out[_norm_alnum(n)] = {"caption": caption, "lead_in": lead_in, "tables": tables}
    return out


def _xml_extract_section_rows(table_el, section_tag: str, cell_tag: str, emphasis: bool = False) -> list[list[dict]]:
    rows: list[list[dict]] = []
    section = table_el.find(section_tag)
    if section is None:
        return rows
    for tr in section.findall("TR"):
        cells = []
        for cell in tr:
            if cell.tag != cell_tag:
                continue
            cells.append(
                {
                    "text": _xml_cell_text(cell),
                    "html": _xml_inline_html(cell, emphasis),
                    "colspan": cell.get("colspan") or cell.get("COLSPAN"),
                    "rowspan": cell.get("rowspan") or cell.get("ROWSPAN"),
                }
            )
        rows.append(cells)
    return rows


def rows_from_xml_tables(table_elems: list) -> list[list[str]]:
    """Plain-text rows (THEAD then TBODY, across all of `table_elems` in
    order) in the same list-of-list-of-str shape the other three table
    algorithms produce, for the proof output and for a uniform internal
    `_table_rows` value. The actual rendered HTML (see
    `render_xml_table_html`) is built straight from the XML elements
    instead, so it keeps colspan/rowspan and sup/sub that plain text can't
    carry."""
    rows: list[list[str]] = []
    for i, table_el in enumerate(table_elems):
        thead = _xml_extract_section_rows(table_el, "THEAD", "TH")
        tbody = _xml_extract_section_rows(table_el, "TBODY", "TD")
        if i == 0:
            for r in thead:
                rows.append([c["text"] for c in r])
        for r in tbody:
            rows.append([c["text"] for c in r])
    return rows


def render_xml_table_html(caption: str, lead_in: str | None, table_elems: list, emphasis: bool = False) -> str:
    cap = escape_html_text(caption)
    # Most 49 CFR 192 inline tables carry no <CAPTION> at all (their title is
    # the first header row); an empty caption div would render as a stray
    # blank line, so it is omitted. Every 40 CFR subpart table has a caption,
    # so this branch is never taken on the byte-identical baselines.
    cap_html = f'<div class="doc-table-caption">{cap}</div>' if cap else ""
    lead_html = f'<p class="doc-table-lead-in">{escape_html_text(lead_in)}</p>' if lead_in else ""

    def cell_attrs(cell: dict) -> str:
        attrs = ""
        if cell.get("colspan") and cell["colspan"] not in ("1", None):
            attrs += f' colspan="{escape_html_text(cell["colspan"])}"'
        if cell.get("rowspan") and cell["rowspan"] not in ("1", None):
            attrs += f' rowspan="{escape_html_text(cell["rowspan"])}"'
        return attrs

    def row_html(cells: list[dict], tag: str) -> str:
        return "<tr>" + "".join(f"<{tag}{cell_attrs(c)}>{c['html']}</{tag}>" for c in cells) + "</tr>"

    thead_html = ""
    tbody_html_parts: list[str] = []
    footnote_parts: list[str] = []
    for i, table_el in enumerate(table_elems):
        thead = _xml_extract_section_rows(table_el, "THEAD", "TH", emphasis)
        tbody = _xml_extract_section_rows(table_el, "TBODY", "TD", emphasis)
        tfoot = _xml_extract_section_rows(table_el, "TFOOT", "TD", emphasis)
        if i == 0:
            thead_html = "".join(row_html(r, "th") for r in thead)
        tbody_html_parts.extend(row_html(r, "td") for r in tbody)
        for r in tfoot:
            for c in r:
                if c["html"].strip():
                    footnote_parts.append(f'<p class="table-footnote">{c["html"]}</p>')
    if not thead_html and not tbody_html_parts:
        return f'<div class="doc-table-wrap">{cap_html}</div>'
    return (
        '<div class="doc-table-wrap">'
        f"{cap_html}"
        f"{lead_html}"
        f'<table class="doc-table"><thead>{thead_html}</thead><tbody>{"".join(tbody_html_parts)}</tbody></table>'
        f'{"".join(footnote_parts)}'
        "</div>"
    )


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
# part number widened 3->4 digits so bare "40 CFR part 1048"-style engine-
# certification-part mentions (JJJJ/IIII) get counted in the CFR-not-in-
# corpus bucket -- this only changes what gets COUNTED in the report, never
# the emitted text (an unmatched CFR-bucket mention is re-emitted verbatim
# either way), so it does not affect OOOO row-JSON byte-identity.
PART_REF_RE = re.compile(r"\bpart\s+(\d{1,4})\b(?:,?\s*subpart\s+([A-Za-z0-9]+))?", re.I)
# "Table 3 to this subpart" / "table 2c to this subpart" -- an inline
# reference to one of THIS subpart's own tables. Only turned on for subparts
# whose SUBPART_META sets enable_table_ref_links=True (see link_citations);
# OFF for OOOOa/b/c so their baselines are untouched.
TABLE_REF_RE = re.compile(r"[Tt]able\s+(?P<tblnum>[0-9]+[a-zA-Z]?)\s+to\s+this\s+subpart")

CHAIN_TOKEN_RE = re.compile(r"(?:\([a-zA-Z0-9]{1,4}\))+")

# --------------------------------------------------------------------------
# Cross-reference patterns for whole-PART (49 CFR) documents
# --------------------------------------------------------------------------
# Deliberately a SEPARATE pattern set from the 40 CFR one above: widening
# NUMREF_RE to accept a "49 CFR" prefix would change which mentions land in
# the report buckets for the six existing subparts, and their baseline
# report JSON must stay byte-identical too.
BUCKET_STATUTE = "statute"                 # 49 U.S.C. 60101 et seq., 43 U.S.C. 1331, ...
BUCKET_STANDARD = "standard_not_in_corpus"  # API 5L, ASME B31.8S, NACE SP0169, GPTC guide, ...
PART_BUCKETS = [BUCKET_CFR, BUCKET_OTHER_SUBPART, BUCKET_UNPARSEABLE, BUCKET_STATUTE, BUCKET_STANDARD]

# "§ 192.605(b)(1)", "§§ 191.15", "49 CFR 191.5", and the bare trailing
# member of a range ("§§ 192.243 through 192.245"). The bare alternative is
# anchored to 19[12] so it can only ever fire on this corpus's own two parts.
PART_NUMREF_RE = re.compile(
    r"(?P<sym1>§§?\s*)(?:49\s*CFR\s+)?(?P<part1>\d{1,3})\.(?P<num1>\d{1,4})(?P<par1>(?:\([a-zA-Z0-9]{1,7}\))*)"
    r"|(?:49\s*CFR\s+)(?P<part2>\d{1,3})\.(?P<num2>\d{1,4})(?P<par2>(?:\([a-zA-Z0-9]{1,7}\))*)"
    # The bare (no "§", no "49 CFR") alternative is anchored to this
    # corpus's own two part numbers AND refuses to fire after "-" or "/", so
    # the section number inside the importer's own figure-placeholder URL
    # (".../title-49/section-192.121") is not turned into a link.
    r"|(?<![-/\w])(?P<part3>19[12])\.(?P<num3>\d{1,4})(?P<par3>(?:\([a-zA-Z0-9]{1,7}\))*)"
)
_PART_PAREN = r"\([a-zA-Z0-9]{1,7}\)"
_PART_CHAIN = rf"(?:{_PART_PAREN})+"
PART_CHAIN_TOKEN_RE = re.compile(_PART_CHAIN)
PART_RELREF_RE = re.compile(
    r"(?P<relword>paragraphs?)\s+(?P<rellist>"
    + _PART_CHAIN + r"(?:" + _REL_LIST_SEP + _PART_CHAIN + r")*"
    + r")\s+of\s+this\s+(?P<relscope>section|paragraph)"
)
# "subpart L of this part" / "subparts I and O of this part"
PART_SUBPART_REF_RE = re.compile(
    r"\bsubparts?\s+(?P<splist>[A-Z](?:\s*(?:,|and|or|through)\s*[A-Z])*)\s+of\s+this\s+part\b"
)
# "appendix B to this part" / "Appendix E of this part"
PART_APPENDIX_REF_RE = re.compile(r"\b(?P<apxword>[Aa]ppendix)\s+(?P<apx>[A-Z])\s+(?:to|of|in)\s+this\s+part\b")
# "part 191 of this chapter", "parts 190 and 192 of this chapter", "part 195"
PART_OTHERPART_REF_RE = re.compile(r"\bparts?\s+(?P<pnum>\d{1,3})\b(?:\s+of\s+this\s+chapter)?")
# bare "this part" -> the document root
PART_THIS_PART_RE = re.compile(r"\bthis\s+part\b")
# "49 U.S.C. 60101", "43 U.S.C. 1331"
PART_USC_RE = re.compile(r"\b\d{1,2}\s+U\.S\.C\.\s+\d+[0-9A-Za-z\-]*")
# Incorporated-by-reference standards: the standard's NAME never links (it
# is not in the corpus); the "see § 192.7" that always accompanies it does,
# via PART_NUMREF_RE, because § 192.7 is a real row.
PART_STANDARD_RE = re.compile(
    r"\b(?:API|AGA|AMPP|ANSI|ASME|ASTM|AWS|CSA|GPTC|GRI|ISO|MSS|NACE|NFPA|PPI|UL|AWWA|NAPSR|PRCI)"
    r"(?:\s+(?:Spec|Std|Standard|RP|TR|SP|B|Guide|Publication))?"
    r"\s+[A-Z0-9][0-9A-Za-z./\-]*"
)


def resolve_chain_list(
    list_str: str, base_id: str, known_ids: set, token_re: re.Pattern | None = None
) -> list[tuple[int, int, str, str | None]]:
    """Tokenizes a run like "(b)(1) through (3)" (already stripped of the
    leading 'paragraph(s)'/trailing 'of this section') and resolves each
    token to a full id, reusing the previous full chain's leading segments
    for a bare trailing paren (the "(b)(1) through (3)" -> (b)(3) shorthand).
    """
    last_full: list[str] | None = None
    out = []
    for m in (token_re or CHAIN_TOKEN_RE).finditer(list_str):
        token = m.group(0)
        parens = re.findall(r"\([a-zA-Z0-9]{1,7}\)", token)
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


def _link_citations_part(
    text: str,
    own_reg: str,
    own_section_id: str,
    own_paragraph_id: str,
    known_ids: set,
    corpus_regs: set,
    unresolved: dict,
) -> str:
    """The 49 CFR whole-part rule set (see `link_citations`, which dispatches
    here for any reg whose SUBPART_META carries document="part").

    Everything the 40 CFR path does is done here too -- absolute section
    cites, "paragraph (b)(1) of this section" (shared RELREF_RE /
    resolve_chain_list), cross-document links to the other part in the
    corpus, and a counted bucket for anything out of corpus -- plus the
    three reference shapes a whole part has that a subpart does not:
    "subpart L of this part", "appendix B to this part", and bare "this
    part" (the document root)."""
    root_id = f"sec-{own_reg}-top-REG-{own_reg}"

    def span(tid: str, inner: str) -> str:
        """A row must never link to itself: "paragraph (c)(2)(ii) of this
        section", read from inside § 192.167(c)(2)(ii), resolves back to the
        citing row. Emit the text unwrapped instead -- it is not an
        unresolved reference (the target exists), it is the reader's own
        position, so it is not bucketed either."""
        if tid == own_paragraph_id:
            return inner
        return f'<span class="xref" data-target="{tid}">{inner}</span>'

    pattern = "|".join(
        p.pattern
        for p in (
            PART_NUMREF_RE,
            PART_RELREF_RE,
            PART_SUBPART_REF_RE,
            PART_APPENDIX_REF_RE,
            PART_OTHERPART_REF_RE,
            PART_THIS_PART_RE,
            PART_USC_RE,
            PART_STANDARD_RE,
        )
    )
    out: list[str] = []
    last = 0
    for m in re.finditer(pattern, text):
        out.append(text[last : m.start()])
        last = m.end()
        gd = m.groupdict()
        matched_text = m.group(0)

        # -- absolute CFR section cite ------------------------------------
        if gd.get("num1") or gd.get("num2") or gd.get("num3"):
            part = gd.get("part1") or gd.get("part2") or gd.get("part3")
            num = gd.get("num1") or gd.get("num2") or gd.get("num3")
            parens = gd.get("par1") or gd.get("par2") or gd.get("par3") or ""
            target_reg = _resolve_target_reg_49(part, num)
            if target_reg == own_reg:
                base_id = f"sec-{own_reg}-{part}.{num}"
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
                    out.append(span(tid, matched_text))
                else:
                    out.append(matched_text)
                    unresolved[BUCKET_UNPARSEABLE][matched_text.strip()] += 1
            elif target_reg in corpus_regs:
                out.append(
                    f'<a class="xref-external-reg" href="/regulations/{target_reg}">{matched_text}</a>'
                )
            else:
                out.append(matched_text)
                unresolved[BUCKET_CFR][matched_text.strip()] += 1
            continue

        # -- "paragraph(s) ... of this section/paragraph" -------------------
        if gd.get("rellist"):
            scope = gd["relscope"]
            base_id = own_section_id if scope == "section" else own_paragraph_id
            rellist_text = gd["rellist"]
            tokens = resolve_chain_list(rellist_text, base_id, known_ids, PART_CHAIN_TOKEN_RE)
            pieces = []
            pos = 0
            for s, e, token, target in tokens:
                pieces.append(rellist_text[pos:s])
                if target:
                    pieces.append(span(target, token))
                else:
                    pieces.append(token)
                    unresolved[BUCKET_UNPARSEABLE][f"paragraph {token} of this {scope}"] += 1
                pos = e
            pieces.append(rellist_text[pos:])
            out.append(f"{gd['relword']} {''.join(pieces)} of this {scope}")
            continue

        # -- "subpart L of this part" --------------------------------------
        if gd.get("splist") is not None:
            rendered = matched_text
            for letter in sorted(set(re.findall(r"\b[A-Z]\b", gd["splist"])), reverse=True):
                tid = f"sec-{own_reg}-PART-{letter}"
                if tid in known_ids:
                    replacement = span(tid, letter)
                    rendered = re.sub(
                        rf"(?<![\w>]){re.escape(letter)}(?![\w<])",
                        lambda _m, _r=replacement: _r,   # literal: no \g escapes
                        rendered,
                        count=1,
                    )
                else:
                    unresolved[BUCKET_OTHER_SUBPART][f"subpart {letter} of this part"] += 1
            out.append(rendered)
            continue

        # -- "appendix B to this part" -------------------------------------
        if gd.get("apx"):
            tid = f"sec-{own_reg}-APPENDIX-{gd['apx']}"
            if tid in known_ids:
                out.append(
                    span(tid, f'{gd["apxword"]} {gd["apx"]}')
                    + matched_text[len(gd["apxword"]) + 1 + len(gd["apx"]) :]
                )
            else:
                out.append(matched_text)
                unresolved[BUCKET_UNPARSEABLE][matched_text.strip()] += 1
            continue

        # -- "part 191 of this chapter" / "part 195" ------------------------
        if gd.get("pnum"):
            target_reg = CFR_PART_TO_REGKEY.get(f"49-{gd['pnum']}")
            if target_reg == own_reg:
                out.append(span(root_id, matched_text))
            elif target_reg in corpus_regs:
                out.append(
                    f'<a class="xref-external-reg" href="/regulations/{target_reg}">{matched_text}</a>'
                )
            else:
                out.append(matched_text)
                unresolved[BUCKET_CFR][matched_text.strip()] += 1
            continue

        # -- bare "this part" ----------------------------------------------
        if matched_text.lower() == "this part":
            out.append(span(root_id, matched_text))
            continue

        # -- statutes and incorporated standards: counted, never linked -----
        if "U.S.C." in matched_text:
            unresolved[BUCKET_STATUTE][matched_text.strip()] += 1
        else:
            unresolved[BUCKET_STANDARD][matched_text.strip()] += 1
        out.append(matched_text)
    out.append(text[last:])
    return "".join(out)


def link_citations(
    text: str,
    own_reg: str,
    own_section_id: str,
    own_paragraph_id: str,
    known_ids: set,
    corpus_regs: set,
    unresolved: dict,
) -> str:
    if SUBPART_META[own_reg].get("document") == "part":
        return _link_citations_part(
            text, own_reg, own_section_id, own_paragraph_id, known_ids, corpus_regs, unresolved
        )
    own_part = str(SUBPART_META[own_reg]["part"])
    enable_table_refs = SUBPART_META[own_reg]["enable_table_ref_links"]
    pattern = f"{NUMREF_RE.pattern}|{RELREF_RE.pattern}|{SUBPART_REF_RE.pattern}|{PART_REF_RE.pattern}"
    if enable_table_refs:
        pattern += f"|{TABLE_REF_RE.pattern}"
    out = []
    last = 0
    for m in re.finditer(pattern, text):
        out.append(text[last : m.start()])
        last = m.end()
        gd = m.groupdict()
        if gd.get("num1") or gd.get("num2") or gd.get("num3"):
            part = gd.get("part1") or gd.get("part2") or gd.get("part3")
            num = gd.get("num1") or gd.get("num2") or gd.get("num3")
            suf = (gd.get("suf1") or gd.get("suf2") or gd.get("suf3") or "").lower()
            parens = gd.get("par1") or gd.get("par2") or gd.get("par3") or ""
            matched_text = m.group(0)
            # Resolves to a reg key iff this citation falls inside THAT reg's
            # own numbering (letter-suffix based for OOOOa/b/c, number-range
            # based for the suffix-less subparts) -- see _resolve_target_reg.
            target_reg = _resolve_target_reg(part, num, suf)
            if target_reg is not None:
                sec_num = f"{part}.{num}{suf}"
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
            subcode = pm.group(2)
            if subcode:
                # "part 63, subpart ZZZZ" (note the reversed order vs.
                # SUBPART_REF_RE's "subpart X of this part") -- resolve the
                # same way, but also require the part number to match that
                # reg's own CFR part (a code could coincidentally match one
                # from the wrong part).
                candidate_reg = None
                for reg_key, letter_code in SUBPART_CODE.items():
                    if subcode.upper() == letter_code.upper() and str(SUBPART_META[reg_key]["part"]) == partnum:
                        candidate_reg = reg_key
                        break
                if candidate_reg == own_reg:
                    out.append(m.group(0))
                elif candidate_reg and candidate_reg in corpus_regs:
                    out.append(
                        m.group(0).replace(
                            f"subpart {subcode}",
                            f'<a class="xref-external-reg" href="/regulations/{candidate_reg}">subpart {subcode}</a>',
                        )
                    )
                else:
                    out.append(m.group(0))
                    unresolved[BUCKET_OTHER_SUBPART][m.group(0).strip()] += 1
                continue
            if partnum == own_part:
                out.append(m.group(0))
            else:
                out.append(m.group(0))
                unresolved[BUCKET_CFR][m.group(0).strip()] += 1
            continue
        if enable_table_refs and gd.get("tblnum"):
            tblnum = gd["tblnum"]
            tid = f"sec-{own_reg}-TABLE-{tblnum}"
            if tid in known_ids:
                out.append(f'<span class="xref" data-target="{tid}">{m.group(0)}</span>')
            else:
                out.append(m.group(0))
                unresolved[BUCKET_UNPARSEABLE][m.group(0).strip()] += 1
            continue
        out.append(m.group(0))
    out.append(text[last:])
    return "".join(out)


# --------------------------------------------------------------------------
# Main parse
# --------------------------------------------------------------------------

DEFINITIONS_RE = re.compile(r"definitions? appl", re.I)


# Hand-verified corrections to labels the eCFR itself misprints. Each entry
# rewrites the label at the start of the ONE line whose stripped text starts
# with `match_prefix` (the same policy as import_ccr.py's KNOWN_LABEL_FIXES:
# exactly one hit expected; 0 or >1 hits is reported so the fix gets
# re-checked instead of firing blindly).
KNOWN_LABEL_FIXES: dict[str, list[dict]] = {
    "ooooc": [
        dict(
            old_label="(vi)",
            new_label="(iv)",
            match_prefix="(vi) The date of successful repair of the leak and the method of monitoring used to",
            # The misprinted line is also indented deeper than its (A)-(C)
            # children (column 27 vs the (iii)/(v) siblings' column 15), so
            # even with the right label the indent-driven nesting would not
            # accept it as (iii)'s sibling; re-indent it to the sibling column.
            indent=15,
            note=(
                'In § 60.5421c(b)(11) the eCFR prints the item between (iii) and (v) as '
                '"(vi)" (and its own text cites "paragraph (b)(11)(vi)(A) through (C)"); '
                "it is (iv). Without the fix the parser could not accept it as a marker, "
                "so its three (A)-(C) children were mis-attached to (iii) as duplicate "
                "ids (found in the Sept 17 2026 second-pass review)."
            ),
        ),
    ],
}


# Hand-verified deletions of lines the eCFR print garbles. Each entry drops
# `n_lines` lines starting at the ONE line whose stripped text starts with
# `match_prefix` (again: exactly one hit expected, reported otherwise).
KNOWN_LINE_DELETIONS: dict[str, list[dict]] = {
    "oooob": [
        dict(
            match_prefix="(3) You must comply with the reporting requirements in § 60.5420b(b)(11) through (13).ecified in",
            n_lines=2,
            note=(
                "§ 60.5415b(f)(3) is printed twice: first as an overprinted fragment "
                '("...(13).ecified in § 60.5420b(c)(11) and (13).", the tail of (f)(2) '
                "bleeding into it), then cleanly. Drop the garbled copy; the clean "
                "one follows two lines later. Found Sept 17 2026 — this is the row "
                "whose summarization kept failing."
            ),
        ),
    ],
}


def apply_known_label_fixes(reg: str, lines: list[str]) -> tuple[list[str], list[dict]]:
    fixes = KNOWN_LABEL_FIXES.get(reg, [])
    deletions = KNOWN_LINE_DELETIONS.get(reg, [])
    if not fixes and not deletions:
        return lines, []
    out = list(lines)
    applied: list[dict] = []
    for fix in fixes:
        hits = 0
        for i, ln in enumerate(out):
            if ln.strip().startswith(fix["match_prefix"]):
                indent = fix.get("indent", len(ln) - len(ln.lstrip(" ")))
                rest = ln.lstrip(" ")[len(fix["old_label"]):]
                out[i] = (" " * indent) + fix["new_label"] + rest
                hits += 1
        applied.append(dict(old_label=fix["old_label"], new_label=fix["new_label"], note=fix["note"], hits=hits))
    for d in deletions:
        starts = [i for i, ln in enumerate(out) if ln.strip().startswith(d["match_prefix"])]
        for i in reversed(starts):
            del out[i : i + d["n_lines"]]
        applied.append(dict(old_label=d["match_prefix"][:40] + "…", new_label=f"(deleted {d['n_lines']} lines)", note=d["note"], hits=len(starts)))
    return out, applied


def _norm_text(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def parse_ecfr(reg: str, pdf_path: str | None, txt_path: str) -> tuple[list[dict], dict]:
    reg = _norm_reg(reg)
    meta = SUBPART_META[reg]
    suffix = meta["suffix"]
    part = meta["part"]
    code = meta["code"]
    raw = Path(txt_path).read_text(encoding="utf-8")
    lines = strip_page_furniture(raw)
    lines, label_fixes_applied = apply_known_label_fixes(reg, lines)
    heading_re = re.compile(rf"^Subpart {re.escape(code)}—")
    table_caption_re = re.compile(
        rf"^Table\s+(\w+)\s+to\s+Subpart\s+{re.escape(code)}\s+of\s+Part\s+{part}—(.*)$"
    )
    appendix_caption_re = re.compile(
        rf"^Appendix\s+(\w+)\s+to\s+Subpart\s+{re.escape(code)}\s+of\s+Part\s+{part}—(.*)$"
    )
    toc_end, body_start = find_body_start(lines, heading_re)
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
    heading_text = heading_text.replace(f"Subpart {code}—", f"Subpart {code} — ")
    root_id = f"sec-{reg}-top-REG-{reg}"
    root_citation = f"40 CFR Part {part} Subpart {code}"
    root_title = f"40 CFR Part {part} {heading_text}"

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
        m_table = table_caption_re.match(stripped) if at_col0 else None
        m_appendix = appendix_caption_re.match(stripped) if at_col0 else None
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
            while idx < len(body_lines) and body_lines[idx].strip() and not body_lines[idx].strip().startswith(("§", "Table", "Appendix")):
                # caption continues until blank line
                nxt = body_lines[idx].strip()
                cap_lines.append(nxt)
                idx += 1
            cur = {
                "type": "table",
                # Table numbers can be alphanumeric (ZZZZ's "Table 1a"), so
                # this is kept as the printed string, not cast to int.
                "num": m_table.group(1),
                "caption": re.sub(r"\s+", " ", " ".join(cap_lines)).strip(),
                "lines": [],
                "parent": root_id,
            }
            continue
        if m_appendix:
            flush()
            cap_lines = [stripped]
            idx += 1
            while idx < len(body_lines) and body_lines[idx].strip() and not body_lines[idx].strip().startswith(("§", "Table")):
                nxt = body_lines[idx].strip()
                cap_lines.append(nxt)
                idx += 1
            cur = {
                "type": "appendix",
                "num": m_appendix.group(1),
                "caption": re.sub(r"\s+", " ", " ".join(cap_lines)).strip(),
                "lines": [],
                "parent": root_id,
            }
            continue
        if m_sec:
            flush()
            num = f"{part}.{m_sec.group(1)}{m_sec.group(2)}"
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

    # -- pdfplumber table extraction pre-pass -----------------------------
    # For a reg whose table_algorithm is "pdfplumber", locate every table's
    # and appendix's caption in the actual PDF word stream UP FRONT (in
    # document order, each search starting where the previous one left off)
    # so each block's content can be bounded by [its own caption's end,
    # the NEXT table/appendix caption's start) when the main loop below
    # reaches it. table_algo_proof collects one entry per table/appendix
    # for the CLI's proof-line output (table id, page range, rows x cols,
    # first two data rows) and for a fallback-to-v2 note when the caption
    # couldn't be found or nothing was extracted.
    pdf_words: list[dict] | None = None
    pdf_table_bounds: dict[int, tuple[int, int]] = {}  # blocks-index -> (start_idx, end_idx)
    table_algo_proof: list[dict] = []
    if meta["table_algorithm"] == "pdfplumber" and pdf_path:
        if pdfplumber is None:
            table_algo_proof.append({"error": "pdfplumber not installed; all tables fell back to v2"})
        else:
            with pdfplumber.open(pdf_path) as pdf:
                pdf_words = _pdf_body_words(pdf)
            table_block_idxs = [i for i, b in enumerate(blocks) if b["type"] in ("table", "appendix")]

            def _locate_from(cursor: int) -> dict[int, int | None]:
                """Sequential caption search for every table/appendix block,
                each one starting where the previous one's match left off."""
                found_map: dict[int, int | None] = {}
                c = cursor
                for bi in table_block_idxs:
                    b = blocks[bi]
                    kind = "Table" if b["type"] == "table" else "Appendix"
                    key = _caption_search_key(kind, str(b["num"]), code, part)
                    found = _find_word_index(pdf_words, key, start=c)
                    found_map[bi] = found
                    if found is not None:
                        c = found + 1
                return found_map

            # The eCFR print's front matter includes a "List of Tables" table
            # of contents that repeats every one of these same captions, in
            # the same order, densely packed (tens of words apart) BEFORE the
            # real body -- a naive single left-to-right sequential search
            # (cursor 0) latches onto that TOC copy for every table, since
            # each is the very first match found. Detect that by re-running
            # the same sequential search starting just past the last match
            # found; if the very first table's caption is found again further
            # on, that second cluster is the real, body one (spaced hundreds
            # of words apart, not tens) and is used instead.
            starts = _locate_from(0)
            found_positions = [v for v in starts.values() if v is not None]
            if found_positions and table_block_idxs:
                first_bi = table_block_idxs[0]
                retry_cursor = max(found_positions) + 1
                key0 = _caption_search_key(
                    "Table" if blocks[first_bi]["type"] == "table" else "Appendix",
                    str(blocks[first_bi]["num"]),
                    code,
                    part,
                )
                if _find_word_index(pdf_words, key0, start=retry_cursor) is not None:
                    starts = _locate_from(retry_cursor)

            for pos, bi in enumerate(table_block_idxs):
                start = starts[bi]
                if start is None:
                    continue
                # Skip past the caption's own words (roughly its word count)
                # so the extracted range starts at the table's actual content.
                cap_word_count = len(blocks[bi]["caption"].split())
                content_start = min(start + cap_word_count, len(pdf_words))
                end = len(pdf_words)
                for later_bi in table_block_idxs[pos + 1 :]:
                    if starts.get(later_bi) is not None:
                        end = starts[later_bi]
                        break
                pdf_table_bounds[bi] = (content_start, end)

    # -- eCFR XML table lookup (algorithm 4 -- see the big comment above
    # `render_xml_table_html`) ---------------------------------------------
    # The XML sibling is resolved from the PDF path (Path(pdf_path).with_
    # suffix(".xml")), NOT from txt_path -- e.g. sources/ZZZZ.pdf ->
    # sources/ZZZZ.xml. If it's missing (a CI checkout without the XML
    # fixtures, a reg that has PDF/txt sources but no XML yet, a typo'd
    # --pdf path), every table for this reg silently degrades to the `v2`
    # reconstruction unless this is loud about it -- so it is: a WARNING is
    # printed to stderr immediately (not just buried in the per-table proof
    # list), in addition to the existing table_algo_proof "error" entry
    # that the CLI's normal proof output also prints.
    xml_tables: dict[str, dict] = {}
    if meta["table_algorithm"] == "xml":
        xml_path = str(Path(pdf_path).with_suffix(".xml")) if pdf_path else None
        if not xml_path or not Path(xml_path).exists():
            msg = f"WARNING: XML source not found ({xml_path}) -- ALL {reg} tables are falling back to v2 reconstruction, not the eCFR XML"
            print(msg, file=sys.stderr)
            table_algo_proof.append({"error": msg})
        else:
            try:
                xml_tables = load_xml_tables(xml_path)
            except Exception as exc:  # pragma: no cover -- defensive, not expected on well-formed eCFR XML
                msg = f"WARNING: failed to parse {xml_path}: {exc} -- ALL {reg} tables are falling back to v2 reconstruction"
                print(msg, file=sys.stderr)
                table_algo_proof.append({"error": msg})

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
        # FIRST occurrence's citation/parent/title. If the later occurrence's
        # text is the same text again (60.5401b's case: an exact reprint), it
        # is dropped — until Sept 17 2026 it was appended, which produced 21
        # rows reading "...low-e valve; or ...low-e valve; or" (the same
        # sentence twice), caught by the second-pass review. If the text
        # DIFFERS (a mis-nested paragraph, or 60.5401b(i)(2)(ii), whose two
        # printed copies word their cross-reference differently) it is still
        # appended so nothing is silently lost; every case is reported in
        # `duplicate_ids` for the editor's notes.
        existing = by_id.get(row["id"])
        if existing is not None:
            duplicate_ids.append(row["id"])
            if _norm_text(existing["full_text"]) != _norm_text(row["full_text"]):
                existing["full_text"] += row["full_text"]
            return
        by_id[row["id"]] = row
        rows.append(row)

    for bi, block in enumerate(blocks):
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
            body_seen_nums.add(f"{part}.{block['num1']}")
            rid = f"sec-{reg}-{part}.{block['num1']}-{part}.{block['num2']}"
            add_row(
                {
                    "id": rid,
                    "citation": f"§§ {part}.{block['num1']}-{part}.{block['num2']}",
                    "title": f"§§ {part}.{block['num1']}-{part}.{block['num2']} [Reserved]",
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": f"§§ {part}.{block['num1']}-{part}.{block['num2']} [Reserved]",
                    "kind": "heading",
                }
            )
        elif block["type"] == "table":
            rid = f"sec-{reg}-TABLE-{block['num']}"
            table_rows = None
            html = None
            display_caption = None  # overrides block["caption"] for title/full_text when set below
            if meta["table_algorithm"] == "xml":
                key = _norm_alnum(f"Table {block['num']} to Subpart {code} of Part {part}")
                entry = xml_tables.get(key)
                proof = {"id": rid, "algorithm": "xml", "caption": block["caption"]}
                if entry is not None and entry["tables"]:
                    table_rows = rows_from_xml_tables(entry["tables"])
                    # block["caption"] is PDF/txt-derived and swallows any
                    # prose immediately following the table's title line up
                    # to the next blank line -- which, for every one of
                    # these tables, IS the same lead-in sentence the XML
                    # carries separately as its own <P> ("As stated in
                    # §§ ..., you must comply with the following ...").
                    # Rendering block["caption"] as the caption AND
                    # entry["lead_in"] as its own paragraph would print
                    # that sentence twice back to back. When the XML has a
                    # lead-in, use the XML's own (short, lead-in-free) HEAD
                    # text as the caption instead, and let the lead-in
                    # render exactly once, in its own <p>. When the XML has
                    # no lead-in for this table, there's nothing to
                    # duplicate, so keep the PDF-derived caption as before.
                    display_caption = entry["caption"] if entry.get("lead_in") else block["caption"]
                    html = render_xml_table_html(display_caption, entry["lead_in"], entry["tables"])
                    proof["xml_match"] = "yes"
                    proof["shape"] = f"{len(table_rows)} rows x {max((len(r) for r in table_rows), default=0)} cols"
                    proof["sample"] = table_rows[:2]
                    proof["lead_in_deduped"] = bool(entry.get("lead_in"))
                else:
                    proof["xml_match"] = "no"
                    proof["fallback"] = "v2 (no matching <DIV9 N=\"Table ...\"> caption found in the XML)"
                table_algo_proof.append(proof)
            if meta["table_algorithm"] == "pdfplumber":
                proof: dict = {"id": rid, "algorithm": "pdfplumber"}
                bounds = pdf_table_bounds.get(bi)
                if bounds is not None and pdf_words:
                    start_idx, end_idx = bounds
                    pdf_rows = rows_from_pdfplumber_table(pdf_words, start_idx, end_idx)
                    if (
                        pdf_rows
                        and len(pdf_rows) >= 2
                        and max((len(r) for r in pdf_rows), default=0) >= 2
                        and not _pdfplumber_rows_are_soup(pdf_rows)
                    ):
                        table_rows = pdf_rows
                        pages = sorted(
                            {pdf_words[i]["page"] for i in range(start_idx, min(end_idx, len(pdf_words)))}
                        )
                        proof["pages"] = [pages[0] + 1, pages[-1] + 1] if pages else None
                        proof["shape"] = f"{len(pdf_rows)} rows x {max(len(r) for r in pdf_rows)} cols"
                        proof["sample"] = pdf_rows[:2]
                    else:
                        pages = sorted(
                            {pdf_words[i]["page"] for i in range(start_idx, min(end_idx, len(pdf_words)))}
                        )
                        proof["pages"] = [pages[0] + 1, pages[-1] + 1] if pages else None
                        proof["attempted_shape"] = (
                            f"{len(pdf_rows)} rows x {max((len(r) for r in pdf_rows), default=0)} cols"
                            if pdf_rows
                            else "0 rows (nothing extracted)"
                        )
                        if pdf_rows and (len(pdf_rows) < 2 or max((len(r) for r in pdf_rows), default=0) < 2):
                            proof["fallback"] = "v2 (pdfplumber extraction degenerate or empty for this table)"
                        else:
                            proof["fallback"] = (
                                "v2 (pdfplumber column geometry did not hold across this table's page span "
                                "-- oversplit columns / merged cells detected, discarded to avoid a worse "
                                "word-soup result)"
                            )
                else:
                    proof["fallback"] = "v2 (table caption not located in PDF word stream)"
                table_algo_proof.append(proof)
            if table_rows is None:
                table_fn = (
                    rows_from_layout_block_v2
                    if meta["table_algorithm"] in ("v2", "pdfplumber", "xml")
                    else rows_from_layout_block
                )
                table_rows = table_fn(block["lines"])
                if meta["table_algorithm"] in ("pdfplumber", "xml"):
                    proof["v2_fallback_shape"] = (
                        f"{len(table_rows)} rows x {max((len(r) for r in table_rows), default=0)} cols"
                        if table_rows
                        else "0 rows"
                    )
                    proof["v2_fallback_sample"] = table_rows[:2] if table_rows else []
            if html is None:
                html = render_table_html(block["caption"], table_rows)
            add_row(
                {
                    "id": rid,
                    "citation": f"Table {block['num']} to Subpart {code} of Part {part}",
                    "title": display_caption if display_caption is not None else block["caption"],
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": html,
                    "kind": "appendix",
                    "_table_rows": table_rows,
                }
            )
        elif block["type"] == "appendix":
            # ZZZZ's Appendix A: numbered N.0 / N.N / N.N.N paragraphs, NOT
            # the CFR (a)(1)(i)(A) marker cycle -- per the importer brief,
            # since these aren't CFR-style labels the whole appendix becomes
            # ONE row (kind "appendix") rather than a parsed tree of children.
            aid = f"sec-{reg}-APPENDIX-{block['num']}"
            paras = split_paragraphs(block["lines"])
            full_text = "".join(f"<p>{escape_html_text(p)}</p>" for p in paras) if paras else ""
            add_row(
                {
                    "id": aid,
                    "citation": f"Appendix {block['num']} to Subpart {code} of Part {part}",
                    "title": block["caption"],
                    "parent_id": block["parent"],
                    "sort_order": next_sort(),
                    "full_text": full_text or block["caption"],
                    "kind": "appendix",
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
                paras = split_paragraphs(buffers.get(mr.get("buffer_key", mr["id"]), []))
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
        "label_fixes_applied": label_fixes_applied,
        "unresolved": unresolved,
        "n_group_headings": group_counter,
        "n_tables": sum(1 for b in blocks if b["type"] == "table"),
        "table_algo_proof": table_algo_proof,
    }
    return rows, report


# --------------------------------------------------------------------------
# Whole-PART (49 CFR 191 / 192) parse, from the eCFR versioner XML
# --------------------------------------------------------------------------
#
# Why the XML and not the PDF print: for a whole part the eCFR XML is a
# complete, already-correct structural description --
#
#   <DIV5 TYPE="PART">
#     <DIV6 TYPE="SUBPART" N="L"><HEAD>Subpart L—Operations</HEAD>
#       <DIV8 TYPE="SECTION" N="192.605"><HEAD>§ 192.605 ...</HEAD>
#         <P>(a) ...</P> <DIV><TABLE>...</TABLE></DIV> <CITA>[...]</CITA>
#     <DIV9 TYPE="APPENDIX" N="Appendix B to Part 192">
#
# -- so the indentation heuristics the PDF path needs (parse_section_body,
# rows_from_layout_block*) have nothing to reconstruct. What IS still
# needed, and is shared verbatim with the PDF path, is the CFR
# paragraph-label CYCLE ((a) -> (1) -> (i) -> (A) -> (1) -> (i) ...): the
# XML flattens every paragraph of a section into sibling <P> elements and
# encodes their nesting only in the printed label, so the tree is rebuilt
# from the label sequence by `_advance_part_label_stack` below.

# Up to SEVEN characters, not the subpart path's four: 49 CFR 192.917(b)(1)
# runs its roman sub-list out to (xxxv), and a CFR roman label can reach
# (xxxviii). This regex is used only by the whole-part path.
_PART_LEAD_LABEL_RE = re.compile(r"^\((?P<lab>[a-zA-Z0-9]{1,7})\)\s*")
# "(b) This section does not apply to: (1) Manifolds;" -- a chapeau and its
# first child item printed on one line with no italic heading. Only a
# first-of-family label counts, so an ordinary parenthetical cannot split a
# paragraph in half.
_PART_LEAD_INTRO_RE = re.compile(r"^(?P<lead>.{0,160}?[:\u2014])\s+(?=\((?:1|i|A|a)\)\s)")
# A heading run at the head of a paragraph: an italic phrase, optionally
# closed by a period or by the em-dash the eCFR uses when the heading and
# its first child item share a line ("(a) <i>Pipeline systems</i>—(1) ...").
_PART_LEAD_ITALIC_RE = re.compile(r"^<i>.*?</i>[.,:;\u2013\u2014-]?\s*")
_PART_DEF_TERM_STRIP_RE = re.compile(r"[\s.,;:]+$")
# Appendix ladder labels, outermost shape first. A whole-part appendix is
# numbered in printer's style (I. / A. / 1. / (1)), not in the CFR
# paragraph cycle, so it gets its own shallow ladder.
_APX_ROMAN_RE = re.compile(r"^(?P<lab>[IVXL]{1,6})\.\s+(?=\S)")
_APX_ALPHA_RE = re.compile(r"^(?P<lab>[A-Z])\.\s+(?=\S)")
_APX_PAREN_ALPHA_RE = re.compile(r"^\((?P<lab>[a-z])\)\s+(?=\S)")
_APX_PAREN_DIGIT_RE = re.compile(r"^\((?P<lab>\d{1,2})\)\s+(?=\S)")
_APX_LADDER = [
    ("ROMAN", _APX_ROMAN_RE),
    ("ALPHA", _APX_ALPHA_RE),
    ("PAREN_ALPHA", _APX_PAREN_ALPHA_RE),
    ("PAREN_DIGIT", _APX_PAREN_DIGIT_RE),
]
_APX_NEXT = {
    "ROMAN": lambda v: _int_to_roman(_roman_to_int(v) + 1).upper(),
    "ALPHA": lambda v: _next_base26(v).upper(),
    "PAREN_ALPHA": lambda v: _next_base26(v),
    "PAREN_DIGIT": lambda v: str(int(v) + 1),
}
_APX_FIRST = {"ROMAN": "I", "ALPHA": "A", "PAREN_ALPHA": "a", "PAREN_DIGIT": "1"}

# Appendices whose printed ladder is NOT unambiguous, so the appendix stays
# one row (see REPORT.md gate A). Appendix D to Part 192 fuses up to three
# ladder levels onto one printed line ("I. Criteria for cathodic
# protection— A. Steel, cast iron, and ductile iron structures. (1) A
# negative ..."), so its (1)-(5) items cannot be attached to the right
# parent without guessing; it is kept whole rather than mis-nested.
PART_FLAT_APPENDICES: dict[str, set[str]] = {
    "p192": {"D"},
    # Appendix A to Part 194 restarts an unlabelled ladder under each of its
    # nine <HD2> "Response Plan: Section N" headings ((a)/(1) inside Section 1,
    # then (a)/(1) again inside Section 2 ...), and prints an introductory
    # (1)-(3) list before the first heading, so no single contiguous ladder
    # exists to attach children to. Appendix C to Part 195 fuses "I." / "A." /
    # "(1)" levels the same way Appendix D to Part 192 does. Both are declared
    # here so the one-row outcome is a recorded decision, not an accident of
    # the probe (the probe reaches the same verdict on its own -- see the
    # appendix_modes lines in each _report.json).
    "p194": {"A"},
    "p195": {"C"},
}

# Sections that are NOT titled "Definitions" but nevertheless print a block of
# definition paragraphs inside one of their own lettered paragraphs. Opt-in per
# section, because the shape (an unlabelled <P> opening with an <I> run) also
# occurs harmlessly elsewhere.
#   § 195.6(c) "Definitions used in this part—" -> 26 terms that would
#   otherwise all fuse into § 195.6(c)(4), an 8.5 KB / 1,251-word row.
# NOT enabled for p192 in this batch: §§ 192.15(a), 192.383(a) and 192.385(a)
# print the same shape (7 terms in total) and would benefit from the same
# treatment, but turning it on there would change the Part 192 parse that
# Batch A shipped and signed off. Flagged in REPORT_batchB.md as a follow-up.
PART_INLINE_DEFINITION_SECTIONS: dict[str, set[str]] = {"p195": {"195.6"}}


def _xml_text(el) -> str:
    """Collapsed plain text of an element and everything under it."""
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def _part_inline_html(el) -> str:
    """Inline HTML for one <P>/<FP-*>/<HD*> element of a whole-part
    document: emphasis preserved (see `_xml_inline_html(..., emphasis=True)`),
    whitespace collapsed, and the newline the eCFR XML puts before a
    superscript ("100 ft\\n<SU>3</SU>") removed so it renders as ft<sup>3</sup>."""
    html = _xml_inline_html(el, emphasis=True)
    html = re.sub(r"\s+", " ", html).strip()
    html = re.sub(r"\s+(<sup>|<sub>)", r"\1", html)
    return html


class _PartLevel:
    __slots__ = ("family", "value", "row_id")

    def __init__(self, family, value, row_id):
        self.family = family
        self.value = value
        self.row_id = row_id


def _advance_part_label_stack(
    stack: list[_PartLevel], label: str, future: tuple[str, ...] = ()
) -> str | None:
    """Decides where a printed paragraph label belongs, given the open label
    stack and the labels still to come in this section. Returns
    "sibling"/"push"/"pop:<n>"/None (None = the label fits nowhere).

    Tests, in order:
      1. successor of the CURRENT level -- "(h)" then "(i)" is the next
         alpha sibling, not a new roman sub-level;
      2. otherwise the FIRST label of the next deeper level -- "(h)(2)"
         then "(i)" is roman (h)(2)(i);
      3. otherwise the successor of some shallower open level (close every
         level below it).

    Tests 2 and 3 genuinely collide in exactly one place in the CFR label
    cycle: a lone "(i)" after a level-1 "(h)" that has open children is
    BOTH the first lower-case roman of a new sub-level AND the next
    top-level alpha sibling. The printed indentation the PDF path uses to
    tell them apart does not exist in the XML, so the surrounding label
    stream decides instead: if the alpha successor ("(j)") shows up later
    in the section, or the very next label is not one a roman "(i)" could
    have ("(ii)" or its own first child), the shallower reading wins.
    Without this, § 192.7(i), § 192.321(i) and § 192.631(i) all nest
    themselves under (h) and drag their children with them.
    """
    if stack:
        top = stack[-1]
        if shape_matches(top.family, label) and label == next_of_family(top.family, top.value):
            return "sibling"
    fam = family_for_depth(len(stack) + 1)
    push_ok = shape_matches(fam, label) and label == first_of_family(fam)
    shallow = None
    for k in range(len(stack) - 2, -1, -1):
        lvl = stack[k]
        if shape_matches(lvl.family, label) and label == next_of_family(lvl.family, lvl.value):
            shallow = k
            break
    if push_ok and shallow is not None:
        succ = next_of_family(stack[shallow].family, label)
        nxt = future[0] if future else None
        allowed_after_push = {
            next_of_family(fam, label),
            first_of_family(family_for_depth(len(stack) + 2)),
        }
        # The LOCAL evidence wins over the distant one. If the very next
        # label is one only the deeper reading could produce -- "(ii)", or
        # the first label of the level below the pushed one -- then this
        # "(i)" really is a roman sub-item, however far away the shallower
        # successor may also appear. 49 CFR 195.452 is the case that proves
        # it: it has BOTH an (h)(1)(i)/(ii) roman pair AND, later, a genuine
        # top-level paragraph (i), so "(j) shows up later in the section"
        # is true at the roman (i) as well and, on its own, mis-pops it (and
        # with it the 24 labels underneath). The p192 sections this
        # heuristic was written for -- 192.7(i), 192.321(i), 192.631(i) --
        # are all decided by the same local test alone: each is followed by
        # "(1)" or "(j)", neither of which a roman "(i)" could be followed
        # by, so they still pop to the alpha level exactly as before.
        deeper_ok = nxt is not None and nxt in allowed_after_push
        if deeper_ok:
            return "push"
        if succ in future or nxt is None or nxt not in allowed_after_push:
            return f"pop:{shallow}"
        return "push"
    if push_ok:
        return "push"
    if shallow is not None:
        return f"pop:{shallow}"
    return None


def _split_part_paragraph(html: str) -> list[tuple[list[str], str]]:
    """Splits one <P>'s inline HTML into (new_labels, text) segments.

    Three printed shapes occur in 49 CFR 191/192:
      "(a) text"                      -> [(["a"], "text")]
      "(1)(i) text"                   -> [(["1","i"], "text")]   (§ 192.3 UNGSF)
      "(b) <i>Heading.</i> (1) text"  -> [(["b"], "<i>Heading.</i>"),
                                          (["1"], "text")]       (§ 192.121(b))
    A paragraph with no leading label returns [([], html)] -- it is the
    continuation text of whatever row is currently open.
    """
    segs: list[tuple[list[str], str]] = []
    rest = html
    while True:
        labels: list[str] = []
        while True:
            m = _PART_LEAD_LABEL_RE.match(rest)
            if not m:
                break
            labels.append(m.group("lab"))
            rest = rest[m.end() :]
        if not labels:
            if not segs:
                return [([], html)]
            if rest.strip():
                segs.append(([], rest.strip()))
            return segs
        mi = _PART_LEAD_ITALIC_RE.match(rest)
        if mi and _PART_LEAD_LABEL_RE.match(rest[mi.end() :]):
            segs.append((labels, rest[: mi.end()].strip().rstrip("\u2014\u2013-").strip()))
            rest = rest[mi.end() :]
            continue
        mc = _PART_LEAD_INTRO_RE.match(rest)
        if mc:
            segs.append((labels, rest[: mc.end()].strip()))
            rest = rest[mc.end() :]
            continue
        segs.append((labels, rest.strip()))
        return segs


def _definition_slug(term: str, used: set) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", term.lower()).strip("-") or "term"
    slug = base
    n = 1
    while slug in used:
        n += 1
        slug = f"{base}-{n}"
    used.add(slug)
    return slug


def _part_image_placeholder(url: str) -> str:
    return (
        '<p class="figure-omitted">[Figure/equation not reproduced — see the eCFR: '
        f"{escape_html_text(url)}]</p>"
    )


def _part_tables_in(div_el) -> list:
    return div_el.findall(".//TABLE")


def _part_table_caption(table_el) -> str:
    cap = table_el.find("CAPTION")
    if cap is None:
        return ""
    return _xml_text(cap)


def parse_ecfr_part(reg: str, xml_path: str) -> tuple[list[dict], dict]:
    """Parses a whole 49 CFR part's eCFR versioner XML into the same
    provisions row shape the subpart path produces."""
    import xml.etree.ElementTree as ET

    reg = _norm_reg(reg)
    meta = SUBPART_META[reg]
    if meta.get("document") != "part":
        raise ValueError(f"{reg} is not a whole-part document; use parse_ecfr()")
    part = meta["part"]
    title = meta["title"]
    base_url = meta["url"]

    root_el = ET.parse(xml_path).getroot()
    rows: list[dict] = []
    sort_order = 0

    def next_sort():
        nonlocal sort_order
        v = sort_order
        sort_order += 10
        return v

    root_id = f"sec-{reg}-top-REG-{reg}"
    rows.append(
        {
            "id": root_id,
            "citation": meta["root_citation"],
            "title": meta["root_title"],
            "parent_id": None,
            "sort_order": next_sort(),
            "full_text": meta["root_title"],
            "kind": "root",
        }
    )

    by_id: dict[str, dict] = {r["id"]: r for r in rows}
    duplicate_ids: list[str] = []
    label_anomalies: list[dict] = []
    stripped_counts = Counter()
    images: list[dict] = []
    tables: list[dict] = []
    footnotes: list[dict] = []
    reserved: list[str] = []
    definitions: list[dict] = []
    appendix_modes: dict[str, str] = {}
    section_index: dict[str, list[str]] = {}
    # <DIV7 TYPE="SUBJGRP"> centre-headings met inside a subpart (Part 195
    # Subpart F only, so far). Reported, not turned into rows -- see the walk.
    subject_groups: list[dict] = []

    def add_row(row: dict):
        if row["id"] in by_id:
            duplicate_ids.append(row["id"])
            existing = by_id[row["id"]]
            if _norm_text(existing["full_text"]) != _norm_text(row["full_text"]):
                existing["full_text"] += row["full_text"]
            return by_id[row["id"]]
        by_id[row["id"]] = row
        rows.append(row)
        return row

    # ---- one section (DIV8) -------------------------------------------
    def parse_section(div8, parent_id: str, subpart_letter: str | None):
        n = div8.get("N") or ""
        head_el = div8.find("HEAD")
        head_text = _xml_text(head_el) if head_el is not None else f"§ {n}"
        sec_id = f"sec-{reg}-{n}"
        is_range = "-" in n
        citation = ("§§ " if is_range else "§ ") + n
        sec_url = f"{base_url.rsplit('/part-', 1)[0]}/section-{n}"
        kids = [k for k in div8 if k.tag != "HEAD"]
        body_kids = [k for k in kids if k.tag not in ("CITA", "EDNOTE", "XREF", "SOURCE", "AUTH")]
        for k in kids:
            if k.tag in ("CITA", "EDNOTE", "XREF", "SOURCE", "AUTH"):
                stripped_counts[k.tag] += 1
        if not body_kids or head_text.endswith("[Reserved]"):
            reserved.append(citation)
            add_row(
                {
                    "id": sec_id,
                    "citation": citation,
                    "title": head_text,
                    "parent_id": parent_id,
                    "sort_order": next_sort(),
                    "full_text": "<p>[Reserved]</p>",
                    "kind": "section",
                }
            )
            section_index.setdefault(subpart_letter or "", []).append(n)
            return
        section_index.setdefault(subpart_letter or "", []).append(n)

        # "§ 192.3 Definitions." and "§ 192.903 What definitions apply to
        # this subpart?" are both definition sections.
        is_definitions = bool(re.search(r"\bdefinitions?\b", head_text, re.I))
        inline_def_section = n in PART_INLINE_DEFINITION_SECTIONS.get(reg, set())
        in_def_block = False
        def_block_parent: str | None = None
        sec_row = add_row(
            {
                "id": sec_id,
                "citation": citation,
                "title": head_text,
                "parent_id": parent_id,
                "sort_order": next_sort(),
                "full_text": "",
                "kind": "section",
                "_own_section_id": sec_id,
            }
        )

        # Every paragraph label this section will print, in order -- the
        # lookahead `_advance_part_label_stack` needs to tell a top-level
        # "(i)" from a roman sub-item (see its docstring).
        flat_labels: list[str] = []
        if not is_definitions:
            for el in body_kids:
                if el.tag != "P":
                    continue
                probe_html = _part_inline_html(el)
                if not probe_html:
                    continue
                for chain, _t in _split_part_paragraph(probe_html):
                    flat_labels.extend(chain)
        label_cursor = 0

        # `open_row` is the row that free text / tables / images attach to.
        open_row = sec_row
        stack: list[_PartLevel] = []
        used_slugs: set = set()
        pending_rows: list[dict] = []

        def emit_item(new_id: str, parent: str, text_html: str, chain: list[str]):
            item_citation = citation + "".join(f"({c})" for c in chain)
            heading_word = None
            plain = _norm_text(text_html)
            if plain:
                # A paragraph whose whole text is the italic heading run --
                # "(b) <i>General requirements for plastic pipe and
                # components.</i> (1) ..." leaves (b) holding just the
                # heading -- has no trailing sentence for
                # split_heading_from_text to key on, so take it directly.
                if re.fullmatch(r"<i>[^<]{1,120}</i>", text_html):
                    heading_word = plain.rstrip(".")
                else:
                    heading_word, _ = split_heading_from_text(plain)
            row = add_row(
                {
                    "id": new_id,
                    "citation": item_citation,
                    "title": f"{item_citation} {heading_word}" if heading_word else item_citation,
                    "parent_id": parent,
                    "sort_order": next_sort(),
                    "full_text": f"<p>{text_html}</p>" if text_html else "",
                    "kind": "item",
                    "_own_section_id": sec_id,
                }
            )
            pending_rows.append(row)
            return row

        def append_html(row, html: str):
            row["full_text"] = (row["full_text"] or "") + html

        for el in body_kids:
            tag = el.tag
            if tag == "P":
                html = _part_inline_html(el)
                if not html:
                    continue
                if is_definitions:
                    first = list(el)
                    if (not (el.text or "").strip()) and first and first[0].tag == "I":
                        term = _PART_DEF_TERM_STRIP_RE.sub("", _xml_text(first[0]))
                        slug = _definition_slug(term, used_slugs)
                        did = f"{sec_id}-{slug}"
                        open_row = add_row(
                            {
                                "id": did,
                                "citation": f"{citation} “{term}”",
                                "title": f"{citation} “{term}”",
                                "parent_id": sec_id,
                                "sort_order": next_sort(),
                                "full_text": f"<p>{html}</p>",
                                "kind": "definition",
                                "_own_section_id": sec_id,
                            }
                        )
                        definitions.append({"id": did, "term": term})
                        continue
                    # A numbered sub-paragraph of the definition just above
                    # (§ 191.3 "Incident" (1)(i)...): folded into that term's
                    # own row -- one row per term, as specified.
                    append_html(open_row, f"<p>{html}</p>")
                    continue
                if inline_def_section:
                    # An in-SECTION definition block: a chapeau ("(c)
                    # Definitions used in this part—") followed by unlabelled
                    # <P><I>Term</I> means ...</P> paragraphs, in a section
                    # whose own heading says nothing about definitions. Same
                    # row shape as a definitions section, but the terms hang
                    # off the chapeau row instead of the section row.
                    first = list(el)
                    is_term = (
                        (not (el.text or "").strip())
                        and first
                        and first[0].tag == "I"
                        and not _PART_LEAD_LABEL_RE.match(html)
                    )
                    if is_term:
                        term = _PART_DEF_TERM_STRIP_RE.sub("", _xml_text(first[0]))
                        # "<i>Terrestrial species with a limited range means</i>
                        # a non-aquatic ..." -- § 195.6(c) prints one term with
                        # the verb inside the italics; the term is the phrase
                        # before it, as for every other entry in the block.
                        term = re.sub(r"\s+means$", "", term)
                        slug = _definition_slug(term, used_slugs)
                        did = f"{sec_id}-{slug}"
                        if def_block_parent is None:
                            def_block_parent = open_row["id"]
                        open_row = add_row(
                            {
                                "id": did,
                                "citation": f"{citation} “{term}”",
                                "title": f"{citation} “{term}”",
                                "parent_id": def_block_parent,
                                "sort_order": next_sort(),
                                "full_text": f"<p>{html}</p>",
                                "kind": "definition",
                                "_own_section_id": sec_id,
                            }
                        )
                        definitions.append({"id": did, "term": term})
                        in_def_block = True
                        continue
                    if in_def_block:
                        # Everything after the first term, labelled or not, is
                        # that term's own sub-paragraph (§ 195.6(c) "Class I
                        # Aquifer" (1)-(4)) -- folded into its row, exactly as
                        # the definitions-section path folds § 191.3
                        # "Incident" (1)(i). The label cursor still advances so
                        # the lookahead stays aligned for the rest of the
                        # section.
                        for chain, _t in _split_part_paragraph(html):
                            label_cursor += len(chain)
                        append_html(open_row, f"<p>{html}</p>")
                        continue
                for chain, text_html in _split_part_paragraph(html):
                    if not chain:
                        append_html(open_row, f"<p>{text_html}</p>")
                        continue
                    for i, label in enumerate(chain):
                        label_cursor += 1
                        move = _advance_part_label_stack(
                            stack, label, tuple(flat_labels[label_cursor:])
                        )
                        if move is None:
                            label_anomalies.append(
                                {
                                    "section": n,
                                    "label": label,
                                    "open_stack": "".join(f"({lv.value})" for lv in stack),
                                    "text": _norm_text(text_html)[:80],
                                }
                            )
                            append_html(open_row, f"<p>({label}) {text_html}</p>")
                            break
                        if move == "sibling":
                            stack.pop()
                        elif move.startswith("pop:"):
                            del stack[int(move.split(":")[1]) :]
                        parent = stack[-1].row_id if stack else sec_id
                        new_id = f"{parent}-({label})"
                        fam = family_for_depth(len(stack) + 1)
                        stack.append(_PartLevel(fam, label, new_id))
                        is_last = i == len(chain) - 1
                        open_row = emit_item(
                            new_id,
                            parent,
                            text_html if is_last else "",
                            [lv.value for lv in stack],
                        )
            elif tag in ("FP", "FP-1", "FP-2"):
                html = _part_inline_html(el)
                if html:
                    append_html(open_row, f"<p>{html}</p>")
            elif tag == "EXTRACT":
                for sub in el:
                    html = _part_inline_html(sub)
                    if html:
                        append_html(open_row, f"<p>{html}</p>")
                stripped_counts["EXTRACT"] += 1
            elif tag == "NOTE":
                hed = el.find("HED")
                lead = _xml_text(hed) if hed is not None else "Note:"
                for sub in el:
                    if sub.tag == "HED":
                        continue
                    html = _part_inline_html(sub)
                    if html:
                        append_html(open_row, f"<p>{escape_html_text(lead)} {html}</p>")
            elif tag == "FTNT":
                # A footnote printed under a section's table (§ 195.303,
                # § 195.563). Unlike <CITA>/<EDNOTE> this is substantive
                # regulatory text -- "A pipeline does not have an effective
                # external coating material if ..." -- so it is kept, attached
                # to whatever row the table itself landed in. Parts 191/192
                # print none of these at section level, so this branch never
                # fires for them.
                html = _part_inline_html(el)
                if html:
                    append_html(open_row, f'<p class="footnote">{html}</p>')
                    footnotes.append({"row": open_row["id"], "section": n})
            elif tag == "img":
                append_html(open_row, _part_image_placeholder(sec_url))
                images.append({"row": open_row["id"], "src": el.get("src"), "url": sec_url})
            elif tag == "DIV":
                for t in _part_tables_in(el):
                    cap = _part_table_caption(t)
                    html = render_xml_table_html(cap, None, [t], emphasis=True)
                    append_html(open_row, html)
                    trows = rows_from_xml_tables([t])
                    tables.append(
                        {
                            "row": open_row["id"],
                            "caption": cap,
                            "rows": len(trows),
                            "cols": max((len(r) for r in trows), default=0),
                            "cells": trows,
                        }
                    )
            else:
                stripped_counts[tag] += 1

        # A section row with no chapeau text (everything lives in its (a)/(b)
        # children) still renders as a section in the app -- per the row-shape
        # spec, EVERY section row keeps kind "section". Only a text-less
        # PARAGRAPH row (a label printed with its first child on one line,
        # e.g. "(1)(i) ...") becomes heading-only.
        for r in [sec_row] + pending_rows:
            if not r["full_text"]:
                r["full_text"] = r["title"] if r is sec_row else r["citation"]
                if r is sec_row:
                    # A section whose whole body lives in its (a)/(b) children
                    # keeps kind "section" (the row-shape spec) but is a
                    # HEADING row: its full_text is the printed heading as
                    # plain text, with no <p> and no markup, exactly as the
                    # JJJJ/ZZZZ path emits "§ 60.4230 Am I subject to this
                    # subpart?". _heading_only keeps it out of the
                    # cross-reference pass below, so the heading's own
                    # section number is never turned into a link.
                    r["_heading_only"] = True
                else:
                    r["kind"] = "heading"

    # ---- one appendix (DIV9) -------------------------------------------
    def parse_appendix(div9):
        n = div9.get("N") or ""
        letter_m = re.search(r"Appendix\s+([A-Z])\b", n)
        letter = letter_m.group(1) if letter_m else n
        head_el = div9.find("HEAD")
        head_text = _xml_text(head_el) if head_el is not None else n
        aid = f"sec-{reg}-APPENDIX-{letter}"
        apx_url = f"{base_url}/appendix-{n.replace(' ', '%20')}"
        kids = [k for k in div9 if k.tag != "HEAD"]
        body_kids = []
        for k in kids:
            if k.tag in ("CITA", "EDNOTE", "XREF", "SOURCE", "AUTH"):
                stripped_counts[k.tag] += 1
            else:
                body_kids.append(k)
        apx_row = add_row(
            {
                "id": aid,
                "citation": f"Appendix {letter} to Part {part}",
                "title": head_text,
                "parent_id": root_id,
                "sort_order": next_sort(),
                "full_text": "",
                "kind": "appendix",
                "_own_section_id": aid,
            }
        )
        if not body_kids or head_text.endswith("[Reserved]"):
            apx_row["full_text"] = "<p>[Reserved]</p>"
            reserved.append(f"Appendix {letter} to Part {part}")
            appendix_modes[letter] = "reserved (one row)"
            return

        flat = letter in PART_FLAT_APPENDICES.get(reg, set())
        # Dry run: does every ladder label sit in an unambiguous, contiguous
        # sequence? If not, the whole appendix stays one row.
        def ladder_label(el):
            """The printed ladder label at the head of an appendix element,
            recognised by SHAPE, not by tag depth: the eCFR marks some
            appendix headings with <HD1>/<HD2> and leaves others as ordinary
            <P>s, and the HD level does not reliably track the label family
            (Appendix A to Part 191 prints its roman "I." inside an <HD2>)."""
            if el.tag not in ("HD1", "HD2", "P"):
                return None, None
            txt = _xml_text(el)
            for fam, rx in _APX_LADDER:
                m = rx.match(txt)
                if m:
                    return m, fam
            return None, None

        if not flat:
            probe: list[tuple[str, str]] = []
            for el in body_kids:
                m, fam = ladder_label(el)
                if m:
                    probe.append((fam, m.group("lab")))
            seen_fams: dict[str, str] = {}
            order = [f for f, _ in _APX_LADDER]
            for fam, lab in probe:
                prev = seen_fams.get(fam)
                ok = (lab == _APX_FIRST[fam]) if prev is None else (lab == _APX_NEXT[fam](prev))
                if not ok and prev is not None and lab == _APX_FIRST[fam]:
                    ok = True  # a deeper family legitimately restarts
                if not ok:
                    flat = True
                    appendix_modes[letter] = (
                        f"one row (ladder label {fam} {lab!r} does not follow {prev!r})"
                    )
                    break
                seen_fams[fam] = lab
                # a shallower label resets everything deeper
                for deeper in order[order.index(fam) + 1 :]:
                    seen_fams.pop(deeper, None)
            if not probe:
                flat = True
                appendix_modes[letter] = "one row (no ladder labels printed)"

        open_row = apx_row
        stack: list[tuple[str, str, str]] = []  # (family, value, row_id)
        order = [f for f, _ in _APX_LADDER]
        child_rows: list[dict] = []

        def append_html(row, html):
            row["full_text"] = (row["full_text"] or "") + html

        for el in body_kids:
            tag = el.tag
            if tag == "img":
                append_html(open_row, _part_image_placeholder(apx_url))
                images.append({"row": open_row["id"], "src": el.get("src"), "url": apx_url})
                continue
            if tag == "DIV":
                for t in _part_tables_in(el):
                    cap = _part_table_caption(t)
                    append_html(open_row, render_xml_table_html(cap, None, [t], emphasis=True))
                    trows = rows_from_xml_tables([t])
                    tables.append(
                        {
                            "row": open_row["id"],
                            "caption": cap or head_text,
                            "rows": len(trows),
                            "cols": max((len(r) for r in trows), default=0),
                            "cells": trows,
                        }
                    )
                continue
            if tag == "EXTRACT":
                for sub in el:
                    html = _part_inline_html(sub)
                    if html:
                        append_html(open_row, f"<p>{html}</p>")
                continue
            html = _part_inline_html(el)
            if not html:
                continue
            m, fam = (None, None) if flat else ladder_label(el)
            if m is None:
                append_html(open_row, f"<p>{html}</p>")
                continue
            lab = m.group("lab")
            depth = order.index(fam)
            while stack and order.index(stack[-1][0]) >= depth:
                stack.pop()
            parent = stack[-1][2] if stack else aid
            new_id = f"{parent}-{lab}"
            stack.append((fam, lab, new_id))
            rest = html[m.end() :].strip() if html.startswith(m.group(0).strip()[:1]) else html
            # `m` matched the plain-text rendering; re-strip the same label
            # off the HTML rendering (identical prefix -- labels are never
            # emphasised in these appendices).
            rest = re.sub(r"^" + re.escape(m.group(0).strip()) + r"\s*", "", html).strip()
            cite_path = "".join(
                (f".{v}" if i else f" {v}") for i, (f2, v, _rid) in enumerate(stack)
            )
            item_citation = f"Appendix {letter} to Part {part}{cite_path}"
            heading_word, _ = split_heading_from_text(_norm_text(rest)) if rest else (None, None)
            open_row = add_row(
                {
                    "id": new_id,
                    "citation": item_citation,
                    "title": f"{item_citation} {heading_word}" if heading_word else item_citation,
                    "parent_id": parent,
                    "sort_order": next_sort(),
                    "full_text": f"<p>{rest}</p>" if rest else "",
                    "kind": "item",
                    "_own_section_id": aid,
                }
            )
            child_rows.append(open_row)

        appendix_modes.setdefault(
            letter, "one row" if flat else f"{len(child_rows)} child rows from its printed ladder"
        )
        for r in [apx_row] + child_rows:
            if not r["full_text"]:
                r["full_text"] = r["title"] if r is apx_row else r["citation"]
                if r is apx_row:
                    r["_heading_only"] = True
                else:
                    r["kind"] = "heading"

    # ---- walk the part ---------------------------------------------------
    for child in root_el:
        if child.tag == "DIV6" and (child.get("TYPE") or "").upper() == "SUBPART":
            letter = child.get("N") or ""
            head_el = child.find("HEAD")
            head_text = _xml_text(head_el) if head_el is not None else f"Subpart {letter}"
            head_text = head_text.replace(f"Subpart {letter}—", f"Subpart {letter} — ")
            pid = f"sec-{reg}-PART-{letter}"
            add_row(
                {
                    "id": pid,
                    "citation": f"Subpart {letter}",
                    "title": head_text,
                    "parent_id": root_id,
                    "sort_order": next_sort(),
                    "full_text": head_text,
                    "kind": "part",
                }
            )
            for sub in child:
                if sub.tag == "DIV8":
                    parse_section(sub, pid, letter)
                elif sub.tag == "DIV7" and (sub.get("TYPE") or "").upper() == "SUBJGRP":
                    # Part 195 Subpart F nests some of its sections one level
                    # deeper, inside a <DIV7 TYPE="SUBJGRP"> ("High Consequence
                    # Areas", "Pipeline Integrity Management") -- a printed
                    # centre-heading that groups sections but is NOT a subpart
                    # and carries no citation of its own. Without this branch
                    # those sections (195.450, 195.452, 195.454 -- the whole
                    # integrity-management regime) are silently dropped.
                    # They are flattened into the enclosing subpart, in
                    # document order, so their ids/citations/parents are the
                    # ordinary section shape; the group heading is recorded in
                    # the report (`subject_groups`) rather than becoming a row,
                    # because the app derives structure from the id and has no
                    # id form between `-PART-x` and a section.
                    grp_head_el = sub.find("HEAD")
                    grp_head = _xml_text(grp_head_el) if grp_head_el is not None else (sub.get("N") or "")
                    grp_secs: list[str] = []
                    for gsub in sub:
                        if gsub.tag == "DIV8":
                            grp_secs.append(gsub.get("N") or "")
                            parse_section(gsub, pid, letter)
                        elif gsub.tag in ("CITA", "EDNOTE", "XREF", "SOURCE", "AUTH"):
                            stripped_counts[gsub.tag] += 1
                    subject_groups.append(
                        {"subpart": letter, "heading": grp_head, "sections": grp_secs}
                    )
                elif sub.tag in ("CITA", "EDNOTE", "XREF", "SOURCE", "AUTH"):
                    stripped_counts[sub.tag] += 1
        elif child.tag == "DIV8":
            parse_section(child, root_id, None)
        elif child.tag == "DIV9" and (child.get("TYPE") or "").upper() == "APPENDIX":
            parse_appendix(child)
        elif child.tag in ("CITA", "EDNOTE", "XREF", "SOURCE", "AUTH", "HEAD"):
            if child.tag != "HEAD":
                stripped_counts[child.tag] += 1

    # ---- cross-reference linking ----------------------------------------
    known_ids = {r["id"] for r in rows}
    unresolved: dict = defaultdict(Counter)
    for b in PART_BUCKETS:
        unresolved[b]
    link_counts = Counter()
    for row in rows:
        own_section_id = row.pop("_own_section_id", row["id"])
        heading_only = row.pop("_heading_only", False)
        if heading_only or row["kind"] not in ("section", "item", "definition", "appendix"):
            continue
        before = row["full_text"]
        row["full_text"] = link_citations(
            before, reg, own_section_id, row["id"], known_ids, CORPUS_REGS, unresolved
        )
        link_counts["same_doc"] += row["full_text"].count('<span class="xref"')
        link_counts["cross_doc"] += row["full_text"].count('class="xref-external-reg"')

    dead_targets = [
        t for t in re.findall(r'data-target="([^"]+)"', "".join(r["full_text"] for r in rows))
        if t not in known_ids
    ]

    report = {
        "reg": reg,
        "document": "part",
        "title": title,
        "part": part,
        "source_xml": xml_path,
        "n_rows": len(rows),
        "kinds": dict(Counter(r["kind"] for r in rows)),
        "subparts": [r["citation"] for r in rows if r["kind"] == "part"],
        "sections_by_subpart": section_index,
        "subject_groups": subject_groups,
        "n_sections": sum(len(v) for v in section_index.values()),
        "reserved": reserved,
        "appendix_modes": appendix_modes,
        "n_definitions": len(definitions),
        "definitions": definitions,
        "tables": [{k: v for k, v in t.items() if k != "cells"} for t in tables],
        "table_cells": {str(i): t["cells"] for i, t in enumerate(tables)},
        "images": images,
        "footnotes": footnotes,
        "stripped": dict(stripped_counts),
        "duplicate_ids": duplicate_ids,
        "label_anomalies": label_anomalies,
        "link_counts": dict(link_counts),
        "dead_targets": dead_targets,
        "unresolved": {b: unresolved[b] for b in sorted(unresolved)},
    }
    return rows, report


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def _write_report(out_path: Path, report: dict):
    report_path = out_path.with_name(out_path.stem + "_report.json")
    serializable_report = dict(report)
    serializable_report["unresolved"] = {
        b: sorted(c.items(), key=lambda kv: -kv[1]) for b, c in report["unresolved"].items()
    }
    report_path.write_text(
        json.dumps(serializable_report, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def part_xml_path(args) -> str | None:
    """The XML source for a whole-PART reg. `--xml` wins when given; otherwise
    it is derived from `--pdf` by swapping the extension
    (`sources/P192.pdf` -> `sources/P192.xml`), because the Import workflow
    always passes `--pdf <BASENAME>.pdf --txt <BASENAME>.txt` for every reg.
    Neither the .pdf nor the .txt has to exist -- a whole-part reg reads only
    the XML, and P192.pdf may never be in the repo at all."""
    if args.xml:
        return args.xml
    pdf = getattr(args, "pdf", None)
    if pdf:
        return str(Path(pdf).with_suffix(".xml"))
    txt = getattr(args, "txt", None)
    if txt:
        return str(Path(txt).with_suffix(".xml"))
    return None


def cmd_parse_part(args):
    """parse for a whole-PART document (49 CFR 191/192): XML in, same row
    JSON out. Shares the writer and the report file naming with cmd_parse."""
    meta = SUBPART_META[_norm_reg(args.reg)]
    xml_path = part_xml_path(args)
    if not xml_path:
        raise SystemExit(
            f"{args.reg} is a whole-part document: pass --xml (or --pdf/--txt, "
            "from which the .xml path is derived)"
        )
    if not Path(xml_path).exists():
        raise SystemExit(f"XML source not found for {args.reg}: {xml_path}")
    rows, report = parse_ecfr_part(args.reg, xml_path)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Parsed {len(rows)} provisions for {args.reg} ({meta['root_citation']}) -> {out_path}")
    print(f"  by kind: {report['kinds']}")
    print(f"  subparts: {len(report['subparts'])}, sections: {report['n_sections']}, "
          f"definitions: {report['n_definitions']}, tables: {len(report['tables'])}, "
          f"images: {len(report['images'])}")
    for grp in report.get("subject_groups", []):
        print(f"  subject group (Subpart {grp['subpart']}): {grp['heading']!r} -> "
              f"{len(grp['sections'])} section(s) flattened into the subpart: {grp['sections']}")
    print(f"  reserved: {len(report['reserved'])} -> {report['reserved']}")
    for letter, mode in sorted(report["appendix_modes"].items()):
        print(f"  appendix {letter}: {mode}")
    print(f"  stripped editorial elements: {report['stripped']}")
    if report["duplicate_ids"]:
        print(f"  WARNING: duplicate ids: {report['duplicate_ids']}")
    if report["label_anomalies"]:
        print(f"  WARNING: {len(report['label_anomalies'])} label anomalies:")
        for a in report["label_anomalies"][:20]:
            print(f"    § {a['section']} ({a['label']}) after {a['open_stack']}: {a['text']}")
    print(f"  links: {report['link_counts']}; dead targets: {len(report['dead_targets'])}")
    for bucket in PART_BUCKETS:
        ctr = report["unresolved"].get(bucket)
        if not ctr:
            continue
        print(f"  bucket '{bucket}': {len(ctr)} distinct, {sum(ctr.values())} mentions; top 5:")
        for text, cnt in ctr.most_common(5):
            print(f"    {cnt:4d}  {text}")
    _write_report(out_path, report)


def cmd_parse(args):
    if SUBPART_META[_norm_reg(args.reg)].get("document") == "part":
        return cmd_parse_part(args)
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
    for fx in report.get("label_fixes_applied", []):
        flag = "" if fx["hits"] == 1 else "  <-- EXPECTED EXACTLY 1 HIT, RE-CHECK"
        print(f"  label fix {fx['old_label']} -> {fx['new_label']}: {fx['hits']} hit(s){flag}")
    if report["duplicate_ids"]:
        print(f"  WARNING: duplicate ids: {report['duplicate_ids']}")
    for proof in report.get("table_algo_proof", []):
        if "error" in proof:
            print(f"  TABLE-ALGO: {proof['error']}")
            continue
        tid = proof.get("id", "?")
        if proof.get("algorithm") == "xml":
            cap = proof.get("caption", "")
            if proof.get("xml_match") == "yes":
                print(f"  TABLE-ALGO {tid}: caption {cap!r} -> XML match: yes, {proof.get('shape')}")
                for row in proof.get("sample", []):
                    print(f"    row: {row}")
            else:
                print(f"  TABLE-ALGO {tid}: caption {cap!r} -> XML match: no -> {proof['fallback']}")
                if proof.get("v2_fallback_shape"):
                    print(f"    v2 fallback shape: {proof['v2_fallback_shape']}")
                    for row in proof.get("v2_fallback_sample", []):
                        print(f"    v2 row: {row}")
            continue
        pages = proof.get("pages")
        page_str = f"pages {pages[0]}-{pages[1]}" if pages else "pages ?"
        if "fallback" in proof:
            print(f"  TABLE-ALGO {tid}: {page_str}, pdfplumber attempted {proof.get('attempted_shape', '?')} -> {proof['fallback']}")
            if proof.get("v2_fallback_shape"):
                print(f"    v2 fallback shape: {proof['v2_fallback_shape']}")
                for row in proof.get("v2_fallback_sample", []):
                    print(f"    v2 row: {row}")
            continue
        print(f"  TABLE-ALGO {tid}: pdfplumber, {page_str}, {proof.get('shape')}")
        for row in proof.get("sample", []):
            print(f"    row: {row}")
    total_unresolved = sum(sum(c.values()) for c in report["unresolved"].values())
    print(f"  unresolved reference mentions: {total_unresolved}")
    for bucket in ALL_BUCKETS:
        ctr = report["unresolved"][bucket]
        if not ctr:
            continue
        print(f"  bucket '{bucket}': {len(ctr)} distinct, {sum(ctr.values())} mentions; top 5:")
        for text, cnt in ctr.most_common(5):
            print(f"    {cnt:4d}  {text}")

    _write_report(out_path, report)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_parse = sub.add_parser("parse", help="Parse an eCFR subpart's pdftotext output into provisions JSON.")
    p_parse.add_argument("--reg", required=True, help="ooooa/oooob/ooooc/jjjj/iiii/zzzz (PDF path) or p191/p192 (XML path)")
    p_parse.add_argument("--pdf", default=None)
    p_parse.add_argument("--txt", default=None, help="Defaults to --pdf with .txt extension.")
    p_parse.add_argument("--xml", default=None, help="Primary source for a whole-PART reg (p191/p192).")
    p_parse.add_argument("--out", required=True)
    p_parse.set_defaults(func=cmd_parse)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
