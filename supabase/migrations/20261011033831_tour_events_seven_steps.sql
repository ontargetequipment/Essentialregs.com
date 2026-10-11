-- The walkthrough has seven steps (Sprint 7, 11 Oct 2026): the step column of
-- public.tour_events accepted 1-6 (20261011014953_tour_events.sql), so a step-7
-- tour_step, tour_complete or tour_trial_click would have been refused.
--
-- Applied to production with the Supabase connector's apply_migration, which
-- recorded this version (it went through at once, DROP CONSTRAINT and all).
-- Widening only: every row already stored satisfies the new check.

alter table public.tour_events
  drop constraint tour_events_step_check,
  add constraint tour_events_step_check check (step between 1 and 7);

comment on table public.tour_events is 'Guided GP05 walkthrough counts (Sprint 6, seven steps since Sprint 7): one row per tour event. Insert-only for anon/authenticated; no PII.';
