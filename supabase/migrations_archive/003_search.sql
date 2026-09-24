-- 003_search.sql — site-wide full-text search over provisions.
--
-- Apply once in the Supabase SQL Editor (or via the MCP connector) AFTER
-- schema.sql. Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE.
--
-- What this adds:
--   1. provisions.search_vector — a STORED generated tsvector built from
--      citation (weight A), title (B), and full_text with HTML tags stripped
--      (C). Being a generated column, Postgres keeps it in sync on every
--      insert/update; nothing in the app or importer has to maintain it.
--   2. A GIN index on that column so `@@` queries don't scan the table.
--   3. search_provisions(q, lim) — the RPC the /search page calls.
--
-- Cost note: ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS ... STORED
-- rewrites the whole table, computing to_tsvector over ~4,400 rows of
-- regulatory HTML, and takes an ACCESS EXCLUSIVE lock while it does. On this
-- corpus expect seconds, not minutes, but run it at a quiet moment. It's
-- deliberately a single statement so it either fully succeeds or fully
-- rolls back.

-- 1. Generated search vector ------------------------------------------------
-- Every input is wrapped in coalesce so a NULL (none of these columns are
-- nullable today, but coalesce keeps the expression total) can't null out
-- the whole vector. regexp_replace/to_tsvector/setweight are all IMMUTABLE
-- with an explicit 'english' config, which is what a generated column
-- requires.
alter table provisions
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(citation, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(
      to_tsvector(
        'english',
        coalesce(regexp_replace(full_text, '<[^>]+>', ' ', 'g'), '')
      ),
      'C'
    )
  ) stored;

-- 2. Index ------------------------------------------------------------------
create index if not exists provisions_search_vector_idx
  on provisions using gin (search_vector);

-- 3. Search RPC -------------------------------------------------------------
-- SECURITY INVOKER (the default, but spelled out on purpose): the function
-- body runs with the *caller's* privileges, so the existing row-level
-- security policies on provisions apply exactly as they do to a plain
-- SELECT — an anonymous visitor only ever gets is_public rows back, a
-- signed-in user gets everything. No separate access check is needed here,
-- and none should be added that could drift from the policies.
--
-- reg_key is the "{reg}" segment of ids shaped like "sec-{reg}-...", which is
-- what /regulations/{reg} routes on; it's NULL for ids that don't follow
-- that pattern (e.g. the hand-written sample rows), and the app falls back
-- to /regs/{id} for those.
--
-- The headline is computed in an outer query, after ranking and LIMIT, so
-- ts_headline (comparatively expensive) only runs for the rows returned.
create or replace function search_provisions(q text, lim int default 25)
returns table (
  id       text,
  citation text,
  title    text,
  reg_key  text,
  headline text,
  rank     real
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('english', q) as tsq
  ),
  hits as (
    select
      p.id,
      p.citation,
      p.title,
      p.full_text,
      ts_rank(p.search_vector, query.tsq) as rank
    from provisions p, query
    where p.search_vector @@ query.tsq
    order by rank desc, p.sort_order asc
    limit lim
  )
  select
    hits.id,
    hits.citation,
    hits.title,
    substring(hits.id from '^sec-([^-]+)-') as reg_key,
    ts_headline(
      'english',
      regexp_replace(hits.full_text, '<[^>]+>', ' ', 'g'),
      query.tsq,
      'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1'
    ) as headline,
    hits.rank
  from hits, query
  order by hits.rank desc;
$$;

-- PostgREST exposes functions in the public schema to whichever roles can
-- execute them; make the grant explicit so it doesn't depend on defaults.
grant execute on function search_provisions(text, int) to anon, authenticated;
