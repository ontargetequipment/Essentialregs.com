/**
 * Named-document detection and the search limit it sets (9 Oct 2026; the
 * outside reviewer's "Method 21 ... under Subpart OOOO" defect). Pure.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { askScope, NAMEABLE_KEYS, NAMEABLE_NUMBERED_REGS, namedDocument, namedDocumentKeys } from "../src/lib/ask-scope";
import { askHref } from "../src/lib/search-hrefs";
import { EVAL_QUESTIONS, evaluateQuestion } from "../src/lib/semantic-eval";
import { groupHits, layoutAsk, QUESTION_MAPS } from "../src/lib/question-maps";

const corpus = JSON.parse(readFileSync(path.join(__dirname, "..", "pipeline", "out", "corpus_ids.json"), "utf8")) as Record<string, string[]>;

test("every key a question can be limited to is a document in the corpus, and the numbered list is exactly the numbered documents", () => {
  for (const k of NAMEABLE_KEYS) assert.ok(corpus[k], `${k} is not a document in pipeline/out/corpus_ids.json`);
  const numbered = Object.keys(corpus).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
  assert.deepEqual([...NAMEABLE_NUMBERED_REGS], numbered);
});

test("one document named: Subpart letters, general permits, numbered regulations, PHMSA parts, ECMC", () => {
  const cases: [string, string][] = [
    ["What test methods apply to a Method 21 inspection under Subpart OOOO?", "oooo"],
    ["storage vessels in OOOOa", "ooooa"],
    ["What does Subpart OOOOb say about flares?", "oooob"],
    ["OOOOc state plan deadlines", "ooooc"],
    ["emission standards in 40 CFR 60 Subpart JJJJ", "jjjj"],
    ["Subpart IIII emergency engines", "iiii"],
    ["Subpart ZZZZ compliance dates", "zzzz"],
    ["limits in GP02", "gp02"],
    ["What are the monitoring conditions of GP 12?", "gp12"],
    ["GP-5 tank limits", "gp05"],
    ["What does Regulation 7 require for dehydrators?", "7"],
    ["Reg 3 APEN thresholds", "3"],
    ["Regulation Number 22 reporting", "22"],
    ["Reg. 26 engines", "26"],
    ["What does Part 192 require for odorization?", "p192"],
    ["49 CFR Part 195 leak detection", "p195"],
    ["49 CFR 192.605 procedures", "p192"],
    ["ECMC Rule 604 setbacks", "ecmc"],
    ["ECMC 900-series spills", "ecmc"],
    ["2 CCR 404-1 rule 523", "ecmc"],
  ];
  for (const [q, key] of cases) assert.equal(namedDocument(q), key, q);
});

test("false positives: Part 60, Part A, Regulation alone, Rule alone, OOOO inside OOOOa, unknown numbers", () => {
  const none = [
    "What does 40 CFR Part 60 require?",
    "Part 60 Subpart A general provisions",
    "40 CFR Part 190 uranium fuel cycle",
    "Part A of the permit",
    "What regulation applies to a tank?",
    "Which rule covers a flare?",
    "Rule 604 setbacks",
    "Regulation 5 requirements",
    "Regulation 2022 changes",
    "Reg 60",
    "GP04 requirements",
    "Part 197 pipelines",
    "OOOOd standards",
    "How many regs apply?",
  ];
  for (const q of none) assert.deepEqual(namedDocumentKeys(q), [], q);
  // OOOO does not match inside OOOOa: a question naming both is two documents, a question naming OOOOa is one.
  assert.deepEqual(namedDocumentKeys("OOOOa"), ["ooooa"]);
  assert.deepEqual(namedDocumentKeys("OOOO, OOOOa and OOOOb"), ["oooo", "ooooa", "oooob"]);
});

test("several documents named: no single document", () => {
  assert.equal(namedDocument("How do OOOOb and OOOOc differ?"), null);
  assert.equal(namedDocument("Does Regulation 7 or Subpart OOOOb control tank vents?"), null);
  assert.equal(namedDocument("Subpart OOOO, OOOOa or OOOOb"), null);
  // The same document named twice is one document.
  assert.equal(namedDocument("Subpart OOOO: does OOOO require Method 21?"), "oooo");
});

test("askScope: the named document limits the search; a premise note, the Regulation filter and ?within=any each lift it", () => {
  const q = "What test methods apply to a Method 21 inspection under Subpart OOOO?";
  assert.deepEqual(askScope(q), { regFilter: "oooo", within: "oooo", released: null });
  assert.deepEqual(askScope(q, { unconstrained: true }), { regFilter: null, within: null, released: "oooo" });
  // The visitor's own Regulation filter wins and shows no chip.
  assert.deepEqual(askScope(q, { reg: "7" }), { regFilter: "7", within: null, released: null });
  // A premise question names one permit on purpose: its premise map shows the Regulation 3 rows beside the permit's.
  for (const p of ["When is a GP01 required?", "Do I need a GP12?", "Can I register a diesel engine under GP02?", "Does OOOOb apply to an existing well drilled before 2022?"]) {
    assert.deepEqual(askScope(p), { regFilter: null, within: null, released: null }, p);
  }
  assert.deepEqual(askScope("What storage tank rules apply?"), { regFilter: null, within: null, released: null });
});

test("only two eval questions name one document (the new one and the OOOOb modification question); premise rows and facet rows behave as before", () => {
  const limited = EVAL_QUESTIONS.filter((e) => askScope(e.q).within !== null).map((e) => [e.q, askScope(e.q).within]);
  assert.deepEqual(limited, [
    ["Am I subject to the federal OOOOb rules if I modified a well after December 2022?", "oooob"],
    ["What test methods apply to a Method 21 inspection under Subpart OOOO?", "oooo"],
  ]);
  // Every eval row that declares a limit agrees with the detector.
  for (const e of EVAL_QUESTIONS) if (e.within !== undefined) assert.equal(askScope(e.q).within, e.within, e.q);
});

const hit = (id: string, reg: string) => ({ id, reg_key: reg, jurisdiction_level: reg.startsWith("oooo") ? "federal" : "state", title: id, path: null });

test("a map groups a limited search but never widens it: canonical rows and hits from other documents are dropped, the caps are lifted", () => {
  const ldar = QUESTION_MAPS.find((m) => m.key === "ldar")!;
  const bs = ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)"].map((n) => hit(`sec-oooo-60.5416-(b)-${n}`, "oooo"));
  const stray = [hit("sec-7-B-II-E", "7"), hit("sec-gp12-I-A", "gp12")];
  const g = groupHits(ldar, [...stray, ...bs], undefined, {}, "oooo");
  const shown = [...g.groups.flatMap((x) => [...x.canonical.map((p) => p.id), ...x.hits.map((h) => h.id)]), ...g.other.map((h) => h.id)];
  assert.deepEqual(shown, bs.map((h) => h.id), "six OOOO rows (more than the cap of three), nothing else");
  // Unlimited, the same call keeps the map's own rows and caps the group.
  const open = groupHits(ldar, bs);
  assert.equal(open.groups.find((x) => x.group === "Federal NSPS")!.hits.length, 3);
  assert.ok(open.groups.some((x) => x.group === "Colorado standards"));
});

test("the acceptance row: limited to OOOO, the question routes to the LDAR map and 60.5416(b)(1)-(6) lead; the pre-fix layout fails the same row", () => {
  const row = EVAL_QUESTIONS.find((e) => e.q === "What test methods apply to a Method 21 inspection under Subpart OOOO?")!;
  const bs = ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)"].map((n) => hit(`sec-oooo-60.5416-(b)-${n}`, "oooo"));
  const scope = askScope(row.q);
  const layout = layoutAsk(row.q, [hit("sec-oooo-60.5416-(b)", "oooo"), ...bs], undefined, false, scope.within);
  assert.equal(layout.map?.key, "ldar");
  assert.equal(layout.shownIds[0], "sec-oooo-60.5416-(b)");
  const ok = evaluateQuestion(row, [{ id: "sec-oooo-60.5416-(b)" }], layout.map?.key ?? null, { ids: layout.shownIds, noteKey: null, title: null, within: scope.within });
  assert.deepEqual(ok.failures, []);
  // Without the limit (document filter on Any, the defect): the map's Regulation 7 and general permit rows lead and the checks fail.
  const before = layoutAsk(row.q, bs, undefined, false, null);
  const bad = evaluateQuestion(row, [{ id: "sec-oooo-60.5416-(b)" }], before.map?.key ?? null, { ids: before.shownIds, noteKey: null, title: null, within: null });
  assert.equal(bad.pass, false);
  assert.match(bad.failures.join("\n"), /not limited to a document|rows from other documents shown/);
});

test("askHref: ?within=any only when the chip was removed, after the other params", () => {
  assert.equal(askHref("q", false), "/search?mode=ask&q=q");
  assert.equal(askHref("q", false, null, "", false, false, true), "/search?mode=ask&q=q&within=any");
  assert.equal(askHref("q", true, "federal", "oooo", true, true, true), "/search?mode=ask&q=q&j=federal&reg=oooo&basis=1&flat=1&facets=all&within=any");
});

test("every ordinary map keeps working with no limit: the grouped layout is unchanged by an absent limit", () => {
  for (const m of QUESTION_MAPS) {
    const a = groupHits(m, []);
    const b = groupHits(m, [], undefined, {}, null);
    assert.deepEqual(a, b, m.key);
  }
});
