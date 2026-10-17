-- regenerated 2026-10-17 from schema_migrations.statements (piece 5 of 6 of supabase/migrations_archive/20261008040000_regulation_release_state.sql)
-- touching a vector value loads pgvector's library in this session so the
-- hnsw.* settings below are known GUCs (a placeholder would need superuser)
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
