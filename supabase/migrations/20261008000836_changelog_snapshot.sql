-- regenerated 2026-10-17 from schema_migrations.statements (the repository copy named below is now supabase/migrations_archive/20261007121000_changelog_snapshot.sql)
-- /changelog answered 500 on 7 Oct 2026 (statement timeout in
-- changelog_public() while imports were writing). The page now reads a
-- stored snapshot refreshed by the pipeline after every write; a failed
-- refresh leaves the previous rows. Full commentary in the repository copy:
-- supabase/migrations/20261007121000_changelog_snapshot.sql

create table if not exists public.changelog_snapshot (
  id integer primary key default 1 check (id = 1),
  rows jsonb not null,
  computed_at timestamptz not null default now(),
  compute_ms integer
);
alter table public.changelog_snapshot enable row level security;
revoke all on table public.changelog_snapshot from public, anon, authenticated;
comment on table public.changelog_snapshot is
  'The last good result of changelog_public() as a JSON array (one row, id 1), read by /changelog through changelog_snapshot_public() and rewritten by refresh_changelog_snapshot(). Counts only; no notes, no ids.';

create or replace function public.refresh_changelog_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
declare
  t0 timestamptz := clock_timestamp();
  j jsonb;
  ms integer;
begin
  select coalesce(jsonb_agg(to_jsonb(r) order by r.latest desc), '[]'::jsonb)
    into j
    from changelog_public() r;
  ms := (extract(epoch from clock_timestamp() - t0) * 1000)::integer;
  insert into changelog_snapshot (id, rows, computed_at, compute_ms)
  values (1, j, now(), ms)
  on conflict (id) do update
    set rows = excluded.rows, computed_at = excluded.computed_at, compute_ms = excluded.compute_ms;
  return jsonb_build_object('rows', jsonb_array_length(j), 'computed_at', now(), 'compute_ms', ms);
end;
$$;

revoke all on function public.refresh_changelog_snapshot() from public, anon, authenticated;
grant execute on function public.refresh_changelog_snapshot() to service_role;
comment on function public.refresh_changelog_snapshot() is
  'Recomputes changelog_snapshot from changelog_public() (120 s timeout) and returns {rows, computed_at, compute_ms}. On failure the previous snapshot stays. service_role only.';

create or replace function public.changelog_snapshot_public()
returns table (rows jsonb, computed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.rows, s.computed_at from changelog_snapshot s where s.id = 1;
$$;

revoke all on function public.changelog_snapshot_public() from public;
grant execute on function public.changelog_snapshot_public() to anon, authenticated;
comment on function public.changelog_snapshot_public() is
  'The stored changelog counts (changelog_snapshot) and when they were computed, for /changelog. Empty when the snapshot has never been written.';
