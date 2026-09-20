**Model: Opus · Effort: medium**

# Claude Code prompt — PHMSA Batch C import (49 CFR Parts 190, 193, 196) + freshness workflow fix

Pull `origin/main` (latest — the "PHMSA Batch C" commit). Do these in order; stop and report if any step fails. **Owner-approved spend for this prompt: summaries for p190 + p193 + p196 (dry-run quote ≈ $1.25 — 413 summary-eligible rows at ≈ $0.30/100) plus embeddings (pennies). Nothing else.**

1. **Tests.** `python -m pytest -q pipeline/test_import_ccr.py pipeline/test_import_ecfr.py pipeline/test_summarize.py pipeline/test_freshness.py`. Expect 688 passed, 9 skipped (233 + 259 + 145 + 51). Report counts.

2. **Workflows.** Copy `docs/imports/2026-09-20/import.yml.new` over `.github/workflows/import.yml` (description strings only — the `^p19[0-9]$` regex already accepts the new keys; diff must show text changes only) and `docs/imports/2026-09-20/freshness.yml.new` over `.github/workflows/freshness.yml` (the freshness step now writes `freshness_report.md` and the issue step reads that file instead of its own empty `$GITHUB_STEP_SUMMARY` — this is why issue #1 was titled "Source update detected: unknown"). Diff both against the current files, commit and push.

3. **Rehearse.** Run the Import workflow with `execute=false` for `reg=p190`, `p193`, `p196`. Paste each run's diff/apply stats. Expected new rows: p190 517, p193 436, p196 27; 0 changed, 0 obsolete; all three apply sanity checks PASS; `issuing_body 'PHMSA'` / `jurisdiction_level 'federal'` in the SQL. Paste the summary dry-run row count and cost quote for each; if the three together quote above $2.00, stop and report before executing.

4. **Execute** each of `p190`, `p193`, `p196` with `execute=true`, `regenerate_summaries=true`, `embed=true`. Paste rows written, summaries generated and cost per part.

5. **Re-link the existing PHMSA parts.** The new parts make some existing cross-references resolvable (e.g. Part 192's "§ 190.9", Part 199's "part 192, 193, or 195"). Run Import with `execute=false` for `reg=p191`, `p192`, `p194`, `p195`, `p199`. Expected: new 0, obsolete 0, and changed rows **all markup-only**: p191 3, p192 5, p194 0, p195 6, p199 6. If that matches, execute each one that has changes (`execute=true`, **no** regenerate_summaries, no embed — markup-only changes keep review state and summaries). If any run shows a non-markup change or different counts, stop and paste its diff report.

6. **Embed** `neighbors_only` once after everything is in. Paste provision and neighbor-row counts.

7. **Freshness.** Trigger the freshness workflow by hand. It should list `eCFR 49 CFR Part 190/193/196` as unchanged alongside the other 29 sources and end "No changes detected." Paste the summary table's last few lines.

8. **Smoke check** production: `/federal` (the PHMSA group now lists Parts 190, 191, 192, 193, 194, 195, 196, 199 in that order, with the three new "applies to" lines), `/regulations/p190` (Subparts A–E, § 190.3 definitions as their own rows, § 190.223 penalty amounts intact), `/regulations/p193` (Subparts A–J, § 193.2007 definitions incl. "m³"), `/regulations/p196` (three subparts, § 196.203 links to Part 190).

Report each step's result in order, then stop.
