# Batch 7 summary review — Procedural Rules, Reg 4, 10, 15, 23, 28, 29, 31

Reviewed 2026-09-21/22, against the Batch 7 import (commit `93ff8c3` era, 2,565 rows).

## Method

Nineteen reviewer agents (Sonnet) graded all 1,555 summary-eligible rows, each reading the row's
own `text` and `parent_chapeau` and nothing else, against the standing brief plus per-document
trap lists built from the eight import readiness reports. Every systemic pattern was re-checked
against the source PDF before any correction ran. The raw flag set, with every corrected summary,
is committed alongside this record as `batch7_review_flags_2026-09-21.json`.

| slice | rows | PASS | FLAG | | slice | rows | PASS | FLAG |
|---|---|---|---|---|---|---|---|---|
| proc_01 | 87 | 86 | 1 | | 31_01 | 92 | 89 | 3 |
| proc_02 | 87 | 85 | 2 | | 31_02 | 92 | 92 | 0 |
| proc_03 | 87 | 85 | 2 | | 31_03 | 92 | 90 | 2 |
| proc_04 | 87 | 85 | 2 | | 31_04 | 92 | 91 | 1 |
| proc_05 | 87 | 87 | 0 | | 31_05 | 92 | 92 | 0 |
| proc_06 | 85 | 83 | 2 | | 4_01 | 72 | 35 | 37 |
| 23_01 | 54 | 53 | 1 | | 4_02 | 71 | 68 | 3 |
| 23_02 | 54 | 52 | 2 | | 4_03 | 71 | 1 | 70 |
| small7 | 101 | 101 | 0 | | 28_01 | 76 | 75 | 1 |
| | | | | | 28_02 | 76 | 75 | 1 |

**Total: 1,555 rows · 1,425 PASS · 130 FLAG.**

## Outcome

- **209 rows corrected** (`reviewed_by = 'Claude (AI second-pass review; summary corrected, …)'`)
  — 127 accepted flags plus 82 unflagged Reg 4 rows swept into the systemic fix below.
- **1,346 rows approved as written**, including 3 overruled flags.
- Every corrected row's previous text is preserved in `summary_original`.

First-pass accuracy excluding the systemic Reg 4 issue: **98.5%** (23 defects in 1,555).
Counting it: **86.6%**.

## The Reg 4 "(State Only)" decision — Batch 6's Reg 21 failure, in a new suit

The summarizer prepended a "(State Only)" tag to **all 214** Reg 4 summaries. Checked against the
source: the printed prefix appears on exactly four operative provisions and one section heading —
I.A.2., I.A.12., II.A.3., III.G.2., and the Section IV (Masonry Heaters) heading — all
masonry-heater provisions. Part A's own applicability sentence is narrow: Reg 4 is implemented on
a state-only basis **"for purposes of carbon monoxide"** — while the wood-stove and pellet-stove
requirements remain part of Colorado's PM10 SIP, i.e. **federally enforceable**. Reg 4's own March
2017 statement of basis says the new-wood-stove requirements "apply state-wide as part of the
EPA-approved SIP."

So the blanket tag was applied 100% of the time and correct roughly 10% of the time, and unlike
Reg 21's geographic tags, this one mislabels **enforceability**: telling a reader a SIP provision
is "State Only" tells them EPA cannot enforce it. Two reviewers flagged the pattern (107 rows
between them); one passed 68 identical rows — the same reviewer split as Batch 6.

**Decision: strip the tag from every Reg 4 row where neither the row's own text nor a printing
ancestor carries it; keep it where grounded.** 192 rows stripped (110 flagged + 82 the lenient
reviewer passed, for end-to-end consistency); 22 rows keep the tag (the I.A.12 definition and its
children, II.A.3, III.G.2, the whole Section IV subtree, and XI.C, whose own text says
"state only applicable basis"). Verified after application: exactly those 22 remain tagged.

**Mechanism, for the record:** the Reg 4 summarizer hint said the printed "(State Only)" prefixes
"are part of the text and must be kept." The model read *preserve* as *apply*, exactly as Reg 21's
"state applicability per part" hint became a per-row guess. Rule for every future
`REG_PROMPT_HINTS` entry: an instruction about a printed marker must say "copy it only where the
row prints it — never add it to a row that does not."

## Overruled flags (3)

`sec-proc-A-III` and `sec-proc-B-III` were flagged for saying which part's definitions they are —
but each row IS in that part, the two parts define terms differently, and saying so is accurate
and disambiguating. `sec-proc-A-V-F-7` was flagged for adding the standard § citations for "the
Act" and "the APA" — citations this document itself prints elsewhere and that identify, not
describe. Reviewer disagreement on both patterns (two other proc reviewers considered and passed
the identical enrichment); resolved in favour of accuracy-plus-usefulness. The next brief will say
so explicitly.

## Genuine defects corrected beyond the Reg 4 tag

| id | defect |
|---|---|
| `sec-proc-B-VI-I-6-a` | Inverted "**no fewer than** fifteen days" into "**within** fifteen days" — a minimum wait became a deadline. The identical sibling row got it right, confirming a slip. |
| `sec-proc-B-V-B-10-b`, `-V-D-3-b` | Invented "the Division" as the acting/filing party where the text names no actor (and context points to the Proponent). |
| `sec-proc-A-V-E-4-b` | Attributed the underlying proposal to the Division; the text says only "a proposed rule". |
| `sec-proc-A-VI-D-2-c` | Called item (c) "the first step" in the order of presentation. |
| `sec-proc-B-XII-I` | Misread the February 2025 date as a completion deadline; it is when public comment begins. |
| `sec-23-A-II-L`, `sec-23-A-V-A-1-b-(iii)-(B)`, `sec-4-C-APPENDIX-A-6.3.1.1` | Claimed an equation "is not shown in the text" when the text prints it in full. |
| `sec-23-B-I` | Called ColoWyo Coal Mine a "coal-fired unit". |
| `sec-28-A-III-KK` | Turned "commercial **or** industrial connections" into "and" — a disjunctive qualifier made conjunctive. |
| `sec-28-D-II-A` | Handed a CEO (Colorado Energy Office) approval duty to the Division — the exact swap the brief called highest-risk. |
| `sec-31-A-II-B` | Dropped "only", obscuring that a biofilter is the pre-1987 closed landfill's *sole* obligation. |
| `sec-31-B-II-D-3` | Tied a 90-day clock to the actual filing date instead of the required submission date. |
| `sec-31-B-II-D-3-a-(ii)` | Made a third-exceedance-only option look available on any exceedance. |
| `sec-31-C-II-I-3-a-(i)` | Made an unconditional 5-day corrective-action duty conditional on the high-temp/high-CO threshold. |
| `sec-31-C-III-B-2-b` | Silently "fixed" the dangling `II.B.2.a.` citation the source actually prints. |
| `sec-31-H-I-A-2` | Invented a discretionary "may review" from "subject to Division review and approval". |
| `sec-4-C-APPENDIX-A-5.5.10`, `-5.5.12.1.1`, `-5.5.7.1` | Three different invented expansions of PHhd/FCtw (it is Primary Horizontal Hearth Dimension / Target Fuel-Crib Width). |
| `sec-4-C-APPENDIX-A-6.0` | Invented "the Division reviews" from passive voice. |
| `sec-4-C-APPENDIX-A-5.8.12.1` | Imported a five-minute detail from the sibling oxygen criterion. |
| `sec-4-B-II-B-1`, `sec-4-B-III-A` | Content borrowed from a sibling row / an editorial "(This deadline has passed.)" gloss. |

Notably clean: **CEO was never expanded as "chief executive officer"** anywhere in Reg 28's 152
summaries; Reg 29's two use restrictions (19 kW state / 7 kW federal-local-nonattainment) survived
intact everywhere; ppmv and ppm-m were never conflated in Reg 31; Reg 31's `[date]` placeholder was
not filled in; and all 101 rows of Regs 10, 15 and 29 passed without a single flag.

## Still open

- The Reg 3 / 6 / 8 / 22 cross-link cleanup pass (128 markup-only rows, per
  `batch7_crosslink_backlog.md`) — scoped separately; free to run.
- `RUN_ME_neighbors_rpc_2026-09-21.sql` still awaits the owner in the Supabase SQL editor; the
  106 no-neighbour rows are unchanged.
