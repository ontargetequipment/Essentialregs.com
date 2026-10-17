# supabase/migrations

This folder is the replayable record of the production database (Supabase project
`tpuowazmmhqlsakghojy`). Every file here corresponds to one row in
`supabase_migrations.schema_migrations`, and every row has a file. Filename order is
apply order.

## The rule

Every schema change is a timestamped file created with
`supabase migration new <name>`, applied with the Supabase connector's
`apply_migration` (which records the row) or with `supabase db push`. Never the SQL
editor. If something was run by hand in an emergency, the same SQL goes in a
timestamped file and the version is recorded with `supabase migration repair --status
applied <version>` (or an insert into `schema_migrations`) the same day.

**A change applied in the SQL editor (or through `execute_sql`) is recorded and
committed the same day, under the version it was recorded with.** The file's name
carries the version in `schema_migrations`, not the version the file was planned
under; if the two differ, rename the file before it merges. Record it with its
statements (`insert into supabase_migrations.schema_migrations (version, name,
statements) values (...)`), not the version alone, so the check below can compare
it. `apply_migration` names the row with its own timestamp, not the file's: after
it returns, read the version back (`select version, name from
supabase_migrations.schema_migrations order by version desc limit 3`) and name the
file to match. Do not also insert the file's planned version; that is how the two
7 Oct twins below came about.

Why: on 2026-09-22 a hand-run file (`011_security_grants.sql`) revoked a grant that a
recorded migration (`20260919035558`) depended on, and keyword search and breadcrumbs
were down until `20260923035949` re-granted it. Nobody could see the two side by side
because the hand-run SQL lived outside the versioned sequence. The order in this folder
is what makes that class of outage visible before it ships, and what makes a replay
reproduce production instead of reproducing the outage.

## Reading the folder

- Version numbers are UTC `YYYYMMDDHHMMSS`. For migrations applied through the CLI or
  connector that is the apply time. Six files carry a header beginning "Reconciled
  2026-09-24": they were applied by hand before the folder was reconciled, and their
  version numbers are bounds or commit times, chosen so that replay order matches the
  order they actually ran. Each header says how the number was derived. Do not renumber
  them. One more, `20260914120000_reimport_backup_tables.sql`, begins "Reconstructed
  2026-09-25": it recreates, from the catalog, two tables that were made by hand and
  never recorded (see below). Same rule: do not renumber it.
- `20260922030526_security_grants.sql` must stay between
  `20260921185135_neighbors_rpc_fallback_probe.sql` (creates the function it revokes on)
  and `20260923035949_guard_provision_path_and_restore_keyword_search.sql` (undoes its
  `provision_path` revoke).
- The two backup tables from the 2026-09-14 Reg 7 re-import
  (`provisions_backup_reg7_20260914`, `provision_changes_backup_20260914`) were made by
  hand with `create table ... as select` and never recorded, so
  `20260918040242_security_housekeeping_backups_and_trigger_fns.sql`, which enables RLS
  on them, failed on a from-scratch replay. `20260914120000_reimport_backup_tables.sql`
  now creates them (empty, with production's exact column list; its header explains the
  reconstruction) and is recorded in `schema_migrations` with that version. Replay
  order: `20260914120000` creates, `20260918040242` enables RLS,
  `20260925013349_archive_backup_tables.sql` moves them to schema `archive`, which is
  not in PostgREST's exposed schema list. Nothing is dropped.
- Reconciled 2026-10-17 (before the BLM import): files whose names carried a
  planned version instead of the recorded one were replaced by the recorded
  versions' stored statements, each with a first line "regenerated 2026-10-17 from
  schema_migrations.statements" (`20261003160551`, `20261007011846`,
  `20261007011936`, `20261008000816`, `20261008000836`, and the five pieces
  `20261008031550` to `20261008032118` of the release-state change); the earlier
  copies, with their longer notes, are in `../migrations_archive/` (see its README).
  `20261007010000` and `20261007020000` are the two twins' duplicate notes.
  `20261008031609_regulation_release_state_seed.sql` begins "Reconciled
  2026-10-17": the release-state seed, run by hand between two recorded pieces,
  dated by the seeded rows' own `released_at`. Do not renumber any of them.
- `../schema.sql` is the original hand-run bootstrap (the "001" the numbered series
  never had). Its content is what `20260902021254_initial_schema`,
  `20260909235329_add_profiles_and_access_granted` and
  `20260910014122_open_full_access_to_authenticated_users` recorded; it is kept for
  reference and is not part of the replay sequence.
- Superseded numbered and `RUN_ME_*` files are in `../migrations_archive/` with a table
  mapping each one to the timestamped file that now represents it.

## Checking parity

```sh
SUPABASE_DB_URL=postgres://... npx tsx scripts/check-migration-ledger.ts
npx tsx scripts/check-migration-ledger.ts --db-url postgres://...
npx tsx scripts/check-migration-ledger.ts --rows rows.json        # an export, no database
#   --pending docs/imports/<day>/RUN_ME_<ts>_migration_ledger_record.sql
#   adds that file's inserts first: the ledger as it will be once it has been run
```

`scripts/check-migration-ledger.ts` reads `schema_migrations` (read-only, through
`psql`) and checks that every row has exactly one file here with the same version
and name, every timestamped file has a row, and, where the row stores its
statements, the file's SQL equals them once comments, whitespace and trailing
semicolons are set aside (the connector stores whatever text it was given, often
with shorter notes than the file). It prints every mismatch and exits 1 on any.
The `qa` job in `.github/workflows/ci.yml` runs it after corpus QA, on every pull
request and by hand, and skips (passes) without `SUPABASE_DB_URL`, like corpus QA.
`scripts/check-migration-ledger.test.ts` runs it against fixtures in `npm test`.

`README.md` and `RUN_ME_*.sql` here are not ledger files and are skipped: the
`RUN_ME_*` files are data changes kept for the record under the standing rule in
`docs/CEO_PHASE_PLAN.md` (run with `execute_sql`, which records nothing). A schema
change is never a `RUN_ME_*` file.

Three cases are allowed only when listed, with a reason, in
`scripts/migration-ledger-allowlist.json`; an entry that stops applying is itself
a mismatch, so the list cannot go stale.

- **Statement-less rows** (`statement_less`): a version recorded by hand with no
  `statements`. The file must carry the SQL that actually ran, and the pull request
  that adds the row must show catalog evidence (the table, columns, policies,
  function signatures and bodies, grants it creates or alters) that it was applied.
  New ones should not happen: record with statements.
- **Twins** (`duplicates`): one change recorded under two versions. Exactly one
  file carries the SQL, at the version whose stored statements match it; the other
  version's file is only a comment naming its twin and saying why, so files = rows
  and a replay does not run the change twice. Neither row is deleted.
- **Known differences** (`known_differences`): a file whose SQL is not what its row
  stores, reported and waiting on a decision. Neither side is changed until then.

A file with no row is never recorded blindly: check the catalog. Applied: record
it (an insert, as above). Never applied: move it to `../migrations_archive/` with a
line in that README saying why, and never apply it. A renamed copy of something
already recorded under another version: a twin, or archive the copy when the
recorded version already has its file.

`supabase db push --dry-run --linked` reports nothing to push when the versions
match.
