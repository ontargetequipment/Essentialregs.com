/**
 * Question maps (Ask Track B, 1 Oct 2026; maps batch 2, 3 and 4, 2 Oct 2026): routing, the group fallback for
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
  ECMC_REG_KEYS,
  FEDERAL_NESHAP_REG_KEYS,
  FEDERAL_NSPS_REG_KEYS,
  MAP_GROUP_ORDER,
  PHMSA_REG_KEYS,
  MAX_HITS_PER_GROUP,
  MAX_OTHER_HITS,
  QUESTION_MAPS,
  groupForHit,
  groupHits,
  layoutAsk,
  matchQuestionMap,
  summariseGroups,
  type GroupableHit,
} from "../src/lib/question-maps";
import { EVAL_QUESTIONS, FACET_FETCH_FACTOR, KNOWN_FAILURES, evaluateQuestion, rowsNeeded, statesFacet, type EvalQuestion } from "../src/lib/semantic-eval";
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
  // Review 4 (7 Oct 2026): a "is GP01 required" question takes the GP01 premise map first.
  assert.equal(matchQuestionMap("When is a GP01 required?")?.key, "premise-gp01");
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
    ["engines", "storage-tanks", "pneumatic-controllers", "dehydrators", "combustion-devices", "ldar", "enforcement", "general-permits", "apen"]
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

// ---- maps batch 4 (2 Oct 2026) ---------------------------------------------

test("the enforcement map routes its two eval questions, the APEN penalty question and the enforcement vocabulary; a bare 'violation' does not", () => {
  assert.equal(matchQuestionMap("How does the Division assess civil penalties for a violation?")?.key, "enforcement");
  assert.equal(matchQuestionMap("What is the maximum civil penalty per day for violating an AQCC regulation?")?.key, "enforcement");
  assert.equal(matchQuestionMap("What is the maximum PHMSA civil penalty for a pipeline safety violation?")?.key, "enforcement");
  // Before the generic APEN map: the penalty is the question, not the notice.
  assert.equal(matchQuestionMap("what is the penalty for not filing an APEN")?.key, "enforcement");
  assert.equal(matchQuestionMap("NOAV response deadline")?.key, "enforcement");
  assert.equal(matchQuestionMap("notice of alleged violation")?.key, "enforcement");
  assert.equal(matchQuestionMap("notice of probable violation")?.key, "enforcement");
  assert.equal(matchQuestionMap("compliance advisory from the Division")?.key, "enforcement");
  assert.equal(matchQuestionMap("order finding violation")?.key, "enforcement");
  assert.equal(matchQuestionMap("OFV hearing")?.key, "enforcement");
  assert.equal(matchQuestionMap("cease and desist order")?.key, "enforcement");
  assert.equal(matchQuestionMap("cease-and-desist")?.key, "enforcement");
  assert.equal(matchQuestionMap("consent order terms")?.key, "enforcement");
  assert.equal(matchQuestionMap("administrative order on consent")?.key, "enforcement");
  assert.equal(matchQuestionMap("AOC payment schedule")?.key, "enforcement");
  assert.equal(matchQuestionMap("enforcement proceedings")?.key, "enforcement");
  assert.equal(matchQuestionMap("enforcement")?.key, "enforcement");
  // A bare "violation" must not trigger: the odor question is Regulation 2.
  assert.equal(matchQuestionMap("How is an odor violation measured with dilutions?"), null);
  assert.equal(matchQuestionMap("violation"), null);
  // Equipment first: an LDAR enforcement question stays on the ldar map; GP02 stays engines.
  assert.equal(matchQuestionMap("LDAR enforcement")?.key, "ldar");
  assert.equal(matchQuestionMap("Do I need a GP02 permit for my engine?")?.key, "premise-gp02"); // a premise question since review 4
  assert.equal(matchQuestionMap("GP02 permit conditions for my engine?")?.key, "engines");
});

test("maps batch 4: the enforcement map's 21 rows in four groups, in display order, CP III.A among the first Colorado rows", () => {
  const enforcement = QUESTION_MAPS.find((m) => m.key === "enforcement");
  assert.ok(enforcement);
  assert.equal(enforcement.name, "Enforcement and penalties: APCD, ECMC and PHMSA");
  assert.equal(enforcement.provisions.length, 21);
  assert.deepEqual(
    [...new Set(enforcement.provisions.map((p) => p.group))],
    ["General Permit options", "Colorado standards", "ECMC rules", "Federal PHMSA"]
  );
  assert.deepEqual(
    enforcement.provisions.filter((p) => p.group === "Colorado standards").map((p) => p.id),
    ["sec-cp-III", "sec-cp-III-A", "sec-cp-III-B-1", "sec-cp-III-B-3", "sec-proc-A-VI-D-1"]
  );
  assert.equal(enforcement.provisions.filter((p) => p.group === "ECMC rules").length, 7);
  assert.equal(enforcement.provisions.filter((p) => p.group === "Federal PHMSA").length, 7);
  assert.ok(enforcement.provisions.every((p) => p.group !== "ECMC rules" || p.id.startsWith("sec-ecmc-")));
  assert.ok(enforcement.provisions.every((p) => p.group !== "Federal PHMSA" || /^sec-p19\d-/.test(p.id)));
  // The two batch-4 groups sit after Federal NESHAP and before Definitions;
  // the two premise groups (review 4, 7 Oct 2026) open the order.
  assert.deepEqual(MAP_GROUP_ORDER.slice(6), ["Federal NESHAP", "ECMC rules", "Federal PHMSA", "Definitions"]);
  assert.deepEqual(MAP_GROUP_ORDER.slice(0, 3), ["Permit applicability", "Colorado permitting and APEN", "Alternatives if the permit does not fit"]);
  assert.equal(MAP_GROUP_ORDER.length, 10);
});

test("maps batch 3: row counts, groups in display order, GP01 first among the tanks permits, the shared rows", () => {
  const byKey = Object.fromEntries(QUESTION_MAPS.map((m) => [m.key, m]));
  const groupsOf = (key: string) => [...new Set(byKey[key].provisions.map((p) => p.group))];
  // The tanks map gained GP01, first in its General Permit options group; the original OOOO added three rows (8 Oct 2026).
  assert.equal(byKey["storage-tanks"].provisions.length, 28);
  assert.deepEqual(
    byKey["storage-tanks"].provisions.filter((p) => p.group === "General Permit options").map((p) => p.id),
    ["sec-gp01-I-A", "sec-gp08-I-B", "sec-gp05-I-A", "sec-gp12-I-A-3", "sec-gp07-I-A"]
  );
  assert.equal(byKey["combustion-devices"].name, "Flares and enclosed combustion devices");
  assert.equal(byKey["combustion-devices"].provisions.length, 16); // two OOOO rows, 8 Oct 2026
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
  // The six air groups (maps batch 4 added ECMC rules and Federal PHMSA to
  // MAP_GROUP_ORDER; no engines row lives there).
  assert.deepEqual(
    [...new Set(engines.provisions.map((p) => p.group))],
    AIR_GROUPS
  );
  assert.ok(engines.provisions.some((p) => p.id === "sec-jjjj-60.4230"));
  assert.ok(engines.provisions.some((p) => p.id === "sec-zzzz-63.6585"));
});

test("maps batch 2: row counts, groups in display order, the two empty Federal NESHAP groups, the shared APEN rows", () => {
  const byKey = Object.fromEntries(QUESTION_MAPS.map((m) => [m.key, m]));
  const groupsOf = (key: string) => [...new Set(byKey[key].provisions.map((p) => p.group))];
  assert.equal(byKey["storage-tanks"].provisions.length, 28); // 24 in batch 2, GP01 added in batch 3, three OOOO rows 8 Oct 2026
  assert.deepEqual(groupsOf("storage-tanks"), ["Colorado permitting and APEN", "General Permit options", "Colorado standards", "Federal NSPS", "Definitions"]);
  assert.equal(byKey["pneumatic-controllers"].provisions.length, 21); // two OOOO rows, 8 Oct 2026
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

/** MAP_GROUP_ORDER without the two groups maps batch 4 added: the groups an air map can fill. */
const PREMISE_GROUPS = ["Permit applicability", "Alternatives if the permit does not fit"];
const AIR_GROUPS = MAP_GROUP_ORDER.filter((g) => g !== "ECMC rules" && g !== "Federal PHMSA" && !PREMISE_GROUPS.includes(g));

// ---- groupForHit -----------------------------------------------------------

const hit = (id: string, reg_key: string | null, jurisdiction_level: string, extra: Partial<GroupableHit> = {}): GroupableHit => ({
  id,
  reg_key,
  jurisdiction_level,
  title: extra.title ?? id,
  path: extra.path ?? null,
});

test("groupForHit routes one row per group, a Definitions row, the ECMC and PHMSA groups, and an Other row", () => {
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
  // Maps batch 4: ECMC and PHMSA rows have groups of their own.
  assert.equal(groupForHit(hit("sec-ecmc-604", "ecmc", "state")), "ECMC rules");
  assert.equal(groupForHit(hit("sec-ecmc-525-c", "ecmc", "state")), "ECMC rules");
  assert.equal(groupForHit(hit("sec-p192-192.3", "p192", "federal")), "Federal PHMSA");
  assert.equal(groupForHit(hit("sec-p190-190.223", "p190", "federal")), "Federal PHMSA");
  assert.equal(groupForHit(hit("sec-p196-196.205", "p196", "federal")), "Federal PHMSA");
  // Everything else: proc, sip and county rows stay "Other".
  assert.equal(groupForHit(hit("sec-proc-I", "proc", "state")), "Other");
  assert.equal(groupForHit(hit("sec-sip-I", "sip", "state")), "Other");
  // A federal-level row keyed to a state regulation is not a state row. None
  // exists since the Reg 26 Subpart JJJJ copy was removed (4 Oct 2026); the
  // rule stays so a re-import cannot file one under "Colorado standards".
  assert.equal(groupForHit(hit("sec-26-X-hypothetical", "26", "federal")), "Other");
  assert.equal(groupForHit(hit("x", null, "county")), "Other");
});

test("the key lists are the ones groupForHit consults", () => {
  assert.deepEqual([...FEDERAL_NSPS_REG_KEYS], ["oooo", "ooooa", "oooob", "ooooc", "jjjj", "iiii"]);
  assert.deepEqual([...FEDERAL_NESHAP_REG_KEYS], ["zzzz"]);
  assert.deepEqual([...ECMC_REG_KEYS], ["ecmc"]);
  assert.deepEqual([...PHMSA_REG_KEYS], ["p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"]);
  for (const k of PHMSA_REG_KEYS) assert.match(k, /^p19\d$/);
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
    hit("sec-ecmc-604", "ecmc", "state"), // maps batch 4: ECMC rules, a group of its own
    hit("sec-p192-192.3", "p192", "federal"), // maps batch 4: Federal PHMSA
    hit("sec-ecmc-912", "ecmc", "state"),
    hit("sec-ecmc-423", "ecmc", "state"),
    hit("sec-ecmc-1105", "ecmc", "state"), // 4th ECMC hit: over MAX_HITS_PER_GROUP
    hit("sec-proc-I", "proc", "state"),
    hit("sec-sip-I", "sip", "state"),
    hit("sec-sip-II", "sip", "state"),
    hit("sec-sip-III", "sip", "state"),
    hit("sec-26-X-hypothetical", "26", "federal"), // a federal-level row keyed to a state regulation: still Other
    hit("x", null, "county"), // 6th other: over MAX_OTHER_HITS
  ];
  // Only the rows the caller could fetch are listed (RLS / filters).
  const fetched = new Set(["sec-gp12-I-A", "sec-gp09-I-A", "sec-26-B-I-D", "sec-jjjj-60.4230"]);
  const g = groupHits(engines, hits, fetched);
  assert.deepEqual(
    g.groups.map((x) => x.group),
    ["General Permit options", "Colorado standards", "Federal NSPS", "ECMC rules", "Federal PHMSA"]
  );
  const permits = g.groups[0];
  assert.deepEqual(permits.canonical.map((p) => p.id), ["sec-gp12-I-A", "sec-gp09-I-A"]);
  assert.deepEqual(permits.hits.map((h) => h.id), ["sec-gp12-I-A-1", "sec-gp02-II-A", "sec-gp06-II-A"]);
  assert.equal(permits.hits.length, MAX_HITS_PER_GROUP);
  assert.deepEqual(g.groups[1].hits.map((h) => h.id), ["sec-26-B-I-D-3"]);
  assert.deepEqual(g.groups[2].canonical.map((p) => p.id), ["sec-jjjj-60.4230"]);
  assert.equal(g.groups[2].hits.length, 0);
  // The ECMC and PHMSA hits are named groups on an air map too (no canonical row, hits only, capped).
  assert.deepEqual(g.groups[3].canonical, []);
  assert.deepEqual(g.groups[3].hits.map((h) => h.id), ["sec-ecmc-604", "sec-ecmc-912", "sec-ecmc-423"]);
  assert.deepEqual(g.groups[4].canonical, []);
  assert.deepEqual(g.groups[4].hits.map((h) => h.id), ["sec-p192-192.3"]);
  assert.deepEqual(g.other.map((h) => h.id), ["sec-proc-I", "sec-sip-I", "sec-sip-II", "sec-sip-III", "sec-26-X-hypothetical"]);
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
  assert.deepEqual(all.groups.map((x) => x.group), AIR_GROUPS);
  assert.equal(all.groups.reduce((n, x) => n + x.canonical.length, 0), 23);
  assert.deepEqual(all.other, []);
  assert.equal(summariseGroups(engines, all).groups.length, 6);

  // Maps batch 4: on the enforcement map the ECMC and PHMSA rows are canonical and lead their groups.
  const enforcement = QUESTION_MAPS.find((m) => m.key === "enforcement")!;
  const e = groupHits(enforcement, [hit("sec-ecmc-525-b-(7)", "ecmc", "state"), hit("sec-p190-190.213-(a)-(2)", "p190", "federal"), hit("sec-cp-III-B-2", "cp", "state")]);
  assert.deepEqual(e.groups.map((x) => x.group), ["General Permit options", "Colorado standards", "ECMC rules", "Federal PHMSA"]);
  assert.deepEqual(e.groups[1].canonical.slice(0, 2).map((p) => p.id), ["sec-cp-III", "sec-cp-III-A"]);
  assert.deepEqual(e.groups[1].hits.map((h) => h.id), ["sec-cp-III-B-2"]);
  assert.deepEqual(e.groups[2].canonical.map((p) => p.id).slice(0, 2), ["sec-ecmc-523-a", "sec-ecmc-523-c"]);
  assert.deepEqual(e.groups[2].hits.map((h) => h.id), ["sec-ecmc-525-b-(7)"]);
  assert.deepEqual(e.groups[3].hits.map((h) => h.id), ["sec-p190-190.213-(a)-(2)"]);
  assert.deepEqual(e.other, []);
});

test("groupHits: groups with a canonical row come before hits-only groups, each run in MAP_GROUP_ORDER", () => {
  // The civil-penalties page (3 Oct 2026): one Regulation 3 retrieval hit
  // used to open "Colorado permitting and APEN" above the enforcement map's
  // own groups. Hits-only groups now follow every group that carries a
  // canonical row, and both runs keep MAP_GROUP_ORDER.
  const enforcement = QUESTION_MAPS.find((m) => m.key === "enforcement")!;
  const hits: GroupableHit[] = [
    hit("sec-3-B-II-A", "3", "state"), // Colorado permitting and APEN: no canonical row on this map
    hit("sec-7-B-I-D-3", "7", "state"), // Colorado standards: canonical rows exist
    hit("sec-ecmc-525-b-(7)", "ecmc", "state"),
    hit("sec-jjjj-60.4230", "jjjj", "federal"), // Federal NSPS: hits only
    hit("sec-proc-I", "proc", "state"), // Other
  ];
  const g = groupHits(enforcement, hits);
  assert.deepEqual(
    g.groups.map((x) => x.group),
    ["General Permit options", "Colorado standards", "ECMC rules", "Federal PHMSA", "Colorado permitting and APEN", "Federal NSPS"]
  );
  assert.ok(g.groups[0].canonical.length > 0);
  assert.deepEqual(g.groups[1].hits.map((h) => h.id), ["sec-7-B-I-D-3"]);
  assert.deepEqual(g.groups[2].hits.map((h) => h.id), ["sec-ecmc-525-b-(7)"]);
  assert.deepEqual(g.groups[4], { group: "Colorado permitting and APEN", canonical: [], hits: [hits[0]] });
  assert.deepEqual(g.groups[5], { group: "Federal NSPS", canonical: [], hits: [hits[3]] });
  assert.deepEqual(g.other.map((h) => h.id), ["sec-proc-I"]);
  // The API's summary follows the same order, "Other" last.
  assert.deepEqual(
    summariseGroups(enforcement, g).groups.map((x) => x.group),
    [...g.groups.map((x) => x.group), "Other"]
  );

  // RLS / filters can empty a group of its canonical rows: it then sorts as hits-only.
  const fetched = new Set(["sec-cp-III", "sec-cp-III-A"]);
  const limited = groupHits(enforcement, [hit("sec-gp01-I-A-2", "gp01", "state"), hit("sec-3-B-II-A", "3", "state")], fetched);
  assert.deepEqual(limited.groups.map((x) => x.group), ["Colorado standards", "Colorado permitting and APEN", "General Permit options"]);
  assert.deepEqual(limited.groups[2], { group: "General Permit options", canonical: [], hits: [limited.groups[2].hits[0]] });
  assert.equal(limited.groups[2].hits[0].id, "sec-gp01-I-A-2");
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

test("evaluateQuestion: the hits a stated fact left out are not scored (7 Oct 2026, GP06 III.E.1 third for the natural-gas compressor question)", () => {
  const q = EVAL_QUESTIONS.find((e) => e.q === "What are the emission standards for a new natural gas fired compressor engine?")!;
  // The raw top five the Ask eval saw after the chained run's rewrite: four
  // diesel rows and GP12 XII.E; the Regulation 26 row sits sixth.
  const raw = [
    hit("sec-iiii-60.4205", "iiii", "federal"),
    hit("sec-iiii-60.4204", "iiii", "federal"),
    hit("sec-gp06-III-E-1", "gp06", "state"),
    hit("sec-iiii-TABLE-4", "iiii", "federal"),
    hit("sec-gp12-XII-E", "gp12", "state"),
    hit("sec-26-B-I-D-6-a-(i)", "26", "state"),
    hit("sec-jjjj-60.4233", "jjjj", "federal"),
  ];
  const layout = layoutAsk(q.q, raw);
  assert.equal(layout.map?.key, "engines");
  // (canonical omissions are listed before the hits', so compare as a set)
  assert.deepEqual(layout.summary?.omittedIds.filter((id) => raw.some((h) => h.id === id)).sort(), ["sec-gp06-III-E-1", "sec-iiii-60.4204", "sec-iiii-60.4205", "sec-iiii-TABLE-4"]);
  const shown = { ids: layout.shownIds, noteKey: null, title: layout.summary?.title ?? null, omittedIds: layout.summary?.omittedIds ?? [] };
  // Scored as the page lists them: GP12 XII.E first, Regulation 26 second.
  assert.deepEqual(evaluateQuestion(q, raw, "engines", shown), { pass: true, matchRank: 2, failures: [] });
  // Without the omissions the raw top five has no Regulation 26 or JJJJ row.
  const rawScore = evaluateQuestion(q, raw, "engines", { ...shown, omittedIds: [] });
  assert.equal(rawScore.pass, false);
  assert.match(rawScore.failures.join("\n"), /none of sec-26-A, sec-26-B-I, sec-26-B-II, sec-jjjj in the top 5$/m);
  // The failure line says the filter was applied when it was.
  const still = evaluateQuestion(q, raw.slice(0, 5), "engines", shown);
  assert.match(still.failures.join("\n"), /in the top 5 \(after the stated-fact filter\)/);
  // A forbid window is counted the same way: a GP02 hit (a reg key the
  // natural-gas value owns) in the raw top 3 is left out for a diesel
  // question, so it is not forbidden either.
  const diesel: EvalQuestion = { q: "What applies to a diesel engine?", expect: ["sec-gp06-"], forbid: ["sec-gp02-"], forbidTopN: 3, note: "" };
  const dieselHits = [hit("sec-gp02-II-A-1", "gp02", "state"), hit("sec-gp06-I-A", "gp06", "state")];
  const dieselLayout = layoutAsk(diesel.q, dieselHits);
  assert.equal(evaluateQuestion(diesel, dieselHits, "engines", { ids: dieselLayout.shownIds, noteKey: null, title: null, omittedIds: dieselLayout.summary?.omittedIds ?? [] }).pass, true);
  assert.equal(evaluateQuestion(diesel, dieselHits, "engines").pass, false);
});

test("rowsNeeded fetches FACET_FETCH_FACTOR times the window when the question states a facet", () => {
  assert.equal(FACET_FETCH_FACTOR, 3);
  assert.equal(statesFacet("What are the emission standards for a new natural gas fired compressor engine?"), true);
  assert.equal(statesFacet("What applies to a diesel engine?"), true);
  assert.equal(statesFacet("What rules apply to a produced water storage tank at a well site?"), true);
  // Both fuels, or no map facet: not stated.
  assert.equal(statesFacet("natural gas or diesel engine"), false);
  assert.equal(statesFacet("When do I have to file an APEN for a new source and what is the threshold?"), false);
  assert.equal(statesFacet("x"), false);
  const compressor = EVAL_QUESTIONS.find((e) => e.q === "What are the emission standards for a new natural gas fired compressor engine?")!;
  assert.equal(rowsNeeded(compressor), 15);
  const engine = EVAL_QUESTIONS.find((e) => e.q === "What regulations apply to a natural gas-fired engine?")!;
  assert.equal(rowsNeeded(engine), 30);
  const apen = EVAL_QUESTIONS.find((e) => e.q === "When do I have to file an APEN for a new source and what is the threshold?")!;
  assert.equal(rowsNeeded(apen), 5);
});

test("the twenty-six map-checked eval questions route as pinned (37 questions), and KNOWN_FAILURES is empty", () => {
  assert.equal(EVAL_QUESTIONS.length, 37);
  const pinned = EVAL_QUESTIONS.filter((e) => e.map !== undefined);
  assert.equal(pinned.length, 26);
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
      ["How does the Division assess civil penalties for a violation?", "enforcement"],
      ["ECD testing requirements", "combustion-devices"],
      ["ecd testing", "combustion-devices"],
      ["flare testing", "combustion-devices"],
      ["What are the requirements for loading gasoline into a tank truck at a bulk plant?", null],
      ["Which general permits can an oil and gas well production facility register under?", "general-permits"],
      ["What is the maximum civil penalty per day for violating an AQCC regulation?", "enforcement"],
      ["When is a GP01 required?", "premise-gp01"],
      ["What regulations apply to a natural gas-fired engine?", "engines"],
      ["What Colorado and federal requirements could apply to storage vessels?", "storage-tanks"],
      ["Do I need a GP12?", "premise-gp12"],
      ["What applies to a diesel engine?", "engines"],
      ["What rules apply to a produced water storage tank at a well site?", "storage-tanks"],
      ["Do I need an APEN for every emission point at my site?", "premise-apen-every-point"],
      ["Does my well site need a Title V operating permit?", "premise-title-v-well-site"],
      ["If my tank battery is exempt from a construction permit, does Regulation 7 still apply?", "premise-exempt-still-regulated"],
      ["Does OOOOb apply to an existing well drilled before 2022?", "premise-oooob-existing-well"],
      ["Can I register a diesel engine under GP02?", "premise-gp02-diesel"],
    ]
  );
  // The general-permits question and the new per-day-maximum question (the 29th) close the original block, before the reviewer questions.
  assert.equal(EVAL_QUESTIONS[24].q, "Which general permits can an oil and gas well production facility register under?");
  assert.equal(EVAL_QUESTIONS[25].q, "What is the maximum civil penalty per day for violating an AQCC regulation?");
  assert.equal(EVAL_QUESTIONS[26].q, "When is a GP01 required?");
  // The civil-penalties question now expects either Colorado penalty section and is pinned to the enforcement map.
  const civil = EVAL_QUESTIONS.find((e) => e.q === "How does the Division assess civil penalties for a violation?");
  assert.deepEqual(civil?.expect, ["sec-cp-III", "sec-ecmc-525"]);
  assert.equal(civil?.map, "enforcement");
  // Every map has at least one eval question pinned to it (maps batch 4: enforcement included).
  assert.ok(QUESTION_MAPS.some((m) => m.key === "enforcement"));
  for (const m of QUESTION_MAPS) assert.ok(pinned.some((e) => e.map === m.key), `${m.key}: no eval question pinned`);
  // The one storage-tanks premise question moved to its premise map; the tanks map keeps three pinned questions.
  assert.equal(pinned.filter((e) => e.map === "storage-tanks").length, 3);
  for (const e of pinned) assert.equal(matchQuestionMap(e.q)?.key ?? null, e.map, e.q);
  // Maps batch 4 closed the one known failure: the gate is 29/29.
  assert.deepEqual(KNOWN_FAILURES, []);
  for (const k of KNOWN_FAILURES) assert.ok(EVAL_QUESTIONS.some((e) => e.q === k), `${k} is not an eval question`);
});

// ---- the generated id list (corpus_qa.sql check 20) -------------------------

test("scripts/question-map-ids.sql is current: regenerate with `npx tsx scripts/question-map-ids.ts`", () => {
  const onDisk = readFileSync(QUESTION_MAP_IDS_SQL, "utf8");
  assert.equal(onDisk, renderQuestionMapIdsSql(), "scripts/question-map-ids.sql is stale: run `npx tsx scripts/question-map-ids.ts` and commit it");
  for (const m of QUESTION_MAPS) for (const p of m.provisions) assert.ok(onDisk.includes(`('${m.key}', '${p.id}')`), `${p.id} missing from the generated file`);
});
