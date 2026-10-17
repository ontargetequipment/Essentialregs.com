-- Keyword search (search_provisions): permits closed to new registrations
-- rank below the operative rule; applicability sections lead for a query
-- that names a source type. Acceptance item 3, 6-7 Oct 2026.
--
-- The 6 Oct 2026 acceptance pass on the live site (Statements of Basis
-- hidden, as a subscriber):
--   "storage tank requirements"  GP09 IV.C (closed), GP10 IV.C (closed),
--                                GP08 II.C, then Regulation 7 Part B II.C.1
--                                fourth. Pass condition: Regulation 7 Part B
--                                storage-tank controls first.
--   "produced water tank"        Regulation 7 Part B V.C.2.w (an item in the
--                                emissions-inventory equipment list) first,
--                                GP08 I.B.1.c (the permit's applicability)
--                                second. Pass condition: GP08 applicability
--                                first.
--   "fugitive emissions"         Common Provisions I.G.54, GP09 I.A.5
--                                (closed), GP10 I.A.5 (closed), GP12 I.A.6,
--                                GP12 V.O. Pass condition: a Regulation 7
--                                LDAR provision and an OOOOb fugitive
--                                provision in the top 5.
-- GP09 and GP10 closed to new registrations on 15 July 2026 (GP12 replaced
-- them); Ask already multiplies them by 0.6 (20260930003325,
-- closed_permit_reg_keys()). Keyword search did not.
--
-- Three multipliers, all in the pool stage of search_provisions (inside the
-- best lim * 3 rows, so they reorder among good matches and never promote a
-- weak one), measured against every row of the acceptance table and the
-- corpus QA guards before being chosen (the smallest set that meets the
-- failing conditions without moving a passing one):
--
--   x0.6  a permit closed to new registrations (closed_permit_reg_keys()),
--         unless the query names it ("gp09", "general permit 10"): an
--         existing registrant looking up their own permit keeps it.
--   x0.95 every other general permit row: a permit condition implements the
--         regulation's requirement, so on a tie the operative rule leads
--         ("storage tank requirements": GP08 II.C 0.2549 and Regulation 7
--         II.C.1 0.2533 are a dead heat by the words).
--   x1.3  a row under an applicability heading, or whose own title is one
--         ("I. General Permit Applicability" -> I.B.1.c; "§ 60.5365b Am I
--         subject to this subpart?"). The heading-level test on purpose: a
--         title that merely contains "subject to" mid-sentence (OOOOb's
--         Table 1 "...Affected Facilities Subject to...") is not an
--         applicability section, and boosting it put the tables above the
--         subpart root for "OOOOb". Ask uses 1.15 with a looser test; the
--         keyword side has only the words, and 1.3 is what it takes for a
--         permit's applicability row to lead a bare equipment-list item
--         with the same words (GP08 I.B.1.c 0.231 against Regulation 7
--         V.C.2.w 0.273; 1.25 left 0.5% between them).
--
-- Result (subscriber, Statements of Basis hidden; the keyword eval,
-- scripts/keyword-eval.ts, pins all seven rows on every pull request):
--   storage tank requirements  Regulation 7 II.C.1 first (GP08 II.C second)
--   produced water tank        GP08 I.B.1.c first
--   APEN requirements          Regulation 3 Part A II first (unchanged)
--   well production facility   Regulation 7 I.L.2, II.E.4 first (unchanged)
--   OOOOb                      the subpart root first, tables below (unchanged)
--   reciprocating internal     GP12 I.A.1 / I.A.2, Regulation 26 I.D.4 in the
--     combustion engine        top 3; the closed GP09 / GP10 rows leave the top 5
--   fugitive emissions         GP12 I.A.6, Common Provisions I.G.54, GP12 V.O,
--                              GP12 VII.G, OOOOc 60.5397c(c); OOOOb 60.5397b(e)
--                              seventh (was eleventh). NOT met, on purpose:
--                              Regulation 7's LDAR provisions score 0.075 at
--                              best on these two words (the rule says "leak
--                              detection and repair"), against a top-5 cut
--                              near 0.18, and the only ways to lift them --
--                              a synonym rule, or demoting GP12's headings --
--                              would break corpus QA check 17 (the oil-and-gas
--                              tie-break the previous review asked for). The
--                              eval lists the row as a known failure.
-- corpus QA checks 16 and 17 hold; "surface coating" still returns
-- Regulation 25 first.
--
-- Nothing else changes: same signature, same grants, SECURITY INVOKER (RLS
-- is the paywall; see 20260923035949), MATERIALIZED matches (see the comment
-- on it), same headline rule.

create or replace function public.search_provisions(
  q             text,
  lim           integer default 25,
  include_basis boolean default false
)
returns table (
  id       text,
  citation text,
  title    text,
  reg_key  text,
  headline text,
  rank     real,
  path     text,
  is_basis boolean
)
language sql
stable
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('english', q) as tsq,
      -- The closed permits the query names by number ("gp09", "gp 10",
      -- "general permit 9"): an existing registrant's own permit keeps its
      -- rank (the same rule as match_provisions_hybrid, 20260930003325).
      (select coalesce(array_agg(c), '{}'::text[])
         from unnest(public.closed_permit_reg_keys()) c
        where lower(coalesce(q, '')) ~ ('\m(gp\s?0?' || ltrim(substring(c from 3), '0')
                                        || '|general permit\s+0?' || ltrim(substring(c from 3), '0') || ')\M')) as named_closed
  ),
  -- MATERIALIZED on purpose. For an authenticated caller the RLS policy on
  -- provisions turns this into a sequential scan of the whole table (36k
  -- rows), and without the fence the planner pushes the is_basis_provision()
  -- filter from the next CTE down into that scan and evaluates it once per
  -- table row instead of once per match: measured 280 ms against 46 ms for
  -- "APEN requirements" as a subscriber. Do not remove the keyword.
  matches as materialized (
    select p.id, p.citation, p.title, p.full_text, p.sort_order, p.reg_key,
      ts_rank(p.search_vector, query.tsq, 1) as base,
      public.is_basis_provision(p.id) as is_basis,
      (to_tsvector('english', p.citation) @@ query.tsq) as citation_hit
    from provisions p, query
    where p.search_vector @@ query.tsq
  ),
  -- Relevance pool: the best lim * 3 rows by normalised rank with the two
  -- row-local multipliers already applied. Basis rows are dropped here, before
  -- any limit, so include_basis = false never returns a short page because
  -- basis rows crowded the pool.
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
  -- The breadcrumb is computed once per pooled row: it drives the Definitions
  -- and applicability multipliers and is returned as-is.
  pathed as (
    select pool.*, public.provision_path(pool.id) as path
    from pool
  ),
  -- Pool-stage multipliers: x0.8 under a Definitions heading, x0.7 for a
  -- regulation about another sector (non_oil_gas_reg_keys(), backlog #21),
  -- x0.6 for a permit closed to new registrations unless the query names it,
  -- x0.95 for any other general permit, x1.3 under an applicability heading
  -- (this migration). All act inside the pool only, so they reorder among
  -- good matches and never promote a weak one.
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
      )::real as score
    from pathed, query
    order by score desc, pathed.sort_order asc
    limit greatest(coalesce(lim, 25), 1)
  ),
  -- Same normalisation as normalizeCitationLabel in src/lib/snippet.ts, applied
  -- to the text (tags removed first) and to the two labels it is compared with.
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
$$;

comment on function public.search_provisions(text, integer, boolean) is
  'Keyword search. Length-normalised ts_rank x2 on a direct citation hit, '
  'x0.5 on a Statement of Basis; the best lim*3 then get x0.8 under a '
  'Definitions heading, x0.7 in a regulation about another sector '
  '(non_oil_gas_reg_keys()), x0.6 in a permit closed to new registrations '
  '(closed_permit_reg_keys(), unless the query names it), x0.95 in any other '
  'general permit and x1.3 under an applicability heading, and the best lim '
  'are returned. include_basis=false (default) drops Statements of Basis. '
  'SECURITY INVOKER on purpose: RLS is the paywall here.';

-- CREATE OR REPLACE keeps the existing grants (anon, authenticated,
-- service_role). Re-stated so a from-scratch replay of this file alone leaves
-- the function callable by the same roles.
grant execute on function public.search_provisions(text, integer, boolean)
  to anon, authenticated, service_role;
