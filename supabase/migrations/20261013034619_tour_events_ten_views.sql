-- Walkthrough v3 counts: tour_events.step takes 0-9 (13 Oct 2026). Applied to
-- production through the Supabase connector (apply_migration) on 13 Oct 2026,
-- recorded as version 20261013034619; the file is named for that version.
--
-- Why: the walkthrough now has an introduction (step 0) and nine steps
-- (src/lib/tour.ts, PR #121). The step column's check was 1-7 from
-- 20261011033831_tour_events_seven_steps.sql, so the first push of v3 folded
-- 0 and 7-9 into 1 and 7 to fit it. The owner chose to count every view on
-- its own instead, so the check is widened and that mapping is gone:
-- countedStep() is the identity and parseTourEvent accepts 0-9.
--
-- What each row means from this change on: tour_start and the first
-- tour_step carry 0, tour_step 1-9 as each view is reached (once per run),
-- tour_complete and tour_trial_click 9, tour_skip the step shown (the
-- closing card as 9). The 105 rows written before it (seven-step runs,
-- tour_complete at 7) are untouched and all within the new range; filter on
-- created_at to read either run alone (docs/CEO_PHASE_PLAN.md, Walkthrough
-- v3, "Counts").
--
-- Read-back after apply: tour_events_step_check = CHECK (((step >= 0) AND
-- (step <= 9))); 105 rows.

alter table public.tour_events
  drop constraint tour_events_step_check,
  add constraint tour_events_step_check check (step between 0 and 9);

comment on table public.tour_events is 'Guided GP05 walkthrough counts (Sprint 6; seven steps in Sprint 7; an introduction, step 0, and nine steps since walkthrough v3, 13 Oct 2026): one row per tour event. Insert-only for anon/authenticated; no PII.';
