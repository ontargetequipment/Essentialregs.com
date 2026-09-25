-- Reconstructed 2026-09-25. The two tables below were created by hand on
-- 2026-09-14, during the Reg 7 re-import, as `create table ... as select` copies
-- of public.provisions and public.provision_changes (docs/CEO_Brief_2026-09-14.md,
-- docs/Reg7_Summary_Review_2026-09-14.md). No migration recorded them, but
-- 20260918040242_security_housekeeping_backups_and_trigger_fns alters both, so a
-- replay onto an empty database failed at that step. This file closes the gap.
-- It sorts after 20260914000000_regulation_source_urls (same day) and before
-- 20260918035710, the first recorded version after the tables existed. The
-- exact creation time was not recorded; 12:00 UTC is a placeholder within the day.
--
-- Shape: read from information_schema.columns, pg_indexes, pg_constraint and
-- pg_trigger on 2026-09-25. A `create table as select` copy carries only the
-- source's column names and types: every column nullable, no defaults, no
-- generated expressions, no primary key, no indexes, no constraints, no
-- triggers. That is exactly what production has, so the columns are listed
-- explicitly instead of `(like public.provisions)`, which today would also copy
-- reg_key (a generated column added 2026-09-24 that the backup does not have)
-- and the source's NOT NULL constraints. search_vector is a plain tsvector here,
-- not the generated column it is on provisions.
--
-- Data: the production copies hold 1,824 and 363 rows, a snapshot of the 14 Sep
-- state that no migration can reproduce. A replay creates the tables empty.
-- On production this file is a no-op (`if not exists`). It was recorded in
-- supabase_migrations.schema_migrations by hand with this version (version,
-- name, statements = this file), the same way the 2026-09-24 reconciliation
-- recorded its files.
--
-- Replay order that matters: this file creates the tables, 20260918040242
-- enables RLS on them, and the 2026-09-25 archive_backup_tables migration moves
-- them to schema archive.

create table if not exists public.provisions_backup_reg7_20260914 (
  id                   text,
  citation             text,
  title                text,
  jurisdiction_level   text,
  issuing_body         text,
  parent_id            text,
  full_text            text,
  ai_summary           text,
  summary_model        text,
  summary_generated_at timestamptz,
  source_url           text,
  last_verified_date   date,
  is_public            boolean,
  sort_order           integer,
  created_at           timestamptz,
  updated_at           timestamptz,
  search_vector        tsvector,
  summary_status       text,
  reviewed_by          text,
  reviewed_at          timestamptz,
  summary_original     text
);

create table if not exists public.provision_changes_backup_20260914 (
  id           bigint,
  provision_id text,
  change_type  text,
  note         text,
  created_at   timestamptz
);
