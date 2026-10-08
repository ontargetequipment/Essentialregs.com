"""Unit tests for source_text_check's corpus-side checks (Oct 2026): a
table header repeated or fused inside the body, underscore runs in an
address, an equation lead-in running straight into "Where:"."""
import unittest

import source_text_check as stc


CLEAN_TABLE = (
    '<div class="doc-table-wrap"><table class="doc-table"><thead><tr><th>General<br/>provisions<br/>citation</th>'
    '<th>Subject of citation</th><th>Applies to<br/>subpart?</th><th>Explanation</th></tr></thead><tbody>'
    '<tr><td>§ 60.6</td><td>Review of plans</td><td>Yes.</td><td></td></tr>'
    '<tr><td>§ 60.7</td><td>Notification and record keeping</td><td>Yes</td><td>Except as specified.</td></tr>'
    '</tbody></table></div>'
)
FUSED_TABLE = (
    '<table class="doc-table"><thead><tr><th>General provisions citation</th><th>Subject of citation</th>'
    '<th>Applies to subpart?</th><th>Explanation</th></tr></thead><tbody>'
    '<tr><td>§ 60.6 General</td><td>Review of plans Subject of</td><td>Yes. Applies</td>'
    '<td>provisions citation citation to subpart? Explanation § 60.7</td></tr></tbody></table>'
)
REPEATED_TABLE = (
    '<table class="doc-table"><thead><tr><th>Pollutant</th><th>Limit</th><th>Units</th></tr></thead><tbody>'
    '<tr><td>NOx</td><td>2.0</td><td>g/hp-hr</td></tr>'
    '<tr><td>Pollutant</td><td>Limit</td><td>Units</td></tr></tbody></table>'
)


class RepeatedHeaderTests(unittest.TestCase):
    def test_clean_table_has_no_hits(self):
        self.assertEqual(stc.repeated_header_rows(CLEAN_TABLE), [])

    def test_fused_page_break_header_is_reported(self):
        hits = stc.repeated_header_rows(FUSED_TABLE)
        self.assertEqual(len(hits), 1)
        self.assertIn("fused", hits[0])

    def test_exact_repeat_of_the_header_row_is_reported(self):
        hits = stc.repeated_header_rows(REPEATED_TABLE)
        self.assertEqual(len(hits), 1)
        self.assertIn("repeated", hits[0])

    def test_a_two_word_header_cannot_fuse_falsely(self):
        # "Yes"/"No" style headers: too few words to count as fused
        html = ('<table><thead><tr><th>Yes</th><th>No</th></tr></thead><tbody>'
                '<tr><td>Yes or No</td><td>maybe</td></tr></tbody></table>')
        self.assertEqual(stc.repeated_header_rows(html), [])


class UnderscoreRunTests(unittest.TestCase):
    def test_doubled_underscores_in_an_address_are_reported(self):
        html = "<p>submit to Oil__and__Gas__PT@EPA.GOV unless posted at epa.gov/airquality/oilandgas/.</p>"
        self.assertEqual(stc.underscore_runs(html), ["Oil__and__Gas__PT@EPA.GOV"])

    def test_single_underscores_are_fine(self):
        self.assertEqual(stc.underscore_runs("<p>Oil_and_Gas_PT@EPA.GOV and https://a.b/c_d</p>"), [])

    def test_a_sic_marked_address_is_acknowledged(self):
        html = ('<p>to Oil____and____Gas____PT@EPA.GOV<span class="er-sic" title="x"> [sic]</span> unless</p>')
        self.assertEqual(stc.underscore_runs(html), [])

    def test_urls_are_checked_too(self):
        self.assertEqual(stc.underscore_runs("<p>see https://www.epa.gov/oil__gas/page</p>"),
                         ["https://www.epa.gov/oil__gas/page"])


class EquationGapTests(unittest.TestCase):
    def test_lead_in_straight_into_where_is_a_gap(self):
        html = "<p>The average sulfur feed rate (X) must be computed as follows:</p><p>Where:</p><p>X = …</p>"
        self.assertEqual(len(stc.equation_gaps(html)), 1)

    def test_using_equation_variants(self):
        for lead in ("using the following equation:", "using Equation 1 to paragraph (e)(1):",
                     "for each 24-hour period by:", "You must use the following equations:"):
            html = f"<p>{lead}</p><p>Where:</p>"
            self.assertEqual(len(stc.equation_gaps(html)), 1, lead)

    def test_an_ecfr_caption_alone_does_not_fill_the_gap(self):
        html = "<p>using the following equation:</p><p>Equation 1 to Paragraph (e)(1)</p><p>Where:</p>"
        self.assertEqual(len(stc.equation_gaps(html)), 1)

    def test_a_placeholder_or_transcription_closes_the_gap(self):
        html = ('<p>as follows:</p><p class="figure-omitted">Equation not reproduced here. See the official '
                'source: <a href="https://www.ecfr.gov/x">40 CFR 60.5413b(b)(4)</a>.</p><p>Where:</p>')
        self.assertEqual(stc.equation_gaps(html), [])
        html = ('<p>as follows:</p><div class="equation-block"><p class="er-note eq-note">Equation transcribed…</p>'
                '<figure class="equation"><div class="eq-math"><var>X</var> = <var>K</var></div>'
                '<pre class="eq-text">X = K</pre></figure></div><p>Where:</p>')
        self.assertEqual(stc.equation_gaps(html), [])


class CorpusChecksTests(unittest.TestCase):
    def test_hits_carry_the_row_id_and_kind(self):
        rows = [dict(id="sec-x-1", sort_order=10, full_text=FUSED_TABLE),
                dict(id="sec-x-2", sort_order=20, full_text="<p>as follows:</p><p>Where:</p>"),
                dict(id="sec-x-3", sort_order=30, full_text="<p>e-mail Oil__and__Gas__PT@EPA.GOV</p>")]
        kinds = [(d["id"], d["kind"]) for d in stc.corpus_checks(rows)]
        self.assertEqual(kinds, [("sec-x-1", "repeated_header"), ("sec-x-2", "equation_gap"),
                                 ("sec-x-3", "underscore_run")])


if __name__ == "__main__":
    unittest.main()
