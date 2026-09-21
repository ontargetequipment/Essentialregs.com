# Batch 6 summary review — AQ Standards, Reg 16, SIP Local Elements, Reg 18, 19, 20, 21

Reviewed 2026-09-21, against the import at commit `454bda2`.

## Method

Twelve reviewer agents (Sonnet) graded all 1,010 summary-eligible rows in twelve slices,
each reviewer reading the row's own `text` and `parent_chapeau` and nothing else. Every
flag was then re-checked by hand against the source PDFs before any correction ran.

| slice | rows | PASS | FLAG |
|---|---|---|---|
| 19_01 | 84 | 84 | 0 |
| 19_02 | 84 | 84 | 0 |
| 19_03 | 84 | 82 | 2 |
| 19_04 | 83 | 80 | 3 |
| 20_01 | 86 | 85 | 1 |
| 20_02 | 85 | 85 | 0 |
| 21_01 | 80 | 22 | 58 |
| 21_02 | 80 | 32 | 48 |
| 21_03 | 80 | 26 | 54 |
| 21_04 | 78 | 77 | 1 |
| sip | 87 | 85 | 2 |
| small (aqs / 16 / 18) | 99 | 95 | 4 |
| **total** | **1,010** | **837** | **173** |

## Outcome

- **203 rows corrected** (`reviewed_by = 'Claude (AI second-pass review; summary corrected, …)'`)
- **807 rows approved as written** (`reviewed_by = 'Claude (AI second-pass review, full text read, …)'`)
- 891 rows in the batch are under the 25-word summary threshold and carry no summary; untouched.
- Every corrected row's previous text is preserved in `summary_original`, so any correction
  here can be reverted row-by-row without re-running the summarizer.

First-pass accuracy excluding the systemic Reg 21 issue below: **98.7%** (13 defects in 1,010).
Counting it: **79.9%**.

## The Reg 21 scope-tag decision

Three of the four Reg 21 reviewers flagged nearly every Part A row for the same thing: the
summary prepends a geographic tag — "Applies in: the 8-hour Ozone Control Area and northern
Weld County", "Applies: Statewide (State Only)", "Part A (consumer products), statewide" —
that appears in neither the row's own text nor its parent chapeau. The fourth reviewer saw the
identical pattern and declined to flag it, reasoning that the tags are internally consistent
and match Reg 21's real structure.

Checked against the source. **Reg 21 Part A § I.A and Part B § I.A are identical in shape and
each has three legs:**

1. `I.A.1.` The 8-hour Ozone Control Area
2. `I.A.2.` Northern Weld County — federally enforceable since February 14, 2023
3. `I.A.3.` `(State Only)` Colorado — i.e. the whole state, not federally enforceable

That makes the tags wrong, not merely ungrounded. Of the 318 summarized Reg 21 rows, 192
carried a scope tag (186 of them ungrounded in the row's own text) and 126 carried none — the
summarizer applied it to roughly 60% of rows and skipped the rest, with no pattern. Of the 186:

- **74** named only the Ozone Control Area and northern Weld County. This is the damaging
  variant: a business in Grand Junction or Pueblo reading it would conclude Reg 21 does not
  reach them. It does, under `I.A.3.`
- **71** named only "statewide (State Only)", which mislabels the federally-enforceable legs.
- **41** named both, which is correct — those three reviewers had flagged these as
  "self-contradictory", which was a reviewer error.

Separately, on the operative standards rows the tag actively contradicted the text: `II.A`–`II.D`
of Part A and `II.A`–`II.B` of Part B each say "in Colorado", and the prepended tag narrowed
that to the Front Range.

**Decision: strip the per-row scope tag from every Reg 21 row where the row's own text does not
state geography.** Reg 21 states its applicability once, correctly, in its own Section I.A, and
that section is one click away in the corpus. A per-row restatement that is right 22% of the
time is worse for a compliance reader than no restatement at all. Where a row's text does say
"in Colorado" or names an area itself (`sec-21-B-IV-A-8`, `sec-21-C-II`), that wording was kept.

This extended the fix to 30 Part B and C rows that slice 21_04's reviewer had passed, so that
Reg 21 is internally consistent end to end.

## Defects corrected beyond the scope tag

| id | defect |
|---|---|
| `sec-21-A-VI-OOOOOO-1` | `ai_summary` held leaked, truncated internal reasoning (a raw `<thinking>` block) instead of a summary. Most serious single defect in the batch. |
| `sec-20-D-II-B` | Silently "fixed" the source's printed citation `1692.6` to `1962.6`. Corrected to reproduce what the CCR actually prints, flagged as printed. |
| `sec-19-A-V-C-3-a` | Added "(or equivalent wording)" to warning-sign text the rule requires verbatim. |
| `sec-19-A-V-C-3-c` | Invented an "(other than window work)" exclusion. |
| `sec-19-A-V-I-2` | Invented an "Abatement supervisors must…" duty from passive-voice text. |
| `sec-19-A-V-J-3-d` | Expanded LEF as "lead-abatement firm". It is Lead **Evaluation** Firm. |
| `sec-19-B-III-D` | Invented a recordkeeping/filing duty. |
| `sec-sip-INTRODUCTION` | Invented a list of eight named towns. |
| `sec-sip-VI-A` | Said the Fort Collins *area* was repealed; the text repeals only its *contingency measures*. |
| `sec-16-I-D-2-d`, `sec-16-I-D-4` | Invented the numeric content of cross-referenced standards. |
| `sec-aqs-IV` | Labelled the visibility standard "State Only" without support. |
| `sec-aqs-VIII-H` | Attributed PM2.5 standards to the 1987 TSP repeal. |
| `sec-21-C-II` | Said the state-only limits apply "statewide"; the text says "in the remainder of the state". |
| `sec-21-A-II-A`, `-III-B`, `-IV-D-9-e`, `-VI-XXXX`, `-VI-SSSSS-1`, `-VI-WWW-1`, `-VI-YYY-1`, `-VI-DDDDD-1`, `sec-21-B-II-E`, `sec-21-B-III-A`, `sec-21-B-VI-BB` | Invented cross-references, effective dates, acronym expansions or regulatory consequences on top of the scope tag. |

## Follow-up for the summarizer

The scope tag was not asked for by the prompt in the sense that produced it: the Reg 21
audience hint told the model to state applicability per part, and the model read that as
licence to guess per row. Before the next batch that has a multi-leg applicability section,
the audience hint for that key should say applicability belongs in the applicability section's
own rows and nowhere else. No code change is needed for Batch 7 — none of its eight documents
has this structure.

## Still open

`106` provisions across the corpus have no `provision_neighbors` rows, because their entire
40-candidate window is filled by siblings. This is a property of the RPC, not of the embed
job. Fix delivered separately as `RUN_ME_neighbors_rpc_2026-09-21.sql`; it needs to be run in
the Supabase SQL editor, then the Embed workflow re-run with `neighbors_only`.
