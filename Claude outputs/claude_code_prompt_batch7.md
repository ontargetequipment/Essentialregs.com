**Claude Code settings for this prompt — Model: Opus · Effort: medium** (run/verify prompt; no code changes)

# Claude Code prompt — Colorado AQCC Batch 7, the final Colorado batch (Procedural Rules, Reg 4, 10, 15, 23, 28, 29, 31)

Pull `origin/main` (latest — the "Colorado Batch 7" commit). Do these in order; stop and report if any step fails. **Owner-approved spend for this prompt: summaries for the eight documents (dry-run quote ≈ $4.67 — 1,555 summary-eligible rows at ≈ $0.30/100), plus embeddings (pennies). Nothing else.**

Two things about this batch that are different from every batch before it, so you know what "correct" looks like:

- **The Procedural Rules have no regulation number**, so other AQCC regulations cite them by name. Importing them adds **62 new cross-reference anchors to 16 documents that are already in the database** — Reg 7 ×21, Reg 9 ×5, Reg 27 ×5, aqs ×5, Reg 26 ×4, Reg 25/30/11 ×3 each, Reg 1/2/20/21/CP ×2 each, Reg 24 ×2, Reg 19 ×1. Reg 23 adds 3 more (Reg 26 ×2, Reg 24 ×1) and Reg 10 adds 5 (all in aqs). So step 5's re-link is much bigger than usual and **every one of those changed rows must be markup-only**.
- **There is a deliberate guard against a wrong link.** ECMC cites the Water Quality Control Commission's "Regulation Number 31" (5 CCR 1002-31, surface water standards), which is a different agency's rule from the AQCC's new Regulation 31 (5 CCR 1001-35, landfill methane). `_non_aqcc_ccr_series()` in `import_ccr.py` suppresses that link. If step 5 shows ECMC changing at all, stop — the guard has broken.

1. **Tests.** `python -m pytest -q pipeline/test_import_ccr.py pipeline/test_import_ecfr.py pipeline/test_summarize.py pipeline/test_freshness.py pipeline/test_embed.py`. Expect **1,136 passed, 119 skipped, 44 subtests passed** for the first four (639 + 149 + 273 + 75), plus test_embed's 27 — so about 1,163 passed overall, plus the usual baseline-gated skips in a fresh clone. Report counts.

2. **Workflow.** Copy `docs/imports/2026-09-21/import.yml.new` over `.github/workflows/import.yml`. The only logic change is a new branch mapping `proc` → `REG_PROC` in "Map reg to source file basename" (the numeric keys 4/10/15/23/28/29/31 already map); the rest is description and error text. Diff it, commit and push.

3. **Rehearse** with `execute=false` for `reg=proc`, `4`, `10`, `15`, `23`, `28`, `29`, `31`. Paste each run's stats. Expected new rows: proc 791, 4 348, 10 79, 15 36, 23 221, 28 282, 29 51, 31 757; 0 changed, 0 obsolete; three sanity checks PASS each. Paste the summary dry-run row count and cost quote per doc; if the eight together quote above **$5.50**, stop and report.

4. **Execute** each of the eight with `execute=true`, `regenerate_summaries=true`, `embed=true`, one at a time. Do `proc` first — the other seven each gain an anchor to it, and doing it first means they land already linked.

5. **Re-link.** This is the big one. Run Import `execute=false` for each of: `7`, `9`, `27`, `aqs`, `26`, `25`, `30`, `11`, `1`, `2`, `20`, `21`, `cp`, `24`, `19`. Expected for every one: new 0, obsolete 0, and changed rows **all markup-only**, in exactly these counts:

   | reg | changed rows | new anchors |
   |---|---|---|
   | 7 | 21 | proc ×21 |
   | 9 | 5 | proc ×5 |
   | 27 | 5 | proc ×5 |
   | aqs | 10 | proc ×5, Reg 10 ×5 |
   | 26 | 6 | proc ×4, Reg 23 ×2 |
   | 25 | 3 | proc ×3 |
   | 30 | 3 | proc ×3 |
   | 11 | 3 | proc ×3 |
   | 1 | 2 | proc ×2 |
   | 2 | 2 | proc ×2 |
   | 20 | 2 | proc ×2 |
   | 21 | 2 | proc ×2 |
   | cp | 2 | proc ×2 |
   | 24 | 3 | proc ×2, Reg 23 ×1 |
   | 19 | 1 | proc ×1 |

   That is 70 changed rows total. Almost all are statement-of-basis rows. If the counts match, execute each with `execute=true`, **no regenerate_summaries, no embed** (markup-only changes do not alter the summary or the embedding).

   Also run `execute=false` for `ecmc`, `12`, `16`, `18` and `sip`. **Expected: 0 new, 0 changed, 0 obsolete for all five.** ECMC in particular must show zero — see the note above. If ECMC shows any change, stop and paste the diff report before executing anything.

6. **Embed** `neighbors_only` once. Paste provisions, neighbour rows, batches/halvings, and the count of provisions with no neighbours.

   Note: the owner may have run `RUN_ME_neighbors_rpc_2026-09-21.sql` in the Supabase SQL editor before this prompt. If he has, the no-neighbours count should drop to near zero; if he hasn't, expect the previous 106 plus however many Batch 7 rows land in large sibling groups. Either result is fine — just report the number and say which it looks like.

7. **Freshness.** Trigger the freshness workflow. Expect eight new `sos` rows unchanged (5 CCR 1001-1 / 1001-6 / 1001-12 / 1001-19 / 1001-27 / 1001-32 / 1001-33 / 1001-35, ruleVersionIds 11840 / 11649 / 6679 / 2600 / 9985 / 12565 / 11408 / 12387) and "No changes detected." Paste the last few lines.

8. **Smoke check** at the data level:
   - the Colorado index query orders the AQCC group **proc first**, then cp, 1, … 31, then aqs, sip — the Procedural Rules sort ahead of every numbered regulation;
   - `sec-proc-A-VI-C-14` does **not** exist (a printed numbering skip in Part A, documented) and `sec-proc-B-III-W` does **not** exist (same, in Part B's definitions);
   - `sec-proc-B-XII-I` exists and is about 39,000 characters (the December 2024 statement of basis);
   - `sec-29-A-I-C` exists and its text starts "Severability" (we split a clause the CCR print fused onto the end of I.B.5.);
   - `sec-4-C-APPENDIX-A-EDITOR-S-NOTES` exists;
   - `sec-4-B-IX` contains a `doc-table` with "Broomfield";
   - `sec-28-C-I-B-2-a-(iv)` contains a `doc-table` with 78 data rows and "Adult Education";
   - `sec-23-A-IV-F-3` contains a `doc-table` and the text "Hayden";
   - `sec-31-K-I` exists and contains the literal string "[date]" — the Commission published the statement of basis with an unfilled placeholder, and we kept it verbatim;
   - `sec-ecmc-100-DEF-CLASSIFIED-WATER-SUPPLY-SEGMENT` contains **no** link to `/regulations/31`.

Report each step's result in order, then stop.
