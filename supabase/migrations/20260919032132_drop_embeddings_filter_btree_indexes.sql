-- Reconciled 2026-09-24. The one part of 008_hybrid_search.sql (now
-- supabase/migrations_archive/) that no recorded migration contains.
--
-- 20260919024603_embeddings_denormalized_filters and
-- 20260919025247_hybrid_search_and_basis_flag both create
-- provision_embeddings_reg_idx and provision_embeddings_juris_idx. Production has
-- neither index, and none of the fifteen recorded versions drops them, so these
-- two statements were run by hand. Everything else in 008 is carried by
-- 20260919024603 / 20260919025247 / 20260919025640 / 20260919025851.
--
-- When it ran: after 20260919025247 (which creates the indexes). The exact time
-- was not recorded; this version number is the UTC time of the commit that added
-- the statements to 008 (e7f13a7, 2026-09-19 03:21:32 UTC), which sorts after
-- 20260919025851 and before 20260919035558. No later migration recreates the
-- indexes, so the final state is the same wherever after 025247 this lands.
--
-- Comment and statements below are verbatim from 008_hybrid_search.sql.
-- ---------------------------------------------------------------------------

-- No btree indexes on reg_key / jurisdiction on purpose: with them the planner
-- prefers "btree + exact-distance sort over every filtered row" (seconds) to the
-- HNSW iterative scan (tens of ms). The columns exist for filtering only.
drop index if exists public.provision_embeddings_reg_idx;
drop index if exists public.provision_embeddings_juris_idx;
