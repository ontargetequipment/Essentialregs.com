-- ============================================================================
-- EssentialRegs — corpus quality checks
-- ============================================================================
-- Run this in the Supabase SQL editor after EVERY import, re-import or
-- summarizer run. It returns one row per check with a count and a verdict.
--
-- Baseline taken 2026-09-22 against 36,517 provisions. The "expected" column
-- is what the corpus looked like then; investigate anything that moves.
-- Checks 1, 2, 3 and 8 were corrected on 3 Oct 2026 after the first
-- pull-request qa run (PR #42): 1 gained a hand-verified allowlist, 2
-- allows a footnote "*", 3 matches the footer signature rather than the
-- bare phrase, and 8 is a REVIEW trend (baseline 3,160) rather than a GUARD
-- at 0, because Phase 0 put 3,163 regenerated parents into pending on
-- purpose. Checks 1-3 and 8 print their hit ids so a failure can be read
-- from the job summary without a second query.
--
-- ReviewBuiltIn (owner decision, 5 Oct 2026; built 6 Oct 2026): three GUARD
-- checks make the review step mandatory. 19 approved_without_review_date
-- (an approved/edited row with no reviewed_at), 21 approved_outside_pipeline
-- (an approved/edited row whose reviewed_by does not contain 'automated
-- pipeline' -- it replaced the looser 'starts with Claude (' test of 4 Oct),
-- and 25 summary_pending_over_24h (a summary that has sat pending for more
-- than 24 hours, less the short allow-list pending_allowlist below, each
-- entry with its reason). All three are expected 0; the qa job on every pull
-- request and the daily "Summary guard" workflow
-- (.github/workflows/summary-guard.yml) both fail on them, and the daily run
-- opens the issue "Summary guard failed". Production also carries the
-- trigger provisions_summary_approval_only_by_pipeline (migration
-- 20261006090000), which refuses an approval outside the pipeline outright.
--
-- Checks 26 and 27 (Test Methods, 9 Oct 2026) guard the method links the
-- importers write into the text (every /test-methods/<slug> href names an
-- entry in src/data/test-methods.json, through the generated
-- scripts/test-method-slugs.sql loaded ahead of this file, Step 0d) and the
-- provision_method_citations rows the "Cited by" lists read (no dangling
-- provision or slug; 0 while the table's migration is not applied yet).
--
-- Every check here corresponds to a defect that has ALREADY happened once and
-- is recorded in EssentialRegs_Known_Issues_and_Fixes.md. This file exists so
-- the next one is caught by a query instead of by somebody noticing.
--
-- Calibration note: several obvious-looking checks were tried and rejected
-- because they cried wolf. They are documented at the bottom so nobody
-- "helpfully" adds them back.
--
-- Checks 13, 14 and 15 are different in kind: they test GRANTS, RLS and the
-- entitlement guard, not the corpus. They exist because this suite runs as
-- postgres and therefore scored the 19 Sep 2026 keyword-search outage (42501
-- inside search_provisions) as healthy for three days. Check 16 tests the
-- keyword RANKING (backlog #15): it exists because for two weeks every
-- "requirements" search returned a first page of Statements of Basis and
-- nobody had a query that would have said so. Check 17 tests the
-- oil-and-gas tie-break on that ranking (backlog #21) and, unlike 16, takes
-- its probe from Step 0b, which runs as the subscriber: the pool-stage
-- multipliers only mean anything for a caller who gets breadcrumbs. Check 18
-- pins the closed-permit list (Ask Track A, 20260930003325): the database's
-- closed_permit_reg_keys() and the app's GP_CLOSURE_NOTE must name the same
-- permits, so a change to either fails loudly until both move. Check 20
-- (Ask Track B, 1 Oct 2026) verifies that every provision id a question map
-- names (src/lib/question-maps.ts) exists: the ids arrive through the
-- generated scripts/question-map-ids.sql, which must be loaded first (CI
-- passes it as the first -f; in the SQL editor paste it ahead of this file
-- in the same run). Check 21 (4 Oct 2026) guards the AI-generated label (reworded 9 Oct 2026):
-- an approved or edited summary whose reviewed_by was not stamped by the AI
-- second pass is a human-only approval the site would mislabel, so it fails
-- the qa job until the pass runs on it. Checks 22-24 (Sprint 3, Oct 2026)
-- guard the official text itself: no math-italic equation glyphs (22), no
-- split-letter runs (23), no Markdown markers (24); each names a curated
-- importer fix to add rather than a row to edit. Run the whole file, top to bottom,
-- in one go: Steps 0, 0b and 0c must run before the main query.
-- ============================================================================

-- ============================================================================
-- Step 0 — role-aware smoke test (runs BEFORE the main query below)
-- ============================================================================
-- Everything else in this file runs as postgres, a superuser. A superuser
-- holds EXECUTE on every function and bypasses RLS, so it cannot see a grant
-- bug. That is exactly how keyword search stayed "healthy" here for three
-- days (19-22 Sep 2026) while every real user got
--   42501 permission denied for function provision_path
-- from search_provisions(). This step executes the user-facing RPCs as the
-- roles real callers actually use. Failures are recorded as rows, never
-- raised, so the suite always finishes. Check 14 reports the result.
--
-- Cases (want_min / want_max = acceptable row count from the probe; want_err
-- = the probe MUST fail, with "SQLSTATE: message" matching this regex):
--   anon            search_provisions must run and see the sample rows;
--                   context_path must run on the sample rows;
--                   provision_path on a paywalled id must be NULL (RLS bypass
--                   guard - provision_path is SECURITY DEFINER);
--                   match_provisions / match_provisions_hybrid must fail with
--                   "permission denied for function" (no EXECUTE for anon).
--   authenticated   a signed-in NON-subscriber: the first three expectations,
--                   and match_provisions / match_provisions_hybrid must raise
--                   42501. Both are SECURITY DEFINER (RLS bypassed) and the
--                   has_full_access() line at the top of each body is their
--                   entire paywall; this is the case that catches its removal.
--   authenticated   an entitled profile: search returns paths, provision_path
--                   on a paywalled id is non-NULL, and both Ask RPCs run.
-- The Ask RPCs are called with a zero vector of the embedding column's
-- dimension (<DIM>, read from the catalog): enough to reach the guard, and
-- the entitled call proves the negative cases are not passing by accident.
drop table if exists pg_temp.rpc_smoke_results;
create temp table rpc_smoke_results (caller text, what text, verdict text);

do $smoke$
declare
  c            record;
  n            bigint;
  entitled_sub text;
  paywalled_id text;
  claims       text;
  embed_dim    integer;
  probe_sql    text;
begin
  -- pgvector stores the dimension as the column's typmod.
  select a.atttypmod into embed_dim
  from pg_attribute a
  where a.attrelid = 'public.provision_embeddings'::regclass and a.attname = 'embedding';

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
       $q$select count(*) from public.search_provisions('emissions', 25)$q$, 1, null, null),
      ('anon', '{"role":"anon"}', false,
       'context_path on sample rows',
       $q$select count(public.context_path(p)) from public.provisions p where p.is_public$q$, 1, null, null),
      ('anon', '{"role":"anon"}', false,
       'provision_path(paywalled id) must be NULL',
       $q$select count(*) from (select 1 where public.provision_path(%L) is not null) x$q$, 0, 0, null),
      ('anon', '{"role":"anon"}', false,
       'match_provisions must be unexecutable (no EXECUTE for anon)',
       $q$select count(*) from public.match_provisions(('[' || rtrim(repeat('0,', <DIM>), ',') || ']')::extensions.vector, 5)$q$, null, null,
       '^42501: permission denied for function match_provisions$'),
      ('anon', '{"role":"anon"}', false,
       'match_provisions_hybrid must be unexecutable (no EXECUTE for anon)',
       $q$select count(*) from public.match_provisions_hybrid('setback', ('[' || rtrim(repeat('0,', <DIM>), ',') || ']')::extensions.vector, 5)$q$, null, null,
       '^42501: permission denied for function match_provisions_hybrid$'),
      -- signed in, not entitled --------------------------------------------
      ('authenticated', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}', false,
       'search_provisions(''emissions'') as non-subscriber',
       $q$select count(*) from public.search_provisions('emissions', 25)$q$, 1, null, null),
      ('authenticated', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}', false,
       'provision_path(paywalled id) must be NULL as non-subscriber',
       $q$select count(*) from (select 1 where public.provision_path(%L) is not null) x$q$, 0, 0, null),
      -- The entitlement guard on the SECURITY DEFINER Ask RPCs. Any 42501 is
      -- the paywall holding (the in-body raise, or a revoked EXECUTE).
      ('authenticated', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}', false,
       'match_provisions must raise 42501 as non-subscriber',
       $q$select count(*) from public.match_provisions(('[' || rtrim(repeat('0,', <DIM>), ',') || ']')::extensions.vector, 5)$q$, null, null,
       '^42501: '),
      ('authenticated', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000"}', false,
       'match_provisions_hybrid must raise 42501 as non-subscriber',
       $q$select count(*) from public.match_provisions_hybrid('setback', ('[' || rtrim(repeat('0,', <DIM>), ',') || ']')::extensions.vector, 5)$q$, null, null,
       '^42501: '),
      -- signed in, entitled ------------------------------------------------
      ('authenticated', '{"role":"authenticated","sub":"<SUB>"}', true,
       'search_provisions(''setback'') rows with a path as subscriber',
       $q$select count(path) from public.search_provisions('setback', 25)$q$, 1, null, null),
      ('authenticated', '{"role":"authenticated","sub":"<SUB>"}', true,
       'provision_path(paywalled id) must be non-NULL as subscriber',
       $q$select count(*) from (select 1 where public.provision_path(%L) is not null) x$q$, 1, 1, null),
      ('authenticated', '{"role":"authenticated","sub":"<SUB>"}', true,
       'match_provisions runs as subscriber',
       $q$select count(*) from public.match_provisions(('[' || rtrim(repeat('0,', <DIM>), ',') || ']')::extensions.vector, 5)$q$, 1, null, null),
      ('authenticated', '{"role":"authenticated","sub":"<SUB>"}', true,
       'match_provisions_hybrid(''setback'') runs as subscriber',
       $q$select count(*) from public.match_provisions_hybrid('setback', ('[' || rtrim(repeat('0,', <DIM>), ',') || ']')::extensions.vector, 5)$q$, 1, null, null)
    ) v(role, claims, needs_entitled, what, sql, want_min, want_max, want_err)
  loop
    if c.needs_entitled and entitled_sub is null then
      insert into rpc_smoke_results values (c.role, c.what, 'skipped: no entitled profile to test with');
      continue;
    end if;
    claims := replace(c.claims, '<SUB>', coalesce(entitled_sub, ''));
    probe_sql := replace(c.sql, '<DIM>', coalesce(embed_dim::text, '0'));
    begin
      perform set_config('request.jwt.claims', claims, true);
      execute format('set local role %I', c.role);
      execute format(probe_sql, paywalled_id) into n;
      reset role;
      if c.want_err is not null then
        insert into rpc_smoke_results values (c.role, c.what, format('FAIL: ran without error (%s rows); wanted an error matching %s', n, c.want_err));
      elsif (c.want_min is not null and n < c.want_min) or (c.want_max is not null and n > c.want_max) then
        insert into rpc_smoke_results values (c.role, c.what, format('FAIL: %s rows, wanted %s..%s', n, coalesce(c.want_min::text, '-'), coalesce(c.want_max::text, '-')));
      else
        insert into rpc_smoke_results values (c.role, c.what, format('ok (%s rows)', n));
      end if;
    exception when others then
      reset role;  -- the failed subtransaction already restored it; belt and braces
      if c.want_err is not null and (sqlstate || ': ' || sqlerrm) ~ c.want_err then
        insert into rpc_smoke_results values (c.role, c.what, format('ok (raised %s: %s)', sqlstate, sqlerrm));
      else
        insert into rpc_smoke_results values (c.role, c.what, format('FAIL %s: %s', sqlstate, sqlerrm));
      end if;
    end;
  end loop;
  reset role;
end
$smoke$;

-- ============================================================================
-- Step 0b — keyword ranking as the subscriber (runs BEFORE the main query)
-- ============================================================================
-- Check 16 runs its searches as postgres, where provision_path() returns NULL
-- and the pool-stage multipliers in search_provisions() (the Definitions
-- x0.8, the other-sector x0.7 from 20260926230949) are either inert or
-- unobservable next to what a real subscriber sees. The reviewer's failing
-- case for backlog #21, "fugitive emissions", is decided by exactly those
-- rows (a Common Provisions definition, Reg 25, Reg 1 against GP09/GP10/
-- GP12), so this probe runs search_provisions('fugitive emissions', 10,
-- false) as the same entitled profile Step 0 uses and records the top 3 for
-- check 17. Rows are collected while the role is set and written after it
-- is reset (the temp table belongs to postgres). Failures are recorded, not
-- raised, so the suite always finishes.
drop table if exists pg_temp.keyword_oil_gas_top3;
create temp table keyword_oil_gas_top3 (ord integer, id text, reg_key text, citation text, note text);

do $oilgas$
declare
  entitled_sub text;
  top3         jsonb;
begin
  select id::text into entitled_sub
  from public.profiles
  where access_granted or subscription_status in ('active', 'trialing')
  order by id limit 1;

  if entitled_sub is null then
    insert into keyword_oil_gas_top3 (ord, note) values (0, 'skipped: no entitled profile to test with');
    return;
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('role', 'authenticated', 'sub', entitled_sub)::text, true);
    set local role authenticated;
    select jsonb_agg(jsonb_build_object('ord', s.ord, 'id', s.id, 'reg_key', s.reg_key, 'citation', s.citation) order by s.ord)
      into top3
    from public.search_provisions('fugitive emissions', 10, false)
         with ordinality as s(id, citation, title, reg_key, headline, rank, path, is_basis, ord)
    where s.ord <= 3;
    reset role;
    insert into keyword_oil_gas_top3 (ord, id, reg_key, citation)
    select r.ord, r.id, r.reg_key, r.citation
    from jsonb_to_recordset(coalesce(top3, '[]'::jsonb)) as r(ord integer, id text, reg_key text, citation text);
  exception when others then
    reset role;
    insert into keyword_oil_gas_top3 (ord, note) values (0, format('FAIL %s: %s', sqlstate, sqlerrm));
  end;
end
$oilgas$;

-- ============================================================================
-- Step 0c — question-map ids (runs BEFORE the main query)
-- ============================================================================
-- scripts/question-map-ids.sql (generated from src/lib/question-maps.ts by
-- scripts/question-map-ids.ts; npm test fails while it is stale) creates
-- pg_temp.question_map_ids. SQL cannot read the TypeScript file, so that
-- file is the one way the ids reach this suite. Check 20 reads the result
-- table below: one row per id missing from provisions, or one "not loaded"
-- row when the generated file was not run first -- never a parse error, so
-- the suite still finishes when it is run on its own.
drop table if exists pg_temp.question_map_missing;
create temp table question_map_missing (map_key text, id text, note text);

do $maps$
begin
  if to_regclass('pg_temp.question_map_ids') is null then
    insert into question_map_missing (note)
    values ('question_map_ids not loaded: run scripts/question-map-ids.sql before this file');
    return;
  end if;
  insert into question_map_missing (map_key, id)
  select m.map_key, m.id
  from pg_temp.question_map_ids m
  where not exists (select 1 from public.provisions p where p.id = m.id);
end
$maps$;

-- ============================================================================
-- Step 0d — Test Methods slugs (runs BEFORE the main query)
-- ============================================================================
-- scripts/test-method-slugs.sql (generated from src/data/test-methods.json
-- by scripts/test-method-slugs.ts; npm test fails while it is stale) creates
-- pg_temp.test_method_slugs: the slugs the Test Methods pages exist for and
-- the only ones the importers' linker (pipeline/method_links.py) may write.
-- Check 26 reads pg_temp.test_method_link_problems: one row per
-- (provision, slug) whose full_text carries href="/test-methods/<slug>" for
-- a slug the data file does not have (a link that 404s), or one "not
-- loaded" row when the generated file was not run first. Check 27 reads
-- pg_temp.test_method_citation_problems: rows of provision_method_citations
-- (migration 20261009005000) whose provision_id or method_slug dangles --
-- or nothing, with a note, while the table does not exist yet (the
-- migration is applied after the pull request that adds it merges), so the
-- suite never fails on a table it cannot see.
drop table if exists pg_temp.test_method_link_problems;
create temp table test_method_link_problems (id text, slug text, note text);
drop table if exists pg_temp.test_method_citation_problems;
create temp table test_method_citation_problems (provision_id text, slug text, note text);

do $methods$
begin
  if to_regclass('pg_temp.test_method_slugs') is null then
    insert into test_method_link_problems (note)
    values ('test_method_slugs not loaded: run scripts/test-method-slugs.sql before this file');
    insert into test_method_citation_problems (note)
    values ('test_method_slugs not loaded: run scripts/test-method-slugs.sql before this file');
    return;
  end if;
  insert into test_method_link_problems (id, slug)
  select distinct p.id, m[1]
  from public.provisions p,
       regexp_matches(coalesce(p.full_text, ''), 'href="/test-methods/([^"]*)"', 'g') m
  where not exists (select 1 from pg_temp.test_method_slugs s where s.slug = m[1]);
  if to_regclass('public.provision_method_citations') is null then
    -- The table arrives with migration 20261009005000; until then there is
    -- nothing to dangle. Not counted as a problem (see check 27).
    return;
  end if;
  insert into test_method_citation_problems (provision_id, slug)
  select c.provision_id, c.method_slug
  from public.provision_method_citations c
  where not exists (select 1 from public.provisions p where p.id = c.provision_id)
     or not exists (select 1 from pg_temp.test_method_slugs s where s.slug = c.method_slug);
end
$methods$;

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
-- Check 1 allowlist: rows whose opening clause legitimately recurs because
-- the source is a run of parallel paragraphs, each read by hand on
-- 2 Oct 2026. A NEW hit on check 1 must be read the same way, never added
-- here blindly: the Reg 3 Part F signature it exists for looks identical.
-- Check 25 allow-list: rows that cannot be verified by the automated
-- reviewer and are left pending on purpose (ReviewBuiltIn item 4). Every
-- entry carries its reason and the date it was last tried; a row leaves the
-- list the moment it is approved. Keep it short: a long list here is the
-- problem the check exists to catch.
pending_allowlist (id, reason) as (
  values
    -- Empty since 6 Oct 2026: the 13 rows the October re-review left pending
    -- were all approved by the first chained run after PR #67 (run
    -- 37480868158; 9 passed as written, 4 corrected). Add a row here only
    -- when the reviewer has failed it twice and it cannot be verified, with
    -- the reason and the date; remove it the moment it is approved.
    ('__none__', 'placeholder: no row is allow-listed; replace this entry with the first real one')
),
repeated_text_allowlist (id, reason) as (
  values
    ('sec-jjjj-60.4231-(b)',  'JJJJ s 60.4231(b): parallel paragraph; each sub-item reopens "Stationary SI internal combustion engine manufacturers must certify..."'),
    ('sec-jjjj-60.4231-(c)',  'JJJJ s 60.4231(c): same parallel opening as (b) and (d)'),
    ('sec-jjjj-60.4231-(d)',  'JJJJ s 60.4231(d): same parallel opening as (b) and (c)'),
    ('sec-jjjj-60.4245-(b)',  'JJJJ s 60.4245(b): sub-items reopen "For all stationary SI emergency ICE greater than or equal to 500 HP..." (2 repeats on 3 Oct 2026, under the threshold; listed because it was read with the others)'),
    ('sec-iiii-60.4210-(c)',  'IIII s 60.4210(c): sub-items reopen "Stationary CI internal combustion engine manufacturers must meet the requirements of 40 CFR..."'),
    ('sec-ecmc-803-d-(1)',    'ECMC 803.d.(1): sub-items each reopen "Form 31, Underground Injection Formation Permit Application..."')
),
-- Check 28: every cross-reference target in the text, by kind.
xref_targets as (
  select p.id as src, 'data-target' as kind, m[1] as target
  from provisions p, regexp_matches(p.full_text, 'data-target="([^"]+)"', 'g') m
  union all
  select p.id, 'data-provision-id', m[1]
  from provisions p, regexp_matches(p.full_text, 'data-provision-id="([^"]+)"', 'g') m
  union all
  select p.id, 'href-hash', m[1]
  from provisions p, regexp_matches(p.full_text, 'href="/regulations/[^"#?]*(?:\?[^"#]*)?#([^"]+)"', 'g') m
  union all
  select p.id, 'href-document', 'sec-' || m[1] || '-top-REG-' || m[1]
  from provisions p, regexp_matches(p.full_text, 'href="/regulations/([A-Za-z0-9]+)"', 'g') m
),
xref_targets_missing as (
  select distinct t.src, t.kind, t.target
  from xref_targets t
  where not exists (select 1 from provisions x where x.id = t.target)
),
checks as (

  -- ---- ERRORS: investigate every hit ------------------------------------

  select 1 as ord, 'ERROR' as severity, 'repeated_text_block' as check_name, count(*) as n, 0 as expected,
         'First 50 chars recur 3+ times inside one row. This is the Reg 3 Part F signature (a row that swallowed every restarted "3." in an entry) and the duplicate-label merge signature. Hits in repeated_text_allowlist (above) are excluded: CFR parallel paragraphs that legitimately begin with the same clause (JJJJ s 60.4231(b)-(d), s 60.4245(b), IIII s 60.4210(c), ECMC 803.d.(1)), each verified by hand on 2 Oct 2026. A new hit must be read, not added to the allowlist blindly.'
         || coalesce(' Hits: ' || string_agg(plain.id, ', ' order by plain.id), '') as what_it_catches
  from plain
  where length(txt) > 200 and (length(txt) - length(replace(txt, left(txt,50), ''))) / 50 >= 3
    and plain.id not in (select id from repeated_text_allowlist)

  union all
  select 2, 'ERROR', 'truncated_summary', count(*), 0,
         'ai_summary does not end in terminal punctuation (. ! ? ) " ]), an optional footnote marker "*" allowed after it - the summarizer MAX_TOKENS cut-off that produced four mid-sentence ZZZZ table summaries and, on 3 Oct 2026, ten more. The summarizer now tests every primary answer with the same regex (WHOLE_ANSWER_RE in pipeline/summarize.py) and strips leaked <answer> tags before testing.'
         || coalesce(' Hits: ' || string_agg(id, ', ' order by id), '')
  from provisions
  where ai_summary is not null and btrim(ai_summary) <> '' and rtrim(ai_summary) !~ '[.!?)"\]]\*?$'

  union all
  select 3, 'ERROR', 'page_furniture_in_text', count(*), 0,
         'Printed page header/footer captured mid-provision: "CODE OF COLORADO REGULATIONS" followed within 60 characters by a "5 CCR 1001-" citation or a page number ("Page 12", "12 of 40"), or preceded within 20 characters by a bare page number. This is how a page number once became "45 days". The bare phrase alone is NOT a hit (3 Oct 2026): Reg 8 Part B I.C.14 defines the abbreviation "CCR", Common Provisions I.F is the abbreviations list and Reg 11 Part H III is an adoption heading, all legitimate text that names the Code.'
         || coalesce(' Hits: ' || string_agg(id, ', ' order by id), '')
  from plain
  where position('CODE OF COLORADO REGULATIONS' in upper(txt)) > 1
    and (txt ~* 'CODE OF COLORADO REGULATIONS.{0,60}(5 CCR 1001-|\mPage \d+|\d+ of \d+)'
         or txt ~* '\m\d{1,4}\M[^.,;:a-z]{0,20}CODE OF COLORADO REGULATIONS')

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
  select 7, 'GUARD', 'public_sample_rows',
         (count(*) filter (where is_public and reg_key is distinct from 'gp05'))
           + (count(*) filter (where not is_public and reg_key = 'gp05')), 4,
         'Rows visible to logged-out visitors outside the GP05 sample, plus any GP05 row that is NOT public. Must be exactly 4: the four /regs/<id> sample cards (Reg 7 I.D.3.a.(i), GP02 II.A.2, ECMC 604.a.(1), CP I.G.90) and nothing else. Since Sprint 4 (10 Oct 2026, migration 20261010120000_gp05_public_sample.sql) every GP05 row is public by design, the free sample read in the real reader (PUBLIC_READER_REGS in src/lib/destination.ts). More than 4 means paid content outside GP05 is leaking past the paywall, or a GP05 row (a re-import) lost its flag and the public reader has a hole.'
  from provisions

  -- ---- REVIEW: expected to be non-zero; watch the trend -----------------

  union all
  select 8, 'REVIEW', 'real_review_backlog', count(*), 3160,
         'Has a summary AND is still pending review. This is the GENUINE backlog - do not confuse it with the ~16,840 structural rows that are pending with ai_summary IS NULL and are never summarised by design. Phase 0 (30 Sep 2026) regenerated 3,163 parent summaries into pending by design; the reader labels them "AI-assisted, not yet reviewed". This number must only go DOWN as reviews land; a rise means a new batch wrote pending rows (the summarizer''s regenerated writes do, on purpose) and must be matched to a known run.'
  from provisions where summary_status = 'pending' and ai_summary is not null

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
         'Step 0 above actually executed search_provisions / context_path / provision_path / match_provisions / match_provisions_hybrid as anon and as authenticated (subscriber and non-subscriber), including the cases that MUST fail: the Ask RPCs as anon (no EXECUTE) and as a non-subscriber (42501 from the has_full_access() guard). Counts rows that did not come back ok. Results: '
         || string_agg(r.caller || ' | ' || r.what || ' | ' || r.verdict, ' ;; ')
  from pg_temp.rpc_smoke_results r

  union all
  select 15, 'GUARD', 'definer_without_entitlement_check', count(*), 0,
         'Any SECURITY DEFINER function in public that authenticated may execute, whose body reads provisions or provision_embeddings (so RLS is bypassed) and does NOT call has_full_access(). Today those functions are match_provisions and match_provisions_hybrid, and the one has_full_access() line at the top of each body is the entire paywall on the Ask tab (see the PAYWALL comment in each body). provision_path is exempt: its guard is inlined and documented (20260923035949). changelog_public is exempt (20261003160524): it joins provisions only for reg_key, returns counts per day/regulation/change type and no text, notes or ids, and is the public /changelog by design. Comment lines are stripped before matching so the warning comment cannot satisfy the check. Expect 0.'
         || coalesce(' Offenders: ' || string_agg(o.fn, '; '), '')
  from (
    select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ '\m(provisions|provision_embeddings)\M'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') !~ '\mhas_full_access\s*\(\s*\)'
      and p.proname not in ('provision_path', 'changelog_public')
  ) o

  -- ---- RANKING: keyword search must put the rules first -------------------

  union all
  select 16, 'GUARD', 'keyword_ranking_operative_first', count(*), 0,
         'Backlog #15 (20260926045912). Five subscriber searches that used to return a first page of Statements of Basis: "APEN requirements", "storage tank requirements", "well production facility", "produced water tank", and "OOOOb" (which put Table 5 ahead of the subpart). Each must return results; with include_basis=true no Statement of Basis may sit in the top 5; with include_basis=false (the page default) none may be returned at all; and "OOOOb" must return the subpart root sec-oooob-top-REG-oooob first. Runs as postgres, so RLS is bypassed (every row is visible) and provision_path() returns NULL, which makes the Definitions multiplier inert here; the basis and citation rules do not depend on it. Counts queries that break any of these. Expect 0.'
         || coalesce(' Offenders: ' || string_agg(k.q || ' -> ' || k.why, '; '), '')
  from (
    select v.q, string_agg(f.problem, ', ') as why
    from (values ('APEN requirements'), ('storage tank requirements'), ('well production facility'),
                 ('produced water tank'), ('OOOOb')) v(q)
    cross join lateral (
      select 'no results' as problem
      where not exists (select 1 from public.search_provisions(v.q, 1, false))
      union all
      select 'Statement of Basis in top 5 with include_basis=true'
      where exists (select 1 from public.search_provisions(v.q, 5, true) s where s.is_basis)
      union all
      select 'Statement of Basis returned with include_basis=false'
      where exists (select 1 from public.search_provisions(v.q, 25, false) s where s.is_basis)
      union all
      select 'first hit is not the subpart root'
      where v.q = 'OOOOb'
        and (select s.id from public.search_provisions(v.q, 1, false) s) is distinct from 'sec-oooob-top-REG-oooob'
    ) f
    group by v.q
  ) k

  union all
  select 17, 'GUARD', 'keyword_ranking_oil_gas_first', count(*), 0,
         'Backlog #21 (20260926230949). Step 0b ran search_provisions(''fugitive emissions'', 10, false) as the entitled subscriber and kept the top 3. For this ambiguous industry term the oil-and-gas requirement must win: the top 3 must contain at least one row from Regulation 7, the ECMC rules or a general permit (GP01-GP12), and none from a regulation non_oil_gas_reg_keys() down-weights (Regulation 25 surface coating and Regulation 1 fugitive dust were the reviewer''s two examples). Counts violations, plus a probe that did not run. Expect 0.'
         || coalesce(' Top 3: ' || (select string_agg(t.reg_key || ' ' || t.citation, ', ' order by t.ord) from pg_temp.keyword_oil_gas_top3 t where t.note is null), '')
         || coalesce(' Problems: ' || string_agg(p.problem, '; '), '')
  from (
    select 'probe did not run (' || t.note || ')' as problem
    from pg_temp.keyword_oil_gas_top3 t where t.note is not null
    union all
    select 'fewer than 3 rows returned (' || count(*) || ')'
    from pg_temp.keyword_oil_gas_top3 t where t.note is null
    having count(*) between 1 and 2
    union all
    select 'no Regulation 7 / ECMC / general permit row in the top 3'
    where exists (select 1 from pg_temp.keyword_oil_gas_top3 t where t.note is null)
      and not exists (select 1 from pg_temp.keyword_oil_gas_top3 t
                      where t.note is null and (t.reg_key in ('7', 'ecmc') or t.reg_key ~ '^gp\d\d$'))
    union all
    select 'down-weighted regulation in the top 3: ' || t.reg_key || ' ' || t.citation
    from pg_temp.keyword_oil_gas_top3 t
    where t.note is null and t.reg_key = any (public.non_oil_gas_reg_keys())
  ) p

  union all
  select 18, 'GUARD', 'closed_permit_keys_in_sync', count(*), 0,
         'Ask Track A (20260930003325). public.closed_permit_reg_keys() -- the permits match_provisions_hybrid multiplies by 0.6 unless the question names them -- must be exactly {gp09,gp10}, the keys of GP_CLOSURE_NOTE in src/lib/regulation-pure.ts (the "Closed to new registrations" badge; scripts/closed-permit.test.ts pins that side). When CDPHE closes or reopens a permit, change both and this literal together. Counts 1 when the sorted array differs. Expect 0.'
         || coalesce(' Got: {' || (select string_agg(k, ',' order by k) from unnest(public.closed_permit_reg_keys()) k) || '}', ' Got: null')
  from (
    select 1
    where (select array_agg(k order by k) from unnest(public.closed_permit_reg_keys()) k)
          is distinct from array['gp09', 'gp10']::text[]
  ) d

  union all
  select 19, 'GUARD', 'approved_without_review_date', count(*), 0,
         'Trust badge (1 Oct 2026; AI-generated label since 9 Oct 2026; ReviewBuiltIn guard since 6 Oct 2026). Every summary in the reader and on the Ask, keyword and related cards carries "AI-generated · automated check against source text" (with " · <reviewed_at>" in the reader) for summary_status approved/edited (summaryStatusBadge in src/lib/regulation-pure.ts). An approved or edited row with a null reviewed_at was not stamped by the review step, and renders the label with no date. Counts rows with summary_status in (approved, edited) and reviewed_at null. Expect 0 (the trigger provisions_summary_approval_only_by_pipeline refuses the write). When above 0, send the rows through pipeline/review.py; never edit reviewed_at by hand.'
         || coalesce(' Rows: ' || (select string_agg(id, ', ' order by id) from (select id from provisions where summary_status in ('approved', 'edited') and reviewed_at is null order by id limit 30) r), '')
  from provisions
  where summary_status in ('approved', 'edited') and reviewed_at is null

  union all
  select 21, 'GUARD', 'approved_outside_pipeline', count(*), 0,
         'AI-generated label (owner decision, 4 Oct 2026, reworded 9 Oct 2026; tightened 6 Oct 2026, ReviewBuiltIn). The badge reads "AI-generated · automated check against source text" for every approved or edited summary whose reviewed_by carries the pipeline stamp ("Reviewed" only when a person approved it), so the AI label is only true when pipeline/review.py has actually run on the row. Both of its stamps contain ''automated pipeline''. Counts rows with summary_status in (approved, edited) whose reviewed_by is null or does not contain ''automated pipeline'': each one is an approval made outside the pipeline (a hand pass, a script, the old admin Approve button) that the site would mislabel. Expect 0 (the trigger provisions_summary_approval_only_by_pipeline refuses the write; this check is the loud failure if the trigger is ever dropped). When above 0, set the rows back to pending and let the next review run stamp them; never edit reviewed_by by hand.'
         || coalesce(' Rows: ' || (select string_agg(id, ', ' order by id) from (select id from provisions where summary_status in ('approved', 'edited') and (reviewed_by is null or reviewed_by not ilike '%automated pipeline%') order by id limit 30) r), '')
  from provisions
  where summary_status in ('approved', 'edited') and (reviewed_by is null or reviewed_by not ilike '%automated pipeline%')

  union all
  select 25, 'GUARD', 'summary_pending_over_24h', count(*), 0,
         'ReviewBuiltIn (owner decision, 5 Oct 2026). Review runs in the same workflow run that writes a summary, so a summary that has been pending for more than 24 hours means a run died, was skipped, or the reviewer failed the row twice and nobody acted. Counts rows with a summary, summary_status pending and summary_generated_at (or, when that is null, updated_at) older than 24 hours, less the allow-listed ids in pending_allowlist (each with its reason). Expect 0. When above 0: re-run the summarize workflow for the ids (it reviews what it writes), or add the id to pending_allowlist with the reason it cannot be verified.'
         || coalesce(' Rows: ' || (select string_agg(id, ', ' order by id) from (select p.id from provisions p where p.ai_summary is not null and p.summary_status = 'pending' and coalesce(p.summary_generated_at, p.updated_at) < now() - interval '24 hours' and p.id not in (select id from pending_allowlist) order by p.id limit 30) r), '')
         || coalesce(' Allow-listed (still pending): ' || (select string_agg(p.id || ' (' || a.reason || ')', '; ' order by p.id) from provisions p join pending_allowlist a on a.id = p.id where p.summary_status = 'pending'), '')
  from provisions p
  where p.ai_summary is not null and p.summary_status = 'pending'
    and coalesce(p.summary_generated_at, p.updated_at) < now() - interval '24 hours'
    and p.id not in (select id from pending_allowlist)

  union all
  select 22, 'GUARD', 'math_glyphs_in_text', count(*), 0,
         'Sprint 3 (Oct 2026), GP equations. Was 4 in production until the Sprint 3 re-import of gp06 and gp12 on 4 Oct 2026 (PR #50); 0 since. The GP PDFs set their equations in Cambria Math and pdftotext renders them as doubled math-italic glyphs (U+1D400-U+1D7FF, italic h U+210E) and U+FFFD boxes; the importer now swaps those lines for the curated transcriptions in pipeline/curated_equations.json. Counts rows whose tag-stripped text still carries such a glyph. Expect 0 (was 4: GP12 III.F.3, IV.A.6.b, GP06 IV.C.1.b.(i), (ii)). When above 0, add the transcription to the curated file and re-import; never edit the row by hand.'
         || coalesce(' Rows: ' || (select string_agg(id, ', ' order by id) from (select id from provisions where regexp_replace(full_text, '<[^>]+>', '', 'g') ~ '[\U0001D400-\U0001D7FF\u210E\uFFFD]' order by id limit 30) r), '')
  from provisions
  where regexp_replace(full_text, '<[^>]+>', '', 'g') ~ '[\U0001D400-\U0001D7FF\u210E\uFFFD]'

  union all
  select 23, 'GUARD', 'split_letter_runs', count(*), 0,
         'Sprint 3 (Oct 2026), split-letter artifacts. Was 10 in production (8 GP01 rows, GP05 VIII.D.2, OOOOa 60.5413a(b)(3)(i)) until the Sprint 3 re-import on 4 Oct 2026 (PR #50); 0 since. pdftotext renders letter-spaced justified text one glyph per word ("t h e f o l l o w i n g", "o w n e r o r o p e r a t o r"); the importer re-spaces every known run (KNOWN_SPACING_FIXES in pipeline/import_ccr.py, letters and digits unchanged) and import_ecfr.py marks the OOOOa equation subscripts. Counts rows whose tag-stripped text has four or more single letters in a row separated by single spaces. Expect 0 (was 10 GP rows plus OOOOa 60.5413a(b)(3)(i)). When above 0, add a spacing fix for the printed run and re-import.'
         || coalesce(' Rows: ' || (select string_agg(id, ', ' order by id) from (select id from provisions where regexp_replace(full_text, '<[^>]+>', '', 'g') ~ '(?<![A-Za-z])(?:[A-Za-z] ){4,}[A-Za-z](?![A-Za-z])' order by id limit 30) r), '')
  from provisions
  where regexp_replace(full_text, '<[^>]+>', '', 'g') ~ '(?<![A-Za-z])(?:[A-Za-z] ){4,}[A-Za-z](?![A-Za-z])'

  union all
  select 24, 'GUARD', 'stray_markdown_in_text', count(*), 0,
         'Sprint 3 (Oct 2026). Official text never carries Markdown; a stored summary''s **bold**, __bold__, `code`, a heading marker opening a paragraph or a [text](http...) link inside full_text means a summary or an edit leaked into the official column. A footnote "**" after a number, the eCFR''s `quoted'' words and underscores inside an address (Oil__and__Gas__PT@EPA.GOV) are official text and do not match. Expect 0.'
         || coalesce(' Rows: ' || (select string_agg(id, ', ' order by id) from (select id from provisions where full_text ~ '(?<![A-Za-z0-9_*])\*\*[A-Za-z][^*\n]{0,80}\*\*(?![A-Za-z0-9_*])|(?<![A-Za-z0-9_])__[A-Za-z][^_\n]{0,80}__(?![A-Za-z0-9_])|`[^`\n]{1,80}`|(^|<p>)\s*#{1,6}\s|\]\(https?://' order by id limit 30) r), '')
  from provisions
  where full_text ~ '(?<![A-Za-z0-9_*])\*\*[A-Za-z][^*\n]{0,80}\*\*(?![A-Za-z0-9_*])|(?<![A-Za-z0-9_])__[A-Za-z][^_\n]{0,80}__(?![A-Za-z0-9_])|`[^`\n]{1,80}`|(^|<p>)\s*#{1,6}\s|\]\(https?://'

  union all
  select 20, 'GUARD', 'question_map_ids_exist', count(*), 0,
         'Ask Track B (1 Oct 2026). Every provision id a question map names in src/lib/question-maps.ts (the canonical rows the grouped Ask view fetches by id) must exist in provisions; a re-import that renumbers a section would otherwise leave a silent hole in the map. The ids come from the generated scripts/question-map-ids.sql (Step 0c), loaded ahead of this file. Counts missing ids, plus 1 when the generated file was not loaded. Expect 0.'
         || coalesce(' Missing: ' || (select string_agg(q.map_key || ' ' || q.id, ', ' order by q.map_key, q.id) from pg_temp.question_map_missing q where q.id is not null), '')
         || coalesce(' Problems: ' || (select string_agg(q.note, '; ') from pg_temp.question_map_missing q where q.note is not null), '')
  from pg_temp.question_map_missing

  union all
  select 26, 'GUARD', 'test_method_links_resolve', count(*), 0,
         'Test Methods (9 Oct 2026). Every href="/test-methods/<slug>" the importers wrote into provisions.full_text (pipeline/method_links.py, class xref-method) must name a slug in src/data/test-methods.json -- the data file is the linker''s allowlist, so a mismatch means a page was renamed or removed after the corpus was linked, and the link 404s in the reader. The slugs come from the generated scripts/test-method-slugs.sql (Step 0d), loaded ahead of this file. Counts distinct (provision, slug) pairs with no such entry, plus 1 when the generated file was not loaded. Expect 0. When above 0: restore the entry or re-link the corpus (the Import workflow, markup-only).'
         || coalesce(' Dangling: ' || (select string_agg(q.id || ' -> ' || q.slug, ', ' order by q.id, q.slug) from (select id, slug from pg_temp.test_method_link_problems where id is not null order by id, slug limit 30) q), '')
         || coalesce(' Problems: ' || (select string_agg(q.note, '; ') from pg_temp.test_method_link_problems q where q.note is not null), '')
  from pg_temp.test_method_link_problems

  union all
  select 27, 'GUARD', 'test_method_citations_dangle', count(*), 0,
         'Test Methods (9 Oct 2026). provision_method_citations (migration 20261009005000; the "Cited by" lists on /test-methods/<slug>) must have no row whose provision_id has no provision (the foreign key cascades, so this means the constraint was dropped) or whose method_slug is not in src/data/test-methods.json (a page the list would link that does not exist). Rows are rewritten per document by every executed import (import_ccr.write_method_citation_rows). Counts dangling rows, plus 1 when the generated slug file was not loaded; 0 while the table does not exist yet. Expect 0.'
         || coalesce(' Dangling: ' || (select string_agg(q.provision_id || ' -> ' || q.slug, ', ' order by q.provision_id, q.slug) from (select provision_id, slug from pg_temp.test_method_citation_problems where provision_id is not null order by provision_id, slug limit 30) q), '')
         || coalesce(' Problems: ' || (select string_agg(q.note, '; ') from pg_temp.test_method_citation_problems q where q.note is not null), '')
  from pg_temp.test_method_citation_problems

  union all
  select 28, 'GUARD', 'xref_targets_exist', count(*), 0,
         'Sprint 3 (fifth review, 9 Oct 2026). Every cross-reference target written into provisions.full_text must exist: a same-document data-target, a cross-document data-provision-id or /regulations/<key>#<id> hash, and the root row of every whole-document /regulations/<key> link. The reviewer found PHMSA cross-part links opening an empty preview; a link to a row that does not exist is the data side of that defect (the reader now follows the link instead of previewing it). Counts (provision, kind, target) triples with no such row. Expect 0. When above 0: re-import the citing document (markup-only) after the target is restored, or fix the importer''s resolver.'
         || coalesce(' Missing: ' || (select string_agg(q.src || ' ' || q.kind || ' ' || q.target, ', ' order by q.src, q.target) from (select * from xref_targets_missing order by src, target limit 30) q), '')
  from xref_targets_missing
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
