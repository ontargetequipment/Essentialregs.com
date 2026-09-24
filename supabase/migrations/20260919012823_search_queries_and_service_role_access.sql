create table if not exists public.search_queries (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete set null,
  mode          text not null default 'ask' check (mode in ('ask', 'keyword', 'eval')),
  query         text not null,
  reg_filter    text[],
  jurisdiction  text,
  result_ids    text[] not null default '{}',
  top_score     real,
  latency_ms    integer,
  created_at    timestamptz not null default now()
);

comment on table public.search_queries is
  'Log of semantic ("Ask") searches. Written by the app with the service role; readable only with the service role. Never exposed to subscribers.';

create index if not exists search_queries_user_created_idx
  on public.search_queries (user_id, created_at desc);

alter table public.search_queries enable row level security;
revoke all on table public.search_queries from anon, authenticated;

create or replace function public.search_queries_recent_count(p_user uuid, window_seconds integer default 60)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.search_queries
  where user_id = p_user
    and mode = 'ask'
    and created_at > now() - make_interval(secs => window_seconds);
$$;
revoke all on function public.search_queries_recent_count(uuid, integer) from public, anon, authenticated;
grant execute on function public.search_queries_recent_count(uuid, integer) to service_role;

create or replace function public.has_full_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (p.access_granted
               or p.subscription_status in ('active', 'trialing'))
      );
$$;
