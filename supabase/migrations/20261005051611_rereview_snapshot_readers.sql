-- Read access to the re-review snapshot for the pipeline (pipeline/review.py,
-- Oct 2026). The archive schema is not exposed through PostgREST, so two
-- service-role functions return what the reviewer needs:
--
--   rereview_snapshot_text(ids)       the BEFORE summary of each id as it stood
--                                     before the first re-review write
--                                     (--audit-ids --from-snapshot, read-only)
--   rereview_corrected_since(since)   every snapshotted row whose live row the
--                                     pipeline corrected at or after `since`,
--                                     with the before text and the live text
--                                     (--redo-corrections-since: review the
--                                     before text again with better context)
--
-- Neither writes anything. Service role only.

create or replace function public.rereview_snapshot_text(p_ids text[])
returns table (id text, ai_summary text, snapshot_at timestamptz)
language sql
stable
security definer
set search_path = public, archive
as $$
  select s.id, s.ai_summary, s.snapshot_at
  from archive.summary_review_snapshot_rereview s
  where s.id = any (p_ids);
$$;

revoke all on function public.rereview_snapshot_text(text[]) from public, anon, authenticated;
grant execute on function public.rereview_snapshot_text(text[]) to service_role;

create or replace function public.rereview_corrected_since(p_since timestamptz)
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
    and p.summary_status in ('approved', 'edited')
  order by p.sort_order, s.id;
$$;

revoke all on function public.rereview_corrected_since(timestamptz) from public, anon, authenticated;
grant execute on function public.rereview_corrected_since(timestamptz) to service_role;
