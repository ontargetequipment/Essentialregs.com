# Reg 21 — import readiness report

## Verdict: READY WITH NOTES

All gates A–I pass; every note below is a documented source-print quirk (four
misprinted definition labels kept as printed, three page-seam paragraph fusions
inside the undivided Part C entries) — nothing structural.

## Regulation identity

- Title as printed on the PDF title page (REG_21.txt lines 17–20; the source
  prints a DOUBLE space after "21", normalized to one): "REGULATION NUMBER 21
  CONTROL OF VOLATILE ORGANIC COMPOUNDS FROM / CONSUMER PRODUCTS AND
  ARCHITECTURAL AND INDUSTRIAL MAINTENANCE COATINGS", then "5 CCR 1001-25".
- `root_title` (exact): `CONTROL OF VOLATILE ORGANIC COMPOUNDS FROM CONSUMER PRODUCTS AND ARCHITECTURAL AND INDUSTRIAL MAINTENANCE COATINGS 5 CCR 1001-25`
- `root_citation`: `Code of Colorado Regulations · Regulation Number 21`; `jurisdiction_level: state`, `issuing_body: CDPHE-APCD`, `source_url: https://cdphe.colorado.gov/aqcc-regulations`.
- Effective 02/14/2023 (SOS ruleVersionId 10677, ruleId 3303, per the brief; the Editor's Notes tail reads "New rule eff. 09/14/2019. Part A, Part B rules I A.2, I A.3, VI.NN-VI.UUU, Part C rule II eff. 02/14/2023."). 68 PDF pages, 4,136 pdftotext lines.
- Parts found: A "CONCERNING CONSUMER PRODUCTS", B "CONCERNING ARCHITECTURAL AND INDUSTRIAL MAINTENANCE COATINGS", C "STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE". Parts A and B each carry the same six sections (I Applicability, II Standards, III Container labeling, IV Reporting, V Test methods, VI Definitions). No appendices.

## Row counts

- Total rows: **509** (root 1, part 3, section 14, item 491).
- Per part: A **340** (Section VI definitions: 171 term rows + 45 sub-item rows), B **163** (Section VI: 73 term rows), C **2**.
- Rows with ≥25 words (get summaries): **318**.
- Longest row: `sec-21-C-I` (12,564 chars — the July 2019 statement of basis, one undivided entry by design); next `sec-21-A-II-O` (11,774 chars — the 180-row consumer-products Table 1 rendered as HTML), `sec-21-C-II` (11,405), `sec-21-B-II-F` (3,732 — the AIM Table 1 + footnote). Nothing else over 2,300.

## Changes made to import_ccr.py (each one line, with the reason)

New / changed config keys: `FAMILY_REGEX_MULTI_UPPER` + REG_META flag `multi_letter_labels` (new), `TABLE_CAPTION_SPANS` + `_spanned_caption_rows` (new), `ITEM_TABLE_SPLICE_MODE["21"]`, `SOB_PART_CONFIG["21"]`, `CORPUS_REGS["21"]`, `REG_META["21"]` (also sets the existing `seam_standalone_line_breaks`), `KNOWN_LABEL_FIXES["21"]` (11 entries), `KNOWN_LABEL_ANOMALIES["21"]` (4 entries).

1. `FAMILY_REGEX_MULTI_UPPER = dict(FAMILY_REGEX, upper=^([A-Z]{1,7})\.)` and a `multi_letter_labels` branch in `family_regex_for` — Part A's definitions labels run to SEVEN repeated letters ("VI.AAAAAAA." .. "VI.QQQQQQQ."); the triple-letter table (Reg 27) stops at three, so 100+ terms fused onto "VI.ZZZ.". Selected only for a reg with the REG_META flag (Reg 21 alone); the marker scan is the only consumer, exactly like the triple variant.
2. `TABLE_CAPTION_SPANS` + helper `_spanned_caption_rows`, applied at the end of `extract_tables_from_pdf` — both "Table 1" VOC-limit tables span many pages (10 and 3) with a reprinted two-row header block (Part A) or a two-line caption cell (Part B); the generic walk left nine stray "Product category" rows mid-table and kept Part B's caption cell as the header row. Entries pin a caption to its (page, index) span; the caption row is dropped by prefix, repeated leading header rows via the existing `_drop_repeated_leading_rows`; optional `display_caption` renders the wrapped second caption line ("...manufactured on or after May 1, 2020"). Replaces the walk's result for that caption; no-op for any reg without an entry.
3. `ITEM_TABLE_SPLICE_MODE["21"] = "merge_continuations"` — the same Reg 25 path: reprinted captions are continuations, and the "* Limits are expressed as VOC content..." footnote AFTER Part B's table survives (the default cut rule dropped it).
4. `SOB_PART_CONFIG["21"]`: Part C, `roman_seq`, opener `^Adopted:?\s`, `inner_items: False` — two entries "I. Adopted: July 18, 2019" / "II. Adopted: December 16, 2022"; both hard-wrap "...Regulation Number\n21. These standards..." onto a line start, which CYCLE_C_INNER would accept as a digit marker (the Reg 24/25 failure shape).
5. `CORPUS_REGS["21"]` and `REG_META["21"]` (identity above; `multi_letter_labels`; `seam_standalone_line_breaks` so Part C's page-top "Specific Statutory Authority" / "Additional Considerations" sub-headings are their own paragraphs, as for Reg 27 — confirmed against all 18 seams the flag breaks in this print: 10 reprinted captions, 6 label lines, those 2 sub-headings).
6. `KNOWN_LABEL_FIXES["21"]` — 11 fixes (below). `KNOWN_LABEL_ANOMALIES["21"]` — 4 documented, deliberately uncorrected misprints (below).
7. `test_import_ccr.py`: three existing assertions widened for the merge (`ITEM_TABLE_SPLICE_REGS` now `{"25","27","21"}` in the Reg 25 and Reg 27 meta tests; Reg 27's "seam flag is Reg 27's alone" check now exempts 21); 24 new tests in `Reg21MetaTests`, `Reg21LabelFixTests`, `Reg21TableCaptionSpansTests`, `Reg21FullParseTests`.

## Label fixes added (printed → corrected, source line, why)

All eleven confirmed in REG_21.pdf's own text layer with pdfplumber (not pdftotext artifacts); each hits exactly once (parse log `OK`).

| printed | corrected | line | why |
|---|---|---|---|
| `VI.MN.` | `VI.N.` | 1280 | "Anti-static product" between VI.M. (Agricultural use) and VI.O. (Antiperspirant); N is the only unprinted letter; "MN" tokenized as a real label and made a `-MN` row with no N row |
| `VI. VVVV.1.a.` .. `VI. VVVV.1.i.` (8 labels: a, b, c, d, f, g, h, i) | `VI.VVVV.1.x.` | 1994–2045 | the "Lubricant" subcategories print a SPACE after the roman numeral (pdfplumber: "VI." and "VVVV.1.a." are separate words 3 pt apart); each tokenized as a bare "VI." → eight spurious duplicate `sec-21-A-VI` section markers that swallowed the definitions |
| `IV. KKKKKK.1.a.` / `IV. KKKKKK.1.b.` | `VI.KKKKKK.1.a.` / `.b.` | 2467 / 2479 | the "Sealant or caulking compound" subcategories print the WRONG roman ("IV.") and the same space → two spurious duplicate `sec-21-A-IV` markers |

Documented, NOT corrected (`KNOWN_LABEL_ANOMALIES["21"]`, same policy as Reg 1/7/12/25):
- `VI.BBB.` skipped (AAA Electronic cleaner → CCC Engine degreaser, line 1585): no term missing; no `-BBB` row, nothing renumbered.
- `VI.DDDDD.` printed twice (Motor vehicle wash, line 2085; Multi-purpose lubricant, line 2111) — both kept, merged into `sec-21-A-VI-DDDDD` in printed order (the second carries the `VI.DDDDD.1.` sub-row).
- `VI.EEEEE.` printed twice (Multi-purpose dry lubricant, 2101; Multi-purpose solvent, 2121), each with its own `.1.` — merged into `sec-21-A-VI-EEEEE` and `sec-21-A-VI-EEEEE-1`. Renumbering would shift ~90 later labels away from the printed citations.
- `VI.WWWWWW.` skipped (VVVVVV Spray buff product → XXXXXX Table B compound, line 2604): no term missing.

## Quality-gate results A–I

- **A. Structure — PASS.** Printed outline (3 PART headings; six roman sections under A and under B; "I. Adopted…"/"II. Adopted…" under C) matches the parsed tree exactly: `sec-21-P-A/B/C`, A and B each `I.`–`VI.` with the printed titles, C `I.`/`II.`. 14 section rows, no extras (the ten spurious "VI."/"IV." markers were the label-fix cases above).
- **B. Coverage — PASS.** Body words after the cover page with page furniture stripped: 27,603; words across all `full_text`: 26,593 (96.3 %). The 1,010-word difference is entirely (a) the nine reprinted Table 1 caption+header blocks on continuation pages (~45 words each, rendered once) and (b) the label tokens themselves (not in `full_text` by convention) — verified by word-bag difference: the top missing words are "manufactured/after/2020/NAAQS/category/…" and label strings like "i.a.2".
- **C. Repeated-text heuristic — PASS.** 0 rows with any 50-char paragraph prefix recurring ≥3×.
- **D. Giant/fused rows — PASS.** Top 10 listed above; the only rows over 3,000 chars are the two undivided Part C statements (by design, like Reg 25/27) and the two table rows. No fused sibling sets.
- **E. Orphans/labels — PASS with 2 documented gaps.** Every `parent_id` resolves; no duplicate ids in the output (the 3 merged duplicate markers are the documented DDDDD/EEEEE anomalies); label sequences contiguous at every level except the two printed skips (BBB, WWWWWW). The continuation-line guard flagged 22 column-deviating candidates (IV.D.10–13 printed at the wrong indent, Part B V.A.1.a–c, etc.) — every one accepted and every one a real label (checked by hand against the source).
- **F. Statement of basis — PASS.** Part C, `roman_seq`, two entries with `Adopted:` openers, each one undivided row; the wrapped "Regulation Number\n21." fragment is body text; the Editor's Notes/History tail rides on entry II as in Reg 26/27/30.
- **G. Cross-references — PASS.** 34 internal spans (17 "Regulation Number 21" self-references → root, Part A/B/C bare-part refs, "Section II.F.", "Section III.D.10.", "Section V." etc.), all targets exist. Reg 21 itself cites NO other corpus regulation (the brief expected Reg 25 / Common Provisions links — grep confirms neither is mentioned; 0 external anchors, `other_reg` bucket empty). `cfr` bucket: "40 CFR Part 59" ×3, "40 CFR Part 60" ×2 (EPA Method 24, "40 CFR Part 60, Appendix A") — correct. Not tokenized (plain text, no bucket): California Title 17 CCR sections (§§ 94503.5, 94509(h), 94511, 94514, 94540-94555), CARB Method 310, ASTM/SCAQMD/BAAQMD methods — a new resolver form would be needed to bucket them; out of scope, reported. One unlinked "See Section II.F." sits inside a table cell (tables are not linked, as elsewhere). In the other direction, Reg 25 Part B I.L.1.b.(iv) "…regulated by Regulation Number 21." now links (see no-op proof).
- **H. Tables — PASS.** Part A Table 1 (pages 6–15) → one 3-column table in `sec-21-A-II-O`: header row "" / "Manufactured on or after May 1, 2020" / "Manufactured on or after 60 days after the effective date of a finding by EPA…", then the printed "Product category / VOC content limit (percent VOCs by weight)" row, then 178 category/limit rows; the reprinted header block appears once; empty cells preserved (e.g. Tire or wheel cleaner: aerosol "" / 8). Part B Table 1 (pages 47–49) → one 2-column table in `sec-21-B-II-F` (Coating category / VOC content limit (grams per liter)*, 51 rows, "Flat coatings 50" … "Zinc-rich primer 340") captioned with the full two-line caption, followed by the "* Limits are expressed as VOC content…" footnote paragraph. No other row carries a table or a stray caption line. Note: the two-row printed header is rendered as thead (dates) + first body row (units) rather than merged — faithful to the print; the summarizer hint names the units.
- **I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` → **392 passed, 7 skipped, 44 subtests passed** (368 + 24 new; 165 s). `python3 -m pytest -q test_summarize.py` → 163 passed, 2 skipped.

## No-op proofs

Baselines `out/base_{26,30,25,7,ecmc}.json` were built with `import_ccr.ORIGINAL.py` (one parse per subprocess; ECMC was killed once at rc=137 and succeeded on retry after 60 s — `out/ecmc_retry.log`). `prove_noop_reg21.py <key> with|without` parses with the edited importer, the latter with `"21"` deleted from `CORPUS_REGS` at runtime (`out/noop_run.log`):

| key | with "21" in CORPUS_REGS | with "21" removed |
|---|---|---|
| 26 | byte-identical (`cmp`) | byte-identical |
| 30 | byte-identical | byte-identical |
| 7 | byte-identical | byte-identical |
| ecmc | byte-identical | byte-identical |
| 25 | **1 row differs** | byte-identical |

Reg 25 with the key present: `strip_reconstruct.py out/base_25.json out/noop_25_with.json 21` → "rows: 993; changed rows: 1; anchors added: {'21': 1}; unexplained: 0". The single anchor (only one exists in the whole corpus — `grep "Regulation Number 21"` over every source finds Reg 25 line 1524 alone): `sec-25-B-I-L-1-b-(iv)`: "…does not apply to architectural and industrial maintenance coatings regulated by `<a class="xref-external-reg" href="/regulations/21">Regulation Number 21</a>`." Stripping the anchor reproduces the baseline exactly. (26/30/25 were re-parsed after the very last importer edit; 7 and ECMC were parsed after the last edit that could touch any other reg — every later edit is inside `REG_META["21"]` / `TABLE_CAPTION_SPANS["21"]`.)

## Things I could not resolve

- Page-seam fusion inside Part C (cosmetic, within the undivided rows): the "(I)" (page 51), "(X)" (page 53) and "(XI)" (page 54) finding items open a page as two-line paragraphs and are joined onto the previous item's paragraph ("…nonattainment areas. (XI) As set forth…"). The `seam_standalone_line_breaks` flag only breaks single-line page-top paragraphs (by design, see Reg 27); the same fusion exists in live Reg 7/26/30 rows. Text is complete and in order.
- The four uncorrected label misprints above (two duplicates merged, two skips) — a policy choice, not a parser gap.
- Part A's definitions list genuinely ends with two AIM-coating terms ("VI.AAAAAAA. Thermoplastic rubber coating and mastic", "VI.QQQQQQQ. Zinc-rich primer" — the latter also defined in Part B as VI.UUU.); printed that way, kept.

## Anything the summarizer should be warned about

(`reg21_summarize.patch` adds `REG_AUDIENCE["21"]` = "a manufacturer, distributor or retailer of consumer products or architectural coatings sold in Colorado" and a 200-word `REG_PROMPT_HINTS["21"]`; 4 new tests + the audience-set assertion widened to include 21.)

- Applicability is per part: the 8-hour Ozone Control Area, northern Weld County (no longer State Only since 02/14/2023), and "(State Only)" the rest of Colorado (Part A I.A.1–3, Part B I.A.1–3) — say which the row names.
- Units differ by part: Part A limits are **percent VOC by weight** (Table 1 in `sec-21-A-II-O`, two date columns — "manufactured on or after May 1, 2020" vs the lower limits that apply 60 days after an EPA finding that Colorado failed the severe 2008-NAAQS attainment date; "40 HVOC, 10 MVOC" for antiperspirants); Part B limits are **grams per liter** (`sec-21-B-II-F`, coatings manufactured on or after May 1, 2020, thinned per manufacturer's maximum). FIFRA-registered products: May 1, 2021 (II.C/II.D). Quote as printed; point to the table rather than restating cells.
- Many definitions carry a `.1.` sub-row that changes the definition "on or after 60 days after the effective date of a finding by EPA…" — a conditional future meaning, not the current one.
- Terms are defined separately in Part A VI and Part B VI (e.g. "Aerosol coating product", "Architectural coating", "Zinc-rich primer" appear in both); "LVP-VOC", "Table B compound", "ACP", "HVOC/MVOC", "Household product", "I&I product", "Responsible party" only as defined here. Two merged rows (`sec-21-A-VI-DDDDD`: Motor vehicle wash + Multi-purpose lubricant; `sec-21-A-VI-EEEEE`: Multi-purpose dry lubricant + Multi-purpose solvent) each define TWO terms.
- "Division" (APCD) and "Commission" (AQCC) are not defined in this regulation (Common Provisions). CARB Method 310, EPA Method 24, ASTM/SCAQMD/BAAQMD methods and California Title 17 CCR sections are incorporated by name and date — name, don't describe. Part C rows are rulemaking history.

## Deliverables (all in `agent_21/`)

`out/reg21_parsed.json` (+ `_unresolved/_duplicate_ids/_corrections/_marker_audit.json`, `out/reg21_parse.log`), `out/reg21_db.json` (`[]`), `out/reg21_diff_report.md` (509 only-parsed, as expected), `out/apply_reg21/` (plan.json, stats.md — all three sanity checks PASS, 3 upsert SQL files, summary_regen_ids.txt), `reg21.patch` (import_ccr + test_import_ccr vs the ORIGINALs — verified to apply cleanly with `patch -p0` and reproduce the edited files byte-for-byte), `reg21_summarize.patch` (vs `summarize.ORIGINAL.py` / `test_summarize.ORIGINAL.py`, which I re-snapshotted from the current `summarize.py`/`test_summarize.py` before editing, as the brief requires — the `.ORIGINAL` copies that shipped in the directory were stale), `prove_noop_reg21.py`, `gates_reg21.py` (+ `out/reg21_gates.txt`), `out/noop_*.json`, `out/noop_run.log`, `REPORT.md`.
