# Reg 20 — import readiness report

## Verdict: READY

## Regulation identity

- Title as printed (REG_20.txt lines 19–23): "REGULATION NUMBER 20" / "COLORADO CLEAN CARS AND TRUCKS REGULATION" / "5 CCR 1001-24"
- `root_title` (exact): `COLORADO CLEAN CARS AND TRUCKS REGULATION 5 CCR 1001-24`
- `root_citation`: `Code of Colorado Regulations · Regulation Number 20`
- CCR cite 5 CCR 1001-24; effective 12/15/2023 (SOS ruleVersionId 11186, ruleId 3282); 56 pages; 3,372 lines of `pdftotext -layout`.
- Parts found (all nine, in order, matching the printed "Outline of Regulation"): A General Provisions, Definitions, and Severability · B Low Emission Vehicles (LEV) · C Aftermarket Exhaust Treatment Devices · D Zero Emission Vehicles (ZEV) · E Heavy-Duty Low NOx Regulation (HD Low NOx) · F Advanced Clean Trucks (ACT) · G Large Entity Reporting Requirement (LER) · H Incorporations by Reference · I Statements of Basis, Specific Statutory Authority and Purpose.

## Row counts

- Total rows: **327** (root 1, parts 9, sections 41, items 274, entries 2).
- Rows per part (excluding the part row itself): A 42 · B 44 · C 4 · D 53 · E 17 · F 8 · G 142 · H 2 · I 5.
- Rows with ≥25 visible words (these get summaries): **171** of 327.
- Longest row: `sec-20-I-II` (statement of basis, ADOPTED August 16, 2019 — 23,051 chars, 3,385 words). Longest non-SOB row: `sec-20-H-TABLE-1` (12,519 chars, almost all of it the 102-row incorporation table).
- Definitions: Part A, Section II → 27 rows `sec-20-A-II-A` … `sec-20-A-II-AA` (one per term); Part G, Section VI → 23 rows `sec-20-G-VI-A` … `-W`.
- Cross-reference spans: 146 same-reg `<span class="xref">`; 0 external anchors (Reg 20 never names another AQCC regulation — see gate G).

## Changes made to import_ccr.py (each one, one line, with the reason)

All changes are additive and keyed on `"20"` (or on a config key no existing reg sets); `out/base_*.json` for Reg 26/7/30/ECMC/25 are byte-identical before and after (see the no-op proofs below).

1. `CORPUS_REGS["20"] = "20"` — so other regulations' "Regulation Number 20" mentions link (none exist in the five baseline sources today; the resolver is exercised by a unit test).
2. `REG_META["20"]` — jurisdiction/issuing body/source URL/root citation/root title per the Reg 3/26 convention, plus **`labels_without_trailing_dot: True`** (the existing GP01–GP12 flag): fifteen Reg 20 labels omit their trailing period ("II.J", "II.T", "II.Y", "I.A", "II.A", "IV.B.3", "V.A.1", "V.B.2", "V.B.6", "V.C.3", "VI.B.2", "III.C.1"–"III.C.4"; lines 166/223/245/594/611/720/732/777/805/839/888/1145–1156); without the flag each was folded into the previous sibling and the label gate reported gaps (A..I, K..S, U..X, Z, AA). The flag added exactly +15 rows and no false positives.
3. `SOB_PART_CONFIG["20"]` — Part I, `roman_seq`, `top_opener_re = ^ADOPTED:\s` (Reg 20 prints the keyword in CAPITALS, which the shared case-sensitive `^Adopted:?` never matches), `inner_items: False` (each entry restarts bare digit lists and hard-wraps citation-shaped fragments; five undivided rows).
4. `FLAT_ENTRY_PART_CONFIG["20"]` — Part H ("Incorporations by Reference") has no labeled sections at all; without this the whole ~350-line part was silently dropped (coverage gate B caught it: 92.4% → 97.6%). New per-config options, both no-ops for Reg 6: `sob_heading_re` is now **optional** (`flat_cfg.get(...)`; Reg 20's flat part ends at the next "PART X" heading, which already resets `flat_active`), and `table_caption_re` (a "Table <n>. <title>" caption line becomes the `TABLE-<n>` entry marker, titled with the caption text). `_flat_entry_match` gained the optional `table_caption_re=None` parameter; the marker may carry a `title`. Rows: `sec-20-H-INTRO` (two intro paragraphs) and `sec-20-H-TABLE-1` (the table, then the four closing paragraphs).
5. `UNCAPTIONED_TABLES["20"]` — pins the Part H table to `sec-20-H-TABLE-1` by row id with `spans=[(28,0)…(33,0)]` (six PDF pages, header row reprinted on each and dropped by the existing repeated-leading-rows rule), `start_prefix="Section"`, `stop_prefix="Regulation Number 20 does not include any later amendments"`. The flat-entry build branch now calls `_swap_uncaptioned_table` exactly like the item/appendix branches (no-op for Reg 6, which has no entry).
6. `REG_CYCLE_AB["20"] = [roman, upper, digit, lower, digit_or_lroman]` plus a new `FAMILY_REGEX["digit_or_lroman"]` (`^(\d{1,3}|[ivxlcdm]+)\.`, roman-validated when alphabetic in `tokenize_by_cycle`, ordinal-aware in `_label_ordinal`; mirrored into `FAMILY_REGEX_NO_TRAILING_DOT`) — Reg 20 prints depth 5 as a bare dotted digit in Part D ("V.A.3.b.1.", "V.A.3.b.2.") and a bare dotted lower roman in Part G ("V.A.6.d.i.", "V.A.6.d.ii."); nothing goes deeper. Only a cycle that names the family ever tries it (no other reg's does).
7. `KNOWN_LABEL_FIXES["20"]` — one entry (see below).
8. `KNOWN_TEXT_FIXES["20"]` — four entries: the "V.b.2.q." citation case typo, and the Westlaw URL that pdftotext hard-wraps over three physical lines (restored onto one line; the two continuation lines blanked with the existing `whole_line`/`prev_endswith` guard). Each hits exactly once.
9. `BUCKET_OTHER_CCR = "other_ccr"` appended to `ALL_BUCKETS`, `CALIFORNIA_CCR_REGS = {"20"}`, `CAL_CCR_RE`, and a new step 1.3 in `link_citations` (gated on `CALIFORNIA_CCR_REGS`) that recognizes "California Code of Regulations, Title 13, Section(s) …" / "Title 13, Section …" / "Title 13 CCR Section …" / "CCR, Title 13, section …" citations (single, lists, "through"/hyphen ranges, paren sub-designations) and counts them per section as `13 CCR § <n>` — never linked (see G). For every other regulation the bucket is present but empty, exactly like the ECMC-only `form`/`crs` buckets: parsed JSON unchanged; the `_unresolved.json` sidecar and the diff report gain one empty bucket (verified: that is the only sidecar difference for all five baseline regs). The diff report's bucket title map gained the matching line.

New/changed config keys, in one list: `CORPUS_REGS["20"]`, `REG_META["20"]` (+`labels_without_trailing_dot`), `SOB_PART_CONFIG["20"]`, `FLAT_ENTRY_PART_CONFIG["20"]` (new optional keys `table_caption_re`; `sob_heading_re` now optional), `UNCAPTIONED_TABLES["20"]`, `REG_CYCLE_AB["20"]`, `FAMILY_REGEX["digit_or_lroman"]` (+ `FAMILY_REGEX_NO_TRAILING_DOT`), `KNOWN_LABEL_FIXES["20"]`, `KNOWN_TEXT_FIXES["20"]`, `BUCKET_OTHER_CCR`/`ALL_BUCKETS`, `CALIFORNIA_CCR_REGS`, `CAL_CCR_RE`.

## Label fixes added (each: printed label → corrected label, source line, why)

- `KNOWN_LABEL_FIXES["20"]`: **`V.A,6.d.ii.` → `V.A.6.d.ii.`** (REG_20.txt line 1309, confirmed in the PDF text layer): a comma printed where the second dot belongs, directly after "V.A.6.d.i."; parse output reports `hits: 1` (OK).
- `KNOWN_TEXT_FIXES["20"]` (body text, not labels — all `hits: 1`): **`through V.b.2.q.,` → `through V.B.2.q.,`** (line 1356; lower-case "b" in a citation to the printed label V.B.2.q. — it was the only `unparseable` bucket hit and now links to `sec-20-G-V-B-2-q`); the three-line Westlaw URL (lines 2014–2016) joined onto one line so it renders as one working URL.
- Not fixed individually (handled by the `labels_without_trailing_dot` flag instead of fifteen fix entries): the fifteen labels printed without a trailing period listed under change 2.
- No `KNOWN_LABEL_ANOMALIES` needed: every label sequence is contiguous once the above are in.

## Quality-gate results A–I

**A. Structure — PASS.** Parts A–I parsed in printed order and match the "Outline of Regulation". Top-level sections per part, txt vs parsed: A I–IV · B I–VII · C I–II · D I–VI · E I–V · F I–VI · G I–VI · H (none — Introduction + Table 1 entry rows) · I I–V — all identical.

**B. Coverage — PASS.** Body words after the cover/outline (25,510 incl. page furniture) vs visible words in all `full_text` (24,899). The 611-word gap is fully accounted for by a word-bag diff: 385 words of page furniture ("CODE OF COLORADO REGULATIONS 5 CCR 1001-24" × 55 pages, which my gate counter did not strip), 218 label tokens (stripped by design — the app re-inserts the citation badge), 20 words of reprinted table column headers on continuation pages (dropped by design). No text is missing. Before Part H was configured the ratio was 92.4%.

**C. Repeated-text heuristic — PASS.** 0 rows with any 50-char paragraph prefix recurring ≥3×.

**D. Giant / fused rows — PASS.** Ten longest: `sec-20-I-II` 23,051 · `sec-20-I-V` 18,775 · `sec-20-I-IV` 17,778 · `sec-20-I-I` 16,615 · `sec-20-H-TABLE-1` 12,519 · `sec-20-I-III` 7,598 · `sec-20-G-V-B` 1,557 · `sec-20-B-I-A-2` 1,309 · `sec-20-B-I-A-1` 1,304 · `sec-20-G-III-A` 1,265. The four rows over 15,000 chars are the undivided statement-of-basis entries (`inner_items: False`, the Reg 24/25/27 shape); the table row is one 102-row table. No fused sibling rows (the earlier fused shapes — the fifteen no-period labels and the four depth-5 items — are now rows of their own).

**E. Orphans and label anomalies — PASS.** 0 duplicate ids, 0 orphans, every `parent_id` resolves, every item id extends its parent's id. Every label sequence under every parent is contiguous (checked per family at each CYCLE_AB depth: 0 anomalies). Continuation-line guard: 45 candidates flagged, 2 rejected — both confirmed wrapped citations ("…in Section\nIV. were from…" line 1261; "…selected per Section\nV.B.7. Respond by estimating…" line 1358), pinned by a test.

**F. Statement-of-basis part — PASS.** Part I, `roman_seq`, five entries I–V each its own undivided row, in order, openers as expected: I "ADOPTED: November 15, 2018 (Adoption of all Sections)" · II "ADOPTED: August 16, 2019 (Adoption of ZEV Section as part of CLEAR)" · III "ADOPTED: August 19, 2021 (Revisions … Colorado Low Emission Automobile Regulation …)" · IV "ADOPTED: April 21, 2023 (Revisions … Colorado Advanced Clean Trucks …)" · V "ADOPTED: October 20, 2023 (Revisions … Colorado Clean Cars and Trucks …)". Inner "(I)…(XII)" findings lists and restarting numbered lists stay inside the entries. The Editor's Notes/History tail attaches to entry V (existing corpus convention).

**G. Cross-references — PASS (with notes).** 146 same-reg spans: 39 root self-mentions ("Regulation Number 20"), 50 bare Part references (A 2, B 3, C 5, D 10, E 8, F 4, G 16, I 2), 57 section/item targets (under B 2, D 3, E 1, G 51 — Part G's reporting rules cite each other heavily); all targets exist. External anchors: **0** — Reg 20 contains no "Regulation Number N" for any other N, no Common Provisions mention, no GP mention; the brief's expected Reg 11 / Reg 12 / 40 CFR 86 cites do not occur in this text (grep-confirmed). Buckets: `cfr` = {"49 CFR 571.500": 1} (FMVSS 500, low-speed vehicles — correct); `other_reg`, `historical`, `unparseable` all empty; **`other_ccr` = 97 distinct / 176 mentions** ("13 CCR § 1962.2" ×7, "§ 1962.4" ×6, "§ 1961.2" ×5, "§ 2121" ×5, "§ 2035" ×4 …) — the incorporated California sections, counted and left as plain text by design (the brief asked how they are bucketed: a new `other_ccr` bucket, not `cfr`, since they are not federal). Left unlinked by tokenizer limits (out of scope): "Sections V.A.6.a to V.A.6.g." ("to" is not a list separator — the first endpoint links), "Part A.II.E." / "Part B.VII" in the SOB history (Part links only). Source typos visible in the bucket, kept as printed: "1692.6" (for 1962.6, Part D II.B), "2196.4" and "2167.7" (for 2169.4/2169.7, SOB entry IV).

**H. Tables — PASS.** pdfplumber finds exactly one ruled table in the whole PDF: Part H, Table 1 ("Code of California Regulations, Title 13. Motor Vehicle, Division 3. Air Resource Board"), six pages. Rendered in `sec-20-H-TABLE-1` as one `doc-table` with 1 header row + 101 body rows (Section / Title / Section Amended Date; Chapter/Article group headings as merged single-cell rows, as printed); every section number and group heading in the pdftotext dump is present, every numeric row has its date, the flattened dump is gone, the four closing paragraphs follow the table. **The brief's expected "percentage/credit tables in Parts D and F" do not exist**: Parts D and F state their ZEV percentage and credit requirements entirely by reference to 13 CCR §§ 1962.2/1962.4/1963–1963.5 (no whitespace-aligned columns either — checked). Percentages appear only in prose ("36 percent", "23 percent"), which the parse keeps verbatim.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` → **400 passed, 7 skipped, 44 subtests passed** (368 existing + 32 new in `Reg20MetaTests`, `Reg20DepthFiveCycleTests`, `Reg20LabelAndTextFixTests`, `Reg20CaliforniaCiteTests`, `Reg20FlatPartHTests` (fixture-driven, no PDF, incl. the degraded no-table path and the opt-in caption shape), `Reg20FullParseTests` (real source: 327 rows, structure, no-period labels, depth-5 rows, fixes, SOB, Part H table, buckets, guard rejections)). `python3 -m pytest -q test_summarize.py` → **161 passed, 2 skipped** (incl. the new Reg 20 hint/audience tests; the audience-set test updated to include "20").

## No-op proofs

Baselines were built FIRST with `import_ccr.ORIGINAL.py`, one parse per subprocess, one at a time (`run_baselines.sh` for 26/7/30, `out/run_rest.sh` for ECMC/25; every parse succeeded on attempt 1): `out/base_26.json`, `base_7.json`, `base_30.json`, `base_ecmc.json`, `base_25.json`.

1. **Key present** (`CORPUS_REGS["20"]` in place, all edits applied; `out/run_noop.sh`) — `out/noop_<key>.json`: `cmp` **byte-identical** for all five (26, 7, 30, ecmc, 25). Anchors added: **0** — none of the five sources contains "Regulation Number 20" / "Regulation No. 20" (grep: 0 hits each), so there is nothing to link and no strip-and-reconstruct list to give (`strip_reconstruct.py` is trivially exact). The `xref-external-reg` resolver for "20" is proven by `Reg20MetaTests.test_regulation_number_20_links_from_other_regs` (Reg 7 text naming "Regulation Number 20, Part A" links to `/regulations/20` with the key present and lands in `other_reg` without it).
2. **Key removed** (`out/import_ccr_nokey.py` = the edited file with the `"20": "20"` line commented out; `out/run_nokey.sh`) — `out/nokey_<key>.json`: `cmp` **byte-identical** for all five.

Side files: `out/*_unresolved.json` differ from the baselines only by the new, empty `"other_ccr": []` key (all pre-existing buckets identical); `_corrections.json`, `_duplicate_ids.json`, `_marker_audit.json` byte-identical.

## Things I could not resolve

- None blocking. Left as printed / consistent with the corpus: the three source typos in California section numbers noted under G; the "Sections V.A.6.a to V.A.6.g." range links only its first endpoint; sections whose heading line is followed by prose (E I "Purpose", F I–V, G I, G V) are titled by their citation only with the heading as first paragraph — the same shape Reg 30 `sec-30-B-III` and Reg 26 `sec-26-B-I` have in their baselines.
- The `other_ccr` bucket adds one empty section to every regulation's diff report and one empty key to every `_unresolved.json` sidecar (parsed JSON unaffected) — the same footprint the ECMC `form`/`crs` buckets already have; flagged in case the merge wants it gated harder.

## Anything the summarizer should be warned about

`reg20_summarize.patch` adds `REG_AUDIENCE["20"]` ("a vehicle manufacturer, dealer or fleet compliance manager selling or registering vehicles in Colorado") and a 199-word `REG_PROMPT_HINTS["20"]` covering:
- Almost every operative standard is a **California Code of Regulations, Title 13 section incorporated by reference** in the version dated in Part H, Table 1 — the summarizer must name the section (e.g. "13 CCR 1962.4") and say it is incorporated, never describe or guess its contents, percentages, credit values or test procedures (the California text is not in the corpus).
- In the incorporated sections "California" means Colorado, "CARB"/"Air Resources Board" means CDPHE, "Executive Officer" means the Executive Director of CDPHE (Part H intro; Part A II.I); **"Department" is CDPHE** (Part A II.G) — not the APCD; "the Division" appears only in the Part A IV rulemaking-petition clause and the Part H inspection address.
- Model-year windows ("2022 through 2025 and 2027 through 2032" for Part B/D light-duty; "2027 and subsequent" for Parts E/F; Part D's two credit regimes, through MY 2025 and 2027–2032), GVWR thresholds (8,500 lbs; 14,001 lbs), percentages ("36 percent"/"23 percent" credit options), dates and deadlines verbatim; never generalize one part's window to another.
- Parts are separate programs: B (LEV), C (aftermarket catalytic converters), D (ZEV credits/deficits), E (HD Low NOx), F (ACT), G (Large Entity Reporting — a one-time report with bins and per-facility questions). Acronyms ZEV, TZEV, NZEV, PHEV, BEVx, FCEV, NEV, LEV, ACT, LER, APU expand only as Part A II / Part G VI define them.
- Part H rows (`sec-20-H-INTRO`, `sec-20-H-TABLE-1`) are the incorporation list with amendment dates; Part I rows are rulemaking history, not current requirements; the SOB entries name pre-2023 numbering (e.g. "Part B.VII") — history, not current sections.
- Three source typos in California section numbers ("1692.6", "2196.4", "2167.7") are kept as printed — the summarizer should not "correct" or expand them.

## Deliverables (all in `agent_20/`)

`out/reg20_parsed.json` (327 rows) · `out/reg20_db.json` (`[]`) · `out/reg20_diff_report.md` (327 only-parsed, 0 lowercase starts) · `out/apply_reg20/` (2 upsert SQL files, `stats.md` — three sanity checks PASS) · `reg20.patch` (import_ccr.py + test_import_ccr.py vs the ORIGINALs; `patch -p0` applies cleanly, verified on fresh copies) · `reg20_summarize.patch` (summarize.py + test_summarize.py vs `summarize.ORIGINAL.py`/`test_summarize.ORIGINAL.py`, which were refreshed from the current files first as the brief instructs; applies cleanly) · `out/base_*.json` / `out/noop_*.json` / `out/nokey_*.json` (no-op proofs) · `REPORT.md`.
