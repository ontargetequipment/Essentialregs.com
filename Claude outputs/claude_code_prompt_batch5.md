**Claude Code settings for this prompt — Model: Opus · Effort: medium** (run/verify prompt; no code changes)

# Claude Code prompt — Colorado AQCC Batch 5 import (Reg 11, 12, 25, 27)

Pull `origin/main` (latest — the "Colorado Batch 5" commit). Do these in order; stop and report if any step fails. **Owner-approved spend for this prompt: summaries for Reg 11 + 12 + 25 + 27 (dry-run quote ≈ $4.05 — 1,340 summary-eligible rows at ≈ $0.30/100) plus embeddings (pennies). Nothing else.**

1. **Tests.** `python -m pytest -q pipeline/test_import_ccr.py pipeline/test_import_ecfr.py pipeline/test_summarize.py pipeline/test_freshness.py`. Expect 843 passed, 9 skipped (368 + 259 + 156 + 60). Report counts. (The 23 baseline-gated skips from last time are expected — the parse baselines are still untracked.)

2. **Rehearse.** Run the Import workflow with `execute=false` for `reg=11`, `12`, `25`, `27`. Paste each run's diff/apply stats. Expected new rows: 11 → 715, 12 → 455, 25 → 993, 27 → 413; 0 changed, 0 obsolete; all three apply sanity checks PASS. Paste the summary dry-run row count and cost quote for each; if the four together quote above $5.50, stop and report before executing.

3. **Execute** each of `11`, `12`, `25`, `27` with `execute=true`, `regenerate_summaries=true`, `embed=true`, one at a time. Paste rows written, summaries generated and cost per reg.

4. **Re-link the citing regulations.** Reg 7, 26, 30 and the Common Provisions cite Reg 25/27/11 and now gain cross-links. Run Import with `execute=false` for `reg=7`, `26`, `30`, `cp`. Expected: new 0, obsolete 0, changed rows **all markup-only**: Reg 7 → 9, Reg 26 → 5, Reg 30 → 1, cp → 1. If that matches, execute each with `execute=true`, **no** regenerate_summaries, no embed. If any run shows a non-markup change or different counts, stop and paste its diff report.

5. **Embed** `neighbors_only` once after everything is in. Paste provision and neighbor-row counts.

6. **Freshness.** Trigger the freshness workflow by hand. The four new `sos` rows (5 CCR 1001-13, 1001-15, 1001-29, 1001-31) should read unchanged with ruleVersionIds 12430 / 11881 / 12376 / 11838; the run should end "No changes detected." Paste the last few lines of the table.

7. **Smoke check** at the data level (the site is unreachable from the sandbox): the Colorado index query orders the AQCC group … 9, 11, 12, 22, 24, 25, 26, 27, 30 …; `sec-11-A-II-24` is the definition row titled "II.24. Division"; `sec-11-F-III-C` contains a `doc-table` with a 1982 / 3.5 / 45.0 / 4.0 row; `sec-25-B-I-P-4-d` contains two tables; `sec-27-A-II-QQQ` exists (the "Verifiable" definition); `sec-27-E-IV` contains "951,898".

Report each step's result in order, then stop.
