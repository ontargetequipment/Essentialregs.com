# Corpus QA query suite — baseline and first findings (2026-09-22)

The suite lives in the repo at **`scripts/corpus_qa.sql`**. Paste it into the Supabase SQL
editor after every import, re-import or summarizer run. It returns one row per check with a
count and a verdict against this baseline.

Every check corresponds to a defect that has already happened once and is recorded in
`EssentialRegs_Known_Issues_and_Fixes.md`. The point is that the next one is caught by a query
instead of by somebody happening to look.

## Baseline, 36,517 provisions

| severity | check | count | verdict |
|---|---|---|---|
| ERROR | `repeated_text_block` | **169** | candidate list — see notes below, not a bug count |
| ERROR | `truncated_summary` | **6** | *** investigate *** |
| ERROR | `page_furniture_in_text` | **3** | *** investigate *** |
| ERROR | `empty_full_text` | 0 | clean |
| ERROR | `dangling_internal_xref` | 0 | clean |
| ERROR | `orphan_parent` | 0 | clean |
| GUARD | `public_sample_rows` | 4 | correct — must stay 4 |
| GUARD | `real_review_backlog` | 0 | clean |
| REVIEW | `duplicate_citation_in_part` | 83 | expected, worth a pass |
| REVIEW | `provisions_without_neighbours` | 106 | known, parked until after launch |
| INFO | `self_referencing_xref` | 525 | mostly legitimate phrasing |
| INFO | `summary_longer_than_long_text` | 202 → 206 | weak signal (see calibration note) |

Referential integrity is **clean** — zero dangling cross-references and zero orphaned parents
across 36,517 rows. That is a genuinely good result and worth protecting with the guard.

## The live defects it found

### Summarizer scaffolding leaking into stored summaries — the worst of these

Three summaries contain raw prompt scaffolding that a subscriber would read:

- `sec-21-A-V-A-2` — ends `…exempted under Section II.N. per unit.</answer>`
- `sec-21-A-VI-DDDDD` — ends `…silicone-based multi-purpose lubricants.</answer>`
- `sec-11-H-APPENDIX-A-ATT-IV-1.8` — ends `…than the published amount in future years.\n\n</explanation>`

These are not truncation. The model's XML wrapper tags were stored as summary text. Two more
end in stray markdown emphasis (`**`, `*`): `sec-11-H-APPENDIX-A-ATT-IV-3.3` and `sec-11-P-C`.
The sixth, `sec-26-C-FEDJJJJ-60_4243`, is a genuine MAX_TOKENS cut-off ending mid-sentence at
"may use propane as an alternative fuel for".

Worth checking the summarizer's output-stripping step, because whatever let three tags through
may have let others through in forms this check does not catch.

### Page furniture captured in provision text

- `sec-8-B-I-C-14` — the entire row is 45 characters: `I.C.14. CCR      Code of Colorado Regulations`.
  That is a garbage row, not a provision.
- `sec-11-H-III` — the same footer text sits inside an otherwise legitimate
  6,357-character provision.
- `sec-cp-I-F` — **probable false positive.** This is the Common Provisions abbreviations list,
  so "CCR Code Of Colorado Regulations" is a legitimate glossary entry. Leave it.

### Repeated text blocks

Five rows, all federal engine provisions (`sec-jjjj-60.4231-(b)/(c)/(d)`, `sec-iiii-60.4210-(c)`,
`sec-ecmc-803-d-(1)`), were the ones hand-checked against the eCFR source when this check was
first written. All five are genuine: that subpart really does repeat "Stationary SI internal
combustion engine manufacturers must…" across adjacent paragraphs, not a duplicate-label merge.

**Calibration note (updated from the first draft of this check):** a query that looks for shared
long sentence-openers *within a single row* — the actual shape of the defect above — cannot be
narrowed to just those five without reading the source, because formulaic regulatory drafting
produces the same pattern legitimately all over the corpus. At the threshold that still catches
all five hand-verified rows, the query returns **169** candidates. That is by design, not a
regression: `repeated_text_block` is a triage list, not a pass/fail gate. See
`EssentialRegs_Known_Issues_and_Fixes.md` for why, and do not bulk-fix or bulk-dismiss based on
this check.

## Calibration notes — why some obvious checks are not in the suite

This is the part that makes the difference between a suite you trust and one you learn to
ignore. Four checks were written, run, and rejected or fixed:

- **"Text starts with its own citation"** — 5,941 rows. Not a data defect at all; that is how
  headings and short leaf rows are legitimately stored. It was a *render* bug in
  `withItemIdBadge()`. Do not add it as a data check.
- **"Summary longer than the provision"** with no length floor — 9,491 hits, all noise, because
  short `REPEALED` stubs always have longer summaries. Fixed with a 500-character floor
  (measured on `full_text` after stripping HTML tags), which brings it to 206. Even with the
  floor this is only INFO — a summary can legitimately say more than a terse provision does.
- **"Duplicate citation within a regulation"** — 1,312 hits, roughly **94% false positives**.
  Provision ids carry the Part letter (`sec-7-B-I-E-3-a-(i)`), so Part A's `I.A.1.` is not Part
  B's `I.A.1.`. Grouping by regulation *and* Part gives the real number: 83.
- **`summary_status = 'pending'` on its own** — ~16,840 rows, all correct by design (structural
  rows below the 25-word summariser threshold). Must always be paired with
  `ai_summary IS NOT NULL`, which gives 0.

A check that fires on a quarter of the corpus teaches you to ignore the report. Every threshold
here was set by running it and looking at what came back.

## Gotcha for whoever edits this file

`check` is a reserved word in Postgres — the column is `check_name`. The first version of this
suite would not run because of it. (The final query also has to wrap its `UNION ALL` in a
subquery before the outer `ORDER BY` — Postgres won't let a `CASE` expression order a union
directly, only bare result-column names.)

## Suggested cadence

- After every import or re-import
- After every summarizer run
- Before any launch milestone

ERROR and GUARD rows should read "as expected" before you ship anything. REVIEW and INFO rows
are trend lines, not alarms — and `repeated_text_block`'s count is a candidate list, not an
alarm either; see `EssentialRegs_Known_Issues_and_Fixes.md`.
