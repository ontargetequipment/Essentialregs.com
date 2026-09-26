/**
 * /changelog folds the importer's per-provision `text_updated` rows into one
 * line per regulation per day (src/lib/changelog-group.ts). Pure grouping,
 * no database.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { groupTextUpdates } from "../src/lib/changelog-group";

const day = (iso: string) => iso.slice(0, 10);

test("one group per regulation per day, newest first, counting distinct provisions", () => {
  const groups = groupTextUpdates(
    [
      { provision_id: "sec-7-B-I-D-3-a-(i)", created_at: "2026-09-14T01:00:00Z" },
      { provision_id: "sec-7-B-I-D-3-a-(ii)", created_at: "2026-09-14T01:00:01Z" },
      // the same provision touched twice on the same day counts once
      { provision_id: "sec-7-B-I-D-3-a-(i)", created_at: "2026-09-14T02:00:00Z" },
      { provision_id: "sec-3-A-I", created_at: "2026-09-16T01:00:00Z" },
      { provision_id: "sec-3-A-II", created_at: "2026-09-16T01:00:00Z" },
      // a different day for the same regulation is its own line
      { provision_id: "sec-7-A-I", created_at: "2026-09-19T01:00:00Z" },
      // a cascade-deleted provision has no id: still counted, grouped under null
      { provision_id: null, created_at: "2026-09-16T03:00:00Z" },
      { provision_id: null, created_at: "2026-09-16T03:00:01Z" },
    ],
    day
  );
  assert.deepEqual(
    groups.map((g) => [g.dateKey, g.regKey, g.provisionCount, g.latest]),
    [
      ["2026-09-19", "7", 1, "2026-09-19T01:00:00Z"],
      ["2026-09-16", null, 2, "2026-09-16T03:00:01Z"],
      ["2026-09-16", "3", 2, "2026-09-16T01:00:00Z"],
      ["2026-09-14", "7", 2, "2026-09-14T02:00:00Z"],
    ]
  );
});

test("no rows, no groups", () => {
  assert.deepEqual(groupTextUpdates([], day), []);
});
