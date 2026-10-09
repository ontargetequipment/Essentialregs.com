"""Sprint 3 (Oct 2026): EssentialRegs notes inside official text and the
text-artifact guards -- curated equation transcriptions, [sic] markers,
split-letter spacing fixes, table subscript repair, and the source-text
check. Unit tests on synthetic rows first; the real general permits are
parsed once per module (slow, a few seconds each) for the end-to-end
assertions the reviewer's regression table names."""
from __future__ import annotations

import json
import os
import re
import unittest
from functools import lru_cache
from pathlib import Path

import import_ccr as ic
import import_ecfr as ie
import source_text_check as stc

SOURCES = Path(__file__).resolve().parent / "sources"
GLYPH_LINE = "                 \U0001D438\U0001D438\U0001D438\U0001D438 �\U0001D466\U0001D466� = 2000 \U0001D459\U0001D459"


def _have(reg: str) -> bool:
    base = reg.upper()
    return (SOURCES / f"{base}.txt").exists() and (SOURCES / f"{base}.pdf").exists()


@lru_cache(maxsize=None)
def _parse(reg: str):
    base = reg.upper()
    return ic.parse_reg(reg, str(SOURCES / f"{base}.txt"), str(SOURCES / f"{base}.pdf"))


class CuratedFilesTests(unittest.TestCase):
    def test_equations_file_shape(self):
        eqs = ic.CURATED_EQUATIONS
        gp = {pid for pid in eqs if pid.startswith("sec-gp")}
        self.assertEqual(gp, {"sec-gp12-III-F-3", "sec-gp12-IV-A-6-b",
                              "sec-gp06-IV-C-1-b-(i)", "sec-gp06-IV-C-1-b-(ii)"})
        # eCFR entries (import_ecfr.insert_ecfr_image_notes): OOOO's nine
        # equation images, each linking its official paragraph.
        ecfr = {pid for pid in eqs if not pid.startswith("sec-gp")}
        self.assertEqual(ecfr, {
            "sec-oooo-60.5406-(b)-(1)", "sec-oooo-60.5406-(c)-(1)", "sec-oooo-60.5406-(c)-(3)",
            "sec-oooo-60.5407-(e)", "sec-oooo-60.5413-(b)-(3)-(ii)-(A)", "sec-oooo-60.5413-(b)-(3)-(iii)",
            "sec-oooo-60.5413-(b)-(4)-(ii)", "sec-oooo-60.5413-(b)-(4)-(iii)-(B)", "sec-oooo-60.5413-(d)-(9)-(vi)"})
        n = 0
        for pid, entry in eqs.items():
            self.assertIsInstance(entry["page"], int)
            if pid in ecfr:
                self.assertEqual(entry["source"], "OOOO.pdf", pid)
                self.assertTrue(entry["url"].startswith("https://www.ecfr.gov/current/title-40/") and "#p-60." in entry["url"], pid)
                self.assertIn("image", entry["reason"], pid)
            for e in entry["equations"]:
                n += 1
                self.assertTrue(e["html"] and e["text"], pid)
                self.assertNotIn("<script", e["html"])
                # the display markup and the plain text agree on letters and digits
                # (the [sic] markers inside the markup are notes, not formula)
                html_ld = ic._letters_digits(re.sub(r"<[^>]+>", "", ic._SIC_SPAN_RE.sub("", e["html"])))
                self.assertEqual(html_ld, ic._letters_digits(e["text"].replace("^", "")), e["label"] or pid)
        self.assertEqual(n, 12 + 10)

    def test_sic_file_shape(self):
        for pid, entries in ic.CURATED_SIC.items():
            self.assertTrue(pid.startswith(("sec-gp", "sec-oooo-", "sec-ooooa-")), pid)
            for e in entries:
                self.assertTrue(e["printed"] and e["reason"], pid)
                if pid == "sec-oooo-60.5371-(b)-(3)":
                    # the eCFR's garbled attestation sentence, noted as published
                    self.assertEqual(e["tooltip"], "Reproduced as published in eCFR.")
                elif pid.startswith("sec-oooo"):
                    # the EPA e-mail address the eCFR prints with doubled underscores
                    self.assertRegex(e["printed"], r"^Oil_{2,}and_{2,}Gas_{2,}PT@EPA\.GOV$")
                    self.assertIn("Oil_and_Gas_PT@EPA.GOV", e["tooltip"])

    def test_loaders_tolerate_a_missing_file(self):
        self.assertEqual(ic.load_curated_equations("/nonexistent/equations.json"), {})
        self.assertEqual(ic.load_curated_sic("/nonexistent/sic.json"), {})


class EquationSwapTests(unittest.TestCase):
    def setUp(self):
        ic.EQUATION_EVENTS.clear()

    def test_curated_row_gets_one_sentinel_and_keeps_non_glyph_lines(self):
        pid = "sec-gp12-III-F-3"
        lines = ["   text before", "", GLYPH_LINE, "   plain line inside", GLYPH_LINE, "", "   text after"]
        out = ic._swap_equation_lines(lines, pid)
        self.assertEqual(out, ["   text before", "", "", ic._EQUATION_SENTINEL + pid, "",
                               "   plain line inside", "", "   text after"])
        self.assertEqual(ic.EQUATION_EVENTS, [dict(row_id=pid, kind="curated", glyph_lines=2,
                                                   kept_inside=["plain line inside"])])

    def test_uncurated_row_is_left_alone_and_reported(self):
        lines = ["   text", GLYPH_LINE]
        self.assertIs(ic._swap_equation_lines(lines, "sec-gp12-IX-Z"), lines)
        self.assertEqual(ic.EQUATION_EVENTS[0]["kind"], "uncurated")
        fixes, anomalies = ic.equation_report_rows("gp12")
        self.assertEqual([a["label"] for a in anomalies], ["sec-gp12-IX-Z"])
        # every curated gp12 entry that saw no glyph line reports 0 hits
        self.assertEqual({f["line_hint"]: f["hits"] for f in fixes},
                         {"sec-gp12-III-F-3": 0, "sec-gp12-IV-A-6-b": 0})

    def test_row_without_glyphs_is_untouched(self):
        lines = ["   just text", ""]
        self.assertIs(ic._swap_equation_lines(lines, "sec-gp12-III-F-3"), lines)
        self.assertEqual(ic.EQUATION_EVENTS, [])

    def test_rendered_block_shape(self):
        html = ic.render_equations_html("sec-gp06-IV-C-1-b-(i)")
        self.assertTrue(html.startswith('<div class="equation-block"><p class="er-note eq-note">'))
        self.assertEqual(html.count('<figure class="equation">'), 5)
        self.assertEqual(html.count('<pre class="eq-text">'), 5)
        self.assertIn("page 20 of GP06.pdf", html)
        self.assertIn('<span class="eq-label">Eq. 1.a.</span>', html)
        self.assertFalse(ic.MATH_GLYPH_RE.search(html))


class SicMarkerTests(unittest.TestCase):
    def test_marker_is_added_after_the_printed_string_and_counted(self):
        rows = [dict(id="sec-gp12-IV-A-6-b-(i)", full_text="<p>BSFC is the Break Specific Fuel Consumption at 100%</p>")]
        applied = ic.apply_sic_markers("gp12", rows)
        self.assertIn("Break Specific Fuel Consumption" + ic.SIC_MARKER_HTML + " at 100%", rows[0]["full_text"])
        by = {a["line_hint"]: a for a in applied}
        self.assertEqual(by["sec-gp12-IV-A-6-b-(i)"]["hits"], 1)
        # the other gp12 entries matched no row here: reported with 0 hits, never raised
        self.assertEqual(by["sec-gp12-VII-C-1"]["hits"], 0)

    def test_marker_is_markup_for_the_diff_and_the_apply_plan(self):
        plain = "<p>at a the same stationary source</p>"
        marked = "<p>at a the same stationary source" + ic.SIC_MARKER_HTML + "</p>"
        self.assertEqual(ic._visible_text(plain), ic._visible_text(marked))
        self.assertEqual(ic._norm_for_compare(plain), ic._norm_for_compare(marked))
        c = ic.classify_apply([dict(id="x", full_text=marked)], [dict(id="x", full_text=plain)])
        self.assertEqual(c["changed"], ["x"])
        self.assertTrue(c["markup_only"]["x"])


class TextArtifactTests(unittest.TestCase):
    def test_each_artifact_kind_is_found(self):
        rows = [
            dict(id="a", full_text="<p>Emissions \U0001D438\U0001D438 ( ) =</p>"),
            dict(id="b", full_text="<p>the o w n e r o r o p e r a t o r must</p>"),
            dict(id="c", full_text="<p>**Plain-language summary:** text</p>"),
            dict(id="d", full_text="<p>limit `5 tpy` here</p>"),
            dict(id="e", full_text="<p># Heading</p>"),
        ]
        kinds = {(a["label"], a["kind"]) for a in ic.text_artifacts(rows)}
        self.assertEqual(kinds, {("a", "math_glyph"), ("b", "split_letters"), ("c", "stray_markdown"),
                                 ("d", "stray_markdown"), ("e", "stray_markdown")})

    def test_official_text_that_looks_like_markdown_is_not_flagged(self):
        rows = [
            dict(id="f", full_text="<p>0.75** 0.80 1.05* Maximum</p>"),                 # footnote stars (Reg 1)
            dict(id="g", full_text="<p>email to Oil__and__Gas__PT@EPA.GOV unless</p>"),  # an address (OOOOa)
            dict(id="h", full_text="<p>the `Presumptive' RACT coating</p>"),            # eCFR quoting
            dict(id="i", full_text="<p>Minimum # of samples to clear</p>"),              # "# of"
            dict(id="j", full_text="<p>E i = K</p>"),                                   # three letters: not a run
        ]
        self.assertEqual(ic.text_artifacts(rows), [])

    def test_essentialregs_notes_do_not_report_themselves(self):
        rows = [dict(id="k", full_text="<p>x</p>" + ic.render_equations_html("sec-gp12-III-F-3")
                     + "<p>Break" + ic.SIC_MARKER_HTML + "</p>")]
        self.assertEqual(ic.text_artifacts(rows), [])


class SpacingFixTests(unittest.TestCase):
    def test_every_entry_only_moves_whitespace(self):
        for reg, fixes in ic.KNOWN_SPACING_FIXES.items():
            for f in fixes:
                self.assertTrue(f.get("spacing_only"), (reg, f["old"]))
                self.assertEqual(ic._letters_digits(f["old"]), ic._letters_digits(f["new"]), (reg, f["old"]))
                self.assertFalse(ic.SPLIT_LETTER_RE.search(f["new"]), (reg, f["new"]))

    def test_a_letter_changing_entry_is_refused(self):
        saved = ic.KNOWN_SPACING_FIXES.get("zz")
        ic.KNOWN_SPACING_FIXES["zz"] = [dict(old="t h e", new="tha", line_hint=1, spacing_only=True, note="bad")]
        try:
            with self.assertRaises(ValueError):
                ic.apply_known_text_fixes("zz", ["t h e line"])
        finally:
            if saved is None:
                del ic.KNOWN_SPACING_FIXES["zz"]
            else:
                ic.KNOWN_SPACING_FIXES["zz"] = saved

    def test_hits_are_counted_against_expect_hits(self):
        lines = ["The o w n e r o r o p e r a t o r must", "", "the o w n e r o r", "o p e r a t o r may"]
        out, applied = ic.apply_known_text_fixes("gp01", lines)
        self.assertEqual(out[0], "The owner or operator must")
        self.assertEqual(out[2:], ["the owner or", "operator may"])
        by = {a["old_label"]: a for a in applied}
        self.assertEqual((by["o w n e r o r o p e r a t o r"]["hits"], by["o w n e r o r o p e r a t o r"]["expect_hits"]), (1, 4))
        self.assertEqual(by["the o w n e r o r"]["hits"], 1)


class TableScriptRepairTests(unittest.TestCase):
    def test_markers_render_as_sub_and_sup(self):
        html = ic.render_table_html(dict(caption="T", rows=[["NO\x01X\x02 (g/hp-hr)", "m\x033\x04"], ["1", "2"]]))
        self.assertIn("<th>NO<sub>X</sub> (g/hp-hr)</th><th>m<sup>3</sup></th>", html)

    def test_cell_text_is_rejoined_on_gp12_page_89(self):
        if not _have("gp12"):
            self.skipTest("GP12 sources not present")
        import pdfplumber
        with pdfplumber.open(str(SOURCES / "GP12.pdf")) as pdf:
            page = pdf.pages[88]
            ic.TABLE_CELL_REPAIRS.clear()
            rows = ic._page_tables(page, "gp12")
            self.assertEqual(rows[0][0][2], "NO\x01X\x02 (g/hp-hr)")
            self.assertEqual([r["before"] for r in ic.TABLE_CELL_REPAIRS], ["NO (g/hp-hr)\nX"])
            # other regs read the page exactly as pdfplumber does
            self.assertEqual(ic._page_tables(page, "23")[0][0][2], "NO (g/hp-hr)\nX")


class EcfrHtmlFixTests(unittest.TestCase):
    def test_ooooa_equation_subscripts(self):
        rows = [dict(id="sec-ooooa-60.5413a-(b)-(3)-(i)",
                     full_text="<p>You must compute</p><p>E i = K 2C i M p Q i</p><p>E o = K 2C o M p Q o Where:</p><p>Ei, Eo = x</p>")]
        applied = ie.apply_known_html_fixes("ooooa", rows)
        self.assertEqual([a["hits"] for a in applied], [1])
        self.assertIn("<p>E<sub>i</sub> = K<sub>2</sub>C<sub>i</sub>M<sub>p</sub>Q<sub>i</sub></p>", rows[0]["full_text"])
        self.assertIn("<p>Where:</p>", rows[0]["full_text"])
        self.assertEqual(ic.text_artifacts(rows), [])

    def test_a_letter_changing_entry_is_refused(self):
        ie.KNOWN_HTML_FIXES["zz"] = [dict(id="r", old="<p>a b</p>", new="<p>a c</p>", note="bad")]
        try:
            with self.assertRaises(ValueError):
                ie.apply_known_html_fixes("zz", [dict(id="r", full_text="<p>a b</p>")])
        finally:
            del ie.KNOWN_HTML_FIXES["zz"]


class RealGeneralPermitTests(unittest.TestCase):
    """End to end on the committed sources (the regression table's pass
    conditions). Skips when a source file is absent."""

    def _rows(self, reg):
        if not _have(reg):
            self.skipTest(f"{reg} sources not present")
        result = _parse(reg)
        return result[0], result[5], result[6]

    def test_gp12_equations_render_and_no_glyph_remains(self):
        rows, fixes, anomalies = self._rows("gp12")
        by = {r["id"]: r for r in rows}
        for pid in ("sec-gp12-III-F-3", "sec-gp12-IV-A-6-b"):
            self.assertIn('<figure class="equation">', by[pid]["full_text"], pid)
            self.assertIn('<pre class="eq-text">', by[pid]["full_text"], pid)
        self.assertIn("Fuel Consumption_engine (MMSCF/month) =", by["sec-gp12-IV-A-6-b"]["full_text"])
        self.assertEqual(ic.text_artifacts(rows), [])
        self.assertEqual([a for a in anomalies if a.get("kind")], [])
        eq = {f["line_hint"]: f["hits"] for f in fixes if "curated" in f["new_label"]}
        self.assertEqual(eq, {"sec-gp12-III-F-3": 1, "sec-gp12-IV-A-6-b": 1})

    def test_gp06_ten_equations(self):
        rows, fixes, _ = self._rows("gp06")
        by = {r["id"]: r for r in rows}
        self.assertEqual(by["sec-gp06-IV-C-1-b-(i)"]["full_text"].count('<figure class="equation">'), 5)
        self.assertEqual(by["sec-gp06-IV-C-1-b-(ii)"]["full_text"].count('<figure class="equation">'), 5)
        # the intro sentence of (ii) is still there, in front of the block
        self.assertTrue(by["sec-gp06-IV-C-1-b-(ii)"]["full_text"].startswith(
            "<p>Emission estimates based upon fuel consumption must be calculated using either Eq. 2 with the appropriate emission factor:</p><div class=\"equation-block\">"))
        self.assertEqual(ic.text_artifacts(rows), [])

    def test_gp12_nox_header_reads_nox_with_no_stray_x(self):
        rows, fixes, _ = self._rows("gp12")
        by = {r["id"]: r for r in rows}
        self.assertIn("<th>NO<sub>X</sub> (g/hp-hr)</th>", by["sec-gp12-ATTACHMENT-A-7-3-1"]["full_text"])
        self.assertNotIn("(g/hp-hr) X", by["sec-gp12-ATTACHMENT-A-7-3-1"]["full_text"])
        self.assertEqual([f["line_hint"] for f in fixes if f["note"].startswith("table cell")], ["PDF page 89"])

    def test_gp02_attachment_table_is_present(self):
        rows, fixes, _ = self._rows("gp02")
        by = {r["id"]: r for r in rows}
        text = by["sec-gp02-ATTACHMENT-A-5-3"]["full_text"]
        self.assertIn("<th>NO<sub>X</sub> (g/hp-hr)</th>", text)
        self.assertIn("<td>July 1, 2010</td>", text)
        self.assertIn("<p>For specific rule requirements, see:</p>", text)

    def test_sic_markers_land_once_each(self):
        for reg in ("gp01", "gp02", "gp12"):
            rows, fixes, _ = self._rows(reg)
            for f in fixes:
                if "[sic] marker" in f["note"]:
                    self.assertEqual(f["hits"], f["expect_hits"], (reg, f["old_label"]))
        by = {r["id"]: r for r in _parse("gp12")[0]}
        self.assertIn("Break Specific Fuel Consumption" + ic.SIC_MARKER_HTML, by["sec-gp12-IV-A-6-b-(i)"]["full_text"])

    def test_split_letter_runs_are_gone_from_every_general_permit(self):
        for reg in ic.GP_KEYS:
            if not _have(reg):
                continue
            rows, fixes, anomalies = self._rows(reg)
            self.assertEqual([a for a in ic.text_artifacts(rows) if a["kind"] == "split_letters"], [], reg)
            for f in fixes:
                if f.get("old_label") in {x["old"] for x in ic.KNOWN_SPACING_FIXES.get(reg, [])}:
                    self.assertEqual(f["hits"], f["expect_hits"], (reg, f["old_label"]))

    def test_source_text_check_has_no_unknown_difference(self):
        for reg in ic.GP_KEYS:
            if not _have(reg):
                continue
            rows = _parse(reg)[0]
            res = stc.compare(reg, rows, SOURCES / f"{reg.upper()}.txt")
            self.assertEqual(res["unknown"], [], f"{reg}: {res['unknown'][:3]}")


if __name__ == "__main__":
    unittest.main()
