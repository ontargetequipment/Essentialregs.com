# APCD General Permits GP01–GP12 — import readiness report (CEO-saved from the agent hand-back, Sept 19 2026)

## Verdict: READY WITH NOTES
All eleven permits parse: 0 duplicate ids, 0 orphans, 0 giant rows, 0 repeated-text flags, top-level sections match each printed Table of Contents. Notes: two shared citation-grammar gaps (`Section III.J.2. of Part B` trailing-part phrasing; repeated "Section X and Section Y" keyword lists) left in the unparseable bucket; GP12 Table 8 header has a cosmetic "NOx" split.

## Identity and row counts
| Key | Title (printed) | Issuance / date | Pages | Rows | ≥25 words | Longest |
|---|---|---|---|---|---|---|
| gp01 | Condensate Storage Tank Batteries | 6 / July 23, 2025 | 25 | 103 | 64 | 2,268 |
| gp02 | Natural Gas Fired RICE | 4 / July 23, 2025 | 48 | 210 (+Attachment A) | 134 | 3,381 |
| gp03 | Land Development Projects | 2 / Jan 24, 2020 | 5 | 59 | 20 | 1,064 |
| gp05 | Produced Water Storage Tank Batteries | 5 / July 23, 2025 | 26 | 111 | 66 | 2,115 |
| gp06 | Diesel Fuel-Fired RICE | 4 / July 23, 2025 | 35 | 174 | 98 | 1,974 |
| gp07 | Hydrocarbon Liquid Loadout | 4 / July 23, 2025 | 25 | 124 | 71 | 1,537 |
| gp08 | Storage Tanks | 4 / July 23, 2025 | 25 | 119 | 73 | 1,766 |
| gp09 | Well Production Facilities (attainment areas) | 3 / July 23, 2025 | 48 | 251 | 148 | 2,287 |
| gp10 | Well Production Facilities (nonattainment areas) | 4 / July 23, 2025 | 54 | 254 | 150 | 2,279 |
| gp11 | Routine or Predictable Gas Venting Emissions | 3 / July 23, 2025 | 26 | 129 | 82 | 1,466 |
| gp12 | GENERAL PERMIT 12 — Well Production Facilities | 1 / May 28, 2026 | 107 | 540 (+Attachments A, B) | 295 | 2,730 |
Total 2,074 rows, ~1,201 summary-eligible. GP09/GP10 root titles carry "(attainment areas)"/"(nonattainment areas)" added by the CEO (title pages are identical).

## Importer changes (all gated to the gp keys)
`GP_KEYS` + `CORPUS_REGS`; `REG_META` ×11 (`no_parts`, CDPHE-APCD, source_url = the CDPHE general-permits page); `page_of_total_footer` flag + `_PAGE_OF_TOTAL_RE` in `clean_pages`; `toc_has_page_leaders` flag for `find_body_start_no_parts`; `labels_without_trailing_dot` (`FAMILY_REGEX_NO_TRAILING_DOT`, all 11 — GP01/GP08 also print a few dot-less sub-labels); `attachments` config (gp02 A; gp12 A, B) → appendix-kind rows with digit-ladder children; `CONDITION_KEYWORD_REGS` ("Condition II.A.6." links like "Section"); `_condition_dangling_words`; `GP_MENTION_RE` + link_citations step 1.6 (any "GP02"/"GP-07"/"General Permit GP02" → that permit's root); `KNOWN_CONTINUATION_LINES` for gp06/gp09/gp10 wrapped citation lists.

## Gates
A PASS (TOC match ×11). B PASS (90–100% coverage; labels omitted from full_text by design). C PASS. D PASS (GP02's 26,726-char fused row fixed by the attachment mechanism). E PASS. F N/A (no SOB). G PASS WITH NOTES (39–82 same-doc spans, 49–175 corpus links per permit; Reg 3/26/cp link; "GPnn" self-mentions 99 total; no permit cites another permit). H PASS (26 tables via pdfplumber). I PASS: 180 passed / 19 skipped (+30 tests).

## No-op proof
Reg 1, Reg 26, Common Provisions re-parsed: byte-identical to pre-GP baselines both with and without the gp keys in CORPUS_REGS (none of those texts mention a GP).

## Summarizer warnings
Division-issued permits: say "permit condition", not "regulation"; "Division" = APCD, "Commission" = AQCC; GP09 = attainment, GP10 = nonattainment, both closed to new registrations July 15, 2026 (still bind existing registrants), GP12 replaces them; AOS = Alternative Operating Scenario, NOS = Notice of Startup, RICE, PSD/NANSR, DI Communities; quote g/hp-hr, tpy, ppmvd, record-retention periods and deadlines verbatim; "Condition X" is a same-permit cross-reference.
