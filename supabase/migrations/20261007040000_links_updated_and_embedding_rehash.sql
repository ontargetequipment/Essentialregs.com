-- Two things the 7 Oct 2026 re-imports showed (PR #69's markup-only runs):
--
-- 1. The public changelog listed them as "22 provisions updated" under an
--    intro that says official text was updated from the agency source. No
--    official text changed: only cross-reference links were added. The
--    trigger that logs full_text changes now tells the two apart. When the
--    letters and digits of the visible text (tags stripped, the [sic]
--    marker span removed with its text -- the same rule the importer uses
--    to decide "markup-only", pipeline/import_ccr.py
--    text_letters_digits_changed) are unchanged, the row is logged as
--    'links_updated'; otherwise as 'text_updated', as before.
--    changelog_public() reports the new type; the page words it "links
--    added or updated in N provisions". The 53 rows those re-imports logged
--    (01:33-01:40 UTC, regs 3, 6, 7, 8, 26, 30, 31, GP02, GP06, GP08, GP12;
--    note is null because the trigger wrote them) are re-labelled here.
--
-- 2. pipeline/embed.py's hash rule changed so that a link-only import does
--    not re-embed (its tag stripping no longer inserts a space where link
--    markup sits). The stored hashes written under the old rule are
--    rewritten in place by `embed.py --rehash` through
--    provision_embeddings_rehash() below: one UPDATE per batch, matched on
--    the old hash too, no Voyage call. service_role only.

alter table public.provision_changes
  drop constraint if exists provision_changes_change_type_check;
alter table public.provision_changes
  add constraint provision_changes_change_type_check
  check (change_type = any (array[
    'summary_approved', 'summary_edited', 'summary_rejected', 'text_updated',
    'added', 'summary_regenerated', 'removed', 'links_updated']));

create or replace function public.log_provision_text_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_key text;
  new_key text;
begin
  if new.full_text is distinct from old.full_text then
    -- Letters and digits of the visible text: tags out, the [sic] marker
    -- span out with its text (an EssentialRegs note, not official text).
    old_key := regexp_replace(lower(regexp_replace(
                 regexp_replace(coalesce(old.full_text, ''), '<span class="er-sic"[^>]*>.*?</span>', '', 'g'),
                 '<[^>]+>', '', 'g')), '[^a-z0-9]', '', 'g');
    new_key := regexp_replace(lower(regexp_replace(
                 regexp_replace(coalesce(new.full_text, ''), '<span class="er-sic"[^>]*>.*?</span>', '', 'g'),
                 '<[^>]+>', '', 'g')), '[^a-z0-9]', '', 'g');
    insert into provision_changes (provision_id, change_type)
    values (new.id, case when old_key = new_key then 'links_updated' else 'text_updated' end);
  end if;
  return new;
end;
$$;

-- The 53 rows the 7 Oct 2026 markup-only re-imports logged as text_updated.
update public.provision_changes
   set change_type = 'links_updated'
 where change_type = 'text_updated'
   and note is null
   and created_at >= '2026-10-07 01:33:00+00'
   and created_at <  '2026-10-07 01:41:00+00'
   and substring(provision_id from '^sec-([^-]+)-')
       in ('3', '6', '7', '8', '26', '30', '31', 'gp02', 'gp06', 'gp08', 'gp12');

-- changelog_public(): as 20261007010000, plus 'links_updated' among the
-- text events. Same contract: counts by Denver day, regulation and change
-- type; no notes, no ids. SECURITY DEFINER for the same reason (no anon
-- policy on provision_changes); corpus QA check 15 exempts it by name.
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
    where c.change_type in ('text_updated', 'links_updated', 'added', 'removed')
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
    count(distinct case when e.change_type = 'removed' then e.id::text
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
  'Counts of provision_changes by Denver day, regulation and change type, for /changelog. A summary_regenerated row paired with the approval or correction that followed it within 24 hours is reported once as summary_rewritten_reviewed / summary_rewritten_corrected (that review row is not counted again); an unpaired rewrite is summary_rewritten_pending while the provision is pending, else summary_rewritten_reviewed_later. links_updated is a full_text change whose visible letters and digits did not change (cross-reference links only). Returns no notes or ids; the only read of provision_changes an anonymous visitor has.';

-- Stored-hash rewrite for pipeline/embed.py --rehash. Matched on the old
-- hash as well, so a chunk re-embedded between the plan and the write keeps
-- its newer hash. Not reachable by anon or authenticated.
create or replace function public.provision_embeddings_rehash(changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  update provision_embeddings e
     set chunk_text_hash = c.new_hash
    from jsonb_to_recordset(changes)
           as c(provision_id text, chunk_index integer, old_hash text, new_hash text)
   where e.provision_id = c.provision_id
     and e.chunk_index = c.chunk_index
     and e.chunk_text_hash = c.old_hash;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.provision_embeddings_rehash(jsonb) from public, anon, authenticated;
grant execute on function public.provision_embeddings_rehash(jsonb) to service_role;

comment on function public.provision_embeddings_rehash(jsonb) is
  'pipeline/embed.py --rehash: rewrites chunk_text_hash in place for [{provision_id, chunk_index, old_hash, new_hash}] rows whose stored hash is old_hash. No embedding is touched. service_role only.';
