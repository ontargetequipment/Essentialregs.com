-- Ask (Track A, step 2): jurisdiction awareness.
--
-- The problem. "What Colorado and federal requirements could apply to storage
-- vessels?" returned no federal row in its top 10 after step 1: the OOOOb /
-- OOOOa storage-vessel standards were in the candidate set but Colorado rows
-- outscored them one by one, and nothing in Ask read the word "federal".
--
-- The change, still confined to match_provisions_hybrid's final ordering.
-- The question text is scanned for jurisdiction words:
--   federal: federal, EPA, CFR, NSPS, NESHAP, subpart, OOOO/OOOOa/b/c, JJJJ,
--            IIII, ZZZZ, PHMSA, U.S.
--   state:   Colorado, state, CDPHE, APCD, AQCC, ECMC, COGCC, "Regulation 7",
--            "Reg 7", GP01..GP12, general permit
-- Then:
--   both named   -> results interleave: best state, best federal, second
--                   state, second federal, ... (a jurisdiction that runs out
--                   leaves the rest to the other).
--   one named    -> that jurisdiction's three best rows lead, and its other
--                   rows carry x1.3 against the rest. The other jurisdiction
--                   is never hidden.
--   none named   -> unchanged from step 1.
-- The candidate pool reserves the 20 best rows of each named jurisdiction so
-- the interleave has rows to work with. An explicit jurisdiction_filter (the
-- page's Colorado / Federal chips) already restricts the set and switches the
-- detection off. Statement-of-Basis, Definitions, other-sector and
-- applicability multipliers from step 1 are unchanged.
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
  want_fed   boolean := false;                 -- the question names federal rules
  want_state boolean := false;                 -- the question names Colorado / state rules
  q_lower    text;
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
  -- Jurisdiction words in the question (only when the caller did not already filter).
  if jurisdiction_filter is null then
    q_lower := lower(coalesce(query_text, ''));
    want_fed   := q_lower ~ '\m(federal|federally|epa|cfr|nsps|neshap|subpart|oooo[abc]?|jjjj|iiii|zzzz|phmsa|u\.?s\.?)\M';
    want_state := q_lower ~ '\m(colorado|state|cdphe|apcd|aqcc|ecmc|cogcc|regulation\s*[0-9]+|reg\s*[0-9]+|gp\s?[0-9]{2}|general permit)\M';
  end if;

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
  local_all as (
    select f.provision_id, f.score, f.is_basis, f.keyword_hit,
           p.citation, p.title, p.sort_order, p.reg_key as stored_reg_key,
           p.jurisdiction_level as jur,
           (f.fused
             * case when f.is_basis then 0.5 else 1.0 end
             * case when p.reg_key = any (public.non_oil_gas_reg_keys()) then 0.7 else 1.0 end
             * case when short_q and tsq is not null and numnode(tsq) > 0
                         and to_tsvector('english', p.citation) @@ tsq then 1.5 else 1.0 end
           )::real as pre
    from fusedset f
    join public.provisions p on p.id = f.provision_id
  ),
  -- The best `pool` overall, plus the 20 best of each jurisdiction the
  -- question named, so an interleave has rows to work with.
  local_ranked as (
    select la.*,
           row_number() over (order by la.pre desc, la.score desc nulls last) as all_rank,
           row_number() over (partition by la.jur order by la.pre desc, la.score desc nulls last) as jur_rank
    from local_all la
  ),
  local_stage as (
    select lr.* from local_ranked lr
    where lr.all_rank <= pool
       or (want_fed   and lr.jur = 'federal' and lr.jur_rank <= 20)
       or (want_state and lr.jur = 'state'   and lr.jur_rank <= 20)
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
  ),
  -- Jurisdiction ordering (see header). jrank = position within its own
  -- jurisdiction by final score; lead = 0 for the three best rows of a
  -- jurisdiction the question named alone.
  juris as (
    select sc.*,
           row_number() over (partition by sc.jur order by sc.final_score desc, sc.score desc nulls last) as jrank,
           case
             when want_fed and want_state then 1.0
             when want_fed   and sc.jur = 'federal' then 1.3
             when want_state and sc.jur = 'state'   then 1.3
             else 1.0
           end as jur_weight
    from scored sc
  )
  select p.id, p.citation, p.title,
         substring(p.id from '^sec-([^-]+)-') as reg_key,
         p.jurisdiction_level,
         case when p.summary_status = 'rejected' then null else p.ai_summary end as summary,
         s.score,
         s.is_basis,
         s.keyword_hit,
         (s.final_score * s.jur_weight)::real as fused,
         s.path
  from juris s
  join public.provisions p on p.id = s.provision_id
  order by
    -- both named: strict interleave, state first in each pair
    case when want_fed and want_state then s.jrank else 0 end,
    case when want_fed and want_state then (case when s.jur = 'state' then 0 else 1 end) else 0 end,
    -- one named: its three best rows lead
    case when (want_fed <> want_state) and s.jur_weight > 1.0 and s.jrank <= 3 then 0 else 1 end,
    s.final_score * s.jur_weight desc, s.score desc nulls last, p.sort_order
  limit match_count;
end;
$$;

comment on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) is
  'Ask search: RRF of vector + full-text, then the keyword-search multipliers: '
  'x0.5 Statement of Basis, x0.7 other-sector regulation (non_oil_gas_reg_keys), '
  'x1.5 direct citation hit on a <=3-word query; the best pool rows then get '
  'x0.8 under a Definitions heading and x1.15 for an applicability section. '
  'Jurisdiction words in the question (federal / Colorado) reserve slots and '
  'interleave or lead the results. SECURITY DEFINER; refuses without has_full_access().';

-- CREATE OR REPLACE keeps the existing grants; re-stated for a from-scratch replay.
revoke all on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) from public, anon;
grant execute on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean, text) to authenticated, service_role;
