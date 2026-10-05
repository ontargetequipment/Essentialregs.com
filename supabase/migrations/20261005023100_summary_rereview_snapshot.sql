-- Snapshot table and RPC for the re-review of earlier summaries
-- (pipeline/review.py --rereview, Oct 2026).
--
-- The 5 Oct 2026 review pass kept the pre-run text of every row it touched in
-- archive.summary_review_snapshot_20261005, a `create table as select` made
-- by hand before the first write. The re-review of the ~16,500 summaries the
-- September hand passes approved does the same thing from the pipeline: before
-- its first write it calls snapshot_summaries_for_rereview(ids) for every
-- selected row. The archive schema is not exposed through PostgREST, so the
-- copy is made server side by this security-definer function, callable by the
-- service role only.
--
-- One row per provision, keyed on id: a second call for the same id is a
-- no-op (`on conflict do nothing`), so the snapshot always holds the text as
-- it stood before the FIRST re-review write, whatever runs follow.

create table if not exists archive.summary_review_snapshot_rereview (
  id               text primary key,
  ai_summary       text,
  summary_original text,
  summary_status   text,
  reviewed_by      text,
  reviewed_at      timestamptz,
  summary_model    text,
  snapshot_at      timestamptz not null default now(),
  run_label        text
);

alter table archive.summary_review_snapshot_rereview enable row level security;

create or replace function public.snapshot_summaries_for_rereview(
  p_ids       text[],
  p_run_label text default null
)
returns integer
language plpgsql
security definer
set search_path = public, archive
as $$
declare
  n integer;
begin
  insert into archive.summary_review_snapshot_rereview
    (id, ai_summary, summary_original, summary_status, reviewed_by, reviewed_at, summary_model, run_label)
  select p.id, p.ai_summary, p.summary_original, p.summary_status, p.reviewed_by, p.reviewed_at,
         p.summary_model, p_run_label
  from public.provisions p
  where p.id = any (p_ids)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.snapshot_summaries_for_rereview(text[], text) from public, anon, authenticated;
grant execute on function public.snapshot_summaries_for_rereview(text[], text) to service_role;
