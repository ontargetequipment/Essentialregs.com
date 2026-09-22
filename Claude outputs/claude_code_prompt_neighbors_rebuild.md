**Claude Code settings for this prompt — Model: Opus · Effort: medium** (run/verify prompt; no code changes, nothing to pull)

# Claude Code prompt — neighbour rebuild after the RPC migration

The owner has just run `RUN_ME_neighbors_rpc_2026-09-21.sql` in the Supabase SQL editor, which adds a wider fallback probe to `recompute_provision_neighbors` for sibling-crowded rows. Also note: three prototype rows from Sept 2 (`cdphe-reg7-general`, `ecmc-rule-604`, `osha-1910-119`) were deleted from the database along with their embeddings and neighbour rows, so expect the corpus at **36,517 provisions**. **Owner-approved spend: none — neighbours only, no Voyage calls.**

1. **Confirm the migration landed.** Check that `recompute_provision_neighbors` now has the `fallback_candidates integer DEFAULT 400` parameter. If it still shows only `candidates integer DEFAULT 40`, stop and report — the migration has not been applied.

2. **Run the Embed workflow with `neighbors_only`** (the adaptive/resumable version). Paste provisions, neighbour rows, batches/halvings.

3. **Verify coverage.** Count provisions with no `provision_neighbors` rows. Before the migration it was a constant 106 (Reg 3 ×78, Reg 6 ×21, ECMC ×4, Reg 21 ×2, Reg 11 ×1). Expect it to drop to **zero or near zero**. List any survivors by id.

4. **Sanity-check one previously starved row**: `sec-3-A-II-A` (or any Reg 3 definition row) should now have 5 neighbours, none of which is its own sibling, parent, ancestor or descendant. Paste its neighbour ids.

Report each step's result in order, then stop.
