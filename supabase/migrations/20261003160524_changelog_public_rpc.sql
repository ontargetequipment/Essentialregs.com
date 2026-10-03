-- Customer-facing changelog.
--
-- /changelog used to render provision_changes row by row for any signed-in
-- user, note column included. The notes are the pipeline's and the
-- reviewers' working log ("Phase 0: regenerated from provision + 4
-- descendants (model ...)", "owner instruction 2026-09-16", ...), and the
-- raw change_type values leaked where no label existed. A reviewer read it
-- as an unfinished engineering log on a paid product.
--
-- changelog_public() returns only counts: one row per Denver calendar day,
-- regulation and change type, with no notes, no provision ids and no row
-- ids. Statement-of-basis and ordinary provisions count alike. The page
-- folds the change types into one line per regulation per day.
--
-- security definer, because provision_changes has no `anon` select policy
-- (20260913000100) and must keep none: the function is the only thing an
-- anonymous visitor can read from the table, and it cannot return a note.
-- Rejected summaries are left out: a withheld summary is not a change a
-- reader can see.

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
