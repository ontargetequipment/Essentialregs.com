-- RUN ME in the Supabase SQL editor (Essentialregs project tpuowazmmhqlsakghojy).
-- Fixes the 106 provisions that end up with zero "related sections" links.
--
-- WHY: recompute_provision_neighbors() pulls the 40 nearest embeddings, then throws
-- away parents, children and siblings. For rows in very large sibling groups
-- (Reg 3's 78-item definition list, Reg 6's subpart stubs, ECMC, Reg 21, Reg 11)
-- all 40 of the nearest are relatives, so nothing survives the filter and the row
-- gets no neighbours at all. It is not a bug in the embed job.
--
-- WHAT THIS CHANGES: adds a second, wider probe (400 candidates) that runs ONLY for
-- the handful of anchors the narrow probe under-served. Every other row takes exactly
-- the same path as today, so this does not slow the normal rebuild down and does not
-- change any existing neighbour row.
--
-- AFTER RUNNING THIS: re-run the Embed workflow with neighbors_only. Expect the
-- "provisions with no neighbours" count to drop from 106 to near zero.

-- IDEMPOTENCY FIX (2026-09-22): the original version of this file used `create or replace`
-- while adding a fourth parameter. In Postgres a different parameter list is a DIFFERENT
-- function, so that created a second overload instead of replacing the old one, and every
-- `target_ids`-only call became ambiguous (PGRST203). Dropping the superseded three-argument
-- signature first makes this file safe to run on any database, fresh or already-migrated.
drop function if exists public.recompute_provision_neighbors(text[], integer, integer);

create or replace function public.recompute_provision_neighbors(
  target_ids text[] default null::text[],
  k integer default 5,
  candidates integer default 40,
  fallback_candidates integer default 400
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  n integer;
begin
  if k < 1 or k > 20 then k := 5; end if;
  if candidates < k then candidates := k * 8; end if;
  if fallback_candidates < candidates then fallback_candidates := candidates * 10; end if;

  -- Anchor vector for each target = its chunk 0
  create temp table _anchors on commit drop as
  select e.provision_id as id, p.parent_id, e.embedding
  from public.provision_embeddings e
  join public.provisions p on p.id = e.provision_id
  where e.chunk_index = 0
    and (target_ids is null or e.provision_id = any (target_ids));

  -- Pass 1: the narrow probe, exactly as before
  create temp table _hits on commit drop as
  select a.id as provision_id, c.neighbor_id, c.score
  from _anchors a
  cross join lateral (
    select q.neighbor_id, max(q.score)::real as score
    from (
      select e2.provision_id as neighbor_id,
             1 - (e2.embedding <=> a.embedding) as score
      from public.provision_embeddings e2
      where e2.provision_id <> a.id
      order by e2.embedding <=> a.embedding
      limit candidates
    ) q
    join public.provisions np on np.id = q.neighbor_id
    where np.parent_id is distinct from a.parent_id            -- not a sibling
      and np.id <> coalesce(a.parent_id, '')                    -- not the parent
      and a.id not like np.id || '-%'                           -- not an ancestor
      and np.id not like a.id || '-%'                           -- not a descendant
    group by q.neighbor_id
  ) c;

  create index on _hits (provision_id);

  -- Which anchors did the narrow probe leave short? (sibling-crowded rows)
  create temp table _short on commit drop as
  select a.id, a.parent_id, a.embedding
  from _anchors a
  where (select count(*) from _hits h where h.provision_id = a.id) < k;

  -- Pass 2: the wide probe, ONLY for those
  insert into _hits (provision_id, neighbor_id, score)
  select s.id, c.neighbor_id, c.score
  from _short s
  cross join lateral (
    select q.neighbor_id, max(q.score)::real as score
    from (
      select e2.provision_id as neighbor_id,
             1 - (e2.embedding <=> s.embedding) as score
      from public.provision_embeddings e2
      where e2.provision_id <> s.id
      order by e2.embedding <=> s.embedding
      limit fallback_candidates
    ) q
    join public.provisions np on np.id = q.neighbor_id
    where np.parent_id is distinct from s.parent_id
      and np.id <> coalesce(s.parent_id, '')
      and s.id not like np.id || '-%'
      and np.id not like s.id || '-%'
    group by q.neighbor_id
  ) c;

  -- Rank once over the merged set (a row found by both probes is deduped here)
  create temp table _new on commit drop as
  select provision_id, neighbor_id, score,
         (row_number() over (partition by provision_id order by score desc, neighbor_id))::smallint as rank
  from (
    select provision_id, neighbor_id, max(score)::real as score
    from _hits
    group by provision_id, neighbor_id
  ) d;

  delete from public.provision_neighbors pn
  using _anchors a
  where pn.provision_id = a.id;

  insert into public.provision_neighbors (provision_id, neighbor_id, score, rank)
  select provision_id, neighbor_id, score, rank
  from _new
  where rank <= k;

  get diagnostics n = row_count;
  drop table if exists _new;
  drop table if exists _short;
  drop table if exists _hits;
  drop table if exists _anchors;
  return n;
end;
$function$;

-- GRANTS FIX (2026-09-22): migration 006 ended by revoking EXECUTE on this function from
-- public, anon and authenticated and granting it to service_role alone. The four-argument
-- signature created above is a DIFFERENT function object and did not inherit any of that, so
-- it picked up Supabase's default grants and became callable by anyone holding the publishable
-- anon key. These two lines restore 006's intent for the new signature. See
-- supabase/migrations/011_security_grants.sql for the full write-up.
revoke all on function
  public.recompute_provision_neighbors(text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function
  public.recompute_provision_neighbors(text[], integer, integer, integer)
  to service_role;

-- Sanity check: should return 5 neighbours for a row that currently has none.
-- select public.recompute_provision_neighbors(array['sec-3-A-II-A'], 5);
