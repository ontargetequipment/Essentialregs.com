-- Item C of the 2026-09-25 security hygiene PR: keyword search returns NULL as
-- headline for rows whose text is nothing but their own heading.
--
-- 5,784 provisions store only their title (or, for none today, only their
-- citation) as full_text. ts_headline on those returns the heading again,
-- slightly rewritten (tags become spaces, so "Rule 604." comes back as
-- "Rule 604 .", and the fragment can drop leading words), so the result card
-- printed the title line and then nearly the same words as the snippet, and the
-- page-side comparison in src/app/search/page.tsx could not always match it.
-- Decide it here instead: compare the row's plain text with its title and its
-- citation after the same normalisation the app's normalizeCitationLabel
-- applies (tags stripped, &nbsp; and U+00A0 to space, &amp; to &, whitespace
-- collapsed, trimmed) and return NULL instead of calling ts_headline. The app
-- renders a NULL headline as "no snippet" (src/lib/search.ts, SearchHit).
--
-- Everything else is identical to 20260919035558: same signature, same result
-- columns, still SECURITY INVOKER (RLS decides which rows a caller may see;
-- anon gets the four is_public samples), same grants (CREATE OR REPLACE on the
-- same signature keeps them). Do NOT make this function SECURITY DEFINER: it
-- selects full_text straight from provisions and as DEFINER would serve
-- paywalled body text to anon (see 20260923035949).

create or replace function public.search_provisions(q text, lim integer default 25)
returns table (id text, citation text, title text, reg_key text, headline text, rank real, path text)
language sql
stable
set search_path = public
as $$
  with query as (select websearch_to_tsquery('english', q) as tsq),
  hits as (
    select p.id, p.citation, p.title, p.full_text, ts_rank(p.search_vector, query.tsq) as rank
    from provisions p, query
    where p.search_vector @@ query.tsq
    order by rank desc, p.sort_order asc
    limit lim
  ),
  -- Same normalisation as normalizeCitationLabel in src/lib/snippet.ts, applied
  -- to the text (tags removed first) and to the two labels it is compared with.
  plain as (
    select hits.*,
      btrim(regexp_replace(replace(replace(replace(regexp_replace(hits.full_text, '<[^>]*>', '', 'g'), '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_text,
      btrim(regexp_replace(replace(replace(replace(hits.title,    '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_title,
      btrim(regexp_replace(replace(replace(replace(hits.citation, '&nbsp;', ' '), chr(160), ' '), '&amp;', '&'), '\s+', ' ', 'g')) as norm_citation
    from hits
  )
  select plain.id, plain.citation, plain.title,
    substring(plain.id from '^sec-([^-]+)-') as reg_key,
    case
      when plain.norm_text = plain.norm_title or plain.norm_text = plain.norm_citation then null
      else ts_headline('english', regexp_replace(plain.full_text, '<[^>]+>', ' ', 'g'), query.tsq,
             'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1')
    end as headline,
    plain.rank,
    public.provision_path(plain.id) as path
  from plain, query
  order by plain.rank desc;
$$;
