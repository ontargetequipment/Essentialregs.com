-- EssentialRegs — Phase 3 of the semantic-search plan.
-- 1. search_queries: owner-only log of Ask searches (raw material for tuning
--    summaries and for the Phase 6 assistant); also drives the per-user rate limit.
-- 2. has_full_access(): let the service role through, so server-side jobs
--    (the acceptance test page, future batch tooling) can call
--    match_provisions without impersonating a subscriber. End-user calls
--    still go through the cookie session and are gated by profiles.

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
-- No policies: anon/authenticated can neither read nor write. service_role bypasses RLS.

revoke all on table public.search_queries from anon, authenticated;

-- Per-user rate limit helper: how many Ask searches this user ran in the last `window_seconds`.
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

-- Service role may call match_provisions (used by the admin acceptance page).
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
