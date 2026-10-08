# AI summary generation

This runs entirely in GitHub Actions — you don't need to install anything or
run any commands on your own computer. You just need to add three secrets
once, then click a button to run it.

## Review is built in (owner decision, Brody, 5 Oct 2026)

Review is part of how a regulation gets onto the site. No summary reaches a
customer labelled "AI reviewed" without passing through `pipeline/review.py`,
and nobody has to ask for it. Since 6 Oct 2026 (ReviewBuiltIn):

- **One run, three stages, one report.** The **Generate summaries** workflow
  runs `pipeline/run_chain.py`: it writes every summary as `pending`, reviews
  exactly the rows it wrote (`review.py`, same reviewer, same prompt), embeds
  them, and writes one report (`pipeline/out/chain_report.md`, the
  **chain-report** artifact and the job summary). Rows the reviewer fails are
  regenerated once and reviewed again in the same run; rows that fail twice
  stay pending and are listed at the top of the report.
- **Imports trigger it too.** The **Import regulation** workflow runs the same
  chained run after every execute, on every row whose letters or digits
  changed plus its ancestors (their summaries are written from the provision
  and its descendants). No checkbox; `skip_summaries` is the emergency
  opt-out, off by default. Link-markup-only changes (a new cross-reference
  span, a [sic] marker, whitespace, punctuation) do not trigger it and keep
  the row's review state (`text_letters_digits_changed`, tested).
- **Only `review.py` approves.** A summary becomes `approved` or `edited` only
  through `review.py`. The admin page (`/admin/review`) can reject a summary,
  send it back to pending, or save an edited text as pending for the next
  review; its Approve buttons are gone. The database trigger
  `provisions_summary_approval_only_by_pipeline` (migration
  `20261006090000`) refuses any approval whose `reviewed_by` does not carry
  "automated pipeline" or whose `reviewed_at` is null, and
  `test_run_chain.py` fails if any other file in the repo writes an approval.
- **Guards that fail loudly.** `scripts/corpus_qa.sql` checks 25
  `summary_pending_over_24h` (expected 0, less the short `pending_allowlist`
  in the same file, each entry with its reason), 21 `approved_outside_pipeline`
  (expected 0; replaced the looser check of 4 Oct) and 19
  `approved_without_review_date` (expected 0). CI's qa job runs them on every
  pull request; the daily **Summary guard** workflow
  (`.github/workflows/summary-guard.yml`, 07:17 Mountain) runs them too and
  opens the issue **"Summary guard failed"** with the counts and ids when any is
  above 0, and does nothing when all are 0. Every chained run also prints the
  three counts at the end of its log (`pipeline/summary_guard.py`).
- **A monthly spot-check.** The **Monthly summary audit** workflow
  (`monthly-audit.yml`, the 1st of each month) runs the reviewer in audit mode
  (`review.py --audit 100 --audit-population pipeline`, current prompt, full
  ancestor context) over 100 random AI-reviewed summaries, read-only, capped
  at $1. It writes the report to `docs/imports/audits/<YYYY-MM>.md` through a
  pull request and opens the issue **"Monthly summary audit: \<rate\>
  would-correct"** when the would-correct rate is above 10 percent. It never
  changes a summary.
- **The standing spending rule, enforced in code.** The pipeline may spend up
  to **$10 per regulation per run** on summaries, review and embedding combined
  without asking (`pipeline/budget.py`, `STANDING_BUDGET_USD`, the one place
  the number lives). Before the first paid call every stage's estimate is added
  per regulation; if any regulation is over, the run makes no paid call and
  stops with a message asking for owner approval (exit code 2). During the run
  actual spend is recorded per regulation after every batch; passing the
  budget cancels the remaining batches and leaves the remaining rows pending.
  The only override is the workflow input **approved_budget**, which the run
  prints at the top of its report. `summarize.py`, `review.py` and `embed.py`
  enforce the same rule when run on their own.
- **One budget, two passes.** `summarize.record_spend` and
  `review.record_spend` add a run's spend to what the stage already held, so
  the regenerate and second-review passes of a chained run no longer erase
  the first passes' figures (the 8 Oct 2026 Subpart OOOO report printed
  $0.0136 spent when its first review alone cost $1.38).
- **Reconnect and resume.** Every database write goes through
  `pipeline/dbclient.py`, which reopens the connection and replays the request
  when the host closes it (it does so after 10,000 requests on one HTTP/2
  connection, which killed the stage 2b run on 6 Oct 2026). A chained run that
  dies after submitting its batches writes their ids to
  `pipeline/out/chain_state.json`; re-run it with the same selection inputs and
  **resume_batches** (`summarize=msgbatch_a;review=msgbatch_b;...`) and it
  consumes those batches without submitting or paying again.
- **The writer sees what the reviewer sees.** The summarizer's prompt carries
  the same "Text above this provision" block the reviewer has had since
  PR #61 (`summarize.build_ancestor_block`, re-exported by `review.py`; one
  copy), the whole provision text up to 16,000 words (was 6,000), and a
  rewritten system prompt with one rule and example per error type the
  October re-review found most often (parties, duty vs option, numbers and
  dates, dropped conditions, ancestor limits, scope, open lists, citations,
  purpose, terms). The proof (`writer_proof.py`, the **writer_proof** input of
  the Review workflow) is recorded in `docs/CEO_PHASE_PLAN.md`.

### Order of operations for a new regulation

1. **Import** — Actions → **Import regulation from official PDF** → dry run
   (unchecked `execute`), read the stats and diff report, then run again with
   `execute`. The chained run follows automatically. The source must be
   committed to `pipeline/sources/` first; for a 40 CFR subpart whose eCFR
   print is not committed yet, the workflow's "Fetch the eCFR print" step
   downloads it on the runner (www.ecfr.gov is not reachable from a Claude
   Code cloud session) and commits the PDF and its pdftotext text to the
   branch the run was started on, so the dry run and the execute read the
   same bytes (added 8 Oct 2026 for the original Subpart OOOO; `ecfr_pdf_url`
   names the PDF link when the page's own cannot be found).
2. **Summarize, review and embed in one run** — automatic after the import
   (new rows and changed rows) and, for a regulation imported before 6 Oct
   2026 or for a full redo, **Generate summaries** with `reg` set. Within the
   $10 per regulation budget; above it the run stops and asks.
3. **Spot-check** — the run writes a 40-row sample (20 pass, 20 corrected,
   seeded, with the ancestor text the reviewer saw) to
   `docs/imports/<date>/<label>_chain_sample_40.md` and opens a pull request
   with it. The Cowork session checks the sample against the official text.
   Opening that pull request (and the monthly audit's) needs the repository
   setting **Settings → Actions → General → "Allow GitHub Actions to create
   and approve pull requests"**; until it is on, the run pushes the sample to
   the branch `chain-sample/<label>-<run id>`, logs a warning naming it, and
   someone opens the pull request from that branch by hand (the sample is in
   the `chain-report` artifact too).
4. **Release** — a first import lands the document **staged**
   (`regulation_releases`, migration 20261008040000; `apply --execute`
   inserts the row and prints `NEW DOCUMENT: <reg> is STAGED`). Staged means
   invisible to subscribers: the reader, `/regs/<id>`, keyword search, Ask,
   related provisions, the previews and the Federal/States/GP indexes, the
   sitemap and the public changelog all leave it out, and other documents'
   re-imports do not write links to it (`dump-ids` leaves its ids out of
   `corpus_ids.json` and lists it in `corpus_staged.json`). Admins on
   `ADMIN_EMAILS` still open it in the reader and the review queue. When the
   Cowork session says "make <reg> public", run Actions → **Release
   regulation** (`python pipeline/import_ccr.py release --reg <reg> --yes`),
   then `dump-ids` and the markup-only re-imports of the documents that cite
   it (`pipeline/link_change_report.py` names them), then the Ask and Keyword
   evals. Before 8 Oct 2026 there was no such state: `is_public` only decides
   which four rows anonymous visitors may read on `/sample`, and Subpart OOOO
   was visible to every subscriber from the moment it was imported.
5. **Public sample** — a regulation's summaries do not appear on the public
   `/sample` or `/regulations/<reg>/preview` pages until nothing of it is still
   pending review (`teaserSummariesVisible`, `gatePublicSummaries`).

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
2. The fields (all optional):
   - **reg** — leave blank to process every regulation, or type `7`, `3`,
     `26`, or `oooob` to do just one.
   - **limit** — leave blank for no limit, or type a number to only process
     that many provisions (useful for test runs).
   - **dry_run** — check this to preview the selection and the estimate for
     all three stages against the budget without spending any money or
     changing anything in the database.
   - **model** / **review_model** — the writer (`claude-sonnet-4-5`) and the
     reviewer (`claude-sonnet-5-5`, always a separate call).
   - **force** — leave unchecked for normal use. Check this only when you
     want to regenerate summaries that already exist (see "Regenerating a
     regulation from scratch" below) — combine it with a specific `reg` so
     you don't accidentally re-spend money re-summarizing everything.
   - **ids** — exact provision ids to regenerate, review and embed.
   - **approved_budget** — only when the owner has approved more than the
     standing $10 per regulation for this run; printed at the top of the
     report.
   - **resume_batches** — only to finish a run that died after submitting
     (see "Reconnect and resume" above).
3. Click the green **Run workflow** button. The run summarizes, reviews and
   embeds; read `chain_report.md` in the job summary: the budget, the rows
   still pending (expected none), the counts per stage and every correction.

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
   provision text, marked "AI reviewed · <date>" once the same run's review
   stage has checked it (a row the reviewer failed twice stays
   "AI-generated · not yet reviewed" and is listed at the top of the report).
3. **Everything:** Once you're happy with the quality, run workflow again
   with all fields blank (and `dry_run` unchecked). This picks up every
   remaining provision across every regulation. It only ever processes
   provisions that don't already have a summary, so it's safe to click this
   even if a previous run is still in progress or only got partway through
   — it just picks up where it left off. The $10 per regulation budget
   applies to every regulation in the run separately.

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

## Regenerating parent summaries from parent + descendants (Phase 0)

A provision that is only an introduction ("must comply with one of the
following:") used to be summarized without its children, and the model
wrote things like "the text does not show what those methods are". The
**parents** checkbox on **Generate summaries** (`summarize.py --parents`)
re-selects every row that already has a summary *and* has at least one
child, and puts the children's text (every descendant, in reading order)
in the prompt under "Provisions inside this one". Subtrees over 3,000
words are shown as an outline (citation + title only) with a note.

It implies **force**, and combines with **reg** and **limit** for pilots.
Every rewritten row goes back to `summary_status = 'pending'` (its previous
summary is kept in `summary_original` unless a reviewer already preserved
one there) and gets a `summary_regenerated` row in `provision_changes`, so
the review queue and /changelog show exactly what changed. A new summary
that still says something is "not stated" / "not specified" / "unclear" is
retried once and, if it still hedges, is **not** written -- the id lands in
`failed.jsonl` with reason `hedging` and the old summary stays in place.

Always dry-run first: the report prints the row count, how many prompts
fell back to outline mode, and the cost estimate.

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
   database, then runs the chained summarize → review → embed run on every
   provision whose letters or digits changed (plus its ancestors) and
   embeds every other changed row. No further click is needed;
   **skip_summaries** is the emergency opt-out and stays unchecked.
7. Read the chained run's report in the job summary (budget, rows still
   pending, corrections) and the spot-check sample pull request it opens.

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
  every `new` row, and every `changed` row whose visible text changed in its
  *letters or digits* (`text_letters_digits_changed`; markup-only changes,
  like a newly-linked cross-reference or a [sic] marker, and whitespace or
  punctuation differences don't need regeneration — the existing summary is
  still accurate and the row keeps its review state).
- `summary_regen_ancestor_ids.txt` — the ancestors of those rows, which the
  chained run regenerates when they have a summary of their own and their
  prompt holds the descendants' text (not outline mode).
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

### Cross-regulation deep links (the corpus id index)

A citation of another regulation's provision ("Regulation Number 7, Part B,
Section I.B.33 and Section II.A.46") used to link only the regulation name, to
the top of that regulation. With the corpus id index each cited section links
to the exact provision: `/regulations/7#sec-7-B-I-B-33` (the reader resolves
the hash on load; the app strips `data-provision-id`, so the hash is what
carries the target). The regulation name itself keeps its top-of-regulation
link, the part ("Part B,") stays plain text unless it is cited alone (then it
links to the part root), and the first section of a list carries the
"Section(s)" keyword in its link text, later ones are bare.

- **The index** is `pipeline/out/corpus_ids.json`: every provision id in the
  database, `{"7": ["sec-7-B-I-B-33", ...], "gp12": [...], ...}`, ids sorted
  bytewise. `python pipeline/import_ccr.py dump-ids` rewrites it from the
  database (read-only; needs `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`,
  pages past PostgREST's 1000-row cap). The **Import regulation** workflow
  runs `dump-ids` before `parse`, so CI imports always resolve against the
  live corpus. The committed copy is only a convenience for local runs; it
  can be verified against the database with
  `select reg_key, count(*), md5(string_agg(id, ',' order by id collate "C")) from provisions group by reg_key`.
- **The definitions index** is `pipeline/out/corpus_definitions.json`,
  written by the same `dump-ids`: `{"7": {"sec-7-B-I-B-34": "Well Production
  Facility", ...}, ...}`, one entry per row whose text opens with a quoted term
  followed by "means" (an optional "(State Only)" first). `parse` uses it to
  verify a deep link whose target is a definition against the phrase the
  citing sentence says is defined ("well production facilities as defined in
  Regulation Number 7, Part B, Section I.B.33"): the term must occur in that
  phrase (case, singular/plural and hyphens tolerated). When it does not --
  the cited regulation was renumbered after the citing document was written
  -- the target's siblings (the same definitions list) are searched, in this
  order, and the search must give exactly one answer or the section stays
  plain text:
    1. the siblings whose term occurs in the phrase (rule `term`); when
       several do, the **nearest-number tie-break** (rule `nearest`): the one
       whose number is closest to the cited number, only if it is within 5
       positions and strictly closer than every other match -- a renumbering
       moves a definition a few places, not across the list ("no visible
       emissions during normal operations, as defined under ... II.A.45"
       links II.A.47 "Visible Emissions", not II.A.27 "Normal Operation");
    2. when none does, the **word-order-tolerant match** (rule `word_order`):
       every significant word of the term occurs in the phrase in the same
       order with other words between them, singular/plural tolerated
       ("natural gas-driven diaphragm pneumatic pumps" holds "Natural
       Gas-Driven Diaphragm Pump"); several such -> the same tie-break
       (`word_order_nearest`).
    3. a cite with no defining phrase ("(Reference: Regulation Number 7,
       Part B, Section II.A.45.)") never gets a sibling guess: the target's
       term must occur somewhere in the paragraph or the section stays plain
       text.
  Every link the sibling search produces is a renumbered link: the printed
  section stays in the text and rides in the href
  (`/regulations/7?cited=I.B.33#sec-7-B-I-B-34`) so the reader's preview can
  say "cites this as Section I.B.33; in the current Regulation 7 it is
  I.B.34". Both outcomes are listed in the diff report, every record:
  `renumbered_cross_reg` (with the rule that chose the link) and
  `definition_mismatch_no_link` (with the siblings that matched and why none
  was chosen). Read both after every import. Without the file every target
  is accepted as cited. `--corpus-definitions PATH` names another file.
- **`parse` uses it by default** when the file exists. `--corpus-ids PATH`
  names another file; `--no-corpus-ids` turns deep links off, and the output
  is then byte-for-byte what it was before the feature existed (so is a
  missing/empty index).
- **Resolution** (`resolve_cross_reg_target`): the candidate id is built from
  the cited regulation, part and section with the CITED regulation's own token
  cycle and id scheme (the general permits and Reg 1 have no part segment;
  parenthesised tokens keep their parentheses). If it does not exist, trailing
  tokens are dropped until an ancestor does (`trimmed`), then the part root
  (`part_root`), then the regulation root (`reg_root`, which gets no link of
  its own: the regulation name already links there). A citation with no part
  named is only resolved when it exists in exactly one part; an ambiguous one
  is not guessed. General-permit conditions ("GP02 Condition II.B.3") resolve
  the same way (no current source text prints one for another permit).
- **Hard rule:** a trailing "and Section II.C." after a cross-regulation cite
  belongs to the cited regulation and is resolved there. It never binds to the
  citing document's own ids (it used to, whenever the same label existed
  locally), and the bare "Regulation 7 Part B, Sections ..." form no longer
  binds its "Part B" locally either. A continuation followed by "of this
  permit/regulation" is still treated as local.
- **Review:** every cross-regulation cite that did not reach the exact
  provision (`trimmed`, `part_root`, `reg_root`, unresolved) is listed in the
  `unresolved_cross_reg` section of the `diff` report with its source
  provision id and the citation as printed.
- **Federal subpart citations** (acceptance item 2, 7 Oct 2026). Every form
  the Colorado documents use to cite the corpus's 40 CFR Part 60 / 63
  subparts links to the corpus document, and to the section when a § number
  is cited and resolves: "40 CFR Part 60, Subpart JJJJ", "40 CFR, Part 63,
  Subpart ZZZZ" (GP12's comma after CFR), "40 C.F.R., Part 63, ...",
  "Part 60 Subpart JJJJ" (no comma), "NSPS OOOOa", "NSPS Subpart IIII",
  "(NSPS) Subpart JJJJ" and "NSPS, Subpart JJJJ" (the "Subpart <code>" span is
  linked), "Subpart ZZZZ of Part 63", a bare "Subpart ZZZZ" / "(Subpart
  OOOOa)" / "Subpart OOOO, OOOOa, or OOOOb" (each code on its own), and
  "§60.4209(a)" / "Section 60.4244" / "60.5386b(c)" / "Sections 63.6600
  through 63.6603" (`CFR_SECTION_RANGES`: the exact paragraph when the index
  has it, else its nearest existing ancestor). The map is PART-AWARE
  (`CFR_PART_SUBPART_TO_REGKEY`, `_subpart_regkey`): 40 CFR Part 63 has its
  own Subparts IIII, JJJJ and OOOO (coating rules), which Regulation 8 Part A
  lists, so "40 C.F.R. Part 63, Subpart IIII" is NOT the engine rule and
  stays plain text (it was linked to it until the re-import after 7 Oct 2026);
  NSPS means Part 60, NESHAP / MACT mean Part 63 ("NESHAP JJJJ" stays text);
  a bare JJJJ / IIII links only when the paragraph shows Part 60 or NSPS, a
  bare ZZZZ / OOOOa / OOOOb / OOOOc always (they occur in one part only).
  "Regulation Number 6, Part A, Subpart IIII" deep-links to Regulation 6's
  own adoption row. Every subpart not in the corpus is counted in the diff
  report's `cfr` bucket and never linked. The original Subpart OOOO is in
  the corpus since 8 Oct 2026 (`oooo`): "NSPS OOOO", "40 CFR Part 60,
  Subpart OOOO", "NSPS Subpart OOOO", "Subpart OOOO, OOOOa, or OOOOb" and a
  bare "§ 60.5365" link to it (`CFR_SECTION_RANGES` holds its 60.5360-60.5433
  range with no suffix; a number with a letter is OOOOa/b/c, and "OOOO" never
  captures the longer codes -- every pattern ends in a word boundary). The
  one care: 40 CFR Part 63 has its own Subpart OOOO (fabric printing, coating
  and dyeing), which Regulation 8 Part A lists, so a bare "Subpart OOOO"
  with no part and no program word links only when the paragraph shows the
  Part 60 context (NSPS, Part 60, a § 60.53xx section or OOOOa/b/c beside
  it) and no Part 63 / NESHAP / MACT context (`OOOO_CONTEXT_RE`,
  `PART_63_CONTEXT_RE`); "40 C.F.R. Part 63, Subpart OOOO" stays plain text.
  `pipeline/link_change_report.py` has a "Federal subpart links" table (per
  regulation: document and section links old -> new, skipped, unresolved);
  the 7 Oct 2026 run is `pipeline/out/acceptance_federal_subpart_links.md`.
- **Preview a re-import's link changes** without touching the database:
  `python pipeline/link_change_report.py --old-dir <dir of parses made by the
  old code> --out pipeline/out/sprint2_link_changes.md` (the importer has no
  link-only mode; this compares old and new parses of the same sources).

### Official text, EssentialRegs notes and the text checks (Sprint 3, Oct 2026)

The official text is never altered. Three curated files and two checks keep
that true while fixing what text extraction gets wrong:

- **`pipeline/curated_equations.json`** — hand transcriptions of the equations
  the GP PDFs set in Cambria Math (pdftotext renders them as doubled
  math-italic glyphs). Keyed by provision id; each entry names the PDF page
  and holds, per equation, display markup (`html`, plain HTML: span/var/sub/
  sup with stacked fractions) and the same formula as copyable plain text
  (`text`). `parse` swaps a row's math-glyph lines for the block
  (`_swap_equation_lines`); a row with glyph lines and no entry is listed as
  an anomaly in the diff report, and an entry that matched no glyph line
  reports 0 hits. Today: GP12 III.F.3 and IV.A.6.b (one equation each),
  GP06 IV.C.1.b.(i) and (ii) (Eq. 1.a-1.e, 2.a-2.e). Every transcription was
  checked against the page image and the glyph letter counts; typos printed
  in the source (`FuelRrate`, `hhr`) are kept and carry a [sic] marker.
- **`pipeline/curated_sic.json`** — typos printed in the official document.
  The text stays exactly as printed; `parse` adds
  `<span class="er-sic" title="Printed this way in the official document."> [sic]</span>`
  after the printed string (`apply_sic_markers`; hits must equal `expect`,
  default 1). The diff and apply steps treat the span as markup (`_visible_text`,
  `_norm_for_compare`), so adding a marker never resets a summary. Only plain
  typos belong here, never unusual wording.
- **`KNOWN_SPACING_FIXES`** (in `import_ccr.py`) — pdftotext renders
  letter-spaced justified text one glyph per word ("t h e f o l l o w i n g").
  Each entry re-spaces one printed run; `apply_known_text_fixes` refuses an
  entry whose letters and digits would change (`spacing_only`), so a fix can
  only move whitespace. The same table carries two whitespace-only label
  repairs (GP12 VI.E.5.i re-indented, GP05 VIII.C.1.a unfused).
- **General-permit tables** — the caption walk now follows a table onto the
  page(s) that reprint its header without its caption, reads a caption whose
  table starts on the next page, assigns two captions on one page in order,
  keeps the footnotes printed under a table (`p.table-footnote`) and the prose
  that follows it in the same row, shows a caption's wrapped last line, and
  re-reads a cell whose subscript or superscript pdfplumber split onto its own
  line ("NO (g/hp-hr)\nX" -> `NO<sub>X</sub> (g/hp-hr)`). All of it is logged
  in the diff report's corrections table. Scoped to the general permits
  (`GP_KEYS` / `SUBSCRIPT_REJOIN_REGS`) so no other regulation's baselined
  output moves; the table-continuation rule runs for every regulation (it
  changed nothing outside the GPs on 4 Oct 2026).
- **`python pipeline/source_text_check.py --all-gp --parsed-dir pipeline/out --out pipeline/out/sprint3_source_text_check.md`**
  — the extraction diff check: each general permit's stored text against the
  body of its pdftotext source, word by word, letters and digits only.
  Spacing differences and table cell order are free; anything else is an
  extraction difference, known (listed in `KNOWN_DIFFERENCES` with a reason)
  or unknown (exit 1). `test_sprint3_text.py` runs it on every GP. Pass
  `--db-json` to check the live rows (`import_ccr.py export`) instead of a
  parse.
- **`text_artifacts()`** / corpus QA checks 22-24 (`scripts/corpus_qa.sql`) —
  math glyphs, split-letter runs and stray Markdown in official text must be
  zero, at parse time (an anomaly in the diff report, a failing GP test) and
  in the database (the qa job).

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

# Automated AI review pass (`review.py`)

Every summary on the site carries a badge: **"AI reviewed · <date>"** when its
`summary_status` is `approved` or `edited`, **"AI-generated · not yet
reviewed"** while it is `pending`. "AI reviewed" never claims human review
(owner decision, 4 Oct 2026): it means a separate automated review checked the
summary against the official text and corrected what was wrong. Until October
2026 that second pass was done by hand in chat sessions; `pipeline/review.py`
is the repeatable version, and the **Review pending summaries** workflow
(`.github/workflows/review.yml`) is how it runs.

**Where it runs.** Since 6 Oct 2026 the review runs inside the chained run
(`run_chain.py`: the Generate summaries and Import workflows) on exactly the
rows that run wrote; the **Review pending summaries** workflow is for
re-reviews, audits, redo runs, resuming and the writer proof. It is the only
code path that makes a summary `approved` or `edited` (database trigger
`provisions_summary_approval_only_by_pipeline`).

**What it selects.** Rows that have a summary and `summary_status = 'pending'`,
nothing else (the one exception is **re-review mode**, below, which selects
the hand-approved rows instead). Approved, edited and rejected rows are excluded by the query and
every write re-checks the status. Three things put a row back to pending: the
summarizer (every write is pending), the importer (`import_ccr.py apply`),
which resets a summary to `pending` and clears `reviewed_by`/`reviewed_at`
whenever a provision's letters or digits change (see "Re-importing a
regulation" above), and the admin page's "send back to pending".

**What the reviewer sees.** The official text of the provision and all of its
descendants, assembled by `summarize.build_prompt()` itself -- the same
regulation line, the same "Text above this provision" ancestor block, the
same `MAX_PROMPT_WORDS` (16,000 since 6 Oct 2026, so every row in the corpus
is seen whole) and `CHILD_TEXT_WORDS` outline fallback the summarizer uses,
so the two cannot drift -- followed by the current summary. The official text
is the only source of truth; the reviewer gets no regulation hints and no
other context (`test_review.py` checks the text block is byte-identical to the
summarizer's prompt).

**Verdicts** (structured JSON, `output_config.format`; anything malformed is a
fail, see `validate_verdict`):

| verdict | meaning | write (with `execute`) |
|---|---|---|
| `pass` | every statement supported; every number, date, threshold, citation and unit matches; nothing asserted to be absent; no advice beyond the text. Style-only rewrites are not corrections. | `summary_status='approved'`, `reviewed_at=now`, `reviewed_by='Claude (AI second-pass review, automated pipeline, <model>, <YYYY-MM-DD>)'`, a `provision_changes` row `summary_approved` |
| `corrected` | specific errors or omissions that change meaning; the reviewer returns a corrected summary that changes only what is needed, with a one-line reason per change | prior text kept in `summary_original` (an existing value is never overwritten), corrected text written, `summary_status='approved'`, `reviewed_by='Claude (AI second-pass review; summary corrected, automated pipeline, <model>, <YYYY-MM-DD>)'`, a `summary_edited` row whose note is the reasons |
| `fail` | not fixable with small edits, or the text is too truncated/outlined to verify; also every malformed answer, a cut-off answer, a "pass" on a hedging summary of a provision with descendants, a correction that still hedges or rewrites the summary | nothing; the row stays pending and is listed in the report |

Both `reviewed_by` forms start with `Claude (`, which corpus QA check 21
(`approved_without_ai_review`) requires on every approved or edited row. The
public changelog shows counts only (`changelog_public()` returns no notes or
ids), so the reasons in `provision_changes.note` stay private.

**Running it.** Actions tab -> **Review pending summaries** -> Run workflow:

- **reg** / **ids** / **limit** scope the run (the ids are still filtered to
  pending rows). **reg** also takes a comma-separated list
  (`gp01,gp02,...`), reviewed in that order.
- **model** -- the reviewer. It is always a separate call from the one that
  wrote the summary. Default `claude-sonnet-5-5`: a different and stronger
  model than the Sonnet 4.5 that wrote the pending summaries, and cheaper per
  token at batch rates ($1 in / $5 out per million) than Sonnet 4.5 ($1.50 /
  $7.50) even after its tokenizer's ~30% larger counts. The dry run also quotes
  `claude-sonnet-4-5` (the summarizer's own model) and `claude-opus-5-5`
  ($2 / $10). Prices: platform.claude.com/docs/en/about-claude/pricing, Batch
  processing table (the Batches API is 50% off both rates).
- **effort** -- thinking depth for 5.x models (`low` by default; temperature is
  not a parameter there). Sonnet 4.5 runs at temperature 0.
- **max_cost** -- a cap on the whole run: the run refuses to submit when the
  pre-submit estimate exceeds it, and cancels the remaining batches once actual
  spend passes it. Since 5 Oct 2026 the pre-submit estimate assumes the cached
  system prompt is read from the cache on every row but the first (the log
  also prints the no-cache ceiling); measured runs sit near that floor (81% of
  input tokens were cache reads in stage 1), and the actual-spend cap is the
  guard during the run. The standing **$10 per regulation per run** budget
  (`budget.py`) applies as well, always; **approved_budget** replaces it for
  one run and is printed at the top of the report.
- **audit_population** -- with audit_sample: `hand` (reviewed_by without
  "automated pipeline", the original audit), `pipeline` (AI-reviewed rows: the
  monthly audit) or `all`.
- **writer_proof** -- `quote` or `execute`: the writer proof instead of a
  review (`writer_proof.py`): the provisions the reviewer corrected in October
  regenerated with the old and the new writer instructions and scored by the
  reviewer, nothing written; `proof_groups`, `proof_seed`, `proof_arms` scope
  it and `max_cost` (default $3) caps it.
- **execute** unchecked = **dry run**: no paid call, no write. It prints the
  row count by regulation, the input tokens (counted with the free
  `messages.count_tokens` endpoint when the API key is present, a character
  estimate otherwise -- the report says which), the expected output tokens,
  the batch price for each model option and how many rows exceed the
  truncation limit. Always dry-run first.

Every run writes `pipeline/out/review_report.md` and `.json` (uploaded as the
**review-report** artifact and printed to the job summary): counts by verdict
and regulation, every corrected row with before / after / reasons, every
failed row with its reason, token usage and the actual cost, and the model,
sampling and prompt version used. Rows the reviewer failed, API errors and
batch timeouts are also logged to `pipeline/review_failed.jsonl`.

**Stray Markdown** (owner instruction, 5 Oct 2026). The site shows a summary
as plain text, so `**bold**`, `__bold__`, backticks or a leading `#` / list
marker in a summary is an error. When that is the only problem the reviewer
returns `corrected` with the markers removed and nothing else changed (one
change, reason "stray Markdown markers removed"); a `pass` on a summary that
still carries markers is not approved (it fails and is retried). Since 6 Oct
2026 a correction labelled Markdown-only that also changed wording is accepted
as an ordinary correction under the ordinary limits (growth cap, no markdown,
whole answer), with the wording change recorded as a change of its own -- the
old "changed more than the markers" fail kept three rows pending for a label.
A lone `*` (footnote marker) and runs of underscores (form blanks, names) are
not Markdown.

**Prompt version 4: correct expansions and standard names stay** (6 Oct 2026,
ReviewBuiltIn item 8c). About 2% of the October corrections removed a correct
expansion because the provision itself did not define it ("Comprehensive Area
Plan" turned back into "CAP" on sec-ecmc-309-e-(6)-A although Rule 314 is
titled Comprehensive Area Plans; "Title V operating permit" removed on
sec-oooob-60.5360b-(c) although 40 CFR parts 70 and 71 are the Title V
permit programs). The reviewer now keeps an expansion or standard name that
is correct and is defined elsewhere in the same regulation or is the ordinary
name of the cited program, and removes it only if it is wrong; the validator
also treats an expansion turned back into its acronym for an acronym reason
as allowance 1 (pass). Both rows are fixtures in `test_review.py`. Applies to
new reviews only; the corpus was not re-run for it.

**Audit mode** (`--audit N`, workflow input **audit_sample**) runs the same
reviewer, same prompt and same validation over a seeded random sample of N
summaries that are already approved or edited and whose `reviewed_by` does not
contain "automated pipeline" (the hand passes from before this step existed),
spread across regulations: one per regulation, the rest in proportion to size
(`allocate_sample`). It writes **nothing** to the database, only the report,
whose "Rows the reviewer would correct (NOT changed)" section lists each such
row's id, current summary, the reviewer's text and reasons. `--seed` makes the
sample repeatable; `max_cost` applies as usual. Without `execute` it is a cost
quote.

**Paragraphs.** A summary may have several paragraphs (the reader shows a
blank line as a paragraph break). A correction keeps them: whitespace is
normalized inside each paragraph and the blank lines between paragraphs are
kept; Markdown is still rejected.

**Prompt version 2: three plain-English allowances** (owner instruction, 5 Oct
2026, after the 200-row audit). The audit's 82 would-corrects were about a
third real errors and mostly strictness that made a summary worse without
making it more accurate, plus one would-be correction that was itself wrong.
The reviewer keeps every strict rule (numbers, dates, thresholds, citations,
scope, parties, conditions and exceptions must match the text; nothing may be
asserted that the text does not say; style-only rewrites are a pass) and gets
exactly three allowances:

1. *Acronyms and agency names.* A correct expansion of an acronym or short name
   the text uses is not an error and must not be removed or abbreviated
   ("volatile organic compounds (VOC)", "maximum allowable operating pressure
   (MAOP)", "Colorado Parks and Wildlife (CPW)"), whether the text uses the
   acronym, the full term or both. It is an error only if the expansion is
   wrong or contradicts the text. The validator backs this up: a `corrected`
   whose every change only removes words for an abbreviation/expansion reason
   (`_is_acronym_pairing_removal`) is treated as `pass` -- the reviewer found
   nothing else wrong. A reason that says the expansion is *wrong*, or a change
   that adds or substitutes words, is a real correction and goes through.
2. *Illustrative examples.* An example clearly marked as one ("like", "such
   as", "for example") is not an error when it is consistent with the text and
   does not narrow or widen the provision's scope. It is an error when the
   text gives its own list and the example is not on it, or when the example
   changes scope. "Including X" correctly renders "including, but not limited
   to, X"; wording that claims completeness ("specifically", "namely") where
   the text says the list is not exhaustive is still an error.
3. *Source typos.* The reviewer never changes a summary to reproduce an evident
   typo in the official text ("trionyl chloride" for thionyl chloride); the
   summary uses the correct word.

Three clarifications ride with them: the regulation and parent lines and the
parent paragraph are part of the text the reviewer is given, so a summary may
say where the provision sits and connect it to that context (a requirement
under "Rule 304 -- Form 2A ... Application" is part of the Form 2A
application); a summary of one item in a list of conditions need not repeat the
other items, and "if" / "when" / "only when" is not a claim that the condition
is sufficient by itself; and spelling out the direct effect of what the text
says ("considered as sulfur dioxide" means the sulfur dioxide requirements
apply) is paraphrase, not an addition. The old sentence "an acronym the text
only abbreviates may not be expanded" is gone (it contradicted allowance 1).
The prompt version (sha1 of prompt + schema, printed in every report) changed
from `4c41cd5622` (version 1, PRs #52-#56) to the value
`review.REVIEW_PROMPT_VERSION` prints (`9ace8f1496` at merge). Proof on the
same 200-row audit sample (seed 20261005): see `docs/CEO_PHASE_PLAN.md`.

`--audit-ids a,b,c` (workflow input **audit_ids**) is audit mode on exact
approved/edited ids, whatever their `reviewed_by`: read-only, report only. It
is how a prompt change is re-checked on the specific rows it was meant to move
without paying for the whole sample again.

**Context above the provision -- prompt version 3** (owner instruction, 5 Oct
2026, after the Cowork spot-check of the stage-1 re-review). The summarizer
shows one parent excerpt of `PARENT_TEXT_CHARS` (400), silently cut with an
ellipsis, and the reviewer used to get the same. In nested lists the duty sits
two levels up ("A revised APEN must be filed:" / "Annually by April 30 ... as
follows:" / the threshold), and a reviewer that reads the cut as silence
removes true statements: 9 of the 18 stage-1 rows under a "revised APEN must
be filed" grandparent lost "file a revised APEN", and `sec-gp07-II-B-1-b` lost
"on request" because those words sit past character 400 of its parent. The
reviewer now gets, in place of the parent excerpt, **the own text of every
ancestor from the root down to the parent**, root first, each labelled with
its id (`build_ancestor_block`, block heading "Text above this provision"):
up to `ANCESTOR_EXCERPT_CHARS` (1,500) per ancestor and `ANCESTOR_BLOCK_CHARS`
(6,000) in all; over the total, the farthest ancestors are shrunk to 200
characters and then dropped, first -- never the parent. Every cut is honest:
at a sentence end where one lies past 60% of the limit, else at a word
boundary, and always ending in `[excerpt cut]` (`honest_cut`). The summarizer's
own prompt is unchanged (`summarize.build_prompt(context_block=...)` is only
passed by the reviewer); the summary writer's context is a later task. Three
reviewer rules go with it: a statement supported by any ancestor shown is
supported; where an excerpt is marked cut, a statement is changed only if the
visible text contradicts it, never because the visible text lacks it; and a
correction must not replace a specific, supported duty with a vaguer one. The
block costs about 300-600 more input tokens per row (the dry run states the
new per-row figure).

**Snapshot text as the input.** `--audit-ids a,b --from-snapshot` reviews the
BEFORE summary from `archive.summary_review_snapshot_rereview` instead of the
live one (read-only; RPC `rereview_snapshot_text`). `--redo-corrections-since
<timestamp>` (workflow input **redo_corrections_since**; `--redo-until` /
**redo_until** bounds it from above so a redo can be resumed without
re-selecting the rows it already re-corrected) selects every snapshotted row
the pipeline corrected in that window (RPC `rereview_corrected_between`,
paged -- PostgREST caps one call at 1,000 rows, which left 247 of 1,247 rows
out of the first redo run) and reviews its BEFORE summary again with the new
context; on execute, `pass` restores the before text with a pass stamp (the
earlier correction is withdrawn; one `summary_edited` row), `corrected` writes
the new text (a `summary_edited` row only when it differs from the live text;
otherwise `corrected_same`, stamp refreshed), `fail` sets the row to pending
with the live text untouched. The snapshot's before text is never written.
Both RPCs: migration `20261005051611_rereview_snapshot_readers.sql`, service
role only.

**Prompt caching** (owner approval, 5 Oct 2026). The system prompt (~2,500
tokens, the same for every row) goes out as one cached block with a 1-hour
TTL (`cache_control: {type: ephemeral, ttl: 1h}`, `SYSTEM_CACHE_TTL`); the
per-row text is not cached. Within a batch most rows then read it from the
cache: a 1-hour cache write bills 2x the input rate, a read 0.1x, both halved
by the batch discount (`estimate_cost`). Hits inside a concurrent batch are
best-effort, so every report and run summary states the measured figures:
uncached input, cache writes, cache reads and the **share of all input served
from the cache** (`usage.cache_read_share`; also in `review_summary.py`), and
the spend cap counts cached tokens at their rates. The dry run quotes two
figures per model: no cache hits (the ceiling) and full cache hits (one write,
a read on every other row).

**Re-review mode** (`--rereview`, workflow input **rereview**) selects the
*other* population: rows that are already `approved` or `edited`, have a
summary, and whose `reviewed_by` does not contain "automated pipeline" -- the
16,467 summaries the September hand passes approved (the same predicate as
audit mode, `is_rereview_row`). Same text, same prompt, same validation;
`reg`, `ids` and `limit` work as usual (so the general permits and Regulations
3 and 7 can go first). The writes differ, and each is guarded by
`summary_status in ('approved','edited')` at write time:

| verdict | write in `--rereview` |
|---|---|
| `pass` | `reviewed_by` = the pipeline stamp, `reviewed_at` = now; status and text unchanged; **no** `provision_changes` row (the summary did not change) |
| `corrected` | exactly as in the normal mode: prior text to `summary_original` (never overwriting one), corrected text, `summary_status='approved'`, corrected stamp, a `summary_edited` row |
| `fail` | `summary_status = 'pending'`; summary text, `summary_original`, `reviewed_by` untouched; listed in the report (`set_pending: true`). The row shows "not yet reviewed" until the normal pending review or a regeneration picks it up |

Because a pass or correction stamps the row and a fail makes it pending, every
row is selected by `--rereview` once; a second run finds only API-error rows.
**Snapshot first**: before the first write of an execute run, every selected
row's `ai_summary`, `summary_original`, `summary_status`, `reviewed_by`,
`reviewed_at` and `summary_model` are copied into
`archive.summary_review_snapshot_rereview` through the service-role RPC
`snapshot_summaries_for_rereview(ids, run_label)` (migration
`20261005023100_summary_rereview_snapshot.sql`; the `archive` schema is not
exposed through PostgREST, so the copy is made server side). A row already in
the snapshot is not overwritten (`on conflict do nothing`), so the table holds
the text as it stood before the first re-review touched the row -- the same
safety net `archive.summary_review_snapshot_20261005` gave the 5 Oct run. An
RPC error aborts the run before any write. A dry run makes no snapshot call.
`--rereview` and `--audit` are different selections and cannot be combined.

```
python pipeline/review.py --rereview --dry-run                        # count by regulation, exact cost
python pipeline/review.py --rereview --reg gp01,gp02,gp03,gp05,gp06,gp07,gp08,gp09,gp10,gp11,gp12,3,7 --execute --max-cost 10
python pipeline/review.py --rereview --execute --max-cost 40          # the rest
```

**Reading a run.** On a large run the job log is longer than the GitHub API
returns (it keeps the end), so the last step prints a compact summary from
`out/review_report.json` (`pipeline/review_summary.py`): counts, actual cost,
the table by regulation and every failed row. The **Review report summary**
workflow (input `run_id`, optional `ids`) prints the same summary for any past
run from its review-report artifact, plus the before / after / reasons of the
listed corrected rows. Read only.

**Resumability** is the summarizer's: approved rows drop out of the
selection, so running again picks up exactly what the last run did not
finish. A run that submitted batches but hit the 6-hour poll ceiling names
the batch ids in its log; `--resume-batch <id>[,<id>...]` (workflow input
**resume_batch**, combined with the same selection inputs as the original
run) consumes those results without submitting (and paying) again. The same
path recovers a run whose writer died mid-batch: the stage 2b re-review
(6 Oct 2026, 11,917 rows) lost its database connection after 10,000 requests
on one HTTP/2 connection (`httpx.RemoteProtocolError: ConnectionTerminated`)
while writing batch 8 of 12; the resume run finished the remaining 4,520 rows
from the already-paid batches. Since 6 Oct 2026 the write loop reconnects by
itself (`dbclient.py`, tested with a mocked dropped connection), and the
chained run has the same resume (`resume_batches`). After a standalone run
with corrections, re-embed the corrected rows (**Embed provisions**, `reg`
scoped); the chained run embeds what it wrote.

Locally:

```
python pipeline/review.py --dry-run                    # quote for everything pending
python pipeline/review.py --dry-run --reg gp12 --show 2
python pipeline/review.py --reg gp12 --limit 15 --execute
python pipeline/review.py --ids sec-7-B-I-B-7 --execute
python3 -m pytest -q pipeline/test_review.py           # stub clients, no network
```

# Semantic embeddings (`embed.py`)

`pipeline/embed.py` turns every provision into a Voyage AI embedding
(`voyage-3.5-lite`, 1024 dims) stored in `provision_embeddings`, then
rebuilds `provision_neighbors` (the "Related provisions" panel) through the
`recompute_provision_neighbors` SQL function. Both tables and the
`match_provisions` search RPC come from `supabase/migrations/005_embeddings.sql`
and `006_neighbors_rpc.sql`.

What goes into each embedding: `<Colorado|Federal> regulation <key>: citation — title`,
the first 300 characters of the immediate parent paragraph, the first 600
characters of the row's `ai_summary` cut back to a sentence boundary (unless
its `summary_status` is `rejected`), and the tag-stripped `full_text`. Rows
over 6,000 characters are split into overlapping chunks (~1,500 tokens, 150
overlap); chunk 0 always carries the capped summary. A row whose summary runs
past the cap gets one more chunk, after the text chunks, holding only the
citation/title line and the full summary. Each chunk is content-hashed with
the model name, so a re-run only re-embeds rows whose text or embedded
summary changed (or everything, with `--force`).

The tag stripping that produces the embedded text unwraps the importer's
link markup in place (`<a class="xref-external-reg">`, `<span class="xref">`,
the `[sic]` marker span: tags removed, inner text kept, no space added) and
turns every other tag into a space. Until 7 Oct 2026 every tag became a
space, so a markup-only re-import (a citation newly wrapped in an anchor
flush against punctuation) changed the stripped text, the hash with it, and
the row was re-embedded for a change no reader could see (22 provisions
across seven regulations after PR #69). A link-only import now makes no
Voyage call. The stored hashes written under the old rule were rewritten in
place by `embed.py --rehash` (the **Embed provisions** workflow's `rehash`
input) through `provision_embeddings_rehash()` (migration
`20261007040000`): it proves a stored hash is the old rule's hash of the
current text before touching it, writes nothing else, and reports any chunk
matching neither rule as stale for a normal embed run. `--rehash --dry-run`
only counts.

The 600-character summary cap (`SUMMARY_EMBED_CHARS`, `cap_summary`) dates
from the Phase 0 parent regeneration (Oct 2026): parent summaries written
with the children in view run to 1,000-3,000 characters, and embedding the
whole gloss in chunk 0 drowned the row's own citation, title and text, so
the OOOOb storage-vessel sections fell out of Ask's top 10. The cut falls at
the last sentence end before 600; a summary with no sentence end in that
window (ECMC 912.b.(1) is one 1,138-character list of spill triggers) is cut
at the last `; ` or `: `, and failing that at a word break, never mid-word.
The separate full-summary chunk is what keeps a question aimed at the
summary's later clauses (a produced-water spill) finding the row: Ask's
hybrid RPC scores a provision by its best chunk, while `provision_neighbors`
is built from chunk 0 only, so the extra chunk changes search and not the
"Related provisions" panel. The reader still shows the whole summary.

Secrets: `VOYAGE_API_KEY` (GitHub Actions secret and Vercel env var), plus the
existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Never commit the key.

## Running it

**Embed provisions** workflow (Actions tab), inputs: `reg`, `limit`, `dry_run`,
`force`, `neighbors_only`, `start_after`, `rehash`. Always dry-run first — it prints the chunk count,
token estimate and cost, and calls nothing:

```
python pipeline/embed.py --dry-run --show 3      # whole corpus estimate
python pipeline/embed.py --reg 7                 # embed Reg 7 (changed rows only)
python pipeline/embed.py                         # whole corpus, resumable
python pipeline/embed.py --neighbors-only        # rebuild related panel, no API calls
python pipeline/embed.py --neighbors-only --start-after sec-gp09-IX-B   # resume a rebuild that died
python pipeline/embed.py --rehash --dry-run      # count stored hashes still on the pre-7-Oct strip rule
python pipeline/embed.py --rehash                # rewrite them in place, no Voyage call
```

The **Import regulation** workflow has an `embed` checkbox that runs
`embed.py --reg <reg>` after a successful execute (and after summaries, if
`regenerate_summaries` is also checked), so new regulations are searchable
without a separate step. Note that `--reg` runs only recompute neighbours for
the rows they touched; run `--neighbors-only` once afterwards if you want
older rows to be able to point at the newly added ones.

The neighbour rebuild sizes its RPC batches adaptively: a statement timeout
(57014) halves the batch and retries the same ids; after a run of clean
batches it doubles back up. Progress lines print `last=<id>`; if a run still
fails, rerun with `start_after` set to that id (the error message spells out
the exact flag) and it skips everything already done.

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

## The reader's version note (`source_dates.py`)

When a document is older than the current text of a regulation it links
into, the reader's cross-regulation preview says so under the title: "GP12
cites Regulation 7 as effective 06/14/2025; shown is the current text,
effective 07/15/2026. Numbering may differ." (the printed date comes from
the "(Adopted ..., Effective ...)" parenthetical the citing provision itself
prints; without one: "GP01 was issued 07/23/2025; shown is the current
Regulation 7, effective 07/15/2026. Numbering may differ."). A document of
the same age or newer gets no note (Regulation 3 and Regulation 7 are both
effective 07/15/2026). The dates are never typed in `src/`: `python
pipeline/source_dates.py` writes `src/lib/source-dates.generated.ts` from
`pipeline/sources/manifest.json` (SOS rules: `effective_date`; eCFR:
`as_of`; general permits: each permit's `date`), `freshness.py
--update-manifest KEY` runs it after rewriting the manifest, and
`scripts/source-dates.test.ts` (plus `pipeline/test_source_dates.py`) fails
whenever the generated file and the manifest disagree. So the procedure
after a re-import is unchanged -- update the manifest entry, commit -- and
the reader's dates follow in the same commit.

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
   docid) back into `manifest.json`, and rewrites
   `src/lib/source-dates.generated.ts` (the reader's version-note dates, see
   `source_dates.py`) to match. A general permit's issuance `date` is not on
   the CDPHE page: set it by hand in the manifest's `permits` entry, then run
   `python pipeline/source_dates.py`.
4. Commit the updated `manifest.json` and `source-dates.generated.ts`
   together (`npm test` fails when they disagree). The next scheduled run will see the
   new value as "ours" and close back out to ✅ — close the GitHub issue by
   hand once you've confirmed that.

### Running it locally / testing

```
python pipeline/freshness.py check                    # live check, needs network access to the source sites
python pipeline/freshness.py check --fixtures DIR      # check against saved HTML/JSON fixtures instead (no network)
python pipeline/freshness.py --update-manifest 3       # record source "3"'s current upstream version
python3 -m pytest -q pipeline/test_freshness.py        # run the test suite (all fixture-based, no network)
```
