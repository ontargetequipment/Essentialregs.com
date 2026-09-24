-- 009_provision_path.sql — "where is this?" context on every search result
-- (Phase 5b follow-up). Adds provision_path(id): the chain of ancestor
-- headings below the regulation ("PART B — Oil and Natural Gas Operations ›
-- II. (State Only) Statewide Controls …"), skipping ancestors whose title is
-- just their number. Returned as `path` by search_provisions (keyword tab),
-- match_provisions and match_provisions_hybrid (Ask), and exposed to
-- PostgREST as the computed column provisions.context_path (Related panels).
--
-- Function-level SET hnsw.* below needs pgvector loaded in this session first.
select '[1,2,3]'::extensions.vector;

create or replace function public.provision_path(p_id text)
returns text
language sql stable security definer
set search_path = public
as $$
  with recursive up as (
    select p.parent_id, p.citation, p.title, 1 as depth
    from public.provisions p where p.id = p_id
    union all
    select p.parent_id, p.citation, p.title, up.depth + 1
    from public.provisions p join up on p.id = up.parent_id
    where up.depth < 12
  )
  select string_agg(coalesce(nullif(btrim(up.title), ''), up.citation), ' › ' order by up.depth desc)
  from up
  where up.depth > 1                 -- not the provision itself
    and up.parent_id is not null     -- not the regulation's top row
    and btrim(up.title) is distinct from btrim(up.citation);   -- skip bare numbering ("II.B.2.")
$$;
revoke all on function public.provision_path(text) from public;
grant execute on function public.provision_path(text) to anon, authenticated, service_role;

-- PostgREST computed column: select("id, citation, context_path") on provisions.
create or replace function public.context_path(p public.provisions)
returns text
language sql stable
set search_path = public
as $$ select public.provision_path(p.id) $$;
grant execute on function public.context_path(public.provisions) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Keyword search (003_search.sql) + path
-- ---------------------------------------------------------------------------
drop function if exists public.search_provisions(text, integer);

create or replace function public.search_provisions(q text, lim integer default 25)
returns table (id text, citation text, title text, reg_key text, headline text, rank real, path text)
language sql
stable
set search_path = public
as $$
  with query as (select websearch_to_tsquery('english', q) as tsq),
  hits as (
    select p.id, p.citation, p.title, p.full_text, ts_rank(p.search_vector, query.tsq) as rank
    from provisions p, query
    where p.search_vector @@ query.tsq
    order by rank desc, p.sort_order asc
    limit lim
  )
  select hits.id, hits.citation, hits.title,
    substring(hits.id from '^sec-([^-]+)-') as reg_key,
    ts_headline('english', regexp_replace(hits.full_text, '<[^>]+>', ' ', 'g'), query.tsq,
      'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1') as headline,
    hits.rank,
    public.provision_path(hits.id) as path
  from hits, query
  order by hits.rank desc;
$$;
grant execute on function public.search_provisions(text, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ask RPCs (008) + path — bodies unchanged apart from the added column
-- ---------------------------------------------------------------------------
drop function if exists public.match_provisions(extensions.vector, integer, text[], text, boolean);

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

revoke all on function public.match_provisions(extensions.vector, integer, text[], text, boolean) from public, anon;
grant execute on function public.match_provisions(extensions.vector, integer, text[], text, boolean) to authenticated, service_role;

drop function if exists public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean);

create or replace function public.match_provisions_hybrid(
  query_text          text,
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
  tsq_and := websearch_to_tsquery('english', coalesce(query_text, ''));
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
    else
      tsq := websearch_to_tsquery('english', regexp_replace(trim(coalesce(query_text, '')), '\s+', ' or ', 'g'));
    end if;
  end if;

  return query
  with kw as (
    select s.id as provision_id, row_number() over (order by s.rnk desc, s.sort_order) as kw_rank
    from (
      select p.id, p.sort_order, ts_rank(p.search_vector, tsq) as rnk
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

revoke all on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean) from public, anon;
grant execute on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean) to authenticated, service_role;
