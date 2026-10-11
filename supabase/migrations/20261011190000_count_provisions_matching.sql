-- How many provisions of the whole library match a keyword search. 11 Oct 2026.
--
-- Why: a logged-out visitor's keyword search reads only the is_public rows
-- (GP05 and a handful of sample rows). A search for "Method 21" or
-- "dehydrator" finds nothing there although the full library has dozens of
-- matches, and "No results" tells the visitor the library cannot help them.
-- The page now says how many provisions the full library has for the same
-- words ("No matches in GP05. The full library has N provisions matching ...")
-- so the visitor can judge whether a trial is worth it.
--
-- What this is: a count-only SECURITY DEFINER read. It runs as its owner, so
-- it sees rows the caller's row-level security hides, and it returns ONE
-- INTEGER: no id, no citation, no title, no text, no headline, no rank. A
-- visitor learns the size of the match without seeing, or being able to
-- derive, anything that is locked. (A bare count still tells a caller whether
-- some word occurs somewhere in the locked text; that is the whole feature,
-- and it is why the function takes no document argument and returns no
-- breakdown by regulation.)
--
-- The match is the one search_provisions uses (20261008013528): the
-- generated provisions.search_vector against websearch_to_tsquery('english',
-- q), so "or", "-word" and "quoted phrases" behave the same and "sampling"
-- also finds "sample". The same defaults apply: Statements of Basis (the
-- rulemaking history is_basis_provision() recognises) are not counted, as the
-- keyword page hides them unless asked. A document staged for release
-- (regulation_releases, 20261008040000) is not counted either: reg_is_released()
-- is the test the subscribers' read policy applies, so the count never names a
-- document no subscriber can open yet. The input is trimmed and cut to 200
-- characters, the length the app passes to search (MAX_QUERY_LENGTH in
-- src/lib/search.ts); an empty or stop-word-only query has no lexemes and
-- counts 0.
--
-- search_path is pinned to public like the other SECURITY DEFINER functions
-- here (reg_is_released, changelog_public). Execute is revoked from public
-- and granted to the two API roles and the service role, as changelog_public()
-- is.
--
-- New object, CREATE OR REPLACE only: the Supabase connector holds any
-- statement that removes an object, so this file has none.

create or replace function public.count_provisions_matching(q text)
 returns integer
 language sql
 stable
 security definer
 set search_path = public
as $function$
  with query as (
    select websearch_to_tsquery('english', left(btrim(coalesce(q, '')), 200)) as tsq
  )
  select count(*)::integer
  from public.provisions p, query
  where p.search_vector @@ query.tsq
    and not public.is_basis_provision(p.id)
    and public.reg_is_released(p.reg_key);
$function$;

comment on function public.count_provisions_matching(text) is
  'Count-only keyword match over the whole released library. Same predicate as search_provisions (search_vector @@ websearch_to_tsquery(english, q), Statements of Basis excluded) plus the staged-document exclusion; input trimmed and cut to 200 characters. Returns one integer and nothing else: SECURITY DEFINER so a logged-out visitor can learn how many provisions match without seeing any locked row.';

revoke all on function public.count_provisions_matching(text) from public;
grant execute on function public.count_provisions_matching(text) to anon, authenticated, service_role;
