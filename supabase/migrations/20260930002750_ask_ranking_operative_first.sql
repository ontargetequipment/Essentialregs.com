-- Ask (Track A, step 1): the keyword-search ranking, applied to Ask.
--
-- The problem. The second outside review scored Ask 6.5/10. Its storage-vessel
-- question ("What Colorado and federal requirements could apply to storage
-- vessels?") returned Regulation 7 Part C "S." -- an 11,836-word Statement of
-- Basis -- as the first result, then three Regulation 6 subpart-adoption stubs.
-- Keyword search stopped doing this on 26 Sep (20260926045912, 20260926230949)
-- but Ask has its own ranking path in match_provisions_hybrid and never got
-- the same treatment: basis rows were only x0.85, definitions and other-sector
-- regulations carried full weight, and a direct citation hit earned nothing.
--
-- The change, confined to the final ordering of match_provisions_hybrid.
-- Signature, return columns, grants, the access check and the RRF fusion are
-- untouched. Two stages, mirroring search_provisions:
--
--   Row-local stage (every fused candidate, cheap column tests):
--     x0.5  Statement of Basis          (was x0.85; same as keyword search)
--     x0.7  regulation about another sector (non_oil_gas_reg_keys(), #21)
--     x1.5  direct citation hit: the question's tsquery matches the row's
--           citation. Only for questions of at most three words, i.e. a
--           document identifier ("OOOOb", "GP01", "II.B.3"), never a sentence.
--   Pool stage (the best `pool` rows after the row-local stage, so that the
--   breadcrumb -- a recursive lookup -- is computed for at most 60-150 rows
--   and only reorders among good matches):
--     x0.8  under a Definitions heading, or a section titled
--           "What definitions apply..." (federal subparts)
--     x1.15 applicability: the row or an ancestor heading is an applicability
--           section ("Applicability", "Am I subject to...", "Who must
--           comply", "applies to"). This is the plan's doc-type order:
--           applicability first, Statement of Basis last; the rest of the
--           order is left to relevance.
--
-- Deliberately NOT in this migration (each is its own step so the effect can
-- be measured on the three reviewer questions between steps): jurisdiction
-- detection from the question, closed/superseded permit status, the semantic
-- score threshold, and the heading-only de-boost.
select '[1,2,3]'::extensions.vector;

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
  fused              real,      -- the score actually sorted on (RRF x the multipliers above)
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
  short_q    boolean;                          -- a document identifier, not a sentence
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
  short_q := array_length(regexp_split_to_array(btrim(coalesce(query_text, '')), '\s+'), 1) <= 3;

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
  ),
  -- Row-local stage: basis x0.5, other-sector regulation x0.7, direct
  -- citation hit x1.5 (short queries only). Cheap column tests on every
  -- fused candidate; the best `pool` go on to the breadcrumb stage.
  local_stage as (
    select f.provision_id, f.score, f.is_basis, f.keyword_hit,
           p.citation, p.title, p.sort_order, p.reg_key as stored_reg_key,
           (f.fused
             * case when f.is_basis then 0.5 else 1.0 end
             * case when p.reg_key = any (public.non_oil_gas_reg_keys()) then 0.7 else 1.0 end
             * case when short_q and tsq is not null and numnode(tsq) > 0
                         and to_tsvector('english', p.citation) @@ tsq then 1.5 else 1.0 end
           )::real as pre
    from fusedset f
    join public.provisions p on p.id = f.provision_id
    order by pre desc, f.score desc nulls last
    limit pool
  ),
  -- Pool stage: the breadcrumb once per pooled row; Definitions x0.8,
  -- applicability x1.15. Reorders among good matches only.
  pathed as (
    select l.*, public.provision_path(l.provision_id) as path
    from local_stage l
  ),
  scored as (
    select ph.*,
           (ph.pre
             * case when ph.path ~* '\mdefinitions?\M'
                      or ph.title ~* '^\s*§?\s*[0-9.]*[a-z]*\s*what definitions apply' then 0.8 else 1.0 end
             * case when ph.title ~* '\m(applicability|applies to|subject to|who must comply|am i subject)'
                      or ph.path ~* '\m(applicability|am i subject|who must comply)' then 1.15 else 1.0 end
           )::real as final_score
    from pathed ph
  )
  select p.id, p.citation, p.title,
         substring(p.id from '^sec-([^-]+)-') as reg_key,
         p.jurisdiction_level,
         case when p.summary_status = 'rejected' then null else p.ai_summary end as summary,
         s.score,
         s.is_basis,
         s.keyword_hit,
         s.final_score as fused,
         s.path
  from scored s
  join public.provisions p on p.id = s.provision_id
  order by s.final_score desc, s.score desc nulls last, p.sort_order
  limit match_count;
end;
$$;

comment on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) is
  'Ask search: RRF of vector + full-text, then the keyword-search multipliers: '
  'x0.5 Statement of Basis, x0.7 other-sector regulation (non_oil_gas_reg_keys), '
  'x1.5 direct citation hit on a <=3-word query; the best pool rows then get '
  'x0.8 under a Definitions heading and x1.15 for an applicability section. '
  'SECURITY DEFINER; refuses without has_full_access().';

-- CREATE OR REPLACE keeps the existing grants; re-stated for a from-scratch replay.
revoke all on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) from public, anon;
grant execute on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) to authenticated, service_role;
