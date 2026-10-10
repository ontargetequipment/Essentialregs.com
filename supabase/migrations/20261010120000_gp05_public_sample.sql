-- GP05 becomes the public sample (Sprint 4, 10 Oct 2026).
--
-- APCD General Permit GP05, Produced Water Storage Tank Batteries (reg_key
-- 'gp05', 111 rows, root id sec-gp05-top-REG-gp05), is marked is_public so
-- that a logged-out visitor can read it in the REAL reader at
-- /regulations/gp05 and search it, instead of the four hand-picked cards the
-- old /sample page showed.
--
-- What provisions.is_public controls (it is the only thing this file changes):
--
--   1. RLS policy "public can read public provisions" on public.provisions
--      (select, to anon and authenticated, using (is_public = true)). A row
--      with the flag is returned by the visitor's own cookie-scoped client:
--      the reader's live fetch (fetchRegulationProvisions), keyword search
--      (search_provisions is a security-invoker function, so RLS applies
--      inside it), /api/provision/<id>, /regs/<id>.
--   2. RLS policy "public can read neighbors of public provisions" on
--      public.provision_neighbors: a neighbour pair is readable by a visitor
--      only when BOTH ends are public. With GP05 public, GP05 rows relate to
--      other GP05 rows for a visitor; a GP05 row whose nearest neighbour is
--      in Regulation 7 shows that neighbour to subscribers only.
--   3. The breadcrumb (public.provision_path, security definer, and the
--      computed column provisions.context_path built on it) walks ancestor
--      rows regardless of RLS, so a public row's "PART ... > II. ..." path
--      reads the same for everyone; it needs nothing from this file.
--
-- What it does NOT open: every other regulation stays subscriber-only (the
-- rows keep is_public = false), the Ask RPCs stay revoked from anon, and the
-- cached service-role reader body is never read for an unentitled request
-- (src/lib/reader-page.ts). The application gate in front of all this is
-- PUBLIC_READER_REGS in src/lib/destination.ts; keep the two in step.
--
-- Why GP05: it is a small, self-contained permit (111 rows) about one piece
-- of equipment, with a real set of cross-references into Regulation 3 and
-- Regulation 7, and it is the answer a produced-water tank operator needs.
-- It is small enough to give away whole and large enough to show the reader:
-- official text, summaries beside it, same-document cross-reference previews.
-- The old sample rows (Reg 7 I.D.3.a(i), GP02 II.A.2, ECMC 604.a(1), Common
-- Provisions I.G.90) keep is_public = true; their /regs/<id> pages stay.
--
-- Idempotent: the "is distinct from" guard makes a second run update nothing.
-- To undo: set is_public = false for reg_key = 'gp05' (and remove "gp05" from
-- PUBLIC_READER_REGS in the same deploy).

update public.provisions
set is_public = true
where reg_key = 'gp05'
  and is_public is distinct from true;

-- Read-back (expected after the update; run by hand, not part of the migration):
--   select count(*) as rows, count(*) filter (where is_public) as public_rows
--   from public.provisions where reg_key = 'gp05';
--   -- rows = 111, public_rows = 111
--   select count(*) from public.provisions where is_public and reg_key is distinct from 'gp05';
--   -- the four old sample rows plus any other earlier public rows; unchanged by this file
