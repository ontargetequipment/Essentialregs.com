/**
 * The jurisdiction badge on Ask, keyword and related-provision cards follows
 * the document, not the row (src/lib/semantic.ts). Regulation 26 Part C
 * carries 40 CFR 60 Subpart JJJJ text incorporated by reference, stored
 * with jurisdiction_level 'federal'; a reviewer saw one of those rows
 * badged "Federal" beside "Regulation 26" and called it a provenance error.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isIncorporatedFederal, regBadge } from "../src/lib/regulation-names";

test("a row inside a Colorado regulation is Colorado even when stored as federal text", () => {
  assert.equal(regBadge("26", "federal"), "Colorado");
  assert.equal(regBadge("26", "state"), "Colorado");
  assert.equal(regBadge("gp12", "state"), "Colorado");
  assert.equal(regBadge("ecmc", "state"), "ECMC");
});

test("federal documents stay Federal whatever the row says", () => {
  assert.equal(regBadge("jjjj", "federal"), "Federal");
  assert.equal(regBadge("oooob", "state"), "Federal");
  assert.equal(regBadge("p192", "federal"), "Federal");
});

test("with no regulation the row's own jurisdiction decides", () => {
  assert.equal(regBadge(null, "federal"), "Federal");
  assert.equal(regBadge(null, "state"), "Colorado");
});

test("only federal text inside a Colorado document is flagged as incorporated", () => {
  assert.equal(isIncorporatedFederal("26", "federal"), true);
  assert.equal(isIncorporatedFederal("26", "state"), false);
  assert.equal(isIncorporatedFederal("jjjj", "federal"), false);
  assert.equal(isIncorporatedFederal(null, "federal"), false);
});
