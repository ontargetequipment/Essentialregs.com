-- Guided GP05 walkthrough counts (Sprint 6, 10-11 Oct 2026).
--
-- Vercel Web Analytics custom events (track()) need a Pro or Enterprise plan;
-- this project's team is on Hobby (the Web Analytics API answers 402
-- "Accessing Analytics custom events requires an Enterprise or Pro plan"), so
-- the tour counts itself here. POST /api/tour-event
-- (src/app/api/tour-event/route.ts) inserts one row per event through the
-- request's own Supabase client: anon for a visitor, authenticated for a
-- subscriber.
--
-- Counts only, no PII: the event, the step, the tour's own random session id
-- (made in the visitor's browser, kept in sessionStorage, never tied to an
-- account), the deployment environment (VERCEL_ENV) and the time. No user id,
-- no IP, no URL, no user agent. The smoke suite's browsers are not stored
-- (the route skips a request marked x-tour-automated).
--
-- RLS: anon and authenticated may INSERT a well-formed row, four columns,
-- and nothing else. There is no select, update or delete policy or grant, so
-- the public API can never read the counts back or change them. They are read
-- in the SQL editor; the counts query is in docs/CEO_PHASE_PLAN.md, Sprint 6.
--
-- Applied with the Supabase connector's apply_migration, which recorded this
-- version. (No "drop policy if exists" here: the connector holds any DROP for
-- a confirmation that an unattended session never gives, and the call times
-- out; the table is new, so there is nothing to drop.)

create table if not exists public.tour_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('tour_start', 'tour_step', 'tour_complete', 'tour_trial_click', 'tour_skip')),
  step smallint not null check (step between 1 and 6),
  session_id text not null check (session_id ~ '^[A-Za-z0-9-]{8,64}$'),
  env text not null default 'production' check (env in ('production', 'preview', 'development')),
  created_at timestamptz not null default now()
);
comment on table public.tour_events is 'Guided GP05 walkthrough counts (Sprint 6): one row per tour event. Insert-only for anon/authenticated; no PII.';
create index if not exists tour_events_created_at_idx on public.tour_events (created_at);
alter table public.tour_events enable row level security;
revoke all on table public.tour_events from public, anon, authenticated;
grant insert (event, step, session_id, env) on table public.tour_events to anon, authenticated;
grant select, insert, update, delete on table public.tour_events to service_role;
create policy "anyone can record a tour event" on public.tour_events for insert to anon, authenticated with check (true);
