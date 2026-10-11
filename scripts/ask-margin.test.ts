/**
 * Ranking margin of an Ask eval question (src/lib/ask-margin.ts). Pure; the
 * first fixture is the production top 8 for "ECD testing requirements" from
 * the stability run on 11 Oct 2026 (Ask eval run 38114804228).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { expectMargin, formatMargin, namedJurisdictions, orderRows, type MarginRow } from "../src/lib/ask-margin";

const row = (id: string, fused: number, score: number, jurisdiction_level = "state"): MarginRow => ({ id, fused, score, jurisdiction_level });

const ECD_TOP8: MarginRow[] = [
  row("sec-24-B-IV-D-2-c-(i)", 0.208273, 0.597162),
  row("sec-oooo-60.5413-(d)-(3)", 0.207548, 0.607548, "federal"),
  row("sec-ooooc-60.5413c-(d)-(3)", 0.206381, 0.606381, "federal"),
  row("sec-ooooc-60.5413c-(e)", 0.200867, 0.600867, "federal"),
  row("sec-7-B-II-B-2-h", 0.200853, 0.586567),
  row("sec-ooooc-60.5415c-(e)-(1)-(xi)-(E)", 0.200506, 0.600506, "federal"),
  row("sec-ooooa-60.5413a-(d)-(3)", 0.199161, 0.599161, "federal"),
  row("sec-oooob-60.5413b-(d)-(3)", 0.19902, 0.59902, "federal"),
];
const ECD_Q = "ECD (enclosed combustion device) testing requirements";
const ECD_EXPECT = ["sec-7-B-II-B-2-h", "sec-7-B-I-E"];

test("ECD testing requirements: rank 5 of 5 by 0.00035 over rank 6", () => {
  const m = expectMargin(ECD_TOP8, ECD_EXPECT, 5, ECD_Q);
  assert.equal(m.orderMatches, true);
  assert.equal(m.atLeast, false);
  assert.ok(m.margin != null && Math.abs(m.margin - (0.200853 - 0.200506)) < 1e-6, String(m.margin));
  assert.equal(formatMargin(m), "0.00035");
});

test("a failing question has a negative margin: the rise its expected rows need", () => {
  // the flipped run: OOOOc (xi)(E) at rank 5, the Reg 7 row at 6
  const flipped = [
    row("sec-24-B-IV-D-2-c-(i)", 0.208449, 0.597338),
    row("sec-oooo-60.5413-(d)-(3)", 0.207871, 0.607871, "federal"),
    row("sec-ooooc-60.5413c-(d)-(3)", 0.206669, 0.606669, "federal"),
    row("sec-ooooc-60.5413c-(e)", 0.201886, 0.601886, "federal"),
    row("sec-ooooc-60.5415c-(e)-(1)-(xi)-(E)", 0.201589, 0.601589, "federal"),
    row("sec-7-B-II-B-2-h", 0.200965, 0.58668),
  ];
  const m = expectMargin(flipped, ECD_EXPECT, 5, ECD_Q);
  assert.ok(m.margin != null && Math.abs(m.margin + (0.201589 - 0.200965)) < 1e-6, String(m.margin));
  assert.ok(formatMargin(m).startsWith("−"));
});

test("an expected row the RPC did not return: absent", () => {
  assert.equal(formatMargin(expectMargin(ECD_TOP8, ["sec-gp12-"], 5, ECD_Q)), "absent");
});

test("a margin beyond the returned rows is a lower bound", () => {
  const m = expectMargin(ECD_TOP8.slice(0, 3), ["sec-24-"], 5, ECD_Q);
  assert.equal(m.atLeast, true);
  assert.ok(formatMargin(m).startsWith("≥ "));
});

test("rows a stated fact left out are not scored", () => {
  // Leaving out two rows above rank 6 moves the window: (xi)(E) and the
  // OOOOa row are now the rows the Reg 7 row has to beat.
  const m = expectMargin(ECD_TOP8, ECD_EXPECT, 5, ECD_Q, ["sec-24-B-IV-D-2-c-(i)", "sec-oooo-60.5413-(d)-(3)"]);
  assert.ok(m.margin != null && Math.abs(m.margin - (0.200853 - 0.19902)) < 1e-6, String(m.margin));
});

test("namedJurisdictions mirrors the RPC's word lists", () => {
  assert.deepEqual(namedJurisdictions("What Colorado and federal requirements could apply to storage vessels?"), { wantFed: true, wantState: true });
  assert.deepEqual(namedJurisdictions("Am I subject to the federal OOOOb rules?"), { wantFed: true, wantState: false });
  assert.deepEqual(namedJurisdictions("When is a GP01 required?"), { wantFed: false, wantState: true });
  assert.deepEqual(namedJurisdictions(ECD_Q), { wantFed: false, wantState: false });
  // whole words only: "statement" is not "state", "federalism" is not "federal"
  assert.deepEqual(namedJurisdictions("a statement on federalism"), { wantFed: false, wantState: false });
  assert.equal(namedJurisdictions("U.S. EPA rules").wantFed, true);
});

test("both jurisdictions named: strict interleave, state first", () => {
  const rows = [row("f1", 0.3, 0.6, "federal"), row("f2", 0.29, 0.6, "federal"), row("s1", 0.2, 0.6), row("s2", 0.1, 0.6)];
  const named = { wantFed: true, wantState: true };
  assert.deepEqual(orderRows(rows, named).map((r) => r.id), ["s1", "f1", "s2", "f2"]);
  // s2 is expected at position 3 of a top-3 window. Lowering it never moves
  // it behind f2 (f2 is the second federal row, paired after the second
  // state row), so the margin is the gap to the next state row -- none was
  // returned, so it is a lower bound.
  const m = expectMargin(orderRows(rows, named), ["s2"], 3, "Colorado and federal rules");
  assert.equal(m.orderMatches, true);
  assert.equal(m.atLeast, true);
});

test("one jurisdiction named: its three best rows lead, the rest by fused", () => {
  const rows = [row("s1", 0.5, 0.6), row("f1", 0.3, 0.6, "federal"), row("f2", 0.2, 0.6, "federal"), row("f3", 0.1, 0.6, "federal"), row("f4", 0.4, 0.6, "federal")];
  const ordered = orderRows(rows, { wantFed: true, wantState: false });
  assert.deepEqual(ordered.map((r) => r.id), ["f4", "f1", "f2", "s1", "f3"]);
  // s1 at rank 4 of a top-4 window: it drops out when it falls below f3 (0.1)
  const m = expectMargin(ordered, ["s1"], 4, "federal rules");
  assert.ok(m.margin != null && Math.abs(m.margin - 0.4) < 1e-6, String(m.margin));
});
