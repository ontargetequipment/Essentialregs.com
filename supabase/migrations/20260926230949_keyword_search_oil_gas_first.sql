-- Backlog #21: for an ambiguous industry term, keyword search puts the
-- oil-and-gas requirement ahead of an equally good match from another sector.
--
-- The problem. After 20260926045912 the outside reviewer's second pass rated
-- keyword search 8.5/10 with one exception: "fugitive emissions" ranked
-- Regulation 25 I.A.7. (fugitive emission control at surface coating
-- operations), Regulation 1 III.D. (fugitive particulate / dust) and the
-- Common Provisions definition I.G.54. above GP09/GP10/GP12 I.A.5./I.A.6.
-- (fugitive component leak emissions at well production facilities), the
-- OOOOb/OOOOc fugitive-emissions monitoring sections and Regulation 7's
-- LDAR rules. All of those are honest hits for the words; the product is
-- marketed for Colorado oil and gas, so among equally relevant matches the
-- oil-and-gas one should win.
--
-- The fix, one more multiplier of the kind 20260926045912 introduced:
--   1. non_oil_gas_reg_keys(): the reg keys whose SUBJECT is a sector or
--      source category other than oil and gas (surface coating and solvents,
--      wood-burning appliances, motor vehicles and diesel fleets, street
--      sanding, landfills, lead abatement, ...). Built from the 57 roots in
--      provisions; the full key-by-key table with reasons is in the PR for
--      this migration. Everything oil-and-gas (Reg 7, ECMC, every general
--      permit, OOOO/OOOOa/OOOOb/OOOOc, ZZZZ, JJJJ, IIII, PHMSA Parts 190-199)
--      and everything cross-cutting that applies to an oil-and-gas site as
--      much as to anyone (Reg 3 permitting, Reg 6 NSPS, Reg 8 HAPs, Reg 22
--      GHG reporting, Reg 26 engines, Reg 30 toxics, Common Provisions,
--      Procedural Rules, Air Quality Standards, SIP) is NOT in the list and
--      keeps its rank. Regulation 1 is in the list even though oil-and-gas
--      sites do raise dust: its subject is not oil and gas. When in doubt a
--      key was left out. IMMUTABLE so the planner folds the call to a
--      constant; SECURITY INVOKER; executable by the same roles as
--      search_provisions.
--   2. search_provisions(): x 0.7 on rows whose reg_key is in that list.
--      Applied in the same stage as the Definitions multiplier, i.e. inside
--      the relevance pool of the best lim * 3 rows, so it reorders among
--      good matches and cannot promote a weak match into the page. Nothing
--      else in the function changes: same signature, same grants, still
--      SECURITY INVOKER (RLS is the paywall; see 20260923035949), still
--      MATERIALIZED matches (see the comment on it), same headline rule.
--      The reg_key used for the test is the stored generated column from
--      20260924022153; the returned reg_key column is derived from the id
--      exactly as before.
--
-- Result, as a subscriber, "fugitive emissions": GP10 I.A.5., GP09 I.A.5.,
-- GP12 I.A.6. / V.O. / VII.G. and the Common Provisions definition move up;
-- Regulation 25 I.A.7. and Regulation 1 III.D. drop out of the top ten. The
-- five backlog #15 queries ("APEN requirements", "storage tank
-- requirements", "well production facility", "OOOOb", "produced water
-- tank") keep the same top 3. "surface coating" still returns Regulation 25
-- first: an explicit query for another sector still finds it, because the
-- multiplier only moves a Reg 25 row below a row that already scored at
-- least 70% as well. Before/after tables and timings are in the PR.
--
-- scripts/corpus_qa.sql check 17 (keyword_ranking_oil_gas_first) asserts the
-- "fugitive emissions" outcome as the subscriber-simulated role.

create or replace function public.non_oil_gas_reg_keys()
returns text[]
language sql
immutable
security invoker
set search_path = public
as $$
  select array[
    '1',   -- Regulation 1: particulate matter, smoke, CO, SOx (fugitive dust, fuel-burning equipment)
    '4',   -- Regulation 4: wood-burning appliances
    '9',   -- Regulation 9: open burning and prescribed fire
    '10',  -- Regulation 10: transportation conformity
    '11',  -- Regulation 11: motor vehicle emissions inspection
    '12',  -- Regulation 12: diesel vehicle emissions
    '15',  -- Regulation 15: ozone-depleting compounds (refrigerant servicing)
    '16',  -- Regulation 16: street sanding
    '18',  -- Regulation 18: federal acid rain program (Title IV electric utilities)
    '19',  -- Regulation 19: lead hazards (abatement)
    '20',  -- Regulation 20: clean cars and trucks
    '21',  -- Regulation 21: consumer products and architectural coatings
    '25',  -- Regulation 25: surface coating, solvents, asphalt, printing, pharmaceuticals
    '27',  -- Regulation 27: greenhouse gas and energy management for manufacturing
    '28',  -- Regulation 28: building benchmarking and performance standards
    '29',  -- Regulation 29: lawn and garden equipment
    '31'   -- Regulation 31: municipal solid waste landfills
  ]::text[];
$$;

comment on function public.non_oil_gas_reg_keys() is
  'Reg keys whose subject is a sector other than oil and gas. search_provisions '
  'multiplies their rows by 0.7 inside its relevance pool so that, for an '
  'ambiguous term, the oil-and-gas requirement wins among equally good matches. '
  'Cross-cutting regulations (Reg 3, 6, 8, 22, 26, 30, Common Provisions, ...) '
  'are deliberately absent. Key-by-key table in the PR for backlog #21.';

grant execute on function public.non_oil_gas_reg_keys()
  to anon, authenticated, service_role;

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
  with query as (select websearch_to_tsquery('english', q) as tsq),
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
  -- multiplier and is returned as-is.
  pathed as (
    select pool.*, public.provision_path(pool.id) as path
    from pool
  ),
  -- Pool-stage multipliers: x0.8 under a Definitions heading, x0.7 for a
  -- regulation about another sector (non_oil_gas_reg_keys(), backlog #21).
  -- Both act inside the pool only, so they reorder among good matches and
  -- never promote a weak one.
  scored as (
    select pathed.*,
      (pathed.pre
        * (case when pathed.path ~* '\mdefinitions?\M' then 0.8 else 1.0 end)
        * (case when pathed.reg_key = any (public.non_oil_gas_reg_keys()) then 0.7 else 1.0 end)
      )::real as score
    from pathed
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
  'Definitions heading and x0.7 in a regulation about another sector '
  '(non_oil_gas_reg_keys()), and the best lim are returned. '
  'include_basis=false (default) drops Statements of Basis. SECURITY INVOKER '
  'on purpose: RLS is the paywall here.';

-- CREATE OR REPLACE keeps the existing grants (anon, authenticated,
-- service_role, from 20260926045912). Re-stated so a from-scratch replay of
-- this file alone leaves the function callable by the same roles.
grant execute on function public.search_provisions(text, integer, boolean)
  to anon, authenticated, service_role;
