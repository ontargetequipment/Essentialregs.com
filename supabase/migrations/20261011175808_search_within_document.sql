-- Keyword search inside one document, for the reader's jump box. 11 Oct 2026.
--
-- The jump box matched words against the first 90 characters of each
-- provision, so "sampling" found nothing in GP05 although VI.D says "must
-- complete site-specific sampling". It now asks the server, scoped to the
-- open document.
--
-- search_provisions(q, lim, include_basis) has no reg_key filter and its
-- limit is applied across the whole corpus (the best lim * 3 rows, then the
-- ranking multipliers), so filtering its result by document afterwards would
-- lose the document's own hits whenever other regulations outrank them.
-- A new argument on that function would be a second overload (the three-
-- argument calls would become ambiguous), and ranking is not to be touched.
-- So this is a separate, much smaller function: same text search
-- (search_vector, websearch_to_tsquery 'english', so "sampling" also finds
-- "sample"), same ts_headline settings, same Statement-of-Basis exclusion,
-- with the document as a WHERE clause and a plain ts_rank order (reading
-- order breaks ties). No multipliers: inside one document there is nothing
-- to weigh a general permit against a regulation.
--
-- SECURITY INVOKER on purpose, like search_provisions: RLS is the paywall.
-- A logged-out caller sees only is_public rows ("public can read public
-- provisions"), so a locked document's key returns nothing and GP05, whose
-- rows are all public, returns its own; a subscriber sees the document once
-- it is released (reg_is_released in the subscribers policy).
--
-- New object, CREATE OR REPLACE only (the Supabase connector holds any
-- statement that removes an object, so this file has none).

create or replace function public.search_provisions_in_document(q text, doc_key text, lim integer default 10)
 returns table(id text, citation text, title text, headline text, rank real)
 language sql
 stable
 set search_path to 'public'
as $function$
  with query as (
    select websearch_to_tsquery('english', coalesce(q, '')) as tsq
  ),
  hits as (
    select p.id, p.citation, p.title, p.full_text, p.sort_order,
      ts_rank(p.search_vector, query.tsq, 1) as base
    from provisions p, query
    where p.reg_key = lower(btrim(coalesce(doc_key, '')))
      and p.search_vector @@ query.tsq
      and not public.is_basis_provision(p.id)
    order by base desc, p.sort_order asc
    limit greatest(least(coalesce(lim, 10), 50), 1)
  ),
  plain as (
    select hits.*,
      btrim(regexp_replace(replace(replace(replace(regexp_replace(hits.full_text, '<[^>]*>', '', 'g'), '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_text,
      btrim(regexp_replace(replace(replace(replace(hits.title,    '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_title,
      btrim(regexp_replace(replace(replace(replace(hits.citation, '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_citation
    from hits
  )
  select plain.id, plain.citation, plain.title,
    case
      when plain.norm_text = plain.norm_title or plain.norm_text = plain.norm_citation then null
      else ts_headline('english', regexp_replace(plain.full_text, '<[^>]+>', ' ', 'g'), query.tsq,
             'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1')
    end as headline,
    plain.base::real as rank
  from plain, query
  order by plain.base desc, plain.sort_order asc;
$function$;

comment on function public.search_provisions_in_document(text, text, integer) is
  'Keyword search inside one document (reg_key), for the reader''s jump box. '
  'websearch_to_tsquery over search_vector, Statements of Basis excluded, '
  'ts_rank order, at most 50 rows (default 10), ts_headline excerpt with '
  '<mark>. SECURITY INVOKER: RLS is the paywall, so a logged-out caller gets '
  'only is_public rows and a locked document returns nothing.';

grant execute on function public.search_provisions_in_document(text, text, integer)
  to anon, authenticated, service_role;
