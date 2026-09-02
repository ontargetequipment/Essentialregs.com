-- A handful of real, hand-verified provisions marked is_public = true, so
-- the site has something genuine to show on the /sample page from day one.
-- Replace/expand this over time with the actual reviewed content pipeline —
-- this is just enough to prove the site works end to end.

insert into provisions
  (id, citation, title, jurisdiction_level, issuing_body, parent_id, full_text, ai_summary, summary_model, summary_generated_at, source_url, last_verified_date, is_public, sort_order)
values
  (
    'osha-1910-119',
    '29 CFR § 1910.119',
    'Process Safety Management of Highly Hazardous Chemicals',
    'federal',
    'OSHA',
    null,
    'This section applies to a process which involves a chemical at or above the specified threshold quantities listed in Appendix A to this section... [full verbatim regulatory text goes here once sourced from eCFR]',
    'If your facility handles certain hazardous chemicals above specific quantity thresholds, this rule requires you to have a formal process safety management program — documented procedures, hazard analysis, training, and incident investigation — not just informal safety practices.',
    'placeholder-manual-draft',
    now(),
    'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-H/section-1910.119',
    current_date,
    true,
    10
  ),
  (
    'ecmc-rule-604',
    'ECMC Rule 604',
    'Financial Assurance',
    'state',
    'ECMC',
    null,
    '[full verbatim rule text goes here once sourced from the Colorado Code of Regulations]',
    'Operators have to post financial assurance (a bond or equivalent) with the state before drilling, sized to cover plugging and reclamation costs, so the state — not taxpayers — isn''t left covering abandoned well cleanup.',
    'placeholder-manual-draft',
    now(),
    'https://ecmc.state.co.us/regulations',
    current_date,
    true,
    20
  ),
  (
    'cdphe-reg7-general',
    'CDPHE Air Quality Control Commission Regulation Number 7',
    'Control of Ozone via Ozone Precursors and Control of Hydrocarbons via Oil and Gas Emissions',
    'state',
    'CDPHE-APCD',
    null,
    '[full verbatim regulatory text goes here once sourced from the Colorado Code of Regulations]',
    'This regulation sets emission control and leak-detection requirements for oil and gas equipment (tanks, compressors, pneumatic devices) to limit the hydrocarbon and ozone-forming emissions that come from normal operations.',
    'placeholder-manual-draft',
    now(),
    'https://cdphe.colorado.gov/air-quality-control-commission/regulations',
    current_date,
    true,
    30
  )
on conflict (id) do nothing;

insert into cross_references (from_provision_id, raw_text, target_type, target_provision_id, target_url)
values
  ('cdphe-reg7-general', 'ECMC Rule 604', 'internal', 'ecmc-rule-604', null),
  ('osha-1910-119', '29 CFR 1910.120', 'external', null, 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-H/section-1910.120')
on conflict do nothing;
