-- regenerated 2026-10-17 from schema_migrations.statements (piece 1 of 6 of supabase/migrations_archive/20261008040000_regulation_release_state.sql)
create table if not exists public.regulation_releases (
  reg_key     text primary key,
  status      text not null check (status in ('staged', 'released')),
  staged_at   timestamptz not null default now(),
  released_at timestamptz,
  note        text
);
comment on table public.regulation_releases is
  'Release state per document (reg_key). No row or released = visible to subscribers; staged = a newly imported document hidden from subscribers (reader, keyword search, Ask, related, previews, changelog) and unlinked by other documents until released. Written by pipeline/import_ccr.py (apply --execute inserts staged; release flips it).';
alter table public.regulation_releases enable row level security;
grant select, insert, update, delete on table public.regulation_releases to service_role;

create or replace function public.reg_is_released(p_reg_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.regulation_releases r
    where r.reg_key = p_reg_key and r.status = 'staged'
  );
$$;
comment on function public.reg_is_released(text) is
  'True unless regulation_releases marks the reg_key staged. SECURITY DEFINER so RLS policies and the Ask functions can consult the (service_role-only) table. No row = released.';
grant execute on function public.reg_is_released(text) to anon, authenticated, service_role;
