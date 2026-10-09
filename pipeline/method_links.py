#!/usr/bin/env python3
"""EPA test-method citation linker, shared by import_ccr.py and import_ecfr.py.

A provision that says "Method 21", "EPA Method 5" or "Performance
Specification 8" gets that text wrapped as

    <a class="xref-method" href="/test-methods/<slug>">Method 21</a>

so the reader can open the site's Test Methods reference page for it
(src/app/test-methods/[slug]). One function does it, `link_method_citations`,
called by both importers on each paragraph AFTER their own cross-reference
pass (`link_citations`), so it sees the xref spans and anchors that pass
produced and never links inside them.

The allowlist IS the data file. `src/data/test-methods.json` (the same file
the app's typed wrapper src/data/test-methods.ts imports) decides which
methods exist: a citation links if and only if the slug `method-<n><letter>`
(letter lower-cased) or `ps-<n>` is an entry's slug. There is no second list
here; Method 7400 (NIOSH), CARB Method 310, Method 5G, Performance
Specification 12 and every other number the file does not carry stay plain
text.

What is recognised
------------------
* `(EPA |Reference |Test )?Method N[A-Z]?` and
  `Performance Specification N`, case-sensitive, `N` followed by a
  non-alphanumeric (so "Method 21" never matches inside "Method 21A"). The
  matched display text is kept exactly as printed, prefix included: "EPA
  Method 21" links as "EPA Method 21", never normalised to "Method 21".
* Lists and ranges after the first number, as the corpus prints them:
  "Methods 1, 2, 3, and 4", "Methods 2A and 2D", "Method 3, 3A, or 3B",
  "Methods 1 through 4", "Methods 1–4" / "Methods 1-4". Each number that
  resolves is linked on its own: the first item's anchor wraps the lead-in
  and the number ("<a>Methods 2A</a> and <a>2D</a>"); every later item's
  anchor wraps just the number. For a "through" (or dash) range only the
  first and last numbers are linked and the words between are untouched;
  the methods inside the range are not enumerated.
  A dash range is read only after the plural "Methods": the singular
  "Method 318-95" / "Method 303-91" is a dated designation, not a range.
  A continuation number followed by "CFR" / "C.F.R." is the start of a
  CFR citation ("Method 22, 40 CFR part 60, appendix A") and ends the list.

Where it never links
--------------------
* inside an existing `<a>` (any anchor, its own included -- which is what
  makes the pass idempotent: running it on already-linked text changes
  nothing, byte for byte);
* inside a `<span class="xref" ...>` (a same-document citation the
  importer resolved);
* inside a table caption (`<div class="doc-table-caption">` and
  `<caption>`), whose numbering is the table's, not a method's;
* inside the row's own citation label when the caller passes it as
  `skip_prefix` (a heading row's text starts with its label).

Returns the new HTML and one record per anchor added, `{"slug", "text"}`,
in document order, so the importers can report counts per slug and the
apply step can write the `provision_method_citations` rows the Test Methods
pages' "Cited by" lists read (`extract_method_citations` re-reads them from
stored HTML, so the rows always match the text).

Switching it off: `ER_METHOD_LINKS=0` in the environment, or
`set_enabled(False)` (the importers' `--no-method-links`), makes
`link_method_citations` return its input unchanged -- the byte-identical
regression proof in test_method_links.py parses every document both ways.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "src" / "data" / "test-methods.json"

ANCHOR_CLASS = "xref-method"
HREF_PREFIX = "/test-methods/"

_ENABLED = os.environ.get("ER_METHOD_LINKS", "1").strip().lower() not in ("0", "false", "no", "off")


def set_enabled(on: bool) -> None:
    """Turn the linker on or off for the process (the importers' --no-method-links)."""
    global _ENABLED
    _ENABLED = bool(on)


def is_enabled() -> bool:
    return _ENABLED


def load_slugs(path: Path | str = DATA_FILE) -> frozenset[str]:
    """Every slug in the data file. The file is the allowlist: nothing else decides what links."""
    with open(path, encoding="utf-8") as f:
        entries = json.load(f)
    return frozenset(e["slug"] for e in entries)


SLUGS: frozenset[str] = load_slugs()


def slug_for(kind: str, number: str) -> str | None:
    """The slug a printed number would link to, or None when the data file has no such entry.
    kind: "method" ("Method 25A" -> "method-25a") or "ps" ("Performance Specification 8" -> "ps-8")."""
    slug = f"{kind}-{number.lower()}"
    return slug if slug in SLUGS else None


# A method number: digits with at most one capital letter, not running into
# more letters or digits ("21", "25A", "3C"; not "21A" from "Method 21AB").
_NUM = r"\d+[A-Z]?(?![A-Za-z0-9])"

# The lead-in of a method citation. Group "lead" is everything up to and
# including the first number; "plural" tells a range apart from a dated
# designation; "n1" is the first number.
_METHOD_RE = re.compile(
    r"(?<![A-Za-z])(?P<lead>(?:EPA |Reference |Test )?Method(?P<plural>s)?\s+(?P<n1>" + _NUM + r"))"
)
_PS_RE = re.compile(r"(?<![A-Za-z])(?P<lead>Performance Specification\s+(?P<n1>" + _NUM + r"))")

# One more item of a list or range, after the previous number. Group "sep"
# is the separator as printed, "n" the number. A number that opens a CFR
# citation ("..., 40 CFR part 60") is not a list item.
_NEXT_ITEM_RE = re.compile(
    r"(?P<sep>\s*,\s*(?:and|or)\s+|\s+(?:and|or|through)\s+|\s*,\s*|\s*[–—-]\s*)"
    r"(?P<n>" + _NUM + r")"
    r"(?!\s*C\.?\s*F\.?\s*R)"
)
_RANGE_SEPS = re.compile(r"\s+through\s+|\s*[–—-]\s*")

_TAG_RE = re.compile(r"<[^>]+>")
_ANCHOR_RE = re.compile(
    r'<a class="' + ANCHOR_CLASS + r'" href="' + re.escape(HREF_PREFIX) + r'([a-z0-9-]+)">(.*?)</a>', re.S
)


def _anchor(slug: str, text: str) -> str:
    return f'<a class="{ANCHOR_CLASS}" href="{HREF_PREFIX}{slug}">{text}</a>'


def _link_text(text: str, records: list[dict], skip_before: int = 0) -> str:
    """Links the citations in one text node (no tags inside). `skip_before`:
    a character offset below which nothing is linked (the citation label)."""
    out: list[str] = []
    pos = 0
    while True:
        m = _METHOD_RE.search(text, pos)
        p = _PS_RE.search(text, pos)
        if m is None and p is None:
            break
        if p is not None and (m is None or p.start() < m.start()):
            m, kind, plural = p, "ps", False
        else:
            kind, plural = "method", bool(m.group("plural"))
        if m.start() < skip_before:
            # Inside the row's own citation label: leave it, carry on after it.
            out.append(text[pos:m.end()])
            pos = m.end()
            continue
        out.append(text[pos:m.start()])
        # First item: the lead-in and its number link together.
        slug = slug_for(kind, m.group("n1"))
        lead = m.group("lead")
        if slug:
            out.append(_anchor(slug, lead))
            records.append({"slug": slug, "text": lead})
        else:
            out.append(lead)
        pos = m.end()
        if kind != "method":
            continue
        # Later items of a list or range. A dash is a range only after the
        # plural "Methods" ("Methods 1-4"); "Method 318-95" is a designation.
        while True:
            nm = _NEXT_ITEM_RE.match(text, pos)
            if nm is None:
                break
            sep = nm.group("sep")
            is_dash = bool(re.search(r"[\u2013\u2014-]", sep))
            if is_dash and not plural:
                break  # "Method 318-95": a dated designation, not a range
            is_range = is_dash or "through" in sep
            n = nm.group("n")
            out.append(sep)
            s = slug_for("method", n)
            if s:
                out.append(_anchor(s, n))
                records.append({"slug": s, "text": n})
            else:
                out.append(n)
            pos = nm.end()
            if is_range:
                # "Methods 1 through 4": first and last only; what follows is prose.
                break
    out.append(text[pos:])
    return "".join(out)


def link_method_citations(html: str, skip_prefix: str | None = None) -> tuple[str, list[dict]]:
    """Wrap every recognised method citation in `html` (one provision's text
    or one paragraph, already HTML-escaped and already through the
    importer's own cross-reference pass) as an xref-method anchor.

    Returns (new_html, records); records is one {"slug", "text"} per anchor
    added, in order. With the linker disabled, or when nothing in `html`
    resolves, the HTML comes back unchanged (the same object).

    `skip_prefix`: the row's own citation label; a citation inside the
    label's leading occurrence in the text is never linked."""
    if not _ENABLED or not html or "Method" not in html and "Performance Specification" not in html:
        return html, []
    records: list[dict] = []
    out: list[str] = []
    pos = 0
    anchor_depth = 0
    span_stack: list[bool] = []   # True for a <span class="xref" ...>
    div_stack: list[bool] = []    # True for <div class="doc-table-caption">
    caption_depth = 0             # <caption> elements
    # The row's citation label: when the visible text (tags stripped) opens
    # with it, nothing inside those characters is linked.
    label_end = 0
    if skip_prefix:
        visible = _TAG_RE.sub("", html)
        lead_ws = len(visible) - len(visible.lstrip())
        if visible[lead_ws:].startswith(skip_prefix):
            label_end = lead_ws + len(skip_prefix)
    seen = 0  # visible characters before the current text node

    def emit(text: str) -> None:
        nonlocal seen
        blocked = anchor_depth > 0 or any(span_stack) or any(div_stack) or caption_depth > 0
        if blocked:
            out.append(text)
        else:
            out.append(_link_text(text, records, max(0, label_end - seen)))
        seen += len(text)

    for tag in _TAG_RE.finditer(html):
        text = html[pos:tag.start()]
        if text:
            emit(text)
        t = tag.group(0)
        tl = t.lower()
        if tl.startswith("<a ") or tl == "<a>":
            anchor_depth += 1
        elif tl.startswith("</a"):
            anchor_depth = max(0, anchor_depth - 1)
        elif tl.startswith("<span"):
            span_stack.append('class="xref"' in t)
        elif tl.startswith("</span"):
            if span_stack:
                span_stack.pop()
        elif tl.startswith("<div"):
            div_stack.append('class="doc-table-caption"' in t)
        elif tl.startswith("</div"):
            if div_stack:
                div_stack.pop()
        elif tl.startswith("<caption"):
            caption_depth += 1
        elif tl.startswith("</caption"):
            caption_depth = max(0, caption_depth - 1)
        out.append(t)
        pos = tag.end()
    tail = html[pos:]
    if tail:
        emit(tail)
    if not records:
        return html, []
    return "".join(out), records


def extract_method_citations(html: str) -> list[dict]:
    """The anchors already in stored HTML, as {"slug", "text"} records in
    document order -- what the apply step writes to provision_method_citations."""
    return [{"slug": m.group(1), "text": m.group(2)} for m in _ANCHOR_RE.finditer(html or "")]


def strip_method_anchors(html: str) -> str:
    """The HTML with every xref-method anchor replaced by its text (the
    regression proof's "differs only by xref-method anchors")."""
    return _ANCHOR_RE.sub(lambda m: m.group(2), html or "")


def count_method_anchors(html: str) -> int:
    return len(_ANCHOR_RE.findall(html or ""))


def summarize_method_links(rows: list[dict]) -> dict:
    """Counts for a parsed document: anchors in total, rows carrying at
    least one, and anchors per slug (what the import record reports)."""
    by_slug: dict[str, int] = {}
    rows_with_links = 0
    anchors = 0
    for r in rows:
        recs = extract_method_citations(r.get("full_text") or "")
        if not recs:
            continue
        rows_with_links += 1
        anchors += len(recs)
        for rec in recs:
            by_slug[rec["slug"]] = by_slug.get(rec["slug"], 0) + 1
    return {
        "enabled": _ENABLED,
        "rows_with_links": rows_with_links,
        "anchors": anchors,
        "by_slug": dict(sorted(by_slug.items(), key=lambda kv: (-kv[1], kv[0]))),
    }


def write_method_links_report(out_path: Path | str, rows: list[dict]) -> dict:
    """Writes <out stem>_method_links.json beside a parse's rows JSON (its
    own file, so the rows and report JSON the baselines compare are
    untouched) and returns the summary."""
    out_path = Path(out_path)
    summary = summarize_method_links(rows)
    report_path = out_path.with_name(out_path.stem + "_method_links.json")
    report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    return summary
