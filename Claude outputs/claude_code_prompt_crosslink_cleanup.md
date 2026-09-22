**Claude Code settings for this prompt — Model: Opus · Effort: medium** (run/verify prompt; no code changes, no push needed)

# Claude Code prompt — cross-link cleanup for Regs 3, 6, 8 and 22

This is the cleanup pass you scoped in `docs/imports/2026-09-21/batch7_crosslink_backlog.md`. Nothing to pull or commit — the importer already produces these anchors; the four documents just need a re-link run. **Owner-approved spend: none — re-links only, no `regenerate_summaries`, no `embed`.**

1. **Rehearse** with `execute=false` for `reg=3`, `6`, `8`, `22`, one at a time (not concurrent — remember cp and Reg 20). Expected, from your own backlog check: Reg 3 → 73 changed rows, Reg 8 → 29, Reg 6 → 15, Reg 22 → 11; 0 new, 0 obsolete, all markup-only, three sanity checks PASS each. Small drift from your earlier counts is fine if every change is still markup-only; if any run shows a non-markup change or new/obsolete rows, stop and paste the diff report.

2. **Execute** each with `execute=true`, no regenerate_summaries, no embed, sequentially.

3. **Verify** at the data level: Reg 3 gains cp ×51, Reg 8 ×22, proc ×19, Reg 6 ×18, Reg 2 ×11, Reg 23 ×8, Reg 1 ×7, Reg 9 ×4, Reg 30 ×3, Reg 24 ×2, Reg 15 ×1, Reg 25 ×1; Reg 8 gains proc ×31; Reg 6 gains proc ×15; Reg 22 gains Reg 27 ×7, proc ×6, cp ×1, Reg 24 ×1, Reg 25 ×1. Paste actual counts.

4. **Close the loop**: append a short "cleanup executed" section to `docs/imports/2026-09-21/batch7_crosslink_backlog.md` with the actual counts and run IDs, commit and push it (that one file only).

5. **Confirm the corpus is fully current**: re-run your parse-vs-database anchor diff across all four documents — expect zero remaining backlog anywhere. Report.

Report each step's result in order, then stop.
