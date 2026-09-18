# Reg 9 — import readiness report (saved by the CEO from the agent's hand-back; the agent did not write this file itself)

## Verdict: READY WITH NOTES

## Regulation identity
- Title as printed: "OPEN BURNING, PRESCRIBED FIRE, AND PERMITTING"; 5 CCR 1001-11; root_citation "Code of Colorado Regulations · Regulation Number 9"; CDPHE-APCD; state.
- No PART headings — `no_parts` regulation (Reg 1 mechanism); sections I–IX (IX = Statement of Basis); Appendices A, B, C.
- CEO correction to the agent's narrative: the parsed section titles are the printed ones (I Scope, II Definitions, III Open Burning Permit Requirements, IV General Open Burning Permit, V Planned Ignition Fire Permits, VI Unplanned Ignition Fire Permits, VII Additional Requirements for Significant Users of Prescribed Fire, VIII Fees, IX SOB). The agent's report mis-described the outline; the data is correct (verified against `out/reg9_parsed.json`).

## Row counts
- 217 rows: 1 root + 9 sections + 204 nested items + 3 appendix rows. 119 rows ≥25 words. Longest: `sec-9-IX-A` (SOB entry, 19,613 chars, legitimate).
- Section II definitions: 28 rows A–BB (letters I., V., X. correctly treated as letters — `sec-9-II-I` = Land Manager).

## Changes made to import_ccr.py
1. `BARE_LADDER_REGS = {"9"}` + `_bare_ladder_*` helpers: Reg 9 prints bare labels (never compound "II.A.1."), so depth comes from the open-ancestor context with sibling-first matching and multi-scheme ordinal disambiguation.
2. `scan_markers` uses `_bare_ladder_tokens` only when `reg in BARE_LADDER_REGS`.
3. `REG_META["9"]` (`no_parts: True`). 4. `CORPUS_REGS["9"]`.
5. `REG9_SOB_OPENER_RE` (three date-opener shapes). 6. `SOB_PART_CONFIG["9"]` (`section: "IX"`, `letter_dated`, `inner_items: False`, `implicit_section_prefix: True`).
7. `implicit_section_prefix` support in `_match_sob_top()` — SOB entries print bare "A.", "B." with no "IX." prefix. 8. This also fixed an id collision (SOB entry "I." vs Section I).
9. `TABLE_CAPTION_EXTRA_RE["9"]` ("TABLE I …"). 10. `APPENDIX_TABLE_SPLICE_REGS = {"9"}` + `_splice_appendix_tables()`. 11. `_fix_reg9_appendix_tables()` pins the two appendix tables to the right (page, index) — pdfplumber picked the wrong same-page table on page 38. 12. `APPENDIX_HEADING_DEDUP_REGS = {"9"}` + `title_end_line` tracking — fixes a duplicated heading/first-paragraph in Appendix B (Reg 1 has the same latent bug; deliberately not fixed there to keep its baseline).

## Label fixes added
None needed.

## Quality gates
A PASS (I–IX in order + Appendices A/B/C). B PASS (~2%). C PASS (0 hits). D PASS (long rows are SOB/appendix). E PASS. F PASS (Section IX, letter_dated, 15 entries). G FLAG minor: 11 bare no-period "Section <roman>" mentions stay plain text (shared tokenizer left untouched). H PASS (Table I/II in appendices rendered). I PASS: 106 passed / 6 skipped (+9 tests in `Reg9BareLadderTests`).

## No-op proof
Reg 2 and Reg 26 byte-identical. Reg 1 byte-identical with "9" removed from CORPUS_REGS; with it present, 11 new `<a class="xref-external-reg" href="/regulations/9">` links across 5 rows and nothing else ("Regulation Number 9", "Reg. No. 9", "Regulation 9 (Open Burning…)", "AQCC Regulation No. 9").

## Things not resolved
- 11 no-period "Section VI" style cites unlinked. - One small uncaptioned 2-row de-minimis table in Appendix A left as prose.

## Summarizer warnings
"Division" = APCD; "Authorized Local Agency" is a defined delegate, not the Division; planned-ignition (prescribed) fire vs unplanned-ignition fire vs ordinary open burning are three permit tracks; Section VIII fees are prose, not a table; Appendix B PM10 example calculations are Colorado fuel-type specific.
