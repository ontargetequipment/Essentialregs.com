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
    # Up to 4 repeated letters: confirmed printed depths reach "aaaa." (Reg 3's
    # Part A, II.D.1's definitions list runs aa../zz., then aaa../zzz., then
    # aaaa../zzzz. — same doubling/tripling/quadrupling convention as
    # PART_C_LETTERS, just at an ordinary CYCLE_AB "lower" depth rather than a
    # statement-of-basis top level). Reg 7/22 never need more than 2, so this
    # is purely additive.
    "lower": re.compile(r"^([a-z]{1,4})\."),
    "paren_roman": re.compile(r"^\(([ivxlcdm]+)\)"),
    "paren_upper": re.compile(r"^\(([A-Z]{1,2})\)"),
    "paren_digit": re.compile(r"^\((\d{1,3})\)"),
    # Reg 12 (see REG_CYCLE_AB["12"]) prints its fifth level as a BARE
    # lower-case roman numeral with a trailing dot instead of the
    # parenthesized "(i)" every other regulation uses — "I.D.2.a.i.",
    # "II.C.1.b.vii." — and validates it as a roman numeral exactly the way
    # "paren_roman" does (see tokenize_by_cycle), so a lettered "lower"
    # token that merely LOOKS roman ("i." as the 9th item of a lettered
    # list, e.g. Reg 12's own "II.A.2.i.") is still tokenized at its own
    # "lower" depth first — this family is only ever tried at the cycle
    # position a REG_CYCLE_AB entry puts it in, and no other regulation's
    # cycle names it, so it is a no-op for every other regulation.
    "bare_lroman": re.compile(r"^([ivxlcdm]+)\."),
    # The SIP Local Elements document (reg key "sip", see BARE_LADDER_FAMILIES)
    # prints its sixth level as a PARENTHESIZED lower-case letter — "(a)",
    # "(b)" .. "(e)" under a bare roman "i." (REG_SIP.txt lines 388-393,
    # 632-643) — a family no other regulation prints (every other document's
    # paren levels are "(i)"/"(A)"/"(1)"). Only ever tried at the cycle
    # position a BARE_LADDER_FAMILIES entry puts it in; no CYCLE_AB /
    # REG_CYCLE_AB / SOB cycle names it, so it is a no-op for every other reg.
    "paren_lower": re.compile(r"^\(([a-z]{1,2})\)"),
    # Reg 20 (see REG_CYCLE_AB["20"]) prints its fifth level TWO ways in the
    # same document, both as bare dotted tokens: a digit under Part D
    # ("V.A.3.b.1.", "V.A.3.b.2." — the two ZEV-credit Option 2 items,
    # REG_20.txt lines 762/766) and a lower-case roman numeral under Part G
    # ("V.A.6.d.i.", "V.A.6.d.ii." — the charger-count questions, lines
    # 1307/1309); it never prints "(i)"/"(A)" and never goes deeper (grep
    # of every depth-5 label in REG_20.txt). One family accepting either
    # token — validated as a roman numeral when alphabetic, exactly like
    # `bare_lroman` — lets both become rows under their own parents; ids and
    # citations use the raw token ("...-1", "...-i"), the same as "digit"
    # and "bare_lroman" would. Only tried at the cycle position a
    # REG_CYCLE_AB entry puts it in — no other regulation's cycle names it.
    "digit_or_lroman": re.compile(r"^(\d{1,3}|[ivxlcdm]+)\."),
}

# GP12 (see REG_META["gp12"]["labels_without_trailing_dot"]) prints its
# condition labels' dot-separators between tokens exactly like every other
# CYCLE_AB regulation ("I.A.8.a.(i)") but OMITS the trailing dot after the
# LAST plain (non-paren) token of the compound label — "I.A", "I.A.1",
# "I.A.3.a", "I.A.8.a.(i)" (confirmed: every top-level section heading
# ("I.", "II.", ... "XII.") DOES keep its own dot; only sub-labels below
# section level ever omit theirs — grep of GP12.txt found zero exceptions).
# Each plain-family regex here accepts EITHER the literal dot (tried first,
# so a dotted label parses exactly as it always has) OR a zero-width
# lookahead for whitespace/end-of-string in its place — i.e. this can only
# ever accept a MISSING dot right where the compound label ends, never
# swallow an internal separator, so a normal fully-dotted label like every
# other regulation's is parsed identically either way. Selected only via
# `family_regex_for` for a reg with the flag set — every other regulation
# keeps using plain FAMILY_REGEX unchanged (Reg 1/2/26/cp byte-identical).
#
# The SAME missing-trailing-dot print quirk turned out NOT to be unique to
# GP12 — it also appears, sporadically (not on every label, unlike GP12),
# in GP01/02/06/07/08/11 (confirmed real, silently-dropped child rows before
# this flag was widened: GP01/GP08's "II.B.1.a"/"II.B.1.b"/"II.B.1.c" sibling
# emission-limit list and GP08's "II.C.1.a"/"V.B.5.a"/"V.B.5.b" — each
# printed with two-plus trailing spaces and NO period before the label's own
# text starts, e.g. "II.B.1.a   Facilities located..."). Every GP key sets
# this flag for that reason; it is still a no-op for every non-GP
# regulation (Reg 1/2/26/cp), and, within a GP permit, the ordinary
# marker-acceptance guards (`_label_position_plausible`, column signals,
# requiring the immediate parent already emitted for depth > 1) are
# unaffected by which family-regex table did the tokenizing, so a
# genuinely mid-sentence citation ("...pursuant to Section V.B.4 and
# documentation...", "VI.E.4.a or VI.E.4.b, corrective action...") is
# still rejected exactly as before — confirmed against every GP permit's
# parse: the only NEW markers this widening ever produces are the
# documented missing-sibling rows above.
FAMILY_REGEX_NO_TRAILING_DOT = {
    "roman": re.compile(r"^([IVXLCDM]+)(?:\.|(?=\s)|$)"),
    "upper": re.compile(r"^([A-Z]{1,2})(?:\.|(?=\s)|$)"),
    "digit": re.compile(r"^(\d{1,3})(?:\.|(?=\s)|$)"),
    "lower": re.compile(r"^([a-z]{1,4})(?:\.|(?=\s)|$)"),
    "paren_roman": FAMILY_REGEX["paren_roman"],
    "paren_upper": FAMILY_REGEX["paren_upper"],
    "paren_digit": FAMILY_REGEX["paren_digit"],
    "bare_lroman": FAMILY_REGEX["bare_lroman"],
    "digit_or_lroman": FAMILY_REGEX["digit_or_lroman"],
    "paren_lower": FAMILY_REGEX["paren_lower"],
}


# Reg 27's Part A definitions list (Section II) runs past the double-letter
# range: "II.A." .. "II.Z.", "II.AA." .. "II.ZZ.", then "II.AAA." .. "II.QQQ."
# ("Process" .. "Verifiable", REG_27.txt lines 365-463 — 17 terms, the same
# doubling/tripling convention PART_C_LETTERS and the "lower" family already
# accept). FAMILY_REGEX's "upper" stops at two letters, so "II.AAA." did not
# tokenize and all 17 definitions were silently fused onto the "II.ZZ." row
# (a 6,400-character row found by the definitions count, not by the label
# gate — an untokenized label leaves no gap). Selected only via
# `family_regex_for` for a reg with REG_META `triple_letter_labels` set;
# every other regulation keeps plain FAMILY_REGEX (byte-identical). Only the
# marker scan uses this table — citation resolution (`_citation_to_id_suffix`)
# keeps the two-letter tokenizer, and no Reg 27 text cites a triple-letter
# definition, so nothing is lost there either.
FAMILY_REGEX_TRIPLE_UPPER = dict(FAMILY_REGEX, upper=re.compile(r"^([A-Z]{1,3})\."))

# Reg 21's Part A definitions list (Section VI, ~1,600 lines, one term per
# label) runs far past even the triple-letter range: "VI.A." .. "VI.Z.",
# "VI.AA." .. "VI.ZZ.", "VI.AAA." .. "VI.ZZZ.", "VI.AAAA." .. "VI.ZZZZ.",
# "VI.AAAAA." .. "VI.ZZZZZ.", "VI.AAAAAA." .. "VI.ZZZZZZ." and finally
# "VI.AAAAAAA." .. "VI.QQQQQQQ." ("Wood floor wax" .. "Wood sealer",
# REG_21.txt lines 1142-2715 — SEVEN repeated letters, the same doubling
# convention as PART_C_LETTERS / FAMILY_REGEX_TRIPLE_UPPER, just carried
# further; Part B's own definitions list stops at "VI.UUU."). Selected only
# via `family_regex_for` for a reg with REG_META `multi_letter_labels` set;
# every other regulation keeps its own table (byte-identical). Only the
# marker scan uses this table, exactly like the triple-letter variant.
FAMILY_REGEX_MULTI_UPPER = dict(FAMILY_REGEX, upper=re.compile(r"^([A-Z]{1,7})\."))


def family_regex_for(reg: str | None) -> dict:
    """Which FAMILY_REGEX table `tokenize_by_cycle` should use for `reg` —
    the no-trailing-dot variant only for a reg with REG_META
    `labels_without_trailing_dot` set (GP12), the triple-upper-letter
    variant only for a reg with `triple_letter_labels` set (Reg 27), plain
    FAMILY_REGEX for every other regulation (a no-op — see
    FAMILY_REGEX_NO_TRAILING_DOT / FAMILY_REGEX_TRIPLE_UPPER)."""
    meta = REG_META.get(reg or "", {})
    if meta.get("labels_without_trailing_dot"):
        return FAMILY_REGEX_NO_TRAILING_DOT
    if meta.get("triple_letter_labels"):
        return FAMILY_REGEX_TRIPLE_UPPER
    if meta.get("multi_letter_labels"):
        return FAMILY_REGEX_MULTI_UPPER
    return FAMILY_REGEX


# Part A / Part B nesting cycle (see IMPORTER_SPEC.md "Existing id scheme").
CYCLE_AB = ["roman", "upper", "digit", "lower", "paren_roman", "paren_upper", "paren_digit"]
# Under a Part C dated statement-of-basis entry, sub-items are printed as
# bare numbers ("1.", "2." with NO "B." prefix) rather than full compound
# paths — see the diff report for why Part C's *existing* DB ids look the
# way they do.
CYCLE_C_INNER = ["digit", "lower", "paren_roman", "paren_upper", "paren_digit"]

# GP12's Attachment A/B items (see REG_META["gp12"]["attachments"]) are a
# bare, purely-numeric outline that keeps subdividing with more digits
# rather than switching families at each depth — "1.", "3.1.", "3.2.",
# "7.7.2.1." (confirmed: the deepest printed label is 4 digits, "7.7.2.1.";
# no letter or paren token appears anywhere in either attachment) — so
# unlike every other ladder in this parser it is the SAME family repeated
# at every depth. 8 repetitions is comfortably past the confirmed max depth
# of 4.
ATTACHMENT_DIGIT_CYCLE = ["digit"] * 8

# Per-regulation override of the ordinary-part nesting cycle. Reg 2 (Odor
# Emission) prints its fifth level as PAREN-DIGIT directly under the lower-
# letter level — "IV.A.3.c.(1)", "IX.A.1.b.(6)", "IX.B.4.d.(1)" — with no
# "(i)"/"(A)" levels in between (confirmed: every one of its 48 depth-5
# labels is "(<digit>)", and it never goes deeper). tokenize_by_cycle walks
# the cycle strictly depth by depth and stops at the first family that
# doesn't match, so under CYCLE_AB those labels tokenized as "IV.A.3.c." with
# a leftover "(1) ..." and were silently folded into the parent's text as
# plain paragraphs. A regulation not listed here keeps CYCLE_AB unchanged
# (Reg 3/7/22/26 are byte-identical before and after this was added).
#
# Reg 12 (Diesel Vehicle Emissions) prints its fifth and sixth levels as
# BARE dotted tokens rather than parenthesized ones: a lower-case roman
# numeral ("I.D.2.a.i.", "I.D.7.d.iv.", "II.C.1.b.vii.") and then an
# upper-case letter ("I.D.7.d.ii.A." .. "I.D.7.d.ii.G.", "II.C.1.b.i.A." ..
# "II.C.1.b.i.F.") — confirmed: every one of its 45 depth-5 labels is a
# dotted lower roman, every one of its 17 depth-6 labels a dotted capital,
# and it never prints "(i)"/"(A)" or goes deeper than six (grep of
# REG_12.txt). Under CYCLE_AB the depth-5 token stopped tokenizing at
# "I.D.2.a." (paren_roman never matches "i.") and every depth-5/6 item was
# folded into its parent's text as a duplicate-id merge. `bare_lroman` (see
# FAMILY_REGEX) is roman-validated so a depth-4 lettered "i." never reaches
# it; the depth-6 level simply reuses "upper", whose citation/id display
# ("A", not "(A)") already matches the printed form.
#
# Reg 20 (Clean Cars and Trucks) prints its fifth level as a bare dotted
# digit in Part D and a bare dotted lower roman in Part G (see the
# `digit_or_lroman` family in FAMILY_REGEX); nothing goes deeper.
REG_CYCLE_AB: dict[str, list[str]] = {
    "2": ["roman", "upper", "digit", "lower", "paren_digit"],
    "12": ["roman", "upper", "digit", "lower", "bare_lroman", "upper"],
    "20": ["roman", "upper", "digit", "lower", "digit_or_lroman"],
}


def cycle_ab_for(reg: str | None) -> list[str]:
    """The ordinary-part token cycle for `reg` (see REG_CYCLE_AB)."""
    return REG_CYCLE_AB.get(reg or "", CYCLE_AB)


def tokenize_by_cycle(text: str, cycle: list[str], family_regex: dict | None = None) -> tuple[list[tuple[str, str]], int]:
    """Greedily consume tokens at the START of `text` following `cycle`,
    depth by depth. Returns (tokens, chars_consumed). tokens is a list of
    (family, raw) pairs; raw excludes surrounding parens/dot. `family_regex`
    defaults to plain FAMILY_REGEX; pass `family_regex_for(reg)` to also
    accept a GP12-style missing trailing dot (see FAMILY_REGEX_NO_TRAILING_DOT) —
    every other caller is unaffected."""
    tokens: list[tuple[str, str]] = []
    pos = 0
    fam_table = family_regex or FAMILY_REGEX
    for fam in cycle:
        rx = fam_table[fam]
        m = rx.match(text[pos:])
        if not m:
            break
        raw = m.group(1)
        if fam == "roman" and not is_valid_roman(raw):
            break
        if fam in ("paren_roman", "bare_lroman") and not is_valid_roman(raw.upper()):
            break
        if fam == "digit_or_lroman" and raw.isalpha() and not is_valid_roman(raw.upper()):
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
# dates printed in the PDF (A. 1995 ... HH. 2026, II. 2026). Extended with a
# third tier (AAA, BBB, ..., ZZZ) for Reg 3's Part F, whose amendment history
# runs long enough to pass ZZ (confirmed printed labels up to "I.MMM." —
# tripled letters, same doubling convention, not AAA/AAB/AAC...). Reg 7 never
# indexes this far (its longest confirmed run is "II." — entry 39), so this
# is purely additive and doesn't change any existing index.
def part_c_letter_sequence():
    for i in range(26):
        yield chr(ord("A") + i)
    for i in range(26):
        yield chr(ord("A") + i) * 2
    for i in range(26):
        yield chr(ord("A") + i) * 3


PART_C_LETTERS = list(part_c_letter_sequence())

# --------------------------------------------------------------------------
# "Bare ladder" regulations — a shape distinct from every regulation above:
# Reg 9 (5 CCR 1001-11) prints EVERY level of its outline bare (just "A.",
# "1.", "a."), never the FULL compound path ("II.A.", "II.A.1.") every
# Part/Section-based regulation above compounds every label into (confirmed:
# grepping REG_9.txt for a label line finds not one dot-joined compound
# label in its 2,480 lines — every accepted marker matches exactly ONE
# FAMILY_REGEX family, never two). `tokenize_by_cycle` walks the FULL cycle
# from depth 0 every time (see its own docstring), so it can't parse this at
# all: a bare "F." never even matches `cycle_ab`'s first family ("roman"),
# so it produces zero tokens and the whole line would be silently dropped as
# body text — and the letters that ARE valid bare roman numerals in their
# own right ("I.", "V.", "X." — Reg 9's own Section II Definitions runs
# "H. General Open Burn" / "I. Land Manager" / ... / "V. Suppression Action"
# / ... / "X. Wildfire" as its 9th/22nd/24th definitions, all at the same
# indent as a genuine top-level section) would be wrongly accepted as a
# brand-new top-level SECTION instead, colliding with the real "I. Scope" /
# "V. Planned Ignition Fire Permits" / "X." (never printed — the document
# only reaches "IX.") rows.
#
# `_bare_ladder_tokens` (used ONLY for a reg listed here; every other reg
# keeps calling `tokenize_by_cycle` exactly as before) resolves both
# problems the same way the rest of this parser resolves an identical
# problem elsewhere (SOB's CYCLE_C_INNER + prepended top token; ECMC's
# ladder — see its own docstring for why family alone can't fix a depth):
# depth is never read off the label text alone, only off which position in
# the FULL ancestor chain of the last ACCEPTED marker the candidate is the
# immediate NEXT item of. A bare "I." right after "H." is the 9th
# definitions letter (continues the open letter list), NOT the 9th
# top-level section, because depth is resolved from context, never from the
# token's own shape.
#
# Batch 6 adds the SIP Local Elements document (5 CCR 1001-20, reg key
# "sip"): the same bare-label print as Reg 9 (confirmed: `grep -nE
# "^\s*[IVX]+\.[A-Z]\." sources/REG_SIP.txt` is empty — every label is a lone
# "I."/"A."/"1."/"a."/"i."/"(a)", never a dot-joined compound), so it
# reuses this ladder unchanged; only its per-depth family list differs (see
# BARE_LADDER_FAMILIES) and one subsection is a leaf (BARE_LADDER_LEAF_CHAINS).
#
# Batch 7 adds Regulation Number 15 (Control of Emissions of Ozone-Depleting
# Compounds, 5 CCR 1001-19): the same bare-label print as Reg 9 (confirmed:
# `grep -nE "^\s*[IVX]+\.[A-Z]\." sources/REG_15.txt` is empty — every label
# is a lone "I."/"A."/"1."), only three levels deep (roman section, lettered
# subsection, digit item), so it takes the DEFAULT per-depth family list and
# needs no BARE_LADDER_FAMILIES / BARE_LADDER_LEAF_CHAINS entry of its own.
BARE_LADDER_REGS: frozenset[str] = frozenset({"9", "sip", "15"})

# Per-depth family list for a bare-ladder document (0-indexed depth of the
# token chain; the LAST family repeats for every deeper level). The default
# is Reg 9's shape exactly as `_bare_ladder_family` always produced it —
# roman, upper, digit, then "lower" forever — so Reg 9 is byte-identical.
# The SIP Local Elements document (reg key "sip") prints six levels: "I."
# (area section), "A." (subsection), "1.", "a.", then a BARE lower-case
# roman "i."/"ii."/"iii." (REG_SIP.txt lines 138-143, 194-202, 345-354,
# 368-380, 626, 661-668, 689-701 — every 5th-level label is a valid roman
# numeral, never a 9th+ lettered item, so `bare_lroman`'s roman validation
# is the right family; "lower" would also have matched lexically, exactly
# as Reg 9's comment above notes, but the roman-validated family is what the
# document actually prints), then a PARENTHESIZED lower letter "(a)".."(e)"
# (lines 388-393, 632-643 — see FAMILY_REGEX["paren_lower"]).
BARE_LADDER_FAMILIES: dict[str, list[str]] = {
    "sip": ["roman", "upper", "digit", "lower", "bare_lroman", "paren_lower"],
}
_BARE_LADDER_DEFAULT_FAMILIES = ["roman", "upper", "digit", "lower"]

# Bare-ladder chains under which NO deeper list is ever opened — the row is a
# single undivided leaf, exactly like an `inner_items: False` statement-of-
# basis entry (SOB_PART_CONFIG). Keyed by the printed label path. The SIP
# Local Elements document prints its Steamboat Springs statement of basis
# as subsection "VIII.F." with THREE dated revision headings inside it
# ("November 15, 2001 Revisions" / "September 21, 1995 Revisions" /
# "October 17, 1996 Revisions", REG_SIP.txt lines 1107, 1131, 1162 — plain
# unlabeled lines, no family to hang a row on) and three RESTARTING bare
# digit lists under them ("1." .. "4." at 1147-1153, "1." .. "2." at
# 1203-1208, "1." .. "3." at 1213-1234): with the ladder's ordinary
# first-child rule the first "1." .. "4." became rows `sec-sip-VIII-F-1` ..
# `-4` (the 1995 findings list) while the two later lists, no longer the
# next sibling of anything open, were folded into `-4` as body text — one
# statement of basis split arbitrarily across five rows. Listed here, the
# ladder skips its first-child rule while the open chain starts with this
# path (siblings "G." and the next section "IX." are still accepted
# normally), so VIII.F. is one row with its dated headings and lists as
# paragraphs, the same shape every other SOB entry in the corpus with
# restarting inner lists takes. A reg absent from this dict is unaffected.
BARE_LADDER_LEAF_CHAINS: dict[str, frozenset[tuple[str, ...]]] = {
    "sip": frozenset({("VIII", "F")}),
}


def _bare_ladder_family(depth: int, reg: str | None = None) -> str:
    """The family a bare-ladder document expects at 0-indexed depth `depth`
    of its own token chain: roman (top-level section), upper (first
    subsection level, "A." .. "BB."), digit, then "lower" for every level
    after that. Reg 9's deepest confirmed nesting (Editor's Notes History:
    "VIII.C.4.a.i") is 5 tokens — roman, upper, digit, lower, lower — the
    5th being a BARE lower-case roman numeral ("i.", "ii." .. "xi."),
    lexically identical to an ordinary continued lettered list (see
    `_bare_ladder_ordinal_variants`); reusing "lower" for every depth past 3
    (rather than hard-capping at one) means a list that nested even deeper
    would still parse instead of silently stopping. A reg listed in
    BARE_LADDER_FAMILIES uses its own list instead (same last-family-repeats
    rule); every other reg — Reg 9 included — gets the default list, which
    reproduces the original hard-coded answer for every depth."""
    fams = BARE_LADDER_FAMILIES.get(reg or "", _BARE_LADDER_DEFAULT_FAMILIES)
    return fams[depth] if depth < len(fams) else fams[-1]


def _bare_ladder_is_leaf_chain(reg: str | None, chain: list[tuple[str, str]]) -> bool:
    """True when `chain`'s printed path starts with one of this reg's
    BARE_LADDER_LEAF_CHAINS entries (no deeper list may open under it)."""
    leaves = BARE_LADDER_LEAF_CHAINS.get(reg or "")
    if not leaves:
        return False
    path = tuple(raw for _, raw in chain)
    return any(path[: len(leaf)] == leaf for leaf in leaves)


def _bare_ladder_ordinal_variants(fam: str, raw: str) -> dict[str, int]:
    """Every plausible 1-based ordinal for a bare-ladder label token, keyed
    by which numbering SCHEME produced it — mirrors `_ecmc_label_ordinal_
    variants` (see its docstring for the general problem: a "lower"/"upper"
    token may be simultaneously a valid plain alphabet position, e.g. "H" is
    the 8th letter, AND a valid roman numeral, e.g. "D" is 500 — trying both
    and requiring the SAME scheme to match on both sides of a comparison is
    what lets "H." -> "I." resolve as the alphabet's 8th -> 9th letter
    without "I" -> "V" (both valid romans, 1 -> 5) ever being considered a
    match for an unrelated pair)."""
    variants: dict[str, int] = {}
    if fam == "digit":
        variants["digit"] = int(raw)
        return variants
    up = raw.upper()
    if fam == "roman":
        if is_valid_roman(up):
            variants["roman"] = roman_to_int(up)
        return variants
    if up in PART_C_LETTERS:
        variants["alpha"] = PART_C_LETTERS.index(up) + 1
    if is_valid_roman(up):
        variants["roman"] = roman_to_int(up)
    return variants


def _bare_ladder_is_next(prev_fam: str, prev_raw: str, fam: str, raw: str) -> bool:
    """True when (fam, raw) is the immediate next item after (prev_fam,
    prev_raw) under ANY numbering scheme they both support (see
    `_bare_ladder_ordinal_variants`)."""
    prev_v = _bare_ladder_ordinal_variants(prev_fam, prev_raw)
    cand_v = _bare_ladder_ordinal_variants(fam, raw)
    for scheme, cand_ord in cand_v.items():
        prev_ord = prev_v.get(scheme)
        if prev_ord is not None and cand_ord == prev_ord + 1:
            return True
    return False


def _bare_ladder_tokens(stripped: str, chain: list[tuple[str, str]],
                        reg: str | None = None) -> tuple[list[tuple[str, str]], int]:
    """`tokenize_by_cycle`'s counterpart for a BARE_LADDER_REGS document
    (see that frozenset's comment for the full rationale). `chain` is the
    FULL token path of the last marker `scan_markers` accepted anywhere in
    the document so far (empty before the first one — this reg's own
    `ab_stack` entry). A candidate is tried, in order:
      1. the immediate next SIBLING of the deepest currently-open level
         (same family slot, next ordinal);
      2. the first child of a brand-new list one level deeper than whatever
         is currently open (opens at "A"/"I"/"1");
      3. the next sibling of an ANCESTOR, closing every level below it —
         tried from the deepest ancestor up to the document root (this is
         what promotes a bare "I."/"V."/"X." back to a genuine new
         top-level section once it really is the next one in sequence,
         exactly like every other level).
    Returns (tokens, chars_consumed) in exactly the shape `tokenize_by_cycle`
    returns — the FULL new chain, not just the one changed token — so every
    downstream check in `scan_markers` (column learning, the dangling-word
    guard, the parent-known / self-heal test, `ab_stack` bookkeeping) runs
    completely unchanged; this function's only job is picking the tokens.
    `reg` selects the per-depth family list (BARE_LADDER_FAMILIES) and the
    leaf chains (BARE_LADDER_LEAF_CHAINS); None / an unlisted reg behaves
    exactly as before either was added."""
    if not chain:
        m = FAMILY_REGEX["roman"].match(stripped)
        if m and m.group(1) == "I":
            return [("roman", "I")], m.end()
        return [], 0
    fam = _bare_ladder_family(len(chain) - 1, reg)
    m = FAMILY_REGEX[fam].match(stripped)
    if m and _bare_ladder_is_next(chain[-1][0], chain[-1][1], fam, m.group(1)):
        return chain[:-1] + [(fam, m.group(1))], m.end()
    if not _bare_ladder_is_leaf_chain(reg, chain):
        fam = _bare_ladder_family(len(chain), reg)
        m = FAMILY_REGEX[fam].match(stripped)
        if m and m.group(1).upper() in ("A", "I", "1"):
            return chain + [(fam, m.group(1))], m.end()
    for d in range(len(chain) - 2, -1, -1):
        fam = _bare_ladder_family(d, reg)
        m = FAMILY_REGEX[fam].match(stripped)
        if m and _bare_ladder_is_next(chain[d][0], chain[d][1], fam, m.group(1)):
            return chain[:d] + [(fam, m.group(1))], m.end()
    return [], 0


DATE_START_RE = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2}(-\d{1,2})?(,|\s*[-–]\s*\d{1,2},)?\s+\d{4}\b"
)

# Reg 9's Section IX statement-of-basis entries open either "Adopted <full
# month> <day>, <year>" (14 of 15 entries), a bare date with no "Adopted" at
# all ("M.      February 19, 2015"), or "Adopted" followed by an ABBREVIATED
# month ("O.      Adopted Feb. 15, 2024" — the only abbreviated one, and the
# only entry with no comma before the day... no, it has the ordinary comma;
# just the abbreviated month DATE_START_RE's full-month-name list doesn't
# match). Optional "Adopted[:] " prefix, then either a full or abbreviated
# month name.
REG9_SOB_OPENER_RE = re.compile(
    r"^(?:Adopted:?\s+)?(?:January|February|March|April|May|June|July|August|"
    r"September|October|November|December|Jan\.|Feb\.|Mar\.|Apr\.|Jun\.|Jul\.|"
    r"Aug\.|Sep\.|Sept\.|Oct\.|Nov\.|Dec\.)\s+\d{1,2}(-\d{1,2})?,?\s+\d{4}\b"
)

# Which Part in each regulation is its "Statements of Basis..." part, and
# what family its top-level entries are printed in. Every OTHER real part in
# the regulation (any part letter that actually appears as a "PART X"
# heading and isn't this one) is scanned as an ordinary roman/upper/digit/
# lower/paren-* nested part (see scan_markers's `current_part != sob_letter`
# branch) — so adding a new part to a regulation (e.g. Reg 22's Part D,
# "General Provisions") needs no config here at all, only a reg missing from
# this dict (or whose SOB part uses neither family below) is skipped.
#   "letter_dated": Reg 7's Part C — top level is a strict A, B, ..., Z, AA,
#     BB, ... ZZ letter sequence (see PART_C_LETTERS), and a candidate is
#     only accepted as a NEW top-level entry when it's immediately followed
#     by a recognizable date (DATE_START_RE) — distinguishing "A. December
#     21, 1995 (...)" from an inner list item that also happens to start
#     with a capital letter and a period.
#   "roman_seq": Reg 22's Part E — top level is a plain roman-numeral
#     sequence (I., II., III., ...), same family Parts A/B/C/D already use
#     at their own top level, but re-started from I. and, unlike
#     "letter_dated", NOT required to be followed by a date — some entries
#     are short "(Removed and placed in Regulation Number 27 ...)" stubs
#     with no date at all (see IMPORTER_SPEC.md / the diff report's Part E
#     section). A candidate is accepted only when it's the exact next
#     roman numeral in sequence AND is paragraph-initial (preceded by a
#     blank line) — both needed because Part E entries themselves contain
#     unrelated nested roman-numeral lists (e.g. entry IX's own "I. ... XII."
#     factors list) that reuse "I.", "II.", ... but are never paragraph-
#     initial at the SAME roman number the top-level scan is expecting next.
SOB_PART_CONFIG: dict[str, dict] = {
    "7": {"letter": "C", "top_family": "letter_dated"},
    # Reg 4's Part C ("STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND
    # PURPOSE", REG_4.txt line 673) has exactly the shape Reg 3's Part F has:
    # every top-level entry is printed with a CONSTANT leading roman numeral
    # that carries no numbering meaning at all — here "XI." (the section
    # number Part C's entries used to sit under when the statements of basis
    # were Section XI of the body) — followed by the incrementing letter and
    # an "Adopted: <date>" opener: "XI.A.   Adopted: November 19, 2015"
    # (line 675), "XI.B.   Adopted: March 16, 2017" (line 865), "XI.C.
    # Adopted: August 15, 2024" (line 928). `roman_prefix: "XI"` requires and
    # consumes that literal prefix, so the ids come out `sec-4-C-XI-A` ..
    # `sec-4-C-XI-C` under a synthesized `sec-4-C-XI` row, exactly as Reg 3's
    # Part F produces `sec-3-F-I-<letter>` under `sec-3-F-I`.
    #
    # `inner_items: False` for the same reason as Reg 3's Part F: each entry
    # is a narrative document whose numbered lists RESTART (entry XI.A. runs
    # a "1."-"3." findings list under "Findings of Fact" and entry XI.C.
    # runs a "(I)"-"(V)" one), and its "Basis" / "Specific Statutory
    # Authority" / "Purpose" / "Findings of Fact" sub-headings are unlabeled.
    # Each entry therefore stays ONE undivided row.
    "4": {
        "letter": "C", "top_family": "letter_dated", "roman_prefix": "XI",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    "22": {
        "letter": "E", "top_family": "roman_seq",
        # Reg 22's Part E contains its OWN nested roman-numeral lists (e.g.
        # entry IX's "Additional Considerations" factors list, itself
        # numbered I. through XII.) that reuse the exact roman numerals the
        # top-level scan is expecting next once the real top-level entries
        # run out at IX — "being the next expected roman numeral, at indent
        # 0, paragraph-initial" is satisfied by BOTH, so an extra signature
        # is needed: every real top-level entry's text starts with either
        # "Adopted: <date>" or "(Removed ..." (confirmed against all 9 —
        # I, II, VI, VII, VIII, IX are dated; III, IV, V are undated
        # "(Removed and placed in Regulation Number ...)" stubs) — no inner
        # list item anywhere in Part E starts with either.
        "top_opener_re": re.compile(r"^(?:Adopted:|\(Removed\b)"),
    },
    # Reg 3's Part F prints every top-level statement-of-basis entry with a
    # constant leading "I." that plays no numbering role at all — the entries
    # are "I.A.   Adopted June 5, 1980", "I.B.   Adopted May 13, 1982", ...
    # all the way to "I.MMM.  Adopted: May 21-22, 2026" (confirmed: the roman
    # numeral is always "I", only the letter increments, following the same
    # A..Z, AA..ZZ, AAA..ZZZ doubling/tripling convention as Reg 7's Part C —
    # see part_c_letter_sequence). `roman_prefix` tells the letter_dated
    # scanner to require and consume that literal "I." before the letter, so
    # the resulting id is `sec-3-F-I-<letter>` (two tokens: roman "I" then
    # upper <letter>), matching the small number of these ids that already
    # exist correctly in the DB (e.g. `sec-3-F-I-A` .. `sec-3-F-I-Z`) — the
    # DB's other Part F ids (bare `sec-3-F-II`, `sec-3-F-XIII-B-2`, etc.) are
    # old-importer artifacts from citation-shaped continuation lines that
    # were never real markers; see the diff report.
    "3": {
        "letter": "F", "top_family": "letter_dated", "roman_prefix": "I",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        # Reg 3's Part F entries are long narrative documents whose inner
        # numbered lists ("1.", "2.", "3." ...) restart many times inside a
        # single entry (e.g. I.L., the July 1993 Title V statement, numbers
        # its administrative/minor/significant-modification discussion 1-3,
        # then numbers a later list of permit-content items 1-12, then
        # another list...). Treating those as nested items produced ids like
        # `sec-3-F-I-L-3` that collected EVERY "3." paragraph in the entry —
        # one such row reached 540,000 characters of repeated text (found in
        # the Sept 17 2026 second-pass review). Each Part F entry is
        # therefore kept as ONE undivided row, like the ~110 entries that
        # never had inner labels in the first place.
        "inner_items": False,
    },
    # Reg 26's Part C top level is a plain roman-numeral sequence (I., II.,
    # III., IV. — only 4 entries so far), each followed immediately by a
    # bare date with no "Adopted"/"Adopted:" keyword at all (e.g. "I.
    # April 20, 2023", "IV.     November 19-21, 2025 (Revisions to Part B,
    # ...)") — the same bare-date opener Reg 7's Part C uses at its own top
    # level (DATE_START_RE), just applied to the "roman_seq" family instead
    # of "letter_dated" (Reg 22's Part E uses "roman_seq" too, but with a
    # different, keyword-based opener — see its own entry above).
    "26": {"letter": "C", "top_family": "roman_seq", "top_opener_re": DATE_START_RE},
    # Reg 24's Part C is the same top-level shape as Reg 26's: a plain
    # roman-numeral sequence (only 2 entries so far), each followed
    # immediately by a bare date with no "Adopted"/"Adopted:" keyword —
    # "I.        April 20, 2023", "II.     April 15-17, 2026 (Revisions to
    # Part B, Section VI.)" (confirmed sources/REG_24.txt lines 2563, 3115).
    # Unlike Reg 26, entry I's own narrative wraps a citation-shaped
    # fragment onto a line start — "...became a new Regulation Number\n26.
    # The upstream oil and gas intensity..." (line 2607) — and "Number" is
    # deliberately not in `_label_position_plausible`'s disqualifying set
    # (see the Reg 2 config comment above), so with `inner_items` at its
    # default (True) that line was accepted as a CYCLE_C_INNER digit marker
    # and produced a `sec-24-C-I-26` row that swallowed the rest of entry
    # I's ~23,000 characters of text (found by the giant/fused-row gate).
    # Entry II's own narrative numbered lists ("(I)" .. "(XII)" findings,
    # twice) are upper-case paren-roman, which CYCLE_C_INNER never starts
    # with, so it was already one undivided row regardless. Both entries are
    # therefore kept as ONE row each (`inner_items: False`), exactly like
    # Reg 3's Part F / Reg 2's Part C / Reg 6's Part A.
    "24": {
        "letter": "C", "top_family": "roman_seq", "top_opener_re": DATE_START_RE,
        "inner_items": False,
    },
    # Reg 2's Part C ("STATEMENT OF BASIS, SPECIFIC STATUTORY AUTHORITY, AND
    # PURPOSE") is a plain roman sequence of only four entries, each printed
    # as "<roman>. Adopted <date>" — "I. Adopted February 19, 1999", "II.
    # Adopted December 14, 2006", "III. Adopted June 19, 2008", "IV.
    # Adopted: May 16, 2013" (the colon appears only on IV) — so it takes
    # the same "Adopted" opener Reg 3 uses, on the "roman_seq" family Reg
    # 22/26 use. Each entry is kept as ONE undivided row (`inner_items:
    # False`, like Reg 3's Part F): the only real inner list is entry II's
    # seven-item SB 06-114 summary ("1." .. "7."), but the entries' flush-
    # left narrative also hard-wraps two citation-shaped fragments onto line
    # starts — "...this amendment to Regulation Number\n2. Typically, the
    # date selected..." (entry I) and "...not been modified pursuant to SB
    # 06-\n114." (entry II) — and neither "Number" nor a hyphen-dangling
    # "06-" is in _label_position_plausible's disqualifying set (see its
    # docstring for why "Number" deliberately isn't), so with inner items on
    # they became rows `sec-2-C-I-2` (swallowing the remaining 35,000 chars
    # of entry I) and `sec-2-C-II-114`. Entry III's "(I)".."(VI)" findings
    # list is upper-case paren-roman, which CYCLE_C_INNER never starts with,
    # and would have been left as paragraphs either way.
    "2": {
        "letter": "C", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 1 has NO "PART X" headings at all (see REG_META["1"]["no_parts"]):
    # its body is a single run of top-level roman sections I. through X., and
    # the statement of basis is not a part but the LAST top-level SECTION,
    # "X. Statement of Basis, Specific Statutory Authority, and Purpose".
    # `section` (instead of `letter`) tells scan_markers to switch into
    # statement-of-basis mode when the ordinary CYCLE_AB scan accepts that
    # top-level section marker, and to stay in it to the end of the document
    # (the SOB section is always printed last). Its entries are printed
    # "X.A.    Adopted: August 11, 1977" ... "X.Q.    Adopted: August 15,
    # 2024" — a letter_dated sequence carrying the section's own "X." as a
    # constant roman prefix (exactly Reg 3's Part F shape, with "X" for "I"),
    # so the ids are `sec-1-X-A` .. `sec-1-X-Q` under the ordinary section
    # row `sec-1-X` (which already exists — no synthetic prefix row is made).
    # Entry X.D./X.E. print "Adopted January 19, 1985" without the colon, so
    # the opener accepts both. Everything printed between the "X." heading
    # and "X.A." (a ~770-line undated 1982 compilation of earlier statements,
    # with ad-hoc "Section II.A.1 – ..." topic headings and a stray "a."/"b."/
    # "II." list) has no consistent labels at all and is kept as the body of
    # `sec-1-X` itself. `inner_items: False` for the same reason as Reg 3:
    # the entries are narrative with restarting inner lists ("B. Smoke Meter
    # Evaluation", "VI.A. While EPA is correct...", "II. The commission
    # concluded...") that would otherwise be accepted as spurious markers.
    # The regulation's own APPENDIX A / APPENDIX B are physically printed
    # INSIDE this section, between X.K. and X.L. — see scan_markers's
    # appendix handling for section-scoped SOB mode.
    "1": {
        "section": "X", "top_family": "letter_dated", "roman_prefix": "X",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Common Provisions Regulation (5 CCR 1001-2, reg key "cp") has NO "PART
    # X" headings (REG_META["cp"]["no_parts"], same shape as Reg 1) and its
    # statement of basis is the LAST top-level SECTION, "V. Statements of
    # Basis, Specific Statutory Authority, and Purpose" — confirmed: 22
    # entries "V.A. Adopted December 14, 1978 - Definitions" through "V.V.
    # Adopted October 17, 2025" (line 4354), a letter_dated sequence carrying
    # the section's own "V." as a constant roman prefix, exactly Reg 1's "X."
    # shape (see REG_META["1"]'s comment) and Reg 3's Part F shape. Entries
    # V.C. onward use a plain hyphen or em-dash between the date and the
    # topic ("V.C.    Adopted May 13, 1982 - Public Comment"); some (V.L.,
    # V.M., V.N., V.O., V.T., V.U., V.V.) carry no topic at all, just the
    # date. `inner_items: False` for the same reason as Reg 1/Reg 3's Part
    # F: these are narrative statements whose own numbered findings lists
    # ("1.", "2.", "3." ...) restart inside a single entry (confirmed: V.D.'s
    # Class I area findings restart their "1." list three separate times).
    "cp": {
        "section": "V", "top_family": "letter_dated", "roman_prefix": "V",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 9 (5 CCR 1001-11) is also part-less (see REG_META["9"]["no_parts"])
    # and its statement of basis is likewise the LAST top-level SECTION,
    # "IX. Statement of Basis, Specific Statutory Authority and Purpose" —
    # but unlike Reg 1's Section X, Reg 9's entries print BARE letters with
    # no constant leading roman prefix at all: "A.      Adopted January 17,
    # 2002" .. "O.      Adopted Feb. 15, 2024" (15 entries, confirmed against
    # every dated heading in Section IX), so `roman_prefix` (which requires
    # and consumes a literal prefix) doesn't fit — `implicit_section_prefix`
    # instead PREPENDS the section's own roman token without requiring it in
    # the text, so the resulting ids are `sec-9-IX-A` .. `sec-9-IX-O` under
    # the ordinary section row `sec-9-IX` (which already exists from the
    # bare-ladder scan accepting "IX." as a top-level section — see
    # BARE_LADDER_REGS) rather than colliding with Section II's own
    # definitions letter A (`sec-9-II-A`) at a bare `sec-9-A`.
    # `top_opener_re` is `REG9_SOB_OPENER_RE`, not the shared `DATE_START_RE`
    # or a bare "Adopted" keyword test, because Reg 9 mixes all three
    # printed shapes (see that regex's own comment). Every entry is kept as
    # ONE undivided row (`inner_items: False`, same reasoning as Reg 3's
    # Part F / Reg 6's Part A): each entry's own narrative restarts bare
    # parenthesized-roman "finding" lists — "(I)" .. "(XII)" — printed
    # identically in at least four separate entries (confirmed: entries J,
    # N and O each have their own "(I)".."(XII)"/"(III)" findings list), and
    # Reg 9 has no digit/lower inner lists inside Section IX at all to lose
    # by collapsing each entry to one row. Appendices A/B/C are printed
    # AFTER every SOB entry (not interleaved, unlike Reg 1's own appendices),
    # so no section-scoped appendix-closing special case is needed here.
    "9": {
        "section": "IX", "top_family": "letter_dated",
        "top_opener_re": REG9_SOB_OPENER_RE,
        "inner_items": False, "implicit_section_prefix": True,
    },
    # Reg 16 (Street Sanding Emissions, 5 CCR 1001-18) is part-less (see
    # REG_META["16"]["no_parts"]) and its statement of basis is the LAST
    # top-level SECTION, "III. Statements of Basis, Specific Statutory
    # Authority and Purpose" — only two entries, printed with the section's
    # own "III." as a constant roman prefix exactly like Reg 1's "X." / the
    # Common Provisions' "V.": "III.A. May 20, 1999" (a bare date, REG_16.txt
    # line 351) and "III.B. Denver metropolitan area, redesignation to
    # attainment for PM10" (line 447 — a TOPIC line; its "Adopted: April 19,
    # 2001" follows as the next paragraph, the Reg 12 shape). Neither a
    # bare-date nor an "Adopted" opener fits both, and the compound
    # "III.<next letter>." label with the section's own prefix is already
    # the whole signature (nothing inside either entry prints that shape —
    # their "Basis"/"Authority"/"Purpose"/"Findings"/"Federal Requirements"
    # sub-headings are bare words), so the opener only asks for a capital
    # letter. `inner_items: False` for the same reason as Reg 1/cp: the
    # entries are narrative ("First, ... Second, ... Third, ..." findings,
    # "do three things. First, ...") with no real labelled sub-items, and
    # CYCLE_C_INNER must never get a chance at a wrapped fragment.
    "16": {
        "section": "III", "top_family": "letter_dated", "roman_prefix": "III",
        "top_opener_re": re.compile(r"^[A-Z]"),
        "inner_items": False,
    },
    # Reg 18 (Control of Emissions of Acid Deposition Precursors, 5 CCR
    # 1001-22) is part-less (REG_META["18"]) — two top-level sections only —
    # and its statement of basis is Section "II. Statement of Basis, Specific
    # Statutory Authority and Purpose", whose seven entries print BARE
    # letters with no roman prefix at all, exactly Reg 9's Section IX shape:
    # "A. May 15, 1997", "B. May 21, 1998", "C. February 15, 2001" (bare
    # dates), "D. Adopted: February 21, 2002" (colon), "E. April 17, 2003",
    # "F. Adopted February 6, 2007", "G. Adopted October 18, 2012" (no colon)
    # — REG_18.txt lines 49, 97, 143, 187, 227, 259, 293. REG9_SOB_OPENER_RE
    # accepts all three printed shapes, and `implicit_section_prefix` nests
    # the ids under the section row (`sec-18-II-A` .. `sec-18-II-G`) rather
    # than at a bare `sec-18-A`. `inner_items: False`: entry B's narrative
    # has unlabeled sub-headings ("Exemptions", "Other permitting") with
    # indented bullet paragraphs, no digit list anywhere — kept whole like
    # every other bare-letter SOB entry (Reg 9).
    "18": {
        "section": "II", "top_family": "letter_dated",
        "top_opener_re": REG9_SOB_OPENER_RE,
        "inner_items": False, "implicit_section_prefix": True,
        # Entry A. is on page one, inside its 4-space margin — see
        # `_match_sob_top`.
        "top_indent_ok": True,
    },
    # Reg 30's Part C ("Statements of Basis, Specific Statutory Authority and
    # Purpose") is a plain roman sequence like Reg 2/26's Part C, only three
    # entries so far, each opening "<roman>.  Adopted: <date>" — "I. Adopted:
    # January 17, 2025", "II. Adopted: September 19, 2025", "III. Adopted:
    # April 17, 2026" (confirmed: every one uses the colon, unlike Reg 2's
    # mixed colon/no-colon). Takes the same "Adopted" keyword opener Reg 2/3
    # use, on the "roman_seq" family. `inner_items` is left at its default
    # (True): unlike Reg 2/3, no Part C entry here contains a restarting
    # digit-led inner list of its own — the only "1./2./3." list in this part
    # is Appendix B's "Table Notes:", which sits inside an APPENDIX block
    # (never scanned as SOB inner items at all, see the appendix-closing fix
    # below) — so CYCLE_C_INNER never has anything to accidentally capture.
    # The Commission's own findings lists inside each entry ("I. Existing
    # data...V. Input from the scientific community.", "(I)..(V)") are bare
    # roman/paren-roman, which CYCLE_C_INNER (digit-first) never starts on.
    "30": {"letter": "C", "top_family": "roman_seq", "top_opener_re": re.compile(r"^Adopted:?\s")},
    # Reg 31's Part K ("Statements of Basis, Specific Statutory Authority and
    # Purpose") holds exactly ONE entry so far — "I.     Adopted: [date]"
    # (REG_31.txt line 4492; the print really does carry the unfilled
    # "[date]" placeholder — see REPORT.md) — so it is the same shape as Reg
    # 2/30: a plain roman sequence whose entries open with the "Adopted"
    # keyword. `inner_items: False` keeps the entry as ONE undivided row,
    # like Reg 2's Part C / Reg 3's Part F / Reg 24's Part C: entry I is a
    # ~66,000-character narrative that discusses the rule part by part under
    # unlabeled prose headings ("Basis", "Specific Statutory Authority",
    # "PART C - Gas Collection and Control System (GCCS) Requirements", ...)
    # and hard-wraps citation-shaped fragments onto line starts (e.g.
    # "...requirements in Regulation Number\n31." and "...§ 25-7-\n102(2)(g),
    # C.R.S."), which CYCLE_C_INNER's digit family would otherwise accept as
    # markers and use to swallow the rest of the entry. Its two genuine
    # lists — the § 25-7-110.5(5)(b) factors "(I)".."(XII)" and the
    # § 25-7-110.8 findings "(I)".."(V)" — are upper paren-roman, which
    # CYCLE_C_INNER (digit-first) never starts on, and they restart the same
    # numerals twice inside the one entry, so leaving them as paragraphs is
    # also what avoids duplicate ids.
    # Entry I's narrative also walks the regulation part by part under
    # "PART C - Gas Collection and Control System (GCCS) Requirements" /
    # "PART D - Section II - Leak Inspection and Repair" / ... headings
    # (REG_31.txt lines 4900, 5529, 5560, 5657, 5722, 5749, 5795), which the
    # PART-heading regex in scan_markers matches exactly like a real heading;
    # `part_headings_are_body` tells it that no new part can open once the
    # statement-of-basis part has started, so those seven lines stay body
    # text (without it each one re-opened an already-emitted part and the
    # parse merged two markers onto ids sec-31-P-C .. sec-31-P-I).
    "31": {
        "letter": "K", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
        "part_headings_are_body": True,
    },
    "11": {
        "letter": "H", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^(?:AMENDMENTS?|REVISIONS?)\b"),
    },
    # Reg 12's Part D ("STATEMENT OF BASIS, SPECIFIC STATUTORY AUTHORITY AND
    # PURPOSE") is a plain roman sequence of eleven entries, but unlike Reg
    # 2/26/30 the date is NOT on the label line: each entry opens with a
    # TOPIC line — "I.      Amendment to Parts A and B, and Creation of this
    # Part D", "II.     Amendments to Parts B and D", ... "X.      AMENDMENTS
    # TO PARTS A, B, C, and D", "XI.     AMENDMENTS" — and the "Adopted
    # <date>" line follows as its own paragraph (confirmed REG_12.txt lines
    # 2217-2822: every one of the eleven starts "Amendment"/"Amendments"/
    # "AMENDMENTS"). So the opener is the case-insensitive word "Amendment".
    # Every entry is kept as ONE undivided row (`inner_items: False`): the
    # entries' own narrative restarts bare digit lists ("1." .. "4." in
    # entries III/IX's rule-by-rule summaries) and lettered findings lists
    # ("a." .. "e." in entry XI's § 25-7-110.8 findings) that CYCLE_C_INNER
    # would otherwise accept as spurious nested items, exactly the Reg 3 /
    # Reg 2 / Reg 6 situation; the "(I)".."(XII)" factor lists are upper
    # paren-roman and were never at risk.
    "12": {
        "letter": "D", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Amendments?\b", re.IGNORECASE),
        "inner_items": False,
    },
    # Reg 25's Part C is the same top-level shape as Reg 26/24's: a plain
    # roman-numeral sequence (three entries so far), each followed
    # immediately by a bare date with no "Adopted" keyword — "I. April 20,
    # 2023", "II. December 18-20, 2024 (Revisions to Part A, Section II.C.2.
    # and Part B, ...)", "III. November 19-21, 2025 (Revisions to Part B,
    # Section I.Q. and Repeal of Part ...)" (REG_25.txt lines 5701, 6284,
    # 6499). No entry contains any real labelled inner list at all (checked:
    # nothing shaped "a.", "(i)" or "<roman>." starts a line anywhere in
    # Part C) — but entry I's narrative hard-wraps the same citation-shaped
    # fragment Reg 24's does, "...became a new Regulation Number\n27." (line
    # 5746), which with `inner_items` at its default was accepted as a
    # CYCLE_C_INNER digit marker and produced a `sec-25-C-I-27` row that
    # swallowed the remaining ~46,000 characters of Part C, entries II and
    # III included (found by the giant/fused-row gate). Every entry is
    # therefore kept as ONE undivided row (`inner_items: False`), exactly
    # like Reg 24/2/3.
    # `top_after_terminal`: entry II (line 6284) is printed directly under
    # entry I's last line ("...in the most cost-effective manner.") with NO
    # blank line, marker line or page seam before it, so the roman_seq
    # scan's paragraph-initial test (which Reg 22/26 needed as-is) rejected
    # it — and entry III, no longer the next expected numeral, went with it,
    # fusing all three entries into one 49,000-character row. With this
    # flag a candidate is also paragraph-initial when the previous line ends
    # in terminal punctuation; the exact-next-numeral + bare-date opener
    # tests still apply, so nothing inside an entry can newly match.
    "25": {
        "letter": "C", "top_family": "roman_seq", "top_opener_re": DATE_START_RE,
        "inner_items": False, "top_after_terminal": True,
    },
    # Reg 27's Part E ("Statements of Basis, Specific Statutory Authority and
    # Purpose") is a plain roman sequence of five entries, each opening
    # "<roman>.  Adopted: <date>" — "I. Adopted: October 22, 2021" (line
    # 2270 of REG_27.txt), "II. Adopted: July 21, 2022", "III. Adopted:
    # April 20, 2023", "IV. Adopted: October 20, 2023", "V. Adopted:
    # December 18-20, 2024" (line 4183) — the same keyword opener Reg 30
    # uses on the same family. Entries I and IV are long narrative
    # statements (entry I is the October 2021 GEMM statement removed from
    # Regulation Number 22, ~830 lines) whose flush-left prose restarts bare
    # digit lists inside a single entry ("1. In Section II.C.3.a.(i)(G)..."
    # "2." "3." at lines 2792-2801; "1. CO2 must be captured onsite..." ..
    # "7." at 3592-3611; then "1. Directs the Division..." "2." with an
    # "a."-"e." sub-list at 3971-3987) and hard-wraps citation-shaped
    # fragments onto line starts ("...$\n1266. The social cost of GHGs..."
    # line 2486, "...in\n2027. The facility will be required..." lines 3666
    # and 3751, "...for\n10 years." line 2715) — every one of which
    # CYCLE_C_INNER would accept as a digit marker and turn into a row that
    # swallows the rest of the entry (the Reg 24 `sec-24-C-I-26` failure
    # shape). Every entry is therefore kept as ONE undivided row
    # (`inner_items: False`), exactly like Reg 2/3/24/6. The entries' own
    # "(I)".."(XII)" findings lists are upper-case paren-roman, which
    # CYCLE_C_INNER never starts with, and are left as paragraphs either way.
    "27": {
        "letter": "E", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 28's Part F ("Statements of Basis, Specific Statutory Authority and
    # Purpose") is a plain roman sequence of two entries, each opening
    # "<roman>.  Adopted: <date>" — "I.      Adopted: August 17, 2023"
    # (line 1944 of REG_28.txt) and "II.     Adopted: September 17-19, 2025"
    # (line 2836) — the same keyword opener Reg 2/6/21/27/30 use on the same
    # family. Both entries are kept as ONE undivided row (`inner_items:
    # False`): neither has a labelled digit/lower inner list at all (their
    # "(I)" .. "(V)" findings-of-fact lists are upper paren-roman, which
    # CYCLE_C_INNER never starts with, and the "Basis" / "Specific Statutory
    # Authority" / "Purpose" / "Applicability" / "Findings of Fact"
    # sub-headings are unlabelled prose lines), but the narrative hard-wraps
    # citation-shaped fragments onto line starts — "...by 2030 as compared
    # to 2021 levels, and a 2050 target set out in Section\n2030." style
    # fragments at REG_28.txt lines 2295 ("2030.") and 2332 ("EUI.") — the
    # same Reg 2/21/24/25 shape that CYCLE_C_INNER accepts as a digit marker
    # and turns into a row that swallows the rest of the entry.
    "28": {
        "letter": "F", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 21's Part C ("STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND
    # PURPOSE") is a plain roman sequence of two entries, each opening
    # "<roman>.  Adopted: <date>" — "I.      Adopted: July 18, 2019" (line
    # 3734 of REG_21.txt) and "II.     Adopted: December 16, 2022" (line
    # 3944) — the same keyword opener Reg 27/30 use on the same family. Both
    # entries are kept as ONE undivided row (`inner_items: False`): neither
    # has a labelled digit/lower inner list at all (their "(I)" .. "(XII)"
    # findings lists are upper paren-roman, which CYCLE_C_INNER never starts
    # with), but each entry's flush-left narrative hard-wraps the citation-
    # shaped fragment "...the standards in Regulation Number\n21. These
    # standards are being implemented..." onto a line start (lines 3899-3900
    # and 4089-4090) — exactly the Reg 24/25 "Regulation Number\n27." shape
    # that CYCLE_C_INNER accepted as a digit marker and turned into a row
    # that swallowed the rest of the entry.
    "21": {
        "letter": "C", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 6 has NO separate statement-of-basis part: Part A carries its own
    # "STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE (For
    # Part A)" block at its tail (after the incorporation-by-reference
    # entries — see FLAT_ENTRY_PART_CONFIG, which hands the scan over to this
    # SOB branch exactly at that heading line), and Part B's own statements
    # of basis are an ordinary nested Section IX (IX.A. ... IX.H., parsed by
    # the plain CYCLE_AB scan like any other Part B section). Part A's
    # entries are a plain roman sequence ("I.  Adopted: June 20, 1996" ...
    # "XXXII. Adopted October 17, 2025" — 32 entries, colon optional), each
    # opening with "Adopted", so the opener test is keyword-based like Reg 3.
    # The entries contain narrative numbered lists ("1." "2." "3." — e.g.
    # entry I's three rule-by-rule items, entry IX.A's findings) that restart
    # inside a single entry, so, exactly like Reg 3's Part F, every entry is
    # kept as ONE undivided row (`inner_items: False`).
    "6": {
        "letter": "A", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 19's Part C ("Statements of Basis, Specific Statutory Authority
    # and Purpose") is a plain roman sequence of five entries, each opening
    # "<roman>.  Adopted: <date>" — "I. Adopted: August 21, 1998" (REG_19.txt
    # line 3703), "II. Adopted: December 19, 2002 Revisions to Regulation
    # Number 19, Part A" (3940), "III. Adopted: February 15, 2007 Revisions
    # to Pre-Renovation Education..." (4042), "IV. Adopted: December 20,
    # 2007 Revisions to ... Sections III.B.1., ..." (4118), "V. Adopted:
    # November 18, 2021 Revisions to Regulation Number 19, Parts A and B"
    # (4142) — every one uses the colon, the same keyword opener Reg 30/27
    # use on the same family. Every entry is kept as ONE undivided row
    # (`inner_items: False`, like Reg 27/2/3): the entries are flush-left
    # narrative with "Background"/"Basis"/"Authority"/"Purpose" sub-headings
    # and, in entry V, a re-statement of the regulation's own outline as
    # "PART A. LEAD-BASED PAINT ACTIVITES" / "PART B. ..." headings (lines
    # 4209/4311 — see test_reg19_part_c_dotted_part_headings_are_body_text)
    # and "(I)".."(III)" findings lists; none of that is a real nested
    # hierarchy, and no entry prints a digit/lower inner list at all.
    "19": {
        "letter": "C", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 20's Part I ("STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND
    # PURPOSE") is a plain roman sequence of five entries, each opening with
    # an ALL-CAPS "ADOPTED:" keyword — "I.  ADOPTED: November 15, 2018
    # (Adoption of all Sections)" (REG_20.txt line 2036) ... "V.  ADOPTED:
    # October 20, 2023 (Revisions to Regulation Number 20 - Colorado Clean
    # Cars and ...)" (line 3072); confirmed all five print the colon and the
    # upper-case keyword, which the case-sensitive "^Adopted:?" opener Reg
    # 2/3/6/27/30 share does not match. Every entry is kept as ONE undivided
    # row (`inner_items: False`): the entries' flush-left narrative restarts
    # bare digit lists inside a single entry and hard-wraps citation-shaped
    # fragments onto line starts — the Reg 24/25/27 `sec-24-C-I-26` failure
    # shape — so CYCLE_C_INNER must not run; their "(I)".."(XII)" findings
    # lists are upper paren-roman and were never at risk.
    "20": {
        "letter": "I", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^ADOPTED:\s"),
        "inner_items": False,
    },
    # -- Batch 7 ---------------------------------------------------------
    # Reg 10 (5 CCR 1001-12) is part-less (REG_META["10"]) and its
    # statements of basis are the LAST top-level SECTION, "VI. Statements
    # of Basis, Specific Statutory Authority, and Purpose", whose four
    # entries print the section's own "VI." as a constant roman prefix —
    # exactly Reg 1's "X." / Reg 16's "III." shape: "VI.A.  Amendments
    # Adopted October 15, 1998" (REG_10.txt line 760), "VI.B.  Amendments
    # Adopted November 20, 2008" (837), "VI.C.  Amendments Adopted December
    # 15, 2011" (925), "VI.D.  Adopted: February 18, 2016" (955). Three of
    # the four put the word "Amendments" in front of "Adopted" and the
    # fourth uses the colon, so the opener accepts both forms.
    # `inner_items: False` (like Reg 1/3/16): the entries are narrative
    # with bare "Basis"/"Purpose"/"Federal Requirements"/"Contested
    # Issues"/"Statutory Authority"/"Findings pursuant to Section
    # 25-7-110.8" sub-headings and no labelled list at all, while their
    # flush-left prose hard-wraps two fragments that CYCLE_C_INNER would
    # otherwise accept as markers — "...exempt from the requirements of
    # Section 25-7-\n110.8(1)(b), C.R.S. The interagency consultation
    # requirements..." (line 828, a digit marker) and "...but they are
    # newly required to be “addressed,”\ni.e., made explicit in state
    # conformity implementation plans." (line 869, a "lower" marker) —
    # each of which would have produced a row swallowing the rest of the
    # entry, the Reg 24 `sec-24-C-I-26` failure shape.
    "10": {
        "section": "VI", "top_family": "letter_dated", "roman_prefix": "VI",
        "top_opener_re": re.compile(r"^(?:Amendments?\s+)?Adopted:?\s"),
        "inner_items": False,
        # `top_indent_ok` (the Reg 18 flag): ALL FOUR of Reg 10's entries
        # are printed at indent 6 under the flush-left "VI." heading (the
        # same six-space body indent Sections IV and V use for their own
        # "IV.A."/"V.A." items), not at indent 0 — the indent-0 requirement
        # rejected every one of them and the whole 14,000-character
        # statement of basis fused into the `sec-10-VI` section row, the
        # exact failure Reg 18 hit with its first entry. The constant
        # "VI." roman prefix plus the "Adopted" opener is already the whole
        # signature, so dropping the indent test cannot admit anything else
        # (nothing else in the document prints "VI.<letter>. Adopted ...").
        "top_indent_ok": True,
    },
    # Reg 15 (5 CCR 1001-19) is part-less (REG_META["15"]) AND a bare-ladder
    # document (BARE_LADDER_REGS), and its statements of basis are the LAST
    # top-level SECTION, "VI. Statements of Basis, Specific Statutory
    # Authority, and Purpose", whose four entries print BARE letters with no
    # roman prefix at all — exactly Reg 9's Section IX / Reg 18's Section II
    # shape: "A. November 20, 1997" (REG_15.txt line 166), "B. May 21, 1998"
    # (204), "C. December 20 & 21, 2007" (337), "D. September 18, 2008"
    # (370). So `implicit_section_prefix` nests them at `sec-15-VI-A` ..
    # `sec-15-VI-D` under the ordinary section row `sec-15-VI` rather than
    # colliding with Section I's own definitions letters at a bare
    # `sec-15-A`. Every entry opens with a BARE date and no
    # "Adopted"/"Adopted:" keyword anywhere, but entry C's date is a
    # two-day hearing written with an AMPERSAND ("December 20 & 21, 2007")
    # which neither DATE_START_RE nor REG9_SOB_OPENER_RE accepts (both only
    # allow a hyphen between the two days), hence this reg's own opener.
    # `inner_items: False` like every other bare-letter SOB (Reg 9/18): the
    # entries are narrative with bare "Background"/"Basis"/"Purpose"/
    # "Action Taken"/"FEDERAL REQUIREMENTS" sub-headings and no labelled
    # list at all, and collapsing them keeps the bare ladder from opening a
    # digit list on a wrapped fragment inside one.
    "15": {
        "section": "VI", "top_family": "letter_dated",
        "top_opener_re": re.compile(
            r"^(?:Adopted:?\s+)?(?:January|February|March|April|May|June|July|August|"
            r"September|October|November|December)\s+\d{1,2}"
            r"(?:\s*(?:[-–&]|and)\s*\d{1,2})?,?\s+\d{4}\b"
        ),
        "inner_items": False, "implicit_section_prefix": True,
    },
    # Reg 29's Part B ("STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY
    # AND PURPOSE", REG_29.txt line 215) is a plain roman sequence with, so
    # far, a single entry: "I.      Adopted: February 16, 2024" (line 217) —
    # the same "Adopted" keyword opener Reg 2/3/6/19/21/27/30 use on the
    # same family. `inner_items: False` (like Reg 2/3/12/19/20/21/24/25/27):
    # the entry is one long narrative statement whose "Additional
    # Considerations" and § 25-7-110.8 findings lists RESTART bare roman
    # numbering twice inside it ("I." .. "XII." at lines 338-390, then "I."
    # .. "V." at 399-412). Those are roman, which CYCLE_C_INNER (digit-
    # first) never starts on, so they were not at risk; what `inner_items:
    # False` guards is the same wrapped-fragment shape every other AQCC SOB
    # part hits — and it keeps the single entry one undivided row, which is
    # what the rest of the corpus does with a narrative statement of basis.
    # The top-level scan is separately safe: the restarted "II." .. "XII."
    # items ARE the next roman numeral the scan is expecting and ARE
    # paragraph-initial at indent 0, and only the "Adopted" opener test
    # rejects them.
    "29": {
        "letter": "B", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
    # Reg 23's Part B ("STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND
    # PURPOSE", REG_23.txt line 1922) is a plain roman sequence of exactly two
    # entries, each opening with the colon form of the keyword — "I.
    # Adopted: December 16, 2020" (line 1924) and "II.  Adopted: December 17,
    # 2021" (line 2139) — the same opener Reg 2/3/6/19/27/30 share on the
    # same family. Each entry is kept as ONE undivided row (`inner_items:
    # False`, like Reg 2/19/20/24): entry I's flush-left narrative hard-wraps
    # a citation-shaped fragment onto a line start — "...incorporated in
    # Regulation Number\n23. The Commission also notes that other Air Quality
    # Control Commission regulations reference..." (line 2050) — and "Number"
    # is deliberately not in `_label_position_plausible`'s disqualifying set
    # (see REG_META["2"] / SOB_PART_CONFIG["24"]), so with inner items on
    # that line was accepted as a CYCLE_C_INNER digit marker and produced a
    # `sec-23-B-I-23` row that swallowed the remaining ~11,000 characters of
    # entry I (Gate D's only giant/fused-row hit in this import). The
    # entries' other inner structure — the "Basis" / "Specific Statutory
    # Authority" / "Purpose" sub-headings and the two "(I)".."(XI)" C.R.S.
    # § 25-7-109(1)(b) / § 25-7-110.8 findings lists — is unlabelled prose
    # and upper paren-roman respectively, neither of which CYCLE_C_INNER
    # ever starts with, so nothing else changes.
    "23": {
        "letter": "B", "top_family": "roman_seq",
        "top_opener_re": re.compile(r"^Adopted:?\s"),
        "inner_items": False,
    },
}

# Statement-of-basis rows whose prose switches between Parts. Reg 19's Part
# C entry V (adopted November 18, 2021, "Revisions to Regulation Number 19,
# Parts A and B") walks the regulation's outline under its own "PART A.
# LEAD-BASED PAINT ACTIVITES" / "PART B. PRE-RENOVATION EDUCATION ..."
# headings (REG_19.txt lines 4209/4311), citing sections bare — "Terms
# (Section II.B.)", "Section III. Training and Certification Requirements",
# "Certification Based on Prior Training (Section III.B.4)" — and entry II
# ("Adopted: December 19, 2002 Revisions to Regulation Number 19, Part A",
# line 3940) does the same for Part A alone. `_default_parts_order` tries
# Part B before A for a citation written from inside the SOB part, so ten of
# those citations landed on Part B's unrelated rows (Part B's II.B. is the
# "Multi-family housing" definition; its III.B.4. is a renovation-notice
# rule). Each pattern here is matched against every paragraph of a row in
# the reg's SOB part; the first non-empty group of a match names the part
# that a bare citation in that paragraph and the following paragraphs of
# the same row is resolved against first (see build_provisions's second
# pass). Explicit "Part X, Section ..." forms are unaffected. A reg with no
# entry is untouched.
SOB_CONTEXT_PART_RE: dict[str, re.Pattern] = {
    "19": re.compile(r"^(?:PART ([A-Z])\.\s|Adopted: .*\bRegulation Number 19, Part ([A-Z])$)"),
}

# Regulations whose statements of basis are NOT a separate part at all, but
# the LAST SECTION of each part ("II. Statements of Basis, Specific Statutory
# Authority and Purpose for Part A", "VII. ... for Part B", ...), with every
# dated entry printed as an ordinary compound CYCLE_AB label under that
# section ("II.A.  September 21, 1995, Emergency Rule with Part E", "VII.K.
# Revision to Sections I., II., and III. ...", "VI.QQ. Adopted October 17,
# 2025"). Confirmed for Reg 8 (5 CCR 1001-10): Part A -> II, Part B -> VII,
# Part C -> II, Part E -> VI; Part D has no statement-of-basis section at all
# (its history is folded into Part E's). Reg 8 therefore has NO entry in
# SOB_PART_CONFIG above (nothing there is a per-section shape), and this
# separate map is consulted only by scan_markers's ordinary CYCLE_AB branch:
#
#   {reg: {part_letter: roman numeral of that part's SOB section}}
#
# Once the configured section's own "<roman>." heading has been accepted in
# that part, every later label candidate in the same part must (a) start
# with that same roman numeral and (b) be at least two tokens deep, or it is
# left as body text of the current row. That is what keeps the entries'
# narrative content from being mis-read as structure: each Reg 8 SOB entry
# contains restarted, flush-left, bare roman-numeral finding lists ("I. EPA
# established national standards for asbestos ... XII. Although alternative
# revisions ...", printed identically in at least five separate Part B
# entries) and wrapped "40 C.F.R. Part 63, Subparts W,\nMM, LLL ..." subpart
# lists whose first token is a valid roman numeral ("MM.", "CC.", "DD.") —
# each of which would otherwise be accepted as a NEW top-level section of the
# part (colliding with, and being merged into, the part's real Section I /
# II / MM ...). Rule (b) also rejects a wrapped cross-reference such as
# "...see Section\nIII.B. ..." whose first token is an EARLIER section of the
# same part — by strict pre-order every earlier section is closed once the
# SOB section opens, so nothing legitimately labelled "III.x." can follow.
# Deeper compound labels that DO start with the SOB roman ("VII.C.1.",
# "VII.C.1.a." in Part B's June 2007 entry) are still accepted normally, so
# entries keep their genuinely nested sub-items. A reg with no entry here
# (3, 7, 22, 26) is completely unaffected — the extra check never runs.
SOB_SECTION_CONFIG: dict[str, dict[str, str]] = {
    "8": {"A": "II", "B": "VII", "C": "II", "E": "VI"},
    # Air Quality Standards (5 CCR 1001-14, key "aqs" — part-less, see
    # REG_META["aqs"]): its statement of basis is the LAST top-level
    # section, "VIII. Statements of Basis, Specific Statutory Authority and
    # Purpose", and every entry is printed as an ordinary compound label
    # whose text is a TOPIC, not a date — "VIII.A. Emission Budgets for
    # Nonattainment Areas in the State of Colorado", "VIII.HH. Repeal of
    # Carbon Monoxide Attainment/Maintenance Area Descriptions", "VIII.II.
    # Revision to Emission Budgets ..." (35 entries, A..Z then AA..II; the
    # "Adopted: <date>" line follows as its own paragraph, the Reg 12 Part D
    # shape). So it is the Reg 8 per-SECTION shape, not a SOB_PART_CONFIG
    # family: the key is the part-less document's single implicit part
    # (NO_PART, the empty string — the value `scan_markers` uses as
    # `current_part` for a `no_parts` reg). Once "VIII." is open, only
    # labels rooted at VIII and at least two tokens deep are structure;
    # the entries' own narrative restarts bare digit lists ("1.
    # Establishing the Primary PM10 Budget", "2. Development of Control
    # Measures") that never tokenize under CYCLE_AB anyway, and no entry
    # prints a compound "VIII.X.1." sub-label (grep of REG_AQS.txt), so
    # each entry is one row. Entries VIII.Q .. VIII.Y are printed WITHOUT
    # the trailing dot ("VIII.Q Denver Carbon Monoxide") — see
    # KNOWN_LABEL_FIXES["aqs"].
    "aqs": {"": "VIII"},
}

# --------------------------------------------------------------------------
# "Flat entry" parts — a part with NO labeled (roman/upper/digit) sections
# at all. Reg 6's Part A ("Federal Register Regulations Adopted by
# Reference") is, in printed order: two introductory paragraphs; "TABLE 1"
# (the 40 CFR Part 60 sections where "Administrator" keeps its federal
# meaning); ~95 "Subpart Xx   <title>. 40 CFR Part 60, Subpart Xx (July 1,
# 2025)." incorporation-by-reference entries (a few carrying several
# paragraphs of Colorado-specific amendments, e.g. Subparts Cc, Cf, DDDD);
# "APPENDIX X to Part 60 ..." entries; "TABLE 2" (the 40 CFR Part 75
# subparts adopted); "APPENDIX X to Part 75 ..." entries; then the Part A
# statements of basis (handed to SOB_PART_CONFIG at `sob_heading_re`).
#
# None of that tokenizes under CYCLE_AB, so without this config the whole
# ~700-line block was silently dropped (a "part" marker owns no text of its
# own, and nothing between it and the first accepted item marker is kept).
# Every printed entry becomes one row, id `sec-<reg>-<letter>-<suffix>`,
# parent = the part root, in printed order:
#   INTRO            the unlabeled intro paragraphs   (citation "Introduction")
#   TABLE-<n>        a "TABLE n" caption line          (citation "Table n"; the
#                    pdfplumber-recovered table, then any footnote paragraphs)
#   SUBPART-<code>   "Subpart <code> <title>..."       (citation "Subpart <code>")
#   P<nn>-APP-<L>    "APPENDIX <L> to Part <nn> ..."   (citation "Appendix <L> to
#                    Part <nn>"; deliberately NOT the `-APPENDIX-` id shape,
#                    which marks a regulation's OWN appendix — these are
#                    federal appendices incorporated by reference)
#   SOB              the statements-of-basis heading line (heading-only row;
#                    the dated entries that follow are the ordinary
#                    `sec-<reg>-<letter>-<roman>` roman_seq rows)
# Only regs listed here are affected; scan_markers/build_provisions/
# find_body_start/link_citations all consult this dict and are no-ops for
# every other regulation (verified: Reg 26 output byte-identical).
#   bare_part_headings: Reg 6 prints "PART A" / "PART B" ALONE on the line,
#     with the part title on the next non-blank line ("Federal Register
#     Regulations Adopted by Reference" / "Non-Federal NSPS for Specific
#     Facilities and Sources") — Reg 3/7/22/26 all print "PART X <title>"
#     on one line, so the bare form is only recognized when this is set.
#   sob_heading_re: the line that ends the flat entry list and starts the
#     SOB_PART_CONFIG scan for the same part letter.
# Guards on an entry line (see _flat_entry_match): indent 0 (captions are
# the exception — they're centered), paragraph-initial (blank line / marker
# line / page seam before it — a hard-wrapped "...40 CFR\nSubpart Cc or WWW
# are subject..." continuation is NOT an entry), and the title text must
# start with a capital letter ("Subpart G approving the state plan" is a
# wrapped continuation, "Subpart G     Standards of Performance..." is not).
#
# Reg 20's Part H ("INCORPORATIONS BY REFERENCE", REG_20.txt lines
# 1679-2032) is the second flat part in the corpus, with a much simpler
# shape than Reg 6's: two intro paragraphs; ONE captioned table ("Table 1.
# Code of California Regulations, Title 13. Motor Vehicle, Division 3. Air
# Resource Board" — Section / Title / Section Amended Date, ~100 rows,
# bordered, spanning REG_20.pdf pages 28-33 with the column-header row
# reprinted on every page and NO caption reprint); then four closing
# paragraphs (the "does not include any later amendments" clause, the
# Division's address, the Westlaw URL, the Barclays address). No
# "Subpart"/"APPENDIX to Part" entries, no statements-of-basis heading (Part
# I is its own SOB part — SOB_PART_CONFIG["20"]), so:
#   sob_heading_re is OPTIONAL here (absent: the flat scan simply runs until
#     the next "PART X" heading, which already resets `flat_active`);
#   table_caption_re (per-reg, optional): the "Table <n>. <title>" caption
#     shape this part prints — `_FLAT_TABLE_RE` only knows the bare "TABLE n"
#     form Reg 6 uses. A matching line becomes the `TABLE-<n>` entry marker
#     (citation "Table <n>", titled with the caption text); the table itself
#     is NOT looked up by caption (the six-page span can't be recovered by the
#     caption walk, which only follows a REPRINTED caption) — it is pinned by
#     row id through UNCAPTIONED_TABLES["20"] (`spans`), and the entry build
#     branch runs `_swap_uncaptioned_table` exactly like the item/appendix
#     branches (a no-op for Reg 6, which has no UNCAPTIONED_TABLES entry).
# Rows: `sec-20-H-INTRO` (the two intro paragraphs) and `sec-20-H-TABLE-1`
# (the recovered table, then the four closing paragraphs).
FLAT_ENTRY_PART_CONFIG: dict[str, dict] = {
    "6": {
        "letter": "A",
        "bare_part_headings": True,
        "sob_heading_re": re.compile(r"^STATEMENTS? OF BASIS\b"),
    },
    "20": {
        "letter": "H",
        "table_caption_re": re.compile(r"^Table\s+(\d+)\.\s+(\S.*)$"),
    },
}

_FLAT_SUBPART_RE = re.compile(r"^Subpart\s+([A-Z]{1,5}[a-z]?)\s+([A-Z].*)$")
_FLAT_APPENDIX_RE = re.compile(r"^APPENDIX\s+([A-Z])\s+to\s+Part\s+(\d+)\s+([A-Z].*)$")
_FLAT_TABLE_RE = re.compile(r"^(?:TABLE|Table)\s+(\d+)$")
# The first sentence of an entry is its title; the "40 CFR Part NN, Subpart
# Xx (July 1, 2025)." adoption citation that follows is body text, not title.
_FLAT_TITLE_CUT_RE = re.compile(r"^(.*?)[.,]?\s+40 CFR\b")
# Same-regulation "Subpart(s) Xx[, Yy, and Zz]" mentions (outside a "40 CFR
# Part NN, Subpart Xx" citation, which CFR_RE claims first) link to the
# flat entry rows — Reg 6 refers to its own Part A entries this way
# throughout ("Subpart A (General Provisions) of Regulation Number 6, Part
# A", "Part A, Subpart IIII or JJJJ", "Subparts A, D, Da, Db, ... and
# GGGa"). Only consulted for regs in FLAT_ENTRY_PART_CONFIG.
_FLAT_SUBPART_CODE = r"[A-Z]{1,5}[a-z]?"
_FLAT_SUBPART_LIST_SEP = r"(?:\s*,\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+)"
FLAT_SUBPART_REF_RE = re.compile(
    r"\b(Subparts?)\s+(" + _FLAT_SUBPART_CODE + r"(?:" + _FLAT_SUBPART_LIST_SEP + _FLAT_SUBPART_CODE + r")*)\b"
)
_FLAT_SUBPART_CODE_RE = re.compile(_FLAT_SUBPART_CODE)
_FLAT_PRECEDING_PART_RE = re.compile(r"\bPart\s+(\d+)\s*,?\s*$")


def _flat_entry_match(lines: list[str], idx: int, last_marker_line: int | None,
                      seam_starts: set[int] | None,
                      table_caption_re: re.Pattern | None = None) -> dict | None:
    """Recognize one flat-entry marker line (see FLAT_ENTRY_PART_CONFIG).
    Returns {suffix, citation, rest, table_caption} or None. `table_caption_re`
    (FLAT_ENTRY_PART_CONFIG `table_caption_re`, Reg 20 only) additionally
    accepts a "Table <n>. <title>" caption line as the `TABLE-<n>` marker,
    carrying the caption text as `title` and NO `table_caption` (the table
    is pinned by row id via UNCAPTIONED_TABLES instead); None (every other
    caller) leaves the Reg 6 behaviour untouched."""
    raw = lines[idx]
    stripped = raw.strip()
    indent = len(raw) - len(raw.lstrip(" "))
    m = _FLAT_TABLE_RE.match(stripped)
    if m:
        return dict(suffix=f"TABLE-{m.group(1)}", citation=f"Table {m.group(1)}",
                    rest="", table_caption=stripped)
    m = table_caption_re.match(stripped) if table_caption_re else None
    if m:
        return dict(suffix=f"TABLE-{m.group(1)}", citation=f"Table {m.group(1)}",
                    rest="", table_caption=None,
                    title=f"Table {m.group(1)} — {m.group(2).strip()}")
    if indent != 0:
        return None
    sig = _prev_line_signals(lines, idx, last_marker_line)
    paragraph_initial = (
        sig["prev_blank"] or sig["prev_is_marker_line"]
        or (seam_starts is not None and idx in seam_starts)
    )
    if not paragraph_initial:
        return None
    m = _FLAT_SUBPART_RE.match(stripped)
    if m:
        return dict(suffix=f"SUBPART-{m.group(1)}", citation=f"Subpart {m.group(1)}",
                    rest=m.group(2).strip(), table_caption=None)
    m = _FLAT_APPENDIX_RE.match(stripped)
    if m:
        return dict(suffix=f"P{m.group(2)}-APP-{m.group(1)}",
                    citation=f"Appendix {m.group(1)} to Part {m.group(2)}",
                    rest=m.group(3).strip(), table_caption=None)
    return None


def _flat_entry_title(citation: str, first_para: str) -> str:
    """'Subpart Cb' + 'Emission Guidelines ... 1994. 40 CFR Part 60, Subpart
    Cb (July 1, 2025).' -> 'Subpart Cb — Emission Guidelines ... 1994'."""
    if not first_para:
        return citation
    m = _FLAT_TITLE_CUT_RE.match(first_para)
    name = (m.group(1) if m else first_para).strip().rstrip(".,")
    return f"{citation} — {name}" if name else citation


# --------------------------------------------------------------------------
# Unlabeled term-definitions section (Common Provisions "I.G. Definitions",
# reg key "cp"). Unlike every other AQCC definitions list seen so far (Reg
# 1's I.B.1./I.B.2./..., Reg 8's I.B.72./I.B.73./...), Common Provisions
# prints each defined term as its OWN ALL-CAPS line ("ABSOLUTE VAPOR
# PRESSURE", "ACT", "AIR POLLUTANT", ...) with NO printed number at all,
# followed by a blank line and the definition's prose (confirmed: 123 such
# terms between the "I.G.    Definitions" heading and the next top-level
# section, "II.     General" — checked against the source PDF page-by-page,
# not just the pdftotext dump, to rule out a layout artifact). Rather than
# leave this whole ~2,600-line block as one fused row under `sec-cp-I-G` (the
# giant/fused-row bug quality gate D is built to catch), each term becomes
# its own row with a SYNTHESIZED sequential digit label — `sec-cp-I-G-1`
# (ABSOLUTE VAPOR PRESSURE) through `sec-cp-I-G-123` (WOOD RESIDUE), in
# printed order — the same `sec-{reg}-{part}-{suffix}` id shape every other
# item in the corpus uses, just with a label this parser assigns rather than
# one the source prints. `TERM_DEFINITIONS_SECTION[reg]` names the exact
# token chain (family, raw) of the section this applies inside (`I.G.` for
# `cp`); a reg absent from this dict is completely unaffected — the branch
# that consults it in scan_markers only runs when `tokenize_by_cycle` found
# NO ordinary compound-label tokens at all on the line (a real "II." marker,
# or an "I.G.4." compound label if this section ever DOES start numbering,
# always tokenizes first and takes priority; see the branch in scan_markers's
# ordinary-item loop). Reg 3/7/22/26/1/... every existing regulation is
# byte-identical before and after (verified: no other reg is listed here, so
# `TERM_DEFINITIONS_SECTION.get(reg or "")` is always None for them and the
# new branch's body never executes).
TERM_DEFINITIONS_SECTION: dict[str, list[tuple[str, str]]] = {
    "cp": [("roman", "I"), ("upper", "G")],
}

# A term heading line: starts with an uppercase letter, and every other
# character is an uppercase letter, digit, space, or one of the small set of
# punctuation marks actually used in these 123 terms' names (parens —
# "CONTROL DEVICE (STATIONARY)"; slash — "FOSSIL FUEL AND/OR WOOD RESIDUE
# FIRED STEAM GENERATING UNIT"; ampersand, comma, hyphen, apostrophe, period
# — "U.S. EPA" doesn't appear as a term name but the class is kept generic).
# Confirmed against all 123 printed term lines plus their surrounding text:
# no ordinary body sentence in this section is written ALL CAPS, so this
# alone (checked only while already inside the configured section — see
# above) does not false-positive on prose.
_TERM_HEADING_RE = re.compile(r"^[A-Z][A-Z0-9()&,/'’.\- ]{0,90}$")


def _match_term_heading_line(lines: list[str], idx: int, seam_starts: set[int] | None) -> str | None:
    """Recognize one term-definition heading line inside a
    TERM_DEFINITIONS_SECTION-configured section: an all-caps line, standing
    alone on its own paragraph (blank line — or a page seam, since a page
    break is always paragraph-initial — immediately before it, blank line
    immediately after), with at least one letter. Returns the term text or
    None."""
    stripped = lines[idx].strip()
    if not stripped or not _TERM_HEADING_RE.match(stripped):
        return None
    if not any(c.isalpha() for c in stripped):
        return None
    prev_ok = idx == 0 or lines[idx - 1].strip() == "" or (seam_starts is not None and idx in seam_starts)
    next_ok = idx + 1 < len(lines) and lines[idx + 1].strip() == ""
    if not (prev_ok and next_ok):
        return None
    return stripped


# --------------------------------------------------------------------------
# Sections whose direct children are printed as BARE digit labels. Reg 11
# (5 CCR 1001-13) prints every label as the full dotted path ("I.C.3.a.",
# "VI.B.1.", confirmed through every one of Parts A-G) EXCEPT Part A's
# Section II "DEFINITIONS", whose 61 defined terms are numbered bare —
# "1.    “Accreditation” means ...", "2.    “Air Intake Systems” ...",
# "61.   “Zero Gas” ..." (REG_11.txt lines 296-589) — with no "II." prefix at
# all, so `tokenize_by_cycle` (which expects roman first under CYCLE_AB)
# produced no tokens and the whole ~300-line block was fused into one
# 14,000-character `sec-11-A-II` row (gate D). The regulation's own Editor's
# Notes cite these as "Part A II.43" and Part H's statement of basis as
# "Part A, Section II.40." — i.e. the compound id `sec-11-A-II-40` is the
# citation the source itself uses, so each bare "N." is accepted as the
# compound [roman <section>, digit N] under the configured section, giving
# ids `sec-11-A-II-1` .. `sec-11-A-II-61` (citation "II.1." etc., the same
# synthesized-compound convention Reg 9's bare ladder and the Common
# Provisions' term rows already use). A candidate is accepted only while the
# configured section is the open chain's head (the section itself or one of
# its bare children was the last accepted marker), only when paragraph-
# initial, and only when its number is exactly the NEXT ordinal (1 first,
# then last + 1) — which is what rejects the one wrapped continuation line in
# the block, "...listed in 40 CFR Part\n82." (line 350: "82." right after
# item 12). The value names the row kind: "definition" also extracts the
# leading quoted term (“Accreditation”) as the row's `term`, so the title
# reads "II.1. Accreditation" like the Common Provisions' term rows. Consulted
# only from the branch of scan_markers that runs when NO ordinary compound
# label tokenized on the line (see TERM_DEFINITIONS_SECTION for the same
# no-op guarantee) — a reg absent from this dict is completely unaffected.
#   {reg: {(part_letter, section_roman): kind}}
BARE_DIGIT_CHILD_SECTIONS: dict[str, dict[tuple[str, str], str]] = {
    "11": {("A", "II"): "definition"},
}

_BARE_DIGIT_CHILD_RE = re.compile(r"^(\d{1,3})\.\s+(\S.*)$")
_QUOTED_TERM_RE = re.compile(r"^[“\"]([^”\"]{1,120})[”\"]")


def _match_bare_digit_child(lines: list[str], idx: int, stripped: str, seam_starts: set[int] | None,
                            last_marker_line: int | None, cfg_kind: str, section: str,
                            chain: list[tuple[str, str]]) -> dict | None:
    """One BARE_DIGIT_CHILD_SECTIONS candidate line. `chain` is the last
    accepted marker's token chain for the current part; returns
    {tokens, consumed, term} or None."""
    if not chain or chain[0] != ("roman", section) or len(chain) > 2:
        return None
    if len(chain) == 2 and chain[1][0] != "digit":
        return None
    m = _BARE_DIGIT_CHILD_RE.match(stripped)
    if not m:
        return None
    sig = _prev_line_signals(lines, idx, last_marker_line)
    paragraph_initial = (
        sig["prev_blank"] or sig["prev_is_marker_line"]
        or (seam_starts is not None and idx in seam_starts)
    )
    if not paragraph_initial:
        return None
    expected = 1 if len(chain) == 1 else int(chain[1][1]) + 1
    if int(m.group(1)) != expected:
        return None
    term = None
    if cfg_kind == "definition":
        tm = _QUOTED_TERM_RE.match(m.group(2))
        term = tm.group(1).strip() if tm else None
    return dict(tokens=[("roman", section), ("digit", m.group(1))], consumed=m.end(1) + 1, term=term)


# --------------------------------------------------------------------------
# Appendix "ladders" — an APPENDIX whose body is itself an outlined
# technical document rather than one undivided blob. Every appendix the
# corpus had seen before Reg 11 is a few pages at most and is stored as ONE
# row (see the `appendix_active` branch of scan_markers); Reg 11's Appendix
# A "Technical Specifications" (REG_11.txt lines 5701-7842, 2,140 lines,
# ~100,000 characters — 46 printed pages of analyzer specifications) is
# not: it is printed as
#   - a "Revised Sept 09, 1994" line and an "INTRODUCTION" heading + prose;
#   - decimal-numbered specification sections "1.0   GENERAL", "1.1   Design
#     Goals", ... "2.14   Standard Hardware...", "3.0   DISPLAY PROMPTS..."
#     (a "X.0" line is the major-group heading; "X.n" its subsections; one
#     third-level "2.8.1  Temperature Control" under "2.8");
#   - under some of those, lettered items "A." .. "K." (1.4, 1.5, 1.8, 2.10,
#     2.11, 2.13, 2.15) or numbered items "1." .. "13." (2.14), and, under
#     a lettered item, its own numbered list ("2.13.A." -> "1." .. "4.")
#     which may nest a lettered list once more ("2.13.D.4." -> "a." .. "c.");
#     (the "(1). Maintain the ..." at line 5941 is NOT a label — it is the
#     wrapped tail of "...sample probes\n(1)." and the paragraph-initial
#     guard leaves it as body text);
#   - then six "ATTACHMENT I" .. "ATTACHMENT VI" blocks: I-III are one-
#     paragraph incorporation-by-reference stubs, IV ("Specifications for
#     Colorado 97 Analyzer") RESTARTS the same "INTRODUCTION" / "1.0" ..
#     "3.5" decimal outline, V ("...OBD Stand-Alone Analyzer", ~500 lines)
#     has NO printed labels at all — only unnumbered Title-Case headings
#     ("Design Goals", "Pass/Fail Requirement", ... "Certification
#     Requirements", 27 of them, each alone on its own line between blank
#     lines) — and VI is a heading with no text (its label samples are images).
# Left as one row it would be the largest row in the corpus by a factor of
# ten (gate D), so for the appendix letters listed here scan_markers keeps
# scanning INSIDE the appendix and emits one row per printed unit, all under
# the appendix row (`sec-11-H-APPENDIX-A`, parent = root, exactly as every
# other appendix — the owner-part-prefixed id shape Reg 3/7/9/30 use):
#   ATTACHMENT <roman> <title>  -> `<appendix>-ATT-<roman>` (kind "appendix",
#       citation "Attachment IV", parent = the appendix row); every later
#       unit nests under it until the next attachment
#   X.0 / X.n / X.n.m           -> `-1.0` (kind "section"), `-1.4` (kind
#       "item", parent `-1.0`), `-2.8.1` (parent `-2.8`); citation "1.4."
#   A. / 1. / a. / (1)          -> `-1.4-A`, `-2.14-1`, `-2.13-A-1`,
#       `-2.13-D-4-a`; parent = the open decimal section or the open item
#       one level up (a stack: decimal -> upper|digit -> digit|paren ->
#       lower|paren -> paren, see _LADDER_CHILD_FAMILIES); citation
#       "1.4.A.", "2.13.D.4.a." (the same compound convention every
#       synthesized ladder in this parser uses)
#   unlabeled heading line      -> `-INTRODUCTION`, `-ATT-V-DESIGN-GOALS`
#       (an upper-cased, dash-joined slug of the heading — stable across
#       re-imports, unlike a sequential number, if a heading is ever added
#       in the middle), citation = title = the heading text, kind "item",
#       parent = the open attachment (or the appendix row)
# Acceptance guards, all three needed (confirmed against the whole block —
# the ONLY lines they accept are the printed outline): a candidate must be
# paragraph-initial (blank line, marker line or page seam before it); a
# decimal label must be the exact next one in sequence ("1.0" first, then
# X.n+1 or X+1.0; X.n.1 first under X.n, then X.n.m+1) — which is what
# rejects "0.5 liters in 24 hours) if the calibration gas..." (line 6303, a
# wrapped continuation) and the Editor's-Notes-style "2.11; Appendix A"
# fragments; a lettered/numbered/lower/paren item must be the exact next
# sibling of an OPEN level of its family (closing everything below it) or
# the first of a new list ("A."/"1."/"a."/"(1)") one level under the deepest
# open level, and there must be an open decimal section for it to hang
# under; an unlabeled heading is a line at indent 0, ≤70 characters,
# starting with a capital letter, containing no digit (rejects "Revised
# Sept 09, 1994") and ending in no sentence punctuation, with a blank line
# before it and a blank line, page seam or attachment/appendix heading after
# it. Each new ATTACHMENT resets the decimal sequence. A reg with no entry
# here keeps the undivided-blob appendix behaviour unchanged (the branch is
# never entered).
#   {reg: frozenset of appendix letters}
# Reg 4's Appendix A ("Test Method Protocols for Measuring Wood-Burning
# Masonry Heater Emissions", REG_4.txt lines 1036-2980 — 1,945 lines,
# ~95,000 characters, 34 of the document's 51 printed pages) is the same
# shape: a self-contained technical protocol outlined as decimal sections
# "1.0 SCOPE", "2.0 DEFINITIONS", "3.0 APPROVAL PROCEDURES" ... "7.0
# REPORTING REQUIREMENTS", their subsections "3.1", "3.2" ..., and
# sub-subsections that go three levels deeper than Reg 11 ever does
# ("5.5.5.2.1 Line of Symmetry", "5.5.12.1.4 Third Layer") — hence
# APPENDIX_LADDER_DECIMAL_DEPTH["4"] = 5. The only item-family list in it is
# the numbered bibliography "1." - "4." under 7.6.8 (line 2950). It has no
# ATTACHMENT blocks and no unlabeled standalone headings (every indent-0
# line in the block is either a decimal label or running prose).
APPENDIX_LADDERS: dict[str, frozenset[str]] = {
    "11": frozenset({"A"}),
    "4": frozenset({"A"}),
}

_LADDER_ATTACHMENT_RE = re.compile(r"^ATTACHMENT\s+([IVXLC]+)\b\s*(.*)$")
# One or more ".<n>" groups after the major number, with NO trailing dot
# before the text (so a wrapped citation line like "5.7.3. The stainless-
# steel probe ..." — REG_4.txt line 1654 — still fails to match, exactly as
# it did under the old two-or-three-component pattern). How many components
# are actually ACCEPTED is capped per regulation by
# APPENDIX_LADDER_DECIMAL_DEPTH, which defaults to the 3 the old pattern
# allowed — so Reg 11's ladder sees precisely the same candidate set.
_LADDER_DECIMAL_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2})+)\s+(\S.*)$")
# Deepest decimal label an appendix ladder will accept, per regulation.
# Reg 11's Appendix A never prints deeper than "2.8.1" (3 components) and
# keeps the historical cap; Reg 4's Appendix A test protocol reaches five
# ("5.5.12.1.1 First Layer", "5.5.5.2.1 Line of Symmetry" — REG_4.txt lines
# 2059/1872). Raising the cap can only ever ADD candidates at depths a reg
# does not print, so it is opt-in per reg.
APPENDIX_LADDER_DECIMAL_DEPTH: dict[str, int] = {"4": 5}
_LADDER_DECIMAL_DEPTH_DEFAULT = 3
_LADDER_UPPER_RE = re.compile(r"^([A-Z])\.\s+(\S.*)$")
_LADDER_DIGIT_RE = re.compile(r"^(\d{1,2})\.\s+(\S.*)$")
_LADDER_LOWER_RE = re.compile(r"^([a-z])\.\s+(\S.*)$")
_LADDER_PAREN_RE = re.compile(r"^\((\d{1,2})\)\.?\s+(\S.*)$")
_LADDER_HEADING_RE = re.compile(r"^[A-Z][^0-9]{0,69}$")
_LADDER_HEADING_TERMINAL = ".;:,"


def _ladder_slug(text: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "-", text.upper()).strip("-")
    return slug or "HEADING"


# Which item families may open a list directly under each level of an
# appendix ladder (confirmed printed shapes: 1.4 -> A.; 2.14 -> 1.; 2.13.A ->
# 1.; 2.13.D.4 -> a.; 1.8.B -> (1).).
_LADDER_CHILD_FAMILIES = {
    "decimal": ("upper", "digit"),
    "upper": ("digit", "paren"),
    "digit": ("lower", "paren"),
    "lower": ("paren",),
    "paren": (),
}


def _ladder_ordinal(fam: str, raw: str) -> int:
    if fam in ("digit", "paren"):
        return int(raw)
    return ord(raw.upper()) - ord("A") + 1


def _new_ladder_state() -> dict:
    return dict(att=None, dec=None, stack=[], slugs=set())


def _ladder_prefix(state: dict) -> str:
    return f"ATT-{state['att']}-" if state["att"] else ""


def _appendix_ladder_match(lines: list[str], idx: int, raw_line: str, stripped: str, indent: int,
                           seam_starts: set[int] | None, last_marker_line: int | None,
                           state: dict, reg: str | None = None) -> dict | None:
    """One APPENDIX_LADDERS candidate line (see that dict's comment for the
    grammar and guards). Mutates `state` on acceptance and returns the
    marker fields {suffix, parent_suffix, citation, rest, kind, heading_only,
    title_end_line, attachment} or None."""
    sig = _prev_line_signals(lines, idx, last_marker_line)
    paragraph_initial = (
        sig["prev_blank"] or sig["prev_is_marker_line"]
        or (seam_starts is not None and idx in seam_starts)
    )
    if not paragraph_initial:
        return None
    pre = _ladder_prefix(state)

    m = _LADDER_ATTACHMENT_RE.match(stripped)
    if m and indent == 0 and is_valid_roman(m.group(1)):
        heading = m.group(2).strip()
        extra_lines = _heading_continuation_lines(lines, idx)
        for ex in extra_lines:
            heading = f"{heading}{ex}" if heading.endswith("-") else f"{heading} {ex}".strip()
        state.update(att=m.group(1), dec=None, stack=[])
        return dict(suffix=f"ATT-{m.group(1)}", parent_suffix=None,
                    citation=f"Attachment {m.group(1)}", rest=heading, kind="appendix",
                    heading_only=True, title_end_line=idx + len(extra_lines),
                    attachment=m.group(1))

    m = _LADDER_DECIMAL_RE.match(stripped)
    if m:
        max_depth = APPENDIX_LADDER_DECIMAL_DEPTH.get(reg or "", _LADDER_DECIMAL_DEPTH_DEFAULT)
        parts = tuple(int(x) for x in m.group(1).split("."))
        dec = state["dec"]  # the open decimal section's components, or None
        # Sequence guard, generalized from the original two-/three-component
        # form (and provably identical to it for depth <= 3): the very first
        # label must be "1.0" or "1.1"; after that a candidate must be the
        # next sibling of the open section or of one of its ANCESTORS
        # (closing everything below it), the first child of the open section
        # ("X.n.1" under "X.n"), or the next major group ("X+1.0").
        ok = False
        if len(parts) <= max_depth:
            if dec is None:
                ok = parts in ((1, 0), (1, 1))
            elif len(parts) == 2 and parts[1] == 0:
                ok = parts[0] == dec[0] + 1
            elif len(parts) <= len(dec):
                ok = (parts[:-1] == dec[:len(parts) - 1]
                      and parts[-1] == dec[len(parts) - 1] + 1)
            elif len(parts) == len(dec) + 1:
                ok = parts[:-1] == dec and parts[-1] == 1
        if not ok:
            return None
        state.update(dec=parts, stack=[])
        label = ".".join(str(x) for x in parts)
        if len(parts) == 2:
            if parts[1] == 0:
                parent, kind = None, "section"
                state[f"has_{pre}{parts[0]}.0"] = True
            else:
                parent = f"{pre}{parts[0]}.0" if state.get(f"has_{pre}{parts[0]}.0") else None
                kind = "item"
        else:
            parent = pre + ".".join(str(x) for x in parts[:-1])
            kind = "item"
        return dict(suffix=f"{pre}{label}", parent_suffix=parent, citation=f"{label}.",
                    rest=m.group(2).strip(), kind=kind,
                    heading_only=False, title_end_line=idx, attachment=None)

    if state["dec"] is not None:
        dec = state["dec"]
        dec_label = ".".join(str(x) for x in dec)
        cand = None
        for fam, rx in (("upper", _LADDER_UPPER_RE), ("digit", _LADDER_DIGIT_RE),
                        ("lower", _LADDER_LOWER_RE), ("paren", _LADDER_PAREN_RE)):
            m = rx.match(stripped)
            if m:
                cand = (fam, m.group(1), m.group(2).strip())
                break
        if cand is not None:
            fam, raw, rest = cand
            stack: list[tuple[str, str]] = state["stack"]
            new_stack = None
            # 1. the exact next sibling of an OPEN level of the same family
            #    (closing everything below it) ...
            for d in range(len(stack) - 1, -1, -1):
                if stack[d][0] == fam and _ladder_ordinal(fam, raw) == _ladder_ordinal(fam, stack[d][1]) + 1:
                    new_stack = stack[:d] + [(fam, raw)]
                    break
            # 2. ... or the FIRST item of a new list one level under the
            #    deepest open level (or directly under the decimal section).
            if new_stack is None and _ladder_ordinal(fam, raw) == 1:
                parent_fam = stack[-1][0] if stack else "decimal"
                if fam in _LADDER_CHILD_FAMILIES[parent_fam]:
                    new_stack = stack + [(fam, raw)]
            if new_stack is None:
                return None
            state["stack"] = new_stack
            disp = [f"({r})" if f == "paren" else r for f, r in new_stack]
            return dict(suffix=f"{pre}{dec_label}-" + "-".join(disp),
                        parent_suffix=f"{pre}{dec_label}" + "".join(f"-{d}" for d in disp[:-1]),
                        citation=f"{dec_label}." + "".join(f"{d}." for d in disp), rest=rest, kind="item",
                        heading_only=False, title_end_line=idx, attachment=None)
        # No item label: fall through to the unlabeled-heading test below.

    # "Standing alone": a blank line follows — or a page seam (clean_pages
    # drops the blank run at a page's end, so a heading that is the last
    # line on its page, like Attachment IV's two "Vehicle Inspection Report
    # – ... Form" figure captions, is followed directly by the next page's
    # first line), or the next attachment/appendix/part heading.
    next_ok = (
        idx + 1 >= len(lines) or lines[idx + 1].strip() == ""
        or (seam_starts is not None and idx + 1 in seam_starts)
        or bool(_MARKER_LOOKALIKE_RE.match(lines[idx + 1]))
        or bool(_LADDER_ATTACHMENT_RE.match(lines[idx + 1].strip()))
    )
    if (indent == 0 and _LADDER_HEADING_RE.match(stripped) and stripped[-1] not in _LADDER_HEADING_TERMINAL
            and next_ok
            and not _MARKER_LOOKALIKE_RE.match(raw_line) and not _LABEL_LOOKALIKE_RE.match(stripped)):
        slug = _ladder_slug(stripped)
        key = f"{pre}{slug}"
        n = 2
        while key in state["slugs"]:
            key = f"{pre}{slug}-{n}"
            n += 1
        state["slugs"].add(key)
        state.update(dec=None, stack=[])
        return dict(suffix=key, parent_suffix=None, citation=stripped, rest="", kind="item",
                    heading_only=False, title_end_line=idx, attachment=None, heading_row=True)
    return None


def _sob_scope(reg: str | None) -> tuple[str | None, str | None]:
    """(part_letter, section_roman) for this reg's statement-of-basis
    scope: exactly one of the two is set — `letter` for a part-scoped SOB
    (every regulation imported before Reg 1), `section` for a section-scoped
    one (a part-less regulation whose SOB is its last top-level section)."""
    cfg = SOB_PART_CONFIG.get(reg or "") or {}
    return cfg.get("letter"), cfg.get("section")


def _sob_top_label(top_family: str, idx0: int) -> str | None:
    """The printed label for the 0-indexed position `idx0` in a
    statement-of-basis part's top-level sequence, or None past the range
    a family supports."""
    if top_family == "letter_dated":
        return PART_C_LETTERS[idx0] if idx0 < len(PART_C_LETTERS) else None
    if top_family == "roman_seq":
        return int_to_roman(idx0 + 1) if idx0 < 4999 else None
    return None


# --------------------------------------------------------------------------
# Page-furniture stripping (form-feed-delimited pages)
# --------------------------------------------------------------------------

_HEADER_RE = re.compile(r"^CODE OF COLORADO REGULATIONS\b")
_FOOTER_BODY_RE = re.compile(r"^Air Quality Control Commission\s*$")
_PAGENUM_RE = re.compile(r"^\d{1,4}$")
_DIVIDER_RE = re.compile(r"^_{5,}$")
# Reg 2's PDF (a 2014 Word print) carries NO running header at all and a
# single combined footer line "Code of Colorado Regulations          <page>"
# (mixed case, page number on the SAME line) at the bottom of every one of
# its 45 pages, instead of the "CODE OF COLORADO REGULATIONS 5 CCR ..." /
# "Air Quality Control Commission" / bare page-number trio the other CCR
# prints use. Matched only as a whole line ending in the page number, so it
# can never strip a sentence that merely mentions the Code; no other source
# in pipeline/sources/ prints this line (Reg 3/7/22/26 output is unchanged).
_FOOTER_CCR_PAGE_RE = re.compile(r"^Code of Colorado Regulations\s+\d{1,4}$")
# The APCD general permits (GP01-GP12) are not CCR-print regulations at all —
# no "CODE OF COLORADO REGULATIONS" running header, just a centered "Page N
# of M" footer on every page (confirmed: every GPxx.txt in sources/; no
# REG_<N>.txt prints this exact whole-line shape). Gated to GP_KEYS (empty
# for every reg without a footer_page_of_total flag) so it can never strip a
# genuine sentence from Reg 1/2/26/cp.
_PAGE_OF_TOTAL_RE = re.compile(r"^Page\s+\d{1,4}\s+of\s+\d{1,4}$")


def clean_pages(raw_text: str, reg: str | None = None) -> tuple[list[str], set[int]]:
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
    page_of_total_ok = bool(REG_META.get(reg or "", {}).get("page_of_total_footer"))
    standalone_breaks = bool(REG_META.get(reg or "", {}).get("seam_standalone_line_breaks"))
    # `seam_paragraph_breaks` (REG_META, Batch 6: Reg 16 / sip / Reg 18):
    # EVERY page seam is a paragraph break — these short SOS prints never
    # wrap a paragraph across a page (each page ends in a run of blank lines
    # and the next page opens on a new paragraph, heading or label:
    # confirmed for all 8 / 21 / 5 seams of REG_16 / REG_SIP / REG_18.txt),
    # so the seam-splice's chained line always fused a page-opening heading
    # or paragraph onto the previous page's last sentence ("...Adopted:
    # November 15, 2001 The November 15, 2001 amendments...", "...federal
    # act. Statutory Authority", "c. Alternative Sanding Materials
    # Experimentation with new..."). Strictly wider than
    # `seam_standalone_line_breaks` (which only breaks before a one-line
    # paragraph); off — and clean_pages byte-identical — for every
    # regulation that doesn't set it.
    all_seam_breaks = bool(REG_META.get(reg or "", {}).get("seam_paragraph_breaks"))
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
            if (
                s == "" or _PAGENUM_RE.match(s) or _DIVIDER_RE.match(s) or _FOOTER_CCR_PAGE_RE.match(s)
                or (page_of_total_ok and _PAGE_OF_TOTAL_RE.match(s))
            ):
                j -= 1
                continue
            break
        lines = lines[:j]
        if page_idx > 0 and lines:
            if all_seam_breaks and out and out[-1].strip() != "":
                out.append("")
            elif standalone_breaks and out and out[-1].strip() != "" and (len(lines) == 1 or lines[1].strip() == ""):
                # See REG_META["27"]["seam_standalone_line_breaks"]: a page
                # that opens with a one-line paragraph (a blank line right
                # after its first surviving line) gets a paragraph break
                # at the seam instead of being chained onto the previous
                # page's last line. The seam index still points at the
                # real first line, not the inserted blank.
                out.append("")
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

# Reg 7 captions use an en-dash/hyphen ("Table 2 – Storage Tank Inspections");
# Reg 22 uses a colon instead ("Table 1: End-Use, Prohibited Substances, and
# Date of Prohibition") — accept either separator. Reg 26's Part B engine
# tables (I.D.4./I.D.5./I.D.6.) are captioned bare, ALL-CAPS, with no
# separator or description at all ("TABLE 1" ... "TABLE 6", confirmed
# against pipeline/sources/REG_26.pdf pages 10-40 — pdfplumber's
# `extract_tables()` finds all six as normal bordered tables; only the
# caption-matching regex was too strict to recognize them as table starts).
# The table id itself can also be a single letter, not just a number ("Table
# A" / "Table B" under I.D.4.c., same bare-no-separator style) — confirmed
# same pages 13-16. The letter form must match the WHOLE line with nothing
# else on it (no optional separator/description branch, unlike the digit
# form): Reg 22's Subpart A text has in-sentence references like "Table A-5
# of Subpart A, 40 CFR 98.253" that would otherwise false-positive-match as
# a "Table A" caption (with "-5 of Subpart A..." misread as its
# description) and wrongly truncate that provision's real text.
TABLE_CAPTION_RE = re.compile(
    r"^(?:Table|TABLE)\s+(?:([0-9]+)\s*(?:[:–—-]\s*(.+))?|([A-Z]))$"
)


# Per-regulation EXTRA caption shapes, tried only after TABLE_CAPTION_RE
# fails and only for the reg named here — so no existing regulation's text
# can newly match (a false caption match is destructive: build_provisions
# cuts the row's remaining lines at the caption whether or not a table was
# recovered for it). Reg 8's Part D high-risk-pollutant list is captioned
# "Table 1.         LIST OF HIGH-RISK POLLUTANTS" (a period after the number,
# then a run of spaces — neither the colon/dash separator nor the bare
# ALL-CAPS "TABLE 1" form TABLE_CAPTION_RE knows). Confirmed against
# REG_8.pdf page 170: pdfplumber finds it as one normal 3-column bordered
# table (CAS No. / Chemical / Weighting Factor, 47 data rows) entirely on
# that page. Because pdftotext -layout and pdfplumber print the run of
# spaces differently, a caption matched through this map is keyed by its
# whitespace-normalized text (see `_table_caption_key`).
TABLE_CAPTION_EXTRA_RE: dict[str, re.Pattern] = {
    "8": re.compile(r"^Table\s+([0-9]+)\.\s+(\S.*)$"),
    # Reg 30's Part B chromium-plating section captions its one inline table
    # the same period-then-spaces way Reg 8 does — "Table 1. Approved
    # Chemical Fume Suppressants and Surface Tensions" (III.B.4.d., line 462)
    # — confirmed against REG_30.pdf page 9: pdfplumber's extract_tables()
    # finds it as one normal 4-column bordered table (chemical/manufacturer,
    # application, stalagmometer value, tensiometer value), caption included
    # as its own merged first row, entirely on that page.
    "30": re.compile(r"^Table\s+([0-9]+)\.\s+(\S.*)$"),
    # ECMC captions its tables "Table <rule>-<n>" (the rule number the table
    # lives in, then a per-rule sequence number) — "Table 423-1 – Maximum
    # Permissible Noise Levels", bare "Table 915-1" (a huge multi-page
    # groundwater/soil cleanup-standards table with no inline caption text,
    # continuation pages captioned "Table 915-1 (continued)"), and one
    # ALL-CAPS "TABLE 437-1. Chemical Additives..." form (period, no dash).
    # Confirmed against ECMC.pdf: pages that contain ANY of these caption
    # forms as their own line always contain the actual bordered table.
    "ecmc": re.compile(r"^(?:Table|TABLE)\s+([0-9]+-[0-9]+)\s*(?:\(continued\))?[.:]?\s*(?:[–—-]\s*)?(.*)$"),
    # Reg 9's Appendix B captions its two tables with a bare ROMAN numeral,
    # not the digit or single-letter forms TABLE_CAPTION_RE knows — "TABLE I
    # EXAMPLE BURNS               Estimated to Potentially Produce 10 Tons
    # of PM10 Emissions" and "TABLE II SOURCES OF INFORMATION/DATA USED IN
    # TABLE I" (confirmed: REG_9.pdf page 38-39, both recovered by
    # pdfplumber as ordinary bordered tables).
    "9": re.compile(r"^(?:Table|TABLE)\s+([IVXLCDM]+)\s+(\S.*)$"),
}

# Regulations whose APPENDIX rows may contain more than one captioned table
# with real narrative text between them (Reg 9's Appendix B: an intro
# paragraph, TABLE I, two worked "Example" paragraphs, then TABLE II) — see
# `_splice_appendix_tables`. A reg not listed here keeps the ordinary
# appendix build path (`split_into_paragraphs` over the raw own_lines)
# completely unchanged.
APPENDIX_TABLE_SPLICE_REGS: frozenset[str] = frozenset({"9"})

# Regulations whose ordinary ITEM rows (not just appendices) may embed one
# or more captioned tables with real narrative text AFTER (or between) them.
# The default item build path cuts the row's remaining lines at the FIRST
# caption line it meets (see the `cut_idx` loop in build_provisions) — fine
# when a table is the last thing in its item (every Reg 3/7/22/26 table, and
# Reg 27's own Part B Tables 1-5), but Reg 27's statement-of-basis entry IV
# (`sec-27-E-IV`, one undivided ~960-line row — see SOB_PART_CONFIG["27"])
# prints its facility list "TABLE 1" (page 56) and "TABLE 2" (page 58) with
# ~90 and ~700 lines of narrative after each: the cut silently dropped
# everything from "TABLE 1" to the end of the entry (6,700 words — found by
# the coverage gate B). For a reg listed here the item path instead runs
# `_splice_appendix_tables` in `strict` mode (see that function): every
# caption block is swapped in place for its recovered table and the prose
# around it is kept. A reg not listed keeps the cut-at-first-caption path
# byte-for-byte (the splice never runs for it).
#
# Reg 25 (Batch 5 too) has the other shape: its I.P.4.d. carries Table 3 AND
# Table 4 back-to-back (pages 60-61), and Table 1 (I.L.2.b.(ii)), Table 2
# (I.L.2.b.(iii)) and Table 5 (I.Q.3.a.(ii)) each span 2-4 pages with the
# caption reprinted at the top of every page. The cut rule dropped Table 4
# and the text after it outright; for Reg 25 the item branch splices each
# table in place in `merge_continuations` mode (a reprinted caption is
# treated as a continuation of the table just spliced rather than a second
# copy of it). ITEM_TABLE_SPLICE_MODE names the `_splice_appendix_tables`
# mode each listed reg runs; the two modes are independent keyword paths
# inside that function and each reg keeps exactly the behaviour its own
# tests pin. Every other reg keeps the cut rule (the splice never runs).
#
# Reg 21 (Batch 6) has the Reg 25 shape: its Part A "Table 1 – VOC content
# limits for consumer products" (II.O., pages 6-15) and Part B "Table 1 – VOC
# content limits for architectural and industrial maintenance coatings"
# (II.F., pages 47-49) each span several pages with the caption reprinted at
# the top of every page, and Part B's table is followed by its "* Limits are
# expressed as VOC content..." footnote paragraph, which the cut rule dropped
# outright. Same `merge_continuations` mode as Reg 25 (see TABLE_CAPTION_SPANS
# for how the two tables' pages are assembled).
ITEM_TABLE_SPLICE_MODE: dict[str, str] = {"25": "merge_continuations", "27": "strict",
                                          "21": "merge_continuations"}
ITEM_TABLE_SPLICE_REGS: frozenset[str] = frozenset(ITEM_TABLE_SPLICE_MODE)

# Captioned tables that the per-page walk in `extract_tables_from_pdf` cannot
# attach to the right caption because MORE THAN ONE captioned table sits on
# the same PDF page (the walk keeps the page's FIRST caption and hands it
# the page's first table; every later caption on that page is never seen).
# Reg 27's Part B prints "Table 2", "Table 3" and "Table 4" — three
# identical-shaped Year / GEMM 2 Annual GHG Emissions Requirement tables —
# on page 11 (confirmed: pdfplumber returns exactly three tables on that
# page, in caption order), so without this "Table 3"/"Table 4" were never
# recovered and, because the item path cuts at the caption regardless, their
# rows (`sec-27-B-I-A-3` / `-4`) lost the table text entirely. Each entry
# pins one caption (its `_table_caption_key` form) to a (1-based page,
# 0-based table index) — the same explicit pinning `UNCAPTIONED_TABLES` and
# `_fix_reg9_appendix_tables` use. Applied after the walk, so a pinned
# caption the walk DID find is simply re-pulled from the pinned location.
# A reg with no entry here is untouched.
TABLE_CAPTION_PINS: dict[str, list[tuple[str, int, int]]] = {
    "27": [("Table 2", 11, 0), ("Table 3", 11, 1), ("Table 4", 11, 2)],
}

# Captioned tables that span SEVERAL pages with a MULTI-ROW header block (or
# a multi-line caption cell) reprinted on every page — the generic per-page
# walk in `extract_tables_from_pdf` drops only a single repeated header ROW
# on a continuation page (Reg 22's Table 1 shape) and drops the merged
# caption row only when the cell text EQUALS the caption line. Reg 21's two
# tables break both assumptions (confirmed with pdfplumber against
# REG_21.pdf): Part A's "Table 1 – VOC content limits for consumer products"
# (pages 6-15, ten pages) reprints a caption row plus a TWO-row header
# ("" / "Manufactured on or after May 1, 2020" / "Manufactured on or after
# 60 days after the effective date of a finding by EPA ..." then "Product
# category" / "VOC content limit (percent VOCs by weight)") on every page, so
# the walk left nine stray "Product category" rows mid-table; Part B's
# "Table 1 – VOC content limits for architectural and industrial maintenance
# coatings" (pages 47-49) prints its caption on TWO lines ("...coatings\n
# manufactured on or after May 1, 2020") inside one merged cell, which never
# equals the one-line caption key pdftotext prints, so the caption cell
# survived as the rendered header row. Each entry here pins one caption (its
# `_table_caption_key` form — the FIRST printed caption line, which is what
# build_provisions looks up) to the ordered list of (1-based page, 0-based
# table index) it spans; the pages' rows are concatenated in order, a leading
# row whose first cell STARTS WITH the caption (newlines folded to spaces) is
# dropped as the printed caption, and a continuation page's leading rows are
# dropped while they equal the table's own leading rows (the reprinted header
# block — `_drop_repeated_leading_rows`, exactly as UNCAPTIONED_TABLES'
# `spans` does). Applied after the walk, REPLACING whatever the walk
# assembled for that caption. A reg with no entry here is untouched.
TABLE_CAPTION_SPANS: dict[str, list[dict]] = {
    "21": [
        dict(caption="Table 1 – VOC content limits for consumer products",
             spans=[(p, 0) for p in range(6, 16)]),
        # `display_caption` (optional): the rendered doc-table-caption text
        # when the printed caption wraps onto a second line that the lookup
        # key (the first line only) would otherwise drop — here the
        # qualifying "manufactured on or after May 1, 2020".
        dict(caption="Table 1 – VOC content limits for architectural and industrial maintenance coatings",
             display_caption="Table 1 – VOC content limits for architectural and industrial maintenance "
                             "coatings manufactured on or after May 1, 2020",
             spans=[(47, 0), (48, 0), (49, 0)]),
    ],
}

# Regulations whose APPENDIX heading-continuation text (see `title_end_line`
# on an "appendix" marker) must NOT also be re-included as the row's own
# first body paragraph. This is gated per-reg, not applied everywhere,
# because Reg 1's OWN two appendices (APPENDIX A / APPENDIX B, each a
# two-physical-line heading) already duplicate their title this exact way in
# the baselined DB/output (`sec-1-APPENDIX-A` currently reads "...Emission
# Sources<p>Method for Measuring Opacity from Fugitive Particulate Emission
# Sources</p><p>a. Principle...") — fixing it there would change Reg 1's
# required byte-identical baseline, so it's left exactly as before there and
# fixed only for the new regulation that exposed it (see the batch-3 brief's
# "existing behaviour must not change" rule); it is not a Reg-9-specific
# BUG, just a Reg-9-specific FIX, in case a later batch wants to extend it.
# Reg 30's Appendix B has the same wrapped-title-onto-a-second-physical-line
# shape as Reg 9's ("Appendix B: Chronic Health-Protective Benchmarks for
# Priority Toxic Air\nContaminants" — without this, "Contaminants" reappeared
# as a stray first paragraph), so it needs the same fix.
# Reg 11's Appendix B heading wraps the same way ("APPENDIX B        Standards
# and Specifications for Calibration/Span Gas\nSuppliers [Repealed eff.
# 11/30/2014]" — without this, "Suppliers [Repealed eff. 11/30/2014]" reappeared
# as the row's first paragraph); Appendix A's heading is one line, unaffected.
# Reg 25's Appendix D ("Minimum Cooling Capacities for Refrigerated Freeboard
# Chillers on\nVapor Degreasers", line 5558) wraps the same way — without
# this, "Vapor Degreasers" reappeared as a stray first paragraph.
# Reg 19's Appendix A takes its title from the line after the one blank
# under the centred "APPENDIX A" line (REG_META `centered_appendix_headings`,
# line 3127 of REG_19.txt) — without this, "Number of Units to be Tested in
# Pre-1978 Multifamily Developments" reappeared as the row's first paragraph.
# Reg 4's Appendix A takes its title the same way, from the line after the
# one blank under the flush-left "APPENDIX A" line (REG_META
# `appendix_title_after_blank`, REG_4.txt line 1038) — without this, "Test
# Method Protocols for Measuring Wood-Burning Masonry Heater Emissions"
# reappeared as the appendix row's first paragraph.
APPENDIX_HEADING_DEDUP_REGS: frozenset[str] = frozenset({"9", "30", "11", "25", "19", "4"})


def _splice_appendix_tables(own_lines: list[str], reg: str, tables_by_caption: dict[str, dict],
                             table_hits: dict, merge_continuations: bool = False,
                             strict: bool = False,
                             seam_starts: set[int] | None = None) -> list[str]:
    """Replace every recognized "Table N ..." caption block inside an
    APPENDIX row's own lines with a `_TABLE_SENTINEL` placeholder for the
    pdfplumber-recovered table (rendered in place by build_provisions's
    second pass — the same sentinel convention `UNCAPTIONED_TABLES` uses),
    leaving any prose before/after each table untouched. This generalizes
    the single-table cut already used for an ordinary item/entry row (see
    the `mk.get("table_caption")` branch below) to run more than once per
    row, since an ordinary item never embeds more than one table but Reg 9's
    Appendix B embeds two with narrative in between.

    `strict` (only ever passed True from the ITEM_TABLE_SPLICE_REGS path —
    the Reg 9 appendix call is unchanged) tightens the end-of-table search
    for a table followed by a long run of prose: (1) a row key is the FIRST
    physical line of the cell (pdfplumber returns a wrapped first-column
    cell as "At least 20% but\nless than 30%", which no single pdftotext
    line can ever start with — Reg 27's Table 5 and its SOB "TABLE 1"/
    "TABLE 2" headers all wrap this way), and (2) once a key row has been
    seen, the first non-blank line that neither starts with a key nor
    continues a key row's own non-blank run ENDS the table, instead of the
    scan running on to the next caption (or the end of the row) looking for
    a later key match — which, over the ~700 lines of narrative that follow
    Reg 27's SOB "TABLE 2", would have swallowed prose up to any wrapped
    line that happened to start with a facility name. `seam_starts` (indices
    into `own_lines` that begin a new PDF page — clean_pages strips the page
    furniture WITHOUT leaving a blank line, so the first prose line of the
    next page is chained directly onto the table's last row) bounds a key
    row's continuation run: a page seam is always a paragraph boundary
    (confirmed: without it, the paragraph following Reg 27's SOB "TABLE 1"
    and "TABLE 2", each printed as the last thing on its page, was
    swallowed as a wrapped cell of the "Yuma Ethanol" row)."""
    out: list[str] = []
    i, n = 0, len(own_lines)
    last_key: str | None = None
    while i < n:
        ln = own_lines[i]
        caption_key = _table_caption_key(ln, reg)
        table = tables_by_caption.get(caption_key) if caption_key else None
        if not table:
            out.append(ln)
            i += 1
            continue
        if strict:
            keys = sorted({(r[0] or "").strip().split("\n")[0] for r in table["rows"]
                           if r and (r[0] or "").strip()})
            j = i + 1
            last_row = i
            seen_key = False
            while j < n:
                if _table_caption_key(own_lines[j], reg):
                    break
                stripped_j = own_lines[j].strip()
                if stripped_j == "":
                    j += 1
                    continue
                if any(stripped_j.startswith(k) for k in keys):
                    last_row = j
                    seen_key = True
                    k = j + 1
                    while (k < n and own_lines[k].strip() != "" and not _table_caption_key(own_lines[k], reg)
                           and not (seam_starts and k in seam_starts)):
                        last_row = k
                        k += 1
                    j = k
                    continue
                if seen_key:
                    break
                j += 1  # a header line printed before the first key row
            out.extend(["", _TABLE_SENTINEL + caption_key, ""])
            table_hits["used"] += 1
            table_hits["captions_used"].append(caption_key)
            i = last_row + 1
            continue
        continuation = merge_continuations and caption_key == last_key
        last_key = caption_key
        # Matched by STARTSWITH, not the line's first whitespace-split token:
        # a multi-word row key ("Piled Slash", "Oakbrush or Aspen") never
        # equals its own first token alone, so a single-token comparison
        # (as the flat-entry table cut uses, where every key IS one token)
        # would stop one row short and leave that last data row as a
        # dangling paragraph fragment (confirmed: Reg 9's Appendix B "TABLE
        # I", whose last row is "Piled Slash").
        keys = sorted((r[0] or "").strip() for r in table["rows"] if r and (r[0] or "").strip())
        if merge_continuations:
            # A first-column cell that wraps ("Drum coating, reconditioned,\n
            # exterior", "Motor vehicle\nlubricating\nwax/compound") only
            # ever starts a pdftotext line with its FIRST physical line; the
            # wrapped-cell loop below then consumes the rest of the row.
            keys = sorted({k.split("\n", 1)[0].strip() for k in keys})
        j = i + 1
        last_row = i
        while j < n:
            if _table_caption_key(own_lines[j], reg):
                break
            stripped_j = own_lines[j].strip()
            if any(stripped_j.startswith(k) for k in keys):
                last_row = j
            j += 1
        # A cell that wraps onto more than one physical line (Reg 9's Table
        # II last row, "Piled Slash", wraps its Reference cells across 3
        # lines) leaves its OWN continuation lines unmatched by the
        # startswith check above, since only the row's first physical line
        # begins with the row key — consume forward through the immediately
        # following non-blank lines too (the raw table dump is always one
        # blank-delimited block; nothing legitimate continues right after
        # the last data row with no blank line first).
        k = last_row + 1
        while k < n and own_lines[k].strip() != "":
            if merge_continuations and _table_caption_key(own_lines[k], reg):
                # A reprinted caption printed right under the page's last
                # data row (Reg 25's Table 1, page 39 -> 40) is the next
                # page's continuation, never a wrapped cell.
                break
            last_row = k
            k += 1
        # Blank lines around the sentinel keep `split_into_paragraphs` from
        # fusing it with the prose immediately before/after the table (the
        # same convention `UNCAPTIONED_TABLES`' own sentinel insertion uses).
        # A reprinted caption (ITEM_TABLE_SPLICE_REGS) only consumes its
        # page's rows — the table was already spliced at its first caption.
        if not continuation:
            out.extend(["", _TABLE_SENTINEL + caption_key, ""])
            table_hits["used"] += 1
            table_hits["captions_used"].append(caption_key)
        i = last_row + 1
    return out


# UNCAPTIONED bordered tables, per regulation. Reg 8's Part B prints its
# certification-fee, refresher-course-length, permit-fee and clearance-
# sample tables as real bordered tables in the PDF (pdfplumber recovers every
# cell cleanly — confirmed pages 33-36, 55 and 66 of REG_8.pdf) but with NO
# "Table N" caption line at all, so the caption-driven mechanism above never
# sees them and pdftotext -layout's column dump is flattened into one run-on
# paragraph (the 5-column clearance-sample matrix in III.P.3.a.(ii) becomes
# "... Work Project Work Area Project ACM is: area Less than 3 square feet/3
# 1 5 5 5 linear feet From 3 square ..." — unreadable). Each entry pins ONE
# table to ONE provision: `row_id` is the provision it belongs to, `page` /
# `table_index` locate it in the PDF (1-based page, 0-based table on that
# page), `start_prefix` is the stripped text of the first pdftotext line of
# the flattened dump inside that provision, and the dump is taken to run to
# the next blank line (every one of these is printed as a single blank-
# delimited block). The block is replaced IN PLACE (a sentinel paragraph,
# see _TABLE_SENTINEL, is swapped for the rendered table in the second pass
# of build_provisions), so paragraphs that follow the table inside the same
# provision keep their printed order. `caption` is the rendered
# doc-table-caption text — descriptive, since the source prints none. A reg
# with no entry here is untouched.
UNCAPTIONED_TABLES: dict[str, list[dict]] = {
    "8": [
        dict(row_id="sec-8-B-II-B-2", page=33, table_index=0, start_prefix="Amount",
             caption="General Abatement Contractor certification fees"),
        dict(row_id="sec-8-B-II-C-2", page=34, table_index=0, start_prefix="Amount",
             caption="Worker, Supervisor, Building Inspector, Management Planner and Project Designer certification fees"),
        dict(row_id="sec-8-B-II-C-5-b", page=35, table_index=0, start_prefix="Certification",
             caption="Length of annual refresher courses"),
        dict(row_id="sec-8-B-II-C-6", page=35, table_index=1, start_prefix="Amount",
             caption="Combined certificate fees"),
        dict(row_id="sec-8-B-II-D-2", page=36, table_index=0, start_prefix="Amount",
             caption="Air Monitoring Specialist certification fees"),
        dict(row_id="sec-8-B-III-G-1-c", page=55, table_index=0, start_prefix="Permit Fee for Projects",
             caption="Permit Fee for Projects"),
        dict(row_id="sec-8-B-III-P-3-a-(ii)", page=66, table_index=0, start_prefix="State-Permitted Project in",
             caption="Minimum number of clearance air samples"),
    ],
    # Reg 30's own Appendix A (Priority Toxic Air Contaminants — a 3-column
    # CAS Number / chemical / date-identified list) and Appendix B (Chronic
    # Health-Protective Benchmarks — a multi-row-header CAS/chemical/cancer
    # value/source/year/non-cancer value/source/year table) are printed with
    # NO "Table N" caption line at all (see APPENDICES_BY_PART in
    # REG_30.txt): the caption-driven mechanism never sees them, and
    # pdftotext -layout's column dump is flattened into unreadable prose the
    # same way Reg 8's uncaptioned tables were. Both recover cleanly as one
    # normal pdfplumber bordered table (confirmed REG_30.pdf pages 71 and 83
    # — Appendix B's table has several visually-merged header rows, which
    # pdfplumber returns as `None` cells in the header row; render_table_html
    # renders them as empty `<th>` cells, matching what's actually on the
    # page). `to_end: True` (see UNCAPTIONED_TABLES' consumer below): unlike
    # Reg 8's tables, the pdftotext flattened dump for each of these has
    # blank lines INSIDE it (every wrapped table cell that pdftotext prints
    # on its own line is followed by pdftotext's usual paragraph-gap blank),
    # so "run to the next blank line" would stop after the first row and
    # leave the rest of the table as unreplaced prose — instead the
    # replacement runs from `start_prefix`'s line to the END of the
    # provision's own lines, which is exactly the whole table in both cases
    # (Appendix A's table is the entirety of its content after the "Appendix
    # A: ..." heading; the same is true for Appendix B after its "Table
    # Notes:" 1-3 paragraphs, which are collected as ordinary body text
    # before the replaced block, same as Reg 8's post-table footnotes).
    "30": [
        dict(row_id="sec-30-C-APPENDIX-A", page=71, table_index=0, start_prefix="CAS Number",
             caption="Priority Toxic Air Contaminants", to_end=True),
        dict(row_id="sec-30-C-APPENDIX-B", page=83, table_index=0,
             start_prefix="Proposed Chronic Health-Protective Benchmarks",
             caption="Chronic Health-Protective Benchmarks for Priority Toxic Air Contaminants", to_end=True),
    ],
    # Reg 25 (surface coating RACT) prints most of its emission limits as
    # small UNCAPTIONED bordered tables — one "Kg/lc | Lb/gc" table under
    # each Part B, Section I "Emission Limitations" item (I.B.3. automobile
    # assembly, I.C.3. can, I.D.3. coil, I.E.3. fabric, I.F.3. large
    # appliance, I.G.3. magnet wire, I.H.3. metal furniture, I.I.3. paper,
    # I.J.3. plastic film, I.K.3. vinyl — REG_25.pdf pages 27-33), the
    # condenser outlet temperature table of V.B.1. (page 114), Appendix D's
    # refrigerated-chiller capacities (page 117), Appendix E's two-page
    # "Equivalency Data" table (pages 118-119) and Part C entry I's
    # eleven-page rule-history tracking table (pages 121-131). Every one
    # recovers cleanly with pdfplumber (all cells confirmed against the
    # pdftotext dump). Three keys are new here and a no-op for every entry
    # that doesn't set them (Reg 8/30 above are untouched):
    #   spans: [(page, table_index), ...] — the SAME table continued across
    #     several pages (each page reprints the header block); the pages'
    #     rows are concatenated in order and a continuation page's leading
    #     rows are dropped while they equal the first page's leading rows
    #     (the reprinted header block — several rows, not just one, since
    #     these headers are multi-row), the same idea `extract_tables_from_pdf`
    #     applies to a repeated CAPTIONED table (Reg 22's Table 1).
    #   stop_prefix: the replaced block ends just BEFORE the first later line
    #     whose stripped text starts with this (Appendix D's "* Kilocalories"
    #     footnote and the tracking table's closing "The Commission also
    #     made typographical..." paragraph are printed with no blank line
    #     after the last table row, so neither "to the next blank line" nor
    #     `to_end` fits).
    #   header_rows: the first N recovered rows are one visually-merged header
    #     (pdfplumber returns the wrapped header text as N rows with `None`
    #     cells); they are joined column-wise into ONE header row. Combined
    #     with `compact` (drop every empty cell from every row — Appendix E's
    #     8-column grid carries only 4 real columns, the rest are `None`
    #     spacers of the merged cells; a category sub-heading such as "Can
    #     Industry" becomes a one-cell row, as printed), the table renders
    #     as the 4-column table the PDF shows.
    "25": [
        dict(row_id="sec-25-B-I-B-3", page=27, table_index=0, start_prefix="Kg/lc",
             caption="Automobile and light-duty truck assembly plant emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-C-3", page=29, table_index=0, start_prefix="Can Coating",
             caption="Can coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-D-3", page=29, table_index=1, start_prefix="Coil Coating",
             caption="Coil coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-E-3", page=30, table_index=0, start_prefix="Kg/lc",
             caption="Fabric coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-F-3", page=30, table_index=1, start_prefix="Kg/lc",
             caption="Large appliance coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-G-3", page=31, table_index=0, start_prefix="Kg/lc",
             caption="Magnet wire coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-H-3", page=31, table_index=1, start_prefix="Kg/lc",
             caption="Metal furniture coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-I-3", page=32, table_index=0, start_prefix="Kg/lc",
             caption="Paper coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-J-3", page=32, table_index=1, start_prefix="Kg/lc",
             caption="Plastic-film coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-I-K-3", page=33, table_index=0, start_prefix="Kg/lc",
             caption="Vinyl coating emission limitations", to_end=True),
        dict(row_id="sec-25-B-V-B-1", page=114, table_index=0,
             start_prefix="VOCs True Vapor Pressure",
             caption="Maximum condenser outlet gas temperature by VOC true vapor pressure",
             stop_prefix="*The calculation methods"),
        dict(row_id="sec-25-B-APPENDIX-D", page=117, table_index=0, start_prefix="DEGREASER WIDTH",
             caption="Minimum cooling capacities for refrigerated freeboard chillers",
             stop_prefix="* Kilocalories"),
        dict(row_id="sec-25-B-APPENDIX-E", page=118, table_index=0,
             spans=[(118, 0), (119, 0)], header_rows=3, compact=True,
             start_prefix="Equivalency Data for Surface Coating Processes",
             caption="Equivalency Data for Surface Coating Processes (VOC Density = 7.36 lb/gal)", to_end=True),
        dict(row_id="sec-25-C-I", page=121, table_index=0,
             spans=[(p, 0) for p in range(121, 132)],
             start_prefix="Year of",
             caption="Regulation 7 rule-history tracking table",
             stop_prefix="The Commission also made typographical"),
    ],
    # Reg 27's statement-of-basis entry IV (October 20, 2023; one undivided
    # row `sec-27-E-IV`, see SOB_PART_CONFIG["27"]) prints the six-step
    # combined-heat-and-power displaced-emissions formula as an uncaptioned
    # bordered table (REG_27.pdf page 63: Step / description / symbol /
    # formula-with-definitions, 6 rows, pdfplumber recovers every cell
    # cleanly, subscripts included — "DT = CT / TP x TE"). pdftotext's
    # column dump of it is unreadable ("DT = C T / T P x T E", the formula
    # column printed above and below its own "Step n:" line) and has blank
    # lines between steps, while ~330 lines of narrative follow it in the
    # same row — hence `end_prefix` (see _swap_uncaptioned_table) rather
    # than `to_end`. The dump's first physical line is the Step 1 formula
    # "DE = (CP + GL) x GE" (line 3787 of REG_27.txt), its last "AT = Total
    # avoided emissions" (line 3823).
    "27": [
        dict(row_id="sec-27-E-IV", page=63, table_index=0,
             start_prefix="DE = (CP + GL) x GE", end_prefix="AT = Total avoided emissions",
             caption="Combined heat and power displaced-emissions calculation (six steps)"),
    ],
    # Air Quality Standards (key "aqs"): Section III's classification list —
    # Area / Classification / Boundary, with "PM10" and "Ozone" group rows —
    # is one bordered table printed right after the "III.A. through III.E.
    # Repealed" line (REG_AQS.pdf pages 3-4; the page-4 continuation
    # reprints the header row, dropped by `spans`). pdftotext flattens it
    # into "Denver Metro Attainment/ All of Denver, Jefferson, and Douglas
    # Counties; (effective Maintenance Boulder County ...". The flattened
    # dump runs from the "Area" header line to the "* The classification of
    # the Denver Metro Area..." footnote, which is printed with no blank
    # line after the last row (hence `stop_prefix`) and stays as the row's
    # closing paragraph.
    "aqs": [
        dict(row_id="sec-aqs-III-A", page=3, table_index=0, spans=[(3, 0), (4, 0)],
             start_prefix="Area", stop_prefix="* The classification of the Denver Metro Area",
             caption="Classification of Nonattainment and Attainment/Maintenance Areas in Colorado"),
    ],
    # Reg 23's Section IV prints every regional-haze determination as a
    # bordered, UNCAPTIONED-in-the-"Table N"-sense table: the heading line
    # above each one ("BART Determinations for Colorado Sources", "RP
    # Determinations for Colorado Sources", "BART Alternative Program
    # Determinations for PSCo Sources", "RP Determinations for Colorado
    # Sources**") is not a "Table N" caption, so TABLE_CAPTION_RE never sees
    # it, and pdftotext -layout's column dump flattened all of them into
    # unreadable prose that scrambled limits across units ("Craig Unit 1 *
    # 0.11 lb/MMBtu 0.03 lb/MMBtu (30-day rolling average) Craig Unit 2 0.08
    # lb/MMBtu ..." — the 10,093-character IV.F.3 row was the worst). Every
    # one recovers cleanly with pdfplumber (REG_23.pdf pages 7-17 and 26,
    # all cells confirmed against the pdftotext dump); the `None` spacer
    # columns pdfplumber returns for the merged cells are removed by
    # `compact`, leaving the 4 (or 2) columns the page actually shows.
    #
    # `drop_caption_row` + `printed_caption` (new, see
    # extract_tables_from_pdf) strip the printed heading, which pdfplumber
    # returns as the table's own merged first row with an EMPTY first cell.
    #
    # A table that continues onto the next page reprints the same heading,
    # and on pages 7/8, 9 and 12/13 a FOOTNOTE is printed between the two
    # segments ("*Refer to Section IV.D. for requirements", "*Refer to
    # Section IV.E. for requirements", the superscript "Refer to Section
    # IV.F.6/IV.F.7 for applicable means of compliance..." notes). Folding
    # those pages into one `spans` entry would swallow the footnote text
    # inside the replaced block and lose it, so each segment is pinned
    # separately, in printed order, and the footnotes stay as the row's own
    # paragraphs exactly where the PDF prints them. The continuation
    # segments carry "(continued)" in their rendered caption (the dict is
    # keyed on `caption`, so two segments of one printed table need two
    # distinct captions) with `printed_caption` naming the text as printed.
    #
    # Block extents: pages 7 and 26 print their dump with no internal blank
    # line, so the default "to the next blank line" is right; pages 8, 9's
    # second table and 11 end their row's own lines, so `to_end`; pages 9's
    # first table, 10 and 14-17 are followed by footnote paragraphs, so
    # `stop_prefix`; pages 12 and 13 are followed by the superscript
    # footnotes and then MORE table, so `end_prefix` on each page's last
    # printed row.
    "23": [
        dict(row_id="sec-23-A-IV-A-2", page=7, table_index=0, compact="align",
             drop_caption_row=True,
             start_prefix="BART Determinations for Colorado Sources",
             caption="BART Determinations for Colorado Sources"),
        dict(row_id="sec-23-A-IV-A-2", page=8, table_index=0, compact="align",
             drop_caption_row=True, to_end=True,
             printed_caption="BART Determinations for Colorado Sources",
             start_prefix="BART Determinations for Colorado Sources",
             caption="BART Determinations for Colorado Sources (continued)"),
        dict(row_id="sec-23-A-IV-B-2", page=9, table_index=0, compact="align",
             drop_caption_row=True, stop_prefix="*Refer to Section IV.E.",
             start_prefix="RP Determinations for Colorado Sources",
             caption="RP Determinations for Colorado Sources"),
        dict(row_id="sec-23-A-IV-B-2", page=9, table_index=1, compact="align",
             drop_caption_row=True, to_end=True,
             printed_caption="RP Determinations for Colorado Sources",
             start_prefix="RP Determinations for Colorado Sources",
             caption="RP Determinations for Colorado Sources (continued)"),
        dict(row_id="sec-23-A-IV-C-2", page=10, table_index=0, compact="align",
             drop_caption_row=True, stop_prefix="* 500 tpy NOx",
             start_prefix="BART Alternative Program Determinations for PSCo Sources",
             caption="BART Alternative Program Determinations for PSCo Sources"),
        dict(row_id="sec-23-A-IV-F-1-d-(i)", page=11, table_index=0, compact="align",
             to_end=True, start_prefix="NOx Emission Limit",
             caption="Comanche Unit 2 emission rates from the closure of Comanche Unit 1 until the closure of Comanche Unit 2"),
        dict(row_id="sec-23-A-IV-F-3", page=12, table_index=0, compact="align",
             drop_caption_row=True, end_prefix="Cherokee",
             start_prefix="RP Determinations for Colorado Sources**",
             caption="RP Determinations for Colorado Sources**",
             cell_fixes=[
                 ("@ 15% O\n2\n(4-hour", "@ 15% O2\n(4-hour"),
                 ("5,000 ppmv HS in digester\n2\ngas", "5,000 ppmv H2S in digester gas"),
             ]),
        dict(row_id="sec-23-A-IV-F-3", page=13, table_index=0, compact="align",
             drop_caption_row=True, end_prefix="Feeders) – 0.019 lb/ton of",
             printed_caption="RP Determinations for Colorado Sources**",
             start_prefix="RP Determinations for Colorado Sources**",
             caption="RP Determinations for Colorado Sources** (continued)",
             cell_fixes=[
                 ("@ 15% O (1-hr\n2\naverage)", "@ 15% O2 (1-hr average)"),
                 ("@ 15% O and 186\n2\nlb/hr", "@ 15% O2 and 186 lb/hr"),
                 ("@ 15% O and 140\n2\nlb/hr", "@ 15% O2 and 140 lb/hr"),
                 ("@ 15% O low load\n2\noperation", "@ 15% O2 low load operation"),
             ]),
        dict(row_id="sec-23-A-IV-F-3", page=14, table_index=0, compact="align",
             spans=[(14, 0), (15, 0), (16, 0), (17, 0)],
             drop_caption_row=True, stop_prefix="**Referenced Federal Regulations",
             printed_caption="RP Determinations for Colorado Sources**",
             start_prefix="RP Determinations for Colorado Sources**",
             caption="RP Determinations for Colorado Sources** (continued 2)"),
        dict(row_id="sec-23-A-V-A-2-e-(i)", page=26, table_index=0, compact="align",
             start_prefix="Process Heater",
             caption="Suncor Refinery process heater NOx emission factors"),
    ],
    # Reg 20's Part H incorporation-by-reference table (see
    # FLAT_ENTRY_PART_CONFIG["20"]): "Table 1. Code of California
    # Regulations, Title 13. Motor Vehicle, Division 3. Air Resource Board"
    # — Section / Title / Section Amended Date, bordered, REG_20.pdf pages
    # 28-33, one table per page (index 0), the 3-cell column-header row
    # reprinted at the top of every page (dropped by `spans`' repeated-
    # leading-rows rule), the caption printed ONCE (page 28) as a text line
    # above the table, not inside it. Chapter/Article group headings are
    # merged rows (first cell text, `None` in the other two — rendered as
    # printed). The pdftotext dump runs from the "Section  Title  Section
    # Amended Date" header line to just before the closing "Regulation
    # Number 20 does not include any later amendments..." paragraph, with
    # blank lines inside it (wrapped title cells) — hence `stop_prefix`.
    # Confirmed cell-by-cell against the dump: 6 pages, 107 rows incl. the
    # header, first data row "1900 / Definitions / November 30, 2022", last
    # "2222 (h) and (i) / Add-On Parts and Modified Parts / October 1, 2021".
    "20": [
        dict(row_id="sec-20-H-TABLE-1", page=28, table_index=0,
             spans=[(p, 0) for p in range(28, 34)],
             start_prefix="Section",
             caption="Table 1. Code of California Regulations, Title 13. Motor Vehicle, Division 3. Air Resource Board",
             stop_prefix="Regulation Number 20 does not include any later amendments"),
    ],
}
_TABLE_SENTINEL = "\x00TABLE:"
_FIGURE_SENTINEL = "\x00FIGURE:"

# Images printed inside an APPENDIX row, per regulation. Reg 25's Appendix A
# ("Colorado Ozone Nonattainment or Attainment Maintenance Areas") ends with
# "II. Maps": two full-page map images (REG_25.pdf pages 15 and 16), each
# with only its title line in the text layer. pdftotext carries nothing of
# the image, so — the same convention import_ecfr.py uses for an eCFR
# figure — a `<p class="figure-omitted">` placeholder is rendered directly
# after the paragraph that equals `after` (whitespace-normalized), naming the
# PDF page the map is on. `APPENDIX_SEAM_BREAK_REGS` lists the regs whose
# appendix rows treat a page seam as a paragraph break, so "II. Maps" and
# each map title (each printed alone on its own page, see clean_pages) come
# out as their own paragraphs instead of being fused onto the previous
# page's last line as Reg 7/26's byte-identical Appendix A rows have them.
# Both are keyed by reg and a no-op for every other regulation.
APPENDIX_SEAM_BREAK_REGS: frozenset[str] = frozenset({"25"})
APPENDIX_FIGURES: dict[str, dict[str, list[dict]]] = {
    "25": {
        "sec-25-A-APPENDIX-A": [
            dict(after="Denver Metropolitan Area and North Front Range (2008 Ozone NAAQS)",
                 note="Map not reproduced — see REG_25.pdf page 15: Denver Metropolitan Area and "
                      "North Front Range (2008 Ozone NAAQS)"),
            dict(after="Denver Metropolitan Area and North Front Range and northern Weld County (2015 ozone NAAQS)",
                 note="Map not reproduced — see REG_25.pdf page 16: Denver Metropolitan Area and "
                      "North Front Range and northern Weld County (2015 ozone NAAQS)"),
        ],
    },
}


def _insert_figure_placeholders(paras: list[str], reg: str, row_id: str) -> list[str]:
    """Appends a `_FIGURE_SENTINEL` paragraph after each configured
    APPENDIX_FIGURES paragraph of `row_id`; unchanged for every other row."""
    figs = APPENDIX_FIGURES.get(reg, {}).get(row_id)
    if not figs:
        return paras
    out: list[str] = []
    for p in paras:
        out.append(p)
        norm = re.sub(r"\s+", " ", p).strip()
        for fig in figs:
            if norm == fig["after"]:
                out.append(_FIGURE_SENTINEL + fig["note"])
    return out


def _figure_placeholder_html(note: str) -> str:
    return f'<p class="figure-omitted">[{escape_html_text(note)}]</p>'


# Images printed inside an ORDINARY item/section row, per regulation — the
# same `<p class="figure-omitted">` placeholder APPENDIX_FIGURES renders,
# but appended to the END of the row's own text (these rows carry nothing
# but the heading: each of Air Quality Standards' nine area maps, REG_AQS.pdf
# pages 5-13, is a full-page image under a one-line "III.F. Denver PM10 and
# 1-Hour Ozone Attainment/Maintenance Area" .. "III.N. ..." heading, and the
# Section III classification table's Boundary column says "See attached
# map." for each — confirmed: pdfplumber reports exactly one image on each
# of those nine pages and no other page). {reg: {row_id: [note, ...]}}; a
# reg or row with no entry is untouched (`_item_figures_html` returns "").
ITEM_FIGURES: dict[str, dict[str, list[str]]] = {
    "aqs": {
        "sec-aqs-III-F": ["Map not reproduced — see REG_AQS.pdf page 5: Denver PM10 and 1-Hour Ozone "
                          "Attainment/Maintenance Area"],
        "sec-aqs-III-G": ["Map not reproduced — see REG_AQS.pdf page 6: Steamboat Springs "
                          "Attainment/Maintenance Area for PM10"],
        "sec-aqs-III-H": ["Map not reproduced — see REG_AQS.pdf page 7: Pagosa Springs "
                          "Attainment/Maintenance Area for PM10"],
        "sec-aqs-III-I": ["Map not reproduced — see REG_AQS.pdf page 8: Telluride/Mt. Village/San Miguel "
                          "County Attainment/Maintenance Area for PM10"],
        "sec-aqs-III-J": ["Map not reproduced — see REG_AQS.pdf page 9: Aspen/Pitkin County "
                          "Attainment/Maintenance Area for PM10"],
        "sec-aqs-III-K": ["Map not reproduced — see REG_AQS.pdf page 10: Cañon City/Fremont County "
                          "Attainment/Maintenance Area for PM10"],
        "sec-aqs-III-L": ["Map not reproduced — see REG_AQS.pdf page 11: Lamar Attainment/Maintenance "
                          "Area for PM10"],
        "sec-aqs-III-M": ["Map not reproduced — see REG_AQS.pdf page 12: Denver Metro Area/North Front "
                          "Range 8-Hour Ozone Nonattainment Area, 2008 Ozone National Ambient Air Quality "
                          "Standard"],
        "sec-aqs-III-N": ["Map not reproduced — see REG_AQS.pdf page 13: Denver Metro Area/North Front "
                          "Range and northern Weld County 8-Hour Ozone Nonattainment Area, 2015 Ozone "
                          "National Ambient Air Quality Standard"],
    },
}


def _item_figures_html(reg: str, row_id: str) -> str:
    """The figure placeholders (if any) configured for an ordinary row — see
    ITEM_FIGURES; "" for every other row."""
    notes = ITEM_FIGURES.get(reg, {}).get(row_id)
    if not notes:
        return ""
    return "".join(_figure_placeholder_html(n) for n in notes)


def _swap_uncaptioned_table(own_lines: list[str], row_id: str, reg: str | None,
                             tables_by_caption: dict[str, dict], table_hits: dict) -> list[str]:
    """Swap the flattened pdftotext block for one of `row_id`'s
    UNCAPTIONED_TABLES entries (if any) with a `_TABLE_SENTINEL` paragraph,
    rendered in place during build_provisions' second pass. Shared by the
    ordinary item branch and the appendix branch of build_provisions — a
    no-op (returns `own_lines` unchanged) for any row with no matching entry.
    By default the replaced block runs from the `start_prefix` line to the
    next BLANK line (Reg 8's tables: the flattened dump has no blank lines
    of its own). `to_end: True` instead runs the replacement all the way to
    the end of `own_lines` — needed when the flattened dump itself contains
    blank lines (a wrapped table cell followed by pdftotext's usual
    paragraph gap, e.g. Reg 30's Appendix A/B — see UNCAPTIONED_TABLES)."""
    for entry in UNCAPTIONED_TABLES.get(reg or "", []):
        if entry["row_id"] != row_id or entry["caption"] not in tables_by_caption:
            continue
        for li, ln in enumerate(own_lines):
            if ln.strip().startswith(entry["start_prefix"]):
                if entry.get("stop_prefix"):
                    lj = li + 1
                    while lj < len(own_lines) and not own_lines[lj].strip().startswith(entry["stop_prefix"]):
                        lj += 1
                elif entry.get("to_end"):
                    lj = len(own_lines)
                elif entry.get("end_prefix"):
                    # The replaced block runs from `start_prefix` through
                    # the first later line that starts with `end_prefix`
                    # and any non-blank lines chained directly onto it —
                    # for a flattened dump that has blank lines INSIDE it
                    # (so "next blank line" stops too early) AND prose
                    # after it in the same row (so `to_end` runs too far):
                    # Reg 27's six-step CHP formula table (see
                    # UNCAPTIONED_TABLES["27"]).
                    lj = li + 1
                    while lj < len(own_lines) and not own_lines[lj].strip().startswith(entry["end_prefix"]):
                        lj += 1
                    if lj >= len(own_lines):
                        break  # end marker not found: leave the row untouched
                    lj += 1
                    while lj < len(own_lines) and own_lines[lj].strip() != "":
                        lj += 1
                else:
                    lj = li
                    while lj < len(own_lines) and own_lines[lj].strip() != "":
                        lj += 1
                own_lines = own_lines[:li] + ["", _TABLE_SENTINEL + entry["caption"], ""] + own_lines[lj:]
                table_hits["used"] += 1
                table_hits["captions_used"].append(entry["caption"])
                break
    return own_lines


# LAYOUT-TEXT tables, per regulation. Reg 11's Part F prints its maximum
# allowable emissions limits (percent CO / ppm HC by model year for light- and
# heavy-duty idle tests, and grams/mile HC / CO / NOx transient-test limits by
# model year) as whitespace-aligned columns with NO ruling lines at all —
# confirmed: pdfplumber's default (line-based) `extract_tables()` returns
# nothing on REG_11.pdf pages 56-58, and its text-based strategy shreds the
# page into 6-7 ragged columns mixing the running prose in with the cells —
# so neither the caption-driven mechanism nor UNCAPTIONED_TABLES (both
# pdfplumber-backed) can recover them, and pdftotext -layout's dump was
# flattened into one unreadable run-on paragraph ("Model Year Percent Carbon
# Parts/million Monoxide Hydrocarbon 1970 and earlier 3.5 1000 1971 3.0
# 1000 ..."). The `-layout` dump itself, however, preserves the column
# alignment exactly (every cell of these tables sits centered under its
# header, and no cell contains a run of two or more spaces), so each table
# is rebuilt from the TEXT: each physical line is split into cells on runs
# of 2+ spaces, the first header line's cell centres define the columns,
# and every later cell (a second header line, a data row) is assigned to
# the column whose centre is nearest. Each entry pins ONE table to ONE
# provision, exactly like UNCAPTIONED_TABLES: `row_id`, `start_prefix` (the
# stripped text of the first header line), `header_lines` (how many
# physical lines the header occupies — Part F's "Model Year / Percent
# Carbon / Parts/million" then "Monoxide / Hydrocarbon" is 2; the grams/mile
# tables' single "MODEL YEAR HC CO NOx" line is 1), and `caption` (the
# rendered doc-table-caption — descriptive, the source prints none). The
# block runs from `start_prefix`'s line through the header lines, then over
# the data rows up to the next blank line, or, with `end_prefix`, up to (not
# including) the line starting with that text, skipping blank lines inside
# the block (Appendix A's analytical-accuracy table groups its rows with
# blank lines between channels). Several entries may name the same row
# (Part F's II.A. prints two tables — 1978-and-earlier and 1979-and-newer
# heavy-duty vehicles — under one label); they are matched in printed order,
# each searching only after the previous entry's block. The block is
# replaced in place with a `_TABLE_SENTINEL` paragraph (see
# `_swap_uncaptioned_table`) and the parsed table is registered in
# `tables_by_caption` under its caption so build_provisions's second pass
# renders it exactly like a pdfplumber-recovered one. A reg with no entry
# here is untouched (the consumer is a no-op).
LAYOUT_TEXT_TABLES: dict[str, list[dict]] = {
    # Reg 4's Appendix A prints two small whitespace-aligned tables, each
    # under its own printed caption line and each followed by a "Note 1:"
    # footnote that stays ordinary body text (`end_prefix`). Both are
    # cleanly centred under their single header line, so the ordinary
    # nearest-centre rebuild applies; `caption_line_prefix` swallows the
    # printed caption so it isn't also left behind as a paragraph, and the
    # rendered caption is that printed text verbatim.
    "4": [
        dict(row_id="sec-4-C-APPENDIX-A-3.2.2.1",
             caption_line_prefix="Table 3.2.2.1.1",
             start_prefix="Critical Dimensions", header_lines=1,
             end_prefix="Note 1:",
             caption="Table 3.2.2.1.1 Critical Masonry Heater Dimensions"),
        dict(row_id="sec-4-C-APPENDIX-A-5.4.1",
             caption_line_prefix="Table 5.4.1.1",
             start_prefix="Range:", header_lines=1,
             end_prefix="Note 1:",
             caption="Table 5.4.1.1 Nominal Calibration Gas Concentrations 1"),
    ],
    # Reg 19's Appendix A ("Number of Units to be Tested in Pre-1978
    # Multifamily Developments", REG_19.pdf pages 52-54): a three-column
    # sampling table — number of similar units / number to test in a
    # pre-1960-or-unknown-age building / number to test in a 1960-1977
    # building — printed with no ruling lines (pdfplumber's extract_tables
    # returns nothing for the whole PDF: "tables found in PDF: 0"), a
    # four-line header ("Number of Similar Units, Similar / Common Areas or
    # Exterior Sites / in a Building or Development" + "Number to Test"
    # under each of the two count columns) reprinted at the top of each of
    # its three pages, and a blank line between every data row — hence
    # `to_end` + `reprinted_headers` (see `_swap_layout_text_tables`). One
    # table, 70 data rows, keyed to the appendix row itself.
    "19": [
        # Part A V.A.5.c.: the abatement notification fee schedule (REG_19.txt
        # lines 2141-2150, page 36) — "VALUATION OF WORK / NOTIFICATION FEE",
        # five valuation bands, the fee cell of four of them wrapped onto a
        # second physical line ("...in valuation or" / "fraction thereof of
        # total valuation") — flattened by pdftotext into one run-on
        # paragraph. `wrap_continuations` folds each wrapped fee line back
        # into its band's row.
        dict(row_id="sec-19-A-V-A-5-c", start_prefix="VALUATION OF WORK", header_lines=1,
             wrap_continuations=True,
             caption="Abatement notification fee by valuation of work"),
        dict(row_id="sec-19-A-APPENDIX-A", start_prefix="Number of Similar Units", header_lines=4,
             to_end=True, reprinted_headers=True,
             caption="Number of units to be tested in pre-1978 multifamily developments (Section V.J.2.b.)"),
    ],
    "11": [
        dict(row_id="sec-11-F-I-A", start_prefix="Model Year", header_lines=2,
             caption="Maximum concentration limits — light-duty vehicles (includes light-duty trucks)"),
        dict(row_id="sec-11-F-II-A", start_prefix="Model Year", header_lines=2,
             caption="Maximum concentration limits — heavy-duty vehicles, 1978 and earlier (greater than 6000 lbs. GVWR)"),
        dict(row_id="sec-11-F-II-A", start_prefix="Model Year", header_lines=2,
             caption="Maximum concentration limits — heavy-duty vehicles, 1979 and newer (greater than 8500 lbs. GVWR)"),
        dict(row_id="sec-11-F-III-C", start_prefix="MODEL YEAR", header_lines=1,
             caption="Transient test mass emissions limits in grams/mile — light-duty vehicles (excluding light-duty trucks)"),
        dict(row_id="sec-11-F-III-D", start_prefix="MODEL YEAR", header_lines=1,
             caption="Transient test mass emissions limits in grams/mile — light-duty trucks (equal to or less than 8,500 lbs. GVWR)"),
        # Appendix A, 2.11.F. "Analytical Bench Accuracy": Channel / Range /
        # Accuracy, rows grouped by channel with blank lines between groups
        # (and one range cell, "1001-2000", wrapped onto two physical lines
        # — kept as two rows, exactly as printed).
        dict(row_id="sec-11-H-APPENDIX-A-2.11-F", start_prefix="Channel", header_lines=1,
             end_prefix="The analyzer display resolution",
             caption="Analytical bench accuracy requirements (Channel / Range / Accuracy)"),
    ],
}

_LAYOUT_CELL_RE = re.compile(r"\S+(?: \S+)*")


def _layout_line_cells(line: str) -> list[tuple[float, str]]:
    """(centre column, text) of every run of non-space text separated by 2+
    spaces on one `pdftotext -layout` line."""
    return [((m.start() + m.end() - 1) / 2.0, m.group(0)) for m in _LAYOUT_CELL_RE.finditer(line.rstrip())]


def _parse_layout_text_table(block: list[str], header_lines: int) -> list[list[str]]:
    """Rebuild a whitespace-aligned table (see LAYOUT_TEXT_TABLES) from its
    raw layout lines: the first line's cells define the columns; every
    other cell joins the column whose centre is nearest (a second header
    line's cells are appended to their column's header text)."""
    nonblank = [ln for ln in block if ln.strip() != ""]
    if not nonblank:
        return []
    centres = [c for c, _ in _layout_line_cells(nonblank[0])]
    ncol = len(centres)

    def assign(line: str) -> list[str]:
        cells = [""] * ncol
        for c, text in _layout_line_cells(line):
            j = min(range(ncol), key=lambda k: abs(centres[k] - c))
            cells[j] = f"{cells[j]} {text}".strip()
        return cells

    header = assign(nonblank[0])
    for ln in nonblank[1:header_lines]:
        for j, text in enumerate(assign(ln)):
            if text:
                header[j] = f"{header[j]} {text}".strip()
    return [header] + [assign(ln) for ln in nonblank[header_lines:]]


def _swap_layout_text_tables(own_lines: list[str], row_id: str, reg: str | None,
                             tables_by_caption: dict[str, dict], table_hits: dict) -> list[str]:
    """Swap every LAYOUT_TEXT_TABLES block belonging to `row_id` for a
    `_TABLE_SENTINEL` paragraph, registering the rebuilt table in
    `tables_by_caption` (the same dict pdfplumber-recovered tables live in,
    so the second pass of build_provisions renders it identically). A no-op
    (returns `own_lines` unchanged) for any row with no matching entry."""
    search_from = 0
    for entry in LAYOUT_TEXT_TABLES.get(reg or "", []):
        if entry["row_id"] != row_id:
            continue
        # `caption_line_prefix` (Reg 4's two Appendix A tables): the source
        # PRINTS a caption line above the column block ("Table 3.2.2.1.1
        # Critical Masonry Heater Dimensions"). Without this the caption
        # line would survive as an ordinary paragraph and the rendered
        # doc-table-caption would repeat it. Locate it, swallow it into the
        # replaced block, and start the column search after it. Absent for
        # every existing entry (Reg 11/19 print no caption at all), whose
        # blocks are located exactly as before.
        cap_prefix = entry.get("caption_line_prefix")
        cap_at = None
        if cap_prefix is not None:
            cap_at = next((k for k in range(search_from, len(own_lines))
                           if own_lines[k].strip().startswith(cap_prefix)), None)
            if cap_at is None:
                continue
        start = next((k for k in range((cap_at + 1) if cap_at is not None else search_from, len(own_lines))
                      if own_lines[k].strip().startswith(entry["start_prefix"])), None)
        if start is None:
            continue
        block_start = cap_at if cap_at is not None else start
        header_lines = entry.get("header_lines", 1)
        end_prefix = entry.get("end_prefix")
        # `to_end` (Reg 19's Appendix A): the block runs to the end of the
        # row's own lines, skipping the blank line printed between EVERY
        # data row (so "next blank line" would stop after the first row)
        # — the table is the last thing in its row, nothing follows it.
        # `reprinted_headers` (same table): a multi-page table whose
        # header block is reprinted at the top of each page (pages 52-54,
        # three times); a later line starting with `start_prefix` opens a
        # new SEGMENT whose `header_lines` are consumed again and dropped,
        # and whose cells are assigned by that segment's OWN header
        # centres (`-layout` shifts the columns from page to page). Both
        # default off, so every existing entry (Reg 11) behaves as before.
        to_end = bool(entry.get("to_end"))
        reprinted = bool(entry.get("reprinted_headers"))
        wrap = bool(entry.get("wrap_continuations"))
        j = start
        nonblank_seen = 0
        segment_starts = [start]
        while j < len(own_lines):
            s = own_lines[j].strip()
            if end_prefix is not None and s.startswith(end_prefix):
                break
            if s == "":
                # A blank line after at least one data row ends the block
                # (unless `end_prefix` delimits it); a blank between the
                # header and the first data row is part of the block.
                if end_prefix is None and not to_end and nonblank_seen > header_lines:
                    break
            else:
                if reprinted and j > start and s.startswith(entry["start_prefix"]):
                    segment_starts.append(j)
                    nonblank_seen = 0
                elif end_prefix is None and nonblank_seen >= header_lines and len(_layout_line_cells(own_lines[j])) < 2 \
                        and not (wrap and own_lines[j][:1] == " "):
                    # A one-cell line is prose, not a data row (Part F's
                    # II.A. second sub-caption follows the first table's
                    # last row directly across a stripped page break) —
                    # unless `wrap_continuations` is on and the line is
                    # indented (its first column empty): a wrapped cell.
                    break
                nonblank_seen += 1
            j += 1
        block = own_lines[start:j]
        # Trim trailing blank lines off the block so they stay as the
        # paragraph gap after the sentinel.
        while block and block[-1].strip() == "":
            block.pop()
        if len(segment_starts) > 1:
            # Reprinted headers: parse each page's segment against its own
            # header, keep the first segment's header row only.
            rows = []
            bounds = segment_starts + [start + len(block)]
            for si in range(len(segment_starts)):
                seg_rows = _parse_layout_text_table(own_lines[bounds[si]:bounds[si + 1]], header_lines)
                rows.extend(seg_rows if si == 0 else seg_rows[1:])
        else:
            rows = _parse_layout_text_table(block, header_lines)
        if not rows:
            continue
        if entry.get("wrap_continuations"):
            # `wrap_continuations` (Reg 19's V.A.5.c. notification-fee
            # table): a cell that wraps onto a second physical line ("$145
            # base plus $8.00 per $1,000 in valuation or" / "fraction
            # thereof of total valuation") prints that line with an EMPTY
            # first column — fold such a line into the row above instead of
            # emitting it as a row of its own. Off (absent) for every
            # existing entry, whose rows are untouched.
            merged: list[list[str]] = []
            for k, r in enumerate(rows):
                if k > 0 and merged and not (r[0] or "").strip():
                    merged[-1] = [f"{a} {b}".strip() if b else a for a, b in zip(merged[-1], r)]
                else:
                    merged.append(list(r))
            rows = merged
        caption = entry["caption"]
        tables_by_caption[caption] = {"caption": caption, "rows": rows}
        replacement = ["", _TABLE_SENTINEL + caption, ""]
        own_lines = own_lines[:block_start] + replacement + own_lines[start + len(block):]
        search_from = block_start + len(replacement)
        table_hits["used"] += 1
        table_hits["captions_used"].append(caption)
    return own_lines


# COLUMN-LAYOUT tables, per regulation — a borderless table whose CELLS are
# multi-line paragraphs, rebuilt from the `pdftotext -layout` dump by column
# CHARACTER POSITION. Air Quality Standards' Section V.A.1. (the motor
# vehicle emissions budgets, REG_AQS.pdf pages 15-19) prints one row per
# area — "Denver Attainment/Maintenance Area (Modeling Domain)" / "PM10:
# 2015 through 2021: 54 tons/day; 2022 and beyond: 55 tons/day. Nitrogen
# Oxides: ... Trading provisions: ..." / "Adopted 2016, 2008 Ozone NAAQS,
# Moderate SIP" — as three whitespace-separated columns with NO ruling lines
# and NO header (pdfplumber's `find_tables()` returns nothing on those
# pages) where a single cell wraps over up to 30 physical lines and a row
# can straddle a page break. Neither existing text-table mechanism fits:
# LAYOUT_TEXT_TABLES assigns every physical line to a table ROW (one line =
# one data row, cells by column centre), so a wrapped cell would become
# thirty rows, and UNCAPTIONED_TABLES needs a pdfplumber-recoverable
# bordered table. Here instead:
#   - the block runs from the `start_prefix` line to the end of the
#     provision's own lines (`to_end`) or up to (not including) the first
#     later line starting with `end_prefix`;
#   - each blank-line-delimited run of physical lines inside the block is
#     ONE table row (confirmed: every area's row is separated from the next
#     by a blank line, and a page seam inside a row leaves NO blank line
#     because clean_pages strips the page furniture and its surrounding
#     blanks — the Denver Metro "Moderate" row spans pages 16-17 and the
#     Steamboat Springs row pages 18-19 this way);
#   - every run of text separated by 2+ spaces on a physical line is a cell
#     fragment, assigned to the LAST column whose `col_starts` character
#     offset is <= the fragment's own start offset in the raw line (the
#     printed column boundaries drift by a few characters from page to
#     page — the middle column starts at character 34, 37, 39, 41 or 43
#     depending on the page's layout scale — so the boundaries are set
#     between the columns, [0, 30, 70], not at them);
#   - a row's fragments are joined per column, in printed order, with single
#     spaces; `header` supplies the column headings (descriptive — the
#     source prints none, exactly as `caption` is for UNCAPTIONED_TABLES).
# Rendered through the same `_TABLE_SENTINEL` / `tables_by_caption` path as
# every other recovered table. A reg with no entry here is untouched.
COLUMN_LAYOUT_TABLES: dict[str, list[dict]] = {
    # Reg 4 Part B Section IX ("Implementation of Local Control Strategies",
    # REG_4.txt lines 593-633): the list of local jurisdictions and the
    # high-pollution-day / construction ordinances each must enforce, printed
    # as five whitespace-aligned columns with no ruling lines (pdfplumber
    # finds no tables at all in REG_4.pdf: "tables found in PDF: 0") and one
    # blank line between every data row. LAYOUT_TEXT_TABLES' nearest-centre
    # matching cannot be used: the header's FIRST physical line carries only
    # four of the five columns ("HPD Ordinance / Date / Construction /
    # Date"), the "Community" header sits alone on the second line and the
    # other four columns' second words on the third — so the columns are
    # given by character offset instead, and the three-line header run is
    # dropped (`skip_rows: 1`) in favour of the explicit `header` below.
    # Empty cells are real: Arvada, Federal Heights, Longmont and Mountain
    # View have no construction ordinance, Douglas County no HPD ordinance,
    # and Lafayette's construction-ordinance number is blank with only its
    # date printed. Broomfield's lone "." in the last column is printed in
    # the source and kept verbatim.
    "4": [
        dict(row_id="sec-4-B-IX", start_prefix="HPD Ordinance", to_end=True,
             col_starts=[0, 30, 55, 70, 92], skip_rows=1,
             header=["Community", "HPD Ordinance Number", "Date Enacted",
                     "Construction Ordinance", "Date Enacted"],
             caption="High pollution day and construction ordinances by local jurisdiction (Section IX.)"),
    ],
    "aqs": [
        dict(row_id="sec-aqs-V-A-1", start_prefix="Denver Attainment/Maintenance Area", to_end=True,
             col_starts=[0, 30, 70],
             header=["Area", "Motor Vehicle Emissions Budget", "Adoption"],
             caption="Motor Vehicle Emissions Budgets by area (Section V.A.1.)"),
    ],
}


def _parse_column_layout_table(block: list[str], col_starts: list[int], header: list[str],
                               skip_rows: int = 0) -> list[list[str]]:
    """Rebuild a COLUMN_LAYOUT_TABLES block: one row per blank-delimited run
    of lines, cells by character-offset column (see the dict's comment).
    `skip_rows` drops that many leading runs before the configured `header`
    is prepended — Reg 4's Section IX ordinance table prints its own header
    as the block's first (three-physical-line, blank-delimited) run, which
    would otherwise come through as a duplicate first data row. Defaults to
    0, so the existing Air Quality Standards entry is unchanged."""
    ncol = len(col_starts)
    rows: list[list[str]] = []
    cur: list[str] | None = None
    for ln in block:
        if ln.strip() == "":
            if cur is not None and any(cur):
                rows.append(cur)
            cur = None
            continue
        if cur is None:
            cur = [""] * ncol
        for m in _LAYOUT_CELL_RE.finditer(ln.rstrip()):
            j = max(k for k in range(ncol) if col_starts[k] <= m.start()) if m.start() >= col_starts[0] else 0
            cur[j] = f"{cur[j]} {m.group(0)}".strip()
    if cur is not None and any(cur):
        rows.append(cur)
    rows = rows[skip_rows:]
    if not rows:
        return []
    return [list(header)] + rows


def _swap_column_layout_tables(own_lines: list[str], row_id: str, reg: str | None,
                               tables_by_caption: dict[str, dict], table_hits: dict) -> list[str]:
    """Swap every COLUMN_LAYOUT_TABLES block belonging to `row_id` for a
    `_TABLE_SENTINEL` paragraph (same contract as `_swap_layout_text_tables`);
    a no-op for any row without an entry."""
    for entry in COLUMN_LAYOUT_TABLES.get(reg or "", []):
        if entry["row_id"] != row_id:
            continue
        start = next((k for k in range(len(own_lines))
                      if own_lines[k].strip().startswith(entry["start_prefix"])), None)
        if start is None:
            continue
        end_prefix = entry.get("end_prefix")
        j = start
        while j < len(own_lines):
            if end_prefix is not None and own_lines[j].strip().startswith(end_prefix):
                break
            j += 1
        if end_prefix is None and not entry.get("to_end"):
            continue
        block = own_lines[start:j]
        while block and block[-1].strip() == "":
            block.pop()
        rows = _parse_column_layout_table(block, entry["col_starts"], entry["header"],
                                          entry.get("skip_rows", 0))
        if not rows:
            continue
        caption = entry["caption"]
        tables_by_caption[caption] = {"caption": caption, "rows": rows}
        replacement = ["", _TABLE_SENTINEL + caption, ""]
        own_lines = own_lines[:start] + replacement + own_lines[start + len(block):]
        table_hits["used"] += 1
        table_hits["captions_used"].append(caption)
    return own_lines


def _table_caption_key(line: str, reg: str | None) -> str | None:
    """The key a caption line is stored/looked up under in the
    tables_by_caption map: the stripped line itself for TABLE_CAPTION_RE
    (unchanged behaviour), or its whitespace-normalized form for a
    reg-specific TABLE_CAPTION_EXTRA_RE match; None if it isn't a caption."""
    stripped = line.strip()
    if TABLE_CAPTION_RE.match(stripped):
        return stripped
    extra = TABLE_CAPTION_EXTRA_RE.get(reg or "")
    if extra and extra.match(stripped):
        return re.sub(r"\s+", " ", stripped)
    return None


# CAPTIONED tables that are printed with NO ruling lines pdfplumber can use
# and whose DATA CELLS stack over several physical lines -- rebuilt from the
# `pdftotext -layout` text and written STRAIGHT INTO `tables_by_caption`,
# REPLACING whatever the pdfplumber walk assembled for that caption, so the
# ordinary caption path in build_provisions (cut the row's own lines at the
# caption, render `tables_by_caption[caption]`) renders the good table with
# no other change.
#
# Reg 28's Part C "Table 1 - Property Type Site EUI and GHG Intensity
# Targets" (REG_28.pdf pages 25-28) is the first entry. Neither existing
# text-table mechanism fits it:
#   - pdfplumber DOES find a table on each of the four pages, but its
#     column detection splits the four numeric columns across TWELVE
#     detected columns and scatters the six-line header block over six
#     nearly-empty rows (confirmed: `page.extract_tables()` on pages 25-28
#     returns 12-wide rows such as
#     ['Adult Education', None, '53.1', '', '42.6', '', '3.3', None, None,
#      '1.9', None, None]), so TABLE_CAPTION_SPANS -- which concatenates
#     the pdfplumber rows -- would only concatenate the same garbage;
#   - LAYOUT_TEXT_TABLES rebuilds from the layout text, but assigns every
#     physical line to one table ROW by column centre, and this table's
#     header block has no line carrying all five column centres (the
#     "Property Type" heading is printed on its own line, vertically
#     centred, three lines below the first header line) while 8 of its 78
#     data rows print their property name on two or three physical lines
#     ("Hospital (General Medical &" / "Surgical)  217.6 ...", and
#     "Convenience Store with Gas" / "  205.9 ..." / "Station" -- the
#     numbers vertically centred INSIDE a three-line name).
# Each entry gives the caption (the `_table_caption_key` form), the explicit
# `header` row (the printed header block is unreconstructable in reading
# order, exactly as COLUMN_LAYOUT_TABLES' `header` is for a table that
# prints none) and `value_cols`, the number of numeric columns after the
# name column. The scan walks the cleaned body lines and classifies each
# one by its cells (runs of text separated by 2+ spaces):
#   - a line with a leading name cell at indent <= `name_indent` plus
#     exactly `value_cols` numeric cells is a complete data row;
#   - a line with exactly `value_cols` numeric cells and no name cell is a
#     data row whose name is stacked around it;
#   - a line with a single non-numeric cell at indent <= `name_indent` is a
#     name fragment: it joins the NEXT data row, or, if it directly follows
#     a name-less data row, that row;
#   - anything else is header/caption furniture -- skipped before the
#     segment's first data row, and ends the table after it.
# A caption printed again (once per page here) simply opens the next
# segment. A reg with no entry here is untouched, and an entry whose
# caption is never found leaves `tables_by_caption` exactly as it was.
CAPTIONED_LAYOUT_TABLES: dict[str, list[dict]] = {
    "28": [
        dict(caption="Table 1 \u2013 Property Type Site EUI and GHG Intensity Targets",
             header=["Property Type",
                     "2026-2029 Site EUI (kBtu/SF)",
                     "2030-2050 Site EUI (kBtu/SF)",
                     "2026-2029 GHG Intensity (kg CO2e/SF)",
                     "2030-2050 GHG Intensity (kg CO2e/SF)"],
             value_cols=4, name_indent=3),
    ],
}

_CAPTIONED_LAYOUT_NUM_RE = re.compile(r"^\d{1,5}(?:\.\d{1,3})?$")


def _rebuild_captioned_layout_tables(reg: str | None, lines: list[str],
                                     tables_by_caption: dict[str, dict]) -> list[str]:
    """Rebuild every CAPTIONED_LAYOUT_TABLES table for `reg` from the cleaned
    body `lines` and store it under its caption in `tables_by_caption`
    (replacing any pdfplumber-assembled table of the same caption). Returns
    the list of captions rebuilt; a no-op returning [] for a reg with no
    entry."""
    rebuilt: list[str] = []
    for entry in CAPTIONED_LAYOUT_TABLES.get(reg or "", []):
        caption = entry["caption"]
        value_cols = entry["value_cols"]
        name_indent = entry.get("name_indent", 3)
        starts = [i for i, ln in enumerate(lines) if _table_caption_key(ln, reg) == caption]
        if not starts:
            continue
        rows: list[list[str]] = []
        pending: list[str] = []
        open_row: list[str] | None = None
        seen_data = False
        i = starts[0]
        while i < len(lines):
            raw = lines[i]
            i += 1
            if raw.strip() == "":
                continue
            if _table_caption_key(raw, reg) == caption:
                # The caption reprinted at the top of the next page: the
                # same table continues, header block and all.
                seen_data = False
                continue
            cells = _layout_line_cells(raw)
            offsets = [m.start() for m in _LAYOUT_CELL_RE.finditer(raw.rstrip())]
            indent = offsets[0] if offsets else len(raw)
            nums = [t for _, t in cells if _CAPTIONED_LAYOUT_NUM_RE.match(t)]
            lead_is_name = bool(cells) and indent <= name_indent \
                and not _CAPTIONED_LAYOUT_NUM_RE.match(cells[0][1])
            if lead_is_name and len(cells) == value_cols + 1 and len(nums) == value_cols:
                rows.append([" ".join(pending + [cells[0][1]])] + nums)
                pending, open_row, seen_data = [], None, True
                continue
            if len(cells) == value_cols and len(nums) == value_cols:
                rows.append([" ".join(pending)] + nums)
                open_row = rows[-1]
                pending, seen_data = [], True
                continue
            if lead_is_name and len(cells) == 1:
                if open_row is not None:
                    open_row[0] = f"{open_row[0]} {cells[0][1]}".strip()
                    open_row = None
                else:
                    pending.append(cells[0][1])
                continue
            if seen_data:
                break
        if not rows:
            continue
        tables_by_caption[caption] = {"caption": caption, "rows": [list(entry["header"])] + rows}
        rebuilt.append(caption)
    return rebuilt


def extract_tables_from_pdf(pdf_path: str, reg: str | None = None) -> dict[str, dict]:
    """Returns {caption_text: {"n": table_num, "caption": caption, "rows": [[...]]}}.

    A caption that recurs on more than one page (confirmed: Reg 22's Table 1
    — "End-Use, Prohibited Substances, and Date of Prohibition" — spans 4
    pages, its caption repeated at the top of each continuation page) means
    the table itself continues across the page break: rows from every page
    carrying that caption are concatenated, in page order, rather than the
    later page's rows overwriting the earlier ones (which is what a plain
    `out[caption] = ...` assignment would do). A repeated header row (the
    continuation page reprinting the same column headers) is dropped so it
    isn't duplicated mid-table."""
    import pdfplumber

    out: dict[str, dict] = {}
    uncaptioned = UNCAPTIONED_TABLES.get(reg or "", [])
    with pdfplumber.open(pdf_path) as pdf:
        for entry in uncaptioned:
            spans = entry.get("spans") or [(entry["page"], entry["table_index"])]
            rows: list = []
            for page_no, table_index in spans:
                page_tables = pdf.pages[page_no - 1].extract_tables()
                if table_index >= len(page_tables):
                    continue
                page_rows = page_tables[table_index]
                if page_rows and page_rows[0] and (page_rows[0][0] or "").strip() == entry["caption"]:
                    page_rows = page_rows[1:]  # the printed caption as a merged first row
                if entry.get("drop_caption_row") and page_rows and page_rows[0]:
                    # Same "the printed caption is the table's own merged first
                    # row" case as the check above, but for a print where that
                    # merged cell is NOT the row's first cell — Reg 23's
                    # determination tables return it as
                    # ["", "BART Determinations for Colorado Sources", None * 9, ""]
                    # (the caption is centred over the middle columns, so
                    # pdfplumber's first cell is the empty left gutter) — and/or
                    # where the RENDERED caption deliberately differs from the
                    # printed one, e.g. a continuation segment rendered as
                    # "... (continued)". `printed_caption` names the text as the
                    # PDF prints it (defaults to `caption`); the row is dropped
                    # only when its non-empty cells are exactly that one string,
                    # so this is a no-op on a real header row and idempotent
                    # after the check above has already fired. Every regulation
                    # without the key is untouched.
                    printed_caption = entry.get("printed_caption", entry["caption"])
                    filled = [(c or "").strip() for c in page_rows[0] if (c or "").strip()]
                    if filled == [printed_caption]:
                        page_rows = page_rows[1:]
                if rows:
                    page_rows = _drop_repeated_leading_rows(rows, page_rows)
                rows.extend(page_rows)
            if not rows:
                continue
            for _old, _new in entry.get("cell_fixes", ()):
                # A subscript that pdfplumber returns as its own line INSIDE a
                # cell ("111 ppmvd @ 15% O\n2\n(4-hour rolling average)"):
                # render_table_html turns the newlines into spaces, so the "2"
                # would read as a separate number. Each pair is an exact
                # substring replacement on the recovered cell text, listed one
                # by one in the entry so it is auditable against the page —
                # see UNCAPTIONED_TABLES["23"]. No-op for an entry without the
                # key (every other regulation).
                rows = [[(c.replace(_old, _new) if isinstance(c, str) else c) for c in r]
                        for r in rows]
            if entry.get("header_rows"):
                rows = _merge_header_rows(rows, entry["header_rows"])
            if entry.get("compact") == "align":
                rows = _compact_rows_aligned(rows)
            elif entry.get("compact"):
                rows = [[c for c in r if (c or "").strip()] for r in rows]
                rows = [r for r in rows if r]
            out[entry["caption"]] = {"caption": entry["caption"], "rows": rows}
        multi_caption = reg in MULTI_CAPTION_PAGE_REGS
        for page in pdf.pages:
            text = page.extract_text() or ""
            caption = None
            for line in text.split("\n"):
                key = _table_caption_key(line, reg)
                if key:
                    caption = key
                    break
            if caption and multi_caption:
                _extract_captioned_tables_by_first_cell(page, reg, out)
                page.flush_cache()
                continue
            if not caption:
                # A large PDF (600+ pages, e.g. ECMC) otherwise accumulates
                # unbounded memory: pdfplumber caches each page's parsed
                # objects (chars/rects/images) once touched by
                # extract_text() above and never releases them across a
                # `for page in pdf.pages` walk of the whole document.
                # Flushing a page's cache as soon as we know it holds no
                # table changes no regulation's OUTPUT (nothing was read
                # from `page` afterwards either way) — purely a memory fix,
                # confirmed additive by the byte-identical reg1/reg26
                # baselines (both far under the page count where this
                # matters, but exercised through the same code path).
                page.flush_cache()
                continue
            tables = page.extract_tables()
            if not tables:
                page.flush_cache()
                continue
            # Pick the table whose first cell matches the caption line, else the first table.
            chosen = None
            for t in tables:
                if t and t[0] and t[0][0] and t[0][0].strip().lower().startswith("table"):
                    chosen = t
                    break
            if chosen is None:
                chosen = tables[0]
            rows = chosen
            # Drop a leading row that's just the caption repeated as a merged cell.
            if rows and rows[0] and rows[0][0] and rows[0][0].strip() == caption:
                rows = rows[1:]
            # Drop any OTHER row that's purely the caption echoed again (seen
            # on Reg 22's Table 1: the caption line re-appears as its own
            # near-empty table row, not just at row 0, on some pages).
            rows = [r for r in rows if not (r and r[0] and r[0].strip() == caption)]
            if caption in out:
                existing_rows = out[caption]["rows"]
                if rows and existing_rows and rows[0] == existing_rows[0]:
                    rows = rows[1:]  # repeated header row on the continuation page
                existing_rows.extend(rows)
            else:
                out[caption] = {"caption": caption, "rows": rows}
            page.flush_cache()
        if reg == "9":
            _fix_reg9_appendix_tables(pdf, out)
        for caption, page_no, table_index in TABLE_CAPTION_PINS.get(reg or "", []):
            # See TABLE_CAPTION_PINS: several captioned tables on one page.
            page_tables = pdf.pages[page_no - 1].extract_tables()
            if table_index < len(page_tables):
                out[caption] = {"caption": caption, "rows": page_tables[table_index]}
        for entry in TABLE_CAPTION_SPANS.get(reg or "", []):
            # See TABLE_CAPTION_SPANS: a multi-page captioned table whose
            # header block (or caption cell) is reprinted on every page.
            rows = _spanned_caption_rows(pdf, entry["caption"], entry["spans"])
            if rows:
                out[entry["caption"]] = {"caption": entry.get("display_caption") or entry["caption"],
                                         "rows": rows}
    return out


def _spanned_caption_rows(pdf, caption: str, spans: list[tuple[int, int]]) -> list:
    """The concatenated rows of a TABLE_CAPTION_SPANS entry (see its comment):
    the printed caption row is dropped from every page (a first cell that
    starts with `caption`, newlines folded), and a continuation page's
    reprinted leading header rows are dropped via `_drop_repeated_leading_rows`."""
    rows: list = []
    for page_no, table_index in spans:
        page_tables = pdf.pages[page_no - 1].extract_tables()
        if table_index >= len(page_tables):
            continue
        page_rows = page_tables[table_index]
        if page_rows and page_rows[0] and (page_rows[0][0] or "").replace("\n", " ").strip().startswith(caption):
            page_rows = page_rows[1:]
        if rows:
            page_rows = _drop_repeated_leading_rows(rows, page_rows)
        rows.extend(page_rows)
    return rows


def _drop_repeated_leading_rows(existing_rows: list, page_rows: list) -> list:
    """A continuation page reprints the table's header BLOCK (one row for a
    single-line header, several for a multi-row one): drop the leading rows
    of `page_rows` while they equal the corresponding leading rows of the
    table so far. Used only by `spans` / MULTI_CAPTION_PAGE_REGS entries."""
    k = 0
    while k < len(page_rows) and k < len(existing_rows) and page_rows[k] == existing_rows[k]:
        k += 1
    return page_rows[k:]


def _compact_rows_aligned(rows: list) -> list:
    """`compact: "align"` — drop pdfplumber's merged-cell spacer columns while
    keeping a genuinely EMPTY cell in its own column.

    `compact: True` (Reg 25's Appendix E) drops every falsy cell from every
    row, which is right when no data cell is legitimately blank. Reg 23's
    determination tables break that: pdfplumber returns each of them as a
    12-column grid in which the spacers are `None` but a unit with no limit
    for one pollutant is `""` — "Suncor / Plant 1 Main Plant Flare" prints
    nothing under NOx (REG_23.pdf page 16), and dropping that cell shifted
    its SO2 limit ("162 ppmv H2S") into the NOx column. Dropping only the
    `None` cells fixes the data rows but not the HEADER row, whose own
    spacers pdfplumber returns as `""`.

    So: the target width is the header row with every blank dropped; each
    row then prefers its drop-`None`-only form when that already has the
    target width (data rows, blank cell preserved in place) and falls back
    to dropping blanks too when it does not (the header row, and any
    continuation row whose grid differs). A row that is blank throughout is
    dropped, as under `compact: True`. Unused by every regulation that does
    not pass the string, so existing tables are untouched."""
    if not rows:
        return rows

    def drop_none(row: list) -> list:
        return [c for c in row if c is not None]

    def drop_blank(row: list) -> list:
        return [c for c in row if (c or "").strip()]

    width = len(drop_blank(rows[0]))
    out: list = []
    for row in rows:
        cells = drop_none(row)
        if len(cells) != width:
            tight = drop_blank(row)
            if len(tight) == width:
                cells = tight
        if any((c or "").strip() for c in cells):
            out.append(cells)
    return out


def _merge_header_rows(rows: list, n: int) -> list:
    """Join the first `n` recovered rows column-wise into ONE header row
    (a visually-merged multi-line header pdfplumber returns as `n` rows with
    `None` cells — Reg 25's Appendix E "Lb VOC per / Gallon Coating / less
    water"). Cell parts are joined with a single space; the data rows that
    follow are returned unchanged."""
    if n <= 1 or len(rows) < n:
        return rows
    width = max(len(r) for r in rows[:n])
    merged = []
    for col in range(width):
        parts = [(r[col] or "").replace("\n", " ").strip() for r in rows[:n] if col < len(r)]
        merged.append(" ".join(p for p in parts if p))
    return [merged] + rows[n:]


# Regulations whose captioned tables may share ONE page with another
# captioned table (Reg 25 page 41: Table 1's last row and Table 2's first
# fourteen rows) and whose multi-page captioned tables reprint a MULTI-ROW
# header block on each continuation page (Tables 1, 2 and 5). The generic
# per-page walk in `extract_tables_from_pdf` assumes one caption per page
# and a one-row header; for a reg listed here every table on a captioned
# page is instead attached to the caption printed in its own first cell (see
# `_extract_captioned_tables_by_first_cell`). Every other reg keeps the
# generic walk unchanged.
MULTI_CAPTION_PAGE_REGS: frozenset[str] = frozenset({"25"})


def _extract_captioned_tables_by_first_cell(page, reg: str | None, out: dict[str, dict]) -> None:
    for t in page.extract_tables():
        if not t or not t[0] or not t[0][0]:
            continue
        first = t[0][0].replace("\n", " ").strip()
        key = _table_caption_key(first, reg)
        if not key:
            continue
        rows = t[1:]
        rows = [r for r in rows if not (r and r[0] and r[0].strip() == key)]
        if key in out:
            existing_rows = out[key]["rows"]
            existing_rows.extend(_drop_repeated_leading_rows(existing_rows, rows))
        else:
            out[key] = {"caption": key, "rows": rows}


def _fix_reg9_appendix_tables(pdf, out: dict[str, dict]) -> None:
    """The generic per-page walk above assumes at most one table per
    captioned page; REG_9.pdf page 38 breaks that assumption — Appendix A's
    own UNCAPTIONED "De Minimis Threshold" table and Appendix B's captioned
    "TABLE I" both sit on that one page, and `extract_tables()` returns the
    De Minimis table FIRST (it's physically higher on the page), so the
    generic walk's "first table on the page" fallback wrongly attaches it to
    the "TABLE I" caption instead of the real fuel-type table that follows
    it. Re-pull both of Reg 9's captioned tables directly by their confirmed
    (1-based page, 0-based table index) — the same explicit pinning
    `UNCAPTIONED_TABLES` uses for a table with no caption at all, just
    applied here to correct a caption that WAS found but matched to the
    wrong table on a multi-table page."""
    fixes = [
        ("TABLE I EXAMPLE BURNS Estimated to Potentially Produce 10 Tons of PM10 Emissions", 38, 1),
        ("TABLE II SOURCES OF INFORMATION/DATA USED IN TABLE I", 39, 0),
    ]
    for caption, page_no, table_index in fixes:
        if caption not in out:
            continue
        tables = pdf.pages[page_no - 1].extract_tables()
        if table_index < len(tables):
            out[caption] = {"caption": caption, "rows": tables[table_index]}


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

# The eleven APCD general construction permits (5 CCR-adjacent, but issued
# directly by the Division rather than adopted by the AQCC as a numbered
# regulation — see REG_META). There is no GP04.
GP_KEYS: tuple[str, ...] = ("gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12")

CORPUS_REGS = {
    "1": "1",
    "2": "2", "3": "3", "6": "6", "7": "7", "8": "8", "9": "9", "22": "22", "24": "24", "26": "26",
    "30": "30",
    # Batch 5: Reg 11 (Motor Vehicle Emissions Inspection Program).
    "11": "11",
    # Batch 5: Regulation Number 12 (Reduction of Diesel Vehicle Emissions).
    "12": "12",
    # Batch 5: Regulation Number 25 (surface coating / solvents / asphalt /
    # graphic arts / pharmaceuticals, 5 CCR 1001-29).
    "25": "25",
    # Batch 5: Regulation Number 27 (GHG Emissions and Energy Management for
    # Manufacturing, 5 CCR 1001-31) — see REG_META["27"].
    "27": "27",
    # Batch 6: Regulation Number 19 (The Control of Lead Hazards, 5 CCR
    # 1001-23) — see REG_META["19"].
    "19": "19",
    # Batch 6: Regulation Number 20 (Colorado Clean Cars and Trucks
    # Regulation, 5 CCR 1001-24) — see REG_META["20"].
    "20": "20",
    # Batch 6: Regulation Number 21 (Control of VOCs from Consumer Products
    # and Architectural and Industrial Maintenance Coatings, 5 CCR 1001-25) —
    # see REG_META["21"]. Cited by Reg 25 Part B I.L.1.c.(xv) only.
    "21": "21",
    # Batch 7: Regulation Number 23 (Regional Haze Limits, 5 CCR 1001-27) —
    # see REG_META["23"]. Cited by Reg 3 Part B / Part D and by Reg 7, and
    # itself cites Regulation Number 1, 3, 7 and the Common Provisions.
    "23": "23",
    # Batch 6: Regulation Number 16 (Street Sanding Emissions, 5 CCR 1001-18),
    # the SIP Local Elements document (5 CCR 1001-20, key "sip" — cited by
    # NAME, never by number; see SIP_LOCAL_ELEMENTS_RE) and Regulation Number
    # 18 (Acid Deposition Precursors, 5 CCR 1001-22) — see REG_META.
    "16": "16", "sip": "sip", "18": "18",
    # Batch 7: Regulation Number 10 (Criteria for Analysis of Transportation
    # Conformity, 5 CCR 1001-12), Regulation Number 15 (Control of Emissions
    # of Ozone-Depleting Compounds, 5 CCR 1001-19) and Regulation Number 29
    # (Emission Reduction Requirements for Lawn and Garden Equipment, 5 CCR
    # 1001-33) — see REG_META["10"] / ["15"] / ["29"].
    "10": "10", "15": "15", "29": "29",
    "oooob": "oooob", "ooooa": "ooooa", "ooooc": "ooooc",
    # 40 CFR Part 60 Subparts JJJJ/IIII and 40 CFR Part 63 Subpart ZZZZ
    # (stationary engine rules) -- parsed by import_ecfr.py alongside
    # OOOOa/b/c; see ECFR_REGS below and IMPORTER_SPEC.md.
    "jjjj": "jjjj", "iiii": "iiii", "zzzz": "zzzz",
    # 49 CFR Parts 191 and 192 (PHMSA gas pipeline safety) -- whole-PART
    # documents parsed from the eCFR versioner XML by import_ecfr.py's
    # parse_ecfr_part(); see PHMSA_BRIEF.md / IMPORTER_SPEC.md.
    # Batch B adds 49 CFR Parts 194 (onshore oil response plans), 195
    # (hazardous liquid pipelines) and 199 (drug and alcohol testing) --
    # same whole-PART shape, same importer path.
    # Batch C adds 49 CFR Parts 190 (enforcement and rulemaking procedures),
    # 193 (LNG facilities) and 196 (excavation damage prevention). Part 198
    # (state grants) stays out of the corpus.
    "p191": "p191", "p192": "p192",
    "p194": "p194", "p195": "p195", "p199": "p199",
    "p190": "p190", "p193": "p193", "p196": "p196",
    "ecmc": "ecmc", "cp": "cp",
    # Batch 6: Air Quality Standards, Designations and Emission Budgets
    # (5 CCR 1001-14) — see REG_META["aqs"].
    "aqs": "aqs",
    # Batch 7: the AQCC Procedural Rules (5 CCR 1001-1, key "proc"). Like
    # "aqs"/"sip" it carries no regulation NUMBER, so nearly every other
    # AQCC regulation cites it by name ("the Commission's Procedural
    # Rules", usually followed by "5 C.C.R. §1001-1" / "5 Code Colo. Reg.
    # §1001-1") — see PROC_RULES_MENTION_RE and link_citations step 1.9.
    "proc": "proc",
    # Batch 7: Regulation Number 4 (Sale and Installation of Wood-Burning
    # Appliances ..., 5 CCR 1001-6) — see REG_META["4"].
    "4": "4",
    # Batch 7: Regulation Number 28 (Building Benchmarking and Performance
    # Standards, 5 CCR 1001-32) — see REG_META["28"].
    "28": "28",
    # Batch 7: Regulation Number 31 (Control of Methane Emissions from
    # Municipal Solid Waste Landfills, 5 CCR 1001-35) — see REG_META["31"].
    "31": "31",
    **{k: k for k in GP_KEYS},
}

# The full set of eCFR-sourced regs (parsed by import_ecfr.py, not the CCR
# parser below). cmd_parse dispatches on membership in this set rather than
# the old `reg.lower().startswith("ooo")` string check, which never matched
# "jjjj"/"iiii"/"zzzz". Kept as a plain set literal (not imported from
# import_ecfr.SUBPART_META) so this module has no import-time dependency on
# import_ecfr beyond the existing lazy `import import_ecfr` inside cmd_parse.
# "p191"/"p192" are eCFR-sourced too, but whole PARTS read from the eCFR
# XML rather than subparts read from a PDF print -- import_ecfr.cmd_parse
# dispatches on SUBPART_META[reg]["document"] == "part" and expects --xml.
ECFR_REGS = {"ooooa", "oooob", "ooooc", "jjjj", "iiii", "zzzz",
             "p191", "p192", "p194", "p195", "p199",
             "p190", "p193", "p196"}

# 40 CFR Part 60 Subpart OOOO (the un-suffixed, pre-2022 version) is
# deliberately NOT in CORPUS_REGS: citations to it stay plain text
# (BUCKET_CFR) until/unless it is imported too — see IMPORTER_SPEC.md and the
# diff report's "CFR part/subpart not in corpus" section. (Regulation Number
# 27 was in the same position until Batch 5 imported it — see REG_META["27"];
# the "Regulation Number 27" mentions in Reg 7 Part B Section VII.F.6, Reg 26
# Part C entry I, Reg 30 Part C entry III and Reg 22's Part E stubs now link.)

# 40 CFR Part 60/63 Subpart code -> the id key it links to when that
# subpart is in CORPUS_REGS. "OOOOB" -> "oooob" (matches the existing
# `sec-oooob-top-REG-oooob` root); "OOOOA"/"OOOOC" mirror that same
# four-O-plus-suffix id shape ("ooooa"/"ooooc" — see REG_META). Bare "OOOO"
# (no letter suffix) has no entry here, so it always falls through to
# BUCKET_CFR regardless of corpus membership.
#
# "JJJJ"/"IIII" (Part 60) and "ZZZZ" (Part 63) are added the same way. This
# dict is keyed on the subpart CODE alone, not (part, code) -- CFR_RE's
# captured part number (m.group(1), e.g. "60" vs "63") is NOT checked
# against it here, only used elsewhere for the unrelated FLAT_ENTRY_PART_
# CONFIG "Part 60, Subpart Xx" adopted-by-reference case. That is safe only
# because every code in this dict is unique across both parts -- if a future
# import ever added, say, a Part 63 "Subpart OOOOa" (it won't: OOOOa/b/c are
# Part 60 by definition and JJJJ/IIII/ZZZZ's codes don't recur elsewhere),
# this dict would need to become {(part, code): regkey} to disambiguate. A
# citation is still text like "40 CFR Part 63, Subpart ZZZZ" either way; a
# bare "40 CFR Part 63" (no subpart, or a different one) still falls through
# to BUCKET_CFR as before.
CFR_SUBPART_TO_REGKEY = {
    "OOOOA": "ooooa", "OOOOB": "oooob", "OOOOC": "ooooc",
    "JJJJ": "jjjj", "IIII": "iiii", "ZZZZ": "zzzz",
}

# (CFR title, CFR part) -> reg key, for corpora whose unit of import is a
# whole CFR PART rather than a subpart. 49 CFR 191/192 are the first (and
# so far only) entries: a Colorado regulation that cites "49 CFR Part 192"
# or "49 CFR 192.605" should link to the pipeline part once it is in the
# corpus, and a bare section number resolves by its PART prefix (192.x ->
# p192) -- NOT by the 40 CFR section-range trick, which exists only because
# OOOOa/b/c share one numeric range.
#
# Deliberately a SEPARATE dict from CFR_SUBPART_TO_REGKEY, and consulted by
# a separate step (1.1 below) that only ever fires on a "49 CFR ..."
# citation: every 40 CFR mapping and every 40 CFR citation's behaviour is
# untouched. The step is additionally gated on corpus membership, so it is
# a strict no-op until p191/p192 are actually imported.
CFR_TITLE_PART_TO_REGKEY: dict[tuple[str, str], str] = {
    ("49", "191"): "p191",
    ("49", "192"): "p192",
    ("49", "194"): "p194",
    ("49", "195"): "p195",
    ("49", "199"): "p199",
    ("49", "190"): "p190",
    ("49", "193"): "p193",
    ("49", "196"): "p196",
}
# "49 CFR Part 192", "49 CFR part 191", "49 CFR 192.605", "49 CFR 191.5(b)"
# -- plus the forms ECMC actually writes 49 CFR citations in (the only
# Colorado document that cites 49 CFR at all; see sources/ECMC.txt):
# "49 C.F.R. § 192.243" (dotted abbreviation, optional leading section
# sign), "49 C.F.R. §§ 195.2 or 192.8" (a two-item list under one shared
# "§§ ... or ..." -- each item resolves independently: see the "or"
# handling in link_citations, below), and "49 C.F.R. § 195 Subpart A" (a
# bare part + subpart LETTER with no section number at all -- ECMC's way
# of naming a part it doesn't cite a specific section of). The dotted/
# spaced "C.F.R."/"C. F. R." acceptance mirrors CFR_RE_DOTTED's own
# "C\.?\s?F\.?\s?R\.?" pattern for the existing 40 CFR path, applied
# unconditionally here (not gated to a CFR_DOTTED_REGS-style set) since
# "49" + this exact letter sequence is specific enough not to false-positive.
CFR_TITLE_PART_RE = re.compile(
    r"\b(?P<title>49)\s+C\.?\s?F\.?\s?R\.?\s+"
    r"(?:"
    r"[Pp]art\s+(?P<part>\d{1,3})\b"
    r"|(?:§§?\s*)?(?P<barepart>\d{1,3})\s+Subpart\s+(?P<baresub>[A-Za-z0-9]+)\b"
    r"|(?:§§?\s*)?(?P<secpart>\d{1,3})\.(?P<secnum>\d{1,4})(?P<par>(?:\([a-zA-Z0-9]{1,7}\))*)"
    r"(?:\s+or\s+(?P<orsecpart>\d{1,3})\.(?P<orsecnum>\d{1,4}))?"
    r")"
)

# --------------------------------------------------------------------------
# Per-regulation metadata for the root row + apply-time provisions columns
# (jurisdiction_level, issuing_body, source_url) and the root row's own
# citation/title — see IMPORTER_SPEC.md and the DB's existing root rows for
# Reg 3/7/26/oooob (`select id, citation, title, jurisdiction_level,
# issuing_body, source_url from provisions where parent_id is null`). A reg
# not listed here falls back to the Reg 7-style state/CDPHE-APCD defaults
# (see SOURCE_URL_DEFAULT and every REG_META.get(..., default) call site).
# --------------------------------------------------------------------------

REG_META: dict[str, dict] = {
    # -- 49 CFR Parts 191 / 192 (PHMSA gas pipeline safety) ---------------
    # Federal, PHMSA-issued, eCFR-sourced. Unlike the 40 CFR subparts these
    # are WHOLE PARTS: the root row's citation is the part itself and the
    # sidebar's top level is the part's 16 subparts (p192) or its sections
    # (p191, which has no subparts).
    "p191": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-191",
        "root_citation": "49 CFR Part 191",
        "root_title": "49 CFR Part 191 \u2014 Transportation of Natural and Other Gas by Pipeline; Annual, Incident, and Other Reporting",
    },
    "p192": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-192",
        "root_citation": "49 CFR Part 192",
        "root_title": "49 CFR Part 192 \u2014 Transportation of Natural and Other Gas by Pipeline: Minimum Federal Safety Standards",
    },
    "p194": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-194",
        "root_citation": "49 CFR Part 194",
        "root_title": "49 CFR Part 194 \u2014 Response Plans for Onshore Oil Pipelines",
    },
    "p195": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-195",
        "root_citation": "49 CFR Part 195",
        "root_title": "49 CFR Part 195 \u2014 Transportation of Hazardous Liquids by Pipeline",
    },
    "p199": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-199",
        "root_citation": "49 CFR Part 199",
        "root_title": "49 CFR Part 199 \u2014 Drug and Alcohol Testing",
    },
    # -- Batch C: 49 CFR Parts 190 / 193 / 196 ---------------------------
    # Root titles are the <DIV5><HEAD> text as printed in the eCFR XML
    # (Part 196's head reads "Excavation Activity", not "Excavation Damage").
    "p190": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-190",
        "root_citation": "49 CFR Part 190",
        "root_title": "49 CFR Part 190 \u2014 Pipeline Safety Enforcement and Regulatory Procedures",
    },
    "p193": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-193",
        "root_citation": "49 CFR Part 193",
        "root_title": "49 CFR Part 193 \u2014 Liquefied Natural Gas Facilities: Federal Safety Standards",
    },
    "p196": {
        "jurisdiction_level": "federal", "issuing_body": "PHMSA",
        "source_url": "https://www.ecfr.gov/current/title-49/part-196",
        "root_citation": "49 CFR Part 196",
        "root_title": "49 CFR Part 196 \u2014 Protection of Underground Pipelines From Excavation Activity",
    },
    # -- APCD General Permits GP01-GP12 (5 CCR-adjacent Division-issued
    # general construction permits, not AQCC-numbered regulations) --------
    # All eleven share the Common Provisions/Reg 1 shape: `no_parts: True`,
    # roman top-level sections I-XI/XII, condition labels printed as full
    # dotted compound paths ("II.A.2.a.") — `tokenize_by_cycle`/CYCLE_AB
    # already parse that unchanged. Every permit also carries the two page-
    # furniture flags: `page_of_total_footer` (clean_pages strips "Page N of
    # M", the ONLY footer these PDFs print — no "CODE OF COLORADO
    # REGULATIONS" header at all) and `toc_has_page_leaders`
    # (find_body_start_no_parts strips the Table of Contents' dot-leader/
    # page-number tail before comparing outline title to body title — every
    # GPxx prints one; GP03 has no TOC at all and is unaffected since the
    # flag only matters when a SECOND matching "I. <title>" line exists).
    # `source_url` points at the Division's general-permits index page (the
    # individual PDFs don't have stable per-permit URLs there); `root_citation`
    # follows the brief's "APCD General Permit GPnn" convention (these are
    # not "Code of Colorado Regulations" citations — no CCR number is
    # printed on any of them). `root_title` is "<printed title page text>
    # GPnn Issuance <n>, <date issued>", each read directly off that
    # permit's own title page (line 1 of sources/GPnn.txt).
    "gp01": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP01",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Condensate Storage Tank Batteries — GP01 Issuance 6, July 23, 2025",
    },
    # GP02 is the one non-GP12 permit that ALSO ends with its own attachment
    # (a single "Attachment A: 2/14/2024" — the natural-gas-RICE Alternative
    # Operating Scenario, folded whole into GP12's own Attachment A once
    # GP12 superseded it) — confirmed printed right after the "Permit
    # History" table (line 1212 of GP02.txt), with the identical bare
    # all-digit ladder shape as GP12's attachments ("1. Prohibitions",
    # "1.1.", "1.2." ... "5.7.", max depth 2, always WITH its trailing dot —
    # `labels_without_trailing_dot` is unrelated to this and doesn't affect
    # it). Without `attachments` here this entire section — 26,700+
    # characters — was silently fused onto the last real condition row,
    # "XI.E.5." (Gate D's first giant/fused-row hit in this batch).
    "gp02": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "attachments": ("A",),
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP02",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Natural Gas Fired Reciprocating Internal Combustion Engines (RICE) — GP02 Issuance 4, July 23, 2025",
    },
    # GP03 (5 pages, Issuance 2, 2020) is the smallest and oldest permit and
    # prints a different title-page/header layout than the rest (a
    # "PERMIT NO: GP03 ... FINAL APPROVAL / Issuance 2 / <date>" block
    # instead of the "Permit Number GPnn Issuance n ... Final Approval"
    # single line the others use) and has NO Table of Contents at all — its
    # first "I.  General Permit Applicability" line IS the real body start,
    # so `find_body_start_no_parts` correctly falls back to 0 (see its
    # docstring); `toc_has_page_leaders` is still set for consistency but is
    # a no-op here (there's no second matching title line to compare).
    "gp03": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP03",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Land Development Projects — GP03 Issuance 2, January 24, 2020",
    },
    "gp05": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP05",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Produced Water Storage Tank Batteries — GP05 Issuance 5, July 23, 2025",
    },
    "gp06": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP06",
        # Title page prints an en-dash: "Diesel Fuel – Fired Reciprocating
        # Internal Combustion Engines (RICE)" — kept verbatim.
        "root_title": "GENERAL CONSTRUCTION PERMIT — Diesel Fuel – Fired Reciprocating Internal Combustion Engines (RICE) — GP06 Issuance 4, July 23, 2025",
    },
    "gp07": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP07",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Hydrocarbon Liquid Loadout — GP07 Issuance 4, July 23, 2025",
    },
    "gp08": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP08",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Storage Tanks — GP08 Issuance 4, July 23, 2025",
    },
    # GP09/GP10 print the IDENTICAL title-page text ("Oil and Gas / Well
    # Production Facilities") even though GP09 is the attainment-area permit
    # and GP10 is nonattainment (confirmed in each body's own General
    # Permit Applicability section, not on the title page) — see the
    # summarizer-warnings section of REPORT.md; root_title only carries what
    # is actually printed on the title page per the brief's instruction.
    "gp09": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP09",
        # The two Well Production Facilities permits print identical title pages; the
        # attainment/nonattainment split (which the body states) is added here so
        # the index and reader can tell them apart. Both closed to new
        # registrations on July 15, 2026 (replaced by GP12) but still bind
        # existing registrants.
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas — Well Production Facilities (attainment areas) — GP09 Issuance 3, July 23, 2025",
    },
    "gp10": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP10",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas — Well Production Facilities (nonattainment areas) — GP10 Issuance 4, July 23, 2025",
    },
    "gp11": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP11",
        "root_title": "GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — Routine or Predictable Gas Venting Emissions — GP11 Issuance 3, July 23, 2025",
    },
    # GP12 (107 pages, Issuance 1, May 2026) is the newest and largest
    # permit and the one whose condition labels print WITHOUT a trailing
    # period below section level SYSTEMATICALLY, on every single label
    # ("I.A", "I.A.3.a", "I.A.8.a.(i)" — only the top-level roman sections
    # themselves keep theirs, "I.", "II." ... "XII." — see
    # FAMILY_REGEX_NO_TRAILING_DOT; every other GP permit has the same flag
    # set too, but only hits it sporadically). It also ends with two
    # attachments (Attachment A/B, Alternative Operating Scenarios) whose
    # own items are a bare all-digit ladder ("1.", "3.1.", "7.7.2.1.")
    # rather than compound roman/letter labels — see ATTACHMENT_DIGIT_CYCLE
    # and the "attachment" marker handling in scan_markers/build_provisions.
    # `attachments` lists the letters this permit's Attachment heading regex
    # is even tried for; both keys are a no-op for every reg that doesn't
    # set them (GP02 also sets `attachments` — see its own entry above).
    "gp12": {
        "no_parts": True, "page_of_total_footer": True, "toc_has_page_leaders": True,
        "labels_without_trailing_dot": True,
        "attachments": ("A", "B"),
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/apcd/general-air-permits",
        "root_citation": "APCD General Permit GP12",
        "root_title": "GENERAL PERMIT 12 (GP12) — Well Production Facilities — GP12 Issuance 1, May 28, 2026",
    },
    "2": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 2",
        # Title-page line is "REGULATION NUMBER 2 ODOR EMISSION" (the name is
        # printed on the same line as the number), cite "5 CCR 1001-4".
        "root_title": "ODOR EMISSION 5 CCR 1001-4",
        # Reg 2's Part A prints one sentence of real regulatory text between
        # its "PART A GENERAL PROVISIONS" heading and its first section
        # ("Pursuant to Section 25-7-109(2)(d), C.R.S., the following
        # Emission Regulations are issued:"). Part rows are heading-only
        # everywhere else in the corpus (their lines up to the first marker
        # are never collected), so that sentence was silently dropped; this
        # flag makes build_provisions append such lead-in paragraphs to the
        # part row's full_text, after the heading, the same way an appendix
        # row carries its title followed by <p> body paragraphs. Off (and a
        # no-op) for every regulation that doesn't set it.
        "part_intro_text": True,
    },
    # Reg 1 is the first regulation in the corpus with NO "PART X" headings:
    # the body runs straight from "I. Applicability and General Provisions"
    # through "X. Statement of Basis, Specific Statutory Authority, and
    # Purpose" (confirmed: `grep -n "^\s*PART [A-Z]" sources/REG_1.txt` is
    # empty). `no_parts: True` (see reg_has_no_parts) makes the parser treat
    # the whole body as one implicit, un-lettered part: no `sec-1-P-X` part
    # rows are emitted, every top-level section's parent_id is the root row,
    # and every id simply OMITS the part segment — `sec-1-I`, `sec-1-I-A-1`,
    # `sec-1-III-D-2-b-(ii)`, `sec-1-X-Q`, `sec-1-APPENDIX-A` — i.e. exactly
    # the printed citation ("Section III.D.2.b.(ii)") with the same
    # dash-joined token shape every other regulation uses after its part
    # letter. Cross-reference resolution has the same single implicit part
    # to try (see _roman_part_letters / _resolve_cite), so a bare "Section
    # III.D.2." resolves directly to `sec-1-III-D-2`. A printed "Part X"
    # naming THIS regulation can never resolve (there is no such row) and
    # lands in the historical bucket like any other missing part. Reg 1's
    # own text never says "Part <letter>" about itself — its only "Part B"/
    # "Part A" mentions are about Regulation Numbers 6 and 8 (checked).
    "1": {
        "no_parts": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 1",
        "root_title": "EMISSION CONTROL FOR PARTICULATE MATTER, SMOKE, CARBON MONOXIDE, AND SULFUR OXIDES 5 CCR 1001-3",
    },
    # Common Provisions Regulation (5 CCR 1001-2, reg key "cp") — like Reg 1,
    # no "PART X" headings at all (`grep -n "^\s*PART [A-Z]" sources/REG_CP.txt`
    # is empty): the body runs straight from "I. Definitions, Statement of
    # Intent, and General Provisions..." through "V. Statements of Basis,
    # Specific Statutory Authority, and Purpose". Subsections print their
    # FULL dotted path as the label at every depth ("I.A.", "II.C.2.a.",
    # confirmed through depth 4) — the SAME shape `tokenize_by_cycle` already
    # expects for every other AQCC regulation (a compound label like
    # "II.C.2.a." is exactly [roman "II", upper "C", digit "2", lower "a"]),
    # so no new tokenizing capability is needed; only the printed INDENT
    # drifts (I.A./I.B. are indented 4 spaces — a page-one column-layout
    # quirk — while I.C. onward sit at indent 0), which the ordinary item
    # scan already tolerates (indent only feeds the column-drift AUDIT, never
    # marker acceptance — see `_marker_column_signals`). Section I.G.
    # ("Definitions") is the one genuinely new shape: see
    # TERM_DEFINITIONS_SECTION for its unlabeled, one-term-per-line
    # definitions list. See SOB_PART_CONFIG["cp"] for the section V
    # statement-of-basis family.
    "cp": {
        "no_parts": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Common Provisions Regulation",
        "root_title": "COMMON PROVISIONS REGULATION 5 CCR 1001-2",
    },
    "3": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 3",
        "root_title": "STATIONARY SOURCE PERMITTING AND AIR POLLUTANT EMISSION NOTICE REQUIREMENTS 5 CCR 1001-5",
    },
    # Reg 9 is part-less like Reg 1 (no "PART X" headings — confirmed:
    # `grep -n "^\s*PART [A-Z]" sources/REG_9.txt` is empty), but ALSO prints
    # every level of its outline bare rather than compound (see
    # BARE_LADDER_REGS) — the second, independent trait Reg 1 doesn't share.
    # `no_parts: True` still applies unchanged: ids omit the part segment
    # (`sec-9-I`, `sec-9-III-B-1-a`, `sec-9-IX-A`, `sec-9-APPENDIX-A`) and
    # every top-level section's parent is the root row.
    "9": {
        "no_parts": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 9",
        "root_title": "OPEN BURNING, PRESCRIBED FIRE, AND PERMITTING 5 CCR 1001-11",
    },
    "6": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 6",
        "root_title": "STANDARDS OF PERFORMANCE FOR NEW STATIONARY SOURCES 5 CCR 1001-8",
    },
    "7": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        # root_citation is deliberately the short "Regulation 7" (the reader
        # <h1>, the /sample labels and e2e SAMPLE_HEADINGS read it); the
        # title is the printed one in the same shape as every other numbered
        # regulation (migration 20260926035205_reg7_root_title replaced the old
        # "Regulation 7" placeholder, which the /regulations card printed as
        # "Regulation Number 7 — Regulation 7").
        "root_citation": "Regulation 7",
        "root_title": "CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9",
    },
    "22": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        # root_citation stays the short "Regulation 22" (reader <h1>, sidebar
        # and preview eyebrow read it); the title is the printed one in the
        # same shape as every other numbered regulation. The old value,
        # "Regulation Number 22 — Colorado Greenhouse Gas ... (5 CCR
        # 1001-26)", folded the label into the title and printed it twice on
        # the catalog card and the public preview (replaced by migration
        # 20260926040857_reg22_root_title).
        "root_citation": "Regulation 22",
        "root_title": "COLORADO GREENHOUSE GAS REPORTING AND EMISSION REDUCTION REQUIREMENTS 5 CCR 1001-26",
    },
    "26": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 26",
        "root_title": "CONTROL OF EMISSIONS FROM ENGINES AND MAJOR STATIONARY SOURCES 5 CCR 1001-30",
    },
    "8": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 8",
        "root_title": "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10",
    },
    "24": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 24",
        # Title page (sources/REG_24.txt lines 12-15) prints "REGULATION
        # NUMBER 24" and the title on one wrapped block, then "5 CCR 1001-28"
        # as its own line — same convention as Reg 3/6/8/26 (root_title omits
        # the "REGULATION NUMBER 24" prefix, keeping just the descriptive
        # title + CCR cite).
        "root_title": (
            "CONTROL OF EMISSIONS FROM VOLATILE ORGANIC COMPOUNDS AND "
            "PETROLEUM LIQUIDS STORAGE AND PETROLEUM PROCESSING AND "
            "REFINING 5 CCR 1001-28"
        ),
    },
    "oooob": {
        "jurisdiction_level": "federal", "issuing_body": "EPA",
        "source_url": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOb",
        "root_citation": "40 CFR Part 60 Subpart OOOOb",
        "root_title": "40 CFR Part 60 Subpart OOOOb — Standards of Performance for Crude Oil and Natural Gas Facilities",
    },
    "ooooa": {
        "jurisdiction_level": "federal", "issuing_body": "EPA",
        "source_url": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOa",
        "root_citation": "40 CFR Part 60 Subpart OOOOa",
        "root_title": (
            "40 CFR Part 60 Subpart OOOOa — Standards of Performance for Crude Oil and Natural Gas "
            "Facilities for Which Construction, Modification, or Reconstruction Commenced After "
            "September 18, 2015, and On or Before December 6, 2022"
        ),
    },
    "ooooc": {
        "jurisdiction_level": "federal", "issuing_body": "EPA",
        "source_url": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOc",
        "root_citation": "40 CFR Part 60 Subpart OOOOc",
        "root_title": (
            "40 CFR Part 60 Subpart OOOOc — Emissions Guidelines for Greenhouse Gas Emissions from "
            "Existing Crude Oil and Natural Gas Facilities"
        ),
    },
    "jjjj": {
        "jurisdiction_level": "federal", "issuing_body": "EPA",
        "source_url": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-JJJJ",
        "root_citation": "40 CFR Part 60 Subpart JJJJ",
        "root_title": (
            "40 CFR Part 60 Subpart JJJJ — Standards of Performance for Stationary Spark Ignition "
            "Internal Combustion Engines"
        ),
    },
    "iiii": {
        "jurisdiction_level": "federal", "issuing_body": "EPA",
        "source_url": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-IIII",
        "root_citation": "40 CFR Part 60 Subpart IIII",
        "root_title": (
            "40 CFR Part 60 Subpart IIII — Standards of Performance for Stationary Compression "
            "Ignition Internal Combustion Engines"
        ),
    },
    "zzzz": {
        "jurisdiction_level": "federal", "issuing_body": "EPA",
        "source_url": "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-63/subpart-ZZZZ",
        "root_citation": "40 CFR Part 63 Subpart ZZZZ",
        "root_title": (
            "40 CFR Part 63 Subpart ZZZZ — National Emission Standards for Hazardous Air Pollutants "
            "for Stationary Reciprocating Internal Combustion Engines"
        ),
    },
    # ECMC rules (2 CCR 404-1) — a completely different document shape from
    # every AQCC regulation above: no "PART X" headings at all, no roman-
    # numeral top sections. Instead the body is organized as "N00 SERIES
    # <title>" headings, each containing numbered "NNN. <title>" RULES, each
    # rule containing a lettered/numbered/lettered/roman ladder
    # (a. -> (1) -> A. -> i.). `family: "rule_series"` gates a completely
    # separate parsing path (see `parse_reg_rule_series` and the
    # "ECMC rule-series family" section below) that this key alone selects —
    # every other regulation's `family` is absent/None and keeps using the
    # AQCC Part/Section pipeline unchanged. See ECMC_BRIEF.md.
    "ecmc": {
        "family": "rule_series",
        "jurisdiction_level": "state", "issuing_body": "ECMC",
        "source_url": "https://ecmc.colorado.gov/regulatory/rules",
        "root_citation": "Code of Colorado Regulations · 2 CCR 404-1",
        # Title page (page 1 of ECMC.pdf / ECMC.txt lines 1-24) prints, after
        # the Dept./Commission lines: "PRACTICE AND PROCEDURE" then "2 CCR
        # 404-1" on their own lines — that IS the document's printed title
        # (the official CCR name for this whole rule set), even though it
        # covers far more than Part 500's "Rules of Practice and Procedure".
        "root_title": "PRACTICE AND PROCEDURE 2 CCR 404-1",
    },
    "11": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 11",
        # Title page (REG_11.txt lines 18-24) prints "REGULATION NUMBER 11" /
        # "MOTOR VEHICLE EMISSIONS INSPECTION PROGRAM" / "5 CCR 1001-13" on
        # separate lines — name with the number stripped off, plus the cite.
        "root_title": "MOTOR VEHICLE EMISSIONS INSPECTION PROGRAM 5 CCR 1001-13",
        # Parts F and G each print real regulatory text between the PART
        # heading and their first section ("In order for a vehicle (owner)
        # to obtain a Certificate of Emissions Compliance, the exhaust and
        # evaporative emissions ... may not exceed the applicable maximum
        # concentrations..." / "Effective April 1, 2027 ... a High Emitter
        # Program shall be established.") — same shape as Reg 2's Part A,
        # same flag (see REG_META["2"]).
        "part_intro_text": True,
        # Part D's heading wraps onto SIX physical lines ("Qualification and
        # Licensing of Emissions Mechanics, ... / ... / Qualification of
        # Clean Screen Inspection Sites; and Registration of Emissions /
        # Related Repair Facilities and Technicians" — REG_11.txt lines
        # 1856-1861); the default 3-line continuation cap truncated it after
        # "Enhanced Inspection Centers;" and, with `part_intro_text` on,
        # dropped the last two lines entirely (they precede the first blank
        # line, so the intro collector never saw them). Only the cap changes;
        # the continuation still stops at a blank line or any label-shaped
        # line, exactly as before.
        "part_heading_max_lines": 6,
    },
    # Reg 27 (5 CCR 1001-31, effective 02/14/2025) — the ordinary AQCC
    # Part A-E shape (`grep -n "^\s*PART [A-Z]" sources/REG_27.txt`: A
    # General Provisions, B GEMM 2 Facility Requirements, C Energy-Intensive
    # Trade-Exposed Stationary Source Requirements, D Greenhouse Gas Credit
    # Trading, E Statements of Basis). Title page (REG_27.txt lines 17-21)
    # prints "REGULATION NUMBER 27" / "GREENHOUSE GAS EMISSIONS AND ENERGY
    # MANAGEMENT FOR MANUFACTURING" / "5 CCR 1001-31" on separate lines —
    # same convention as Reg 3/26/30 (number stripped, title + cite kept).
    # Every compound label prints its full dotted path ("II.A.", "I.A.1.b.
    # (iv)(A)") — tokenize_by_cycle/CYCLE_AB unchanged. Part A Section II
    # is the definitions list, one printed "II.<letters>." item per term
    # (II.A. through II.ZZ., then II.AAA. through II.QQQ. — 69 terms,
    # ordinary item rows like Reg 22; see `triple_letter_labels` below).
    # See SOB_PART_CONFIG["27"] (Part E), TABLE_CAPTION_PINS /
    # ITEM_TABLE_SPLICE_REGS / UNCAPTIONED_TABLES["27"] (its eight tables).
    "27": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 27",
        "root_title": "GREENHOUSE GAS EMISSIONS AND ENERGY MANAGEMENT FOR MANUFACTURING 5 CCR 1001-31",
        # clean_pages splices pages together with NO blank line at the seam
        # (see its docstring — that is what keeps a paragraph that wraps
        # across a page break whole). The flip side: a one-line paragraph
        # printed at the TOP of a page — Reg 27's Part E prints its
        # "Basis" / "Specific Statutory Authority" / "Purpose" /
        # "Transparency" / "Points of Compliance" / "Incorporation by
        # Reference" / "State-Managed GHG Reduction Fund" sub-headings and
        # the "TABLE 1"/"TABLE 2"/"Table 5" captions this way — is chained
        # onto the previous page's last line and printed as the tail of the
        # preceding paragraph ("...requirements of the existing rule.
        # Specific Statutory Authority"). This flag makes clean_pages insert
        # a paragraph break at a seam whose new page opens with a standalone
        # line (its first surviving line followed by a blank line, or the
        # page's only line). Confirmed against every such seam in
        # REG_27.txt (19 of them: 13 sub-headings, 3 table captions, 2
        # section/part headings, 1 "(VIII)" list item — all genuinely
        # paragraph-initial; a paragraph's final wrapped line such as
        # "...somewhere in\n<page>\nbetween." is NEVER followed by a blank
        # line in this print, so none are split). Off — and clean_pages
        # byte-identical — for every regulation that doesn't set it; the
        # same fusion exists in the live Reg 7/26/30 rows (2/4/1 instances)
        # and is deliberately left alone there.
        "seam_standalone_line_breaks": True,
        # The definitions list's labels reach three letters ("II.AAA." ..
        # "II.QQQ.") — see FAMILY_REGEX_TRIPLE_UPPER / family_regex_for.
        "triple_letter_labels": True,
    },
    # Reg 28 (5 CCR 1001-32, effective 06/17/2026) — the ordinary AQCC
    # Part A-F shape (`grep -n "^\s*PART [A-Z]" sources/REG_28.txt`: A
    # Applicability and General Provisions, B Benchmarking and Reporting
    # Requirements, C Building Performance Standards and Compliance
    # Pathways, D Recordkeeping, E Penalties, F Statements of Basis). Title
    # page (REG_28.txt lines 17-21) prints the name across TWO lines —
    # "REGULATION NUMBER 28 BUILDING BENCHMARKING AND PERFORMANCE" /
    # "STANDARDS" — then "5 CCR 1001-32" on its own line; joined, with the
    # number stripped, plus the cite (the same convention as Reg 3/26/27/30).
    # Every compound label prints its full dotted path ("II.A.", "I.B.2.a.
    # (iv)") — tokenize_by_cycle/CYCLE_AB unchanged. Part A Section III is
    # the definitions list, one printed "III.<letters>." item per term
    # (III.A. through III.YY. — 51 terms, ordinary item rows like Reg 22/27;
    # two letters is enough, so no `triple_letter_labels`). See
    # SOB_PART_CONFIG["28"] (Part F) and LAYOUT_TEXT_TABLES["28"] (its one
    # table, Part C Table 1, reprinted across PDF pages 25-28).
    "28": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations \u00b7 Regulation Number 28",
        "root_title": "BUILDING BENCHMARKING AND PERFORMANCE STANDARDS 5 CCR 1001-32",
    },
    "30": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 30",
        # Title page (REG_30.txt lines 1-25) prints "REGULATION NUMBER 30
        # TOXIC AIR CONTAMINANTS" then "5 CCR 1001-34" on its own line — the
        # name, with the number stripped off, plus the cite.
        "root_title": "TOXIC AIR CONTAMINANTS 5 CCR 1001-34",
    },
    # Batch 7: Regulation Number 31 (Control of Methane Emissions from
    # Municipal Solid Waste Landfills, 5 CCR 1001-35, effective 02/14/2026;
    # SOS ruleVersionId 12387, ruleId 3469; 117 pages, 6,060 lines) — the
    # ordinary AQCC shape: eleven PART headings A..K, roman sections under
    # each, the default CYCLE_AB ladder (roman → upper → digit → lower; the
    # print never goes deeper than four levels) and a statement-of-basis
    # Part K (see SOB_PART_CONFIG["31"]). The title page (REG_31.txt lines
    # 18-24) prints "REGULATION NUMBER 31" / "Control of Methane Emissions
    # from Municipal Solid Waste Landfills" / "5 CCR 1001-35" on separate
    # lines, the name in MIXED case (like Reg 30's title page) — upper-cased
    # here to match every other root_title in this dict.
    "31": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 31",
        "root_title": "CONTROL OF METHANE EMISSIONS FROM MUNICIPAL SOLID WASTE LANDFILLS 5 CCR 1001-35",
    },
    "12": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations \u00b7 Regulation Number 12",
        # Title page (REG_12.txt lines 16-18) prints "REGULATION NUMBER 12
        # REDUCTION OF DIESEL VEHICLE EMISSIONS" then "5 CCR 1001-15" on its
        # own line — the name, with the number stripped off, plus the cite
        # (same convention as Reg 30).
        "root_title": "REDUCTION OF DIESEL VEHICLE EMISSIONS 5 CCR 1001-15",
    },
    # Reg 19 (5 CCR 1001-23, effective 01/14/2022) — the ordinary AQCC
    # Part A-C shape (`grep -n "^PART [A-Z]" sources/REG_19.txt`: A
    # Lead-Based Paint Activities, B Pre-Renovation Education in Target
    # Housing and Child-Occupied Facilities, C Statements of Basis). Title
    # page (REG_19.txt lines 17-21) prints "REGULATION NUMBER 19" / "THE
    # CONTROL OF LEAD HAZARDS" / "5 CCR 1001-23" on separate lines — same
    # convention as Reg 3/26/30 (number stripped, title + cite kept). Every
    # compound label prints its full dotted path ("I.A.", "II.B.48.",
    # "V.J.2.b.(i)") — tokenize_by_cycle/CYCLE_AB unchanged. See
    # SOB_PART_CONFIG["19"] (Part C) and `centered_appendix_headings` below.
    "19": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 19",
        "root_title": "THE CONTROL OF LEAD HAZARDS 5 CCR 1001-23",
        # Reg 19's one appendix (Part A's "APPENDIX A — Number of Units to
        # be Tested in Pre-1978 Multifamily Developments", REG_19.txt line
        # 3125) is printed CENTRED — 46 spaces of indent, then "APPENDIX A"
        # alone on its line, a blank, the centred title line, another
        # blank, then "(Section V.J.2.b.)" — unlike every other appendix in
        # the corpus (all flush-left, indent 0, which the Appendix branch of
        # scan_markers requires). With this flag the branch matches the
        # STRIPPED line at any indent and, when the heading line carries no
        # title of its own, skips the one blank line to pick the title up
        # (the same one-blank skip Reg 1's part-less appendices use). Off
        # (absent) for every other reg, so their appendix scan is unchanged.
        "centered_appendix_headings": True,
        # Same page-seam shape Reg 27 has: 25 of Reg 19's pages open with a
        # one-line paragraph followed by a blank — a label line, a PART /
        # APPENDIX heading, a statement-of-basis sub-heading ("Training and
        # Certification", "Basis", "Recertification (Section III.B.5)" —
        # REG_19.txt lines 3757/4059/4243), the centred "WARNING" sign
        # line of V.C.2.a. (line 2287) and a signature-line rule of the
        # Part B V.A.2. sample form (line 3589) —
        # every one of them a genuine paragraph break, never the last line
        # of a wrapped sentence (all 25 seams listed and checked by hand),
        # so, as for Reg 27, the seam gets a blank line instead of chaining
        # the line onto the previous page's paragraph.
        "seam_standalone_line_breaks": True,
    },
    # -- Batch 6: three small part-less AQCC documents -------------------
    # Reg 16 (Street Sanding Emissions, 5 CCR 1001-18, effective 04/20/2007,
    # 9 pages): NO "PART X" headings (`grep -n "^\s*PART [A-Z]"
    # sources/REG_16.txt` is empty) — three top-level roman sections, "I.
    # Street Sanding Materials Specifications", "II. Street Sanding
    # Requirements Specific to the Denver PM10 Attainment/Maintenance Area",
    # "III. Statements of Basis, Specific Statutory Authority and Purpose"
    # (SOB_PART_CONFIG["16"]). Labels print the full dotted compound path
    # ("I.B.1.", "II.D.1.a.") — CYCLE_AB unchanged — but with six typo'd
    # labels (a capital I for the digit 1, a capital C for the letter c, a
    # comma or nothing for the trailing dot; see KNOWN_LABEL_FIXES["16"]).
    # Title page (REG_16.txt line 20) prints "REGULATION NUMBER 16 STREET
    # SANDING EMISSIONS" on one line and "5 CCR 1001-18" on the next — the
    # name with the number stripped off, plus the cite (Reg 30 convention).
    "16": {
        "no_parts": True,
        "seam_paragraph_breaks": True,  # every page seam is a paragraph break — see clean_pages
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 16",
        "root_title": "STREET SANDING EMISSIONS 5 CCR 1001-18",
    },
    # The SIP Local Elements document (5 CCR 1001-20, effective 12/30/2008,
    # 22 pages) — "STATE IMPLEMENTATION PLAN, SPECIFIC REGULATIONS FOR
    # NONATTAINMENT-ATTAINMENT/MAINTENANCE AREAS (LOCAL ELEMENTS)": not a
    # numbered regulation at all (no "REGULATION NUMBER" line on the title
    # page; the title wraps over REG_SIP.txt lines 20-21, joined with a
    # space, then "5 CCR 1001-20"), so it takes the name key "sip" like the
    # Common Provisions' "cp". Part-less (`no_parts`); the body is an
    # unlabeled "INTRODUCTION" preamble (`preamble_heading` — its "A."/"B."
    # paragraphs precede Section I and stay inside the preamble row, since
    # the bare ladder's chain only opens on "I."), then one roman section
    # per area: I Pagosa Springs, II Telluride, III Aspen/Pitkin County, IV
    # Lamar, V Canon City, VI City of Fort Collins (Repealed), VII Colorado
    # Springs, VIII Steamboat Springs. Every label prints BARE ("A.", "1.",
    # "a.", "i.", "(a)") like Reg 9 — see BARE_LADDER_REGS /
    # BARE_LADDER_FAMILIES. There is NO trailing statement-of-basis section
    # (no SOB_PART_CONFIG entry): each area carries its own statement of
    # basis as an ordinary lettered subsection ("I.D.", "II.C.", "III.D.",
    # "VI.A.", "VII.A.", "VIII.F.") or, for Lamar/Canon City, as the
    # section's own body text — parsed as ordinary ladder rows (VIII.F. is
    # a leaf, see BARE_LADDER_LEAF_CHAINS). Section VIII.A. misnumbers its
    # last three definitions (KNOWN_LABEL_FIXES["sip"]); VIII.B.5. prints
    # "c."/"d." with no "a."/"b." (KNOWN_LABEL_ANOMALIES["sip"]).
    "sip": {
        "no_parts": True,
        "seam_paragraph_breaks": True,  # every page seam is a paragraph break — see clean_pages
        "preamble_heading": "INTRODUCTION",
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · SIP Local Elements",
        "root_title": (
            "STATE IMPLEMENTATION PLAN, SPECIFIC REGULATIONS FOR NONATTAINMENT-"
            "ATTAINMENT/MAINTENANCE AREAS (LOCAL ELEMENTS) 5 CCR 1001-20"
        ),
    },
    # Reg 18 (Control of Emissions of Acid Deposition Precursors, 5 CCR
    # 1001-22, effective 12/15/2012, 6 pages): part-less, two top-level
    # sections only. Section "I." is printed as a BARE label alone on its
    # line (REG_18.txt line 25) with no heading text at all — the operative
    # text (the incorporation by reference of 40 CFR Parts 72 and 76, two
    # term definitions, the Reg 3 precedence clause and the Commission's
    # commitment) follows as five unlabeled paragraphs, so the section row
    # is titled by its bare citation "I." and carries all of them as body.
    # "II. Statement of Basis, Specific Statutory Authority and Purpose" is
    # the SOB section (SOB_PART_CONFIG["18"]). Title page (line 20) prints
    # "REGULATION NUMBER 18 CONTROL OF EMISSIONS OF ACID DEPOSITION
    # PRECURSORS" then "5 CCR 1001-22" — Reg 30 convention.
    "18": {
        "no_parts": True,
        "seam_paragraph_breaks": True,  # every page seam is a paragraph break — see clean_pages
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 18",
        "root_title": "CONTROL OF EMISSIONS OF ACID DEPOSITION PRECURSORS 5 CCR 1001-22",
    },
    "25": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 25",
        # Title page (REG_25.txt lines 16-22) prints "REGULATION NUMBER 25",
        # then the title on two wrapped lines, then "5 CCR 1001-29" on its
        # own line — same convention as Reg 3/24/26/30 (number prefix
        # dropped, the two title lines joined with a space, plus the cite).
        "root_title": (
            "CONTROL OF EMISSIONS FROM SURFACE COATING, SOLVENTS, ASPHALT, "
            "GRAPHIC ARTS AND PRINTING, AND PHARMACEUTICALS 5 CCR 1001-29"
        ),
    },
    # Batch 6: "Air Quality Standards, Designations and Emission Budgets"
    # (5 CCR 1001-14, reg key "aqs") — the AQCC document that is NOT a
    # numbered regulation: it holds the Colorado ambient standards (Section
    # I), the nonattainment / attainment-maintenance area classifications
    # and maps (Section III), the visibility standard (IV), the motor
    # vehicle emissions budgets (V), the Eisenhower Tunnel CO standard (VI),
    # the standards rationale (VII) and the statements of basis (VIII).
    # Part-less like Reg 1 / cp / 9 (`grep -n "^\s*PART [A-Z]"
    # sources/REG_AQS.txt` is empty): the body runs straight from "I.
    # Ambient Air Quality Standards" to "VIII. Statements of Basis, Specific
    # Statutory Authority and Purpose", every label printed as the full
    # dotted compound ("I.B.1.", "V.A.4.e.", "VIII.DD."), so ids are
    # `sec-aqs-I-B-1`, `sec-aqs-V-A-4-e`, `sec-aqs-VIII-DD`. There is no
    # front-matter outline, so `find_body_start_no_parts` falls back to 0
    # and the cover / incorporation-by-reference boilerplate before "I." is
    # unowned front matter, exactly as for Reg 1. Title page (REG_AQS.txt
    # lines 15-16) prints the title then "5 CCR 1001-14" on its own line.
    # See SOB_SECTION_CONFIG["aqs"] (Section VIII), UNCAPTIONED_TABLES /
    # COLUMN_LAYOUT_TABLES / ITEM_FIGURES ["aqs"] (the area-classification
    # table, the emissions-budget table and the nine area maps), and
    # KNOWN_LABEL_FIXES / KNOWN_TEXT_FIXES ["aqs"].
    "aqs": {
        "no_parts": True,
        # Several headings are printed directly above their body text with
        # no blank line ("IV. Visibility Standard" / "To be added to ...",
        # "VI. Carbon Monoxide Standard ... (State Only)" / "Pursuant to
        # ...", "V.C.1. Geographic Coverage", "V.A.4.e." .. "V.A.4.j.") —
        # see `_inline_heading_stands_alone`; off (a no-op) for every other
        # regulation.
        "heading_line_own_paragraph": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Air Quality Standards, Designations and Emission Budgets",
        "root_title": "AIR QUALITY STANDARDS, DESIGNATIONS AND EMISSION BUDGETS 5 CCR 1001-14",
    },
    # Batch 7: the AQCC Procedural Rules (5 CCR 1001-1, key "proc",
    # effective 02/14/2025) — the Commission's own hearing/rulemaking/
    # adjudication procedure, carrying no regulation number (cited by name
    # by nearly every other AQCC regulation; see PROC_RULES_MENTION_RE).
    # Structure: the ordinary AQCC two-part shape, NOT a part-less document
    # — sources/REG_PROC.txt prints exactly four "PART [A-Z]" lines, two
    # in the front-matter outlines (lines 29 and 151) and two real headings
    # (line 283 "PART A ... before August 1, 2025 ...", line 3050 "PART B
    # ... on or After August 1, 2025 ..."). Part A is the pre-8/1/2025
    # procedure kept alive for proceedings already begun; Part B is the
    # procedure from 8/1/2025 on. `find_body_start`'s "last PART A <title>
    # line" rule lands on line 283 unchanged, so BOTH front-matter outlines
    # (Part A's at 29-149 and Part B's at 151-281) are skipped with no new
    # config — which is why there is no `no_parts` flag here.
    # Both part headings wrap onto THREE printed lines (the default
    # `part_heading_max_lines` of 3 is exactly enough).
    # Sections are CAPS romans I..XI (Part A) and I..XII (Part B); every
    # deeper label prints its full dotted path ("II.A.", "V.E.5.c.(ix)"),
    # so tokenize_by_cycle/CYCLE_AB handle them unchanged.
    # See SOB_SECTION_CONFIG["proc"] (Part B Section XII — the statements
    # of basis are the last SECTION of Part B, the Reg 8/aqs shape, not a
    # part of their own; Part A's outline lists a Section XII but the body
    # prints none — see REPORT.md gate A) and KNOWN_LABEL_FIXES["proc"].
    # Title page (REG_PROC.txt lines 17-21) prints "PROCEDURAL RULES" then
    # "5 CCR 1001-1" on its own line — the Reg 3/8/24/26 convention.
    "proc": {
        # Part B's definitions III.I ("Department of Law") and III.J
        # ("Division") are the document's ONLY two labels printed without
        # the trailing dot every other label carries ("III.I    Department
        # of Law: ...", REG_PROC.txt 3194/3205 — confirmed in the PDF's own
        # text layer with pdfplumber, page 53, so it is a print, not a
        # pdftotext artifact). Without the flag neither tokenized and both
        # definitions were folded into III.H's row, leaving the Part B
        # definitions sequence reading H -> K. Same sporadic quirk, and the
        # same fix, as Reg 20's fifteen labels and GP01/02/06/07/08/11 — see
        # FAMILY_REGEX_NO_TRAILING_DOT.
        "labels_without_trailing_dot": True,
        # Each PART heading is followed by one paragraph of real regulatory
        # text before Section I — the sunset/savings clause that decides
        # WHICH part governs a given proceeding ("The rules as set forth in
        # this Part A will cease to apply on August 1, 2025; provided,
        # however, ...", REG_PROC.txt 287-290, and Part B's counterpart at
        # 3054-3057). Part rows are heading-only everywhere else in the
        # corpus, so without this flag both paragraphs were silently
        # dropped (found by the gate-B coverage count). Same mechanism, and
        # the same reason, as Reg 2's Part A lead-in sentence.
        "part_intro_text": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · AQCC Procedural Rules",
        "root_title": "PROCEDURAL RULES 5 CCR 1001-1",
    },
    # Reg 20 (5 CCR 1001-24, effective 12/15/2023) — the ordinary AQCC
    # Part A-I shape (`grep -n "^\s*PART [A-Z]" sources/REG_20.txt`: A
    # General Provisions/Definitions/Severability, B LEV, C Aftermarket
    # Exhaust Treatment Devices, D ZEV, E HD Low NOx, F ACT, G Large Entity
    # Reporting, H Incorporations by Reference, I Statements of Basis).
    # Title page (REG_20.txt lines 19-23) prints "REGULATION NUMBER 20" /
    # "COLORADO CLEAN CARS AND TRUCKS REGULATION" / "5 CCR 1001-24" on
    # separate lines — same convention as Reg 11/12/30 (number stripped,
    # title + cite kept). Every compound label prints its full dotted path
    # ("I.B.", "IV.A.1.a.(i)") — tokenize_by_cycle/CYCLE_AB unchanged — but
    # FIFTEEN labels omit the trailing period the rest of the document
    # prints, exactly the sporadic GP01/GP08 quirk `labels_without_trailing_
    # dot` (FAMILY_REGEX_NO_TRAILING_DOT) was widened for: Part A "II.J",
    # "II.T", "II.Y" (REG_20.txt lines 166/223/245 — the definitions of
    # "Financial assistance program", "NZEV", "Ultimate Purchaser"), Part D
    # "I.A" (594), "II.A" (611), "IV.B.3" (720), "V.A.1" (732), "V.B.2"
    # (777), "V.B.6" (805), "V.C.3" (839), "VI.B.2" (888) and Part G
    # "III.C.1"-"III.C.4" (1145-1156). Without the flag none of them
    # tokenized: each was folded into the previous sibling's text and the
    # label gate reported sequences such as II. A..I, K..S, U..X, Z, AA.
    # See SOB_PART_CONFIG["20"] (Part I), FLAT_ENTRY_PART_CONFIG["20"] and
    # UNCAPTIONED_TABLES["20"] (Part H, a section-less incorporation-by-
    # reference part whose body is one six-page table).
    "20": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 20",
        "root_title": "COLORADO CLEAN CARS AND TRUCKS REGULATION 5 CCR 1001-24",
        "labels_without_trailing_dot": True,
    },
    # Batch 7: Regulation Number 23 (Regional Haze Limits, 5 CCR 1001-27,
    # effective 01/30/2022; SOS ruleVersionId 9985, ruleId 3344; 39 pages,
    # 2,453 lines). Ordinary AQCC two-part shape — `grep -n "PART [A-Z]"
    # sources/REG_23.txt` gives exactly four hits, two of which are the
    # printed "Outline of Regulation" front matter (lines 31/43) and two the
    # real body headings: "PART A  Regional Haze Limits - Best Available
    # Retrofit Technology (BART) and Reasonable Progress (RP)" (line 80,
    # wrapped over two lines — within the default `part_heading_max_lines`)
    # and "PART B  STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND
    # PURPOSE" (line 1922). Part A runs sections I Applicability, II
    # Definitions, III Challenge of Division BART Determinations and
    # Enforceable Agreements, IV Regional Haze Determinations (the bulk —
    # the per-unit emission-limit tables) and V Monitoring, Recordkeeping,
    # and Reporting. Every compound label prints its full dotted path
    # ("II.B.1.a.(i)", "V.A.3.d.(ii)(A)") so tokenize_by_cycle/CYCLE_AB are
    # unchanged. Title page (REG_23.txt lines 19-23) prints "REGULATION
    # NUMBER 23" / "REGIONAL HAZE LIMITS" / "5 CCR 1001-27" on separate
    # lines — the Reg 11/12/20/30 convention (number stripped, title + cite
    # kept). See SOB_PART_CONFIG["23"] (Part B) and UNCAPTIONED_TABLES["23"]
    # (the five whitespace-aligned determination tables in Section IV).
    "23": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 23",
        "root_title": "REGIONAL HAZE LIMITS 5 CCR 1001-27",
    },
    # Reg 21 (5 CCR 1001-25, effective 02/14/2023; SOS ruleVersionId 10677,
    # ruleId 3303) — the ordinary AQCC Part A-C shape (`grep -n "^\s*PART
    # [A-Z]" sources/REG_21.txt`: A Concerning Consumer Products, B
    # Concerning Architectural and Industrial Maintenance Coatings, C
    # Statements of Basis). Title page (REG_21.txt lines 17-20) prints
    # "REGULATION NUMBER 21  CONTROL OF VOLATILE ORGANIC COMPOUNDS FROM" (a
    # DOUBLE space after "21" in the source — normalized to one) wrapped onto
    # "CONSUMER PRODUCTS AND ARCHITECTURAL AND INDUSTRIAL MAINTENANCE
    # COATINGS", then "5 CCR 1001-25" on its own line — same convention as
    # Reg 3/24/25/26 (number prefix dropped, the two title lines joined with
    # a space, plus the cite). Parts A and B each run the same six sections
    # (I Applicability, II Standards, III Container labeling, IV Reporting,
    # V Test methods, VI Definitions); every compound label prints its full
    # dotted path ("II.N.7.", "IV.D.9.e.", "V.A.1.b.(ii)" — max depth 5), so
    # tokenize_by_cycle/CYCLE_AB are unchanged. See SOB_PART_CONFIG["21"]
    # (Part C), ITEM_TABLE_SPLICE_MODE / TABLE_CAPTION_SPANS["21"] (the two
    # multi-page "Table 1" VOC-limit tables), KNOWN_LABEL_FIXES["21"] and
    # KNOWN_LABEL_ANOMALIES["21"] (the Part A definitions list's misprints).
    "21": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 21",
        "root_title": (
            "CONTROL OF VOLATILE ORGANIC COMPOUNDS FROM CONSUMER PRODUCTS AND "
            "ARCHITECTURAL AND INDUSTRIAL MAINTENANCE COATINGS 5 CCR 1001-25"
        ),
        # Part A's definitions labels reach SEVEN letters ("VI.QQQQQQQ.") —
        # see FAMILY_REGEX_MULTI_UPPER / family_regex_for.
        "multi_letter_labels": True,
        # Same page-top fusion Reg 27's Part E has (see REG_META["27"]): Part
        # C's "Specific Statutory Authority" (page 50) and "Additional
        # Considerations" (page 52) sub-headings open a page and were chained
        # onto the previous page's last sentence. Confirmed against every
        # seam in REG_21.txt: the 18 seams the flag breaks are 10 reprinted
        # "Table 1" captions (consumed by the table splice either way), 6
        # part/section/item label lines (already paragraph-initial) and
        # those 2 sub-headings; no wrapped paragraph tail is ever followed
        # by a blank line in this print. The (I)/(X)/(XI) finding items that
        # open pages 51/53/54 are two-line paragraphs, which the flag by
        # design leaves joined to the previous item.
        "seam_standalone_line_breaks": True,
    },
    # -- Batch 7 ---------------------------------------------------------
    # Reg 10 (Criteria for Analysis of Transportation Conformity, 5 CCR
    # 1001-12, effective 03/30/2016; SOS ruleVersionId 6679, ruleId 2345;
    # 17 pages / 1,015 lines). Part-less (`grep -nE "^\s*PART [A-Z]"
    # sources/REG_10.txt` is empty — the "Part B, Transportation
    # Conformity" mentions in the statements of basis are prose about the
    # regulation's PRE-2012 structure, not headings), so `no_parts: True`
    # like Reg 1/9/16/18/aqs/cp/sip: the body is one run of top-level roman
    # sections, I through VI, and ids omit the part segment
    # (`sec-10-III-A-3-a`). Every label prints the FULL dotted compound
    # path ("I.A.", "III.A.3.a.", "III.H.2.b.") so tokenize_by_cycle /
    # CYCLE_AB are unchanged. There is no front-matter outline at all, so
    # `find_body_start_no_parts` falls back to 0 and the title page /
    # editor's-note boilerplate before "I." is unowned front matter,
    # exactly as for Reg 1 and aqs.
    #
    # Title page (REG_10.txt line 20) prints "REGULATION NUMBER 10 CRITERIA
    # FOR ANALYSIS OF TRANSPORTATION CONFORMITY" on one line and "5 CCR
    # 1001-12" on the next — the Reg 16/18/30 convention (number stripped,
    # name + cite kept). NOTE the CCR index calls this rule "Criteria for
    # Analysis of Transportation CONFORMITY" while several of the
    # regulation's own statement-of-basis entries call it "Criteria for
    # Analysis of Conformity"; the TITLE PAGE spelling is what is used here.
    #
    # See SOB_PART_CONFIG["10"] (Section VI).
    "10": {
        "no_parts": True,
        # Every page seam is a paragraph break: confirmed line by line
        # against all 17 seams in REG_10.txt — 12 open a marker line, 2 open
        # a new Section II definition ("Metropolitan planning organization
        # (MPO) ...", "Transportation Plan in the context of this regulation
        # ..."), and 3 open a new statement-of-basis paragraph or
        # sub-heading; not one continues a wrapped sentence. Without the
        # flag those two definitions were spliced onto the tail of the
        # preceding definition's paragraph (LPA and TIP), so Section II read
        # as 11 paragraphs instead of the 13 printed. See clean_pages.
        "seam_paragraph_breaks": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 10",
        "root_title": "CRITERIA FOR ANALYSIS OF TRANSPORTATION CONFORMITY 5 CCR 1001-12",
    },
    # Reg 15 (Control of Emissions of Ozone-Depleting Compounds, 5 CCR
    # 1001-19, effective 10/30/2008; SOS ruleVersionId 2600, ruleId 2351;
    # 7 pages / 413 lines — the smallest AQCC document in the corpus after
    # Reg 18). Part-less (`grep -nE "^\s*PART [A-Z]" sources/REG_15.txt` is
    # empty; the "§ XII of Part C of Regulation No. 15" in the 1997
    # statement of basis describes the regulation's pre-1998 structure),
    # and — unlike Reg 10 above — every label prints BARE ("A.", "B.",
    # "1.") with no compound dotted path anywhere (`grep -nE
    # "^\s*[IVX]+\.[A-Z]\." sources/REG_15.txt` is empty), so it joins Reg
    # 9 and the SIP Local Elements document in BARE_LADDER_REGS with the
    # default roman/upper/digit/lower family list. Six top-level sections:
    # I Definitions, II General Requirements, III Registration Requirements
    # for Stationary Appliances and Refrigerated Food Appliances, IV
    # Notification and Reporting Requirements for Air Conditioning and
    # Refrigeration Service Facilities (its heading WRAPS onto a second
    # line), V Motor Vehicle Air Conditioning Service Requirements, VI
    # Statements of Basis. No lettered list in the document reaches "I."
    # (the longest is Section I's A..G), so the bare ladder never has to
    # choose between a 9th definition letter and a new roman section.
    #
    # Title page (REG_15.txt line 20) prints "REGULATION NUMBER 15 CONTROL
    # OF EMISSIONS OF OZONE-DEPLETING COMPOUNDS" then "5 CCR 1001-19" — the
    # Reg 16/18/30 convention. Page furniture is the SHORT footer form
    # ("Code of Colorado Regulations<spaces><page number>" on one line —
    # `_FOOTER_CCR_PAGE_RE`), not the Reg 10/29 three-line header block.
    #
    # See SOB_PART_CONFIG["15"] (Section VI).
    "15": {
        "no_parts": True,
        # Every page seam is a paragraph break: confirmed against all six
        # seams in REG_15.txt — two open a marker line ("C.", "3.") and four
        # open a new statement-of-basis paragraph, three of them directly
        # after a bare sub-heading line ("FEDERAL REQUIREMENTS", "Federal
        # Requirements", "COLORADO AIR QUALITY CONTROL COMMISSION") that
        # would otherwise be glued to the body text below it. Same flag Reg
        # 16/18/sip carry. See clean_pages.
        "seam_paragraph_breaks": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 15",
        "root_title": "CONTROL OF EMISSIONS OF OZONE-DEPLETING COMPOUNDS 5 CCR 1001-19",
    },
    # Reg 29 (Emission Reduction Requirements for Lawn and Garden
    # Equipment, 5 CCR 1001-33, effective 04/15/2024; SOS ruleVersionId
    # 11408, ruleId 3435; 7 pages / 424 lines). The ordinary AQCC part
    # shape, with only TWO parts: "PART A  Emission Reduction Requirements
    # for Lawn and Garden Equipment" (Sections I Applicability and general
    # provisions, II Definitions, III Use restrictions, IV Recordkeeping
    # and reporting) and "PART B  STATEMENTS OF BASIS, SPECIFIC STATUTORY
    # AUTHORITY AND PURPOSE". The four `PART [A-Z]` matches the survey
    # reported are those two headings printed twice each — once in the
    # front-matter "Outline of Regulation" (lines 31/33) and once in the
    # body (lines 42/215); `find_body_start` already skips the outline
    # copy. Every label prints the full dotted compound path ("I.B.5.",
    # "IV.B.3.a.") so tokenize_by_cycle / CYCLE_AB are unchanged.
    #
    # Title page (REG_29.txt lines 20-24) prints "REGULATION NUMBER 29",
    # then the title on its own line, then "5 CCR 1001-33" — the Reg
    # 11/12/20/30 convention (number stripped, title + cite kept).
    #
    # See SOB_PART_CONFIG["29"] (Part B) and KNOWN_LABEL_FIXES["29"] /
    # KNOWN_TEXT_FIXES["29"] (the fused "Section IV.I.C. Severability."
    # line and the missing trailing dot on "III.C").
    "29": {
        # Every page seam is a paragraph break: confirmed against all six
        # seams in REG_29.txt — three open a marker line ("II.", "II.G.",
        # "IV.B.3.b.") and three open a new Part B paragraph, two of them a
        # bare sub-heading ("Purpose", "Additional Considerations") that
        # would otherwise be glued to the previous page's last sentence, and
        # one the "XII." item of the entry's own findings list. See
        # clean_pages.
        "seam_paragraph_breaks": True,
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 29",
        "root_title": "EMISSION REDUCTION REQUIREMENTS FOR LAWN AND GARDEN EQUIPMENT 5 CCR 1001-33",
    },
    # -- Batch 7: Regulation Number 4 (Sale and Installation of Wood-Burning
    # Appliances and the Use of Certain Wood Burning Appliances During High
    # Pollution Days, 5 CCR 1001-6, effective 10/15/2024, 51 pages) --------
    # Ordinary Reg 7/26-shaped AQCC document: PART A (Applicability, one
    # section), PART B (the body, sections I-X), PART C (statements of basis
    # — see SOB_PART_CONFIG["4"]) and one APPENDIX A whose body is an
    # outlined technical test protocol (see APPENDIX_LADDERS["4"] /
    # APPENDIX_LADDER_DECIMAL_DEPTH["4"]). Every compound label prints its
    # full dotted path ("I.A.6.g.", "IV.C.5.a.", "I.A.12.b.(i)" — max depth
    # 5), so tokenize_by_cycle/CYCLE_AB are unchanged.
    #
    # Title page (REG_4.txt lines 21-22) prints the title over TWO lines,
    # "SALE AND INSTALLATION OF WOOD-BURNING APPLIANCES AND THE USE OF
    # CERTAIN WOOD" / "BURNING APPLIANCES DURING HIGH POLLUTION DAYS" (the
    # break falls inside "WOOD BURNING", which is printed unhyphenated
    # there), then "5 CCR 1001-6" — the two lines joined with a space plus
    # the cite, the Reg 3/21/24/25/26 convention.
    #
    # The front-matter "Outline of Regulation" (lines 30-58) misnumbers Part
    # B: it prints "VI." twice ("List of approved wood-burning appliances"
    # at line 46 and "High pollution days" at line 48) and then jumps to
    # "VIII.". The BODY itself is correctly numbered (VI. List of Approved
    # Wood-Burning Appliances at line 491, VII. High Pollution Days at line
    # 497, VIII. at line 550), and find_body_start skips the outline
    # entirely, so the misprint never reaches the parse — it is documented
    # here and in REPORT.md rather than fixed (policy: only labels on BODY
    # lines get KNOWN_LABEL_FIXES entries).
    "4": {
        "jurisdiction_level": "state", "issuing_body": "CDPHE-APCD",
        "source_url": "https://cdphe.colorado.gov/aqcc-regulations",
        "root_citation": "Code of Colorado Regulations · Regulation Number 4",
        "root_title": (
            "SALE AND INSTALLATION OF WOOD-BURNING APPLIANCES AND THE USE OF "
            "CERTAIN WOOD BURNING APPLIANCES DURING HIGH POLLUTION DAYS 5 CCR 1001-6"
        ),
        # "APPENDIX A" (line 1036) is printed alone on its line at indent 0,
        # then a BLANK line, then its title "Test Method Protocols for
        # Measuring Wood-Burning Masonry Heater Emissions" (line 1038) — see
        # scan_markers's `appx_title_after_blank`.
        "appendix_title_after_blank": True,
    },
}

# Bucket names used for citation/reference text we recognized as
# reference-shaped but could not (or must not) turn into a link.
BUCKET_HISTORICAL = "historical"     # former structure (renumbered away; Part D/E/F, old roman Part-C sections, romans beyond the current highest section)
BUCKET_OTHER_REG = "other_reg"       # another regulation number not in the corpus
BUCKET_CFR = "cfr"                   # a CFR part/subpart not in the corpus
BUCKET_UNPARSEABLE = "unparseable"   # reference-shaped text that didn't tokenize, or a claimed-valid-part target that's still missing
# ECMC-only buckets (see link_citations_ecmc): "Form N" and "§ ..., C.R.S."
# citations are recognized reference shapes that are DELIBERATELY left as
# plain text (per ECMC_BRIEF.md — no Form/statute rows exist to link to) but
# still worth counting separately from a genuine parser gap. Additive for
# every other regulation: their `unresolved` dicts are built fresh from
# ALL_BUCKETS at parse time, so they simply get two permanently-empty
# counters that print as "0 distinct" and change no parsed JSON output.
BUCKET_FORM = "form"                 # "Form 2A", "Form 41", ...
BUCKET_CRS = "crs"                   # "§ 34-60-106, C.R.S." statute citations
# Another STATE's administrative code, incorporated by reference — Reg 20
# adopts California Code of Regulations, Title 13 sections wholesale
# ("California Code of Regulations, Title 13, Section 1962.2", "Title 13,
# Section 1961.4(c)(1)(B)", "Title 13 CCR Section 1963(c)"); see
# CALIFORNIA_CCR_REGS / CAL_CCR_RE. Recognized and counted (one entry per
# section number, normalized to "13 CCR § <section>"), deliberately left as
# plain text: the target is not a Colorado provision and the incorporated
# text is not in the corpus. Only a reg in CALIFORNIA_CCR_REGS ever fills it;
# for every other regulation the bucket is present but empty (the same
# additive shape the ECMC-only `form`/`crs` buckets already have).
BUCKET_OTHER_CCR = "other_ccr"
ALL_BUCKETS = [BUCKET_HISTORICAL, BUCKET_OTHER_REG, BUCKET_CFR, BUCKET_UNPARSEABLE, BUCKET_FORM, BUCKET_CRS,
               BUCKET_OTHER_CCR]

# Regulations that cite the California Code of Regulations, Title 13 (see
# BUCKET_OTHER_CCR). CAL_CCR_RE accepts the citation shapes REG_20.txt
# actually prints (grep-confirmed, ~100 mentions): an optional "California
# Code of Regulations[,]" or "CCR[,]" prefix, "Title 13[,]", an optional
# "CCR", then optionally "Section(s)" and a list of four-digit section
# numbers with an optional decimal part and paren sub-designations
# ("1961(a)(1)", "1962.4 (c)(1)(B)", "2222 (h)"), joined by the ordinary
# list separators (comma / and / or / through / hyphen range: "Sections
# 2109-2135", "Sections 2111 through 2133"). A bare "California Code of
# Regulations, Title 13" with no section is counted as itself. The match is
# CLAIMED so no later step re-tokenizes any part of it (none does today —
# _CITATION_TOKEN starts with a roman numeral — but the claim keeps the
# decision in one place). A reg not listed never runs the step.
CALIFORNIA_CCR_REGS: frozenset[str] = frozenset({"20"})
_CAL_SECTION_TOKEN = r"\d{4}(?:\.\d+)?(?:\s*\([a-zA-Z0-9]{1,3}\))*"
_CAL_SECTION_LIST = r"(?:" + _CAL_SECTION_TOKEN + r"(?:" + r"(?:\s*,\s*(?:and\s+|or\s+|through\s+)?|\s+and\s+|\s+or\s+|\s+through\s+|\s*[–—-]\s*)" + _CAL_SECTION_TOKEN + r")*)"
CAL_CCR_RE = re.compile(
    r"(?:California Code of Regulations,?\s+|\bCCR,?\s+)?\bTitle\s+13\b,?\s*(?:CCR\s+)?"
    r"(?:[Ss]ections?\s+(" + _CAL_SECTION_LIST + r"))?"
)
_CAL_SECTION_RE = re.compile(_CAL_SECTION_TOKEN)

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
# An APPENDIX_LADDERS appendix refers to its OWN decimal units by number --
# "as specified in Section 5.7.3.", "see Sections 5.8.8.1 and 5.8.12.1",
# "the criteria outlined in Section 3.2.2.1" -- a shape SECTION_RE's
# roman/letter citation list never matches, so those references stayed
# plain text. Each decimal component is capped at two digits, which is what
# keeps a CFR section citation out ("40 CFR Part 60, Section 60.532(b)(1)",
# "Section 60.535" -- 532/535 are three digits) along with C.R.S. section
# numbers ("Section 175a."). The trailing `(?!\d)` is what makes the digit
# cap bite: without it "Section 60.535" matched the PREFIX "60.53" and
# linked it. The trailing period a citation is printed with
# is deliberately left OUTSIDE the span: in this document it is usually the
# sentence's full stop, not part of the label.
LADDER_SECTION_RE = re.compile(
    r"\b(Sections?)\s+(\d{1,2}(?:\.\d{1,2})+)(?!\d)"
    r"(?:\s+and\s+(\d{1,2}(?:\.\d{1,2})+)(?!\d))?"
)
# Regulations whose APPENDIX_LADDERS rows get LADDER_SECTION_RE applied (see
# link_citations step 3c). Reg 11's Appendix A has the same self-reference
# shape but is NOT listed: linking it would change that regulation's
# baselined output, which this batch must leave byte-identical. Adding "11"
# here is the one-line follow-up whenever Reg 11 is next re-baselined.
APPENDIX_LADDER_XREF_REGS: frozenset[str] = frozenset({"4"})
# The GPxx general permits cite their own condition labels as "Condition
# II.A.6." / "Conditions II.A.4. and II.A.5." — never "Section" — alongside
# ordinary "Section(s)"/"Sections IV.C. and IV.D." references to OTHER
# regulations (Reg 3, 26, the Common Provisions Regulation). Gated to
# CONDITION_KEYWORD_REGS (every GP key) via `_bare_section_re`, so every
# other regulation keeps matching bare "Section(s)" only — a no-op (no
# source .txt in this batch outside GPxx uses the word "Condition" this way).
CONDITION_KEYWORD_REGS: frozenset[str] = frozenset(GP_KEYS)
SECTION_OR_CONDITION_RE = re.compile(r"\b(Sections?|Conditions?)\s+(" + _CITATION_LIST + r")")


def _bare_section_re(reg: str | None) -> re.Pattern:
    return SECTION_OR_CONDITION_RE if reg in CONDITION_KEYWORD_REGS else SECTION_RE


def _condition_dangling_words(reg: str | None) -> tuple[str, ...]:
    return ("Condition",) if reg in CONDITION_KEYWORD_REGS else ()
# "Part X[, Section(s) <list>]" — the part may be this regulation's own, or a
# former part (D, E, F, ...) that no longer exists.
PART_RE = re.compile(r"\bPart\s+([A-Z])\b(?:,\s*(Sections?)\s+(" + _CITATION_LIST + r"))?")
# Reg 12 cites its own provisions almost exclusively as "Part <letter>,
# <citation>" with NO "Section" keyword at all — "Part A, IV.C.5.", "Part B,
# II.C. of this Regulation", "Part A, II.A.2.d.", "Part B, V." (36 such
# citations in REG_12.txt vs. only 2 bare "Section X." ones and zero "Part
# X, Section" ones). PART_RE above links only the "Part X" span of that
# form and leaves the citation as plain text. This companion pattern (step
# 3b of link_citations, tried only for a reg in PART_COMMA_CITATION_REGS —
# a no-op for every other regulation, whose "Part B, II.C." would keep
# being linked as "Part B" alone exactly as today) resolves the citation
# list against THAT part, like an explicit "Part X, Section ..." does.
PART_COMMA_CITATION_REGS: frozenset[str] = frozenset({"12"})
PART_COMMA_CITE_RE = re.compile(r"\bPart\s+([A-Z]),\s*(" + _CITATION_LIST + r")")
# "Regulation Number N[, Part X[, Section(s) <list>]]" or
# "Regulation Number N[, Section(s) <list>]" (no Part named).
# Reg 30's statement-of-basis narrative cites two OTHER regulations as
# "Commission Regulation No. 3, Part B, Section III.B.5.d." and
# "Regulation No. 27, Part B, Section II.A.6." (line 4863-4864 of
# REG_30.txt) — the abbreviated "No." Reg 1/2/26 never use (confirmed:
# no "Regulation No." anywhere in their source text, so accepting it
# here is a no-op for them). Without this, "Regulation No. 3" doesn't
# match this pattern's literal "Number" keyword at all, so the citation
# falls through to a bare "Section III.B.5.d." attempt against Reg 30's
# OWN ids (BUCKET_UNPARSEABLE) instead of correctly linking to Reg 3
# (which IS in the corpus) as an external-regulation reference.
REG_NUM_RE = re.compile(
    r"\bRegulation\s+(?:Number|No\.?)\s+(?P<num>\d+)\b"
    r"(?:,\s*Part\s+(?P<part>[A-Z])\b(?:,\s*(?P<kw_p>Sections?)\s+(?P<seclist_p>" + _CITATION_LIST + r"))?"
    r"|,\s*(?P<kw_np>Sections?)\s+(?P<seclist_np>" + _CITATION_LIST + r"))?"
)
BARE_REG_RE = re.compile(r"\bRegulation\s+(?:(?:Number|No\.?)\s+)?(\d+)\b")
# A numbered regulation that is NOT an AQCC regulation: Reg 11's Appendix A
# (Attachment V, "Auditing Requirements") cites "...as prescribed by C.R.S.,
# AQCC Regulation 11, and DOR Regulation 1" — the Department of Revenue's own
# Regulation 1, which linked to AQCC Regulation Number 1 (in the corpus) as
# a false positive. A "Regulation N" mention immediately preceded by this
# agency prefix is bucketed as another regulation instead of linked.
# Confirmed a no-op for every other source: "DOR Regulation" appears only
# in REG_11.txt (grep of sources/*.txt).
_NON_AQCC_REG_PREFIX_RE = re.compile(r"\bDOR\s+$")
# A "Regulation [Number] N" mention that the surrounding sentence identifies,
# by its own CCR cite, as a rule of a DIFFERENT commission that happens to
# use the same number. The Water Quality Control Commission's regulations are
# 5 CCR 1002-NN — the same numbers as the Air Quality Control Commission's
# 5 CCR 1001-NN series — and ECMC's "CLASSIFIED WATER SUPPLY SEGMENT"
# definition (ECMC.txt lines 252-255) prints "...by the Colorado Water
# Quality Control Commission, pursuant to the Regulation Number 31, Basic
# Standards and Methodologies for Surface Water Regulations, 5 C.C.R. §
# 1002-31 (“WQCC Regulation 31”)...". Before Batch 7 that mention landed in
# BUCKET_OTHER_REG because no AQCC Regulation 31 existed; adding Reg 31 to
# CORPUS_REGS turned it into a wrong link to the landfill-methane rule. A
# mention is disqualified when the 140 characters after it carry a
# "5 C.C.R. 1002-<the same number>" cite — i.e. the text itself says which
# commission's Regulation N it means. Confirmed the ONLY match anywhere in
# the corpus (grep of every sources/*.txt for "1002-"), so a strict no-op
# for every other regulation and every other mention.
_NON_AQCC_CCR_SERIES_WINDOW = 140


def _non_aqcc_ccr_series(html_text: str, start: int, end: int, num: str) -> bool:
    """True when the text AROUND a "Regulation [Number] <num>" mention cites
    that same number in a NON-1001 CCR series (5 CCR 1002-<num>, the Water
    Quality Control Commission's) — see _NON_AQCC_REG_PREFIX_RE. Both sides
    are searched because the printed sentence puts the cite after the first
    mention ("Regulation Number 31, Basic Standards ..., 5 C.C.R. § 1002-31")
    and before the short-form one that follows it ("(“WQCC Regulation
    31”)")."""
    w = _NON_AQCC_CCR_SERIES_WINDOW
    window = html_text[max(0, start - w):end + w]
    return re.search(r"\b5\s*C\.?\s*C\.?\s*R\.?\s*§?\s*(?!1001-)\d{4}-" + re.escape(num) + r"\b", window) is not None
# The Common Provisions Regulation (reg key "cp") is cited by NAME, not by
# number, throughout the AQCC corpus — "Common Provisions Regulation",
# "Common Provisions regulation" (lower-case "r"), or bare "Common
# Provisions" with no "Regulation" word at all (confirmed: Reg 2 "the
# Commission's Common Provisions", Reg 26 "AQCC Common Provisions" — every
# instance checked names this regulation, no generic non-title use of the
# phrase exists in the corpus), optionally followed by a same-style
# "[,] Section(s) <list>" clause naming a specific provision of it (e.g.
# "Common Provisions Regulation, Section I.G.", "Common Provisions
# Regulation Section II.C." with no comma — both printed forms confirmed).
# See link_citations and _cp_known_ids.
COMMON_PROVISIONS_RE = re.compile(
    r"\bCommon Provisions(?:\s+[Rr]egulation)?\b"
    r"(?:,?\s*(Sections?)\s+(" + _CITATION_LIST + r"))?"
)
# A mention of one of the eleven GP01-GP12 general permits, anywhere in any
# regulation's text: bare "GP01" (confirmed the overwhelmingly common form —
# every GPxx permit repeatedly names itself this way, e.g. GP01.txt "not
# registered to GP01 prior to..."), the hyphenated "GP-07", and "General
# Permit GP02" (the phrase "General Permit" is not itself captured — the
# bare "GPnn" token inside it is what's matched and linked, exactly like
# COMMON_PROVISIONS_RE only ever captures "Common Provisions [Regulation]").
# No "Sections/Conditions <list>" clause is captured here (unlike
# COMMON_PROVISIONS_RE) — no source .txt in this batch ever follows a GPnn
# mention with one (every GP mentions ANOTHER regulation's sections via its
# own number: "Regulation Number 3, Part A, Section IV.A", never "GP03,
# Section ..."). See `_gp_key_for` / link_citations step 1.6.
GP_MENTION_RE = re.compile(r"\bGP-?(0[1-9]|1[0-2])\b")

# A mention of the Air Quality Standards, Designations and Emission Budgets
# document (5 CCR 1001-14, key "aqs" — see REG_META["aqs"]), which has no
# regulation NUMBER and so is never matched by REG_NUM_RE/BARE_REG_RE. The
# corpus names it four ways (grep of every sources/*.txt): "the Ambient Air
# Quality Standards regulation" / "... Rule" / "... Regulation" (Reg 7 Part
# C, twice; Reg 16 "the Colorado Ambient Air Quality Standards Regulation";
# the document's own statements of basis, ~20 times), the older short name
# "the Ambient Air Standards rule" / "the Ambient Air Standards for the
# State of Colorado rule" (its own Section VIII.A/VIII.D), the printed
# title "Air Quality Standards, Designations and Emission Budgets", and the
# CCR cite "5 CCR 1001-14" (printed only in its own running header today —
# no other source .txt prints it, but Reg 3 is expected to). The word
# "Regulation"/"Rule" after the name is REQUIRED: "Ambient Air Quality
# Standards" alone is overwhelmingly the generic NAAQS phrase ("attainment
# of the National Ambient Air Quality Standards", "state ambient air
# quality standards are met") and must never link — the "National "
# lookbehind rejects the one generic form that does carry the keyword
# ("National Ambient Air Quality Standards regulations"). Case-sensitive on
# the name: the lower-case "ambient air quality standards regulation" in
# its own VIII.L. narrative is left plain (reported). See link_citations
# step 1.7 — a strict no-op unless "aqs" is in the corpus.
AQS_MENTION_RE = re.compile(
    r"(?<!National )(?<!national )"
    r"\b(?:Colorado(?:’s|'s)?\s+)?Ambient Air (?:Quality )?Standards(?:\s+for the State of Colorado)?\s+"
    r"(?:[Rr]egulations?|[Rr]ule)\b"
    r"|\b5 CCR 1001-14\b"
    r"|\bAir Quality Standards, Designations,? and Emission Budgets\b"
)


# The SIP Local Elements document (reg key "sip", 5 CCR 1001-20) has no
# regulation number and is cited by NAME, in two printed shapes: its full
# title — "State Implementation Plan Specific Regulations for Nonattainment -
# Attainment/Maintenance Areas" (REG_SIP.txt 208-209, 443-444: with or
# without the comma after "Plan", a hyphen or en-dash or a plain space
# between "Nonattainment" and "Attainment", with or without the
# "-Specific"/"Specific" hyphen, optionally followed by "(Local Elements)"
# and/or "Regulation") and the SOB-prose short form "SIP-Specific
# Regulations" (Ambient Air Quality Standards SOB, REG_AQS.txt 1238/1261/
# 1316; REG_SIP.txt 915, 1196, 1211, 1256). The older, pre-2001 title
# "State Implementation Plan-Specific Regulations for Nonattainment Areas
# (Local Elements)" (REG_SIP.txt 422-423, 777) is the same document and
# matches too. Confirmed a no-op for every other source: neither phrase
# appears in any of Reg 1/2/3/6/7/8/9/11/12/22/24/25/26/27/30, the GP
# permits, ECMC or the Common Provisions (grep of sources/*.txt — the
# Common Provisions' "local elements of the State Implementation Plan" is a
# different phrase and does not match). See link_citations step 1.8.
SIP_LOCAL_ELEMENTS_RE = re.compile(
    r"\b(?:State Implementation Plan,?\s*[-–—]?\s*Specific Regulations?\s+for\s+Nonattainment"
    r"(?:\s*[-–—]?\s*Attainment/Maintenance)?\s+Areas(?:\s*\(Local Elements\))?(?:\s+Regulation)?"
    r"|SIP-Specific Regulations)"
)


# The AQCC Procedural Rules (reg key "proc", 5 CCR 1001-1) carry no
# regulation NUMBER, so — like "aqs" and "sip" — every other AQCC
# regulation cites them BY NAME. Two printed shapes, and they nest: the
# bare title "Procedural Rules" (always capitalised when it names the
# document — "the Air Quality Control Commission’s (Commission)
# Procedural Rules", "the Commission’s Procedural Rules", "Procedural
# Rules V. and VI."), optionally followed by the CCR citation the
# statements of basis print after it ("Procedural Rules, 5 C.C.R.
# §1001-1" in Reg 25/26, "Procedural Rules, 5 Code Colo. Reg. §1001-1"
# / "... section 1001-1" in Reg 7/30) — the optional tail is part of the
# SAME alternative so one citation produces ONE anchor, not two. The
# citation also matches on its own, for a source that prints it without
# the title.
#
# Deliberately NOT matched: lower-case "these procedural rules" / "the
# procedural rules" (the Procedural Rules' own text uses the lower-case
# form ~90 times for itself, as ordinary prose, and no other document uses
# it to cite this one), and any "5 CCR 1001-<n>" with more digits — the
# trailing \b after "1001-1" cannot match inside "1001-10"/"1001-14"/
# "1001-19", so the other AQCC documents' own cites are untouched
# (confirmed against Reg 7/25/26/30 and ECMC: the only matches are the 31
# real citations to this document, all of them in statements of basis).
PROC_RULES_MENTION_RE = re.compile(
    r"\bProcedural Rules\b"
    r"(?:,?\s+5\s+(?:C\.?C\.?R\.?|Code\s+Colo\.\s+Reg\.)\s*(?:§\s*|[Ss]ection\s+)?1001-1\b)?"
    r"|\b5\s+(?:C\.?C\.?R\.?|Code\s+Colo\.\s+Reg\.)\s*(?:§\s*|[Ss]ection\s+)?1001-1\b"
)


def _gp_key_for(num_str: str) -> str:
    return f"gp{int(num_str):02d}"


CFR_RE = re.compile(r"\b40\s+CFR\s+Part\s+(\d+)(?:,\s*Subpart\s+([A-Za-z0-9]+))?")
# "NSPS Subpart JJJJ", "NESHAP Subpart ZZZZ", "MACT Subpart ZZZZ" — program
# abbreviation + subpart, no part number (see link_citations step 1.2). The
# subpart is 2-5 capitals with an optional OOOO-style lowercase suffix, or a
# single capital WITH a suffix ("Dc", "Kb"); a bare single letter ("NSPS
# Subpart A general provisions") is deliberately not matched.
PROGRAM_SUBPART_RE = re.compile(r"\b(NSPS|NESHAP|MACT)\s+Subpart\s+((?:[A-Z]{2,5}[a-c]?|[A-Z][a-c]))\b")
# Reg 8 writes almost every CFR citation with the abbreviation dotted — "40
# C.F.R. Part 61", "40 C. F. R. Part 63, Subparts F (July 1, 2025)" (391
# dotted occurrences vs 8 undotted in the December 2025 print) — so the
# undotted CFR_RE alone missed 98% of them (they never even reached the
# `cfr` bucket of the report). This variant accepts "CFR", "C.F.R." and
# "C. F. R." and the plural "Subparts", and is used ONLY for the regs in
# CFR_DOTTED_REGS: for every other regulation the original CFR_RE keeps
# running unchanged (a dotted "40 C.F.R. Part 60, Subpart OOOOb" in Reg 7
# or 26 would otherwise newly turn into a link, changing baselined output).
CFR_RE_DOTTED = re.compile(
    r"\b40\s+C\.?\s?F\.?\s?R\.?\s+Part\s+(\d+)(?:,\s*Subparts?\s+([A-Za-z0-9]+))?"
)
# Reg 12 prints its only two CFR citations dotted as well ("40 C.F.R. Part
# 85, Subpart V, January 24, 2023" in Part A IV.D.4.b. and Part B
# III.A.4.c.), so it takes the same variant — bucketed as `cfr` (Part 85 is
# not in the corpus).
# Reg 19 too: "40 C.F.R. Part 745, Subpart Q" (Part A III.A.1.a.(ii), REG_19.txt
# line 699-700, wrapped across "40\nC.F.R."), "40 C.F.R. Part 745." and "40
# C.F.R. Part 745, Subpart E." (Part C entries I and III, lines 3715 and
# 4066) — Part 745 is EPA's lead-based paint rule, not in the corpus, so all
# three land in the `cfr` bucket. Its other CFR mentions are section-level
# or comma-broken ("40 C.F.R., Part 745, Subpart Q", "40 C.F.R. 745.227(e)",
# "40 C.F.R. section 745.223", "40 CFR Section 261.3") and stay plain text
# with either variant.
CFR_DOTTED_REGS: frozenset[str] = frozenset({"8", "12", "19"})
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


_ROMAN_PART_LETTER_RE_CACHE: dict[str, re.Pattern] = {}

# The "part letter" a part-less regulation's provisions carry internally
# (see REG_META["1"]["no_parts"]): the empty string. It is only ever a
# dictionary/namespace key inside scan_markers and build_provisions and the
# `own_part` handed to link_citations — it never appears in an id, because
# `provision_id` omits the part segment entirely for it.
NO_PART = ""


def reg_has_no_parts(reg: str | None) -> bool:
    return bool(REG_META.get(reg or "", {}).get("no_parts"))


def provision_id(reg: str, part: str, suffix: str) -> str:
    """`sec-{reg}-{part}-{suffix}` for an ordinary part, or `sec-{reg}-{suffix}`
    when `part` is NO_PART (a part-less regulation, see REG_META). Every id
    built from a part letter + token suffix goes through here so the two id
    shapes can never drift apart between the parser and the xref resolver."""
    return f"sec-{reg}-{part}-{suffix}" if part else f"sec-{reg}-{suffix}"


def _roman_part_letters(reg: str, known_ids: set[str]) -> list[str]:
    """Every part letter (sorted) that actually has a roman-numeral-style
    top level in this parse (an id `sec-{reg}-{L}-I` exists for a single
    part letter L) — i.e. every ordinary part, EXCLUDING whichever part is
    this reg's statement-of-basis part (letter_dated parts, like Reg 7's
    Part C, never have a `-I` top level at all; roman_seq parts, like Reg
    22's Part E, incidentally do start at `-I` too, but that's a
    coincidence of the family sharing a symbol with CYCLE_AB's roman level,
    not a normal nested part, so it's excluded by name via SOB_PART_CONFIG
    rather than relying on that coincidence). Scans `known_ids` directly
    (not the `sec-{reg}-P-{L}` part-root ids) so this works even against a
    partial id set that never included the part roots (e.g. a unit test
    fixture).

    A part-less regulation (REG_META `no_parts`) has exactly one implicit
    part, NO_PART, and that is what every same-reg citation resolves
    against — returned unconditionally, without scanning ids: its ids have
    no part segment, so the `sec-{reg}-{L}-I` pattern would otherwise
    misread a genuine `sec-1-X-I` (statement-of-basis entry X.I.) as
    evidence of a "Part X"."""
    if reg_has_no_parts(reg):
        return [NO_PART]
    pat = _ROMAN_PART_LETTER_RE_CACHE.get(reg)
    if pat is None:
        pat = re.compile(r"^sec-" + re.escape(reg) + r"-([A-Z]{1,2})-I$")
        _ROMAN_PART_LETTER_RE_CACHE[reg] = pat
    sob_letter = SOB_PART_CONFIG.get(reg, {}).get("letter")
    letters = {m.group(1) for i in known_ids if (m := pat.match(i))}
    return sorted(letters - ({sob_letter} if sob_letter else set()))


def _default_parts_order(own_part: str | None, reg: str, known_ids: set[str]) -> list[str]:
    """Which part(s) to try, in order, for a same-reg "Section X.Y." citation
    that is NOT preceded by an explicit "Part Z,". Parts A and B both number
    their own sections starting at "I." (rule 1b): a provision in A or B
    tries its own part first, then the other. Parts whose own top-level
    sections are lettered rather than roman (Part C: "Statements of Basis")
    can never be the target of a roman-numeral citation (rule 3) — a
    provision there, or one with no clear enclosing part at all, tries B
    then A, since Part C's prose describes revisions to A/B.

    Deliberately NOT extended to add the SOB part itself as a same-reg
    fallback target for a BARE (no "Part X," prefix) citation written from
    within that SOB part: measured against Reg 3's Part F, doing so
    misresolves bare "Section I.F."/"Section I.G." (Part A's own
    abbreviations/definitions sections, which this parse doesn't capture as
    separate ids) onto Part F's unrelated dated entries I.F/I.G, since a
    bare "Section <letter>." citation from inside a `roman_prefix` SOB part
    (Reg 3) or a same-shaped `roman_seq` SOB part (Reg 26) is indistinguishable
    from that SOB part's own id shape (see the "Statement-of-basis
    cross-reference targets" section of the diff report). Only the EXPLICIT
    "Part F, Section I.AA." form is safe to resolve into the SOB part — see
    `_link_part_clause`'s `part_is_roman` check."""
    roman_parts = _roman_part_letters(reg, known_ids)
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
    cycle = cycle_ab_for(reg)
    tokens, consumed = tokenize_by_cycle(cite if cite.endswith((".", ")")) else cite + ".", cycle)
    suffix = _citation_to_id_suffix(cite, cycle)
    if (suffix is None or not tokens) and reg in BARE_DIGIT_CHILD_SECTIONS:
        # A citation into a BARE_DIGIT_CHILD_SECTIONS section ("Part A,
        # Section II.40." — Reg 11's Part H citing definition 40) is
        # [roman, digit], which CYCLE_AB (roman -> upper) never tokenizes;
        # try the section's own [roman, digit, ...] shape, accepted only
        # for a configured (part, section) pair whose row exists.
        alt_cycle = ["roman", "digit"] + cycle[3:]
        alt_suffix = _citation_to_id_suffix(cite, alt_cycle)
        alt_tokens, _ = tokenize_by_cycle(cite if cite.endswith((".", ")")) else cite + ".", alt_cycle)
        if alt_suffix is not None and len(alt_tokens) >= 2:
            for part, section in BARE_DIGIT_CHILD_SECTIONS[reg]:
                if alt_tokens[0][1] == section and part in parts_order:
                    target = provision_id(reg, part, alt_suffix)
                    if target in known_ids:
                        return target, ""
    if suffix is None or not tokens:
        return None, BUCKET_UNPARSEABLE
    top_raw = tokens[0][1]
    for part in parts_order:
        target = provision_id(reg, part, suffix)
        if target in known_ids:
            return target, ""
    exists_top = any(provision_id(reg, p, top_raw) in known_ids for p in _roman_part_letters(reg, known_ids))
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


_CP_KNOWN_IDS_CACHE: set[str] | None = None


def _cp_known_ids() -> set[str]:
    """Lazily parses Common Provisions' own source text once (module-level
    cache, for the life of the process) so a cross-reference TO it from
    another regulation (see COMMON_PROVISIONS_RE) can be verified against
    ids that actually exist — the same "IF AND ONLY IF the target id exists"
    rule every same-reg citation already follows — rather than just being
    syntactically well-formed. Never raises: a build without
    sources/REG_CP.txt (e.g. cp not merged in yet) returns an empty set, so
    every "Common Provisions Regulation" mention is left as plain text
    (BUCKET_OTHER_REG/BUCKET_UNPARSEABLE) instead of crashing every other
    regulation's parse. Not consulted when `reg == "cp"` itself (a
    self-mention resolves against the CURRENT parse's own known_ids, like
    any other same-reg citation — see link_citations)."""
    global _CP_KNOWN_IDS_CACHE
    if _CP_KNOWN_IDS_CACHE is not None:
        return _CP_KNOWN_IDS_CACHE
    cp_txt = Path(__file__).resolve().parent / "sources" / "REG_CP.txt"
    if not cp_txt.exists():
        _CP_KNOWN_IDS_CACHE = set()
        return _CP_KNOWN_IDS_CACHE
    try:
        result = parse_reg("cp", str(cp_txt), None)
        _CP_KNOWN_IDS_CACHE = {r["id"] for r in result[0]}
    except Exception:
        _CP_KNOWN_IDS_CACHE = set()
    return _CP_KNOWN_IDS_CACHE


def _emit_cp_section_list(list_text: str, list_start: int, keyword_start: int, keyword: str,
                           pieces: list[tuple[int, int, str]], buckets: dict[str, Counter],
                           cp_ids: set[str]) -> None:
    """Cross-regulation twin of `_emit_section_list`, for a "Section(s)
    <list>" clause naming a Common Provisions section from another
    regulation's text. Same first-citation-carries-the-keyword convention,
    but wrapped as an `<a>` (not a same-reg `<span data-target>`) — the
    reader is leaving this regulation's own page — carrying BOTH
    `data-provision-id` (the resolved sec-cp-... id, for a deep link/scroll
    on the target page) and `href="/regulations/cp"` (an ordinary page
    link), mirroring the plain external-reg link's class."""
    matches = list(CITATION_RE.finditer(list_text))
    keyword_used = False
    for idx, cm in enumerate(matches):
        cite = cm.group(0)
        abs_start = list_start + cm.start()
        abs_end = list_start + cm.end()
        target, bucket = _resolve_cite(cite, "cp", cp_ids, [NO_PART])
        if target:
            text = f"{keyword} {cite}" if (not keyword_used and idx == 0) else cite
            start = keyword_start if (not keyword_used and idx == 0) else abs_start
            pieces.append((start, abs_end,
                            f'<a class="xref-external-reg" data-provision-id="{target}" '
                            f'href="/regulations/cp">{text}</a>'))
            keyword_used = True
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
    sob_cfg = SOB_PART_CONFIG.get(reg, {})
    # Ordinarily "sec-{reg}-{letter}-I" existing means the part's own
    # top-level sections are roman-numbered (rule 1a's precondition). That
    # bare-id check can never be true for a `letter_dated` SOB part WITH a
    # `roman_prefix` (Reg 3's Part F: real ids are "sec-3-F-I-<letter>", a
    # minimum of two tokens — "sec-3-F-I" alone never exists) even though a
    # printed citation into it ("Part F, Section I.AA.") is perfectly valid
    # and tokenizes the same way an ordinary roman-numeral citation does —
    # so that specific SOB shape is special-cased in here too. This does NOT
    # affect Reg 7 (Part C, letter_dated, no roman_prefix) or Reg 22/Reg 26
    # (Part E / Part C, roman_seq — already covered by the plain bare-id
    # check, since their SOB top level really is "sec-{reg}-{letter}-I").
    part_is_roman = f"sec-{reg}-{letter}-I" in known_ids or (
        letter == sob_cfg.get("letter") and sob_cfg.get("roman_prefix")
    )
    if not part_is_roman:
        # This part's own sections are lettered (Part C), not roman — a
        # roman-numeral "Section" citation naming it can only be a reference
        # to the regulation's former structure (rule 3); never resolve it
        # here, and never silently fall back to another part either.
        for cm in CITATION_RE.finditer(seclist_text):
            buckets[BUCKET_HISTORICAL][cm.group(0)] += 1
        return
    _emit_section_list(html_text, kw_start, keyword, seclist_start, seclist_text, [letter], pieces, buckets, reg, known_ids)


def _link_cfr49_citations(
    text: str,
    corpus_regs: set[str],
    pieces: list[tuple[int, int, str]],
    buckets: dict[str, Counter],
    try_claim,
) -> None:
    """"49 CFR Part 192" / "49 CFR 192.605(b)" / ECMC's dotted "49 C.F.R. §
    192.243" / "49 C.F.R. §§ 195.2 or 192.8" / "49 C.F.R. § 195 Subpart A"
    — a whole-CFR-part corpus regulation (see CFR_TITLE_PART_TO_REGKEY).

    Shared between `link_citations` (the AQCC Part/roman linker used by the
    numbered CCR regs, Reg 26, Reg 30, ...) and `link_citations_ecmc` (its
    own, otherwise-independent linker) because ECMC is the only Colorado
    document that currently cites 49 CFR at all (see sources/ECMC.txt) --
    both callers need this exact same 49-CFR-title handling, not a
    reimplementation of it.

    `try_claim(start, end) -> bool` is the caller's own claimed-span
    tracker: True and the span is now claimed, False if some earlier match
    already owns it (in which case this citation is left untouched). A 49
    CFR part that is not in the corpus (190, 193, 195, 196, 199) falls
    through to the cfr bucket exactly as before this step existed; it never
    competes with a "40 CFR ..." citation, which this pattern never matches.
    """
    for m in CFR_TITLE_PART_RE.finditer(text):
        if not try_claim(m.start(), m.end()):
            continue
        title = m.group("title")

        if m.group("orsecpart"):
            # "49 C.F.R. §§ 195.2 or 192.8" -- a two-item list sharing one
            # "§§ ... or ..." prefix. Each item is its own citation into
            # its own part and resolves independently (195.2 stays in the
            # cfr bucket, 192.8 links, say), so only the two section-number
            # spans themselves become pieces/bucket entries -- the shared
            # "49 C.F.R. §§ " prefix and the " or " connective are left as
            # plain text, same as the untouched words around any other
            # xref span.
            for part_num, sec_num, g_start, g_end in (
                (m.group("secpart"), m.group("secnum"), m.start("secpart"),
                 m.end("par") if m.group("par") else m.end("secnum")),
                (m.group("orsecpart"), m.group("orsecnum"),
                 m.start("orsecpart"), m.end("orsecnum")),
            ):
                sub_text = text[g_start:g_end]
                regkey = CFR_TITLE_PART_TO_REGKEY.get((title, part_num))
                if regkey and regkey in corpus_regs:
                    deep = f' data-provision-id="sec-{regkey}-{part_num}.{sec_num}"'
                    pieces.append((g_start, g_end,
                                   f'<a class="xref-external-reg" href="/regulations/{regkey}"{deep}>{sub_text}</a>'))
                else:
                    buckets[BUCKET_CFR][sub_text] += 1
            continue

        part_num = m.group("part") or m.group("barepart") or m.group("secpart")
        regkey = CFR_TITLE_PART_TO_REGKEY.get((title, part_num))
        if regkey and regkey in corpus_regs:
            # When a SECTION was named ("49 CFR 192.605"), carry the target
            # row's id as data-provision-id alongside the reg-page href, so
            # the app can deep-link into the other regulation while the
            # plain href keeps working. A bare part cite ("49 CFR Part 192",
            # or ECMC's "49 C.F.R. § 195 Subpart A" once 195 is ever in the
            # corpus) just links to the reg page, as every other cross-reg
            # link does.
            deep = ""
            if m.group("secnum"):
                deep = f' data-provision-id="sec-{regkey}-{part_num}.{m.group("secnum")}"'
            elif m.group("barepart") and m.group("baresub"):
                # "49 C.F.R. § 195 Subpart A" -- a whole-part document's
                # subpart rows are `sec-<reg>-PART-<LETTER>` (import_ecfr's
                # parse_ecfr_part), so a part+subpart cite CAN deep-link,
                # unlike a bare "49 CFR Part 195". Only a single printed
                # letter is accepted; anything else (a numbered or multi-
                # letter "subpart") just links to the reg page.
                sub = m.group("baresub")
                if len(sub) == 1 and sub.isalpha():
                    deep = f' data-provision-id="sec-{regkey}-PART-{sub.upper()}"'
            pieces.append((m.start(), m.end(),
                           f'<a class="xref-external-reg" href="/regulations/{regkey}"{deep}>{m.group(0)}</a>'))
        else:
            buckets[BUCKET_CFR][m.group(0)] += 1


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
    cfr_re = CFR_RE_DOTTED if reg in CFR_DOTTED_REGS else CFR_RE
    for m in cfr_re.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        subpart = m.group(2)
        regkey = CFR_SUBPART_TO_REGKEY.get((subpart or "").upper())
        # A reg with flat incorporation-by-reference entries (Reg 6's Part
        # A, FLAT_ENTRY_PART_CONFIG) adopts "40 CFR Part 60, Subpart Xx"
        # itself: when that subpart is not a corpus regulation of its own
        # (OOOOa/b/c always win) but IS one of this reg's entry rows, the
        # citation links there as a same-reg xref. No-op for other regs.
        flat_cfg_cfr = FLAT_ENTRY_PART_CONFIG.get(reg)
        flat_target = (
            f"sec-{reg}-{flat_cfg_cfr['letter']}-SUBPART-{subpart}"
            if flat_cfg_cfr and subpart and m.group(1) == "60" else None
        )
        if regkey and regkey in corpus_regs:
            pieces.append((m.start(), m.end(), f'<a class="xref-external-reg" href="/regulations/{regkey}">{m.group(0)}</a>'))
        elif flat_target and flat_target in known_ids:
            pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{flat_target}">{m.group(0)}</span>'))
        else:
            buckets[BUCKET_CFR][m.group(0)] += 1

    # 1.1) "49 CFR Part 192" / "49 CFR 192.605(b)" / ECMC's dotted "49
    # C.F.R. § 192.243" / "49 C.F.R. § 195 Subpart A" — a whole-CFR-part
    # corpus regulation (see CFR_TITLE_PART_TO_REGKEY and
    # _link_cfr49_citations, shared with link_citations_ecmc). Runs after
    # step 1, which only ever matches "40 CFR ...", so the two never
    # compete; a 49 CFR part that is not in the corpus (190, 193, 195, 196,
    # 199) falls through to the cfr bucket exactly as before this step
    # existed.
    def _try_claim(s: int, e: int) -> bool:
        if is_claimed(s, e):
            return False
        claim(s, e)
        return True

    _link_cfr49_citations(html_text, corpus_regs, pieces, buckets, _try_claim)

    # 1.2) "NSPS Subpart IIII" / "NESHAP Subpart ZZZZ" / "MACT Subpart ZZZZ" —
    # the general permits and Reg 26/30 name the federal engine rules by
    # program abbreviation without the "40 CFR Part NN" prefix, so step 1
    # never sees them. Only subparts that are corpus regulations link; any
    # other program+subpart mention is counted in the cfr bucket. Runs after
    # step 1 so a fully-cited "40 CFR Part 60, Subpart IIII" is already
    # claimed and is not double-wrapped.
    for m in PROGRAM_SUBPART_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        regkey = CFR_SUBPART_TO_REGKEY.get(m.group(2).upper())
        if regkey and regkey in corpus_regs:
            claim(m.start(), m.end())
            pieces.append((m.start(), m.end(), f'<a class="xref-external-reg" href="/regulations/{regkey}">{m.group(0)}</a>'))
        else:
            claim(m.start(), m.end())
            buckets[BUCKET_CFR][m.group(0)] += 1

    # 1.3) California Code of Regulations, Title 13 citations (Reg 20's
    # incorporated-by-reference vehicle standards — see BUCKET_OTHER_CCR /
    # CAL_CCR_RE). Counted per section number as "13 CCR § <n>", never
    # linked; a no-op for every reg not in CALIFORNIA_CCR_REGS.
    if reg in CALIFORNIA_CCR_REGS:
        for m in CAL_CCR_RE.finditer(html_text):
            if is_claimed(m.start(), m.end()):
                continue
            claim(m.start(), m.end())
            seclist = m.group(1)
            if seclist:
                for sm in _CAL_SECTION_RE.finditer(seclist):
                    buckets[BUCKET_OTHER_CCR]["13 CCR § " + re.sub(r"\s+", "", sm.group(0))] += 1
            else:
                buckets[BUCKET_OTHER_CCR]["California Code of Regulations, Title 13"] += 1

    # 1.5) "Common Provisions [Regulation][, Section(s) list]" — see
    # COMMON_PROVISIONS_RE. Run before steps 2-4 so the trailing "Section(s)
    # list" (if any) is claimed as part of THIS phrase, not later picked up
    # by the bare SECTION_RE (step 4) and wrongly resolved against the
    # CITING regulation's own known_ids.
    for m in COMMON_PROVISIONS_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        keyword, seclist = m.group(1), m.group(2)
        name_end = m.start(1) if keyword else m.end()
        name_text = html_text[m.start():name_end].rstrip(", ")
        name_end = m.start() + len(name_text)
        if reg == "cp":
            cp_ids, root_target = known_ids, f"sec-{reg}-top-REG-{reg}"
        elif "cp" in corpus_regs:
            cp_ids, root_target = _cp_known_ids(), "sec-cp-top-REG-cp"
        else:
            # "cp" not in the corpus at all (pre-merge / no-op proof runs) —
            # never touch sources/REG_CP.txt or produce a link; count only,
            # exactly like any other regulation not (yet) in the corpus.
            cp_ids, root_target = set(), "sec-cp-top-REG-cp"
        if root_target in cp_ids:
            if reg == "cp":
                pieces.append((m.start(), name_end, f'<span class="xref" data-target="{root_target}">{name_text}</span>'))
            else:
                pieces.append((m.start(), name_end,
                                f'<a class="xref-external-reg" data-provision-id="{root_target}" '
                                f'href="/regulations/cp">{name_text}</a>'))
        else:
            buckets[BUCKET_OTHER_REG if reg != "cp" else BUCKET_UNPARSEABLE][name_text] += 1
        if keyword:
            if reg == "cp":
                _emit_section_list(html_text, m.start(1), keyword, m.start(2), seclist,
                                    [NO_PART], pieces, buckets, reg, cp_ids)
            else:
                _emit_cp_section_list(seclist, m.start(2), m.start(1), keyword, pieces, buckets, cp_ids)

    # 1.6) "GP01".."GP12" / "GP-07" / "General Permit GP02" mentions -> that
    # permit's own root row (see GP_MENTION_RE). Run before step 2 for the
    # same reason as step 1.5: nothing in REG_NUM_RE/PART_RE/SECTION_RE's
    # patterns overlaps "GPnn" syntactically, but claiming it here keeps
    # every GP-mention decision in one place. A SELF-mention (this permit
    # naming itself, the overwhelmingly common case — "not registered to
    # GP01 prior to...") links to this reg's OWN root, exactly like a bare
    # "Regulation Number 7" self-mention already does (step 2) — chosen for
    # consistency with that existing convention rather than left plain.
    # A no-op for every regulation whose text never contains "GPnn" at all
    # (confirmed: none of Reg 1/26/cp's source text does — see REPORT.md's
    # no-op proof) and, before this batch's permits exist in `corpus_regs`,
    # for the permits' OWN cross-mentions of each other too (counted into
    # BUCKET_OTHER_REG like any other not-yet-imported regulation).
    for m in GP_MENTION_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        gp_key = _gp_key_for(m.group(1))
        if gp_key == reg:
            target = f"sec-{reg}-top-REG-{reg}"
            if target in known_ids:
                pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
            else:
                buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1
        elif gp_key in corpus_regs:
            pieces.append((m.start(), m.end(), f'<a class="xref-external-reg" href="/regulations/{gp_key}">{m.group(0)}</a>'))
        else:
            buckets[BUCKET_OTHER_REG][m.group(0)] += 1

    # 1.7) "the Ambient Air Quality Standards regulation" / "5 CCR 1001-14" /
    # the printed title -> the Air Quality Standards document's root row
    # (see AQS_MENTION_RE). Only ever runs when "aqs" is in the corpus, so
    # it is a strict no-op (no claim, no bucket entry, nothing) for every
    # parse made before that document was imported — the same corpus gate
    # `_link_cfr49_citations` uses. A self-mention (the document naming
    # itself, ~20 times in its own statements of basis) links to its own
    # root, exactly like a bare "Regulation Number 7" self-mention (step 2).
    if "aqs" in corpus_regs:
        for m in AQS_MENTION_RE.finditer(html_text):
            if is_claimed(m.start(), m.end()):
                continue
            claim(m.start(), m.end())
            if reg == "aqs":
                target = "sec-aqs-top-REG-aqs"
                if target in known_ids:
                    pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
                else:
                    buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1
            else:
                pieces.append((m.start(), m.end(),
                               f'<a class="xref-external-reg" data-provision-id="sec-aqs-top-REG-aqs" '
                               f'href="/regulations/aqs">{m.group(0)}</a>'))

    # 1.8) The SIP Local Elements document, cited by name (see
    #      SIP_LOCAL_ELEMENTS_RE) -> its root row: a same-document span when
    #      this IS the sip reg (its own statements of basis quote the title),
    #      an external link when "sip" is in the corpus, otherwise counted in
    #      the other_reg bucket exactly like a not-yet-imported regulation.
    #      No "Section(s) <list>" clause is captured (no source ever follows
    #      the name with one). A no-op for every regulation whose text never
    #      prints either phrase (see the regex's own comment).
    for m in SIP_LOCAL_ELEMENTS_RE.finditer(html_text):
        if is_claimed(m.start(), m.end()):
            continue
        claim(m.start(), m.end())
        if reg == "sip":
            target = f"sec-{reg}-top-REG-{reg}"
            if target in known_ids:
                pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
            else:
                buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1
        elif "sip" in corpus_regs:
            pieces.append((m.start(), m.end(), f'<a class="xref-external-reg" href="/regulations/sip">{m.group(0)}</a>'))
        else:
            buckets[BUCKET_OTHER_REG][m.group(0)] += 1

    # 1.9) The AQCC Procedural Rules, cited by name (see
    #      PROC_RULES_MENTION_RE) -> their root row: a same-document span
    #      when this IS the proc document (its own statements of basis and
    #      several sections name it), an external link when "proc" is in
    #      the corpus. Gated on the corpus exactly like step 1.7, so it is
    #      a strict no-op — no claim, no bucket entry, nothing — for every
    #      parse made before this document was imported.
    if "proc" in corpus_regs:
        for m in PROC_RULES_MENTION_RE.finditer(html_text):
            if is_claimed(m.start(), m.end()):
                continue
            claim(m.start(), m.end())
            if reg == "proc":
                target = "sec-proc-top-REG-proc"
                if target in known_ids:
                    pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
                else:
                    buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1
            else:
                pieces.append((m.start(), m.end(),
                               f'<a class="xref-external-reg" data-provision-id="sec-proc-top-REG-proc" '
                               f'href="/regulations/proc">{m.group(0)}</a>'))

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
        # The printed keyword between "Regulation" and the number — "Number"
        # for every existing regulation, or Reg 30's abbreviated "No."/"No"
        # (see REG_NUM_RE) — is preserved verbatim in the link/span text
        # rather than hardcoded, so "Regulation No. 3" doesn't render (or
        # get counted) as "Regulation Number 3".
        num_text = html_text[num_span[0]:num_span[1]]

        if num != reg:
            if num in corpus_regs and not _non_aqcc_ccr_series(html_text, m.start(), num_span[1], num):
                # Bare "Regulation Number N" only — a trailing Part/Section
                # on THAT regulation is left unlinked (see docstring).
                pieces.append((num_span[0], num_span[1], f'<a class="xref-external-reg" href="/regulations/{num}">{num_text}</a>'))
            else:
                buckets[BUCKET_OTHER_REG][m.group(0)] += 1
            continue

        # num == reg: a self-reference. "Regulation Number 7" always links to
        # the root as its own span (rule 1); Part/Section, if present, are
        # independently linked to their own more specific targets.
        root_target = f"sec-{reg}-top-REG-{reg}"
        if root_target in known_ids:
            pieces.append((num_span[0], num_span[1], f'<span class="xref" data-target="{root_target}">{num_text}</span>'))
        else:
            buckets[BUCKET_UNPARSEABLE][num_text] += 1

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

    # 3b) "Part X, <citation list>" with no "Section" keyword (see
    #     PART_COMMA_CITATION_REGS / PART_COMMA_CITE_RE — Reg 12 only). Step
    #     3 has already claimed and linked the "Part X" span itself; only the
    #     citation list after the comma is claimed here, each citation
    #     resolved against that part and wrapped bare (the same shape a
    #     later member of a "Sections A., B." list gets — there is no
    #     keyword to fold into the first span).
    if reg in PART_COMMA_CITATION_REGS:
        for m in PART_COMMA_CITE_RE.finditer(html_text):
            letter = m.group(1)
            if f"sec-{reg}-P-{letter}" not in known_ids or is_claimed(m.start(2), m.end(2)):
                continue
            claim(m.start(2), m.end(2))
            list_start = m.start(2)
            matches = list(CITATION_RE.finditer(m.group(2)))
            for idx, cm in enumerate(matches):
                cite = cm.group(0)
                abs_start, abs_end = list_start + cm.start(), list_start + cm.end()
                target, bucket = _resolve_cite(cite, reg, known_ids, [letter])
                if target:
                    pieces.append((abs_start, abs_end, f'<span class="xref" data-target="{target}">{cite}</span>'))
                    if idx == len(matches) - 1:
                        _maybe_link_sibling(html_text, abs_end, target, known_ids, pieces)
                else:
                    buckets[bucket][cite] += 1

    # 3c) Inside an outlined appendix (APPENDIX_LADDERS), a "Section <a.b[.c]>"
    #     reference to one of that appendix's OWN decimal units. Gated to
    #     APPENDIX_LADDER_XREF_REGS and to a row that actually IS one of
    #     those appendix rows, so it is a strict no-op everywhere else --
    #     including Reg 11, the only other reg with an appendix ladder.
    if reg in APPENDIX_LADDER_XREF_REGS and own_id and "-APPENDIX-" in own_id:
        apx_base = own_id[:own_id.index("-APPENDIX-") + len("-APPENDIX-") + 1]
        for m in LADDER_SECTION_RE.finditer(html_text):
            if is_claimed(m.start(), m.end()):
                continue
            claim(m.start(), m.end())
            first_target = f"{apx_base}-{m.group(2)}"
            if first_target in known_ids:
                pieces.append((m.start(1), m.end(2),
                               f'<span class="xref" data-target="{first_target}">'
                               f'{html_text[m.start(1):m.end(2)]}</span>'))
            else:
                buckets[BUCKET_UNPARSEABLE][m.group(2)] += 1
            if m.group(3) is not None:
                second_target = f"{apx_base}-{m.group(3)}"
                if second_target in known_ids:
                    pieces.append((m.start(3), m.end(3),
                                   f'<span class="xref" data-target="{second_target}">'
                                   f'{m.group(3)}</span>'))
                else:
                    buckets[BUCKET_UNPARSEABLE][m.group(3)] += 1

    # 4) bare "Section(s)"/"Condition(s) list" not already claimed above —
    #    resolved against the citing provision's own part (see
    #    `_default_parts_order`); "Condition(s)" only tried for a GP reg
    #    (see `_bare_section_re`/CONDITION_KEYWORD_REGS).
    for m in _bare_section_re(reg).finditer(html_text):
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
        if _NON_AQCC_REG_PREFIX_RE.search(html_text[max(0, m.start() - 8):m.start()]):
            buckets[BUCKET_OTHER_REG][f"DOR {m.group(0)}"] += 1
            continue
        if _non_aqcc_ccr_series(html_text, m.start(), m.end(), num):
            # Another commission's Regulation N, named as such by its own
            # CCR cite — see _non_aqcc_ccr_series.
            buckets[BUCKET_OTHER_REG][m.group(0)] += 1
            continue
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

    # 6) Same-regulation "Subpart(s) Xx[, Yy and Zz]" mentions -> the flat
    #    incorporation-by-reference entry rows (FLAT_ENTRY_PART_CONFIG). Only
    #    for a reg that HAS such rows; a "40 CFR Part NN, Subpart Xx" citation
    #    is already claimed by step 1 and never reaches here. Same span
    #    convention as _emit_section_list: the first resolved code's span
    #    carries the "Subpart(s)" keyword, later ones are wrapped bare, and a
    #    code with no entry row (e.g. a NESHAP "Subpart UUUUU", or a subpart
    #    this regulation never adopted) is left as plain text, uncounted.
    flat_cfg = FLAT_ENTRY_PART_CONFIG.get(reg)
    if flat_cfg:
        flat_letter = flat_cfg["letter"]
        for m in FLAT_SUBPART_REF_RE.finditer(html_text):
            if is_claimed(m.start(), m.end()):
                continue
            claim(m.start(), m.end())
            # "40 CFR Part 75, Subparts A through H" / "40 CFR Part 63,
            # Subparts ..." name ANOTHER CFR part's subparts (step 1 only
            # claims the singular "Part NN, Subpart X" form) — a "Part <n>"
            # other than 60 just before the keyword means these codes are
            # not this regulation's Part 60 entries at all.
            pm = _FLAT_PRECEDING_PART_RE.search(html_text[max(0, m.start() - 40):m.start()])
            if pm and pm.group(1) != "60":
                continue
            keyword, list_start = m.group(1), m.start(2)
            for ci, cm in enumerate(_FLAT_SUBPART_CODE_RE.finditer(m.group(2))):
                target = f"sec-{reg}-{flat_letter}-SUBPART-{cm.group(0)}"
                if target not in known_ids:
                    continue
                s, e = list_start + cm.start(), list_start + cm.end()
                if ci == 0:
                    pieces.append((m.start(1), e, f'<span class="xref" data-target="{target}">{html_text[m.start(1):e]}</span>'))
                else:
                    pieces.append((s, e, f'<span class="xref" data-target="{target}">{cm.group(0)}</span>'))

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
    # Reg 4 Part B Section VIII.A.: the five installable-fireplace items are
    # the only compound labels in the document printed WITHOUT the dot after
    # the section letter.
    "4": [
        dict(
            old_label="VIII.A 1.", new_label="VIII.A.1.",
            match_prefix="VIII.A 1. a gas appliance.",
            line_hint=555,
            note=(
                "Part B Section VIII.A. lists the five fireplace types that may still be "
                "installed; all five labels are printed with the dot after the SECTION "
                "letter missing -- \"VIII.A 1.\" .. \"VIII.A 5.\" instead of \"VIII.A.1.\" .. "
                "\"VIII.A.5.\" (REG_4.txt lines 555-564; every other compound label in the "
                "document prints its full dotted path). Without the fix none of the five "
                "tokenizes, so all five were folded into VIII.A.'s own row as inline "
                "paragraphs still carrying their printed labels."
            ),
        ),
        dict(
            old_label="VIII.A 2.", new_label="VIII.A.2.",
            match_prefix="VIII.A 2. an electric device.",
            line_hint=557,
            note=(
                "Part B Section VIII.A. lists the five fireplace types that may still be "
                "installed; all five labels are printed with the dot after the SECTION "
                "letter missing -- \"VIII.A 1.\" .. \"VIII.A 5.\" instead of \"VIII.A.1.\" .. "
                "\"VIII.A.5.\" (REG_4.txt lines 555-564; every other compound label in the "
                "document prints its full dotted path). Without the fix none of the five "
                "tokenizes, so all five were folded into VIII.A.'s own row as inline "
                "paragraphs still carrying their printed labels."
            ),
        ),
        dict(
            old_label="VIII.A 3.", new_label="VIII.A.3.",
            match_prefix="VIII.A 3. a fireplace insert that meets the requirements set forth in Section II.A.",
            line_hint=559,
            note=(
                "Part B Section VIII.A. lists the five fireplace types that may still be "
                "installed; all five labels are printed with the dot after the SECTION "
                "letter missing -- \"VIII.A 1.\" .. \"VIII.A 5.\" instead of \"VIII.A.1.\" .. "
                "\"VIII.A.5.\" (REG_4.txt lines 555-564; every other compound label in the "
                "document prints its full dotted path). Without the fix none of the five "
                "tokenizes, so all five were folded into VIII.A.'s own row as inline "
                "paragraphs still carrying their printed labels."
            ),
        ),
        dict(
            old_label="VIII.A 4.", new_label="VIII.A.4.",
            match_prefix="VIII.A 4. an approved pellet burning fireplace insert that meets the requirements set forth",
            line_hint=561,
            note=(
                "Part B Section VIII.A. lists the five fireplace types that may still be "
                "installed; all five labels are printed with the dot after the SECTION "
                "letter missing -- \"VIII.A 1.\" .. \"VIII.A 5.\" instead of \"VIII.A.1.\" .. "
                "\"VIII.A.5.\" (REG_4.txt lines 555-564; every other compound label in the "
                "document prints its full dotted path). Without the fix none of the five "
                "tokenizes, so all five were folded into VIII.A.'s own row as inline "
                "paragraphs still carrying their printed labels."
            ),
        ),
        dict(
            old_label="VIII.A 5.", new_label="VIII.A.5.",
            match_prefix="VIII.A 5. any other clean burning device approved by the Commission which meets the",
            line_hint=564,
            note=(
                "Part B Section VIII.A. lists the five fireplace types that may still be "
                "installed; all five labels are printed with the dot after the SECTION "
                "letter missing -- \"VIII.A 1.\" .. \"VIII.A 5.\" instead of \"VIII.A.1.\" .. "
                "\"VIII.A.5.\" (REG_4.txt lines 555-564; every other compound label in the "
                "document prints its full dotted path). Without the fix none of the five "
                "tokenizes, so all five were folded into VIII.A.'s own row as inline "
                "paragraphs still carrying their printed labels."
            ),
        ),
    ],
    # -- Batch 7 --------------------------------------------------------
    "29": [
        dict(
            old_label="III.C",
            new_label="III.C.",
            match_prefix="III.C    The restrictions in Sections III.A. and III.B.",
            line_hint=163,
            note=(
                'Part A Section III\'s third and last item is printed "III.C    The '
                'restrictions in Sections III.A. and III.B. also apply to lawn and garden '
                'services..." (REG_29.txt line 163) — the ONLY label in the whole regulation '
                'missing its trailing dot (III.A. and III.B. immediately above both print it, '
                'as does every other label in both parts). Without the fix the line was not a '
                'marker at all: its text was folded into III.B. as trailing paragraphs (making '
                'III.B. a 613-character two-provision row) and the label gate reported Section '
                'III\'s letter sequence as A..B with C missing. Corrected here rather than by '
                'setting REG_META `labels_without_trailing_dot` (the Reg 20 flag) because this '
                'is a single confirmed misprint, not the sporadic reg-wide habit that flag is '
                'for — a one-line fix that reports its own hit count is the narrower change.'
            ),
        ),
    ],
    # AQCC Procedural Rules (5 CCR 1001-1): one printed label typo.
    "proc": [
        # Part B's VI.B.3. list ("Contents of the Hearing Request") prints
        # its second item as "VI.B.3. b.   Brief statement of background
        # and relevant facts;" — a stray space between the parent label
        # and the child letter (REG_PROC.txt 4822; Part A prints the same
        # item correctly as "VI.B.3.b." at line 1876, and every other
        # sibling here is "VI.B.3.a."/"VI.B.3.c.".."VI.B.3.g."). Without
        # the fix "VI.B.3." tokenized a SECOND time on that line, so the
        # item became a duplicate of its own parent id (merged by
        # parse_reg's de-dup pass into `sec-proc-B-VI-B-3`) and the Part B
        # sibling run read a -> c.
        dict(
            old_label="VI.B.3. b.", new_label="VI.B.3.b.",
            match_prefix="VI.B.3. b.         Brief statement of background and relevant facts;",
            line_hint=4822,
            note=(
                'Printed "VI.B.3. b." (stray space after the parent label) — Part B\'s second '
                "Hearing Request content item; re-labelled VI.B.3.b., matching Part A's printing "
                "of the same list."
            ),
        ),
    ],
    "19": [
        # Part A III.B. runs III.B.1. .. III.B.3. (Abatement Worker and
        # Project Designer), then the PDF prints, on one line at III.B.'s
        # own indent, "(Reserved)III.B.5.       Re-certification" (REG_19.txt
        # line 1586; pdfplumber confirms the characters are printed exactly
        # so — one 10-pt Arial run, no hidden label) and continues with
        # III.B.5.a. ... III.B.6. The 2021 statement of basis (Part C, entry
        # V, line 4231) says "Certification Based on Prior Training (Section
        # III.B.4) — The Commission removed this section as it is no longer
        # applicable or used": the line is the fused remnant of "III.B.4.
        # (Reserved)" (its label lost) and the "III.B.5. Re-certification"
        # heading. Without the fix the line doesn't tokenize, so the whole of
        # III.B.5. (re-certification intervals and the $180/year fees) was
        # folded into III.B.3.c. as inline paragraphs. `prev_blank_line`
        # restores the reserved III.B.4. row on the blank line above.
        dict(
            old_label="(Reserved)III.B.5.", new_label="III.B.5.",
            prev_blank_line="III.B.4. (Reserved)",
            match_prefix="(Reserved)III.B.5.       Re-certification",
            line_hint=1586,
            note=(
                'Printed "(Reserved)III.B.5.       Re-certification" — the reserved III.B.4. '
                '(removed November 18, 2021, per Part C entry V) lost its label and fused onto '
                'the III.B.5. heading; split back into "III.B.4. (Reserved)" + "III.B.5. '
                'Re-certification".'
            ),
        ),
        # Two paren labels printed with a stray trailing period ("(i)." —
        # the only two such lines in REG_19.txt: `grep -nE
        # "\([ivx]+\)\.\s" sources/REG_19.txt`). tokenize_by_cycle requires
        # the text after a label to start with a space, so ".    Cities,
        # ..." left the line untokenized and the item was folded into its
        # parent as an inline paragraph (label text and all).
        dict(
            old_label="III.B.6.a.(i).", new_label="III.B.6.a.(i)",
            match_prefix="III.B.6.a.(i).    Cities, counties, municipalities",
            line_hint=1632,
            note='Printed "III.B.6.a.(i)." (stray period after the paren label) — the only child of III.B.6.a.',
        ),
        dict(
            old_label="V.A.6.c.(i).", new_label="V.A.6.c.(i)",
            match_prefix="V.A.6.c.(i).    The scope of work for the project.",
            line_hint=2184,
            note='Printed "V.A.6.c.(i)." (stray period after the paren label) before "V.A.6.c.(ii)" .. "(vi)".',
        ),
    ],
    # Reg 16 (Street Sanding Emissions): a 2007 SOS print whose text layer
    # (pdfplumber extracts the identical glyphs — these are printed, not
    # pdftotext artifacts) types six labels wrong. None of them tokenizes
    # under CYCLE_AB (a capital "I" is not a digit, "C" is not a lower
    # letter, and a comma / nothing is not the trailing dot), so without
    # these fixes each item was folded into its previous sibling as body
    # text: I.C.1. (and its I.C.1.b.), I.E.1. and I.E.2.c. vanished as rows,
    # I.D.2.c. fused into I.D.2.b., II.C.6. into II.C.5., I.B.7. into
    # I.B.6. The regulation's own cross-references confirm the intended
    # labels ("Section I.C.1.b.", "Section I.D.2.C." [sic], "Section
    # E.l.c.", "sections II.C.4, II.C.5 and II.C.6").
    "16": [
        dict(
            old_label="I.B.7,", new_label="I.B.7.",
            match_prefix="I.B.7, “Independent Laboratory”",
            line_hint=68,
            note='Printed "I.B.7," (comma for the trailing dot) between I.B.6. and I.B.8.',
        ),
        dict(
            old_label="I.C.I.", new_label="I.C.1.",
            match_prefix="I.C.I. Material Standards",
            line_hint=78,
            note='Printed "I.C.I." (capital I for the digit 1) — the only numbered item under I.C.',
        ),
        dict(
            old_label="I.C.I.b.", new_label="I.C.1.b.",
            match_prefix="I.C.I.b. less than 4% fines",
            line_hint=85,
            note='Printed "I.C.I.b." after "I.C.1.a." — capital I for the digit 1.',
        ),
        dict(
            old_label="I.D.2.C.", new_label="I.D.2.c.",
            match_prefix="I.D.2.C. Suppliers shall have one test performed by an independent laboratory determine",
            line_hint=111,
            note='Printed "I.D.2.C." between I.D.2.b. and I.D.2.d. — capital C for the letter c.',
        ),
        dict(
            old_label="I.E.I.", new_label="I.E.1.",
            match_prefix="I.E.I. Suppliers Requirements",
            line_hint=134,
            note='Printed "I.E.I." (capital I for the digit 1) before I.E.1.a. and I.E.2.',
        ),
        dict(
            old_label="I.E.2.C.", new_label="I.E.2.c.",
            match_prefix="I.E.2.C. The user shall maintain on file",
            line_hint=158,
            note='Printed "I.E.2.C." after I.E.2.b. — capital C for the letter c.',
        ),
        dict(
            old_label="II.C.6", new_label="II.C.6.",
            match_prefix="II.C.6 The City and County of Denver and CDOT",
            line_hint=331,
            note='Printed "II.C.6" with no trailing dot after II.C.5. (II.C.2. itself cites "II.C.6").',
        ),
    ],
    # SIP Local Elements (reg key "sip"): Section VIII.A. (Steamboat Springs
    # definitions) prints "1." .. "5." and then "3.", "4.", "5." AGAIN for
    # its last three definitions (REG_SIP.txt lines 947, 951, 956 —
    # "Independent Laboratory", "Percent Fines", "Reserved"), a source
    # misnumbering for "6.", "7.", "8.": VIII.B.2.a. itself cites the
    # "Percent Fines" definition as "VIII.A.7." (line 970), and every other
    # area's definitions list runs 1..n. The bare ladder accepts only the
    # exact next sibling, so without these fixes the three were folded into
    # "5. Governmental Entity" as body text. Each `match_prefix` is unique
    # in the document (checked: the other "Independent Laboratory"/"Percent
    # Fines"/"Reserved" definitions carry different numbers or letters).
    "sip": [
        dict(
            old_label="3.", new_label="6.",
            match_prefix='3. "Independent Laboratory" means a facility capable',
            line_hint=947,
            note='VIII.A.: printed "3." for the 6th definition (the list had already reached 5.).',
        ),
        dict(
            old_label="4.", new_label="7.",
            match_prefix='4. "Percent Fines" means the percent material passing',
            line_hint=951,
            note='VIII.A.: printed "4." for the 7th definition — cited as "VIII.A.7." by VIII.B.2.a.',
        ),
        dict(
            old_label="5.", new_label="8.",
            match_prefix="5. Reserved",
            line_hint=956,
            note='VIII.A.: printed "5. Reserved" a second time (after "5. Governmental Entity") for the 8th, reserved, slot.',
        ),
    ],
    "11": [
        # Part H's statement-of-basis entries are a plain roman sequence
        # I. .. XXXVII. (37 entries, one per printed "ADOPTED <date>" line —
        # both counted at 37), but the print skips XIV and numbers XII twice:
        # "XII.   AMENDMENTS / ADOPTED DECEMBER 19, 2002" (line 4069, correct),
        # "XII.   AMENDMENTS / ADOPTED SEPTEMBER 18, 2003" (line 4138 — the
        # 13th entry), "XIII.   AMENDMENTS / ADOPTED DECEMBER 18, 2003" (line
        # 4182 — the 14th), then "XV." (line 4200) onward correct. The Editor's
        # Notes confirm the intended numbering ("Part H XX eff. 11/30/2007" is
        # the October 18, 2007 entry, which is the 20th printed — only right
        # if the two misprints are corrected). The roman_seq scanner accepts
        # only the exact next numeral, so without these fixes the second
        # "XII." and the "XIII." were folded into entry XII (a 76,000-
        # character fused row, gate D) and XIII/XIV never existed. The
        # "XIII." fix runs first (while "XIII.   AMENDMENTS" is still unique);
        # `next_line_prefix` pins each to its own "ADOPTED" date line since
        # the label lines themselves are printed identically.
        dict(
            old_label="Ill.D.3.", new_label="III.D.3.",
            match_prefix="Ill.D.3. That the repair facility be adequately equipped",
            line_hint=2356,
            note=(
                'Printed "Ill.D.3." (capital I, two lower-case Ls) between "III.D.2." and '
                '"III.D.4." in Part D — a source-text typo for "III.D.3." (the same lower-case-L '
                'glyph slip Reg 2\'s Part A has); "Ill" is not a roman numeral, so the line did '
                'not tokenize and the item was folded into III.D.2. as an inline paragraph.'
            ),
        ),
        dict(
            old_label="XIII.", new_label="XIV.",
            match_prefix="XIII.   AMENDMENTS",
            next_line_prefix="ADOPTED DECEMBER 18, 2003",
            line_hint=4182,
            note=(
                'Printed "XIII.   AMENDMENTS" (ADOPTED DECEMBER 18, 2003, "The purpose of this '
                'revision is to postpone...") as the 14th Part H entry — a source-text misnumbering '
                'for "XIV." (the print has no XIV at all; the next entry is XV).'
            ),
        ),
        dict(
            old_label="XII.", new_label="XIII.",
            match_prefix="XII.   AMENDMENTS",
            next_line_prefix="ADOPTED SEPTEMBER 18, 2003",
            line_hint=4138,
            note=(
                'Printed "XII.   AMENDMENTS" a second time (ADOPTED SEPTEMBER 18, 2003) directly '
                'after the real XII (ADOPTED DECEMBER 19, 2002) — a source-text misnumbering for '
                '"XIII."; without the fix the roman_seq scanner folded this entry and the next into '
                'entry XII.'
            ),
        ),
    ],
    "2": [
        # Part A prints six of its eleven labels with a lower-case letter L
        # in place of the roman numeral I ("l.A.", "l.B.", "l.C.2.", "ll.",
        # "lll.", "lV.") — confirmed to be the PDF's own text layer (a 2014
        # Word print; pdfplumber extracts the identical glyphs), not a
        # pdftotext artifact. None of them tokenizes as a label ("l" is not
        # a roman numeral), so without these fixes Part A lost sections
        # II-IV entirely (folded into I.C.2.'s text) and I.A./I.B./I.C.2.
        # were folded into their neighbours.
        dict(
            old_label="l.A.", new_label="I.A.",
            match_prefix="l.A. For areas used predominantly for residential",
            line_hint=35,
            note='Printed "l.A." (lower-case L) — a source-text typo for "I.A.".',
        ),
        dict(
            old_label="l.B.", new_label="I.B.",
            match_prefix="l.B. In all other land use areas",
            line_hint=39,
            note='Printed "l.B." (lower-case L) — a source-text typo for "I.B.".',
        ),
        dict(
            old_label="l.C.2.", new_label="I.C.2.",
            match_prefix="l.C.2. For all areas it is a violation",
            line_hint=54,
            note='Printed "l.C.2." (lower-case L) directly after "I.C.1." — a source-text typo for "I.C.2.".',
        ),
        dict(
            old_label="ll.", new_label="II.",
            match_prefix="ll. For the purposes of this Part A of Regulation Number 2, two odor measurements",
            line_hint=59,
            note='Printed "ll." (two lower-case Ls) — a source-text typo for "II.".',
        ),
        dict(
            old_label="lll.", new_label="III.",
            match_prefix="lll. For the purposes of this Part A of Regulation Number 2, personnel",
            line_hint=64,
            note='Printed "lll." (three lower-case Ls) — a source-text typo for "III.".',
        ),
        dict(
            old_label="lV.", new_label="IV.",
            match_prefix="lV. An instrument, device, or technique",
            line_hint=73,
            note='Printed "lV." (lower-case L) — a source-text typo for "IV.".',
        ),
        dict(
            old_label="VI.E.1.e", new_label="VI.E.1.e.",
            match_prefix="VI.E.1.e The Division's preliminary determination",
            line_hint=788,
            note=(
                'Printed "VI.E.1.e The Division\'s preliminary determination..." — missing '
                'the trailing period every sibling ("VI.E.1.a." .. "VI.E.1.h.") has; '
                'without it the line does not tokenize and item (e) was folded into (d).'
            ),
        ),
        dict(
            old_label="VII.B.2.b.", new_label="VIII.B.2.b.",
            match_prefix="VII.B.2.b. Reopenings under this Section VIII.B.",
            line_hint=1008,
            note=(
                'Printed "VII.B.2.b." directly after "VIII.B.2.a." under "VIII.B.2." (its own '
                'text even says "under this Section VIII.B.") — a source-text typo for '
                '"VIII.B.2.b."; the real VII.B.2 (a Part B odor-management-plan map item) has '
                'no children, so without the fix this paragraph fused into VIII.B.2.a.'
            ),
        ),
        dict(
            old_label="X.A.1.a.", new_label="X.A.2.a.",
            match_prefix="X.A.1.a. An initial compliance test within 180 days",
            line_hint=1408,
            note=(
                'Printed "X.A.1.a." a second time, directly under the "X.A.2." heading and '
                'immediately before "X.A.2.b." — a source-text typo for "X.A.2.a." (the real '
                'X.A.1.a., "Testing for concentration of off-site odor emissions", is a few '
                'lines earlier); without the fix the two X.A.1.a. paragraphs merged into one row.'
            ),
        ),
        dict(
            old_label="X.B.2.f.", new_label="X.B.1.f.",
            match_prefix="X.B.2.f. The operating conditions existing at the time",
            line_hint=1431,
            note=(
                'Printed "X.B.2.f." sitting between "X.B.1.e." and the "X.B.2." heading — a '
                'source-text typo for "X.B.1.f." (X.B.2 is a single paragraph with no '
                'children); without the fix the (f) paragraph was folded into X.B.1.e.'
            ),
        ),
    ],
    "1": [
        dict(
            old_label="II.A.6.a",
            new_label="II.A.6.a.",
            match_prefix="II.A.6.a Emissions from fireplaces, fireplace inserts and stoves",
            line_hint=185,
            note=(
                'Printed as "II.A.6.a Emissions from fireplaces..." — missing the trailing '
                'period its siblings "II.A.6.b." and "II.A.6.c." have. Without it the line '
                "does not tokenize as a label and the fireplace exemption was fused into the "
                'parent "II.A.6. Exemptions" row as an inline paragraph.'
            ),
        ),
        dict(
            old_label="III.D.2.(iv)",
            new_label="III.D.2.d.(iv)",
            match_prefix="III.D.2.(iv)        Control Measures and Operating Procedures",
            line_hint=906,
            note=(
                'Printed as "III.D.2.(iv) Control Measures and Operating Procedures" under '
                '"III.D.2.d. Mining Activities", directly after "III.D.2.d.(iii)" and '
                'immediately followed by "III.D.2.d.(iv)(A)" through "(M)" — the "d." level '
                "is simply missing from the printed label. Without the fix the heading and "
                "all 13 (A)-(M) control-measure items were fused into the (iii) row."
            ),
        ),
        dict(
            old_label="IV.B.4.d.",
            new_label="VI.B.4.d.",
            match_prefix="IV.B.4.d.            Natural Gas Desulfurization",
            line_hint=1596,
            note=(
                'Printed as "IV.B.4.d. Natural Gas Desulfurization" between "VI.B.4.c. '
                'Combustion Turbines" and "VI.B.4.e. Petroleum Refining" in Section VI.B.4 '
                "(the SO2 fuel-burning limits), and its own children are printed "
                '"VI.B.4.d.(i)"/"(ii)" — a source-text typo for "VI.B.4.d." (there is no '
                "IV.B.4 at all; Section IV.B has only IV.B.1-IV.B.3)."
            ),
        ),
        dict(
            old_label="III.D.2.j.(iv)(C)",
            new_label="III.D.2.i.(iv)(C)",
            match_prefix="III.D.2.j.(iv)(C) other equivalent methods or techniques approved by the",
            line_hint=1159,
            note=(
                'Printed as "III.D.2.j.(iv)(C) other equivalent methods..." directly after '
                '"III.D.2.i.(iv)(A)" and "(B)" in the Blasting Activities control-measure list, '
                'three lines BEFORE the "III.D.2.j. Sandblasting Operations" heading even '
                'starts — a source-text typo for "III.D.2.i.(iv)(C)". Without the fix the '
                "item was fused into the (B) row."
            ),
        ),
        dict(
            old_label="VI.F.1.a.",
            new_label="VI.F.2.a.",
            match_prefix="VI.F.1.a.       An equal or greater air quality benefit than that required",
            line_hint=1737,
            note=(
                'Printed as "VI.F.1.a. An equal or greater air quality benefit..." directly '
                'under "VI.F.2. The application shall include a demonstration that the '
                'proposed alternative produces:" and followed by "VI.F.2.b." — a source-text '
                'typo for "VI.F.2.a." (the real VI.F.1.a., "Test method,", is a separate item '
                "twelve lines earlier; without the fix the two were merged into one row)."
            ),
        ),
    ],
    "3": [
        dict(
            old_label="V.D.2",
            new_label="V.D.2.",
            match_prefix="V.D.2 Non-creditable reductions",
            line_hint=2527,
            note=(
                'Printed as "V.D.2 Non-creditable reductions" — missing the trailing '
                'period every sibling heading in this same list has ("V.D.1.", "V.D.3.", '
                '"V.D.4.", "V.D.5." all end in a period). Without it, "V.D.2" does not '
                'tokenize as a label at all, so it — and all 7 of its children, '
                '"V.D.2.a." through "V.D.2.g." — were silently dropped (no parent for '
                "them to attach to)."
            ),
        ),
        # Part C's exemption list prints the three children of II.E.3.nnn.
        # ("Stationary Internal Combustion Engines that:") with a stray
        # space after the roman numeral — "II. E.3.nnn.(i)" instead of
        # "II.E.3.nnn.(i)". The tokenizer read each as a bare "II." marker,
        # so the three items were lost and their text was appended to the
        # Part C Section II heading row (found in the Sept 17 2026 review).
        dict(
            old_label="II. E.3.nnn.(i)",
            new_label="II.E.3.nnn.(i)",
            match_prefix="II. E.3.nnn.(i) Are power portable drilling rigs",
            line_hint=8112,
            note='Printed "II. E.3.nnn.(i)" with a stray space after "II." — a source-text typo for "II.E.3.nnn.(i)".',
        ),
        dict(
            old_label="II. E.3.nnn.(ii)",
            new_label="II.E.3.nnn.(ii)",
            match_prefix="II. E.3.nnn.(ii) Are emergency power generators",
            line_hint=8114,
            note='Printed "II. E.3.nnn.(ii)" with a stray space after "II." — a source-text typo for "II.E.3.nnn.(ii)".',
        ),
        dict(
            old_label="II. E.3.nnn.(iii)",
            new_label="II.E.3.nnn.(iii)",
            match_prefix="II. E.3.nnn.(iii)",
            line_hint=8117,
            note='Printed "II. E.3.nnn.(iii)" with a stray space after "II." — a source-text typo for "II.E.3.nnn.(iii)".',
        ),
    ],
    "26": [
        dict(
            old_label="II.D.6.f.(i)(B)",
            new_label="I.D.6.f.(i)(B)",
            match_prefix="II.D.6.f.(i)(B) Beginning May 1, 2025, an identification of any",
            line_hint=2107,
            note=(
                'Printed as "II.D.6.f.(i)(B)" directly after "I.D.6.f.(i)(A)" and before '
                '"I.D.6.f.(i)(C)" in Part B Section I.D.6.f. (there is no Section II.D.6 '
                "in Part B) — a source-text typo for \"I.D.6.f.(i)(B)\". Without the fix the "
                "(B) paragraph was fused into the (A) row (found in the Sept 17 2026 review)."
            ),
        ),
        dict(
            old_label="IV.A.5.c.(ii)",
            new_label="IV.A.5.c.(iii)",
            match_prefix="IV.A.5.c.(ii) Installing and operating crown inspectors to monitor",
            line_hint=3932,
            note=(
                'Printed "IV.A.5.c.(ii)" twice in a row (fill level detectors, then crown '
                'inspectors) and then "IV.A.5.c.(iv)" — the second is a source-text typo for '
                '"IV.A.5.c.(iii)". Before the Sep 19 2026 duplicate-marker fix the second '
                "paragraph silently overwrote the first, so the DB row (ii) read only the "
                "crown-inspector text."
            ),
        ),
    ],
    # Reg 8's Part A statement-of-basis section (Section II) prints three of
    # its dated entries WITHOUT the trailing period every other entry in the
    # same list has ("II.G." ... "II.K." all end in a period): "II.H    July
    # 15, 2004", "II.I    June 17, 2011", "II.J    October 18, 2012". Without
    # the period none of the three tokenizes as a label, so each entry's
    # text was silently fused into the tail of the preceding entry (II.G /
    # II.H / II.I respectively) and the Part A SOB sequence jumped G -> K.
    "8": [
        dict(
            old_label="II.H",
            new_label="II.H.",
            match_prefix="II.H    July 15, 2004",
            line_hint=445,
            note='Printed as "II.H    July 15, 2004" — missing the trailing period its siblings "II.G." and "II.K." carry.',
        ),
        dict(
            old_label="II.I",
            new_label="II.I.",
            match_prefix="II.I    June 17, 2011",
            line_hint=473,
            note='Printed as "II.I    June 17, 2011" — missing the trailing period its siblings carry.',
        ),
        dict(
            old_label="II.J",
            new_label="II.J.",
            match_prefix="II.J    October 18, 2012",
            line_hint=512,
            note='Printed as "II.J    October 18, 2012" — missing the trailing period its siblings carry.',
        ),
        # Part B's definitions list (Section I.B.) prints 19 consecutive labels,
        # "I.B. 72." through "I.B. 87." (including the children "I.B. 84.a."/
        # "I.B. 84.b." and "I.B. 85.a."-"I.B. 85.c."; I.B.73. and I.B.74. are
        # printed correctly in between), with a stray space between "I.B." and
        # the number — confirmed in the PDF's own text layer (pages 25-27),
        # not a pdftotext artifact. The tokenizer read each as a bare "I.B."
        # marker, so all 19 definitions were merged into the Section I.B.
        # heading row as duplicate ids and their own ids never existed. Same
        # typo once more at "II.F. 7." in Section II.F. (training-course
        # approval), whose text was likewise fused onto the II.F. row.
        dict(
            old_label='I.B. 72.',
            new_label='I.B.72.',
            match_prefix='I.B. 72. “Minor asbestos spill” means an',
            line_hint=1494,
            note='Printed "I.B. 72." with a stray space after "I.B." — a source-text typo for "I.B.72.".',
        ),
        dict(
            old_label='I.B. 75.',
            new_label='I.B.75.',
            match_prefix='I.B. 75. “Movable objects” means pieces of',
            line_hint=1511,
            note='Printed "I.B. 75." with a stray space after "I.B." — a source-text typo for "I.B.75.".',
        ),
        dict(
            old_label='I.B. 76.',
            new_label='I.B.76.',
            match_prefix='I.B. 76. “Negative air machine (NAM)” means',
            line_hint=1517,
            note='Printed "I.B. 76." with a stray space after "I.B." — a source-text typo for "I.B.76.".',
        ),
        dict(
            old_label='I.B. 77.',
            new_label='I.B.77.',
            match_prefix='I.B. 77. “Nonfriable” means material which, when',
            line_hint=1523,
            note='Printed "I.B. 77." with a stray space after "I.B." — a source-text typo for "I.B.77.".',
        ),
        dict(
            old_label='I.B. 78.',
            new_label='I.B.78.',
            match_prefix='I.B. 78. “Operations and maintenance program” means',
            line_hint=1527,
            note='Printed "I.B. 78." with a stray space after "I.B." — a source-text typo for "I.B.78.".',
        ),
        dict(
            old_label='I.B. 79.',
            new_label='I.B.79.',
            match_prefix='I.B. 79. “Particulate asbestos material” means finely',
            line_hint=1532,
            note='Printed "I.B. 79." with a stray space after "I.B." — a source-text typo for "I.B.79.".',
        ),
        dict(
            old_label='I.B. 80.',
            new_label='I.B.80.',
            match_prefix='I.B. 80. “Person” means any individual, any',
            line_hint=1535,
            note='Printed "I.B. 80." with a stray space after "I.B." — a source-text typo for "I.B.80.".',
        ),
        dict(
            old_label='I.B. 81.',
            new_label='I.B.81.',
            match_prefix='I.B. 81. “Phase Contrast Microscopy (PCM)” is',
            line_hint=1541,
            note='Printed "I.B. 81." with a stray space after "I.B." — a source-text typo for "I.B.81.".',
        ),
        dict(
            old_label='I.B. 82.',
            new_label='I.B.82.',
            match_prefix='I.B. 82. “Polarized Light Microscopy (PLM)” is',
            line_hint=1544,
            note='Printed "I.B. 82." with a stray space after "I.B." — a source-text typo for "I.B.82.".',
        ),
        dict(
            old_label='I.B. 83.',
            new_label='I.B.83.',
            match_prefix='I.B. 83. “Porous” means capable of trapping,',
            line_hint=1547,
            note='Printed "I.B. 83." with a stray space after "I.B." — a source-text typo for "I.B.83.".',
        ),
        dict(
            old_label='I.B. 84.',
            new_label='I.B.84.',
            match_prefix='I.B. 84. “Potential damage” means circumstances in',
            line_hint=1550,
            note='Printed "I.B. 84." with a stray space after "I.B." — a source-text typo for "I.B.84.".',
        ),
        dict(
            old_label='I.B. 84.a.',
            new_label='I.B.84.a.',
            match_prefix='I.B. 84.a.       Friable ACM or ACBM is',
            line_hint=1552,
            note='Printed "I.B. 84.a." with a stray space after "I.B." — a source-text typo for "I.B.84.a.".',
        ),
        dict(
            old_label='I.B. 84.b.',
            new_label='I.B.84.b.',
            match_prefix='I.B. 84.b.        There are indications that there',
            line_hint=1555,
            note='Printed "I.B. 84.b." with a stray space after "I.B." — a source-text typo for "I.B.84.b.".',
        ),
        dict(
            old_label='I.B. 85.',
            new_label='I.B.85.',
            match_prefix='I.B. 85. “Potential significant damage” means circumstances',
            line_hint=1568,
            note='Printed "I.B. 85." with a stray space after "I.B." — a source-text typo for "I.B.85.".',
        ),
        dict(
            old_label='I.B. 85.a.',
            new_label='I.B.85.a.',
            match_prefix='I.B. 85.a.       Friable ACM or ACBM is',
            line_hint=1570,
            note='Printed "I.B. 85.a." with a stray space after "I.B." — a source-text typo for "I.B.85.a.".',
        ),
        dict(
            old_label='I.B. 85.b.',
            new_label='I.B.85.b.',
            match_prefix='I.B. 85.b.       There are indications that there',
            line_hint=1573,
            note='Printed "I.B. 85.b." with a stray space after "I.B." — a source-text typo for "I.B.85.b.".',
        ),
        dict(
            old_label='I.B. 85.c.',
            new_label='I.B.85.c.',
            match_prefix='I.B. 85.c.        The material is subject to',
            line_hint=1579,
            note='Printed "I.B. 85.c." with a stray space after "I.B." — a source-text typo for "I.B.85.c.".',
        ),
        dict(
            old_label='I.B. 86.',
            new_label='I.B.86.',
            match_prefix='I.B. 86. “Pre-cleaning” means the cleaning of',
            line_hint=1583,
            note='Printed "I.B. 86." with a stray space after "I.B." — a source-text typo for "I.B.86.".',
        ),
        dict(
            old_label='I.B. 87.',
            new_label='I.B.87.',
            match_prefix='I.B. 87. “Preventive measures” mean actions taken',
            line_hint=1586,
            note='Printed "I.B. 87." with a stray space after "I.B." — a source-text typo for "I.B.87.".',
        ),
        dict(
            old_label='II.F. 7.',
            new_label='II.F.7.',
            match_prefix='II.F. 7. Final approval will be granted',
            line_hint=2425,
            note='Printed "II.F. 7." with a stray space after "II.F." — a source-text typo for "II.F.7.".',
        ),
        # Further confirmed source-text label typos in Parts B and D (each one
        # read in the PDF; see the diff report's corrections section). Every one
        # either orphaned a real provision (and its children) or fused it into
        # the preceding row until corrected here.
        dict(
            old_label='II.G.3',
            new_label='II.G.3.',
            match_prefix='II.G.3    On each course notification, the',
            line_hint=2475,
            note='Printed "II.G.3    On each course notification..." — missing the trailing period its siblings "II.G.1."/"II.G.2." carry; without it the paragraph was fused onto II.G.2.',
        ),
        dict(
            old_label='III.A.3.c.(iii).',
            new_label='III.A.3.c.(iii)',
            match_prefix='III.A.3.c.(iii).   Miscellaneous',
            line_hint=2693,
            note='Printed "III.A.3.c.(iii)." with a stray period after the paren (its siblings "(i)"/"(ii)" have none); the tokenizer left ". Miscellaneous" as the remainder so the heading was never a marker.',
        ),
        dict(
            old_label='III.A.4.c.(iii)(A)',
            new_label='III.A.3.c.(iii)(A)',
            match_prefix='III.A.4.c.(iii)(A) In a manner sufficient to',
            line_hint=2695,
            note='Printed "III.A.4.c.(iii)(A)" as the sole child of the "III.A.3.c.(iii). Miscellaneous" heading, inside Section III.A.3 (the real III.A.4 "Analysis" starts 80 lines later and has no (iii) child) — a source-text typo for "III.A.3.c.(iii)(A)".',
        ),
        dict(
            old_label='III.A.3.e.(v).',
            new_label='III.A.3.e.(v)',
            match_prefix='III.A.3.e.(v).    The assessment of friable ACM',
            line_hint=2748,
            note='Printed "III.A.3.e.(v)." with a stray period after the paren; without the fix it and its seven children "(v)(A)"-"(v)(G)" were fused into the (iv)(C) row.',
        ),
        dict(
            old_label='III.E.2',
            new_label='III.E.2.',
            match_prefix='III.E.2 Notifications for Single-Family Residential Dwellings',
            line_hint=3104,
            note='Printed "III.E.2 Notifications for Single-Family Residential Dwellings..." — missing the trailing period "III.E.1."/"III.E.3." carry; its children III.E.2.a.-d. were orphaned and fused into III.E.1.b.',
        ),
        dict(
            old_label='III.P.3.c.(i).',
            new_label='III.P.3.c.(i)',
            match_prefix='III.P.3.c.(i).     The air samples collected under',
            line_hint=4028,
            note='Printed "III.P.3.c.(i)." with a stray period after the paren.',
        ),
        dict(
            old_label='III.P.3.c.(ii).',
            new_label='III.P.3.c.(ii)',
            match_prefix='III.P.3.c.(ii).    Whenever on-site satellite labs are',
            line_hint=4036,
            note='Printed "III.P.3.c.(ii)." with a stray period after the paren.',
        ),
        dict(
            old_label='III.S.1.c',
            new_label='III.S.1.c.',
            match_prefix='III.S.1.c             Sheet vinyl flooring which contains',
            line_hint=4163,
            note='Printed "III.S.1.c             Sheet vinyl flooring..." — missing the trailing period "III.S.1.b."/"III.S.1.d." carry.',
        ),
        dict(
            old_label='III.T.2.d (ii)',
            new_label='III.T.2.d.(ii)',
            match_prefix='III.T.2.d (ii)    Using certified Workers and',
            line_hint=4372,
            note='Printed "III.T.2.d (ii)" with a space in place of the period before the paren (its siblings "(i)"/"(iii)" are printed "III.T.2.d.(i)"); without the fix its three children (ii)(A)-(C) had no parent.',
        ),
        dict(
            old_label='II.W.2.i.',
            new_label='III.W.2.i.',
            match_prefix='II.W.2.i. Spill procedures to be undertaken',
            line_hint=4661,
            note='Printed "II.W.2.i." between "III.W.2.h." and "III.W.2.j." in Part B Section III.W.2 (Part B Section II has no W) — a source-text typo for "III.W.2.i.".',
        ),
        dict(
            old_label='IV J.4.',
            new_label='IV.J.4.',
            match_prefix='IV J.4. Each LEA shall maintain',
            line_hint=5617,
            note='Printed "IV J.4." with a space in place of the first period, between "IV.J.3." and "IV.J.5.".',
        ),
        dict(
            old_label='IV J.5.i.',
            new_label='IV.J.5.i.',
            match_prefix='IV J.5.i.           A plan for reinspection',
            line_hint=5717,
            note='Printed "IV J.5.i." with a space in place of the first period, between "IV.J.5.h." and "IV.J.5.j.".',
        ),
        dict(
            old_label='V.B.2.C.',
            new_label='V.B.2.c.',
            match_prefix='V.B.2.C.         A person who has received',
            line_hint=6032,
            note='Printed "V.B.2.C." (capital C) directly after "V.B.2.b.(v)" in Part B Section V.B.2 — the lower-case sibling of "V.B.2.a."/"V.B.2.b."; the capital does not tokenize at the lower-letter depth, so the paragraph was fused into V.B.2.b.(v).',
        ),
        dict(
            old_label='Vl.C.1.d.',
            new_label='VI.C.1.d.',
            match_prefix='Vl.C.1.d.       The manufacture of friction products.',
            line_hint=6371,
            note='Printed "Vl.C.1.d." with a lower-case L in place of the roman I, between "VI.C.1.c." and "VI.C.1.e.".',
        ),
        dict(
            old_label='VI.E.1. STANDARD FOR FABRICATING',
            new_label='VI.E. STANDARD FOR FABRICATING',
            match_prefix='VI.E.1. STANDARD FOR FABRICATING',
            line_hint=6435,
            note='The flush-left Section VI.E heading is printed as "VI.E.1. STANDARD FOR FABRICATING", the same label as its own first child on the next line ("VI.E.1. Applicability"); every sibling heading is printed "VI.D.   Standard for Spraying" / "VI.F. ..." — a source-text typo for "VI.E.". Without the fix the heading and "Applicability" paragraphs merged under one id and Section VI had no E.',
        ),
        dict(
            old_label='V.B.I.',
            new_label='V.B.1.',
            match_prefix='V.B.I.   A description of the source',
            line_hint=8989,
            note='Part D Section V.B prints its first item as "V.B.I." (roman I) directly before "V.B.2." — a source-text typo for "V.B.1.".',
        ),
    ],
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
    "ecmc": [
        # Rule 525.b lists violation-duration rules (1)-(6), then its own
        # PRINTED numbering restarts at "(4)" for two more items (ECMC.txt
        # 16352-16357) that plainly continue the SAME list (mid-sentence
        # topic continuity with (6) "With respect to violations..." just
        # above; nothing about "Penalty Adjustments" or a new sub-topic that
        # would justify a fresh (1)) rather than genuinely restarting — a
        # source-text renumbering slip, not two different lists. Corrected
        # to continue the sequence as (7) and (8); without this both
        # collide with the earlier (4)/(5) into the same
        # `sec-ecmc-525-b-(4)` / `sec-ecmc-525-b-(5)` rows (see the parse
        # step's "id(s) produced by more than one marker" warning).
        dict(
            old_label="(4)", new_label="(7)",
            match_prefix="(4)   A penalty will be assessed for each day the evidence shows a violation",
            line_hint=16352,
            note='Printed "(4)" — a source-text renumbering slip continuing Rule 525.b\'s '
                 '(1)-(6) list; corrected to "(7)".',
        ),
        dict(
            old_label="(5)", new_label="(8)",
            match_prefix="(5)   The number of days of violation does not include any period necessary to",
            line_hint=16355,
            note='Printed "(5)" — a source-text renumbering slip continuing Rule 525.b\'s '
                 '(1)-(6) list; corrected to "(8)".',
        ),
    ],
    "25": [
        # Part B, Section I.A.5.d.(iv) is printed "zxsdaI.A.5.d.(iv) The
        # crossline averaging shall be met on a daily weighted average." —
        # five stray characters glued to the front of the label (confirmed
        # in REG_25.pdf page 19's own text layer via pdfplumber; not a
        # pdftotext artifact). Nothing tokenizes at "zxsda", so without the
        # fix the (iv) sub-item was folded into (iii)'s text, label text and
        # all, and the (iii) -> (v) gap showed up in the sequence check.
        dict(
            old_label="zxsdaI.A.5.d.(iv)", new_label="I.A.5.d.(iv)",
            match_prefix="zxsdaI.A.5.d.(iv) The crossline averaging shall be met on a daily",
            line_hint=793,
            note='Printed "zxsdaI.A.5.d.(iv)" (stray "zxsda" glued to the label) — a source-text '
                 'typo for "I.A.5.d.(iv)", the fourth sibling of I.A.5.d.(i)-(iii), (v), (vi).',
        ),
        # Part B, Section II.F.5.b. is printed "II.F.5.b The owner or
        # operator..." with no period after "b" (line 4720; confirmed in the
        # PDF's own text layer, page 100). The tokenizer stops at "II.F.5."
        # and re-matches the already-emitted II.F.5. heading, folding the
        # whole (b) paragraph into II.F.5.a.'s text.
        dict(
            old_label="II.F.5.b", new_label="II.F.5.b.",
            match_prefix="II.F.5.b The owner or operator of operations that use solvents that utilize a",
            line_hint=4720,
            note='Printed "II.F.5.b" (no trailing period) — a source-text typo for "II.F.5.b.", '
                 'the second sibling of II.F.5.a. and II.F.5.c.',
        ),
        # Part B, Section IV.B.1.a.(vi) is printed "IV.B.1.a.(vi “Heatset”
        # means..." with no closing parenthesis (line 5078; confirmed in the
        # PDF's own text layer, page 106), so "(vi" never tokenizes and the
        # definition was folded into (v)'s text.
        dict(
            old_label="IV.B.1.a.(vi", new_label="IV.B.1.a.(vi)",
            match_prefix="IV.B.1.a.(vi \u201cHeatset\u201d means any lithographic or letterpress",
            line_hint=5078,
            note='Printed "IV.B.1.a.(vi" (missing closing parenthesis) — a source-text typo for '
                 '"IV.B.1.a.(vi)", the sixth of the IV.B.1.a.(i)-(xiv) definitions.',
        ),
    ],
    "30": [
        # III.D.1.g.'s four "Notice of Applicability..." sub-items are
        # printed "III.D.1.g.(i)" / "(ii)" / "(iii)", but the fourth carries
        # a stray space between "III.D.1." and "g.(iv)" — "III.D.1. g.(iv)
        # Notice of Applicability after a stationary source modifies..."
        # (confirmed the PDF's own text layer, not a pdftotext artifact).
        # Without the fix, the tokenizer stops at "III.D.1." (the space
        # blocks the "g." lower-letter token from ever being reached),
        # re-matching the ALREADY-emitted section heading `sec-30-B-III-D-1`
        # a second time and dropping the whole (iv) sub-item's structure —
        # confirmed by the parser's own "id(s) produced by more than one
        # marker" warning for both `sec-30-B-III-D-1` and its child
        # `sec-30-B-III-D-1-g` before this fix.
        dict(
            old_label="III.D.1. g.(iv)", new_label="III.D.1.g.(iv)",
            match_prefix="III.D.1. g.(iv) Notice of Applicability after a stationary source",
            line_hint=1246,
            note='Printed "III.D.1. g.(iv)" (stray space before "g.") — a source-text typo for '
                 '"III.D.1.g.(iv)", the fourth sibling of III.D.1.g.(i)-(iii).',
        ),
    ],
    "12": [
        # Part A section IV's second subsection is printed "IV. B.   Test
        # Site and Vehicle Parameters" with a stray space after "IV." (the
        # PDF's own text layer — pdfplumber shows the same glyph run), the
        # same shape as Reg 30's "III.D.1. g.(iv)" above. The tokenizer
        # stops at "IV." and re-matches the already-emitted section heading
        # `sec-12-A-IV` (duplicate-id merge), so IV.B. lost its own row and
        # its five children IV.B.1.-IV.B.5. hung off a synthesized parent.
        dict(
            old_label="IV. B.", new_label="IV.B.",
            match_prefix="IV. B.   Test Site and Vehicle Parameters",
            line_hint=389,
            note='Printed "IV. B." (stray space after "IV.") — a source-text typo for "IV.B.", '
                 'the second subsection of Part A section IV (between IV.A. and IV.C.).',
        ),
        # Part A I.D.'s fourth exemption is printed "I.D.4    Any new heavy-duty
        # diesel vehicle of model year 2014 or newer..." with no trailing dot
        # (I.D.1.-I.D.3. all have one), so it was folded into I.D.3.'s text —
        # and the two "Part A, I.D.4." citations in II.A.2.h. had no target.
        dict(
            old_label="I.D.4", new_label="I.D.4.",
            match_prefix="I.D.4    Any new heavy-duty diesel vehicle of model year 2014",
            line_hint=210,
            note='Printed "I.D.4" (missing trailing dot) — a source-text typo for "I.D.4.", '
                 'the fourth sibling of Part A I.D.1.-3.',
        ),
        # Part B I.D.2.b.'s third sub-item is printed "I.D.2.b.iii         Any
        # new heavy-duty diesel vehicle..." with NO trailing dot after "iii"
        # (its siblings "I.D.2.b.i." / "I.D.2.b.ii." both have one), so the
        # bare_lroman token never matched and the item was folded into
        # I.D.2.b.ii.'s text.
        dict(
            old_label="I.D.2.b.iii", new_label="I.D.2.b.iii.",
            match_prefix="I.D.2.b.iii         Any new heavy-duty diesel vehicle having a GVWR",
            line_hint=1179,
            note='Printed "I.D.2.b.iii" (missing trailing dot) — a source-text typo for '
                 '"I.D.2.b.iii.", the third sibling of I.D.2.b.i./ii.',
        ),
        # Part B II.C.1.b.i.'s sixth spec line is printed "II.C.1.b.i.F     Peak
        # Hold Feature" with no trailing dot (A.-E. all have one).
        dict(
            old_label="II.C.1.b.i.F", new_label="II.C.1.b.i.F.",
            match_prefix="II.C.1.b.i.F     Peak Hold Feature",
            line_hint=1413,
            note='Printed "II.C.1.b.i.F" (missing trailing dot) — a source-text typo for '
                 '"II.C.1.b.i.F.", the sixth sibling of II.C.1.b.i.A.-E.',
        ),
        # Part B II.D.2.e. ("Calibration:")'s first sub-item is printed
        # "II.D.2.e.i        Provision for field checking..." with no
        # trailing dot; its sibling "II.D.2.e.ii." has one.
        dict(
            old_label="II.D.2.e.i", new_label="II.D.2.e.i.",
            match_prefix="II.D.2.e.i        Provision for field checking the accuracy",
            line_hint=1514,
            note='Printed "II.D.2.e.i" (missing trailing dot) — a source-text typo for '
                 '"II.D.2.e.i.", the first sibling before II.D.2.e.ii.',
        ),
        # Part B III.C.4.b.'s sixth step is printed "III C.4.b.vi.    Reserved"
        # with the dot after "III" missing (a space instead), between
        # "III.C.4.b.v." and "III.C.4.b.vii." — nothing tokenizes on it at
        # all, so the "Reserved" placeholder row was silently folded into
        # III.C.4.b.v.'s text.
        dict(
            old_label="III C.4.b.vi.", new_label="III.C.4.b.vi.",
            match_prefix="III C.4.b.vi.    Reserved",
            line_hint=1922,
            note='Printed "III C.4.b.vi." (space instead of the dot after "III") — a source-text '
                 'typo for "III.C.4.b.vi.", the reserved sixth step between III.C.4.b.v. and vii.',
        ),
    ],
    "20": [
        # Part G, Section V.A.6.d. (electricity for on-road vehicle charging)
        # has two sub-questions printed "V.A.6.d.i." and then "V.A,6.d.ii."
        # (REG_20.txt line 1309, confirmed in the PDF text layer) — a comma
        # where the second dot belongs. The tokenizer stops at "V." for it,
        # so without the fix the line was folded into V.A.6.d.'s text while
        # "V.A.6.d.i." became a row on its own.
        dict(
            old_label="V.A,6.d.ii.", new_label="V.A.6.d.ii.",
            match_prefix="V.A,6.d.ii.         If present, provide kW capacity of the charger(s).",
            line_hint=1309,
            note='Printed "V.A,6.d.ii." (comma for the second dot) directly after "V.A.6.d.i." — '
                 'a source-text typo for "V.A.6.d.ii.".',
        ),
    ],
    "27": [
        # Part B, Section II.A.1. ("Basic emissions information") lists four
        # sub-items: II.A.1.a., II.A.1.b., II.A.1.c. and then a fourth
        # printed "I.A.1.d. The difference in metric tons of CO2e between the
        # GEMM 2 facility's GEMM 2 annual GHG emissions requirement for 2030
        # and ... for 2024" (line 763 of REG_27.txt, confirmed the PDF's own
        # text layer) — the roman "II" lost an "I". Without the fix the
        # tokenizer accepts it as a child of Part B Section I.A.1. (a real
        # earlier item, whose own children are I.A.1.a./b.), producing
        # `sec-27-B-I-A-1-d` with a label gap (a, b, d) under the wrong
        # parent and leaving II.A.1. with only three of its four items.
        dict(
            old_label="I.A.1.d.", new_label="II.A.1.d.",
            match_prefix="I.A.1.d. The difference in metric tons of CO2e between the GEMM 2",
            line_hint=763,
            note='Printed "I.A.1.d." directly after "II.A.1.c." under "II.A.1." — a source-text '
                 'typo for "II.A.1.d." (Part B, Section II.A.1.\'s fourth basic-emissions item).',
        ),
        # Part D, Section II.D. ("Any individual who requires access to the
        # GHG crediting and tracking system...") has three numbered items;
        # the first is printed "II.D.1   Each manufacturing stationary
        # source and midstream segment company must designate..." (line
        # 1913) with NO trailing period, unlike "II.D.2." / "II.D.3." and
        # every other label in the document (confirmed in the PDF text
        # layer). Without the period the line does not tokenize and the
        # whole item was folded into II.D.'s own text, leaving II.D.2./3. as
        # a sequence starting at 2.
        dict(
            old_label="II.D.1", new_label="II.D.1.",
            match_prefix="II.D.1   Each manufacturing stationary source and midstream segment company",
            line_hint=1913,
            note='Printed "II.D.1" without the trailing period every sibling ("II.D.2.", '
                 '"II.D.3.") has; without it the line does not tokenize and item 1 was folded '
                 'into II.D.',
        ),
    ],
    # Air Quality Standards (key "aqs"): nine consecutive statement-of-basis
    # entries, VIII.Q through VIII.Y (REG_AQS.txt lines 2288-2532, PDF pages
    # 57-62), are printed WITHOUT the trailing period every other entry has
    # ("VIII.P. Greeley" ... "VIII.Q Denver Carbon Monoxide" ... "VIII.Z.
    # Ambient Air Quality Standards Regulation Update") — confirmed in the
    # PDF's own text layer (pdfplumber extracts the same nine lines without
    # a period), not a pdftotext artifact. Without the period none of the
    # nine tokenizes, so all nine entries (about 250 lines) were folded into
    # entry VIII.P.'s row and the letter sequence jumped P -> Z (gate E).
    # Each fix is pinned by the entry's own topic text, unique in the
    # document (the Editor's Notes cite "VIII.X, VIII.Y" but never with the
    # topic).
    "aqs": [
        dict(old_label="VIII.Q", new_label="VIII.Q.", match_prefix="VIII.Q Denver Carbon Monoxide",
             line_hint=2288, note='Printed "VIII.Q" with no trailing period (entries Q-Y all lack it).'),
        dict(old_label="VIII.R", new_label="VIII.R.", match_prefix="VIII.R Longmont and Colorado Springs Carbon Monoxide",
             line_hint=2319, note='Printed "VIII.R" with no trailing period.'),
        dict(old_label="VIII.S", new_label="VIII.S.", match_prefix="VIII.S Denver 8-Hour Ozone",
             line_hint=2355, note='Printed "VIII.S" with no trailing period.'),
        dict(old_label="VIII.T", new_label="VIII.T.", match_prefix="VIII.T Denver 8-Hour Ozone",
             line_hint=2389, note='Printed "VIII.T" with no trailing period (same topic line as VIII.S — '
                                  'both fixes match their own line only, since each old_label is distinct).'),
        dict(old_label="VIII.U", new_label="VIII.U.", match_prefix="VIII.U Denver and Longmont Carbon Monoxide",
             line_hint=2402, note='Printed "VIII.U" with no trailing period.'),
        dict(old_label="VIII.V", new_label="VIII.V.", match_prefix="VIII.V Cañon City PM10",
             line_hint=2438, note='Printed "VIII.V" with no trailing period.'),
        dict(old_label="VIII.W", new_label="VIII.W.", match_prefix="VIII.W Denver Metro Area/North Front Range 8-Hour Ozone Emissions Budgets",
             line_hint=2473, note='Printed "VIII.W" with no trailing period.'),
        dict(old_label="VIII.X", new_label="VIII.X.", match_prefix="VIII.X Pagosa Springs PM10",
             line_hint=2497, note='Printed "VIII.X" with no trailing period.'),
        dict(old_label="VIII.Y", new_label="VIII.Y.", match_prefix="VIII.Y Telluride PM10",
             line_hint=2532, note='Printed "VIII.Y" with no trailing period.'),
    ],
    "21": [
        # Part A's definitions list (Section VI) runs "VI.L. Aerosol
        # product" / "VI.M. Agricultural use" / then "VI.MN. “Anti-static
        # product”" (line 1280 of REG_21.txt; confirmed in REG_21.pdf page
        # 20's own text layer) / "VI.O. Antiperspirant" — "MN" is a typo for
        # "N." (the alphabetical run Agricultural -> Anti-static ->
        # Antiperspirant is unbroken and "N" is the only unprinted letter).
        # "MN" does tokenize (two upper letters), so without the fix the term
        # became a `sec-21-A-VI-MN` row between M and O with no N row at all.
        dict(
            old_label="VI.MN.", new_label="VI.N.",
            match_prefix="VI.MN. “Anti-static product” means a product that is labeled",
            line_hint=1280,
            note='Printed "VI.MN." between "VI.M." (Agricultural use) and "VI.O." '
                 '(Antiperspirant) in Part A\'s definitions — a source-text typo for "VI.N." '
                 '(the alphabetical run is unbroken and N is the only letter not printed).',
        ),
        # "Lubricant" (VI.VVVV.) lists its nine subcategories under
        # VI.VVVV.1. as "VI.VVVV.1.a." .. "VI.VVVV.1.i.", but eight of the
        # nine are printed with a SPACE after the roman numeral — "VI.
        # VVVV.1.a. “Anti-seize lubricant”" (REG_21.txt lines 1994-2027; only
        # "VI.VVVV.1.e." is printed normally) — confirmed to be the PDF's own
        # text layer (pdfplumber extracts "VI." and "VVVV.1.a." as separate
        # words 3 pt apart on pages 31-32), not a pdftotext artifact. A label
        # with an internal space tokenizes as the bare roman "VI." alone, so
        # each of the eight became a spurious second "VI." top-level marker
        # (eight duplicate `sec-21-A-VI` ids) that swallowed its definition.
        # "Sealant or caulking compound" (VI.KKKKKK.1.) has the same slip on
        # both of its subcategories AND the roman itself is misprinted "IV."
        # ("IV. KKKKKK.1.a. “Chemically curing sealant..."", lines 2467/2479,
        # page 40 of the PDF) — two spurious "IV." top-level markers
        # (duplicate `sec-21-A-IV` ids) instead.
        *[
            dict(
                old_label=f"VI. VVVV.1.{ltr}.", new_label=f"VI.VVVV.1.{ltr}.",
                match_prefix=f"VI. VVVV.1.{ltr}. “{term}”",
                line_hint=line,
                note=f'Printed "VI. VVVV.1.{ltr}." (a space after the roman numeral) for the '
                     f'"{term}" lubricant subcategory — a source-text slip for "VI.VVVV.1.{ltr}."; '
                     'with the space the line tokenized as a bare "VI." and became a spurious '
                     'duplicate of the Section VI heading.',
            )
            for ltr, term, line in [
                ("a", "Anti-seize lubricant", 1994), ("b", "Cutting or tapping oil", 2000),
                ("c", "Dry lubricant", 2008), ("d", "Firearm lubricant", 2017),
                ("f", "Multi-purpose lubricant", 2026), ("g", "Penetrant", 2035),
                ("h", "Rust preventative or rust control lubricant", 2041),
                ("i", "Silicone-based multi-purpose lubricant", 2045),
            ]
        ],
        dict(
            old_label="IV. KKKKKK.1.a.", new_label="VI.KKKKKK.1.a.",
            match_prefix="IV. KKKKKK.1.a.         “Chemically curing sealant or caulking compound”",
            line_hint=2467,
            note='Printed "IV. KKKKKK.1.a." (wrong roman numeral AND a space after it) for the '
                 '"Chemically curing sealant or caulking compound" subcategory under VI.KKKKKK.1. '
                 '— a source-text slip for "VI.KKKKKK.1.a."; the line tokenized as a bare "IV." '
                 'and became a spurious duplicate of the Section IV heading.',
        ),
        dict(
            old_label="IV. KKKKKK.1.b.", new_label="VI.KKKKKK.1.b.",
            match_prefix="IV. KKKKKK.1.b.        “Non-chemically curing sealant or caulking compound”",
            line_hint=2479,
            note='Printed "IV. KKKKKK.1.b." (wrong roman numeral AND a space after it) for the '
                 '"Non-chemically curing sealant or caulking compound" subcategory under '
                 'VI.KKKKKK.1. — a source-text slip for "VI.KKKKKK.1.b.".',
        ),
    ],
    # Reg 31 (Control of Methane Emissions from MSW Landfills): five printed
    # label slips, every one confirmed against the PDF's own text layer with
    # pdfplumber (the glyphs really are printed that way — none is a
    # pdftotext -layout artifact). None of the five tokenizes where it
    # stands, so without these fixes each item is folded into a sibling or
    # parent as an inline paragraph, label text and all.
    "31": [
        # Part B, Section II.D.3.a.'s two sub-items print "I.D.3.a.(i)" /
        # "I.D.3.a.(ii)" — one "I" short of their own parent, whose text a
        # line earlier says "For the purposes of this Section II.D.3.a.".
        # Part B has no Section I.D.3. at all (Section I is Waste-in-Place
        # Reporting, I.A.-I.D. with no I.D.3.), so the printed labels cannot
        # be read any other way. The match_prefix carries the following
        # words because "I.D.3.a.(ii)" itself starts with "I.D.3.a.(i)".
        dict(
            old_label="I.D.3.a.(i)", new_label="II.D.3.a.(i)",
            match_prefix="I.D.3.a.(i)  If re-monitoring shows a third exceedance",
            line_hint=704,
            note='Printed "I.D.3.a.(i)" under Part B, Section II.D.3.a. — one roman "I" short.',
        ),
        dict(
            old_label="I.D.3.a.(ii)", new_label="II.D.3.a.(ii)",
            match_prefix="I.D.3.a.(ii)  Meet the requirements of Part C to install and operate",
            line_hint=709,
            note='Printed "I.D.3.a.(ii)" under Part B, Section II.D.3.a. — one roman "I" short.',
        ),
        # Part C III.B. runs III.B.1. .. III.B.8. and then prints "IIl.B.9."
        # — a lower-case letter "l" for the third "I". III.B.3.'s own text
        # cites "III.B.8. or III.B.9.", so the intended label is not in
        # doubt; without the fix the whole of III.B.9. (the replacement gas
        # control device rule) was inline text of III.B.8. and the
        # regulation's own "III.B.9." citation had no target to resolve to.
        dict(
            old_label="IIl.B.9.", new_label="III.B.9.",
            match_prefix="IIl.B.9. If the owner or operator replaces the gas control device",
            line_hint=2118,
            note='Printed "IIl.B.9." (lower-case l for the third I) after III.B.8. in Part C.',
        ),
        # Part E I.A.1. runs a.-e.; "d" prints with NO trailing dot, and
        # tokenize_by_cycle needs the dot, so the item was folded into
        # I.A.1.c.
        dict(
            old_label="I.A.1.d", new_label="I.A.1.d.",
            match_prefix="I.A.1.d           Ability to detect methane emissions without physical access",
            line_hint=2879,
            note='Printed "I.A.1.d" (no trailing dot) between I.A.1.c. and I.A.1.e. in Part E.',
        ),
        # Part I IV.B.1. runs a.-e.; "b" prints "IV.B1.b." — the dot between
        # the "B" and the "1" is missing.
        dict(
            old_label="IV.B1.b.", new_label="IV.B.1.b.",
            match_prefix="IV.B1.b.      A data recorder is not required.",
            line_hint=4338,
            note='Printed "IV.B1.b." (missing the dot after B) between IV.B.1.a. and IV.B.1.c. in Part I.',
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
    "proc": [
        dict(
            label="VI.C.14. (Part A)",
            line_hint=2354,
            note=(
                'Part A\'s Section VI.C. hearing-procedure list runs "VI.C.12. Location of '
                'Hearing", "VI.C.13. Continuances", then jumps to "VI.C.15. Subpoenas" and '
                '"VI.C.16. Filing and Service of Documents" (REG_PROC.txt 2315/2330/2354/2374) '
                '\u2014 there is no VI.C.14. Part B prints the identical list correctly numbered '
                '(VI.C.12/13/14 Subpoenas/15 Filing and Service, lines 5270-5329), which confirms '
                'the Part A numbering is a printed slip and that no item is missing. Part A\'s own '
                'cross-references cite the PRINTED labels ("VI.C.6, VI.C.12-13, and VI.D.8", line '
                '1930), so renumbering would break them: the printed labels are kept as-is and '
                'there is no `sec-proc-A-VI-C-14` row.'
            ),
        ),
        dict(
            label="III.W. (Part B)",
            line_hint=3323,
            note=(
                'Part B\'s definitions run "III.U. Rulemaking Proceeding", "III.V. Rulemaking '
                'Request", then "III.X. State Implementation Plan (SIP)", "III.Y. Working Day", '
                '"III.Z. Written Testimony" (REG_PROC.txt 3308-3329) \u2014 the letter W is skipped. '
                'The terms stay in strict alphabetical order across the gap (Rulemaking Request '
                '\u2192 State Implementation Plan), so no definition is missing; the printed labels '
                'are kept and there is no `sec-proc-B-III-W` row.'
            ),
        ),
    ],
    "sip": [
        dict(
            label="VIII.B.5.c.",
            line_hint=1006,
            note=(
                'Section VIII.B.5. ("Recordkeeping Requirements", Steamboat Springs) prints its '
                'two list items as "c." and "d." (REG_SIP.txt lines 1006, 1009) with no "a." or '
                '"b." at all — the 2001 revision that "repeals unnecessary reporting requirements" '
                '(VIII.F.) evidently removed the first two items without relettering. Relabeling '
                'them "a."/"b." would invent citations, so they are kept as printed, as inline '
                "paragraphs of the `sec-sip-VIII-B-5` row (label text included), not as rows of "
                "their own — exactly the Reg 1 III.D.1.e.(ii)(A) treatment."
            ),
        ),
        dict(
            label="I.C.2.c.",
            line_hint=174,
            note=(
                'Section I.C.2. (Pagosa Springs) prints item "c." ending mid-sentence ("...reduce '
                'the amount of street sanding") and item "d." continuing it ("Materials applied by '
                'fifteen (15) percent from the base sanding amount..."), lines 174-179 — a printed '
                "paragraph split, not a typo the parser can safely undo. Both rows are kept exactly "
                "as printed (`sec-sip-I-C-2-c`, `sec-sip-I-C-2-d`); the summarizer should read them "
                "together."
            ),
        ),
    ],
    "1": [
        dict(
            label="III.D.1.e.(ii)(A)",
            line_hint=688,
            note=(
                'Section III.D.1.e. prints "(i) It shall be a violation ... if the owner or '
                'operator:" and then three items labeled "III.D.1.e.(ii)(A)", "(ii)(B)", '
                '"(ii)(C)" (lines ~688-701) followed by "III.D.1.e.(iii)" — there is no '
                '"III.D.1.e.(ii)" line at all, so the printed "(ii)" level has no text and no '
                "parent row. Grammatically the three items complete (i)'s sentence, but "
                'relabeling them "(i)(A)"-"(i)(C)" would invent citations, and synthesizing '
                'an empty "(ii)" row would invent a provision. They are therefore kept as '
                "printed, as inline paragraphs of the `sec-1-III-D-1-e-(i)` row (label text "
                "included), not as rows of their own."
            ),
        ),
    ],
    "25": [
        dict(
            label="I.L.1.c.(xv)",
            line_hint=1646,
            note=(
                'Part B, Section I.L.1.c. prints the label "I.L.1.c.(xv)" twice in a row for two '
                'different definitions: line ~1635 ("High-Performance Architectural Coating") and '
                'line ~1646 ("Metallic Coating"); the list then continues "(xvi) Military '
                'Specification Coating" through "(xxvi)" (confirmed in REG_25.pdf page 37\'s own '
                'text layer, not a pdftotext artifact). Both definitions are kept, merged into one '
                'row `sec-25-B-I-L-1-c-(xv)`, in printed order — not renumbered.'
            ),
        ),
        dict(
            label="I.L.1.c.(x)",
            line_hint=1614,
            note=(
                'Part B, Section I.L.1.c. skips "(x)": "(ix) Etching Filler" (line ~1610) is '
                'followed directly by "(xi) Extreme Environmental Conditions" (line ~1614) — '
                'confirmed in REG_25.pdf page 37\'s own text layer. No definition is missing '
                '(the alphabetical run is unbroken), so the printed labels are kept as-is: there '
                'is no `sec-25-B-I-L-1-c-(x)` row and (xi)-(xxvi) are not renumbered.'
            ),
        ),
    ],
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
    "12": [
        dict(
            label="I.D.7.d.ii.F.",
            line_hint=1277,
            note=(
                'Part B I.D.7.d.ii. lists the emissions-related repair systems as "I.D.7.d.ii.A." '
                '(Air intake systems), "B.", "C.", "D." (Turbochargers...) and then jumps to '
                '"I.D.7.d.ii.F." (Fuel control systems) and "G." (Basic Engine Systems) — there '
                'is no "E." printed anywhere (confirmed in the PDF text layer, not a pdftotext '
                'drop). Renumbering F/G to E/F would invent citations that differ from the '
                'printed regulation, so the labels are kept exactly as printed: rows '
                '`sec-12-B-I-D-7-d-ii-D` is followed by `...-F` and `...-G`, with no `...-E` row.'
            ),
        ),
    ],
    # Reg 21's Part A definitions list (Section VI, ~200 terms, labels A ..
    # QQQQQQQ) is an alphabetical list whose printed labels slip four times
    # (each confirmed in REG_21.pdf's own text layer via pdfplumber, not a
    # pdftotext artifact). Only the "VI.MN." typo is corrected (see
    # KNOWN_LABEL_FIXES["21"]); the others are kept exactly as printed. Part
    # B's definitions list (VI.A. .. VI.UUU.) is clean.
    "21": [
        dict(
            label="VI.BBB.",
            line_hint=1585,
            note=(
                'Part A Section VI skips "VI.BBB.": "VI.AAA. Electronic cleaner" (line ~1567) '
                'is followed directly by "VI.CCC. Engine degreaser" (line ~1585) — confirmed in '
                'REG_21.pdf page 25\'s own text layer. No definition is missing (the '
                'alphabetical run Electronic -> Engine is unbroken), so the printed labels are '
                'kept as-is: there is no `sec-21-A-VI-BBB` row and CCC onward are not renumbered.'
            ),
        ),
        dict(
            label="VI.DDDDD.",
            line_hint=2111,
            note=(
                'Part A Section VI prints the label "VI.DDDDD." twice for two different '
                'definitions: line ~2085 ("Motor vehicle wash") and line ~2111 ("Multi-purpose '
                'lubricant", which carries its own "VI.DDDDD.1." effective-date sub-item) — '
                'confirmed in REG_21.pdf pages 33-34\'s own text layer. Both definitions are kept, '
                'merged into one row `sec-21-A-VI-DDDDD`, in printed order — not renumbered '
                '(renumbering would shift every later label through QQQQQQQ away from the '
                'printed citations).'
            ),
        ),
        dict(
            label="VI.EEEEE.",
            line_hint=2121,
            note=(
                'Part A Section VI likewise prints "VI.EEEEE." twice: line ~2101 ("Multi-purpose '
                'dry lubricant", with a "VI.EEEEE.1." sub-item) and line ~2121 ("Multi-purpose '
                'solvent", also with a "VI.EEEEE.1." sub-item) — confirmed in REG_21.pdf page '
                '34\'s own text layer. Both definitions are kept, merged into one row '
                '`sec-21-A-VI-EEEEE` (and both sub-items into `sec-21-A-VI-EEEEE-1`), in printed '
                'order — not renumbered.'
            ),
        ),
        dict(
            label="VI.WWWWWW.",
            line_hint=2604,
            note=(
                'Part A Section VI skips "VI.WWWWWW.": "VI.VVVVVV. Spray buff product" (line '
                '~2601) is followed directly by "VI.XXXXXX. Table B compound" (line ~2604) — '
                'confirmed in REG_21.pdf page 42\'s own text layer. No definition is missing '
                '(Spray buff -> Table B is alphabetical), so the printed labels are kept as-is: '
                'there is no `sec-21-A-VI-WWWWWW` row.'
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
                if fix.get("next_line_prefix") is not None:
                    # Optional extra discriminator: the next NON-BLANK line
                    # must start with this text. Needed when the misprinted
                    # label line is printed IDENTICALLY to a correct one
                    # elsewhere (Reg 11's Part H prints "XII.   AMENDMENTS"
                    # twice — only the second is wrong — and each entry's
                    # "ADOPTED <date>" line is what tells them apart).
                    j = i + 1
                    while j < len(out) and out[j].strip() == "":
                        j += 1
                    if j >= len(out) or not out[j].strip().startswith(fix["next_line_prefix"]):
                        continue
                indent = len(ln) - len(ln.lstrip(" "))
                if fix.get("prev_blank_line") is not None:
                    # Optional: a label line that FUSED the previous item's
                    # whole text onto its own front (Reg 19's
                    # "(Reserved)III.B.5.       Re-certification" — the
                    # printed remnant of "III.B.4. (Reserved)" + "III.B.5.
                    # Re-certification"): besides rewriting this line's
                    # label, write `prev_blank_line` (at the same indent)
                    # into the blank line immediately above, which must be
                    # blank — line count and every later line index (page
                    # seams, other fixes' line hints) stay exactly as they
                    # were. The fix is skipped (0 hits, reported) if the
                    # line above is not blank.
                    if i == 0 or out[i - 1].strip() != "":
                        continue
                    out[i - 1] = (" " * indent) + fix["prev_blank_line"]
                rest = ln.lstrip(" ")[len(fix["old_label"]):]
                out[i] = (" " * indent) + fix["new_label"] + rest
                hits += 1
        applied.append(dict(
            old_label=fix["old_label"], new_label=fix["new_label"],
            line_hint=fix["line_hint"], note=fix["note"], hits=hits,
        ))
    return out, applied


# --------------------------------------------------------------------------
# Confirmed INLINE label splits: a genuine provision label printed in the
# MIDDLE of a physical line, immediately after the previous sibling's last
# sentence, instead of starting its own line. No marker scan can see such a
# label (every family regex is anchored to the start of the line), so the
# item silently becomes a sentence inside its previous sibling's text.
#
# Each entry rewrites exactly TWO adjacent lines and changes no text and no
# line COUNT (so every later `line_hint`, page seam index and other fix is
# untouched): the matched line is cut just before `inline_label`, its head
# stays put, and the cut tail is joined onto the FOLLOWING line — which must
# be that item's own wrapped continuation, identified by `next_line_prefix`
# — re-indented to `new_indent` (the sibling labels' printed column) so the
# ordinary column/continuation guards see it exactly as they see the real
# siblings around it. Same discipline as KNOWN_LABEL_FIXES: matched by the
# label plus enough surrounding words to be unique in the document, and the
# parse output reports the hit count (must be exactly 1).
#
# A strict no-op for every regulation with no entry here.
# --------------------------------------------------------------------------

KNOWN_INLINE_LABEL_SPLITS: dict[str, list[dict]] = {
    "proc": [
        # AQCC Procedural Rules, Part B, V.D.5.a. ("Requirements for
        # Position Statements"): the printed list runs (i), (ii), (iv),
        # (v), (vi) down the left margin, and item (iii) is printed inside
        # (ii)'s second line — "...to take on the Proposal or Redlines.
        # V.D.5.a.(iii) A list of any pending / motions." (REG_PROC.txt
        # 4238-4239; confirmed in the PDF's own text layer, page 70). The
        # split restores "V.D.5.a.(iii) A list of any pending motions." as
        # its own line at the siblings' column (24), leaving (ii) ending at
        # "...Proposal or Redlines."
        dict(
            match_prefix="to take on the Proposal or Redlines. V.D.5.a.(iii) A list of any pending",
            inline_label="V.D.5.a.(iii)",
            next_line_prefix="motions.",
            new_indent=24,
            line_hint=4238,
            note=(
                'Printed "... Proposal or Redlines. V.D.5.a.(iii) A list of any pending motions." '
                "— item (iii) of the Position Statement list runs on inside item (ii)'s "
                "paragraph instead of starting its own line; split back out so (iii) is its own row."
            ),
        ),
    ],
}


def apply_inline_label_splits(reg: str, lines: list[str]) -> tuple[list[str], list[dict]]:
    """Applies KNOWN_INLINE_LABEL_SPLITS[reg] to the cleaned lines (before
    marker scanning, like apply_known_label_fixes / apply_known_text_fixes)
    and returns (new_lines, applied) in the same report shape
    (old_label/new_label/line_hint/note/hits)."""
    entries = KNOWN_INLINE_LABEL_SPLITS.get(reg, [])
    if not entries:
        return lines, []
    out = list(lines)
    applied: list[dict] = []
    for e in entries:
        hits = 0
        for i, ln in enumerate(out):
            if not ln.strip().startswith(e["match_prefix"]):
                continue
            pos = ln.find(e["inline_label"])
            if pos <= 0 or i + 1 >= len(out):
                continue
            nxt = out[i + 1].strip()
            if not nxt.startswith(e["next_line_prefix"]):
                continue
            head = ln[:pos].rstrip()
            tail = ln[pos:].strip()
            out[i] = head
            out[i + 1] = (" " * e["new_indent"]) + tail + " " + nxt
            hits += 1
        applied.append(dict(
            old_label=e["inline_label"], new_label=e["inline_label"] + " (moved to its own line)",
            line_hint=e["line_hint"], note=e["note"], hits=hits,
        ))
    return out, applied


# Confirmed wrapped-citation continuation lines that the generic guards in
# `_label_position_plausible` / `_marker_column_signals` cannot catch: a
# physical line that STARTS with a citation-shaped token because the previous
# line broke right before it ("...described in\nIV.D.2. may apply..."), where
# the previous line neither ends in a cue word the guard knows ("Section",
# "Part", "or", ...) nor lacks the "confident previous line" signal (it IS the
# enclosing marker's own line). Same discipline as KNOWN_LABEL_FIXES: matched
# by the label plus enough following words to be unique in the document, and
# the parse output reports the hit count (must be exactly 1). The line's text
# is never altered — it is only excluded from marker candidacy, so it stays
# ordinary body text of the provision it wraps.
KNOWN_CONTINUATION_LINES: dict[str, list[dict]] = {
    "12": [
        dict(
            match_prefix="I.B.16.", whole_line=True,
            line_hint=643,
            note=(
                'Part A IV.C.5. reads "...which document is incorporated herein by reference as '
                'provided in Part A,\nI.B.16." — the wrapped citation "I.B.16." is the ENTIRE '
                'physical line (previous line dangles on "Part A,", which the generic guard '
                'treats as a confident "Part" cue only for a following LETTER, not a citation) '
                'and was accepted as a second "I.B.16." marker, merging IV.C.5.\'s remaining two '
                'paragraphs into the definition row `sec-12-A-I-B-16`. `whole_line` because a '
                'prefix match would also hit the two real "I.B.16. “Opacity meter”" / "I.B.16. '
                '“Diesel Opacity Inspection”" definition lines (exactly one bare line in REG_12.txt).'
            ),
        ),
        dict(
            match_prefix="I.D.2.a.i., unless such transfer of ownership is a transfer from the lessor",
            line_hint=1166,
            note=(
                'Part B I.D.2.a.ii. reads "...pursuant to Part B,\nI.D.2.a.i., unless such transfer '
                'of ownership..." — the wrapped citation opens the line (previous line dangles '
                'on "Part B,") and would be accepted as a second "I.D.2.a.i." marker, truncating '
                'I.D.2.a.ii. and appending its tail to I.D.2.a.i.'
            ),
        ),
        dict(
            match_prefix="I.D.2.a.i. unless such transfer of ownership is a transfer from the lessor",
            line_hint=1176,
            note=(
                'Part B I.D.2.b.ii. reads "...pursuant to Part B,\nI.D.2.a.i. unless such transfer '
                'of ownership..." (no comma this time) — same wrapped-citation shape as the '
                'I.D.2.a.ii. line above.'
            ),
        ),
    ],
    "1": [
        dict(
            match_prefix="IV.D.2. may apply to the division for an exemption from continuous emission",
            line_hint=1288,
            note=(
                'Section IV.D.3.a. reads "The owner or operator of a fluid bed catalytic cracking '
                'unit described in\\nIV.D.2. may apply to the division for an exemption..." — the '
                'wrapped line starts with the citation "IV.D.2." and was accepted as a second '
                '"IV.D.2." marker (duplicate id, merged into `sec-1-IV-D-2`), truncating '
                'IV.D.3.a. at "described in" and appending its text to IV.D.2.'
            ),
        ),
    ],
    "gp09": [
        dict(
            match_prefix="IV.G.1.e. through IV.G.1.h., IV.G.1.e. and IV.G.1.f., the owner or operator",
            line_hint=986,
            note=(
                'Condition IV.G.2. reads "...provisions in\\nIV.G.1.e. through IV.G.1.h., IV.G.1.e. '
                'and IV.G.1.f., the owner or operator may inspect..." — the wrapped line starts with '
                'the citation "IV.G.1.e." (previous line dangles on "in", not a cue word the generic '
                'guard knows) and was accepted as a second "IV.G.1.e." marker, truncating IV.G.2. at '
                '"provisions in" and appending its text to the real IV.G.1.e. row.'
            ),
        ),
    ],
    "gp10": [
        # Same shape as gp09's fix above — GP10 (nonattainment) shares most
        # of GP09's Section IV text verbatim, including this exact wrapped
        # citation-list continuation.
        dict(
            match_prefix="IV.G.1.e. through IV.G.1.h., IV.G.4.e. and IV.G.4.f., the owner or operator",
            line_hint=1059,
            note=(
                'Condition IV.G.2. reads "...provisions in\\nIV.G.1.e. through IV.G.1.h., IV.G.4.e. '
                'and IV.G.4.f., the owner or operator may inspect..." — same dangling-"in" wrapped '
                'citation-list shape as GP09\'s IV.G.2., truncating it and duplicating IV.G.1.e.'
            ),
        ),
    ],
    "gp06": [
        dict(
            match_prefix="III.D.3 above have been determined to be RACT for the",
            line_hint=529,
            note=(
                'Condition III.E.4.a. reads "The requirements of condition numbers III.D.1, '
                'III.D.2 and\\nIII.D.3 above have been determined to be RACT..." — the wrapped '
                'line starts with the bare number "3" of a citation list ("numbers ... and", '
                'lowercase, not the "Condition(s)"/"Section(s)" keyword the generic guard '
                'checks for) with no dot before the following space, which only became a '
                'complete-looking "III.D.3" label once REG_META `labels_without_trailing_dot` '
                'was enabled for gp06 (see FAMILY_REGEX_NO_TRAILING_DOT) — there is no real '
                '"III.D.3." condition printed anywhere in GP06.txt.'
            ),
        ),
    ],
}


# Per-regulation SOURCE-TEXT glitches confirmed against the PDF's own
# character data (pdfplumber shows them as size-6.5 superscript glyphs) that
# `pdftotext -layout` flattens onto the baseline, silently changing the
# meaning of an emission-limit formula: Reg 1's "PE=0.5(FI)-0.26" is printed
# PE = 0.5(FI)^-0.26 (a negative EXPONENT, not a subtraction), "3.59(P)0.62"
# is 3.59(P)^0.62, and every "106"/"10 6" is 10^6. Each entry replaces `old`
# with `new` inside the one line that contains it (or, with `whole_line`,
# blanks a line whose entire stripped content is `old` — used for a
# superscript that pdftotext dropped onto its own physical line — guarded by
# `prev_endswith` on the previous non-blank line so it can only ever fire in
# the one confirmed spot). Caret notation is used because full_text is
# entity-escaped before markup is added, so "<sup>" can't be emitted here.
# Hit counts are reported next to the label fixes (must be exactly 1 each).
KNOWN_TEXT_FIXES: dict[str, list[dict]] = {
    # -- Batch 7 --------------------------------------------------------
    # Reg 15 Section IV is the ONLY top-level heading in the regulation
    # whose printed title wraps onto a second physical line:
    #
    #     IV. Notification and Reporting Requirements for Air Conditioning and Refrigeration Service
    #             Facilities
    #
    # (REG_15.txt lines 113-114). `_heading_continuation_lines` only joins a
    # wrapped heading for PART and APPENDIX markers, never for a roman
    # section, so the tail counted as body text: the row was titled by its
    # bare citation "IV." and "Notification and Reporting Requirements for
    # Air Conditioning and Refrigeration Service Facilities" became its
    # first body paragraph — a section with no title at all in the sidebar,
    # in a six-section regulation. Re-wrapped onto one line with the
    # ORDINARY in-line replace (no new mechanism) and the now-empty
    # continuation line blanked, so the LINE COUNT is unchanged and
    # `clean_pages`'s page-seam indices stay exactly as they were. Both
    # halves are matched on unique strings (the 8-space-indented lone
    # "Facilities" occurs on exactly one line of REG_15.txt; the other
    # "Facilities" in the document, line 170, is flush left) and report
    # their own hit counts, which must each be exactly 1.
    "15": [
        dict(
            old="IV. Notification and Reporting Requirements for Air Conditioning and Refrigeration Service",
            new=("IV. Notification and Reporting Requirements for Air Conditioning and Refrigeration "
                 "Service Facilities"),
            line_hint=113,
            note=(
                'Section IV: join the wrapped second line of the printed heading onto the '
                'heading line, so the section row is titled instead of carrying its title as '
                'body text. The orphaned "Facilities" line is blanked by the fix below.'
            ),
        ),
        dict(
            old="        Facilities",
            new="",
            line_hint=114,
            note=(
                'Section IV: blank the orphaned second line of the wrapped heading (its text is '
                'already restored on the heading line by the fix above). Matched with its '
                'leading whitespace — the only other "Facilities" line in REG_15.txt (line 170, '
                '"Facilities. In order to effectively collect such a fee...") is flush left.'
            ),
        ),
    ],
    # Reg 29 Part A, Section I.B.5.: the official CCR print FUSES the
    # regulation's severability provision onto the end of the exemption
    # item's second physical line, with no line break and no label of its
    # own on a line start:
    #
    #     I.B.5.    Nothing in this Section I.B. limits the applicability of the recordkeeping and reporting
    #               provisions in Section IV.I.C. Severability. If any section, clause, phrase, or standard
    #               contained in these regulations is for any reason held to be inoperative, ...
    #
    # (REG_29.txt lines 61-66; confirmed against REG_29.pdf page 1 with
    # pdfplumber's own layout-free text extraction, so it is the source
    # document's error, not a pdftotext artifact). Read literally, I.B.5.
    # ends "...reporting provisions in Section IV." and the next sentence
    # opens a new Section I item, "I.C. Severability." — Section I is
    # "Applicability and general provisions" and every other AQCC Part A
    # of this generation carries its severability clause as that part's
    # last Section I item, so I.C. is a real provision whose line break the
    # print lost. Without the fix the severability clause lived inside
    # `sec-29-A-I-B-5` (an exemption for emergency/fire/public-safety use),
    # there was no `sec-29-A-I-C` row at all, and "Section IV.I.C." went to
    # the `unparseable` bucket as a bogus five-token citation.
    #
    # Fixed with the ORDINARY in-line replace (no new mechanism, and
    # deliberately NOT a line insert): the severability sentence's opening
    # words are cut from line 62 and re-wrapped onto the front of line 63
    # carrying the "I.C." label at Section I's own item indent. Every word
    # of the printed text is preserved verbatim and the LINE COUNT is
    # unchanged, so `clean_pages`'s already-computed page-seam indices and
    # every other fix's line hint stay exactly as they were (the same
    # discipline KNOWN_LABEL_FIXES' `prev_blank_line` keeps). Both halves
    # are matched on long, unique substrings and report their own hit
    # counts, which must each be exactly 1.
    "29": [
        dict(
            old="provisions in Section IV.I.C. Severability. If any section, clause, phrase, or standard",
            new="provisions in Section IV.",
            line_hint=62,
            note=(
                'I.B.5.: cut the fused severability sentence\'s opening words off the end of '
                'the line, leaving I.B.5. ending at "...in Section IV." as printed. The cut '
                'text is restored verbatim at the front of the next line by the fix below.'
            ),
        ),
        dict(
            old="                        contained in these regulations is for any reason held to be inoperative, unconstitutional,",
            new=("              I.C.      Severability. If any section, clause, phrase, or standard "
                 "contained in these regulations is for any reason held to be inoperative, unconstitutional,"),
            line_hint=63,
            note=(
                'I.C.: restore the severability sentence\'s opening words (cut from line 62 by '
                'the fix above) at the front of this line, with the "I.C." label the print lost, '
                'at Section I\'s own item indent (14, the column I.A. and I.B.1.-I.B.5. use). '
                'Matched with its leading whitespace so the indent is set exactly.'
            ),
        ),
    ],
    "11": [
        # The Editor's Notes rule line ("____...", 70 underscores) sits on
        # the page right after Appendix B's two-line heading; clean_pages
        # strips the page break between them, so the heading-continuation
        # reader (which stops only at a blank or label-shaped line) folded
        # the rule into Appendix B's title. Blank that one line (guarded by
        # the heading's own last words) so the title ends at "[Repealed eff.
        # 11/30/2014]" and the Editor's Notes follow as body paragraphs.
        dict(old="_" * 70, new="", whole_line=True, prev_endswith="[Repealed eff. 11/30/2014]", line_hint=7855,
             note="Appendix B: the Editor's Notes rule line, otherwise folded into the appendix title."),
    ],
    "1": [
        dict(old="0.5 lbs. per 106 BTU heat input", new="0.5 lbs. per 10^6 BTU heat input", line_hint=395,
             note='III.A.1.a.: "106" is the printed superscript 10^6.'),
        dict(old="equal to 1x106 BTU/hr", new="equal to 1x10^6 BTU/hr", line_hint=396,
             note='III.A.1.a.: "1x106" is the printed 1x10^6.'),
        dict(old="heat inputs greater than 1x10 6", new="heat inputs greater than 1x10^6", line_hint=398,
             note='III.A.1.b.: "1x10 6" (superscript separated by a space) is the printed 1x10^6.'),
        dict(old="equal to 500x106 BTU per hour", new="equal to 500x10^6 BTU per hour", line_hint=399,
             note='III.A.1.b.: "500x106" is the printed 500x10^6.'),
        dict(old="PE=0.5(FI)-0.26", new="PE = 0.5(FI)^-0.26", line_hint=402,
             note='III.A.1.b. allowable PM equation: "-0.26" is a superscript EXPONENT in the PDF '
                  "(pdfplumber char size 6.5), not a subtraction — PE = 0.5(FI)^-0.26."),
        dict(old="0.1 lbs. per 106 BTU heat input", new="0.1 lbs. per 10^6 BTU heat input", line_hint=410,
             note='III.A.1.c.: "106" is the printed superscript 10^6.'),
        dict(old="500x10 BTU per hour or more.", new="500x10^6 BTU per hour or more.", line_hint=411,
             note='III.A.1.c.: the "6" exponent of 500x10^6 was dropped onto its own next line by pdftotext.'),
        dict(old="6", new="", whole_line=True, prev_endswith="500x10^6 BTU per hour or more.", line_hint=412,
             note='III.A.1.c.: the orphaned superscript "6" line (already restored into "500x10^6" above).'),
        dict(old="PE = 3.59(P)0.62", new="PE = 3.59(P)^0.62", line_hint=508,
             note='III.C.1.a. process-weight equation: "0.62" is a superscript exponent — PE = 3.59(P)^0.62.'),
        dict(old="PE = 17.31(P)0.16", new="PE = 17.31(P)^0.16", line_hint=519,
             note='III.C.1.b. process-weight equation: "0.16" is a superscript exponent — PE = 17.31(P)^0.16.'),
        dict(old="pounds per 10 6 British thermal units", new="pounds per 10^6 British thermal units", line_hint=3916,
             note='Statement of basis X.K.: "10 6" is the printed 10^6.'),
    ],
    "28": [
        # Part A, Section II.A.: "This regulation applies to owners of
        # covered buildings, as defined in Section IlI.O." (REG_28.txt line
        # 62) — the roman numeral is printed capital-I / lower-case-L /
        # capital-I, confirmed in the PDF's own text layer (page 1). The
        # tokenizer stops at nothing at all for "IlI" (no roman token
        # matches it), so the citation was never even recognized as a
        # citation and the one reference that tells a reader where "covered
        # building" is defined went unlinked; corrected to the label Part A
        # actually prints ("III.O.", line 244, the "Covered building"
        # definition). Like Reg 20's "V.b.2.q." this is a citation inside
        # body text, not a label line, so KNOWN_LABEL_FIXES (which rewrites
        # line starts) does not apply.
        dict(old="Section IlI.O.", new="Section III.O.", line_hint=62,
             note='II.A.: citation "IlI.O." is a capital-I/lower-L/capital-I typo for the '
                  'printed label "III.O." (the "Covered building" definition).'),
    ],
    "20": [
        # Part G, Section V.B.1.: "...in Sections V.B.2.a. through V.b.2.q.,
        # except Section V.B.2.j., ..." (REG_20.txt line 1356, confirmed in
        # the PDF text layer) — a lower-case "b" in the middle of an
        # otherwise upper-case citation. The tokenizer stops at "V." for it
        # (an "upper" token never matches "b"), so the citation landed in
        # the `unparseable` bucket and the range's second endpoint was left
        # unlinked; corrected to the label the list actually prints
        # ("V.B.2.q.", line 1417). This is a citation inside body text, not a
        # label line, so KNOWN_LABEL_FIXES (which rewrites line starts) does
        # not apply.
        dict(old="through V.b.2.q.,", new="through V.B.2.q.,", line_hint=1356,
             note='V.B.1.: citation "V.b.2.q." is a case typo for the printed label "V.B.2.q.".'),
        # Part H's closing paragraphs print the Westlaw URL of the
        # incorporated California regulations hard-wrapped over three
        # physical lines (REG_20.txt lines 2014-2016) with NO spaces in the
        # PDF — the paragraph joiner would otherwise put a space at each
        # break ("...guid=I88 D700E0D...", "...Type=Defa ult&...") and
        # render a URL that does not work. Restore the whole URL onto the
        # first line and blank the two continuation lines (guarded by the
        # preceding line's own tail, like Reg 1's orphaned-exponent fix).
        dict(old="CaliforniaCodeofRegulations?guid=I88",
             new="CaliforniaCodeofRegulations?guid=I88D700E0D46911DE8879F88E8B0DAAAE"
                 "&originationContext=documenttoc&transitionType=Default&contextData=%28sc.Default%29",
             line_hint=2014,
             note="Part H: the Westlaw URL is hard-wrapped over three lines; joined onto the first."),
        dict(old="D700E0D46911DE8879F88E8B0DAAAE&originationContext=documenttoc&transitionType=Defa", new="",
             whole_line=True, prev_endswith="&contextData=%28sc.Default%29", line_hint=2015,
             note="Part H: second physical line of the Westlaw URL (already restored above)."),
        dict(old="ult&contextData=%28sc.Default%29", new="",
             whole_line=True, prev_endswith="&contextData=%28sc.Default%29", line_hint=2016,
             note="Part H: third physical line of the Westlaw URL (already restored above)."),
    ],
    # Air Quality Standards (key "aqs"): Sections I.B.1. and IV carry
    # superscript footnote markers (the SO2 standard's revision history;
    # the visibility standard's five definitional footnotes) that pdftotext
    # prints as a bare digit glued to the preceding word ("(SO2)1",
    # "of.076/km 1,", "32 miles2", "standard.3", "area.4", "percent.5") with
    # each footnote's own digit dropped onto a line of its own, before OR
    # after its text (confirmed with pdfplumber: every one is a superscript
    # that precedes its footnote text — "1Extinction is a measure...",
    # "2Extinction (Bext)...", "3There are five...", "4The AIR program
    # area...", "5Any hour..."). Rewritten as bracketed markers ("[1]") so
    # the reference and its footnote read as a pair, and the orphaned digit
    # lines are removed (each pinned by the exact preceding line, after the
    # earlier fixes in this list have run — the list is applied in order).
    "aqs": [
        dict(old="Sulfur Dioxide (SO2)1", new="Sulfur Dioxide (SO2) [1]", line_hint=46,
             note='I.B.1.: superscript footnote 1 on "(SO2)".'),
        dict(old="Sulfur Dioxide: Revised: 3/10/83", new="[1] Sulfur Dioxide: Revised: 3/10/83", line_hint=72,
             note="I.B.1.: footnote 1 (the standard's revision history) — its own digit is on the next line."),
        dict(old="1", new="", whole_line=True, prev_endswith="Revised 2/18/10; Effective 3/30/10.", line_hint=73,
             note="I.B.1.: the orphaned superscript \"1\" line (restored as \"[1]\" above)."),
        dict(old="of.076/km 1, equivalent", new="of .076/km [1], equivalent", line_hint=273,
             note='IV: "of.076/km 1," is the printed ".076/km" with superscript footnote 1 (pdftotext also '
                  'dropped the space after "of").'),
        dict(old="visual range of 32 miles2", new="visual range of 32 miles [2]", line_hint=273,
             note='IV: superscript footnote 2 on "miles".'),
        dict(old="in violation of the standard.3", new="in violation of the standard. [3]", line_hint=276,
             note='IV: superscript footnote 3 after "standard."'),
        dict(old="applicable in the AIR program area.4", new="applicable in the AIR program area. [4]", line_hint=278,
             note='IV: superscript footnote 4 after "area."'),
        dict(old="is less than 70 percent.5", new="is less than 70 percent. [5]", line_hint=281,
             note='IV: superscript footnote 5 after "percent."'),
        dict(old="1", new="", whole_line=True, prev_endswith="is less than 70 percent. [5]", line_hint=282,
             note='IV: the orphaned superscript "1" line printed before footnote 1\'s text.'),
        dict(old="Extinction is a measure of the ability", new="[1] Extinction is a measure of the ability", line_hint=283,
             note="IV: footnote 1's text."),
        dict(old="Extinction (Bext) can be converted", new="[2] Extinction (Bext) can be converted", line_hint=287,
             note="IV: footnote 2's text (its digit is printed on the line after)."),
        dict(old="2", new="", whole_line=True, prev_endswith="in miles as follows:", line_hint=288,
             note='IV: the orphaned superscript "2" line.'),
        dict(old="scattering coefficient of.01/km", new="scattering coefficient of .01/km", line_hint=296,
             note='IV: footnote 2 — pdftotext dropped the space in "of .01/km".'),
        dict(old="3", new="", whole_line=True, prev_endswith="a contrast threshold of two percent.", line_hint=297,
             note='IV: the orphaned superscript "3" line printed before footnote 3\'s text.'),
        dict(old="There are five possible contiguous", new="[3] There are five possible contiguous", line_hint=298,
             note="IV: footnote 3's text."),
        dict(old="The AIR program area is defined in C.R.S.", new="[4] The AIR program area is defined in C.R.S.", line_hint=302,
             note="IV: footnote 4's text (its digit is printed on the line after)."),
        dict(old="4", new="", whole_line=True, prev_endswith="C.R.S. 42-4-307 (8).", line_hint=303,
             note='IV: the orphaned superscript "4" line.'),
        dict(old="Any hour with a relative humidity of 70 percent", new="[5] Any hour with a relative humidity of 70 percent", line_hint=307,
             note="IV: footnote 5's text (its digit is printed on the line after)."),
        dict(old="5", new="", whole_line=True, prev_endswith="the four-hour running averages.", line_hint=308,
             note='IV: the orphaned superscript "5" line.'),
        # The Editor's Notes rule line (70 underscores) opens page 82 with no
        # blank line after the last statement of basis's final sentence once
        # the page furniture is stripped, so it was joined onto that sentence
        # (the same shape Reg 11's Appendix B fix handles).
        dict(old="_" * 70, new="", whole_line=True,
             prev_endswith="alternative.", line_hint=3401,
             note="VIII.II.: the Editor's Notes rule line, otherwise joined onto the entry's last sentence."),
    ],
}


def apply_known_text_fixes(reg: str, lines: list[str]) -> tuple[list[str], list[dict]]:
    """Applies KNOWN_TEXT_FIXES[reg] to the cleaned lines (before marker
    scanning, like apply_known_label_fixes) and returns (new_lines, applied)
    in the same report shape (old_label/new_label/line_hint/note/hits)."""
    fixes = KNOWN_TEXT_FIXES.get(reg, [])
    if not fixes:
        return lines, []
    out = list(lines)
    applied: list[dict] = []
    for fix in fixes:
        hits = 0
        for i, ln in enumerate(out):
            if fix.get("whole_line"):
                if ln.strip() != fix["old"]:
                    continue
                j = i - 1
                while j >= 0 and out[j].strip() == "":
                    j -= 1
                if j < 0 or not out[j].rstrip().endswith(fix["prev_endswith"]):
                    continue
                out[i] = ""
                hits += 1
            elif fix["old"] in ln:
                out[i] = ln.replace(fix["old"], fix["new"])
                hits += 1
        applied.append(dict(
            old_label=fix["old"], new_label=fix["new"] or "(line removed)",
            line_hint=fix["line_hint"], note=fix["note"], hits=hits,
        ))
    return out, applied


def find_known_continuation_lines(reg: str, lines: list[str]) -> tuple[set[int], list[dict]]:
    """Indices (into `lines`) of the KNOWN_CONTINUATION_LINES[reg] matches,
    plus a per-entry hit report in the same shape `apply_known_label_fixes`
    returns (`hits` should be exactly 1 for every entry), so parse_reg can
    report both through the same corrections sidecar / diff-report table:
    `old_label` is the citation-shaped token that opens the line and
    `new_label` says it was kept as body text rather than rewritten."""
    entries = KNOWN_CONTINUATION_LINES.get(reg, [])
    skip: set[int] = set()
    applied: list[dict] = []
    for entry in entries:
        hits = 0
        for i, ln in enumerate(lines):
            stripped = ln.strip()
            # `whole_line` (Reg 12's "I.B.16." — a wrapped citation that is
            # the ENTIRE physical line, so a prefix match would also hit the
            # two real "I.B.16. “Opacity meter” ..." definition lines):
            # match only when the stripped line IS the prefix.
            if stripped == entry["match_prefix"] if entry.get("whole_line") else stripped.startswith(entry["match_prefix"]):
                skip.add(i)
                hits += 1
        applied.append(dict(
            old_label=entry["match_prefix"].split(" ", 1)[0],
            new_label="(continuation line — kept as body text, not a label)",
            line_hint=entry["line_hint"], note=entry["note"], hits=hits,
        ))
    return skip, applied


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


def _label_position_plausible(lines: list[str], idx: int, last_marker_line: int | None,
                               seam_starts: set[int] | None = None,
                               extra_dangling_words: tuple[str, ...] = ()) -> bool:
    """A genuine label line is preceded by a paragraph boundary: either a
    blank line, a line ending in terminal punctuation, or another label line
    (heading chained directly into its first child, e.g. "I.  Applicability"
    -> "I.A.  ..." with no body text in between). Anything else means we're
    looking at a citation-shaped fragment that happens to start a wrapped
    continuation line mid-sentence (confirmed instance: Reg 7 line ~3107,
    "...not already controlled under Sections\nI.D. or II.C.1.b. must be in
    compliance..." — "I.D." here is NOT a new label). Note: the identical
    "...and Part E became Regulation Number\n26. The upstream oil and gas
    ..." phrasing appears verbatim in both Reg 7 and Reg 26's Statement-of-
    Basis prose and produces a bare "26." at a line start in both; Reg 7's
    existing (DB-matching) output already treats that "26." as a one-off
    digit-family item under its enclosing SOB entry, so "Number" is
    deliberately NOT added to the disqualifying set below — doing so would
    flip Reg 7's row count away from its established baseline. The same
    quirk is left as-is in Reg 26's output for consistency; it is one
    spurious row, documented here and in the diff report, not a structural
    problem.

    `idx` being a page seam (see `clean_pages`) softens ONLY the "or"/"and"/
    "through" checks below, never the "Section"/"Part"/"Regulation" one: that
    trio grammatically demands a citation next regardless of where the page
    happens to break (confirmed instance: Reg 3's "...as specified in
    Section" ends one page, "II.C.3.c. of Part A, if any control equipment
    is added..." starts the next — still a dangling reference, not a new
    label, seam or not). "or" is different — it's frequently just list
    punctuation ("...; or") rather than a dangling citation, and at a seam
    that's the ONLY plausible reading, since the "previous line" there is
    really the tail of the PREVIOUS page, spliced on with no blank line by
    design (confirmed instances: Reg 3's "III.J.5.c." and "III.C.1.c.(iii)"
    each start a page immediately after a sibling list item ending "...; or"
    / "...standards, or" — without this exemption both were silently
    dropped, never even reaching the `_marker_column_signals` audit, since
    this check runs first and short-circuits acceptance)."""
    if idx == 0:
        return True
    prev = lines[idx - 1].strip()
    if prev == "":
        return True
    is_seam = seam_starts is not None and idx in seam_starts
    words = prev.split()
    last_word = words[-1].strip(".,;:") if words else ""
    # `extra_dangling_words` (GP-only: "Condition") — the GPxx permits cite
    # their own conditions as "...subject to Condition\nII.A.6. ..." /
    # "...subject to Conditions II.C.1.a. or\nII.C.1.b. and..." the exact
    # same dangling shape "Section"/"Sections" already catches; empty (a
    # no-op) for every regulation without the Condition keyword gated on.
    if last_word.rstrip("s") in ("Section", "Part", "Regulation") + extra_dangling_words:
        return False
    if last_word == "or":
        if not is_seam:
            return False
    if last_word in ("and", "through") and (
        "Section" in prev or "Sections" in prev
        or any(w in prev for w in extra_dangling_words + tuple(w + "s" for w in extra_dangling_words))
    ):
        if is_seam:
            return True
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


# Regulations whose ordinary parts contain TIGHTLY PACKED label lists: a run
# of consecutive sibling labels printed on consecutive physical lines with no
# blank line between them and no terminal punctuation at the end of each
# entry. Confirmed instance: Reg 8 Part B's acronym list, Section I.C. —
# "I.C.1.  ABIH  American Board of Industrial Hygiene, ...\nI.C.2.  ACBM
# asbestos-containing building material\nI.C.3.  ACGIH ..." through I.C.55.,
# every entry flush-left (indent 0) while the depth's learned column is 6-7,
# so 49 of the 55 entries tripped the continuation-line guard (column
# deviates + previous line lacks terminal punctuation) and were rejected,
# fusing the whole list into the I.C.1. row. For a reg listed here,
# `_marker_column_signals` treats "this candidate is the IMMEDIATE NEXT
# SIBLING of the last accepted marker" (same parent chain, same family, its
# ordinal exactly one higher — "I.C.2." right after "I.C.1.") as a
# structural paragraph-boundary signal, on a par with "first child of the
# open marker", so the column deviation alone can't reject it. It is opt-in
# per regulation (a no-op for Reg 3/7/22/26, whose outputs are baselined
# against the DB) because a wrapped citation line can in principle also name
# the next sibling ("...subject to Sections II.C.1.a. or\nII.C.1.b. and ...")
# — the dangling-word check in `_label_position_plausible` still rejects
# that exact phrasing, but the general case was never measured on the other
# regulations.
# Reg 25 (Part B surface-coating sections) prints the same tightly packed
# shape at depth 5/6 — "I.N.4.a.(i) ... control device; and,\nI.N.4.a.(ii)
# In addition to...", "IV.A.3.a.(iv) ...; or\nIV.A.3.a.(v) Flexographic...",
# "V.B.4.a. ...; and,\nV.B.4.b. Install..." — with the label a few
# characters off its depth's learned column; without this, six genuine
# labels (I.N.4.a.(ii) and its (A)/(B) children, I.O.3.a.(iii)(C),
# IV.A.3.a.(v), IV.B.1.a.(v), V.B.4.b.) were rejected by the guard and
# fused into their previous sibling (found by the gate-E sequence check).
SIBLING_CHAIN_REGS: frozenset[str] = frozenset({"8", "25"})

# Regulations (a subset of SIBLING_CHAIN_REGS) where the previous line
# ending in LIST punctuation — "...; or" / "..., or" — directly before the
# open marker's immediate next sibling is that sibling's paragraph boundary,
# not a dangling citation. `_label_position_plausible` rejects EVERY
# non-seam line that ends in "or" (Reg 7 confirmed "...subject to Sections
# II.C.1.a. or\nII.C.1.b. and ..." wraps), which also rejected Reg 25's
# "I.A.5.a. ... of this regulation; or\nI.A.5.b. Use of the specified
# equipment...", "I.O.3.a.(iii)(B) ...; or\nI.O.3.a.(iii)(C) Use acid-cured
# ..." and "IV.A.3.a.(iv) ...; or\nIV.A.3.a.(v) Flexographic ..." (three
# genuine labels, each the exact next sibling of the last accepted marker,
# each preceded by a semicolon-then-"or" list terminator that a wrapped
# citation list never prints). Opt-in per reg; a no-op for Reg 8 and every
# other regulation.
LIST_OR_SIBLING_REGS: frozenset[str] = frozenset({"25"})
_LIST_OR_ENDINGS = ("; or", ", or")

# Regulations where a SECTION/SUBSECTION HEADING whose own title happens to
# END in one of `_label_position_plausible`'s dangling cue words
# ("Section"/"Part"/"Regulation") is immediately followed, on the very next
# physical line, by its own first child. Confirmed instance: the AQCC
# Procedural Rules' Part B "V.G.   How a Final Rule Becomes a Regulation"
# (REG_PROC.txt 4661) — the page break after it swallows the blank line, so
# "V.G.1. Attorney General Review" lands directly beneath a line ending in
# the word "Regulation" and the dangling-word check rejected it outright
# (before `_marker_column_signals` ever runs, so it did not even reach the
# audit): V.G.1's whole text was fused into the V.G. row. The heading line
# cannot be dangling into a citation — it IS the last ACCEPTED marker's own
# line, and this candidate is a strict one-level extension of that marker's
# label ("first child of the open marker", the structural signal
# `_marker_column_signals` already computes), which no wrapped
# "...pursuant to Section / X.Y.Z. ..." citation ever is. Opt-in per
# regulation, exactly like SIBLING_CHAIN_REGS / LIST_OR_SIBLING_REGS, so it
# is a strict no-op for every regulation not listed (Reg 7/25/26/30 and
# ECMC re-parse byte-identical).
HEADING_CHILD_CHAIN_REGS: frozenset[str] = frozenset({"proc"})


def _prev_is_list_or(lines: list[str], idx: int) -> bool:
    """LIST_OR_SIBLING_REGS: the line before `idx` ends a list entry with
    "; or" / ", or", or is a bare "or" wrapped onto its own line after an
    entry ending in a semicolon (Reg 25's "...is used;\nor\nIV.A.3.a.(v)
    Flexographic...")."""
    if idx <= 0:
        return False
    prev = lines[idx - 1].rstrip()
    if prev.endswith(_LIST_OR_ENDINGS):
        return True
    if prev.strip() == "or" and idx >= 2 and lines[idx - 2].rstrip().endswith(";"):
        return True
    return False


def _label_ordinal(fam: str, raw: str) -> int | None:
    """1-based position of a label token within its own family's sequence
    ("1." -> 1, "b." -> 2, "(iv)" -> 4, "AA." -> 27), or None if it isn't a
    recognizable member of that family's sequence."""
    if fam in ("digit", "paren_digit"):
        return int(raw)
    if fam in ("roman", "paren_roman", "bare_lroman"):
        up = raw.upper()
        return roman_to_int(up) if is_valid_roman(up) else None
    if fam == "digit_or_lroman":
        if raw.isdigit():
            return int(raw)
        up = raw.upper()
        return roman_to_int(up) if is_valid_roman(up) else None
    if fam in ("upper", "lower", "paren_upper"):
        up = raw.upper()
        return PART_C_LETTERS.index(up) + 1 if up in PART_C_LETTERS else None
    return None


def _is_next_sibling(tokens: list, last_marker_tokens: list | None) -> bool:
    """True when `tokens` is the immediate next sibling of the last accepted
    marker: identical parent chain, same family at the last level, and the
    last token's ordinal is exactly one higher (see SIBLING_CHAIN_REGS)."""
    if last_marker_tokens is None or len(tokens) != len(last_marker_tokens) or len(tokens) < 2:
        return False
    if tuple(tokens[:-1]) != tuple(last_marker_tokens[:-1]):
        return False
    (fam_a, raw_a), (fam_b, raw_b) = last_marker_tokens[-1], tokens[-1]
    if fam_a != fam_b:
        return False
    a, b = _label_ordinal(fam_a, raw_a), _label_ordinal(fam_b, raw_b)
    return a is not None and b is not None and b == a + 1


def _marker_column_signals(lines: list[str], idx: int, indent: int, tokens: list, rest: str,
                            part: str, last_marker_line: int | None, col_stats: dict,
                            seam_starts: set[int] | None = None,
                            last_marker_tokens: list | None = None,
                            sibling_chain: bool = False) -> dict:
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
    is_next_sibling_of_open_marker = sibling_chain and _is_next_sibling(tokens, last_marker_tokens)
    confident_prev = (
        sig["prev_blank"] or sig["prev_is_marker_line"] or is_first_child_of_open_marker
        or is_next_sibling_of_open_marker
    )
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
        is_next_sibling_of_open_marker=is_next_sibling_of_open_marker,
        prev_is_marker_line=sig["prev_is_marker_line"],
    )


def _record_accepted_column(col_stats: dict, part: str, depth: int, indent: int) -> None:
    col_stats.setdefault((part, depth), Counter())[indent] += 1


def _heading_marker_plausible(lines: list[str], idx: int, last_marker_line: int | None,
                               seam_starts: set[int] | None) -> bool:
    """A genuine PART/Appendix heading is paragraph-initial: preceded by a
    blank line, chained directly onto the previous marker's own line, ending
    in terminal punctuation, or sitting at a page seam (see clean_pages) —
    never a non-blank, non-terminal-punctuated continuation of the previous
    line. Without this guard, two confirmed false positives slip through:
    Reg 3's Part F statement-of-basis prose is printed flush-left (indent 0,
    unlike Parts A-D's 4-space margin), so a hard-wrapped line can start with
    "Appendix A ..." / "Appendix B ..." mid-sentence (the regex alone can't
    tell that apart from a real appendix heading); and Reg 26's rulemaking-
    history table has a wrapped line reading "PART C IV eff. 01/14/2026."
    mid-list, inside a comma-separated list of amended citations."""
    sig = _prev_line_signals(lines, idx, last_marker_line)
    is_seam = seam_starts is not None and idx in seam_starts
    return sig["prev_blank"] or sig["prev_is_marker_line"] or sig["prev_ends_terminal"] or is_seam


_MARKER_LOOKALIKE_RE = re.compile(r"^\s*PART\s+[A-Z]\b|^(?:Appendix|APPENDIX)\s+[A-Z]\b")
# Any run of one or more short "<1-4 alnum chars>." or "(<1-4 alnum chars>)"
# tokens with no space between them, followed by whitespace — matches a bare
# label ("A.", "I.", "1.") AND a compound one ("I.A.", "I.J.1.a.(i)") without
# needing to know which specific family/cycle is in play (CYCLE_AB, a
# statement-of-basis top label like Reg 3's "I.A." or Reg 7's bare "A.",
# etc.) — deliberately broader than tokenize_by_cycle here since a heading
# continuation line must never be confused with ANY regulation's provision
# label, not just the ones the currently-open part happens to use.
_LABEL_LOOKALIKE_RE = re.compile(r"^(?:[A-Za-z0-9]{1,4}\.|\([A-Za-z0-9]{1,4}\))+\s")


def _consume_heading_continuation(lines: list[str], idx: int, max_extra: int = 3) -> str:
    """A PART/Appendix heading whose own text wraps onto subsequent physical
    lines with no blank line before the next marker (confirmed instances:
    Reg 3's Part D — "...MAJOR STATIONARY SOURCE NEW SOURCE\nREVIEW AND
    PREVENTION OF SIGNIFICANT DETERIORATION" — and Part F — "...STATUTORY
    AUTHORITY AND\nPURPOSE"). Consumes lines after `idx` while they're
    non-blank and don't themselves look like a new PART/Appendix heading or a
    provision label of any kind (see `_LABEL_LOOKALIKE_RE` — stopping there
    is what keeps this from swallowing Part D's very next line, "I.
    Applicability", or, when the current part is a statement-of-basis part
    like Reg 7's Part C, its first dated entry, "A.      December 21, 1995
    ..." — both genuine next markers with no blank line before them either),
    up to `max_extra` lines (a heading is a short title, not a paragraph —
    this bounds the heuristic if it's ever wrong). Returns the joined
    continuation text (possibly "")."""
    return " ".join(_heading_continuation_lines(lines, idx, max_extra))


def _heading_continuation_lines(lines: list[str], idx: int, max_extra: int = 3) -> list[str]:
    """The stripped continuation lines `_consume_heading_continuation` joins
    (split out so a caller can also know HOW MANY lines were consumed)."""
    extra: list[str] = []
    j = idx + 1
    while j < len(lines) and len(extra) < max_extra:
        raw = lines[j]
        s = raw.strip()
        if s == "" or _MARKER_LOOKALIKE_RE.match(raw) or _LABEL_LOOKALIKE_RE.match(s):
            break
        extra.append(s)
        j += 1
    return extra


def scan_markers(lines: list[str], seam_starts: set[int] | None = None, reg: str | None = None,
                 skip_candidates: set[int] | None = None) -> tuple[list[dict], list[dict]]:
    """Returns (markers, marker_audit). `marker_audit` records every A/B-part
    label candidate flagged by the continuation-line guard (column deviation
    and/or a previous line lacking terminal punctuation) — whether it was
    ultimately accepted as a real label or rejected as a continuation — for
    the diff report's audit section.

    `reg` selects this regulation's statement-of-basis part (if any) via
    SOB_PART_CONFIG; every part letter other than that one part is scanned
    as an ordinary nested roman/upper/digit/lower/paren-* part regardless of
    its own letter — see SOB_PART_CONFIG's docstring.

    A part-less regulation (REG_META `no_parts`, Reg 1) starts out with
    `current_part = NO_PART` instead of None, so the ordinary CYCLE_AB scan
    runs from the first line without ever needing a "PART X" heading, and
    its statement-of-basis scope is a top-level SECTION (SOB_PART_CONFIG
    `section`) rather than a part: once the ordinary scan accepts that
    section's own marker, `sob_active` flips on and the same
    statement-of-basis branch used for a part-scoped SOB takes over for the
    rest of the document.

    `skip_candidates` (from find_known_continuation_lines) lists line
    indices that are never considered as ordinary provision-label markers —
    hand-confirmed wrapped-citation continuations; empty/None for every
    regulation without KNOWN_CONTINUATION_LINES entries."""
    sob_cfg = SOB_PART_CONFIG.get(reg or "")
    sob_letter, sob_section = _sob_scope(reg)
    sob_family = sob_cfg["top_family"] if sob_cfg else None
    sob_sections = SOB_SECTION_CONFIG.get(reg or "", {})
    # See the `part_headings_are_body` guard in the PART-heading branch below.
    sob_part_body_headings = bool(sob_cfg and sob_cfg.get("part_headings_are_body"))
    no_parts = reg_has_no_parts(reg)
    cycle_ab = cycle_ab_for(reg)  # CYCLE_AB unless REG_CYCLE_AB overrides it
    # Flat-entry part (Reg 6's Part A — see FLAT_ENTRY_PART_CONFIG). `flat_active`
    # is True from that part's heading until its `sob_heading_re` line, after
    # which the same part letter continues under the SOB_PART_CONFIG branch.
    flat_cfg = FLAT_ENTRY_PART_CONFIG.get(reg or "")
    flat_letter = flat_cfg["letter"] if flat_cfg else None
    bare_part_ok = bool(flat_cfg and flat_cfg.get("bare_part_headings"))
    flat_active = False
    skip_until = -1  # lines consumed as a bare PART heading's title (bare_part_headings only)
    # GP12 "Attachment A"/"Attachment B" (see REG_META["gp12"]["attachments"]
    # and ATTACHMENT_HEADING_RE): the set of pseudo-part tokens
    # ("ATTACHMENT-A", "ATTACHMENT-B") this reg's attachments use as their
    # `current_part` value, so the item-scan branch below can select the
    # all-digit ladder cycle for them instead of cycle_ab. Empty (a no-op)
    # for every reg without an `attachments` config entry.
    attachment_letters = REG_META.get(reg or "", {}).get("attachments") or ()
    attachment_parts = frozenset(f"ATTACHMENT-{l}" for l in attachment_letters)
    # Outlined appendices (Reg 11's Appendix A — see APPENDIX_LADDERS); empty
    # (the branch is never entered) for every reg without an entry.
    ladder_letters = APPENDIX_LADDERS.get(reg or "", frozenset())
    ladder_state = _new_ladder_state()
    bare_digit_sections = BARE_DIGIT_CHILD_SECTIONS.get(reg or "", {})
    # A PART heading may wrap onto more physical lines than the default 3
    # (Reg 11's Part D heading is six lines long) — REG_META
    # `part_heading_max_lines`; every other reg keeps the default.
    part_heading_max = REG_META.get(reg or "", {}).get("part_heading_max_lines", 3)
    # Centred appendix headings (Reg 19 only — REG_META
    # `centered_appendix_headings`); False for every other reg.
    centered_appx = bool(REG_META.get(reg or "", {}).get("centered_appendix_headings"))
    # REG_META `appendix_title_after_blank` (Reg 4): the appendix heading is
    # flush-left at indent 0 like every other part-structured reg's, but its
    # TITLE is printed one blank line below it ("APPENDIX A" / "" / "Test
    # Method Protocols for Measuring Wood-Burning Masonry Heater Emissions",
    # REG_4.txt lines 1036-1038) rather than on the heading line or the very
    # next one. That is the same one-blank skip Reg 1's part-less appendices
    # and Reg 19's centred one already take, without also waiving the
    # indent-0 / raw-line match those two need — so it gets its own flag.
    # Absent (False) for every other regulation, whose appendix heading
    # handling is bit-for-bit unchanged.
    appx_title_after_blank = bool(REG_META.get(reg or "", {}).get("appendix_title_after_blank"))
    # An unlabeled preamble heading printed BEFORE the first top-level
    # section of a part-less regulation (REG_META `preamble_heading`, the
    # SIP Local Elements document's "INTRODUCTION") — None, and the test
    # below never runs, for every reg without the flag.
    preamble_heading = REG_META.get(reg or "", {}).get("preamble_heading") if no_parts else None

    markers: list[dict] = []
    current_part = NO_PART if no_parts else None
    appendix_active = None
    sob_active = False
    emitted: dict[tuple, set] = defaultdict(set)
    partc_next_idx = 0
    ab_stack: dict[str, list[tuple[str, str]]] = {}  # part letter -> current open token chain
    last_marker_line: int | None = None
    col_stats: dict[tuple, Counter] = {}
    term_def_next_n: dict[tuple, int] = {}  # ns -> next synthesized term number (see TERM_DEFINITIONS_SECTION)
    marker_audit: list[dict] = []

    def _match_sob_top(stripped: str, indent: int, idx: int) -> tuple[list | None, int | None]:
        """The statement-of-basis top-level entry test, shared by the SOB
        branch below and by the appendix-closing check for a section-scoped
        SOB. Returns (top_tokens, top_consumed) or (None, None)."""
        nxt = _sob_top_label(sob_family, partc_next_idx)
        roman_prefix = sob_cfg.get("roman_prefix") if sob_cfg else None
        # Reg 9's Section IX entries are bare letters with NO constant
        # leading roman at all in the printed text ("A.      Adopted
        # January 17, 2002", not "IX.A. ..."), unlike Reg 1's Section X
        # (which prints "X.A." literally) or Reg 3's Part F ("I.A."). The id
        # still needs to nest under the section root (`sec-9-IX-A`, not a
        # bare `sec-9-A` colliding with Section II's own definitions letter
        # A — see SOB_PART_CONFIG["9"]'s comment), so `implicit_section_
        # prefix` prepends the section's own roman token WITHOUT requiring
        # or consuming it from the line (contrast `roman_prefix`, which
        # requires and consumes a literal prefix that's actually printed).
        implicit_prefix = (
            sob_section if (sob_cfg and sob_cfg.get("implicit_section_prefix") and sob_section) else None
        )
        opener_re = (sob_cfg.get("top_opener_re") if sob_cfg else None) or DATE_START_RE
        # `top_indent_ok` (SOB_PART_CONFIG, Reg 18 only): the first entry,
        # "A. May 15, 1997", sits on the document's FIRST page, whose whole
        # text carries the 4-space left margin every CCR print's page one
        # has (REG_18.txt line 49; entries B.-G. on later pages are at
        # indent 0). The indent-0 requirement rejected it, and since the
        # letter_dated scan only ever accepts the exact NEXT letter, every
        # later entry went with it (the whole statement of basis fused into
        # the `sec-18-II` section row). Off for every other regulation.
        indent_ok = indent == 0 or bool(sob_cfg and sob_cfg.get("top_indent_ok"))
        if not indent_ok or nxt is None:
            return None, None
        if sob_family == "letter_dated":
            # `roman_prefix` (Reg 3's Part F): every entry is printed
            # with a constant leading "I." that carries no numbering
            # meaning of its own — require and consume it before the
            # letter, so `top_tokens` ends up as [roman I, upper
            # <letter>] and the id comes out `sec-3-F-I-<letter>`
            # (matching the DB's existing correctly-formed ids for
            # this range — see SOB_PART_CONFIG). Letters run up to 4
            # chars (confirmed printed labels reach 3, e.g. "MMM").
            if roman_prefix:
                pat = re.compile(rf"^{re.escape(roman_prefix)}\.([A-Z]{{1,4}})\.\s+(\S.*)$")
            else:
                pat = re.compile(r"^([A-Z]{1,2})\.\s+(\S.*)$")
            m2 = pat.match(stripped)
            if m2 and m2.group(1) == nxt and opener_re.match(m2.group(2)):
                prefix_tokens = (
                    [("roman", roman_prefix)] if roman_prefix
                    else [("roman", implicit_prefix)] if implicit_prefix
                    else []
                )
                return prefix_tokens + [("upper", nxt)], m2.end(1) + 1
        elif sob_family == "roman_seq":
            m2 = re.match(r"^([IVXLCDM]+)\.\s+(\S.*)$", stripped)
            sig = _prev_line_signals(lines, idx, last_marker_line)
            # Paragraph-initial = preceded by a blank line, OR directly
            # chained onto the PREVIOUS top-level entry's own line with
            # no blank line at all — confirmed instance: Reg 22's
            # entries V and VI sit on consecutive lines with no blank
            # between them once page-furniture stripping removes the
            # intervening page break (see clean_pages) — OR `idx` is a
            # page seam, where the "previous line" is really the tail
            # of the previous page spliced on with no blank line by
            # design (confirmed instance: Reg 26's entry III opens a
            # page immediately after Part C's prior entry's own last
            # sentence, "...maximize the air quality benefits of\n
            # regulation in the most cost-effective manner." — not a
            # blank line, not a marker line, but still genuinely
            # paragraph-initial because a page boundary always is).
            paragraph_initial = (
                sig["prev_blank"] or sig["prev_is_marker_line"]
                or (seam_starts is not None and idx in seam_starts)
                # `top_after_terminal` (SOB_PART_CONFIG, Reg 25 only): the
                # previous line ends a sentence but is NOT blank, a marker
                # line or a page seam — Reg 25's entry II is printed
                # directly under entry I's last "(V) ... in the most cost-
                # effective manner." line with no blank between them
                # (REG_25.txt line 6284). Off for every other reg, so this
                # branch never fires for them.
                or (bool(sob_cfg.get("top_after_terminal")) and sig["prev_ends_terminal"])
            )
            if m2 and m2.group(1) == nxt and paragraph_initial and opener_re.match(m2.group(2)):
                return [("roman", nxt)], len(nxt) + 1
        return None, None

    for idx, raw_line in enumerate(lines):
        stripped = raw_line.strip()
        if stripped == "":
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))

        # Matched against `raw_line` allowing leading whitespace: a real Part
        # heading is normally at indent 0, but Reg 22's Part A heading keeps
        # a 4-space left margin inherited from its page's column layout (see
        # find_body_start's docstring) — by the time scan_markers ever sees
        # these lines, find_body_start has already sliced away every
        # front-matter "Outline of Regulation" occurrence of "PART X", so a
        # real heading is the only thing this can still match, regardless of
        # its indent.
        if idx <= skip_until:
            continue

        if preamble_heading is not None and not markers and stripped == preamble_heading:
            # See REG_META["sip"]["preamble_heading"]: the heading line of an
            # unlabeled preamble printed before Section I. Only ever matched
            # before the first marker of the document, by exact whole-line
            # text, so a later body line that happens to read the same is
            # not affected. Everything up to the next marker (the "A."/"B."
            # paragraphs the bare ladder cannot hang anywhere — its chain
            # only opens on "I.") becomes this row's body text.
            markers.append({"line": idx, "type": "preamble", "heading": stripped})
            last_marker_line = idx
            continue

        m = re.match(r"^\s*PART\s+([A-Z])\s+(\S.*)$", raw_line)
        # `part_headings_are_body` (SOB_PART_CONFIG): once the statement-of-
        # basis part has started, a later "PART X <title>" line is that
        # part's own prose walking the regulation's outline, not a new part.
        # Reg 31's Part K does exactly that ("PART C - Gas Collection and
        # Control System (GCCS) Requirements", "PART D - Section II - Leak
        # Inspection and Repair", ... seven of them), and without this guard
        # each one re-opened the already-emitted part and merged two markers
        # onto one id. Reg 19's Part C prints the same kind of heading with a
        # dot after the letter ("PART A. LEAD-BASED PAINT ACTIVITES"), which
        # the regex above never matched in the first place. Off — and this
        # branch unchanged — for every reg without the flag.
        if m and sob_part_body_headings and current_part == sob_letter:
            m = None
        # `bare_part_headings` (FLAT_ENTRY_PART_CONFIG): "PART A" alone on its
        # line, title on the next non-blank line. Never attempted for a reg
        # without that setting, so Reg 3/7/22/26 are unaffected.
        m_bare = None if (m or not bare_part_ok) else re.match(r"^\s*PART\s+([A-Z])\s*$", raw_line)
        if (m or m_bare) and _heading_marker_plausible(lines, idx, last_marker_line, seam_starts):
            title_line = None
            if m:
                letter, heading = m.group(1), m.group(2).strip()
                extra = _consume_heading_continuation(lines, idx, max_extra=part_heading_max)
                if extra:
                    heading = f"{heading} {extra}"
            else:
                letter, heading = m_bare.group(1), ""
                j = idx + 1
                while j < len(lines) and lines[j].strip() == "":
                    j += 1
                if j < len(lines) and not _MARKER_LOOKALIKE_RE.match(lines[j]) \
                        and not _LABEL_LOOKALIKE_RE.match(lines[j].strip()):
                    heading = lines[j].strip()
                    extra_lines = _heading_continuation_lines(lines, j)
                    if extra_lines:
                        heading = f"{heading} {' '.join(extra_lines)}"
                    title_line = j + len(extra_lines)
                    skip_until = title_line
            current_part = letter
            appendix_active = None
            emitted[("part", letter)] = set()
            markers.append({"line": idx, "type": "part", "letter": letter, "heading": heading})
            last_marker_line = idx
            flat_active = flat_letter is not None and letter == flat_letter
            if flat_active:
                # The unlabeled intro paragraphs own everything from after
                # the title line up to the first entry marker.
                intro_line = title_line if title_line is not None else idx
                markers.append({
                    "line": intro_line, "type": "entry", "letter": letter,
                    "suffix": "INTRO", "citation": "Introduction", "rest": "",
                    "table_caption": None, "consumed": 0,
                })
                last_marker_line = intro_line
            continue

        if flat_active:
            # `sob_heading_re` is optional (Reg 20's Part H has no SOB
            # heading — see FLAT_ENTRY_PART_CONFIG); Reg 6 keeps its check.
            flat_sob_re = flat_cfg.get("sob_heading_re")
            if flat_sob_re is not None and flat_sob_re.match(stripped) and indent == 0:
                markers.append({
                    "line": idx, "type": "entry", "letter": current_part,
                    "suffix": "SOB", "citation": "Statements of Basis", "rest": stripped,
                    "table_caption": None, "consumed": len(stripped), "heading_only": True,
                })
                last_marker_line = idx
                flat_active = False
                continue
            fe = _flat_entry_match(lines, idx, last_marker_line, seam_starts,
                                   table_caption_re=flat_cfg.get("table_caption_re"))
            if fe is not None:
                mk_entry = {
                    "line": idx, "type": "entry", "letter": current_part,
                    "suffix": fe["suffix"], "citation": fe["citation"], "rest": fe["rest"],
                    "table_caption": fe["table_caption"], "consumed": len(stripped),
                }
                if fe.get("title"):
                    mk_entry["title"] = fe["title"]
                markers.append(mk_entry)
                last_marker_line = idx
            continue

        # GP12 "Attachment A: <title>" / "Attachment B: <title>" (see
        # REG_META["gp12"]["attachments"]) — printed like an Appendix
        # heading but keyed by the word "Attachment", and, unlike every
        # existing Appendix in the corpus (which swallows its whole body as
        # one undivided blob — see the `appendix_active` branch below),
        # GP12's attachments are their own scannable numeric ladder: setting
        # `current_part` to a pseudo-part token lets the ordinary item-scan
        # branch pick up its "1."/"3.1."/"7.7.2.1." markers as real child
        # rows (ATTACHMENT_DIGIT_CYCLE), the same way a real "PART X"
        # heading hands off to CYCLE_AB. A no-op for every reg without an
        # `attachments` config entry (the regex is only tried when one
        # exists at all).
        m_att = (
            re.match(r"^\s*Attachment\s+([A-Z])\s*:\s*(\S.*)$", raw_line)
            if attachment_letters else None
        )
        # Printed with a small left indent (3 spaces, a page-layout quirk —
        # confirmed against both GP12.txt occurrences of each heading) unlike
        # every ordinary top-level section heading (indent 0), so — unlike
        # the Appendix check just below — this doesn't require indent == 0.
        if m_att and _heading_marker_plausible(lines, idx, last_marker_line, seam_starts):
            letter, heading = m_att.group(1), m_att.group(2).strip()
            extra = _consume_heading_continuation(lines, idx)
            if extra:
                heading = f"{heading} {extra}"
            current_part = f"ATTACHMENT-{letter}"
            appendix_active = None
            emitted[("part", current_part)] = set()
            ab_stack.pop(current_part, None)
            markers.append({"line": idx, "type": "attachment", "letter": letter, "heading": heading})
            last_marker_line = idx
            continue

        # Case-insensitive on the word itself ("Appendix" — Reg 7/22/26 — or
        # "APPENDIX" — Reg 3), and the title text may be entirely absent from
        # the marker's own line (Reg 3's "APPENDIX C" sits alone on its line,
        # with "Toxic Air Contaminant (TAC) List ..." starting only on the
        # next physical line) — `_consume_heading_continuation` below
        # recovers that either way, whether it's completing a same-line
        # title or supplying the whole thing.
        # Reg 30 prints its own appendices with a colon directly after the
        # letter, no space — "Appendix A: Priority Toxic Air Contaminants"
        # (line 3821 of REG_30.txt), "Appendix B: Chronic Health-Protective
        # Benchmarks..." (line 4407) — the optional `:?` consumes it when
        # present and is a no-op for every other regulation, none of which
        # print the colon.
        # Reg 19 prints its Appendix A heading CENTRED (indent 46 — see
        # REG_META["19"]["centered_appendix_headings"]): for a reg with that
        # flag the regex runs on the stripped line and the indent-0
        # requirement is waived; every other reg keeps the exact raw-line,
        # indent-0 match below.
        m = re.match(r"^(?:Appendix|APPENDIX)\s+([A-Z])\b:?(?:\s+(\S.*))?$",
                     stripped if centered_appx else raw_line)
        if m and (indent == 0 or centered_appx) and _heading_marker_plausible(lines, idx, last_marker_line, seam_starts):
            letter, heading = m.group(1), (m.group(2) or "").strip()
            extra_lines = _heading_continuation_lines(lines, idx)
            title_end_line = idx + len(extra_lines)
            if not extra_lines and not heading and (no_parts or centered_appx or appx_title_after_blank):
                # Reg 1 prints "APPENDIX A" alone on its line, then a BLANK
                # line, then the title ("Method for Measuring Opacity from
                # Fugitive Particulate Emission Sources") — one blank
                # further than the Reg 3 "APPENDIX C\n<title>" shape the
                # continuation consumer handles. Skip that single blank so
                # the title isn't demoted to the appendix's first body
                # paragraph (gated to part-less regs, `centered_appendix_
                # headings` and `appendix_title_after_blank` so no other
                # reg's appendix heading can change).
                extra_lines = _heading_continuation_lines(lines, idx + 1, max_extra=1)
                if extra_lines:
                    title_end_line = idx + 1 + len(extra_lines)
            if extra_lines:
                heading = f"{heading} {' '.join(extra_lines)}".strip()
            appendix_active = letter
            ladder_state = _new_ladder_state()
            markers.append({
                "line": idx, "type": "appendix", "letter": letter, "heading": heading,
                "owner_part": current_part, "title_end_line": title_end_line,
            })
            last_marker_line = idx
            continue

        if appendix_active is not None:
            # Everything until the next marker is one undivided blob for this
            # appendix (matches how the current DB stores it; see diff report
            # for the content-omission bug this recovers). Two exceptions,
            # both closing the appendix on the next top-level statement-of-
            # basis entry rather than letting it swallow that entry too:
            #   - a SECTION-scoped statement of basis (Reg 1): its own
            #     APPENDIX A / APPENDIX B are printed in the middle of its
            #     statement-of-basis SECTION (between entries X.K. and X.L.).
            #   - a PART-scoped statement of basis whose own PART is the one
            #     currently open (Reg 30's Part C): its own Appendix A /
            #     Appendix B are printed in the middle of Part C's dated
            #     entries (between entries I./II. and II./III. — see
            #     "APPENDICES, BY PART" in REG_30.txt), the exact same shape
            #     as Reg 1's section-scoped case, just under a lettered part
            #     instead of a numbered section. `current_part == sob_letter`
            #     is only ever true here for a part whose SOB is part-scoped
            #     (SOB_PART_CONFIG's `letter`, not `section`); no existing
            #     regulation (1/2/3/6/7/22/26) prints an appendix inside its
            #     own SOB part, so this is a no-op for all of them (confirmed
            #     by the byte-identical reg1/reg2/reg26 baselines).
            sob_top_here = (
                sob_letter is not None and current_part == sob_letter
                and _match_sob_top(stripped, indent, idx)[0] is not None
            )
            if not (sob_top_here or (sob_active and _match_sob_top(stripped, indent, idx)[0] is not None)):
                if appendix_active in ladder_letters:
                    # An outlined appendix (see APPENDIX_LADDERS): keep
                    # scanning inside it for its own attachment / decimal-
                    # section / lettered-item / heading units instead of
                    # folding the whole body into the appendix row.
                    lm = _appendix_ladder_match(lines, idx, raw_line, stripped, indent,
                                                seam_starts, last_marker_line, ladder_state, reg)
                    if lm is not None:
                        lm.update(line=idx, type="appendix_item", letter=appendix_active,
                                  owner_part=current_part)
                        markers.append(lm)
                        last_marker_line = lm["title_end_line"]
                continue
            appendix_active = None

        if (sob_letter is not None and current_part == sob_letter) or sob_active:
            # A part-scoped SOB shares the part's own namespace; a section-
            # scoped one gets its own, so its `emitted` reset on each new
            # top-level entry can't disturb the ordinary items scanned
            # earlier under the implicit part.
            ns = ("part", sob_letter) if sob_letter is not None else ("sob", current_part)
            nxt = _sob_top_label(sob_family, partc_next_idx)
            top_family_tag = "upper" if sob_family == "letter_dated" else "roman"
            roman_prefix = sob_cfg.get("roman_prefix") if sob_cfg else None
            top_tokens, top_consumed = _match_sob_top(stripped, indent, idx)
            if top_tokens is not None:
                disp = (nxt,)
                emitted[ns] = {disp}
                if roman_prefix and partc_next_idx == 0 and sob_section is None:
                    # Every entry in this family carries the SAME leading
                    # roman token (Reg 3's Part F: always "I."), which is
                    # otherwise never emitted as its own row — synthesize it
                    # once, on the first entry's line, exactly like the
                    # ordinary CYCLE_AB gap-fill self-heal below (same
                    # "synthetic" marker shares its line with the marker that
                    # revealed the gap, so it gets no body text of its own —
                    # see marker_own_lines) — so every top-level entry's
                    # parent_id (`sec-3-F-I`) actually resolves to a row.
                    markers.append({
                        "line": idx, "type": "item", "ns": ns,
                        "tokens": [("roman", roman_prefix)], "consumed": 0,
                        "synthetic": True,
                    })
                partc_next_idx += 1
                markers.append({
                    "line": idx, "type": "item", "ns": ns,
                    "tokens": top_tokens, "consumed": top_consumed,
                })
                last_marker_line = idx
                continue
            inner_items_ok = (sob_cfg or {}).get("inner_items", True)
            if inner_items_ok and partc_next_idx > 0 and _label_position_plausible(lines, idx, last_marker_line, seam_starts, _condition_dangling_words(reg)):
                cur_top = _sob_top_label(sob_family, partc_next_idx - 1)
                tokens, consumed = tokenize_by_cycle(stripped, CYCLE_C_INNER)
                if tokens:
                    rest = stripped[consumed:]
                    if rest == "" or rest[0] == " ":
                        disp = (cur_top,) + tuple(token_display(f, r) for f, r in tokens)
                        # A label already emitted inside this statement-of-
                        # basis entry is a restarted inner list (these
                        # entries are narrative, not a numbered hierarchy),
                        # NOT a second marker for the same row — leave the
                        # line as body text of the current row rather than
                        # merging two unrelated paragraphs under one id.
                        if disp[:-1] in emitted[ns] and disp not in emitted[ns]:
                            emitted[ns].add(disp)
                            full_tokens = (
                                ([("roman", roman_prefix)] if roman_prefix else [])
                                + [(top_family_tag, cur_top)] + tokens
                            )
                            markers.append({
                                "line": idx, "type": "item", "ns": ns,
                                "tokens": full_tokens, "consumed": consumed,
                            })
                            last_marker_line = idx
                            continue
            continue

        if current_part is not None and current_part != sob_letter:
            if skip_candidates and idx in skip_candidates:
                continue
            ns = ("part", current_part)
            if reg in BARE_LADDER_REGS:
                # See BARE_LADDER_REGS: Reg 9 prints every label bare, so
                # depth must come from the currently open chain, not from
                # matching the full cycle from scratch.
                tokens, consumed = _bare_ladder_tokens(stripped, ab_stack.get(current_part, []), reg)
            elif current_part in attachment_parts:
                # GP12 Attachment A/B (see REG_META["gp12"]["attachments"]):
                # their items are a bare, purely-numeric ladder ("1.",
                # "3.1.", "7.7.2.1.") — never a letter or roman token at any
                # depth (confirmed: zero letter/paren markers found anywhere
                # in either attachment) — so every depth in the cycle is
                # "digit", not CYCLE_AB's roman/upper/digit/lower/paren mix.
                tokens, consumed = tokenize_by_cycle(stripped, ATTACHMENT_DIGIT_CYCLE)
            else:
                tokens, consumed = tokenize_by_cycle(stripped, cycle_ab, family_regex_for(reg))
            if tokens:
                rest = stripped[consumed:]
                # Statement-of-basis SECTION guard (see SOB_SECTION_CONFIG):
                # once this part's configured SOB section is open, only
                # compound labels rooted at that section are structure.
                sob_sec = sob_sections.get(current_part)
                if (
                    sob_sec is not None
                    and (sob_sec,) in emitted[ns]
                    and (len(tokens) < 2 or tokens[0][1] != sob_sec)
                ):
                    continue
                if rest == "" or rest[0] == " ":
                    depth = len(tokens)
                    dangling_ok = _label_position_plausible(lines, idx, last_marker_line, seam_starts, _condition_dangling_words(reg))
                    colsig = _marker_column_signals(
                        lines, idx, indent, tokens, rest, current_part, last_marker_line, col_stats,
                        seam_starts, ab_stack.get(current_part),
                        sibling_chain=(reg in SIBLING_CHAIN_REGS),
                    )
                    # SIBLING_CHAIN_REGS only: a one-line sibling entry whose
                    # last word happens to be "Regulations" ("I.C.14.  CCR
                    # Code of Colorado Regulations") is not dangling into a
                    # citation when the very next line is that entry's own
                    # next sibling ("I.C.15.  CDPHE ...") — the dangling-word
                    # check has no way to know that, so the structural
                    # signal overrides it in exactly that shape (previous
                    # line IS the last accepted marker's own line, and this
                    # candidate is its immediate next sibling).
                    chained_sibling = (
                        colsig["is_next_sibling_of_open_marker"] and (
                            colsig["prev_is_marker_line"]
                            or (reg in LIST_OR_SIBLING_REGS and _prev_is_list_or(lines, idx))
                        )
                    )
                    # HEADING_CHILD_CHAIN_REGS only: the previous line IS
                    # the last accepted marker's own line and this candidate
                    # is that marker's first child, so a dangling cue word at
                    # the end of that heading ("...How a Final Rule Becomes a
                    # Regulation") cannot mean a citation follows.
                    chained_child = (
                        reg in HEADING_CHILD_CHAIN_REGS
                        and colsig["is_first_child_of_open_marker"]
                        and colsig["prev_is_marker_line"]
                    )
                    accept_candidate = (dangling_ok or chained_sibling or chained_child) and not colsig["continuation"]
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
                            if sob_section is not None and depth == 1 and tokens[0][1] == sob_section:
                                # Section-scoped statement of basis (Reg 1's
                                # "X."): from here to the end of the document
                                # only its own top-level entries are markers.
                                sob_active = True
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
            elif bare_digit_sections:
                # Bare "N." children of a configured section (see
                # BARE_DIGIT_CHILD_SECTIONS): only reached when the line
                # carried NO ordinary compound label at all, and only regs
                # listed there reach this branch.
                chain = ab_stack.get(current_part, [])
                cfg_kind = bare_digit_sections.get((current_part, chain[0][1])) if chain else None
                bd = None
                if cfg_kind is not None:
                    bd = _match_bare_digit_child(lines, idx, stripped, seam_starts, last_marker_line,
                                                 cfg_kind, chain[0][1], chain)
                if bd is not None:
                    disp = tuple(token_display(f, r) for f, r in bd["tokens"])
                    emitted[ns].add(disp)
                    ab_stack[current_part] = bd["tokens"]
                    markers.append({
                        "line": idx, "type": "item", "ns": ns,
                        "tokens": bd["tokens"], "consumed": bd["consumed"],
                        "term": bd["term"], "bare_kind": cfg_kind,
                    })
                    last_marker_line = idx
                    continue
            elif TERM_DEFINITIONS_SECTION.get(reg or ""):
                # Unlabeled term-definitions section (see
                # TERM_DEFINITIONS_SECTION): only reached when the line
                # carried NO ordinary compound label at all (`tokens` above
                # is empty) — a real "II." marker, or a compound "I.G.4."
                # label if this section ever starts numbering, always
                # tokenizes and is handled by the `if tokens:` branch above,
                # never falls through here. Only regs listed in
                # TERM_DEFINITIONS_SECTION reach this branch at all.
                term_tokens = TERM_DEFINITIONS_SECTION[reg]
                term_disp = tuple(r for _, r in term_tokens)
                chain_disp = tuple(t[1] for t in ab_stack.get(current_part, []))
                # "in the section" = the last accepted marker IS the
                # section heading itself (about to emit the first term), or
                # IS a previously emitted term (about to emit its sibling).
                in_term_section = (
                    chain_disp[: len(term_disp)] == term_disp
                    and len(chain_disp) in (len(term_disp), len(term_disp) + 1)
                )
                if in_term_section:
                    term = _match_term_heading_line(lines, idx, seam_starts)
                    if term is not None:
                        n = term_def_next_n.get(ns, 0) + 1
                        term_def_next_n[ns] = n
                        new_tokens = list(term_tokens) + [("digit", str(n))]
                        disp = tuple(token_display(f, r) for f, r in new_tokens)
                        emitted[ns].add(disp)
                        ab_stack[current_part] = new_tokens
                        markers.append({
                            "line": idx, "type": "item", "ns": ns,
                            "tokens": new_tokens, "consumed": 0,
                            "term": term,
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


_HEADING_TAIL_FUNCTION_WORDS = frozenset(
    "a an the of for in to and or with by on at from as that which shall be is are".split()
)


def _inline_heading_stands_alone(inline_text: str, own_lines: list[str]) -> bool:
    """REG_META `heading_line_own_paragraph` (Air Quality Standards): the
    text on a label's own line is a short heading whose body text starts on
    the very next physical line with NO blank line between them ("IV.
    Visibility Standard" / "To be added to the Colorado Air Quality Control
    Commission document ...", "VI. Carbon Monoxide Standard within the
    Eisenhower Tunnel* (State Only)" / "Pursuant to the authority of ...",
    "V.C.1. Geographic Coverage" / "The geographic coverage for ...",
    "V.A.4.e. Aspen PM10" / "The 16,244 pounds-per-day ..."), so
    `split_into_paragraphs` would otherwise fuse heading and body into one
    paragraph. It is NOT a heading wrapped onto a second line ("III.
    Classification of Nonattainment and Attainment/Maintenance Areas in" /
    "Colorado*", "VII.A. Rationale for the Promulgation of Ambient Air
    Quality Standards for Sulfur" / "Dioxide") nor a sentence that merely
    wrapped ("V.A.3. The Motor Vehicle Emissions Budget for PM10 applies to
    total primary PM10" / "emissions, including ..."). The tests, all
    required (confirmed against every label line in REG_AQS.txt):
      - the inline text is short (<= 90 chars), ends in no terminal or
        list punctuation, and its last word is not a lower-case function
        word (an article/preposition/verb dangling into a wrapped line);
      - the next line is non-blank and starts a sentence (upper-case
        letter) — a wrapped heading's tail ("Dioxide", "Colorado*") also
        does, so additionally:
      - the run of non-blank lines that follows is at least TWO lines long
        (a wrapped heading tail is one line, then a blank line or the next
        marker; body text runs on)."""
    text = inline_text.strip()
    if not text or len(text) > 90 or text[-1] in ".;:,":
        return False
    last = text.split()[-1].strip("*()")
    if not last or last.lower() in _HEADING_TAIL_FUNCTION_WORDS or last[0].islower():
        return False
    nxt = own_lines[0].strip() if own_lines else ""
    if not nxt or not nxt[0].isupper():
        return False
    return len(own_lines) > 1 and own_lines[1].strip() != ""


def build_provisions(reg: str, lines: list[str], markers: list[dict], tables_by_caption: dict[str, dict],
                     seam_starts: set[int] | None = None):
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

    meta = REG_META.get(reg, {})
    root_citation = meta.get("root_citation", f"Regulation {reg}")
    root_title = meta.get("root_title", root_citation)
    root_id = f"sec-{reg}-top-REG-{reg}"
    provisions[root_id] = dict(
        id=root_id, citation=root_citation, title=root_title,
        parent_id=None, sort_order=0, full_text=escape_html_text(root_title), kind="root",
    )
    order.append(root_id)

    part_root_id = {}
    part_intro_text = bool(meta.get("part_intro_text"))
    heading_own_para = bool(meta.get("heading_line_own_paragraph"))  # see REG_META["aqs"]
    ladder_att: str | None = None  # the open ATTACHMENT inside an APPENDIX_LADDERS appendix

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
            if part_intro_text:
                # See REG_META["2"]["part_intro_text"]: lead-in paragraphs
                # printed between the PART heading and its first marker.
                # `_consume_heading_continuation` may already have folded
                # the first few non-blank lines into the heading itself, so
                # only lines after a blank line (a real paragraph break) are
                # collected here, never the heading's own wrapped text.
                own_lines = marker_own_lines(lines, markers, i)
                first_blank = next((k for k, ln in enumerate(own_lines) if ln.strip() == ""), None)
                intro_paras = split_into_paragraphs(own_lines[first_blank:]) if first_blank is not None else []
                if intro_paras:
                    pending[pid] = ("appendix", intro_paras, title, "", letter, pid)
            continue

        if mk["type"] == "preamble":
            # Unlabeled preamble of a part-less regulation (see REG_META
            # `preamble_heading` / the "preamble" marker in scan_markers):
            # one row directly under the root, id `sec-{reg}-<HEADING>`
            # (an upper-cased, dash-joined slug of the printed heading, like
            # an APPENDIX_LADDERS heading row), kind "section" so it sits in
            # the sidebar beside the roman sections it precedes; the heading
            # is the plain-text lead, the preamble's paragraphs follow as
            # <p> body (appendix shape).
            heading = mk["heading"]
            pid = f"sec-{reg}-{_ladder_slug(heading)}"
            citation = heading.title() if heading.isupper() else heading
            own_lines = marker_own_lines(lines, markers, i)
            paras = split_into_paragraphs(own_lines)
            provisions[pid] = dict(
                id=pid, citation=citation, title=heading, parent_id=root_id,
                sort_order=next_sort(), full_text="", kind="section",
            )
            pending[pid] = ("appendix", paras, heading, "", NO_PART, pid)
            order.append(pid)
            continue

        if mk["type"] == "attachment":
            # GP12 Attachment A/B (see REG_META["gp12"]["attachments"] and
            # the "attachment" marker in scan_markers): a heading-only row
            # hanging directly off the root, id `sec-{reg}-ATTACHMENT-{letter}`
            # (kind "appendix" per the brief — these read like an appendix to
            # the reader even though they're scanned like a part). Registered
            # into `part_root_id` under the SAME pseudo-part token
            # ("ATTACHMENT-A") scan_markers used as `current_part`, so the
            # ordinary `type == "item"` handling below resolves this
            # attachment's own child rows' parent/ids with no further
            # special-casing.
            letter, heading = mk["letter"], mk["heading"]
            pid = f"sec-{reg}-ATTACHMENT-{letter}"
            citation = f"Attachment {letter}"
            title = f"{citation}: {heading}" if heading else citation
            provisions[pid] = dict(
                id=pid, citation=citation, title=title, parent_id=root_id,
                sort_order=next_sort(), full_text=escape_html_text(title), kind="appendix",
            )
            order.append(pid)
            part_root_id[f"ATTACHMENT-{letter}"] = pid
            continue

        if mk["type"] == "appendix":
            letter, heading, owner = mk["letter"], mk["heading"], mk["owner_part"]
            aid = provision_id(reg, owner, f"APPENDIX-{letter}")
            ladder_att = None
            citation = f"Appendix {letter}"
            title = f"{citation} — {heading}"
            # `marker_own_lines` starts right after the marker's OWN physical
            # line; when its heading wrapped onto further physical lines
            # (`_consume_heading_continuation` — see `title_end_line`), those
            # lines are already folded into `heading` above and must be
            # skipped here too, or their text is duplicated as the
            # appendix's own first body paragraph (confirmed: Reg 9's
            # Appendix B, "...WHETHER\n     A LANDOWNER/MANAGER IS A
            # SIGNIFICANT USER OF PRESCRIBED FIRE" — without this, "A
            # LANDOWNER/MANAGER IS A SIGNIFICANT USER OF PRESCRIBED FIRE"
            # printed twice). Gated to APPENDIX_HEADING_DEDUP_REGS — see its
            # own comment for why this isn't applied to every regulation.
            if reg in APPENDIX_HEADING_DEDUP_REGS:
                body_start = mk.get("title_end_line", mk["line"]) + 1
                own_lines = lines[body_start:markers[i + 1]["line"] if i + 1 < len(markers) else len(lines)]
            else:
                body_start = mk["line"] + 1
                own_lines = marker_own_lines(lines, markers, i)
            if reg in APPENDIX_SEAM_BREAK_REGS and seam_starts:
                # See APPENDIX_FIGURES: a page seam inside the appendix is a
                # paragraph break (a blank line spliced in before the seam's
                # first line), never a wrapped continuation.
                for sidx in sorted((sidx - body_start for sidx in seam_starts
                                    if body_start < sidx < body_start + len(own_lines)), reverse=True):
                    own_lines.insert(sidx, "")
            if reg in APPENDIX_TABLE_SPLICE_REGS:
                own_lines = _splice_appendix_tables(own_lines, reg, tables_by_caption, table_hits)
            # An appendix's own uncaptioned table(s) — Reg 30's Appendix A/B
            # (see UNCAPTIONED_TABLES) — are swapped the same way an
            # ordinary item's are; a no-op for every reg without an entry
            # keyed to this appendix's own id.
            own_lines = _swap_uncaptioned_table(own_lines, aid, reg, tables_by_caption, table_hits)
            # ... and an appendix's own whitespace-aligned table (Reg 19's
            # Appendix A — see LAYOUT_TEXT_TABLES["19"]) the same way an
            # ordinary item's / appendix_item's is; a no-op for every reg
            # without an entry keyed to this appendix's own id.
            own_lines = _swap_layout_text_tables(own_lines, aid, reg, tables_by_caption, table_hits)
            paras = _insert_figure_placeholders(split_into_paragraphs(own_lines), reg, aid)
            provisions[aid] = dict(
                id=aid, citation=citation, title=title, parent_id=root_id,
                sort_order=next_sort(), full_text="", kind="appendix",
            )
            pending[aid] = ("appendix", paras, title, "", owner, aid)
            order.append(aid)
            continue

        if mk["type"] == "appendix_item":
            # One unit of an outlined appendix (see APPENDIX_LADDERS): an
            # attachment, a decimal spec section, a lettered/numbered item
            # under one, or an unlabeled heading — every id hangs under the
            # appendix row's own id.
            base = provision_id(reg, mk["owner_part"], f"APPENDIX-{mk['letter']}")
            item_id = f"{base}-{mk['suffix']}"
            parent_id = f"{base}-{mk['parent_suffix']}" if mk["parent_suffix"] else (
                f"{base}-ATT-{ladder_att}" if ladder_att and not mk["attachment"] else base)
            if mk["attachment"]:
                ladder_att = mk["attachment"]
            citation = mk["citation"]
            body_start = mk["title_end_line"] + 1
            own_lines = lines[body_start:markers[i + 1]["line"] if i + 1 < len(markers) else len(lines)]
            own_lines = _swap_layout_text_tables(own_lines, item_id, reg, tables_by_caption, table_hits)
            rest = fix_known_pdf_glitches(mk["rest"])
            extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]
            if mk["attachment"] or mk.get("heading_row"):
                # Attachment / unlabeled heading: the heading IS the title;
                # any prose that follows is the row's body (appendix shape).
                title = f"{citation} — {rest}" if (mk["attachment"] and rest) else citation
                paras = split_into_paragraphs(own_lines)
                provisions[item_id] = dict(
                    id=item_id, citation=citation, title=title, parent_id=parent_id,
                    sort_order=next_sort(), full_text="", kind=mk["kind"],
                )
                pending[item_id] = ("appendix", paras, title, "", mk["owner_part"], item_id)
                order.append(item_id)
                continue
            # A labeled unit whose label line is a short heading standing
            # alone before a blank line ("1.1   Design Goals" then its prose)
            # is titled with that heading; otherwise the label line's text is
            # the first paragraph, exactly like an ordinary item.
            heading_alone = (
                rest and len(rest) <= 90 and rest[-1] not in _LADDER_HEADING_TERMINAL
                and own_lines and own_lines[0].strip() == ""
            )
            if not extra_nonblank:
                text = f"{citation} {rest}".strip() if rest else citation
                pending[item_id] = ("heading", text, citation, "", mk["owner_part"], item_id)
                title = text
            elif heading_alone:
                # Appendix shape: the heading as the plain-text lead, then
                # the body paragraphs ("1.1. Design Goals<p>The specifications
                # ...</p>") — the heading stays in full_text, and is the title.
                paras = split_into_paragraphs(own_lines)
                title = f"{citation} {rest}"
                pending[item_id] = ("appendix", paras, title, "", mk["owner_part"], item_id)
            else:
                paras = split_into_paragraphs(([rest] if rest else []) + own_lines)
                pending[item_id] = ("paras", paras, citation, "", mk["owner_part"], item_id)
                title = citation
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=title, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind=mk["kind"],
            )
            order.append(item_id)
            continue

        if mk["type"] == "entry":
            # Flat-entry row (see FLAT_ENTRY_PART_CONFIG): id from the
            # entry's own suffix, parent = the part root, printed order.
            letter = mk["letter"]
            eid = f"sec-{reg}-{letter}-{mk['suffix']}"
            citation = mk["citation"]
            own_lines = marker_own_lines(lines, markers, i)
            table_html = ""
            if mk.get("table_caption"):
                table = tables_by_caption.get(mk["table_caption"])
                if table:
                    table_html = render_table_html(table)
                    table_hits["used"] += 1
                    table_hits["captions_used"].append(mk["table_caption"])
                    # Drop the raw pdftotext rendering of the table body:
                    # every line up to the LAST one whose first token is one
                    # of the recovered table's first-column cells (the row
                    # keys "A", "Da", ... "KKK"); what remains (the "*And any
                    # other section..." footnote) stays as paragraphs.
                    keys = {(r[0] or "").strip() for r in table["rows"] if r}
                    last_row = None
                    for li, ln in enumerate(own_lines):
                        toks = ln.split()
                        if toks and toks[0] in keys:
                            last_row = li
                    if last_row is not None:
                        own_lines = own_lines[last_row + 1:]
            # A table pinned to this entry row by id (UNCAPTIONED_TABLES —
            # Reg 20's six-page Part H table) replaces its flattened dump
            # with a sentinel paragraph, exactly as in the item/appendix
            # branches; a no-op for a reg with no entry for this row (Reg 6).
            own_lines = _swap_uncaptioned_table(own_lines, eid, reg, tables_by_caption, table_hits)
            if mk.get("heading_only"):
                paras: list[str] = []
            else:
                paras = split_into_paragraphs(([mk["rest"]] if mk["rest"] else []) + own_lines)
            if mk.get("heading_only") or (not paras and not table_html):
                # A heading-only row: the printed heading line itself (SOB
                # heading), or, for an entry with no body at all, its citation.
                text = mk["rest"] if mk.get("heading_only") else (
                    f"{citation} {mk['rest']}".strip() if mk["rest"] else citation)
                title = text if mk.get("heading_only") else _flat_entry_title(citation, mk["rest"])
                pending[eid] = ("heading", text, citation, table_html, letter, eid)
            else:
                # Subpart/appendix entries are titled by their first sentence;
                # the intro and table rows carry only their citation (or, for
                # a `table_caption_re` caption marker, the caption text).
                title = _flat_entry_title(citation, paras[0]) if mk["rest"] and paras else citation
                pending[eid] = ("entry", paras, citation, table_html, letter, eid)
            if mk.get("title"):
                title = mk["title"]
            provisions[eid] = dict(
                id=eid, citation=citation, title=title, parent_id=part_root_id.get(letter, f"sec-{reg}-P-{letter}"),
                sort_order=next_sort(), full_text="", kind="entry",
            )
            order.append(eid)
            continue

        # type == "item"
        ns = mk["ns"]
        tokens = mk["tokens"]
        part_letter = ns[1]
        suffix = tokens_to_id_suffix(tokens)
        item_id = provision_id(reg, part_letter, suffix)
        citation = tokens_to_citation(tokens)
        if len(tokens) == 1:
            # A part-less regulation (part_letter == NO_PART) has no part
            # rows: its top-level sections hang directly off the root.
            parent_id = root_id if not part_letter else part_root_id.get(part_letter, f"sec-{reg}-P-{part_letter}")
        else:
            parent_suffix = tokens_to_id_suffix(tokens[:-1])
            parent_id = provision_id(reg, part_letter, parent_suffix)

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
        if reg in ITEM_TABLE_SPLICE_REGS:
            # See ITEM_TABLE_SPLICE_REGS / ITEM_TABLE_SPLICE_MODE: swap each
            # caption block in place (sentinel paragraphs rendered in the
            # second pass) and keep the prose after it, instead of the
            # cut-at-first-caption below. Reg 25 runs the
            # `merge_continuations` mode (several tables per row, reprinted
            # continuation captions); Reg 27 the `strict` mode (a table
            # followed by hundreds of lines of narrative, page seams bound
            # a wrapped row). A caption whose table pdfplumber did NOT
            # recover is left as text, so nothing printed is ever dropped
            # silently.
            own_start = mk["line"] + 1
            own_seams = {si - own_start for si in (seam_starts or ()) if si >= own_start}
            mode = ITEM_TABLE_SPLICE_MODE[reg]
            own_lines = _splice_appendix_tables(own_lines, reg, tables_by_caption, table_hits,
                                                merge_continuations=(mode == "merge_continuations"),
                                                strict=(mode == "strict"), seam_starts=own_seams)
            extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]
        for li, ln in enumerate(own_lines):
            caption_key = _table_caption_key(ln, reg)
            if caption_key:
                cut_idx = li
                caption_text = caption_key
                table = tables_by_caption.get(caption_text)
                if table:
                    table_html = render_table_html(table)
                    table_hits["used"] += 1
                    table_hits["captions_used"].append(caption_text)
                break
        if cut_idx is not None:
            own_lines = own_lines[:cut_idx]
            extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]

        # Uncaptioned bordered tables (see UNCAPTIONED_TABLES): swap the
        # flattened pdftotext block for a sentinel paragraph, rendered in
        # place during the second pass below.
        own_lines = _swap_uncaptioned_table(own_lines, item_id, reg, tables_by_caption, table_hits)
        # Whitespace-aligned tables rebuilt from the layout text (see
        # LAYOUT_TEXT_TABLES) — a no-op for every row without an entry.
        own_lines = _swap_layout_text_tables(own_lines, item_id, reg, tables_by_caption, table_hits)
        # Borderless multi-line-cell tables rebuilt by column position (see
        # COLUMN_LAYOUT_TABLES) — likewise a no-op without an entry.
        own_lines = _swap_column_layout_tables(own_lines, item_id, reg, tables_by_caption, table_hits)
        extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]
        if heading_own_para and inline_text and _inline_heading_stands_alone(inline_text, own_lines):
            # See REG_META["aqs"]["heading_line_own_paragraph"]: the label
            # line is a short heading printed directly above its body text
            # with no blank line between — keep it as its own paragraph.
            own_lines = [""] + own_lines

        kind = "section" if len(tokens) == 1 else "item"
        term = mk.get("term")  # see TERM_DEFINITIONS_SECTION / BARE_DIGIT_CHILD_SECTIONS
        if term is not None or mk.get("bare_kind") == "definition":
            kind = "definition"

        if item_id in provisions:
            # Duplicate marker (two printed items with the same citation —
            # Reg 7 "VI.D.3.a.(iii)" twice — or a citation-shaped false
            # positive): keep the FIRST occurrence's row (citation, parent,
            # title, sort_order) and fold this occurrence's text in as
            # trailing paragraphs. Before this guard the second marker's
            # dict overwrote the first's here, so the first paragraph was
            # lost and parse_ccr's de-dup pass appended the survivor to
            # itself (the row read "X. X." — found Sep 19, 2026).
            prev = pending.get(item_id)
            new_paras = (split_into_paragraphs(([inline_text] if inline_text else []) + own_lines)
                         if extra_nonblank else
                         [f"{citation} {inline_text}".strip() if inline_text else citation])
            if prev is None:
                pending[item_id] = ("paras", new_paras, citation, table_html, part_letter, item_id)
            elif prev[0] == "heading":
                pending[item_id] = ("paras", [prev[1]] + new_paras, prev[2], prev[3] + table_html, prev[4], prev[5])
            elif prev[0] in ("paras", "entry"):
                prev[1].extend(new_paras)
            order.append(item_id)  # parse_ccr counts the repeat as a duplicate id
            continue

        # A BARE_DIGIT_CHILD_SECTIONS definition whose whole text fits on
        # its label line is still a definition paragraph, not a heading.
        one_line_definition = mk.get("bare_kind") == "definition" and bool(inline_text)
        if not extra_nonblank and not one_line_definition:
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
            # A synthesized term-definition row (see TERM_DEFINITIONS_SECTION)
            # is titled with the defined term itself, not the bare synthetic
            # citation — "I.G.1." carries no information a reader can use.
            title = f"{citation} {term}" if term is not None else citation
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=title, parent_id=parent_id,
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
            provisions[pid]["full_text"] = linked + table_html + _item_figures_html(reg, pid)
        elif kindtag == "paras":
            _, paras, citation, table_html, own_part, own_id = entry
            rendered = []
            # SOB_CONTEXT_PART_RE (Reg 19): inside a statement-of-basis row,
            # a "PART A." / "PART B." heading paragraph (or an opener naming
            # one part) switches which part a bare "Section X.Y." citation
            # in the FOLLOWING paragraphs of the same row is resolved
            # against first. None (a no-op: `ctx_part` stays `own_part`
            # throughout) for every other reg.
            ctx_re = SOB_CONTEXT_PART_RE.get(reg) if own_part == _sob_scope(reg)[0] else None
            ctx_part = own_part
            for p in paras:
                if p.startswith(_TABLE_SENTINEL):
                    rendered.append(render_table_html(tables_by_caption[p[len(_TABLE_SENTINEL):]]))
                    continue
                if ctx_re is not None:
                    cm = ctx_re.match(p)
                    if cm:
                        ctx_part = next(g for g in cm.groups() if g)
                escaped = escape_html_text(p)
                linked, buckets = link_citations(escaped, reg, known_ids, CORPUS_REGS, ctx_part, own_id)
                _merge(buckets)
                rendered.append(f"<p>{linked}</p>")
            provisions[pid]["full_text"] = "".join(rendered) + table_html + _item_figures_html(reg, pid)
        elif kindtag == "entry":
            # Flat entry: a recovered table (if any) leads, its footnote
            # paragraphs follow — the reverse of the "paras" convention
            # because here the paragraphs ARE the table's footnotes.
            _, paras, citation, table_html, own_part, own_id = entry
            rendered = []
            for p in paras:
                if p.startswith(_TABLE_SENTINEL):
                    rendered.append(render_table_html(tables_by_caption[p[len(_TABLE_SENTINEL):]]))
                    continue
                escaped = escape_html_text(p)
                linked, buckets = link_citations(escaped, reg, known_ids, CORPUS_REGS, own_part, own_id)
                _merge(buckets)
                rendered.append(f"<p>{linked}</p>")
            provisions[pid]["full_text"] = table_html + "".join(rendered)
        elif kindtag == "appendix":
            _, paras, title, table_html, own_part, own_id = entry
            rendered = []
            for p in paras:
                if p.startswith(_TABLE_SENTINEL):
                    # See `_splice_appendix_tables` (Reg 9's Appendix B, the
                    # only reg with more than one table per appendix row).
                    rendered.append(render_table_html(tables_by_caption[p[len(_TABLE_SENTINEL):]]))
                    continue
                if p.startswith(_FIGURE_SENTINEL):
                    rendered.append(_figure_placeholder_html(p[len(_FIGURE_SENTINEL):]))
                    continue
                escaped = escape_html_text(p)
                linked, buckets = link_citations(escaped, reg, known_ids, CORPUS_REGS, own_part, own_id)
                _merge(buckets)
                rendered.append(f"<p>{linked}</p>")
            body_html = "".join(rendered)
            escaped_title = escape_html_text(title)
            provisions[pid]["full_text"] = escaped_title if not paras else escaped_title + body_html

    return provisions, order, unresolved_all, table_hits


# ==========================================================================
# ECMC rule-series family (2 CCR 404-1, reg key "ecmc") — see ECMC_BRIEF.md.
#
# This document has NO "PART X" headings and no roman-numeral top level: the
# body is organized as "N00 SERIES <title>" headings (100-1200, then a
# differently-printed 1300 and 1400 series), each containing numbered
# "NNN. <title>" RULES, each rule optionally containing a lettered/numbered/
# lettered/roman ladder (a. -> (1) -> A. -> (i)), followed by four
# APPENDIX blocks and an Editor's Notes/History tail. None of this matches
# `scan_markers`'s hardcoded "PART <letter>" detection, so it is parsed by
# this wholly separate, additive code path instead of reusing
# scan_markers/build_provisions (which stay untouched for every other reg).
# ==========================================================================

# A genuine series/rule/appendix heading is always the first line of a new
# paragraph in this pdftotext -layout dump (confirmed: the one place a bare
# "NNN." pattern appears WITHOUT a preceding blank line is a wrapped
# cross-reference — "...pursuant to Rule\n701." at ECMC.txt:670 — every real
# heading has a blank line, or start-of-body, immediately before it).
_ECMC_SERIES_RE = re.compile(r"^(\d{3,4})\s+[Ss][Ee][Rr][Ii][Ee][Ss]\b\s*[-–—:]?\s*(.*)$")
_ECMC_RULE_RE = re.compile(r"^(\d{3,4})\.\s+(\S.*)$")
_ECMC_APPENDIX_RE = re.compile(r"^(?:APPENDIX|Appendix)\s+([IVXLCDM]+)\b[:.]?\s*(.*)$")

# The ladder under a rule (see ECMC_BRIEF.md: confirmed in Rule 604 —
# "604.a.(1)", "604.b.(3).A"). ECMC_BRIEF.md describes the 4th level as
# parenthesized roman ("(i)") from Rule 604 alone; reading the FULL document
# shows that is the rare case (4 lines total) — the dominant 4th-level (and
# occasionally 5th-level) convention is a BARE lower-case roman numeral
# ("i.", "ii.", "iii." — 1347 lines, e.g. Rule 205.c.(3).A.i) which is
# LEXICALLY IDENTICAL to an ordinary depth-1 lettered item ("a.", "b." ...
# "h.", "i." IS a legal 9th plain letter too) — "i." cannot be told apart
# from a 9th sequential lettered item by its text alone. Depth is therefore
# resolved by INDENTATION (a classic indent-stack: pop while indent <= the
# open stack top's indent, then push), not by which family regex matched;
# family only affects citation punctuation (paren vs bare-with-dot) via
# `token_display`, where a bare roman numeral and an ordinary letter render
# identically ("i.") — so both can safely share the "lower" family, and no
# separate "roman" family is needed at all for THIS (row-building) purpose.
# `ECMC_LADDER_CYCLE` (kept for `link_citations_ecmc`'s compound-citation
# tokenizer only, e.g. "604.b.(3).A" or the deeper "205.c.(3).A.i") repeats
# the 3-part (letter, number, upper) pattern to cover a confirmed 5th level
# without hard-capping at 4.
ECMC_LADDER_CYCLE = ["lower", "paren_digit", "upper", "lower", "paren_digit", "upper", "lower"]

# Mutually exclusive by construction (first non-space character differs):
# "(" + digit, "(" + roman letters, one/two upper-case letters + ".", or
# 1-4 lower-case letters + "." (plain letter OR bare roman numeral alike).
_ECMC_ITEM_FAMILY_ORDER = ["paren_digit", "paren_roman", "upper", "lower"]


def _ecmc_prevblank(lines: list[str], idx: int) -> bool:
    return idx == 0 or lines[idx - 1].strip() == ""


# Post-import review (2026-09-18) found 193 item rows nested one level too
# deep: the source's indentation drifts by a few columns WITHIN THE SAME
# LIST (a page break, or a heading that wraps onto extra lines before its
# first child, both reflow the next label a bit left or right of where its
# true siblings printed) -- e.g. Rule 406.e.(4) prints "D. Remove the cellar
# ring;" at column 11 and, after a page break, "E. Within 30 days..." at
# column 14; the old pure indentation-stack treated the deeper column as a
# new nested level, giving sec-ecmc-406-e-(4)-D-E instead of the correct
# sibling ids sec-ecmc-406-e-(4)-D / -E. Fixed the same way Reg 8's
# SIBLING_CHAIN_REGS treats "the immediate next sibling of an open level" as
# a structural signal that overrides an indentation-only read: if a
# candidate's family matches an OPEN level on the stack and its ordinal is
# EXACTLY that level's ordinal + 1 (D->E, (4)->(5), ii->iii, b->c), it's
# that level's sibling regardless of how far its column drifted. Indentation
# is still the only signal for a genuinely NEW deeper level -- the first
# item of any list is always ordinal 1/A/i/(1)/a, so it can never match an
# existing level's "ordinal + 1" -- and gets a +/-4-column tolerance so
# drift alone can never fake a new level either.
_ECMC_INDENT_TOL = 4


def _ecmc_label_ordinal_variants(fam: str, raw: str) -> dict[str, int]:
    """Every plausible 1-based ordinal for an ECMC ladder label, keyed by
    which NUMBERING SCHEME produced it. Most families have exactly one
    scheme (paren_digit: the digit itself; paren_roman/upper: roman value
    / alphabetic position). ECMC's "lower" family is the one genuinely
    ambiguous case: it covers plain letters (a., b., ...), bare roman
    numerals (i., ii., ...), AND a confirmed 5th/6th ladder tier that
    doubles or triples a single letter once the plain alphabet is
    exhausted (aa., bb., ... -- the same repeated-letter convention
    `PART_C_LETTERS` already reads for a statement-of-basis's own
    overflow tier), with no separate family tag distinguishing them (see
    ECMC_LADDER_CYCLE's docstring) -- a raw token like "ii." is
    SIMULTANEOUSLY a valid roman "2" and a valid doubled-letter "the 9th
    letter, doubled" (position 35), and the same-family-sibling check
    below tries both and accepts whichever one is internally consistent
    with the level it's being compared against, never mixing schemes
    across the two sides of a comparison. This is what lets the sibling
    check correctly promote a page-break-drifted "dd." -> "ee." pair
    (doubled-letter scheme: 30 -> 31) even though "EE" isn't a valid
    roman numeral at all (E isn't a roman digit), while also correctly
    promoting a drifted "ii." -> "iii." pair under the roman scheme (2 ->
    3) without the doubled-letter scheme (35 -> 60ish) getting in the
    way."""
    variants: dict[str, int] = {}
    if fam == "paren_digit":
        variants["digit"] = int(raw)
    elif fam == "paren_roman":
        up = raw.upper()
        if is_valid_roman(up):
            variants["roman"] = roman_to_int(up)
    elif fam == "upper":
        up = raw.upper()
        if up in PART_C_LETTERS:
            variants["alpha"] = PART_C_LETTERS.index(up) + 1
    elif fam == "lower":
        up = raw.upper()
        if up in PART_C_LETTERS:
            variants["alpha"] = PART_C_LETTERS.index(up) + 1
        if is_valid_roman(up):
            variants["roman"] = roman_to_int(up)
    return variants


def _ecmc_lower_scheme_from_raw(raw: str) -> str:
    """The numbering scheme a FRESH "lower"-family ladder level's own
    first item establishes, from its shape alone: a repeated single
    character of 2+ letters ("aa.", "bb.") only ever opens the doubled/
    tripled-letter overflow tier in this document (a real list never
    OPENS at "bb." or "cc.", only "aa."), so it unambiguously locks
    "alpha"; an unrepeated 2+ character string ("iv.", "ix.") is
    unambiguously a bare roman numeral, locking "roman"; a single
    character ("a.", "i.") is genuinely ambiguous at the moment it opens
    (it might continue as an ordinary lettered list, or turn out to be
    the first item of a bare roman list) and is left "ambiguous" until
    its own second item (see `_ecmc_sibling_match_index`) settles which
    scheme actually fits, at which point that match's scheme is locked in
    for the rest of the list."""
    if len(raw) >= 2 and len(set(raw)) == 1:
        return "alpha"
    if len(raw) >= 2:
        return "roman"
    return "ambiguous"


def _ecmc_sibling_match_index(stack: list[dict], fam: str, raw_lbl: str) -> tuple[int, str | None] | None:
    """Checks only the DEEPEST open level (the top of the stack) for
    whether it is the same family and exactly this candidate's immediate
    predecessor under a numbering scheme consistent with that level (see
    `_ecmc_label_ordinal_variants` and `_ecmc_lower_scheme_from_raw`).
    Deliberately does NOT search further down the stack: the
    mis-indentation bug this fixes always leaves the wrongly-nested
    predecessor sitting at the top at the moment its rightful sibling
    arrives (nothing else gets pushed in between a drifted "D."/"E." pair,
    or a "(4)"/"(5)" pair), so checking the top is both necessary and
    sufficient for every reported case. Searching deeper is deliberately
    avoided -- confirmed during testing: an unrestricted search matched a
    deeply-nested roman "ii." against an unrelated top-level letter "a."
    several levels down the stack purely because both are "lower" family
    and the roman value of "ii" (2) happens to equal the alphabetic
    ordinal of "a" (1) plus one. For a "lower" level whose scheme is
    already LOCKED (not "ambiguous" -- see `_ecmc_lower_scheme_from_raw`),
    only that one scheme is tried: confirmed necessary during testing too
    -- a doubled-letter tier's own coincidentally-roman-valued item
    ("ii.", the tier's 9th entry) would otherwise "continue" under the
    roman interpretation into "iii.", when "iii." is actually the OUTER
    roman list's real next sibling (one level up, past the whole doubled-
    letter tier), not a continuation of it. Returns (stack index to
    treat as the sibling's own slot, the scheme the match was found
    under -- None for a non-"lower" family) or None if the top doesn't
    qualify (typically because the candidate is ordinal 1/A/i/(1)/a, or
    the top is a different family)."""
    if not stack:
        return None
    top = stack[-1]
    lvl_fam, lvl_raw = top["chain"][-1]
    if lvl_fam != fam:
        return None
    cand_variants = _ecmc_label_ordinal_variants(fam, raw_lbl)
    lvl_variants = _ecmc_label_ordinal_variants(lvl_fam, lvl_raw)
    locked_scheme = top.get("scheme") if fam == "lower" else None
    schemes_to_try = [locked_scheme] if locked_scheme not in (None, "ambiguous") else cand_variants.keys()
    for scheme in schemes_to_try:
        cand_ord = cand_variants.get(scheme)
        lvl_ord = lvl_variants.get(scheme)
        if cand_ord is not None and lvl_ord is not None and cand_ord == lvl_ord + 1:
            return len(stack) - 1, (scheme if fam == "lower" else None)
    return None


def _ecmc_is_ladder_label(stripped: str) -> tuple[str, str, int] | None:
    """The ladder family whose regex matches the START of `stripped`; returns
    (family, raw_label, chars_consumed) or None."""
    for fam in _ECMC_ITEM_FAMILY_ORDER:
        rx = FAMILY_REGEX[fam]
        m = rx.match(stripped)
        if not m:
            continue
        raw = m.group(1)
        if fam == "paren_roman" and not is_valid_roman(raw.upper()):
            continue
        return fam, raw, m.end()
    return None


def find_body_start_ecmc(lines: list[str]) -> int:
    """The title page / cover matter (Secretary of State boilerplate,
    Department/Commission name, printed document title, Editor's Notes
    forward-reference) precedes the real body; the real body starts at the
    first "100 SERIES DEFINITIONS" heading."""
    for i, l in enumerate(lines):
        if _ECMC_SERIES_RE.match(l.strip()):
            return i
    return 0


def _ecmc_scan_markers(lines: list[str]) -> list[dict]:
    """One flat, document-order pass building every series/rule/appendix/
    definition/ladder-item marker. A ladder item's depth and parent chain
    are resolved by an INDENTATION STACK (see ECMC_LADDER_CYCLE's docstring
    for why family alone can't disambiguate a bare roman numeral from an
    ordinary lettered item): pop every open level whose indent is >= the
    new candidate's indent (a shallower level, or a sibling at the same
    indent), then the new item's parent is whatever remains on top (or the
    rule itself, if the stack is now empty) and depth = len(stack)+1. This
    also means a rule that skips a level, or nests deeper than 4, is
    handled automatically — no hard-coded depth cap."""
    markers: list[dict] = []
    in_rule: str | None = None      # current rule number, or None outside any rule
    in_series: str | None = None    # current series number
    stack: list[dict] = []          # open ladder levels: [{"indent": int, "chain": [...]}]
    in_appendix = False

    for idx, raw in enumerate(lines):
        stripped = raw.strip()
        if stripped == "":
            continue
        prevblank = _ecmc_prevblank(lines, idx)
        indent = len(raw) - len(raw.lstrip(" "))

        if prevblank:
            m = _ECMC_SERIES_RE.match(stripped)
            if m:
                in_series, in_rule, in_appendix = m.group(1), None, False
                stack = []
                markers.append(dict(type="series", line=idx, num=m.group(1), heading=m.group(2)))
                continue
            m = _ECMC_APPENDIX_RE.match(stripped)
            if m:
                in_appendix, in_rule = True, None
                markers.append(dict(type="appendix", line=idx, letter=m.group(1), heading=m.group(2)))
                continue
            if not in_appendix:
                m = _ECMC_RULE_RE.match(stripped)
                if m:
                    in_rule = m.group(1)
                    stack = []
                    markers.append(dict(type="rule", line=idx, num=m.group(1), rest=m.group(2),
                                         series=in_series))
                    continue
            if in_rule is not None:
                rule_prefixed = False
                hit = _ecmc_is_ladder_label(stripped)
                if not hit:
                    # The 1100 (Flowline) series' rules 1101-1105 print their
                    # OWN top-level letter re-prefixed with the full rule
                    # number ("1101.a.", "1105.g." — confirmed the only
                    # rules doing this: grep "^\d{3,4}\.[a-z]{1,3}\.\s"
                    # across the whole document only ever matches these 5),
                    # instead of Rule 604's bare "a." — without this, the
                    # line doesn't start with '(' or a letter so it isn't
                    # recognized as a label at all, and every rule's "(1)"
                    # that follows wrongly opens at depth 1 instead of
                    # nesting under the (never-recorded) "a."/"b." level,
                    # colliding across sections ("sec-ecmc-1101-(1)" printed
                    # once under "a." and again, unrelated, under "b.").
                    m = re.match(rf"^{re.escape(in_rule)}\.([a-z]{{1,4}})\.\s+(\S.*)$", stripped)
                    if m:
                        hit = ("lower", m.group(1), m.start(2))
                        rule_prefixed = True
                if hit:
                    fam, raw_lbl, consumed = hit
                    match = _ecmc_sibling_match_index(stack, fam, raw_lbl)
                    if match is not None:
                        # Exact next-ordinal sibling of an open level --
                        # accept regardless of indentation drift (see
                        # _ECMC_INDENT_TOL's docstring above). The matched
                        # scheme (for a "lower" family level) is carried
                        # forward onto the replacement frame so the list's
                        # numbering scheme, once established, stays locked
                        # for the rest of its siblings (see
                        # _ecmc_sibling_match_index's docstring).
                        sib_idx, matched_scheme = match
                        stack = stack[:sib_idx]
                        new_scheme = matched_scheme
                    else:
                        # No open level is this candidate's immediate
                        # predecessor (it's the first item of a list, or its
                        # true predecessor isn't open): fall back to the
                        # indentation stack, with a +/-4-column tolerance so
                        # drift ALONE never opens a new nested level -- only
                        # a candidate printed CLEARLY deeper than the open
                        # top (beyond the tolerance) stays a child of it.
                        while stack and indent <= stack[-1]["indent"] + _ECMC_INDENT_TOL:
                            stack.pop()
                        new_scheme = _ecmc_lower_scheme_from_raw(raw_lbl) if fam == "lower" else None
                    parent_chain = stack[-1]["chain"] if stack else []
                    chain = parent_chain + [(fam, raw_lbl)]
                    frame = dict(indent=indent, chain=chain)
                    if fam == "lower":
                        frame["scheme"] = new_scheme
                    stack.append(frame)
                    markers.append(dict(type="item", line=idx, rule=in_rule, depth=len(stack),
                                         chain=chain, consumed=consumed, rule_prefixed=rule_prefixed))
                    continue
    return markers


# 100-Series definitions: "TERM means ..." / "TERM shall mean ..." (also,
# confirmed present in this document: "shall be", "shall include", "is
# defined", "when used", "for purposes of", "used to", "includes",
# "refers to", "has the meaning", or a bare "TERM:" opener) — one paragraph
# (occasionally several, with lettered/numbered/bulleted sub-items) per
# defined term, no printed labels at all. A defined term is recognized by
# testing the FIRST LINE of each blank-line-delimited paragraph inside the
# 100 Series against this opener list; every paragraph that doesn't open a
# new term (a lettered/numbered/bulleted sub-item, a wrapped continuation, a
# nested sub-definition like "Wellhead Line means...") is folded into the
# CURRENT term's full_text as an additional paragraph rather than becoming
# its own row.
_ECMC_DEF_OPENERS = (
    r"shall mean|means|shall be|shall include|is defined|when used|"
    r"for purposes of|used to|includes|refers to|has the meaning"
)
_ECMC_DEF_START_RE = re.compile(
    rf"^([A-Za-z0-9][A-Za-z0-9 ()&,\-/’'.]*?)(?:\s+(?:{_ECMC_DEF_OPENERS})\b|:\s+\S)"
)

# Fallback for a term with NO opener verb at all — confirmed exactly once:
# "COMPLETION An oil well shall be considered completed when..." (the term
# is directly followed by an ordinary capitalized sentence, no "means"/
# "shall mean"/etc. and no colon). Recognized structurally: 1-3 ALL-CAPS
# words immediately followed by a Capitalized-then-lowercase word (a real
# sentence start, not another all-caps run or a lone lettered sub-item
# label like "A." — "A" is 1 letter, this requires 2+ uppercase letters
# with no separating punctuation before the sentence begins). Verified
# against every OTHER 100-Series paragraph that doesn't match the opener
# list above: this pattern matches nothing else in the document, so it is
# not loosening the primary opener-based detection.
_ECMC_DEF_NOVERB_RE = re.compile(r"^([A-Z][A-Z]+(?:\s[A-Z]+){0,2})\s+(?=[A-Z][a-z])")


def _ecmc_def_term(first_line: str) -> str | None:
    m = _ECMC_DEF_START_RE.match(first_line)
    if m:
        term = m.group(1).strip()
        letters = [c for c in term if c.isalpha()]
        ok = bool(letters) and len(term.split()) <= 8
        if ok and sum(c.isupper() for c in letters) / len(letters) > 0.9:
            return term
        # Falls through to the no-opener fallback below rather than
        # returning None here: the lazy capture in _ECMC_DEF_START_RE can
        # match past the real term (e.g. "COMPLETION An oil well" before
        # hitting a LATER "shall be" inside the sentence), which fails the
        # ratio check above without proving there's no term at all.
    m2 = _ECMC_DEF_NOVERB_RE.match(first_line)
    if m2:
        term = m2.group(1).strip()
        if term.isupper() and 1 <= len(term.split()) <= 3:
            return term
    return None


def _ecmc_def_slug(term: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "-", term.upper()).strip("-")
    return slug or "TERM"


# Common short lower-case connectors that legitimately appear INSIDE an
# otherwise ALL-CAPS rule title (confirmed: Rule 604 "SETBACKS and SITING
# REQUIREMENTS", Rule 402 "...AND UNIT DESIGNATION RULE") — everything else
# in a title is either ALL-CAPS or pure punctuation/digits.
_ECMC_TITLE_CONNECTORS = {"a", "an", "the", "of", "in", "on", "for", "and", "or", "to", "at", "by", "with", "from"}


def _ecmc_title_word_ok(word: str) -> bool:
    core = word.strip(",.;:()")
    alpha = [c for c in core if c.isalpha()]
    if not alpha:
        return True  # pure punctuation/digits, e.g. "2A," "600" — title-safe
    if all(c.isupper() for c in alpha):
        return True
    return core.lower() in _ECMC_TITLE_CONNECTORS


def _ecmc_rule_title(rest: str, own_lines: list[str]) -> tuple[str, str, int]:
    """Splits a rule heading's title from (a) an inline body lead sharing the
    heading's own physical line (confirmed once: Rule 409, "REPORT OF
    RESERVOIR PRESSURE TEST. Where the Director believes..." — the first
    word that isn't ALL-CAPS/punctuation/a title connector, "Where", starts
    the body, not the title) or (b) a title that wraps onto one or more
    ALL-CAPS continuation lines with no blank line before the real body
    starts (confirmed 27 times, e.g. Rule 211 "PLUGGING AND ABANDONMENT OF
    WELLS AND CLOSURE OF OIL AND" / "GAS FACILITIES AND LOCATIONS"). A
    period-position heuristic (title ends at the first ". " before a
    lower-case letter) looks tempting but is WRONG here: Rule 409's own
    body text starts with "Where" — capitalized, like any normal English
    sentence — so the real signal is ALL-CAPS-ness word by word, not case
    at a period. Returns (title, body_lead, n_continuation_lines_consumed)."""
    # Rule 437's title, alone in the document, is printed in ordinary Title
    # Case rather than ALL-CAPS ("Hydraulic Fracturing Chemical Additives.")
    # — a single clean sentence-fragment ending in exactly one period with
    # nothing else on the line, which the ALL-CAPS word scan below would
    # otherwise reject at its very first word. Recognized structurally (one
    # terminal period, no other punctuation implying a second sentence) so
    # it doesn't have to be hard-coded to that one rule number.
    if re.fullmatch(r"[A-Z][A-Za-z0-9 ,()'/&\-]*\.", rest):
        return rest, "", 0
    words0 = rest.split()
    stop_idx = next((i for i, w in enumerate(words0) if not _ecmc_title_word_ok(w)), None)
    if stop_idx is not None:
        title = " ".join(words0[:stop_idx])
        body_lead = " ".join(words0[stop_idx:])
        return re.sub(r"\s+", " ", title).strip(), body_lead.strip(), 0
    title_words = words0[:]
    consumed = 0
    for ln in own_lines:
        if ln.strip() == "":
            break
        lwords = ln.split()
        if lwords and all(_ecmc_title_word_ok(w) for w in lwords):
            title_words.extend(lwords)
            consumed += 1
        else:
            break
    return re.sub(r"\s+", " ", " ".join(title_words)).strip(), "", consumed


_ECMC_ITEM_HEADING_WORDS_MAX = 12


def _ecmc_item_heading_split(inline_text: str, own_lines: list[str]) -> tuple[str | None, str, int]:
    """For a 'rule_prefixed' 1100-series ladder item (see the caller):
    distinguishes a genuine short printed heading from ordinary body prose
    that simply happens to start with a capitalized word. Word-by-word
    ALL-CAPS scanning (used for rule titles, which ARE printed ALL-CAPS)
    does not work here because these headings are Title-Case or even just
    sentence-case ("Isolation valve repair and maintenance.") — case alone
    cannot tell "Material." (a heading) from "Any valve, flange..." (a
    sentence, also capitalized at the start). The reliable structural
    signal instead: a printed heading here is always a short noun-phrase
    ending in ITS OWN period within a handful of words — either on the
    marker's own physical line ("Material. Materials for pipe...", period
    after 1 word) or, when the heading itself wraps, on the immediately
    following continuation line ("Crude Oil Transfer Line and Produced
    Water Transfer System" / "Registration.", period after 1 word on line
    2). Ordinary body prose, by contrast, does not reach a period until
    much later (confirmed for every 1103.b/.c/.d, 1105.a/.b/.g instance:
    no period appears anywhere in the first physical line at all). Returns
    (heading_or_None, body_lead, n_continuation_lines_consumed)."""

    def _first_period_idx(words: list[str]) -> int | None:
        return next((i for i, w in enumerate(words) if w.endswith(".")), None)

    words = inline_text.split()
    idx = _first_period_idx(words)
    if idx is not None and idx < _ECMC_ITEM_HEADING_WORDS_MAX:
        heading = " ".join(words[: idx + 1])
        body_lead = " ".join(words[idx + 1:]).strip()
        return heading, body_lead, 0

    if idx is None and own_lines and own_lines[0].strip():
        cont_words = own_lines[0].split()
        cidx = _first_period_idx(cont_words)
        if cidx is not None and len(words) + cidx + 1 <= _ECMC_ITEM_HEADING_WORDS_MAX:
            heading = " ".join(words + cont_words[: cidx + 1])
            body_lead = " ".join(cont_words[cidx + 1:]).strip()
            return heading, body_lead, 1

    return None, inline_text, 0


# Distinct citation shapes this linker recognizes and deliberately leaves as
# plain text rather than resolving (per ECMC_BRIEF.md: no Form/statute rows
# exist in this corpus to link to) — counted separately from a genuine gap
# via BUCKET_FORM / BUCKET_CRS so the diff report can tell the two apart.
_ECMC_FORM_RE = re.compile(r"\bForm\s+\d+[A-Z]?\b")
_ECMC_CRS_RE = re.compile(r"§+\s*[\d\-.]+(?:\([a-zA-Z0-9]+\))*,?\s*C\.R\.S\.")
_ECMC_RULE_CITE_RE = re.compile(
    # A printed compound citation attaches each token DIRECTLY to the last
    # one (confirmed: "604.b.(3).A", "201.a.(1)") — a bare letter/number
    # token supplies its OWN leading+trailing dot (".a.", ".A" — trailing
    # dot optional, since mid-sentence the last token often drops it), while
    # a parenthesized token has no dot of its own at all (it attaches
    # directly to whatever came before, and the NEXT token's leading dot,
    # if any, is that next token's own). So "\.[a-z]{1,4}\.?" (or upper) and
    # a bare "(...)" are the only two per-token shapes, repeated freely.
    r"\bRules?\s+(\d{3,4})((?:\.[a-zA-Z]{1,4}\.?|\(\d{1,3}\)|\([ivxlcdmA-Z]{1,4}\))*)"
)
_ECMC_RULE_THROUGH_RE = re.compile(r"\bRules\s+(\d{3,4})\s+through\s+(\d{3,4})\b")
_ECMC_SERIES_CITE_RE = re.compile(r"\b(?:the\s+)?(\d{3,4})\s+Series\b")
_ECMC_TABLE_CITE_RE = re.compile(r"\bTable\s+(\d{3,4}-\d+)\b")
_ECMC_APPENDIX_CITE_RE = re.compile(r"\bAppendix\s+([IVXLCDM]+)\b")
_ECMC_OTHER_REG_RE = re.compile(r"\bRegulation Number\s+(\d+)\b")


def _ecmc_rule_sub_id(rule_num: str, sub_citation: str) -> str | None:
    """'.b.(3).A' -> 'sec-ecmc-604-b-(3)-A' (tokenizes against
    ECMC_LADDER_CYCLE, same convention as the parser's own ids)."""
    text = sub_citation.lstrip(".")
    if not text:
        return None
    if not text.endswith((".", ")")):
        text += "."
    tokens, consumed = tokenize_by_cycle(text, ECMC_LADDER_CYCLE)
    if not tokens or text[consumed:] not in ("", "."):
        return None
    return f"sec-ecmc-{rule_num}-" + tokens_to_id_suffix(tokens)


def link_citations_ecmc(text: str, known_ids: set[str], corpus_regs: set[str],
                         table_owner: dict[str, str]) -> tuple[str, dict[str, Counter]]:
    """ECMC's cross-reference linker (see ECMC_BRIEF.md "Cross-reference
    linking"). Independent of `link_citations` (the AQCC Part/roman linker)
    because the id/citation shapes are unrelated; written against plain
    `text` (already HTML-escaped) using non-overlapping regex passes over a
    `pieces` splice list, the same output convention `link_citations` uses."""
    buckets: dict[str, Counter] = {b: Counter() for b in ALL_BUCKETS}
    pieces: list[tuple[int, int, str]] = []
    claimed: list[tuple[int, int]] = []

    def _claim(start: int, end: int) -> bool:
        for s, e in claimed:
            if start < e and end > s:
                return False
        claimed.append((start, end))
        return True

    # 0) "49 C.F.R. § 192.243" / "49 C.F.R. §§ 195.2 or 192.8" / "49 C.F.R.
    # § 195 Subpart A" — ECMC is the only Colorado document that cites 49
    # CFR at all (see sources/ECMC.txt), and it does so only in this dotted
    # "C.F.R." + "§"/"§§" form, never the plain "49 CFR ..." AQCC regs use.
    # Shared with link_citations() (see _link_cfr49_citations) rather than
    # reimplemented here, since the corpus-membership/part-resolution logic
    # is identical either way. Runs first so an ECMC-specific pattern below
    # (e.g. "§ ..., C.R.S.") never has a chance to claim a 49 C.F.R. span
    # first -- there is no overlap risk in practice (a 49 CFR cite never
    # looks like a Colorado "Rule N"/"C.R.S." citation), but running it
    # first keeps that guarantee explicit rather than incidental.
    _link_cfr49_citations(text, corpus_regs, pieces, buckets, _claim)

    # 1) "Rules N through M" — link the two endpoints, leave "through" as text.
    for m in _ECMC_RULE_THROUGH_RE.finditer(text):
        for grp in (1, 2):
            num = m.group(grp)
            target = f"sec-ecmc-{num}"
            span = m.span(grp)
            if target in known_ids and _claim(*span):
                pieces.append((span[0], span[1], f'<span class="xref" data-target="{target}">{num}</span>'))

    # 2) "Rule N" / "Rules N" with an optional compound sub-citation.
    for m in _ECMC_RULE_CITE_RE.finditer(text):
        if not _claim(*m.span()):
            continue
        num, sub = m.group(1), m.group(2)
        target = f"sec-ecmc-{num}"
        if sub:
            deep_target = _ecmc_rule_sub_id(num, sub)
            if deep_target and deep_target in known_ids:
                target = deep_target
            elif target not in known_ids:
                target = None
        elif target not in known_ids:
            target = None
        if target:
            pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
        else:
            top_target = f"sec-ecmc-{num}"
            bucket = BUCKET_UNPARSEABLE if top_target in known_ids else BUCKET_HISTORICAL
            buckets[bucket][m.group(0)] += 1

    # 3) "N Series" / "the N00 Series".
    for m in _ECMC_SERIES_CITE_RE.finditer(text):
        if not _claim(*m.span()):
            continue
        num = m.group(1)
        target = f"sec-ecmc-S-{num}"
        if target in known_ids:
            pieces.append((m.start(1), m.end(1), f'<span class="xref" data-target="{target}">{num}</span>'))
        else:
            buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1

    # 4) "Table N-N" — link to the row the table is actually rendered in.
    for m in _ECMC_TABLE_CITE_RE.finditer(text):
        if not _claim(*m.span()):
            continue
        key = m.group(1)
        target = table_owner.get(key)
        if target and target in known_ids:
            pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
        else:
            buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1

    # 5) "Appendix N".
    for m in _ECMC_APPENDIX_CITE_RE.finditer(text):
        if not _claim(*m.span()):
            continue
        letter = m.group(1)
        target = f"sec-ecmc-APPENDIX-{letter}"
        if target in known_ids:
            pieces.append((m.start(), m.end(), f'<span class="xref" data-target="{target}">{m.group(0)}</span>'))
        else:
            buckets[BUCKET_UNPARSEABLE][m.group(0)] += 1

    # 6) "Form N" / "§ ..., C.R.S." — recognized, deliberately plain text.
    for m in _ECMC_FORM_RE.finditer(text):
        if _claim(*m.span()):
            buckets[BUCKET_FORM][m.group(0)] += 1
    for m in _ECMC_CRS_RE.finditer(text):
        if _claim(*m.span()):
            buckets[BUCKET_CRS][m.group(0)] += 1

    # 7) "Regulation Number N" — another regulation in (or outside) the corpus.
    for m in _ECMC_OTHER_REG_RE.finditer(text):
        if not _claim(*m.span()):
            continue
        num = m.group(1)
        if num == "404":  # "2 CCR 404-1" self-mentions are not "Regulation Number 404"
            continue
        if _non_aqcc_ccr_series(text, m.start(), m.end(), num):
            # Another commission's Regulation N, named as such by its own CCR
            # cite — the "CLASSIFIED WATER SUPPLY SEGMENT" definition's WQCC
            # "Regulation Number 31, ... 5 C.C.R. § 1002-31". See
            # _non_aqcc_ccr_series.
            buckets[BUCKET_OTHER_REG][m.group(0)] += 1
            continue
        if num in corpus_regs and num != "ecmc":
            root_target = f"sec-{num}-top-REG-{num}"
            pieces.append((m.start(), m.end(),
                            f'<a class="xref-external-reg" href="/regulations/{num}">{m.group(0)}</a>'))
        else:
            buckets[BUCKET_OTHER_REG][m.group(0)] += 1

    pieces.sort(key=lambda p: p[0])
    out = []
    pos = 0
    for start, end, html in pieces:
        if start < pos:
            continue
        out.append(text[pos:start])
        out.append(html)
        pos = end
    out.append(text[pos:])
    return "".join(out), buckets


def parse_reg_rule_series(reg: str, lines: list[str], tables_by_caption: dict[str, dict]):
    """The ECMC ("rule_series" family) counterpart to build_provisions — see
    the module docstring above this section. Returns the same 4-tuple shape
    as build_provisions (provisions_dict, order, unresolved, table_hits)."""
    meta = REG_META.get(reg, {})
    root_citation = meta.get("root_citation", f"Regulation {reg}")
    root_title = meta.get("root_title", root_citation)
    root_id = f"sec-{reg}-top-REG-{reg}"

    provisions: dict[str, dict] = {}
    order: list[str] = []
    sort = {"n": 0}
    table_hits = {"used": 0, "captions_used": []}

    def next_sort():
        sort["n"] += 10
        return sort["n"]

    provisions[root_id] = dict(
        id=root_id, citation=root_citation, title=root_title,
        parent_id=None, sort_order=0, full_text=escape_html_text(root_title), kind="root",
    )
    order.append(root_id)

    markers = _ecmc_scan_markers(lines)

    # pending[id] = (kind_tag, ...) — raw (unlinked) content, resolved into
    # full_text in the second pass below, exactly like build_provisions.
    pending: dict[str, tuple] = {}
    series_row_id: dict[str, str] = {}
    table_owner: dict[str, str] = {}  # "423-1" -> row id the table is rendered in

    def _cut_table(own_lines: list[str], row_id: str) -> tuple[list[str], str]:
        table_html = ""
        for li, ln in enumerate(own_lines):
            caption_key = _table_caption_key(ln, reg)
            if not caption_key:
                continue
            table = tables_by_caption.get(caption_key)
            if not table:
                # A captioned table pdfplumber's line-based detector found
                # no bordered table for (confirmed: Rule 423's "Table 423-1
                # – Maximum Permissible Noise Levels" is printed with NO
                # ruling lines at all on ECMC.pdf page 228 — extract_tables()
                # returns zero tables there). Leaving `own_lines` untouched
                # keeps the table's actual data as plain (column-garbled but
                # PRESENT) paragraph text — cutting here without a `table`
                # to replace it with would silently drop the content
                # entirely, which is worse than a garbled render.
                continue
            table_html = render_table_html(table)
            table_hits["used"] += 1
            table_hits["captions_used"].append(caption_key)
            m = re.match(r"^(?:Table|TABLE)\s+([0-9]+-[0-9]+)", caption_key)
            if m:
                table_owner.setdefault(m.group(1), row_id)
            return own_lines[:li], table_html
        return own_lines, table_html

    for i, mk in enumerate(markers):
        if mk["type"] == "series":
            sid = f"sec-ecmc-S-{mk['num']}"
            heading = re.sub(r"\s+", " ", mk["heading"]).strip()
            citation = f"{mk['num']} Series"
            title = f"{citation} — {heading}" if heading else citation
            provisions[sid] = dict(
                id=sid, citation=citation, title=title, parent_id=root_id,
                sort_order=next_sort(), full_text=escape_html_text(title), kind="series",
            )
            order.append(sid)
            series_row_id[mk["num"]] = sid
            if mk["num"] == "100":
                # 100 Series definitions: no printed labels; see
                # _ecmc_def_term. Walk this series' own text (up to the next
                # marker, i.e. the 200 Series heading) as paragraphs.
                own_lines = marker_own_lines(lines, markers, i)
                paras = split_into_paragraphs(own_lines)
                terms_seen: Counter = Counter()
                cur_id = None
                def_paras: list[str] = []

                def _flush():
                    if cur_id is not None:
                        pending[cur_id] = ("def", def_paras[:], cur_id)

                for p in paras:
                    term = _ecmc_def_term(p)
                    if term:
                        _flush()
                        slug = _ecmc_def_slug(term)
                        terms_seen[slug] += 1
                        suffix = slug if terms_seen[slug] == 1 else f"{slug}-{terms_seen[slug]}"
                        cur_id = f"sec-ecmc-100-DEF-{suffix}"
                        provisions[cur_id] = dict(
                            id=cur_id, citation=f"100 Series — {term}", title=term,
                            parent_id=sid, sort_order=next_sort(), full_text="", kind="definition",
                        )
                        order.append(cur_id)
                        def_paras = [p]
                    elif cur_id is not None:
                        def_paras.append(p)
                    # else: stray text before the first recognized term
                    # (none confirmed) — silently dropped rather than
                    # crashing; would show up as a row-count shortfall.
                _flush()
            continue

        if mk["type"] == "appendix":
            aid = f"sec-ecmc-APPENDIX-{mk['letter']}"
            heading = re.sub(r"\s+", " ", mk["heading"]).strip()
            citation = f"Appendix {mk['letter']}"
            title = f"{citation} — {heading}" if heading else citation
            own_lines = marker_own_lines(lines, markers, i)
            own_lines, table_html = _cut_table(own_lines, aid)
            paras = split_into_paragraphs(own_lines)
            provisions[aid] = dict(
                id=aid, citation=citation, title=title, parent_id=root_id,
                sort_order=next_sort(), full_text="", kind="appendix",
            )
            pending[aid] = ("appendix", paras, title, table_html, aid)
            order.append(aid)
            continue

        if mk["type"] == "rule":
            num = mk["num"]
            rid = f"sec-ecmc-{num}"
            own_lines_full = marker_own_lines(lines, markers, i)
            title, body_lead, consumed = _ecmc_rule_title(mk["rest"], own_lines_full)
            own_lines = own_lines_full[consumed:]
            own_lines, table_html = _cut_table(own_lines, rid)
            citation = f"Rule {num}."
            row_title = f"{citation} — {title}" if title else citation
            paras = split_into_paragraphs(([body_lead] if body_lead else []) + own_lines)
            parent_id = series_row_id.get(mk["series"], root_id)
            provisions[rid] = dict(
                id=rid, citation=citation, title=row_title, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind="section",
            )
            # "heading_body": the printed heading (row_title, e.g. "Rule
            # 604. — SETBACKS and SITING REQUIREMENTS") is always rendered —
            # alone (plain, unwrapped — same convention as an AQCC Part/
            # bare-item heading row, e.g. Reg 26's `sec-26-A-I` full_text
            # "I. General Provisions") when the rule has no lead-in body
            # text of its own before its first ladder item/table, or as the
            # FIRST <p> paragraph followed by the body paragraphs (the way
            # an AQCC section with printed lead-in text does) when it does.
            pending[rid] = ("heading_body", row_title, paras, table_html)
            order.append(rid)
            continue

        # type == "item" — a ladder entry inside a rule.
        chain = mk["chain"]
        rule_num = mk["rule"]
        item_id = f"sec-ecmc-{rule_num}-" + tokens_to_id_suffix(chain)
        citation = f"{rule_num}." + tokens_to_citation(chain)
        if len(chain) == 1:
            parent_id = f"sec-ecmc-{rule_num}"
        else:
            parent_id = f"sec-ecmc-{rule_num}-" + tokens_to_id_suffix(chain[:-1])

        inline_line = lines[mk["line"]]
        inline_text = fix_known_pdf_glitches(inline_line.strip()[mk["consumed"]:].strip())
        own_lines_full = marker_own_lines(lines, markers, i)
        own_lines, table_html = _cut_table(own_lines_full, item_id)
        extra_nonblank = [ln for ln in own_lines if ln.strip() != ""]

        if mk.get("rule_prefixed"):
            # The 1100 (Flowline) series' own top-level letters re-print the
            # FULL rule number ("1101.a.     Flowline and Crude Oil Transfer
            # Line Statuses."). MANY, but not all, of these letters print a
            # genuine short descriptive HEADING first (a noun-phrase label
            # ending in its own period — "Material.", "Isolation valve repair
            # and maintenance.", occasionally wrapping onto one continuation
            # line before that period — "Crude Oil Transfer Line and Produced
            # Water Transfer System" / "Registration."); others have NO
            # heading at all and start directly with ordinary body prose
            # (confirmed: 1103.b/.c/.d, 1105.a/.b/.g — e.g. "Any valve,
            # flange, fitting..."). `_ecmc_item_heading_split` tells the two
            # apart structurally (see its own docstring) rather than
            # assuming every rule_prefixed line is a heading.
            heading, body_lead, cont_used = _ecmc_item_heading_split(inline_text, own_lines)
            if heading is not None:
                remaining = own_lines[cont_used:]
                paras = split_into_paragraphs(([body_lead] if body_lead else []) + remaining)
                pending[item_id] = ("heading_body", heading, paras, table_html)
                provisions[item_id] = dict(
                    id=item_id, citation=citation, title=heading, parent_id=parent_id,
                    sort_order=next_sort(), full_text="", kind="item",
                )
            else:
                # No genuine printed heading under this letter — ordinary
                # body prose from the first word. Falls back to the same
                # convention as any other ladder item with body text: title
                # stays the bare citation (not a truncated sentence
                # fragment), full_text is the body paragraphs.
                all_lines = ([inline_text] if inline_text else []) + own_lines
                paras = split_into_paragraphs(all_lines)
                pending[item_id] = ("paras", paras, item_id, table_html)
                provisions[item_id] = dict(
                    id=item_id, citation=citation, title=citation, parent_id=parent_id,
                    sort_order=next_sort(), full_text="", kind="item",
                )
        elif not extra_nonblank and not inline_text and not table_html:
            text = citation
            pending[item_id] = ("heading", text, item_id, "")
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=text, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind="item",
            )
        elif not extra_nonblank:
            text = f"{citation} {inline_text}".strip() if inline_text else citation
            pending[item_id] = ("heading", text, item_id, table_html)
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=text, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind="item",
            )
        else:
            all_lines = ([inline_text] if inline_text else []) + own_lines
            paras = split_into_paragraphs(all_lines)
            pending[item_id] = ("paras", paras, item_id, table_html)
            provisions[item_id] = dict(
                id=item_id, citation=citation, title=citation, parent_id=parent_id,
                sort_order=next_sort(), full_text="", kind="item",
            )
        order.append(item_id)

    # Second pass: link cross-references now that every id is known.
    known_ids = set(provisions.keys())
    unresolved_all: dict[str, Counter] = {b: Counter() for b in ALL_BUCKETS}

    def _merge(b: dict[str, Counter]) -> None:
        for k, ctr in b.items():
            unresolved_all[k].update(ctr)

    for pid, entry in pending.items():
        kindtag = entry[0]
        if kindtag == "def":
            paras = entry[1]
            rendered = []
            for p in paras:
                escaped = escape_html_text(p)
                linked, b = link_citations_ecmc(escaped, known_ids, CORPUS_REGS, table_owner)
                _merge(b)
                rendered.append(f"<p>{linked}</p>")
            provisions[pid]["full_text"] = "".join(rendered)
        elif kindtag == "heading":
            _, text, own_id, table_html = entry
            escaped = escape_html_text(text)
            linked, b = link_citations_ecmc(escaped, known_ids, CORPUS_REGS, table_owner)
            _merge(b)
            provisions[pid]["full_text"] = linked + table_html
        elif kindtag == "paras":
            _, paras, own_id, table_html = entry
            rendered = []
            for p in paras:
                escaped = escape_html_text(p)
                linked, b = link_citations_ecmc(escaped, known_ids, CORPUS_REGS, table_owner)
                _merge(b)
                rendered.append(f"<p>{linked}</p>")
            provisions[pid]["full_text"] = "".join(rendered) + table_html
        elif kindtag == "heading_body":
            # Rule rows and "rule_prefixed" ladder items (the 1100/Flowline
            # series): the heading text ALWAYS appears in full_text, either
            # alone (no lead-in body) or as the first paragraph followed by
            # the body paragraphs — matching the existing AQCC convention
            # for e.g. sec-26-P-A / sec-26-A-I heading rows.
            _, heading_text, paras, table_html = entry
            escaped_heading = escape_html_text(heading_text)
            linked_heading, b = link_citations_ecmc(escaped_heading, known_ids, CORPUS_REGS, table_owner)
            _merge(b)
            if not paras:
                provisions[pid]["full_text"] = linked_heading + table_html
            else:
                rendered = [f"<p>{linked_heading}</p>"]
                for p in paras:
                    escaped = escape_html_text(p)
                    linked, b = link_citations_ecmc(escaped, known_ids, CORPUS_REGS, table_owner)
                    _merge(b)
                    rendered.append(f"<p>{linked}</p>")
                provisions[pid]["full_text"] = "".join(rendered) + table_html
        elif kindtag == "appendix":
            _, paras, title, table_html, own_id = entry
            rendered = []
            for p in paras:
                escaped = escape_html_text(p)
                linked, b = link_citations_ecmc(escaped, known_ids, CORPUS_REGS, table_owner)
                _merge(b)
                rendered.append(f"<p>{linked}</p>")
            body_html = "".join(rendered)
            escaped_title = escape_html_text(title)
            provisions[pid]["full_text"] = table_html + (escaped_title if not paras else escaped_title + body_html)

    return provisions, order, unresolved_all, table_hits


_PART_A_HEADING_RE = re.compile(r"^\s*PART\s+A\s+\S")
_PART_A_BARE_HEADING_RE = re.compile(r"^\s*PART\s+A\s*$")


def find_body_start(lines: list[str], reg: str | None = None) -> int:
    """Finds where the real regulation body starts, skipping the front-matter
    "Outline of Regulation" list that repeats every Part heading (including
    "PART A ...") before the real content. Reg 7's real "PART A" heading sits
    at indent 0 while the outline copy is indented, so matching indent 0 used
    to be enough to tell them apart — but Reg 22's real "PART A" heading is
    ALSO indented (its whole first page carries a 4-space left margin, a
    pdftotext -layout quirk of that page's column layout; every part after A
    resets to indent 0 on a later page). Taking the LAST "PART A ..." match
    in the document instead of the first indent-0 one works for both: there
    are only ever the two occurrences (the outline copy, then the real
    heading), regardless of indentation."""
    last = 0
    # A reg whose parts are printed as a bare "PART A" line (see
    # FLAT_ENTRY_PART_CONFIG's `bare_part_headings`) has no "PART A <title>"
    # line at all; only then is the bare form considered (Reg 6 has no
    # front-matter outline either — its cover page is followed directly by
    # the real "PART A" heading).
    bare_ok = bool(FLAT_ENTRY_PART_CONFIG.get(reg or "", {}).get("bare_part_headings"))
    for i, l in enumerate(lines):
        if _PART_A_HEADING_RE.match(l) or (bare_ok and _PART_A_BARE_HEADING_RE.match(l)):
            last = i
    return last


_TOP_SECTION_HEADING_RE = re.compile(r"^\s*I\.\s+(\S.*)$")
# The GPxx general permits' front-matter Table of Contents prints each
# section title followed by a dot-leader or a run of plain spaces and the
# page number ("General Permit Applicability ................. 4" or
# "General Permit Applicability                    4" — GP09/10/11 use plain
# spaces, no dots; confirmed in every GPxx.txt), which the real body heading
# never carries — so the outline-copy/body-repeat title strings never
# compare equal for these regs, and `find_body_start_no_parts` fell back to
# 0 (scanning the title page / "Permit History" / cover TOC itself as body
# text). Stripping this trailing leader before comparing is gated to
# REG_META `toc_has_page_leaders` (every GP key) so Reg 1/cp — whose outline
# titles already match their body headings verbatim, with no leader at all —
# compare exactly as before.
_TOC_PAGE_LEADER_RE = re.compile(r"\s*(?:\.{2,}\s*)?\d{1,4}\s*$")


def _normalize_toc_title(title: str, strip_leader: bool) -> str:
    t = re.sub(r"\s+", " ", title).strip()
    return _TOC_PAGE_LEADER_RE.sub("", t).strip() if strip_leader else t


def find_body_start_no_parts(lines: list[str], reg: str | None = None) -> int:
    """`find_body_start` for a part-less regulation (REG_META `no_parts`):
    there is no "PART A" heading to anchor on, but the front-matter "Outline
    of Regulation" still lists every top-level section ("I. Applicability
    and General Provisions", "II. ...") before the real body repeats the
    same "I. <title>" heading verbatim as its first line. Take the first
    "I. <title>" line as the outline copy, and the next later line printing
    the SAME title as the body start (Reg 1: outline at line 32, body at
    line 63). Falls back to 0 (scan everything) if that repeat is never
    found, so a source with no outline at all still parses — and in that
    case the outline-less body's own "I." line is the first match anyway
    (confirmed for GP03, which prints no Table of Contents at all)."""
    strip_leader = bool(REG_META.get(reg or "", {}).get("toc_has_page_leaders"))
    first_title = None
    for i, l in enumerate(lines):
        m = _TOP_SECTION_HEADING_RE.match(l)
        if not m:
            continue
        title = _normalize_toc_title(m.group(1), strip_leader)
        if first_title is None:
            first_title = title
            continue
        if title == first_title:
            return i
    return 0


# --------------------------------------------------------------------------
# Reg 26 Part C supplement: 40 CFR Part 60 Subpart JJJJ (incorporated by
# reference). Confirmed by reading pipeline/sources/REG_26.pdf page-by-page
# (pdftotext dump + pdfplumber) that Subpart JJJJ is only ever MENTIONED in
# REG_26.pdf ("40 C.F.R. Part 60, Subpart JJJJ (July 1, 2023)", etc. — see
# I.D.5.d.(i)(C)(1), I.D.6.c.(i)(C)(1), III.A.1., III.B.1., and the Part C
# rulemaking-history narrative) — its ~20 rows of actual regulatory text
# (root + §§ 60.4230-60.4248) are NEVER printed in REG_26.pdf itself, so
# there is no PDF text for this importer to parse them out of. The existing
# DB nonetheless carries this content under Part C (sec-26-C-FEDJJJJ and its
# 19 children) — it must have been added via a separate eCFR import that
# pre-dates this CCR PDF parser and whose source file isn't in
# pipeline/sources/. Rather than fabricate or drop that content, this loads
# it verbatim from a one-time snapshot of those DB rows
# (pipeline/sources/reg26_fedjjjj_supplement.json, captured from
# pipeline/out/reg26_db.json) and re-attaches it under the freshly-parsed
# Part C root (`sec-26-P-C` — this parser's own id, NOT the old DB's
# `sec-26-C-PART-C`), sort_order-ed immediately after the last real SOB
# entry — so the parser stops silently dropping it (see the diff report's
# "Ids only in DB" list) without inventing new text.
def _load_reg26_fedjjjj_supplement(after_sort_order: int) -> list[dict]:
    path = Path(__file__).resolve().parent / "sources" / "reg26_fedjjjj_supplement.json"
    if not path.exists():
        return []
    rows = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for i, row in enumerate(rows):
        r = dict(row)
        r["sort_order"] = after_sort_order + (i + 1) * 10
        out.append(r)
    return out


def parse_reg(reg: str, txt_path: str, pdf_path: str | None):
    raw = Path(txt_path).read_text(encoding="utf-8")
    lines, seam_starts = clean_pages(raw, reg)
    lines, label_fixes_applied = apply_known_label_fixes(reg, lines)
    lines, text_fixes_applied = apply_known_text_fixes(reg, lines)
    label_fixes_applied = label_fixes_applied + text_fixes_applied
    # Inline label splits (see KNOWN_INLINE_LABEL_SPLITS) — a no-op for
    # every regulation with no entry.
    lines, inline_splits_applied = apply_inline_label_splits(reg, lines)
    label_fixes_applied = label_fixes_applied + inline_splits_applied
    is_rule_series = REG_META.get(reg, {}).get("family") == "rule_series"
    if is_rule_series:
        start = find_body_start_ecmc(lines)
    elif reg_has_no_parts(reg):
        start = find_body_start_no_parts(lines, reg)
    else:
        start = find_body_start(lines, reg)
    lines = lines[start:]
    seam_starts = {i - start for i in seam_starts if i >= start}
    skip_candidates, continuation_hits = find_known_continuation_lines(reg, lines)
    label_fixes_applied = label_fixes_applied + continuation_hits

    tables_by_caption: dict[str, dict] = {}
    if pdf_path:
        try:
            tables_by_caption = extract_tables_from_pdf(pdf_path, reg)
        except Exception as exc:  # pdfplumber optional at parse time
            print(f"warning: table extraction failed: {exc}", file=sys.stderr)
    # Captioned tables rebuilt from the layout text rather than from
    # pdfplumber (see CAPTIONED_LAYOUT_TABLES) — a no-op for every reg with
    # no entry, and it needs no PDF, so it runs whether or not `pdf_path`
    # was given.
    _rebuild_captioned_layout_tables(reg, lines, tables_by_caption)

    if is_rule_series:
        marker_audit = []
        provisions, order, unresolved, table_hits = parse_reg_rule_series(reg, lines, tables_by_caption)
    else:
        markers, marker_audit = scan_markers(lines, seam_starts, reg, skip_candidates)
        provisions, order, unresolved, table_hits = build_provisions(reg, lines, markers, tables_by_caption,
                                                                     seam_starts=seam_starts)

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
            if row is not seen[pid]:
                seen[pid]["full_text"] += row["full_text"]
            # else: build_provisions already folded the repeat's text into
            # the first occurrence (same dict object) — nothing to append.
            continue
        seen[pid] = row
        result.append(row)

    if reg == "26":
        max_sort = max((r["sort_order"] for r in result), default=0)
        result.extend(_load_reg26_fedjjjj_supplement(max_sort))

    anomalies = KNOWN_LABEL_ANOMALIES.get(reg, [])
    return result, unresolved, table_hits, len(tables_by_caption), duplicate_ids, label_fixes_applied, anomalies, marker_audit


# --------------------------------------------------------------------------
# CLI: parse
# --------------------------------------------------------------------------


def cmd_parse(args):
    if args.reg.lower() in ECFR_REGS:
        # eCFR subparts (ooooa/oooob/ooooc, jjjj, iiii, zzzz) use a
        # different source layout (eCFR "enhanced display" PDF prints, not
        # a CCR PDF) and are parsed by pipeline/import_ecfr.py instead --
        # see IMPORTER_SPEC.md. (Was `args.reg.lower().startswith("ooo")`,
        # which never matched "jjjj"/"iiii"/"zzzz".)
        import import_ecfr

        return import_ecfr.cmd_parse(args)
    if not args.pdf:
        raise SystemExit("--pdf is required for CCR regulations (only the whole-PART 49 CFR regs p190-p196/p199 use --xml)")
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


_QUOTE_COMPARE_TABLE = str.maketrans({
    "‘": "'", "’": "'", "‚": "'", "′": "'",
    "“": '"', "”": '"', "„": '"', "″": '"',
})


def _norm_for_compare(s: str) -> str:
    """Whitespace/page-furniture-insensitive normalization used ONLY for the
    diff's identical/truncation classification — never for the stored output.
    Also folds curly quotes/apostrophes to their straight ASCII form: the
    current Reg 26 DB rows were imported through a pipeline that flattened
    "'"/'"'-family Unicode punctuation to ASCII, while this parser (correctly,
    per IMPORTER_SPEC — keep the PDF's own text) preserves the PDF's actual
    curly characters, e.g. Reg 26's `sec-26-B-II-A-3-a` — DB '"Affected
    unit" means...' vs parsed '"Affected unit" means...' (same text) — that
    would otherwise misclassify hundreds of purely-cosmetic rows as
    "different" instead of "identical"."""
    s = re.sub(r"<[^>]+>", "", s or "")
    s = _FURNITURE_COMPARE_RE.sub(" ", s)
    s = s.translate(_QUOTE_COMPARE_TABLE)
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
    if reg_has_no_parts(reg):
        if rest.startswith("APPENDIX-"):
            return "appendix"
        return f"Section {rest.split('-', 1)[0]}. (no parts in this regulation)"
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
        BUCKET_HISTORICAL: "Historical (former structure — this regulation was renumbered/reorganized; these no longer exist in the current Parts)",
        BUCKET_OTHER_REG: "Other regulation not in corpus",
        BUCKET_CFR: "CFR part/subpart not in corpus",
        BUCKET_UNPARSEABLE: "Unparseable / genuine parser gap",
        BUCKET_FORM: "Form N (ECMC) — recognized, deliberately left as plain text",
        BUCKET_CRS: "C.R.S. statute citation (ECMC) — recognized, deliberately left as plain text",
        BUCKET_OTHER_CCR: "California Code of Regulations, Title 13 (Reg 20) — recognized, deliberately left as plain text",
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
            exists_top = any(provision_id(reg, p, roman) in known_ids for p in _roman_part_letters(reg, known_ids))
            if exists_top:
                remaining_non_historical += 1
    lines.append(
        f"### Remaining unwrapped \"Section...\" text\n\n"
        f"- Total: **{remaining_total}**\n"
        f"- Excluding ones whose roman numeral doesn't exist in any current roman-numbered part at all "
        f"(historical, expected to stay unlinked): **{remaining_non_historical}**\n"
    )

    # 4) Reviewer spot-check: 10 random linked Part B paragraphs, 5 from Part C.
    def _sample_linked(prefix: str, n: int, seed: int) -> list[dict]:
        pool = [r for r in parsed if r["id"].startswith(prefix) and 'class="xref"' in (r.get("full_text") or "")]
        rng = random.Random(seed)
        return rng.sample(pool, min(n, len(pool)))

    if reg_has_no_parts(reg):
        # No parts to sample by: show the body (everything outside the
        # statement-of-basis section) and the SOB section itself.
        _, sob_section = _sob_scope(reg)
        sob_prefix = provision_id(reg, NO_PART, sob_section) + "-" if sob_section else None
        lines.append("### 10 random linked paragraphs from the body (no parts in this regulation)\n")
        pool = [r for r in parsed if 'class="xref"' in (r.get("full_text") or "")
                and not (sob_prefix and (r["id"].startswith(sob_prefix) or r["id"] == sob_prefix[:-1]))]
        for r in random.Random(101).sample(pool, min(10, len(pool))):
            lines.append(f"- `{r['id']}`: {(r['full_text'] or '')[:400]}")
        lines.append("")
        lines.append(f"### 5 random linked paragraphs from the statement-of-basis section ({sob_section}.)\n")
        for r in (_sample_linked(sob_prefix, 5, 102) if sob_prefix else []):
            lines.append(f"- `{r['id']}`: {(r['full_text'] or '')[:400]}")
        lines.append("")
    else:
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
    if reg != "7":
        lines.append(
            "_(the hand-reviewed DB-vs-parsed xref-target writeup below is Reg 7-specific "
            "and only applies when diffing Reg 7 against a pre-existing DB export)_\n"
        )
        return lines
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
    HTML differs) so those can be excluded from the summary-regen list and
    keep their review state. Tags are removed outright (not replaced by a
    space): an xref span/anchor inserted flush against punctuation
    ("Regulation</a>." vs "Regulation.") must read as the same visible text
    -- replacing the tag with a space turned every such new link into a false
    "visible text changed" (Reg 6 IX.C on the batch-4 re-import)."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text or "")).strip()


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
    if touch_full_text == "markup":
        # visible text unchanged (only xref/table markup differs): replace
        # the stored HTML but leave every summary/review column alone.
        set_clause.append("full_text = EXCLUDED.full_text")
    elif touch_full_text:
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
    reg_meta = REG_META.get(reg, {})
    jurisdiction_level = reg_meta.get("jurisdiction_level", "state")
    issuing_body = reg_meta.get("issuing_body", "CDPHE-APCD")
    source_url = reg_meta.get("source_url", SOURCE_URL_DEFAULT)
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
        f"  - of which markup-only (visible text unchanged — full_text replaced, review state and summary_status left as they are): **{markup_only_count}**",
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
                row, jurisdiction_level, issuing_body, source_url, today, False,
                # summary_status is never touched for `identical` (not in SET
                # clause), but the INSERT branch still needs a legal value in
                # case this exact id is somehow new by the time this runs —
                # 'pending' matches every other row's default.
                "pending",
            ),
        ))
    for pid in c["changed"] + c["new"]:
        row = parsed_by_id[pid]
        touch = "markup" if c["markup_only"].get(pid) else True
        upsert_rows.append(dict(
            id=pid, sort_order=row["sort_order"], touch_full_text=touch,
            values_sql=_row_values_sql(
                row, jurisdiction_level, issuing_body, source_url, today, False, "pending",
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


def _execute_changed_fields(row: dict, now_iso: str, markup_only: bool = False) -> dict:
    """Adds full_text + clears summary review state, matching
    build_upsert_statement's `touch_full_text` branch. With `markup_only`
    (visible text identical to the DB row -- only xref spans / table HTML
    differ, e.g. an existing reg re-parsed after new regs joined the corpus
    and gained cross-links) only full_text is replaced: summary_status,
    reviewed_by, reviewed_at and summary_original are left exactly as they
    are, so a reviewed/corrected summary is not thrown back to `pending`
    for a change the reader cannot see. Still omits
    jurisdiction_level/issuing_body/source_url/last_verified_date/is_public
    (an id classified `changed` is, by construction, already a row in the
    DB -- classify_apply's `changed` is the shared-id set with different
    text -- so those columns are never touched by the SQL path's SET clause
    for this class either) and never touches ai_summary."""
    fields = _execute_identical_fields(row, now_iso)
    fields["full_text"] = row.get("full_text") or ""
    if not markup_only:
        fields.update({
            "summary_status": "pending",
            "reviewed_by": None,
            "reviewed_at": None,
            "summary_original": None,
        })
    return fields


def _execute_new_payload(row: dict, today: str, now_iso: str, meta: dict | None = None) -> dict:
    """A genuine INSERT (no existing row to preserve columns from), so every
    NOT NULL column the table requires is populated -- the same column list
    as `build_upsert_statement`'s `cols`. Unlike `.update()`, `.insert()`
    needs `id` in the payload. `meta` is this regulation's REG_META entry
    (jurisdiction_level/issuing_body/source_url) -- defaults to the Reg
    7-style state/CDPHE-APCD values when not given (unconfigured reg, or a
    caller/test that doesn't pass one) — same fallback as cmd_apply's SQL
    path (SOURCE_URL_DEFAULT)."""
    meta = meta or {}
    payload = _execute_changed_fields(row, now_iso)
    payload.update({
        "id": row["id"],
        "jurisdiction_level": meta.get("jurisdiction_level", "state"),
        "issuing_body": meta.get("issuing_body", "CDPHE-APCD"),
        "source_url": meta.get("source_url", SOURCE_URL_DEFAULT),
        "last_verified_date": today,
        "is_public": False,
    })
    return payload


def _execute_write_plan(c: dict, today: str, now_iso: str, chunk_size: int = EXECUTE_CHUNK,
                         meta: dict | None = None) -> list[dict]:
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
            pending_new.append(_execute_new_payload(row, today, now_iso, meta))
            if len(pending_new) >= chunk_size:
                flush_new()
        else:
            flush_new()
            if shape == "identical":
                fields = _execute_identical_fields(row, now_iso)
            else:
                fields = _execute_changed_fields(row, now_iso, markup_only=bool(c.get("markup_only", {}).get(pid)))
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
    meta = REG_META.get(getattr(args, "reg", None), {})

    total = len(c["identical"]) + len(c["changed"]) + len(c["new"])
    print(
        f"Writing {total} rows (identical={len(c['identical'])} + changed={len(c['changed'])} via "
        f"one UPDATE each, new={len(c['new'])} via INSERT in chunks of <= {EXECUTE_CHUNK}), "
        f"ordered by sort_order so parents precede children..."
    )
    done = 0
    for action in _execute_write_plan(c, today, now_iso, EXECUTE_CHUNK, meta):
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
    p_parse.add_argument("--pdf", default=None, help="Path to the source .pdf (for pdfplumber table extraction). Not used by the whole-PART eCFR regs (p190/p191/p192/p193/p194/p195/p196/p199), which read --xml.")
    p_parse.add_argument("--txt", default=None, help="Path to pdftotext -layout output (defaults to sources/REG_<reg>.txt).")
    p_parse.add_argument("--xml", default=None, help="Path to the eCFR versioner XML; required for the whole-PART eCFR regs (p190/p191/p192/p193/p194/p195/p196/p199).")
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
