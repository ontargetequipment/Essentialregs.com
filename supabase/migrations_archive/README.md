# supabase/migrations_archive

Files that used to live in `supabase/migrations/` and no longer describe how the
production database was built. Nothing here is applied by anything. Each file is kept
verbatim for history; the table says what it was and which timestamped file in
`supabase/migrations/` now represents it.

## Why the folder was reconciled (2026-09-24)

`supabase/migrations/` held numbered files `002`-`011`, three `RUN_ME_*.sql` files that
were pasted into the Supabase SQL editor, one timestamped file, and no `001`, while the
database's own history (`supabase_migrations.schema_migrations`) was fifteen timestamped
versions. The two records did not correspond, so nobody could see that
`011_security_grants.sql` (hand-run) revoked a grant that recorded version
`20260919035558` depended on; keyword search and breadcrumbs were down until
`20260923035949` re-granted it. The folder was rebuilt so that every recorded version is
a file, every hand-run file is a timestamped version in its true position (and recorded
in `schema_migrations`), and a replay in filename order ends in the production state
rather than the outage.

## Mapping

Classification key. **Recorded**: the file's content is one of the fifteen recorded
versions. **Hand-run, not recorded**: applied through the SQL editor or connector,
never entered `schema_migrations` until 2026-09-24. **Partially recorded**: some
statements recorded, some hand-run. No file was found to be **never applied**.

| Archived file | Classification | What was checked | Now represented by |
|---|---|---|---|
| `002_subscriptions.sql` | Hand-run, not recorded. Applied as part of `RUN_ME_in_Supabase_SQL_Editor.sql`, not on its own: the `comment on column profiles.subscription_status` that only 002 carries is absent in production. | Six `profiles` columns, `profiles_stripe_customer_id_key`, the two `subscribers can read all ...` policies (production quals use this file's `(select auth.uid())` form) all present. | `20260913000000_subscriptions_and_keyword_search.sql` |
| `003_search.sql` | Hand-run, not recorded. Same bundle as 002. | `provisions.search_vector` (generated, stored) and `provisions_search_vector_idx` present. Its `search_provisions()` body was later replaced by the recorded `20260919035558`, which is why production's body differs from this file. | `20260913000000_subscriptions_and_keyword_search.sql`; superseded by `20260919035558_provision_path_on_search_results.sql` |
| `004_review.sql` | Hand-run, not recorded. Statement-for-statement identical to `RUN_ME_2` (only the banner differs). | Four review columns, `provisions_summary_status_check`, both column comments, `provision_changes` + policy + index, trigger `provisions_log_text_updated`; `log_provision_text_updated()` body matches modulo whitespace (production has CRLF line endings from the paste). | `20260913000100_review_queue_and_changelog.sql` |
| `005_embeddings.sql` | Recorded, as `20260918035710`. Two `revoke ... from public, anon;` lines in this file read `... from public;` in the recorded text; otherwise identical. | md5 after that substitution equals the recorded statements. | `20260918035710_embeddings_and_semantic_search.sql` |
| `006_neighbors_rpc.sql` | Recorded, as `20260918040936`. Byte-identical. | md5 match. The three-argument function it creates was replaced on 2026-09-21 (see the note on the neighbours RPC below). | `20260918040936_neighbors_rpc.sql`; superseded by `20260921185135_neighbors_rpc_fallback_probe.sql` |
| `007_search_queries.sql` | Recorded, as `20260919012823`. Same statements; the recorded text has no comment lines. | Statement text identical; `has_full_access()` and `search_queries_recent_count()` bodies match production. | `20260919012823_search_queries_and_service_role_access.sql` |
| `008_hybrid_search.sql` | **Partially recorded.** Columns, `is_basis_provision`, `provision_embeddings_fill_meta`, trigger, backfill, `match_provisions`, `match_provisions_hybrid` are recorded across `20260919024603`, `20260919025247`, `20260919025640`, `20260919025851`. The two `drop index if exists` statements (`provision_embeddings_reg_idx`, `provision_embeddings_juris_idx`) are in no recorded version, and production has neither index, so they were run by hand. | Index absence confirmed in `pg_indexes`; function bodies match production (`match_provisions` from 025851, then 035558). | `20260919024603`, `20260919025247`, `20260919025640`, `20260919025851` (recorded parts); `20260919032132_drop_embeddings_filter_btree_indexes.sql` (hand-run remainder) |
| `009_provision_path.sql` | Recorded, as `20260919035558`. Byte-identical. | md5 match; `search_provisions`, `context_path`, `match_provisions` bodies match production. `provision_path` was later replaced by `20260923035949`. | `20260919035558_provision_path_on_search_results.sql` |
| `010_keyword_query.sql` | Recorded, as `20260919041700`. Byte-identical. | md5 match; `match_provisions_hybrid` body matches production. | `20260919041700_hybrid_keyword_query_and_normalised_rank.sql` |
| `011_security_grants.sql` | Hand-run, not recorded. The file whose `provision_path` revoke caused the outage. | `recompute_provision_neighbors(...4 args)` EXECUTE held by `service_role` only; `is_basis_provision(text)` has `search_path = public`; `provision_path` grants are the later fix's. All three effects present. | `20260922030526_security_grants.sql` (verbatim minus the `begin;`/`commit;` wrapper) |
| `RUN_ME_in_Supabase_SQL_Editor.sql` | Hand-run, not recorded. Bundle of 002 + 003 as actually pasted. | See 002 and 003. | `20260913000000_subscriptions_and_keyword_search.sql` |
| `RUN_ME_2_review_queue_in_Supabase_SQL_Editor.sql` | Hand-run, not recorded. Copy of 004 as actually pasted. | See 004. | `20260913000100_review_queue_and_changelog.sql` |
| `RUN_ME_3_source_urls_in_Supabase_SQL_Editor.sql` | Hand-run, not recorded. Data only (four `UPDATE`s). | The four root rows carry exactly these `source_url` values. | `20260914000000_regulation_source_urls.sql` |

Two related files were **not** archived:

- `docs/imports/2026-09-21/RUN_ME_neighbors_rpc_2026-09-21.sql` was never in
  `supabase/migrations/` but was hand-run on 2026-09-21 and is what production's
  four-argument `recompute_provision_neighbors` came from. It stays in the import record
  and is now also `supabase/migrations/20260921185135_neighbors_rpc_fallback_probe.sql`.
  Without it, replaying `011` fails (it revokes on the four-argument signature).
- `supabase/schema.sql`, the "001" the numbered series never had, matches the first
  three recorded versions (`20260902021254`, `20260909235329`, `20260910014122`) and
  is left in place for reference.

## Dating the hand-run files

The repository's history begins on 2026-09-18, after most of these were applied, so
their timestamps come from bounds rather than clocks. `docs/CEO_PHASE_PLAN.md` ("Status
as of Sep 13 2026") records 002, 003 and 004 as applied, and `20260910014122` is the
recorded version whose policy the subscriptions bundle drops, so those two land on
2026-09-13. `docs/CEO_Brief_2026-09-14.md` records the source-URL update as a
same-day change on 2026-09-14. The neighbours RPC and `011` are dated by the UTC time
their files entered git (2026-09-21 18:51 and 2026-09-22 03:05); `011` refers to the
RPC's by-hand fix "on 2026-09-21" and predates the 2026-09-23 03:59 UTC fix. The drop
of the two btree indexes is dated by the commit that added the statements to 008
(2026-09-19 03:21 UTC), after the recorded version that created them.
