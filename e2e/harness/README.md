# Production-build test harness

Runs the Playwright specs in `e2e/` against a real production build of the app
(`next build` + `next start`) with a local stand-in for Supabase, on a machine
that can reach neither Supabase nor the live site.

```
bash e2e/harness/run.sh                      # fixtures, mock Supabase, next build, next start; prints BASE_URL
BASE_URL=http://127.0.0.1:3100 npx playwright test e2e/smoke-tour.spec.ts
```

Everything the specs touch is the app as built: `src/` is not stubbed, patched
or read by the harness. Only the database on the other side of
`NEXT_PUBLIC_SUPABASE_URL` is fake.

## Running it

| Command | What it does |
| --- | --- |
| `bash e2e/harness/run.sh` | Build fixtures if missing, start the mock (:54321), `next build`, `next start` (:3100), print `BASE_URL`, stay in the foreground (Ctrl-C stops both). |
| `bash e2e/harness/run.sh --detach` | The same, returns once the app answers. Stop with `--stop`. |
| `bash e2e/harness/run.sh --skip-build` | Serve the existing `.next` (the data must be the data it was built with: prerendering reads the mock). |
| `bash e2e/harness/run.sh --test e2e/smoke-tour.spec.ts` | Build, serve, run `playwright test <args>` with the right env, stop, exit with Playwright's code. |
| `bash e2e/harness/run.sh --gp05 F --reg7 F --overlay F --docs-dir D [--only 7,gp05]` | Regenerate the fixtures from these files first (any subset of the options). |
| `node e2e/harness/selftest.mjs` | Checks the harness itself (RLS, PostgREST and GoTrue behaviour, three requests through the app). Run it after changing the mock. |

Then, from another shell:

```
export PLAYWRIGHT_BROWSERS_PATH="$(bash e2e/harness/pw-browsers.sh)"    # see "Playwright's browser" below
BASE_URL=http://127.0.0.1:3100 npx playwright test e2e/smoke-tour.spec.ts
BASE_URL=http://127.0.0.1:3100 npx playwright test e2e/smoke-anonymous.spec.ts --grep "GP05|Regulation 7|preview|search|regs|api"
SMOKE_EMAIL=harness-subscriber@essentialregs.test SMOKE_PASSWORD=harness-password-1 \
  BASE_URL=http://127.0.0.1:3100 npx playwright test e2e/smoke-signed-in.spec.ts:87
```

Environment (all optional): `HARNESS_APP_PORT` (3100), `HARNESS_MOCK_PORT`
(54321), `HARNESS_FIXTURE_ARGS`, `HARNESS_REBUILD_FIXTURES=1`,
`HARNESS_FONTS=auto|mock|network`, `HARNESS_EMAIL` / `HARNESS_PASSWORD` (the
subscriber; set before the fixtures are built). Logs and generated data are in
`e2e/harness/generated/` (git-ignored): `db.json`, `mock.log`, `app.log`,
`build.log`, `unhandled.log`.

Prerequisites: Node 22, Python 3, a **real** `node_modules` (see below),
Chromium for Playwright. Nothing is downloaded except what `next build` itself
fetches (Google Fonts, unless it cannot; see below).

### What `run.sh` sets

`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` (two signed JWTs the mock tells apart by their
`role` claim; `node e2e/harness/mock-supabase.mjs --print-env` prints them),
`NEXT_PUBLIC_SITE_URL=$BASE_URL`, dummy `STRIPE_*` values (the specs never reach
Stripe) and `NEXT_TELEMETRY_DISABLED=1`. A `.env.local` cannot override them:
process environment wins over `.env` files.

## What the mock emulates

`mock-supabase.mjs` is one file, no dependencies. It serves the subset of
PostgREST and GoTrue that the app uses (found by reading every `.from()`,
`.rpc()` and `auth.*` call in `src/`), from `generated/db.json`, in memory.

**PostgREST** (`/rest/v1/<table>`)
- `select` with column lists, `*`, aliases, and resource embedding with a
  foreign-key hint (`neighbor:provisions!provision_neighbors_neighbor_id_fkey(...)`,
  `cross_references!cross_references_from_provision_id_fkey(...)`, `!inner`);
  the computed column `provisions.context_path` (= `provision_path(id)`).
- Filters `eq neq gt gte lt lte like ilike in is`, `not.<op>`, `or=(...)`, `and=(...)`
  nested; quoted `in.(...)` values with parentheses (ids like `sec-7-B-I-D-3-a-(i)`).
- `order` (multi-column, `nullsfirst/last`), `limit`, `offset`, `Range`, the 1000-row
  response cap of hosted Supabase (the app paginates for it).
- `Prefer: count=exact` with `GET` and `HEAD` and a `Content-Range`;
  `Accept: application/vnd.pgrst.object+json` (one object, or `406 PGRST116`).
- `POST` inserts (`tour_events`, `search_queries`; the `tour_events` check
  constraints are enforced, `step` 0-9 as migration 20261013034619 has it: the
  walkthrough's introduction and nine steps), service-role `PATCH` / `DELETE`.
- Unknown columns, tables, relationships and operators are honest PostgREST-shaped
  errors, not silent empties.

**Row-level security**, per request, from the JWT in `Authorization` (a user's access
token, or the anon / service key supabase-js sends as the bearer), else `apikey`:

| caller | `provisions` | `provision_neighbors` | `cross_references` | `profiles` | other tables |
| --- | --- | --- | --- | --- | --- |
| anon key; or signed in without access | rows with `is_public = true` | only when both ends are public | only when both ends are public | anon: 403; signed-in: own row | `provision_method_citations` readable; `tour_events` insert only; the rest 403 |
| subscriber (`access_granted`, or `subscription_status` active / trialing) | every row of a released document | both ends released | all | own row | as above |
| service-role key | everything (staged documents too) | all | all | all | all |

`provision_path` / `context_path` follow the migration: a breadcrumb for an entitled
caller, the service role, or an `is_public` row; `null` otherwise. `search_provisions`
runs as the caller, so the paywall is the same RLS.
(Production's `cross_references` policy checks only the from-end; the table is empty
here, so the stricter rule changes nothing.)

**RPCs** (`/rest/v1/rpc/<fn>`): `search_provisions` (below), `provision_path`,
`changelog_snapshot_public`, `changelog_public`, `refresh_changelog_snapshot`,
`search_queries_recent_count`, `search_provisions_in_document` (the reader's jump-box text matches: the same matcher as `search_provisions`, scoped to `doc_key` before the limit, columns id, citation, title, headline, rank), `count_provisions_matching` (the visitor's "the full library has N provisions" line: the same matcher over every released row whatever the caller's RLS, as a bare integer; a staged document is left out). `match_provisions` / `match_provisions_hybrid` (Ask): 403
for anon as in production; for a subscriber `[]` and a note in the unhandled log.

**`search_provisions`** is *not* Postgres full-text search. It is a case-insensitive
word match with a light English stemmer ("emissions" finds "emission"), websearch
syntax (`or`, `-word`, `"quoted phrase"`), a length-normalised weighted score
(citation > title > text) with the migration's multipliers where they can be computed
(citation hit x2, document-named root x2, Definitions x0.8, applicability x1.3, GP
x0.95), and a `<mark>` headline (`null` when the text is only its own heading).
Result *order* will not match production; membership under the paywall will.

**GoTrue** (`/auth/v1`): password sign-in, refresh-token grant, `GET/PUT /user`, logout,
sign-up (an unconfirmed account), resend / recover, settings. Access tokens are signed
JWTs; the app only ever calls `auth.getUser()` (a round trip to `/auth/v1/user`), never
`getClaims()`, so no JWKS is needed. Two accounts exist: a **subscriber**
(`harness-subscriber@essentialregs.test` / `harness-password-1`,
`profiles.access_granted = true`) and a **signed-in visitor with no access**
(`harness-visitor@essentialregs.test`, same password). `run.sh` prints them as
`SMOKE_EMAIL` / `SMOKE_PASSWORD`. The session cookie is `Secure` in a production
build; Chromium accepts it on `http://127.0.0.1`.

**Harness endpoints** (not Supabase): `GET /__harness/health`, `GET|DELETE
/__harness/tour-events`, `GET /__harness/search-queries`, `GET|DELETE
/__harness/unhandled`, `GET /__harness/requests` (counts by route),
`POST /__harness/reset`. Every request the mock cannot answer is logged to stderr,
`generated/unhandled.log` and `/__harness/unhandled`; check it after a run.

## The fixtures

`build-fixtures.py` writes `generated/db.json`. Inputs are arguments, with the
defaults of the first build:

| option | default | what |
| --- | --- | --- |
| `--gp05` | `.../scratchpad/shared/reggp05_parsed_new.json` | GP05 as the importer now parses it |
| `--reg7` | `.../scratchpad/shared/reg7_parsed.json` | Regulation 7 |
| `--overlay` | `.../scratchpad/shared/harness_overlay.json` | production `summary_status`, `ai_summary`, `reviewed_by`, `reviewed_at`, `source_url` for the rows the tour touches (`rows`), the 13-id Regulation 7 subtree (`reg7_public_subtree`), the two second-hop rows I.D and I.D.4 (`reg7_public_second_hop`, 13 Oct 2026), the sample ids (`public_ids_outside_gp05_before_sprint7`); each list falls back to the builder's own copy when the key is absent |
| `--docs-dir` | `.../scratchpad/pr1/out_new` | every other document, `reg*_parsed.json` (GP05 and Reg 7 in it are replaced by the two above) |
| `--only 7,gp05,3` | all | keep only these documents in full (every root is kept so the indexes still list all) |

All 58 documents (37,208 rows, a 34 MB `db.json`) are loaded by default, because pages
need them: the indexes, the sitemap, `/sample`'s snapshot ids, the previews' headings,
Test Methods' "Cited by".

Derived from the data, not made up: `reg_key` (the `<reg>` of `sec-<reg>-...`),
`jurisdiction_level` / `issuing_body` / root `source_url` (from `pipeline/import_ccr.py`
`REG_META`), `provision_method_citations` (from the importer's `xref-method` anchors in
`full_text`), `is_public` (every GP05 row, the 13 subtree ids, I.D and I.D.4 (the walkthrough's second hop,
migration `20261013014006`), the four older sample rows: 130 in all), `summary_status = 'pending'` with no summary except where the
overlay says otherwise.

**Invented, and marked as such in the data** (`[Harness placeholder ...]`):
- an approved summary on the four older sample rows (the overlay has none, and the specs
  pin the "automated check against source text" badge on `/regs/sec-7-B-I-D-3-a-(i)`);
- an approved summary on every document root the overlay does not cover (production has
  one on each; the whole-document preview reads it). `--no-root-summaries` leaves them out;
- five `provision_neighbors` for each of the four sample rows (lexical TF-IDF, not
  embeddings; GP12 VI.A.1 pinned at rank 3 as the smoke spec says production has it);
- a four-row changelog snapshot (counts only);
- the two accounts above.

## Limits, and where it differs from production

- **Ask / semantic search is not emulated.** It needs Voyage embeddings and Claude.
  `VOYAGE_API_KEY` is unset, so `/search?mode=ask` as a subscriber shows the error state;
  the seven Ask specs in `smoke-signed-in.spec.ts` fail for that reason (and the
  signed-in file runs serially, so run those tests by line number, not as a file).
- **Summaries are production's only for the rows in the overlay.** Everything else is
  pending with no summary, so any spec that counts summaries on other documents sees few.
- **Search ranking** is approximate (above). **Neighbours** exist for four rows only.
  `cross_references` is empty (production's legacy table is not fed by the importer).
- **No staged documents**: `regulation_releases` is empty, so everything is released.
  Insert a `staged` row through the service key to test the release gate.
- **Tour events**: the app's route does not store a request from a browser that reports
  `navigator.webdriver` (every Playwright browser), and the tour specs intercept the
  request anyway. A test that wants a stored row posts to `/api/tour-event` from
  `page.request` (no automation header) and reads `GET /__harness/tour-events`.
- **Email, Stripe, Realtime, storage, edge functions**: not present. Sign-up creates an
  unconfirmed account and no email goes anywhere; checkout and the portal are not reached.
- **The mock is not Postgres.** No joins beyond the embeds above, no aggregates, no
  `fts` / `cs` operators, no `upsert`; a spec that needs one gets an error in the
  unhandled list, which is the signal to extend the mock.
- Each run of `next build` prerenders against the mock, so a page's build-time data
  is the fixtures' data.

### Playwright's browser

`@playwright/test` 1.63 wants Chromium build 1243. This sandbox's `/opt/pw-browsers`
holds build 1194 (Playwright 1.56), so every test fails with "Executable doesn't exist"
until the build is found under the name 1.63 looks for. `pw-browsers.sh` links the
installed build under that name in `generated/pw-browsers/` (no download, nothing
under `/opt` is touched) and prints the path to export; `run.sh --test` does it for
you. Where the expected build is installed it prints the original path unchanged.
Chromium 141 runs the 1.63 protocol without trouble across the specs here.

### `node_modules` must be a real directory

Turbopack refuses a `node_modules` that is a symlink out of the project
("Symlink [project]/node_modules is invalid, it points out of the filesystem root"),
which is how a git worktree usually borrows the main checkout's. Run `npm ci` in the
worktree; `run.sh` stops with this message if it finds the symlink.

### Fonts

`next build` downloads two Google Fonts stylesheets. `HARNESS_FONTS=auto` (default) uses the
network when `fonts.googleapis.com` answers; otherwise, or with `HARNESS_FONTS=mock`, it
builds with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` (stylesheets generated by `font-mocks.mjs`
from the app's own `next/font/google` calls; the font files are placeholder bytes served
by the mock), and the page uses the system fallback fonts. Layout measurements in the
specs are the same either way here, but a font-metric-sensitive spec should use the
network build.

## Does it have teeth?

`selftest.mjs` asserts the policy table above directly (anon sees 111 GP05 rows and
16 of Regulation 7's; a locked row is absent; neighbours need both ends public; a user
reads only their own profile; and so on). Started with `HARNESS_RLS=off` (every caller
treated as a subscriber; never for a real run) it fails 8 of its checks. The existing
smoke specs do **not** notice that leak: with `HARNESS_RLS=off`, `smoke-anonymous.spec.ts`
and `smoke-tour.spec.ts` still pass 45 of 45, because the app's own gates
(`PUBLIC_READER_REGS`, the service-role label reads) sit in front of the same rows. A
spec about *which rows are public* (the Regulation 7 I.C.1 unlock) has to ask for a row
directly (`/regs/<id>`, `/api/provision/<id>`, a search) to be sensitive to the data.

## Files

| file | |
| --- | --- |
| `run.sh` | fixtures, mock, `next build`, `next start`, `--test` |
| `mock-supabase.mjs` | the fake PostgREST + GoTrue |
| `build-fixtures.py` | writes `generated/db.json` |
| `selftest.mjs` | checks the mock (and three requests through the app) |
| `pw-browsers.sh` | Chromium build shim |
| `font-mocks.mjs` | offline Google Fonts stylesheets |
