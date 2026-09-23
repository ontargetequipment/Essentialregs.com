-- ============================================================================
-- EssentialRegs — corpus quality checks
-- ============================================================================
-- Run this in the Supabase SQL editor after EVERY import, re-import or
-- summarizer run. It returns one row per check with a count and a verdict.
--
-- Baseline taken 2026-09-22 against 36,517 provisions. The "expected" column
-- is what the corpus looked like then; investigate anything that moves.
--
-- Every check here corresponds to a defect that has ALREADY happened once and
-- is recorded in EssentialRegs_Known_Issues_and_Fixes.md. This file exists so
-- the next one is caught by a query instead of by somebody noticing.
--
-- Calibration note: several obvious-looking checks were tried and rejected
-- because they cried wolf. They are documented at the bottom so nobody
-- "helpfully" adds them back.
-- ============================================================================

with plain as (
  select
    id, citation, parent_id, ai_summary, summary_status, is_public,
    btrim(regexp_replace(regexp_replace(coalesce(full_text,''), '<[^>]*>', '', 'g'),
                         '&nbsp;|\s+', ' ', 'g')) as txt
  from provisions
),
checks as (

  -- ---- ERRORS: investigate every hit ------------------------------------

  select 1 as ord, 'ERROR' as severity, 'repeated_text_block' as check_name, count(*) as n, 0 as expected,
         'First 50 chars recur 3+ times inside one row. This is the Reg 3 Part F signature (a row that swallowed every restarted "3." in an entry) and the duplicate-label merge signature.' as what_it_catches
  from plain
  where length(txt) > 200 and (length(txt) - length(replace(txt, left(txt,50), ''))) / 50 >= 3

  union all
  select 2, 'ERROR', 'truncated_summary', count(*), 0,
         'ai_summary does not end in terminal punctuation - the summarizer MAX_TOKENS cut-off that produced four mid-sentence ZZZZ table summaries.'
  from provisions
  where ai_summary is not null and btrim(ai_summary) <> '' and rtrim(ai_summary) !~ '[.!?)"\]]$'

  union all
  select 3, 'ERROR', 'page_furniture_in_text', count(*), 0,
         'Printed page header/footer captured mid-provision ("CODE OF COLORADO REGULATIONS ... 5 CCR"). This is how a page number once became "45 days".'
  from plain
  where txt ~* 'CODE OF COLORADO REGULATIONS'
    and position('CODE OF COLORADO REGULATIONS' in upper(txt)) > 1

  union all
  select 4, 'ERROR', 'empty_full_text', count(*), 0,
         'Provision carrying no usable text at all.'
  from plain where btrim(coalesce(txt,'')) = ''

  union all
  select 5, 'ERROR', 'dangling_internal_xref', count(*), 0,
         'Cross-reference whose target provision id does not exist - a link that 404s inside the reader.'
  from cross_references cr
  where cr.target_provision_id is not null
    and not exists (select 1 from provisions p where p.id = cr.target_provision_id)

  union all
  select 6, 'ERROR', 'orphan_parent', count(*), 0,
         'parent_id points at a provision that does not exist - breaks the sidebar tree.'
  from provisions p
  where p.parent_id is not null
    and not exists (select 1 from provisions q where q.id = p.parent_id)

  -- ---- GUARDS: a number that must not drift -----------------------------

  union all
  select 7, 'GUARD', 'public_sample_rows', count(*), 4,
         'Rows visible to logged-out visitors on /sample. Must be exactly 4. More than 4 means paid content is leaking past the paywall.'
  from provisions where is_public

  union all
  select 8, 'GUARD', 'real_review_backlog', count(*), 0,
         'Has a summary AND is still pending review. This is the GENUINE backlog - do not confuse it with the ~16,840 structural rows that are pending with ai_summary IS NULL and are never summarised by design.'
  from provisions where summary_status = 'pending' and ai_summary is not null

  -- ---- REVIEW: expected to be non-zero; watch the trend -----------------

  union all
  select 9, 'REVIEW', 'duplicate_citation_in_part', count(*), 83,
         'Same citation twice inside one regulation AND one Part. Usually a mislabelled source line. NOTE: must group by reg AND part - grouping by reg alone reports 1,312 and is 94% false positives, because ids carry the Part letter and Part A''s "I.A.1." is not Part B''s.'
  from (select split_part(id,'-',2) r, split_part(id,'-',3) p, citation
        from provisions where citation is not null and citation <> ''
        group by 1,2,3 having count(*) > 1) d

  union all
  select 10, 'REVIEW', 'provisions_without_neighbours', count(*), 106,
         'No semantic neighbours, so the "related sections" panel renders empty. Cause is the neighbours function, not the UI. Parked until after launch.'
  from provisions p
  where not exists (select 1 from provision_neighbors n where n.provision_id = p.id)

  -- ---- INFO: low confidence, eyeball occasionally -----------------------

  union all
  select 11, 'INFO', 'self_referencing_xref', count(*), 525,
         'A provision cross-referencing itself (525 links across 87 provisions). Mostly legitimate regulatory phrasing ("nothing in this Section I.B.30.b. shall..."), but it renders as a link that previews the section you are already reading.'
  from cross_references where from_provision_id = target_provision_id

  union all
  select 12, 'INFO', 'summary_longer_than_long_text', count(*), 202,
         'Summary longer than a provision of 500+ chars. Weak signal - dense technical provisions legitimately produce long summaries. The naive version (no length floor) fires on 9,491 rows and is useless, because short "REPEALED" stubs always have longer summaries.'
  from plain
  where ai_summary is not null and length(txt) > 500
    and length(btrim(ai_summary)) > length(txt)
)
select severity, check_name, n,
       case when severity in ('ERROR','GUARD') and n <> expected then '*** CHECK ***'
            when n <> expected then 'moved (was ' || expected || ')'
            else 'as expected' end as verdict,
       expected as baseline_2026_09_22,
       what_it_catches
from checks
order by ord;

-- ============================================================================
-- Checks deliberately NOT included, and why
-- ============================================================================
-- * "text starts with its own citation" (5,941 rows). Not a defect - it is how
--   headings and short leaf rows are stored. It was a RENDER bug in
--   withItemIdBadge(), fixed there. Do not add it as a data check.
--
-- * "summary longer than provision" with no length floor: 9,491 hits, all noise.
--   Use check 12's 500-char floor instead.
--
-- * "duplicate citation" grouped by regulation only: 1,312 hits, ~94% false
--   positives. Must include the Part. See check 9.
--
-- * summary_status = 'pending' on its own: ~16,840 rows, all correct by design
--   (structural rows under the 25-word summariser threshold). Always pair it
--   with ai_summary IS NOT NULL. See check 8.
-- ============================================================================
