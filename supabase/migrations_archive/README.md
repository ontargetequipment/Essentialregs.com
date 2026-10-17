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

## The 2026-10-17 reconciliation (before the BLM import)

On 2026-10-17 `supabase/migrations/` had 68 timestamped files against 73 rows: five
files with no row and ten rows with no file, all from 3-10 Oct. Most of the gap was one
pattern: the connector's `apply_migration` records a change under its own timestamp,
while the file had been committed under the version it was planned with. The recorded
versions now have files holding their stored statements verbatim (each begins
"regenerated 2026-10-17 from schema_migrations.statements"); the files below, which
were never anyone's row, were moved here unchanged. None of them is applied by anything.

| Archived file | What it was | What was checked | Now represented by |
|---|---|---|---|
| `20261003160524_changelog_public_rpc.sql` | Renamed copy. Applied by `apply_migration` and recorded as `20261003160551`. | The row's stored statements equal this file's SQL once comments and whitespace are set aside. | `20261003160551_changelog_public_rpc.sql` |
| `20261007120000_changelog_regulatory_changes_only.sql` | Renamed copy, recorded as `20261008000816`. The stored text names this file as the "repository copy" with the full commentary, which is why it is kept. | Stored statements equal this file's SQL, comments aside. | `20261008000816_changelog_regulatory_changes_only.sql` |
| `20261007121000_changelog_snapshot.sql` | Renamed copy, recorded as `20261008000836`; the stored text names this file the same way. | Stored statements equal this file's SQL, comments aside. | `20261008000836_changelog_snapshot.sql` |
| `20261008040000_regulation_release_state.sql` | Consolidated replay copy of a change applied in six pieces on 8 Oct 2026 (its own note says so). **Not** a faithful record: it uses DROP/CREATE POLICY where production ran ALTER POLICY, and its three `revoke` statements on `regulation_releases` and `reg_is_released(text)` were never run (production's ACLs still carry the defaults; reported in the PR). Recording it would replay the whole change a second time after its pieces. | Five pieces are recorded with statements (031550 table and function, 031623 policies, 031858 changelog, 032004 `match_provisions`, 032118 `match_provisions_hybrid`, whose stored text is this file's function byte for byte). The seed `insert` was run by hand: 58 rows with its note and one `released_at`, 2026-10-08 03:16:09 UTC. | `20261008031550`, `20261008031609_regulation_release_state_seed.sql` (the seed, recorded by `docs/imports/2026-10-16/RUN_ME_20261017035000_migration_ledger_record.sql`), `20261008031623`, `20261008031858`, `20261008032004`, `20261008032118` |
| `20261007010000_changelog_rewritten_and_reviewed.sql` | The twin's former text. Applied once, recorded twice: `20261007011846` by `apply_migration` with statements, and `20261007010000` inserted by hand with none (docs/CEO_PHASE_PLAN.md, "Migration records"). | Stored statements of `20261007011846` equal this file's SQL, comments aside. | `20261007011846_changelog_rewritten_and_reviewed.sql` (the SQL); `supabase/migrations/20261007010000_...` is now the comment-only duplicate note |
| `20261007020000_keyword_search_closed_permits_and_applicability.sql` | The twin's former text: recorded as `20261007011936` (with statements) and `20261007020000` (none). | Stored statements of `20261007011936` equal this file's SQL, comments aside. | `20261007011936_keyword_search_closed_permits_and_applicability.sql` (the SQL); `supabase/migrations/20261007020000_...` is the duplicate note |

`20261010120000_gp05_public_sample.sql` had no row either, but it was applied (all 111
GP05 rows are `is_public`) and stays in `supabase/migrations/`; the same RUN_ME file
records it. No file was found to be never applied.
