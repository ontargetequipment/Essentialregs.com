-- regenerated 2026-10-17 from schema_migrations.statements (the earlier repository copy, numbered 20261003160524, is in supabase/migrations_archive/)
create or replace function public.changelog_public()
returns table (
  day date,
  reg_key text,
  change_type text,
  provision_count bigint,
  latest timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (c.created_at at time zone 'America/Denver')::date as day,
    coalesce(p.reg_key, substring(c.provision_id from '^sec-([^-]+)-')) as reg_key,
    c.change_type,
    count(distinct coalesce(c.provision_id, c.id::text)) as provision_count,
    max(c.created_at) as latest
  from provision_changes c
  left join provisions p on p.id = c.provision_id
  where c.change_type in (
    'text_updated', 'summary_approved', 'summary_edited',
    'summary_regenerated', 'added'
  )
  group by 1, 2, 3
  order by max(c.created_at) desc;
$$;

revoke all on function public.changelog_public() from public;
grant execute on function public.changelog_public() to anon, authenticated;

comment on function public.changelog_public() is
  'Counts of provision_changes by Denver day, regulation and change type, for /changelog. Returns no notes or ids; the only read of provision_changes an anonymous visitor has.';
