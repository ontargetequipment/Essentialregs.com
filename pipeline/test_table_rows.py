"""Table continuation rows (pipeline/table_rows.py, Sprint 7, 11 Oct 2026).

The synthetic tables are the rows the extractor actually returned for the
tables named, copied from the parse of the committed sources; the last
class parses GP05 from its PDF and checks Table 2 in VI.D end to end."""
from __future__ import annotations

import re
import unittest
from functools import lru_cache
from pathlib import Path

import table_rows as tr
from table_rows import merge_continuation_rows

SOURCES = Path(__file__).resolve().parent / "sources"

# GP05 VI.D, Table 2, as pdfplumber returns it: the first and last body rows
# each wrapped onto a second printed line that came back as its own row.
GP05_VI_D_TABLE_2 = [
    ["Effective Date of\nRegistration2", "Classification", "Permitted VOC\nEmissions", "Frequency"],
    ["Prior to", "Any", "Any", "Every 5"],
    ["Issuance 5", "", "", "years"],
    ["On or after Issuance 5", "Marginal/Moderate Ozone Non-\nAttainment", "Less than 90 TPY", "Every 5 years"],
    ["On or after Issuance 5", "Marginal/Moderate Ozone Non-\nAttainment", "Greater than or equal to 90 TPY", "Annually"],
    ["On or after Issuance 5", "Serious Ozone Non-Attainment", "Less than 40 TPY", "Every 5 years"],
    ["On or after Issuance 5", "Serious Ozone Non-Attainment", "Greater than or equal to 40 TPY", "Annually"],
    ["On or after Issuance 5", "Severe Ozone Non-\nAttainment", "Less than 15 TPY", "Every 5 years"],
    ["On or after", "Severe Ozone Non-", "Greater", "Annually"],
    ["Issuance 5", "Attainment", "than or equal to 15 TPY", ""],
]


def flat(rows):
    return [[re.sub(r"\s+", " ", (c or "")).strip() for c in r] for r in rows]


class Gp05VIDTableTests(unittest.TestCase):
    def test_four_header_columns_and_seven_body_rows(self):
        out = merge_continuation_rows(GP05_VI_D_TABLE_2)
        self.assertEqual(len(out[0]), 4)
        self.assertEqual(len(out) - 1, 7)

    def test_the_two_wrapped_rows_read_as_printed(self):
        out = flat(merge_continuation_rows(GP05_VI_D_TABLE_2))
        self.assertEqual(out[1], ["Prior to Issuance 5", "Any", "Any", "Every 5 years"])
        self.assertEqual(out[7], ["On or after Issuance 5", "Severe Ozone Non- Attainment",
                                  "Greater than or equal to 15 TPY", "Annually"])

    def test_every_other_row_is_untouched(self):
        out = merge_continuation_rows(GP05_VI_D_TABLE_2)
        self.assertEqual(out[0], GP05_VI_D_TABLE_2[0])
        self.assertEqual(out[2:7], GP05_VI_D_TABLE_2[3:8])

    def test_no_word_is_lost_or_reordered_within_a_column(self):
        out = merge_continuation_rows(GP05_VI_D_TABLE_2)
        for col in range(4):
            before = " ".join((r[col] or "") for r in GP05_VI_D_TABLE_2).split()
            after = " ".join((r[col] or "") for r in out).split()
            self.assertEqual(before, after)

    def test_input_is_not_modified(self):
        rows = [list(r) for r in GP05_VI_D_TABLE_2]
        merge_continuation_rows(rows)
        self.assertEqual(rows, GP05_VI_D_TABLE_2)


class LegitimateBlankCellTests(unittest.TestCase):
    """Rows with a blank cell that are rows of the table, not wrapped lines."""

    def assertUnchanged(self, rows):
        self.assertEqual(merge_continuation_rows(rows), rows)

    def test_spanned_class_with_a_second_date_does_not_merge(self):
        # GP02 Attachment A 5.3 (and GP12 Attachment A 7.3.1): the blank
        # horsepower cell is spanned from the row above.
        self.assertUnchanged([
            ["Max Engine (HP)", "Construction or Relocation Date", "NOX (g/hp-hr)", "CO (g/hp-hr)", "VOC (g/hp-hr)"],
            ["100≤hp<500", "January 1, 2008", "2.0", "4.0", "1.0"],
            ["", "January 1, 2011", "1.0", "2.0", "0.7"],
            ["500<hp", "July 1, 2007", "2.0", "4.0", "1.0"],
            ["", "July 1, 2010", "1.0", "2.0", "0.7"],
        ])

    def test_category_heading_with_no_value_does_not_merge(self):
        # Regulation 21 II.F: "Specialty coatings" has no limit of its own.
        self.assertUnchanged([
            ["Coating category", "VOC limit (g/l)"],
            ["Nonflat – high gloss coatings", "150"],
            ["Specialty coatings", ""],
            ["* Aluminum roof", "450"],
        ])

    def test_mostly_empty_sub_header_does_not_merge(self):
        # Regulation 26 I.D.5.b.(v)(B): a spanned sub-header under the dates.
        self.assertUnchanged([
            ["", "May 1, 2022", "May 1, 2023", "May 1, 2024"],
            ["", "Percent (%) of engines that must comply with Table 2 limits", "", ""],
            ["Outside the 8- Hour Ozone Control Area only", "At least 20%", "At least 40%", "At least 60%"],
        ])

    def test_units_row_under_the_header_does_not_merge(self):
        # 49 CFR 192.327(a).
        self.assertUnchanged([
            ["Location", "Normal soil", "Consolidated rock"],
            ["Inches (Millimeters)", "", ""],
            ["Class 1 locations", "30 (762)", "18 (457)"],
        ])

    def test_a_blank_cell_above_is_never_continued(self):
        self.assertUnchanged([
            ["Unit", "Limit", "Note"],
            ["Boiler 1", "", "see below"],
            ["", "ppm by volume", ""],
        ])

    def test_a_list_marker_starts_a_new_row(self):
        self.assertUnchanged([
            ["Item", "Requirement"],
            ["1. Tanks", "Inspect the"],
            ["", "a. thief hatch"],
        ])

    def test_one_stray_cell_under_the_header_does_not_merge(self):
        # Regulation 23 IV.F.3, Table 3: the tail of a cell carried over from
        # the previous page, not a wrapped column title.
        self.assertUnchanged([
            ["Emission Unit", "NOx Emission Limit", "SO2 Emission Limit", "Particulate Emission Limit"],
            ["", "", "", "clinker S013 (Iron/Silica Feed Belt) – 0.0031 lb/ton of clinker"],
            ["Kiln", "1.5 lb/ton", "N/A", "N/A"],
        ])


class OtherContinuationTests(unittest.TestCase):
    def test_a_header_wrapped_in_several_columns_merges(self):
        # 40 CFR 60 Subpart OOOOa, Table 3 (the eCFR print's layout reader).
        out = flat(merge_continuation_rows([
            ["General provisions", "Subject of", "Applies to", "Explanation"],
            ["citation", "citation", "subpart?", ""],
            ["§ 60.1", "General applicability of the General Provisions", "Yes", ""],
        ]))
        self.assertEqual(out[0], ["General provisions citation", "Subject of citation", "Applies to subpart?",
                                  "Explanation"])
        self.assertEqual(len(out), 2)

    def test_a_hyphenated_number_range_merges(self):
        # Regulation 11 Appendix A 2.11(f).
        out = flat(merge_continuation_rows([
            ["Channel", "Range", "Accuracy"],
            ["", "1001-", "±80ppm"],
            ["", "2000", ""],
        ]))
        self.assertEqual(out, [["Channel", "Range", "Accuracy"], ["", "1001- 2000", "±80ppm"]])

    def test_a_three_line_wrap_merges_twice(self):
        out = flat(merge_continuation_rows([
            ["A", "B"],
            ["Tanks with", "Annually"],
            ["a capacity of", ""],
            ["more than 500 bbl", ""],
        ]))
        self.assertEqual(out, [["A", "B"], ["Tanks with a capacity of more than 500 bbl", "Annually"]])

    def test_a_row_with_no_text_is_dropped(self):
        out = merge_continuation_rows([
            ["", "1 year", "2 years"],
            ["GAC (renewal)", "$1,000.00", "$2,000.00"],
            ["", "", ""],
            [None, None, None],
        ])
        self.assertEqual(len(out), 2)

    def test_a_full_row_never_merges(self):
        rows = [["A", "B"], ["Prior to", "Every 5"], ["issuance", "years"]]
        self.assertEqual(merge_continuation_rows(rows), rows)

    def test_merges_are_logged(self):
        tr.TABLE_ROW_MERGES.clear()
        merge_continuation_rows(GP05_VI_D_TABLE_2, caption="Table 2")
        self.assertEqual([m["kind"] for m in tr.TABLE_ROW_MERGES], ["wrap", "wrap"])
        self.assertIn(("Prior to", "Issuance 5"), tr.TABLE_ROW_MERGES[0]["cells"])
        tr.TABLE_ROW_MERGES.clear()


@lru_cache(maxsize=None)
def _parse(reg: str):
    import import_ccr as ic
    base = reg.upper()
    return ic.parse_reg(reg, str(SOURCES / f"{base}.txt"), str(SOURCES / f"{base}.pdf"))


@unittest.skipUnless((SOURCES / "GP05.pdf").exists() and (SOURCES / "GP05.txt").exists(), "GP05 sources not committed")
class Gp05ParseTests(unittest.TestCase):
    """The importer, end to end, on the committed GP05 permit."""

    def table_of(self, pid: str) -> str:
        rows = {r["id"]: r for r in _parse("gp05")[0]}
        m = re.search(r'<table class="doc-table">.*?</table>', rows[pid]["full_text"], re.S)
        self.assertIsNotNone(m, pid)
        return m.group(0)

    def test_vi_d_table_2_has_four_columns_and_seven_body_rows(self):
        t = self.table_of("sec-gp05-VI-D")
        self.assertEqual(len(re.findall(r"<th>", t)), 4)
        body = re.search(r"<tbody>(.*)</tbody>", t, re.S).group(1)
        self.assertEqual(len(re.findall(r"<tr>", body)), 7)
        self.assertIn("<td>Prior to Issuance 5</td><td>Any</td><td>Any</td><td>Every 5 years</td>", body)
        self.assertIn("<td>On or after Issuance 5</td><td>Severe Ozone Non- Attainment</td>"
                      "<td>Greater than or equal to 15 TPY</td><td>Annually</td>", body)

    def test_iv_b_4_table_rows_read_as_printed(self):
        body = re.search(r"<tbody>(.*)</tbody>", self.table_of("sec-gp05-IV-B-4"), re.S).group(1)
        self.assertEqual(len(re.findall(r"<tr>", body)), 9)
        self.assertIn("<td>Greater than or equal to 80 TPY</td>", body)
        self.assertNotIn("<td></td><td></td><td>80 TPY</td>", body)

    def test_the_merges_are_in_the_parse_report(self):
        fixes = _parse("gp05")[5]
        notes = [f for f in fixes if "pipeline/table_rows.py" in f["note"]]
        self.assertEqual(len(notes), 4)


if __name__ == "__main__":
    unittest.main()
