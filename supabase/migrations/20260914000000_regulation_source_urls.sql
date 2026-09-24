-- Reconciled 2026-09-24. Source: supabase/migrations/RUN_ME_3_source_urls_in_Supabase_SQL_Editor.sql
-- (now supabase/migrations_archive/). Data only: four UPDATEs, no schema change.
-- Applied 2026-09-14 through the Supabase connector (docs/CEO_Brief_2026-09-14.md,
-- status update: "source_url was already populated for all 4 regulation roots
-- (via a same-day Supabase update, URLs supplied directly by Brody)"). Exact time
-- not recorded; the version number is the date.
--
-- Production evidence: the four rows carry exactly these URLs (read back 2026-09-24).
-- On an empty database these statements update zero rows and succeed.
--
-- Nothing below the next line was changed.
-- ---------------------------------------------------------------------------

-- =====================================================================
-- EssentialRegs — official source links for each regulation.
-- Paste this WHOLE file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once (plain UPDATEs, no schema changes).
-- =====================================================================
--
-- Populates provisions.source_url (added in schema.sql, "canonical
-- government source link") on each regulation's own root row (the id
-- containing "-top-REG-"). The app already renders a "View official
-- source" link wherever this is non-null (src/app/regulations/[reg]/page.tsx
-- and src/app/regulations/[reg]/preview/page.tsx) -- until this runs, that
-- link simply doesn't show, so nothing else needs to change.
--
-- URLs supplied by Brody:
--   - CDPHE Regulation Number 3, 7, and 26 all point at the same AQCC
--     regulations index page (there isn't a separate page per regulation).
--   - 40 CFR Part 60 Subpart OOOOb points at its eCFR.gov page.

update provisions
set source_url = 'https://cdphe.colorado.gov/aqcc-regulations'
where id = 'sec-3-top-REG-3';

update provisions
set source_url = 'https://cdphe.colorado.gov/aqcc-regulations'
where id = 'sec-7-top-REG-7';

update provisions
set source_url = 'https://cdphe.colorado.gov/aqcc-regulations'
where id = 'sec-26-top-REG-26';

update provisions
set source_url = 'https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-60/subpart-OOOOb'
where id = 'sec-oooob-top-REG-oooob';
