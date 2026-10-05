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
   provision text, marked "AI-generated · not yet reviewed" until the
   automated review pass below (`review.py`) has checked it.
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

**What it selects.** Rows that have a summary and `summary_status = 'pending'`,
nothing else. Approved, edited and rejected rows are excluded by the query and
every write re-checks the status, so a row an admin approved meanwhile is left
alone. Two things put a row back to pending: the parent regeneration
(`summarize.py --parents`, Phase 0) and the importer (`import_ccr.py apply`),
which resets a summary to `pending` and clears `reviewed_by`/`reviewed_at`
whenever a provision's *visible* text changes (see "Re-importing a regulation"
above). This step is what reviews those rows again -- after a re-import with
`regenerate_summaries`, run **Review pending summaries** for that `reg`.

**What the reviewer sees.** The official text of the provision and all of its
descendants, assembled by `summarize.build_prompt()` itself -- the same
regulation/parent lines, parent-paragraph excerpt, `MAX_PROMPT_WORDS`
truncation and `CHILD_TEXT_WORDS` outline fallback the summarizer uses, so the
two cannot drift -- followed by the current summary. The official text is the
only source of truth; the reviewer gets no regulation hints and no other
context (`test_review.py` checks the text block is byte-identical to the
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
- **max_cost** -- a spend cap: the run refuses to submit above this estimate
  and cancels the remaining batches once actual spend passes it.
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
change, reason "stray Markdown markers removed"); the validator checks that a
Markdown-only correction is exactly the current summary without its markers,
and a `pass` on a summary that still carries markers is not approved (it fails
and is retried). A lone `*` (footnote marker) and runs of underscores (form
blanks, names) are not Markdown.

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

**Resumability** is the summarizer's: approved rows drop out of the
selection, so running again picks up exactly what the last run did not
finish. A run that submitted batches but hit the 6-hour poll ceiling names
the batch ids in its log; `--resume-batch <id>` consumes those results
without submitting (and paying) again. After a run with corrections, re-embed
the corrected rows (**Embed provisions**, `reg` scoped) so Ask and the related
panel see the new text.

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
`force`, `neighbors_only`, `start_after`. Always dry-run first — it prints the chunk count,
token estimate and cost, and calls nothing:

```
python pipeline/embed.py --dry-run --show 3      # whole corpus estimate
python pipeline/embed.py --reg 7                 # embed Reg 7 (changed rows only)
python pipeline/embed.py                         # whole corpus, resumable
python pipeline/embed.py --neighbors-only        # rebuild related panel, no API calls
python pipeline/embed.py --neighbors-only --start-after sec-gp09-IX-B   # resume a rebuild that died
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
