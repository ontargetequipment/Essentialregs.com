# Handoff to Claude Code: trust fixes + Sprint 2 (Oct 3 2026)

Two patch files sit beside this brief in `Claude outputs/` (gitignored). The Cowork session could read the repo but not push to it, so Code does the git.

## 1. `third-review-trust-fixes.patch` (2 commits)

`git checkout -b claude/third-review-trust-fixes origin/main && git am "Claude outputs/third-review-trust-fixes.patch"`

Push, open a PR titled **"Third review, day-one trust fixes"**, merge once CI is green. Migration `20261003160524_changelog_public_rpc.sql` is ALREADY APPLIED in production (it shows there as version 20261003160551); do not re-apply. Checked in Cowork on this exact tree: lint clean, typecheck clean, `npm test` 123 pass / 1 skipped.

## 2. `sprint2-navigation-provenance.patch` (6 commits, stacked on #1)

`git checkout -b claude/sprint2-navigation-provenance claude/third-review-trust-fixes && git am "Claude outputs/sprint2-navigation-provenance.patch"`

(After #1 merges, branching from `origin/main` works the same.) Push, open a PR titled **"Sprint 2: cross-regulation deep links, reader navigation, exact official sources"**, merge once CI is green. Checked in Cowork on this exact tree: lint clean, typecheck clean, `npm test` 161 pass / 1 skipped, `python -m pytest pipeline` 1364 passed / 29 skipped. `npm run build` was not run (no Google Fonts access in that sandbox), so CI is the first build of the new route `src/app/api/provision/[id]/route.ts`.

Commits: importer deep links (with `pipeline/out/corpus_ids.json`, about 1 MB); exact Secretary of State source links; general-permit document links (its own commit so it can be reverted alone); reader navigation; reader follow-up (GP label, card links with hashes); CEO plan status.

## 3. After the Sprint 2 PR merges

1. Run the **Import** workflow with `execute` checked and `regenerate_summaries` unchecked, once per regulation: gp01, gp02, gp03, gp05, gp06, gp07, gp08, gp09, gp10, gp11, gp12, 3, 7, 26. Dry-run one first (gp01) and compare its diff report with `pipeline/out/sprint2_link_changes.md`: the only changes should be link markup in the rows that file lists (34 rows for gp01), text otherwise identical. If a run shows text changes or summary regeneration, stop and report. Then the other regulations the report lists with changed rows: 1, 6, 8, 9, 22, 23, 24, 25, 27, 30, 31, aqs, cp.
2. The new workflow step `dump-ids` has only been tested against a mocked client. If it fails in CI, the committed `pipeline/out/corpus_ids.json` matches production today (md5-checked per regulation), so parse can fall back to it.
3. Do NOT apply `supabase/migrations/RUN_ME_20261003_exact_source_urls.sql`. The Cowork session applies it through the Supabase connector once Brody confirms.
4. On the Vercel preview, as a subscriber: in GP12 click a "Regulation Number 7, Part B, Section …" link (preview popup, then "Open in Regulation 7", then the "← Back to GP12 · …" bar); type in the jump box and use arrows, Enter and Escape. This was only tested in jsdom.
