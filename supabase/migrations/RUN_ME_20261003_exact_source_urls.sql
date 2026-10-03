-- Exact official-source links (Sprint 2, 2026-10-03).
--
-- BEFORE: every AQCC provision carried https://cdphe.colorado.gov/aqcc-regulations,
-- every ECMC provision https://ecmc.colorado.gov/regulatory/rules, and every general-permit
-- provision https://cdphe.colorado.gov/apcd/general-air-permits (generic index pages). A
-- reviewer marked the site down because "View official source" did not land on the
-- exact official document.
--
-- AFTER (section 1): each AQCC regulation, and ECMC's 2 CCR 404-1, links to its own page on
-- the Colorado Secretary of State's Code of Colorado Regulations site
-- (DisplayRule.do?action=ruleinfo&ruleId=..., the stable page that always shows the CURRENT
-- version of the rule, so it does not go stale at the next rulemaking). Every URL was fetched
-- on 2026-10-03 and the page heading matched the CCR number and title recorded here.
--
-- SCOPE (read from production 2026-10-03): the app resolves the link as
-- provisions.source_url ?? root.source_url, and production carries the generic URL on EVERY
-- provision of these regulations, not just the root (only Reg 3, Reg 7, Reg 26 and OOOOb have
-- NULL source_url on most child rows; those fall back to the root and need no change). So this
-- updates by reg_key, matching only rows that still hold the old generic URL.
--   * Idempotent: a second run matches zero rows.
--   * Leaves any row with a different (manually set) URL alone.
--   * Federal eCFR rows are untouched.
--   * Touches only source_url (provisions_set_updated_at bumps updated_at; the
--     log_provision_text_updated trigger fires only on full_text changes, so
--     provision_changes gets no rows).
-- Not applied by the agent that wrote it. The CEO session reviews, renames to a timestamped
-- migration (supabase/migrations/README.md) and applies with apply_migration.
--
-- Source of truth in code: REG_META[<key>]["source_url"] in pipeline/import_ccr.py (a test
-- pins every value against pipeline/sources/manifest.json).
-- ---------------------------------------------------------------------------

-- 1. AQCC regulations (31) + ECMC 2 CCR 404-1: Secretary of State rule pages
update provisions p
set source_url = m.new_url
from (values
  ('1', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2335&deptID=16&agencyID=7'),  -- 5 CCR 1001-3
  ('2', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2336&deptID=16&agencyID=7'),  -- 5 CCR 1001-4
  ('3', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2337&deptID=16&agencyID=7'),  -- 5 CCR 1001-5
  ('4', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2338&deptID=16&agencyID=7'),  -- 5 CCR 1001-6
  ('6', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2340&deptID=16&agencyID=7'),  -- 5 CCR 1001-8
  ('7', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2341&deptID=16&agencyID=7'),  -- 5 CCR 1001-9
  ('8', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2343&deptID=16&agencyID=7'),  -- 5 CCR 1001-10
  ('9', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2344&deptID=16&agencyID=7'),  -- 5 CCR 1001-11
  ('10', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2345&deptID=16&agencyID=7'),  -- 5 CCR 1001-12
  ('11', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2346&deptID=16&agencyID=7'),  -- 5 CCR 1001-13
  ('12', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2348&deptID=16&agencyID=7'),  -- 5 CCR 1001-15
  ('15', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2351&deptID=16&agencyID=7'),  -- 5 CCR 1001-19
  ('16', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2350&deptID=16&agencyID=7'),  -- 5 CCR 1001-18
  ('18', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2354&deptID=16&agencyID=7'),  -- 5 CCR 1001-22
  ('19', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2355&deptID=16&agencyID=7'),  -- 5 CCR 1001-23
  ('20', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3282&deptID=16&agencyID=7'),  -- 5 CCR 1001-24
  ('21', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3303&deptID=16&agencyID=7'),  -- 5 CCR 1001-25
  ('22', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3325&deptID=16&agencyID=7'),  -- 5 CCR 1001-26
  ('23', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3344&deptID=16&agencyID=7'),  -- 5 CCR 1001-27
  ('24', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3409&deptID=16&agencyID=7'),  -- 5 CCR 1001-28
  ('25', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3410&deptID=16&agencyID=7'),  -- 5 CCR 1001-29
  ('26', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3411&deptID=16&agencyID=7'),  -- 5 CCR 1001-30
  ('27', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3412&deptID=16&agencyID=7'),  -- 5 CCR 1001-31
  ('28', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3408&deptID=16&agencyID=7'),  -- 5 CCR 1001-32
  ('29', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3435&deptID=16&agencyID=7'),  -- 5 CCR 1001-33
  ('30', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3464&deptID=16&agencyID=7'),  -- 5 CCR 1001-34
  ('31', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=3469&deptID=16&agencyID=7'),  -- 5 CCR 1001-35
  ('aqs', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2347&deptID=16&agencyID=7'),  -- 5 CCR 1001-14
  ('cp', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2334&deptID=16&agencyID=7'),  -- 5 CCR 1001-2
  ('proc', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2333&deptID=16&agencyID=7'),  -- 5 CCR 1001-1
  ('sip', 'https://cdphe.colorado.gov/aqcc-regulations',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2352&deptID=16&agencyID=7'),  -- 5 CCR 1001-20
  ('ecmc', 'https://ecmc.colorado.gov/regulatory/rules',
   'https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2124&deptID=13&agencyID=79')  -- 2 CCR 404-1
) as m(reg_key, old_url, new_url)
where p.reg_key = m.reg_key
  and p.source_url = m.old_url;

-- ---------------------------------------------------------------------------
-- Read-back (run after applying; expected: no row left on a generic URL, and the
-- pre-apply counts below move to the new URLs):
--
--   select reg_key, source_url, count(*) as rows
--   from provisions
--   where source_url like 'https://www.sos.state.co.us/CCR/%'
--      or source_url like 'https://oitco.hylandcloud.com/%'
--   group by 1, 2 order by 1;
--
--   -- must return 0 rows:
--   select reg_key, count(*) from provisions
--   where source_url in ('https://cdphe.colorado.gov/aqcc-regulations',
--                        'https://ecmc.colorado.gov/regulatory/rules')
--   group by 1;
--
--   -- every root row now on its exact URL (expect 32 SoS roots):
--   select id, source_url from provisions where parent_id is null
--   and (source_url like 'https://www.sos.state.co.us/CCR/%'
--        or source_url like 'https://oitco.hylandcloud.com/%') order by id;
--
-- Pre-apply row counts per URL group (read 2026-10-03): AQCC generic 12,378 rows /
-- 31 roots; ECMC generic 6,754 rows / 1 root; GP generic 2,074 rows / 11 roots.
