/**
 * Ranking margin of an Ask eval question (src/lib/ask-margin.ts). Pure; the
 * first fixture is the production top 8 for "ECD testing requirements" from
 * the stability run on 11 Oct 2026 (Ask eval run 38114804228).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MARGIN_FLAG, expectMargin, formatMargin, fusionMode, isThin, namedJurisdictions, orderRows, type MarginRow } from "../src/lib/ask-margin";

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

// "flare testing", production 11 Oct 2026 (Ask eval run 38116549501): two
// words, so reciprocal-rank fusion; the same 0.0012 on all six vectors.
const FLARE_TOP7: MarginRow[] = [
  row("sec-ooooa-60.5413a-(a)-(1)", 0.0163934, 0.489437, "federal"),
  row("sec-oooob-60.5412b-(a)-(3)-(v)", 0.016129, 0.482596, "federal"),
  row("sec-oooob-60.5412b-(a)-(3)-(vii)", 0.015873, 0.482355, "federal"),
  row("sec-oooo-60.5413-(a)-(1)", 0.015625, 0.480972, "federal"),
  row("sec-ooooc-60.5417c-(d)-(8)-(iv)-(B)-(1)", 0.0153846, 0.474529, "federal"),
  row("sec-ooooc-60.5412c-(a)-(3)-(vi)", 0.0151515, 0.472551, "federal"),
  row("sec-oooob-60.5403b-(e)", 0.0149254, 0.472525, "federal"),
];
const FLARE_EXPECT = ["sec-7-B-II-B-2-h", "sec-oooob-60.5412b", "sec-ooooa-60.5412a", "sec-oooob-60.5417b"];

test("fusionMode mirrors the RPC's word count: 6+ words score, else rank", () => {
  assert.equal(fusionMode(ECD_Q), "score");
  assert.equal(fusionMode("flare testing"), "rank");
  assert.equal(fusionMode("APEN (air pollutant emission notice) exemptions for small sources"), "score");
  assert.equal(fusionMode("When is a GP01 required?"), "rank");
});

test("rank fusion is flagged on rank, not on its constant score gap", () => {
  const m = expectMargin(FLARE_TOP7, FLARE_EXPECT, 5, "flare testing");
  assert.equal(m.mode, "rank");
  assert.equal(m.rank, 2);
  assert.ok(m.margin != null && m.margin < MARGIN_FLAG); // 0.0012: meaningless here
  assert.equal(isThin(m), false);
  assert.equal(formatMargin(m), "rank 2 of 5");
  // the expected row in the last slot of the window is flagged
  const last = [...FLARE_TOP7.slice(0, 1), ...FLARE_TOP7.slice(3, 7)].map((r) => ({ ...r }));
  last.splice(4, 0, row("sec-oooob-60.5412b-(a)-(3)-(v)", 0.0153, 0.48, "federal"));
  const m5 = expectMargin(last, FLARE_EXPECT, 5, "flare testing");
  assert.equal(m5.rank, 5);
  assert.equal(isThin(m5), true);
});

test("score fusion is flagged on score", () => {
  assert.equal(isThin(expectMargin(ECD_TOP8, ECD_EXPECT, 5, ECD_Q)), true); // 0.00035
  // the same rows with the Reg 7 row at its post-change score, in the order the RPC returns them
  const ok = orderRows(ECD_TOP8.map((r) => (r.id === "sec-7-B-II-B-2-h" ? { ...r, fused: 0.215138 } : r)), { wantFed: false, wantState: false });
  const m = expectMargin(ok, ECD_EXPECT, 5, ECD_Q);
  assert.equal(m.rank, 1);
  assert.equal(isThin(m), false);
});

// "Do I need emission controls on a condensate storage tank at a well
// site?", production 11 Oct 2026: four expected Reg 7 rows at ranks 4 and
// 6-8. The margin is the best expected row over the fifth unexpected row
// (GP08 II.C.1.a); the expected rows below it add no slack, because a
// common shift moves them together.
test("condensate tank: 0.0042, the best expected row over the fifth unexpected row", () => {
  const rows = [
    row("sec-gp07-II-D-1", 0.231112, 0.631112),
    row("sec-gp01-II-D-1", 0.220197, 0.616947),
    row("sec-7-B-I-C-1-f-(ii)", 0.217907, 0.617907),
    row("sec-7-B-II-C-1-b-(i)-(C)", 0.215798, 0.615798),
    row("sec-7-B-I-M-1", 0.215454, 0.615454),
    row("sec-7-B-II-C-1-b", 0.214841, 0.614841),
    row("sec-7-B-II-C-1-a", 0.214217, 0.614217),
    row("sec-7-B-II-C-5-a", 0.212085, 0.612085),
    row("sec-gp08-II-C-1-a", 0.211638, 0.608497),
  ];
  const m = expectMargin(rows, ["sec-7-B-I-D", "sec-7-B-II-C", "sec-oooob-60.5395b"], 5, "Do I need emission controls on a condensate storage tank at a well site?");
  assert.ok(m.margin != null && Math.abs(m.margin - (0.215798 - 0.211638)) < 1e-6, String(m.margin));
});
