-- /changelog: a summary rewritten and AI reviewed in the same run is one
-- statement, not two.
--
-- The 6 Oct 2026 acceptance pass read, logged out: "APCD General Permit
-- GP03 -- 5 summaries AI reviewed (1 corrected) · 5 summaries rewritten,
-- awaiting AI review". Both phrases described the same five summaries: the
-- chained run (run_chain.py) writes a `summary_regenerated` row when it
-- rewrites a summary and a `summary_approved` / `summary_edited` row minutes
-- later when its reviewer approves it, and changelog_public() counted the
-- two rows as two unrelated events.
--
-- changelog_public() now pairs every `summary_regenerated` row with the first
-- approval or correction of the same provision in the 24 hours after it (the
-- chained run reviews what it wrote within the hour; a day covers a run that
-- stalled on the Batches API) and reports the pair once, on the day of the
-- rewrite, under one of these change types:
--
--   summary_rewritten_reviewed        rewritten and passed by the reviewer
--   summary_rewritten_corrected       rewritten and corrected by the reviewer
--   summary_rewritten_pending         rewritten, no review yet, and the
--                                     provision is still pending now
--   summary_rewritten_reviewed_later  rewritten, reviewed more than 24 hours
--                                     later (that review is counted on its
--                                     own day as before)
--
-- The approval or correction row a rewrite is paired with is left out of
-- `summary_approved` / `summary_edited`, so nothing is counted twice. Every
-- other change type is reported exactly as before. The page
-- (src/lib/changelog-group.ts) words them: "5 summaries rewritten and AI
-- reviewed (1 corrected)", "2 summaries rewritten (AI reviewed later)",
-- "1 summary rewritten, awaiting AI review". It still folds a plain
-- `summary_regenerated` row as pending, so the page and this function can be
-- deployed in either order.
--
-- Same contract as before: counts by Denver day, regulation and change type;
-- no notes, no ids, no row ids. SECURITY DEFINER for the same reason (no
-- `anon` policy on provision_changes); corpus QA check 15 exempts it by name.

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
    -- Every rewrite, with the first review of the same provision that
    -- followed it within 24 hours (null when none did).
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
    -- The review rows a rewrite claimed: reported with the rewrite, not again.
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
    -- 'removed' rows hang off the surviving parent and count per row, as
    -- since 20261004200000.
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
