#!/usr/bin/env python3
"""Tests for scripts/fetch_method_sections.py (sections 1.0-2.0 of each EPA
test method, verbatim from the eCFR versioner XML), on a synthetic appendix
shaped like the versioner's: no network.

  cd pipeline && python -m pytest test_fetch_method_sections.py -q
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

import fetch_method_sections as fms  # noqa: E402

FILLER = "The sampling train and procedures are described in the method. " * 4

APPENDIX = f"""<?xml version="1.0"?>
<DIV9 N="Appendix A-1 to Part 60" TYPE="APPENDIX">
<HEAD>Appendix A-1 to Part 60&#x2014;Test Methods 1 through 2F</HEAD>
<HD1>Method 1&#x2014;Sample and velocity traverses for stationary sources</HD1>
<HD1>1.0 Scope and Application</HD1>
<P>1.1 <E T="03">Measured Parameters.</E> The purpose of the method is to provide guidance. {FILLER}</P>
<P>1.2 <E T="03">Applicability.</E> This method is applicable to gas streams flowing in ducts, stacks, and flues.</P>
<HD1>2.0 Summary of Method</HD1>
<P>2.1 A measurement site where the effluent stream is flowing in a known direction is selected. {FILLER}</P>
<P>The area is computed using Equation 1-1:</P>
<img src="/graphics/ec01.000.gif"/>
<P>where A is the area, ft<SU>2</SU>, of CO<E T="52">2</E> at n<E T="51">&#x2212;0.2</E>.</P>
<DIV><TABLE><THEAD><TR><TH>Diameter</TH><TH>Points</TH></TR></THEAD><TBODY><TR><TD>0.30 to 0.61</TD><TD>8</TD></TR></TBODY></TABLE></DIV>
<HD1>3.0 Definitions [Reserved]</HD1>
<P>3.1 Not part of the span.</P>
<HD1>Method 1A&#x2014;Sample and velocity traverses for stationary sources with small stacks or ducts</HD1>
<HD1>1.0 Scope and Application</HD1>
<P>1.1 Method 1A text. {FILLER}</P>
<HD1>2.0 Summary of Method</HD1>
<P>2.1 Method 1A summary.</P>
<HD1>3.0 Definitions</HD1>
<HD1>Method 10&#x2014;Wrong appendix, but here to prove Method 1 never matches it</HD1>
<HD1>1.0 Scope</HD1>
<HD1>Method 2&#x2014;Determination of stack gas velocity and volumetric flow rate (Type S pitot tube)</HD1>
<HD1>1.0 Scope and Application</HD1>
<P>1.1 Method 2 scope. {FILLER}</P>
<HD1>2.0 Summary of Method</HD1>
<P>2.1 Method 2 summary.</P>
<P>3.5 A stray paragraph numbered 3.5 inside section 2.</P>
<HD1>3.0 Definitions</HD1>
<HD1>Method 2A&#x2014;Direct measurement of gas volume through pipes and small ducts</HD1>
<HD1>1.0 Scope and Application</HD1>
<P>1.1 Method 2A scope. {FILLER}</P>
<HD1>4.0 Interferences</HD1>
<HD1>Method 9&#x2014;Visual determination of the opacity of emissions from stationary sources</HD1>
<P>Many stationary sources discharge visible emissions into the atmosphere.</P>
<HD1>1. Principle and Applicability</HD1>
<P>1.1 Principle. The opacity of emissions from stationary sources is determined visually. {FILLER}</P>
<HD1>2. Procedure</HD1>
<P>2.1 Procedure. The observer qualified in accordance with section 3 of this method shall stand at a distance.</P>
<HD1>3. Qualifications and testing</HD1>
<HD1>Method 9A&#x2014;A method that opens with a table of contents</HD1>
<HD2>1.0 What is the purpose of Method 9A?</HD2>
<HD2>2.0 What approval must I have?</HD2>
<HD2>3.0 What does it include?</HD2>
<HD1>Using Method 9A</HD1>
<HD2>1.0 What is the purpose of Method 9A?</HD2>
<P>Method 9A provides a set of procedures. {FILLER}</P>
<HD2>2.0 What approval must I have?</HD2>
<P>If you want to use a candidate test method, you must get approval.</P>
<HD2>3.0 What does it include?</HD2>
</DIV9>
"""


def entry(slug: str, short: str, title: str) -> dict:
    return {
        "slug": slug, "shortName": short, "officialTitle": title, "titleVerified": False,
        "source": "40 CFR Part 60, Appendix A-1",
        "ecfrUrl": "https://www.ecfr.gov/current/title-40/part-60/appendix-Appendix%20A-1%20to%20Part%2060",
        "measures": "m", "principle": "p", "equipment": "e", "whenCited": "w",
        "relatedSlugs": [], "category": "stack-sampling",
    }


class FetchMethodSectionsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        d = Path(self.tmp.name)
        (d / "xml").mkdir()
        (d / "xml" / "Appendix_A_1_to_Part_60.xml").write_text(APPENDIX, encoding="utf-8")
        self.xml_dir = d / "xml"
        self.data = d / "methods.json"
        self.src = fms.AppendixSource("2026-10-09", self.xml_dir, None)

    def tearDown(self):
        self.tmp.cleanup()

    def test_method_1_is_sections_1_and_2_only(self):
        got = fms.extract(entry("method-1", "Method 1", "x"), self.src)
        html = got["officialText"]
        self.assertEqual(got["heading"], "Method 1—Sample and velocity traverses for stationary sources")
        self.assertTrue(html.startswith("<h3>1.0 Scope and Application</h3><p>1.1 <i>Measured Parameters.</i> The purpose"))
        self.assertIn("<h3>2.0 Summary of Method</h3>", html)
        self.assertNotIn("3.0", html)
        self.assertNotIn("Method 1A", html)
        self.assertIn("ft<sup>2</sup>, of CO<sub>2</sub> at n<sup>\u22120.2</sup>.", html)
        self.assertIn('<table class="doc-table">', html)
        self.assertIn('<p class="figure-omitted">Equation not reproduced here. See the official source: '
                      '<a href="https://www.ecfr.gov/current/title-40/part-60/appendix-Appendix%20A-1%20to%20Part%2060">'
                      '40 CFR Part 60, Appendix A-1, Method 1</a>.</p>', html)
        self.assertEqual(got["officialTextSource"], "40 CFR Part 60, Appendix A-1, Method 1, sections 1.0–2.0")

    def test_method_1a_is_its_own(self):
        got = fms.extract(entry("method-1a", "Method 1A", "x"), self.src)
        self.assertIn("Method 1A text.", got["officialText"])
        self.assertTrue(got["heading"].startswith("Method 1A—"))

    def test_a_block_numbered_3_inside_the_span_fails(self):
        with self.assertRaisesRegex(fms.Failure, "numbered 3.5"):
            fms.extract(entry("method-2", "Method 2", "x"), self.src)

    def test_missing_section_2_fails(self):
        with self.assertRaisesRegex(fms.Failure, "section 2.0 not found"):
            fms.extract(entry("method-2a", "Method 2A", "x"), self.src)

    def test_missing_heading_fails(self):
        with self.assertRaisesRegex(fms.Failure, "heading not found"):
            fms.extract(entry("method-2d", "Method 2D", "x"), self.src)

    def test_older_numbering_matches_on_the_number(self):
        got = fms.extract(entry("method-9", "Method 9", "x"), self.src)
        self.assertTrue(got["officialText"].startswith("<h3>1. Principle and Applicability</h3>"))
        self.assertNotIn("Many stationary sources", got["officialText"])
        self.assertNotIn("Qualifications", got["officialText"])
        self.assertTrue(got["officialTextSource"].endswith("sections 1–2"))

    def test_a_table_of_contents_is_skipped(self):
        got = fms.extract(entry("method-9a", "Method 9A", "x"), self.src)
        self.assertTrue(got["officialText"].startswith("<h4>1.0 What is the purpose of Method 9A?</h4><p>Method 9A provides"))
        self.assertIn("you must get approval.</p>", got["officialText"])
        self.assertNotIn("3.0", got["officialText"])

    def _write(self, entries):
        self.data.write_text(fms.dump(entries), encoding="utf-8")

    def test_main_writes_corrects_the_title_and_is_idempotent(self):
        self._write([entry("method-1", "Method 1", "Method 1—Sample And Velocity Traverses"),
                     entry("method-1a", "Method 1A", "y")])
        argv = ["--date", "2026-10-09", "--data", str(self.data), "--xml-dir", str(self.xml_dir)]
        self.assertEqual(fms.main(argv), 0)
        first = self.data.read_text(encoding="utf-8")
        out = json.loads(first)
        self.assertEqual(out[0]["officialTitle"], "Method 1—Sample and velocity traverses for stationary sources")
        self.assertIs(out[0]["titleVerified"], True)
        self.assertEqual(out[0]["officialTextRetrieved"], "2026-10-09")
        self.assertEqual(list(out[0])[-3:], ["officialText", "officialTextSource", "officialTextRetrieved"])
        self.assertEqual(fms.main(argv), 0)
        self.assertEqual(self.data.read_text(encoding="utf-8"), first)

    def test_main_fails_and_writes_nothing_when_one_method_fails(self):
        self._write([entry("method-1", "Method 1", "x"), entry("method-2a", "Method 2A", "x")])
        before = self.data.read_text(encoding="utf-8")
        self.assertEqual(fms.main(["--data", str(self.data), "--xml-dir", str(self.xml_dir)]), 1)
        self.assertEqual(self.data.read_text(encoding="utf-8"), before)

    def test_appendix_url(self):
        self.assertEqual(
            fms.appendix_url("2026-10-09", "60", "Appendix A-7 to Part 60"),
            "https://www.ecfr.gov/api/versioner/v1/full/2026-10-09/title-40.xml?part=60&appendix=Appendix%20A-7%20to%20Part%2060",
        )
        self.assertEqual(fms.appendix_name("40 CFR Part 63, Appendix A"), ("63", "Appendix A to Part 63"))


if __name__ == "__main__":
    unittest.main()
