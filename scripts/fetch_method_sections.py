#!/usr/bin/env python3
"""
Sections 1.0 and 2.0 of every EPA test method / performance specification in
src/data/test-methods.json, verbatim from the eCFR versioner XML.

Every method in 40 CFR Part 60 Appendices A-1 to A-8 and B and Part 63
Appendix A is written to one template, and its first two sections ("1.0
Scope and Application", "2.0 Summary of Method"; a performance specification
titles 2.0 "Summary of Performance Specification", Method 301 asks questions)
are what a compliance reader actually reads. This script puts them on each
entry so /test-methods/<slug> can show them, labelled as the method's own
words, above the EssentialRegs editorial copy.

For each entry it
  * fetches the appendix named by `source` from the versioner, one <date>
    for the whole run (today unless --date is given):
      /api/versioner/v1/full/<date>/title-40.xml?part=60&appendix=Appendix%20A-7%20to%20Part%2060
    falling back to the whole part (?part=60, fetched once) sliced to the
    appendix's <DIV9> if the appendix filter does not answer;
  * finds the method's heading ("Method 21—Determination of ...") anchored on
    the whole "<shortName><dash>" prefix, so "Method 2" never matches "Method
    2A" and "Method 1" never matches "Method 1A" or "Method 10";
  * takes everything from the heading numbered 1.0 up to (not including) the
    heading numbered 3.0, matching on the number, never on the title;
  * renders it with the importer's own XML -> HTML helpers
    (pipeline/import_ecfr.py: _part_inline_html, render_xml_table_html), one
    <p> per paragraph, <h3>/<h4> for the eCFR's HD1 / HD2+ headings, and the
    importer's visible "figure-omitted" placeholder, linked to the eCFR, at
    every equation or figure image (no text is ever invented for one);
  * writes officialText / officialTextSource / officialTextRetrieved, and
    corrects officialTitle to the heading actually printed (titleVerified
    true).

Official text: reproduced exactly. Nothing is paraphrased, reworded or
"cleaned up"; whitespace is collapsed exactly as the importer collapses it
for provision text. An element this script does not know how to render is a
hard failure, never a silent drop.

Hard failures (exit 1, every one listed): heading not found (or found more
than once); 1.0 or 2.0 not found; officialText under 200 or over 20,000
characters; a heading numbered 3.0 or higher inside the span.

Deterministic: the JSON is rewritten with a fixed key order and the file's
own formatting (2-space indent, UTF-8, trailing newline), so two runs on the
same eCFR date produce no diff.

    python scripts/fetch_method_sections.py                 # today, write the JSON
    python scripts/fetch_method_sections.py --date 2026-10-08
    python scripts/fetch_method_sections.py --xml-dir DIR   # read saved appendix XML, no network
    python scripts/fetch_method_sections.py --check         # extract and validate, write nothing

Run by .github/workflows/method-sections.yml (www.ecfr.gov is not reachable
from every environment this repo is worked on in).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from import_ecfr import (  # noqa: E402  (the importer's helpers; importing it has no side effects)
    _part_inline_html,
    _part_table_caption,
    _part_tables_in,
    _xml_text,
    escape_html_text,
    render_xml_table_html,
)

DATA_FILE = ROOT / "src" / "data" / "test-methods.json"
USER_AGENT = "EssentialRegsMethodSections/1.0 (+https://essentialregs.com; contact: brodykerr95@gmail.com)"
TIMEOUT_SECONDS = 120
VERSIONER = "https://www.ecfr.gov/api/versioner/v1/full/{date}/title-40.xml"

MIN_CHARS = 200
MAX_CHARS = 20_000

# The entry's key order. Keys the file grows later that are not listed here
# keep their place after these.
KEY_ORDER = [
    "slug", "shortName", "officialTitle", "titleVerified", "source", "ecfrUrl",
    "measures", "principle", "equipment", "whenCited", "readerNotes", "relatedSlugs", "category",
    "officialText", "officialTextSource", "officialTextRetrieved",
]

SOURCE_RE = re.compile(r"^40 CFR Part (?P<part>\d+), Appendix (?P<apx>[A-Z](?:-\d+)?)$")
DASHES = "—–-"
HEADING_TAG_RE = re.compile(r"^(?:HD\d*|HEAD)$")
# Any method or performance specification heading: where the previous one ends.
ANY_METHOD_HEADING_RE = re.compile(rf"^(?:(?:Test\s+)?Method\s+\d+[A-Z]*|Performance\s+Specification\s+\d+[A-Z]*)\s*[{DASHES}]")
# A numbered section heading: "1.0 Scope and Application", or the older
# "1. Principle and Applicability". "1.1 ..." is a sub-section, never this.
SECTION_HEAD_RE = re.compile(r"^(?P<n>\d+)\.(?P<zero>0)?(?=\s|$)")
# The same number on a <P>: "2.0 Summary of Method. A sample is ..." counts;
# "2. Procedure" counts only as a short title-only line.
P_SECTION_ZERO_RE = re.compile(r"^(?P<n>\d+)\.0\s")
P_SECTION_SHORT_RE = re.compile(r"^(?P<n>\d+)\.\s+[^.]{1,80}\.?$")
# Any numbered (sub-)section label at the head of a block: "3.1 ...", "4.0 ...".
ANY_NUMBERED_RE = re.compile(r"^(?P<n>\d+)\.\d*(?=\s|$)")

IMAGE_TAGS = {"img", "GPH", "MATH"}
PARAGRAPH_TAGS = {"P", "FP", "FP-1", "FP-2", "FP-DASH", "PSPACE"}
CONTAINER_TAGS = {"EXTRACT", "NOTE", "NOTES"}
SKIP_TAGS = {"PRTPAGE", "STARS"}
SENTINEL = ""


class Failure(Exception):
    pass


# --------------------------------------------------------------------------
# Fetching
# --------------------------------------------------------------------------


def appendix_name(source: str) -> tuple[str, str]:
    """("60", "Appendix A-7 to Part 60") from "40 CFR Part 60, Appendix A-7"."""
    m = SOURCE_RE.match(source)
    if not m:
        raise Failure(f"source {source!r} is not '40 CFR Part <n>, Appendix <X>'")
    return m.group("part"), f"Appendix {m.group('apx')} to Part {m.group('part')}"


def appendix_url(date: str, part: str, appendix: str | None = None) -> str:
    q = {"part": part}
    if appendix:
        q["appendix"] = appendix
    return VERSIONER.format(date=date) + "?" + urllib.parse.urlencode(q, quote_via=urllib.parse.quote)


def http_get(url: str) -> bytes:
    last: Exception | None = None
    for attempt in range(4):
        # The versioner's /full/ endpoint refuses (406) a request that does
        # not allow a compressed response.
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as r:
                data = r.read()
                if r.headers.get("Content-Encoding", "").lower() == "gzip":
                    data = gzip.decompress(data)
                return data
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429:
                raise
            last = e
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        time.sleep(2 ** (attempt + 1))
    raise last  # type: ignore[misc]


TITLES_URL = "https://www.ecfr.gov/api/versioner/v1/titles.json"


def resolve_date(requested: str) -> tuple[str, str]:
    """(the date to fetch, a note). The requested date (today by default) is
    used when the versioner serves it. The eCFR is published a day or two
    behind, so if the versioner refuses the date, the run falls back to Title
    40's `up_to_date_as_of`, whose text is the current text."""
    try:
        http_get(appendix_url(requested, "60", "Appendix B to Part 60"))
        return requested, ""
    except urllib.error.HTTPError as e:
        refused = e
    try:
        titles = json.loads(http_get(TITLES_URL))
        latest = next(t["up_to_date_as_of"] for t in titles["titles"] if t["number"] == 40)
    except Exception as e:  # noqa: BLE001
        return requested, f"the versioner refused {requested} ({refused}) and Title 40's up_to_date_as_of could not be read ({e})"
    return latest, f"the versioner refused {requested} ({refused}); Title 40 is up to date as of {latest}, so {latest} is used"


def find_appendix_div(root: ET.Element, appendix: str) -> ET.Element | None:
    if root.tag == "DIV9" and root.get("N") == appendix:
        return root
    for div in root.iter("DIV9"):
        if div.get("N") == appendix:
            return div
    return None


class AppendixSource:
    """Appendix <DIV9> elements, fetched once each (or read from --xml-dir)."""

    def __init__(self, date: str, xml_dir: Path | None, save_dir: Path | None):
        self.date = date
        self.xml_dir = xml_dir
        self.save_dir = save_dir
        self.cache: dict[str, ET.Element] = {}
        self.parts: dict[str, ET.Element] = {}
        self.part_errors: dict[str, Exception] = {}
        self.used_url: dict[str, str] = {}

    @staticmethod
    def _file_name(appendix: str) -> str:
        return re.sub(r"[^A-Za-z0-9]+", "_", appendix).strip("_") + ".xml"

    def _save(self, name: str, data: bytes) -> None:
        if self.save_dir:
            self.save_dir.mkdir(parents=True, exist_ok=True)
            (self.save_dir / name).write_bytes(data)

    def get(self, part: str, appendix: str) -> ET.Element:
        if appendix in self.cache:
            return self.cache[appendix]
        div = None
        if self.xml_dir is not None:
            path = self.xml_dir / self._file_name(appendix)
            if not path.exists():
                raise Failure(f"{path} not found (--xml-dir)")
            div = find_appendix_div(ET.fromstring(path.read_bytes()), appendix)
            self.used_url[appendix] = str(path)
        else:
            url = appendix_url(self.date, part, appendix)
            try:
                data = http_get(url)
                div = find_appendix_div(ET.fromstring(data), appendix)
                if div is not None:
                    self._save(self._file_name(appendix), data)
                    self.used_url[appendix] = url
                else:
                    print(f"note: {url} has no <DIV9 N={appendix!r}>; slicing the whole part instead", file=sys.stderr)
            except (urllib.error.HTTPError, ET.ParseError) as e:
                body = e.read()[:300].decode("utf-8", "replace") if isinstance(e, urllib.error.HTTPError) else ""
                print(f"note: {url} -> {e} {body}; slicing the whole part instead", file=sys.stderr)
            if div is None:
                if part in self.part_errors:
                    raise self.part_errors[part]
                if part not in self.parts:
                    purl = appendix_url(self.date, part)
                    try:
                        data = http_get(purl)
                    except urllib.error.URLError as e:
                        self.part_errors[part] = e
                        raise
                    self._save(f"part_{part}.xml", data)
                    self.parts[part] = ET.fromstring(data)
                div = find_appendix_div(self.parts[part], appendix)
                self.used_url[appendix] = appendix_url(self.date, part) + f" (sliced to {appendix})"
        if div is None:
            raise Failure(f"{appendix} not found in the eCFR XML of {self.date}")
        self.cache[appendix] = div
        return div


# --------------------------------------------------------------------------
# Locating a method and its sections 1.0-2.0
# --------------------------------------------------------------------------


def flatten_blocks(el: ET.Element) -> list[ET.Element]:
    """The appendix's block-level elements in document order. A <DIV> that
    holds a table is one block (a table); any other wrapper is descended
    into, so a heading nested one level down is still seen."""
    out: list[ET.Element] = []
    for child in el:
        tag = child.tag
        if tag == "DIV" and child.find(".//TABLE") is None:
            out.extend(flatten_blocks(child))
        elif tag.startswith("DIV") and tag != "DIV":
            out.extend(flatten_blocks(child))
        else:
            out.append(child)
    return out


def block_text(el: ET.Element) -> str:
    return _xml_text(el)


def is_heading(el: ET.Element) -> bool:
    return bool(HEADING_TAG_RE.match(el.tag))


def method_heading_re(short_name: str) -> re.Pattern:
    # The eCFR prints Part 63's "Test Method 320—..." with "Test" in front.
    words = r"\s+".join(re.escape(w) for w in short_name.split())
    test = r"(?:Test\s+)?" if short_name.startswith("Method ") else ""
    return re.compile(rf"^{test}{words}\s*[{DASHES}]")


def section_number(el: ET.Element) -> tuple[int, bool] | None:
    """(N, printed-as-"N.0") when the block is section N's heading."""
    txt = block_text(el)
    if is_heading(el):
        m = SECTION_HEAD_RE.match(txt)
        return (int(m.group("n")), bool(m.group("zero"))) if m else None
    if el.tag in PARAGRAPH_TAGS:
        m = P_SECTION_ZERO_RE.match(txt)
        if m:
            return int(m.group("n")), True
        m = P_SECTION_SHORT_RE.match(txt)
        if m:
            return int(m.group("n")), False
    return None


def locate(blocks: list[ET.Element], short_name: str) -> tuple[str, list[ET.Element], bool]:
    """(heading text, the blocks of sections 1 and 2, printed-as-"N.0")."""
    rx = method_heading_re(short_name)
    hits = [i for i, b in enumerate(blocks) if is_heading(b) and rx.match(block_text(b))]
    if not hits:
        raise Failure("heading not found")
    if len(hits) > 1:
        raise Failure(f"heading found {len(hits)} times: " + "; ".join(block_text(blocks[i])[:80] for i in hits))
    start = hits[0]
    heading = block_text(blocks[start])
    end = len(blocks)
    for j in range(start + 1, len(blocks)):
        if is_heading(blocks[j]) and ANY_METHOD_HEADING_RE.match(block_text(blocks[j])):
            end = j
            break
    body = blocks[start + 1 : end]
    numbered = [(i, section_number(b)) for i, b in enumerate(body)]
    numbered = [(i, n) for i, n in numbered if n is not None]
    nums = dict(numbered)
    ones = [i for i, n in numbered if n[0] == 1]
    if not ones:
        raise Failure("section 1.0 not found")
    span = None
    for one in ones:
        two = next((i for i, n in numbered if i > one), None)
        if two is None or nums[two][0] != 2:
            continue
        three = next((i for i, n in numbered if i > two), None)
        if three is not None and nums[three][0] != 3:
            raise Failure(f"the section after 2.0 is numbered {nums[three][0]}, not 3")
        candidate = body[one : three if three is not None else len(body)]
        # A method that opens with a table of contents (Method 301 prints its
        # section headings once as a list, then again with their text) has a
        # 1.0 / 2.0 / 3.0 run of bare headings first: skip it for the run
        # that carries text.
        if all(is_heading(b) for b in candidate):
            continue
        span = candidate
        break
    if span is None:
        raise Failure("section 2.0 not found (no 1.0 heading is followed by a 2.0 heading and text)")
    one = body.index(span[0])
    # Nothing numbered 3.x or higher may sit inside the span (a missed
    # boundary would otherwise pull section 3 onwards in silently).
    for b in span:
        m = ANY_NUMBERED_RE.match(block_text(b))
        if m and int(m.group("n")) >= 3 and (is_heading(b) or b.tag in PARAGRAPH_TAGS):
            raise Failure(f"span contains a block numbered {m.group(0)}: {block_text(b)[:80]!r}")
    zero = nums[one][1]
    return heading, span, zero


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------


def placeholder(kind: str, url: str, label: str) -> str:
    """The importer's visible note at an image (import_ecfr.insert_ecfr_image_notes)."""
    return (f'<p class="figure-omitted">{kind} not reproduced here. See the official source: '
            f'<a href="{escape_html_text(url)}">{escape_html_text(label)}</a>.</p>')


def render_paragraph(el: ET.Element, url: str, label: str) -> str:
    inline_images = [d for d in el.iter() if d is not el and d.tag in IMAGE_TAGS]
    if not inline_images:
        html = _part_inline_html(el)
        return f"<p>{html}</p>" if html else ""
    # An image inside a paragraph: mark its position, render, then split the
    # paragraph there so the note sits exactly where the image does.
    saved = []
    for d in inline_images:
        saved.append((d, d.text, list(d)))
        for c in list(d):
            d.remove(c)
        d.text = SENTINEL
    try:
        html = _part_inline_html(el)
    finally:
        for d, text, kids in saved:
            d.text = text
            d.extend(kids)
    out = []
    pieces = html.split(SENTINEL)
    for k, piece in enumerate(pieces):
        piece = piece.strip()
        if piece:
            out.append(f"<p>{piece}</p>")
        if k < len(pieces) - 1:
            out.append(placeholder("Symbol" if pieces[k + 1].strip()[:1].islower() else "Equation", url, label))
    return "".join(out)


def render_blocks(blocks: list[ET.Element], url: str, label: str, unknown: list[str]) -> str:
    out: list[str] = []
    for i, el in enumerate(blocks):
        tag = el.tag
        if tag in SKIP_TAGS:
            continue
        if is_heading(el):
            html = _part_inline_html(el)
            if html:
                h = "h3" if tag in ("HD1", "HEAD") else "h4"
                out.append(f"<{h}>{html}</{h}>")
        elif tag in PARAGRAPH_TAGS:
            out.append(render_paragraph(el, url, label))
        elif tag in CONTAINER_TAGS:
            out.append(render_blocks(list(el), url, label, unknown))
        elif tag == "HED":
            html = _part_inline_html(el)
            if html:
                out.append(f"<p><b>{html}</b></p>")
        elif tag in ("DIV", "TABLE", "GPOTABLE"):
            tables = [el] if tag == "TABLE" else _part_tables_in(el)
            if not tables:
                unknown.append(f"<{tag}> without a <TABLE>")
            for t in tables:
                out.append(render_xml_table_html(_part_table_caption(t), None, [t], emphasis=True))
        elif tag in IMAGE_TAGS:
            nxt = blocks[i + 1] if i + 1 < len(blocks) else None
            kind = "Figure" if nxt is not None and nxt.tag == "BCAP" else "Equation"
            out.append(placeholder(kind, url, label))
        elif tag == "BCAP":
            html = _part_inline_html(el)
            if html:
                out.append(f"<p>{html}</p>")
        else:
            unknown.append(f"<{tag}> {block_text(el)[:60]!r}")
    return "".join(out)


def extract(entry: dict, src: AppendixSource) -> dict:
    part, appendix = appendix_name(entry["source"])
    div = src.get(part, appendix)
    heading, span, zero = locate(flatten_blocks(div), entry["shortName"])
    label = f"{entry['source']}, {entry['shortName']}"
    unknown: list[str] = []
    html = render_blocks(span, entry["ecfrUrl"], label, unknown)
    if unknown:
        raise Failure("element(s) this script does not render: " + "; ".join(unknown))
    if len(html) < MIN_CHARS:
        raise Failure(f"officialText is {len(html)} characters (< {MIN_CHARS})")
    if len(html) > MAX_CHARS:
        raise Failure(f"officialText is {len(html)} characters (> {MAX_CHARS})")
    sections = "sections 1.0–2.0" if zero else "sections 1–2"
    return {
        "heading": heading,
        "officialText": html,
        "officialTextSource": f"{label}, {sections}",
        "chars": len(html),
        "url": src.used_url.get(appendix, ""),
    }


def headings_outline(src: AppendixSource, entry: dict, limit: int = 40) -> list[str]:
    """Diagnostics for a failure: the first blocks of the method's own
    region (its heading to the next method's), tag and opening words."""
    try:
        part, appendix = appendix_name(entry["source"])
        blocks = flatten_blocks(src.get(part, appendix))
    except Exception:  # noqa: BLE001
        return []
    rx = method_heading_re(entry["shortName"])
    starts = [i for i, b in enumerate(blocks) if is_heading(b) and rx.match(block_text(b))]
    if not starts:
        near = [block_text(b)[:70] for b in blocks if is_heading(b) and entry["shortName"].split()[-1] in block_text(b)[:40]]
        return [f"    heading-like blocks naming {entry['shortName'].split()[-1]}: {near[:8]}"]
    lines = []
    for b in blocks[starts[0] : starts[0] + limit]:
        if lines and is_heading(b) and ANY_METHOD_HEADING_RE.match(block_text(b)):
            break
        lines.append(f"    <{b.tag}> {block_text(b)[:70]}")
    return lines


# --------------------------------------------------------------------------
# Writing
# --------------------------------------------------------------------------


def ordered(entry: dict) -> dict:
    out = {k: entry[k] for k in KEY_ORDER if k in entry}
    out.update({k: v for k, v in entry.items() if k not in out})
    return out


def dump(entries: list[dict]) -> str:
    return json.dumps(entries, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=_dt.date.today().isoformat(), help="eCFR date (YYYY-MM-DD); default today")
    ap.add_argument("--data", type=Path, default=DATA_FILE)
    ap.add_argument("--xml-dir", type=Path, help="read <Appendix_X_to_Part_N>.xml from here instead of fetching")
    ap.add_argument("--save-xml", type=Path, help="save every fetched XML document here")
    ap.add_argument("--report", type=Path, help="also write the markdown report here")
    ap.add_argument("--check", action="store_true", help="extract and validate only; do not write the JSON")
    args = ap.parse_args(argv)
    _dt.date.fromisoformat(args.date)
    date_note = ""
    if args.xml_dir is None:
        args.date, date_note = resolve_date(args.date)
        print(f"eCFR date: {args.date} {date_note}".rstrip(), file=sys.stderr)

    entries = json.loads(args.data.read_text(encoding="utf-8"))
    src = AppendixSource(args.date, args.xml_dir, args.save_xml)
    failures: list[str] = []
    outlines: list[str] = []
    rows: list[tuple[str, str, int]] = []
    titles: list[str] = []
    updated: list[dict] = []
    for entry in entries:
        try:
            got = extract(entry, src)
        except (Failure, urllib.error.URLError, ET.ParseError) as e:
            failures.append(f"{entry['slug']} ({entry['shortName']}, {entry['source']}): {e}")
            if isinstance(e, Failure):
                outlines.append(f"{entry['slug']}:")
                outlines.extend(headings_outline(src, entry))
            updated.append(entry)
            continue
        new = dict(entry)
        if re.sub(r"\s+", " ", entry["officialTitle"]).strip() != got["heading"]:
            titles.append(f"{entry['slug']}: {entry['officialTitle']!r} -> {got['heading']!r}")
            new["officialTitle"] = got["heading"]
            new["titleVerified"] = True
        new["officialText"] = got["officialText"]
        new["officialTextSource"] = got["officialTextSource"]
        new["officialTextRetrieved"] = args.date
        updated.append(ordered(new))
        rows.append((entry["slug"], got["heading"], got["chars"]))

    report = [f"eCFR date: {args.date}"] + ([f"({date_note})"] if date_note else []) + [""]
    report += ["Appendix XML used:"] + [f"- {a}: {u}" for a, u in sorted(src.used_url.items())] + [""]
    report += ["| slug | heading found | characters of official text |", "|---|---|---|"]
    report += [f"| {s} | {h} | {c:,} |" for s, h, c in rows]
    report += ["", f"officialTitle corrected: {len(titles)}"] + [f"- {t}" for t in titles]
    if failures:
        report += ["", f"FAILURES ({len(failures)}):"] + failures + ["", "Outline of each failed method:"] + outlines
    text = "\n".join(report) + "\n"
    print(text)
    if args.report:
        args.report.write_text(text, encoding="utf-8")
    if failures:
        print("Nothing written: every method must pass.", file=sys.stderr)
        return 1
    if not args.check:
        out = dump(updated)
        if out != args.data.read_text(encoding="utf-8"):
            args.data.write_text(out, encoding="utf-8")
            print(f"wrote {args.data.relative_to(ROOT) if args.data.is_relative_to(ROOT) else args.data}")
        else:
            print("no change")
    return 0


if __name__ == "__main__":
    sys.exit(main())
