-- 010_keyword_query.sql — Ask keyword side understands acronyms properly.
-- "ecd testing" used to be ANDed as ecd & enclosed & combustion & device &
-- testing (only an 85k-char statement of basis has all five), then fell back
-- to any-word, where long documents win on term count. Now the app passes a
-- to_tsquery string with OR-groups — (ecd | enclosed<->combustion<->device)
-- & testing — and ts_rank is length-normalised (flag 1). websearch(query_text)
-- remains the path when keyword_query is null.
select '[1,2,3]'::extensions.vector;

drop function if exists public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean);

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

revoke all on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) from public, anon;
grant execute on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) to authenticated, service_role;
