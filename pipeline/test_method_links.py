#!/usr/bin/env python3
"""Tests for pipeline/method_links.py (the EPA test-method citation linker)
and its wiring into import_ccr.py / import_ecfr.py.

  cd pipeline && python -m pytest test_method_links.py -q

The fixture-gated regression at the bottom parses real documents from
pipeline/sources/ twice, with the linker off and on, and proves (a) the
"on" parse differs from the "off" parse only by xref-method anchors and (b)
the "off" parse is byte-identical to a baseline when one is present. By
default it runs three documents (Regulation 1, Subpart OOOOb, Subpart JJJJ:
a CCR print, an eCFR print and an eCFR XML table); ER_FULL_CORPUS=1 runs
every document in pipeline/sources/ (about 20 minutes).
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import method_links as ml  # noqa: E402

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
A = '<a class="xref-method" href="/test-methods/%s">%s</a>'


def link(text: str, **kw):
    return ml.link_method_citations(text, **kw)


class SlugsFromTheDataFileTests(unittest.TestCase):
    def test_the_data_file_is_the_allowlist(self):
        self.assertEqual(ml.DATA_FILE.name, "test-methods.json")
        self.assertTrue(ml.DATA_FILE.exists(), ml.DATA_FILE)
        self.assertGreaterEqual(len(ml.SLUGS), 30)
        for s in ("method-21", "method-25a", "method-3c", "ps-8", "ps-9", "ps-2", "method-301", "method-320"):
            self.assertIn(s, ml.SLUGS)
        # Tier-2 methods the file does not carry never link.
        for s in ("method-7400", "method-310", "method-5g", "method-5h", "method-28", "method-28a", "ps-3", "ps-12"):
            self.assertNotIn(s, ml.SLUGS)

    def test_slug_for(self):
        self.assertEqual(ml.slug_for("method", "25A"), "method-25a")
        self.assertEqual(ml.slug_for("method", "21"), "method-21")
        self.assertEqual(ml.slug_for("ps", "8"), "ps-8")
        self.assertIsNone(ml.slug_for("method", "7400"))
        self.assertIsNone(ml.slug_for("ps", "12"))


# (input, expected output, expected slugs) -- every rule in the module docstring.
CASES = [
    # 1-4: the prefixes, display text kept exactly as printed
    ("Use Method 21 here.", "Use " + A % ("method-21", "Method 21") + " here.", ["method-21"]),
    ("per EPA Method 21 (August 3, 2017)", "per " + A % ("method-21", "EPA Method 21") + " (August 3, 2017)", ["method-21"]),
    ("by Reference Method 9,", "by " + A % ("method-9", "Reference Method 9") + ",", ["method-9"]),
    ("by Test Method 5 of", "by " + A % ("method-5", "Test Method 5") + " of", ["method-5"]),
    # 5-6: a letter suffix; the number must end there
    ("Method 25A tests", A % ("method-25a", "Method 25A") + " tests", ["method-25a"]),
    ("Method 21A is not a method", "Method 21A is not a method", []),
    # 7: Performance Specification
    ("under Performance Specification 8 or 9", "under " + A % ("ps-8", "Performance Specification 8") + " or 9", ["ps-8"]),
    # 8-11: anything not in the data file stays plain text
    ("NIOSH Method 7400", "NIOSH Method 7400", []),
    ("CARB Method 310", "CARB Method 310", []),
    ("Methods 5G, 5H, 28, and 28A", "Methods 5G, 5H, 28, and 28A", []),
    ("Performance Specification 12", "Performance Specification 12", []),
    # 12-16: lists -- each resolving number on its own
    ("Methods 1, 2, 3, and 4 apply",
     A % ("method-1", "Methods 1") + ", " + A % ("method-2", "2") + ", " + A % ("method-3", "3") + ", and " + A % ("method-4", "4") + " apply",
     ["method-1", "method-2", "method-3", "method-4"]),
    ("Methods 2A and 2D", A % ("method-2a", "Methods 2A") + " and " + A % ("method-2d", "2D"), ["method-2a", "method-2d"]),
    ("Method 3, 3A, or 3B of 40 CFR part 60",
     A % ("method-3", "Method 3") + ", " + A % ("method-3a", "3A") + ", or " + A % ("method-3b", "3B") + " of 40 CFR part 60",
     ["method-3", "method-3a", "method-3b"]),
    ("EPA Method 18, 25, or 25A", A % ("method-18", "EPA Method 18") + ", 25, or " + A % ("method-25a", "25A"), ["method-18", "method-25a"]),
    ("Test Method 5, 5B, 5D or 17", A % ("method-5", "Test Method 5") + ", 5B, 5D or 17", ["method-5"]),
    # 17-19: ranges -- first and last only, the words between untouched
    ("Methods 1 through 4 of appendix A", A % ("method-1", "Methods 1") + " through " + A % ("method-4", "4") + " of appendix A", ["method-1", "method-4"]),
    ("EPA Methods 1–4 and the front half", A % ("method-1", "EPA Methods 1") + "–" + A % ("method-4", "4") + " and the front half", ["method-1", "method-4"]),
    ("Methods 1-4", A % ("method-1", "Methods 1") + "-" + A % ("method-4", "4"), ["method-1", "method-4"]),
    # 20-21: a dash after the singular is a dated designation, not a range; a CFR citation ends a list
    ("Method 318-95", "Method 318-95", []),
    ("Method 22, 40 CFR part 60, appendix A", A % ("method-22", "Method 22") + ", 40 CFR part 60, appendix A", ["method-22"]),
    # 22-24: never inside an existing anchor, an xref span, or a table caption
    ('<a href="https://x">Method 21</a> and Method 22', '<a href="https://x">Method 21</a> and ' + A % ("method-22", "Method 22"), ["method-22"]),
    ('<span class="xref" data-target="sec-7-B-I-L-8">Section I.L.8. Method 21</span>, Method 21',
     '<span class="xref" data-target="sec-7-B-I-L-8">Section I.L.8. Method 21</span>, ' + A % ("method-21", "Method 21"), ["method-21"]),
    ('<div class="doc-table-wrap"><div class="doc-table-caption">Table 2 Method 21</div><table class="doc-table"><tbody><tr><td>Method 22</td></tr></tbody></table></div>',
     '<div class="doc-table-wrap"><div class="doc-table-caption">Table 2 Method 21</div><table class="doc-table"><tbody><tr><td>' + A % ("method-22", "Method 22") + '</td></tr></tbody></table></div>', ["method-22"]),
    ("<table><caption>Method 21 table</caption><tr><td>Method 21</td></tr></table>",
     "<table><caption>Method 21 table</caption><tr><td>" + A % ("method-21", "Method 21") + "</td></tr></table>", ["method-21"]),
    # 26-27: lower-case "method" and a bare number are not citations
    ("the method 21 approach and Method twenty-one", "the method 21 approach and Method twenty-one", []),
    ("Methods of compliance", "Methods of compliance", []),
    # 28: HTML-escaped text around it is untouched
    ("&lt;Method 21&gt; &amp; Method 22", "&lt;" + A % ("method-21", "Method 21") + "&gt; &amp; " + A % ("method-22", "Method 22"), ["method-21", "method-22"]),
]


class TableDrivenTests(unittest.TestCase):
    def test_every_case(self):
        self.assertGreaterEqual(len(CASES), 20)
        for text, expected, slugs in CASES:
            with self.subTest(text=text):
                out, records = link(text)
                self.assertEqual(out, expected)
                self.assertEqual([r["slug"] for r in records], slugs)

    def test_records_carry_the_printed_text(self):
        _, records = link("EPA Methods 1–4 and Method 25A")
        self.assertEqual(records, [
            {"slug": "method-1", "text": "EPA Methods 1"},
            {"slug": "method-4", "text": "4"},
            {"slug": "method-25a", "text": "Method 25A"},
        ])

    def test_unchanged_input_comes_back_as_the_same_object(self):
        text = "<p>Nothing to link here.</p>"
        out, records = link(text)
        self.assertIs(out, text)
        self.assertEqual(records, [])


class IdempotenceTests(unittest.TestCase):
    def test_linking_linked_text_changes_nothing(self):
        for text, _expected, _slugs in CASES:
            once, _ = link(text)
            twice, records = link(once)
            self.assertEqual(twice, once, text)
            self.assertEqual(records, [], text)

    def test_strip_then_relink_round_trips(self):
        for text, expected, _slugs in CASES:
            self.assertEqual(ml.strip_method_anchors(expected), text)
            relinked, _ = link(ml.strip_method_anchors(expected))
            self.assertEqual(relinked, expected)


class CitationLabelTests(unittest.TestCase):
    def test_the_rows_own_label_is_never_linked(self):
        # A heading row whose text opens with its label (import_ccr heading rows).
        out, records = link("I.D.3. Method 21 Monitoring per Method 21", skip_prefix="I.D.3. Method 21")
        self.assertEqual(out, "I.D.3. Method 21 Monitoring per " + A % ("method-21", "Method 21"))
        self.assertEqual([r["slug"] for r in records], ["method-21"])

    def test_a_label_the_text_does_not_open_with_skips_nothing(self):
        out, _ = link("<p>See Method 21.</p>", skip_prefix="I.D.3.")
        self.assertEqual(out, "<p>See " + A % ("method-21", "Method 21") + ".</p>")

    def test_label_counted_in_visible_text_across_tags(self):
        out, _ = link("<p>Method 21</p><p>Method 21</p>", skip_prefix="Method 21")
        self.assertEqual(out, "<p>Method 21</p><p>" + A % ("method-21", "Method 21") + "</p>")


class SwitchTests(unittest.TestCase):
    def test_disabled_returns_the_input_untouched(self):
        ml.set_enabled(False)
        try:
            text = "Method 21 and Methods 1 through 4"
            out, records = link(text)
            self.assertIs(out, text)
            self.assertEqual(records, [])
            self.assertFalse(ml.is_enabled())
        finally:
            ml.set_enabled(True)
        self.assertTrue(ml.is_enabled())


class ExtractionAndCountsTests(unittest.TestCase):
    def test_extract_reads_back_what_link_wrote(self):
        html, records = link("<p>Use Methods 1 through 4 and Method 25A.</p>")
        self.assertEqual(ml.extract_method_citations(html), records)
        self.assertEqual(ml.count_method_anchors(html), 3)
        self.assertEqual(ml.extract_method_citations("<p>no links</p>"), [])

    def test_summary_counts_rows_and_slugs(self):
        rows = [
            {"id": "a", "full_text": link("Method 21 and Method 21")[0]},
            {"id": "b", "full_text": link("Method 22")[0]},
            {"id": "c", "full_text": "<p>nothing</p>"},
        ]
        s = ml.summarize_method_links(rows)
        self.assertEqual((s["rows_with_links"], s["anchors"]), (2, 3))
        self.assertEqual(s["by_slug"], {"method-21": 2, "method-22": 1})
        self.assertTrue(s["enabled"])


# ---------------------------------------------------------------------------
# The real sentences
# ---------------------------------------------------------------------------

class RealSentenceTests(unittest.TestCase):
    """The parsed text of three corpus rows, as the importers hand it to the
    linker (escaped, with the cross-reference spans already in place)."""

    def test_reg1_sec_1_III_A_2(self):
        # sec-1-III-A-2 (Regulation 1, performance tests): a dash range and a prefixed single.
        text = ("<p>Performance Tests</p><p>Prior to granting of a final approval permit or amending a permit, "
                "when an emission source or control equipment is altered, or at any time when there is reason to "
                "believe that emission standards are being violated, the division may require the owner or operator "
                "of any fuel burning equipment to conduct performance tests, as measured by EPA Methods 1–4 and "
                "the front half of EPA Method 5 (40 CFR 60.275 (Aug. 25. 2023)), Appendix A, Part 60 (March 29, 2023), "
                "or other credible method approved by the division, to determine compliance with this subsection of "
                "this regulation. The particulate emission standards contained in this subsection do not include "
                "condensable particulate matter, or the back half emissions of EPA Method 5 (March 29, 2023).</p>")
        out, records = link(text)
        self.assertIn("as measured by " + A % ("method-1", "EPA Methods 1") + "–" + A % ("method-4", "4")
                      + " and the front half of " + A % ("method-5", "EPA Method 5") + " (40 CFR 60.275", out)
        self.assertIn("back half emissions of " + A % ("method-5", "EPA Method 5") + " (March 29, 2023).</p>", out)
        self.assertEqual([r["slug"] for r in records], ["method-1", "method-4", "method-5", "method-5"])
        self.assertEqual(ml.strip_method_anchors(out), text)

    def test_reg7_sec_7_B_I_B_3_beside_an_xref_span(self):
        # sec-7-B-I-B-3 (Regulation 7 Part B, "Approved Instrument Monitoring
        # Method"): the nearest Method 21 citation to sec-7-B-I-D-3-a-(i)'s
        # neighbourhood that carries a resolved xref span in the same sentence.
        text = ("<p>“Approved Instrument Monitoring Method” means an infra-red camera, EPA Method 21 "
                "(August 3, 2017), or other instrument based monitoring method or program approved in accordance "
                'with <span class="xref" data-target="sec-7-B-I-L-8">Section I.L.8.</span> If an owner or operator '
                "elects to use Division approved continuous emission monitoring, the Division may approve a "
                "streamlined inspection, recordkeeping, and reporting program.</p>")
        out, records = link(text)
        self.assertIn("an infra-red camera, " + A % ("method-21", "EPA Method 21") + " (August 3, 2017), or other", out)
        self.assertIn('<span class="xref" data-target="sec-7-B-I-L-8">Section I.L.8.</span>', out)
        self.assertEqual([r["slug"] for r in records], ["method-21"])
        # "Monitoring Method" (no number) is not a citation.
        self.assertIn("“Approved Instrument Monitoring Method” means", out)

    def test_jjjj_table_2_methods_25a_and_18(self):
        # The corpus prints "Methods 25A and 18" in Table 2 to Subpart JJJJ
        # (sec-jjjj-TABLE-2, an XML table cell), not in Subpart OOOOb: a
        # list inside a table cell, beside two singles and two non-entries.
        cell = ("<td>(5) Methods 25A and 18 of 40 CFR part 60, appendices A-6 and A-7, Method 25A with the use of "
                "a hydrocarbon cutter as described in 40 CFR 1065.265, Method 18 of 40 CFR part 60, appendix "
                "A-6,<sup>c e</sup> Method 320 of 40 CFR part 63, appendix A,<sup>e</sup> or ASTM Method D6348-03 "
                "<sup>d e</sup></td>")
        out, records = link(cell)
        self.assertTrue(out.startswith("<td>(5) " + A % ("method-25a", "Methods 25A") + " and " + A % ("method-18", "18")
                                       + " of 40 CFR part 60, appendices A-6 and A-7, " + A % ("method-25a", "Method 25A")))
        self.assertIn(A % ("method-18", "Method 18") + " of 40 CFR part 60, appendix A-6,<sup>c e</sup> "
                      + A % ("method-320", "Method 320") + " of 40 CFR part 63", out)
        self.assertIn("or ASTM Method D6348-03 <sup>d e</sup></td>", out)
        self.assertEqual([r["slug"] for r in records], ["method-25a", "method-18", "method-25a", "method-18", "method-320"])


# ---------------------------------------------------------------------------
# Wiring: the importers and the apply step
# ---------------------------------------------------------------------------

class ImporterWiringTests(unittest.TestCase):
    def test_ccr_paragraphs_link_after_the_xref_pass(self):
        import import_ccr as ic
        escaped = ic.escape_html_text("Use EPA Method 21 per Section I.L.8.")
        linked, _b = ic.link_citations(escaped, "7", {"sec-7-B-I-L-8"}, set(), own_part="B", own_id="sec-7-B-I-B-3")
        out, records = link(linked)
        self.assertIn(A % ("method-21", "EPA Method 21"), out)
        self.assertEqual([r["slug"] for r in records], ["method-21"])

    def test_method_citation_rows_one_per_provision_and_method(self):
        import import_ccr as ic
        rows = [
            {"id": "sec-7-B-I-B-3", "sort_order": 2, "full_text": link("EPA Method 21 and Method 21 and Method 22")[0]},
            {"id": "sec-7-B-I-A-1", "sort_order": 1, "full_text": "<p>none</p>"},
            {"id": "sec-7-B-I-C-1", "sort_order": 3, "full_text": link("Methods 1 through 4")[0]},
        ]
        self.assertEqual(ic.method_citation_rows(rows), [
            {"provision_id": "sec-7-B-I-B-3", "method_slug": "method-21", "raw_text": "EPA Method 21"},
            {"provision_id": "sec-7-B-I-B-3", "method_slug": "method-22", "raw_text": "Method 22"},
            {"provision_id": "sec-7-B-I-C-1", "method_slug": "method-1", "raw_text": "Methods 1"},
            {"provision_id": "sec-7-B-I-C-1", "method_slug": "method-4", "raw_text": "4"},
        ])

    def test_write_method_citation_rows_deletes_the_document_then_inserts(self):
        import import_ccr as ic

        class _Q:
            def __init__(self, calls, table, kind, payload=None):
                self.calls, self.table, self.kind, self.payload, self.filters = calls, table, kind, payload, []

            def like(self, col, val):
                self.filters.append(("like", col, val))
                return self

            def execute(self):
                self.calls.append((self.table, self.kind, self.payload, list(self.filters)))

        class _T:
            def __init__(self, calls, name):
                self.calls, self.name = calls, name

            def delete(self):
                return _Q(self.calls, self.name, "delete")

            def insert(self, payload):
                return _Q(self.calls, self.name, "insert", payload)

        class _C:
            def __init__(self):
                self.calls = []

            def table(self, name):
                return _T(self.calls, name)

        client = _C()
        rows = [{"id": f"sec-7-B-I-{i}", "sort_order": i, "full_text": link("Method 21")[0]} for i in range(3)]
        n = ic.write_method_citation_rows(client, "7", rows, chunk_size=2)
        self.assertEqual(n, 3)
        self.assertEqual(client.calls[0][:2], ("provision_method_citations", "delete"))
        self.assertEqual(client.calls[0][3], [("like", "provision_id", "sec-7-%")])
        self.assertEqual([c[1] for c in client.calls[1:]], ["insert", "insert"])
        self.assertEqual(len(client.calls[1][2]) + len(client.calls[2][2]), 3)

    def test_write_method_citation_rows_warns_when_the_table_is_missing(self):
        import import_ccr as ic

        class _C:
            def table(self, name):
                raise RuntimeError("relation \"provision_method_citations\" does not exist")

        self.assertIsNone(ic.write_method_citation_rows(_C(), "7", [{"id": "sec-7-B-I-1", "sort_order": 1, "full_text": link("Method 21")[0]}]))


# ---------------------------------------------------------------------------
# Regression: byte-identical with the linker off, anchors-only with it on
# ---------------------------------------------------------------------------

DEFAULT_REGRESSION_KEYS = ("1", "oooob", "jjjj")


def _source_pairs() -> list[tuple[str, str]]:
    """(reg key, source basename) for every document in pipeline/sources/."""
    names = sorted({p.stem for p in SOURCES.iterdir() if p.suffix in (".txt", ".pdf", ".xml")})
    pairs = []
    for name in names:
        key = name[4:].lower() if name.startswith("REG_") else name.lower()
        pairs.append((key, name))
    return pairs


def _parse(key: str, name: str) -> list[dict]:
    """The rows a `parse` of this document produces, the way cmd_parse does
    it (import_ecfr for the eCFR documents, import_ccr for the rest)."""
    import import_ccr as ic

    if key in ic.ECFR_REGS:
        import import_ecfr as ie

        if ie.SUBPART_META[key].get("document") == "part":
            rows, _report = ie.parse_ecfr_part(key, str(SOURCES / f"{name}.xml"))
        else:
            rows, _report = ie.parse_ecfr(key, str(SOURCES / f"{name}.pdf"), str(SOURCES / f"{name}.txt"))
        return rows
    result = ic.parse_reg(key, str(SOURCES / f"{name}.txt"), str(SOURCES / f"{name}.pdf"))
    return result[0]


def _dump(rows: list[dict]) -> str:
    return json.dumps(rows, ensure_ascii=False, indent=1)


class LinkerRegressionTests(unittest.TestCase):
    """For each document: parse with the linker OFF and ON. The ON rows with
    every xref-method anchor replaced by its text must equal the OFF rows
    byte for byte (the linker adds anchors and nothing else), and the OFF
    rows must equal out/<key>_parsed_baseline.json when that baseline is
    present (the parse is unchanged while the linker is off). Prints the
    counts the import record reports: rows changed per document, anchors
    per slug."""

    def _keys(self):
        pairs = _source_pairs()
        if os.environ.get("ER_FULL_CORPUS"):
            return pairs
        return [p for p in pairs if p[0] in DEFAULT_REGRESSION_KEYS]

    def test_off_is_a_no_op_and_on_adds_only_anchors(self):
        if not SOURCES.exists():
            self.skipTest("pipeline/sources not present")
        keys = self._keys()
        if not keys:
            self.skipTest("no regression sources present")
        totals: dict[str, int] = {}
        for key, name in keys:
            with self.subTest(reg=key):
                ml.set_enabled(False)
                try:
                    off = _parse(key, name)
                finally:
                    ml.set_enabled(True)
                on = _parse(key, name)
                self.assertEqual(len(on), len(off), f"{key}: row count differs")
                changed = 0
                for a, b in zip(on, off):
                    stripped = dict(a)
                    stripped["full_text"] = ml.strip_method_anchors(a["full_text"])
                    self.assertEqual(_dump([stripped]), _dump([b]), f"{key} {a['id']}: ON differs from OFF by more than anchors")
                    self.assertEqual(ml.count_method_anchors(b["full_text"]), 0, f"{key} {b['id']}: OFF output carries an anchor")
                    if a != b:
                        changed += 1
                summary = ml.summarize_method_links(on)
                if key == "jjjj":
                    # The performance-test table (an eCFR "appendix" row) links its cells.
                    table = next(r for r in on if r["id"] == "sec-jjjj-TABLE-2")
                    self.assertIn(A % ("method-25a", "Methods 25A") + " and " + A % ("method-18", "18"), table["full_text"])
                    self.assertNotIn('doc-table-caption">Table 2 to Subpart JJJJ of Part 60—Requirements for Performance Tests<a', table["full_text"])
                for slug, n in summary["by_slug"].items():
                    totals[slug] = totals.get(slug, 0) + n
                print(f"\n  {key}: {changed} row(s) changed, {summary['anchors']} anchor(s): {summary['by_slug']}")
                baseline = HERE / "out" / f"{key}_parsed_baseline.json"
                if baseline.exists():
                    self.assertEqual(_dump(off), baseline.read_text(encoding="utf-8"),
                                     f"{key}: parse with the linker OFF diverged from out/{key}_parsed_baseline.json")
        print(f"\n  anchors per method over {len(keys)} document(s): {dict(sorted(totals.items(), key=lambda kv: -kv[1]))}")


if __name__ == "__main__":
    unittest.main()
