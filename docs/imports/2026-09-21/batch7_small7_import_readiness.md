# Batch 7 — agent_small7 — Regs 10, 15 and 29

Three regulations, one directory, one working tree. Everything below was produced with the
same edited `import_ccr.py` / `summarize.py`; per-key patches are split out mechanically and
each verified to reproduce this tree's output exactly (see **Deliverables** at the end).

---

## Shared results (all three keys)

### Full test suite
`python3 -m pytest -q test_import_ccr.py test_summarize.py` → **643 passed, 169 skipped**
(the skips are tests whose source files are not in this agent's `sources/` — this directory
carries only REG_10/REG_15/REG_29 plus the five no-op baselines and REG_CP).
`python3 -m pytest -q test_freshness.py` → 75 passed.

### No-op proof — **both directions, all five mandated baselines**

| baseline | keys REMOVED from `CORPUS_REGS` | keys PRESENT (`strip_reconstruct.py`) |
|---|---|---|
| Reg 26 (626 rows) | byte-identical to `out/base_26.json` | 0 changed rows, 0 anchors, 0 unexplained |
| Reg 30 (444 rows) | byte-identical to `out/base_30.json` | 0 changed rows, 0 anchors, 0 unexplained |
| Reg 25 (993 rows) | byte-identical to `out/base_25.json` | 0 changed rows, 0 anchors, 0 unexplained |
| Reg 7 (2,182 rows) | byte-identical to `out/base_7.json` | 0 changed rows, 0 anchors, 0 unexplained |
| ECMC (6,754 rows) | byte-identical to `out/base_ecmc.json` | 0 changed rows, 0 anchors, 0 unexplained |

**Reproducibility note (important for the merge):** the centrally-built baselines were produced
in a tree that contains `sources/REG_CP.txt`. `_cp_known_ids()` parses that file to validate
"Common Provisions Regulation, Section II.C." style cross-references; without it, four Reg 26
rows lose their `cp` anchors and the "before" side is not reproducible. I copied
`REG_CP.txt` **and** `REG_CP.pdf` from `../base/sources/` into `sources/` for this reason (the
PDF because adding the TXT un-skips `RegCpEndToEndTests::test_civil_penalty_table_rendered`,
which needs it). Neither file is part of any patch.

### Cross-links these three keys actually create, corpus-wide

The five mandated baselines gain **zero** anchors: none of Reg 7 / 25 / 26 / 30 / ECMC mentions
Reg 10, 15 or 29 at all (`grep -oEc 'Regulation[s]?,? ?(Number|No\.?|#)? ?(10|15|29)\b'` over
every `.txt` in `../base/sources/` returns hits only in REG_10, REG_15, REG_29, REG_AQS and
REG_PROC). So I ran the same proof against the two documents that **do** cite them:

* **Air Quality Standards (`aqs`, already in the corpus)** — before/after with
  `import_ccr.ORIGINAL.py`: 80 rows, **5 changed rows, 5 new `/regulations/10` anchors, 0
  unexplained**, strip-and-reconstruct exact. The five source phrases:
  1. `sec-aqs-VIII-I` — "…administered though the transportation conformity regulations. Air Quality Control Commission **Regulation Number 10**, Part B; 40 CFR Part 93."
  2. `sec-aqs-VIII-J` — "…will be administered though the transportation conformity regulations. Air Quality Control Commission **Regulation Number 10**, Part B; 40 CFR Part 93."
  3. `sec-aqs-VIII-L` — "…are administered though the transportation conformity regulations. Air Quality Control Commission **Regulation Number 10**, Part B; 40 CFR Part 93."
  4. `sec-aqs-VIII-M` — "…are administered though the transportation conformity regulations. Air Quality Control Commission **Regulation Number 10**, Part B; 40 CFR Part 93."
  5. `sec-aqs-VIII-O` — "…identical to the federal rules on the subject. Elsewhere, in **Regulation Number 10**, Part B, the Commission has already passed a state regulation…"
* A **sixth** AQS mention does not anchor: `sec-aqs-V-A-1` carries "…delineated in Section IV (F)
  of AQCC Regulation Number 10, Criteria for Analysis of Conformity." inside a
  `COLUMN_LAYOUT_TABLES`-rendered table cell. Rendered table HTML is never passed through
  `link_citations` (pre-existing, corpus-wide behaviour, not something these keys change) —
  flagged for the plumbing backlog, not fixed here.
* **Procedural Rules (`proc`)** cites Reg 10 three more times (REG_PROC.txt lines 676, 3506,
  6340). `proc` is not yet in `CORPUS_REGS`, so those anchors appear only once agent_proc's
  patch lands; nothing on my side is needed.
* Nothing in the corpus cites Reg 15 or Reg 29 by number. Both cite **themselves** heavily
  (28 and 12 self-root `<span class="xref">` targets respectively) and those resolve.

### Merge hot-spots (three literals every Batch 7 agent will touch)
1. `test_import_ccr.py::Batch6SmallConfigTests::test_seam_paragraph_breaks_and_preamble_flags_are_reg_gated`
   — roster extended from `("16", "sip", "18")` to include `10, 15, 29`.
2. `test_import_ccr.py::Batch6SmallConfigTests::test_sob_scopes` — the "`top_indent_ok` is Reg 18's
   alone" roster extended to include `10`.
3. `test_summarize.py::test_only_reg_11_overrides_the_audience` — the `set(REG_AUDIENCE)` literal
   extended with `10, 15, 29`.
   All three are commented "MERGE NOTE" in place.

### Manifest
`sources/manifest.json` gains three `kind: "sos"` entries (10 → 5 CCR 1001-12, ruleId 2345,
ruleVersionId 6679, eff. 2016-03-30; 15 → 5 CCR 1001-19, ruleId 2351, ruleVersionId 2600, eff.
2008-10-30; 29 → 5 CCR 1001-33, ruleId 3435, ruleVersionId 11408, eff. 2024-04-15), delivered as
`manifest_10_15_29.patch`. `test_freshness.py` stays green. No change is needed to
`docs/import.yml.new`: numeric keys already map to `sources/REG_<n>.pdf/.txt`.

---
---

# Reg 10 — import readiness report

## Verdict: **READY WITH NOTES**

## Regulation identity
* Printed title page (REG_10.txt line 20): `REGULATION NUMBER 10 CRITERIA FOR ANALYSIS OF TRANSPORTATION CONFORMITY`, then `5 CCR 1001-12` on its own line (the Reg 16/18/30 convention).
* `root_citation` = `Code of Colorado Regulations · Regulation Number 10`
* **`root_title` = `CRITERIA FOR ANALYSIS OF TRANSPORTATION CONFORMITY 5 CCR 1001-12`**
* Effective 03/30/2016 (Editor's Notes: "Entire rule eff. 01/30/2012. Entire rule eff. 03/30/2016."); SOS ruleVersionId 6679, ruleId 2345. 17 PDF pages, 1,015 source lines.
* **Parts: none.** `grep -nE "^\s*PART [A-Z]" sources/REG_10.txt` is empty; the "Part B, Transportation Conformity" phrases in the statements of basis describe the regulation's pre-2012 structure. `no_parts: True`, ids omit the part segment (`sec-10-III-A-3-a`).
* Sections I–VI, all present: I Requirement to Comply with the Federal Rule, II Definitions, III Interagency Consultation, IV Emission reduction credit for certain control measures, V Enforceability of design concept and scope and project-level mitigation and control measures, VI Statements of Basis.
* **Correction to the brief:** the brief says "no section V printed (IV → VI — check and document)". **Section V IS printed**, at REG_10.txt line 752, with one item V.A. It parses to `sec-10-V` / `sec-10-V-A`.
* **Correction to the brief's title note:** the brief warns the CCR index says "CONFORMITY" vs the title page. Both agree; what differs is the regulation's *own statements of basis*, which call it "Criteria for Analysis of **Conformity**" (VI.A, and the AQS table cell above). The title page spelling is what `root_title` uses.

## Row counts
* **79 rows**: 1 root, 6 sections, 72 items.
* Per section (rows whose id sits under it): I 4, II 1, III 63, IV 3, V 2, VI 5.
* Rows with ≥25 words (these get summaries): **63**.
* Longest row: `sec-10-II` (Definitions), 6,347 characters.

## Changes made to import_ccr.py
* `CORPUS_REGS["10"] = "10"` — so Reg 10 resolves as a cross-reference target (5 real anchors in `aqs`, 3 more once `proc` lands).
* `REG_META["10"]` — `no_parts: True`, state / CDPHE-APCD / aqcc-regulations, root citation and title above.
* `REG_META["10"]["seam_paragraph_breaks"] = True` — every one of the 17 page seams in REG_10.txt opens a new paragraph (12 a marker line, 2 a new Section II definition, 3 a new statement-of-basis paragraph or sub-heading); not one continues a wrapped sentence. Verified seam by seam. Without it, "Metropolitan planning organization (MPO) …" and "Transportation Plan in the context of this regulation …" were spliced onto the tail of the preceding definition.
* `SOB_PART_CONFIG["10"]` — `section: "VI"`, `top_family: "letter_dated"`, `roman_prefix: "VI"`, `top_opener_re = ^(?:Amendments?\s+)?Adopted:?\s`, `inner_items: False`, **`top_indent_ok: True`**.

No new parser capability was added for Reg 10; every key used already existed (`no_parts`, `seam_paragraph_breaks`, the Reg 1/16-style section-scoped `letter_dated` SOB with `roman_prefix`, and Reg 18's `top_indent_ok`).

## Label fixes added
**None.** Reg 10 prints no misnumbered or dot-less label anywhere; `out/reg10_parsed_corrections.json` is empty on both `label_fixes` and `anomalies`.

## Quality-gate results A–I

**A. Structure — PASS.** No printed table of contents exists, so the outline was built from the body's own headings. Parsed tree: root → six sections I…VI in printed order, then the nested dotted-path items (`III.A.3.a.`, `III.C.1.g.`, `III.F.1.g.`, `III.H.4.c.` — max depth 4). Matches the printed document exactly, including Section V.

**B. Coverage — PASS (0.00% shortfall).** Body from the "I. Requirement to Comply…" line: 7,292 word tokens with the printed labels stripped (the parser deliberately drops the label from `full_text` — the app re-inserts it as a badge); parsed rows carry 7,304, the extra 12 being citation labels re-inserted on the 12 heading-only rows. **Zero source tokens missing.** 73 tokens of title page / editor's-note front matter before Section I belong to no row — identical to Reg 1 and `aqs`, which are also part-less with `find_body_start_no_parts` falling back to 0. Two of those lines are the regulation's printed long-form subtitle, "Conformity to State Implementation Plans of Transportation Plans, Programs, and Projects / Developed, Funded or Approved Under Title 23 U.S.C. or the Federal Transit Act" (lines 26-27) — see *Things I could not resolve*.

**C. Repeated-text heuristic — PASS.** First-50-character prefixes of every paragraph in every row: **0 rows** with a prefix recurring ≥3×.

**D. Giant / fused rows — PASS.** Ten longest: `sec-10-II` 6,347 (Definitions — see the note below), `sec-10-VI-A` 4,676, `sec-10-VI-B` 4,646, `sec-10-VI-D` 2,639, `sec-10-VI-C` 1,971 (all four statement-of-basis entries), `sec-10-III-C-1-d` 1,753, `sec-10-III-C-1-b` 1,560, `sec-10-III-H-2` 1,238, `sec-10-III-B-1-c` 1,132, `sec-10-III-A-3-c` 978. Nothing over 15,000; nothing fused.

**E. Orphans and label anomalies — PASS.** 79 unique ids, 0 duplicates, every `parent_id` resolves, `sort_order` strictly increasing, every sibling label run contiguous from 1 (checked per parent under both roman and alphabetic readings), 0 rows whose visible text starts lower-case.

**F. Statement of basis — PASS.** Section VI (not a part). Family `letter_dated` with the section's own "VI." as a constant roman prefix — the Reg 1 "X." / Reg 16 "III." shape. Four entries, each its own row in order: `sec-10-VI-A` "Amendments Adopted October 15, 1998", `-B` "Amendments Adopted November 20, 2008", `-C` "Amendments Adopted December 15, 2011", `-D` "Adopted: February 18, 2016". Two things were needed: (a) the opener accepts an optional leading "Amendments", which three of the four print; (b) **`top_indent_ok`** — all four entries sit at indent 6 under the flush-left "VI." heading, and the scanner's indent-0 requirement rejected every one of them, fusing the whole 14,000-character statement of basis into `sec-10-VI` (exactly the failure Reg 18 hit). `inner_items: False` because entry A's prose hard-wraps "…Section 25-7-\n**110.8(1)(b)**, C.R.S. …" (line 828) and entry B's wraps "…to be "addressed,"\n**i.e.**, made explicit …" (line 869) — a digit marker and a "lower" marker that `CYCLE_C_INNER` would each have turned into a row swallowing the rest of the entry.

**G. Cross-references — PASS.** 20 internal `<span class="xref">` spans, **0 dangling targets**, 0 external anchors (Reg 10 cites no other corpus regulation). Unresolved buckets: `cfr` = {"40 CFR Part 93, Subpart A": 4, "40 CFR Part 93": 1} — correct, Part 93 is not in the corpus; `historical` = {"Part B": 2} — correct, those name the regulation's own pre-2012 part structure, which no longer exists; `other_reg` and **`unparseable` are both empty**. Three wrapped citations that open a line ("…set out in \\ Section\n**III.H.** The Commission may escalate…", "…pursuant to Section\n**III.F.** to further clarify…") were correctly rejected as continuations by the generic guard and still link as citations — no `KNOWN_CONTINUATION_LINES` entry needed.

**H. Tables — N/A (PASS).** `grep -E "^\s*(TABLE|Table)\s+\d" sources/REG_10.txt` is empty; pdfplumber finds 0 tables in REG_10.pdf. Nothing to recover.

**I. Tests — PASS.** 643 passed / 169 skipped across `test_import_ccr.py` + `test_summarize.py`, including the new `Batch7Small*` classes (config, label/text fixes, full parse, no-op).

## Things I could not resolve
1. **`sec-10-II` (Definitions) is one 6,347-character row holding all 15 defined terms.** The print gives them no per-term label of *any* kind — not a number, not an all-caps standalone heading — so neither `TERM_DEFINITIONS_SECTION` (Common Provisions: all-caps line alone on its paragraph) nor `BARE_DIGIT_CHILD_SECTIONS` (Reg 11: bare "N.") fits, and three of the fifteen do not even use a "means"/"is" verb ("Project-level Conformity See: Hot Spot Analysis"; "Transportation Improvement Program (TIP) A prioritized program…"). I deliberately did **not** invent a prose heuristic for it. After the `seam_paragraph_breaks` fix the row is 16 clean paragraphs (the "Definitions" heading + 15 definitions, each exactly as printed) and is well under the gate-D threshold, so nothing is lost — but the reader gets one summary for fifteen terms. *Recommendation for the plumbing backlog:* a `TERM_DEFINITIONS_SECTION` variant whose matcher is "every paragraph inside the configured section is one definition", with the term taken as the leading tokens up to a `means|is|are|refers|See:` stop word or a trailing `(ABBR)`. I verified that rule produces exactly the right 15 splits, but it is a new marker family and belongs in a plumbing change, not a reg import.
2. **`sec-10-I` and `sec-10-II` are titled by their bare citation ("I.", "II.")**, with the printed heading text as the row's first paragraph. That is the corpus-wide convention for a section that carries body text of its own (`sec-26-B-I`, `sec-30-B-III`, `sec-25-C-I` all do the same) — not a Reg 10 bug, but worth knowing before someone "fixes" it.
3. **The regulation's printed long-form subtitle is unowned.** REG_10.txt lines 26-27 sit above Section I and below the cover divider, so, as for Reg 1 and `aqs`, no row carries them. If the CEO wants that text, the mechanism is `preamble_heading` — but there is no heading line to hang it on, so it would need a new config key.
4. **A stray backslash in the source.** REG_10.txt line 178 prints "…the dispute resolution process set out in `\` Section III.H." The backslash is in the official text layer (pdfplumber confirms), so it is preserved verbatim in `sec-10-III-A-2`. The citation still links.
5. **The sixth AQS mention of Reg 10 does not anchor** because it lives inside a rendered table cell (see "Cross-links" above). Corpus-wide plumbing issue, not Reg 10's.

## Anything the summarizer should be warned about for this regulation
`REG_AUDIENCE["10"]` = "a transportation planner at a Colorado metropolitan planning organization or state agency doing conformity analysis" (not the oil-and-gas default).
`REG_PROMPT_HINTS["10"]` (192 words) covers, and the tests assert:
* **The Batch 6 Reg 21 lesson, applied literally.** The hint never asks for applicability or scope to be stated. It says Section I is the only section that states the regulation's reach and "do not repeat or infer that on any other row, and never add a nonattainment or maintenance area, a county or an effective date a row does not itself name." A dedicated test (`test_batch7_small_hints_never_ask_to_restate_applicability`) fails if that discipline is ever reversed.
* 40 CFR Part 93 Subpart A (and §§ 93.105, 93.122(a)(4)(ii), 93.125(c), 51.390) is **adopted by reference** — name it, never describe what the federal rule requires. Reg 10 is almost entirely a pointer to the federal rule; this is the single biggest hallucination risk.
* Section II's defined terms (CDOT, Commission = AQCC, Division = APCD, LPA, MPO, TPR, Hot Spot Analysis, Regional Transportation Conformity, routine conformity determination) mean only what Section II says. **All fifteen arrive in one row** (item 1 above) — the summary for `sec-10-II` will necessarily be a list.
* Section III assigns duties **agency by agency** (III.A.3.a Division, .b LPA, .c MPO, .d–.e CDOT, .f Commission); never move one agency's duty to another.
* TCM, TIP, SIP, FHWA, FTA, EPA stay as written.
* Section VI rows are rulemaking history, not requirements, and the trailing Editor's Notes revision history sits on `sec-10-VI-D` (corpus convention — Reg 7/25/26/30 all park it on their last SOB row).

---
---

# Reg 15 — import readiness report

## Verdict: **READY WITH NOTES**

## Regulation identity
* Printed title page (REG_15.txt line 20): `REGULATION NUMBER 15 CONTROL OF EMISSIONS OF OZONE-DEPLETING COMPOUNDS`, then `5 CCR 1001-19`.
* `root_citation` = `Code of Colorado Regulations · Regulation Number 15`
* **`root_title` = `CONTROL OF EMISSIONS OF OZONE-DEPLETING COMPOUNDS 5 CCR 1001-19`**
* Effective 10/30/2008 (Editor's Notes: "Entire rule eff. 01/30/2008. Section III eff. 10/30/2008."); SOS ruleVersionId 2600, ruleId 2351. 7 PDF pages, 413 source lines — the smallest AQCC document in the corpus after Reg 18.
* **Parts: none.** `no_parts: True`. (The "§ XII of Part C of Regulation No. 15" in the 1997 statement of basis describes the pre-1998 structure.)
* Sections I–VI: I Definitions, II General Requirements, III Registration Requirements for Stationary Appliances and Refrigerated Food Appliances, IV Notification and Reporting Requirements for Air Conditioning and Refrigeration Service Facilities, V Motor Vehicle Air Conditioning Service Requirements, VI Statements of Basis.
* **Answer to the brief's "III and IV not matched by the survey regex — find them":** both are real sections and both are simply printed **flush left** (indent 0) rather than at the 4-space page-one margin that Sections I and II sit in — III at line 86, IV at line 113. IV additionally **wraps onto a second line** ("…Refrigeration Service" / "Facilities"), which is why a single-line regex missed it.

## Row counts
* **36 rows**: 1 root, 6 sections, 29 items.
* Per section: I 8, II 5, III 4, IV 7, V 6, VI 5.
* Rows with ≥25 words: **20**.
* Longest row: `sec-15-VI-B` (statement of basis, May 21 1998), 10,221 characters.

## Changes made to import_ccr.py
* `CORPUS_REGS["15"] = "15"`.
* `REG_META["15"]` — `no_parts: True`, `seam_paragraph_breaks: True`, state / CDPHE-APCD, root citation and title above.
* **`BARE_LADDER_REGS` extended to `{"9", "sip", "15"}`** — Reg 15 prints every label BARE ("A.", "B.", "1.") and never a dotted compound (`grep -nE "^\s*[IVX]+\.[A-Z]\." sources/REG_15.txt` is empty). It takes the DEFAULT per-depth family list (roman / upper / digit / lower…) and needs no `BARE_LADDER_FAMILIES` or `BARE_LADDER_LEAF_CHAINS` entry, because it is only three levels deep and no lettered list in the document reaches "I." (the longest is Section I's A..G), so the ladder never has to choose between a 9th definition letter and a new roman section.
* `SOB_PART_CONFIG["15"]` — `section: "VI"`, `top_family: "letter_dated"`, `implicit_section_prefix: True`, `inner_items: False`, and a **reg-specific `top_opener_re`** (below).
* `KNOWN_TEXT_FIXES["15"]` — two entries, the wrapped Section IV heading (below).

No new parser capability was added; `BARE_LADDER_REGS`, `implicit_section_prefix` (Reg 9/18) and the ordinary in-line `KNOWN_TEXT_FIXES` replace are all pre-existing.

## Label fixes added
Both are `KNOWN_TEXT_FIXES` entries, each reporting exactly **1 hit**, and together they are **line-count-preserving** (so `clean_pages`'s already-computed page-seam indices and every other fix's line hint are untouched — the same discipline `KNOWN_LABEL_FIXES`' `prev_blank_line` keeps):

| printed | corrected | source line | why |
|---|---|---|---|
| `IV. Notification and Reporting Requirements for Air Conditioning and Refrigeration Service` + `        Facilities` on the next line | the two joined onto the heading line; the orphan line blanked | REG_15.txt 113–114 | `_heading_continuation_lines` joins a wrapped heading only for PART and APPENDIX markers, never for a roman section. The tail therefore counted as body text: `sec-15-IV` was titled by its bare citation "IV." and its own title became its first paragraph — one of six sections with no title at all in the sidebar. The second half matches `"        Facilities"` **with its leading whitespace**; the document's only other "Facilities" line (170, "Facilities. In order to effectively collect such a fee…") is flush left. |

## Quality-gate results A–I

**A. Structure — PASS.** No printed table of contents. Parsed tree: root → six sections I…VI in printed order, each titled from its own printed heading (including IV, after the fix), with bare-ladder children I.A–I.G, II.A–II.D, III.A–III.C, IV.A(.1–.3)–IV.C, V.A(.1–.3)–V.B, VI.A–VI.D. Matches the printed document.

**B. Coverage — PASS (0.00% shortfall).** Body from "I. Definitions": 3,295 word tokens with printed labels stripped; parsed rows carry 3,303 (the 8 extra are citation labels re-inserted on heading rows). **Zero source tokens missing.** 49 tokens of title-page front matter unowned, as for Reg 1 / `aqs` / Reg 10.

**C. Repeated-text heuristic — PASS.** 0 rows with a 50-character paragraph prefix recurring ≥3×.

**D. Giant / fused rows — PASS.** Ten longest: `sec-15-VI-B` 10,221, `sec-15-VI-A` 2,546, `sec-15-VI-D` 1,753, `sec-15-VI-C` 1,607 (the four statement-of-basis entries), `sec-15-III-B` 1,268, `sec-15-I-G` 979 (the "Stationary Appliance" definition, genuinely that long), `sec-15-II-D` 804, `sec-15-IV-C` 557, `sec-15-II-B` 463, `sec-15-III-A` 432. Nothing over 15,000; the only four-figure rows are statements of basis. Justified.

**E. Orphans and label anomalies — PASS.** 36 unique ids, 0 duplicates, every `parent_id` resolves, `sort_order` strictly increasing, every sibling run contiguous from 1, 0 lower-case-start rows. Notably **no `sec-15-A` collision**: `implicit_section_prefix` nests the statement-of-basis letters under `sec-15-VI`, keeping them clear of Section I's own definitions letter A.

**F. Statement of basis — PASS.** Section VI (not a part), `letter_dated`, **bare letters with no printed roman prefix** — exactly Reg 9's Section IX / Reg 18's Section II shape, hence `implicit_section_prefix`. Four entries, each its own row, each opening with a **bare date and no "Adopted" keyword at all**: `sec-15-VI-A` "November 20, 1997", `-B` "May 21, 1998", `-C` "December 20 & 21, 2007", `-D` "September 18, 2008". Entry C is why this reg needed its own opener: its two-day hearing date is written with an **ampersand**, which neither `DATE_START_RE` nor `REG9_SOB_OPENER_RE` accepts (both allow only a hyphen between the two days) — asserted directly in `test_reg15_sob_is_section_vi_with_bare_letters`. `inner_items: False` like every other bare-letter SOB: the entries are narrative with bare "Background"/"Basis"/"Purpose"/"Action Taken"/"FEDERAL REQUIREMENTS" sub-headings and no labelled list.

**G. Cross-references — PASS.** 38 internal spans (28 of them to the regulation's own root, from its 24 "Regulation No. 15" self-mentions), **0 dangling targets**, 0 external anchors (Reg 15 cites no other corpus regulation). Unresolved: `historical` = {"Part C": 1} — correct, the 1997 statement of basis names the pre-1998 "Part C"; `other_reg`, `cfr` and **`unparseable` all empty**. Note `40 CFR Part 82` is written "Title 40, Part 82, Subpart F" and "40 C.F.R., Part 82, Subparts B and F", which `CFR_RE` does not tokenize; it is therefore not even bucketed. That is pre-existing tokenizer behaviour shared with other regs, and Part 82 is not in the corpus, so nothing would link either way — recorded here so it is not mistaken for a gap.

**H. Tables — N/A (PASS).** No "Table N" captions in the source; pdfplumber finds 0 tables.

**I. Tests — PASS.** Covered by the 643-passing suite, including `test_reg15`, `test_reg15_sob_is_section_vi_with_bare_letters`, `test_reg15_is_the_third_bare_ladder_document` and `test_reg15_wrapped_section_iv_heading_is_rejoined`.

## Things I could not resolve
1. **A misprinted cross-reference in the source, left as printed.** `sec-15-IV-C` reads "…accounted for such individual in the fee submitted pursuant to **Sections V.A.1. and V.A.2.** of this Regulation No. 15." Section IV is the notification-and-fee section; V is motor-vehicle A/C recordkeeping. The intended targets are almost certainly IV.A.1. and IV.A.2. (the 1998 renumbering moved them). Because `sec-15-V-A-1` and `sec-15-V-A-2` genuinely exist, the parser links them — **to the wrong provisions, faithfully as printed**. I did not "correct" it: unlike the Reg 29 fixes below, this is a substantive citation, not a typography slip, and rewriting it would change what the regulation says. The summarizer hint tells the model to say a row *cites* something rather than describe the target, which contains the damage. Flagged for a human.
2. **The Editor's Notes tail lands on `sec-15-VI-D`** (corpus convention, see Reg 10 note 5 equivalent).

## Anything the summarizer should be warned about for this regulation
`REG_AUDIENCE["15"]` = "a motor-vehicle air-conditioning or refrigeration service technician in Colorado".
`REG_PROMPT_HINTS["15"]` (177 words) covers, and the tests assert:
* **No geographic scope anywhere.** Reg 15 states no area, no per-provision effective date — the hint forbids writing "statewide", naming an area or county, or adding a date a row does not print, rather than asking for applicability to be restated (the Reg 21 lesson).
* Section I's seven defined terms — and specifically that a **Stationary Appliance** is 100 horsepower or greater and is **not** a refrigerated food appliance; those two categories have separate registration rules and fees and are the easiest thing to conflate.
* 40 CFR Part 82 Subparts B and F, 42 USC 7671g and 62 Fed. Reg. 68026 are **incorporated by reference as of the printed edition dates** — name them, never describe their contents. Nearly all of Section II is such an incorporation.
* **Quote every fee, cap, pound threshold and filing window exactly.** This regulation is mostly numbers: $47.00 per stationary appliance, $300.00 per facility cap, $29.00 base per site, $2.00 per product refrigeration system, $3.00 per 100 pounds, $75.00 per system cap, $40.00 annual facility notification, 300 pounds, 100 horsepower, "within sixty (60) days of November 1", "within thirty (30) days of installation", "within sixty (60) days of April 1", one-year record retention.
* "Division" = APCD, "Commission" = AQCC; Section VI rows are rulemaking history, and the trailing Editor's Notes sit on the last of them.
* **Not in the hint but worth a human's attention:** the `sec-15-IV-C` mis-citation above. The summary will say the row points at Sections V.A.1./V.A.2. — which is what the page says.

---
---

# Reg 29 — import readiness report

## Verdict: **READY WITH NOTES**

## Regulation identity
* Printed title page (REG_29.txt lines 20–24): `REGULATION NUMBER 29` / `EMISSION REDUCTION REQUIREMENTS FOR LAWN AND GARDEN EQUIPMENT` / `5 CCR 1001-33` — the Reg 11/12/20/30 convention (number stripped, title + cite kept).
* `root_citation` = `Code of Colorado Regulations · Regulation Number 29`
* **`root_title` = `EMISSION REDUCTION REQUIREMENTS FOR LAWN AND GARDEN EQUIPMENT 5 CCR 1001-33`**
* Effective 04/15/2024 (Editor's Notes: "New rule eff. 04/15/2024."); SOS ruleVersionId 11408, ruleId 3435. 7 PDF pages, 424 source lines.
* **Answer to the brief's "four `PART [A-Z]` matches — confirm whether it is part-structured or a flat I–IV":** it **is** part-structured, with exactly **two** parts. The four matches are those two headings printed twice each — once in the front-matter "Outline of Regulation" (lines 31, 33) and once in the body (lines 42, 215); `find_body_start` already skips the outline copy. "PART A  Emission Reduction Requirements for Lawn and Garden Equipment" (Sections I–IV) and "PART B  STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE". The "I. Adopted: February 16, 2024" at line 217 the brief spotted is Part B's single `roman_seq` entry, not a section of Part A.
* Sections: I Applicability and general provisions, II Definitions, III Use restrictions, IV Recordkeeping and reporting.

## Row counts
* **51 rows**: 1 root, 2 parts, 5 sections, 43 items.
* Per part: Part A 48 rows, Part B 2 rows (the part row + its single statement-of-basis entry).
* Rows with ≥25 words: **18**.
* Longest row: `sec-29-B-I` (the February 16 2024 statement of basis), 12,835 characters.

## Changes made to import_ccr.py
* `CORPUS_REGS["29"] = "29"`.
* `REG_META["29"]` — state / CDPHE-APCD, root citation and title above, plus `seam_paragraph_breaks: True` (all six seams open a new paragraph: three a marker line, two a bare Part B sub-heading — "Purpose", "Additional Considerations" — that was otherwise glued to the previous page's last sentence, one the "XII." item of the entry's own findings list).
* `SOB_PART_CONFIG["29"]` — `letter: "B"`, `top_family: "roman_seq"`, `top_opener_re = ^Adopted:?\s`, `inner_items: False`.
* `KNOWN_LABEL_FIXES["29"]` — one entry (the dot-less `III.C`).
* `KNOWN_TEXT_FIXES["29"]` — two entries (the fused severability line).

No new parser capability was added.

## Label fixes added

| printed | corrected | source line | why |
|---|---|---|---|
| `III.C    The restrictions in Sections III.A. and III.B. also apply…` | `III.C.` | REG_29.txt 163 | The **only** label in the whole regulation missing its trailing dot (III.A. and III.B. immediately above both print it). Without the fix the line was not a marker at all: its text folded into III.B. as trailing paragraphs, making III.B. a 613-character two-provision row, and the label gate reported Section III's letter run as A..B with C missing. Reported as **1 hit**. Corrected here rather than by setting `labels_without_trailing_dot` (the Reg 20 flag) because this is a single confirmed misprint, not a reg-wide habit — a one-line fix that reports its own hit count is the narrower change. |
| `…provisions in Section IV.I.C. Severability. If any section, clause, phrase, or standard` (all on one printed line, inside I.B.5.) | split into `…provisions in Section IV.` + a new `I.C.      Severability. …` label | REG_29.txt 62–63 | **The official CCR print fuses the regulation's severability provision onto the end of I.B.5.**, with no line break and no label of its own. Confirmed against REG_29.pdf page 1 with pdfplumber's own layout-free extraction, so it is the source document's error, not a pdftotext artifact. Read literally, I.B.5. ends "…reporting provisions in Section IV." and the next sentence opens a new Section I item, "I.C. Severability." — Section I is "Applicability and general provisions", and every other AQCC Part A of this generation carries its severability clause as that part's last Section I item. Without the fix the severability clause lived inside an emergency-use *exemption* row, there was no `sec-29-A-I-C` row at all, and "Section IV.I.C." went to the `unparseable` bucket as a bogus five-token citation. Fixed with the **ordinary in-line `KNOWN_TEXT_FIXES` replace, no new mechanism and no line insert**: the sentence's opening words are cut from line 62 and re-wrapped onto the front of line 63 carrying the "I.C." label at Section I's own item indent (14). Every printed word is preserved verbatim and the line count is unchanged — a unit test asserts the word multiset before and after is identical apart from the run-on token "IV.I.C." separating into "IV." + "I.C.". Reported as **1 hit** each. |

## Quality-gate results A–I

**A. Structure — PASS.** Printed "Outline of Regulation" (lines 29–33) lists PART A and PART B; the parsed tree has exactly those two parts in that order, Part A with Sections I–IV in printed order and Part B with its one entry. No mismatch.

**B. Coverage — PASS (0.00% shortfall).** Body from the body copy of "PART A": 2,681 word tokens with printed labels stripped; parsed rows carry 2,721 (40 extra = citation labels re-inserted on the heading-only rows). **Zero source tokens missing** — including every word of the re-wrapped severability sentence. 158 tokens of title page + outline + incorporation-by-reference boilerplate before the body copy of "PART A" are unowned front matter, exactly as for every part-structured reg in the corpus.

**C. Repeated-text heuristic — PASS.** 0 rows with a 50-character paragraph prefix recurring ≥3×, including inside the 12,835-character statement of basis (whose two restarted roman findings lists are distinct text).

**D. Giant / fused rows — PASS.** Ten longest: `sec-29-B-I` 12,835 (the single statement-of-basis entry — a long narrative document, justified and deliberately undivided), then `sec-29-A-IV-B` 501, `sec-29-A-II-D` 369, `sec-29-A-II-B` 357, `sec-29-A-IV-A` 352, `sec-29-A-I-C` 345, `sec-29-A-IV-B-3-b` 328, `sec-29-A-II-G` 324, `sec-29-A-III-C` 307, `sec-29-A-III-B` 300. Nothing else is even four figures; no fusion.

**E. Orphans and label anomalies — PASS.** 51 unique ids, 0 duplicates, every `parent_id` resolves, `sort_order` strictly increasing, 0 lower-case-start rows. Every sibling run is contiguous from 1 **after the two fixes** — before them Section I ran A, B (no C) and Section III ran A, B (no C). Section II's run A..I is contiguous (the gate checks both the roman and alphabetic reading of "I", so the 9th definition letter is not mistaken for a roman 1). The 14-item `II.C.1`..`II.C.14` equipment list is complete.

**F. Statement of basis — PASS.** Part B, `roman_seq`, one entry so far: `sec-29-B-I`, opening "Adopted: February 16, 2024". `inner_items: False`. The interesting part is the **top-level** scan, not the inner one: the entry's "Additional Considerations" and § 25-7-110.8 findings lists **restart bare roman numbering twice inside it** ("I."…"XII." at lines 338–390, then "I."…"V." at 399–412), flush left and paragraph-initial — i.e. every one of those items IS the next roman numeral the scanner expects and IS paragraph-initial. Only the `^Adopted:?\s` opener test rejects them; a date-shaped or bare-letter opener would have shredded the entry into a dozen phantom top-level entries. A unit test asserts three of those inner items fail the opener, and that `sec-29-B-II` does not exist.

**G. Cross-references — PASS.** 24 internal spans (12 to the regulation's own root, 12 to Part A rows), **0 dangling targets**, 0 external anchors, and **every unresolved bucket is empty** — including `unparseable`, which before the severability fix held the bogus "IV.I.C." and the dot-less "III.C.". The one wrapped citation that opens a line ("…compliance with Sections III.A. through\n**III.C.** Records must be made available…", IV.A) was correctly rejected as a marker by the generic guard and still links as a citation.

**H. Tables — N/A (PASS).** No "Table N" captions; pdfplumber finds 0 tables. The 14-item equipment list in II.C is a labelled list, not a table, and parsed as 14 rows.

**I. Tests — PASS.** Covered by the 643-passing suite, including `test_reg29`, `test_reg29_sob_is_part_b`, `test_reg29_fused_severability_line_is_rewrapped_without_changing_line_count`, `test_reg29_text_fixes_are_inert_on_text_that_does_not_match` and `test_reg29_missing_trailing_dot_on_iii_c`.

## Things I could not resolve
1. **Nothing blocking.** The two source misprints above are fixed and unit-tested; both report exactly 1 hit, and the parse fails loudly (0 hits, reported in `out/reg29_parsed_corrections.json`) if the source text ever changes under them.
2. **One judgement call the CEO should ratify:** creating `sec-29-A-I-C` (Severability) is a structural correction to the *official* text, which prints no such label. I am confident it is right — the sentence is a standard severability clause, it is grammatically impossible as a continuation of I.B.5. ("…provisions in Section IV.I.C. Severability. If any section…"), Section I is the applicability-and-general-provisions section where severability belongs in this generation of AQCC rules, and the Reg 19 `(Reserved)III.B.5.` precedent is the same kind of correction. But it does mean the app will show a provision label the PDF does not print. The alternative — leaving severability buried inside an emergency-use exemption — is worse.
3. **Layout noise, harmless.** Reg 29's label indents are inconsistent in the source (I.A. at column 10, I.B. at column 4, I.B.1. at column 10, II.A. at 6, II.G. at 7, III.A. at 7). The column-deviation guard flagged 8 candidates and rejected exactly 1, correctly (the wrapped "III.C." continuation above). No action needed.

## Anything the summarizer should be warned about for this regulation
`REG_AUDIENCE["29"]` = "a public-entity fleet or grounds manager buying or using lawn and garden equipment in Colorado".
`REG_PROMPT_HINTS["29"]` (164 words) covers, and the tests assert:
* **The Reg 21 lesson, stated explicitly for a document that does have a multi-leg applicability section.** The hint says "Part A Section I states applicability and the Section I.B exemptions; **do not repeat or infer applicability, scope or an exemption on any other row**, and never add 'statewide', the ozone nonattainment area, a county or a date a row does not itself print." This regulation is precisely the trap Reg 21 fell into: its reach has three legs (federal government, state agencies, local governments) and two different geographies, so a row-level guess is very likely to be wrong.
* **The two use restrictions are NOT interchangeable and must never be merged.** III.A: state government agencies, engines smaller than **19 kW (25 horsepower)** — no area named. III.B: the federal government and local governments, engines smaller than **7 kW (10 horsepower)**, **in the ozone nonattainment area**. Swapping either the entity set or the threshold is the single most damaging error available here, and the hint names both explicitly. A unit test asserts `sec-29-A-III-A` does not contain "7 kW" and vice versa.
* The June 1 – August 31 window, the June 1 2025 start, the June 1 2026 first report and annually thereafter, and the five-year record retention are quoted exactly.
* Section II's nine defined terms are used only as defined — "local government" includes public school districts and special districts; "ozone nonattainment area" is the 40 CFR § 81.306 area; "lawn and garden services" explicitly excludes forest or grassland management.
* Part B is rulemaking history, not requirements — **and its two internal "I."–"XII." / "I."–"V." lists are the Commission's § 25-7-110.5(5)(b) and § 25-7-110.8 findings, not numbered requirements.** They sit inside `sec-29-B-I` as paragraphs; a summary that reads them as obligations would be badly wrong.
* The trailing Editor's Notes revision history sits at the end of `sec-29-B-I`.

---
---

## Deliverables in this directory

| file | what it is |
|---|---|
| `out/reg10_parsed.json`, `out/reg15_parsed.json`, `out/reg29_parsed.json` | 79 / 36 / 51 rows, plus the `_unresolved` / `_duplicate_ids` / `_corrections` / `_marker_audit` sidecars |
| `out/reg{10,15,29}_db.json` | `[]` — brand-new regulations, so every row diffs as `new` |
| `out/reg{10,15,29}_diff_report.md` | 79 / 36 / 51 rows all `only_parsed`; 0 page-furniture leaks, 0 lowercase-start rows |
| `out/apply_reg{10,15,29}/` | plan + one SQL file each; **all three sanity checks PASS** for all three |
| `reg10.patch`, `reg15.patch`, `reg29.patch` | per-key `import_ccr.py` + `test_import_ccr.py` diffs against the ORIGINALs |
| `reg10_summarize.patch`, `reg15_summarize.patch`, `reg29_summarize.patch` | per-key `summarize.py` + `test_summarize.py` diffs against the ORIGINALs |
| `reg10_15_29.patch`, `reg10_15_29_summarize.patch` | the **combined** diffs — exactly this working tree |
| `manifest_10_15_29.patch` | the three `sources/manifest.json` freshness entries |
| `_gates_small7.py` | the gate A–I harness (`python3 _gates_small7.py 10`) |
| `_split_small7.py` | builds the per-key variants the per-key patches are diffed from |

**How to merge.** Apply `reg10_15_29.patch` + `reg10_15_29_summarize.patch` + `manifest_10_15_29.patch`;
all three apply cleanly to the pristine ORIGINALs and reproduce this tree byte-for-byte (verified).
The six per-key patches are for a partial merge: **each applies cleanly to the ORIGINAL on its own**,
and each was verified to (a) pass the full test suite and (b) reproduce this tree's
`out/reg<key>_parsed.json` byte-for-byte in isolation — but they overlap at the same dict insert
points, so they cannot be applied one after another without a hand-merge. Use the combined patch
unless you want only one or two of the three keys.
