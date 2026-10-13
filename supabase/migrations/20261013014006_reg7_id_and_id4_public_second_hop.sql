-- Regulation 7, Part B, Sections I.D and I.D.4 become public (walkthrough v3,
-- 13 Oct 2026). Applied to production through the Supabase connector
-- (apply_migration) on 13 Oct 2026, recorded as version 20261013014006; the
-- file is named for that version.
--
-- Why: the walkthrough's second citation hop. After the visitor follows GP05
-- VI.C to Regulation 7 I.C.1 and opens I.C.1.a's summary, step "Follow this
-- one too" points at I.C.1.c's citation "Sections I.D., I.J., and I.K." and
-- has them follow "I.D." -- the Storage Tank Emission Controls section, the
-- natural next hop for a storage-tank question. Every citation inside I.C.1
-- (I., I.D., I.D.1., I.J., I.K.) landed on a locked row, so the owner allowed
-- at most two more public rows. These are the two:
--
--   sec-7-B-I-D     "I.D. Storage Tank Emission Controls" -- the cited heading,
--                   where the hop lands (/regulations/7/preview?p=sec-7-B-I-D)
--   sec-7-B-I-D-4   "Alternative emissions control equipment ..." -- the one
--                   substantive child worth reading there (I.D.1 and I.D.2 are
--                   repealed stubs, I.D.3 is a heading over 17 locked rows);
--                   GP05 VI.C itself cites I.D.4 for alternative control
--                   equipment, so the visitor has already seen it named.
--
-- Nothing else changes: I.D.1, I.D.2, I.D.3 and its subtree, and I.D.4's three
-- children stay is_public = false and show as locked rows on the preview. The
-- older public sample row sec-7-B-I-D-3-a-(i) is untouched. Regulation 7's
-- reader stays closed to visitors (PUBLIC_READER_REGS is still ["gp05"]).
-- What is_public opens is listed in 20261010120000_gp05_public_sample.sql.
--
-- Corpus QA check 7 (public_sample_rows, scripts/corpus_qa.sql) counts these
-- two ids as a public set from the same change, so it still reads 4.
--
-- Read-back after apply: 2 rows updated, both is_public = true; the count of
-- public Regulation 7 rows went from 14 to 16.

update public.provisions
   set is_public = true
 where id in ('sec-7-B-I-D', 'sec-7-B-I-D-4')
   and is_public = false;
