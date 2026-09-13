# AI summary generation

This runs entirely in GitHub Actions — you don't need to install anything or
run any commands on your own computer. You just need to add three secrets
once, then click a button to run it.

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
