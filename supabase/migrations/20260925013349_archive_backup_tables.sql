-- Item B1 of the 2026-09-25 security hygiene PR: move the two 2026-09-14 backup
-- tables out of the API-exposed public schema.
--
-- provisions_backup_reg7_20260914 (1,824 rows of provision text) and
-- provision_changes_backup_20260914 (363 rows) sat in public with RLS enabled
-- and no policies (20260918040242). That is deny-all today, but the tables also
-- carry full table privileges for anon and authenticated from the public
-- schema's default ACL, so one accidentally added policy would have served
-- paid provision text over the REST API. Schema archive is not in PostgREST's
-- exposed schema list (the authenticator role carries no pgrst.db_schemas
-- setting, the list is managed in the dashboard under Settings > API, and this
-- schema did not exist before this file), so nothing in it is reachable over
-- the API regardless of grants or policies.
--
-- Nothing is dropped. Whether the tables are still needed is a separate
-- decision. They keep RLS on / no policies; postgres (the SQL editor) and
-- service_role can still read them directly.

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;
grant usage on schema archive to service_role;
comment on schema archive is
  'Copies of data kept outside the API-exposed schemas. Not in PostgREST''s '
  'exposed schema list; anon and authenticated hold no USAGE. Do not add it to '
  'the exposed list.';

alter table public.provisions_backup_reg7_20260914 set schema archive;
alter table public.provision_changes_backup_20260914 set schema archive;

-- Belt and braces: the tables inherited full privileges for anon and
-- authenticated from public's default ACL. They are unreachable now (no USAGE
-- on archive), but the grants should not be left lying around either.
revoke all on table archive.provisions_backup_reg7_20260914 from public, anon, authenticated;
revoke all on table archive.provision_changes_backup_20260914 from public, anon, authenticated;
