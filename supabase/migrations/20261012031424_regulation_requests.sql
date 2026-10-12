-- Regulation requests (12 Oct 2026): what customers and prospects ask us to
-- import next. The public form at /request writes one row per request through
-- the server action in src/app/request/actions.ts; the owner reads and triages
-- them at /admin/requests (src/app/admin/requests/page.tsx). Both go through
-- the service-role client after their own checks (the form's validation, spam
-- guards and per-day caps; requireAdmin() on the admin page).
--
-- RLS is on and there are NO policies: anon and authenticated can neither read
-- nor write a row through PostgREST (deny-all), and their table grants are
-- revoked too. Every access path is the service role on the server.
--
-- ip_hash is sha256(REQUEST_IP_SALT + ':' + client ip); the raw address is
-- never stored. It and the email are what the per-24h caps count against
-- (5 per email, 20 per ip_hash), checked before the insert.
--
-- Applied with the Supabase connector's apply_migration, which recorded this
-- version. No DROP statements (the connector holds those for a confirmation an
-- unattended session never gives); the table is new.

create table if not exists public.regulation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- What they want, 3-200 characters (validated server-side as well).
  regulation text not null check (char_length(regulation) between 3 and 200),
  -- 'federal', a US state name as the form lists it ('Colorado'), or 'other'.
  jurisdiction text not null check (char_length(jurisdiction) between 1 and 60),
  agency text check (agency is null or char_length(agency) <= 200),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  -- "What are you working on?" (<= 1000 characters).
  reason text check (reason is null or char_length(reason) <= 1000),
  email text not null check (char_length(email) between 3 and 320),
  company text check (company is null or char_length(company) <= 200),
  -- The signed-in requester, when there was one; the row outlives the account.
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'new'
    check (status in ('new', 'planned', 'building', 'done', 'declined')),
  -- Owner's triage notes (/admin/requests).
  notes text,
  ip_hash text,
  user_agent text
);

comment on table public.regulation_requests is
  'Regulation requests from /request (12 Oct 2026): one row per ask; the signal for what to import next. Deny-all RLS; service role only. Triaged at /admin/requests.';
comment on column public.regulation_requests.ip_hash is
  'sha256(REQUEST_IP_SALT + '':'' + client ip). Never the raw address. Counted for the 20-per-24h cap.';

-- The admin list (newest first, filtered by status) and the status counts.
create index if not exists regulation_requests_status_created_at_idx
  on public.regulation_requests (status, created_at desc);
-- The per-24h caps: requests by this email / this address since a timestamp.
create index if not exists regulation_requests_email_created_at_idx
  on public.regulation_requests (email, created_at desc);
create index if not exists regulation_requests_ip_hash_created_at_idx
  on public.regulation_requests (ip_hash, created_at desc);

alter table public.regulation_requests enable row level security;
revoke all on table public.regulation_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.regulation_requests to service_role;
