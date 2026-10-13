-- The eight Regulation 7 rows the /sample Ask example cites that were still
-- locked (walkthrough v3.1, 13 Oct 2026; owner-approved, cap of eight).
-- Applied to production 13 Oct 2026 through the Supabase connector
-- (apply_migration), recorded as version 20261013051740; the file is named
-- for that version. Read back: all eight public; Regulation 7 public rows
-- 16 -> 24.
--
-- Why: the tenth outside review followed a citation of the sample page's Ask
-- example (Regulation 7 I.D.3.a.(ii), from the map's introduction) and met the
-- subscribe wall. The example cites these Regulation 7 provisions (the
-- storage-tanks map's canonical rows, its introduction's cites and one
-- retrieval hit); every other one was public already (I.D, I.D.4 since
-- 20261013014006; I.D.3.a.(i) the older sample row):
--
--   sec-7-B-I-B-30         I.B.30.         "Storage tank" (definition, Section I)
--   sec-7-B-I-B-34         I.B.34.         "Well production facility"
--   sec-7-B-II-A-43        II.A.43.        "Storage tank" (definition, Section II)
--   sec-7-B-I-D-3-a-(ii)   I.D.3.a.(ii).   the 2 tons per year control threshold
--   sec-7-B-I-E            I.E.            Monitoring of storage tanks (heading row)
--   sec-7-B-I-F            I.F.            Storage tank recordkeeping and reporting (heading row)
--   sec-7-B-II-C           II.C.           Emission reduction from storage tanks (heading row)
--   sec-7-B-V-C-2-w        V.C.2.w.        Produced water storage tanks (a listing row)
--
-- I.B.9 ("Condensate storage tank") is a canonical row of the map too, but
-- the example states produced water, so the layout omits it; it stays locked.
-- A heading row's children stay locked: its focused preview shows the
-- heading's own text and says how many rows are left out ("… N more
-- provisions in the full corpus", v3.1). Nothing else changes: RLS and the
-- paywall are as they were; a row is readable because its flag is.
--
-- Data only, no DDL; idempotent (the predicate skips rows already public).

update public.provisions
   set is_public = true
 where id in (
   'sec-7-B-I-B-30',
   'sec-7-B-I-B-34',
   'sec-7-B-II-A-43',
   'sec-7-B-I-D-3-a-(ii)',
   'sec-7-B-I-E',
   'sec-7-B-I-F',
   'sec-7-B-II-C',
   'sec-7-B-V-C-2-w'
 )
   and is_public = false;
