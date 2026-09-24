-- 002_subscriptions.sql — Stripe subscription billing
--
-- Run this once in the Supabase SQL Editor (after supabase/schema.sql).
-- Safe to re-run: every statement is IF NOT EXISTS / DROP IF EXISTS + CREATE.
--
-- What it does:
--   1. Adds Stripe subscription columns to `profiles`. These are written ONLY
--      by the Stripe webhook (src/app/api/stripe/webhook/route.ts) using the
--      service-role key. There is deliberately no RLS update policy on
--      profiles, so a user can't set their own subscription_status.
--   2. Replaces the "any authenticated user can read everything" policies
--      from schema.sql with policies that require either an active/trialing
--      Stripe subscription or the manual `access_granted` override.
--      The anon "public can read public provisions" policies are untouched,
--      so the free /sample page keeps working.

-- 1. Subscription columns -------------------------------------------------

alter table profiles add column if not exists stripe_customer_id     text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists subscription_status    text;        -- Stripe's status string: active, trialing, past_due, canceled, unpaid, incomplete, ...
alter table profiles add column if not exists current_period_end     timestamptz; -- end of the paid period (access runs until here when canceled)
alter table profiles add column if not exists plan                   text;        -- Stripe Price nickname or id the subscription is on
alter table profiles add column if not exists cancel_at_period_end   boolean not null default false; -- user canceled; status stays 'active' until current_period_end

-- One Stripe customer maps to exactly one profile.
create unique index if not exists profiles_stripe_customer_id_key
  on profiles (stripe_customer_id);

comment on column profiles.subscription_status is
  'Mirror of Stripe subscription.status, maintained by the Stripe webhook. Access requires active or trialing (or access_granted = true).';

-- 2. Replace the login-only gate with the subscription gate ---------------
--
-- The subquery reads the caller's own profiles row. That's allowed by the
-- existing "users can read own profile" policy (auth.uid() = id), and since
-- it doesn't reference the outer row Postgres evaluates it once per query,
-- not once per provision.

-- Old policies from schema.sql (both spellings, in case an older run exists).
drop policy if exists "authenticated users can read all provisions" on provisions;
drop policy if exists "granted users can read all provisions"       on provisions;
drop policy if exists "subscribers can read all provisions"         on provisions;

create policy "subscribers can read all provisions"
  on provisions for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid())
        and (p.access_granted or p.subscription_status in ('active', 'trialing'))
    )
  );

drop policy if exists "authenticated users can read all cross-refs" on cross_references;
drop policy if exists "granted users can read all cross-refs"       on cross_references;
drop policy if exists "subscribers can read all cross-refs"         on cross_references;

create policy "subscribers can read all cross-refs"
  on cross_references for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid())
        and (p.access_granted or p.subscription_status in ('active', 'trialing'))
    )
  );

-- The anon policies ("public can read public provisions" / "...cross-refs of
-- public provisions") from schema.sql stay in place. Postgres ORs permissive
-- policies together, so a subscriber sees everything and everyone else sees
-- only is_public rows.
