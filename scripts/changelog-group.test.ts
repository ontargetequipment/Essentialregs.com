/**
 * /changelog folds changelog_public()'s count rows (one per day, regulation
 * and change type) into one line per regulation per day, with customer
 * wording (src/lib/changelog-group.ts). Pure grouping, no database.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { describeLine, foldChangelog } from "../src/lib/changelog-group";

test("one line per regulation per day, newest first, change types folded in", () => {
  const lines = foldChangelog([
    { day: "2026-09-14", reg_key: "7", change_type: "text_updated", provision_count: 1496, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_approved", provision_count: 200, latest: "2026-09-14T03:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_edited", provision_count: 12, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-16", reg_key: "3", change_type: "summary_rewritten_pending", provision_count: 40, latest: "2026-09-16T01:00:00Z" },
    // a cascade-deleted provision has no regulation: grouped under null
    { day: "2026-09-16", reg_key: null, change_type: "text_updated", provision_count: 2, latest: "2026-09-16T03:00:00Z" },
    // the one change type with no customer wording is dropped, not shown raw
    { day: "2026-09-19", reg_key: "7", change_type: "summary_rejected", provision_count: 1, latest: "2026-09-19T01:00:00Z" },
  ]);
  assert.deepEqual(
    lines.map((l) => [l.dateKey, l.regKey, l.textUpdated, l.reviewed, l.corrected, l.rewrittenPending, l.latest]),
    [
      ["2026-09-16", null, 2, 0, 0, 0, "2026-09-16T03:00:00Z"],
      ["2026-09-16", "3", 0, 0, 0, 40, "2026-09-16T01:00:00Z"],
      ["2026-09-14", "7", 1496, 212, 12, 0, "2026-09-14T03:00:00Z"],
    ]
  );
});

test("wording: text first, then summaries; corrected shown inside reviewed", () => {
  const [reg7] = foldChangelog([
    { day: "2026-09-14", reg_key: "7", change_type: "text_updated", provision_count: 1496, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_approved", provision_count: 200, latest: "2026-09-14T03:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_edited", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "added", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 3, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "removed", provision_count: 2, latest: "2026-09-14T01:00:00Z" },
  ]);
  assert.deepEqual(describeLine(reg7), [
    "1,496 provisions updated",
    "1 provision added",
    "2 provisions removed",
    "201 summaries AI reviewed (1 corrected)",
    "3 summaries rewritten, awaiting AI review",
  ]);
});

test("a rewrite reviewed in the same run is one statement (GP03, 6 Oct 2026)", () => {
  // Production before migration 20261007010000: changelog_public() returned
  // summary_regenerated 5, summary_approved 4 and summary_edited 1 for GP03
  // on 2026-10-06 (the chained run rewrote five summaries at 14:54 and
  // reviewed them at 15:01), and the page read "5 summaries AI reviewed (1
  // corrected) · 5 summaries rewritten, awaiting AI review" -- the same five
  // summaries twice, and "awaiting" for summaries that were not. The
  // function now pairs them; the page says it once.
  const [gp03] = foldChangelog([
    { day: "2026-10-06", reg_key: "gp03", change_type: "summary_rewritten_reviewed", provision_count: 4, latest: "2026-10-06T15:01:16Z" },
    { day: "2026-10-06", reg_key: "gp03", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-10-06T15:01:16Z" },
  ]);
  assert.deepEqual(describeLine(gp03), ["5 summaries rewritten and AI reviewed (1 corrected)"]);

  // Rewrites with no review within a day: pending ones say so; one reviewed
  // days later is not "awaiting" (its review is counted on its own day).
  const [mixed] = foldChangelog([
    { day: "2026-10-02", reg_key: "7", change_type: "summary_rewritten_reviewed_later", provision_count: 1, latest: "2026-10-03T03:49:43Z" },
    { day: "2026-10-02", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 2, latest: "2026-10-03T03:49:43Z" },
    { day: "2026-10-02", reg_key: "7", change_type: "summary_approved", provision_count: 3, latest: "2026-10-03T03:49:43Z" },
  ]);
  assert.deepEqual(describeLine(mixed), [
    "3 summaries AI reviewed",
    "1 summary rewritten (AI reviewed later)",
    "2 summaries rewritten, awaiting AI review",
  ]);
  // No corrected count when every paired review passed.
  const [plain] = foldChangelog([
    { day: "2026-10-06", reg_key: "1", change_type: "summary_rewritten_reviewed", provision_count: 1, latest: "2026-10-06T15:01:04Z" },
  ]);
  assert.deepEqual(describeLine(plain), ["1 summary rewritten and AI reviewed"]);
  // The pre-migration shape still folds, as pending.
  const [legacy] = foldChangelog([
    { day: "2026-09-16", reg_key: "3", change_type: "summary_regenerated", provision_count: 40, latest: "2026-09-16T01:00:00Z" },
  ]);
  assert.deepEqual(describeLine(legacy), ["40 summaries rewritten, awaiting AI review"]);
});

test("a markup-only re-import is 'links added or updated', not 'provisions updated' (7 Oct 2026)", () => {
  // Regulation 7's markup-only re-import after PR #69 logged 22 rows; the
  // trigger now logs them as links_updated (migration 20261007040000) and
  // the page must not call them official-text updates.
  const [reg7] = foldChangelog([
    { day: "2026-10-06", reg_key: "7", change_type: "links_updated", provision_count: 22, latest: "2026-10-07T01:39:30Z" },
  ]);
  assert.equal(reg7.linksUpdated, 22);
  assert.deepEqual(describeLine(reg7), ["links added or updated in 22 provisions"]);
  const [one] = foldChangelog([
    { day: "2026-10-06", reg_key: "gp08", change_type: "links_updated", provision_count: 1, latest: "2026-10-07T01:36:03Z" },
    { day: "2026-10-06", reg_key: "gp08", change_type: "text_updated", provision_count: 3, latest: "2026-10-07T01:36:03Z" },
  ]);
  assert.deepEqual(describeLine(one), ["3 provisions updated", "links added or updated in 1 provision"]);
});

test("when every logged review was a correction the line says so, not 'AI reviewed (N corrected)' (7 Oct 2026)", () => {
  // Passes are not logged as changes (pipeline/README.md: a pass writes no
  // provision_changes row), so "98 summaries AI reviewed (98 corrected)"
  // read as if every reviewed summary was wrong.
  const [all] = foldChangelog([
    { day: "2026-10-05", reg_key: "21", change_type: "summary_edited", provision_count: 98, latest: "2026-10-05T03:58:00Z" },
  ]);
  assert.deepEqual(describeLine(all), ["98 summaries corrected on AI review"]);
  const [single] = foldChangelog([
    { day: "2026-10-05", reg_key: "p196", change_type: "summary_edited", provision_count: 1, latest: "2026-10-05T03:55:27Z" },
  ]);
  assert.deepEqual(describeLine(single), ["1 summary corrected on AI review"]);
  // A mix still shows the corrected count inside the reviewed count.
  const [mix] = foldChangelog([
    { day: "2026-10-05", reg_key: "3", change_type: "summary_approved", provision_count: 3, latest: "2026-10-05T04:56:53Z" },
    { day: "2026-10-05", reg_key: "3", change_type: "summary_edited", provision_count: 97, latest: "2026-10-05T04:56:53Z" },
  ]);
  assert.deepEqual(describeLine(mix), ["100 summaries AI reviewed (97 corrected)"]);
  // Same rule for rewrites reviewed in the same run.
  const [rewrites] = foldChangelog([
    { day: "2026-10-06", reg_key: "11", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-10-06T15:01:05Z" },
  ]);
  assert.deepEqual(describeLine(rewrites), ["1 summary rewritten and corrected on AI review"]);
});

test("the removal of Regulation 26's Subpart JJJJ copy reads as one plain line (4 Oct 2026)", () => {
  // The migration logs one 'removed' row per removed provision against the
  // surviving Part C root; changelog_public() counts them by row.
  const [line] = foldChangelog([
    { day: "2026-10-04", reg_key: "26", change_type: "removed", provision_count: 20, latest: "2026-10-04T20:00:00Z" },
  ]);
  assert.equal(line.regKey, "26");
  assert.deepEqual(describeLine(line), ["20 provisions removed"]);
});

test("no changelog phrase says a summary was 'reviewed' without 'AI' (owner decision, 4 Oct 2026)", () => {
  const lines = foldChangelog([
    { day: "2026-09-14", reg_key: "7", change_type: "text_updated", provision_count: 5, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "links_updated", provision_count: 2, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "added", provision_count: 1, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "removed", provision_count: 1, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_approved", provision_count: 1, latest: "2026-09-14T03:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_edited", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_reviewed", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_reviewed_later", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
  ]);
  for (const phrase of lines.flatMap(describeLine)) {
    // "reviewed"/"review" only ever directly after "AI".
    assert.doesNotMatch(phrase, /(?<!AI )\breview(ed)?\b/, phrase);
    assert.doesNotMatch(phrase, /^Reviewed\b/, phrase);
  }
});

test("counts arrive as strings from PostgREST bigint and still add up", () => {
  const [line] = foldChangelog([
    { day: "2026-09-14", reg_key: "gp12", change_type: "summary_approved", provision_count: "7" as unknown as number, latest: "2026-09-14T03:00:00Z" },
  ]);
  assert.equal(line.reviewed, 7);
  assert.deepEqual(describeLine(line), ["7 summaries AI reviewed"]);
});

test("no rows, no lines", () => {
  assert.deepEqual(foldChangelog([]), []);
});
