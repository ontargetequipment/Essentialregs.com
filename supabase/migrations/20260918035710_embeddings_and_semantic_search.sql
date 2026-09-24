-- EssentialRegs — Phase 1 of the semantic-search plan
-- Adds pgvector, the provision_embeddings + provision_neighbors tables,
-- and an access-checked RPC (match_provisions) that is the ONLY way
-- non-service clients can read embeddings.
--
-- Safe to re-run (idempotent). No data is written here; Phase 2 (embed.py)
-- fills the tables using the service-role key.

-- 1. Extension (Supabase installs extensions into the `extensions` schema)
create extension if not exists vector with schema extensions;

-- 2. Shared access rule — mirrors the "subscribers can read all provisions"
--    RLS policy so the rule lives in exactly one place.
create or replace function public.has_full_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.access_granted
           or p.subscription_status in ('active', 'trialing'))
  );
$$;

revoke all on function public.has_full_access() from public;
grant execute on function public.has_full_access() to authenticated, service_role;

-- 3. Embeddings — one row per (provision, chunk). Written only by the
--    pipeline via service_role. RLS on, no policies => anon/authenticated
--    cannot read or write directly; the RPC below is the only read path.
create table if not exists public.provision_embeddings (
  provision_id    text not null references public.provisions(id) on delete cascade,
  chunk_index     integer not null default 0,
  chunk_text_hash text not null,
  embedding       extensions.vector(1024) not null,
  model           text not null,
  created_at      timestamptz not null default now(),
  primary key (provision_id, chunk_index)
);

comment on table public.provision_embeddings is
  'Voyage embeddings of provision text (citation + title + chapeau + full_text + summary). Long rows are chunked; chunk 0 always carries the summary. chunk_text_hash gates re-embedding on re-runs.';

alter table public.provision_embeddings enable row level security;

-- HNSW, cosine. ~13k x 1024-dim rows: ~60 MB.
create index if not exists provision_embeddings_hnsw_cos
  on public.provision_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 4. Precomputed neighbours for the "Related provisions" panel.
--    Populated by the pipeline after each embedding run; read directly by the
--    app under the same rule as provisions.
create table if not exists public.provision_neighbors (
  provision_id text not null references public.provisions(id) on delete cascade,
  neighbor_id  text not null references public.provisions(id) on delete cascade,
  score        real not null,
  rank         smallint not null,
  created_at   timestamptz not null default now(),
  primary key (provision_id, rank),
  unique (provision_id, neighbor_id),
  check (provision_id <> neighbor_id)
);

comment on table public.provision_neighbors is
  'Top-5 cosine neighbours per provision, corpus-wide, excluding same-parent siblings and ancestors. Written by pipeline/embed.py.';

alter table public.provision_neighbors enable row level security;

drop policy if exists "public can read neighbors of public provisions" on public.provision_neighbors;
create policy "public can read neighbors of public provisions"
  on public.provision_neighbors for select
  to anon, authenticated
  using (
    exists (select 1 from public.provisions a where a.id = provision_id and a.is_public)
    and exists (select 1 from public.provisions b where b.id = neighbor_id and b.is_public)
  );

drop policy if exists "subscribers can read all neighbors" on public.provision_neighbors;
create policy "subscribers can read all neighbors"
  on public.provision_neighbors for select
  to authenticated
  using (public.has_full_access());

-- 5. Semantic search RPC.
--    security definer so it can read provision_embeddings (which has no
--    policies), and it re-checks access itself so RLS on provisions cannot be
--    bypassed through the function. Returns the best chunk per provision.
create or replace function public.match_provisions(
  query_embedding     extensions.vector(1024),
  match_count         integer default 20,
  reg_filter          text[]  default null,   -- e.g. array['7','oooob']
  jurisdiction_filter text    default null    -- 'state' | 'federal'
)
returns table (
  id                 text,
  citation           text,
  title              text,
  reg_key            text,
  jurisdiction_level text,
  summary            text,
  score              real
)
language plpgsql
stable
security definer
set search_path = public, extensions
-- pgvector 0.8: keep scanning the HNSW index until the filtered result set is full
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
    select e.provision_id,
           (1 - (e.embedding <=> query_embedding))::real as score
    from public.provision_embeddings e
    join public.provisions p on p.id = e.provision_id
    where (reg_filter is null
           or substring(p.id from '^sec-([^-]+)-') = any (reg_filter))
      and (jurisdiction_filter is null
           or p.jurisdiction_level = jurisdiction_filter)
    order by e.embedding <=> query_embedding
    limit match_count * 6
  ),
  best as (
    select h.provision_id, max(h.score) as score
    from hits h
    group by h.provision_id
  )
  select p.id,
         p.citation,
         p.title,
         substring(p.id from '^sec-([^-]+)-') as reg_key,
         p.jurisdiction_level,
         case when p.summary_status = 'rejected' then null else p.ai_summary end as summary,
         b.score
  from best b
  join public.provisions p on p.id = b.provision_id
  order by b.score desc
  limit match_count;
end;
$$;

revoke all on function public.match_provisions(extensions.vector, integer, text[], text) from public;
grant execute on function public.match_provisions(extensions.vector, integer, text[], text) to authenticated, service_role;
