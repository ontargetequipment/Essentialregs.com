# AI summary generation

This runs entirely in GitHub Actions — you don't need to install anything or
run any commands on your own computer. You just need to add three secrets
once, then click a button to run it.

## Working rule: fetch and merge before editing

More than one Claude Code session works in this repo, sometimes at the same
time. Before editing anything under `pipeline/`, run `git fetch` and merge
`origin/main` into your branch first, and resolve any conflicts before you
start — otherwise your changes can silently clobber another session's work
(or vice versa) the next time either side pushes.

## One-time setup: add the three secrets

1. Go to the repo on GitHub: **ontargetequipment/Essentialregs.com**.
2. Go to **Settings → Secrets and variables → Actions → New repository secret**,
   and add these three, one at a time:

   | Secret name | Where to get it |
   |---|---|
   | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → **Settings → API Keys → Create Key**. Copy the key (starts with `sk-ant-`) — you can't view it again after you close the dialog, so paste it into the GitHub secret right away. |
   | `SUPABASE_URL` | Your Supabase project → **Project Settings → API → Project URL** (looks like `https://xxxxx.supabase.co`). |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same page, **Project Settings → API → Project API keys → `service_role`** (labeled "secret"). This key bypasses all the site's normal access rules, so treat it like a password — never put it in the app itself, only here. |

You only have to do this once. Come back and update `ANTHROPIC_API_KEY` if you
ever rotate it in the Anthropic console.

## Running it

1. On GitHub, go to the **Actions** tab → **Generate summaries** (in the left
   sidebar) → **Run workflow** (button on the right).
2. You'll see four optional fields:
   - **reg** — leave blank to process every regulation, or type `7`, `3`,
     `26`, or `oooob` to do just one.
   - **limit** — leave blank for no limit, or type a number to only process
     that many provisions (useful for test runs).
   - **dry_run** — check this to preview what would happen without spending
     any money or changing anything in the database.
   - **model** — leave as `claude-sonnet-4-5` unless you're deliberately
     trying a different model.
   - **force** — leave unchecked for normal use. Check this only when you
     want to regenerate summaries that already exist (see "Regenerating a
     regulation from scratch" below) — combine it with a specific `reg` so
     you don't accidentally re-spend money re-summarizing everything.
3. Click the green **Run workflow** button.

### The recommended first-time sequence

1. **Dry run first, no cost:** Run workflow with `dry_run` checked and
   everything else blank (or `limit=25` to keep the log short). Open the run
   in the Actions tab and check the log — it prints the prompt built for
   each provision and an estimated cost. Nothing is written to the database
   and no API calls are made.
2. **Small real test:** Run workflow with `reg=7`, `limit=25`, `dry_run`
   unchecked. This actually calls Claude and writes 25 real summaries for
   Regulation 7. Open the site and spot-check a few of those provisions —
   the summary shows in the "Plain-English summary" panel under the
   provision text, marked "AI-generated · not yet human-reviewed" until you
   set a `last_verified_date` on that row.
3. **Everything:** Once you're happy with the quality, run workflow again
   with all fields blank (and `dry_run` unchecked). This picks up every
   remaining provision across all four regulations. It only ever processes
   provisions that don't already have a summary, so it's safe to click this
   even if a previous run is still in progress or only got partway through
   — it just picks up where it left off.

The run can take a while (the workflow allows up to 6 hours) because it
submits your provisions to Anthropic's Batch API and waits for the batch to
finish processing — that's normal, and it's also what keeps the cost to half
the normal per-token price. Progress prints to the run's log the whole time.

## If some rows fail

A provision can fail if, say, the API had a transient error on that one
request. Failed provisions are logged (to `pipeline/failed.jsonl` inside that
run) and, if there were any, the run attaches them as a downloadable
**failed-summaries** file at the bottom of the Actions run page so you can
see which ones and why.

**To retry failures, just run the workflow again** with the same `reg`
(or blank for everything) and `dry_run` unchecked. The script always skips
provisions that already have a summary and only processes what's still
missing, so a second run automatically retries anything that failed the
first time — no special "retry" mode needed.

## Regenerating a regulation from scratch

Normal runs only ever fill in provisions that don't have a summary yet — so
if you've changed the prompt, switched models, or just want fresher
summaries for one regulation, that regulation's existing summaries won't be
touched unless you say so explicitly:

1. Go to **Actions → Generate summaries → Run workflow**.
2. Set **reg** to the one you want to redo (e.g. `3`) — leaving it blank
   with `force` checked would re-summarize the *entire* corpus and re-spend
   the full cost, so scope it deliberately.
3. Check **force**, leave **dry_run** unchecked, click **Run workflow**.

## Cost

Each run prints a final table with rows processed, tokens used, and an
estimated dollar cost based on Anthropic's published per-token rates. See
the project's sizing note for a full-corpus estimate before you run
everything at once.

## Re-importing a regulation from the official PDF

When the official CCR text has changed (a new rulemaking, a fix to a parser
bug, a full re-check against `pipeline/sources/`), the importer
(`pipeline/import_ccr.py`, see `pipeline/IMPORTER_SPEC.md`) rebuilds the
regulation's `provisions` rows from the source PDF while preserving ids,
review status, and existing AI summaries wherever the text hasn't actually
changed.

Source-text typos the parser corrects by hand are listed in
`KNOWN_LABEL_FIXES` (in `import_ccr.py` for the CCR regulations and
`import_ecfr.py` for the federal subparts). Each entry rewrites exactly one
line and the parse output reports its hit count — `OK` means 1 hit; anything
else means the source text changed and the fix needs re-checking. When a
second-pass review finds a mis-nested or fused provision, look at the source
line first: it is usually a misprinted label (e.g. Reg 26's `II.D.6.f.(i)(B)`
for `I.D.6.f.(i)(B)`, Reg 3's `II. E.3.nnn.(i)` with a stray space, OOOOc's
`(vi)` for `(iv)` in § 60.5421c(b)(11)), and a fix entry is the right repair.
Statement-of-basis parts whose entries contain restarted numbered lists are
kept as one row per entry (`inner_items: False` in `SOB_PART_CONFIG`).

### Running it from GitHub Actions (the normal way — no computer needed)

This is the recommended path: everything runs in the cloud, from the PDF
that's already committed at `pipeline/sources/REG_<N>.pdf`, and it's the
only place with the service-role key that can write to the database.

1. On GitHub, go to the **Actions** tab → **Import regulation from official
   PDF** (in the left sidebar) → **Run workflow** (button on the right).
2. Fill in the fields:
   - **reg** — the regulation number to import, e.g. `7`.
   - **execute** — leave unchecked for the first run on a given PDF. This
     parses the PDF, diffs it against the live database, and builds an
     apply plan, but **writes nothing** to the database — it just uploads a
     report for you to read.
   - **regenerate_summaries** — leave unchecked for now (see step 4 below).
3. Click the green **Run workflow** button, then open the run once it
   starts.
4. Scroll the run's log to the **"Print stats and diff report to the job
   log"** step — it prints the plan's counts (how many provisions are
   identical / changed / new / removed) and the first 60 lines of the diff
   report right there in the browser, no download needed. For the full
   detail, the run also attaches a downloadable **import-reg\<N\>** file at
   the bottom of the page with the complete diff report, the plan, and the
   list of ids that will need a fresh AI summary.
5. **Read the stats and the diff report before doing anything else.** If
   the counts and the "different"/"only in DB"/"only in parsed" sections
   look like what you expect from the change you're importing, you're ready
   to actually write it.
6. Run the workflow again with the same **reg**, this time with **execute**
   checked. This performs the exact same plan directly against the
   database. Also check **regenerate_summaries** if you want it to
   automatically regenerate AI summaries afterwards for exactly the
   provisions whose text changed (equivalent to the "Generate summaries"
   workflow's "Regenerating a regulation from scratch" flow, but scoped
   to only what this import actually touched — see step 4 of the manual
   flow below for what that command is doing).
7. If you didn't check **regenerate_summaries** in step 6, go run the
   **Generate summaries** workflow separately afterwards (see the top of
   this file), or check it next time.

Nothing about this requires installing anything locally — the three repo
secrets from the top of this file (`ANTHROPIC_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`) are all it needs, and they're already set up if
you've run "Generate summaries" before.

### Running it by hand (local dry-run / review, no writes)

This is the same pipeline the Actions workflow above runs, useful if you
want to inspect intermediate files yourself or don't have Supabase access
from the Actions runner. It's a four-step, human-in-the-loop pipeline —
nothing writes to the database except a SQL file you run yourself (or, on
the `--execute` path described further down, a script you approve and run
in CI):

```bash
# 1. Parse the official PDF into provisions JSON.
python pipeline/import_ccr.py parse --reg 7 \
  --pdf pipeline/sources/REG_7.pdf \
  --out pipeline/out/reg7_parsed.json

# 2. Export a fresh snapshot of the current DB rows for this regulation
#    (id, citation, title, parent_id, sort_order, full_text) — a read-only
#    Supabase SELECT. Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in
#    the environment (see the top of this file for where to get them), or
#    use the Supabase MCP execute_sql tool instead (see IMPORTER_SPEC.md
#    item 2) if you're doing this from an assistant session with Supabase
#    access but no shell env vars set.
python pipeline/import_ccr.py export --reg 7 --out pipeline/out/reg7_db.json

# 3. Diff the parse against that export. Read the report before continuing.
python pipeline/import_ccr.py diff --reg 7 \
  --parsed pipeline/out/reg7_parsed.json \
  --db pipeline/out/reg7_db.json \
  --out pipeline/out/reg7_diff_report.md

# 4. Build the apply plan: a per-id classification (identical/changed/new/
#    obsolete) and ready-to-run SQL files. Still no database writes.
python pipeline/import_ccr.py apply --reg 7 \
  --parsed pipeline/out/reg7_parsed.json \
  --db pipeline/out/reg7_db.json \
  --out-dir pipeline/out/apply_reg7
```

This writes, under `pipeline/out/apply_reg7/`:

- `plan.json` — every id's class and the reason (for `changed` rows, also
  whether the change is markup-only — e.g. an added xref span — vs a real
  visible-text change).
- `stats.md` — counts per class plus the sanity checks (every parent_id in
  the final state resolves; no id is both deleted and upserted; every
  deleted id's removal note resolved to a surviving ancestor).
- `summary_regen_ids.txt` — the ids that actually need a fresh AI summary:
  every `new` row, and every `changed` row whose *visible* text changed
  (markup-only changes, like a newly-linked cross-reference, don't need
  regeneration — the existing summary is still accurate).
- `01_upsert_NNN.sql`, `02_provision_removed_notes_NNN.sql`,
  `03_deletes_NNN.sql` — run in that numeric/prefix order, each file sized
  to run as one paste/execute. `01_upsert_*` is one ordered upsert stream
  (sorted by document order) covering every surviving id — for `identical`
  rows it only refreshes citation/title/parent_id/sort_order; for `changed`
  and `new` rows it also replaces `full_text` and marks the row
  `summary_status = 'pending'` (clearing `reviewed_by`/`reviewed_at`/
  `summary_original`) while leaving the *existing* `ai_summary` alone, so a
  stale-but-useful summary survives until it's regenerated.
  `02_provision_removed_notes_*` logs a `provision_changes` row on each
  removed provision's nearest surviving ancestor. `03_deletes_*` removes the
  obsolete rows last.

Review `stats.md` and spot-check `plan.json`, then run the SQL files
yourself, in order, against Supabase (SQL editor or `psql`).

```bash
# 5. Regenerate AI summaries for exactly the ids that need it.
python pipeline/summarize.py --ids-file pipeline/out/apply_reg7/summary_regen_ids.txt --force
```

`--force` is required alongside `--ids-file`: without it, `summarize.py`
skips any row that already has *some* `ai_summary`, which would defeat the
point of re-running an id whose text just changed (see `--help` on both
scripts for the full flag list).

### The `--execute` path

`import_ccr.py apply` also accepts `--execute --yes`, which performs the
same plan directly against Supabase via `supabase-py` instead of writing
SQL files, using the same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
environment variables as `summarize.py`. `identical` and `changed` ids are
always existing rows, so each gets its own `UPDATE ... WHERE id = ...`
(never an upsert — PostgREST's upsert is `INSERT ... ON CONFLICT DO
UPDATE`, and Postgres builds the INSERT row, with every omitted column set
to NULL, before it even checks the conflict, so an upsert payload that
deliberately omits a NOT NULL column to leave it alone on the UPDATE branch
fails that column's constraint even though the row already exists); `new`
ids are genuinely inserted, with every required column populated, in
chunks of at most 100 rows. The whole stream is ordered by `sort_order` so
a brand-new parent is always written before any child that references it,
then the removal notes are inserted, then obsolete ids are deleted last.
It refuses to run without `--yes`. A failed write (an exception, or an
UPDATE that matches zero rows) aborts the run immediately (a non-zero
exit, no silent partial success) rather than continuing on to later
writes. This is the path the **Import regulation from official PDF**
Actions workflow above uses when you check **execute**; it's not meant to
be run by hand outside CI —
prefer generating and reviewing the SQL files above for a manual import.
See `pipeline/test_import_ccr.py` for the stub-client tests covering its
chunking, field, and ordering behavior.

# Semantic embeddings (`embed.py`)

`pipeline/embed.py` turns every provision into a Voyage AI embedding
(`voyage-3.5-lite`, 1024 dims) stored in `provision_embeddings`, then
rebuilds `provision_neighbors` (the "Related provisions" panel) through the
`recompute_provision_neighbors` SQL function. Both tables and the
`match_provisions` search RPC come from `supabase/migrations/005_embeddings.sql`
and `006_neighbors_rpc.sql`.

What goes into each embedding: `<Colorado|Federal> regulation <key>: citation — title`,
the first 300 characters of the immediate parent paragraph, the row's
`ai_summary` (unless its `summary_status` is `rejected`), and the tag-stripped
`full_text`. Rows over 6,000 characters are split into overlapping chunks
(~1,500 tokens, 150 overlap); chunk 0 always carries the summary. Each chunk
is content-hashed with the model name, so a re-run only re-embeds rows whose
text or summary changed (or everything, with `--force`).

Secrets: `VOYAGE_API_KEY` (GitHub Actions secret and Vercel env var), plus the
existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Never commit the key.

## Running it

**Embed provisions** workflow (Actions tab), inputs: `reg`, `limit`, `dry_run`,
`force`, `neighbors_only`. Always dry-run first — it prints the chunk count,
token estimate and cost, and calls nothing:

```
python pipeline/embed.py --dry-run --show 3      # whole corpus estimate
python pipeline/embed.py --reg 7                 # embed Reg 7 (changed rows only)
python pipeline/embed.py                         # whole corpus, resumable
python pipeline/embed.py --neighbors-only        # rebuild related panel, no API calls
```

The **Import regulation** workflow has an `embed` checkbox that runs
`embed.py --reg <reg>` after a successful execute (and after summaries, if
`regenerate_summaries` is also checked), so new regulations are searchable
without a separate step. Note that `--reg` runs only recompute neighbours for
the rows they touched; run `--neighbors-only` once afterwards if you want
older rows to be able to point at the newly added ones.

## Cost

`voyage-3.5-lite` is $0.02 per million tokens. The whole corpus is roughly
3.4M tokens ≈ **$0.07** one-time (September 2026 estimate; Voyage's free tier
covers far more than that). A single search query is ~30 tokens. The related
panel costs nothing at runtime. A new Voyage account has a low starter rate
limit until a payment method is added; the script retries 429s with backoff,
but adding a card in the Voyage dashboard makes the full run take minutes
instead of hours.

Failures are written to `pipeline/embed_failed.jsonl` (uploaded as a workflow
artifact) and retried automatically on the next run, because a failed row
still has no matching hash on record.

## Source freshness watcher

"Updates included" is a promise we monitor rather than a promise we just
make. The **Source freshness check** workflow (`.github/workflows/freshness.yml`)
runs every Monday at 7 AM Mountain (`workflow_dispatch` also lets you run it
on demand) and checks every imported source document against its live
upstream:

- **Colorado SOS CCR rules** (`kind: "sos"`, e.g. Reg 3, Reg 7, the ECMC
  rules) — loads the rule's `DisplayRule.do` page and reads the current
  `ruleVersionId` out of the first `OpenRuleWindow(...)` call in the HTML.
- **eCFR subparts** (`kind: "ecfr"`, e.g. NSPS OOOOa/OOOOb/OOOOc, JJJJ, IIII,
  ZZZZ) — calls the eCFR versioner API and compares the latest amendment
  date to the `as_of` date we imported.
- **CDPHE general air permits** (`kind: "cdphe_gp"`, GP01–GP12) — loads the
  general-air-permits page and compares each permit's OnBase `docid` (and
  watches for a docid that vanished, or a new GP number that isn't in the
  manifest yet).

What we hold for each source lives in `pipeline/sources/manifest.json`. The
check never writes to the database or touches secrets — it only reads public
pages/APIs and prints a report.

### Reading the report

Every run writes a markdown table to the job summary (Actions tab → the run →
**Summary**), one row per source: `key | source | ours | theirs | status`,
where status is ✅ (unchanged), 🔔 (upstream changed), or ⚠️ (couldn't be
checked — a timeout or a page layout change; these do **not** fail the run,
since a flaky site shouldn't page anyone).

When at least one source shows 🔔, the job fails (red X) and the workflow
opens or updates a single GitHub issue titled **"Source update detected:
\<keys\>"** with the full report attached. If that issue is already open from
a previous week, it's updated in place (with a comment noting the re-check)
instead of opening a duplicate — there's only ever one open freshness issue
at a time.

### Re-import procedure once a change is flagged

1. Open the flagged issue and note which key(s) changed (e.g. `3`, `ooooa`,
   `cdphe_gp:gp03`).
2. Run the **Import regulation from official PDF** workflow for that
   regulation with `execute`, `regenerate_summaries`, and `embed` all
   checked, using the latest official PDF/text for that source. (For eCFR
   subparts and CDPHE general permits — which aren't PDF-based CCR imports —
   follow the same execute/summarize/embed steps against whatever import
   path that source type uses; the point is the DB rows, summaries, and
   embeddings all need to reflect the new text before you clear the flag.)
3. Once the re-import lands, run:
   ```
   python pipeline/freshness.py --update-manifest <key>
   ```
   for each changed key. This re-fetches the live source and writes its
   current version (ruleVersionId/effective date, eCFR as_of date, or CDPHE
   docid) back into `manifest.json`.
4. Commit the updated `manifest.json`. The next scheduled run will see the
   new value as "ours" and close back out to ✅ — close the GitHub issue by
   hand once you've confirmed that.

### Running it locally / testing

```
python pipeline/freshness.py check                    # live check, needs network access to the source sites
python pipeline/freshness.py check --fixtures DIR      # check against saved HTML/JSON fixtures instead (no network)
python pipeline/freshness.py --update-manifest 3       # record source "3"'s current upstream version
python3 -m pytest -q pipeline/test_freshness.py        # run the test suite (all fixture-based, no network)
```
