-- EssentialRegs core schema
-- Run this once against a fresh Supabase project (SQL Editor, or via the
-- Supabase MCP connector). Safe to re-run: uses IF NOT EXISTS / OR REPLACE
-- where practical.

create extension if not exists "pgcrypto";

create table if not exists provisions (
  id                    text primary key,          -- stable slug from citation, e.g. 'osha-1910-119'
  citation              text not null,              -- official citation, e.g. '29 CFR § 1910.119'
  title                 text not null,
  jurisdiction_level    text not null check (jurisdiction_level in ('federal', 'state', 'county')),
  issuing_body          text not null,              -- e.g. 'OSHA', 'ECMC', 'CDPHE-APCD'
  parent_id             text references provisions(id) on delete set null,
  full_text             text not null,              -- verbatim regulatory text
  ai_summary            text,                       -- plain-English summary
  summary_model         text,                       -- model/version used to generate the summary
  summary_generated_at  timestamptz,
  source_url            text,                       -- canonical government source link
  last_verified_date    date,                       -- last time this was checked against the source
  is_public             boolean not null default false, -- true = visible without a subscription (sample content)
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists provisions_parent_id_idx on provisions (parent_id);
create index if not exists provisions_jurisdiction_idx on provisions (jurisdiction_level, issuing_body);

create table if not exists cross_references (
  id                  uuid primary key default gen_random_uuid(),
  from_provision_id   text not null references provisions(id) on delete cascade,
  raw_text            text not null,                -- the citation string as it appeared in the source text
  target_type         text not null check (target_type in ('internal', 'external')),
  target_provision_id text references provisions(id) on delete set null, -- set when target_type = 'internal'
  target_url          text,                         -- set when target_type = 'external'
  created_at          timestamptz not null default now()
);

create index if not exists cross_references_from_idx on cross_references (from_provision_id);

-- Row Level Security: for now, only publicly-flagged provisions are readable
-- by anyone (this is the "Sample" page). Once the paid subscription flow is
-- wired up (see the phase plan), a second policy gets added here granting
-- full read access to authenticated subscribers.
alter table provisions enable row level security;
alter table cross_references enable row level security;

drop policy if exists "public can read public provisions" on provisions;
create policy "public can read public provisions"
  on provisions for select
  using (is_public = true);

drop policy if exists "public can read cross-refs of public provisions" on cross_references;
create policy "public can read cross-refs of public provisions"
  on cross_references for select
  using (
    exists (
      select 1 from provisions
      where provisions.id = cross_references.from_provision_id
      and provisions.is_public = true
    )
  );

-- updated_at auto-touch
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists provisions_set_updated_at on provisions;
create trigger provisions_set_updated_at
  before update on provisions
  for each row execute function set_updated_at();

-- Auth: profiles table + manual "early access" gate ---------------------
--
-- profiles holds one row per Supabase Auth user (auth.users is managed by
-- Supabase itself and lives outside this file). access_granted is the manual
-- switch Brody flips (via SQL) to give a signed-in user full read access
-- without a paid subscription (comped accounts) -- there is deliberately no
-- update policy letting a user grant it to themselves. The Stripe
-- subscription columns (stripe_customer_id, subscription_status, ...) are
-- added by supabase/migrations/002_subscriptions.sql.
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  access_granted boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "users can read own profile" on profiles;
create policy "users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SUPERSEDED: the two "authenticated users can read all ..." policies below
-- were the interim login-only gate. supabase/migrations/002_subscriptions.sql
-- drops them and replaces them with "subscribers can read all ..." policies
-- that require an active/trialing Stripe subscription or access_granted =
-- true (it also adds the Stripe columns to profiles). They're kept here so a
-- fresh project bootstraps the same way it always did; run the migration
-- afterwards to switch to the paid gate. Don't edit the policy text here --
-- the migration is the source of truth.
drop policy if exists "granted users can read all provisions" on provisions;
create policy "authenticated users can read all provisions"
  on provisions for select
  using (auth.role() = 'authenticated');

drop policy if exists "granted users can read all cross-refs" on cross_references;
create policy "authenticated users can read all cross-refs"
  on cross_references for select
  using (auth.role() = 'authenticated');
