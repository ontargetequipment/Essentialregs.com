-- /changelog "Regulatory changes" lists only changes that come from the
-- agency (review of Sprint 5 on production, 7 Oct 2026). Until now the
-- section listed every full_text change whose visible letters and digits
-- changed, which on 3 and 4 October were our own link imports (Sprint 2)
-- and transcription fixes (Sprint 3: [sic] markers, equations, extraction
-- errors), and in September the re-imports that replaced our earlier copy
-- of each regulation with the official CCR text. No agency changed a rule
-- on those days.
--
-- Three new change types:
--   transcription_corrected  we corrected our own copy of the text to match
--                            the official source (visible letters or digits
--                            changed, no agency version change); also a row
--                            our earlier copy had that the official text
--                            does not (the importer's "removed in re-import"
--                            notes) and a row added by hand to fix a parse.
--   duplicate_removed        a provision deleted because it duplicated a
--                            document the corpus holds elsewhere (the 20
--                            Subpart JJJJ rows under Regulation 26 Part C,
--                            4 Oct 2026). Not an agency removal.
--   source_version_changed   an import found the source document's version
--                            or effective date changed (one row per import,
--                            against the regulation root; the note names
--                            the old and new version). From now on the
--                            importer logs this itself (pipeline/
--                            changelog_sources.py) and leaves that run's
--                            text_updated / added / removed rows as
--                            regulatory; without a version change it
--                            re-labels the run's text_updated rows as
--                            transcription_corrected.
--   removal_note             internal: the importer's duplicate note for a
--                            removal already counted (the 19 "removed in
--                            re-import" notes of 4 Oct 2026 describe the
--                            same 20 Subpart JJJJ rows). Never shown.
--
-- History re-labelled below, by provenance (docs/imports/*, the plan doc,
-- the provision_changes notes). Where a run mixed kinds and the rows cannot
-- be told apart, the rows go under corrections (never under regulatory
-- changes), and the report says so.
--
-- public.source_versions records the version of each source we hold, as
-- pipeline/sources/manifest.json records it at the time of this migration;
-- the importer compares the manifest against it on every execute.

alter table public.provision_changes
  drop constraint if exists provision_changes_change_type_check;
alter table public.provision_changes
  add constraint provision_changes_change_type_check
  check (change_type = any (array[
    'summary_approved', 'summary_edited', 'summary_rejected', 'text_updated',
    'added', 'summary_regenerated', 'removed', 'links_updated',
    'transcription_corrected', 'duplicate_removed', 'source_version_changed',
    'removal_note']));

comment on column public.provision_changes.change_type is
  'summary_approved / summary_edited / summary_rejected (review actions); text_updated (trigger: visible letters or digits changed; regulatory only when the import also logged source_version_changed), links_updated (trigger: markup only), added, removed (agency additions and removals), summary_regenerated (pipeline), transcription_corrected (our copy corrected to match the official source), duplicate_removed (a row that duplicated another corpus document), source_version_changed (one per import that found a new source version; note names old and new), removal_note (internal duplicate of a counted removal).';

-- 1. The Subpart JJJJ copy (4 Oct 2026): a duplicate of the jjjj document,
--    not an agency removal; the importer's 19 notes for the same rows are
--    internal duplicates.
update public.provision_changes
   set change_type = 'duplicate_removed'
 where change_type = 'removed'
   and provision_id = 'sec-26-P-C'
   and note like 'sec-26-C-FEDJJJJ%removed 4 Oct 2026%';

update public.provision_changes
   set change_type = 'removal_note'
 where change_type = 'text_updated'
   and provision_id like 'sec-26-%'
   and note like '%removed in re-import from official CCR text (Sept 2026)%'
   and (created_at at time zone 'America/Denver')::date = date '2026-10-04';

-- 2. The September official-text re-imports: rows our earlier copy had that
--    the official text does not (removal notes), and the four rows added by
--    hand to fix a parse (Regulation 26 II.D.6.f.(i)(B), Regulation 3
--    II.E.3.nnn.(i)-(iii)).
update public.provision_changes
   set change_type = 'transcription_corrected'
 where change_type = 'text_updated'
   and note like '%removed in re-import from official CCR text (Sept 2026)%';

update public.provision_changes
   set change_type = 'transcription_corrected'
 where change_type = 'added'
   and created_at < '2026-10-01';

-- 3. Regulation 7, 14 Sep 2026 (1,439 rows without a note): checked by
--    letters and digits against archive.provisions_backup_reg7_20260914,
--    the copy taken before that re-import. Every later change to
--    Regulation 7 was link markup (19-21 Sep, 3-4 Oct, 6 Oct), so a row
--    whose letters and digits differ from the backup now changed them on
--    14 Sep: a correction of our copy. The rows whose letters and digits
--    are the same (39) only gained markup: links_updated. The 10 rows the
--    backup does not hold are counted as corrections (not verifiable).
with keys as (
  select p.id,
    regexp_replace(lower(regexp_replace(regexp_replace(coalesce(p.full_text, ''), '<span class="er-sic"[^>]*>.*?</span>', '', 'g'), '<[^>]+>', '', 'g')), '[^a-z0-9]', '', 'g') as now_key,
    regexp_replace(lower(regexp_replace(regexp_replace(coalesce(b.full_text, ''), '<span class="er-sic"[^>]*>.*?</span>', '', 'g'), '<[^>]+>', '', 'g')), '[^a-z0-9]', '', 'g') as then_key
  from public.provisions p
  join archive.provisions_backup_reg7_20260914 b on b.id = p.id
  where p.reg_key = '7'
)
update public.provision_changes c
   set change_type = 'links_updated'
  from keys k
 where c.change_type = 'text_updated'
   and c.note is null
   and c.provision_id = k.id
   and (c.created_at at time zone 'America/Denver')::date = date '2026-09-14'
   and k.now_key = k.then_key;

update public.provision_changes
   set change_type = 'transcription_corrected'
 where change_type = 'text_updated'
   and note is null
   and provision_id like 'sec-7-%'
   and (created_at at time zone 'America/Denver')::date = date '2026-09-14';

-- 4. 15-18 Sep 2026: the first official-text imports of OOOOb, OOOOc,
--    Regulation 26, Regulation 3 and the ECMC rules over our earlier copy.
--    Corrections of our copy; no backup exists to check row by row.
update public.provision_changes
   set change_type = 'transcription_corrected'
 where change_type = 'text_updated'
   and note is null
   and (created_at at time zone 'America/Denver')::date between date '2026-09-15' and date '2026-09-18';

-- 5. 19-21 Sep 2026 (batches 4-7): every difference the merge reports
--    record is a cross-reference anchor (docs/imports/2026-09-19..21,
--    "strip reproduces the agent file row-for-row"); markup only.
update public.provision_changes
   set change_type = 'links_updated'
 where change_type = 'text_updated'
   and note is null
   and (created_at at time zone 'America/Denver')::date between date '2026-09-19' and date '2026-09-21';

-- 6. 3 Oct 2026: the Sprint 2 deep-link re-imports (exact cross-regulation
--    links; docs/CEO_PHASE_PLAN.md "Sprint 2 status"). Markup only.
update public.provision_changes
   set change_type = 'links_updated'
 where change_type = 'text_updated'
   and note is null
   and (created_at at time zone 'America/Denver')::date = date '2026-10-03';

-- 7. 4 Oct 2026: Sprint 3. Regulations 6, 7 and 30 gained the federal
--    engine-subpart links, OOOOa its subscript markup and Regulation 26 its
--    links to the jjjj document: markup only. The nine general permits had
--    equations, tables, split letters and [sic] markers fixed in the same
--    runs as link changes; the rows cannot be told apart, so all of them
--    are corrections.
update public.provision_changes
   set change_type = 'links_updated'
 where change_type = 'text_updated'
   and note is null
   and (created_at at time zone 'America/Denver')::date = date '2026-10-04'
   and substring(provision_id from '^sec-([^-]+)-') in ('6', '7', '30', '26', 'ooooa');

update public.provision_changes
   set change_type = 'transcription_corrected'
 where change_type = 'text_updated'
   and note is null
   and (created_at at time zone 'America/Denver')::date = date '2026-10-04'
   and substring(provision_id from '^sec-([^-]+)-') like 'gp%';

-- 8. Nothing else may remain as a regulatory change: every text_updated,
--    added and removed row before this migration was ours.
do $$
declare n int;
begin
  select count(*) into n from public.provision_changes
   where change_type in ('text_updated', 'added', 'removed')
     and created_at < '2026-10-07 12:00:00+00';
  if n <> 0 then
    raise exception 'unclassified regulatory-looking rows remain: %', n;
  end if;
end $$;

-- 9. The version of each source we hold (pipeline/sources/manifest.json at
--    this migration). The importer compares the manifest against this row
--    on every execute and logs source_version_changed when it differs.
create table if not exists public.source_versions (
  reg_key text primary key,
  version text not null,
  effective_date date,
  recorded_at timestamptz not null default now()
);
alter table public.source_versions enable row level security;
revoke all on table public.source_versions from public, anon, authenticated;
comment on table public.source_versions is
  'The version of each imported source document the corpus holds (from pipeline/sources/manifest.json). pipeline/changelog_sources.py compares the manifest with it after every executed import; a difference is logged as a source_version_changed row and recorded here. service_role only.';

insert into public.source_versions (reg_key, version, effective_date) values
  ('1', 'effective 2024-10-15 (SOS ruleVersionId 11648)', '2024-10-15'),
  ('10', 'effective 2016-03-30 (SOS ruleVersionId 6679)', '2016-03-30'),
  ('11', 'effective 2026-03-02 (SOS ruleVersionId 12430)', '2026-03-02'),
  ('12', 'effective 2025-03-17 (SOS ruleVersionId 11881)', '2025-03-17'),
  ('15', 'effective 2008-10-30 (SOS ruleVersionId 2600)', '2008-10-30'),
  ('16', 'effective 2007-04-20 (SOS ruleVersionId 1529)', '2007-04-20'),
  ('18', 'effective 2012-12-15 (SOS ruleVersionId 4928)', '2012-12-15'),
  ('19', 'effective 2022-01-14 (SOS ruleVersionId 9953)', '2022-01-14'),
  ('2', 'effective 2013-11-01 (SOS ruleVersionId 5444)', '2013-11-01'),
  ('20', 'effective 2023-12-15 (SOS ruleVersionId 11186)', '2023-12-15'),
  ('21', 'effective 2023-02-14 (SOS ruleVersionId 10677)', '2023-02-14'),
  ('22', 'effective 2024-12-15 (SOS ruleVersionId 11724)', '2024-12-15'),
  ('23', 'effective 2022-01-30 (SOS ruleVersionId 9985)', '2022-01-30'),
  ('24', 'effective 2026-06-14 (SOS ruleVersionId 12562)', '2026-06-14'),
  ('25', 'effective 2026-01-14 (SOS ruleVersionId 12376)', '2026-01-14'),
  ('26', 'effective 2026-01-14 (SOS ruleVersionId 12356)', '2026-01-14'),
  ('27', 'effective 2025-02-14 (SOS ruleVersionId 11838)', '2025-02-14'),
  ('28', 'effective 2026-06-17 (SOS ruleVersionId 12565)', '2026-06-17'),
  ('29', 'effective 2024-04-15 (SOS ruleVersionId 11408)', '2024-04-15'),
  ('3', 'effective 2026-07-15 (SOS ruleVersionId 12619)', '2026-07-15'),
  ('30', 'effective 2026-06-14 (SOS ruleVersionId 12561)', '2026-06-14'),
  ('31', 'effective 2026-02-14 (SOS ruleVersionId 12387)', '2026-02-14'),
  ('4', 'effective 2024-10-15 (SOS ruleVersionId 11649)', '2024-10-15'),
  ('6', 'effective 2025-12-15 (SOS ruleVersionId 12287)', '2025-12-15'),
  ('7', 'effective 2026-07-15 (SOS ruleVersionId 12621)', '2026-07-15'),
  ('8', 'effective 2025-12-15 (SOS ruleVersionId 12288)', '2025-12-15'),
  ('9', 'effective 2024-04-15 (SOS ruleVersionId 11420)', '2024-04-15'),
  ('aqs', 'effective 2026-01-14 (SOS ruleVersionId 12357)', '2026-01-14'),
  ('cp', 'effective 2025-12-15 (SOS ruleVersionId 12286)', '2025-12-15'),
  ('ecmc', 'effective 2026-05-30 (SOS ruleVersionId 12558)', '2026-05-30'),
  ('gp01', 'issuance 6, 2025-07-23 (CDPHE docid 11306933)', '2025-07-23'),
  ('gp02', 'issuance 4, 2025-07-23 (CDPHE docid 11306935)', '2025-07-23'),
  ('gp03', 'issuance 2, 2020-01-24 (CDPHE docid 6159373)', '2020-01-24'),
  ('gp05', 'issuance 5, 2025-07-23 (CDPHE docid 11306936)', '2025-07-23'),
  ('gp06', 'issuance 4, 2025-07-23 (CDPHE docid 11306939)', '2025-07-23'),
  ('gp07', 'issuance 4, 2025-07-23 (CDPHE docid 11306940)', '2025-07-23'),
  ('gp08', 'issuance 4, 2025-07-23 (CDPHE docid 11306945)', '2025-07-23'),
  ('gp09', 'issuance 3, 2025-07-23 (CDPHE docid 6754291)', '2025-07-23'),
  ('gp10', 'issuance 4, 2025-07-23 (CDPHE docid 11306946)', '2025-07-23'),
  ('gp11', 'issuance 3, 2025-07-23 (CDPHE docid 11306947)', '2025-07-23'),
  ('gp12', 'issuance 1, 2026-05-28 (CDPHE docid 63372084)', '2026-05-28'),
  ('iiii', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('jjjj', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('ooooa', 'eCFR as of 2026-09-11', '2026-09-11'),
  ('oooob', 'eCFR as of 2026-09-10', '2026-09-10'),
  ('ooooc', 'eCFR as of 2026-09-11', '2026-09-11'),
  ('p190', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p191', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p192', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p193', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p194', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p195', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p196', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('p199', 'eCFR as of 2026-09-17', '2026-09-17'),
  ('proc', 'effective 2025-02-14 (SOS ruleVersionId 11840)', '2025-02-14'),
  ('sip', 'effective 2008-12-30 (SOS ruleVersionId 2721)', '2008-12-30'),
  ('zzzz', 'eCFR as of 2026-09-17', '2026-09-17')
on conflict (reg_key) do nothing;

-- 10. changelog_public(): as 20261007040000, plus the new types among the
--     text events (transcription_corrected and duplicate_removed counted per
--     row like 'removed'; source_version_changed is one row per import).
create or replace function public.changelog_public()
returns table (
  day date,
  reg_key text,
  change_type text,
  provision_count bigint,
  latest timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with regen as (
    select c.id, c.provision_id, c.created_at,
      (select min(r.created_at)
         from provision_changes r
        where r.provision_id = c.provision_id
          and r.change_type in ('summary_approved', 'summary_edited')
          and r.created_at >= c.created_at
          and r.created_at < c.created_at + interval '24 hours') as reviewed_at
    from provision_changes c
    where c.change_type = 'summary_regenerated'
      and c.provision_id is not null
  ),
  paired as (
    select distinct g.provision_id, g.reviewed_at as created_at
    from regen g
    where g.reviewed_at is not null
  ),
  events as (
    select c.id, c.provision_id, c.created_at, c.change_type
    from provision_changes c
    where c.change_type in ('text_updated', 'links_updated', 'added', 'removed',
                            'transcription_corrected', 'duplicate_removed', 'source_version_changed')
    union all
    select c.id, c.provision_id, c.created_at, c.change_type
    from provision_changes c
    where c.change_type in ('summary_approved', 'summary_edited')
      and not exists (
        select 1 from paired k
        where k.provision_id = c.provision_id and k.created_at = c.created_at
      )
    union all
    select g.id, g.provision_id, g.created_at,
      case
        when g.reviewed_at is not null then
          case when exists (
                 select 1 from provision_changes r
                 where r.provision_id = g.provision_id
                   and r.created_at = g.reviewed_at
                   and r.change_type = 'summary_edited')
               then 'summary_rewritten_corrected'
               else 'summary_rewritten_reviewed'
          end
        when p.summary_status = 'pending' then 'summary_rewritten_pending'
        else 'summary_rewritten_reviewed_later'
      end
    from regen g
    left join provisions p on p.id = g.provision_id
  )
  select
    (e.created_at at time zone 'America/Denver')::date as day,
    coalesce(p.reg_key, substring(e.provision_id from '^sec-([^-]+)-')) as reg_key,
    e.change_type,
    count(distinct case when e.change_type in ('removed', 'duplicate_removed', 'transcription_corrected') then e.id::text
                        else coalesce(e.provision_id, e.id::text) end) as provision_count,
    max(e.created_at) as latest
  from events e
  left join provisions p on p.id = e.provision_id
  group by 1, 2, 3
  order by max(e.created_at) desc;
$$;

revoke all on function public.changelog_public() from public;
grant execute on function public.changelog_public() to anon, authenticated;

comment on function public.changelog_public() is
  'Counts of provision_changes by Denver day, regulation and change type, for /changelog (read through changelog_snapshot_public(), refreshed by refresh_changelog_snapshot()). Regulatory changes are text_updated, added, removed and source_version_changed; links_updated is markup only; transcription_corrected and duplicate_removed are corrections to our own copy. A summary_regenerated row paired with the review that followed it within 24 hours is reported once as summary_rewritten_reviewed / summary_rewritten_corrected. Returns no notes or ids.';
