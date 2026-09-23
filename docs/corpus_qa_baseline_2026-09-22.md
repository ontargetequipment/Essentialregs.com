# Corpus QA query suite — baseline and first findings (2026-09-22)

The suite lives in the repo at **`scripts/corpus_qa.sql`**. Paste it into the Supabase SQL
editor after every import, re-import or summarizer run. It returns one row per check with a
count and a verdict against this baseline.

Every check corresponds to a defect that has already happened once. The full history — why each
check exists, what it caught, and which naive versions were rejected and why — is kept in a
running known-issues log in the owner's claude.ai project, not in this repository. This document
covers the same ground for the checks in this suite specifically; ask the owner if you need the
fuller log (it also covers auth/RLS, a SECURITY DEFINER grant hole, a production outage, and
other history unrelated to this suite).

The numbers below are the literal output of `scripts/corpus_qa.sql`, re-run end to end against
the live corpus, not a transcription or an approximation.

## Baseline, 36,517 provisions

| severity | check | count | verdict |
|---|---|---|---|
| ERROR | `repeated_text_block` | **5** | *** investigate — verify each hit against source before touching it *** |
| ERROR | `truncated_summary` | **6** | *** investigate *** |
| ERROR | `page_furniture_in_text` | **3** | *** investigate (check for known false positive sec-cp-I-F) *** |
| ERROR | `empty_full_text` | 0 | clean |
| ERROR | `dangling_internal_xref` | 0 | clean |
| ERROR | `orphan_parent` | 0 | clean |
| GUARD | `public_sample_rows` | 4 | correct — must stay 4 |
| GUARD | `real_review_backlog` | 0 | clean |
| REVIEW | `duplicate_citation_in_part` | 83 | expected — worth a pass, not a blocker |
| REVIEW | `provisions_without_neighbours` | 106 | known — parked until after launch |
| INFO | `self_referencing_xref` | 525 | mostly legitimate phrasing — trend line only |
| INFO | `summary_longer_than_long_text` | 207 | weak signal — trend line only |

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

Five rows, all federal engine/injection provisions (`sec-jjjj-60.4231-(b)/(c)/(d)`,
`sec-iiii-60.4210-(c)`, `sec-ecmc-803-d-(1)`), have a cleaned `full_text` longer than 200
characters whose own first-50-character opening recurs at least three times somewhere in the
text. All five were checked against the eCFR/CCR source: that subpart really does repeat
"Stationary SI internal combustion engine manufacturers must…" across adjacent sentences — a
genuine feature of the regulation's own drafting, not a duplicate-label import merge.

The 50-char / ≥3-occurrences threshold is a calibrated point, not an arbitrary one — this is
what makes the check trustworthy as an ERROR-severity, zero-baseline check rather than a
candidate list someone has to triage every run:

| prefix length | min. occurrences | rows flagged |
|---|---|---|
| 50 | ≥ 2 | 56 |
| 30 | ≥ 3 | 21 |
| **50** | **≥ 3** | **5** |
| 80 | ≥ 3 | 0 |

50/≥3 is the narrowest window that still catches the five hand-verified rows without pulling in
the much larger set of provisions where formulaic regulatory drafting repeats a short opening
phrase only once or twice — which is normal, not a defect. Any future hit on this check should
still be verified against source the same way these five were, since a new occurrence hasn't had
that check yet.

## Calibration notes — why some obvious checks are not in the suite

This is the part that makes the difference between a suite you trust and one you learn to
ignore. Several checks were written, run, and rejected or fixed before landing on the versions
in `scripts/corpus_qa.sql`:

- **"Text starts with its own citation"** — 5,941 rows. Not a data defect at all; that is how
  headings and short leaf rows are legitimately stored. It was a *render* bug in
  `withItemIdBadge()`. Do not add it as a data check.
- **"Summary longer than the provision" with no length floor** — 9,491 hits, all noise, because
  short `REPEALED` stubs always have longer summaries than their one-line body. Fixed with a
  500-character floor on the cleaned `full_text`, which brings it to 207. Even with the floor
  this is only INFO — a summary can legitimately say more than a terse provision does.
- **"Duplicate citation within a regulation"** (no Part in the grouping key) — 1,312 hits,
  roughly **94% false positives**. Provision ids carry the Part letter
  (`sec-7-B-I-E-3-a-(i)`), so Part A's `I.A.1.` is not Part B's `I.A.1.`. Grouping by regulation
  *and* Part gives the real number: 83.
- **`summary_status = 'pending'` on its own** — ~16,840 rows, all correct by design (structural
  rows below the 25-word summariser threshold). Must always be paired with
  `ai_summary IS NOT NULL`, which gives 0.
- **"Repeated text block" at a looser threshold** (e.g. any two sentences sharing a 50+
  character opening, compared pairwise within a row) — tried first, and it does catch the five
  rows above, but also 100+ others where formulaic drafting repeats a phrase only twice. That
  version teaches you to stop reading the report; the 50-char/≥3-occurrences version above is
  what's actually in the suite.

A check that fires on a quarter of the corpus teaches you to ignore the report. Every threshold
here was set by running it and looking at what came back, not chosen up front.

## Gotcha for whoever edits this file

`check` is a reserved word in Postgres — the column is `check_name`. The first version of this
suite would not run because of it. (The final query also has to wrap its `UNION ALL` in a
subquery before the outer `ORDER BY` — Postgres won't let a `CASE` expression order a union
directly, only bare result-column names.)

All `full_text` inspection goes through a single normalization CTE (strip tags, collapse
`&nbsp;`/whitespace, trim) shared by every check that needs it, so their counts stay comparable
to each other and across runs.

## Suggested cadence

- After every import or re-import
- After every summarizer run
- Before any launch milestone

ERROR and GUARD rows should read "as expected" (i.e. 0, or 4 for `public_sample_rows`) before
you ship anything. REVIEW and INFO rows are trend lines, not alarms.
