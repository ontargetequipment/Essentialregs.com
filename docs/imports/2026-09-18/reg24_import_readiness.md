# Reg 24 — import readiness report

## Verdict: READY

## Regulation identity
- Title as printed (title page, sources/REG_24.txt lines 12-15): "REGULATION NUMBER 24 CONTROL OF EMISSIONS FROM VOLATILE ORGANIC COMPOUNDS AND PETROLEUM LIQUIDS STORAGE AND PETROLEUM PROCESSING AND REFINING", "5 CCR 1001-28".
- root_title set to: `CONTROL OF EMISSIONS FROM VOLATILE ORGANIC COMPOUNDS AND PETROLEUM LIQUIDS STORAGE AND PETROLEUM PROCESSING AND REFINING 5 CCR 1001-28` (omits the "REGULATION NUMBER 24" prefix, matching the Reg 3/6/8/26 convention).
- root_citation: `Code of Colorado Regulations . Regulation Number 24`.
- Effective date on the PDF: 06/14/2026 (per brief; Part C's newest SOB entry is "II. April 15-17, 2026 (Revisions to Part B, Section VI.)").
- Page count: 67 pages; 3,455 lines of pdftotext -layout output.
- Parts found: PART A (Applicability and General Provisions), PART B (Storage, Transfer, and Disposal of VOCs and Petroleum Liquids and Petroleum Processing and Refining), PART C (Statements of Basis, Specific Statutory Authority and Purpose). Three appendices: Appendix A (inside Part A), Appendix B and Appendix C (inside Part B).

## Row counts
- Total rows: 415 (root: 1, part: 3, section: 11, item: 397, appendix: 3).
- Rows per top-level owner: Part A subtree 86, Part B subtree 325, Part C subtree 3, root 1.
- Rows with >=25 words (get AI summaries): 201.
- Longest rows: sec-24-C-I (25,819 chars, Part C's first SOB entry, a narrative statement-of-basis document -- expected/legitimate), sec-24-C-II (16,151 chars, second SOB entry -- legitimate), sec-24-B-APPENDIX-B (4,841 chars), sec-24-B-APPENDIX-C (3,658 chars), sec-24-A-APPENDIX-A (1,778 chars). No fused-sibling rows (see gate D below for the one bug found and fixed along the way).

## Changes made to import_ccr.py (each one, one line, with the reason)
1. `CORPUS_REGS["24"] = "24"` -- registers Reg 24 so cross-references to/from it resolve.
2. `REG_META["24"] = {...}` -- standard state/CDPHE-APCD metadata, root_citation, and root_title (title-page text + CCR cite), matching the Reg 3/6/8/26 convention.
3. `SOB_PART_CONFIG["24"] = {"letter": "C", "top_family": "roman_seq", "top_opener_re": DATE_START_RE, "inner_items": False}` -- Part C is a bare-dated roman_seq sequence like Reg 26's, but with inner_items: False (see the bug this fixes, under gate D).
4. Added 10 new tests in test_import_ccr.py (Reg24MetaTests, Reg24SobPartTests, Reg24AppendixTests, Reg24FullParseTests) covering the CORPUS_REGS/REG_META entries, the inner_items: False fix (with a synthetic-lines regression test reproducing the exact wrapped-line bug), the appendix owner-part/id/parent-id mechanism, and end-to-end structure/no-duplicate/no-repeated-prefix/self-reference-link checks against the real source.

No other code paths needed changes: the ordinary Part/Section/Item cycle (CYCLE_AB), the appendix marker mechanism (`Appendix <Letter> <title>`, root-parented, owner-part-scoped id), the generic table-caption mechanism (TABLE_CAPTION_RE), and the generic "Regulation Number N" / "40 CFR Part 60[, Subpart X]" cross-reference resolvers all already handled everything Reg 24's text does, unmodified.

## Label fixes added
None. out/reg24_parsed_corrections.json reports label_fixes: [], anomalies: [] -- every label sequence in the source is clean (no misprinted/misnumbered labels found).

## Quality-gate results A-I

A. Structure check -- PASS. Parsed tree: Part A -> Sections I, II (+ Appendix A); Part B -> Sections I-VII (+ Appendices B, C); Part C -> 2 SOB entries. This matches the printed "Outline of Regulation" (sources/REG_24.txt lines 24-52) exactly, in order.

B. Coverage check -- PASS. Parsed full_text totals 17,561 words. The cleaned body text from the first "PART A" heading to end of document (which also includes the ~35-word Outline-of-Regulation TOC block, not itself parsed into any row) totals 17,918 words -- a ~2% gap fully explained by that TOC block plus normal HTML-tag/whitespace tokenization differences. No dropped text found.

C. Repeated-text heuristic -- PASS. Checked every row's paragraphs for a first-50-char prefix recurring >=3x within the same row. Zero hits (both before and after the gate-D fix below).

D. Giant/fused rows -- FLAG (found and fixed). Before the inner_items: False fix, Part C's first SOB entry produced a spurious child row sec-24-C-I-26 at 23,169 characters -- a fused-row bug identical in shape to the one already documented for Reg 2's Part C: entry I's own narrative wraps "...became a new Regulation Number\n26. The upstream oil and gas intensity..." onto a line start, and since "Number" is deliberately not in _label_position_plausible's disqualifying set, the wrapped "26." was accepted as a CYCLE_C_INNER digit marker and swallowed the rest of entry I's text. Setting inner_items: False for reg 24 (same as Reg 2/3/6) merges it back into sec-24-C-I as one row, which is now the longest row in the corpus at 25,819 characters -- legitimate, since it's one continuous statement-of-basis narrative document, not a fused set of sibling paragraphs. Confirmed fixed: sec-24-C-I-26 no longer exists in the parsed output, and the repeated-text heuristic (gate C) still reports zero hits.

E. Orphans and label anomalies -- PASS. No duplicate ids (415 unique ids for 415 rows). Every parent_id resolves to an existing row. Ran a contiguity check over every sibling group (roman/upper/lower/digit families): no gaps or jumps found anywhere in the document.

F. Statement-of-basis part -- PASS. Part C is the SOB part, top_family: "roman_seq" (2 entries: "I. April 20, 2023" at line 2563, "II. April 15-17, 2026 (Revisions to Part B, Section VI.)" at line 3115 -- both bare-dated, no "Adopted" keyword, same shape as Reg 26). Inner numbered lists do not cleanly restart as separate sub-items inside either entry (entry I has only the one spurious "26." fragment described above; entry II's own findings lists use upper-case paren-roman "(I)".."(XII)", which CYCLE_C_INNER never starts with), so inner_items: False keeps each entry as one undivided row -- confirmed both entries parsed to their own single row, in order.

G. Cross-references -- PASS with two notes.
- References to Reg 3 (2 mentions), Reg 7 (many), and Reg 22 (2 mentions) all link correctly (all three are already in CORPUS_REGS).
- References to regulations not yet in the corpus (Reg 23, 25, 27, 30) correctly land in the other_reg bucket (5 distinct, 10 mentions) -- expected, not a gap.
- "Common Provisions Regulation" does not appear anywhere in Reg 24's text (confirmed via grep) -- no bucket-until-cp-lands note needed for this reg.
- 40 CFR Part 60 (11 mentions, no subpart letter attached in any of them -- the brief's "Subparts K/Ka/Kb" mention does not occur in this source; the closest are bare 40 CFR Part 60 (March 23, 2021) style incorporation-by-reference citations and 40 CFR Part 60, Appendix A-... method citations) correctly lands in the cfr bucket.
- Note 1 (benign miscount, no code change): the unparseable bucket's bare "IV." and "V." hits (1 each) are not real cross-references -- they're Appendix B's own internal enumerated list headings ("IV. Type of Liquid Fill Connection", "V. Tank Truck Inspection") printed inside the appendix's undivided blob. Because Part B separately has real Sections IV and V, the tokenizer treats the appendix's own list numbers as citation-shaped and buckets them as "unparseable" rather than "historical" -- but nothing gets mis-linked; it's a bucket-classification quirk, not a broken link, and the same shape is plausible in any appendix elsewhere in the corpus that contains its own roman list.
- Note 2 (source-text inconsistency, no code change): sec-24-B-IV-D-4-b-(viii) cites "Section IV.D.2.a.(ii)(A)" (source line 1750), but no such subsection exists -- IV.D.2.a.(ii) has no lettered/paren children in the printed text (its own sub-item register only reaches (i)(A)-(i)(E)(4)). This reads as a drafting typo in the official CCR text (most likely intending IV.D.2.a.(i)(A), which is the actual 5-minute-pressure-test-time provision the surrounding sentence describes) and correctly lands in the unparseable bucket since the target doesn't exist. Flagged under "Things I could not resolve" below.

H. Tables -- PASS. One table in the source: "Table 1 - Allowable Cargo Tank Test Pressure or Vacuum Change" (source line 1539, inside sec-24-B-IV-D-2-a-(i)-(E)-(4)). Recovered cleanly via the existing generic TABLE_CAPTION_RE + pdfplumber mechanism (dash-separated caption, no new caption regex needed) -- 3-column, 4-data-row bordered table, rendered as `<div class="doc-table-wrap">...</div>` with all cell text intact and correctly attached to the provision whose text immediately precedes the caption line.

I. Tests -- PASS. python3 -m pytest -q test_import_ccr.py: 107 passed, 6 skipped (baseline for this checkout -- confirmed by running the pristine import_ccr.ORIGINAL.py + test_import_ccr.ORIGINAL.py against the same sources/ directory -- is also 97 passed / 6 skipped; my 10 new Reg-24 tests bring it to 107/6, all green). The 6 skips are unrelated to Reg 24 (missing sources/REG_9.txt / other not-yet-imported regs' fixtures).

## No-op proof (batch-3 three-baseline rule)
- sources/REG_1.pdf and sources/REG_2.pdf reparsed with the edited import_ccr.py are byte-identical to out/reg1_baseline.json / out/reg2_baseline.json (cmp clean). Reg 1/2 never mention "Regulation Number 24" or "Regulation 24" at all, so this is expected and unconditional.
- sources/REG_26.pdf reparsed with the edited import_ccr.py differs from out/reg26_baseline.json at exactly 2 rows (sec-26-A-I-C, sec-26-C-I) -- both mention Reg 24 by name.
  - (a) Byte-identity with Reg 24 temporarily removed: re-ran the parse against a copy of import_ccr.py with "24": "24" deleted from CORPUS_REGS (everything else unchanged) -- the Reg 26 output was then byte-identical to the baseline, confirming the only-with-24-present diff is caused solely by the CORPUS_REGS addition, nothing else in the patch.
  - (b) With Reg 24 present, the diff is provably link-only: diffed the two Reg 26 JSON files row by row. Exactly 2 rows differ, and both diffs are precisely the insertion of one `<a class="xref-external-reg" href="/regulations/24">Regulation Number 24</a>` link each, with everything else in those rows' text byte-identical:
    - sec-26-A-I-C: "...Regulation Number 7</a>, Regulation Number 24, Regulation Number 25, ..." -> "...Regulation Number 7</a>, <a class=\"xref-external-reg\" href=\"/regulations/24\">Regulation Number 24</a>, Regulation Number 25, ..."
    - sec-26-C-I: "...Part B</span> became Regulation Number 24; <span ...>Part C</span> became Regulation Number 25..." -> "...Part B</span> became <a class=\"xref-external-reg\" href=\"/regulations/24\">Regulation Number 24</a>; <span ...>Part C</span> became Regulation Number 25..."
  - Total new link count: 2 (5 examples requested by the brief is more than exist -- there are only 2 total, both shown above in full).

## Things I could not resolve
- sec-24-B-IV-D-4-b-(viii) cites "Section IV.D.2.a.(ii)(A)" (source line 1750), a target that does not exist in the printed text (see gate G, Note 2 above). This looks like an official-text typo, not a parser gap -- left as plain text in the unparseable bucket rather than guessed at.

## Anything the summarizer should be warned about for this regulation
- Nonattainment-area scoping: Appendix A ("Colorado Ozone Nonattainment or Attainment Maintenance Areas") lists specific counties/areas and dated attainment-status chronology; several Part B provisions apply only within these areas -- summaries should preserve the geographic scoping rather than generalizing to "statewide."
- Reid vapor pressure and other numeric thresholds: many provisions turn on precise numbers (e.g., true vapor pressure "greater than 0.3 kPa at 20C", "78 torr (1.5 psia)", "570 torr (11.0 psia)", tank capacities in liters/gallons, the Table 1 pressure/vacuum-change thresholds) -- the summarizer must keep these verbatim, not round or paraphrase them.
- Tank capacities as written: Table 1's capacity bands are printed in liters with gallon equivalents in parentheses (e.g., "9,464 or more (2,500 or more)") -- summaries should keep both units together, not drop one.
- "Division": Reg 24 uses "the Division" to mean CDPHE-APCD throughout (confirmed by context, e.g. "submit to the Division for approval") -- same convention as the rest of the AQCC corpus.
- Cross-reference to Common Provisions Regulation: does not occur anywhere in Reg 24's text -- no bucket-until-cp-lands follow-up is needed for this regulation specifically.
- Reorganization history in Part C: both SOB entries narrate the 2026 reorganization of former Regulation 7 into Regulations 24/25/26/27 and the Regulation 30 PTAC (priority toxic air contaminant) benzene-reduction rulemaking (HB22-1244 context) -- summarizers should not mistake this historical/legislative narrative for an operative requirement of Reg 24 itself.
- Appendix B/C are technical specification documents (drop-tube specs, vapor-hose sizing, nomograph references to "Attachment 1" which is not itself part of the parsed text) -- flag these as procedural/engineering criteria rather than general applicability provisions.
