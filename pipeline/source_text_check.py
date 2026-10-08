#!/usr/bin/env python3
"""Letters-and-digits diff of a general permit's stored text against its source PDF text.

Sprint 3 (Oct 2026), the corpus QA step for extraction errors. For each
regulation it takes the parse the importer would store (a `reg<key>_parsed.json`
from `import_ccr.py parse`, or a fresh in-process parse) and the body of the
`pdftotext -layout` text the parser read (pipeline/sources/<BASE>.txt, through
the importer's own clean_pages / find_body_start so page furniture, the cover
and the table of contents are dropped exactly as the parser drops them), turns
both into word sequences, and lists every place they differ:

  * a difference whose letters and digits are identical on both sides is a
    SPACING difference (a split-letter run re-spaced, a hyphenation rejoined,
    a line wrap) -- counted, listed, never an error;
  * a difference inside a table whose letters and digits are the same
    multiset is a TABLE LAYOUT difference (the layout text reads the cells
    in a different order than the rebuilt table) -- counted, not an error;
  * anything else is an EXTRACTION DIFFERENCE and is listed with the
    provision id and both texts. The expected ones are documented in
    KNOWN_DIFFERENCES and reported as such; an unknown one fails the run.

EssentialRegs' own notes are excluded before comparing: the [sic] marker
spans (pipeline/curated_sic.json) and the curated equation blocks
(pipeline/curated_equations.json; the source side drops the math-glyph lines
they replace, whose letters are checked by the glyph-count test instead).

    python pipeline/source_text_check.py --regs gp12 gp06           # parse in process
    python pipeline/source_text_check.py --all-gp --parsed-dir pipeline/out --out pipeline/out/sprint3_source_text_check.md
    python pipeline/source_text_check.py --regs gp12 --db-json pipeline/out/reggp12_db.json   # the live rows instead of a parse
    python pipeline/source_text_check.py --regs oooo --parsed-dir pipeline/out                # an eCFR subpart print (8 Oct 2026)

The 40 CFR subpart prints (OOOO, OOOOa/b/c, JJJJ, IIII, ZZZZ; import_ecfr.py)
are checked the same way since 8 Oct 2026: the source side is the print's
body after import_ecfr's own furniture stripping and body start (the table
of contents is dropped), and the corpus side puts back what that parser
moves out of the text -- a section's "§ 60.5365 heading" line (its title)
and a paragraph's printed label "(e)" (the tail of its citation).

Exit status 1 when an unknown extraction difference remains.
"""
from __future__ import annotations

import argparse
import difflib
import html as html_mod
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_ccr as ic  # noqa: E402
import import_ecfr as ie  # noqa: E402

SOURCES = Path(__file__).resolve().parent / "sources"
GP_REGS = list(ic.GP_KEYS)
_WORD_RE = re.compile(r"[^\W_]+", re.UNICODE)
_TAG_RE = re.compile(r"<[^>]+>")
_TABLE_RE = re.compile(r'(?:<div class="doc-table-caption">.*?</div>)?<table.*?</table>(?:</div>)?'
                       r'(?:<p class="table-footnote">.*?</p>)*', re.S)
_FIGURE_NOTE_RE = re.compile(r'<p class="figure-omitted">.*?</p>', re.S)

# Differences that are read and accepted, keyed by (reg, provision id): a
# short reason each. A difference listed here still prints, under "known".
KNOWN_DIFFERENCES: dict[tuple[str, str], str] = {
    ("gp03", "sec-gp03-I"): (
        "GP03's cover (title block, issuance, signature and the 'Note: See the Land Development General "
        "Permit Guidance document' line) precedes Condition I on page 1; every general permit's cover is "
        "outside the parsed body, and GP03 has no table of contents to put the body start after it"),
    ("gp08", "sec-gp08-VI-D"): (
        "the last row of Table 2 is printed across the page break (GP08.pdf pages 17-18: 'On or after' / "
        "'Issuance 4', 'Severe Ozone Non-' / 'Attainment', 'Greater than or' / 'equal to 15 TPY'); pdfplumber "
        "returns the two halves as two rows, as printed, and the page-18 half falls outside the span this "
        "check anchors for the table"),
    ("gp02", "sec-gp02-ATTACHMENT-A-5-3"): (
        "the table is printed without a caption; the importer's UNCAPTIONED_TABLES entry labels it "
        "'Table 1 in the Part B' (the words the sentence above it uses), so those five words occur "
        "once more in the corpus than in the PDF"),
}


def is_ecfr_subpart(reg: str) -> bool:
    """A 40 CFR subpart read from an eCFR print (not a whole-PART XML document)."""
    return reg in ic.ECFR_REGS and reg in ie.SUBPART_META and ie.SUBPART_META[reg].get("document") != "part"


def source_basename(reg: str) -> str:
    fixed = {"cp": "REG_CP", "aqs": "REG_AQS", "sip": "REG_SIP", "proc": "REG_PROC", "ecmc": "ECMC",
             "oooo": "OOOO", "oooob": "OOOOb", "ooooa": "OOOOa", "ooooc": "OOOOc"}
    if reg in fixed:
        return fixed[reg]
    if reg.isdigit():
        return f"REG_{reg}"
    return reg.upper()


def letters_digits(words: list[str]) -> str:
    return "".join(ic._letters_digits(w) for w in words)


def _plain(fragment: str) -> str:
    """Tags out, entities back to characters (the importer stores "&amp;")."""
    return html_mod.unescape(_TAG_RE.sub(" ", fragment))


# {row id: Counter of header words} of every rebuilt table, filled by
# corpus_words: the importer drops a table's reprinted header row on a
# continuation page, so the source may carry those words once more.
TABLE_HEADERS: dict[str, Counter] = {}
_HEADER_ROW_RE = re.compile(r"<thead>.*?</thead>|<tr>.*?</tr>", re.S)


_ECFR_LABEL_RE = re.compile(r"\(([a-zA-Z0-9]{1,4})\)$")


def _ecfr_lead_words(r: dict) -> list[str]:
    """What import_ecfr moves out of a row's text and the print shows in
    front of it: a section row's heading line ("§ 60.5365 Am I subject to
    this subpart?", the row's title), a paragraph row's label ("(e)", the
    tail of its citation). Tables carry their caption in the text already;
    group headings keep their text."""
    cit = r.get("citation") or ""
    m = _ECFR_LABEL_RE.search(cit)
    if m:
        return [m.group(1)]
    if cit.startswith("§") and r.get("title"):
        return _WORD_RE.findall(r["title"])
    return []


def corpus_words(rows: list[dict], ecfr: bool = False) -> tuple[list[str], list[str], list[bool]]:
    """(words, row id per word, in-table flag per word) for the stored text,
    in document order, EssentialRegs notes removed, the synthesized root
    row skipped (its title is not printed in the PDF)."""
    words: list[str] = []
    owners: list[str] = []
    in_table: list[bool] = []
    TABLE_HEADERS.clear()
    for r in sorted(rows, key=lambda r: r["sort_order"]):
        if r.get("kind") == "root" or "-top-REG-" in r["id"]:
            continue
        html = r.get("full_text") or ""
        html = ic._SIC_SPAN_RE.sub("", html)
        html = ic._EQUATION_BLOCK_RE.sub("", html)
        html = _FIGURE_NOTE_RE.sub("", html)
        # The parser moves an item's printed label ("III.F.3") out of the
        # body into `citation` (the reader prints it as a badge); a heading
        # row keeps it in its text. Put it back in front unless it is there.
        if ecfr:
            # import_ecfr always moves the label out, so it always goes back
            # (no "already there" test: "(A) A pilot flame" starts with the
            # letter of its own label); a label-only paragraph (kind
            # "heading", its text is the synthesized "§ 60.5365(d)" title) is
            # printed as the bare label and nothing else.
            for w in _ecfr_lead_words(r):
                words.append(w); owners.append(r["id"]); in_table.append(False)
            if r.get("kind") == "heading" and _plain(html).strip() == (r.get("title") or "").strip():
                continue
            cit_words = []
        else:
            cit_words = _WORD_RE.findall(r.get("citation") or "")
        body_ld = letters_digits(_WORD_RE.findall(_plain(html)))
        cit_ld = letters_digits(cit_words)
        if cit_words and not body_ld.startswith(cit_ld):
            for w in cit_words:
                words.append(w); owners.append(r["id"]); in_table.append(False)
        pos = 0
        for m in _TABLE_RE.finditer(html):
            for w in _WORD_RE.findall(_plain(html[pos:m.start()])):
                words.append(w); owners.append(r["id"]); in_table.append(False)
            for w in _WORD_RE.findall(_plain(m.group(0))):
                words.append(w); owners.append(r["id"]); in_table.append(True)
            head = _HEADER_ROW_RE.search(m.group(0))
            if head:
                TABLE_HEADERS.setdefault(r["id"], Counter()).update(
                    ic._letters_digits(w) for w in _WORD_RE.findall(_plain(head.group(0))))
            for fn in re.findall(r'<p class="table-footnote">.*?</p>', m.group(0), re.S):
                # a footnote is reprinted under every page of the table
                TABLE_HEADERS.setdefault(r["id"], Counter()).update(
                    ic._letters_digits(w) for w in _WORD_RE.findall(_plain(fn)))
            pos = m.end()
        for w in _WORD_RE.findall(_plain(html[pos:])):
            words.append(w); owners.append(r["id"]); in_table.append(False)
    return words, owners, in_table


def source_words(reg: str, txt_path: Path) -> tuple[list[str], list[int]]:
    """(words, source line number per word) of the body of the pdftotext
    text, prepared exactly as parse_reg prepares it (page furniture off,
    body start found, spacing fixes applied), math-glyph lines dropped."""
    raw = txt_path.read_text(encoding="utf-8")
    if is_ecfr_subpart(reg):
        lines = ie.strip_page_furniture(raw)
        lines, _ = ie.apply_known_label_fixes(reg, lines)
        meta = ie.SUBPART_META[reg]
        heading_re = re.compile(rf"^Subpart {re.escape(meta['code'])}—")
        _toc_end, start = ie.find_body_start(lines, heading_re)
        words: list[str] = []
        linenos: list[int] = []
        for i, ln in enumerate(lines[start:], start):
            for w in _WORD_RE.findall(ln):
                words.append(w)
                linenos.append(i + 1)
        return words, linenos
    lines, _seams = ic.clean_pages(raw, reg)
    lines, _ = ic.apply_known_label_fixes(reg, lines)
    lines, _ = ic.apply_known_text_fixes(reg, lines)
    lines, _ = ic.apply_inline_label_splits(reg, lines)
    if ic.REG_META.get(reg, {}).get("family") == "rule_series":
        start = ic.find_body_start_ecmc(lines)
    elif ic.reg_has_no_parts(reg):
        start = ic.find_body_start_no_parts(lines, reg)
    else:
        start = ic.find_body_start(lines, reg)
    words: list[str] = []
    linenos: list[int] = []
    for i, ln in enumerate(lines[start:], start):
        if ic.MATH_GLYPH_RE.search(ln):
            continue
        for w in _WORD_RE.findall(ln):
            words.append(w)
            linenos.append(i + 1)
    return words, linenos


# --------------------------------------------------------------------------
# Corpus-side checks (Oct 2026 review of the OOOO import). The word diff
# above cannot see a problem the source text shares -- a page-break header
# pdftotext reprints inside a table, an e-mail address the eCFR itself
# prints with doubled underscores, an equation the eCFR publishes only as
# an image -- so these look at the stored text alone and report every hit;
# any hit fails the check like an unknown extraction difference does.
# --------------------------------------------------------------------------

_TABLE_EL_RE = re.compile(r"<table.*?</table>", re.S)
_TR_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
_CELL_RE = re.compile(r"<t[hd][^>]*>(.*?)</t[hd]>", re.S)
_THEAD_RE = re.compile(r"<thead[^>]*>(.*?)</thead>", re.S)
_TBODY_RE = re.compile(r"<tbody[^>]*>(.*?)</tbody>", re.S)
# two or more underscores inside an e-mail address or a URL
_UNDERSCORE_RUN_RE = re.compile(r"[\w.\-]*_{2,}[\w.\-]*@[\w.\-]+|(?:https?://|www\.)[^\s<]*_{2,}[^\s<]*")
# "... as follows:" / "using the following equation:" / "using Equation 1 ...:"
# directly followed by "Where:" (an optional eCFR equation caption between)
_EQUATION_GAP_RE = re.compile(
    r"(?:as follows|following equations?|using (?:the following )?equations?[^:]{0,40}|by):\s*"
    r"(?:Equation \d+ to [Pp]aragraph [^:]{0,30})?\s*Where:", re.I)


def _cells(tr_html: str) -> list[str]:
    return [_plain(c).strip() for c in _CELL_RE.findall(tr_html)]


def _row_words(cells: list[str]) -> Counter:
    return Counter(w.lower() for c in cells for w in _WORD_RE.findall(c))


def repeated_header_rows(html: str) -> list[str]:
    """Body rows of the tables in `html` that repeat the header: the same
    cells as a header row, or (a fused page-break header, OOOO Table 3 on
    the v1 algorithm) every word of a header row inside one body row. One
    description per hit."""
    hits: list[str] = []
    for t in _TABLE_EL_RE.findall(html):
        thead = _THEAD_RE.search(t)
        tbody = _TBODY_RE.search(t)
        if thead:
            header_rows = [_cells(tr) for tr in _TR_RE.findall(thead.group(1))]
            body_rows = [_cells(tr) for tr in _TR_RE.findall(tbody.group(1) if tbody else t)]
        else:
            rows = [_cells(tr) for tr in _TR_RE.findall(t)]
            header_rows, body_rows = rows[:1], rows[1:]
        header_keys = [letters_digits(h) for h in header_rows if any(h)]
        header_words = [_row_words(h) for h in header_rows if len(set(_row_words(h))) >= 3]
        for cells in body_rows:
            key = letters_digits(cells)
            if key and key in header_keys:
                hits.append("header row repeated in the body: " + " | ".join(cells)[:120])
                continue
            words = _row_words(cells)
            for hw in header_words:
                if all(words.get(w, 0) >= n for w, n in hw.items()):
                    hits.append("header words fused into a body row: " + " | ".join(cells)[:120])
                    break
    return hits


def underscore_runs(html: str) -> list[str]:
    """E-mail addresses / URLs in `html` with a run of two or more
    underscores, except one already carrying a [sic] marker (an EssentialRegs
    note saying the official text prints it that way)."""
    hits: list[str] = []
    for m in _UNDERSCORE_RUN_RE.finditer(html):
        if html[m.end():m.end() + 24].startswith('<span class="er-sic"'):
            continue
        hits.append(m.group(0))
    return hits


def equation_gaps(html: str) -> list[str]:
    """Lead-ins announcing an equation that run straight into "Where:" --
    nothing (no transcription, no placeholder) between them."""
    text = re.sub(r"\s+", " ", _plain(html))
    return [m.group(0)[-80:] for m in _EQUATION_GAP_RE.finditer(text)]


def corpus_checks(rows: list[dict]) -> list[dict]:
    """Every hit of the three checks over `rows`: dicts (id, kind, note)."""
    out: list[dict] = []
    for r in sorted(rows, key=lambda r: r.get("sort_order", 0)):
        html = r.get("full_text") or ""
        for h in repeated_header_rows(html):
            out.append(dict(id=r["id"], kind="repeated_header", note=h))
        for h in underscore_runs(html):
            out.append(dict(id=r["id"], kind="underscore_run",
                            note=f"{h}: confirm against the eCFR XML; if the official text prints it this way, "
                                 "add a pipeline/curated_sic.json note (tooltip) instead of altering it"))
        for h in equation_gaps(html):
            out.append(dict(id=r["id"], kind="equation_gap",
                            note=f"…{h}: no equation between the lead-in and 'Where:' (an image in the source? "
                                 "import_ecfr.insert_ecfr_image_notes places a transcription or placeholder from the XML)"))
    return out


def compare(reg: str, rows: list[dict], txt_path: Path) -> dict:
    a_words, owners, in_table = corpus_words(rows, ecfr=is_ecfr_subpart(reg))
    b_words, linenos = source_words(reg, txt_path)
    sm = difflib.SequenceMatcher(None, a_words, b_words, autojunk=False)
    spacing: list[dict] = []
    table_layout: list[dict] = []
    extraction: list[dict] = []

    def rec_for(i1, i2, j1, j2, a_span=None, b_span=None):
        owner = owners[i1] if i1 < len(owners) else (owners[-1] if owners else "?")
        line = linenos[j1] if j1 < len(linenos) else (linenos[-1] if linenos else 0)
        a_span = a_words[i1:i2] if a_span is None else a_span
        b_span = b_words[j1:j2] if b_span is None else b_span
        return dict(id=owner, line=line, corpus=" ".join(a_span), pdf=" ".join(b_span),
                    context=" ".join(a_words[max(0, i1 - 6):i1]))

    # Tables first. A rebuilt table reads its cells in a different order than
    # the layout text (a header stacked over two lines, a cell wrapped onto
    # the next line), so each table is compared as a whole: the corpus run of
    # table words against the source words between the nearest words matched
    # on either side of it, as multisets of letters and digits. The source
    # may hold the table's header once more per continuation page (the
    # importer drops the reprint); anything else is an extraction difference.
    blocks = sm.get_matching_blocks()
    a_to_b: dict[int, int] = {}
    for a, b, n in blocks:
        for k in range(n):
            a_to_b[a + k] = b + k
    a_done = [False] * len(a_words)
    b_done = [False] * len(b_words)
    i = 0
    while i < len(a_words):
        if not in_table[i]:
            i += 1
            continue
        s_ = i
        while i < len(a_words) and in_table[i]:
            i += 1
        e_ = i
        # Anchors: the nearest run of three consecutively matched prose
        # words on each side (a single matched "VI" or "the" can belong to
        # a block far away and would swallow the prose in between).
        def anchored(k):
            return (0 <= k < len(a_words) and not in_table[k] and k in a_to_b)

        prev = s_ - 1
        while prev >= 2 and not (anchored(prev) and anchored(prev - 1) and anchored(prev - 2)
                                 and a_to_b[prev] == a_to_b[prev - 1] + 1 == a_to_b[prev - 2] + 2):
            prev -= 1
        nxt = e_
        while nxt + 2 < len(a_words) and not (anchored(nxt) and anchored(nxt + 1) and anchored(nxt + 2)
                                              and a_to_b[nxt + 2] == a_to_b[nxt + 1] + 1 == a_to_b[nxt] + 2):
            nxt += 1
        j1 = a_to_b[prev] + 1 if prev >= 2 and anchored(prev) else 0
        j2 = a_to_b[nxt] if nxt + 2 < len(a_words) and anchored(nxt) else len(b_words)
        if j2 < j1:
            j2 = j1
        # The anchors may sit a few prose words away from the table on the
        # corpus side; those words are compared with the table region too.
        s_, e_ = min(s_, prev + 1) if prev >= 2 else s_, max(e_, nxt) if nxt + 2 < len(a_words) else e_
        a_span, b_span = a_words[s_:e_], b_words[j1:j2]
        for k in range(s_, e_):
            a_done[k] = True
        for k in range(j1, j2):
            b_done[k] = True
        rec = rec_for(s_, e_, j1, j2)
        a_ld, b_ld = letters_digits(a_span), letters_digits(b_span)
        if a_ld == b_ld:
            continue
        if sorted(a_ld) == sorted(b_ld):
            table_layout.append(rec)
        elif _is_repeated_header(owners[s_], a_span, b_span):
            rec["repeated_header"] = True
            table_layout.append(rec)
        else:
            a_c = Counter(ic._letters_digits(w) for w in a_span)
            b_c = Counter(ic._letters_digits(w) for w in b_span)
            rec["corpus"] = "table words not in the source: " + " ".join((a_c - b_c).elements())
            rec["pdf"] = "source words not in the table: " + " ".join((b_c - a_c).elements())
            rec["known"] = KNOWN_DIFFERENCES.get((reg, owners[s_]))
            extraction.append(rec)

    # Then the prose, opcode by opcode, with the table words taken out.
    equal = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            equal += sum(1 for k in range(i1, i2) if not a_done[k])
            continue
        a_span = [a_words[k] for k in range(i1, i2) if not a_done[k]]
        b_span = [b_words[k] for k in range(j1, j2) if not b_done[k]]
        if not a_span and not b_span:
            continue
        rec = rec_for(i1, i2, j1, j2, a_span, b_span)
        a_ld, b_ld = letters_digits(a_span), letters_digits(b_span)
        if a_ld == b_ld:
            spacing.append(rec)
        else:
            rec["known"] = KNOWN_DIFFERENCES.get((reg, rec["id"]))
            extraction.append(rec)
    return dict(reg=reg, corpus_words=len(a_words), source_words=len(b_words), equal=equal,
                spacing=spacing, table_layout=table_layout, extraction=extraction,
                unknown=[d for d in extraction if not d["known"]],
                corpus_checks=corpus_checks(rows))


def _is_repeated_header(owner: str, a_span: list[str], b_span: list[str]) -> bool:
    """True when the source words are the corpus words plus reprints of the
    owner row's table header and footnotes (a multi-page table whose header
    block and footnote the PDF reprints on every page and the importer
    keeps once)."""
    header = TABLE_HEADERS.get(owner)
    if not header:
        return False
    # Character multisets: a footnote marker printed glued ("Registration1")
    # on one page and spaced ("Registration 1") on the next is the same
    # letters and digits.
    a = Counter(letters_digits(a_span))
    b = Counter(letters_digits(b_span))
    surplus = b - a
    if not surplus or (a - b):
        return False
    hchars = Counter("".join(w * n for w, n in header.items()))
    # every surplus character is a header (or footnote) character, at most
    # five reprints' worth of it
    return all(hchars.get(ch, 0) * 5 >= n for ch, n in surplus.items())


def load_rows(reg: str, parsed_dir: Path | None, db_json: Path | None) -> list[dict]:
    if db_json:
        return json.loads(db_json.read_text(encoding="utf-8"))
    if parsed_dir:
        p = parsed_dir / f"reg{reg}_parsed.json"
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    base = source_basename(reg)
    pdf = SOURCES / f"{base}.pdf"
    if is_ecfr_subpart(reg):
        rows, _report = ie.parse_ecfr(reg, str(pdf) if pdf.exists() else None, str(SOURCES / f"{base}.txt"))
        return rows
    result = ic.parse_reg(reg, str(SOURCES / f"{base}.txt"), str(pdf) if pdf.exists() else None)
    return result[0]


def render(results: list[dict]) -> str:
    out = ["# Source text check: stored text vs. source PDF text (letters and digits)\n"]
    out.append("Word-level diff of each document's stored text against the body of its pdftotext "
               "source. A difference with identical letters and digits is *spacing* (free); a table "
               "difference with the same letters as a multiset is *table layout* (free); the rest are "
               "*extraction differences*, each either known (reason given) or **unknown** (fails).\n")
    out.append("Corpus checks look at the stored text alone (the source may share the fault): a table "
               "header row repeated or fused inside the body, a run of two or more underscores in an "
               "e-mail address or URL, an equation lead-in followed directly by \"Where:\". Any hit fails.\n")
    out.append("| reg | corpus words | source words | equal | spacing | table layout | extraction | unknown | corpus checks |")
    out.append("|---|---|---|---|---|---|---|---|---|")
    for r in results:
        out.append(f"| {r['reg']} | {r['corpus_words']} | {r['source_words']} | {r['equal']} | {len(r['spacing'])} "
                   f"| {len(r['table_layout'])} | {len(r['extraction'])} | **{len(r['unknown'])}** "
                   f"| **{len(r.get('corpus_checks', []))}** |")
    out.append("")
    for r in results:
        out.append(f"## {r['reg']}\n")
        if r.get("corpus_checks"):
            out.append(f"### Corpus checks: {len(r['corpus_checks'])} hit(s)\n")
            for d in r["corpus_checks"]:
                out.append(f"- `{d['id']}` **{d['kind']}**: {d['note']}")
            out.append("")
        if r["extraction"]:
            out.append("### Extraction differences\n")
            for d in r["extraction"]:
                tag = f"known: {d['known']}" if d["known"] else "**UNKNOWN**"
                out.append(f"- `{d['id']}` (source line ~{d['line']}) {tag}\n"
                           f"  - corpus: `…{d['context']}` **`{d['corpus'] or '∅'}`**\n"
                           f"  - pdf: **`{d['pdf'] or '∅'}`**")
            out.append("")
        if r["spacing"]:
            out.append("### Spacing differences (same letters and digits)\n")
            for d in r["spacing"]:
                out.append(f"- `{d['id']}` (source line ~{d['line']}): corpus `{d['corpus']}` / pdf `{d['pdf']}`")
            out.append("")
        if r["table_layout"]:
            out.append(f"### Table layout differences (same letters, different cell order): {len(r['table_layout'])}\n")
            for d in r["table_layout"][:12]:
                out.append(f"- `{d['id']}` (source line ~{d['line']}): corpus `{d['corpus'][:80]}` / pdf `{d['pdf'][:80]}`")
            if len(r["table_layout"]) > 12:
                out.append(f"- … {len(r['table_layout']) - 12} more")
            out.append("")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--regs", nargs="*", default=[], help="regulation keys (default: every general permit)")
    ap.add_argument("--all-gp", action="store_true", help="every general permit (gp01-gp12)")
    ap.add_argument("--parsed-dir", type=Path, default=None, help="directory holding reg<key>_parsed.json files")
    ap.add_argument("--db-json", type=Path, default=None, help="compare a DB export (import_ccr.py export) instead of a parse")
    ap.add_argument("--out", type=Path, default=None, help="write the Markdown report here")
    args = ap.parse_args(argv)
    regs = list(args.regs) or GP_REGS
    if args.all_gp:
        regs = GP_REGS
    results = []
    for reg in regs:
        rows = load_rows(reg, args.parsed_dir, args.db_json)
        txt = SOURCES / f"{source_basename(reg)}.txt"
        res = compare(reg, rows, txt)
        results.append(res)
        print(f"{reg}: {res['corpus_words']} corpus words, {res['source_words']} source words, "
              f"{res['equal']} equal; spacing {len(res['spacing'])}, table layout {len(res['table_layout'])}, "
              f"extraction {len(res['extraction'])} (unknown {len(res['unknown'])}); "
              f"corpus checks {len(res['corpus_checks'])}")
    report = render(results)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(report)
    return 1 if any(r["unknown"] or r.get("corpus_checks") for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
