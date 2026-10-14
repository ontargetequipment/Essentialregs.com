-- Subpart lists, existing rows (14 Oct 2026). Data only.
--
-- BEFORE: GP05 IX.B stores
--   (NSPS) <a class="xref-external-reg" href="/regulations/oooo">Subpart OOOO</a>, OOOOa, or OOOOb – Standards of ...
-- and only the first code of the list is a link.
-- AFTER: every code of the list is its own link to its subpart's document, in
-- the shape the importer now writes (pipeline/import_ccr.py, _subpart_list_tail
-- and emit_subpart_tail, 14 Oct 2026):
--   (NSPS) <a ... href="/regulations/oooo">Subpart OOOO</a>, <a ... href="/regulations/ooooa">OOOOa</a>,
--   or <a ... href="/regulations/oooob">OOOOb</a> – Standards of ...
--
-- Scope: the Colorado documents only (reg_key not in the federal set: oooo,
-- ooooa, oooob, ooooc, jjjj, iiii, zzzz and the 49 CFR parts p190-p199; inside
-- a federal subpart most bare codes are the document naming itself and stay
-- plain). A code is linked only when it directly follows a head citation that
-- is ALREADY a link to a corpus subpart document in the same run of text, with
-- nothing between them but a list separator (", ", ", or ", ", and ", " or ",
-- " and ", " and/or ", "/"). The part is the head's: a head linked to a Part
-- 60 document (oooo, ooooa, oooob, ooooc, jjjj, iiii) takes the Part 60 codes
-- OOOO, OOOOa, OOOOb, OOOOc, JJJJ, IIII; a head linked to zzzz (Part 63) takes
-- ZZZZ only. A bare Part 63 "Subpart OOOO" (Regulation 8) is never a linked
-- head, so nothing after it changes. The pass repeats until no list is left
-- (each linked code is the head of the next).
--
-- Not covered (left plain, listed in the PR): a list whose head is not a link
-- ("Subparts KKK, OOOO, and OOOOa", "Subparts A and OOOO", "NSPS OOOO or
-- 60.5365"), "EG OOOOc" (an emission guideline, not a list), and the codes
-- inside a Part 63 coating list in Regulation 8.
--
-- Not a re-import. Only link markup is added: the UPDATE requires the same
-- visible text before and after (tags stripped), so no official text can
-- change. The provisions_log_text_updated trigger logs each row as
-- 'links_updated' (visible letters and digits unchanged; migration
-- 20261007040000); pipeline/embed.py's hash unwraps xref-external-reg
-- anchors without a space (LINK_MARKUP_RE), so no row is re-embedded;
-- search_vector replaces tags with a space, so its tokens are unchanged.
-- Summaries and review state are not touched. Re-running it changes nothing.
--
-- The function is a session-local helper in pg_temp (no DDL on the schema, no
-- DROP): run the function, the UPDATE and nothing else in ONE call.

create or replace function pg_temp.link_subpart_tails(t text) returns text language plpgsql as $f$
declare
  p60 constant text := '(<a [^>]*href="/regulations/(?:oooo|ooooa|oooob|ooooc|jjjj|iiii)"[^>]*>[^<]*(?:OOOO[abc]?|JJJJ|IIII)</a>(?:,\s+(?:or|and)\s+|,\s+|\s+(?:and/or|or|and)\s+|/))(OOOOa|OOOOb|OOOOc|OOOO|JJJJ|IIII)\M(?![.-]\d)';
  p63 constant text := '(<a [^>]*href="/regulations/zzzz"[^>]*>[^<]*ZZZZ</a>(?:,\s+(?:or|and)\s+|,\s+|\s+(?:and/or|or|and)\s+|/))(ZZZZ)\M(?![.-]\d)';
  m text[]; n int := 0; pat text;
begin
  foreach pat in array array[p60, p63] loop
    loop
      m := regexp_match(t, pat);
      exit when m is null or n > 40;
      n := n + 1;
      t := regexp_replace(t, pat, '\1<a class="xref-external-reg" href="/regulations/' || lower(m[2]) || '">\2</a>');
    end loop;
  end loop;
  return t;
end $f$;

-- Dry run (read only): every row that would change, with its before and after
-- text around the first changed list. Run it with the function above.
-- with cand as (
--   select id, reg_key, full_text as before, pg_temp.link_subpart_tails(full_text) as after
--   from public.provisions
--   where reg_key not in ('oooo','ooooa','oooob','ooooc','jjjj','iiii','zzzz','p190','p191','p192','p193','p194','p195','p196','p199')
--     and full_text ~ 'xref-external-reg' and full_text ~ '(OOOO|JJJJ|IIII|ZZZZ)'
-- ), ch as (
--   select *, length((regexp_split_to_array(before, '<a [^>]*href="/regulations/(?:oooo|ooooa|oooob|ooooc|jjjj|iiii)"[^>]*>[^<]*(?:OOOO[abc]?|JJJJ|IIII)</a>(?:,\s+(?:or|and)\s+|,\s+|\s+(?:and/or|or|and)\s+|/)(?:OOOOa|OOOOb|OOOOc|OOOO|JJJJ|IIII)\M'))[1]) d
--   from cand where after is distinct from before)
-- select reg_key, id, (length(after) - length(before)) as added_chars,
--   substr(before, greatest(d-60,1), 300) as before_snip,
--   substr(after, greatest(d-60,1), 300 + (length(after)-length(before))) as after_snip
-- from ch order by reg_key, id;

with upd as (
  update public.provisions p
     set full_text = pg_temp.link_subpart_tails(p.full_text)
   where p.reg_key not in ('oooo','ooooa','oooob','ooooc','jjjj','iiii','zzzz','p190','p191','p192','p193','p194','p195','p196','p199')
     and p.full_text ~ 'xref-external-reg'
     and p.full_text ~ '(OOOO|JJJJ|IIII|ZZZZ)'
     and pg_temp.link_subpart_tails(p.full_text) is distinct from p.full_text
     and regexp_replace(pg_temp.link_subpart_tails(p.full_text), '<[^>]+>', '', 'g') = regexp_replace(p.full_text, '<[^>]+>', '', 'g')
  returning p.reg_key
)
select coalesce(reg_key, 'total') as reg_key, count(*) as rows_changed
from upd group by rollup (reg_key) order by count(*) desc;

-- select public.refresh_changelog_snapshot();

-- Read-back 1: rows logged as links_updated by the trigger in this run.
-- select count(*) from public.provision_changes
--  where change_type = 'links_updated' and created_at > now() - interval '15 minutes';
--
-- Read-back 2: bare list codes left after a linked head in the Colorado
-- documents (expected: none). Same head, separator and code as the UPDATE.
-- select reg_key, id from public.provisions
--  where reg_key not in ('oooo','ooooa','oooob','ooooc','jjjj','iiii','zzzz','p190','p191','p192','p193','p194','p195','p196','p199')
--    and (full_text ~ '<a [^>]*href="/regulations/(?:oooo|ooooa|oooob|ooooc|jjjj|iiii)"[^>]*>[^<]*(?:OOOO[abc]?|JJJJ|IIII)</a>(?:,\s+(?:or|and)\s+|,\s+|\s+(?:and/or|or|and)\s+|/)(?:OOOOa|OOOOb|OOOOc|OOOO|JJJJ|IIII)\M(?![.-]\d)'
--      or full_text ~ '<a [^>]*href="/regulations/zzzz"[^>]*>[^<]*ZZZZ</a>(?:,\s+(?:or|and)\s+|,\s+|\s+(?:and/or|or|and)\s+|/)ZZZZ\M(?![.-]\d)');
--
-- Read-back 3: the GP05 IX.B row.
-- select full_text from public.provisions where id = 'sec-gp05-IX-B';
--
-- Read-back 4: the embedding hashes of the changed rows (unchanged).
-- select count(*), md5(string_agg(provision_id||':'||chunk_index||':'||chunk_text_hash, ',' order by provision_id, chunk_index))
--   from public.provision_embeddings
--  where provision_id in ('sec-7-C-EE','sec-7-C-P','sec-7-C-X','sec-gp01-I-F-1','sec-gp01-IX-A','sec-gp01-IX-B',
--    'sec-gp05-I-F-1','sec-gp05-IX-A','sec-gp05-IX-B','sec-gp08-I-A-1','sec-gp12-I-H-8');
-- Before the run: 48 chunks, md5 78a4f7e0808c8287b0d0c12977f375eb.
