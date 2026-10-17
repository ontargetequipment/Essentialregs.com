-- body replaced 2026-10-17 with the applied SQL from schema_migrations.statements; the previous body was never applied
-- Backlog #15: keyword search ranks operative provisions first and Statements
-- of Basis last.
--
-- The problem. ts_rank() without a normalisation flag rewards term frequency
-- alone, so the 20-85k-character Statement of Basis entries (Reg 7 Part C,
-- Reg 3 Part F, ...) -- which mention every regulated thing dozens of times --
-- saturate at rank 1.0 and fill the whole first page. Measured 2026-09-26 as
-- a subscriber: "APEN requirements", "storage tank requirements" and "well
-- production facility" each returned five Statement of Basis rows in the top
-- five and not one operative rule; "produced water tank" led with Reg 7 Part
-- C.S; "OOOOb" put Table 5 ahead of the subpart itself.
--
-- The fix, all inside this one function:
--   1. ts_rank(..., 1): divide by 1 + log(document length). A short rule that
--      is about storage tanks now beats a long history that mentions them.
--      Same flag the Ask keyword side has used since 20260919041700.
--   2. include_basis (default false): Statements of Basis are left out of the
--      result set unless asked for. The Search page passes it from a toggle.
--   3. is_basis output column, from the existing is_basis_provision(), so the
--      page can badge those rows when they are included (same badge Ask uses).
--   4. Multipliers on the normalised rank:
--        x 2.0  direct citation hit: every query term appears in the row's own
--               citation (to_tsvector(citation) @@ tsq). "OOOOb" matches the
--               citation of the subpart root and of its five tables and of
--               nothing else; normalisation then puts the root first.
--        x 0.5  Statement of Basis row (only reachable with include_basis).
--        x 0.8  row whose breadcrumb passes through a "Definitions" heading
--               ("100 Series — DEFINITIONS", "I.B. Definitions"): a term's
--               definition is useful but rarely the requirement someone
--               searched for. Matched on the path this function already
--               returns, so for a caller who gets NULL paths (anon, see
--               provision_path) the multiplier is inert -- and anon can only
--               see the four sample rows anyway.
--   5. The multipliers are applied to a pool of lim * 3 rows taken by
--      normalised rank, then the best lim are returned. Costs lim * 3
--      provision_path() calls instead of lim: measured +25-30 ms per search on
--      a warm cache (about 50 -> 80 ms for the pool stage).
--
-- Result, same five queries, same subscriber, include_basis off (the page
-- default): "APEN requirements" -> Reg 3 Part A II. (APEN Requirements) first;
-- "storage tank requirements" -> GP09/GP10 IV.C. Storage Tank Requirements,
-- GP08 II.C., Reg 7 II.C.1.; "well production facility" -> Reg 7 I.L.2., Reg 7
-- II.E.4., Reg 3 III.J.4.; "OOOOb" -> the subpart root, then Tables 1-5;
-- "produced water tank" -> Reg 7 V.C.2.w., GP08 I.B.1.c., GP08 II.C.1. With
-- include_basis on, the normalisation alone already keeps every basis row out
-- of the top five for all five queries; the 0.5 is belt and braces for short
-- basis entries. Full before/after tables are in the PR for this migration.
--
-- Signature change: (text, integer) -> (text, integer, boolean). CREATE OR
-- REPLACE would create a second overload and PostgREST would refuse the
-- ambiguous rpc("search_provisions", {q, lim}) call, so the old one is
-- dropped first and the grants are re-issued on the new signature, unchanged
-- from 20260913000000: anon + authenticated (+ service_role, which held it).
-- Existing callers that pass only q and lim keep working.
--
-- Still SECURITY INVOKER (RLS decides which rows a caller may see; anon gets
-- the four is_public samples), still SET search_path = public. Do NOT make
-- this function SECURITY DEFINER: it selects full_text straight from
-- provisions and as DEFINER would serve paywalled body text to anon (see
-- 20260923035949). Headline behaviour (NULL for heading-only rows) is
-- unchanged from 20260925013538.

drop function if exists public.search_provisions(text, integer);

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
  -- Relevance pool: the best lim * 3 rows by length-normalised rank. Basis
  -- rows are filtered here, before the limit, so include_basis = false never
  -- returns a short page just because basis rows crowded the pool.
  pool as (
    select p.id, p.citation, p.title, p.full_text, p.sort_order,
      ts_rank(p.search_vector, query.tsq, 1) as base,
      public.is_basis_provision(p.id) as is_basis,
      (to_tsvector('english', p.citation) @@ query.tsq) as citation_hit
    from provisions p, query
    where p.search_vector @@ query.tsq
      and (include_basis or not public.is_basis_provision(p.id))
    order by base desc, p.sort_order asc
    limit greatest(coalesce(lim, 25), 1) * 3
  ),
  -- The breadcrumb is computed once per pooled row: it drives the Definitions
  -- multiplier and is returned as-is.
  pathed as (
    select pool.*, public.provision_path(pool.id) as path
    from pool
  ),
  scored as (
    select pathed.*,
      (pathed.base
        * (case when pathed.citation_hit then 2.0 else 1.0 end)
        * (case when pathed.is_basis then 0.5 else 1.0 end)
        * (case when pathed.path ~* '\mdefinitions?\M' then 0.8 else 1.0 end)
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
  'Keyword search. Length-normalised ts_rank with multipliers (x2 direct '
  'citation hit, x0.5 Statement of Basis, x0.8 under a Definitions heading) '
  'applied to a lim*3 pool; include_basis=false (default) drops Statements of '
  'Basis. SECURITY INVOKER on purpose: RLS is the paywall here.';

-- Same grants as 20260913000000 (anon, authenticated) plus service_role, which
-- already held EXECUTE on the old signature. Re-issued because the drop above
-- took them with the old function.
grant execute on function public.search_provisions(text, integer, boolean)
  to anon, authenticated, service_role;
