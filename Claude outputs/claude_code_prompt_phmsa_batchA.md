# Claude Code prompt — PHMSA Batch A import (49 CFR Parts 191 and 192)

Pull `origin/main` (latest; the PHMSA Batch A files landed in the "PHMSA Batch A…" and "Duplicate-marker fix…" commits). Do these in order; stop and report if any step fails. **Owner-approved spend for this prompt: summaries for p191 + p192 (dry-run quote ≈ $4.00 — 1,331 summary-eligible rows at ≈ $0.30/100) plus embeddings (pennies). Nothing else.**

1. **Tests.** `python -m pytest -q pipeline/test_import_ccr.py pipeline/test_import_ecfr.py pipeline/test_summarize.py pipeline/test_freshness.py`. Expect about 225 + 188 + 123 + 43 passed (a few file-gated skips). Report counts.

2. **Workflow.** Copy `docs/imports/2026-09-19/import.yml.new` over `.github/workflows/import.yml` (it adds the `p191`/`p192` → `P191`/`P192` basename mapping and skips the pdftotext step for those two keys, checking that `pipeline/sources/P19x.xml` exists instead). Diff it against the current file so only those hunks change; commit and push.

3. **Rehearse.** Run the Import workflow with `reg=p191`, `execute=false`, then `reg=p192`, `execute=false`. Paste each run's diff/apply stats. Expected: p191 new 127, p192 new 2,612, 0 changed, 0 obsolete, all three apply sanity checks PASS, `issuing_body 'PHMSA'` / `jurisdiction_level 'federal'` in the upsert SQL. Also paste the summary dry-run row count and cost quote. If p192's cost quote is above $5.50, stop and report before executing.

4. **Execute.** `reg=p191`, `execute=true`, `regenerate_summaries=true`, `embed=true`; then the same for `p192`. Paste the final stats (rows written, summaries generated, cost) for each.

5. **ECMC re-link.** ECMC Rules 100 (Gathering Line definition) and 1102.d.(3).A cite 49 C.F.R. § 192.8 / § 192.243 and now link to Part 192. Run Import `reg=ecmc`, `execute=false`; confirm new 0, obsolete 0, changed 2, both markup-only (`sec-ecmc-100-DEF-GATHERING-LINE`, `sec-ecmc-1102-d-(3)-A`). If so, execute (no regenerate_summaries). If anything else changed, stop and paste the diff report.

6. **Embed** `neighbors_only` once after both parts are in. Paste provision and neighbor-row counts.

7. **Freshness.** Trigger the freshness workflow by hand; it should now show `eCFR 49 CFR Part 191` / `Part 192` as unchanged and the CDPHE general-permit line as either unchanged (browser headers worked) or "not checked (blocked)". Paste the summary.

8. **Smoke check** production: `/federal` (new "PHMSA — 49 CFR Pipeline Safety" group at the bottom), `/regulations/p191`, `/regulations/p192` (16 subparts in the sidebar, Appendix B–G after Subpart P, § 192.3 definitions as their own rows, § 192.121 shows a "figure not reproduced" line). Note the load time of `/regulations/p192` — it is the largest document so far.

Report each step's result in order, then stop.
