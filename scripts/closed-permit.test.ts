/**
 * The closed-permit list and the Ask acceptance evaluator (Ask Track A,
 * 30 Sep 2026). No database, no Next.
 *
 * The app's list (GP_CLOSURE_NOTE in src/lib/regulation-pure.ts, read
 * through isClosedPermit / CLOSED_PERMIT_REG_KEYS) and the database's
 * public.closed_permit_reg_keys() (migration 20260930003325) must name the
 * same permits. scripts/corpus_qa.sql check 18 pins the database side to
 * {gp09,gp10}; this pins the app side to the same literal, so a change to
 * either fails loudly until both move.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CLOSED_PERMIT_BADGE, CLOSED_PERMIT_REG_KEYS, isClosedPermit } from "../src/lib/regulation-pure";
import { layoutAsk } from "../src/lib/question-maps";
import { EVAL_QUESTIONS, evaluateQuestion, rowsNeeded, type EvalQuestion } from "../src/lib/semantic-eval";

test("closed permits are exactly gp09 and gp10 (same literal as corpus_qa.sql check 18)", () => {
  assert.deepEqual([...CLOSED_PERMIT_REG_KEYS].sort(), ["gp09", "gp10"]);
});

test("isClosedPermit reads GP_CLOSURE_NOTE, any case, and is false for everything else", () => {
  assert.equal(isClosedPermit("gp09"), true);
  assert.equal(isClosedPermit("GP10"), true);
  assert.equal(isClosedPermit("gp12"), false);
  assert.equal(isClosedPermit("gp01"), false);
  assert.equal(isClosedPermit("7"), false);
  assert.equal(isClosedPermit(null), false);
  assert.equal(isClosedPermit(undefined), false);
  assert.equal(isClosedPermit(""), false);
  // a prototype property is not a permit
  assert.equal(isClosedPermit("constructor"), false);
});

test("the badge names the closure date and the replacement permit", () => {
  assert.equal(CLOSED_PERMIT_BADGE.label, "Closed to new registrations");
  assert.match(CLOSED_PERMIT_BADGE.title, /July 15, 2026/);
  assert.match(CLOSED_PERMIT_BADGE.title, /GP12 replaced GP09 and GP10/);
});

// ---- evaluator -----------------------------------------------------------

const hit = (id: string, extra: { is_basis?: boolean; jurisdiction_level?: string } = {}) => ({ id, ...extra });

test("a plain question (the original 24 shape) passes on any expected prefix in the top 5", () => {
  const q: EvalQuestion = { q: "x", expect: ["sec-7-B-I-D"], note: "" };
  const hits = [hit("sec-3-A-II-1"), hit("sec-7-B-I-D-2"), hit("sec-7-B-I-D-3")];
  assert.deepEqual(evaluateQuestion(q, hits), { pass: true, matchRank: 2, failures: [] });
  assert.equal(rowsNeeded(q), 5);
  const miss = evaluateQuestion(q, [hit("a"), hit("b"), hit("c"), hit("d"), hit("e"), hit("sec-7-B-I-D-1")]);
  assert.equal(miss.pass, false);
  assert.equal(miss.matchRank, null);
});

test("forbid fails the question even when expect passes", () => {
  const q: EvalQuestion = { q: "x", expect: ["sec-gp01-I-A"], forbid: ["sec-gp03-", "sec-gp10-"], note: "" };
  const good = evaluateQuestion(q, [hit("sec-gp01-I-A-1"), hit("sec-gp01-I-E"), hit("sec-gp12-I")]);
  assert.equal(good.pass, true);
  const bad = evaluateQuestion(q, [hit("sec-gp01-I-A-1"), hit("sec-gp03-II-B-1-c")]);
  assert.equal(bad.pass, false);
  assert.equal(bad.matchRank, 1);
  assert.match(bad.failures[0], /sec-gp03-II-B-1-c/);
  // a forbidden row past the window is fine
  const past = evaluateQuestion(q, [hit("sec-gp01-I-A-1"), hit("b"), hit("c"), hit("d"), hit("e"), hit("sec-gp10-IV")]);
  assert.equal(past.pass, true);
});

test("topN widens expect; forbidTopN narrows forbid; rowsNeeded takes the widest", () => {
  const q: EvalQuestion = {
    q: "x",
    expect: ["sec-gp12-", "sec-26-"],
    topN: 10,
    forbid: ["sec-gp09-", "sec-gp10-"],
    forbidTopN: 3,
    checks: [{ any: ["sec-gp12-"] }, { any: ["sec-26-"] }],
    note: "",
  };
  assert.equal(rowsNeeded(q), 10);
  const hits = [
    hit("sec-jjjj-60.4248"),
    hit("sec-gp12-XII-E"),
    hit("sec-gp12-ATT-A-1"),
    hit("sec-gp12-VI-F-2"),
    hit("sec-gp09-IV-B-1"),
    hit("sec-gp10-IV-B-1"),
    hit("sec-7-B-II"),
    hit("sec-7-B-III"),
    hit("sec-26-I-D-6-a-i"),
  ];
  assert.deepEqual(evaluateQuestion(q, hits), { pass: true, matchRank: 2, failures: [] });
  // GP09 in the top 3 fails it
  const bad = evaluateQuestion(q, [hit("sec-gp09-IV-B-1"), ...hits]);
  assert.equal(bad.pass, false);
  assert.match(bad.failures.join("\\n"), /top 3: sec-gp09-IV-B-1/);
  // Reg 26 missing from the top 10 fails the second group
  const noReg26 = evaluateQuestion(q, hits.slice(0, 8));
  assert.equal(noReg26.pass, false);
  assert.match(noReg26.failures.join("\\n"), /sec-26-/);
});

test("noBasis and minFederal checks", () => {
  const q: EvalQuestion = {
    q: "x",
    expect: ["sec-gp08-"],
    topN: 10,
    checks: [{ any: ["sec-oooob-60.5365b"] }, { noBasis: true, topN: 5 }, { minFederal: 3 }],
    note: "",
  };
  const fed = { jurisdiction_level: "federal" };
  const st = { jurisdiction_level: "state" };
  const good = [
    hit("sec-gp12-I-A-3-a", st),
    hit("sec-ooooc-60.5386c", fed),
    hit("sec-gp08-I-B-1-a", st),
    hit("sec-ooooc-60.5420c", fed),
    hit("sec-6-Ka", st),
    hit("sec-7-C-S", { ...st, is_basis: true }), // basis at rank 6 is allowed
    hit("sec-oooob-60.5365b-e-5-i", fed),
  ];
  assert.deepEqual(evaluateQuestion(q, good), { pass: true, matchRank: 3, failures: [] });
  const basisFirst = evaluateQuestion(q, [hit("sec-7-C-S", { ...st, is_basis: true }), ...good]);
  assert.equal(basisFirst.pass, false);
  assert.match(basisFirst.failures.join("\\n"), /Statement of Basis in the top 5: sec-7-C-S/);
  const twoFederal = evaluateQuestion(q, good.filter((h) => h.id !== "sec-ooooc-60.5420c"));
  assert.equal(twoFederal.pass, false);
  assert.match(twoFederal.failures.join("\\n"), /2 federal rows in the top 10; need 3/);
});

test("the list carries the original 24 questions unchanged, the maps batch 3 and 4 questions, then the three reviewer questions, the three review-4 rows and the five topic-note rows", () => {
  assert.equal(EVAL_QUESTIONS.length, 38);
  const plain = EVAL_QUESTIONS.slice(0, 26);
  for (const e of plain) {
    assert.equal(e.topN, undefined, e.q);
    assert.equal(e.forbid, undefined, e.q);
    assert.equal(e.checks, undefined, e.q);
  }
  assert.deepEqual(
    EVAL_QUESTIONS.slice(26).map((e) => e.q),
    [
      "When is a GP01 required?",
      "What regulations apply to a natural gas-fired engine?",
      "What Colorado and federal requirements could apply to storage vessels?",
      "Do I need a GP12?",
      "What applies to a diesel engine?",
      "What rules apply to a produced water storage tank at a well site?",
      "Do I need an APEN for every emission point at my site?",
      "Does my well site need a Title V operating permit?",
      "If my tank battery is exempt from a construction permit, does Regulation 7 still apply?",
      "Does OOOOb apply to an existing well drilled before 2022?",
      "Can I register a diesel engine under GP02?",
      "What test methods apply to a Method 21 inspection under Subpart OOOO?",
    ]
  );
  // the measured 30 Sep production top 10 for each passes its own question
  // (since review 4 the GP01 question pins the GP01 premise map and checks
  // the shown order, so the layout is passed the way scripts/ask-eval.ts
  // passes it)
  const gp01: EvalQuestion = EVAL_QUESTIONS[26];
  const hits = [hit("sec-gp01-I"), hit("sec-gp01-I-E"), hit("sec-gp01-I-A-1"), hit("sec-gp01-IX"), hit("sec-gp01-top-REG-gp01")];
  const layout = layoutAsk(gp01.q, hits.map((h) => ({ ...h, reg_key: "gp01", jurisdiction_level: "state", title: "" })));
  assert.equal(
    evaluateQuestion(gp01, hits, layout.map?.key ?? null, { ids: layout.shownIds, noteKey: layout.note?.key ?? null, title: layout.summary?.title ?? null }).pass,
    true
  );
});
