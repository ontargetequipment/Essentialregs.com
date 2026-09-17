# Reg 2 — import readiness report

## Verdict: READY WITH NOTES

All nine gates pass. The notes are (1) four Part C statement-of-basis rows are
long single-row narratives (by design, `inner_items: False`), (2) the trailing
"Editor's Notes / History" block lands in the last Part C row exactly as it does
for Reg 26 today, and (3) the effective date I was given (11/01/2013) is not
printed anywhere in the PDF — see "Regulation identity".

## Regulation identity

- Title as printed on the title page: `REGULATION NUMBER 2 ODOR EMISSION` (number and
  name on one line), cite `5 CCR 1001-4`. `root_title` = `ODOR EMISSION 5 CCR 1001-4`,
  `root_citation` = `Code of Colorado Regulations · Regulation Number 2`.
- Effective date: the PDF prints no effective date on its title page. Its Editor's
  Notes (last page) say `Entire rule eff. 08/30/2008` and `Part B, Part C.IV eff.
  07/15/2013`; PDF metadata is a Word 2010 print created 2014-01-22. The
  11/01/2013 date in my assignment does not appear in the document — treat it as
  the CCR publication date, not something the parser can confirm.
- 45 pages, `sources/REG_2.txt` 2,686 lines, zero tables (pdfplumber finds none on
  any page; no "Table N" captions in the text).
- Parts found (3): `PART A GENERAL PROVISIONS`, `PART B HOUSED COMMERCIAL SWINE
  FEEDING OPERATIONS`, `PART C STATEMENT OF BASIS, SPECIFIC STATUTORY AUTHORITY,
  AND PURPOSE`. The existing part regex `^\s*PART\s+([A-Z])\s+(\S.*)$` handles the
  title-on-the-same-line form with no change; there is no front-matter outline, so
  `find_body_start` (last `PART A` match) lands on the real heading.

## Row counts

- Total rows: **310** (1 root, 3 parts, 23 sections, 283 items).
- Per part: Part A 10 (+1 part row); Part B 292 (+1); Part C 4 (+1).
- Depth profile (1 = section): {1: 23, 2: 58, 3: 88, 4: 89, 5: 48}.
- Rows with ≥25 words (get summaries): **152**.
- Longest row: `sec-2-C-I` (the February 19, 1999 statement of basis), 48,710 chars / 92
  paragraphs. Longest non-SOB row: `sec-2-B-VI-C-3`, 1,610 chars.
- Cross-references: 271 `xref` spans, 0 external links (Reg 2 cites no corpus regulation).

## Changes made to import_ccr.py (each one, one line, with the reason)

1. `REG_CYCLE_AB = {"2": ["roman","upper","digit","lower","paren_digit"]}` +
   `cycle_ab_for(reg)` — Reg 2 prints its fifth level as `(1)`,`(2)` directly under
   the lower-letter level (`IV.A.3.c.(1)`, 48 such labels); `tokenize_by_cycle` stops
   at the first non-matching family so under `CYCLE_AB` those 48 items were folded
   into their parents' text. Every other reg still gets `CYCLE_AB` (identity object).
2. `scan_markers` uses `cycle_ab_for(reg)` instead of the `CYCLE_AB` literal (one line).
3. `_resolve_cite` tokenizes with `cycle_ab_for(reg)` so citations like
   `Section IV.A.3.g.(1) through IV.A.3.g.(3)` resolve for Reg 2 (they do — see gate G).
4. `_FOOTER_CCR_PAGE_RE = ^Code of Colorado Regulations\s+\d{1,4}$` added to
   `clean_pages`'s bottom-of-page strip — Reg 2's PDF has NO running header and a
   single combined mixed-case footer line with the page number on it (45 of them);
   no other source in the corpus prints this line.
5. `SOB_PART_CONFIG["2"] = {letter C, roman_seq, opener ^Adopted:?\s, inner_items False}`
   — see gate F for why inner items are off.
6. `CORPUS_REGS["2"] = "2"`; `REG_META["2"]` per the Reg 3/26 convention, plus a new
   per-reg flag `part_intro_text: True`.
7. `build_provisions`: when `REG_META[reg]["part_intro_text"]` is set, lead-in
   paragraphs printed between a `PART` heading and its first marker are appended to
   the part row's `full_text` after the heading (same `title + <p>…</p>` shape an
   appendix row already uses). Reg 2's Part A has exactly one such sentence
   ("Pursuant to Section 25-7-109(2)(d), C.R.S., the following Emission Regulations
   are issued:") that every other path would silently drop. Off / no-op for every
   reg that doesn't set the flag (only lines after the first blank line are
   collected, so a heading's own wrapped continuation is never duplicated).
8. `KNOWN_LABEL_FIXES["2"]` — 10 entries, below.

No existing code path changed for Reg 3/7/22/26: `out/reg26_before.json` (parsed
with the ORIGINAL) and `out/reg26_after.json` (parsed after all edits) are
byte-identical (`cmp` clean, md5 `698a5349c91cedcf078d2c4cd5420575` both). Reg 26
never mentions Regulation 2, so adding "2" to `CORPUS_REGS` changes nothing there.

## Label fixes added (each: printed label → corrected label, source line, why)

All ten are confirmed in the PDF's own text layer (pdfplumber extracts the identical
glyphs), so they are source typos, not pdftotext artifacts. Each fires exactly once
(parse output prints `OK` for all 10; also asserted by a test against the real file).

| printed | corrected | REG_2.txt line | why |
|---|---|---|---|
| `l.A.` | `I.A.` | 35 | lower-case L for roman I (Part A) |
| `l.B.` | `I.B.` | 39 | same |
| `l.C.2.` | `I.C.2.` | 54 | same; follows `I.C.1.` |
| `ll.` | `II.` | 59 | same |
| `lll.` | `III.` | 64 | same |
| `lV.` | `IV.` | 73 | same |
| `VI.E.1.e` | `VI.E.1.e.` | 788 | missing trailing period; siblings a–h all have it; item (e) was folded into (d) |
| `VII.B.2.b.` | `VIII.B.2.b.` | 1008 | printed under `VIII.B.2.` after `VIII.B.2.a.`; its own text says "under this Section VIII.B."; fused into VIII.B.2.a. without fix |
| `X.A.1.a.` (2nd) | `X.A.2.a.` | 1408 | duplicate label under the `X.A.2.` heading, right before `X.A.2.b.`; the two X.A.1.a. paragraphs merged into one row without fix |
| `X.B.2.f.` | `X.B.1.f.` | 1431 | sits between `X.B.1.e.` and the `X.B.2.` heading; X.B.2 has no children; folded into X.B.1.e. without fix |

Without the six Part A fixes, Part A lost sections II–V entirely (they became
paragraphs of I.C.2.) and I.A./I.B. were folded into I.

## Quality-gate results A–I

**A. Structure — PASS.** The PDF has no table of contents, so the outline was built
from the printed headings: Part A sections I–V; Part B sections I–XIV (I
Applicability, II Definitions, III Odor Standards, IV Technology Requirements, V
Setback Requirements, VI Permit to Operate, VII Odor Management Plan, VIII
Modification or Reopening, IX Specific Odor Control Requirements, X Testing/
Recordkeeping/Reporting/Monitoring, XI Enforcement, XII Annual Fees, XIII Reserved,
XIV Severability); Part C entries I–IV. The parsed tree has exactly these parts and
top-level sections, in order (asserted in `Reg2FullParseTests`). An independent
regex count of printed labels in the corrected text gives Part A 9 (+ the bare `I.C.`
heading line the regex can't see = 10) and Part B 292, matching the row counts.

**B. Coverage — PASS.** Body words after the cover page with furniture stripped:
22,054. Words across all parsed `full_text` (excluding the root row): 22,006, plus the
235 citation labels that the `<p>` convention strips = 22,241 (100.85%; the excess is
xref markup splitting "Regulation Number 2," into extra tokens). Stricter check: the
alphanumeric-only character stream of the body (120,102 chars) vs the parsed rows
(120,103 chars) in document order differs ONLY at the ten label-fix positions
(`l`→`I` ×6, the inserted `I` of VIII.B.2.b, `1`↔`2` of X.A.2.a and X.B.1.f). Nothing
else was dropped or duplicated.

**C. Repeated-text heuristic — PASS (1 hit, legitimate).** One row has a 50-char
paragraph prefix recurring 3×: `sec-2-C-II`, "The Commission has determined this
section of the regulation was not modified pursuant to SB 06-114." — printed verbatim
three times in the 2006 statement's section-by-section summary (REG_2.txt lines
2327, 2343, 2349). No other row has any prefix ≥3×.

**D. Giant / fused rows — PASS with notes.** Ten longest: `sec-2-C-I` 48,710;
`sec-2-C-II` 16,458; `sec-2-C-IV` 9,995; `sec-2-C-III` 6,494; then Part B rows of
1,610 / 1,380 / 1,328 / 1,290 / 1,145 / 1,144 chars. The two rows over 15,000 chars
are whole statement-of-basis entries (1999 and 2006), kept undivided by design
(gate F); their paragraph counts (92 and 51) match the source, and gate B's
character-level diff shows they contain exactly the source text once. No fused
sibling paragraphs anywhere (the duplicate-id merge list is empty).

**E. Orphans and label anomalies — PASS.** 0 duplicate ids, 0 unresolved
`parent_id`s, `sort_order` strictly increasing (0…3090). Every child sequence under
every parent is contiguous from 1 (A/1/a/(1) and roman I…XIV) — 0 gaps after the ten
label fixes above. The marker audit flagged 5 column-deviating candidates (Part A's
`IV.`/`V.` after the page-1→2 indent change, and `XII.A.`–`XII.C.` printed at
8-space indent); all five are real labels and were accepted; 0 rejected.

**F. Statement-of-basis part — PASS.** Part C ("STATEMENT OF BASIS, SPECIFIC
STATUTORY AUTHORITY, AND PURPOSE"), `top_family = roman_seq`, opener
`^Adopted:?\s`. Four entries, each its own row, in order, with the expected opener:
`sec-2-C-I` "Adopted February 19, 1999" (48,710 chars), `sec-2-C-II` "Adopted
December 14, 2006" (16,458), `sec-2-C-III` "Adopted June 19, 2008" (6,494),
`sec-2-C-IV` "Adopted: May 16, 2013" (9,995; note the colon appears only here).
`inner_items: False` because with inner items on, two hard-wrapped fragments in the
flush-left narrative — "…amendment to Regulation Number⏎2. Typically, the date…"
(line 1708) and "…pursuant to SB 06-⏎114." (line 2280) — were accepted as items
`sec-2-C-I-2` (which then swallowed the remaining 35,000 chars of entry I) and
`sec-2-C-II-114`; neither "Number" nor a hyphen-dangling word is in
`_label_position_plausible`'s disqualifying set, and the docstring explains why
"Number" must stay out for Reg 7. The only genuine inner list (entry II's 1–7
SB 06-114 summary) is therefore kept as paragraphs of `sec-2-C-II`, like Reg 3's
Part F. Entry III's "(I)…(VI)" findings list is upper-case paren-roman and was never
a marker candidate.

**G. Cross-references — PASS.** 271 spans: 99 to the root ("Regulation Number 2"),
82/16/1 bare "Part B/A/C", 69 under Part B, 4 under Part A. Paren-digit targets
resolve (e.g. `Section IV.A.3.g.(1) through IV.A.3.g.(3)` → both spans,
`sec-2-B-IV-A-3-g-(1)`/`-(3)`), as do explicit-part forms ("Sections VI.C.2., VI.C.3.,
and VI.D., Part B, of this Regulation Number 2" → three spans + Part B + root).
`historical` and `cfr` buckets are empty. `other_reg`: "Regulation Number 6" (Part B
carcass incineration, IX.A.5.a.) and "Regulation Number 61" (WQCC, in Part C) — both
correctly left as plain text since neither is in the corpus. `unparseable` (4, all
correct to leave unlinked): `I.G.` (Section I.G. of the Common Provisions, cited in
Part C), `VI.D.2.a.` and `VI.D.8.` (sections the 2013 rulemaking REMOVED — described
in `sec-2-C-IV`), `X.D.1.a.` (the SOB cites X.D.1.a. but the reg only has X.D.1.).
One tokenizer miss worth knowing: "(see Section VII)" in `VI.D.1.` has no trailing
period before ")", so `_CITATION_TOKEN` does not match it; a single instance, left
as text, not worth touching the shared regex for.

**H. Tables — PASS (none).** pdfplumber finds 0 tables on all 45 pages and the text
has no "Table N" captions; `tables found in PDF: 0; rendered/injected: 0`.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` → 49 passed, 1 skipped
(the pre-existing Reg 7 fixture skip). 17 new tests in `Reg2CycleTests`,
`Reg2FooterTests`, `Reg2LabelFixTests`, `Reg2SobPartTests`, `Reg2PartIntroTextTests`,
`Reg2FullParseTests` cover: the cycle override (and that `CYCLE_AB` behaviour is
unchanged for other regs), footer stripping (and that the regex cannot match prose or
the other regs' header), each label fix on synthetic lines plus exactly-one-hit on the
real source, the SOB opener/inner-items behaviour on the two false-positive shapes,
the part-intro flag on and off, and an end-to-end parse asserting 310 rows, the
part/section outline, the fixed ids, and no furniture.

Diff/apply: `out/reg2_diff_report.md` against `out/reg2_db.json` = `[]` shows
only_parsed = 310, everything else 0. `out/apply_reg2/` (no `--execute`): 310 `new`,
0 changed/obsolete, two upsert SQL files (242,716 bytes), all three `stats.md` sanity
checks PASS.

`reg2.patch` = `diff -u ../import_ccr.ORIGINAL.py import_ccr.py` + the test-file diff;
verified with `patch -p0 --dry-run` against pristine copies of both originals (clean).

## Things I could not resolve

- Effective date 11/01/2013 is not printed in the PDF (see identity). Not a parser
  issue; flagging so nobody expects the parse to carry it.
- `sec-2-C-IV` ends with the document's Editor's Notes block
  (`<p>____…</p><p>Editor's Notes</p><p>History</p><p>Entire rule eff. 08/30/2008</p>
  <p>Part B, Part C.IV eff. 07/15/2013.</p>`). This is identical to how Reg 26's
  last Part C row (`sec-26-C-IV`) already carries its "PART C IV eff. 01/14/2026"
  history line in the live parse, so I left the behaviour alone rather than add a
  Reg-2-only trimmer; if the CEO wants it stripped corpus-wide that is a one-line
  change in `clean_pages`, but it would alter Reg 26's output.
- Two prose mentions of "Air Quality Control Commission" (in `sec-2-C-I` and
  `sec-2-C-IV`) trip the diff report's `PAGE_LEAK_PATTERNS` heuristic; both are real
  sentences ("requires the Air Quality Control Commission to promulgate…", "The
  Colorado Air Quality Control Commission (Commission) concludes…"), not furniture —
  Reg 2's actual footer line is fully stripped (0 rows match it).

## Anything the summarizer should be warned about for this regulation

- **Scope split.** Part A (11 rows) is the general odor standard for *all* sources
  statewide (7:1 / 15:1 / 127:1 dilution thresholds), with an explicit exemption
  for housed commercial swine feeding operations and non-major agricultural
  production (`sec-2-A-V`). Part B (292 rows) applies ONLY to housed commercial swine
  feeding operations (≥800,000 lb live weight). Summaries of Part B rows should not
  generalize to other sources.
- **Heading-only rows.** Many Part B items are a bare heading line followed by
  body text (e.g. `II.A.` → `<p>Aerobic</p><p>Means…</p>`, `IV.A.1.` → `<p>New or
  Expanded</p><p>All new…</p>`); the first paragraph is the defined term / heading,
  not a sentence. `sec-2-A-I-C` and `sec-2-B-XIII` ("Reserved.") are heading-only.
- **Seven rows start lower-case** on purpose — list fragments continuing their
  parent's stem ("any term or condition…", "housed commercial swine feeding
  operations owned by…", "that is land applied and not injected…").
- **Part C is four very long narrative rows** (1999, 2006, 2008, 2013 statements),
  each with its own internal headings as bare paragraphs ("Background", "Basis",
  "Authority", "Purpose", "Definitions", …). The 1999 entry discusses "Amendment 14"
  (the 1998 ballot initiative that became C.R.S. 25-7-138) — not a section of this
  regulation. The 2013 entry describes sections that were REMOVED (VI.D.2.a.,
  VI.D.8., old VI.E.1./VI.E.3., XIII Environmental Leadership Program) — those
  ids do not exist and the summarizer should not imply they are current.
- **"IX.B. Recommended Specific Odor Control Requirements"** are recommended /
  Division-may-require practices, in contrast to the mandatory list in IX.A. — the
  headings say so but individual sub-rows read like mandates ("shall").
- **"Division"** in Part B means the Division of Environmental Health and
  Sustainability of CDPHE (`sec-2-B-II-H`), NOT the Air Pollution Control Division;
  Part A's `sec-2-A-IV` refers to the "Colorado Air Pollution Control Division".
- Acronyms likely to be mis-expanded: **SB 06-114** (Senate Bill), **C.A.R.E.**
  (a hearing party, not an agency), **USPHS Pub. #999-AP-32** (a 1960s odor-panel
  method), **BOD** (biological oxygen demand), **FTE**, **WQCC/Regulation 61**
  (Water Quality Control Commission's discharge-permit regulation, external).
- The text also cross-cites Regulation Number 6 (incinerators) and the Common
  Provisions (5 CCR 1001-2) — neither is in the corpus, both left as plain text.
- The row `sec-2-P-A` is the only part row with body text (the "Pursuant to Section
  25-7-109(2)(d)…" lead-in) — a summarizer keyed on `kind == "part"` being
  heading-only should tolerate that.
