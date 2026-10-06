/**
 * Public summary gate (ReviewBuiltIn, owner decision 5 Oct 2026): a
 * regulation's summaries are not shown on the public sample or preview
 * pages until its review run has finished. Two pure helpers carry the rule:
 * teaserSummariesVisible (the /regulations/[reg]/preview teaser) and
 * gatePublicSummaries (the /sample cards).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { gatePublicSummaries, teaserSummariesVisible } from "../src/lib/regulation-pure";

test("teaser summaries are visible only when nothing of the regulation is pending review", () => {
  assert.equal(teaserSummariesVisible(0), true);
  assert.equal(teaserSummariesVisible(1), false);
  assert.equal(teaserSummariesVisible(250), false);
});

test("sample cards lose their summary while the regulation's review run is unfinished or the row is not reviewed", () => {
  const rows = [
    { id: "sec-7-B-I-D-3-a-(i)", ai_summary: "Tanks must be controlled.", summary_status: "approved" },
    { id: "sec-gp02-II-A-2", ai_summary: "Facility-wide limits.", summary_status: "edited" },
    { id: "sec-ecmc-604-a-(1)", ai_summary: "Well locations.", summary_status: "pending" },
    { id: "sec-cp-I-G-90", ai_summary: "Potential to emit.", summary_status: "approved" },
  ];
  const pending = new Map<string, number>([
    ["7", 0],
    ["gp02", 3], // GP02's chained run has not finished: hide its summary
    ["ecmc", 0],
    ["cp", 0],
  ]);
  const gated = gatePublicSummaries(rows, pending);
  assert.equal(gated[0].ai_summary, "Tanks must be controlled.");
  assert.equal(gated[1].ai_summary, null, "regulation still under review");
  assert.equal(gated[2].ai_summary, null, "row itself is pending");
  assert.equal(gated[3].ai_summary, "Potential to emit.");
  // nothing else changes, and the input is not mutated
  assert.equal(gated[1].id, "sec-gp02-II-A-2");
  assert.equal(rows[1].ai_summary, "Facility-wide limits.");
});

test("a regulation with no count on record is treated as finished", () => {
  const gated = gatePublicSummaries(
    [{ id: "sec-7-B-I-D-3-a-(i)", ai_summary: "x", summary_status: "approved" }],
    new Map()
  );
  assert.equal(gated[0].ai_summary, "x");
});
