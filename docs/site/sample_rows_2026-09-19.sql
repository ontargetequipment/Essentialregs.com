-- Sample page: make four real, reviewed provisions public and retire the three
-- hand-typed placeholder rows (kept in the table, just not public).
-- All four summaries are reviewed (batch 3 / ECMC / Reg 7 earlier; GP02 II.A.2 in the
-- batch-4 review of 2026-09-19).
update provisions set is_public = true
 where id in ('sec-7-B-I-D-3-a-(i)', 'sec-gp02-II-A-2', 'sec-ecmc-604-a-(1)', 'sec-cp-I-G-90');
update provisions set is_public = false
 where id in ('osha-1910-119', 'ecmc-rule-604', 'cdphe-reg7-general');
select id, is_public, summary_status from provisions
 where is_public or id in ('osha-1910-119', 'ecmc-rule-604', 'cdphe-reg7-general') order by id;
