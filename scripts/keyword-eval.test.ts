/**
 * The keyword-search acceptance rows and their evaluator (src/lib/keyword-eval.ts),
 * pinned against what production returned before and after migration
 * 20261007020000 (closed permits x0.6, general permits x0.95, applicability
 * x1.3), measured as a subscriber on 6-7 Oct 2026. No database.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { KEYWORD_KNOWN_FAILURES, KEYWORD_ROWS, evaluateKeywordRow, keywordRowsNeeded, type KeywordHit } from "../src/lib/keyword-eval";

const hit = (id: string, title = "", path = ""): KeywordHit => ({ id, title, path });
const row = (q: string) => {
  const r = KEYWORD_ROWS.find((x) => x.q === q);
  assert.ok(r, q);
  return r;
};

test("the seven rows are the reviewer's, in the acceptance table's order", () => {
  assert.deepEqual(
    KEYWORD_ROWS.map((r) => r.q),
    ["storage tank requirements", "fugitive emissions", "produced water tank", "APEN requirements", "well production facility", "OOOOb", "reciprocating internal combustion engine"]
  );
  assert.deepEqual(Object.keys(KEYWORD_KNOWN_FAILURES), ["fugitive emissions"]);
  assert.equal(keywordRowsNeeded(row("OOOOb")), 1);
  assert.equal(keywordRowsNeeded(row("storage tank requirements")), 5);
  assert.equal(keywordRowsNeeded(row("reciprocating internal combustion engine")), 25);
});

test("storage tank requirements: production before (closed permits first) fails, after (Regulation 7 II.C.1 first) passes", () => {
  const before = ["sec-gp09-IV-C", "sec-gp10-IV-C", "sec-gp08-II-C", "sec-7-B-II-C-1", "sec-gp01-II-D"].map((id) => hit(id));
  const r = evaluateKeywordRow(row("storage tank requirements"), before);
  assert.equal(r.pass, false);
  assert.match(r.failures[0], /first hit is sec-gp09-IV-C/);
  const after = ["sec-7-B-II-C-1", "sec-gp08-II-C", "sec-gp01-II-D", "sec-gp09-IV-C", "sec-gp10-IV-C"].map((id) => hit(id));
  assert.deepEqual(evaluateKeywordRow(row("storage tank requirements"), after), { pass: true, failures: [] });
  assert.deepEqual(evaluateKeywordRow(row("storage tank requirements"), []), { pass: false, failures: ["no results"] });
});

test("produced water tank: Regulation 7 V.C.2.w first fails, GP08 I.B.1.c first passes", () => {
  const before = ["sec-7-B-V-C-2-w", "sec-gp08-I-B-1-c", "sec-gp08-II-C-1", "sec-gp05-II-D", "sec-ecmc-314-e-(10)-J-v-cc"].map((id) => hit(id));
  assert.equal(evaluateKeywordRow(row("produced water tank"), before).pass, false);
  const after = ["sec-gp08-I-B-1-c", "sec-gp12-I-A-3-d", "sec-7-B-V-C-2-w", "sec-ecmc-314-e-(10)-J-v-cc", "sec-gp05-I-A-1"].map((id) => hit(id));
  assert.equal(evaluateKeywordRow(row("produced water tank"), after).pass, true);
});

test("fugitive emissions: both halves are checked; the row is a known failure today", () => {
  const after = ["sec-gp12-I-A-6", "sec-cp-I-G-54", "sec-gp12-V-O", "sec-gp12-VII-G", "sec-ooooc-60.5397c-(c)", "sec-ooooc-60.5397c-(e)", "sec-oooob-60.5397b-(e)"].map((id) => hit(id));
  const r = evaluateKeywordRow(row("fugitive emissions"), after);
  assert.equal(r.pass, false);
  assert.equal(r.failures.length, 2);
  assert.match(r.failures[0], /sec-7-B-II-E/);
  assert.match(r.failures[1], /sec-oooob-60\.5397b/);
  const ideal = ["sec-7-B-II-E-4", "sec-oooob-60.5397b-(e)", "sec-gp12-I-A-6", "sec-cp-I-G-54", "sec-gp12-V-O"].map((id) => hit(id));
  assert.equal(evaluateKeywordRow(row("fugitive emissions"), ideal).pass, true);
});

test("the four rows that pass today keep passing on their production top 5, and fail on the failures they guard against", () => {
  assert.equal(evaluateKeywordRow(row("APEN requirements"), [hit("sec-3-A-II"), hit("sec-gp01-VIII-C-7")]).pass, true);
  assert.equal(evaluateKeywordRow(row("APEN requirements"), [hit("sec-gp01-VIII-C-7"), hit("sec-3-A-II")]).pass, false);

  assert.equal(evaluateKeywordRow(row("well production facility"), [hit("sec-7-B-I-L-2"), hit("sec-7-B-II-E-4"), hit("sec-3-B-III-J-4")]).pass, true);
  assert.equal(evaluateKeywordRow(row("well production facility"), [hit("sec-7-C-N"), hit("sec-7-B-I-L-2")]).pass, false, "a Statement of Basis is not an operative provision");

  const oooob = ["sec-oooob-top-REG-oooob", "sec-oooob-TABLE-1", "sec-oooob-TABLE-2"].map((id) => hit(id));
  assert.equal(evaluateKeywordRow(row("OOOOb"), oooob).pass, true);
  const tablesFirst = ["sec-oooob-TABLE-1", "sec-oooob-TABLE-2", "sec-oooob-top-REG-oooob"].map((id) => hit(id));
  const r = evaluateKeywordRow(row("OOOOb"), tablesFirst);
  assert.equal(r.pass, false);
  assert.match(r.failures.join("\n"), /first hit is sec-oooob-TABLE-1/);
  assert.match(r.failures.join("\n"), /forbidden in the top 1: sec-oooob-TABLE-1/);

  const rice = row("reciprocating internal combustion engine");
  const after = [
    hit("sec-gp12-I-A-1", "I.A.1. Natural gas-fired reciprocating internal combustion engines.", "I. General Permit Applicability"),
    hit("sec-gp12-I-A-2"),
    hit("sec-26-B-I-D-4"),
    hit("sec-gp02-I-E"),
    hit("sec-gp06-I-E"),
    hit("sec-jjjj-60.4230", "§ 60.4230 Am I subject to this subpart?", null as unknown as string),
    hit("sec-jjjj-60.4248-(a)", "§ 60.4248(a)", "§ 60.4248 What definitions apply to this subpart?"),
    hit("sec-zzzz-63.6675-(b)", "", "§ 63.6675 What definitions apply to this subpart?"),
  ];
  const got = evaluateKeywordRow(rice, after);
  assert.equal(got.pass, false, "ZZZZ's first row is a definitions row");
  assert.match(got.failures.join("\n"), /^zzzz: its first row is a definitions row/m);
  assert.doesNotMatch(got.failures.join("\n"), /jjjj/);
  // Without the ZZZZ definitions row, and without Regulation 26 in the top 5.
  assert.equal(evaluateKeywordRow(rice, after.slice(0, 7)).pass, true);
  const noReg26 = after.filter((h) => !h.id.startsWith("sec-26-"));
  assert.match(evaluateKeywordRow(rice, noReg26).failures[0], /sec-26-/);
});
