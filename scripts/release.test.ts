/**
 * Staged release state (regulation_releases, migration 20261008040000):
 * the app's service-role reads drop a staged document through
 * filterReleased (src/lib/regulation-pure.ts), the pure half of
 * src/lib/release.ts. The database side (RLS, the Ask functions) is
 * exercised by scripts/corpus_qa.sql in CI.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { filterReleased } from "../src/lib/regulation-pure";

const ROOTS = [
  { id: "sec-7-top-REG-7", citation: "REGULATION NUMBER 7" },
  { id: "sec-oooo-top-REG-oooo", citation: "40 CFR Part 60 Subpart OOOO" },
  { id: "sec-ooooa-top-REG-ooooa", citation: "40 CFR Part 60 Subpart OOOOa" },
  { id: "sec-gp12-top-REG-gp12", citation: "GP12" },
];

test("no staged documents: every row passes, same array", () => {
  assert.equal(filterReleased(ROOTS, new Set()), ROOTS);
});

test("a staged document's rows are dropped by reg key, nothing else", () => {
  const out = filterReleased(ROOTS, new Set(["oooo"]));
  assert.deepEqual(
    out.map((r) => r.id),
    ["sec-7-top-REG-7", "sec-ooooa-top-REG-ooooa", "sec-gp12-top-REG-gp12"]
  );
});

test("the reg key is the second dash field: 'oooo' does not hide 'ooooa', and section rows are dropped with their root", () => {
  const rows = [
    { id: "sec-oooo-60.5365-(e)" },
    { id: "sec-ooooa-60.5365a-(e)" },
    { id: "sec-oooo-TABLE-3" },
  ];
  assert.deepEqual(filterReleased(rows, new Set(["oooo"])).map((r) => r.id), ["sec-ooooa-60.5365a-(e)"]);
  assert.deepEqual(filterReleased(rows, new Set(["ooooa"])).map((r) => r.id), ["sec-oooo-60.5365-(e)", "sec-oooo-TABLE-3"]);
});
