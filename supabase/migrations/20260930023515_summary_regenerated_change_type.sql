-- Phase 0: parent summaries regenerated from parent + descendants.
--
-- pipeline/summarize.py --parents rewrites the ai_summary of every row that
-- has children and puts it back in the review queue. It records each rewrite
-- in provision_changes, which needs a new change_type value; and the
-- summary_status column comment, which named the admin review actions as the
-- column's only writer, now names the pipeline as its second writer.
--
-- No other schema change: search_provisions, provision_path, grants and RLS
-- are untouched.

alter table provision_changes
  drop constraint if exists provision_changes_change_type_check;

alter table provision_changes
  add constraint provision_changes_change_type_check check (
    change_type in (
      'summary_approved', 'summary_edited', 'summary_rejected',
      'text_updated', 'added', 'summary_regenerated'
    )
  );

comment on column provisions.summary_status is
  'Moderation state of ai_summary: pending (not yet reviewed), approved (reviewed as-is), edited (reviewer changed the text), rejected (summary withheld from readers). Written by src/app/admin/review/actions.ts via the service-role client, and by pipeline/summarize.py --parents, which sets it back to pending (clearing reviewed_by/reviewed_at) whenever it regenerates a parent summary from the parent plus its descendants.';
