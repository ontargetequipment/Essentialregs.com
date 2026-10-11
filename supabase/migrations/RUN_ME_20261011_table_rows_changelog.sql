-- The table-continuation re-imports of 11 Oct 2026 (Sprint 7 PR 1,
-- pipeline/table_rows.py) are corrections to our copy, not agency changes and
-- not link changes. Applied to production by the CEO session with the
-- Supabase connector on 11 Oct 2026 (returned the five rows below), then the
-- changelog snapshot was refreshed.
--
-- The importer logs a full_text change as text_updated when its letters or
-- digits moved (changelog_sources.py then relabels it transcription_corrected:
-- 11 rows) and as links_updated when they did not. Five provisions changed
-- only by rows the table fix rejoined without moving a letter -- four lost
-- table rows with no text in any cell, and GP09 VI.A.2's wrapped cell had an
-- empty first column -- so they were logged links_updated, which the public
-- changelog would have counted as "links added or updated". Those five rows
-- are relabelled here. (sec-gp12-VII-C-2-c-(ii)'s links_updated row of 03:26
-- UTC is the cross-regulation Part link update of PR #98, and stays.)

update public.provision_changes
set change_type = 'transcription_corrected',
    note = 'Table rows rejoined: a wrapped cell''s second line, or a row with no text, put back into the row above (pipeline/table_rows.py, 11 Oct 2026). Same words.'
where id in (28975, 28977, 28988, 28989, 28999)
  and change_type = 'links_updated'
  and provision_id in ('sec-gp09-VI-A-2', 'sec-21-A-II-O', 'sec-22-B-I-E-1', 'sec-22-B-I-E-2', 'sec-8-B-II-B-2');

select public.refresh_changelog_snapshot();
