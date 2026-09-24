-- Reconciled 2026-09-24. Source: supabase/migrations/011_security_grants.sql
-- (now supabase/migrations_archive/). Pasted into the Supabase SQL editor and never
-- entered supabase_migrations.schema_migrations; this file puts it on the record.
--
-- ORDER MATTERS. This file revokes EXECUTE on provision_path(text) from anon and
-- authenticated. search_provisions() and context_path() are SECURITY INVOKER and
-- call provision_path(), so from the moment this ran, keyword search and detail-page
-- breadcrumbs raised 42501 for every non-service caller. The fix,
-- 20260923035949_guard_provision_path_and_restore_keyword_search, re-grants it and
-- makes provision_path enforce the paywall itself. This file must sort BEFORE that
-- fix (it does: 20260922030526 < 20260923035949) and AFTER
-- 20260921185135_neighbors_rpc_fallback_probe, which creates the four-argument
-- function it revokes on. Do not renumber it.
--
-- When it ran: between 2026-09-21 (the neighbours RPC and the by-hand drop it refers
-- to) and 2026-09-23 03:59 UTC (the fix). This version number is the UTC time of
-- the commit that added the file (1255d0a, 2026-09-22 03:05:26 UTC).
--
-- Production evidence: recompute_provision_neighbors(...4 args) EXECUTE = service_role
-- only; is_basis_provision(text) has search_path = public; the provision_path grant
-- state is the fix's, as expected.
--
-- The only edit below: the original wrapped its statements in `begin; ... commit;`.
-- The Supabase CLI already runs each migration file inside a transaction, so the
-- wrapper is dropped here. The trailing VERIFY query is kept (read-only).
-- ---------------------------------------------------------------------------

-- EssentialRegs — migration 011: close the grants my Batch 7 migration left open.
-- RUN ME in the Supabase SQL editor (project tpuowazmmhqlsakghojy). Safe to run twice.
--
-- WHAT WENT WRONG (mine). Migration 006 created recompute_provision_neighbors with a
-- three-argument signature and ended with:
--
--     revoke all on function ...(text[], integer, integer) from public, anon, authenticated;
--     grant execute on function ...(text[], integer, integer) to service_role;
--
-- RUN_ME_neighbors_rpc_2026-09-21.sql re-created the function with a FOURTH argument
-- (fallback_candidates) and did not carry those two lines forward. A new signature is a new
-- function object with fresh, default privileges, and Supabase's defaults grant EXECUTE on
-- public-schema functions to PUBLIC, anon and authenticated. So from the moment that file was
-- run, anyone holding the publishable anon key — which ships in the browser bundle by design —
-- could POST to /rest/v1/rpc/recompute_provision_neighbors and start a full-corpus neighbour
-- rebuild: ~36,500 anchors, each doing a vector scan, running as the definer (postgres) and
-- writing to provision_neighbors. Unauthenticated, uncapped, repeatable. This is the same root
-- cause as the PGRST203 overload bug: I changed the signature without carrying across what was
-- attached to the old one.
--
-- Nothing suggests it was called: provision_neighbors is at its expected size. This closes it.
--
-- WHAT THIS DOES NOT BREAK. pipeline/embed.py is the only caller (embed.py line ~391) and it
-- authenticates with SUPABASE_SERVICE_ROLE_KEY. service_role keeps EXECUTE below, and a revoke
-- from PUBLIC never touches an explicit role grant. The app never calls this function.


-- 1. The neighbour rebuild: service_role only, as migration 006 intended. -------------------

-- Defensive: the superseded three-argument signature should already be gone (dropped by hand
-- on 2026-09-21 to clear the PGRST203 ambiguity). If it is somehow back, it goes now.
drop function if exists public.recompute_provision_neighbors(text[], integer, integer);

revoke all on function
  public.recompute_provision_neighbors(text[], integer, integer, integer)
  from public, anon, authenticated;

grant execute on function
  public.recompute_provision_neighbors(text[], integer, integer, integer)
  to service_role;

-- 2. provision_path: stop exposing it as a public RPC. --------------------------------------
-- Created by migration 009 as SECURITY DEFINER, so it reads the corpus with RLS bypassed and
-- returns a breadcrumb of ancestor titles for ANY provision id — including the 36,513 rows that
-- are not is_public. That is section-title metadata rather than regulation text, so it is a
-- small leak, not an open door, but it is a leak the paywall is supposed to cover.
--
-- Nothing calls it over the API: the app's only rpc() calls are search_provisions,
-- search_queries_recent_count, match_provisions and match_provisions_hybrid. match_provisions
-- calls provision_path INTERNALLY, and a call made inside a SECURITY DEFINER function runs as
-- the function owner (postgres), so it is unaffected by the revoke below. Semantic search
-- keeps working exactly as it does today.
revoke all on function public.provision_path(text) from public, anon, authenticated;
grant execute on function public.provision_path(text) to service_role;

-- 3. is_basis_provision: pin its search_path. -----------------------------------------------
-- Flagged by the Supabase linter (0011_function_search_path_mutable). It is SECURITY INVOKER,
-- so this is hardening rather than a fix — it stops the function resolving its table reference
-- through a caller-controlled search_path. No behaviour change.
alter function public.is_basis_provision(text) set search_path = public;


-- VERIFY. Expect exactly two rows, both with anon_exec = false and auth_exec = false.
select p.proname,
       pg_get_function_identity_arguments(p.oid)          as args,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('recompute_provision_neighbors', 'provision_path')
order by p.proname;

-- Deliberately NOT changed, for the record:
--
--   match_provisions / match_provisions_hybrid  — the linter warns that signed-in users can
--     execute these SECURITY DEFINER functions. They can, and they should: that is how search
--     works. Both open with `if not public.has_full_access() then raise exception ... 42501`,
--     so a signed-in non-subscriber gets an error, not results. The paywall holds. Verified by
--     reading both function bodies on 2026-09-22.
--
--   has_full_access / search_queries_recent_count — correctly scoped already.
--
--   search_provisions — SECURITY INVOKER, so RLS applies and an anonymous caller sees only the
--     four is_public sample rows. Correct as is.
--
--   provision_embeddings / search_queries / the two 2026-09-14 backup tables — the linter
--     reports "RLS enabled, no policy". That is the intended deny-all posture: no policy means
--     no row is visible to anon or authenticated, and the service role bypasses RLS. Nothing to
--     do, though the two backup tables from the Reg 7 reimport could be dropped once you are
--     confident they are no longer needed.
