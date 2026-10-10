/**
 * Every question map's introduction is cited (9 Oct 2026): a sentence that
 * states a date, a threshold or an applicability conclusion carries the
 * provisions that support it, and every provision id exists in the corpus
 * (pipeline/out/corpus_ids.json, the list of every live id per reg key).
 * Covers the nine ordinary maps and the sixteen premise maps.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { introNeedsCitation } from "../src/lib/intro-citations";
import { PREMISE_NOTES } from "../src/lib/premise-notes";
import { introText, QUESTION_MAPS, type QuestionMap } from "../src/lib/question-maps";

const corpus = JSON.parse(readFileSync(path.join(__dirname, "..", "pipeline", "out", "corpus_ids.json"), "utf8")) as Record<string, string[]>;
const live = new Set(Object.values(corpus).flat());

const ALL_MAPS: QuestionMap[] = [...QUESTION_MAPS, ...PREMISE_NOTES.map((n) => n.map)];

test("introNeedsCitation: dates, numbers with units and applicability wording trip it; plain description does not", () => {
  for (const t of [
    "Subpart OOOOb reaches facilities after December 6, 2022.",
    "The rule took effect in 2015.",
    "It applies at 50 hp or more.",
    "Tanks emitting 4 tons per year are controlled.",
    "Control efficiency is at least 95%.",
    "An owner must test the device.",
    "The facility is subject to Subpart ZZZZ.",
    "Leaks within 1,000 feet of an occupied area.",
  ]) {
    assert.equal(introNeedsCitation(t), true, t);
  }
  for (const t of ["40 CFR 63 Subpart HH is not in this corpus, so this map has no federal NESHAP group.", "Rows are grouped by regulation."]) {
    assert.equal(introNeedsCitation(t), false, t);
  }
});

test("every introduction sentence that states a date, threshold or applicability conclusion carries a citation", () => {
  assert.equal(ALL_MAPS.length, 9 + 16);
  for (const m of ALL_MAPS) {
    assert.ok(m.factors.length > 0, `${m.key}: no introduction`);
    for (const x of m.factors) {
      if (introNeedsCitation(x.text)) assert.ok(x.cites.length > 0, `${m.key}: uncited sentence: ${x.text}`);
    }
  }
});

test("every id an introduction cites is a live provision, and no sentence cites an id twice", () => {
  for (const m of ALL_MAPS) {
    for (const x of m.factors) {
      assert.equal(new Set(x.cites).size, x.cites.length, `${m.key}: repeated cite in: ${x.text}`);
      for (const id of x.cites) assert.ok(live.has(id), `${m.key}: ${id} is not in pipeline/out/corpus_ids.json`);
    }
  }
});

test("the engines introduction drops the claims no provision supports", () => {
  const engines = QUESTION_MAPS.find((m) => m.key === "engines")!;
  // Reworded 9 Oct 2026: the old single sentence asserted "site-rated horsepower" and "date of construction" as deciding
  // factors for every engine rule; the cited text is what JJJJ / IIII / Regulation 3 / ZZZZ / Regulation 26 actually say.
  assert.match(introText(engines), /July 11, 2005/);
});

test("the dehydrator and general-permit introductions no longer carry the claims the sources do not support", () => {
  const dehy = introText(QUESTION_MAPS.find((m) => m.key === "dehydrators")!);
  assert.doesNotMatch(dehy, /benzene/i);
  const gps = introText(QUESTION_MAPS.find((m) => m.key === "general-permits")!);
  assert.doesNotMatch(gps, /Section I\.B exclusion/);
  assert.doesNotMatch(gps, /emission caps/);
});
