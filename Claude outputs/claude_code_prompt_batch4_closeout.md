# Claude Code prompt — batch 4 close-out (paste after the commit is pushed)

Pull `origin/main` (commit "Batch 4 review: 25 summary fixes, markup-only re-imports keep review state, GP hint + MAX_TOKENS") and do these in order. Stop and report if any step fails. Owner-approved spend for this prompt: embedding only (well under $1); no summary generation.

1. **Tests.** `pip install -r pipeline/requirements.txt` if needed, then `python -m pytest -q pipeline/test_import_ccr.py pipeline/test_import_ecfr.py pipeline/test_summarize.py`. Expect ≈200 + 67 + 101 passed (a few file-gated skips). Report the counts.

2. **Freshness workflow.** Copy `docs/imports/2026-09-19/freshness.yml.new` to `.github/workflows/freshness.yml` (create the file; it is a weekly `schedule` + `workflow_dispatch` job running `pipeline/freshness.py`). Commit and push, then trigger it once by hand (`gh workflow run freshness.yml`), wait for it, and paste the run summary (it should report every source as "unchanged" and write nothing).

3. **Re-import the five regs that now mention batch-4 documents** so their cross-links appear: run the Import workflow for `6`, `7`, `8`, `26`, `30` with `execute=false` (rehearsal) and no `regenerate_summaries`. For each, read the apply stats and confirm: `new` 0, `obsolete` 0, and every `changed` row is **markup-only** (the stats line "of which markup-only" equals the `changed` count). Expected: about 27 changed rows total across the five, all markup-only. If any reg shows a non-markup change, a new row or an obsolete row, STOP and paste that reg's diff report — do not execute it.
   If all five are clean, run the same five with `execute=true` (still no `regenerate_summaries`). Markup-only rows now keep their `summary_status`, `reviewed_by` and `summary_original` (new importer behaviour, tested). Afterwards run this read-only check and paste the result — it must return 0 rows:
   `select id, summary_status from provisions where id ~ '^sec-(6|7|8|26|30)-' and summary_status <> 'approved' and ai_summary is not null;`

4. **Embed.** Run Embed provisions for `gp02, gp05, gp06, gp08, gp09, gp10, gp11, gp12, jjjj, iiii, zzzz` (the regs with corrected summaries), then one `neighbors_only` run. Paste the row counts and cost.

5. **Sample page.** Apply `docs/site/sample_rows_2026-09-19.sql` against Supabase (service-role key from the repo secrets, the same way the import job connects — e.g. a one-off `python - <<EOF` using supabase-py's `rpc`/`postgrest` or `psql` if `DATABASE_URL` is available). It makes four reviewed rows public (`sec-7-B-I-D-3-a-(i)`, `sec-gp02-II-A-2`, `sec-ecmc-604-a-(1)`, `sec-cp-I-G-90`) and un-publishes the three hand-typed placeholders. Paste the final `select`. If there is no clean way to run SQL from your session, say so and Brody will paste the file into the Supabase SQL editor.

6. **Smoke check** the production site: `/general-permits`, `/regulations/gp02`, `/regulations/zzzz` (Table 2c summary should now end in a full sentence), `/sample` (four cards, GP02 II.A.2 among them). Paste any error.

Report each step's result in order, then stop.
