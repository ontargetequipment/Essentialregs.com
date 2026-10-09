-- Test Methods: which provisions cite which EPA test method (9 Oct 2026).
--
-- The importers (pipeline/import_ccr.py, pipeline/import_ecfr.py, through
-- pipeline/method_links.py) link every citation of a method in the Test
-- Methods data file (src/data/test-methods.json) as
--   <a class="xref-method" href="/test-methods/<slug>">Method 21</a>
-- inside provisions.full_text. The public /test-methods/<slug> pages list
-- the provisions that cite each method ("Cited by"). Scanning full_text for
-- the anchors on every page view would be a sequential read of the whole
-- corpus, so the apply step writes one row per (provision, method) here
-- from the anchors in the final text (import_ccr.write_method_citation_rows:
-- delete the document's rows, insert the new ones, on every executed
-- import or re-link), and the page makes one indexed read.
--
-- Why a new table and not public.cross_references with target_type
-- 'method': the importers do not maintain cross_references. Its 4,672
-- 'internal' rows date from the original upload and no code path in
-- pipeline/ writes it (the reader's citation popups read the xref spans in
-- full_text, not this table), so new rows there would sit beside a legacy
-- set nobody refreshes and would inherit its is_public-only read policy.
-- This table is written on every import and has its own, public, read.
--
-- Readable by everyone: the rows are navigation (a provision id, its
-- regulation's key inside the id, the slug, the printed citation text such
-- as "Method 21"), never provision text, and the Test Methods pages are
-- free. The citing provision itself stays behind the provisions policies;
-- a staged (unreleased) document's rows are hidden the same way its
-- provisions are (reg_is_released: recorded in schema_migrations as
-- 20261008031550 and 20261008031623, the connector's versions of the
-- release-state change the file 20261008040000_regulation_release_state.sql
-- replays). service_role (the pipeline) is the only writer.
--
-- Applied to the live project on 9 Oct 2026 by the CEO chat through the
-- Supabase connector and recorded in supabase_migrations.schema_migrations
-- under this file's version, 20261009005000. The corpus re-link that fills
-- the table is a separate job after that.

create table if not exists public.provision_method_citations (
  provision_id text not null references public.provisions(id) on delete cascade,
  method_slug  text not null check (method_slug ~ '^(method-[0-9]+[a-z]?|ps-[0-9]+)$'),
  raw_text     text not null,
  created_at   timestamptz not null default now(),
  primary key (provision_id, method_slug)
);
comment on table public.provision_method_citations is
  'One row per (provision, EPA test method) the provision''s text links (<a class="xref-method" href="/test-methods/<slug>">). raw_text is the citation as printed ("EPA Method 21"). Rewritten per document by pipeline/import_ccr.py apply --execute from the anchors in full_text; read by the public /test-methods/<slug> pages ("Cited by"). Navigation only: ids and the printed citation, never provision text.';

-- "All provisions citing slug X" is one index range scan; the primary key
-- covers the per-provision rewrite the importer does.
create index if not exists provision_method_citations_slug_idx
  on public.provision_method_citations (method_slug, provision_id);

alter table public.provision_method_citations enable row level security;

revoke all on table public.provision_method_citations from public, anon, authenticated;
grant select on table public.provision_method_citations to anon, authenticated;
grant select, insert, update, delete on table public.provision_method_citations to service_role;

-- Everyone may read the citation rows of a released document. The policy
-- carries the release gate so a staged document's provision ids are not
-- enumerable through this table before the document is public.
drop policy if exists "anyone can read method citations of released documents" on public.provision_method_citations;
create policy "anyone can read method citations of released documents"
  on public.provision_method_citations for select
  to anon, authenticated
  using (public.reg_is_released(split_part(provision_id, '-', 2)));

-- No insert/update/delete policy: service_role bypasses RLS and is the
-- only role with those grants, so nothing else can write.
