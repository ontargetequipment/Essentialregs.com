-- ReviewBuiltIn (owner decision, Brody, 5 Oct 2026): review is part of how a
-- regulation gets onto the site. No summary reaches a customer labelled
-- "AI reviewed" without passing through pipeline/review.py, and nobody has
-- to ask for it.
--
-- This trigger makes an approval outside the pipeline impossible rather than
-- merely caught: a row may only become (or stay, when re-stamped)
-- summary_status 'approved' or 'edited' when reviewed_by carries the
-- pipeline's mark ('automated pipeline' -- both REVIEWED_BY_* stamps in
-- review.py do) and reviewed_at is set. Every other transition is untouched:
-- the importer and the summarizer set 'pending', the admin page may set
-- 'rejected' or 'pending'. The admin page's Approve / Save edit & approve
-- actions were removed in the same change (src/app/admin/review/actions.ts);
-- the hand SQL files under docs/imports from September cannot run any more
-- (they would raise here).
--
-- Corpus QA checks approved_outside_pipeline, approved_without_review_date and
-- summary_pending_over_24h (scripts/corpus_qa.sql) stay in place as the
-- loud failure if this trigger is ever dropped.

create or replace function public.summary_approval_only_by_pipeline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.summary_status in ('approved', 'edited')
     and (tg_op = 'INSERT'
          or old.summary_status is distinct from new.summary_status
          or old.ai_summary is distinct from new.ai_summary
          or old.reviewed_by is distinct from new.reviewed_by) then
    if new.reviewed_by is null or new.reviewed_by not ilike '%automated pipeline%' then
      raise exception 'summary_status % on % requires the automated pipeline review (pipeline/review.py); reviewed_by is %',
        new.summary_status, new.id, coalesce(new.reviewed_by, 'null')
        using errcode = 'check_violation';
    end if;
    if new.reviewed_at is null then
      raise exception 'summary_status % on % requires reviewed_at', new.summary_status, new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.summary_approval_only_by_pipeline() is
  'Refuses summary_status approved/edited unless reviewed_by carries ''automated pipeline'' and reviewed_at is set (ReviewBuiltIn, 6 Oct 2026). Only pipeline/review.py approves a summary.';

drop trigger if exists provisions_summary_approval_only_by_pipeline on public.provisions;
create trigger provisions_summary_approval_only_by_pipeline
  before insert or update of summary_status, ai_summary, reviewed_by, reviewed_at on public.provisions
  for each row execute function public.summary_approval_only_by_pipeline();

comment on column public.provisions.summary_status is
  'Moderation state of ai_summary: pending (written, not yet reviewed), approved (the automated second-pass review passed it), edited (the review corrected it), rejected (withheld from readers). Only pipeline/review.py may set approved/edited (trigger provisions_summary_approval_only_by_pipeline); the summarizer and the importer set pending; src/app/admin/review/actions.ts may set rejected or pending.';
