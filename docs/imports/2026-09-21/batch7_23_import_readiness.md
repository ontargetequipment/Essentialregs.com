# Reg 23 — import readiness report

## Verdict: READY

All nine gates pass. No text is lost, no row is fused, every label sequence is
contiguous as printed, all thirteen printed determination tables are rendered as
real tables, and both no-op proofs are clean in both directions.

## Regulation identity

| field | value |
|---|---|
| printed title page | `REGULATION NUMBER 23` / `REGIONAL HAZE LIMITS` / `5 CCR 1001-27` (REG_23.txt lines 19–23, three separate lines — the Reg 11/12/20/30 convention) |
| `root_title` | **`REGIONAL HAZE LIMITS 5 CCR 1001-27`** |
| `root_citation` | `Code of Colorado Regulations · Regulation Number 23` |
| CCR cite | 5 CCR 1001-27 |
| effective date | 01/30/2022 (Editor's Notes tail: "New rule eff. 02/14/2021. Rules … Part B II eff. 01/30/2022"); SOS ruleVersionId 9985, ruleId 3344 |
| pages / lines | 39 pages, 2,453 lines |
| parts found | **two**: `sec-23-P-A` "PART A — Regional Haze Limits – Best Available Retrofit Technology (BART) and Reasonable Progress (RP)" (body heading wraps over two source lines, joined by the default `part_heading_max_lines`) and `sec-23-P-B` "PART B — STATEMENTS OF BASIS, SPECIFIC STATUTORY AUTHORITY AND PURPOSE" |
| the four `PART [A-Z]` matches | **confirmed**: lines 31 and 43 are the printed "Outline of Regulation" front matter (not parsed as parts — they sit above the body start), lines 80 and 1922 are the two real body headings. No hidden third part. |

## Row counts

- **Total rows: 221** — root 1, part 2, section 7, item 211.
- Part A: 217 rows (Sections I Applicability, II Definitions (A–W), III Challenge of
  Division BART Determinations and Enforceable Agreements, IV Regional Haze
  Determinations (A–F), V Monitoring, Recordkeeping, and Reporting (A–D)).
- Part B: 3 rows (the part row plus the two statement-of-basis entries).
- Rows with ≥ 25 words of visible text (these get summaries): **107**.
- Longest row: `sec-23-B-II` at 18,838 chars (the December 17, 2021 statement of basis,
  one undivided row by design).

## Changes made to import_ccr.py (each one, with the reason)

1. `CORPUS_REGS["23"] = "23"` — makes Reg 23 a corpus regulation, so its own citations to
   Regulation Number 3/6/7/9 become anchors and Reg 24/26's citations to it resolve.
2. `REG_META["23"]` — identity only (`jurisdiction_level` state, `issuing_body` CDPHE-APCD,
   `source_url`, `root_citation`, `root_title`). No capability flag is needed: Reg 23 is the
   ordinary part-structured AQCC shape with full dotted compound labels, so
   `tokenize_by_cycle`/`CYCLE_AB`/`FAMILY_REGEX` are unchanged.
3. `SOB_PART_CONFIG["23"] = {letter: "B", top_family: "roman_seq", top_opener_re: ^Adopted:?\s,
   inner_items: False}` — Part B's two entries are "I. Adopted: December 16, 2020" and
   "II. Adopted: December 17, 2021". `inner_items: False` is load-bearing: entry I's narrative
   wraps "…incorporated in Regulation Number\n23. The Commission also notes…" (line 2050) onto a
   line start, which with inner items on was accepted as a CYCLE_C_INNER digit marker and
   produced a `sec-23-B-I-23` row swallowing ~11,000 characters of the entry (the Reg 2/24
   failure shape).
4. `UNCAPTIONED_TABLES["23"]` — ten entries pinning the thirteen printed table segments to the
   six provisions that carry them (`sec-23-A-IV-A-2`, `-IV-B-2`, `-IV-C-2`, `-IV-F-1-d-(i)`,
   `-IV-F-3`, `sec-23-A-V-A-2-e-(i)`). Without them pdftotext's column dump was flattened into
   prose that scrambled limits across units.
5. **New config key `drop_caption_row` (+ optional `printed_caption`)** in
   `extract_tables_from_pdf` — Reg 23's tables print their heading centred over the middle
   columns, so pdfplumber returns it as a merged first row whose FIRST cell is empty and the
   existing `page_rows[0][0] == caption` strip never fires. The new check drops a first row whose
   non-empty cells are exactly the printed heading. Idempotent, and a no-op for every entry
   without the key.
6. **New `compact: "align"` mode + `_compact_rows_aligned()`** — `compact: True` (Reg 25's
   Appendix E, untouched) drops every blank cell from every row, which here shifted data: the
   "Suncor / Plant 1 Main Plant Flare" row prints nothing under NOx (page 16) and its SO2 limit
   "162 ppmv H2S" moved into the NOx column. The new mode drops only the `None` spacer cells
   when that already yields the header's width, so a genuinely empty cell keeps its column.
7. **New `cell_fixes` key** — six exact substring repairs for subscripts pdfplumber returns as
   their own line inside a cell ("111 ppmvd @ 15% O\n2\n(4-hour rolling average)", the H2S
   digester-gas limit, and the two Manchief turbine NOx cells). `render_table_html` turns the
   newlines into spaces, so the "2" would read as a separate number ("… and 186 2 lb/hr").

## Changes made to test_import_ccr.py

- Four new test classes, **13 tests**: `Reg23MetaTests`, `CompactRowsAlignedTests`,
  `Reg23UncaptionedTableConfigTests`, `Reg23FullParseTests`.
- `Batch6SmallNoOpProofTests._check` updated (its own premise — "no source mentions these keys"
  — is no longer true for Reg 26): the ABSENT leg now also pops `"23"`, and the PRESENT leg is
  compared to the pre-Batch-7 baseline **after stripping the new `/regulations/23` anchors**,
  with a new `expect_23` argument pinning how many there may be (Reg 26 → 2, Reg 30 → 0). That
  turns the old byte-identity assertion into the strip-and-reconstruct proof this batch asks
  for, inside the suite.

## Changes made to summarize.py / test_summarize.py

- `REG_AUDIENCE["23"]` = "an environmental manager at a Colorado power plant or large industrial
  source subject to regional haze limits".
- `REG_PROMPT_HINTS["23"]` — **199 words**. Following the Batch 6 Reg 21 lesson it explicitly
  tells the model *not* to restate scope: "Section I states applicability and which sections are
  incorporated into Colorado's Regional Haze State Implementation Plan rather than being
  State-Only; **do not repeat or infer applicability, scope, geography, the SIP/State-Only split
  or an effective date on any other row.**"
- Five new tests, including `test_reg23_hint_never_asks_for_applicability_on_other_rows`, which
  asserts that exact sentence is present and that the hint contains none of "state
  applicability" / "name the area" / "restate" / etc.; plus the `set(REG_AUDIENCE)` assertion
  updated to include `"23"`.

## Also produced (not in the two patches)

- `manifest_23.patch` — adds the `sources/manifest.json` entry for freshness monitoring
  (`kind: sos`, `ccr: 5 CCR 1001-27`, `ruleId: 3344`, `deptID: 16`, `agencyID: 7`,
  `ruleVersionId: 9985`, `effective_date: 2022-01-30`). `test_freshness.py` stays green (75 passed).
- No change is needed in `docs/import.yml.new` (numeric regs map generically to `REG_<n>`) or in
  `site/src/lib/regulation.ts` (numeric regs get "Regulation Number 23 — REGIONAL HAZE LIMITS"
  with "5 CCR 1001-27" as the subtitle from the generic branch).

## Label fixes added

**None.** No `KNOWN_LABEL_FIXES`, `KNOWN_LABEL_ANOMALIES`, `KNOWN_TEXT_FIXES` or
`KNOWN_CONTINUATION_LINES` entry was needed — the parse reports zero applied fixes and zero
anomalies, and every printed label sequence is already contiguous (see Gate E).

## Quality-gate results A–I

**A. Structure — PASS.** The printed outline (PART A with Sections I–V, PART B) matches the
parsed tree exactly: `sec-23-P-A` → `I. II. III. IV. V.`, `sec-23-P-B` → `I. II.`. The two
front-matter "PART A"/"PART B" outline lines (31, 43) are correctly left as unowned front matter,
and no "Outline of Regulation" text leaks into any row. Sections I and V carry their heading as
the first body paragraph with `title == citation`, which is the established house shape for a
section whose heading is followed immediately by body text (identical to `sec-26-B-I`,
`sec-26-B-V`).

**B. Coverage — PASS.** Source body (line 80 to EOF, page headers/footers/page numbers/rule
lines removed): **15,687 words**; parsed `full_text` across all 221 rows: **15,551 words**
(**99.13 %**). A token-level diff shows the shortfall is entirely (a) the citation labels
themselves, which the row shapes deliberately drop from item text ("V.A.1.b", "(i)", "(ii)"…),
and (b) three reprinted "RP Determinations for Colorado Sources** / Emission Unit / NOx… " header
blocks on pages 15–17 that are correctly de-duplicated into the one rendered table. A stricter
line-level check (every source body line of ≥ 8 words must appear contiguously in some row) finds
**no prose line missing at all** — only the two PART headings, which are rendered with the house
"PART X — " em-dash join, and table rows whose cell order legitimately differs from the pdftotext
column dump.

**C. Repeated-text heuristic — PASS.** First-50-character paragraph prefixes recurring ≥ 3× inside
one row: **0 hits** across all 221 rows.

**D. Giant / fused rows — PASS.** Ten longest: `sec-23-B-II` 18,838, `sec-23-B-I` 14,960,
`sec-23-A-IV-F-3` 11,970, `sec-23-A-IV-A-2` 3,222, `sec-23-A-IV-C-2` 2,221, `sec-23-A-V-B-3`
2,196, `sec-23-A-IV-B-2` 2,072, `sec-23-A-V-B-1` 1,731, `sec-23-A-V-A-1-b` 1,614,
`sec-23-A-V-A-1-a` 1,572. Only one row exceeds 15,000 chars: `sec-23-B-II`, a statement-of-basis
entry kept whole on purpose (`inner_items: False`) — the same shape as Reg 2/3/19/20/24's SOB
rows. `sec-23-A-IV-F-3` is the six-page RP determination table (three rendered segments, 57 data
rows) plus its five footnote paragraphs, all legitimate. The one real fused-row risk in this
document — `sec-23-B-I-23` — is gone; a test asserts that id never exists.

**E. Orphans and label anomalies — PASS.** 221 ids, **0 duplicates**, **0 unresolved
`parent_id`s**, `sort_order` strictly increasing, every item id prefixed by its parent's id. All
58 sibling groups are contiguous with no gap or jump: II.A–II.W (23 definitions), II.M.1–26,
II.B.1.b.(i)–(x), IV.A–IV.F, IV.F.1.a–IV.F.1.i, V.A–V.D, V.A.1.a–e, V.A.2.a–f, V.B.1–4,
V.C.1–3, and every paren-roman / paren-upper leaf run. The continuation-line guard flagged 49
marker candidates and rejected 4 — all four correct rejections of wrapped cross-reference
citations at line starts ("…V.A.2.f.(i)(B) are met.", "…V.C.3. except that…", "…IV.A.3. or
IV.B.3., the owner/operator…", "…IV.F.3. is demonstrated by fuel limitation.") — asserted by test.

**F. Statement-of-basis part — PASS.** Part B is the SOB part. `top_family: "roman_seq"` with the
`^Adopted:?\s` opener (the Reg 2/3/6/19/27/30 keyword form — Reg 20's all-caps `ADOPTED:` does not
match, asserted by test). Both top-level entries parsed to their own row in order:
`sec-23-B-I` opening "Adopted: December 16, 2020" and `sec-23-B-II` opening "Adopted: December 17,
2021". `inner_items: False`, so each entry is one undivided row — the "Basis" / "Specific
Statutory Authority" / "Purpose" sub-headings and the two "(I)"–"(XI)" C.R.S. § 25-7-109(1)(b) /
§ 25-7-110.8 findings lists stay as body paragraphs, which is what they are.

**G. Cross-references — PASS.** 102 same-regulation `<span class="xref">` targets (all of which
resolve to an id in this parse — asserted by test) and 27 `<a class="xref-external-reg">` anchors:
**Regulation Number 3 × 21, Regulation Number 6 × 2, Regulation Number 7 × 2, Regulation Number
9 × 2** — every corpus regulation Reg 23 names links. The `other_reg` bucket is **empty** (Reg 23
names no non-corpus regulation). `cfr` bucket: 7 distinct / 31 mentions (40 CFR Part 60 ×16,
Part 75 ×5, Part 60 Subpart F ×3, Part 63 Subpart LLL ×3, Part 64 ×2, Part 60 Subpart Ja ×1,
Part 63 Subpart A ×1) — correct, none of those is in the corpus. `historical` 3 distinct /
5 mentions and `unparseable` 1 / 1 — see "Things I could not resolve". No tokenizer change was
needed or made.

**H. Tables — PASS.** 13 printed table segments on pages 7–17 and 26, rendered as **10
`<table class="doc-table">`** blocks (pages 14–17 are one continued table, concatenated through
`spans` with the reprinted header blocks dropped). Every rendered table is rectangular — all rows
have the same cell count, asserted by test. Spot-checked against the PDF: "Craig Unit 2 | 0.08
lb/MMBtu (30-day rolling average) | 0.11 lb/MMBtu (30-day rolling average) | 0.03 lb/MMBtu", the
Suncor flare's empty NOx cell, the Comanche Unit 2 two-column rate table, and the Suncor process
heater factors (H-11, H-27 → 100 lbs/MMscf). Every footnote printed between or after a table
segment ("*Refer to Section IV.D. for requirements", "*Refer to Section IV.E. …", "* 500 tpy NOx
will be reserved …", the superscript "Refer to Section IV.F.6/IV.F.7 …" notes, and the closing
`**`/`*`/`+` notes) keeps its printed position as a paragraph — that is why the multi-page tables
are pinned segment by segment rather than folded into one `spans` entry, which would have
swallowed them.

**I. Tests — PASS.** `python3 -m pytest -q test_import_ccr.py` → **524 passed, 7 skipped**
(baseline 511 + my 13). `test_summarize.py` → **205 passed, 2 skipped** (baseline 196 + my 9).
`test_freshness.py` → 75 passed. (To reach the documented baseline counts I copied the other
regulations' `.txt`/`.pdf` sources from `../base/sources/` into `sources/` — byte-identical files,
same corpus; without them 138 tests skip for want of their source document.)

## No-op proof (both directions)

Run through the ordinary CLI path (`prove_noop_23.py`, the Batch 6 prover with the Reg 23 key),
one document per subprocess, retrying after 60 s when the shared box killed one (Reg 7 needed one
retry).

**Keys removed from `CORPUS_REGS` → byte-identical.** `cmp` against the centrally-built
baselines: **Reg 26 ✓, Reg 30 ✓, Reg 25 ✓, Reg 7 ✓, ECMC ✓** — and Reg 24 ✓ against a baseline I
built here with `import_ccr.ORIGINAL.py` (`out/base_24.json`), because Reg 24 is the only other
document in the corpus that cites Reg 23.

**Keys present → every difference is a new anchor to Reg 23.** `strip_reconstruct.py` (strip
`<a class="xref-external-reg" href="/regulations/23">X</a>` → `X`, then field-by-field compare):

| document | rows | changed rows | anchors added | unexplained |
|---|---|---|---|---|
| Reg 26 | 626 | 2 | 2 | **0** |
| Reg 24 | 415 | 1 | 1 | **0** |
| Reg 30 | 444 | 0 | 0 | **0** |
| Reg 25 | 993 | 0 | 0 | **0** |
| Reg 7 | 2,182 | 0 | 0 | **0** |
| ECMC | 6,754 | 0 | 0 | **0** |

**Total: 3 new anchors, corpus-wide.** `grep -n "Regulation 23\|Regulation Number 23"
../base/sources/*.txt` matches only REG_23, REG_24 and REG_26, so three is the complete set —
the brief asks for five listed with their source phrase; there are only three to list:

1. `sec-26-B-II-A-2-f` — "Any stationary combustion equipment subject to a federally enforceable
   work practice or emission control requirement contained in this Regulation Number 26, Part B,
   Sections III.A. through III.C. **or Regulation 23**." (REG_26.txt line 2224)
2. `sec-26-C-I` (`sec-26-C-I-26`) — the Part C entry I rule-history tracking table, September 2020
   row: "Adopted requirements for natural gas fired … 1,000 horsepower … Part D, **Regulation
   23**" (recovered from REG_26.pdf, not the flat .txt).
3. `sec-24-C-I` — Reg 24's Part C entry I tracking table: "… Part C, Section X.; Part D, Section
   I.; … Regulation 26, Part B (fkna Part E); **Regulation 23** (fkna Part F)" (REG_24.txt
   line 2884).

`strip_reconstruct.py` reports `unexplained: 0` for all six, i.e. with those anchors removed the
JSON is byte-for-byte the pre-Batch-7 baseline again. The same proof now runs inside the suite
(`Batch6SmallNoOpProofTests`, `expect_23=2` for Reg 26).

## Things I could not resolve

1. **`sources/REG_23.txt` line 238 — "Regulation Number 23, Section VII."** (in the II.K. "CEMS"
   definition). Part A has no Section VII; the monitoring requirements are in Section V. This is a
   stale reference carried over from Reg 3, Part F's old numbering when the regulation was
   relocated in December 2020. Correctly left as plain text (bucket `historical`, 1 mention). It
   is a **source error, not a parser gap** — do not "fix" it silently on import.
2. **Line 1366 — "the excess emission reports required by Section V.E."** (in
   `sec-23-A-V-B-1-b-(iii)(C)`). Section V ends at V.D.; the reporting requirements are V.D.
   Same provenance as (1). Left as plain text (bucket `unparseable`, 1 mention). These two are the
   entire `unparseable` + non-SBAP `historical` content.
3. **"SBAP Sections L., O., Q., R., and S." / "SBAP Section N."** (lines 2054 and 2357, inside the
   two statement-of-basis entries) — these name *other regulations'* statement-of-basis entry
   letters (Reg 7 Part E's and Reg 9's). "L." ×2 lands in the `historical` bucket. Leaving them
   plain is correct: there is no cross-regulation deep-link path in the tokenizer, and building one
   would not be a no-op for the rest of the corpus. The enclosing "Regulation Number 6/7/9"
   mentions do link.
4. **"Part F" ×2 in the `historical` bucket** — from "Regulation Number 3, Part F". The
   "Regulation Number 3" half links to `/regulations/3`; the bare part name stays plain text, which
   is the documented house behaviour (deep cross-regulation targets are a later improvement, per
   IMPORTER_SPEC.md).
5. **"Remaining unwrapped 'Section…' text: 24"** in the diff report, 12 of them citing a roman
   numeral that exists in no current part (i.e. the historical ones above and the SBAP letters).
   The other 12 are inside statement-of-basis narrative describing *Reg 3 Part F's* old sections
   ("Regulation Number 3, Part F, Sections III. and IV.", "Sections VI.A.4. and VI.B.4."), which
   must not be linked to Reg 23's own Sections III/IV. Correct as-is.
6. **Superscript footnote markers fused to unit names in table cells** — the PDF prints
   "Hayden¹", "Hayden²", "Pawnee³" and both pdftotext and pdfplumber return "Hayden1", "Hayden2",
   "Pawnee3". I left them as printed rather than guess at stripping a digit from a unit name (some
   real unit names *do* end in a digit). See the summarizer warnings below.

## Anything the summarizer should be warned about for this regulation

(The `REG_PROMPT_HINTS["23"]` entry covers the first six; the rest is for the reviewer.)

- **Applicability lives in Section I and nowhere else.** Section I is the only place that states
  who the regulation applies to (BART-eligible existing stationary facilities as defined in
  II.M., plus reasonable-progress sources) *and* which sections are incorporated into Colorado's
  Regional Haze SIP (IV and V) versus State-Only (everything else). Per the Batch 6 Reg 21 lesson,
  the hint explicitly forbids repeating or inferring applicability, scope, geography, the
  SIP/State-Only split or an effective date on any other row. Reg 23 is **not** area-scoped — it
  names individual units, not nonattainment areas — so `_COLORADO_AREA_SCOPE_HINT` does not apply
  and is deliberately not used.
- **Never generalize one unit's limit.** Section IV is a list of per-unit limits for named
  facilities (CENC, Craig, Comanche, Hayden, Martin Drake, CEMEX Lyons, Rawhide, Nixon, Clark,
  Holcim Florence, Nucla, Cherokee, Valmont, Pawnee, Arapahoe, ColoWyo, GCC Pueblo, EVRAZ, Rocky
  Mountain Bottle, Suncor, Manchief, Boiler Support Facility). A limit, averaging period, closure
  date or shutdown belongs to exactly one unit.
- **Units matter and are mixed**: lb/MMBtu, tons/year and tpy, lbs/hr, lb/ton of clinker,
  lb/ton of steel, grains/dscf, ppmvd @ 15 % O2, ppmvd @ 0 % O2, ppmv H2S, tons PM10 per year,
  % opacity — with averaging periods of 30-day rolling, 12-month rolling total, 12-month rolling
  average, annual, 365-day rolling, 7-day rolling, 3-hour rolling, 24-hour, 4-hour and 1-hour.
  Quote verbatim; never convert.
- **Table footnote markers.** `*` and `**` mark a per-table footnote explained in the same row
  (e.g. "*Refer to Section IV.D. for requirements", "* 500 tpy NOx will be reserved from Cherokee
  Station for netting or offsets"); `+` means "This pollutant is not emitted"; `N/A*` means the
  point did not meet the Regional Haze screening threshold. An **empty cell means no limit is
  printed for that pollutant** — it is not zero.
- **A trailing 1/2/3 on a unit name in the Section IV.F.3 table is a footnote marker, not part of
  the name**: "Hayden1 / Unit 1", "Hayden2 / Unit 2" and "Pawnee3 / Unit 1" point at the
  "Refer to Section IV.F.6 / IV.F.7 for applicable means of compliance if the PUC approves the
  PSCo ERP" notes rendered just below the table. Read them as Hayden Unit 1, Hayden Unit 2 and
  Pawnee Unit 1.
- **Acronyms** expand only as this document defines them: BART (Best Available Retrofit
  Technology), RP (Reasonable Progress), CEMS, DAHS, MRR (Monitoring, Recordkeeping and
  Reporting), SDHF, FCCU, LMS, EAF, SRU/SRC TGI, NMOC-free. **PUC is the Colorado Public
  Utilities Commission**, ERP an Electric Resource Plan and CEP a Clean Energy Plan — not AQCC
  terms. "Commission" is the Air Quality Control Commission and "Division" the Air Pollution
  Control Division. "SBAP" in Part B means another regulation's *statement of basis and purpose*.
- **Adopted by reference, name-don't-describe**: 40 CFR Part 51 Appendix Y (July 6, 2005),
  Part 60 and Appendices (July 1, 2021), Part 63 Subparts A/LLL/UUU with their own dates,
  Part 64 (October 22, 1997), Part 75 including Performance Specifications and Appendices
  (January 18, 2012), plus EPA Methods 5/9 and 40 CFR 60.4300 Table 1 (NSPS KKKK).
- **Part B is history.** Both entries are rulemaking statements of basis, not requirements, and
  they describe the *old* Regulation Number 3, Part F structure at length. A summary of a Part B
  row must not present its content as a current obligation.
- **Several closure dates in Section IV are already in the past** (Cameo 12/31/2011, Cherokee
  Units 1–3, Valmont, Arapahoe Unit 3, Clark, Nucla — "Nucla Station closed in September 2019" is
  stated in IV.E.1.). Report them as printed; do not add a "no longer applies" gloss the text
  does not make.
- **Formulas.** II.L. (the deciview haze index) and V.A.1.b/V.B.4 carry equations with defined
  variables (ER4, ER5, HI4, HI5, b, c). Keep the variable definitions attached to their formula.

## Files delivered

```
out/reg23_parsed.json        221 provisions
out/reg23_db.json            []  (no DB access from here — every row diffs as `new`)
out/reg23_diff_report.md     parsed 221 / DB 0 / only-parsed 221; cross-reference section
out/apply_reg23/             plan.json, stats.md (3/3 sanity checks PASS), 2 upsert SQL files,
                             summary_regen_ids.txt (221 ids)
reg23.patch                  import_ccr.py + test_import_ccr.py vs the ORIGINALs
reg23_summarize.patch        summarize.py + test_summarize.py vs the ORIGINALs
manifest_23.patch            sources/manifest.json freshness entry
prove_noop_23.py             the no-op prover; run_noop23.sh wraps it with the 60 s retry
out/noop_<key>_{with,without}.json + .log   the six documents' no-op evidence
out/base_24.json             extra ORIGINAL-built baseline for Reg 24 (the sixth document)
REPORT.md                    this file
```

Both patches were verified to apply cleanly with `patch -p0` to pristine copies of the four
ORIGINAL files and to reproduce the working files byte for byte.
