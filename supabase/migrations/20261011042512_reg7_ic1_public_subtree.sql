-- Regulation 7, Part B, Section I.C.1 becomes public (Sprint 7, 11 Oct 2026).
--
-- The guided walkthrough's step 5 follows GP05 VI.C's citation of
-- "Regulation Number 7, Part B, Section I.C.1." The eighth outside review
-- (11 Oct) found that the click ended at a subscription preview, so the
-- visitor never read the cited text or came back to GP05. This file makes
-- that one cited requirement readable: sec-7-B-I-C-1 ("I.C.1. General
-- Requirements") and every row under it, 13 rows:
--
--   sec-7-B-I-C-1
--   sec-7-B-I-C-1-a  -b  -c  -d
--   sec-7-B-I-C-1-e  -e-(i)  -e-(ii)  -e-(iii)  -e-(iv)
--   sec-7-B-I-C-1-f  -f-(i)  -f-(ii)
--
-- Nothing else in Regulation 7 changes. Its parent (sec-7-B-I-C), its
-- siblings (I.C.2 ...) and the rest of the regulation keep is_public = false;
-- the one older public sample row, sec-7-B-I-D-3-a-(i), is untouched.
-- Regulation 7's reader stays closed to visitors (PUBLIC_READER_REGS is
-- still ["gp05"]); a visitor reads the subtree on the focused preview,
-- /regulations/7/preview?p=sec-7-B-I-C-1, which reads it through the
-- visitor's own RLS-bound client, so this flag is the gate.
--
-- What is_public opens is listed in 20261010120000_gp05_public_sample.sql:
-- the RLS read of the row (preview, /regs/<id>, keyword search snippets),
-- neighbour pairs whose BOTH ends are public, nothing else.
--
-- Matching: the subtree's ids are exactly sec-7-B-I-C-1 and the ids that
-- start with "sec-7-B-I-C-1-" (a hyphen after the 1, so I.C.10 or I.C.1x
-- could never match; neither exists). LIKE's "_" wildcard is not used.
--
-- Applied to production by the CEO session with the Supabase connector's
-- apply_migration, with the read-back below. Recorded like the GP05 unlock:
-- this file and docs/CEO_PHASE_PLAN.md (Sprint 7). A visibility change logs no
-- provision_changes row (the trigger fires on full_text only).
-- Idempotent. To undo: set is_public = false for the same 13 ids (and the
-- preview then shows the locked panel again by itself).

update public.provisions
set is_public = true
where reg_key = '7'
  and (id = 'sec-7-B-I-C-1' or left(id, length('sec-7-B-I-C-1-')) = 'sec-7-B-I-C-1-')
  and is_public is distinct from true;

-- Read-back (run after applying; expected values):
--   select id from public.provisions
--   where reg_key = '7' and is_public order by sort_order;
--   -- the 13 ids above, then sec-7-B-I-D-3-a-(i): 14 rows
