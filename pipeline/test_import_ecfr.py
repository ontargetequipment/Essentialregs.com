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
from collections import Counter, defaultdict

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


# ---------------------------------------------------------------------------
# SUBPART_META / generalized reg resolution (JJJJ/IIII/ZZZZ additions)
# ---------------------------------------------------------------------------


class SubpartMetaTests(unittest.TestCase):
    def test_all_six_regs_present_with_expected_shape(self):
        for key in ("ooooa", "oooob", "ooooc", "jjjj", "iiii", "zzzz"):
            self.assertIn(key, ie.SUBPART_META)
            meta = ie.SUBPART_META[key]
            self.assertIn(meta["part"], (60, 63))
            self.assertTrue(meta["code"])

    def test_norm_reg_accepts_all_six_case_insensitively(self):
        for key in ("OOOOa", "OoooB", "ooooC", "JJJJ", "Iiii", "ZZZZ"):
            self.assertEqual(ie._norm_reg(key), key.lower())

    def test_norm_reg_rejects_unknown(self):
        with self.assertRaises(ValueError):
            ie._norm_reg("kkkk")

    def test_jjjj_iiii_have_no_letter_suffix(self):
        self.assertEqual(ie.SUBPART_META["jjjj"]["suffix"], "")
        self.assertEqual(ie.SUBPART_META["iiii"]["suffix"], "")
        self.assertEqual(ie.SUBPART_META["zzzz"]["suffix"], "")

    def test_zzzz_is_part_63(self):
        self.assertEqual(ie.SUBPART_META["zzzz"]["part"], 63)
        self.assertEqual(ie.SUBPART_META["jjjj"]["part"], 60)
        self.assertEqual(ie.SUBPART_META["iiii"]["part"], 60)


class SectionRangeResolverTests(unittest.TestCase):
    """_resolve_target_reg: OOOOa/b/c are told apart by letter suffix
    (unchanged rule); JJJJ/IIII/ZZZZ (no suffix) are told apart by their own
    section-number range within their CFR part."""

    def test_ooooa_b_c_still_resolve_by_letter(self):
        self.assertEqual(ie._resolve_target_reg("60", "5397", "b"), "oooob")
        self.assertEqual(ie._resolve_target_reg("60", "5397", "a"), "ooooa")
        self.assertEqual(ie._resolve_target_reg("60", "5397", "c"), "ooooc")

    def test_jjjj_resolves_by_number_range_part_60_no_suffix(self):
        self.assertEqual(ie._resolve_target_reg("60", "4231", ""), "jjjj")
        self.assertEqual(ie._resolve_target_reg("60", "4248", ""), "jjjj")

    def test_iiii_resolves_by_number_range_part_60_no_suffix(self):
        self.assertEqual(ie._resolve_target_reg("60", "4200", ""), "iiii")
        self.assertEqual(ie._resolve_target_reg("60", "4219", ""), "iiii")

    def test_zzzz_resolves_by_number_range_part_63_no_suffix(self):
        self.assertEqual(ie._resolve_target_reg("63", "6603", ""), "zzzz")
        self.assertEqual(ie._resolve_target_reg("63", "6675", ""), "zzzz")

    def test_general_provisions_numbers_do_not_resolve(self):
        # § 60.18 / § 63.1 (Part 60/63 General Provisions) are not inside
        # ANY subpart's own numbering.
        self.assertIsNone(ie._resolve_target_reg("60", "18", ""))
        self.assertIsNone(ie._resolve_target_reg("63", "1", ""))

    def test_jjjj_and_iiii_ranges_dont_collide(self):
        # 4220-4229 is a gap between IIII's and JJJJ's own ranges.
        self.assertIsNone(ie._resolve_target_reg("60", "4225", ""))

    def test_cross_reg_link_jjjj_own_section(self):
        from collections import Counter

        known = {"sec-jjjj-60.4231", "sec-jjjj-60.4231-(a)"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "as specified in § 60.4231(a) of this subpart."
        out = ie.link_citations(text, "jjjj", "sec-jjjj-60.4230", "sec-jjjj-60.4230", known, {"jjjj"}, unresolved)
        self.assertIn('data-target="sec-jjjj-60.4231-(a)"', out)

    def test_cross_reg_link_zzzz_part_63_own_section(self):
        from collections import Counter

        known = {"sec-zzzz-63.6603"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "under § 63.6603 of this subpart."
        out = ie.link_citations(text, "zzzz", "sec-zzzz-63.6580", "sec-zzzz-63.6580", known, {"zzzz"}, unresolved)
        self.assertIn('data-target="sec-zzzz-63.6603"', out)

    def test_jjjj_reference_to_zzzz_subpart_links_cross_reg(self):
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "meeting the requirements of 40 CFR part 63, subpart ZZZZ, Table 2a."
        out = ie.link_citations(text, "jjjj", "sec-jjjj-60.4231", "sec-jjjj-60.4231", set(), {"jjjj", "zzzz"}, unresolved)
        self.assertIn('<a class="xref-external-reg" href="/regulations/zzzz">', out)

    def test_engine_certification_part_is_cfr_not_in_corpus(self):
        from collections import Counter

        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "certify their engines according to 40 CFR part 1048."
        out = ie.link_citations(text, "jjjj", "sec-jjjj-60.4231", "sec-jjjj-60.4231", set(), {"jjjj"}, unresolved)
        self.assertNotIn("xref", out)
        self.assertEqual(sum(unresolved[ie.BUCKET_CFR].values()), 1)

    def test_table_ref_to_this_subpart_resolves_for_new_subparts(self):
        from collections import Counter

        known = {"sec-jjjj-TABLE-1"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "comply with the emission standards in Table 1 to this subpart."
        out = ie.link_citations(text, "jjjj", "sec-jjjj-60.4231", "sec-jjjj-60.4231", known, {"jjjj"}, unresolved)
        self.assertIn('data-target="sec-jjjj-TABLE-1"', out)

    def test_table_ref_to_this_subpart_not_linked_for_oooo(self):
        """OOOOa/b/c keep enable_table_ref_links=False so their baselines
        are untouched -- the same text must NOT get wrapped for them."""
        from collections import Counter

        known = {"sec-oooob-TABLE-5"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "Table 5 to this subpart shows which parts of the General Provisions apply to you."
        out = ie.link_citations(text, "oooob", "sec-oooob-60.5360b", "sec-oooob-60.5360b", known, {"oooob"}, unresolved)
        self.assertNotIn("xref", out)

    def test_alphanumeric_table_ref_resolves_for_zzzz(self):
        from collections import Counter

        known = {"sec-zzzz-TABLE-2c"}
        unresolved = {b: Counter() for b in ie.ALL_BUCKETS}
        text = "requirements in table 2c of this subpart."
        # "table 2c of this subpart" (not "to this subpart") doesn't match;
        # use the actual printed form.
        text = "requirements in Table 2c to this subpart apply."
        out = ie.link_citations(text, "zzzz", "sec-zzzz-63.6600", "sec-zzzz-63.6600", known, {"zzzz"}, unresolved)
        self.assertIn('data-target="sec-zzzz-TABLE-2c"', out)


# ---------------------------------------------------------------------------
# Table-number parsing (alphanumeric "Table 1a" for ZZZZ) and appendix ids
# ---------------------------------------------------------------------------


class TableAndAppendixIdTests(unittest.TestCase):
    def test_row_anchor_regex_recognizes_numbered_and_section_anchors(self):
        self.assertTrue(ie._ROW_ANCHOR_RE.match("1. Stationary SI internal combustion engine"))
        self.assertTrue(ie._ROW_ANCHOR_RE.match("a. Reduce CO emissions"))
        self.assertTrue(ie._ROW_ANCHOR_RE.match("§ 60.1 General applicability"))
        self.assertTrue(ie._ROW_ANCHOR_RE.match("§§ 63.6(b)(1)-(4) Compliance dates"))

    def test_row_anchor_regex_rejects_bare_section_number_fragment(self):
        # "60.4244" is a wrapped cross-reference fragment, not a "60." list
        # marker -- must NOT be mistaken for a new row (see rows_from_
        # layout_block_v2's docstring / REPORT.md's JJJJ Table 2 note).
        self.assertFalse(ie._ROW_ANCHOR_RE.match("60.4244 a Also, you may petition"))

    def test_dedupe_repeated_runs_drops_second_occurrence(self):
        lines = [
            "Complying",
            "with the",
            "requirement",
            "1. First item text.",
            "Complying",
            "with the",
            "requirement",
            "2. Second item text.",
        ]
        out = ie._dedupe_repeated_runs(lines)
        self.assertEqual(
            out,
            ["Complying", "with the", "requirement", "1. First item text.", "2. Second item text."],
        )

    def test_dedupe_leaves_short_legitimate_repeats_alone(self):
        # Real table data legitimately repeats short values like "Yes" many
        # times, each time surrounded by DIFFERENT substantive text -- only a
        # long (>= min_run) verbatim run is ever dropped.
        lines = [
            "§ 60.1", "General applicability", "Yes",
            "§ 60.2", "Definitions", "Yes",
            "§ 60.3", "Units and abbreviations", "Yes",
        ]
        self.assertEqual(ie._dedupe_repeated_runs(lines), lines)

    def test_v2_falls_back_to_v1_when_no_anchor_column(self):
        # A table with no "N." / "§" leading column (ordinary prose lead-in)
        # must come out identical under v1 and v2.
        lines = [
            "Engine type          Power        Standard",
            "Non-Emergency SI     100<=HP<500  2.0",
        ]
        self.assertEqual(ie.rows_from_layout_block_v2(lines), ie.rows_from_layout_block(lines))

    def test_v2_splits_one_row_per_numbered_item(self):
        lines = [
            "For each          You must",
            "1. Item one       a. Do X",
            "2. Item two       b. Do Y",
        ]
        rows = ie.rows_from_layout_block_v2(lines)
        # header + 2 body rows
        self.assertEqual(len(rows), 3)
        self.assertTrue(rows[1][0].startswith("1. Item one"))
        self.assertTrue(rows[2][0].startswith("2. Item two"))


# ---------------------------------------------------------------------------
# Full-file smoke tests for JJJJ / IIII / ZZZZ
# ---------------------------------------------------------------------------


def _full_parse_smoke(reg, code):
    @unittest.skipUnless(
        os.path.exists(os.path.join(SOURCES, f"{code}.txt")) and os.path.exists(os.path.join(SOURCES, f"{code}.pdf")),
        f"{code} source files not present",
    )
    class _Test(unittest.TestCase):
        def test_row_count_and_parent_integrity(self):
            rows, report = ie.parse_ecfr(reg, os.path.join(SOURCES, f"{code}.pdf"), os.path.join(SOURCES, f"{code}.txt"))
            self.assertGreater(len(rows), 100)
            ids = {r["id"] for r in rows}
            for r in rows:
                if r["parent_id"] is not None:
                    self.assertIn(r["parent_id"], ids, f"missing parent for {r['id']}")
            self.assertEqual(len(ids), len(rows))
            leaked = [r["id"] for r in rows if ie.find_page_leaks(r["full_text"])]
            self.assertEqual(leaked, [])
            self.assertEqual(report["missing_sections"], [])
            self.assertEqual(report["duplicate_ids"], [])

        def test_root_row_shape(self):
            rows, _ = ie.parse_ecfr(reg, os.path.join(SOURCES, f"{code}.pdf"), os.path.join(SOURCES, f"{code}.txt"))
            root = rows[0]
            self.assertEqual(root["id"], f"sec-{reg}-top-REG-{reg}")
            self.assertIsNone(root["parent_id"])
            self.assertEqual(root["kind"], "root")

    _Test.__name__ = f"FullFileSmokeTest_{reg}"
    return _Test


FullFileSmokeTest_jjjj = _full_parse_smoke("jjjj", "JJJJ")
FullFileSmokeTest_iiii = _full_parse_smoke("iiii", "IIII")
FullFileSmokeTest_zzzz = _full_parse_smoke("zzzz", "ZZZZ")


class ZzzzAppendixTests(unittest.TestCase):
    @unittest.skipUnless(
        os.path.exists(os.path.join(SOURCES, "ZZZZ.txt")) and os.path.exists(os.path.join(SOURCES, "ZZZZ.pdf")),
        "ZZZZ source files not present",
    )
    def test_appendix_a_is_a_single_row(self):
        rows, _ = ie.parse_ecfr("zzzz", os.path.join(SOURCES, "ZZZZ.pdf"), os.path.join(SOURCES, "ZZZZ.txt"))
        appendix_rows = [r for r in rows if r["id"] == "sec-zzzz-APPENDIX-A"]
        self.assertEqual(len(appendix_rows), 1)
        row = appendix_rows[0]
        self.assertEqual(row["kind"], "appendix")
        self.assertIn("Electrochemical", row["title"])
        self.assertGreater(len(row["full_text"]), 1000)


class ZzzzTableIdTests(unittest.TestCase):
    @unittest.skipUnless(
        os.path.exists(os.path.join(SOURCES, "ZZZZ.txt")) and os.path.exists(os.path.join(SOURCES, "ZZZZ.pdf")),
        "ZZZZ source files not present",
    )
    def test_alphanumeric_table_ids(self):
        rows, _ = ie.parse_ecfr("zzzz", os.path.join(SOURCES, "ZZZZ.pdf"), os.path.join(SOURCES, "ZZZZ.txt"))
        ids = {r["id"] for r in rows}
        for expected in ("sec-zzzz-TABLE-1a", "sec-zzzz-TABLE-2c", "sec-zzzz-TABLE-8"):
            self.assertIn(expected, ids)


# ---------------------------------------------------------------------------
# eCFR XML table reconstruction (algorithm 4 -- the fix for Gate H)
# ---------------------------------------------------------------------------

_XML_FIXTURE = """<?xml version="1.0"?>
<DIV6 N="ZZZZ" TYPE="SUBPART">
<DIV9 N="Table 1a to Subpart ZZZZ of Part 63" TYPE="APPENDIX">
<HEAD>Table 1<E T="01">a</E> to Subpart ZZZZ of Part 63&#x2014;Some Caption
</HEAD>
<P>As stated in &#xA7;&#xA7; 63.6600 and 63.6640, you must comply with the following:</P>
<DIV width="100%"><DIV class="gpotbl_div">
<TABLE border="1" cellpadding="1" cellspacing="1" class="gpo_table" frame="void" width="100%">
<THEAD>
<TR>
<TH class="center">For each . . .</TH>
<TH class="center">You must . . .</TH>
</TR>
</THEAD>
<TBODY>
<TR>
<TD class="left">1. 4SRB stationary RICE</TD>
<TD class="left">a. Reduce formaldehyde emissions by 76 percent or more<br/>b. Limit the concentration of formaldehyde in the exhaust to 350 ppbvd or less at 15 percent O<sub>2</sub>
</TD>
</TR>
<TR>
<TD class="left" colspan="1">2. 4SRB stationary RICE, second kind</TD>
<TD class="left">Comply with limits approved by the Administrator.<sup>1</sup></TD>
</TR>
</TBODY>
<TFOOT><TR><TD colspan="2"><sup>1</sup> Sources can petition the Administrator.</TD></TR></TFOOT></TABLE>
</DIV></DIV>
</DIV9>
</DIV6>
"""


class XmlTableFixtureTests(unittest.TestCase):
    def setUp(self):
        import tempfile

        fh = tempfile.NamedTemporaryFile(mode="w", suffix=".xml", delete=False, encoding="utf-8")
        fh.write(_XML_FIXTURE)
        fh.close()
        self.addCleanup(os.remove, fh.name)
        self.xml_path = fh.name

    def test_load_xml_tables_finds_caption_and_lead_in(self):
        tables = ie.load_xml_tables(self.xml_path)
        key = ie._norm_alnum("Table 1a to Subpart ZZZZ of Part 63")
        self.assertIn(key, tables)
        entry = tables[key]
        # The <E T="01">a</E> wrapper's text must survive so the caption
        # reads "Table 1a", not "Table 1".
        self.assertIn("Table 1a to Subpart ZZZZ of Part 63", entry["caption"])
        self.assertTrue(entry["lead_in"].startswith("As stated in"))
        self.assertEqual(len(entry["tables"]), 1)

    def test_first_cell_is_the_label_alone_not_word_soup(self):
        # This is the exact defect the coordinator flagged: TABLE-1a's first
        # cell must be "1. 4SRB stationary RICE" ALONE, with none of column
        # 2's text or the footnote fused into it.
        tables = ie.load_xml_tables(self.xml_path)
        key = ie._norm_alnum("Table 1a to Subpart ZZZZ of Part 63")
        rows = ie.rows_from_xml_tables(tables[key]["tables"])
        self.assertEqual(rows[1][0], "1. 4SRB stationary RICE")
        self.assertEqual(rows[2][0], "2. 4SRB stationary RICE, second kind")
        self.assertNotIn("Reduce formaldehyde", rows[1][0])
        self.assertNotIn("petition", rows[1][0])

    def test_rendered_html_keeps_sup_sub_br_colspan_and_footnote(self):
        tables = ie.load_xml_tables(self.xml_path)
        entry = tables[ie._norm_alnum("Table 1a to Subpart ZZZZ of Part 63")]
        html = ie.render_xml_table_html(entry["caption"], entry["lead_in"], entry["tables"])
        self.assertIn("<sub>2</sub>", html)
        self.assertIn("<sup>1</sup>", html)
        self.assertIn("<br/>", html)
        self.assertIn('class="table-footnote"', html)
        self.assertIn('class="doc-table-lead-in"', html)
        self.assertIn("<td", html)
        self.assertIn("<th", html)
        # No raw "&" / unescaped angle brackets from the source leaking
        # through as literal text outside the tags we intentionally kept.
        self.assertNotIn("<E ", html)

    @unittest.skipUnless(
        os.path.exists(os.path.join(SOURCES, "ZZZZ.txt"))
        and os.path.exists(os.path.join(SOURCES, "ZZZZ.pdf"))
        and os.path.exists(os.path.join(SOURCES, "ZZZZ.xml")),
        "ZZZZ source files not present",
    )
    def test_real_zzzz_table_1a_is_clean_end_to_end(self):
        rows, report = ie.parse_ecfr("zzzz", os.path.join(SOURCES, "ZZZZ.pdf"), os.path.join(SOURCES, "ZZZZ.txt"))
        row = next(r for r in rows if r["id"] == "sec-zzzz-TABLE-1a")
        self.assertIn("<td>1. 4SRB stationary RICE</td>", row["full_text"])
        proofs = {p.get("id"): p for p in report["table_algo_proof"]}
        self.assertEqual(proofs["sec-zzzz-TABLE-1a"]["xml_match"], "yes")

    @unittest.skipUnless(
        os.path.exists(os.path.join(SOURCES, "JJJJ.txt"))
        and os.path.exists(os.path.join(SOURCES, "JJJJ.pdf"))
        and os.path.exists(os.path.join(SOURCES, "JJJJ.xml")),
        "JJJJ source files not present",
    )
    def test_all_jjjj_tables_match_xml(self):
        _, report = ie.parse_ecfr("jjjj", os.path.join(SOURCES, "JJJJ.pdf"), os.path.join(SOURCES, "JJJJ.txt"))
        proofs = [p for p in report["table_algo_proof"] if p.get("algorithm") == "xml"]
        self.assertTrue(proofs)
        for p in proofs:
            self.assertEqual(p.get("xml_match"), "yes", p.get("id"))

    @unittest.skipUnless(
        os.path.exists(os.path.join(SOURCES, "IIII.txt"))
        and os.path.exists(os.path.join(SOURCES, "IIII.pdf"))
        and os.path.exists(os.path.join(SOURCES, "IIII.xml")),
        "IIII source files not present",
    )
    def test_all_iiii_tables_match_xml(self):
        _, report = ie.parse_ecfr("iiii", os.path.join(SOURCES, "IIII.pdf"), os.path.join(SOURCES, "IIII.txt"))
        proofs = [p for p in report["table_algo_proof"] if p.get("algorithm") == "xml"]
        self.assertTrue(proofs)
        for p in proofs:
            self.assertEqual(p.get("xml_match"), "yes", p.get("id"))


# ---------------------------------------------------------------------------
# Byte-identical OOOO baselines (proves the generalization is a no-op for
# the three original subparts)
# ---------------------------------------------------------------------------


class OoooByteIdenticalBaselineTests(unittest.TestCase):
    def _check(self, reg, code):
        pdf = os.path.join(SOURCES, f"{code}.pdf")
        txt = os.path.join(SOURCES, f"{code}.txt")
        baseline = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", f"{reg}_baseline.json")
        if not (os.path.exists(pdf) and os.path.exists(txt) and os.path.exists(baseline)):
            self.skipTest(f"{code} source or baseline files not present")
        import json

        rows, _ = ie.parse_ecfr(reg, pdf, txt)
        with open(baseline, encoding="utf-8") as f:
            expected = json.load(f)
        self.assertEqual(rows, expected, f"{reg} output diverged from its baseline")

    def test_ooooa_byte_identical(self):
        self._check("ooooa", "OOOOa")

    def test_oooob_byte_identical(self):
        self._check("oooob", "OOOOb")

    def test_ooooc_byte_identical(self):
        self._check("ooooc", "OOOOc")


# ---------------------------------------------------------------------------
# Whole-PART (49 CFR 191/192) documents, parsed from the eCFR XML
# ---------------------------------------------------------------------------

P191_XML = os.path.join(SOURCES, "P191.xml")
P192_XML = os.path.join(SOURCES, "P192.xml")
P194_XML = os.path.join(SOURCES, "P194.xml")
P195_XML = os.path.join(SOURCES, "P195.xml")
P199_XML = os.path.join(SOURCES, "P199.xml")


def _mini_part_xml(body: str, part: str = "192") -> str:
    return (
        f'<DIV5 N="{part}" TYPE="PART">'
        f"<HEAD>PART {part}—TEST</HEAD>"
        f"{body}"
        "</DIV5>"
    )


def _parse_mini(tmpdir, body, reg="p192", part="192"):
    path = os.path.join(tmpdir, "mini.xml")
    with open(path, "w", encoding="utf-8") as f:
        f.write(_mini_part_xml(body, part))
    return ie.parse_ecfr_part(reg, path)


class PartMetaTests(unittest.TestCase):
    def test_both_parts_registered_as_part_documents(self):
        for key, part in (("p191", 191), ("p192", 192)):
            self.assertIn(key, ie.SUBPART_META)
            meta = ie.SUBPART_META[key]
            self.assertEqual(meta["document"], "part")
            self.assertEqual(meta["source"], "xml")
            self.assertEqual(meta["part"], part)
            self.assertEqual(meta["title"], 49)

    def test_urls(self):
        self.assertEqual(
            ie.SUBPART_META["p191"]["url"], "https://www.ecfr.gov/current/title-49/part-191"
        )
        self.assertEqual(
            ie.SUBPART_META["p192"]["url"], "https://www.ecfr.gov/current/title-49/part-192"
        )

    def test_root_citation_and_title(self):
        self.assertEqual(ie.SUBPART_META["p192"]["root_citation"], "49 CFR Part 192")
        self.assertEqual(
            ie.SUBPART_META["p192"]["root_title"],
            "49 CFR Part 192 — Transportation of Natural and Other Gas by Pipeline: "
            "Minimum Federal Safety Standards",
        )

    def test_norm_reg_accepts_the_part_keys(self):
        self.assertEqual(ie._norm_reg("P192"), "p192")
        self.assertEqual(ie._norm_reg("p191"), "p191")

    def test_both_parts_are_in_the_corpus(self):
        self.assertIn("p191", ie.CORPUS_REGS)
        self.assertIn("p192", ie.CORPUS_REGS)

    def test_part_meta_does_not_disturb_the_six_subparts(self):
        for key in ("ooooa", "oooob", "ooooc", "jjjj", "iiii", "zzzz"):
            self.assertNotIn("document", ie.SUBPART_META[key])
            self.assertIn(ie.SUBPART_META[key]["part"], (60, 63))

    def test_parse_ecfr_part_rejects_a_subpart_key(self):
        with self.assertRaises(ValueError):
            ie.parse_ecfr_part("oooob", P192_XML)


class CfrPartResolverTests(unittest.TestCase):
    """A 49 CFR section number resolves by PART prefix, not by the 40 CFR
    section-number-range trick."""

    def test_191_and_192_resolve_by_part_prefix(self):
        self.assertEqual(ie._resolve_target_reg_49("191", "15"), "p191")
        self.assertEqual(ie._resolve_target_reg_49("192", "605"), "p192")
        self.assertEqual(ie._resolve_target_reg_49("192", "3"), "p192")

    def test_194_195_199_resolve_by_part_prefix(self):
        """Batch B: the pipeline corpus is five whole parts, not two."""
        self.assertEqual(ie._resolve_target_reg_49("194", "5"), "p194")
        self.assertEqual(ie._resolve_target_reg_49("195", "2"), "p195")
        self.assertEqual(ie._resolve_target_reg_49("195", "452"), "p195")
        self.assertEqual(ie._resolve_target_reg_49("199", "3"), "p199")

    def test_other_49_cfr_parts_do_not_resolve(self):
        # 190, 193, 196 and 198 are pipeline-safety parts that are NOT in the
        # corpus; 1.97 is the DOT delegation section.
        for part, num in (("190", "9"), ("193", "2007"), ("196", "1"), ("198", "37"), ("1", "97")):
            self.assertIsNone(ie._resolve_target_reg_49(part, num))

    def test_cfr_part_to_regkey_mapping(self):
        self.assertEqual(
            ie.CFR_PART_TO_REGKEY,
            {
                "49-191": "p191",
                "49-192": "p192",
                "49-194": "p194",
                "49-195": "p195",
                "49-199": "p199",
            },
        )

    def test_40_cfr_resolver_never_returns_a_part_document(self):
        # a stray "§ 192.605" inside a 40 CFR subpart must NOT link to p192
        for num in ("605", "3", "8"):
            self.assertIsNone(ie._resolve_target_reg("192", num, ""))
            self.assertIsNone(ie._resolve_target_reg("191", num, ""))


class PartLabelStackTests(unittest.TestCase):
    def _stack(self, chain):
        st = []
        for i, lab in enumerate(chain):
            st.append(ie._PartLevel(ie.family_for_depth(i + 1), lab, "x"))
        return st

    def test_simple_sibling_and_push(self):
        st = self._stack(["a"])
        self.assertEqual(ie._advance_part_label_stack(st, "b"), "sibling")
        self.assertEqual(ie._advance_part_label_stack(st, "1"), "push")

    def test_i_after_h_with_open_children_is_a_top_level_alpha(self):
        # § 192.7: (h)(1),(h)(2) then "(i) National Fire Protection ..." then (j)
        st = self._stack(["h", "2"])
        self.assertEqual(ie._advance_part_label_stack(st, "i", ("1", "2", "j")), "pop:0")

    def test_i_after_h_with_a_roman_successor_is_a_real_sub_level(self):
        st = self._stack(["h", "2"])
        self.assertEqual(ie._advance_part_label_stack(st, "i", ("ii", "iii")), "push")

    def test_i_under_a_non_h_parent_is_unambiguous(self):
        # § 192.121(b)(1) then (i) -- alpha successor of (b) is (c), no clash
        st = self._stack(["b", "1"])
        self.assertEqual(ie._advance_part_label_stack(st, "i", ("ii",)), "push")

    def test_pop_to_a_shallower_level(self):
        st = self._stack(["a", "1", "iii"])
        self.assertEqual(ie._advance_part_label_stack(st, "2"), "pop:1")

    def test_label_that_fits_nowhere_is_rejected(self):
        self.assertIsNone(ie._advance_part_label_stack(self._stack(["a"]), "z"))

    def test_long_roman_labels_are_accepted(self):
        st = self._stack(["b", "1", "xvii"])
        self.assertEqual(ie._advance_part_label_stack(st, "xviii"), "sibling")


class PartParagraphSplitTests(unittest.TestCase):
    def test_plain_label(self):
        self.assertEqual(ie._split_part_paragraph("(a) Some text."), [(["a"], "Some text.")])

    def test_unlabelled_paragraph(self):
        self.assertEqual(ie._split_part_paragraph("Some text."), [([], "Some text.")])

    def test_fused_labels(self):
        self.assertEqual(
            ie._split_part_paragraph("(1)(i) A depleted hydrocarbon reservoir;"),
            [(["1", "i"], "A depleted hydrocarbon reservoir;")],
        )

    def test_italic_heading_plus_first_item_on_one_line(self):
        segs = ie._split_part_paragraph("(b) <i>General requirements.</i> (1) Except as provided...")
        self.assertEqual(segs, [(["b"], "<i>General requirements.</i>"), (["1"], "Except as provided...")])

    def test_em_dash_heading_plus_first_item_on_one_line(self):
        segs = ie._split_part_paragraph("(a) <i>Pipeline systems</i>—(1) <i>Transmission.</i> Each operator...")
        self.assertEqual(segs[0], (["a"], "<i>Pipeline systems</i>"))
        self.assertEqual(segs[1], (["1"], "<i>Transmission.</i> Each operator..."))

    def test_colon_lead_in_plus_first_item_on_one_line(self):
        segs = ie._split_part_paragraph("(b) This section does not apply to: (1) Manifolds;")
        self.assertEqual(segs, [(["b"], "This section does not apply to:"), (["1"], "Manifolds;")])

    def test_an_ordinary_parenthetical_does_not_split_a_paragraph(self):
        # only a first-of-family label can start a fused child item
        txt = "(a) Effective date: (2019) editions apply."
        self.assertEqual(ie._split_part_paragraph(txt), [(["a"], "Effective date: (2019) editions apply.")])


class PartInlineHtmlTests(unittest.TestCase):
    def _el(self, xml):
        import xml.etree.ElementTree as ET

        return ET.fromstring(xml)

    def test_italic_and_e_codes_become_i_sup_sub(self):
        el = self._el('<P><I>Term</I> means <E T="03">x</E><E T="52">2</E><E T="54">r</E>.</P>')
        self.assertEqual(ie._part_inline_html(el), "<i>Term</i> means <i>x</i><sup>2</sup><sub>r</sub>.")

    def test_su_becomes_superscript_with_no_leading_space(self):
        el = self._el("<P>100 ft\n<SU>3</SU> of gas</P>")
        self.assertEqual(ie._part_inline_html(el), "100 ft<sup>3</sup> of gas")

    def test_fr_fraction_stays_plain_text(self):
        el = self._el("<P>10\n<FR>3/4</FR> inches</P>")
        self.assertEqual(ie._part_inline_html(el), "10 3/4 inches")

    def test_subpart_path_inline_html_is_unchanged(self):
        # emphasis=False (the default) still DROPS <E> -- the six 40 CFR
        # subparts' table HTML depends on it
        el = self._el('<TD>Table 1<E T="01">a</E></TD>')
        self.assertEqual(ie._xml_inline_html(el), "Table 1a")


class PartStructureFromXmlTests(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmp = tempfile.mkdtemp()

    def test_subpart_section_and_paragraph_rows(self):
        rows, _ = _parse_mini(
            self.tmp,
            '<DIV6 N="L" TYPE="SUBPART"><HEAD>Subpart L—Operations</HEAD>'
            '<DIV8 N="192.605" TYPE="SECTION"><HEAD>§ 192.605 Procedural manual.</HEAD>'
            "<P>(a) <I>General.</I> An operator must do things.</P>"
            "<P>(1) First thing.</P>"
            "</DIV8></DIV6>",
        )
        byid = {r["id"]: r for r in rows}
        self.assertEqual(byid["sec-p192-PART-L"]["citation"], "Subpart L")
        self.assertEqual(byid["sec-p192-PART-L"]["title"], "Subpart L — Operations")
        self.assertEqual(byid["sec-p192-PART-L"]["kind"], "part")
        self.assertEqual(byid["sec-p192-PART-L"]["parent_id"], "sec-p192-top-REG-p192")
        sec = byid["sec-p192-192.605"]
        self.assertEqual(sec["citation"], "§ 192.605")
        self.assertEqual(sec["title"], "§ 192.605 Procedural manual.")
        self.assertEqual(sec["kind"], "section")
        self.assertEqual(sec["parent_id"], "sec-p192-PART-L")
        self.assertEqual(byid["sec-p192-192.605-(a)"]["citation"], "§ 192.605(a)")
        self.assertEqual(byid["sec-p192-192.605-(a)-(1)"]["parent_id"], "sec-p192-192.605-(a)")

    def test_reserved_section_is_a_row_not_a_drop(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV8 N="192.57" TYPE="SECTION"><HEAD>§ 192.57 [Reserved]</HEAD></DIV8>',
        )
        byid = {r["id"]: r for r in rows}
        self.assertIn("sec-p192-192.57", byid)
        self.assertEqual(byid["sec-p192-192.57"]["full_text"], "<p>[Reserved]</p>")
        self.assertEqual(byid["sec-p192-192.57"]["kind"], "section")
        self.assertIn("§ 192.57", rep["reserved"])

    def test_definitions_become_one_row_per_term(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV8 N="192.3" TYPE="SECTION"><HEAD>§ 192.3 Definitions.</HEAD>'
            "<P>As used in this part:</P>"
            "<P><I>Abandoned</I> means permanently removed from service.</P>"
            "<P><I>Active corrosion</I> means continuing corrosion.</P>"
            "<P>(1) A sub-item of the definition above.</P>"
            "</DIV8>",
        )
        byid = {r["id"]: r for r in rows}
        # the chapeau keeps its "this part" link to the document root
        self.assertEqual(
            byid["sec-p192-192.3"]["full_text"],
            '<p>As used in <span class="xref" data-target="sec-p192-top-REG-p192">this part</span>:</p>',
        )
        d = byid["sec-p192-192.3-abandoned"]
        self.assertEqual(d["kind"], "definition")
        self.assertEqual(d["citation"], "§ 192.3 “Abandoned”")
        self.assertEqual(d["parent_id"], "sec-p192-192.3")
        # the trailing numbered sub-paragraph folds into its term's own row
        self.assertIn("A sub-item", byid["sec-p192-192.3-active-corrosion"]["full_text"])
        self.assertEqual(rep["n_definitions"], 2)

    def test_cita_ednote_and_xref_are_stripped_and_counted(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV8 N="192.605" TYPE="SECTION"><HEAD>§ 192.605 X.</HEAD>'
            "<P>(a) Body text.</P>"
            '<XREF ID="1">Link to an amendment published at 91 FR 21990.</XREF>'
            '<CITA TYPE="N">[35 FR 13257, Aug. 19, 1970]</CITA>'
            "<EDNOTE><HED>Editorial Note:</HED><PSPACE>Nomenclature changes.</PSPACE></EDNOTE>"
            "</DIV8>",
        )
        joined = " ".join(r["full_text"] for r in rows)
        self.assertNotIn("35 FR 13257", joined)
        self.assertNotIn("Nomenclature changes", joined)
        self.assertNotIn("Link to an amendment", joined)
        self.assertEqual(rep["stripped"]["CITA"], 1)
        self.assertEqual(rep["stripped"]["EDNOTE"], 1)
        self.assertEqual(rep["stripped"]["XREF"], 1)

    def test_image_becomes_a_figure_placeholder_with_the_section_url(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV8 N="192.121" TYPE="SECTION"><HEAD>§ 192.121 Design.</HEAD>'
            "<P>(a) The formula is:</P>"
            '<img src="/graphics/er20no18.000.gif" />'
            "</DIV8>",
        )
        byid = {r["id"]: r for r in rows}
        txt = byid["sec-p192-192.121-(a)"]["full_text"]
        self.assertIn('<p class="figure-omitted">', txt)
        self.assertIn("https://www.ecfr.gov/current/title-49/section-192.121", txt)
        self.assertNotIn(".gif", txt)
        self.assertEqual(len(rep["images"]), 1)

    def test_table_renders_inline_not_as_its_own_row(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV8 N="192.111" TYPE="SECTION"><HEAD>§ 192.111 Design factor.</HEAD>'
            "<P>(a) Use the following table:</P>"
            '<DIV width="100%"><DIV class="gpotbl_div"><TABLE>'
            '<CAPTION><P class="title">Table 1 to Paragraph (a)</P></CAPTION>'
            "<THEAD><TR><TH>Class location</TH><TH>Design factor</TH></TR></THEAD>"
            "<TBODY><TR><TD>1</TD><TD>0.72</TD></TR></TBODY>"
            "</TABLE></DIV></DIV>"
            "</DIV8>",
        )
        byid = {r["id"]: r for r in rows}
        txt = byid["sec-p192-192.111-(a)"]["full_text"]
        self.assertIn('<table class="doc-table">', txt)
        self.assertIn("Table 1 to Paragraph (a)", txt)
        self.assertIn("<td>0.72</td>", txt)
        self.assertFalse([r for r in rows if "-TABLE-" in r["id"]])
        self.assertEqual(rep["tables"][0]["rows"], 2)
        self.assertEqual(rep["tables"][0]["cols"], 2)

    def test_appendix_row_and_ladder_children(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV9 N="Appendix B to Part 192" TYPE="APPENDIX">'
            "<HEAD>Appendix B to Part 192—Qualification of Pipe</HEAD>"
            "<HD1>I. List of Specifications</HD1>"
            "<HD2>A. Listed Pipe Specifications</HD2>"
            "<FP-1>API Spec 5L, Line Pipe.</FP-1>"
            "<P>II. Steel pipe of unknown specification.</P>"
            "</DIV9>",
        )
        byid = {r["id"]: r for r in rows}
        apx = byid["sec-p192-APPENDIX-B"]
        self.assertEqual(apx["citation"], "Appendix B to Part 192")
        self.assertEqual(apx["kind"], "appendix")
        self.assertEqual(apx["parent_id"], "sec-p192-top-REG-p192")
        self.assertIn("sec-p192-APPENDIX-B-I", byid)
        self.assertIn("sec-p192-APPENDIX-B-I-A", byid)
        self.assertIn("API Spec 5L", byid["sec-p192-APPENDIX-B-I-A"]["full_text"])
        self.assertIn("sec-p192-APPENDIX-B-II", byid)
        self.assertEqual(byid["sec-p192-APPENDIX-B-I-A"]["parent_id"], "sec-p192-APPENDIX-B-I")

    def test_ambiguous_appendix_ladder_stays_one_row(self):
        rows, rep = _parse_mini(
            self.tmp,
            '<DIV9 N="Appendix Z to Part 192" TYPE="APPENDIX">'
            "<HEAD>Appendix Z to Part 192—Test</HEAD>"
            "<P>III. Out of sequence first entry.</P>"
            "<P>IV. Second entry.</P>"
            "</DIV9>",
        )
        self.assertEqual([r["id"] for r in rows if "APPENDIX" in r["id"]], ["sec-p192-APPENDIX-Z"])
        self.assertIn("one row", rep["appendix_modes"]["Z"])


class PartCitationLinkingTests(unittest.TestCase):
    KNOWN = {
        "sec-p192-top-REG-p192",
        "sec-p192-PART-L",
        "sec-p192-APPENDIX-B",
        "sec-p192-192.605",
        "sec-p192-192.605-(b)",
        "sec-p192-192.605-(b)-(1)",
        "sec-p192-192.243",
        "sec-p192-192.245",
        "sec-p192-192.7",
    }

    def _link(self, text, reg="p192"):
        unresolved = defaultdict(Counter)
        out = ie.link_citations(
            text, reg, "sec-p192-192.605", "sec-p192-192.605", self.KNOWN, ie.CORPUS_REGS, unresolved
        )
        return out, unresolved

    def test_same_part_section_and_paragraph(self):
        out, _ = self._link("see § 192.605(b)(1) now")
        self.assertIn('data-target="sec-p192-192.605-(b)-(1)"', out)

    def test_range_links_both_ends(self):
        out, _ = self._link("§§ 192.243 through 192.245 apply")
        self.assertIn('data-target="sec-p192-192.243"', out)
        self.assertIn('data-target="sec-p192-192.245"', out)

    def test_relative_paragraph_reference(self):
        out, _ = self._link("as in paragraph (b)(1) of this section")
        self.assertIn('data-target="sec-p192-192.605-(b)-(1)"', out)

    def test_subpart_of_this_part(self):
        out, _ = self._link("qualified under subpart L of this part")
        self.assertIn('data-target="sec-p192-PART-L"', out)

    def test_appendix_to_this_part(self):
        out, _ = self._link("listed in appendix B to this part")
        self.assertIn('data-target="sec-p192-APPENDIX-B"', out)

    def test_this_part_links_to_the_root(self):
        out, _ = self._link("incorporated by reference into this part")
        self.assertIn('data-target="sec-p192-top-REG-p192"', out)

    def test_cross_part_reference_links_to_the_other_regulation(self):
        out, _ = self._link("reported under § 191.15 of this chapter")
        self.assertIn('href="/regulations/p191"', out)
        out2, _ = self._link("see 49 CFR 191.5")
        self.assertIn('href="/regulations/p191"', out2)
        out3, _ = self._link("subject to part 191 of this chapter")
        self.assertIn('href="/regulations/p191"', out3)

    def test_p191_links_back_to_p192(self):
        unresolved = defaultdict(Counter)
        out = ie.link_citations(
            "as determined in § 192.8 of this chapter",
            "p191",
            "sec-p191-191.3",
            "sec-p191-191.3",
            {"sec-p191-top-REG-p191"},
            ie.CORPUS_REGS,
            unresolved,
        )
        self.assertIn('href="/regulations/p192"', out)

    def test_out_of_corpus_cfr_parts_are_bucketed_not_linked(self):
        # Batch B put 194/195/199 in the corpus; 190, 193, 196 and 198 stay
        # out, and so does 49 CFR 1.97.
        for text in (
            "under § 190.9 of this chapter",
            "part 193 of this chapter",
            "part 196 of this chapter",
            "§ 198.37 of this chapter",
            "49 CFR 1.97",
        ):
            out, unres = self._link(text)
            self.assertNotIn("xref", out)
            self.assertTrue(sum(unres[ie.BUCKET_CFR].values()) >= 1, text)

    def test_in_corpus_49_cfr_parts_link(self):
        """The other side of the same rule: the three parts Batch B added now
        resolve from a p192 row instead of landing in the CFR bucket."""
        for text, reg in (
            ("part 194 of this chapter", "p194"),
            ("part 195 of this chapter", "p195"),
            ("part 199 of this chapter", "p199"),
            ("§ 195.452 of this chapter", "p195"),
        ):
            out, unres = self._link(text)
            self.assertIn(f'href="/regulations/{reg}"', out, text)
            self.assertEqual(sum(unres[ie.BUCKET_CFR].values()), 0, text)

    def test_statutes_are_bucketed(self):
        out, unres = self._link("authorized by 49 U.S.C. 60101 et seq.")
        self.assertNotIn("xref", out)
        self.assertEqual(sum(unres[ie.BUCKET_STATUTE].values()), 1)

    def test_incorporated_standard_name_is_bucketed_but_its_see_section_links(self):
        out, unres = self._link("ASME B31.8S (incorporated by reference, see § 192.7)")
        self.assertIn('data-target="sec-p192-192.7"', out)
        self.assertIn("ASME B31.8S", unres[ie.BUCKET_STANDARD])

    def test_a_row_never_links_to_itself(self):
        """§ 192.167(c)(2)(ii) says "paragraph (c)(2)(ii) of this section",
        which resolves back to the citing row: emit it unwrapped, and do not
        bucket it (the target exists, it is just the reader's position)."""
        unresolved = defaultdict(Counter)
        out = ie.link_citations(
            "For the purpose of paragraph (b) of this section",
            "p192", "sec-p192-192.605", "sec-p192-192.605-(b)",
            self.KNOWN, ie.CORPUS_REGS, unresolved,
        )
        self.assertNotIn("xref", out)
        self.assertEqual(out, "For the purpose of paragraph (b) of this section")
        self.assertEqual(sum(sum(c.values()) for c in unresolved.values()), 0)

    def test_a_sibling_reference_still_links(self):
        unresolved = defaultdict(Counter)
        out = ie.link_citations(
            "as in paragraph (b)(1) of this section",
            "p192", "sec-p192-192.605", "sec-p192-192.605-(b)",
            self.KNOWN, ie.CORPUS_REGS, unresolved,
        )
        self.assertIn('data-target="sec-p192-192.605-(b)-(1)"', out)

    def test_part_linker_is_only_used_for_part_documents(self):
        unresolved = defaultdict(Counter)
        out = ie.link_citations(
            "see § 60.5397b(a)", "oooob", "sec-oooob-60.5390b", "sec-oooob-60.5390b",
            {"sec-oooob-60.5397b"}, ie.CORPUS_REGS, unresolved,
        )
        self.assertIn('data-target="sec-oooob-60.5397b"', out)




class PartCliXmlPathTests(unittest.TestCase):
    """The Import workflow always passes `--pdf <BASENAME>.pdf --txt
    <BASENAME>.txt`. A whole-part reg reads only the XML, so the .pdf/.txt
    need not exist (P192.pdf may never be in the repo) -- the .xml path is
    derived from whichever of them was given, and --xml overrides."""

    class _Args:
        def __init__(self, xml=None, pdf=None, txt=None):
            self.xml, self.pdf, self.txt = xml, pdf, txt

    def test_derived_from_pdf(self):
        self.assertEqual(
            ie.part_xml_path(self._Args(pdf="pipeline/sources/P192.pdf")),
            os.path.join("pipeline", "sources", "P192.xml"),
        )

    def test_derived_from_txt_when_only_txt_is_given(self):
        self.assertEqual(
            ie.part_xml_path(self._Args(txt="pipeline/sources/P191.txt")),
            os.path.join("pipeline", "sources", "P191.xml"),
        )

    def test_explicit_xml_overrides(self):
        self.assertEqual(
            ie.part_xml_path(self._Args(xml="a/b.xml", pdf="c/d.pdf")), "a/b.xml"
        )

    def test_none_when_nothing_is_given(self):
        self.assertIsNone(ie.part_xml_path(self._Args()))

    def test_full_cli_parse_with_workflow_style_args_and_no_pdf_on_disk(self):
        import tempfile

        import shutil

        if not os.path.exists(P192_XML):
            self.skipTest("P192.xml not present")
        # The point of this test is that the workflow passes --pdf/--txt for
        # EVERY reg and a whole-part reg must parse with neither file on disk.
        # A full checkout may or may not carry P192.pdf (Batch B's does), so
        # the XML is copied into an empty temp dir and --pdf is pointed there:
        # the .pdf/.txt siblings are then guaranteed absent whatever the repo
        # holds, and the path-derivation is still what is under test.
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "P192.xml")
            shutil.copyfile(P192_XML, src)
            self.assertFalse(os.path.exists(os.path.join(tmp, "P192.pdf")))
            self.assertFalse(os.path.exists(os.path.join(tmp, "P192.txt")))
            out = os.path.join(tmp, "p192_parsed.json")
            ie.cmd_parse(
                _WorkflowArgs(
                    reg="p192",
                    pdf=os.path.join(tmp, "P192.pdf"),   # does not exist
                    txt=os.path.join(tmp, "P192.txt"),   # does not exist
                    out=out,
                )
            )
            self.assertTrue(os.path.exists(out))


class _WorkflowArgs:
    def __init__(self, reg, pdf, txt, out, xml=None):
        self.reg, self.pdf, self.txt, self.out, self.xml = reg, pdf, txt, out, xml


class _PartRowInvariantsMixin:
    """Two invariants every whole-part row must satisfy. Mixed into both
    full-parse cases so they run over the real p191 and p192 parses."""

    SELF_LINK_RE = re.compile(r'data-(?:target|provision-id)="([^"]+)"')

    def test_no_row_links_to_itself(self):
        offenders = []
        for r in self.rows:
            if r["id"] in set(self.SELF_LINK_RE.findall(r["full_text"])):
                offenders.append(r["id"])
        self.assertEqual(offenders, [], f"{len(offenders)} row(s) link to their own id")

    def test_section_heading_rows_carry_plain_heading_text(self):
        """A section whose body is entirely in its children renders as the
        printed heading, plain -- no <p>, no markup, no xref -- exactly like
        the JJJJ/ZZZZ path's "§ 60.4230 Am I subject to this subpart?"."""
        checked = 0
        for r in self.rows:
            if r["kind"] != "section" or "<p>" in r["full_text"]:
                continue
            checked += 1
            self.assertEqual(r["full_text"], r["title"], r["id"])
            self.assertNotIn("<", r["full_text"], r["id"])
        self.assertGreater(checked, 0)


class P191FullParseTests(_PartRowInvariantsMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(P191_XML):
            raise unittest.SkipTest("P191.xml not present")
        cls.rows, cls.rep = ie.parse_ecfr_part("p191", P191_XML)

    def test_root_row(self):
        r = self.rows[0]
        self.assertEqual(r["id"], "sec-p191-top-REG-p191")
        self.assertEqual(r["citation"], "49 CFR Part 191")
        self.assertEqual(r["kind"], "root")
        self.assertIsNone(r["parent_id"])

    def test_fifteen_sections_and_one_appendix_hang_off_the_root(self):
        top = [r for r in self.rows if r["parent_id"] == "sec-p191-top-REG-p191"]
        self.assertEqual(sum(1 for r in top if r["kind"] == "section"), 15)
        self.assertEqual(sum(1 for r in top if r["kind"] == "appendix"), 1)
        self.assertEqual(self.rep["subparts"], [])   # Part 191 has no subparts

    def test_no_orphans_no_duplicates_no_label_anomalies(self):
        ids = {r["id"] for r in self.rows}
        self.assertEqual(len(ids), len(self.rows))
        self.assertFalse([r for r in self.rows if r["parent_id"] and r["parent_id"] not in ids])
        self.assertEqual(self.rep["label_anomalies"], [])
        self.assertEqual(self.rep["dead_targets"], [])

    def test_definitions_and_reserved(self):
        self.assertEqual(self.rep["n_definitions"], 17)
        self.assertEqual(self.rep["reserved"], ["§ 191.12"])


class P192FullParseTests(_PartRowInvariantsMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(P192_XML):
            raise unittest.SkipTest("P192.xml not present")
        cls.rows, cls.rep = ie.parse_ecfr_part("p192", P192_XML)

    def test_sixteen_subparts_then_seven_appendices_in_order(self):
        top = [r for r in self.rows if r["parent_id"] == "sec-p192-top-REG-p192"]
        self.assertEqual(
            [r["citation"] for r in top],
            [f"Subpart {c}" for c in "ABCDEFGHIJKLMNOP"]
            + [f"Appendix {c} to Part 192" for c in "ABCDEFG"],
        )

    def test_267_sections_and_every_subpart_section_list_matches_the_xml(self):
        import xml.etree.ElementTree as ET

        root = ET.parse(P192_XML).getroot()
        for div6 in root:
            if div6.tag != "DIV6":
                continue
            expected = [d.get("N") for d in div6 if d.tag == "DIV8"]
            self.assertEqual(self.rep["sections_by_subpart"][div6.get("N")], expected)
        self.assertEqual(self.rep["n_sections"], 267)

    def test_no_orphans_no_duplicates_no_label_anomalies_no_dead_targets(self):
        ids = {r["id"] for r in self.rows}
        self.assertEqual(len(ids), len(self.rows))
        self.assertFalse([r for r in self.rows if r["parent_id"] and r["parent_id"] not in ids])
        self.assertEqual(self.rep["label_anomalies"], [])
        self.assertEqual(self.rep["duplicate_ids"], [])
        self.assertEqual(self.rep["dead_targets"], [])

    def test_all_seventeen_reserved_markers_survive_as_rows(self):
        reserved_rows = [r for r in self.rows if "[Reserved]" in r["full_text"]]
        self.assertEqual(len(reserved_rows), 17)
        self.assertIn("sec-p192-APPENDIX-A", {r["id"] for r in reserved_rows})
        self.assertIn("sec-p192-192.117-192.119", {r["id"] for r in reserved_rows})

    def test_thirty_one_tables_are_inline_and_nine_images_are_placeholders(self):
        self.assertEqual(len(self.rep["tables"]), 31)
        self.assertEqual(len(self.rep["images"]), 9)
        self.assertFalse([r for r in self.rows if "-TABLE-" in r["id"]])

    def test_editorial_elements_are_stripped(self):
        self.assertEqual(self.rep["stripped"]["CITA"], 206)
        self.assertEqual(self.rep["stripped"]["EDNOTE"], 5)
        joined = " ".join(r["full_text"] for r in self.rows)
        self.assertNotIn("Amdt. 192-27", joined)

    def test_the_192_7_i_paragraph_is_top_level_not_nested_under_h(self):
        byid = {r["id"]: r for r in self.rows}
        self.assertIn("sec-p192-192.7-(i)", byid)
        self.assertIn("sec-p192-192.7-(j)", byid)
        self.assertNotIn("sec-p192-192.7-(h)-(2)-(i)", byid)

    def test_192_121_b_splits_its_heading_from_its_first_item(self):
        byid = {r["id"]: r for r in self.rows}
        self.assertEqual(
            byid["sec-p192-192.121-(b)"]["full_text"],
            "<p><i>General requirements for plastic pipe and components.</i></p>",
        )
        self.assertIn("Except as provided", byid["sec-p192-192.121-(b)-(1)"]["full_text"])


# ---------------------------------------------------------------------------
# Batch B: 49 CFR Parts 194, 195 and 199
# ---------------------------------------------------------------------------


class BatchBPartMetaTests(unittest.TestCase):
    EXPECTED = {
        "p194": (194, "49 CFR Part 194",
                 "49 CFR Part 194 — Response Plans for Onshore Oil Pipelines",
                 "https://www.ecfr.gov/current/title-49/part-194"),
        "p195": (195, "49 CFR Part 195",
                 "49 CFR Part 195 — Transportation of Hazardous Liquids by Pipeline",
                 "https://www.ecfr.gov/current/title-49/part-195"),
        "p199": (199, "49 CFR Part 199",
                 "49 CFR Part 199 — Drug and Alcohol Testing",
                 "https://www.ecfr.gov/current/title-49/part-199"),
    }

    def test_meta_shape(self):
        for key, (part, cite, title, url) in self.EXPECTED.items():
            meta = ie.SUBPART_META[key]
            self.assertEqual(meta["title"], 49, key)
            self.assertEqual(meta["part"], part, key)
            self.assertEqual(meta["document"], "part", key)
            self.assertEqual(meta["source"], "xml", key)
            self.assertEqual(meta["table_algorithm"], "xml", key)
            self.assertFalse(meta["enable_table_ref_links"], key)
            self.assertEqual(meta["root_citation"], cite, key)
            self.assertEqual(meta["root_title"], title, key)
            self.assertEqual(meta["url"], url, key)
            self.assertTrue(meta["has_subparts"], key)

    def test_all_three_are_in_the_corpus(self):
        for key in self.EXPECTED:
            self.assertIn(key, ie.CORPUS_REGS)
            self.assertEqual(ie.ECFR_URL[key], self.EXPECTED[key][3])

    def test_root_titles_match_the_printed_div5_head(self):
        import xml.etree.ElementTree as ET

        for key, xmlp in (("p194", P194_XML), ("p195", P195_XML), ("p199", P199_XML)):
            if not os.path.exists(xmlp):
                self.skipTest(f"{xmlp} not present")
            root = ET.parse(xmlp).getroot()
            div5 = [d for d in root.iter("DIV5") if d.get("TYPE") == "PART"][0]
            head = re.sub(r"\s+", " ", "".join(div5.find("HEAD").itertext())).strip()
            # "PART 195—TRANSPORTATION OF HAZARDOUS LIQUIDS BY PIPELINE"
            printed = head.split("—", 1)[1].lower()
            stored = ie.SUBPART_META[key]["root_title"].split(" — ", 1)[1].lower()
            self.assertEqual(stored, printed, key)

    def test_flat_appendices_and_inline_definition_sections_are_declared(self):
        self.assertEqual(ie.PART_FLAT_APPENDICES["p194"], {"A"})
        self.assertEqual(ie.PART_FLAT_APPENDICES["p195"], {"C"})
        self.assertEqual(ie.PART_FLAT_APPENDICES["p192"], {"D"})
        self.assertEqual(ie.PART_INLINE_DEFINITION_SECTIONS["p195"], {"195.6"})
        # no-op for every other whole-part reg
        self.assertEqual(ie.PART_INLINE_DEFINITION_SECTIONS.get("p192", set()), set())


class PartSubjectGroupTests(unittest.TestCase):
    """<DIV7 TYPE="SUBJGRP"> is a printed centre-heading inside a subpart. Its
    sections must reach the parse, flattened into the enclosing subpart."""

    XML = """<DIV5 TYPE="PART" N="195"><HEAD>PART 195—X</HEAD>
      <DIV6 TYPE="SUBPART" N="F"><HEAD>Subpart F—Operation</HEAD>
        <DIV8 TYPE="SECTION" N="195.401"><HEAD>§ 195.401 General.</HEAD><P>(a) Text one.</P></DIV8>
        <DIV7 TYPE="SUBJGRP" N="ECFR1"><HEAD>Pipeline Integrity Management</HEAD>
          <DIV8 TYPE="SECTION" N="195.452"><HEAD>§ 195.452 IM.</HEAD><P>(a) Text two.</P></DIV8>
        </DIV7>
      </DIV6></DIV5>"""

    def setUp(self):
        import tempfile

        self.tmp = tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-8")
        self.tmp.write(self.XML)
        self.tmp.close()
        self.rows, self.rep = ie.parse_ecfr_part("p195", self.tmp.name)

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_the_nested_section_is_a_row_under_its_subpart(self):
        byid = {r["id"]: r for r in self.rows}
        self.assertIn("sec-p195-195.452", byid)
        self.assertEqual(byid["sec-p195-195.452"]["parent_id"], "sec-p195-PART-F")
        self.assertEqual(byid["sec-p195-195.452"]["kind"], "section")

    def test_section_order_follows_the_document(self):
        self.assertEqual(self.rep["sections_by_subpart"]["F"], ["195.401", "195.452"])

    def test_the_group_heading_is_reported_not_rowed(self):
        self.assertEqual(
            self.rep["subject_groups"],
            [{"subpart": "F", "heading": "Pipeline Integrity Management",
              "sections": ["195.452"]}],
        )
        self.assertFalse([r for r in self.rows if "SUBJGRP" in r["id"]])

    def test_no_subjgrp_in_the_other_four_parts(self):
        import xml.etree.ElementTree as ET

        for xmlp in (P191_XML, P192_XML, P194_XML, P199_XML):
            if not os.path.exists(xmlp):
                continue
            self.assertEqual(ET.parse(xmlp).getroot().findall(".//DIV7"), [], xmlp)


class PartInlineDefinitionBlockTests(unittest.TestCase):
    """§ 195.6(c) prints a definition block inside a section whose own heading
    says nothing about definitions."""

    XML = """<DIV5 TYPE="PART" N="195"><HEAD>PART 195—X</HEAD>
      <DIV6 TYPE="SUBPART" N="A"><HEAD>Subpart A—General</HEAD>
        <DIV8 TYPE="SECTION" N="195.6"><HEAD>§ 195.6 Unusually Sensitive Areas (USAs).</HEAD>
          <P>(a) An USA drinking water resource is:</P>
          <P>(b) An USA ecological resource is a coastal beach.</P>
          <P>(c) Definitions used in this part—</P>
          <P><I>Class I Aquifer</I> means an aquifer that is shallow.</P>
          <P>(1) Unconsolidated Aquifers (Class Ia) that consist of alluvium.</P>
          <P><I>Coastal beach</I> means any land between the marks.</P>
          <P><I>Terrestrial species with a limited range means</I> a non-aquatic animal.</P>
        </DIV8>
      </DIV6></DIV5>"""

    def setUp(self):
        import tempfile

        self.tmp = tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-8")
        self.tmp.write(self.XML)
        self.tmp.close()
        self.rows, self.rep = ie.parse_ecfr_part("p195", self.tmp.name)
        self.byid = {r["id"]: r for r in self.rows}

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_one_row_per_term_hanging_off_the_chapeau(self):
        for slug, term in (
            ("class-i-aquifer", "Class I Aquifer"),
            ("coastal-beach", "Coastal beach"),
            ("terrestrial-species-with-a-limited-range",
             "Terrestrial species with a limited range"),
        ):
            row = self.byid[f"sec-p195-195.6-{slug}"]
            self.assertEqual(row["kind"], "definition")
            self.assertEqual(row["citation"], f"§ 195.6 “{term}”")
            self.assertEqual(row["parent_id"], "sec-p195-195.6-(c)")

    def test_a_terms_numbered_subparagraph_folds_into_its_own_row(self):
        row = self.byid["sec-p195-195.6-class-i-aquifer"]
        self.assertIn("Unconsolidated Aquifers", row["full_text"])
        self.assertNotIn("sec-p195-195.6-(c)-(1)", self.byid)

    def test_labelled_paragraphs_before_the_block_are_untouched(self):
        self.assertEqual(self.byid["sec-p195-195.6-(a)"]["kind"], "item")

    def test_the_same_shape_is_inert_in_a_section_that_did_not_opt_in(self):
        xml = self.XML.replace('N="195.6"', 'N="195.7"').replace("§ 195.6", "§ 195.7")
        import tempfile

        with tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-8") as f:
            f.write(xml)
            name = f.name
        try:
            rows, _ = ie.parse_ecfr_part("p195", name)
        finally:
            os.unlink(name)
        self.assertFalse([r for r in rows if r["kind"] == "definition"])


class PartFootnoteTests(unittest.TestCase):
    """<FTNT> under a section carries substantive rule text (§ 195.563) and is
    kept, unlike <CITA>/<EDNOTE>."""

    XML = """<DIV5 TYPE="PART" N="195"><HEAD>PART 195—X</HEAD>
      <DIV6 TYPE="SUBPART" N="H"><HEAD>Subpart H—Corrosion</HEAD>
        <DIV8 TYPE="SECTION" N="195.563"><HEAD>§ 195.563 Cathodic protection.</HEAD>
          <P>(a) Each buried pipeline must have cathodic protection.</P>
          <FTNT><P>1 A pipeline does not have an effective external coating material.</P></FTNT>
          <CITA>[Amdt. 195-1, 1 FR 1]</CITA>
        </DIV8>
      </DIV6></DIV5>"""

    def setUp(self):
        import tempfile

        self.tmp = tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-8")
        self.tmp.write(self.XML)
        self.tmp.close()
        self.rows, self.rep = ie.parse_ecfr_part("p195", self.tmp.name)

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_footnote_text_survives_and_the_citation_does_not(self):
        joined = " ".join(r["full_text"] for r in self.rows)
        self.assertIn("effective external coating material", joined)
        self.assertIn('class="footnote"', joined)
        self.assertNotIn("Amdt. 195-1", joined)
        self.assertEqual(self.rep["stripped"]["CITA"], 1)
        self.assertEqual(len(self.rep["footnotes"]), 1)


class _BatchBFullParseMixin(_PartRowInvariantsMixin):
    def test_no_orphans_no_duplicates_no_anomalies_no_dead_targets(self):
        ids = {r["id"] for r in self.rows}
        self.assertEqual(len(ids), len(self.rows))
        self.assertFalse([r for r in self.rows if r["parent_id"] and r["parent_id"] not in ids])
        self.assertEqual(self.rep["label_anomalies"], [])
        self.assertEqual(self.rep["duplicate_ids"], [])
        self.assertEqual(self.rep["dead_targets"], [])

    def test_every_subpart_section_list_equals_the_xml(self):
        import xml.etree.ElementTree as ET

        root = ET.parse(self.XMLP).getroot()
        for div6 in root:
            if div6.tag != "DIV6":
                continue
            expected = []
            for x in div6:
                if x.tag == "DIV8":
                    expected.append(x.get("N"))
                elif x.tag == "DIV7":
                    expected.extend(y.get("N") for y in x if y.tag == "DIV8")
            self.assertEqual(self.rep["sections_by_subpart"][div6.get("N")], expected)
        self.assertEqual(self.rep["n_sections"], len(root.findall(".//DIV8")))

    def test_root_row(self):
        r = self.rows[0]
        self.assertEqual(r["id"], f"sec-{self.REG}-top-REG-{self.REG}")
        self.assertEqual(r["kind"], "root")
        self.assertIsNone(r["parent_id"])
        self.assertEqual(r["citation"], ie.SUBPART_META[self.REG]["root_citation"])

    def test_definition_section_produced_definition_rows(self):
        own = [r for r in self.rows
               if r["kind"] == "definition" and r["id"].startswith(f"sec-{self.REG}-{self.DEF_SECTION}-")]
        self.assertGreaterEqual(len(own), 10)
        for r in own:
            self.assertTrue(r["citation"].startswith(f"§ {self.DEF_SECTION} “"), r["id"])


class P194FullParseTests(_BatchBFullParseMixin, unittest.TestCase):
    REG, XMLP, DEF_SECTION = "p194", P194_XML, "194.5"

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(P194_XML):
            raise unittest.SkipTest("P194.xml not present")
        cls.rows, cls.rep = ie.parse_ecfr_part("p194", P194_XML)

    def test_two_subparts_then_two_appendices(self):
        top = [r for r in self.rows if r["parent_id"] == "sec-p194-top-REG-p194"]
        self.assertEqual(
            [r["citation"] for r in top],
            ["Subpart A", "Subpart B",
             "Appendix A to Part 194", "Appendix B to Part 194"],
        )

    def test_counts(self):
        self.assertEqual(self.rep["n_sections"], 15)
        self.assertEqual(self.rep["n_definitions"], 24)
        self.assertEqual(len(self.rep["tables"]), 3)
        self.assertEqual(self.rep["reserved"], [])

    def test_appendix_a_is_deliberately_one_row(self):
        self.assertIn("one row", self.rep["appendix_modes"]["A"])
        self.assertIn("one row", self.rep["appendix_modes"]["B"])

    def test_it_links_into_part_195(self):
        joined = " ".join(r["full_text"] for r in self.rows)
        self.assertIn('href="/regulations/p195"', joined)


class P195FullParseTests(_BatchBFullParseMixin, unittest.TestCase):
    REG, XMLP, DEF_SECTION = "p195", P195_XML, "195.2"

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(P195_XML):
            raise unittest.SkipTest("P195.xml not present")
        cls.rows, cls.rep = ie.parse_ecfr_part("p195", P195_XML)

    def test_eight_subparts_then_three_appendices_in_order(self):
        top = [r for r in self.rows if r["parent_id"] == "sec-p195-top-REG-p195"]
        self.assertEqual(
            [r["citation"] for r in top],
            [f"Subpart {c}" for c in "ABCDEFGH"]
            + [f"Appendix {c} to Part 195" for c in "ABC"],
        )

    def test_all_148_sections_including_the_three_inside_subject_groups(self):
        self.assertEqual(self.rep["n_sections"], 148)
        byid = {r["id"] for r in self.rows}
        for n in ("195.450", "195.452", "195.454"):
            self.assertIn(f"sec-p195-{n}", byid)
        self.assertEqual(
            [g["heading"] for g in self.rep["subject_groups"]],
            ["High Consequence Areas", "Pipeline Integrity Management"],
        )

    def test_195_452_h_4_i_is_a_roman_subitem_not_a_top_level_paragraph(self):
        """The section has BOTH an (h)(1)(i)/(ii) roman pair and a genuine
        top-level (i); the label stack must not confuse them."""
        byid = {r["id"] for r in self.rows}
        self.assertIn("sec-p195-195.452-(h)-(1)-(i)", byid)
        self.assertIn("sec-p195-195.452-(h)-(1)-(ii)", byid)
        self.assertIn("sec-p195-195.452-(h)-(4)-(i)-(A)", byid)
        self.assertIn("sec-p195-195.452-(i)", byid)
        self.assertIn("sec-p195-195.452-(j)", byid)

    def test_reserved_rows_and_tables(self):
        self.assertEqual(self.rep["reserved"], ["§§ 195.236-195.244", "§ 195.415"])
        byid = {r["id"]: r for r in self.rows}
        self.assertEqual(byid["sec-p195-195.415"]["full_text"], "<p>[Reserved]</p>")
        self.assertEqual(len(self.rep["tables"]), 19)
        self.assertFalse([r for r in self.rows if "-TABLE-" in r["id"]])

    def test_195_6_definition_block(self):
        defs = [r for r in self.rows
                if r["kind"] == "definition" and r["id"].startswith("sec-p195-195.6-")]
        self.assertEqual(len(defs), 27)
        self.assertNotIn("sec-p195-195.6-(c)-(4)", {r["id"] for r in self.rows})


class P199FullParseTests(_BatchBFullParseMixin, unittest.TestCase):
    REG, XMLP, DEF_SECTION = "p199", P199_XML, "199.3"

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(P199_XML):
            raise unittest.SkipTest("P199.xml not present")
        cls.rows, cls.rep = ie.parse_ecfr_part("p199", P199_XML)

    def test_three_subparts_and_no_appendices(self):
        top = [r for r in self.rows if r["parent_id"] == "sec-p199-top-REG-p199"]
        self.assertEqual([r["citation"] for r in top], ["Subpart A", "Subpart B", "Subpart C"])
        self.assertFalse([r for r in self.rows if r["kind"] == "appendix"])

    def test_counts_and_reserved(self):
        self.assertEqual(self.rep["n_sections"], 40)
        self.assertEqual(self.rep["n_definitions"], 13)
        self.assertEqual(len(self.rep["tables"]), 0)
        self.assertEqual(
            self.rep["reserved"],
            ["§ 199.111", "§ 199.201", "§§ 199.203-199.205", "§ 199.213"],
        )

    def test_part_40_stays_out_of_corpus_but_part_192_links(self):
        joined = " ".join(r["full_text"] for r in self.rows)
        self.assertIn('href="/regulations/p192"', joined)
        self.assertNotIn('href="/regulations/p40"', joined)
        self.assertIn("part 40", dict(self.rep["unresolved"][ie.BUCKET_CFR]))


# ---------------------------------------------------------------------------
# Byte-identical baselines for ALL SIX existing eCFR subparts (proves the
# whole-part path is a no-op for every document already in the corpus)
# ---------------------------------------------------------------------------


class AllSixByteIdenticalBaselineTests(unittest.TestCase):
    CASES = [
        ("ooooa", "OOOOa"), ("oooob", "OOOOb"), ("ooooc", "OOOOc"),
        ("jjjj", "JJJJ"), ("iiii", "IIII"), ("zzzz", "ZZZZ"),
    ]

    def _check(self, reg, code):
        import json

        here = os.path.dirname(os.path.abspath(__file__))
        pdf = os.path.join(SOURCES, f"{code}.pdf")
        txt = os.path.join(SOURCES, f"{code}.txt")
        baseline = os.path.join(here, "out", f"{reg}_baseline.json")
        if not (os.path.exists(pdf) and os.path.exists(txt) and os.path.exists(baseline)):
            self.skipTest(f"{code} source or baseline files not present")
        rows, _ = ie.parse_ecfr(reg, pdf, txt)
        with open(baseline, encoding="utf-8") as f:
            expected = json.load(f)
        self.assertEqual(rows, expected, f"{reg} output diverged from its baseline")

    def test_jjjj_byte_identical(self):
        self._check("jjjj", "JJJJ")

    def test_iiii_byte_identical(self):
        self._check("iiii", "IIII")

    def test_zzzz_byte_identical(self):
        self._check("zzzz", "ZZZZ")

    def test_all_six_report_jsons_byte_identical(self):
        import json

        here = os.path.dirname(os.path.abspath(__file__))
        for reg, code in self.CASES:
            pdf = os.path.join(SOURCES, f"{code}.pdf")
            txt = os.path.join(SOURCES, f"{code}.txt")
            baseline = os.path.join(here, "out", f"{reg}_baseline_report.json")
            if not (os.path.exists(pdf) and os.path.exists(txt) and os.path.exists(baseline)):
                self.skipTest(f"{code} source or baseline report not present")
            _, report = ie.parse_ecfr(reg, pdf, txt)
            serializable = dict(report)
            serializable["unresolved"] = {
                b: sorted(c.items(), key=lambda kv: -kv[1]) for b, c in report["unresolved"].items()
            }
            with open(baseline, encoding="utf-8") as f:
                expected = json.load(f)
            self.assertEqual(
                json.loads(json.dumps(serializable, ensure_ascii=False)),
                expected,
                f"{reg} report diverged from its baseline",
            )


if __name__ == "__main__":
    unittest.main()
