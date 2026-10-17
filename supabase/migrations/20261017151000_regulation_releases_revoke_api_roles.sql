-- regulation_releases: no table privileges for the API roles (17 Oct 2026).
--
-- 20261008031550 created the table without the revoke the release-state file
-- (now supabase/migrations_archive/20261008040000_regulation_release_state.sql)
-- carried, so anon and authenticated kept Supabase's default grants
-- (arwdDxtm). RLS was on with no policy for them, so PostgREST returned and
-- changed no rows, but the grants said otherwise. Found by the ledger
-- reconciliation of 17 Oct 2026 (PR #139).
--
-- Nothing reads or writes the table as anon or authenticated: the app reads it
-- through the service-role client (src/lib/release.ts, createAdminClient), the
-- importer and the Release workflow through SUPABASE_SERVICE_ROLE_KEY
-- (pipeline/import_ccr.py fetch_staged_reg_keys, ensure_release_row,
-- cmd_release), and the RLS policies and Ask functions through
-- reg_is_released(), which is SECURITY DEFINER and owned by postgres, the
-- table's owner, so this revoke does not reach it.

revoke all on table public.regulation_releases from public, anon, authenticated;
grant all on table public.regulation_releases to service_role;
