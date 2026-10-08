-- Staged release state for newly imported regulations (8 Oct 2026).
--
-- What `provisions.is_public` controls today, and only this: the four
-- /sample rows anonymous visitors may read ("public can read public
-- provisions" policy; provision_path() returns a breadcrumb for them). It
-- never hid a regulation from subscribers: the "subscribers can read all
-- provisions" policy, has_full_access() in the SECURITY DEFINER Ask
-- functions and the app's service-role reads (regulation roots, teaser,
-- rendered reader cache) all read every reg_key. So Subpart OOOO, imported
-- with is_public false, was in the reader, keyword search, Ask and the
-- Federal index for every subscriber from the moment it was imported.
--
-- This migration adds the release state the import workflow was missing.
--   regulation_releases(reg_key, status staged|released): one row per
--   document. No row = released (every document before this migration;
--   seeded below so the table lists them all). The importer inserts a
--   `staged` row the first time it writes a reg_key (import_ccr.py
--   cmd_apply --execute) and `python pipeline/import_ccr.py release --reg X
--   --yes` (or the Release regulation workflow) flips it to released.
--   reg_is_released(reg_key): SECURITY DEFINER so the subscriber policies
--   and functions below can consult the table without a grant on it.
-- While a document is staged:
--   * subscribers cannot read its rows (policy below) -- the reader's live
--     path, /regs/[id], the provision preview API, keyword search
--     (search_provisions is SECURITY INVOKER, so RLS decides) and related
--     provisions (provision_neighbors policy below) all return nothing;
--   * Ask (match_provisions, match_provisions_hybrid) skips its rows and
--     embeddings unless the caller is service_role;
--   * the public changelog does not list it;
--   * the app's service-role reads (src/lib/release.ts) drop it from the
--     Federal/States/GP indexes, the sitemap, the preview and the cached
--     reader (admins on ADMIN_EMAILS still see it in the reader and the
--     review queue);
--   * other documents do not link to it: dump-ids leaves it out of
--     corpus_ids.json and writes corpus_staged.json, which parse uses to
--     drop it from CORPUS_REGS (import_ccr.set_staged_regs).
-- service_role (the pipeline, the admin review page) sees staged rows.
--
-- Applied to the live project on 8 Oct 2026 through the Supabase MCP in
-- pieces (table + function, seed, ALTER POLICY in place of the DROP/CREATE
-- below, then each function); this file is the same change for a replay.

create table if not exists public.regulation_releases (
  reg_key     text primary key,
  status      text not null check (status in ('staged', 'released')),
  staged_at   timestamptz not null default now(),
  released_at timestamptz,
  note        text
);
comment on table public.regulation_releases is
  'Release state per document (reg_key). No row or released = visible to subscribers; staged = a newly imported document hidden from subscribers (reader, keyword search, Ask, related, previews, changelog) and unlinked by other documents until released. Written by pipeline/import_ccr.py (apply --execute inserts staged; release flips it).';
alter table public.regulation_releases enable row level security;
revoke all on table public.regulation_releases from public, anon, authenticated;
grant select, insert, update, delete on table public.regulation_releases to service_role;

create or replace function public.reg_is_released(p_reg_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.regulation_releases r
    where r.reg_key = p_reg_key and r.status = 'staged'
  );
$$;
comment on function public.reg_is_released(text) is
  'True unless regulation_releases marks the reg_key staged. SECURITY DEFINER so RLS policies and the Ask functions can consult the (service_role-only) table. No row = released.';
revoke all on function public.reg_is_released(text) from public;
grant execute on function public.reg_is_released(text) to anon, authenticated, service_role;

-- Every document that exists today is released (Subpart OOOO included: it
-- has been visible to subscribers since its import and hiding it now would
-- break the 55 links eleven documents already carry to it).
insert into public.regulation_releases (reg_key, status, released_at, note)
select distinct p.reg_key, 'released', now(), 'released before the staged state existed (8 Oct 2026)'
from public.provisions p
where p.reg_key is not null
on conflict (reg_key) do nothing;

-- Subscriber read gate: as 20260913000000, plus the release state.
drop policy if exists "subscribers can read all provisions" on public.provisions;
create policy "subscribers can read all provisions"
  on public.provisions for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = (select auth.uid())
                   and (p.access_granted or p.subscription_status in ('active','trialing')))
         and public.reg_is_released(reg_key));

-- Related provisions: as 20260918035710, plus both ends released.
drop policy if exists "subscribers can read all neighbors" on public.provision_neighbors;
create policy "subscribers can read all neighbors"
  on public.provision_neighbors for select
  to authenticated
  using (public.has_full_access()
         and public.reg_is_released(split_part(provision_id, '-', 2))
         and public.reg_is_released(split_part(neighbor_id, '-', 2)));

-- Ask: vector-only (20260925013159) and hybrid (20261002151233) functions,
-- unchanged except that a staged document's rows and embeddings are
-- skipped unless the caller is service_role.
-- Touching a vector value first loads pgvector's library in this session,
-- so the functions' `set hnsw.*` clauses name known settings: without it
-- a non-superuser (the MCP / dashboard role) gets "permission denied to
-- set parameter hnsw.iterative_scan" on a placeholder GUC.
select '[0]'::extensions.vector(1);

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
      and (auth.role() = 'service_role' or public.reg_is_released(e.reg_key))
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
  long_q     boolean;                          -- a sentence: fuse on cosine, not rank (see fusedset)
  n_words    integer;
  want_fed   boolean := false;                 -- the question names federal rules
  want_state boolean := false;                 -- the question names Colorado / state rules
  q_lower    text;
  named_closed text[] := '{}';                 -- closed permits the question names by number
  kw_min_score constant real := 0.5;           -- a keyword-only row below this cosine is dropped
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
  n_words := array_length(regexp_split_to_array(btrim(coalesce(query_text, '')), '\s+'), 1);
  short_q := n_words <= 3;
  long_q  := n_words >= 6;
  -- Jurisdiction words in the question (only when the caller did not already filter).
  if jurisdiction_filter is null then
    q_lower := lower(coalesce(query_text, ''));
    want_fed   := q_lower ~ '\m(federal|federally|epa|cfr|nsps|neshap|subpart|oooo[abc]?|jjjj|iiii|zzzz|phmsa|u\.?s\.?)\M';
    want_state := q_lower ~ '\m(colorado|state|cdphe|apcd|aqcc|ecmc|cogcc|division|commission|regulation\s*[0-9]+|reg\s*[0-9]+|gp\s?[0-9]{2}|general permit)\M';
  end if;
  -- A closed permit the question names by number keeps its rank (an existing
  -- registrant asking about their own permit).
  select coalesce(array_agg(c), '{}') into named_closed
  from unnest(public.closed_permit_reg_keys()) c
  where lower(coalesce(query_text, '')) ~ ('\m(gp\s?0?' || ltrim(substring(c from 3), '0') || '|general permit\s+0?' || ltrim(substring(c from 3), '0') || ')\M');

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
        and (auth.role() = 'service_role' or public.reg_is_released(p.reg_key))
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
  with kw_raw as (
    select s.id as provision_id, row_number() over (order by s.rnk desc, s.sort_order) as kw_rank
    from (
      select p.id, p.sort_order, ts_rank(p.search_vector, tsq, 1) as rnk   -- /(1+log len): short operative paragraphs beat long basis statements
      from public.provisions p
      where tsq is not null and numnode(tsq) > 0
        and p.search_vector @@ tsq
        and (auth.role() = 'service_role' or public.reg_is_released(p.reg_key))
        and (reg_filter is null or exists (select 1 from unnest(reg_filter) r where p.id like 'sec-' || r || '-%'))
        and (jurisdiction_filter is null or p.jurisdiction_level = jurisdiction_filter)
        and (include_basis or not public.is_basis_provision(p.id))
      order by rnk desc, p.sort_order
      limit pool
    ) s
  ),
  -- Keyword-only rows get their real similarity to the question (best chunk);
  -- below kw_min_score they are dropped here, before fusion.
  kw as (
    select kr.provision_id, row_number() over (order by kr.kw_rank) as kw_rank, ks.kw_score
    from kw_raw kr
    left join lateral (
      select max(1 - (e.embedding <=> query_embedding))::real as kw_score
      from public.provision_embeddings e
      where e.provision_id = kr.provision_id
    ) ks on true
    where ks.kw_score is null or ks.kw_score >= kw_min_score
  ),
  -- Nearest chunks, over-fetched so that provisions with several chunks
  -- (long rows; every long summary since 30 Sep) do not crowd the window.
  sem_hits as (
    select e.provision_id, e.is_basis,
           (1 - (e.embedding <=> query_embedding))::real as score
    from public.provision_embeddings e
    where (reg_filter is null or e.reg_key = any (reg_filter))
      and (auth.role() = 'service_role' or public.reg_is_released(e.reg_key))
      and (jurisdiction_filter is null or e.jurisdiction = jurisdiction_filter)
      and (include_basis or not e.is_basis)
    order by e.embedding <=> query_embedding
    limit sem_cand * 3
  ),
  -- Best chunk per provision, then the best sem_cand PROVISIONS.
  sem_by_provision as (
    select s.provision_id, bool_or(s.is_basis) as is_basis, max(s.score) as score
    from sem_hits s group by s.provision_id
  ),
  sem as (
    select sp.provision_id, sp.is_basis, sp.score,
           row_number() over (order by sp.score desc) as sem_rank
    from sem_by_provision sp
    order by sp.score desc
    limit sem_cand
  ),
  -- Fusion. Short and medium queries (<= 5 words: identifiers, topics):
  -- reciprocal-rank fusion, where a row both legs found beats any row one
  -- leg found. A sentence (>= 6 words): cosine-based -- the vector leg's
  -- similarity carries its magnitude (0.63 beats 0.60 by the margin it
  -- earned, not by one rank step), and a keyword hit adds a bonus worth
  -- about two hundredths of cosine, fading with keyword rank. A long
  -- question shares ordinary words with hundreds of rows, so a word match
  -- is weak evidence next to a clear meaning match (the 912 spill rows,
  -- 30 Sep). The 0.40 floor keeps the later multipliers proportional:
  -- x0.6 on (0.62 - 0.40) is a shift of about 0.09 cosine, not a kill.
  fusedset as (
    select coalesce(sem.provision_id, kw.provision_id) as provision_id,
           coalesce(sem.score, kw.kw_score) as score,
           coalesce(sem.is_basis, public.is_basis_provision(kw.provision_id)) as is_basis,
           (kw.provision_id is not null) as keyword_hit,
           (case
              when long_q then
                greatest(coalesce(sem.score, kw.kw_score, 0.0) - 0.40, 0.01)
                + coalesce(0.02 / (1.0 + (kw.kw_rank - 1) / 10.0), 0)
              else
                coalesce(1.0 / (k + sem.sem_rank), 0) + coalesce(1.0 / (k + kw.kw_rank), 0)
            end)::real as fused
    from sem full outer join kw on kw.provision_id = sem.provision_id
  ),
  -- Row-local stage: basis x0.5, other-sector regulation x0.7, direct
  -- citation hit x1.5 (short queries only), closed permit x0.6 unless named. Cheap column tests on every
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
             * case when p.reg_key = any (public.closed_permit_reg_keys())
                         and not (p.reg_key = any (named_closed)) then 0.6 else 1.0 end
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
  -- applicability x1.15, heading-only x0.6. Reorders among good matches only.
  pathed as (
    select l.*, public.provision_path(l.provision_id) as path,
           -- heading-only: <= 20 words of text AND provisions underneath it
           (array_length(regexp_split_to_array(btrim(regexp_replace(coalesce(px.full_text, ''), '<[^>]+>', ' ', 'g')), '\s+'), 1) <= 20
              and exists (select 1 from public.provisions c where c.parent_id = l.provision_id)) as heading_only
    , px.parent_id
    from local_stage l
    join public.provisions px on px.id = l.provision_id
  ),
  content_scored as (
    select ph.*,
           (ph.pre
             * case when ph.path ~* '\mdefinitions?\M'
                      or ph.title ~* '^\s*§?\s*[0-9.]*[a-z]*\s*what definitions apply' then 0.8 else 1.0 end
             * case when ph.title ~* '\m(applicability|applies to|subject to|who must comply|am i subject)'
                      or ph.path ~* '\m(applicability|am i subject|who must comply)' then 1.15 else 1.0 end
           )::real as content_score
    from pathed ph
  ),
  -- The best pooled child of each heading-only row (by its own score).
  best_child as (
    select c.provision_id, h.content_score as heading_score,
           row_number() over (partition by c.parent_id order by c.content_score desc, c.score desc nulls last) as child_rank
    from content_scored c
    join content_scored h on h.provision_id = c.parent_id and h.heading_only
  ),
  scored as (
    select cs.*,
           (case
              when cs.heading_only then cs.content_score * 0.6
              when bc.child_rank = 1 then greatest(cs.content_score, bc.heading_score)
              else cs.content_score
            end)::real as final_score
    from content_scored cs
    left join best_child bc on bc.provision_id = cs.provision_id and bc.child_rank = 1
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

-- The public changelog (20261007120000) does not list a staged document.
create or replace function public.changelog_public()
returns table (
  day date,
  reg_key text,
  change_type text,
  provision_count bigint,
  latest timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with regen as (
    select c.id, c.provision_id, c.created_at,
      (select min(r.created_at)
         from provision_changes r
        where r.provision_id = c.provision_id
          and r.change_type in ('summary_approved', 'summary_edited')
          and r.created_at >= c.created_at
          and r.created_at < c.created_at + interval '24 hours') as reviewed_at
    from provision_changes c
    where c.change_type = 'summary_regenerated'
      and c.provision_id is not null
  ),
  paired as (
    select distinct g.provision_id, g.reviewed_at as created_at
    from regen g
    where g.reviewed_at is not null
  ),
  events as (
    select c.id, c.provision_id, c.created_at, c.change_type
    from provision_changes c
    where c.change_type in ('text_updated', 'links_updated', 'added', 'removed',
                            'transcription_corrected', 'duplicate_removed', 'source_version_changed')
    union all
    select c.id, c.provision_id, c.created_at, c.change_type
    from provision_changes c
    where c.change_type in ('summary_approved', 'summary_edited')
      and not exists (
        select 1 from paired k
        where k.provision_id = c.provision_id and k.created_at = c.created_at
      )
    union all
    select g.id, g.provision_id, g.created_at,
      case
        when g.reviewed_at is not null then
          case when exists (
                 select 1 from provision_changes r
                 where r.provision_id = g.provision_id
                   and r.created_at = g.reviewed_at
                   and r.change_type = 'summary_edited')
               then 'summary_rewritten_corrected'
               else 'summary_rewritten_reviewed'
          end
        when p.summary_status = 'pending' then 'summary_rewritten_pending'
        else 'summary_rewritten_reviewed_later'
      end
    from regen g
    left join provisions p on p.id = g.provision_id
  )
  select
    (e.created_at at time zone 'America/Denver')::date as day,
    coalesce(p.reg_key, substring(e.provision_id from '^sec-([^-]+)-')) as reg_key,
    e.change_type,
    count(distinct case when e.change_type in ('removed', 'duplicate_removed', 'transcription_corrected') then e.id::text
                        else coalesce(e.provision_id, e.id::text) end) as provision_count,
    max(e.created_at) as latest
  from events e
  left join provisions p on p.id = e.provision_id
  where public.reg_is_released(coalesce(p.reg_key, substring(e.provision_id from '^sec-([^-]+)-')))
  group by 1, 2, 3
  order by max(e.created_at) desc;
$$;

revoke all on function public.changelog_public() from public;
grant execute on function public.changelog_public() to anon, authenticated;
