-- ============================================================================
-- EssentialRegs — corpus quality checks
-- ============================================================================
-- Run this in the Supabase SQL editor after EVERY import, re-import or
-- summarizer run. It returns one row per check with a count and a verdict.
--
-- Baseline taken 2026-09-22 against 36,517 provisions. The "expected" column
-- is what the corpus looked like then; investigate anything that moves.
--
-- Every check here corresponds to a defect that has ALREADY happened once and
-- is recorded in EssentialRegs_Known_Issues_and_Fixes.md. This file exists so
-- the next one is caught by a query instead of by somebody noticing.
--
-- Calibration note: several obvious-looking checks were tried and rejected
-- because they cried wolf. They are documented at the bottom so nobody
-- "helpfully" adds them back.
--
-- Checks 13 and 14 are different in kind: they test GRANTS and RLS, not the
-- corpus. They exist because this suite runs as postgres and therefore
-- scored the 19 Sep 2026 keyword-search outage (42501 inside
-- search_provisions) as healthy for three days. Run the whole file, top to
-- bottom, in one go: Step 0 must run before the main query.
-- ============================================================================

-- ============================================================================
-- Step 0 — role-aware smoke test (runs BEFORE the main query below)
-- ============================================================================
-- Everything else in this file runs as postgres, a superuser. A superuser
-- holds EXECUTE on every function and bypasses RLS, so it cannot see a grant
-- bug. That is exactly how keyword search stayed "healthy" here for three
-- days (19-22 Sep 2026) while every real user got
--   42501 permission denied for function provision_path
-- from search_provisions(). This step executes the two user-facing RPCs as
-- the roles real callers actually use. Failures are recorded as rows, never
-- raised, so the suite always finishes. Check 14 reports the result.
--
-- Cases (want_min / want_max = acceptable row count from the probe):
--   anon            search_provisions must run and see the sample rows;
--                   context_path must run on the sample rows;
--                   provision_path on a paywalled id must be NULL (RLS bypass
--                   guard - provision_path is SECURITY DEFINER).
--   authenticated   a signed-in NON-subscriber: same three expectations.
--   authenticated   an entitled profile: search returns paths, and
--                   provision_path on a paywalled id is non-NULL.
drop table if exists pg_temp.rpc_smoke_results;
create temp table rpc_smoke_results (caller text, what text, verdict text);

do $smoke$
declare
  c            record;
  n            bigint;
  entitled_sub text;
  paywalled_id text;
  claims       text;
begin
  select id::text into entitled_sub
  from public.profiles
  where access_granted or subscription_status in ('active', 'trialing')
  order by id limit 1;

  -- A paywalled row whose parent is a real titled heading (not the regulation's
  -- top row, not bare numbering), so an entitled caller is guaranteed a
  -- non-NULL path. Rows like sec-cp-I-G-90, whose ancestors are all bare
  -- numbering, return NULL for everyone and would be a false alarm here.
  select p.id into paywalled_id
  from public.provisions p
  join public.provisions a on a.id = p.parent_id
  where not p.is_public
    and a.parent_id is not null
    and btrim(a.title) is distinct from btrim(a.citation)
    and nullif(btrim(a.title), '') is not null
  order by p.id limit 1;

  for c in
    select * from (values
      -- anonymous visitor -------------------------------------------------
      ('anon', '{"role":"anon"}', false,
       'search_provisions(''emissions'')',
       $q$select count(*) from public.search_provisions('emissions', 25)$q$, 1, null),
      ('anon', '{"role":"anon"}', false,
       'context_path on sample rows',
       $q$select count(public.context_path(p)) from public.provisions p where p.is_public$q$, 1, null),
      ('anon', '{"role":"anon"}', false,
       'provision_path(paywalled id) must be NULL',
       $q$select count(*) from (select 1 where public.provision_path(%L) is not null) x$q$, 0, 0),
      -- signed in, not entitled --------------------------------------------
      ('authenticated', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}', false,
       'search_provisions(''emissions'') as non-subscriber',
       $q$select count(*) from public.search_provisions('emissions', 25)$q$, 1, null),
      ('authenticated', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}', false,
       'provision_path(paywalled id) must be NULL as non-subscriber',
       $q$select count(*) from (select 1 where public.provision_path(%L) is not null) x$q$, 0, 0),
      -- signed in, entitled ------------------------------------------------
      ('authenticated', '{"role":"authenticated","sub":"<SUB>"}', true,
       'search_provisions(''setback'') rows with a path as subscriber',
       $q$select count(path) from public.search_provisions('setback', 25)$q$, 1, null),
      ('authenticated', '{"role":"authenticated","sub":"<SUB>"}', true,
       'provision_path(paywalled id) must be non-NULL as subscriber',
       $q$select count(*) from (select 1 where public.provision_path(%L) is not null) x$q$, 1, 1)
    ) v(role, claims, needs_entitled, what, sql, want_min, want_max)
  loop
    if c.needs_entitled and entitled_sub is null then
      insert into rpc_smoke_results values (c.role, c.what, 'skipped: no entitled profile to test with');
      continue;
    end if;
    claims := replace(c.claims, '<SUB>', coalesce(entitled_sub, ''));
    begin
      perform set_config('request.jwt.claims', claims, true);
      execute format('set local role %I', c.role);
      execute format(c.sql, paywalled_id) into n;
      reset role;
      if (c.want_min is not null and n < c.want_min) or (c.want_max is not null and n > c.want_max) then
        insert into rpc_smoke_results values (c.role, c.what, format('FAIL: %s rows, wanted %s..%s', n, coalesce(c.want_min::text, '-'), coalesce(c.want_max::text, '-')));
      else
        insert into rpc_smoke_results values (c.role, c.what, format('ok (%s rows)', n));
      end if;
    exception when others then
      reset role;  -- the failed subtransaction already restored it; belt and braces
      insert into rpc_smoke_results values (c.role, c.what, format('FAIL %s: %s', sqlstate, sqlerrm));
    end;
  end loop;
  reset role;
end
$smoke$;

-- ============================================================================
-- Main query — one row per check
-- ============================================================================
with plain as (
  select
    id, citation, parent_id, ai_summary, summary_status, is_public,
    btrim(regexp_replace(regexp_replace(coalesce(full_text,''), '<[^>]*>', '', 'g'),
                         '&nbsp;|\s+', ' ', 'g')) as txt
  from provisions
),
checks as (

  -- ---- ERRORS: investigate every hit ------------------------------------

  select 1 as ord, 'ERROR' as severity, 'repeated_text_block' as check_name, count(*) as n, 0 as expected,
         'First 50 chars recur 3+ times inside one row. This is the Reg 3 Part F signature (a row that swallowed every restarted "3." in an entry) and the duplicate-label merge signature.' as what_it_catches
  from plain
  where length(txt) > 200 and (length(txt) - length(replace(txt, left(txt,50), ''))) / 50 >= 3

  union all
  select 2, 'ERROR', 'truncated_summary', count(*), 0,
         'ai_summary does not end in terminal punctuation - the summarizer MAX_TOKENS cut-off that produced four mid-sentence ZZZZ table summaries.'
  from provisions
  where ai_summary is not null and btrim(ai_summary) <> '' and rtrim(ai_summary) !~ '[.!?)"\]]$'

  union all
  select 3, 'ERROR', 'page_furniture_in_text', count(*), 0,
         'Printed page header/footer captured mid-provision ("CODE OF COLORADO REGULATIONS ... 5 CCR"). This is how a page number once became "45 days".'
  from plain
  where txt ~* 'CODE OF COLORADO REGULATIONS'
    and position('CODE OF COLORADO REGULATIONS' in upper(txt)) > 1

  union all
  select 4, 'ERROR', 'empty_full_text', count(*), 0,
         'Provision carrying no usable text at all.'
  from plain where btrim(coalesce(txt,'')) = ''

  union all
  select 5, 'ERROR', 'dangling_internal_xref', count(*), 0,
         'Cross-reference whose target provision id does not exist - a link that 404s inside the reader.'
  from cross_references cr
  where cr.target_provision_id is not null
    and not exists (select 1 from provisions p where p.id = cr.target_provision_id)

  union all
  select 6, 'ERROR', 'orphan_parent', count(*), 0,
         'parent_id points at a provision that does not exist - breaks the sidebar tree.'
  from provisions p
  where p.parent_id is not null
    and not exists (select 1 from provisions q where q.id = p.parent_id)

  -- ---- GUARDS: a number that must not drift -----------------------------

  union all
  select 7, 'GUARD', 'public_sample_rows', count(*), 4,
         'Rows visible to logged-out visitors on /sample. Must be exactly 4. More than 4 means paid content is leaking past the paywall.'
  from provisions where is_public

  union all
  select 8, 'GUARD', 'real_review_backlog', count(*), 0,
         'Has a summary AND is still pending review. This is the GENUINE backlog - do not confuse it with the ~16,840 structural rows that are pending with ai_summary IS NULL and are never summarised by design.'
  from provisions where summary_status = 'pending' and ai_summary is not null

  -- ---- REVIEW: expected to be non-zero; watch the trend -----------------

  union all
  select 9, 'REVIEW', 'duplicate_citation_in_part', count(*), 83,
         'Same citation twice inside one regulation AND one Part. Usually a mislabelled source line. NOTE: must group by reg AND part - grouping by reg alone reports 1,312 and is 94% false positives, because ids carry the Part letter and Part A''s "I.A.1." is not Part B''s.'
  from (select split_part(id,'-',2) r, split_part(id,'-',3) p, citation
        from provisions where citation is not null and citation <> ''
        group by 1,2,3 having count(*) > 1) d

  union all
  select 10, 'REVIEW', 'provisions_without_neighbours', count(*), 106,
         'No semantic neighbours, so the "related sections" panel renders empty. Cause is the neighbours function, not the UI. Parked until after launch.'
  from provisions p
  where not exists (select 1 from provision_neighbors n where n.provision_id = p.id)

  -- ---- INFO: low confidence, eyeball occasionally -----------------------

  union all
  select 11, 'INFO', 'self_referencing_xref', count(*), 525,
         'A provision cross-referencing itself (525 links across 87 provisions). Mostly legitimate regulatory phrasing ("nothing in this Section I.B.30.b. shall..."), but it renders as a link that previews the section you are already reading.'
  from cross_references where from_provision_id = target_provision_id

  union all
  select 12, 'INFO', 'summary_longer_than_long_text', count(*), 202,
         'Summary longer than a provision of 500+ chars. Weak signal - dense technical provisions legitimately produce long summaries. The naive version (no length floor) fires on 9,491 rows and is useless, because short "REPEALED" stubs always have longer summaries.'
  from plain
  where ai_summary is not null and length(txt) > 500
    and length(btrim(ai_summary)) > length(txt)

  -- ---- GUARDS that need to run as a real role, not as postgres -----------

  union all
  select 13, 'GUARD', 'broken_privilege_chain', count(*), 0,
         'Any SECURITY INVOKER function that anon or authenticated may call, which calls a SECURITY DEFINER function they lack EXECUTE on. This is exactly the shape that took keyword search down on 19 Sep 2026 and went unnoticed because the rest of this suite runs as postgres. Expect 0.'
         || coalesce(' Offenders: ' || string_agg(b.invoker_fn || ' -> ' || b.calls_definer, '; '), '')
  from (
    with defs as (
      select p.oid, n.nspname||'.'||p.proname as fq, p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.prokind='f' and p.prosecdef
    ),
    invokers as (
      select p.oid, n.nspname, p.proname,
             pg_get_function_identity_arguments(p.oid) as args, p.prosrc,
             has_function_privilege('anon',          p.oid,'EXECUTE') as anon_x,
             has_function_privilege('authenticated', p.oid,'EXECUTE') as auth_x
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.prokind='f' and not p.prosecdef and n.nspname='public'
        and (has_function_privilege('anon',          p.oid,'EXECUTE')
          or has_function_privilege('authenticated', p.oid,'EXECUTE'))
    )
    select 'broken_privilege_chain' as check_name,
           i.nspname||'.'||i.proname||'('||i.args||')' as invoker_fn,
           d.fq as calls_definer
    from invokers i
    join defs d on i.prosrc ~ ('\m'||d.proname||'\s*\(')
    where (i.anon_x and not has_function_privilege('anon',          d.oid,'EXECUTE'))
       or (i.auth_x and not has_function_privilege('authenticated', d.oid,'EXECUTE'))
  ) b

  union all
  select 14, 'GUARD', 'rpc_smoke_as_real_roles', count(*) filter (where r.verdict !~ '^ok'), 0,
         'Step 0 above actually executed search_provisions / context_path / provision_path as anon and as authenticated (subscriber and non-subscriber). Counts rows that did not come back ok. Results: '
         || string_agg(r.caller || ' | ' || r.what || ' | ' || r.verdict, ' ;; ')
  from pg_temp.rpc_smoke_results r
)
select severity, check_name, n,
       case when severity in ('ERROR','GUARD') and n <> expected then '*** CHECK ***'
            when n <> expected then 'moved (was ' || expected || ')'
            else 'as expected' end as verdict,
       expected as baseline_2026_09_22,
       what_it_catches
from checks
order by ord;

-- ============================================================================
-- Checks deliberately NOT included, and why
-- ============================================================================
-- * "text starts with its own citation" (5,941 rows). Not a defect - it is how
--   headings and short leaf rows are stored. It was a RENDER bug in
--   withItemIdBadge(), fixed there. Do not add it as a data check.
--
-- * "summary longer than provision" with no length floor: 9,491 hits, all noise.
--   Use check 12's 500-char floor instead.
--
-- * "duplicate citation" grouped by regulation only: 1,312 hits, ~94% false
--   positives. Must include the Part. See check 9.
--
-- * summary_status = 'pending' on its own: ~16,840 rows, all correct by design
--   (structural rows under the 25-word summariser threshold). Always pair it
--   with ai_summary IS NOT NULL. See check 8.
-- ============================================================================
