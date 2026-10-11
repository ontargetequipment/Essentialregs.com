-- Cross-regulation "Part X" links, existing rows (11 Oct 2026). Data only.
--
-- BEFORE: a citation such as GP05 VI.A's "Regulation Number 7, Part B,
-- Section I.A.1" linked the regulation and the section and left the part as
-- plain text between them:
--   <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, Part B,
--   <a class="xref-external-reg" href="/regulations/7#sec-7-B-I-A-1">Section I.A.1</a>
-- AFTER: "Part B" links to the part root, in the shape the importer now
-- writes (pipeline/import_ccr.py _emit_xreg_clauses, 11 Oct 2026):
--   ..., <a class="xref-external-reg" href="/regulations/7#sec-7-P-B">Part B</a>, ...
--
-- Scope: rows whose full_text matches '%</a>, Part _,%' (611 rows, 26
-- reg_keys). Each "Part X," that directly follows a cross-regulation link
-- to /regulations/<reg> is wrapped only when sec-<reg>-P-<X> exists; every
-- other occurrence is left as printed (Reg 7 Parts D and E and Reg 10 Part
-- B have no root). The WHERE requires at least one such root and the same
-- visible text before and after (tags stripped), so no official text can
-- change. Re-running it changes nothing (no "</a>, Part X," with a root is
-- left to match).
--
-- Not a re-import. The provisions_log_text_updated trigger logs each row as
-- 'links_updated' (visible letters and digits unchanged; migration
-- 20261007040000), and pipeline/embed.py's hash unwraps
-- xref-external-reg anchors without a space (LINK_MARKUP_RE), so no row is
-- re-embedded. The keyword index (search_vector) replaces tags with a
-- space, so its tokens are unchanged too. Summaries and review state are not
-- touched.
--
-- Applied by Claude Code through the Supabase connector (execute_sql) on
-- 11 Oct 2026 at 03:26 UTC, then select public.refresh_changelog_snapshot();
-- read-back queries are at the end of this file. Result: 604 rows, 797 part
-- links (gp12 124, gp09 65, gp10 65, gp02 48, gp07 38, gp11 32, gp06 31,
-- gp05 29, gp08 28, gp01 28, 30 27, 7 18, 3 14, 23 9, 25 8, 24 8, 26 7,
-- 27 6, 22 4, gp03 4, cp 3, 9 3, 1 2, 8 1, 6 1, aqs 1); 604 'links_updated'
-- rows logged, nothing else. Left as printed, no part root: Reg 7 Part D x7
-- (sec-22-A-II-W, -A-II-Y, -A-III-C-1 x2, -A-III-C-2, -E-I, sec-gp12-V-F),
-- Reg 7 Part E x3 (sec-23-B-I, -B-II, sec-24-C-I), Reg 10 Part B x1
-- (sec-aqs-VIII-O). Not matched by this pattern (a re-import of those
-- documents links the first two forms): "Regulation Number 3, Part B.
-- Section III.E." with a period (16 rows), "Regulation Number 6 Part B,"
-- with no comma (1 row), and "Parts A and B" (7 rows, never linked).

with pat as (
  select '(<a class="xref-external-reg"[^>]*href="/regulations/([^"/?#]+)[^"]*"[^>]*>[^<]*</a>, )Part ([A-Z]),'::text as re
),
cand as (
  select p.id,
    (select string_agg(s.piece || coalesce(r.repl, ''), '' order by s.n)
       from unnest(regexp_split_to_array(p.full_text, pat.re)) with ordinality as s(piece, n)
       left join (
         select m.n,
                m.arr[1] || case
                  when exists (select 1 from public.provisions pr where pr.id = 'sec-' || m.arr[2] || '-P-' || m.arr[3])
                  then '<a class="xref-external-reg" href="/regulations/' || m.arr[2] || '#sec-' || m.arr[2]
                       || '-P-' || m.arr[3] || '">Part ' || m.arr[3] || '</a>,'
                  else 'Part ' || m.arr[3] || ','
                end as repl
         from regexp_matches(p.full_text, pat.re, 'g') with ordinality as m(arr, n)
       ) r on r.n = s.n) as new_text
  from public.provisions p, pat
  where p.full_text like '%</a>, Part _,%'
),
upd as (
  update public.provisions p
     set full_text = c.new_text
    from cand c, pat
   where p.id = c.id
     and c.new_text is distinct from p.full_text
     and exists (
       select 1
       from regexp_matches(p.full_text, pat.re, 'g') as m(arr)
       join public.provisions root on root.id = 'sec-' || m.arr[2] || '-P-' || m.arr[3])
     and regexp_replace(c.new_text, '<[^>]+>', '', 'g') = regexp_replace(p.full_text, '<[^>]+>', '', 'g')
  returning p.reg_key
)
select coalesce(reg_key, 'total') as reg_key, count(*) as rows_changed
from upd group by rollup (reg_key) order by count(*) desc;

-- select public.refresh_changelog_snapshot();

-- Read-back 1: rows logged as links_updated by the trigger in this run.
-- select count(*) from public.provision_changes
--  where change_type = 'links_updated' and created_at > now() - interval '15 minutes';
--
-- Read-back 2: "Part X," still plain after a cross-regulation link, with and
-- without a part root (expected: none with a root).
-- select m.arr[1] as reg, m.arr[2] as part,
--        exists (select 1 from public.provisions r where r.id = 'sec-' || m.arr[1] || '-P-' || m.arr[2]) as root,
--        count(*), array_agg(distinct p.id)
--   from public.provisions p,
--        regexp_matches(p.full_text, '<a class="xref-external-reg"[^>]*href="/regulations/([^"/?#]+)[^"]*"[^>]*>[^<]*</a>, Part ([A-Z]),', 'g') as m(arr)
--  group by 1, 2, 3;
--
-- Read-back 3: the GP05 rows.
-- select id, (select string_agg(h[1], ' ') from regexp_matches(full_text, 'href="([^"]+)"', 'g') h) as hrefs
--   from public.provisions where id in ('sec-gp05-VI-A', 'sec-gp05-VI-B', 'sec-gp05-VI-C') order by id;
