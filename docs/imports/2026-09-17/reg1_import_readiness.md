# Reg 1 — import readiness report

## Verdict: READY WITH NOTES

All nine quality gates pass. The notes are (1) the id shape chosen for a part-less regulation needs the CEO's sign-off, (2) one source-text anomaly (`III.D.1.e.(ii)(A)–(C)` with no printed `(ii)`) is documented rather than "fixed", and (3) a few pdftotext-garbled tables inside statement-of-basis / appendix prose are readable but not tabular.

## Regulation identity

- Title as printed on the PDF title page: **EMISSION CONTROL FOR PARTICULATE MATTER, SMOKE, CARBON MONOXIDE, AND SULFUR OXIDES** (note the Oxford comma before "AND SULFUR OXIDES" — `root_title` copies it exactly).
- CCR cite: **5 CCR 1001-3**. Reg key `"1"`. `root_citation` = "Code of Colorado Regulations · Regulation Number 1".
- Effective date on the PDF (Editor's Notes, last page): **Entire rule eff. 10/15/2024** (prior: 08/30/2007).
- Page count: **85** (pdfplumber), 5,114 text lines.
- Parts found: **none**. `grep -n "^\s*PART [A-Z]" sources/REG_1.txt` is empty (confirmed). The body is a single run of top-level roman sections I.–X.; Section X. is the Statement of Basis; the regulation's own APPENDIX A / APPENDIX B are physically printed inside Section X between entries X.K. and X.L.

### Id shape chosen for a part-less regulation (CEO decision requested)

The part segment is simply **omitted**: `sec-1-I`, `sec-1-I-A-1`, `sec-1-III-D-2-d-(iv)-(M)`, `sec-1-X`, `sec-1-X-Q`, `sec-1-APPENDIX-A`; root is the usual `sec-1-top-REG-1`, and every top-level section's `parent_id` is the root. No `sec-1-P-X` part row is fabricated, no `kind: "part"` rows exist. Rationale: the id equals the printed citation ("Section III.D.2.d.(iv)(M)") with the same dash-joined token shape every other regulation uses after its part letter, it is stable (no invented part letter to change later), and `-APPENDIX-` still marks appendix kind. Everything is driven by one flag, `REG_META["1"]["no_parts"] = True`, and a single helper `provision_id(reg, part, suffix)` (returns `sec-{reg}-{suffix}` when `part == NO_PART`, the empty string) used by the parser AND the xref resolver so the two can never drift. The alternative (a synthetic single "PART A" row, ids `sec-1-A-I-A-1`) was rejected because it would invent a heading the regulation does not print; switching to it later is a one-line change in `provision_id` plus emitting the synthetic part row.

## Row counts

- Total rows: **344** (1 root, 10 sections, 331 items, 2 appendices; 0 parts).
- Rows per top-level section (section + items): I: 14, II: 42, III: 130, IV: 29, V: 8, VI: 71, VII: 10, VIII: 18, IX: 1, X: 18 (the section row + 17 dated entries X.A–X.Q), plus APPENDIX A and B.
- Rows with ≥25 words (get summaries): **184**.
- Longest row: `sec-1-X` at 48,174 chars (the undated 1982 statement-of-basis compilation printed between the "X." heading and "X.A." — see gate D).

## Changes made to import_ccr.py (each one, one line, with the reason)

1. `CORPUS_REGS["1"] = "1"` — so Reg 1 cross-references resolve and other regs' "Regulation Number 1" citations link to it.
2. `REG_META["1"]` (state / CDPHE-APCD / aqcc-regulations URL / root citation & title as printed) with the new key `"no_parts": True` — the config flag for a part-less regulation.
3. New `NO_PART = ""`, `reg_has_no_parts(reg)`, `provision_id(reg, part, suffix)` — single point that omits the part segment from ids for a part-less reg (used by build_provisions, `_resolve_cite`, the diff report).
4. `_roman_part_letters()` returns `[NO_PART]` for a part-less reg — otherwise its `sec-1-<L>-I` regex would misread the real SOB entry `sec-1-X-I` as evidence of a "Part X".
5. `SOB_PART_CONFIG["1"]` with the new key `"section": "X"` (instead of `"letter"`), `letter_dated`, `roman_prefix "X"`, opener `^Adopted:?\s`, `inner_items: False` — the SOB is a top-level section, not a part; entries are `X.A. Adopted: …` … `X.Q.` (X.D./X.E. print "Adopted" without the colon); new helper `_sob_scope(reg)`.
6. `scan_markers`: starts with `current_part = NO_PART` for a part-less reg (ordinary CYCLE_AB scan runs without any PART heading); flips `sob_active = True` when the ordinary scan accepts the configured SOB section marker; the SOB branch then runs for the rest of the document under its own namespace `("sob", "")`; the SOB top-entry test was factored into `_match_sob_top()` (verbatim logic) so the appendix check can reuse it; the synthetic roman-prefix row is not created in section mode (the `X.` section row already exists).
7. `scan_markers` appendix handling: in section-scoped SOB mode, the next top-level SOB entry line closes an open appendix (Reg 1 prints APPENDIX A/B between X.K. and X.L.; without this, X.L.–X.Q. were swallowed into Appendix B); and, only for a part-less reg, an "APPENDIX A" line whose title sits after ONE blank line gets that title into the heading (title "Appendix A — Method for Measuring Opacity from Fugitive Particulate Emission Sources") instead of "Appendix A — ".
8. `build_provisions`: ids via `provision_id`; a depth-1 item's parent is the root when `part_letter == NO_PART`; appendix id via `provision_id` (→ `sec-1-APPENDIX-A`).
9. New `find_body_start_no_parts()` + branch in `parse_reg` — no "PART A" to anchor on; takes the second occurrence of the outline's first "I. <title>" line (outline copy at line 32, real heading at line 63). Without it the whole outline would be scanned as markers.
10. New `KNOWN_CONTINUATION_LINES` + `find_known_continuation_lines()` + optional `skip_candidates` param on `scan_markers` — reg-scoped list of hand-confirmed wrapped-citation lines that must not become markers (one entry for Reg 1, see label fixes). Reported with hit counts alongside label fixes.
11. New `KNOWN_TEXT_FIXES` + `apply_known_text_fixes()` (applied in `parse_reg` right after label fixes) — restores superscript exponents that `pdftotext -layout` flattened in the PM emission-limit formulas (confirmed against the PDF's char sizes; see gate H). 11 entries for Reg 1, each with a hit count (all `OK`).
12. `KNOWN_LABEL_FIXES["1"]` (5 entries) and `KNOWN_LABEL_ANOMALIES["1"]` (1 entry) — see next section.
13. Diff report only: `_target_bucket_label` prints "Section II. (no parts in this regulation)" / "appendix" for a part-less reg; the "10 from Part B / 5 from Part C" samples become "10 from the body / 5 from the statement-of-basis section" for a part-less reg; `exists_top` uses `provision_id`.

Every branch above is gated on `no_parts` / `section` / a reg-keyed dict entry. Proof of no-op: `out/reg26_before.json` (ORIGINAL parser) and the post-edit Reg 26 parse are **byte-identical** (`cmp` clean, verified after the final edit). `reg1.patch` applies cleanly to `../import_ccr.ORIGINAL.py` and to `pipeline/test_import_ccr.py` (verified with `patch -p0` into a scratch copy → files identical to mine).

## Label fixes added (printed → corrected, source line, why)

All applied with `hits == 1` (parse output prints `OK` for each):

| printed (wrong) | corrected | line | why |
|---|---|---|---|
| `II.A.6.a` | `II.A.6.a.` | 185 | Missing trailing period; siblings b./c. have it. Without it the fireplace exemption was an inline paragraph of `II.A.6.` |
| `III.D.2.(iv)` | `III.D.2.d.(iv)` | 906 | "Control Measures and Operating Procedures" under III.D.2.d. Mining, after (iii), followed by `III.D.2.d.(iv)(A)`–`(M)`; the "d." level is missing. Without it the heading and all 13 (A)–(M) items were fused into the (iii) row. |
| `IV.B.4.d.` | `VI.B.4.d.` | 1596 | "Natural Gas Desulfurization" between VI.B.4.c. and VI.B.4.e., children printed VI.B.4.d.(i)/(ii); there is no IV.B.4. |
| `III.D.2.j.(iv)(C)` | `III.D.2.i.(iv)(C)` | 1159 | Sits after III.D.2.i.(iv)(A)/(B) in the Blasting list, three lines before "III.D.2.j. Sandblasting" even starts. |
| `VI.F.1.a.` | `VI.F.2.a.` | 1737 | Directly under VI.F.2. and followed by VI.F.2.b.; the real VI.F.1.a. ("Test method,") is 12 lines earlier and was being merged with it. |

Continuation line (not a label; `KNOWN_CONTINUATION_LINES`): line 1288 `IV.D.2. may apply to the division…` is the wrap of "…unit described in" (IV.D.3.a.). Without the entry it became a duplicate `IV.D.2.` marker: IV.D.3.a. was truncated at "described in" and its text appended to `sec-1-IV-D-2`. The generic guards can't catch it (previous line is the enclosing marker's own line, ends in "in").

Text fixes (`KNOWN_TEXT_FIXES`, 11 entries, lines 395–412, 508, 519, 3916): `PE=0.5(FI)-0.26` → `PE = 0.5(FI)^-0.26`, `PE = 3.59(P)0.62` → `PE = 3.59(P)^0.62`, `PE = 17.31(P)0.16` → `PE = 17.31(P)^0.16`, and every `106` / `10 6` / `500x10` + orphan `6` line → `10^6`. See gate H.

Documented anomaly, NOT corrected (`KNOWN_LABEL_ANOMALIES["1"]`): lines 688–701 print `III.D.1.e.(ii)(A)`, `(ii)(B)`, `(ii)(C)` immediately after `III.D.1.e.(i) … if the owner or operator:` with **no `III.D.1.e.(ii)` line at all**, then `(iii)`. Relabeling to (i)(A)–(C) would invent citations; synthesizing an empty (ii) row would invent a provision. They are kept as printed, as inline paragraphs (label text included) of `sec-1-III-D-1-e-(i)`. CEO may prefer one of the alternatives — it is a 3-line `KNOWN_LABEL_FIXES` change either way.

## Quality-gate results A–I

**A. Structure — PASS.** The PDF's own outline lists I.–X.; the parse has exactly `sec-1-I` … `sec-1-X` as `kind: section` in order, all parented to the root, and the lettered subsections under each match the printed headings in order (I.A–B; II.A–D; III.A–D; IV.A–I; V.A–C; VI.A–F; VII.A; VIII.A–E; IX (no subsections); X.A–Q with APPENDIX A/B between X.K and X.L exactly as printed). Cross-check script: every label-shaped line in the body (I. through the "X." heading) maps to a parsed id except the 3 `III.D.1.e.(ii)(x)` anomaly lines; no parsed body id lacks a source line.

**B. Coverage — PASS.** Body words after the outline/cover, page furniture stripped: **39,393**. Words across all parsed `full_text` (tags stripped, +1 for the citation label the app re-inserts on `<p>` rows): **39,467** (ratio 1.0019 — the surplus is the 2 appendix titles and heading-row labels counted twice). Nothing dropped.

**C. Repeated-text heuristic — PASS (2 hits, both legitimate).** `sec-1-X` ×3 "The commission established a list of potential con…" — the 1982 compilation genuinely repeats that sentence for three source categories (3 occurrences in the .txt). `sec-1-X-N` ×4 "EPA Concern:" — the 2005 statement is written as an EPA-concern / response list. No fused rows.

**D. Giant rows — PASS with explanation.** Rows over 15,000 chars: `sec-1-X` (48,174), `sec-1-X-A` (21,322), `sec-1-X-N` (20,631), `sec-1-X-L` (19,553), `sec-1-X-H` (19,337). All five are statement-of-basis prose kept undivided by design (`inner_items: False`, same as Reg 3). `sec-1-X` is the ~770-line undated 1982 compilation printed between the "X." heading and "X.A." — it has ad-hoc "Section II.A.1 – …" topic headings and a stray "a."/"b."/"II." list but no consistent labels, so it stays as the section row's own body. Next largest: `sec-1-APPENDIX-A` 12,577 (one undivided appendix blob, as for every other reg). No fused sibling paragraphs anywhere (verified by gate C and the label cross-check).

**E. Orphans / labels — PASS.** 0 duplicate ids, 0 unresolved `parent_id`s, 0 ids merged from multiple markers (after the fixes above; before them there were 2 merges). Label-sequence contiguity check over every parent: the only gap is the documented `III.D.1.e.(ii)` anomaly. 87 candidates flagged by the column guard, 5 rejected — all 5 are genuine wrapped "…Section\nIII.D. …" continuations (checked). 14 rows start lowercase — all are `(iv)(A)…` control-measure list fragments ("watering or chemical stabilization…"), legitimately lowercase in the source.

**F. Statement of basis — PASS.** It is **Section X.** (not a part): `top_family: letter_dated` with `roman_prefix "X"` (ids `sec-1-X-A` … `sec-1-X-Q`, parent `sec-1-X`), opener `Adopted:?` (X.D. and X.E. print no colon). All 17 entries parsed to their own row, in order, each starting `<p>Adopted[:] <date></p>`: A 8/11/1977, B 4/9/1981, C 8/26/1982, D 1/19/1985, E 1/15/1987, F 9/15/1987, G 8/19/1993, H 12/23/1996, I 7/17/1998, J 4/19/2001, K 8/16/2001, L 1/17/2002, M 6/19/2003, N 7/21/2005, O 9/21/2006, P 6/21/2007, Q 8/15/2024. Inner numbered lists restart inside entries (e.g. X.K "B. Smoke Meter Evaluation", X.N "VI.A. While EPA is correct…", the preamble's "II. The commission concluded…") → `inner_items: False`; confirmed none of those became rows. The Editor's Notes/History lines at the very end land in `sec-1-X-Q`'s tail, exactly as Reg 26's do in its last entry.

**G. Cross-references — PASS.** 259 same-reg spans (90 to the root, 169 to sections I–IX — none wrongly into X.*), 5 external anchors, all to `/regulations/3` (Regulation Number 3 is the only corpus reg Reg 1 cites). `other_reg` bucket (correct, plain text): Reg 9 (11), Reg 5 (6), Reg 6 (9 incl. Part/Section forms), Reg 8 (4). `cfr`: 40 CFR Part 60 (+Subparts D, CCCC). `historical`: "Part B" ×4 — these are "Part B, Section V of Regulation Number 6" (Part precedes the reg name, so `PART_RE` sees a bare Part B) — left as plain text, which is the right outcome; only the bucket label is imprecise. `unparseable` (19 mentions, all left plain, none mis-linked): they are old-numbering references in the SOB ("previous Section II.A.2.b.", "V.A.5.c.", "V.B.5.a.", "II.A.7", "I.G.", "VI.A.f.", "III.D.A.") whose top-level roman still exists, so the generic bucketing calls them unparseable rather than historical — cosmetic; no tokenizer change made. Historical body-structure refs whose top level no longer exists do land in `historical` (unit-tested with `V.A.5.c.`). Body-text citations link correctly, e.g. `sec-1-III-D-1-a-(iii)`: "Section III.D.1.b. through III.D.1.e." → two spans.

**H. Tables / formulas — PASS with notes.** (1) PM emission-limit formulas (III.A.1.a–c, III.C.1.a–b) now read correctly (`PE = 0.5(FI)^-0.26`, `PE = 3.59(P)^0.62`, `PE = 17.31(P)^0.16`, `10^6 BTU`) — pdfplumber confirms the exponents are size-6.5 superscript glyphs in the PDF; the fixes are exact-substring, hit-counted. (2) SO2 limits (VI.B.4.a–e, VI.C, VI.D) are prose lists, not tables — parsed as ordinary rows, readable. (3) Opacity limits are prose (II.A.1–10). (4) The only bordered table pdfplumber finds is "Table 1 — Smoke Meter Design and Performance Specifications", which is inside APPENDIX A (a smoke-meter method); appendices are undivided blobs so it is present as line-per-row text ("a. Light Source Incandescent lamp operated at nominal rate voltage", …), readable but not `<table>`; injecting it there would (by the existing cut-at-caption rule) drop the appendix text after it, so I did not. (5) TABLE I–IV (sulfur removal / coal / fuel-oil / desulfurization) are in the 1977 statement `sec-1-X-A` as unbordered layout text; they come through as one short paragraph per row ("8,000 0.4 58") — readable, not tabular, with the page-continuation caption repeated once mid-table. (6) The 1982 preamble's EF/EMISSIONS fraction formula (line 2289, `sec-1-X`) is garbled by pdftotext's column layout — SOB only, left as is.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py`: **43 passed, 1 skipped** (was 32 + 1 skipped). 11 new tests in `Reg1NoPartsTests` / `Reg1KnownFixesTests`: config flags, `provision_id`, body-start detection, ids/parents/kinds on a miniature Reg-1-shaped fixture, section-scoped SOB entries with both opener spellings and `inner_items` off, appendix-inside-SOB closed by the next entry (and title recovery), same-reg citation resolution without a part, historical vs unparseable bucketing, each label fix, each text fix (incl. the guarded orphan-"6" line removal and no-op for Reg 26), and the continuation-line skip (with/without).

## Things I could not resolve

- `III.D.1.e.(ii)(A)`–`(C)` (source lines 688–701): no printed `(ii)`; kept inline in `sec-1-III-D-1-e-(i)` (see anomaly above). Needs a policy call.
- `sec-1-X` (48k chars): the undated 1982 compilation cannot be split without inventing labels. Its topic headings ("Section II.A.1 – Smoke and Opacity.") are 1982 numbering that happens to coincide with today's numbering for II.A.*, so those DO link to current rows — reasonable but the CEO should know the linked provisions are the 1982 versions being discussed.
- Bucket labels: "Part B ×4" in `historical` and the old-numbering SOB references in `unparseable` are cosmetic misfiles (all correctly left unlinked); fixing them would touch the shared tokenizer/bucketing, so I did not.
- Headings that wrap over two physical lines with a child immediately following (`sec-1-VII`, `sec-1-IX`) get `title = "VII."` and the heading text as their first `<p>` — identical to how Reg 7's "VI. (State Only) Oil and Natural Gas…" behaves today; noted, not changed. `sec-1-II-D` prints its heading run into its first sentence in the source ("Smoke and Obscurants for Military Training Exercises Emissions associated with…") — reproduced faithfully.
- REG_26.pdf is not present in `sources/` (only the .txt), so both the before and after Reg 26 parses ran without table extraction (same warning both times); the byte-identical comparison is still valid for everything the parser does with the .txt.

## Anything the summarizer should be warned about

- **Statewide vs. nonattainment scoping**: I.A.1 makes the whole reg statewide unless a provision names attainment / attainment-maintenance / nonattainment areas; III.D.2.* subsections are split "(i) Applicability – Attainment and Non-attainment Areas"; IX applies only to CO nonattainment / attainment-maintenance areas (refinery FCCUs); VIII (oil as backup fuel) is scoped to named PM-10 areas; IV.D.2 to CO nonattainment areas.
- **State-only**: I.A.2 — as of 10/15/2024 the CO provisions are state-only (not SIP); X.Q explains the CO repeal.
- **Formulas**: caret notation is exponentiation (`(FI)^-0.26` is a negative exponent, not "minus 0.26"); `10^6 BTU` = million BTU. PE = pounds per hour (III.C) or pounds per million BTU (III.A); P = process weight rate in tons/hour; FI = fuel input in MMBTU/hr.
- **Incorporated-by-reference federal methods**: EPA Method 9 (40 CFR Part 60, App. A, July 1992), Methods 1–5, 6, 8 (40 CFR 60.275, Aug 25 2023), 40 CFR Part 60 App. B (CEMS performance specs), Subpart D, Subpart CCCC — cited with fixed edition dates; the regulation does not reproduce their text.
- **Source-specific limits**: VII (Public Service Company of Colorado stations — unit-level NOx/SO2/opacity limits, lb/mmBTU) and VIII (named facilities' oil-backup restrictions) — summaries must not generalize these to all sources.
- **Acronyms likely mis-expanded**: PE (Particulate Emission, the formula variable — not "professional engineer"), FI (Fuel Input), P (process weight rate), gr/dscf, FCCU (fluid bed catalytic cracking unit), CEM/CEMS, SO2, PM/PM-10, HB 1366/1109 (Colorado House Bills), "commission" = AQCC, "division" = APCD, "State Only", TPY.
- **Appendices A and B** are test methods (fugitive opacity; off-property transport observation), printed inside the SOB section but referenced normatively from III.D — summarize them as methods, not as rulemaking history. Appendix A contains the smoke-meter spec table as line-per-row text.
- **Section X and X.A–X.Q** are rulemaking history (1977–2024), partly about superseded numbering (e.g. "Section V" iron & steel, 1982 II.A.2.b.); do not treat their citations as current requirements.
