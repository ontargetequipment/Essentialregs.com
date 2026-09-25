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
- `../schema.sql` is the original hand-run bootstrap (the "001" the numbered series
  never had). Its content is what `20260902021254_initial_schema`,
  `20260909235329_add_profiles_and_access_granted` and
  `20260910014122_open_full_access_to_authenticated_users` recorded; it is kept for
  reference and is not part of the replay sequence.
- Superseded numbered and `RUN_ME_*` files are in `../migrations_archive/` with a table
  mapping each one to the timestamped file that now represents it.

## Checking parity

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

The set of `version` values must equal the set of 14-digit filename prefixes here.
`supabase db push --dry-run --linked` reports nothing to push when they match.
