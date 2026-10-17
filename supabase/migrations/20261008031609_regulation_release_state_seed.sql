-- Reconciled 2026-10-17: hand-applied on 8 Oct 2026, recorded late.
--
-- Source: the seed insert of 20261008040000_regulation_release_state.sql
-- (commit 2d72300; that file is now in supabase/migrations_archive/), copied
-- below unchanged with its comment. The release-state change was applied "in
-- pieces" (the archived file's own note). Five pieces were recorded by the
-- Supabase connector's apply_migration: 20261008031550 (table and
-- reg_is_released), 20261008031623 (policies), 20261008031858 (changelog),
-- 20261008032004 (match_provisions), 20261008032118 (hybrid). This seed was
-- not: it went through execute_sql, which records nothing.
--
-- Version: production's 58 seeded rows share one released_at,
-- 2026-10-08 03:16:09.359144+00 (this statement's now()), after 20261008031550
-- created the table and before 20261008031623. Recorded in schema_migrations
-- by docs/imports/2026-10-16/RUN_ME_20261017035000_migration_ledger_record.sql.
--
-- Catalog evidence, 17 Oct 2026: 58 rows carry this note, all 'released', one
-- released_at; provisions has 58 distinct reg_keys and every one has a row.

-- Every document that exists today is released (Subpart OOOO included: it
-- has been visible to subscribers since its import and hiding it now would
-- break the 55 links eleven documents already carry to it).
insert into public.regulation_releases (reg_key, status, released_at, note)
select distinct p.reg_key, 'released', now(), 'released before the staged state existed (8 Oct 2026)'
from public.provisions p
where p.reg_key is not null
on conflict (reg_key) do nothing;
