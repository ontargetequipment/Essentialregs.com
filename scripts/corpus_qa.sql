-- EssentialRegs corpus QA query suite
--
-- Paste the whole file into the Supabase SQL editor after every import,
-- re-import, or summarizer run. It returns one row per check with a count
-- and a verdict. ERROR and GUARD rows should read "as expected" before you
-- ship anything; REVIEW and INFO rows are trend lines, not alarms — see
-- EssentialRegs_Known_Issues_and_Fixes.md for the defect each check guards
-- against and why the ones that look obvious but aren't are not here.
--
-- Gotcha: `check` is a reserved word in Postgres, so the column below is
-- `check_name`, not `check`.
--
-- Baseline (36,517 provisions, 2026-09-22):
--   ERROR  repeated_text_block            169 (candidate list — see note below, do not read this as "169 bugs")
--   ERROR  truncated_summary              6
--   ERROR  page_furniture_in_text         3 (one is a documented false positive, sec-cp-I-F)
--   ERROR  empty_full_text                0
--   ERROR  dangling_internal_xref         0
--   ERROR  orphan_parent                  0
--   GUARD  public_sample_rows             4 (must stay exactly 4)
--   GUARD  real_review_backlog            0
--   REVIEW duplicate_citation_in_part     83
--   REVIEW provisions_without_neighbours  106
--   INFO   self_referencing_xref          525
--   INFO   summary_longer_than_long_text  206 (500-char floor; see calibration notes)

with

-- ---------------------------------------------------------------------
-- ERROR: repeated_text_block
--
-- A row whose full_text contains two or more sentences that open with the
-- same 60+ character phrase. This is a CANDIDATE list for a human to check
-- against the eCFR/CCR source, not a strict pass/fail count: formulaic
-- regulatory drafting (parallel "X must A. X must B." paragraph structure)
-- legitimately produces this pattern too, so the count will run well above
-- zero. The five rows first flagged this way (all federal engine/injection
-- provisions: sec-jjjj-60.4231-(b)/(c)/(d), sec-iiii-60.4210-(c),
-- sec-ecmc-803-d-(1)) were hand-verified against source and are genuine
-- repeats in the regulation's own text, not a duplicate-label merge bug —
-- but do not bulk-fix or bulk-dismiss the rest of the list on that basis;
-- eyeball each one.
repeated_sentences as (
  select p.id, btrim(s) as sentence
  from provisions p
  cross join lateral regexp_split_to_table(
    regexp_replace(p.full_text, '<[^>]+>', ' ', 'g'), '[.!?]\s+'
  ) as s
),
repeated_prefixed as (
  select id, lower(left(sentence, 60)) as prefix
  from repeated_sentences
  where length(sentence) >= 60
),
repeated_text_block as (
  select count(distinct id) as n
  from (
    select id, prefix, count(*)
    from repeated_prefixed
    group by id, prefix
    having count(*) > 1
  ) dupes
),

-- ---------------------------------------------------------------------
-- ERROR: truncated_summary
--
-- ai_summary carries summarizer scaffolding (a stray XML/prompt closing
-- tag like </answer> or </explanation>) that should never have left the
-- output-stripping step, dangling markdown emphasis (a trailing * or **
-- with no opening partner), or is a MAX_TOKENS cut-off with no
-- sentence-ending punctuation at all.
truncated_summary as (
  select count(*) as n
  from provisions
  where ai_summary is not null
    and (
      ai_summary ~ '</[a-zA-Z]+>\s*$'
      or ai_summary ~ '\*+\s*$'
      or ai_summary !~ '[.!?"''”)\]]\s*$'
    )
),

-- ---------------------------------------------------------------------
-- ERROR: page_furniture_in_text
--
-- full_text captured page furniture from the source PDF/HTML ("CCR Code
-- of Colorado Regulations", the running footer) instead of just the
-- provision's own text. sec-cp-I-F is a known false positive — it is the
-- Common Provisions abbreviations list, where "CCR Code Of Colorado
-- Regulations" is a legitimate glossary entry, not captured furniture.
-- Left in deliberately so the count stays comparable across runs; check
-- the id before treating a hit as real.
page_furniture_in_text as (
  select count(*) as n
  from provisions
  where regexp_replace(full_text, '<[^>]+>', ' ', 'g') ~* 'code of colorado regulations'
),

-- ---------------------------------------------------------------------
-- ERROR: empty_full_text
--
-- full_text is null or whitespace-only. Schema has full_text NOT NULL, so
-- this should be structurally impossible; the check exists as a guard in
-- case a future migration relaxes that constraint or a bulk load bypasses
-- it via the service-role client.
empty_full_text as (
  select count(*) as n
  from provisions
  where full_text is null or btrim(full_text) = ''
),

-- ---------------------------------------------------------------------
-- ERROR: dangling_internal_xref
--
-- cross_references.target_provision_id points at a provisions.id that no
-- longer exists. The FK (on delete set null) makes this structurally
-- impossible in normal operation; this is insurance against a bulk import
-- that ran with constraints deferred or bypassed. Note that target_type =
-- 'internal' with a NULL target_provision_id is normal (an internal
-- reference the resolver could not or did not map to a specific row —
-- ProvisionCard.tsx renders it as unlinked text) and is not counted here.
dangling_internal_xref as (
  select count(*) as n
  from cross_references cr
  where cr.target_type = 'internal'
    and cr.target_provision_id is not null
    and not exists (select 1 from provisions p where p.id = cr.target_provision_id)
),

-- ---------------------------------------------------------------------
-- ERROR: orphan_parent
--
-- provisions.parent_id points at a provisions.id that no longer exists.
-- Same story as dangling_internal_xref: the FK (on delete set null)
-- should make this impossible; the check is insurance, not a live risk.
orphan_parent as (
  select count(*) as n
  from provisions p
  where p.parent_id is not null
    and not exists (select 1 from provisions p2 where p2.id = p.parent_id)
),

-- ---------------------------------------------------------------------
-- GUARD: public_sample_rows
--
-- Exactly four provisions should be is_public = true: the reviewed
-- /sample page rows (sec-7-B-I-D-3-a-(i), sec-gp02-II-A-2,
-- sec-ecmc-604-a-(1), sec-cp-I-G-90 — see docs/site/sample_rows_2026-09-19.sql).
-- Anything other than 4 means a row was flipped public without review, or
-- one of the four was flipped back off.
public_sample_rows as (
  select count(*) as n from provisions where is_public
),

-- ---------------------------------------------------------------------
-- GUARD: real_review_backlog
--
-- summary_status = 'pending' alone is not a signal — ~16,840 rows are
-- correctly pending because they are structural rows below the
-- summarizer's word-count threshold and were never sent to the model
-- (ai_summary stays NULL by design). The real backlog is a summary that
-- exists but has never been through admin review.
real_review_backlog as (
  select count(*) as n
  from provisions
  where summary_status = 'pending' and ai_summary is not null
),

-- ---------------------------------------------------------------------
-- REVIEW: duplicate_citation_in_part
--
-- Same citation appearing twice inside the same regulation AND the same
-- Part. Grouping by citation alone is nearly all false positives (1,312
-- groups) because Part A's "I.A.1." and Part B's "I.A.1." are different
-- provisions that happen to share a label — the Part has to be part of
-- the key. Part-less regulations (no [A-Z]{1,2} segment right after the
-- reg key) group under a null part, which is correct: they have exactly
-- one implicit part.
duplicate_parsed as (
  select id, citation,
         substring(id from '^sec-([^-]+)-') as reg_key,
         substring(id from '^sec-[^-]+-([A-Z]{1,2})-') as part_key
  from provisions
),
duplicate_citation_in_part as (
  select count(*) as n
  from (
    select reg_key, part_key, citation
    from duplicate_parsed
    group by reg_key, part_key, citation
    having count(*) > 1
  ) dupes
),

-- ---------------------------------------------------------------------
-- REVIEW: provisions_without_neighbours
--
-- Provisions with an embedding (chunk_index = 0) that recompute_provision_
-- neighbors() (006_neighbors_rpc.sql) could not give any neighbours to —
-- every ANN candidate within the search window was excluded as a sibling,
-- parent, ancestor, or descendant. Expected for provisions that sit in a
-- very small or structurally isolated part of the corpus; parked until
-- after launch rather than tuned now.
provisions_without_neighbours as (
  select count(*) as n
  from provision_embeddings pe
  where pe.chunk_index = 0
    and not exists (
      select 1 from provision_neighbors pn where pn.provision_id = pe.provision_id
    )
),

-- ---------------------------------------------------------------------
-- INFO: self_referencing_xref
--
-- cross_references row whose target_provision_id is its own
-- from_provision_id. Mostly legitimate phrasing ("as defined in this
-- section", "pursuant to this Part") that the citation linker resolved
-- back to the provision it started from — not a bug on its own, just
-- worth watching if the rate jumps between runs.
self_referencing_xref as (
  select count(*) as n
  from cross_references
  where target_type = 'internal' and target_provision_id = from_provision_id
),

-- ---------------------------------------------------------------------
-- INFO: summary_longer_than_long_text
--
-- ai_summary is longer (chars) than full_text, restricted to provisions
-- whose full_text clears a 500-character floor after stripping markup.
-- Without the floor this fires on ~9,500 rows, virtually all noise: short
-- REPEALED/Reserved stubs always have a longer summary than their one-line
-- body. Weak signal even with the floor — a summary CAN legitimately spell
-- out more than a terse provision says.
summary_longer_than_long_text as (
  select count(*) as n
  from provisions
  where ai_summary is not null
    and length(regexp_replace(full_text, '<[^>]+>', '', 'g')) >= 500
    and length(ai_summary) > length(regexp_replace(full_text, '<[^>]+>', '', 'g'))
),

results as (
  select 'ERROR' as severity, 'repeated_text_block' as check_name, n as count,
         case when n = 0 then 'clean' else '*** candidates — eyeball against source, do not bulk-fix ***' end as verdict
    from repeated_text_block
  union all
  select 'ERROR', 'truncated_summary', n,
         case when n = 0 then 'clean' else '*** investigate ***' end
    from truncated_summary
  union all
  select 'ERROR', 'page_furniture_in_text', n,
         case when n = 0 then 'clean' else '*** investigate (check for known false positive sec-cp-I-F) ***' end
    from page_furniture_in_text
  union all
  select 'ERROR', 'empty_full_text', n,
         case when n = 0 then 'clean' else '*** investigate ***' end
    from empty_full_text
  union all
  select 'ERROR', 'dangling_internal_xref', n,
         case when n = 0 then 'clean' else '*** investigate ***' end
    from dangling_internal_xref
  union all
  select 'ERROR', 'orphan_parent', n,
         case when n = 0 then 'clean' else '*** investigate ***' end
    from orphan_parent
  union all
  select 'GUARD', 'public_sample_rows', n,
         case when n = 4 then 'correct — must stay 4' else '*** GUARD FAILED — investigate immediately ***' end
    from public_sample_rows
  union all
  select 'GUARD', 'real_review_backlog', n,
         case when n = 0 then 'clean' else '*** investigate ***' end
    from real_review_backlog
  union all
  select 'REVIEW', 'duplicate_citation_in_part', n, 'expected — worth a pass, not a blocker'
    from duplicate_citation_in_part
  union all
  select 'REVIEW', 'provisions_without_neighbours', n, 'known — parked until after launch'
    from provisions_without_neighbours
  union all
  select 'INFO', 'self_referencing_xref', n, 'mostly legitimate phrasing — trend line only'
    from self_referencing_xref
  union all
  select 'INFO', 'summary_longer_than_long_text', n, 'weak signal — trend line only'
    from summary_longer_than_long_text
)
select severity, check_name, count, verdict
from results
order by
  case severity when 'ERROR' then 1 when 'GUARD' then 2 when 'REVIEW' then 3 when 'INFO' then 4 end,
  check_name;
