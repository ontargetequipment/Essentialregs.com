-- EssentialRegs — Phase 2: SQL-side builder for the "Related provisions" table.
-- Called by pipeline/embed.py (service role) after embeddings are written.
-- Never callable by anon/authenticated.

create or replace function public.recompute_provision_neighbors(
  target_ids text[] default null,   -- null = every provision that has an embedding
  k          integer default 5,
  candidates integer default 40     -- ANN candidates examined per provision before exclusions
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n integer;
begin
  if k < 1 or k > 20 then k := 5; end if;
  if candidates < k then candidates := k * 8; end if;

  -- Work table: the anchor vector for each target = its chunk 0
  create temp table _anchors on commit drop as
  select e.provision_id as id, p.parent_id, e.embedding
  from public.provision_embeddings e
  join public.provisions p on p.id = e.provision_id
  where e.chunk_index = 0
    and (target_ids is null or e.provision_id = any (target_ids));

  create temp table _new on commit drop as
  select a.id as provision_id,
         c.neighbor_id,
         c.score,
         (row_number() over (partition by a.id order by c.score desc, c.neighbor_id))::smallint as rank
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

  delete from public.provision_neighbors pn
  using _anchors a
  where pn.provision_id = a.id;

  insert into public.provision_neighbors (provision_id, neighbor_id, score, rank)
  select provision_id, neighbor_id, score, rank
  from _new
  where rank <= k;

  get diagnostics n = row_count;
  drop table if exists _new;
  drop table if exists _anchors;
  return n;
end;
$$;

revoke all on function public.recompute_provision_neighbors(text[], integer, integer) from public, anon, authenticated;
grant execute on function public.recompute_provision_neighbors(text[], integer, integer) to service_role;
