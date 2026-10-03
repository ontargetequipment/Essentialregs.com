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
    { day: "2026-09-16", reg_key: "3", change_type: "summary_regenerated", provision_count: 40, latest: "2026-09-16T01:00:00Z" },
    // a cascade-deleted provision has no regulation: grouped under null
    { day: "2026-09-16", reg_key: null, change_type: "text_updated", provision_count: 2, latest: "2026-09-16T03:00:00Z" },
    // the one change type with no customer wording is dropped, not shown raw
    { day: "2026-09-19", reg_key: "7", change_type: "summary_rejected", provision_count: 1, latest: "2026-09-19T01:00:00Z" },
  ]);
  assert.deepEqual(
    lines.map((l) => [l.dateKey, l.regKey, l.textUpdated, l.reviewed, l.corrected, l.regenerated, l.latest]),
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
    { day: "2026-09-14", reg_key: "7", change_type: "summary_regenerated", provision_count: 3, latest: "2026-09-14T01:00:00Z" },
  ]);
  assert.deepEqual(describeLine(reg7), [
    "1,496 provisions updated",
    "1 provision added",
    "201 summaries reviewed (1 corrected)",
    "3 summaries rewritten, awaiting review",
  ]);
});

test("counts arrive as strings from PostgREST bigint and still add up", () => {
  const [line] = foldChangelog([
    { day: "2026-09-14", reg_key: "gp12", change_type: "summary_approved", provision_count: "7" as unknown as number, latest: "2026-09-14T03:00:00Z" },
  ]);
  assert.equal(line.reviewed, 7);
  assert.deepEqual(describeLine(line), ["7 summaries reviewed"]);
});

test("no rows, no lines", () => {
  assert.deepEqual(foldChangelog([]), []);
});
