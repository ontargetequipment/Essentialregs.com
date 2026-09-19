# PHMSA Batch B — 49 CFR Parts 194 / 195 / 199 — import readiness report (September 19, 2026)

## Verdict: READY WITH NOTES

All three parts parse clean from the eCFR versioner XML (as of 2026-09-17): 0 dead cross-reference targets, 0 orphans, 0 duplicate ids, 0 label anomalies, 0 repeated-text flags, 0 giant rows, every XML `<TABLE>` rendered inline and round-tripped cell-for-cell. The six 40 CFR baselines are byte-identical (parsed JSON and report JSON) and the Parts 191/192 parses are byte-identical to the ones Batch A shipped — proven by re-parsing and `cmp`.

| Key | Root title | Subparts | Sections | Appendices | Tables | Rows | Summary-eligible (≥25 words) | Longest row |
|---|---|---|---|---|---|---|---|---|
| `p194` | 49 CFR Part 194 — Response Plans for Onshore Oil Pipelines | A, B | 15 | A, B | 3 | **155** | **66** | `sec-p194-APPENDIX-A` 1,342 words |
| `p195` | 49 CFR Part 195 — Transportation of Hazardous Liquids by Pipeline | A–H | 148 | A, B, C | 19 | **1,394** | **617** | `sec-p195-APPENDIX-C` 3,152 words |
| `p199` | 49 CFR Part 199 — Drug and Alcohol Testing | A–C | 40 | — | 0 | **243** | **116** | `sec-p199-199.229-(c)` 149 words |
| | | | | | | **1,792** | **799** (≈ $2.40 at $0.30/100) | |

Definition rows: § 194.5 → 24, § 199.3 → 13, § 195.2 → 62, § 195.6(c) → 27 (in-section definition block, see below).

## Importer changes (`import_ecfr.py`), each with its reason
1. **`<DIV7 TYPE="SUBJGRP">` walk.** Part 195 Subpart F nests §§ 195.450, 195.452 and 195.454 inside two subject-group headings ("High Consequence Areas", "Pipeline Integrity Management"). The whole-part walker only descended into a subpart's direct `DIV8` children, so the entire hazardous-liquid integrity-management regime — including the 140-paragraph § 195.452 and its two tables — was silently dropped (that is also why the Batch A sketch reported 145 sections, not 148, and 10 unresolved `§ 195.452` citations). Fixed: 148/148 sections, 19/19 tables. The group heading is recorded in the report (`subject_groups`), not rowed (no id form exists between `-PART-x` and a section). No-op for 191/192/194/199 (no `DIV7` in any — asserted by test).
2. **`_advance_part_label_stack` tie-break.** § 195.452 has both an (h)(1)(i)/(ii) roman pair and a later genuine top-level (i); the "does (j) appear later" test mis-popped the roman (i) and dragged 24 labels (25 anomalies). Local evidence (next label is `(ii)` or the level below) now decides first. p191/p192 byte-identical after the change.
3. **`PART_INLINE_DEFINITION_SECTIONS = {"p195": {"195.6"}}`.** § 195.6(c) "Definitions used in this part—" is followed by 27 unlabelled `<I>Term</I> means …` paragraphs that were fusing into one 1,251-word row; now one definition row per term, parented on the (c) chapeau.
4. **`<FTNT>` kept** as `<p class="footnote">…</p>` (2 occurrences, § 195.563 rule text) instead of being stripped with `<CITA>`/`<EDNOTE>`.
5. `PART_FLAT_APPENDICES` += `p194: {"A"}`, `p195: {"C"}`; `PART_META` finalized; `CFR_PART_TO_REGKEY` += 49-194/195/199; report gains `subject_groups`/`footnotes`. `check_gates.py` takes reg keys, walks `DIV7`, skips the pdftotext half of gate B when no print exists.

## Gates
- **A structure PASS** — top level equals the XML in order for all three; per-subpart section lists (walking `DIV7`) equal the XML's `DIV8` lists; section rows == `DIV8` count (15/15, 148/148, 40/40).
- **B coverage PASS** — XML `<P>` word bags vs rows: p194 0 lost / 0 paragraphs unfound; p195 6 lost / 1 unfound (the same superscript-footnote spacing artifact, phrases verified present); p199 0 / 0. **pdftotext half not run** — no PDF prints for these three.
- **C repeated text PASS** (0 flags). **D giant rows PASS** (0 over 6,000 words; the four whole-appendix rows are 9–23 KB by design). **E PASS** (0 dup ids / orphans / anomalies).
- **Reserved:** p195 `§§ 195.236-195.244`, `§ 195.415`; p199 `§ 199.111`, `§ 199.201`, `§§ 199.203-199.205`, `§ 199.213`; p194 none. All rows.
- **Appendices:** 194 A (one row: restarted ladders under nine `<HD2>` headings), 194 B (one row: 79-row table), 195 A (one row: prose + examples), 195 B (one row: prose + 6 tables), 195 C (one row: fused ladder, like 192 Appendix D).
- **G xrefs PASS, 0 dead** — p194 28 same-doc + 6 → p195; p195 647 + 2 → p199; p199 61 + 5 → p192, 2 → p191, 1 → p195. Buckets: 195 cites 81 distinct incorporated standards 225×; 199 cites 49 CFR Part 40 13× (not in corpus — the top hallucination risk); 194 cites parts 300/311, 33 CFR 154. P192 contains zero mentions of 194/195/199, so its parse is unchanged.
- **H tables PASS** — 3 + 19 + 0 rendered inline, 0 cell round-trip failures (inventory in `out/gates.json`).
- **I tests PASS** — `test_import_ecfr.py` 188, `test_import_ccr.py` 225 (incl. the duplicate-marker fix), `test_summarize.py` 123, `test_freshness.py` 43.

## CCR importer touchpoints (`import_ccr.py`)
`CORPUS_REGS`, `ECFR_REGS`, `REG_META` for the three; `CFR_TITLE_PART_TO_REGKEY` += 194/195/199; bare part + subpart letter (`49 C.F.R. § 195 Subpart A`) now deep-links to `sec-p195-PART-A`. Merge-and-prove: ECMC 6,754 rows both ways; exactly 4 rows differ (`100-DEF-CRUDE-OIL-TRANSFER-LINE`, `100-DEF-GATHERING-LINE`, `1102-d-(3)-A`, `1102-g-(2)`), 12 new anchors all to `/regulations/p195` (§ 195 Subpart A ×3, 195.2 ×4, 195.234 ×3, 195.410 ×2); strip-and-reconstruct exact. Reg 26/30 unchanged.

## Summarizer hints
`p194` 171 words, `p195` 184, `p199` 170; all five pipeline keys strip the base prompt's EPA-Administrator sentence. 195: hazardous liquid **and CO2** pipelines, not gas; HVL / rural gathering / low-stress / breakout tank are distinct categories; IM = § 195.452, HCA = § 195.450, USA terms = § 195.6; standards named not described. 199: "covered employees" / "covered function" only; 49 CFR Part 40 named never described; MRO/SAP/DER/EBT as defined; testing rates only as stated. 194: OPA 90 response plans; worst case discharge, response zone, qualified individual as defined; Appendix A/B are guidance.

## Things not resolved
1. No PDF prints for 194/195/199 (pdftotext coverage half skipped; `check_gates.py` picks them up if committed).
2. §§ 192.15(a), 192.383(a), 192.385(a) have the § 195.6(c) shape (7 unlabelled definitions fused into the preceding row). Enabling `PART_INLINE_DEFINITION_SECTIONS["p192"]` fixes it in one line but changes the Batch A parse — flagged, not done.
3. One `unparseable` in p194: "paragraph (d) of this section" printed inside Appendix A.
4. Part 195's two subject-group headings appear only in the report, not the reader.
5. § 199.207 does not exist in the source (Subpart C skips it) — confirmed.
