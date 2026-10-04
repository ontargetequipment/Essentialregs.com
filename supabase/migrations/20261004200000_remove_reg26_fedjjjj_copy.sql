-- Regulation 26: remove the copy of 40 CFR 60 Subpart JJJJ (owner decision, Brody, 4 Oct 2026).
--
-- The 20 rows under sec-26-C-FEDJJJJ (the subpart root and §§ 60.4230-60.4248,
-- parent sec-26-P-C) are not printed in the Regulation 26 PDF and duplicate
-- the corpus's own Subpart JJJJ document (reg key jjjj). Regulation 26's
-- citing sentences (Part B I.D.5.d.(i)(C)(1), I.D.5.e.(i)(D),
-- I.D.6.c.(i)(C)(1), I.D.6.d.(i)(D), III.A.1, III.B.1 and the Part C
-- narrative) link to /regulations/jjjj after the re-import that follows this
-- file (pipeline/import_ccr.py, CFR_DOTTED_REGS / CFR_PART_SUBPART_LIST_REGS /
-- PROGRAM_BARE_SUBPART_REGS). The importer's own loader for these rows
-- (_load_reg26_fedjjjj_supplement) and its snapshot file are gone, so a
-- re-import cannot bring them back.
--
-- Read from production on 4 Oct 2026 before writing this: 20 provisions
-- (646 in Regulation 26 in all), 42 provision_embeddings rows, 280
-- provision_neighbors rows (either side), 22 provision_changes rows, 0 rows
-- in any other provision citing them (full_text), 0 children outside the
-- block, 0 cross_references rows. Foreign keys on provisions(id):
--   provision_embeddings.provision_id   ON DELETE CASCADE  (42 rows go)
--   provision_neighbors.provision_id    ON DELETE CASCADE  (280 rows go; the
--   provision_neighbors.neighbor_id     ON DELETE CASCADE   embed workflow
--                                                           rebuilds them)
--   provision_changes.provision_id      ON DELETE CASCADE  (22 rows go: the
--                                                           block's own
--                                                           history)
--   cross_references.from/target        CASCADE / SET NULL (0 rows)
--   provisions.parent_id                ON DELETE SET NULL (no child outside
--                                                           the block)
--
-- Steps (apply_migration runs the file as one transaction):
--   1. Archive the provisions, embeddings and change rows in schema archive
--      (precedent: 20260925013349_archive_backup_tables; not in PostgREST's
--      exposed schemas, RLS on, no grants for anon/authenticated).
--   2. Add change_type 'removed' and teach changelog_public() to count it
--      per row, so the public /changelog can say "20 provisions removed"
--      under Regulation 26 instead of hiding the removal (the importer's
--      precedent logs a removal as one 'text_updated' note on the surviving
--      ancestor, which would have read "1 provision updated"). Notes never
--      leave the database: changelog_public() returns counts only.
--   3. Log one 'removed' row per removed provision against the surviving
--      Part C root (sec-26-P-C), then delete the 20 rows.
--   4. Verify: 0 rows left, 626 in Regulation 26, 20 archived.
--
-- Apply with the Supabase connector's apply_migration AFTER the pull request
-- is merged and CI is green, then run the Import workflow for reg 26 with
-- execute (regenerate_summaries unchecked) so the citing sentences gain
-- their links. A second run is harmless: the archive tables are created
-- "if not exists", the insert and the delete find nothing, and the checks
-- still hold.

-- 1. Archive --------------------------------------------------------------

create schema if not exists archive;

create table if not exists archive.provisions_backup_reg26_fedjjjj_20261004 as
  select * from public.provisions where id like 'sec-26-C-FEDJJJJ%';
create table if not exists archive.provision_embeddings_backup_reg26_fedjjjj_20261004 as
  select * from public.provision_embeddings where provision_id like 'sec-26-C-FEDJJJJ%';
create table if not exists archive.provision_changes_backup_reg26_fedjjjj_20261004 as
  select * from public.provision_changes where provision_id like 'sec-26-C-FEDJJJJ%';

alter table archive.provisions_backup_reg26_fedjjjj_20261004 enable row level security;
alter table archive.provision_embeddings_backup_reg26_fedjjjj_20261004 enable row level security;
alter table archive.provision_changes_backup_reg26_fedjjjj_20261004 enable row level security;
revoke all on table archive.provisions_backup_reg26_fedjjjj_20261004 from public, anon, authenticated;
revoke all on table archive.provision_embeddings_backup_reg26_fedjjjj_20261004 from public, anon, authenticated;
revoke all on table archive.provision_changes_backup_reg26_fedjjjj_20261004 from public, anon, authenticated;

comment on table archive.provisions_backup_reg26_fedjjjj_20261004 is
  'The 20 Subpart JJJJ rows Regulation 26 Part C carried until 4 Oct 2026 (sec-26-C-FEDJJJJ and children), copied before deletion. The live text is the jjjj document.';
comment on table archive.provision_embeddings_backup_reg26_fedjjjj_20261004 is
  'provision_embeddings rows of the archived sec-26-C-FEDJJJJ block (cascade-deleted with the provisions on 4 Oct 2026).';
comment on table archive.provision_changes_backup_reg26_fedjjjj_20261004 is
  'provision_changes rows of the archived sec-26-C-FEDJJJJ block (cascade-deleted with the provisions on 4 Oct 2026).';

do $$
declare n int;
begin
  select count(*) into n from archive.provisions_backup_reg26_fedjjjj_20261004;
  if n <> 20 then
    raise exception 'expected 20 archived sec-26-C-FEDJJJJ rows, found %', n;
  end if;
end $$;

-- 2. change_type 'removed' and changelog_public() ------------------------

alter table public.provision_changes
  drop constraint if exists provision_changes_change_type_check;
alter table public.provision_changes
  add constraint provision_changes_change_type_check check (
    change_type in (
      'summary_approved', 'summary_edited', 'summary_rejected',
      'text_updated', 'added', 'summary_regenerated', 'removed'
    )
  );

comment on column public.provision_changes.change_type is
  'summary_approved / summary_edited / summary_rejected (review actions), text_updated (trigger on full_text, and the importer''s removal notes before 4 Oct 2026), added, summary_regenerated (pipeline), removed (4 Oct 2026: one row per provision deleted from the corpus, logged against its surviving parent; the note names the removed id).';

-- Same body as 20261003160524, plus 'removed' in the filter and counted per
-- row: a removal is logged against the surviving parent, so counting
-- distinct provision_id would collapse 20 removals into "1".
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
  select
    (c.created_at at time zone 'America/Denver')::date as day,
    coalesce(p.reg_key, substring(c.provision_id from '^sec-([^-]+)-')) as reg_key,
    c.change_type,
    count(distinct case when c.change_type = 'removed' then c.id::text
                        else coalesce(c.provision_id, c.id::text) end) as provision_count,
    max(c.created_at) as latest
  from provision_changes c
  left join provisions p on p.id = c.provision_id
  where c.change_type in (
    'text_updated', 'summary_approved', 'summary_edited',
    'summary_regenerated', 'added', 'removed'
  )
  group by 1, 2, 3
  order by max(c.created_at) desc;
$$;

revoke all on function public.changelog_public() from public;
grant execute on function public.changelog_public() to anon, authenticated;

comment on function public.changelog_public() is
  'Counts of provision_changes by Denver day, regulation and change type, for /changelog. Returns no notes or ids; the only read of provision_changes an anonymous visitor has. ''removed'' rows are counted per row (they hang off the surviving parent).';

-- 3. Log the removal, then delete ------------------------------------------

insert into public.provision_changes (provision_id, change_type, note)
select 'sec-26-P-C', 'removed',
       id || ' (' || coalesce(citation, '') || ') removed 4 Oct 2026: a copy of 40 CFR 60 Subpart JJJJ that is not printed in Regulation 26; the text is the corpus''s own jjjj document, which Regulation 26 now links to. Archived in archive.provisions_backup_reg26_fedjjjj_20261004.'
from public.provisions
where id like 'sec-26-C-FEDJJJJ%'
  and exists (select 1 from public.provisions where id = 'sec-26-P-C')
order by sort_order;

delete from public.provisions where id like 'sec-26-C-FEDJJJJ%';

-- 4. Verify ------------------------------------------------------------------

do $$
declare n int;
begin
  select count(*) into n from public.provisions where id like 'sec-26-C-FEDJJJJ%';
  if n <> 0 then raise exception 'sec-26-C-FEDJJJJ rows still present: %', n; end if;
  select count(*) into n from public.provisions where reg_key = '26';
  if n <> 626 then raise exception 'expected 626 Regulation 26 rows after the delete, found %', n; end if;
  select count(*) into n from public.provision_changes where change_type = 'removed' and provision_id = 'sec-26-P-C';
  if n <> 20 then raise exception 'expected 20 removed rows logged on sec-26-P-C, found %', n; end if;
end $$;
