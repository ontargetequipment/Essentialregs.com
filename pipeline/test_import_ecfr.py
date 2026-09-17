#!/usr/bin/env python3
"""Unit tests for import_ecfr.py (the eCFR 40 CFR Part 60 Subparts
OOOOa/OOOOb/OOOOc importer). Run from the `pipeline/` directory:

    python -m unittest test_import_ecfr -v
"""

from __future__ import annotations

import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import import_ecfr as ie  # noqa: E402

SOURCES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources")


# ---------------------------------------------------------------------------
# Page furniture stripping
# ---------------------------------------------------------------------------


class FurnitureStrippingTests(unittest.TestCase):
    def test_strips_header_block_and_footer(self):
        raw = (
            "40 CFR Part 60 Subpart OOOOb (up to date as of 9/10/2026)\n"
            "                                   40 CFR Part 60 Subpart OOOOb (Sept. 10, 2026)\n"
            "Standards of Performance for Crude Oil and Natural Gas Facilities for...\n"
            "\n"
            "\n"
            "§ 60.5360b What is the purpose of this subpart?\n"
            "     (a) Scope. Real body text here.\n"
            "\n"
            "\n"
            "40 CFR 60.5360b(a) (enhanced display)                              page 3 of 219\n"
        )
        lines = ie.strip_page_furniture(raw)
        text = "\n".join(lines)
        self.assertNotIn("up to date as of", text)
        self.assertNotIn("enhanced display", text)
        self.assertNotIn("Standards of Performance for Crude Oil", text)
        self.assertIn("§ 60.5360b What is the purpose of this subpart?", text)
        self.assertIn("Scope. Real body text here.", text)

    def test_strips_banner_and_amendment_note(self):
        raw = (
            "This content is from the eCFR and is authoritative but unofficial.\n"
            "\n"
            "[89 FR 62917, Aug. 1, 2024]\n"
            "Real content survives.\n"
        )
        lines = ie.strip_page_furniture(raw)
        text = "\n".join(lines)
        self.assertNotIn("authoritative but unofficial", text)
        self.assertNotIn("89 FR 62917", text)
        self.assertIn("Real content survives.", text)

    def test_merged_header_line_variant_is_also_stripped(self):
        # Rare pdftotext hiccup: the running-position header merges onto the
        # same physical line as the "up to date as of" line, and the
        # truncated-title line picks up the overflow -- 2 lines instead of 3.
        raw = (
            "40 CFR Part 60 Subpart OOOOb (up to date as of 9/10/2026)     "
            "40 CFR 60.5430b “Local distribution company (LDC) custody\n"
            "Standards of Performance for Crude Oil and Natural Gas Facilities for...   "
            "transfer station”\n"
            "\n"
            "   Local distribution company (LDC) custody transfer station means a metering station.\n"
        )
        lines = ie.strip_page_furniture(raw)
        text = "\n".join(lines)
        self.assertNotIn("up to date as of", text)
        self.assertIn("Local distribution company (LDC) custody transfer station means", text)

    def test_find_page_leaks(self):
        self.assertTrue(ie.find_page_leaks("blah (enhanced display) page 3 of 9 blah"))
        self.assertTrue(ie.find_page_leaks("up to date as of 9/10/2026"))
        self.assertFalse(ie.find_page_leaks("nothing wrong with this paragraph."))


# ---------------------------------------------------------------------------
# TOC exclusion
# ---------------------------------------------------------------------------


class BodyStartAndTocTests(unittest.TestCase):
    def _sample_lines(self):
        return (
            "Subpart OOOOb Standards of Performance for Crude Oil and Natural Gas Facilities for\n"
            "  § 60.5360b What is the purpose of this subpart?\n"
            "  § 60.5365b Am I subject to this subpart?\n"
            "\n"
            "Subpart OOOOb—Standards of Performance for Crude Oil and Natural Gas Facilities for Which\n"
            "Construction, Modification or Reconstruction Commenced After December 6, 2022\n"
            "\n"
            "Source: 89 FR 17043, Mar. 8, 2024, unless otherwise noted.\n"
            "\n"
            "\n"
            "§ 60.5360b What is the purpose of this subpart?\n"
            "This subpart establishes emission standards.\n"
        ).split("\n")

    def test_body_start_skips_toc(self):
        lines = self._sample_lines()
        toc_end, body_start = ie.find_body_start(lines)
        # Nothing before toc_end should ever become a row: the TOC's "§
        # 60.5360b" mention must not be reachable as a body line.
        toc_text = "\n".join(lines[:toc_end])
        self.assertIn("Subpart OOOOb Standards of Performance", toc_text)
        body_text = "\n".join(lines[body_start:])
        self.assertTrue(body_text.startswith("§ 60.5360b What is the purpose"))
        self.assertIn("This subpart establishes emission standards.", body_text)

    def test_toc_sections_extracted_for_audit(self):
        lines = self._sample_lines()
        toc_end, _ = ie.find_body_start(lines)
        toc_sections, _ = ie.extract_toc(lines, toc_end)
        self.assertIn("60.5360b", toc_sections)
        self.assertIn("60.5365b", toc_sections)
        self.assertIn("purpose of this subpart", toc_sections["60.5360b"])


# ---------------------------------------------------------------------------
# Paragraph-label nesting, including the (i)/(1) ambiguity
# ---------------------------------------------------------------------------


class MarkerNestingTests(unittest.TestCase):
    def test_simple_two_level_nesting(self):
        body = [
            "     (a) First paragraph.",
            "",
            "     (b) Second paragraph.",
            "",
            "           (1) Nested digit item.",
            "",
            "           (2) Another nested digit item.",
        ]
        rows, buffers = ie.parse_section_body("sec-oooob-60.5397b", body)
        ids = [r["id"] for r in rows]
        self.assertEqual(
            ids,
            [
                "sec-oooob-60.5397b-(a)",
                "sec-oooob-60.5397b-(b)",
                "sec-oooob-60.5397b-(b)-(1)",
                "sec-oooob-60.5397b-(b)-(2)",
            ],
        )
        self.assertIn("First paragraph.", buffers["sec-oooob-60.5397b-(a)"][0])
        self.assertEqual(
            next(r["parent_id"] for r in rows if r["id"] == "sec-oooob-60.5397b-(b)-(1)"),
            "sec-oooob-60.5397b-(b)",
        )

    def test_i_after_h_is_alpha_sibling_not_new_roman_level(self):
        """The exact ambiguity called out in the task: "(i)" immediately
        after "(h)" at the SAME depth-1 indentation is the 9th letter of an
        alpha list continuing past (h), not the start of a nested
        lower-roman-numeral list. Indentation (not label shape) drives depth,
        and the depth's family is fixed at the point that depth is first
        entered, so a bare "(i)" at depth-1 must resolve as the alpha
        sibling of (h) -- never as a fresh push into a new roman depth."""
        body = [
            "     (a) Paragraph a.",
            "",
            "     (b) Paragraph b.",
            "",
            "     (c) Paragraph c.",
            "",
            "     (d) Paragraph d.",
            "",
            "     (e) Paragraph e.",
            "",
            "     (f) Paragraph f.",
            "",
            "     (g) Some paragraph.",
            "",
            "     (h) Another paragraph.",
            "",
            "     (i) Repair requirements paragraph, not roman numeral one.",
            "",
            "           (1) A nested digit item under (i).",
        ]
        rows, buffers = ie.parse_section_body("sec-oooob-60.5401b", body)
        ids = [r["id"] for r in rows]
        self.assertIn("sec-oooob-60.5401b-(i)", ids)
        self.assertNotIn("sec-oooob-60.5401b-(g)-(i)", ids)
        self.assertNotIn("sec-oooob-60.5401b-(h)-(i)", ids)
        # (i)'s child must nest UNDER (i), depth-2 digit -- confirms (i) was
        # treated as a depth-1 sibling (alpha family), not a depth-3 push.
        self.assertEqual(
            next(r["parent_id"] for r in rows if r["id"] == "sec-oooob-60.5401b-(i)-(1)"),
            "sec-oooob-60.5401b-(i)",
        )

    def test_reprinted_paragraph_gets_its_own_buffer(self):
        """The eCFR prints 60.5401b's whole paragraph (i) twice. The repeat
        must become a second marker row with its OWN text buffer (so the
        two copies never merge into one text), and its children must nest
        under it rather than under the previous item's last leaf."""
        body = [
            "     (a) Repair requirements. First copy chapeau.",
            "",
            "           (1) First copy item one.",
            "",
            "           (2) First copy item two.",
            "",
            "     (a) Repair requirements. First copy chapeau.",
            "",
            "           (1) First copy item one.",
            "",
            "           (2) Second copy item two, worded differently.",
        ]
        rows, buffers = ie.parse_section_body("sec-oooob-60.5401b", body)
        ids = [r["id"] for r in rows]
        self.assertEqual(ids.count("sec-oooob-60.5401b-(a)"), 2)
        self.assertEqual(ids.count("sec-oooob-60.5401b-(a)-(1)"), 2)
        keys = [r.get("buffer_key", r["id"]) for r in rows if r["id"] == "sec-oooob-60.5401b-(a)-(2)"]
        self.assertEqual(keys, ["sec-oooob-60.5401b-(a)-(2)", "sec-oooob-60.5401b-(a)-(2)#dup1"])
        self.assertEqual(" ".join(buffers["sec-oooob-60.5401b-(a)-(2)"]).strip(), "First copy item two.")
        self.assertEqual(
            " ".join(buffers["sec-oooob-60.5401b-(a)-(2)#dup1"]).strip(),
            "Second copy item two, worded differently.",
        )
        # The first copy's last leaf must not have swallowed the repeated chapeau.
        self.assertNotIn("(a)", " ".join(buffers["sec-oooob-60.5401b-(a)-(2)"]))
        self.assertTrue(all(r["parent_id"] == "sec-oooob-60.5401b-(a)" for r in rows if r["id"].endswith("-(1)")))

    def test_genuine_roman_sublevel_still_works(self):
        body = [
            "     (a) Top paragraph.",
            "",
            "           (1) Digit item.",
            "",
            "                 (i)   First roman sub-item.",
            "",
            "                (ii) Second roman sub-item.",
        ]
        rows, buffers = ie.parse_section_body("sec-oooob-60.5397b", body)
        ids = [r["id"] for r in rows]
        self.assertIn("sec-oooob-60.5397b-(a)-(1)-(i)", ids)
        self.assertIn("sec-oooob-60.5397b-(a)-(1)-(ii)", ids)

    def test_stray_reference_at_start_of_wrapped_line_is_not_a_new_marker(self):
        """A cross-reference wrapped so it starts a physical line -- e.g.
        "(a)(2) of this section" continuing a sentence from the previous
        line -- must not be mistaken for a marker: it doesn't match the
        NEXT expected label for any live depth."""
        body = [
            "     (a) First paragraph, see paragraph",
            "     (c) of this section for more.",
            "",
            "     (b) Second paragraph.",
        ]
        rows, buffers = ie.parse_section_body("sec-oooob-60.5397b", body)
        ids = [r["id"] for r in rows]
        # Only (a) and (b) are real markers; the stray "(c)" line merges
        # into (a)'s own text instead of creating a bogus sibling id.
        self.assertEqual(ids, ["sec-oooob-60.5397b-(a)", "sec-oooob-60.5397b-(b)"])
        self.assertIn("(c) of this section for more.", " ".join(buffers["sec-oooob-60.5397b-(a)"]))

    def test_family_and_shape_helpers(self):
        self.assertEqual(ie.family_for_depth(1), "alpha")
        self.assertEqual(ie.family_for_depth(2), "digit")
        self.assertEqual(ie.family_for_depth(3), "roman")
        self.assertEqual(ie.family_for_depth(4), "ALPHA")
        self.assertEqual(ie.family_for_depth(5), "digit")
        self.assertEqual(ie.family_for_depth(6), "roman")
        self.assertEqual(ie.next_of_family("alpha", "h"), "i")
        self.assertEqual(ie.next_of_family("alpha", "z"), "aa")
        self.assertEqual(ie.next_of_family("roman", "ix"), "x")
        self.assertEqual(ie.next_of_family("digit", "9"), "10")
        self.assertTrue(ie.shape_matches("roman", "iii"))
        self.assertFalse(ie.shape_matches("digit", "iii"))


# ---------------------------------------------------------------------------
# Relative cross-reference resolution ("paragraph (x) of this section")
# ---------------------------------------------------------------------------


class RelativeReferenceTests(unittest.TestCase):
    def test_single_relative_reference_resolves(self):
        known = {"sec-oooob-60.5365b", "sec-oooob-60.5365b-(d)", "sec-oooob-60.5365b-(d)-(2)"}
        unresolved = {b: {} for b in ie.ALL_BUCKETS}
        for b in unresolved:
            unresolved[b] = __import__("collections").Counter()
        text = "as provided in paragraph (d)(2) of this section."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5365b", "sec-oooob-60.5365b", known, {"oooob"}, unresolved)
        self.assertIn('data-target="sec-oooob-60.5365b-(d)-(2)"', out)
        self.assertIn(">(d)(2)<", out)

    def test_shorthand_list_reuses_leading_chain(self):
        """"paragraph (d)(2)(i) or (ii) of this section" -- the bare "(ii)"
        reuses (d)(2) from the preceding full chain, per the spec's
        "paragraphs (b)(1) through (3)" example."""
        known = {
            "sec-oooob-60.5365b-(d)-(2)-(i)",
            "sec-oooob-60.5365b-(d)-(2)-(ii)",
        }
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "choose to apply paragraph (d)(2)(i) or (ii) of this section instead."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5365b", "sec-oooob-60.5365b-(d)-(2)", known, {"oooob"}, unresolved)
        self.assertIn('data-target="sec-oooob-60.5365b-(d)-(2)-(i)"', out)
        self.assertIn('data-target="sec-oooob-60.5365b-(d)-(2)-(ii)"', out)

    def test_through_range_shorthand(self):
        known = {f"sec-oooob-60.5397b-(e)-(5)-({r})" for r in ("i", "ii", "iii", "iv")}
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "comply with the requirements of paragraphs (e)(5)(i) through (iv) of this section."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5397b", "sec-oooob-60.5397b-(e)-(5)", known, {"oooob"}, unresolved)
        self.assertIn('data-target="sec-oooob-60.5397b-(e)-(5)-(i)"', out)
        self.assertIn('data-target="sec-oooob-60.5397b-(e)-(5)-(iv)"', out)

    def test_unresolved_relative_reference_is_bucketed(self):
        from collections import Counter

        known = {"sec-oooob-60.5365b"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "as provided in paragraph (z)(9) of this section."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5365b", "sec-oooob-60.5365b", known, {"oooob"}, unresolved)
        self.assertNotIn("xref", out)
        self.assertEqual(sum(unresolved[ie.BUCKET_UNPARSEABLE].values()), 1)

    def test_same_subpart_absolute_reference_resolves(self):
        from collections import Counter

        known = {"sec-oooob-60.5397b", "sec-oooob-60.5397b-(g)", "sec-oooob-60.5397b-(g)-(1)"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "as specified in § 60.5397b(g)(1) of this subpart."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5360b", "sec-oooob-60.5360b", known, {"oooob"}, unresolved)
        self.assertIn('data-target="sec-oooob-60.5397b-(g)-(1)"', out)

    def test_cross_reg_reference_links_to_regulation_page(self):
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "the definition in § 60.5397a of subpart OOOOa."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5360b", "sec-oooob-60.5360b", set(), {"oooob", "ooooa"}, unresolved)
        self.assertIn('<a class="xref-external-reg" href="/regulations/ooooa">', out)

    def test_general_provisions_reference_is_cfr_not_in_corpus(self):
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "as required by § 60.18(c) of the General Provisions."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5360b", "sec-oooob-60.5360b", set(), {"oooob"}, unresolved)
        self.assertNotIn("xref", out)
        self.assertEqual(sum(unresolved[ie.BUCKET_CFR].values()), 1)

    def test_other_part60_subpart_number_not_mistaken_for_corpus(self):
        """"§ 60.112b" (subpart Kb) coincidentally ends in "b" but is NOT
        OOOOb's own numbering range (5300-5499) -- must not self-link."""
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "as required under § 60.112b(a)(1)."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5360b", "sec-oooob-60.5360b", set(), {"oooob"}, unresolved)
        self.assertNotIn("xref", out)
        self.assertEqual(sum(unresolved[ie.BUCKET_CFR].values()), 1)

    def test_subpart_a_of_this_part_is_general_provisions_not_oooa(self):
        """Plain "subpart A of this part" (Part 60's General Provisions)
        must never be confused with corpus reg "ooooa" (Subpart OOOOa) just
        because "oooo"+"a" happens to share letters with "OOOOa"."""
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "as defined in subpart A of this part."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5360b", "sec-oooob-60.5360b", set(), {"oooob", "ooooa"}, unresolved)
        self.assertNotIn("/regulations/ooooa", out)
        self.assertEqual(sum(unresolved[ie.BUCKET_OTHER_SUBPART].values()), 1)


# ---------------------------------------------------------------------------
# HTML escaping
# ---------------------------------------------------------------------------


class EscapingTests(unittest.TestCase):
    def test_escapes_amp_lt_gt_in_order(self):
        self.assertEqual(ie.escape_html_text("< 60 grams/hour & > 2 tpy"), "&lt; 60 grams/hour &amp; &gt; 2 tpy")
        self.assertEqual(ie.escape_html_text("&lt;"), "&amp;lt;")

    def test_table_html_escapes_cells(self):
        html = ie.render_table_html("Table 1 — A & B", [["X < Y", "A & B"], ["1", "2 > 1"]])
        self.assertIn("A &amp; B", html)
        self.assertIn("X &lt; Y", html)
        self.assertIn("2 &gt; 1", html)


# ---------------------------------------------------------------------------
# Heading-lead detection ("(a) General requirements. You must ...")
# ---------------------------------------------------------------------------


class HeadingLeadTests(unittest.TestCase):
    def test_detects_short_heading_lead(self):
        head, _ = ie.split_heading_from_text("Scope. This subpart establishes emission standards.")
        self.assertEqual(head, "Scope")

    def test_no_false_positive_on_ordinary_sentence(self):
        head, _ = ie.split_heading_from_text("You must comply with the requirements of this section.")
        self.assertIsNone(head)


# ---------------------------------------------------------------------------
# Full-file smoke test
# ---------------------------------------------------------------------------


@unittest.skipUnless(
    os.path.exists(os.path.join(SOURCES, "OOOOb.txt")) and os.path.exists(os.path.join(SOURCES, "OOOOb.pdf")),
    "OOOOb source files not present",
)
class FullFileSmokeTest(unittest.TestCase):
    def test_oooob_row_count_and_parent_integrity(self):
        rows, report = ie.parse_ecfr("oooob", os.path.join(SOURCES, "OOOOb.pdf"), os.path.join(SOURCES, "OOOOb.txt"))
        self.assertGreater(len(rows), 500)
        ids = {r["id"] for r in rows}
        for r in rows:
            if r["parent_id"] is not None:
                self.assertIn(r["parent_id"], ids, f"missing parent for {r['id']}")
        # Every id is unique in the final output (duplicates are merged, not
        # left in place -- see parse_ecfr's add_row()).
        self.assertEqual(len(ids), len(rows))
        # No page furniture should have leaked into rendered text.
        leaked = [r["id"] for r in rows if ie.find_page_leaks(r["full_text"])]
        self.assertEqual(leaked, [])
        self.assertEqual(report["missing_sections"], [])


if __name__ == "__main__":
    unittest.main()
