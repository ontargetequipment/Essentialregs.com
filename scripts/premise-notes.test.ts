/**
 * Premise notes and stated-fact facets (review 4, 7 Oct 2026): the
 * misconception matcher, the eleven curated notes and their citations, the
 * premise maps, the facet detection and filtering, the shown-order layout
 * the page and the eval share, and the eval's new checks. No database, no
 * Next.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PERMIT_NOTES,
  PREMISE_GP_NUMBERS,
  PREMISE_NOTES,
  TOPIC_NOTES,
  citeLabel,
  citeRegKey,
  matchPremiseNote,
  premisePermitNumber,
} from "../src/lib/premise-notes";
import {
  FACETS,
  MAP_GROUP_ORDER,
  QUESTION_MAPS,
  detectFacets,
  groupHits,
  hitMatchesFacets,
  layoutAsk,
  mapTitle,
  matchQuestionMap,
  omittedLines,
  rowMatchesFacets,
  summariseGroups,
  type GroupableHit,
} from "../src/lib/question-maps";
import { isClosedPermit } from "../src/lib/regulation-pure";
import { EVAL_QUESTIONS, evaluateQuestion, type EvalQuestion } from "../src/lib/semantic-eval";
import { QUESTION_MAP_IDS_SQL } from "./question-map-ids";

const hit = (id: string, reg_key: string | null, jurisdiction_level = "state", title = ""): GroupableHit => ({ id, reg_key, jurisdiction_level, title });

// ---- the matcher -------------------------------------------------------------

test("the requirement patterns match the reviewer's question and its close variants, for every permit", () => {
  const yes: [string, string][] = [
    ["When is a GP01 required?", "01"],
    ["when is gp01 required", "01"],
    ["Is GP01 mandatory?", "01"],
    ["GP01 required?", "01"],
    ["is a GP01 ever required for a tank battery", "01"],
    ["Do I need a GP12?", "12"],
    ["do i need a gp12 for my well pad", "12"],
    ["Does my tank battery need a GP01?", "01"],
    ["Do I have to register under GP01?", "01"],
    ["Am I required to get a GP08?", "08"],
    ["my engine requires a GP02", "02"],
    ["when does GP12 become required", "12"],
    ["Is GP-09 still required", "09"],
    ["gp 1 required", "01"],
    ["do we need gp11 for blowdowns", "11"],
    ["Would I need a GP06 for a diesel generator?", "06"],
    ["Is registration under GP02 mandatory?", "02"],
    ["is a GP03 permit needed for grading", "03"],
    ["Is GP05 necessary for produced water tanks?", "05"],
    ["must I have a GP07 for truck loading", "07"],
    ["Do I need GP10 for a well production facility in the nonattainment area?", "10"],
    ["Is a GP01 a requirement for condensate tanks?", "01"],
  ];
  for (const [q, n] of yes) assert.equal(premisePermitNumber(q), n, q);
  const no = [
    "GP01 requirements",
    "What does GP01 require?",
    "requirements under GP01",
    "GP01 monitoring requirements",
    "Which general permit do I need?",
    "GP01 or GP08 for condensate?", // two permits: the note would have to pick one
    "GP02 limits",
    "What regulations apply to a natural gas-fired engine?",
    "Do I need a GP04?", // not one of the eleven
    "GP12 registration",
    "When is an APEN required?",
    "Do I need a permit for my engine?",
  ];
  for (const q of no) assert.equal(premisePermitNumber(q), null, q);
});

test("the matcher runs on the raw or the acronym-expanded question alike", () => {
  const raw = "When is a GP01 required?";
  const expanded = "When is a GP01 (Air Pollution Control Division general permit for condensate storage tank batteries) required?";
  assert.equal(matchPremiseNote(raw)?.key, "gp01-required");
  assert.equal(matchPremiseNote(expanded)?.key, "gp01-required");
  assert.equal(matchQuestionMap(raw)?.key, "premise-gp01");
  assert.equal(matchQuestionMap(expanded)?.key, "premise-gp01");
});

// ---- the notes ---------------------------------------------------------------

test("there is one note per general permit (the eleven) and five topic notes; every sentence is cited, every cite is a real-looking id in the generated list", () => {
  assert.deepEqual(PERMIT_NOTES.map((n) => n.regKey), PREMISE_GP_NUMBERS.map((n) => `gp${n}`));
  assert.deepEqual(PREMISE_NOTES, [...PERMIT_NOTES, ...TOPIC_NOTES]);
  assert.deepEqual(TOPIC_NOTES.map((n) => n.key), ["apen-every-point", "title-v-well-site", "exempt-still-regulated", "oooob-existing-well", "gp02-diesel"]);
  const sql = readFileSync(QUESTION_MAP_IDS_SQL, "utf8");
  for (const n of PERMIT_NOTES) {
    assert.equal(n.kind, "permit");
    assert.equal(n.key, `${n.regKey}-required`);
    assert.equal(n.map.key, `premise-${n.regKey}`);
    assert.equal(n.map.permitRegKey, n.regKey);
    assert.equal(n.title, `Is ${n.permit} required?`);
    assert.ok(n.sentences.length >= 4, `${n.key}: too few sentences`);
    for (const s of n.sentences) for (const id of s.cites) assert.match(id, /^sec-(gp\d\d|3)-/, `${n.key}: a cite outside the permits and Regulation 3: ${id}`);
  }
  for (const n of TOPIC_NOTES) {
    assert.equal(n.kind, "topic");
    assert.equal(n.map.key, `premise-${n.key}`);
    assert.equal(typeof n.matches, "function");
    assert.ok(n.sentences.length >= 4, `${n.key}: too few sentences`);
  }
  for (const n of PREMISE_NOTES) {
    const keys = new Set<string>();
    for (const s of n.sentences) {
      assert.ok(s.text.trim().length > 20, `${n.key}: empty sentence`);
      assert.ok(s.cites.length >= 1, `${n.key}: uncited sentence: ${s.text}`);
      for (const id of s.cites) {
        assert.match(id, /^sec-[a-z0-9]+-/, `${n.key}: not a provision id: ${id}`);
        assert.ok(sql.includes(`('${n.map.key}:note', '${id}')`), `${id} missing from scripts/question-map-ids.sql (run npx tsx scripts/question-map-ids.ts)`);
      }
      // The note never reads as a determination.
      assert.doesNotMatch(s.text, /\byou (?:must|need|are required|do not need)\b/i, `${n.key}: addresses the visitor as a determination: ${s.text}`);
    }
    for (const p of n.map.provisions) {
      assert.ok(sql.includes(`('${n.map.key}', '${p.id}')`), `${p.id} missing from the generated file`);
      assert.ok(!keys.has(p.id), `${n.key}: ${p.id} listed twice`);
      keys.add(p.id);
    }
    assert.ok(n.map.factors.length > 40, `${n.key}: no factors line`);
  }
  // Map keys are unique across every note and the ordinary maps.
  const mapKeys = PREMISE_NOTES.map((n) => n.map.key);
  assert.equal(new Set(mapKeys).size, mapKeys.length);
});

test("every permit note says registration is voluntary and that Regulation 3 decides whether a permit or an APEN is required, with the Regulation 3 rows cited", () => {
  for (const n of PERMIT_NOTES) {
    const voluntary = n.sentences.find((s) => /registration under it is voluntary/.test(s.text));
    assert.ok(voluntary, `${n.key}: no voluntary sentence`);
    assert.ok(voluntary.cites.some((id) => /-(VIII|IX|XI|IV)-[DE]-3$/.test(id)), `${n.key}: the voluntary sentence must cite the permit's own "voluntary" row`);
    const reg3 = n.sentences.find((s) => /decided under Regulation 3/.test(s.text));
    assert.ok(reg3, `${n.key}: no Regulation 3 sentence`);
    assert.deepEqual(reg3.cites, ["sec-3-A-II-A-1", "sec-3-A-II-D-1", "sec-3-B-I-A", "sec-3-B-II-A-1", "sec-3-B-II-D"]);
    const alt = n.sentences.find((s) => /alternatives? (?:are|is)/.test(s.text));
    assert.ok(alt, `${n.key}: no alternatives sentence`);
    assert.match(alt.text, /Regulation 3 Part B/);
    // The note never reads as a determination.
    for (const s of n.sentences) assert.doesNotMatch(s.text, /\byou (?:must|need|are required|do not need)\b/i, `${n.key}: addresses the visitor as a determination: ${s.text}`);
  }
});

test("GP09 and GP10 open with the closure, cite their document row and GP12; the eleven notes name the right alternatives", () => {
  const byKey = Object.fromEntries(PERMIT_NOTES.map((n) => [n.regKey!, n]));
  for (const k of ["gp09", "gp10"]) {
    const first = byKey[k].sentences[0];
    assert.match(first.text, /closed to new registrations \(July 15, 2026\)/);
    assert.match(first.text, /GP12 replaced GP09 and GP10 for new applicants/);
    assert.deepEqual(first.cites, [`sec-${k}-top-REG-${k}`, "sec-gp12-I-A"]);
    assert.ok(isClosedPermit(k));
    assert.match(byKey[k].map.factors, /closed to new registrations/);
  }
  for (const k of ["gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp11", "gp12"]) assert.doesNotMatch(byKey[k].sentences[0].text, /closed/);
  const alts = (k: string) => byKey[k].map.provisions.filter((p) => p.group === "Alternatives if the permit does not fit").map((p) => p.id);
  assert.deepEqual(alts("gp01"), ["sec-gp01-VIII-E-3", "sec-gp08-I-B", "sec-gp12-I-A-3"]);
  assert.deepEqual(alts("gp02"), ["sec-gp02-XI-D-3", "sec-gp12-I-A-1"]);
  assert.deepEqual(alts("gp03"), ["sec-gp03-IV-E-3"]);
  assert.deepEqual(alts("gp05"), ["sec-gp05-VIII-E-3", "sec-gp08-I-B", "sec-gp12-I-A-3"]);
  assert.deepEqual(alts("gp06"), ["sec-gp06-IX-E-3", "sec-gp12-I-A-2"]);
  assert.deepEqual(alts("gp07"), ["sec-gp07-VIII-E-3", "sec-gp12-I-A-4"]);
  assert.deepEqual(alts("gp08"), ["sec-gp08-VIII-E-3", "sec-gp01-I-A", "sec-gp05-I-A", "sec-gp12-I-A-3"]);
  assert.deepEqual(alts("gp09"), ["sec-gp09-IX-D-3", "sec-gp12-I-A", "sec-gp12-I-B"]);
  assert.deepEqual(alts("gp10"), ["sec-gp10-IX-D-3", "sec-gp12-I-A", "sec-gp12-I-B"]);
  assert.deepEqual(alts("gp11"), ["sec-gp11-VIII-D-3", "sec-gp12-I-A-8"]);
  assert.deepEqual(alts("gp12"), ["sec-gp12-XI-D-3", "sec-gp01-I-A", "sec-gp05-I-A", "sec-gp08-I-B", "sec-gp02-I-A", "sec-gp06-I-A", "sec-gp07-I-A", "sec-gp11-I-A"]);
});

test("a premise map lists the permit's Section I rows first, then the Regulation 3 rows, then the alternatives, in MAP_GROUP_ORDER", () => {
  for (const n of PERMIT_NOTES) {
    const groups = [...new Set(n.map.provisions.map((p) => p.group))];
    assert.deepEqual(groups, ["Permit applicability", "Colorado permitting and APEN", "Alternatives if the permit does not fit"], n.key);
    const idx = groups.map((g) => MAP_GROUP_ORDER.indexOf(g));
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
    const app = n.map.provisions.filter((p) => p.group === "Permit applicability");
    assert.ok(app.length >= 3, n.key);
    for (const p of app) assert.match(p.id, new RegExp(`^sec-${n.regKey}-I(-|$)`), `${n.key}: ${p.id} is not a Section I row`);
    assert.equal(app[0].id, n.regKey === "gp08" ? "sec-gp08-I-A" : `sec-${n.regKey}-I-A`);
    assert.ok(n.map.provisions.some((p) => p.id === "sec-3-A-II-A-1"));
    assert.ok(n.map.provisions.some((p) => p.id === "sec-3-B-II-A-1"));
    // Keys are unique across the ordinary maps and the premise maps.
    assert.ok(!QUESTION_MAPS.some((m) => m.key === n.map.key));
  }
  // GP01: I.A through I.F in order.
  const gp01 = PERMIT_NOTES[0].map.provisions.filter((p) => p.group === "Permit applicability").map((p) => p.id);
  assert.deepEqual(gp01, ["sec-gp01-I-A", "sec-gp01-I-B", "sec-gp01-I-C", "sec-gp01-I-D", "sec-gp01-I-E", "sec-gp01-I-F"]);
});

test("citeLabel and citeRegKey give the reader link and a short label for a cite", () => {
  assert.equal(citeLabel("sec-gp01-I-A-1"), "GP01 I.A.1");
  assert.equal(citeLabel("sec-3-A-II-A-1"), "Regulation 3 Part A II.A.1");
  assert.equal(citeLabel("sec-3-B-I-A"), "Regulation 3 Part B I.A");
  assert.equal(citeLabel("sec-gp09-top-REG-gp09"), "GP09 (document)");
  assert.equal(citeRegKey("sec-gp01-I-A-1"), "gp01");
  assert.equal(citeRegKey("sec-3-A-II-A-1"), "3");
});

// ---- the GP01 premise question, with the 7 Oct production top 10 -------------------

test("the reviewer's GP01 question: note present, GP01 I.A first, Regulation 3 shown, the storage-tank map not what leads", () => {
  // The 7 Oct 2026 production Ask top 10 (ask-eval run 37564225403).
  const prod = [
    hit("sec-gp01-I-A", "gp01"),
    hit("sec-gp01-I-E", "gp01"),
    hit("sec-gp01-I-A-1", "gp01"),
    hit("sec-gp01-IX-B", "gp01"),
    hit("sec-gp05-I-A", "gp05"),
    hit("sec-gp08-IX-B", "gp08"),
    hit("sec-gp05-top-REG-gp05", "gp05"),
    hit("sec-gp05-IX-B", "gp05"),
    hit("sec-gp01-I", "gp01"),
    hit("sec-gp05-VIII-A", "gp05"),
  ];
  const layout = layoutAsk("When is a GP01 required?", prod);
  assert.equal(layout.map?.key, "premise-gp01");
  assert.equal(layout.note?.key, "gp01-required");
  assert.deepEqual(layout.shownIds.slice(0, 3), ["sec-gp01-I-A", "sec-gp01-I-B", "sec-gp01-I-C"]);
  assert.ok(layout.shownIds.includes("sec-3-A-II-A-1"));
  assert.ok(layout.shownIds.includes("sec-3-B-II-A-1"));
  // The permit's own retrieval hits sit under its applicability group, the other permits' under General Permit options.
  const groups = layout.summary!.groups;
  assert.deepEqual(groups.map((g) => g.group), ["Permit applicability", "Colorado permitting and APEN", "Alternatives if the permit does not fit", "General Permit options"]);
  assert.deepEqual(groups[0].provisions.slice(6), ["sec-gp01-I-A-1", "sec-gp01-IX-B", "sec-gp01-I"]);
  assert.deepEqual(groups[3].provisions, ["sec-gp05-I-A", "sec-gp08-IX-B", "sec-gp05-top-REG-gp05"]);
  assert.equal(layout.summary!.note?.title, "Is GP01 required?");
  assert.equal(layout.summary!.title, layout.map!.name);
  assert.deepEqual(layout.summary!.omitted, []);
  // The eval row passes on this layout.
  const row = EVAL_QUESTIONS.find((e) => e.q === "When is a GP01 required?")!;
  const r = evaluateQuestion(row, prod, layout.map!.key, { ids: layout.shownIds, noteKey: layout.note!.key, title: layout.summary!.title });
  assert.deepEqual(r, { pass: true, matchRank: 1, failures: [] });
  // And fails without the note or with the tank map.
  const noNote = evaluateQuestion(row, prod, "storage-tanks", { ids: layout.shownIds, noteKey: null, title: "Storage tanks and tank batteries" });
  assert.equal(noNote.pass, false);
  assert.ok(noNote.failures.some((f) => f.startsWith("routed to")));
  assert.ok(noNote.failures.some((f) => f.startsWith("premise note missing")));
  // A caller that passes no layout cannot pass a shown check.
  assert.ok(evaluateQuestion(row, prod, "premise-gp01").failures.some((f) => f.startsWith("no shown order")));
});

// ---- facets ------------------------------------------------------------------

test("facet detection runs on the raw question: one stated value counts, two or none do not, and GP02's expansion is never read", () => {
  const engines = QUESTION_MAPS.find((m) => m.key === "engines")!;
  const tanks = QUESTION_MAPS.find((m) => m.key === "storage-tanks")!;
  assert.equal(detectFacets("What regulations apply to a natural gas-fired engine?", engines).fuel?.value, "natural gas");
  assert.equal(detectFacets("What applies to a diesel engine?", engines).fuel?.value, "diesel");
  assert.equal(detectFacets("compression ignition RICE at a well pad", engines).fuel?.value, "diesel");
  assert.equal(detectFacets("lean burn engine limits", engines).fuel?.value, "natural gas");
  assert.deepEqual(detectFacets("natural gas and diesel engines", engines), {});
  assert.deepEqual(detectFacets("GP02 limits", engines), {});
  assert.deepEqual(detectFacets("engine emission standards", engines), {});
  assert.deepEqual(detectFacets("What applies to a diesel engine?", tanks), {}); // the tanks map has no fuel facet
  assert.equal(detectFacets("What rules apply to a produced water storage tank at a well site?", tanks).contents?.value, "produced water");
  assert.equal(detectFacets("condensate tank battery controls", tanks).contents?.value, "condensate");
  assert.equal(detectFacets("crude oil storage tanks", tanks).contents?.value, "crude oil");
  assert.deepEqual(detectFacets("condensate and produced water tanks", tanks), {});
  assert.deepEqual(detectFacets("storage vessels", tanks), {});
  assert.deepEqual(detectFacets("anything", null), {});
  // Only the two maps carry facets; every other map behaves as before.
  for (const m of QUESTION_MAPS) if (m.key !== "engines" && m.key !== "storage-tanks") assert.equal(m.facets, undefined, m.key);
});

test("row and hit filtering: tagged rows and owned reg keys go, untagged rows stay; the omitted line names the other value", () => {
  const engines = QUESTION_MAPS.find((m) => m.key === "engines")!;
  const ng = { fuel: FACETS.fuel.values[0] };
  const diesel = { fuel: FACETS.fuel.values[1] };
  const row = (id: string) => engines.provisions.find((p) => p.id === id)!;
  assert.equal(rowMatchesFacets(row("sec-gp06-I-A"), ng), false);
  assert.equal(rowMatchesFacets(row("sec-gp06-I-A"), diesel), true);
  assert.equal(rowMatchesFacets(row("sec-gp02-I-A"), ng), true);
  assert.equal(rowMatchesFacets(row("sec-gp02-I-A"), diesel), false);
  assert.equal(rowMatchesFacets(row("sec-gp12-I-A"), ng), true); // covers both fuels
  assert.equal(rowMatchesFacets(row("sec-gp12-I-A"), diesel), true);
  assert.equal(rowMatchesFacets(row("sec-zzzz-63.6585"), diesel), true);
  assert.equal(rowMatchesFacets(row("sec-iiii-60.4200"), ng), false);
  assert.equal(rowMatchesFacets(row("sec-jjjj-60.4230"), diesel), false);
  assert.equal(rowMatchesFacets(row("sec-gp09-I-A"), ng), true); // GP09/GP10 cover natural gas-fired RICE only
  assert.equal(rowMatchesFacets(row("sec-gp09-I-A"), diesel), false);
  assert.equal(rowMatchesFacets(row("sec-gp02-I-A"), {}), true);
  assert.equal(hitMatchesFacets({ reg_key: "gp06" }, ng), false);
  assert.equal(hitMatchesFacets({ reg_key: "iiii" }, ng), false);
  assert.equal(hitMatchesFacets({ reg_key: "jjjj" }, diesel), false);
  assert.equal(hitMatchesFacets({ reg_key: "gp12" }, ng), true);
  assert.equal(hitMatchesFacets({ reg_key: "26" }, diesel), true);
  assert.equal(hitMatchesFacets({ reg_key: null }, ng), true);
  assert.equal(mapTitle(engines, ng), "Natural gas-fired engines");
  assert.equal(mapTitle(engines, diesel), "Diesel engines");
  assert.equal(mapTitle(engines, {}), "Natural gas-fired and diesel engines");
  assert.deepEqual(omittedLines(engines, ng), [{ facet: "fuel", said: "natural gas", omitted: "diesel engine provisions (GP06, Subpart IIII)" }]);
  assert.deepEqual(omittedLines(engines, diesel), [{ facet: "fuel", said: "diesel", omitted: "natural gas-fired engine provisions (GP02, Subpart JJJJ)" }]);
  assert.deepEqual(omittedLines(engines, {}), []);
});

test("the reviewer's engine question: no GP06 or Subpart IIII shown, Regulation 3 / GP12 / Regulation 26 / JJJJ / ZZZZ shown, GP09 and GP10 shown and badged closed", () => {
  // The 7 Oct 2026 production Ask top 10 (ask-eval run 37564225403), plus a diesel hit to prove the filter.
  const prod = [
    hit("sec-26-B-I-D-6-a-(i)", "26"),
    hit("sec-26-B-I-D-5-b-(ii)", "26"),
    hit("sec-gp12-XII-E", "gp12"),
    hit("sec-gp02-I-A-2", "gp02"),
    hit("sec-gp12-VI-F-2", "gp12"),
    hit("sec-gp06-II-A-4", "gp06"),
    hit("sec-iiii-60.4201", "iiii", "federal"),
    hit("sec-gp12-XII-D", "gp12"),
  ];
  const q = "What regulations apply to a natural gas-fired engine?";
  const layout = layoutAsk(q, prod);
  assert.equal(layout.map?.key, "engines");
  assert.equal(layout.note, null);
  assert.equal(layout.summary!.title, "Natural gas-fired engines");
  assert.deepEqual(layout.summary!.stated, ["fuel=natural gas"]);
  assert.ok(!layout.shownIds.some((id) => id.startsWith("sec-gp06-") || id.startsWith("sec-iiii-")));
  for (const p of ["sec-3-", "sec-gp12-", "sec-26-", "sec-jjjj-", "sec-zzzz-", "sec-gp09-I-A", "sec-gp10-I-A"]) assert.ok(layout.shownIds.some((id) => id.startsWith(p)), p);
  assert.deepEqual(layout.summary!.omittedIds, ["sec-gp06-I-A", "sec-iiii-60.4200", "sec-iiii-60.4204", "sec-iiii-60.4205", "sec-gp06-II-A-4", "sec-iiii-60.4201"]);
  assert.deepEqual(layout.summary!.omitted, [{ facet: "fuel", said: "natural gas", omitted: "diesel engine provisions (GP06, Subpart IIII)" }]);
  const row = EVAL_QUESTIONS.find((e) => e.q === q)!;
  assert.deepEqual(evaluateQuestion(row, prod, "engines", { ids: layout.shownIds, noteKey: null, title: layout.summary!.title }), { pass: true, matchRank: 1, failures: [] });
  // "Show them" (?facets=all): everything is back and nothing is reported omitted.
  const all = layoutAsk(q, prod, undefined, true);
  assert.equal(all.summary!.title, "Natural gas-fired and diesel engines");
  assert.ok(all.shownIds.includes("sec-gp06-I-A") && all.shownIds.includes("sec-iiii-60.4200"));
  // (sec-gp06-II-A-4 is the fourth permit hit, over MAX_HITS_PER_GROUP, so the cap drops it, not the facet.)
  assert.deepEqual(all.summary!.omitted, []);
  assert.deepEqual(all.summary!.omittedIds, []);
  // The eval fails the unfiltered layout.
  const unfiltered = evaluateQuestion(row, prod, "engines", { ids: all.shownIds, noteKey: null, title: all.summary!.title });
  assert.equal(unfiltered.pass, false);
  assert.ok(unfiltered.failures.some((f) => f.startsWith("shown but should not be: sec-gp06-I-A")));
  assert.ok(unfiltered.failures.some((f) => f.startsWith("map titled")));
});

test("the diesel and produced-water rows: GP06 and IIII shown without JJJJ; GP05 and GP08 shown without GP01, GP07 or the condensate definition", () => {
  const diesel = EVAL_QUESTIONS.find((e) => e.q === "What applies to a diesel engine?")!;
  const dl = layoutAsk(diesel.q, [hit("sec-gp06-I-A-1", "gp06"), hit("sec-jjjj-60.4230-(a)", "jjjj", "federal"), hit("sec-26-B-II-A", "26")]);
  assert.equal(dl.summary!.title, "Diesel engines");
  assert.ok(dl.shownIds.includes("sec-gp06-I-A") && dl.shownIds.includes("sec-iiii-60.4200"));
  assert.ok(!dl.shownIds.some((id) => id.startsWith("sec-jjjj-")));
  assert.ok(!dl.shownIds.some((id) => id.startsWith("sec-gp02-")));
  assert.ok(dl.shownIds.includes("sec-gp12-I-A") && dl.shownIds.includes("sec-zzzz-63.6585") && dl.shownIds.includes("sec-3-A-I-B-36"));
  assert.equal(evaluateQuestion(diesel, [{ id: "sec-gp06-I-A-1" }], "engines", { ids: dl.shownIds, noteKey: null, title: dl.summary!.title }).pass, true);

  const water = EVAL_QUESTIONS.find((e) => e.q === "What rules apply to a produced water storage tank at a well site?")!;
  const wl = layoutAsk(water.q, [hit("sec-7-B-II-C-1", "7"), hit("sec-gp01-II-A", "gp01"), hit("sec-gp05-II-A", "gp05")]);
  assert.equal(wl.map?.key, "storage-tanks");
  assert.equal(wl.summary!.title, "Produced water storage tanks and tank batteries");
  assert.ok(wl.shownIds.includes("sec-gp05-I-A") && wl.shownIds.includes("sec-gp08-I-B") && wl.shownIds.includes("sec-gp12-I-A-3"));
  assert.ok(!wl.shownIds.some((id) => id.startsWith("sec-gp01-") || id.startsWith("sec-gp07-") || id === "sec-7-B-I-B-9"));
  assert.ok(wl.shownIds.includes("sec-7-B-I-D") && wl.shownIds.includes("sec-oooob-60.5365b-(e)") && wl.shownIds.includes("sec-7-B-I-B-30"));
  assert.deepEqual(wl.summary!.omitted, [{ facet: "contents", said: "produced water", omitted: "condensate-only provisions (GP01, the condensate storage tank definition); crude oil provisions" }]);
  assert.deepEqual(wl.summary!.omittedIds, ["sec-gp01-I-A", "sec-gp07-I-A", "sec-7-B-I-B-9", "sec-gp01-II-A"]);
  assert.equal(evaluateQuestion(water, [{ id: "sec-7-B-II-C-1" }], "storage-tanks", { ids: wl.shownIds, noteKey: null, title: wl.summary!.title }).pass, true);
  // Without a stated value the tanks map is unchanged.
  const plain = layoutAsk("What Colorado and federal requirements could apply to storage vessels?", []);
  assert.equal(plain.summary!.title, "Storage tanks and tank batteries");
  assert.equal(plain.shownIds.length, 25);
  assert.deepEqual(plain.summary!.omitted, []);
});

test("the GP12 premise row and the API summary shape", () => {
  const row = EVAL_QUESTIONS.find((e) => e.q === "Do I need a GP12?")!;
  const layout = layoutAsk(row.q, [hit("sec-gp12-I-B", "gp12"), hit("sec-gp12-XI-D-3", "gp12")]);
  assert.equal(layout.map?.key, "premise-gp12");
  assert.equal(layout.note?.key, "gp12-required");
  assert.equal(layout.shownIds[0], "sec-gp12-I-A");
  assert.equal(evaluateQuestion(row, [{ id: "sec-gp12-I-B" }], "premise-gp12", { ids: layout.shownIds, noteKey: "gp12-required", title: layout.summary!.title }).pass, true);
  const s = layout.summary!;
  assert.deepEqual(Object.keys(s).sort(), ["factors", "groups", "key", "name", "note", "omitted", "omittedIds", "stated", "title"]);
  assert.equal(s.note!.sentences.length, PREMISE_NOTES.find((n) => n.regKey === "gp12")!.sentences.length);
  // summariseGroups without facets keeps the old fields' meaning for an ordinary map.
  const engines = QUESTION_MAPS.find((m) => m.key === "engines")!;
  const plain = summariseGroups(engines, groupHits(engines, []));
  assert.equal(plain.note, null);
  assert.deepEqual(plain.stated, []);
  assert.equal(plain.title, engines.name);
});

test("the eval's new fields are declared only on the rows that need them", () => {
  const withShown = EVAL_QUESTIONS.filter((e: EvalQuestion) => e.premise !== undefined || e.title !== undefined || (e.shown?.length ?? 0) > 0).map((e) => e.q);
  assert.deepEqual(withShown, [
    "When is a GP01 required?",
    "What regulations apply to a natural gas-fired engine?",
    "Do I need a GP12?",
    "What applies to a diesel engine?",
    "What rules apply to a produced water storage tank at a well site?",
    "Do I need an APEN for every emission point at my site?",
    "Does my well site need a Title V operating permit?",
    "If my tank battery is exempt from a construction permit, does Regulation 7 still apply?",
    "Does OOOOb apply to an existing well drilled before 2022?",
    "Can I register a diesel engine under GP02?",
  ]);
});

// ---- the five topic notes (7 Oct 2026) ---------------------------------------

test("the topic notes match their misconceptions, never the pinned eval questions or the permit notes' own questions", () => {
  const route = (q: string) => matchPremiseNote(q)?.key ?? null;
  assert.equal(route("Do I need an APEN for every emission point at my site?"), "apen-every-point");
  assert.equal(route("Does every tank need an APEN?"), "apen-every-point");
  assert.equal(route("Is an APEN required for each piece of equipment?"), "apen-every-point");
  assert.equal(route("Does my well site need a Title V operating permit?"), "title-v-well-site");
  assert.equal(route("Is Title V required for a compressor station?"), "title-v-well-site");
  assert.equal(route("Are we subject to Title V?"), "title-v-well-site");
  assert.equal(route("If my tank battery is exempt from a construction permit, does Regulation 7 still apply?"), "exempt-still-regulated");
  assert.equal(route("Does an APEN exemption mean no other rules apply?"), "exempt-still-regulated");
  assert.equal(route("Does OOOOb apply to an existing well drilled before 2022?"), "oooob-existing-well");
  assert.equal(route("Is an old well grandfathered out of Subpart OOOOb?"), "oooob-existing-well");
  assert.equal(route("Can I register a diesel engine under GP02?"), "gp02-diesel");
  assert.equal(route("Can I use GP02 for a diesel engine?"), "gp02-diesel");
  assert.equal(route("gp2 diesel"), "gp02-diesel");
  // The permit note still answers its own question; the pinned rows keep their maps.
  assert.equal(route("Do I need a GP02?"), "gp02-required");
  assert.equal(route("When do I have to file an APEN for a new source and what is the threshold?"), null);
  assert.equal(route("APEN exemptions for small sources"), null);
  assert.equal(route("When does a source need a construction permit versus just an APEN?"), null);
  assert.equal(route("Am I subject to the federal OOOOb rules if I modified a well after December 2022?"), null);
  assert.equal(route("What applies to a diesel engine?"), null);
  assert.equal(route("What regulations apply to a natural gas-fired engine?"), null);
  for (const e of EVAL_QUESTIONS) {
    if (e.premise === undefined) assert.equal(route(e.q), null, e.q);
    else assert.equal(route(e.q), e.premise, e.q);
  }
  // matchQuestionMap() takes the topic note's map, so a question map never overrides it.
  assert.equal(matchQuestionMap("Can I register a diesel engine under GP02?")?.key, "premise-gp02-diesel");
  assert.equal(matchQuestionMap("Do I need an APEN for every emission point at my site?")?.key, "premise-apen-every-point");
});

test("each topic note says what the owner asked for, with the provision that supports it", () => {
  const byKey = Object.fromEntries(TOPIC_NOTES.map((n) => [n.key, n]));
  const text = (k: string) => byKey[k].sentences.map((s) => s.text).join(" ");
  const cited = (k: string) => new Set(byKey[k].sentences.flatMap((s) => s.cites));
  // APEN: every point unless exempt; the thresholds; exempt units still comply.
  assert.match(text("apen-every-point"), /unless the point is exempt under Regulation 3 Part A, Section II\.D/);
  assert.match(text("apen-every-point"), /one ton per year in a nonattainment area or two tons per year elsewhere/);
  assert.ok(cited("apen-every-point").has("sec-3-A-II-D-1-a") && cited("apen-every-point").has("sec-3-A-II-A-1"));
  // Title V: Part C's list; the general permits' minor-source condition.
  assert.match(text("title-v-well-site"), /required only for the sources Part C lists/);
  assert.ok(cited("title-v-well-site").has("sec-3-C-II-A-1") && cited("title-v-well-site").has("sec-gp12-I-E"));
  // Exempt: a permit exemption does not affect other regulations; Regulation 7 by its own terms.
  assert.match(text("exempt-still-regulated"), /does not affect the applicability of any other state or federal regulation/);
  assert.ok(cited("exempt-still-regulated").has("sec-3-B-II-D") && cited("exempt-still-regulated").has("sec-7-B-I-A-1"));
  // OOOOb: the date, and a later modification or reconstruction brings an existing facility in (owner's ask), cited.
  assert.match(text("oooob-existing-well"), /after December 6, 2022/);
  const later = byKey["oooob-existing-well"].sentences.find((s) => /later modification or reconstruction can bring it in/.test(s.text))!;
  assert.ok(later, "the later-modification sentence");
  assert.deepEqual(later.cites, ["sec-oooob-60.5365b", "sec-oooob-60.5365b-(a)-(1)", "sec-oooob-60.5365b-(e)-(3)"]);
  assert.ok(cited("oooob-existing-well").has("sec-ooooc-60.5360c"));
  // GP02 diesel: GP02 natural gas only, GP06 diesel, GP12 both, Regulation 3 decides.
  assert.match(text("gp02-diesel"), /only for natural gas fired reciprocating internal combustion engines/);
  assert.match(text("gp02-diesel"), /GP06 covers/);
  assert.match(text("gp02-diesel"), /GP12 covers both/);
  assert.match(text("gp02-diesel"), /decided under Regulation 3/);
  // The shown order for the diesel question: GP02 I.A first, GP06 I.A within three, GP12 I.A.2 shown.
  const layout = layoutAsk("Can I register a diesel engine under GP02?", []);
  assert.equal(layout.note?.key, "gp02-diesel");
  assert.equal(layout.shownIds[0], "sec-gp02-I-A");
  assert.ok(layout.shownIds.slice(0, 3).includes("sec-gp06-I-A"));
  assert.ok(layout.shownIds.includes("sec-gp12-I-A-2"));
  assert.ok(layout.shownIds.includes("sec-3-A-II-A-1"));
  // Nothing omitted: the premise map has no facets, so "diesel" leaves nothing out.
  assert.deepEqual(layout.summary?.omittedIds, []);
  assert.deepEqual(layout.summary?.stated, []);
});
