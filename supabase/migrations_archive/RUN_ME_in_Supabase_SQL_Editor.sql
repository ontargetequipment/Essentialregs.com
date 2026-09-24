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
