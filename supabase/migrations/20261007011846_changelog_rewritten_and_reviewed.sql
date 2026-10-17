-- regenerated 2026-10-17 from schema_migrations.statements (20261007010000 is the duplicate record of this change; its earlier text is in supabase/migrations_archive/)
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
  with regen as (
    select c.id, c.provision_id, c.created_at,
      (select min(r.created_at)
         from provision_changes r
        where r.provision_id = c.provision_id
          and r.change_type in ('summary_approved', 'summary_edited')
          and r.created_at >= c.created_at
          and r.created_at < c.created_at + interval '24 hours') as reviewed_at
    from provision_changes c
    where c.change_type = 'summary_regenerated'
      and c.provision_id is not null
  ),
  paired as (
    select distinct g.provision_id, g.reviewed_at as created_at
    from regen g
    where g.reviewed_at is not null
  ),
  events as (
    select c.id, c.provision_id, c.created_at, c.change_type
    from provision_changes c
    where c.change_type in ('text_updated', 'added', 'removed')
    union all
    select c.id, c.provision_id, c.created_at, c.change_type
    from provision_changes c
    where c.change_type in ('summary_approved', 'summary_edited')
      and not exists (
        select 1 from paired k
        where k.provision_id = c.provision_id and k.created_at = c.created_at
      )
    union all
    select g.id, g.provision_id, g.created_at,
      case
        when g.reviewed_at is not null then
          case when exists (
                 select 1 from provision_changes r
                 where r.provision_id = g.provision_id
                   and r.created_at = g.reviewed_at
                   and r.change_type = 'summary_edited')
               then 'summary_rewritten_corrected'
               else 'summary_rewritten_reviewed'
          end
        when p.summary_status = 'pending' then 'summary_rewritten_pending'
        else 'summary_rewritten_reviewed_later'
      end
    from regen g
    left join provisions p on p.id = g.provision_id
  )
  select
    (e.created_at at time zone 'America/Denver')::date as day,
    coalesce(p.reg_key, substring(e.provision_id from '^sec-([^-]+)-')) as reg_key,
    e.change_type,
    count(distinct case when e.change_type = 'removed' then e.id::text
                        else coalesce(e.provision_id, e.id::text) end) as provision_count,
    max(e.created_at) as latest
  from events e
  left join provisions p on p.id = e.provision_id
  group by 1, 2, 3
  order by max(e.created_at) desc;
$$;

revoke all on function public.changelog_public() from public;
grant execute on function public.changelog_public() to anon, authenticated;

comment on function public.changelog_public() is
  'Counts of provision_changes by Denver day, regulation and change type, for /changelog. A summary_regenerated row paired with the approval or correction that followed it within 24 hours is reported once as summary_rewritten_reviewed / summary_rewritten_corrected (that review row is not counted again); an unpaired rewrite is summary_rewritten_pending while the provision is pending, else summary_rewritten_reviewed_later. Returns no notes or ids; the only read of provision_changes an anonymous visitor has.';
