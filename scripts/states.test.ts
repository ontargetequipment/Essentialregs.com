/**
 * The /states picker and the /states/<state> index are driven by
 * src/lib/states.ts. This proves the slug lookup, the per-state root
 * filter and the picker card's live counts over the same root fixture
 * marketing-index.test.ts uses (no database, no Next).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { rootIdOf } from "../src/lib/regulation-pure";
import { STATES, coverageLabel, stateBySlug, stateCoverage, stateRoots } from "../src/lib/states";

const ROOTS = [
  ...["1", "10", "11", "12", "15", "16", "18", "19", "2", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "3", "30", "31", "4", "6", "7", "8", "9", "aqs", "cp", "ecmc", "proc", "sip"].map(
    (k) => ({ id: rootIdOf(k), jurisdiction_level: "state" as const })
  ),
  ...["gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12"].map(
    (k) => ({ id: rootIdOf(k), jurisdiction_level: "state" as const })
  ),
  ...["iiii", "jjjj", "oooo", "ooooa", "oooob", "ooooc", "zzzz", "p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"].map(
    (k) => ({ id: rootIdOf(k), jurisdiction_level: "federal" as const })
  ),
];

test("Colorado is the only state, and only a known slug resolves", () => {
  assert.deepEqual(STATES.map((s) => s.slug), ["colorado"]);
  assert.equal(stateBySlug("colorado")?.name, "Colorado");
  assert.equal(stateBySlug("texas"), undefined);
  assert.equal(stateBySlug(""), undefined);
});

test("/states/colorado lists exactly the state-level roots, as /regulations did", () => {
  const colorado = stateBySlug("colorado")!;
  const regs = stateRoots(colorado, ROOTS);
  assert.equal(regs.length, 43);
  assert.ok(regs.every((r) => r.jurisdiction_level === "state"));
});

test("the picker card's counts come from the roots, permits split out", () => {
  const colorado = stateBySlug("colorado")!;
  const coverage = stateCoverage(stateRoots(colorado, ROOTS));
  assert.deepEqual(coverage, { regulations: 32, generalPermits: 11 });
  assert.equal(coverageLabel(coverage), "32 regulations · 11 General Permits");
});

test("the count label pluralises and drops an empty permits part", () => {
  assert.equal(coverageLabel({ regulations: 1, generalPermits: 1 }), "1 regulation · 1 General Permit");
  assert.equal(coverageLabel({ regulations: 5, generalPermits: 0 }), "5 regulations");
  assert.equal(coverageLabel(stateCoverage([])), "0 regulations");
});
