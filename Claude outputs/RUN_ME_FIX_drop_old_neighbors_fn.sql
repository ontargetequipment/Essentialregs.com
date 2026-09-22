-- RUN ME in the Supabase SQL editor — one statement, fixes my mistake in the last migration.
--
-- WHAT WENT WRONG: RUN_ME_neighbors_rpc_2026-09-21.sql used `create or replace function` while
-- ALSO adding a fourth parameter (fallback_candidates). In Postgres a different parameter list
-- makes a *different* function, so "replace" had nothing to replace — it created a second
-- overload and left the old three-argument version in place. The embed pipeline calls the
-- function with only `target_ids`, which now matches both, so PostgREST refuses to choose
-- (PGRST203) and the neighbour rebuild aborts before writing anything.
--
-- Nothing is damaged: no rows were written, and the new four-argument function is complete and
-- correct (verified — it has the _short table, the _hits index and the fallback probe).
-- This drops the superseded three-argument version so the call is unambiguous again.

drop function if exists public.recompute_provision_neighbors(text[], integer, integer);

-- Verify: this should return exactly ONE row, the four-argument version.
select pg_get_function_identity_arguments(p.oid) as remaining_signature
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'recompute_provision_neighbors';
