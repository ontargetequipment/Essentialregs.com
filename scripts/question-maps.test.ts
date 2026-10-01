/**
 * Question maps (Ask Track B, 1 Oct 2026): routing, the group fallback for
 * retrieval hits, the grouped layout, the eval's `map` check, and the
 * generated id list scripts/corpus_qa.sql check 20 reads. No database, no
 * Next.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AQCC_REGULATION_KEYS,
  FEDERAL_NESHAP_REG_KEYS,
  FEDERAL_NSPS_REG_KEYS,
  MAP_GROUP_ORDER,
  MAX_HITS_PER_GROUP,
  MAX_OTHER_HITS,
  QUESTION_MAPS,
  groupForHit,
  groupHits,
  matchQuestionMap,
  summariseGroups,
  type GroupableHit,
} from "../src/lib/question-maps";
import { EVAL_QUESTIONS, KNOWN_FAILURES, evaluateQuestion, type EvalQuestion } from "../src/lib/semantic-eval";
import { QUESTION_MAP_IDS_SQL, renderQuestionMapIdsSql } from "./question-map-ids";

// ---- routing ---------------------------------------------------------------

test("the two engine questions and a GP12 question route to the engines map", () => {
  assert.equal(matchQuestionMap("What are the emission standards for a new natural gas fired compressor engine?")?.key, "engines");
  assert.equal(matchQuestionMap("What regulations apply to a natural gas-fired engine?")?.key, "engines");
  assert.equal(matchQuestionMap("GP12 engine limits")?.key, "engines");
  // The acronym expansion is what routes a bare permit number or RICE.
  assert.equal(matchQuestionMap("gp02 registration")?.key, "engines");
  assert.equal(matchQuestionMap("Is my RICE subject to ZZZZ?")?.key, "engines");
  assert.equal(matchQuestionMap("emergency generator at a well pad")?.key, "engines");
});

test("compressor, storage-vessel and GP01 questions route to no map", () => {
  assert.equal(matchQuestionMap("centrifugal compressor wet seals"), null);
  assert.equal(matchQuestionMap("What venting and control requirements apply to a centrifugal compressor with wet seals?"), null);
  assert.equal(matchQuestionMap("storage vessels"), null);
  assert.equal(matchQuestionMap("What Colorado and federal requirements could apply to storage vessels?"), null);
  assert.equal(matchQuestionMap("When is a GP01 required?"), null);
  // Word boundaries: "engineering" and "GP20" are not engines.
  assert.equal(matchQuestionMap("engineering controls for dust"), null);
  assert.equal(matchQuestionMap("gp20"), null);
});

test("every map has a unique key, a trigger, a factors sentence and rows in MAP_GROUP_ORDER groups", () => {
  const keys = QUESTION_MAPS.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const m of QUESTION_MAPS) {
    assert.ok(m.triggers.length > 0, `${m.key}: no trigger`);
    assert.ok(m.factors.length > 20, `${m.key}: no factors sentence`);
    assert.ok(m.provisions.length > 0, `${m.key}: no rows`);
    const ids = m.provisions.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${m.key}: duplicate id`);
    for (const p of m.provisions) {
      assert.ok(MAP_GROUP_ORDER.includes(p.group), `${m.key} ${p.id}: unknown group ${p.group}`);
      assert.ok(p.why.length > 0, `${m.key} ${p.id}: no why`);
    }
  }
});

test("the engines map lists its 22 rows in the plan's order, six groups, GP09/GP10 last among the permits", () => {
  const engines = QUESTION_MAPS.find((m) => m.key === "engines");
  assert.ok(engines);
  assert.equal(engines.name, "Natural gas-fired and diesel engines");
  assert.equal(engines.provisions.length, 22);
  assert.deepEqual(
    engines.provisions.filter((p) => p.group === "General Permit options").map((p) => p.id),
    ["sec-gp12-I-A", "sec-gp02-I-A", "sec-gp09-I-A", "sec-gp10-I-A"]
  );
  assert.deepEqual(
    [...new Set(engines.provisions.map((p) => p.group))],
    MAP_GROUP_ORDER
  );
  assert.ok(engines.provisions.some((p) => p.id === "sec-jjjj-60.4230"));
  assert.ok(engines.provisions.some((p) => p.id === "sec-zzzz-63.6585"));
});

// ---- groupForHit -----------------------------------------------------------

const hit = (id: string, reg_key: string | null, jurisdiction_level: string, extra: Partial<GroupableHit> = {}): GroupableHit => ({
  id,
  reg_key,
  jurisdiction_level,
  title: extra.title ?? id,
  path: extra.path ?? null,
});

test("groupForHit routes one row per group, a Definitions row and an Other row", () => {
  assert.equal(groupForHit(hit("sec-3-B-II-D-1", "3", "state")), "Colorado permitting and APEN");
  assert.equal(groupForHit(hit("sec-gp01-I-A", "gp01", "state")), "General Permit options");
  assert.equal(groupForHit(hit("sec-7-B-II-E", "7", "state")), "Colorado standards");
  assert.equal(groupForHit(hit("sec-cp-III-A", "cp", "state")), "Colorado standards");
  assert.equal(groupForHit(hit("sec-aqs-I", "aqs", "state")), "Colorado standards");
  assert.equal(groupForHit(hit("sec-oooob-60.5395b", "oooob", "federal")), "Federal NSPS");
  assert.equal(groupForHit(hit("sec-iiii-60.4204", "iiii", "federal")), "Federal NSPS");
  assert.equal(groupForHit(hit("sec-zzzz-63.6590", "zzzz", "federal")), "Federal NESHAP");
  // Definitions win over the regulation, by path or by title.
  assert.equal(groupForHit(hit("sec-7-B-I-B-2", "7", "state", { path: "PART B — … › I. Definitions" })), "Definitions");
  assert.equal(groupForHit(hit("sec-jjjj-60.4248", "jjjj", "federal", { title: "§ 60.4248 What definitions apply to this subpart?" })), "Definitions");
  assert.equal(groupForHit(hit("sec-3-A-I-B-36", "3", "state", { path: "PART A — … › I.B. Definitions" })), "Definitions");
  // Everything else.
  assert.equal(groupForHit(hit("sec-ecmc-604", "ecmc", "state")), "Other");
  assert.equal(groupForHit(hit("sec-p192-192.3", "p192", "federal")), "Other");
  assert.equal(groupForHit(hit("sec-proc-I", "proc", "state")), "Other");
  assert.equal(groupForHit(hit("sec-sip-I", "sip", "state")), "Other");
  assert.equal(groupForHit(hit("sec-26-C-FEDJJJJ", "26", "federal")), "Other"); // a federal-level row keyed to a state regulation: not a state row
  assert.equal(groupForHit(hit("x", null, "county")), "Other");
});

test("the key lists are the ones groupForHit consults", () => {
  assert.deepEqual([...FEDERAL_NSPS_REG_KEYS], ["ooooa", "oooob", "ooooc", "jjjj", "iiii"]);
  assert.deepEqual([...FEDERAL_NESHAP_REG_KEYS], ["zzzz"]);
  assert.equal(AQCC_REGULATION_KEYS.length, 33);
  assert.ok(AQCC_REGULATION_KEYS.includes("1") && AQCC_REGULATION_KEYS.includes("31") && !AQCC_REGULATION_KEYS.includes("32"));
});

// ---- groupHits / summariseGroups ------------------------------------------

test("groupHits: canonical rows lead, hits follow in retrieval order, caps hold, empty groups vanish", () => {
  const engines = QUESTION_MAPS.find((m) => m.key === "engines")!;
  const hits: GroupableHit[] = [
    hit("sec-gp12-I-A-1", "gp12", "state"),
    hit("sec-26-B-I-D-3", "26", "state"),
    hit("sec-gp12-I-A", "gp12", "state"), // canonical: never listed twice
    hit("sec-gp02-II-A", "gp02", "state"),
    hit("sec-gp06-I-A", "gp06", "state"),
    hit("sec-gp09-II", "gp09", "state"),
    hit("sec-gp11-I", "gp11", "state"), // 4th permit hit: over MAX_HITS_PER_GROUP
    hit("sec-ecmc-604", "ecmc", "state"),
    hit("sec-p192-192.3", "p192", "federal"),
    hit("sec-ecmc-912", "ecmc", "state"),
    hit("sec-ecmc-423", "ecmc", "state"),
    hit("sec-proc-I", "proc", "state"),
    hit("sec-sip-I", "sip", "state"), // 6th other: over MAX_OTHER_HITS
  ];
  // Only the rows the caller could fetch are listed (RLS / filters).
  const fetched = new Set(["sec-gp12-I-A", "sec-gp09-I-A", "sec-26-B-I-D", "sec-jjjj-60.4230"]);
  const g = groupHits(engines, hits, fetched);
  assert.deepEqual(
    g.groups.map((x) => x.group),
    ["General Permit options", "Colorado standards", "Federal NSPS"]
  );
  const permits = g.groups[0];
  assert.deepEqual(permits.canonical.map((p) => p.id), ["sec-gp12-I-A", "sec-gp09-I-A"]);
  assert.deepEqual(permits.hits.map((h) => h.id), ["sec-gp12-I-A-1", "sec-gp02-II-A", "sec-gp06-I-A"]);
  assert.equal(permits.hits.length, MAX_HITS_PER_GROUP);
  assert.deepEqual(g.groups[1].hits.map((h) => h.id), ["sec-26-B-I-D-3"]);
  assert.deepEqual(g.groups[2].canonical.map((p) => p.id), ["sec-jjjj-60.4230"]);
  assert.equal(g.groups[2].hits.length, 0);
  assert.deepEqual(g.other.map((h) => h.id), ["sec-ecmc-604", "sec-p192-192.3", "sec-ecmc-912", "sec-ecmc-423", "sec-proc-I"]);
  assert.equal(g.other.length, MAX_OTHER_HITS);

  const summary = summariseGroups(engines, g);
  assert.equal(summary.key, "engines");
  assert.equal(summary.name, engines.name);
  assert.equal(summary.factors, engines.factors);
  assert.deepEqual(summary.groups[0], {
    group: "General Permit options",
    provisions: ["sec-gp12-I-A", "sec-gp09-I-A", "sec-gp12-I-A-1", "sec-gp02-II-A", "sec-gp06-I-A"],
  });
  assert.deepEqual(summary.groups.at(-1), { group: "Other", provisions: g.other.map((h) => h.id) });

  // Without a fetched set every canonical row is listed (the API's view).
  const all = groupHits(engines, []);
  assert.deepEqual(all.groups.map((x) => x.group), MAP_GROUP_ORDER);
  assert.equal(all.groups.reduce((n, x) => n + x.canonical.length, 0), 22);
  assert.deepEqual(all.other, []);
  assert.equal(summariseGroups(engines, all).groups.length, 6);
});

// ---- the eval's map check --------------------------------------------------

const evalHit = (id: string) => ({ id });

test("evaluateQuestion: map expected as a string passes on that key and fails on another or none", () => {
  const q: EvalQuestion = { q: "x", expect: ["sec-26-"], map: "engines", note: "" };
  const hits = [evalHit("sec-26-B-I-D")];
  assert.equal(evaluateQuestion(q, hits, "engines").pass, true);
  const wrong = evaluateQuestion(q, hits, "compressors");
  assert.equal(wrong.pass, false);
  assert.match(wrong.failures[0], /routed to question map "compressors"; expected "engines"/);
  const none = evaluateQuestion(q, hits, null);
  assert.equal(none.pass, false);
  assert.match(none.failures[0], /routed to no question map; expected "engines"/);
  // Still rank 1: the map check is one more condition, not a replacement.
  assert.equal(none.matchRank, 1);
});

test("evaluateQuestion: map null fails when any map matched; absent map is never checked", () => {
  const q: EvalQuestion = { q: "x", expect: ["sec-7-"], map: null, note: "" };
  const hits = [evalHit("sec-7-B-II-J")];
  assert.equal(evaluateQuestion(q, hits, null).pass, true);
  const bad = evaluateQuestion(q, hits, "engines");
  assert.equal(bad.pass, false);
  assert.match(bad.failures[0], /routed to question map "engines"; expected none/);
  const unchecked: EvalQuestion = { q: "x", expect: ["sec-7-"], note: "" };
  assert.equal(evaluateQuestion(unchecked, hits, "engines").pass, true);
  assert.equal(evaluateQuestion(unchecked, hits).pass, true);
});

test("the four map-checked eval questions route as pinned, and KNOWN_FAILURES is exactly the civil-penalties question", () => {
  const pinned = EVAL_QUESTIONS.filter((e) => e.map !== undefined);
  assert.deepEqual(
    pinned.map((e) => [e.q, e.map]),
    [
      ["What are the emission standards for a new natural gas fired compressor engine?", "engines"],
      ["What venting and control requirements apply to a centrifugal compressor with wet seals?", null],
      ["What regulations apply to a natural gas-fired engine?", "engines"],
      ["What Colorado and federal requirements could apply to storage vessels?", null],
    ]
  );
  for (const e of pinned) assert.equal(matchQuestionMap(e.q)?.key ?? null, e.map, e.q);
  assert.deepEqual(KNOWN_FAILURES, ["How does the Division assess civil penalties for a violation?"]);
  for (const k of KNOWN_FAILURES) assert.ok(EVAL_QUESTIONS.some((e) => e.q === k), `${k} is not an eval question`);
});

// ---- the generated id list (corpus_qa.sql check 20) -------------------------

test("scripts/question-map-ids.sql is current: regenerate with `npx tsx scripts/question-map-ids.ts`", () => {
  const onDisk = readFileSync(QUESTION_MAP_IDS_SQL, "utf8");
  assert.equal(onDisk, renderQuestionMapIdsSql(), "scripts/question-map-ids.sql is stale: run `npx tsx scripts/question-map-ids.ts` and commit it");
  for (const m of QUESTION_MAPS) for (const p of m.provisions) assert.ok(onDisk.includes(`('${m.key}', '${p.id}')`), `${p.id} missing from the generated file`);
});
