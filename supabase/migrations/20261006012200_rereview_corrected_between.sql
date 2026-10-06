-- rereview_corrected_between: the paged, upper-bounded form of
-- rereview_corrected_since (pipeline/review.py --redo-corrections-since).
-- PostgREST caps a function's result at 1,000 rows, which left 247 of 1,247
-- rows out of the first redo run (5 Oct 2026); the pipeline now pages with
-- p_limit/p_offset, and p_until bounds the correction time from above so a
-- redo can be resumed without re-selecting rows an earlier redo already
-- re-corrected (their reviewed_at moved forward). rereview_corrected_since
-- stays as it was. Read-only; service role only.

create or replace function public.rereview_corrected_between(
  p_since  timestamptz,
  p_until  timestamptz default null,
  p_limit  integer default 500,
  p_offset integer default 0
)
returns table (id text, before_summary text, live_summary text, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = public, archive
as $$
  select s.id, s.ai_summary, p.ai_summary, p.reviewed_at
  from archive.summary_review_snapshot_rereview s
  join public.provisions p on p.id = s.id
  where p.reviewed_by like '%summary corrected, automated pipeline%'
    and p.reviewed_at >= p_since
    and (p_until is null or p.reviewed_at < p_until)
    and p.summary_status in ('approved', 'edited')
  order by p.sort_order, s.id
  limit greatest(1, least(coalesce(p_limit, 500), 1000))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.rereview_corrected_between(timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.rereview_corrected_between(timestamptz, timestamptz, integer, integer) to service_role;
