-- Keyword search (search_provisions): a query that is exactly a document's
-- key opens that document first. 8 Oct 2026, the original Subpart OOOO import.
--
-- "OOOOb" already returned the subpart root first (the keyword eval's sixth
-- row and corpus QA check 17 pin it). "OOOO", the day its document arrived,
-- returned Regulation 6's adoption-by-reference stub for Subpart OOOO
-- (sec-6-A-SUBPART-OOOO, citation "Subpart OOOO", 0.2729) ahead of the
-- subpart's own root row (sec-oooo-top-REG-oooo, 0.2382): the stub is two
-- words of citation and one sentence of text, so ts_rank's length
-- normalization and the x2.0 citation hit favour it. OOOOb has no such stub
-- in Regulation 6, which is the only reason its root led.
--
-- One multiplier, in the scored stage (inside the best lim * 3 rows, like
-- the others): x2.0 for the root row ("sec-<key>-top-REG-<key>") of the
-- document whose reg key is the whole query, lower-cased and trimmed
-- ("OOOO" -> oooo, "oooob", "jjjj", "gp12", "7"). A query that is exactly a
-- document's name wants that document; a longer query is never touched
-- (the key must be the entire query), so no other acceptance row or guard
-- can move. Measured: "OOOO" -> sec-oooo-top-REG-oooo 0.476, Regulation 6's
-- stub 0.273 second; "OOOOb" -> its root 0.491, tables below (unchanged
-- order); the other seven keyword eval rows unchanged. Both "OOOO" and
-- "OOOOb" are keyword eval rows (src/lib/keyword-eval.ts).
--
-- Everything else in the function is 20261007020000 verbatim.

create or replace function public.search_provisions(q text, lim integer default 25, include_basis boolean default false)
 returns table(id text, citation text, title text, reg_key text, headline text, rank real, path text, is_basis boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  with query as (
    select websearch_to_tsquery('english', q) as tsq,
      lower(btrim(coalesce(q, ''))) as named_key,
      (select coalesce(array_agg(c), '{}'::text[])
         from unnest(public.closed_permit_reg_keys()) c
        where lower(coalesce(q, '')) ~ ('\m(gp\s?0?' || ltrim(substring(c from 3), '0')
                                        || '|general permit\s+0?' || ltrim(substring(c from 3), '0') || ')\M')) as named_closed
  ),
  matches as materialized (
    select p.id, p.citation, p.title, p.full_text, p.sort_order, p.reg_key,
      ts_rank(p.search_vector, query.tsq, 1) as base,
      public.is_basis_provision(p.id) as is_basis,
      (to_tsvector('english', p.citation) @@ query.tsq) as citation_hit
    from provisions p, query
    where p.search_vector @@ query.tsq
  ),
  pool as (
    select matches.*,
      (matches.base
        * (case when matches.citation_hit then 2.0 else 1.0 end)
        * (case when matches.is_basis then 0.5 else 1.0 end)) as pre
    from matches
    where include_basis or not matches.is_basis
    order by pre desc, matches.sort_order asc
    limit greatest(coalesce(lim, 25), 1) * 3
  ),
  pathed as (
    select pool.*, public.provision_path(pool.id) as path
    from pool
  ),
  scored as (
    select pathed.*,
      (pathed.pre
        * (case when pathed.path ~* '\mdefinitions?\M' then 0.8 else 1.0 end)
        * (case when pathed.reg_key = any (public.non_oil_gas_reg_keys()) then 0.7 else 1.0 end)
        * (case when pathed.reg_key = any (public.closed_permit_reg_keys())
                     and not (pathed.reg_key = any (query.named_closed)) then 0.6
                when pathed.reg_key ~ '^gp\d\d$' then 0.95
                else 1.0 end)
        * (case when pathed.path ~* '\m(applicability|am i subject|who must comply)\M'
                  or pathed.title ~* '^\s*(§\s*[0-9][0-9a-z.]*\s*|[IVXLC]+(\.[A-Za-z0-9]+)*\.?\s+)?(applicability|am i subject|who must comply|applies to)\M'
                then 1.3 else 1.0 end)
        * (case when query.named_key <> ''
                     and pathed.id = 'sec-' || query.named_key || '-top-REG-' || query.named_key
                then 2.0 else 1.0 end)
      )::real as score
    from pathed, query
    order by score desc, pathed.sort_order asc
    limit greatest(coalesce(lim, 25), 1)
  ),
  plain as (
    select scored.*,
      btrim(regexp_replace(replace(replace(replace(regexp_replace(scored.full_text, '<[^>]*>', '', 'g'), '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_text,
      btrim(regexp_replace(replace(replace(replace(scored.title,    '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_title,
      btrim(regexp_replace(replace(replace(replace(scored.citation, '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_citation
    from scored
  )
  select plain.id, plain.citation, plain.title,
    substring(plain.id from '^sec-([^-]+)-') as reg_key,
    case
      when plain.norm_text = plain.norm_title or plain.norm_text = plain.norm_citation then null
      else ts_headline('english', regexp_replace(plain.full_text, '<[^>]+>', ' ', 'g'), query.tsq,
             'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1')
    end as headline,
    plain.score as rank,
    plain.path,
    plain.is_basis
  from plain, query
  order by plain.score desc, plain.sort_order asc;
$function$;

comment on function public.search_provisions(text, integer, boolean) is
  'Keyword search. Length-normalised ts_rank x2 on a direct citation hit, '
  'x0.5 on a Statement of Basis; the best lim*3 then get x0.8 under a '
  'Definitions heading, x0.7 in a regulation about another sector '
  '(non_oil_gas_reg_keys()), x0.6 in a permit closed to new registrations '
  '(closed_permit_reg_keys(), unless the query names it), x0.95 in any other '
  'general permit, x1.3 under an applicability heading and x2.0 for the root '
  'row of the document whose reg key is the whole query ("OOOO", "gp12"), '
  'and the best lim are returned. include_basis=false (default) drops '
  'Statements of Basis. SECURITY INVOKER on purpose: RLS is the paywall here.';

-- CREATE OR REPLACE keeps the existing grants (anon, authenticated,
-- service_role). Re-stated so a from-scratch replay of this file alone leaves
-- the function callable by the same roles.
grant execute on function public.search_provisions(text, integer, boolean)
  to anon, authenticated, service_role;
