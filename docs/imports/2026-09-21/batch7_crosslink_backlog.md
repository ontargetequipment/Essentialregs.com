# Batch 7 cross-link backlog — anchors added beyond the forecast (September 21, 2026)

Batch 7's re-link step (step 5 of the import prompt) changed **88 rows across 15
documents**, not the **70** the batch brief forecast. All 88 are markup-only:
`new` 0, `obsolete` 0, visible text unchanged, `summary_status` and `ai_summary`
untouched, three sanity checks PASS on every run. No summaries and no embeddings
were regenerated for the re-link.

The 18 extra rows are **not** new Batch 7 behaviour and **not** a defect. They are
a backlog: three regulations were last imported before the linker learned to emit
anchors for Reg 9, Common Provisions, Reg 25 and Reg 27, so their stored rows have
been missing those cross-references ever since. Re-importing them applies the
backlog. Withholding it would have left 18 broken links live and required a second
pass.

## What each document gained beyond the forecast

| reg | forecast | actual | extra rows | anchors added beyond the forecast |
|---|---|---|---|---|
| 1 | 2 | **12** | +10 | Reg 9 ×11, Common Provisions ×9 (plus the forecast proc ×2) |
| 2 | 2 | **6** | +4 | Common Provisions ×7 (plus the forecast proc ×2) |
| 24 | 3 | **7** | +4 | Reg 25 ×6, Reg 27 ×1 (plus the forecast proc ×2, Reg 23 ×1) |

The other twelve matched the forecast exactly: 7 → 21, 9 → 5, 27 → 5, aqs → 10,
26 → 6, 25 → 3, 30 → 3, 11 → 3, 20 → 2, 21 → 2, cp → 2, 19 → 1.

### The rows involved

**Reg 1** (12 rows): `sec-1-II-C-1`, `sec-1-II-C-2-c`, `sec-1-III-D-1-a-(ii)`,
`sec-1-IV-G-5`, `sec-1-VI-B-3`, `sec-1-X-H`, `sec-1-X-K`, `sec-1-X-L`,
`sec-1-X-N`, `sec-1-X-O`, `sec-1-X-P`, `sec-1-X-Q`. Only `sec-1-X-L` and
`sec-1-X-Q` were forecast (the proc anchors).

**Reg 2** (6 rows): `sec-2-B-II`, `sec-2-B-VI-E-4`, `sec-2-C-I`, `sec-2-C-II`,
`sec-2-C-III`, `sec-2-C-IV`. Only `sec-2-B-VI-E-4` was forecast.

**Reg 24** (7 rows): `sec-24-B-IV-B-2-a-(i)-(C)`, `sec-24-B-IV-B-3-g`,
`sec-24-B-IV-C-2-c`, `sec-24-B-VI-A-2-a-(iii)-(A)`, `sec-24-B-VI-B-6`,
`sec-24-C-I`, `sec-24-C-II`. Only `sec-24-C-I` and `sec-24-C-II` were forecast.

The Reg 24 → Reg 27 anchor was the one link that cannot be confirmed by a plain
grep of the source, so it was read in context and verified by hand: `sec-24-C-I`
prints "The manufacturing sector greenhouse gas provisions in Regulation Number 22
became a new Regulation Number 27." That is a genuine citation to the AQCC's
Regulation 27.

## How this was diagnosed

The rehearsal (`execute=false`) reported 12 / 6 / 7 changed rows against a forecast
of 2 / 2 / 3, so the import was halted before anything was written. The cause was
then established without touching the database:

1. Parse the regulation locally with the merged importer.
2. Count `/regulations/<target>` anchors per target in the parse.
3. Compare against the same count taken from the stored rows in Postgres.
4. The targets present in the parse but absent from the database are the backlog.

This predicted the changed-row count exactly for every regulation it was checked
against (1 → 12, 2 → 6, 24 → 7, 20 → 2), each confirmed afterwards against the
workflow's own apply-plan stats. It is the cheap check to reach for when a re-link
count does not match a forecast.

Note the one trap found while doing this: comparing a whole regulation by
`md5(string_agg(full_text order by id))` is **not** reliable, because Python's
string sort and Postgres' `en_US.UTF-8` collation order ids differently, so the
aggregate differs for identical content. Compare row by row instead. A sip
"mismatch" raised this way turned out to be identical across all 173 rows.

## The ECMC guard

`_non_aqcc_ccr_series()` suppresses the link from ECMC's citations of the Water
Quality Control Commission's "Regulation Number 31" (5 CCR 1002-31, surface water
standards) to the AQCC's new Regulation 31 (5 CCR 1001-35, landfill methane).
The guard held: ECMC's rehearsal reported 6,754 identical rows, 0 changed, 0 new,
0 obsolete. Regs 12, 16, 18 and sip likewise showed 0 changed, confirmed row by
row for all four.

## Remaining backlog elsewhere in the corpus

The documents **not** re-linked in Batch 7 were checked with the same method
(parse locally, diff anchors against the stored rows). Nothing was executed on
them; these are counts only, for a separate cleanup pass.

| doc | rows | backlog rows | anchors missing from the database |
|---|---|---|---|
| Reg 3 | 2,065 | **73** | cp ×51, Reg 8 ×22, proc ×19, Reg 6 ×18, Reg 2 ×11, Reg 23 ×8, Reg 1 ×7, Reg 9 ×4, Reg 30 ×3, Reg 24 ×2, Reg 15 ×1, Reg 25 ×1 |
| Reg 8 | 1,340 | **29** | proc ×31 |
| Reg 6 | 462 | **15** | proc ×15 |
| Reg 22 | 344 | **11** | Reg 27 ×7, proc ×6, cp ×1, Reg 24 ×1, Reg 25 ×1 |
| gp01-gp12 (11 docs) | 2,074 | **0** | none — current |
| **total** | | **128** | |

Two distinct causes are mixed together here:

- **Reg 6 and Reg 8** are missing *only* proc anchors. They cite the Procedural
  Rules but were not on Batch 7's re-link list, so this is simply a Batch 7
  omission — the brief's "62 proc anchors across 16 documents" undercounted.
  Adding Reg 3 (×19), Reg 6 (×15), Reg 8 (×31) and Reg 22 (×6) brings the real
  total to roughly 133 proc anchors.
- **Reg 3 and Reg 22** carry that plus an older backlog of the same kind found in
  Reg 1, 2 and 24: anchors to Common Provisions, Reg 8, Reg 6, Reg 2, Reg 9,
  Reg 1, Reg 30, Reg 15, Reg 23, Reg 24, Reg 25 and Reg 27 that their stored
  rows have never had. Reg 3 is the largest single case in the corpus at 73 rows.

All eleven general permits are fully current; they need nothing.

## For the next batch

The Colorado corpus is now current on cross-links for the fifteen documents
re-linked in Batch 7. Reg 3, 6, 8 and 22 are not, and are the scope of the
cleanup pass.

When a future batch adds a document that existing regulations cite by name or
number, build the re-link list from the parse rather than from a grep of the new
document: anything citing the new document needs re-linking, and anything not
re-imported since a linker rule landed will bring extra rows with it.

When a future batch adds a document that existing regulations cite by name or
number, expect the re-link to touch more rows than a grep-based forecast predicts
if any of those regulations has not been re-imported since the relevant linker
rule landed.
