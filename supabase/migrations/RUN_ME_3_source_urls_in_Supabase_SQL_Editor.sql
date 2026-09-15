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
