/**
 * Question maps (Ask Track B, 1 Oct 2026; maps batch 2 and 3, 2 Oct 2026): routing, the group fallback for
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
  // Maps batch 2: GP06 (diesel RICE) joins the engines triggers.
  assert.equal(matchQuestionMap("GP06 registration for a diesel unit")?.key, "engines");
  assert.equal(matchQuestionMap("gp6")?.key, "engines");
});

// ---- maps batch 2 (2 Oct 2026) ---------------------------------------------

test("the storage-tanks map: its eval questions, GP08, a tank battery APEN question; never a bare tank", () => {
  assert.equal(matchQuestionMap("Do I need emission controls on a condensate storage tank at a well site?")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("What Colorado and federal requirements could apply to storage vessels?")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("storage vessels")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("GP08 tank controls")?.key, "storage-tanks");
  // Equipment before APEN: the tanks map carries the APEN rows for tanks.
  assert.equal(matchQuestionMap("APEN for my tank battery")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("thief hatch inspections")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("produced water tanks at a disposal well")?.key, "storage-tanks");
  // GP01 routes here through its acronym expansion ("condensate storage tank
  // batteries") and, since maps batch 3, its own trigger.
  assert.equal(matchQuestionMap("When is a GP01 required?")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("GP01 requirements")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("gp 1 tank battery")?.key, "storage-tanks");
  // A bare "tank" does not route: a tank truck at a bulk plant is Regulation 24.
  assert.equal(matchQuestionMap("tank truck at a bulk plant"), null);
  assert.equal(matchQuestionMap("What are the requirements for loading gasoline into a tank truck at a bulk plant?"), null);
  assert.equal(matchQuestionMap("flash tank"), null);
});

test("the pneumatic-controllers map routes its eval question and a bleed-rate question", () => {
  assert.equal(matchQuestionMap("Can I install a natural gas driven pneumatic controller at a new facility?")?.key, "pneumatic-controllers");
  assert.equal(matchQuestionMap("high-bleed controller replacement deadline")?.key, "pneumatic-controllers");
  assert.equal(matchQuestionMap("OOOOb process controller standards")?.key, "pneumatic-controllers");
  assert.equal(matchQuestionMap("pneumatic pump at a well site")?.key, "pneumatic-controllers");
  assert.equal(matchQuestionMap("intermittent vent controller inspection")?.key, "pneumatic-controllers");
});

test("the dehydrators map routes its eval question and 'dehy still vent'", () => {
  assert.equal(matchQuestionMap("What controls are required for a glycol dehydrator?")?.key, "dehydrators");
  assert.equal(matchQuestionMap("dehy still vent")?.key, "dehydrators");
  assert.equal(matchQuestionMap("reboiler emissions")?.key, "dehydrators");
  // "dehydrated" is not a dehydrator.
  assert.equal(matchQuestionMap("dehydrated gas pipeline"), null);
});

test("the apen map routes its two eval questions, last after the equipment maps", () => {
  assert.equal(matchQuestionMap("When do I have to file an APEN for a new source and what is the threshold?")?.key, "apen");
  assert.equal(matchQuestionMap("When does a source need a construction permit versus just an APEN?")?.key, "apen");
  assert.equal(matchQuestionMap("APEN exemptions for small sources")?.key, "apen");
  assert.equal(matchQuestionMap("air pollutant emission notice for a heater")?.key, "apen");
  assert.equal(matchQuestionMap("emission notices")?.key, "apen");
  // An APEN question that names mapped equipment takes the equipment map.
  assert.equal(matchQuestionMap("APEN for a natural gas engine")?.key, "engines");
  assert.equal(matchQuestionMap("APEN for a glycol dehydrator")?.key, "dehydrators");
  assert.equal(matchQuestionMap("APEN for a pneumatic controller")?.key, "pneumatic-controllers");
  assert.deepEqual(
    QUESTION_MAPS.map((m) => m.key),
    ["engines", "storage-tanks", "pneumatic-controllers", "dehydrators", "combustion-devices", "ldar", "general-permits", "apen"]
  );
});

test("compressor questions route to no map (unchanged by maps batch 3); word boundaries hold", () => {
  assert.equal(matchQuestionMap("centrifugal compressor wet seals"), null);
  assert.equal(matchQuestionMap("centrifugal compressor with wet seals"), null);
  assert.equal(matchQuestionMap("What venting and control requirements apply to a centrifugal compressor with wet seals?"), null);
  // Word boundaries: "engineering" is not an engine, and "control requirements" is not a control device.
  assert.equal(matchQuestionMap("engineering controls for dust"), null);
  // "GP20" is not an engine either; since maps batch 3 the general-permits
  // gp\d\d catch-all takes any permit number no earlier map claimed.
  assert.notEqual(matchQuestionMap("gp20")?.key, "engines");
  assert.equal(matchQuestionMap("gp20")?.key, "general-permits");
});

// ---- maps batch 3 (2 Oct 2026) ---------------------------------------------

test("the combustion-devices map routes its three eval questions, ECD in any case, and the control-device vocabulary", () => {
  assert.equal(matchQuestionMap("ECD testing requirements")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("ecd testing")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("flare testing")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("enclosed combustion device destruction efficiency")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("auto-igniter on a combustor")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("thermal oxidizer monitoring")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("vapor combustion unit")?.key, "combustion-devices");
  assert.equal(matchQuestionMap("flaring at a well pad")?.key, "combustion-devices");
});

test("equipment order: 'flare on my tank battery' is a tanks question (storage-tanks before combustion-devices)", () => {
  assert.equal(matchQuestionMap("flare on my tank battery")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("flare on my glycol dehydrator")?.key, "dehydrators");
  assert.equal(matchQuestionMap("flare on a natural gas engine site")?.key, "engines");
});

test("the ldar map routes its eval question, OGI, LDAR, AVO, fugitives and compressor stations", () => {
  assert.equal(matchQuestionMap("How often do I have to do leak inspections at a well production facility?")?.key, "ldar");
  assert.equal(matchQuestionMap("OGI survey frequency")?.key, "ldar");
  assert.equal(matchQuestionMap("LDAR at a compressor station")?.key, "ldar");
  assert.equal(matchQuestionMap("AVO inspection schedule")?.key, "ldar");
  assert.equal(matchQuestionMap("fugitive emissions components under OOOOb")?.key, "ldar");
  assert.equal(matchQuestionMap("Method 21 monitoring")?.key, "ldar");
  assert.equal(matchQuestionMap("infrared camera leak survey")?.key, "ldar");
  // A compressor station is an LDAR site; a compressor on its own is still no map.
  assert.equal(matchQuestionMap("natural gas compressor stations")?.key, "ldar");
  assert.equal(matchQuestionMap("compressor"), null);
});

test("the general-permits map: its eval question, GP03, GP11, 'which general permit'; GP02 stays engines and GP01 stays tanks", () => {
  assert.equal(matchQuestionMap("Which general permits can an oil and gas well production facility register under?")?.key, "general-permits");
  assert.equal(matchQuestionMap("GP03 dust permit")?.key, "general-permits");
  assert.equal(matchQuestionMap("gp11 venting")?.key, "general-permits");
  assert.equal(matchQuestionMap("which general permit do I need?")?.key, "general-permits");
  assert.equal(matchQuestionMap("which GP fits a loadout?")?.key, "general-permits");
  assert.equal(matchQuestionMap("can I register under a general permit")?.key, "general-permits");
  // The equipment maps claim their permit numbers first.
  assert.equal(matchQuestionMap("GP02 limits")?.key, "engines");
  assert.equal(matchQuestionMap("GP01 requirements")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("GP08 conditions")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("GP12 registration")?.key, "engines");
  // GP04 is inactive and GP07 is loadout; GP07 is a tanks trigger, GP04 falls to the catch-all.
  assert.equal(matchQuestionMap("GP07 loadout")?.key, "storage-tanks");
  assert.equal(matchQuestionMap("GP04")?.key, "general-permits");
});

test("maps batch 3: row counts, groups in display order, GP01 first among the tanks permits, the shared rows", () => {
  const byKey = Object.fromEntries(QUESTION_MAPS.map((m) => [m.key, m]));
  const groupsOf = (key: string) => [...new Set(byKey[key].provisions.map((p) => p.group))];
  // The tanks map gained GP01, first in its General Permit options group.
  assert.equal(byKey["storage-tanks"].provisions.length, 25);
  assert.deepEqual(
    byKey["storage-tanks"].provisions.filter((p) => p.group === "General Permit options").map((p) => p.id),
    ["sec-gp01-I-A", "sec-gp08-I-B", "sec-gp05-I-A", "sec-gp12-I-A-3", "sec-gp07-I-A"]
  );
  assert.equal(byKey["combustion-devices"].name, "Flares and enclosed combustion devices");
  assert.equal(byKey["combustion-devices"].provisions.length, 14);
  assert.deepEqual(groupsOf("combustion-devices"), ["Colorado standards", "Federal NSPS", "Definitions"]);
  // No "Enclosed combustion device" / "Flare" definition row exists in Reg 7 Part B: the two
  // definitions are II.A 'Air pollution control equipment' and 'Approved instrument monitoring method'.
  assert.deepEqual(
    byKey["combustion-devices"].provisions.filter((p) => p.group === "Definitions").map((p) => p.id),
    ["sec-7-B-II-A-1", "sec-7-B-II-A-2"]
  );
  assert.equal(byKey["ldar"].provisions.length, 25);
  assert.deepEqual(groupsOf("ldar"), ["General Permit options", "Colorado standards", "Federal NSPS", "Definitions"]);
  assert.equal(byKey["general-permits"].name, "APCD general permits: which one fits");
  assert.equal(byKey["general-permits"].provisions.length, 14);
  assert.deepEqual(groupsOf("general-permits"), ["Colorado permitting and APEN", "General Permit options"]);
  // Every active permit's applicability row is on the general-permits map; GP09/GP10 (closed) last.
  const permits = byKey["general-permits"].provisions.filter((p) => p.group === "General Permit options").map((p) => p.id);
  for (const n of ["01", "02", "03", "05", "06", "07", "08", "09", "10", "11", "12"]) assert.ok(permits.some((id) => id.startsWith(`sec-gp${n}-`)), `GP${n} missing`);
  assert.deepEqual(permits.slice(-2), ["sec-gp09-I-A", "sec-gp10-I-A"]);
  // Every map's groups are in MAP_GROUP_ORDER order (repeated here for the new maps).
  for (const m of QUESTION_MAPS) {
    const idx = groupsOf(m.key).map((g) => MAP_GROUP_ORDER.indexOf(g));
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${m.key}: groups out of display order`);
  }
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

test("the engines map lists its 23 rows in the plan's order, six groups, GP06 after GP02, GP09/GP10 last among the permits", () => {
  const engines = QUESTION_MAPS.find((m) => m.key === "engines");
  assert.ok(engines);
  assert.equal(engines.name, "Natural gas-fired and diesel engines");
  assert.equal(engines.provisions.length, 23);
  assert.ok(engines.provisions.some((p) => p.id === "sec-gp06-I-A"));
  assert.deepEqual(
    engines.provisions.filter((p) => p.group === "General Permit options").map((p) => p.id),
    ["sec-gp12-I-A", "sec-gp02-I-A", "sec-gp06-I-A", "sec-gp09-I-A", "sec-gp10-I-A"]
  );
  assert.deepEqual(
    [...new Set(engines.provisions.map((p) => p.group))],
    MAP_GROUP_ORDER
  );
  assert.ok(engines.provisions.some((p) => p.id === "sec-jjjj-60.4230"));
  assert.ok(engines.provisions.some((p) => p.id === "sec-zzzz-63.6585"));
});

test("maps batch 2: row counts, groups in display order, the two empty Federal NESHAP groups, the shared APEN rows", () => {
  const byKey = Object.fromEntries(QUESTION_MAPS.map((m) => [m.key, m]));
  const groupsOf = (key: string) => [...new Set(byKey[key].provisions.map((p) => p.group))];
  assert.equal(byKey["storage-tanks"].provisions.length, 25); // 24 in batch 2, GP01 added in batch 3
  assert.deepEqual(groupsOf("storage-tanks"), ["Colorado permitting and APEN", "General Permit options", "Colorado standards", "Federal NSPS", "Definitions"]);
  assert.equal(byKey["pneumatic-controllers"].provisions.length, 19);
  assert.deepEqual(groupsOf("pneumatic-controllers"), ["Colorado standards", "Federal NSPS", "Definitions"]);
  assert.equal(byKey["dehydrators"].provisions.length, 10);
  assert.deepEqual(groupsOf("dehydrators"), ["Colorado permitting and APEN", "Colorado standards", "Definitions"]);
  assert.equal(byKey["apen"].provisions.length, 15);
  assert.deepEqual(groupsOf("apen"), ["Colorado permitting and APEN", "Definitions"]);
  // Subpart HH is not in the corpus: no Federal NESHAP row on the tanks or dehydrator map (left empty on purpose).
  for (const key of ["storage-tanks", "dehydrators"]) assert.ok(!byKey[key].provisions.some((p) => p.group === "Federal NESHAP"), key);
  // Subpart Kb is only Regulation 6's adoption stub, so it is a Colorado standards row.
  assert.equal(byKey["storage-tanks"].provisions.find((p) => p.id === "sec-6-A-SUBPART-Kb")?.group, "Colorado standards");
  // The APEN basics lead the tanks, dehydrator and apen maps alike.
  for (const key of ["storage-tanks", "dehydrators", "apen"]) {
    assert.deepEqual(byKey[key].provisions.slice(0, 2).map((p) => p.id), ["sec-3-A-II-A", "sec-3-A-II-B-3"], key);
  }
  // Every map's groups are in MAP_GROUP_ORDER order.
  for (const m of QUESTION_MAPS) {
    const idx = groupsOf(m.key).map((g) => MAP_GROUP_ORDER.indexOf(g));
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `${m.key}: groups out of display order`);
  }
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
    hit("sec-gp06-II-A", "gp06", "state"),
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
  assert.deepEqual(permits.hits.map((h) => h.id), ["sec-gp12-I-A-1", "sec-gp02-II-A", "sec-gp06-II-A"]);
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
    provisions: ["sec-gp12-I-A", "sec-gp09-I-A", "sec-gp12-I-A-1", "sec-gp02-II-A", "sec-gp06-II-A"],
  });
  assert.deepEqual(summary.groups.at(-1), { group: "Other", provisions: g.other.map((h) => h.id) });

  // Without a fetched set every canonical row is listed (the API's view).
  const all = groupHits(engines, []);
  assert.deepEqual(all.groups.map((x) => x.group), MAP_GROUP_ORDER);
  assert.equal(all.groups.reduce((n, x) => n + x.canonical.length, 0), 23);
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

test("the sixteen map-checked eval questions route as pinned (28 questions), and KNOWN_FAILURES is exactly the civil-penalties question", () => {
  assert.equal(EVAL_QUESTIONS.length, 28);
  const pinned = EVAL_QUESTIONS.filter((e) => e.map !== undefined);
  assert.equal(pinned.length, 16);
  assert.deepEqual(
    pinned.map((e) => [e.q, e.map]),
    [
      ["Do I need emission controls on a condensate storage tank at a well site?", "storage-tanks"],
      ["How often do I have to do leak inspections at a well production facility?", "ldar"],
      ["Can I install a natural gas driven pneumatic controller at a new facility?", "pneumatic-controllers"],
      ["When do I have to file an APEN for a new source and what is the threshold?", "apen"],
      ["What are the emission standards for a new natural gas fired compressor engine?", "engines"],
      ["What controls are required for a glycol dehydrator?", "dehydrators"],
      ["What venting and control requirements apply to a centrifugal compressor with wet seals?", null],
      ["When does a source need a construction permit versus just an APEN?", "apen"],
      ["ECD testing requirements", "combustion-devices"],
      ["ecd testing", "combustion-devices"],
      ["flare testing", "combustion-devices"],
      ["What are the requirements for loading gasoline into a tank truck at a bulk plant?", null],
      ["Which general permits can an oil and gas well production facility register under?", "general-permits"],
      ["When is a GP01 required?", "storage-tanks"],
      ["What regulations apply to a natural gas-fired engine?", "engines"],
      ["What Colorado and federal requirements could apply to storage vessels?", "storage-tanks"],
    ]
  );
  // The new general-permits question sits last in the original block, before the reviewer questions.
  assert.equal(EVAL_QUESTIONS[24].q, "Which general permits can an oil and gas well production facility register under?");
  assert.equal(EVAL_QUESTIONS[25].q, "When is a GP01 required?");
  // Every map has at least one eval question pinned to it.
  for (const m of QUESTION_MAPS) assert.ok(pinned.some((e) => e.map === m.key), `${m.key}: no eval question pinned`);
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
