-- Item A of the 2026-09-25 security hygiene PR: defence in depth on the two
-- semantic-search RPCs. Both are SECURITY DEFINER (they bypass RLS on
-- provisions and provision_embeddings) and are granted to authenticated, so
-- the one `if not public.has_full_access()` line at the top of each body is
-- the entire paywall for the Ask tab. Nothing in this file changes behaviour:
-- each body is re-issued byte-identical except for a comment block above that
-- check saying what it is and what removing it would do, so the next person
-- to edit these functions reads the warning before the guard.
--
-- No grants are touched. CREATE OR REPLACE on the same signature keeps the
-- existing ACL (postgres, authenticated, service_role; not anon); the QA
-- suite's broken_privilege_chain and the new definer_without_entitlement_check
-- and rpc_smoke_as_real_roles cases prove the guard and the grants after
-- apply.
--
-- Function-level SET hnsw.* below needs pgvector loaded in this session first.
select '[1,2,3]'::extensions.vector;

create or replace function public.match_provisions(
  query_embedding     extensions.vector(1024),
  match_count         integer default 20,
  reg_filter          text[]  default null,
  jurisdiction_filter text    default null,
  include_basis       boolean default true
)
returns table (
  id                 text,
  citation           text,
  title              text,
  reg_key            text,
  jurisdiction_level text,
  summary            text,
  score              real,
  is_basis           boolean,
  path               text       -- ancestor headings, e.g. 'PART B — … › II. …' (null when directly under the regulation)
)
language plpgsql
stable
security definer
set search_path = public, extensions
set hnsw.iterative_scan = relaxed_order
set hnsw.ef_search = 80
set plan_cache_mode = force_custom_plan   -- plan with the real filter values, not a generic plan
as $$
declare
  cand integer;
begin
  -- PAYWALL. This function is SECURITY DEFINER and granted to authenticated,
  -- so it reads public.provisions and public.provision_embeddings with RLS
  -- BYPASSED. The has_full_access() check directly below is the ONLY thing
  -- between a signed-in non-subscriber and the whole paid corpus. Removing
  -- it, moving it below the query, or making it conditional exposes every
  -- paid row, and RLS will not catch it. scripts/corpus_qa.sql asserts it two
  -- ways: definer_without_entitlement_check (this body must still contain
  -- has_full_access()) and the rpc_smoke_as_real_roles cases that call this
  -- function as a non-subscriber and expect SQLSTATE 42501.
  if not public.has_full_access() then
    raise exception 'semantic search requires an active subscription'
      using errcode = '42501';
  end if;
  if match_count is null or match_count < 1 or match_count > 50 then
    match_count := 20;
  end if;
  -- A filter makes the HNSW scan iterative (it keeps walking until enough rows
  -- pass), so ask for fewer candidates when filtering. Must be a plain
  -- variable: a LIMIT expression the planner can't size makes it abandon the
  -- vector index and sort every filtered row (seconds instead of ~50 ms).
  cand := case when reg_filter is null and jurisdiction_filter is null then match_count * 6 else match_count * 2 end;

  return query
  with hits as (
    select e.provision_id, e.is_basis,
           (1 - (e.embedding <=> query_embedding))::real as score
    from public.provision_embeddings e
    where (reg_filter is null or e.reg_key = any (reg_filter))
      and (jurisdiction_filter is null or e.jurisdiction = jurisdiction_filter)
      and (include_basis or not e.is_basis)
    order by e.embedding <=> query_embedding
    limit cand
  ),
  best as (
    select h.provision_id, bool_or(h.is_basis) as is_basis, max(h.score) as score
    from hits h group by h.provision_id
  )
  select p.id, p.citation, p.title,
         substring(p.id from '^sec-([^-]+)-') as reg_key,
         p.jurisdiction_level,
         case when p.summary_status = 'rejected' then null else p.ai_summary end as summary,
         b.score,
         b.is_basis,
         public.provision_path(p.id) as path
  from best b
  join public.provisions p on p.id = b.provision_id
  -- statements of basis sort as if 8% less similar: still found, rarely first
  order by (b.score * case when b.is_basis then 0.92 else 1.0 end) desc
  limit match_count;
end;
$$;

create or replace function public.match_provisions_hybrid(
  query_text          text,
  query_embedding     extensions.vector(1024),
  match_count         integer default 20,
  reg_filter          text[]  default null,
  jurisdiction_filter text    default null,
  include_basis       boolean default true,
  keyword_query       text    default null   -- to_tsquery syntax from lib/acronyms.ts keywordQuery(); null = websearch(query_text)
)
returns table (
  id                 text,
  citation           text,
  title              text,
  reg_key            text,
  jurisdiction_level text,
  summary            text,
  score              real,      -- cosine similarity when the vector search saw it, else null
  is_basis           boolean,
  keyword_hit        boolean,   -- true when full-text search also matched
  fused              real,      -- the RRF score actually sorted on
  path               text       -- ancestor headings, e.g. 'PART B — … › II. …' (null when directly under the regulation)
)
language plpgsql
stable
security definer
set search_path = public, extensions
set hnsw.iterative_scan = relaxed_order
set hnsw.ef_search = 80
set plan_cache_mode = force_custom_plan
as $$
declare
  k          constant integer := 60;          -- standard RRF constant
  pool       integer;
  sem_cand   integer;
  tsq        tsquery;
  tsq_and    tsquery;
  n_and      integer := 0;
begin
  -- PAYWALL. This function is SECURITY DEFINER and granted to authenticated,
  -- so it reads public.provisions and public.provision_embeddings with RLS
  -- BYPASSED. The has_full_access() check directly below is the ONLY thing
  -- between a signed-in non-subscriber and the whole paid corpus. Removing
  -- it, moving it below the query, or making it conditional exposes every
  -- paid row, and RLS will not catch it. scripts/corpus_qa.sql asserts it two
  -- ways: definer_without_entitlement_check (this body must still contain
  -- has_full_access()) and the rpc_smoke_as_real_roles cases that call this
  -- function as a non-subscriber and expect SQLSTATE 42501.
  if not public.has_full_access() then
    raise exception 'semantic search requires an active subscription'
      using errcode = '42501';
  end if;
  if match_count is null or match_count < 1 or match_count > 50 then
    match_count := 20;
  end if;
  pool := greatest(match_count * 3, 60);
  -- plain variable on purpose: see match_provisions
  sem_cand := case when reg_filter is null and jurisdiction_filter is null then pool * 2 else pool end;

  -- Keyword side: all words must match; if that finds almost nothing (a long
  -- natural-language question), fall back to any-word so ts_rank can still
  -- favour rows that share several terms with the question.
  -- Structured query when the app built one: (ecd | enclosed<->combustion<->device) & testing.
  if keyword_query is not null and btrim(keyword_query) <> '' then
    begin
      tsq_and := to_tsquery('english', keyword_query);
    exception when others then
      tsq_and := websearch_to_tsquery('english', coalesce(query_text, ''));
    end;
  else
    tsq_and := websearch_to_tsquery('english', coalesce(query_text, ''));
  end if;
  if tsq_and is not null and numnode(tsq_and) > 0 then
    select count(*) into n_and from (
      select 1 from public.provisions p
      where p.search_vector @@ tsq_and
        and (reg_filter is null or exists (select 1 from unnest(reg_filter) r where p.id like 'sec-' || r || '-%'))
        and (jurisdiction_filter is null or p.jurisdiction_level = jurisdiction_filter)
      limit 5
    ) c;
    if n_and >= 5 then
      tsq := tsq_and;
    elsif keyword_query is not null and btrim(keyword_query) <> '' then
      -- any-word fallback: loosen every AND to OR (inside acronym groups too)
      begin
        tsq := to_tsquery('english', replace(keyword_query, ' & ', ' | '));
      exception when others then
        tsq := tsq_and;
      end;
    else
      tsq := websearch_to_tsquery('english', regexp_replace(trim(coalesce(query_text, '')), '\s+', ' or ', 'g'));
    end if;
  end if;

  return query
  with kw as (
    select s.id as provision_id, row_number() over (order by s.rnk desc, s.sort_order) as kw_rank
    from (
      select p.id, p.sort_order, ts_rank(p.search_vector, tsq, 1) as rnk   -- /(1+log len): short operative paragraphs beat long basis statements
      from public.provisions p
      where tsq is not null and numnode(tsq) > 0
        and p.search_vector @@ tsq
        and (reg_filter is null or exists (select 1 from unnest(reg_filter) r where p.id like 'sec-' || r || '-%'))
        and (jurisdiction_filter is null or p.jurisdiction_level = jurisdiction_filter)
        and (include_basis or not public.is_basis_provision(p.id))
      order by rnk desc, p.sort_order
      limit pool
    ) s
  ),
  sem_hits as (
    select e.provision_id, e.is_basis,
           (1 - (e.embedding <=> query_embedding))::real as score
    from public.provision_embeddings e
    where (reg_filter is null or e.reg_key = any (reg_filter))
      and (jurisdiction_filter is null or e.jurisdiction = jurisdiction_filter)
      and (include_basis or not e.is_basis)
    order by e.embedding <=> query_embedding
    limit sem_cand
  ),
  sem as (
    select s.provision_id, bool_or(s.is_basis) as is_basis, max(s.score) as score,
           row_number() over (order by max(s.score) desc) as sem_rank
    from sem_hits s group by s.provision_id
  ),
  fusedset as (
    select coalesce(sem.provision_id, kw.provision_id) as provision_id,
           sem.score,
           coalesce(sem.is_basis, public.is_basis_provision(kw.provision_id)) as is_basis,
           (kw.provision_id is not null) as keyword_hit,
           (coalesce(1.0 / (k + sem.sem_rank), 0) + coalesce(1.0 / (k + kw.kw_rank), 0))::real as fused
    from sem full outer join kw on kw.provision_id = sem.provision_id
  )
  select p.id, p.citation, p.title,
         substring(p.id from '^sec-([^-]+)-') as reg_key,
         p.jurisdiction_level,
         case when p.summary_status = 'rejected' then null else p.ai_summary end as summary,
         f.score,
         f.is_basis,
         f.keyword_hit,
         (f.fused * case when f.is_basis then 0.85 else 1.0 end)::real as fused,
         public.provision_path(p.id) as path
  from fusedset f
  join public.provisions p on p.id = f.provision_id
  order by (f.fused * case when f.is_basis then 0.85 else 1.0 end) desc, f.score desc nulls last
  limit match_count;
end;
$$;
