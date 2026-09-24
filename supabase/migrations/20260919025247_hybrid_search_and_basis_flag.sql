alter table public.provision_embeddings
  add column if not exists reg_key text,
  add column if not exists jurisdiction text,
  add column if not exists is_basis boolean not null default false;

create or replace function public.is_basis_provision(p_id text)
returns boolean
language sql
immutable
as $$
  select p_id ~ '^sec-(1-X|2-C|22-E|24-C|26-C-(I|II|III|IV)|3-F|30-C|6-A-[IVX]+|6-B-IX|7-C|8-A-II|8-B-VII|8-C-II|8-E-VI|9-IX|cp-V)(-|$)';
$$;

create or replace function public.provision_embeddings_fill_meta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select substring(p.id from '^sec-([^-]+)-'), p.jurisdiction_level
    into new.reg_key, new.jurisdiction
  from public.provisions p where p.id = new.provision_id;
  new.is_basis := public.is_basis_provision(new.provision_id);
  return new;
end;
$$;

drop trigger if exists provision_embeddings_meta on public.provision_embeddings;
create trigger provision_embeddings_meta
  before insert or update of provision_id on public.provision_embeddings
  for each row execute function public.provision_embeddings_fill_meta();

update public.provision_embeddings
set is_basis = true
where not is_basis and public.is_basis_provision(provision_id);

create index if not exists provision_embeddings_reg_idx on public.provision_embeddings (reg_key);
create index if not exists provision_embeddings_juris_idx on public.provision_embeddings (jurisdiction);

drop function if exists public.match_provisions(extensions.vector, integer, text[], text);

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
  is_basis           boolean
)
language plpgsql
stable
security definer
set search_path = public, extensions
set hnsw.iterative_scan = relaxed_order
set hnsw.ef_search = 80
as $$
begin
  if not public.has_full_access() then
    raise exception 'semantic search requires an active subscription'
      using errcode = '42501';
  end if;
  if match_count is null or match_count < 1 or match_count > 50 then
    match_count := 20;
  end if;

  return query
  with hits as (
    select e.provision_id, e.is_basis,
           (1 - (e.embedding <=> query_embedding))::real as score
    from public.provision_embeddings e
    where (reg_filter is null or e.reg_key = any (reg_filter))
      and (jurisdiction_filter is null or e.jurisdiction = jurisdiction_filter)
      and (include_basis or not e.is_basis)
    order by e.embedding <=> query_embedding
    limit match_count * 6
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
         b.is_basis
  from best b
  join public.provisions p on p.id = b.provision_id
  order by (b.score * case when b.is_basis then 0.92 else 1.0 end) desc
  limit match_count;
end;
$$;

revoke all on function public.match_provisions(extensions.vector, integer, text[], text, boolean) from public, anon;
grant execute on function public.match_provisions(extensions.vector, integer, text[], text, boolean) to authenticated, service_role;

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
  score              real,
  is_basis           boolean,
  keyword_hit        boolean,
  fused              real
)
language plpgsql
stable
security definer
set search_path = public, extensions
set hnsw.iterative_scan = relaxed_order
set hnsw.ef_search = 80
as $$
declare
  k          constant integer := 60;
  pool       integer;
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

  tsq_and := websearch_to_tsquery('english', coalesce(query_text, ''));
  if tsq_and is not null and numnode(tsq_and) > 0 then
    select count(*) into n_and from (
      select 1 from public.provisions p
      where p.search_vector @@ tsq_and
        and (reg_filter is null or substring(p.id from '^sec-([^-]+)-') = any (reg_filter))
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
        and (reg_filter is null or substring(p.id from '^sec-([^-]+)-') = any (reg_filter))
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
    limit pool * 2
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
         (f.fused * case when f.is_basis then 0.85 else 1.0 end)::real as fused
  from fusedset f
  join public.provisions p on p.id = f.provision_id
  order by (f.fused * case when f.is_basis then 0.85 else 1.0 end) desc, f.score desc nulls last
  limit match_count;
end;
$$;

revoke all on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean) from public, anon;
grant execute on function public.match_provisions_hybrid(text, extensions.vector, integer, text[], text, boolean) to authenticated, service_role;
