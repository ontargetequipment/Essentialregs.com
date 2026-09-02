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
