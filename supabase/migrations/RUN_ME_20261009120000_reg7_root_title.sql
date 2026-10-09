-- Reg 7 root row: store the regulation's full adopted title (trust copy pass,
-- 9 Oct 2026, outside reviewer's fifth review).
--
-- BEFORE: sec-7-top-REG-7 carries "CONTROL OF EMISSIONS FROM OIL AND GAS
-- EMISSIONS OPERATIONS 5 CCR 1001-9", which is what the Secretary of State's
-- cover page of pipeline/sources/REG_7.txt prints (migration
-- 20260926035205_reg7_root_title) and which reads as a stutter ("emissions
-- ... emissions") on the /regulations card, the preview and the reader.
--
-- AFTER: the title the AQCC adopted for 5 CCR 1001-9, as ECMC's rules quote it
-- twice (pipeline/sources/ECMC.txt, "Regulation No. 7, Control of Ozone Via
-- Ozone Precursors and Control of Hydrocarbons Via Oil and Gas Emissions
-- (Emissions of Volatile Organic Compounds and Nitrogen Oxides), 5 C.C.R.
-- 1001-9"), in the same shape as every other numbered root: the title in
-- capitals followed by the CCR series. pipeline/import_ccr.py
-- REG_META["7"]["root_title"] is changed in the same commit (a test pins it),
-- so a re-import keeps this.
--
-- The root row's full_text is the same string as its title (the importer
-- writes escape_html_text(root_title)), and the reader sidebar prints it,
-- so both columns change. The text trigger (log_provision_text_updated)
-- would record that as a "text_updated" change, which the changelog shows as
-- an agency rule change; this is a correction of our copy of the printed
-- title, not an agency change, so the one row it logs is relabelled
-- 'transcription_corrected' in the same transaction.
--
-- Citation ("Regulation 7") untouched: the reader <h1>, sidebar, /sample
-- labels and the smoke test's SAMPLE_HEADINGS read it.
--
-- Idempotent: the where clause pins the id and the old title, so a replay
-- after this has applied updates zero rows (and relabels nothing).
-- Not applied by the agent that wrote it. Run in the Supabase SQL editor.
begin;

with changed as (
  update public.provisions
     set title = 'CONTROL OF OZONE VIA OZONE PRECURSORS AND CONTROL OF HYDROCARBONS VIA OIL AND GAS EMISSIONS (EMISSIONS OF VOLATILE ORGANIC COMPOUNDS AND NITROGEN OXIDES) 5 CCR 1001-9',
         full_text = 'CONTROL OF OZONE VIA OZONE PRECURSORS AND CONTROL OF HYDROCARBONS VIA OIL AND GAS EMISSIONS (EMISSIONS OF VOLATILE ORGANIC COMPOUNDS AND NITROGEN OXIDES) 5 CCR 1001-9'
   where id = 'sec-7-top-REG-7'
     and title = 'CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9'
  returning id
)
update public.provision_changes c
   set change_type = 'transcription_corrected'
  from changed
 where c.provision_id = changed.id
   and c.change_type = 'text_updated'
   and c.note is null
   and c.created_at >= now() - interval '1 minute';

commit;

-- Check (expect one row with the new title):
-- select id, title from public.provisions where id = 'sec-7-top-REG-7';
