-- Fixes: keyword search has raised 42501 for every non-service caller since
-- 20260919035558_provision_path_on_search_results, which made the SECURITY
-- INVOKER function public.search_provisions() call the SECURITY DEFINER
-- function public.provision_path(), whose EXECUTE was granted only to
-- postgres and service_role. public.context_path(provisions) -- the PostgREST
-- computed column behind detail-page breadcrumbs -- is broken the same way and
-- is fixed by the same grant.
--
-- Fix: grant EXECUTE on provision_path to anon + authenticated, and make
-- provision_path enforce the paywall itself, because it bypasses RLS.
--
-- NOT done here, on purpose: making search_provisions SECURITY DEFINER. It
-- selects full_text and builds ts_headline straight from public.provisions;
-- as DEFINER it would bypass RLS and serve paywalled body text to anon.

create or replace function public.provision_path(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- SECURITY DEFINER *and* granted to anon/authenticated, so this function
  -- bypasses RLS on public.provisions and MUST decide for itself who may see a
  -- heading chain. It returns the breadcrumb when the caller is entitled, or
  -- when the target row is one of the is_public marketing samples, and returns
  -- NULL -- never an error -- for everyone else, so that search_provisions()
  -- and context_path() keep working for anonymous visitors.
  --
  -- The entitlement predicate is INLINED rather than delegated to
  -- public.has_full_access() on purpose. has_full_access() is not granted to
  -- anon, and PostgreSQL resolves function EXECUTE privilege when the
  -- expression tree is initialised, NOT lazily per CASE branch -- so even
  --   case when auth.role() <> 'anon' then public.has_full_access() ... end
  -- still raises 42501 for anon. Granting has_full_access() to anon would also
  -- work, but the Supabase linter actively recommends revoking that grant, and
  -- a revoke would silently restore this outage. Reading public.profiles
  -- directly is correct for every caller class because RLS does not apply to
  -- the owner inside this function.
  --
  -- Written positively (WHEN <allowed> THEN path ELSE null) so that it fails
  -- CLOSED: auth.role() is NULL when no JWT claims are present, and a NULL
  -- condition falls through to ELSE. Do not rewrite this as
  -- "WHEN NOT (<allowed>) THEN null ELSE path" -- that form fails OPEN.
  --
  -- KEEP IN SYNC WITH public.has_full_access() and with the
  -- "subscribers can read all provisions" policy on public.provisions.
  select case
    when exists (
           select 1
           from public.profiles pr
           where pr.id = auth.uid()
             and (pr.access_granted
                  or pr.subscription_status in ('active', 'trialing'))
         )
      or exists (
           select 1
           from public.provisions v
           where v.id = p_id
             and v.is_public is true
         )
      or auth.role() = 'service_role'
    then (
      with recursive up as (
        select p.parent_id, p.citation, p.title, 1 as depth
        from public.provisions p
        where p.id = p_id
        union all
        select p.parent_id, p.citation, p.title, up.depth + 1
        from public.provisions p
        join up on p.id = up.parent_id
        where up.depth < 12
      )
      select string_agg(
               coalesce(nullif(btrim(up.title), ''), up.citation),
               ' › ' order by up.depth desc)
      from up
      where up.depth > 1                                        -- not the provision itself
        and up.parent_id is not null                            -- not the regulation's top row
        and btrim(up.title) is distinct from btrim(up.citation)  -- skip bare numbering ("II.B.2.")
    )
    else null
  end;
$$;

comment on function public.provision_path(text) is
  'Ancestor heading breadcrumb for a provision. SECURITY DEFINER and callable '
  'by anon/authenticated, so it enforces the paywall itself: full path for '
  'entitled users and service_role, path for is_public sample rows, NULL for '
  'everyone else. A NULL here is the paywall working. Do not "fix" a NULL by '
  'making the caller SECURITY DEFINER.';

-- The 42501 fix. search_provisions() and context_path() are SECURITY INVOKER,
-- so they need the CALLER to hold EXECUTE on provision_path.
revoke all on function public.provision_path(text) from public;
grant execute on function public.provision_path(text)
  to anon, authenticated, service_role;
