-- profiles: one row per authenticated user, auto-created on signup.
-- access_granted is the manual "early access" switch -- flip it to true for a
-- user (via SQL) to let them read subscriber-only content before the paid
-- subscription flow exists. Users cannot set this themselves: there is no
-- update policy for authenticated users on this table.
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

-- Extend provisions visibility: signed-in users Brody has manually granted
-- access to (profiles.access_granted = true) can read everything, not just
-- is_public rows. This is the "approve access by hand" mechanism until the
-- paid subscription flow replaces it.
drop policy if exists "granted users can read all provisions" on provisions;
create policy "granted users can read all provisions"
  on provisions for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.access_granted = true
    )
  );

drop policy if exists "granted users can read all cross-refs" on cross_references;
create policy "granted users can read all cross-refs"
  on cross_references for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.access_granted = true
    )
  );
