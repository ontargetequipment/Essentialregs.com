-- Reg 22 root row: store the bare printed title in sibling shape.
--
-- Reg 22 was imported (pipeline/import_ccr.py REG_META["22"].root_title)
-- with the label folded into its title, "Regulation Number 22 — Colorado
-- Greenhouse Gas Reporting and Emission Reduction Requirements (5 CCR
-- 1001-26)", where every other numbered AQCC root stores the printed title
-- followed by the CCR series ("STATIONARY SOURCE PERMITTING ... 5 CCR
-- 1001-5"). The /regulations card prefixed "Regulation Number 22 — " onto
-- it a second time (fixed defensively in regulationCardInfo by migration
-- 20260926035205's PR), and /regulations/22/preview still printed the
-- doubled label: eyebrow "REGULATION 22" over an <h1> that began
-- "Regulation Number 22 — ...". Storing the title page's own text (REG_22.txt:
-- "REGULATION NUMBER 22 / COLORADO GREENHOUSE GAS REPORTING AND EMISSION
-- REDUCTION REQUIREMENTS / 5 CCR 1001-26") fixes every surface at once. The
-- importer's REG_META["22"].root_title is changed in the same commit so a
-- re-import keeps it.
--
-- The citation ("Regulation 22") is deliberately untouched: the reader <h1>
-- and sidebar and the preview eyebrow read it. Only the title changes; no
-- full_text, so the changelog trigger (log_provision_text_updated) records
-- nothing.
--
-- Idempotent: the where clause pins both the id and the old value, so a
-- replay after this has applied updates zero rows.
update public.provisions
   set title = 'COLORADO GREENHOUSE GAS REPORTING AND EMISSION REDUCTION REQUIREMENTS 5 CCR 1001-26'
 where id = 'sec-22-top-REG-22'
   and title = 'Regulation Number 22 — Colorado Greenhouse Gas Reporting and Emission Reduction Requirements (5 CCR 1001-26)';
