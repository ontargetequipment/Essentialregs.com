-- Reg 7 root row: replace the placeholder title with the printed one.
--
-- The /regulations index card composes "Regulation Number 7 — <title>" from
-- the root row's title (regulationCardInfo, src/lib/regulation-pure.ts).
-- Reg 7, the first regulation imported, was stored with the placeholder
-- title "Regulation 7" (pipeline/import_ccr.py REG_META["7"].root_title),
-- so its card read "Regulation Number 7 — Regulation 7" next to Reg 3's
-- "Regulation Number 3 — STATIONARY SOURCE PERMITTING ...". Every other
-- numbered AQCC root stores the printed title followed by the CCR series;
-- this stores Reg 7's the same way (title page of pipeline/sources/REG_7.txt:
-- "REGULATION NUMBER 7 / CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS
-- OPERATIONS / 5 CCR 1001-9"). The importer's REG_META["7"].root_title is
-- changed in the same commit so a re-import keeps it.
--
-- The citation ("Regulation 7") is deliberately untouched: the reader <h1>
-- and sidebar, the /sample card labels and the smoke test's SAMPLE_HEADINGS
-- all read it. Only the title changes; no full_text, so the changelog
-- trigger (log_provision_text_updated) records nothing.
--
-- Idempotent: the where clause pins both the id and the old value, so a
-- replay after this has applied updates zero rows.
update public.provisions
   set title = 'CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9'
 where id = 'sec-7-top-REG-7'
   and title = 'Regulation 7';
