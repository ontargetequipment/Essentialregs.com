/**
 * The remembered summary panels of the preview pages (src/lib/open-summaries.ts,
 * v3.1, 13 Oct 2026): what is stored, what is read back, and what junk does.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { OPEN_SUMMARIES_KEY, OPEN_SUMMARIES_MAX, parseOpenSummaries, withOpenSummary } from "../src/lib/open-summaries";

test("the key is its own; nothing, junk, and non-ids read as an empty list", () => {
  assert.equal(OPEN_SUMMARIES_KEY, "er:open-summaries");
  for (const raw of [null, undefined, "", "{", "null", "1", '"sec-7-B-I-C-1-a"', "{}", '{"a":1}']) assert.deepEqual(parseOpenSummaries(raw), [], String(raw));
  // Not provision ids: dropped, the rest kept in order, duplicates once.
  assert.deepEqual(
    parseOpenSummaries(JSON.stringify(["sec-7-B-I-C-1-a", 7, "", "javascript:alert(1)", "sec-7-B-I-C-1-a", "sec-gp05-VI-D", "<b>x</b>", null])),
    ["sec-7-B-I-C-1-a", "sec-gp05-VI-D"]
  );
});

test("opening moves a panel to the end, closing removes it, and the list is capped at the newest", () => {
  let ids = withOpenSummary([], "sec-7-B-I-C-1-a", true);
  assert.deepEqual(ids, ["sec-7-B-I-C-1-a"]);
  ids = withOpenSummary(ids, "sec-7-B-I-C-1-c", true);
  ids = withOpenSummary(ids, "sec-7-B-I-C-1-a", true);
  assert.deepEqual(ids, ["sec-7-B-I-C-1-c", "sec-7-B-I-C-1-a"]);
  ids = withOpenSummary(ids, "sec-7-B-I-C-1-c", false);
  assert.deepEqual(ids, ["sec-7-B-I-C-1-a"]);
  assert.deepEqual(withOpenSummary(ids, "sec-7-B-I-D", false), ["sec-7-B-I-C-1-a"], "closing a panel that was not remembered changes nothing");
  // A round trip through storage is the same list.
  assert.deepEqual(parseOpenSummaries(JSON.stringify(ids)), ids);
  // The cap: the oldest go first.
  let many: string[] = [];
  for (let i = 0; i < OPEN_SUMMARIES_MAX + 5; i++) many = withOpenSummary(many, `sec-7-B-I-B-${i}`, true);
  assert.equal(many.length, OPEN_SUMMARIES_MAX);
  assert.equal(many[0], "sec-7-B-I-B-5");
  assert.equal(parseOpenSummaries(JSON.stringify([...many, "sec-7-B-I-B-x"])).length, OPEN_SUMMARIES_MAX);
});
