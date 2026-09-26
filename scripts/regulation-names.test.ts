/**
 * Regulation names as a user sees them: the /regulations index card and
 * regulationDisplayName (the Ask filter, search-result eyebrows, the
 * related panel). A user never sees a raw reg_key ("p190", "aqs"). Root
 * rows below are the live ones' id/citation/title (no database, no Next).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { regulationCardInfo, regulationDisplayName, rootIdOf } from "../src/lib/regulation-pure";

// ---- /regulations index cards ----

test("Reg 22 card: a stored title that already opens with the label is not doubled", () => {
  // The Reg 22 root row as imported (pipeline/import_ccr.py REG_META["22"]):
  // the title carries "Regulation Number 22 — " and the series in parens.
  const info = regulationCardInfo({
    id: "sec-22-top-REG-22",
    citation: "Regulation 22",
    title: "Regulation Number 22 — Colorado Greenhouse Gas Reporting and Emission Reduction Requirements (5 CCR 1001-26)",
    issuing_body: "CDPHE-APCD",
  });
  assert.equal(
    info.title,
    "Regulation Number 22 — Colorado Greenhouse Gas Reporting and Emission Reduction Requirements"
  );
  assert.equal(info.subtitle, "5 CCR 1001-26");
  // As stored since migration 20260926040857_reg22_root_title (sibling shape);
  // the strip above stays as a guard against a re-import of the old shape.
  const stored = regulationCardInfo({
    id: "sec-22-top-REG-22",
    citation: "Regulation 22",
    title: "COLORADO GREENHOUSE GAS REPORTING AND EMISSION REDUCTION REQUIREMENTS 5 CCR 1001-26",
    issuing_body: "CDPHE-APCD",
  });
  assert.equal(stored.title, "Regulation Number 22 — COLORADO GREENHOUSE GAS REPORTING AND EMISSION REDUCTION REQUIREMENTS");
  assert.equal(stored.subtitle, "5 CCR 1001-26");
});

test("Reg 7 card: the old placeholder title collapses to the label; the printed title reads like Reg 3's", () => {
  const before = regulationCardInfo({
    id: "sec-7-top-REG-7",
    citation: "Regulation 7",
    title: "Regulation 7",
    issuing_body: "CDPHE-APCD",
  });
  assert.equal(before.title, "Regulation Number 7");
  assert.equal(before.subtitle, null);
  const after = regulationCardInfo({
    id: "sec-7-top-REG-7",
    citation: "Regulation 7",
    title: "CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9",
    issuing_body: "CDPHE-APCD",
  });
  assert.equal(after.title, "Regulation Number 7 — CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS");
  assert.equal(after.subtitle, "5 CCR 1001-9");
});

test("a bare printed title (Reg 3, Reg 2) is prefixed exactly once, and the digit guard keeps Reg 2 off Reg 22", () => {
  const reg3 = regulationCardInfo({
    id: "sec-3-top-REG-3",
    citation: "Code of Colorado Regulations · Regulation Number 3",
    title: "STATIONARY SOURCE PERMITTING AND AIR POLLUTANT EMISSION NOTICE REQUIREMENTS 5 CCR 1001-5",
    issuing_body: "CDPHE-APCD",
  });
  assert.equal(reg3.title, "Regulation Number 3 — STATIONARY SOURCE PERMITTING AND AIR POLLUTANT EMISSION NOTICE REQUIREMENTS");
  assert.equal(reg3.subtitle, "5 CCR 1001-5");
  const reg2 = regulationCardInfo({
    id: "sec-2-top-REG-2",
    citation: "Code of Colorado Regulations · Regulation Number 2",
    title: "Regulation Number 22 — not this regulation's label",
    issuing_body: "CDPHE-APCD",
  });
  assert.equal(reg2.title, "Regulation Number 2 — Regulation Number 22 — not this regulation's label");
});

// ---- regulationDisplayName ----

// Root rows as fetchRegulationRoots returns them (id + citation), one per
// key shape, so the root-sourced path is proven against real citations.
const ROOTS: Record<string, { citation: string }> = {
  "7": { citation: "Regulation 7" },
  "3": { citation: "Code of Colorado Regulations · Regulation Number 3" },
  "22": { citation: "Regulation 22" },
  cp: { citation: "Code of Colorado Regulations · Common Provisions Regulation" },
  proc: { citation: "Code of Colorado Regulations · AQCC Procedural Rules" },
  aqs: { citation: "Code of Colorado Regulations · Air Quality Standards, Designations and Emission Budgets" },
  sip: { citation: "Code of Colorado Regulations · SIP Local Elements" },
  ecmc: { citation: "Code of Colorado Regulations · 2 CCR 404-1" },
  gp02: { citation: "APCD General Permit GP02" },
  gp12: { citation: "APCD General Permit GP12" },
  oooob: { citation: "40 CFR Part 60 Subpart OOOOb" },
  ooooc: { citation: "40 CFR Part 60 Subpart OOOOc" },
  jjjj: { citation: "40 CFR Part 60 Subpart JJJJ" },
  zzzz: { citation: "40 CFR Part 63 Subpart ZZZZ" },
  p190: { citation: "49 CFR Part 190" },
  p192: { citation: "49 CFR Part 192" },
};

const EXPECTED: Record<string, string> = {
  "7": "Regulation 7",
  "3": "Regulation 3",
  "22": "Regulation 22",
  cp: "Common Provisions Regulation",
  proc: "AQCC Procedural Rules",
  aqs: "Air Quality Standards, Designations and Emission Budgets",
  sip: "SIP Local Elements",
  ecmc: "2 CCR 404-1 (ECMC Rules)",
  gp02: "APCD General Permit GP02",
  gp12: "APCD General Permit GP12",
  oooob: "40 CFR Part 60 Subpart OOOOb",
  ooooc: "40 CFR Part 60 Subpart OOOOc",
  jjjj: "40 CFR Part 60 Subpart JJJJ",
  zzzz: "40 CFR Part 63 Subpart ZZZZ",
  p190: "49 CFR Part 190",
  p192: "49 CFR Part 192",
};

test("regulationDisplayName from the root row is the professional's name for every key shape", () => {
  for (const [key, want] of Object.entries(EXPECTED)) {
    assert.equal(regulationDisplayName(key, ROOTS[key]), want, key);
  }
});

test("regulationDisplayName without a root row (anonymous search) gives the same names, never the key", () => {
  for (const [key, want] of Object.entries(EXPECTED)) {
    assert.equal(regulationDisplayName(key), want, key);
    assert.equal(regulationDisplayName(key, null), want, key);
  }
  // Case and the "sec-<reg>-top-REG-<reg>" id shape don't matter to the caller.
  assert.equal(regulationDisplayName("OOOOb"), "40 CFR Part 60 Subpart OOOOb");
  assert.equal(regulationDisplayName("GP02"), "APCD General Permit GP02");
  assert.ok(rootIdOf("p190").includes("-top-REG-"));
});

test("no display name is a bare reg key or a 'Reg <key>' label", () => {
  const keys = [
    ...["1", "10", "11", "12", "15", "16", "18", "19", "2", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "3", "30", "31", "4", "6", "7", "8", "9", "aqs", "cp", "ecmc", "proc", "sip"],
    ...["gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12"],
    ...["iiii", "jjjj", "ooooa", "oooob", "ooooc", "zzzz", "p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"],
  ];
  assert.equal(keys.length, 57);
  for (const key of keys) {
    const name = regulationDisplayName(key);
    assert.notEqual(name.toLowerCase(), key, key);
    assert.doesNotMatch(name, /^Reg /, key);
    assert.doesNotMatch(name, new RegExp(`^${key}$`, "i"), key);
  }
});
