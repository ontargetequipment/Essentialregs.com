# Reg 8 — import readiness report

## Verdict: READY WITH NOTES

All nine quality gates pass. The notes are (1) the parser needed four small,
reg-scoped, additive capabilities (none change any existing regulation —
Reg 26 before/after parse is byte-identical, all 32 pre-existing tests pass),
(2) 39 confirmed source-text label typos are corrected via `KNOWN_LABEL_FIXES`
(every one hits exactly once), and (3) a few cosmetic page-seam joins and the
trailing Editor's Notes block, both of which behave exactly as they do in the
already-imported regulations.

## Regulation identity

- Title as printed on the PDF title page: **CONTROL OF HAZARDOUS AIR POLLUTANTS**
- CCR cite: **5 CCR 1001-10**, "Regulation Number 8"
- Effective date on the PDF (last Editor's Notes history line): **12/15/2025**
  ("Part A rules I, II.W, Part E rules I, III, VI.QQ eff. 12/15/2025")
- Page count: **236** (pdfplumber); `sources/REG_8.txt` = 13,153 lines
- Parts found (all five from the printed "Outline of Regulation", in order):
  - PART A — National Emission Standards for Hazardous Air Pollutants (NESHAP)
  - PART B — Asbestos Control
  - PART C — Colorado State Standards for Hazardous Pollutants
  - PART D — Compliance Extensions for Early Reductions of Hazardous Air Pollutants
  - PART E — Federal Maximum Achievable Control Technology (MACT)
- Appendices: Part B Appendix A (non-mandatory work practices), Appendix B
  (– BROCHURE; the brochure itself is image-only in the PDF, so the row is
  title-only), Appendix C (training course outline); Part D Appendix A
  ("(for Part D)" — EPA Method 301 test-method text, one blob).

## Row counts

- **Total rows: 1,340** (root 1, part 5, section 29, item 1,301, appendix 4)
- Per part: A 26 · B 1,053 (incl. 3 appendices) · C 5 · D 179 (incl. 1 appendix) · E 76
- Rows with ≥25 words (summary candidates): **746**
- Longest row: `sec-8-B-VII-K` (46,755 chars) — the single January 22, 2021
  Part B statement-of-basis entry (see gate D).
- Part B detail: 150 definitions under I.B (I.B.1–I.B.150 incl. sub-items),
  55 acronyms under I.C, 79 statement-of-basis entries regulation-wide
  (A: 23, B: 11, C: 2, E: 43; Part D has none).

## Changes made to import_ccr.py (each one, with the reason)

1. `CORPUS_REGS`: added `"8": "8"` — so Reg 8's citations to Reg 3/7 link and
   other regs' "Regulation Number 8" citations can resolve to it.
2. `REG_META["8"]`: state / CDPHE-APCD / aqcc-regulations URL /
   `root_citation` "Code of Colorado Regulations · Regulation Number 8" /
   `root_title` "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10" (Reg 3/26 convention).
3. `KNOWN_LABEL_FIXES["8"]`: 39 entries (listed below) — every one a
   confirmed printed typo that orphaned or fused a provision.
4. **New `SOB_SECTION_CONFIG`** (`{"8": {"A": "II", "B": "VII", "C": "II", "E": "VI"}}`)
   + one guard in `scan_markers`'s CYCLE_AB branch. Reg 8 has NO
   statement-of-basis *part*; each part ends with its own "Statements of
   Basis…" *section* whose entries are ordinary compound labels
   ("II.A.", "VII.K.", "VI.QQ."). Once that section is open, a candidate is
   structure only if it starts with that section's roman numeral and has ≥2
   tokens. Without this, the flush-left bare "I."…"XII." findings lists
   printed inside at least five Part B entries, and wrapped subpart lists
   ("…Subparts W,\nMM, LLL…"), were accepted as new top-level sections and
   merged into Part B's real Sections I/II/III (duplicate ids). `SOB_PART_CONFIG`
   is untouched (Reg 8 has no entry there); regs without a `SOB_SECTION_CONFIG`
   entry never run the check. This is the "smallest additive extension" the
   assignment asked for: one dict, one `if`, no change to the existing
   single-SOB-part mechanism.
5. **New `SIBLING_CHAIN_REGS = {"8"}`** + `_label_ordinal` / `_is_next_sibling`
   + one extra signal in `_marker_column_signals` (and a matching override of
   the dangling-word check when the previous line *is* the last marker's own
   line). Part B's acronym list I.C.1–I.C.55 is printed as 55 consecutive
   flush-left lines with no blank lines and no terminal punctuation, so 49 of
   them tripped the continuation-line guard and were fused into I.C.1. "This
   candidate is the immediate next sibling of the last accepted marker" is
   now a paragraph-boundary signal for regs opted in here. Opt-in only.
6. **New `TABLE_CAPTION_EXTRA_RE = {"8": "Table N. …"}`** + `_table_caption_key()`:
   Part D's "Table 1.         LIST OF HIGH-RISK POLLUTANTS" uses a period
   separator TABLE_CAPTION_RE doesn't know; matched captions are
   whitespace-normalized so the pdftotext and pdfplumber spellings agree.
   Reg-scoped because a false caption match is destructive (the row is cut
   at the caption). `extract_tables_from_pdf` gained an optional `reg` arg.
7. **New `UNCAPTIONED_TABLES["8"]`** (7 entries) + in-place sentinel
   rendering in `build_provisions`: Part B's five certification-fee /
   refresher-length tables, the permit-fee table and the clearance-sample
   matrix are real bordered tables with no caption at all; pdfplumber
   recovers every cell, and the flattened pdftotext block is replaced in
   place (paragraphs after the table keep their order). Reg-scoped.
8. **New `CFR_RE_DOTTED` / `CFR_DOTTED_REGS = {"8"}`**: Reg 8 writes 391 of
   its 399 CFR citations as "40 C.F.R. Part 63" / "40 C. F. R. Part 63,
   Subparts F"; the undotted `CFR_RE` saw only 8. The dotted variant is used
   only for Reg 8 (a dotted OOOOb citation in Reg 7/26 would otherwise
   newly become a link and change baselined output).

Proof of no-op for existing regs: `out/reg26_before.json` (parsed with the
ORIGINAL importer) and `out/reg26_after.json` are byte-identical, as are the
four side files (`_unresolved`, `_duplicate_ids`, `_corrections`,
`_marker_audit`). `sources/REG_26.pdf` is not present in this workspace, so
both runs used the .txt only (table extraction warning in both).

## Label fixes added (printed label → corrected label, source line, why)

All confirmed against the PDF text layer (pdfplumber), not pdftotext artefacts.
Every fix reports `OK (1 hit)` in the parse output.

Part A, Section II (statement-of-basis entries missing their trailing period —
each entry's text was fused into the preceding entry and the sequence jumped G→K):
- `II.H` → `II.H.` (line 445) · `II.I` → `II.I.` (473) · `II.J` → `II.J.` (512)

Part B, Section I.B definitions — stray space between "I.B." and the number
(the tokenizer read each as a bare "I.B." marker; 19 definitions were merged
into the Section I.B heading row as duplicate ids):
- `I.B. 72.`→`I.B.72.` (1494), `I.B. 75.`→`I.B.75.` (1511), `I.B. 76.` (1517),
  `I.B. 77.` (1523), `I.B. 78.` (1527), `I.B. 79.` (1532), `I.B. 80.` (1535),
  `I.B. 81.` (1541), `I.B. 82.` (1544), `I.B. 83.` (1547), `I.B. 84.` (1550),
  `I.B. 84.a.` (1552), `I.B. 84.b.` (1555), `I.B. 85.` (1568), `I.B. 85.a.` (1570),
  `I.B. 85.b.` (1573), `I.B. 85.c.` (1579), `I.B. 86.` (1583), `I.B. 87.` (1586)
- `II.F. 7.` → `II.F.7.` (2425) — same stray-space typo in Section II.F.

Part B, other:
- `II.G.3` → `II.G.3.` (2475) — missing trailing period; fused onto II.G.2.
- `III.A.3.c.(iii).` → `III.A.3.c.(iii)` (2693) — stray period after the paren; heading never a marker.
- `III.A.4.c.(iii)(A)` → `III.A.3.c.(iii)(A)` (2695) — sole child of the (iii) heading above, inside III.A.3 (real III.A.4 has no (iii)).
- `III.A.3.e.(v).` → `III.A.3.e.(v)` (2748) — stray period; it and children (v)(A)–(G) were fused into (iv)(C).
- `III.E.2` → `III.E.2.` (3104) — missing period; children III.E.2.a–d were fused into III.E.1.b.
- `III.P.3.c.(i).` → `III.P.3.c.(i)` (4028), `III.P.3.c.(ii).` → `III.P.3.c.(ii)` (4036) — stray periods.
- `III.S.1.c` → `III.S.1.c.` (4163) — missing period.
- `III.T.2.d (ii)` → `III.T.2.d.(ii)` (4372) — space instead of period; children (ii)(A)–(C) had no parent.
- `II.W.2.i.` → `III.W.2.i.` (4661) — printed between III.W.2.h. and III.W.2.j.
- `IV J.4.` → `IV.J.4.` (5617), `IV J.5.i.` → `IV.J.5.i.` (5717) — space instead of first period.
- `V.B.2.C.` → `V.B.2.c.` (6032) — capital C at the lower-letter depth; fused into V.B.2.b.(v).
- `Vl.C.1.d.` → `VI.C.1.d.` (6371) — lower-case L for roman I.
- `VI.E.1. STANDARD FOR FABRICATING` → `VI.E. STANDARD FOR FABRICATING` (6435) — the flush-left Section VI.E heading carries its own first child's label ("VI.E.1. Applicability" is the very next line); sibling headings are "VI.D. Standard for Spraying"/"VI.F.". Without it Section VI had no E and heading+Applicability merged.

Part D:
- `V.B.I.` → `V.B.1.` (8989) — roman I for digit 1, directly before V.B.2.

Not corrected (documented only): the SOB-internal restarted "I."–"XII."
findings lists and "1."/"2." lists are kept as body text by design (see gate F).

## Quality-gate results A–I

**A. Structure — PASS.** The printed outline lists Parts A–E; the parse has
exactly `sec-8-P-A`…`sec-8-P-E` in order. Top-level sections per part, checked
against every flush-left "N." heading in the source: A: I, II · B: I–VII ·
C: I (Repealed), II · D: I–XII · E: I–VI — the parsed tree has the same 29
sections, same order, no extras. The only flush-left roman look-alike inside
a section ("IV. (School Requirements). Disturbance…", a wrapped "see Section\nIV."
citation at line 4270) was correctly rejected. Appendices: B-A, B-B, B-C, D-A as printed.

**B. Coverage — PASS.** Source body (after cover/outline, page furniture
stripped): 88,242 words; across all parsed `full_text`: 87,578 words
(99.25%). The 0.75% difference is the ~1,300 citation labels (excluded from
`full_text` by convention) and whitespace-only table-cell differences; no text block is missing.

**C. Repeated-text heuristic — PASS (1 hit, legitimate).** Only
`sec-8-B-APPENDIX-C` repeats a 50-char paragraph prefix ≥3× ("● Quiz", 3×) —
the training-course outline genuinely has a quiz bullet after each module.
No row repeats any substantive paragraph. (Before the SOB-section guard and
the I.B stray-space fixes, `sec-8-B-I-B` was a 19-way merged duplicate — now gone: `duplicate_ids = []`.)

**D. Giant / fused rows — PASS.** Ten longest: `sec-8-B-VII-K` 46,755 ·
`sec-8-D-APPENDIX-A` 33,349 · `sec-8-E-III` 22,837 · `sec-8-B-VII-J` 8,169 ·
`sec-8-B-VII-H` 7,334 · `sec-8-E-VI-H` 6,524 · `sec-8-B-VII-B` 6,381 ·
`sec-8-E-VI-J` 6,372 · `sec-8-B-VII-I` 6,331 · `sec-8-E-VI-M` 5,740.
The three over 15,000 are all justified single units: VII.K is one dated
statement-of-basis entry (the January 22, 2021 comprehensive Part B
revision — 134 paragraphs, no compound sub-labels printed inside it; its
inner "I.–XII." and "1.–3." lists are restarted narrative lists, kept as
text like Reg 3's Part F); D Appendix A is EPA Method 301 as one appendix
blob (existing convention); E-III is Section III's printed list of ~110
incorporated Part 63 subparts, which carries no sub-labels in the source
(each "Subpart XXXX …" is a plain paragraph). No sibling paragraphs are fused.

**E. Orphans and label anomalies — PASS.** 0 orphans, 0 duplicate ids, and
every sibling sequence under every parent is contiguous (checked
programmatically: roman, letter incl. AA…QQ, digit, lower, paren families —
0 gaps). Before the fixes there were 26 non-contiguous sequences; each traced
to a printed typo now in `KNOWN_LABEL_FIXES` (above). 26 candidates remain
rejected by the continuation-line guard; every one hand-checked to be a
wrapped citation ("…see Section\nIII.A.1.d.", "III.E.1. (Notices) or
III.G.1 (Permits) must accompany…", "IV.C.1.c. and IV.C.1.d. prior to use…", etc.).

**F. Statement-of-basis — PASS (new shape, configured).** Reg 8 has no SOB
part: each part's LAST section is its statement of basis (A→II, B→VII, C→II,
E→VI; D has none), entries printed as ordinary compound labels
("II.A. September 21, 1995, Emergency Rule with Part E" … "VI.QQ. Adopted
October 17, 2025"). This fits neither `letter_dated` nor `roman_seq` (both
describe a whole part), so it is the new `SOB_SECTION_CONFIG` family
described above. Every entry parsed to its own row in printed order: A II.A–W
(23, dates 1995→Oct 17 2025), B VII.A–K (11), C II.A–B (2), E VI.A–QQ (43,
1995→Oct 17 2025); `sec-8-E-VI-QQ` and `sec-8-A-II-W` are the December 2025
adoptions. Inner numbered lists DO restart inside entries (bare "1.", "2.",
"I."…"XII." with no compound prefix) and are kept as body text — equivalent
to `inner_items: False`. Part B's VII.C and VII.F additionally print genuine
compound sub-items (VII.C.1., VII.C.1.a–c, VII.C.2–3, VII.F.1., VII.F.1.a–d,
VII.F.2) and those are rows, correctly nested.

**G. Cross-references — PASS.** 779 same-reg spans + 21 external anchors.
Reg 3: 20/20 mentions linked (`/regulations/3`); Reg 7: 1/1; "Regulation
Number 8"/"Regulation 8" self-references: 133/133 → root. `other_reg` bucket:
only "Regulation Number 6, Part A" (1, correct — not in corpus).
`cfr` bucket: 143 distinct / 386 mentions after the dotted-CFR fix — dominated
by "40 C.F.R. Part 63" (89), "40 C.F.R. Part 61" (86), "40 C.F.R. Part 763"
(18) and ~130 distinct "40 C.F.R. Part 63, Subpart XXXX" forms — all correctly
unlinked (Part 61/63/763 are not in the corpus). `historical`: 1 ("C." from a
wrapped "Part\nC." phrase). `unparseable`: 13 single mentions, all source
spelling quirks in citations ("III.P.3.b.iii." without parens, "I.B.87.a",
"III.A.I.", "I.I") — no common pattern is being missed. Remaining un-tokenized
CFR forms: 13 ("40 CFR 61", "40 C.F.R. 61 Subpart M" with no "Part" — bucket
only, no output impact).

**H. Tables — PASS.** 8 tables rendered as `doc-table` HTML: Part D Table 1
(LIST OF HIGH-RISK POLLUTANTS, 47 rows × 3, in `sec-8-D-V-F`), and seven
uncaptioned Part B tables rendered in place — GAC fees (`sec-8-B-II-B-2`),
Worker/Supervisor/… fees (`II-C-2`), refresher-course lengths (`II-C-5-b`),
combined-certificate fees (`II-C-6`), AMS fees (`II-D-2`), Permit Fee for
Projects (`III-G-1-c`, with the two paragraphs after it preserved in order),
and the 5-column minimum-clearance-sample matrix (`III-P-3-a-(ii)`). Also
checked: the Part C lead-NAAQS comparison (2 rows, `sec-8-C-II-B`) and the
"Danger" warning-label box (`III-R-2-b`) read fine as plain paragraphs and
were left as text. The multi-row headers ("Amount" over "1 year/3 years/5
years") render as header row + first body row; readable.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py`: **46 passed,
1 skipped** (the pre-existing skip). 14 new tests added: Reg 8 config/meta;
SOB-section guard (accepts entries + nested VII.B.1.a, rejects inner "I."/
"II."/"III.B."/"MM." — with a control test showing the unconfigured
behaviour); sibling-chain acceptance (and unchanged for Reg 26);
`_label_ordinal`/`_is_next_sibling`; extra caption key (Reg 8 only, standard
captions unchanged for every reg); uncaptioned in-place table rendering (and
no-op for another reg); dotted CFR tokenizer (Reg 8) vs unchanged undotted
(Reg 7); and a source-backed test that all 39 label fixes hit exactly once.

Deliverables: `out/reg8_parsed.json` (+ `_unresolved/_duplicate_ids/_corrections/_marker_audit`),
`out/reg8_db.json` (`[]`), `out/reg8_diff_report.md` (1,340 only-parsed, 0
only-DB), `out/apply_reg8/` (plan.json, stats.md — all 3 sanity checks PASS,
1,340 new / 0 obsolete, 7 upsert SQL files, summary_regen_ids.txt), `reg8.patch`
(928 lines; applies cleanly to `../import_ccr.ORIGINAL.py` and `../pipeline/test_import_ccr.py`).

## Things I could not resolve

- **Page-seam joins without a paragraph break** (existing behaviour, cosmetic):
  where a page ends mid-list, the first paragraph of the next page is glued
  to the previous one. Example: inside `sec-8-B-VII-K` the findings "V. The
  NESHAP and AHERA … implementation. VI. The proposed revisions will assist…"
  are one `<p>` (source lines 8138–8150, page break at 134/135). Text is
  complete; only the `<p>` boundary is lost. Same in Reg 7/26 today.
- **Editor's Notes / rulemaking history** (source lines ~13100–13153) is
  appended to the last row, `sec-8-E-VI-QQ` (as the "History" paragraphs after
  a divider line) — same place it lands for Reg 26. Not a parser gap, but the
  summarizer should ignore that tail.
- Part B Appendix B is title-only ("– BROCHURE"): the brochure pages
  (PDF pp. 138–158) are images with no text layer; nothing to parse.
- Section headings whose text is followed by body paragraphs before their
  first child (`sec-8-A-I`, `sec-8-D-I`, `sec-8-E-I`, `sec-8-E-III`, `sec-8-E-V`)
  get `title = "I."` (citation) with the heading words as the first paragraph —
  the established convention for para-carrying rows, not a defect.
- 41 lowercase-start rows, all legitimate list fragments ("provide
  documentation…", "erect secondary containment barriers…", "that is
  participating in…") — listed in the diff report.

## Anything the summarizer should be warned about

- **Adopted-by-reference federal text dominates Parts A and E.** `sec-8-A-I`
  and `sec-8-E-III` are lists of 40 C.F.R. Part 61 / Part 63 subparts
  incorporated by reference "(July 1, 2025)" etc.; several are "Repealed –
  Reserved for …". The regulatory content is in the CFR, not in the row —
  summaries should say "incorporates 40 CFR Part 63 Subpart X (dated
  version)" rather than summarize the subpart. Part E Section III also
  carries permanent Title V exemptions inline for some subparts (M, N, T…).
- **Part C is repealed** except its 2 statement-of-basis entries
  (`sec-8-C-I` "Repealed"; `sec-8-C-II-B` explains the removed lead standard).
- **Part B scoping**: Part B distinguishes school buildings (Section IV,
  AHERA/LEA) from other facilities and single-family residential dwellings
  (SFRD opt-out); many provisions are conditional on "areas of public
  access" and "trigger levels". No "(State Only)" prefixes appear in Reg 8.
- **Acronyms likely to be mis-expanded** (all defined in `sec-8-B-I-C-*`):
  AMS = Air Monitoring Specialist (not "asbestos management system"); GAC =
  General Abatement Contractor (not granular activated carbon); LEA = local
  education agency; MAAL = Maximum Allowable Asbestos Level; ACBM/ACM/ACWM;
  PCM/PLM/TEM analytical methods; NAM = negative air machine; LCF = large
  contiguous facility; MAP = EPA Model Accreditation Plan; SFRD = single-family
  residential dwelling; RFCI = Resilient Floor Covering Institute. In Part D,
  "source" and "base year" have the Part D-specific definitions in Section II.
- **Tables**: the fee tables in Part B (rows listed under gate H) and Part D
  Table 1 (high-risk pollutant weighting factors — note the 100,000 weighting
  for 2,3,7,8-TCDD) are HTML tables inside `full_text`; summaries should
  reference them, not restate every row.
- **Statement-of-basis rows** (79 rows, ids ending in `-A-II-*`, `-B-VII-*`,
  `-C-II-*`, `-E-VI-*`) are rulemaking history, not requirements; several
  Part B entries embed near-identical boilerplate "Findings Pursuant to
  § 25-7-110.5(5)" lists (I.–XII.) — repeated legitimately across entries
  H, I, J, K.
- `sec-8-E-VI-QQ` carries the Editor's Notes history tail (see above).
