-- Reconciled 2026-09-24. Source: supabase/migrations/RUN_ME_in_Supabase_SQL_Editor.sql
-- (now supabase/migrations_archive/), the hand-run bundle of 002_subscriptions.sql
-- and 003_search.sql. It was pasted into the Supabase SQL editor and never entered
-- supabase_migrations.schema_migrations; this file puts it on the record.
--
-- When it ran: after 20260910014122 (it drops that version's "authenticated users
-- can read all provisions" policy) and no later than 2026-09-13
-- (docs/CEO_PHASE_PLAN.md, "Status as of Sep 13 2026": migrations 002, 003 and 004
-- applied). The exact time was not recorded, so this version number is a bound
-- that sorts correctly, not a clock reading.
--
-- Production evidence: profiles.stripe_* / subscription_status / current_period_end /
-- plan / cancel_at_period_end columns, index profiles_stripe_customer_id_key,
-- provisions.search_vector (generated), index provisions_search_vector_idx, and the
-- two "subscribers can read all ..." policies (using the "(select auth.uid())" form
-- below) all exist. The column comment that 002_subscriptions.sql would have left on
-- profiles.subscription_status is absent, which is how we know this bundle ran
-- rather than 002 itself. search_provisions() as created here was later replaced by
-- 20260919035558_provision_path_on_search_results.
--
-- Nothing below the next line was changed. Every statement is idempotent
-- (if not exists / drop if exists / create or replace); the UPDATE touches zero rows
-- on an empty database.
-- ---------------------------------------------------------------------------

-- =====================================================================
-- EssentialRegs — one-time setup for Stripe billing + site search.
-- Paste this WHOLE file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- 1. Subscription columns on profiles
alter table profiles add column if not exists stripe_customer_id     text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists subscription_status    text;
alter table profiles add column if not exists current_period_end     timestamptz;
alter table profiles add column if not exists plan                   text;
alter table profiles add column if not exists cancel_at_period_end   boolean not null default false;
create unique index if not exists profiles_stripe_customer_id_key on profiles (stripe_customer_id);

-- 2. Keep every EXISTING account (today: just the owner) on full access.
--    New signups after this get access only by subscribing.
update profiles set access_granted = true;

-- 3. New access gate: subscriber OR access_granted
drop policy if exists "subscribers can read all provisions" on provisions;
create policy "subscribers can read all provisions"
  on provisions for select to authenticated
  using (exists (select 1 from profiles p
                 where p.id = (select auth.uid())
                   and (p.access_granted or p.subscription_status in ('active','trialing'))));

drop policy if exists "subscribers can read all cross-refs" on cross_references;
create policy "subscribers can read all cross-refs"
  on cross_references for select to authenticated
  using (exists (select 1 from profiles p
                 where p.id = (select auth.uid())
                   and (p.access_granted or p.subscription_status in ('active','trialing'))));

-- 4. Retire the old "any logged-in user sees everything" gate
drop policy if exists "authenticated users can read all provisions"  on provisions;
drop policy if exists "authenticated users can read all cross-refs"  on cross_references;
drop policy if exists "granted users can read all provisions"        on provisions;
drop policy if exists "granted users can read all cross-refs"        on cross_references;

-- 5. Full-text search (takes a few seconds — it indexes ~4,400 rows)
alter table provisions
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(citation, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(regexp_replace(full_text, '<[^>]+>', ' ', 'g'), '')), 'C')
  ) stored;
create index if not exists provisions_search_vector_idx on provisions using gin (search_vector);

create or replace function search_provisions(q text, lim int default 25)
returns table (id text, citation text, title text, reg_key text, headline text, rank real)
language sql stable security invoker set search_path = public as $$
  with query as (select websearch_to_tsquery('english', q) as tsq),
  hits as (
    select p.id, p.citation, p.title, p.full_text, ts_rank(p.search_vector, query.tsq) as rank
    from provisions p, query
    where p.search_vector @@ query.tsq
    order by rank desc, p.sort_order asc
    limit lim
  )
  select hits.id, hits.citation, hits.title,
    substring(hits.id from '^sec-([^-]+)-') as reg_key,
    ts_headline('english', regexp_replace(hits.full_text, '<[^>]+>', ' ', 'g'), query.tsq,
      'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1') as headline,
    hits.rank
  from hits, query
  order by hits.rank desc;
$$;
grant execute on function search_provisions(text, int) to anon, authenticated;

-- 6. Sanity check — you should see the two "subscribers can read..." policies and a search hit.
select policyname from pg_policies where tablename in ('provisions','cross_references') order by 1;
select id, citation, reg_key from search_provisions('fugitive emissions', 3);
