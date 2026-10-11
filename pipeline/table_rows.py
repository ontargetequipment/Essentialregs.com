"""Table continuation rows (Sprint 7, 11 Oct 2026).

pdfplumber, and the eCFR print's whitespace-layout reader, emit a cell that
wraps onto a second printed line as a second table ROW whenever the page's
ruling (or the layout) does not keep the two lines in one cell. GP05 VI.D's
Table 2 printed one row,

    Prior to Issuance 5 | Any | Any | Every 5 years

and the extractor returned two,

    Prior to   | Any | Any | Every 5
    Issuance 5 |     |     | years

`merge_continuation_rows` puts such a row back into the row above it,
joining each cell to the one above with a space. Only the rows of a table
are touched: the words, their order inside a cell and every other row stay
exactly as extracted.

A row is a continuation when it leaves at least one cell blank (a wrapped
line never fills every column) and EVERY cell it does fill continues the
cell above it mid-phrase:

  * the cell above ends with a hyphen ("Non-" / "Attainment"), a comma, an
    opening bracket, a slash or an ampersand; or
  * the cell above ends with a word a printed phrase cannot end on: an
    article, a preposition, a conjunction ("Prior to" / "Issuance 5",
    "Greater than or" / "equal to 40 TPY"); or
  * the cell starts with a lower-case letter ("Every 5" / "years").

A filled cell under a blank one, or one that starts with a list marker
("1.", "(a)", "*"), is never a continuation, so a row with a legitimately
blank cell (an engine table's second construction date under a spanned
horsepower class, a category heading such as "Specialty coatings" with no
limit of its own, a units row such as "Inches (Millimeters)") stays a row.
Being mostly empty is not enough on its own: those same sub-header and
category rows are mostly empty.

A header row takes a continuation only when at least two of its cells
continue ("General provisions" / "citation", "Subject of" / "citation",
"Applies to" / "subpart?"): one stray lower-case cell under a header is far
more often the tail of a cell carried over from the previous page
(Regulation 23 IV.F.3, "clinker S013 ...") than a wrapped column title.

A row with no text at all is dropped: it is an empty band of the printed
grid, not a row of the table.

Every merge is logged in TABLE_ROW_MERGES for the parse report.
"""
from __future__ import annotations

import re

# Words a printed phrase in a table cell cannot end on. A cell whose last
# word is one of these was cut mid-phrase by the line wrap.
CONNECTOR_WORDS: frozenset[str] = frozenset({
    "a", "an", "the",
    "and", "or", "nor", "but", "if", "as", "that", "which", "whose", "where", "when",
    "of", "to", "in", "on", "at", "by", "for", "from", "with", "without", "than", "per",
    "after", "before", "prior", "under", "over", "between", "within", "into", "onto",
    "upon", "via", "through", "during", "until", "since", "including", "excluding",
    "each", "every", "any", "all", "no", "not", "is", "are", "be",
    "equal", "greater", "less", "more",
})

# The sub/superscript markers import_ccr._page_tables puts around a rejoined
# script character; they are not text and must not decide a continuation.
_SCRIPT_MARKERS_RE = re.compile(r"[\x01-\x04]")
_LIST_MARKER_RE = re.compile(r"^(?:\(?(?:\d{1,3}|[ivxlc]{1,5}|[IVXLC]{1,5}|[a-z])[.)]|[*••])(?:\s|$)")

# Per-parse log of the merges (reset by the importers' parse entry points).
TABLE_ROW_MERGES: list[dict] = []


def unique_merges() -> list[dict]:
    """TABLE_ROW_MERGES without repeats: an importer may render the same
    table more than once in one parse."""
    seen: set[str] = set()
    out: list[dict] = []
    for m in TABLE_ROW_MERGES:
        key = repr((m["caption"], m["kind"], m["row"], m["cells"]))
        if key not in seen:
            seen.add(key)
            out.append(m)
    return out


def _text(cell) -> str:
    """A cell's text as the reader shows it: line breaks as spaces, trimmed."""
    return re.sub(r"\s+", " ", _SCRIPT_MARKERS_RE.sub("", (cell or "").replace("\n", " "))).strip()


def continues_cell(above, cell) -> bool:
    """Whether `cell` is the wrapped tail of `above` (the cell in the same
    column of the row before)."""
    a, c = _text(above), _text(cell)
    if not a or not c:
        return False
    if _LIST_MARKER_RE.match(c):
        return False
    if a.endswith("-") and not a.endswith("--"):
        return True
    if a[-1] in ",(/&":
        return True
    last = a.split()[-1]
    if last.isalpha() and last.lower() in CONNECTOR_WORDS:
        return True
    return c[0].islower()


def _join(above, cell):
    a = (above or "").replace("\n", " ").strip()
    c = (cell or "").replace("\n", " ").strip()
    if not c:
        return above
    return f"{a} {c}" if a else c


def merge_continuation_rows(rows: list, caption: str = "") -> list:
    """`rows` (header first) with every continuation row merged into the row
    above it and every textless row dropped. See the module docstring.
    Returns a new list; the input is not modified."""
    out: list[list] = []
    for row in rows:
        row = list(row or [])
        texts = [_text(c) for c in row]
        if out and not any(texts):
            TABLE_ROW_MERGES.append(dict(caption=caption, kind="blank", row=len(out) - 1, cells=[]))
            continue
        if out and len(row) == len(out[-1]) and not all(texts):
            above = out[-1]
            filled = [j for j, t in enumerate(texts) if t]
            into_header = len(out) == 1
            if (filled and (not into_header or len(filled) >= 2)
                    and all(continues_cell(above[j], row[j]) for j in filled)):
                TABLE_ROW_MERGES.append(dict(
                    caption=caption, kind="wrap", row=len(out) - 1,
                    cells=[(_text(above[j]), texts[j]) for j in filled],
                ))
                out[-1] = [_join(above[j], row[j]) for j in range(len(row))]
                continue
        out.append(row)
    return out
