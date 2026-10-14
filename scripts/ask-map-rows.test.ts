/**
 * The research map above an Ask answer (Sprint 8, 11 Oct 2026): the rows
 * askMapRows derives from layoutAsk's groups, where each "Why it matters"
 * comes from, the destinations a visitor and a subscriber get, and the markup
 * of src/components/AskResearchMap.tsx rendered with react-dom/server against
 * the /sample snapshot's real grouped answer (labels are made up from the ids:
 * the snapshot stores ids only).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AskReading, AskResearchMap } from "../src/components/AskResearchMap";
import {
  ASK_FINDS_LINE,
  READING_HEADING,
  askMapRows,
  citeRelatesTo,
  summaryFirstSentence,
  type AskMapRow,
} from "../src/lib/ask-map-rows";
import { provisionDestination } from "../src/lib/destination";

/** What /search passes: Ask is subscriber-only, so every destination is the reader (semantic.ts hrefForHit, which is server-only). */
const hrefForHit = (hit: { id: string; reg_key: string | null }) => provisionDestination(hit, { hasAccess: true });
import { OTHER_GROUP, groupHits, layoutAsk, QUESTION_MAPS, matchQuestionMap } from "../src/lib/question-maps";
import { jurisdictionOfKey, regKeyOf } from "../src/lib/regulation-names";
import { layoutSampleAsk, sampleIds, sampleMapRows, SNAPSHOT, type SampleRow } from "../src/lib/sample-pure";

/** Label rows for every id the sample hydrates; a GP05 row also carries an approved summary, as the page's gate allows. */
function fakeRows(): Map<string, SampleRow> {
  const rows = new Map<string, SampleRow>();
  for (const id of sampleIds()) {
    const key = regKeyOf(id)!;
    const citation = id.replace(/^sec-[^-]+-/, "").replace(/-/g, ".");
    rows.set(id, {
      id,
      citation,
      title: `${citation} Heading of ${id}`,
      reg_key: key,
      jurisdiction_level: jurisdictionOfKey(key),
      context_path: null,
      ...(key === "gp05"
        ? {
            ai_summary: "This GP05 summary sentence is quotable. A second sentence follows it.",
            summary_status: "approved",
            reviewed_at: "2026-10-05T12:00:00Z",
            reviewed_by_human: false,
          }
        : {}),
    });
  }
  return rows;
}

const byComponent = (rows: AskMapRow[], name: string) => rows.find((r) => r.component === name)!;

test("citeRelatesTo: a cite is the provision, inside it, or above it, never a sibling", () => {
  assert.ok(citeRelatesTo("sec-7-B-I-D", "sec-7-B-I-D"));
  assert.ok(citeRelatesTo("sec-7-B-I-D-3-a-(i)", "sec-7-B-I-D"), "inside");
  assert.ok(citeRelatesTo("sec-oooo-60.5365", "sec-oooo-60.5365-(e)"), "above");
  assert.ok(!citeRelatesTo("sec-7-B-I-D", "sec-7-B-I-DD"), "a longer id that merely starts the same");
  assert.ok(!citeRelatesTo("sec-7-B-I-E", "sec-7-B-I-D"), "sibling");
  assert.ok(!citeRelatesTo("sec-gp05-I-A", "sec-gp05-I-B"));
});

test("summaryFirstSentence: the first sentence of the overview, null for no summary", () => {
  assert.equal(summaryFirstSentence(null), null);
  assert.equal(summaryFirstSentence(""), null);
  assert.equal(summaryFirstSentence("One sentence only."), "One sentence only.");
  assert.equal(summaryFirstSentence("First sentence here. Second sentence here."), "First sentence here.");
  const long = Array.from({ length: 80 }, (_, i) => `word${i},`).join(" ") + " end.";
  const first = summaryFirstSentence(long)!;
  assert.ok(first.endsWith("…"), "a first sentence over the slack is cut at a clause, as the reader's overview is");
  assert.ok(first.split(/\s+/).length <= 60);
});

test("/sample: one row per group of the answer, in the answer's order, every provision once", () => {
  const rows = fakeRows();
  const ask = layoutSampleAsk(rows);
  const table = sampleMapRows(ask, rows, false);
  assert.deepEqual(
    table.map((r) => r.component),
    [...ask.summary!.groups.map((g) => g.group === "Other" ? OTHER_GROUP : g.group)],
    "the groups layoutAsk produced, in its order"
  );
  assert.deepEqual(
    table.flatMap((r) => r.provisions.map((p) => p.id)),
    ask.shownIds,
    "the provisions layoutAsk shows, in its order"
  );
  assert.equal(new Set(table.flatMap((r) => r.provisions.map((p) => p.id))).size, ask.shownIds.length, "none twice");
  for (const r of table) for (const p of r.provisions) {
    assert.ok(p.label.length > 0 && p.href.length > 0, p.id);
  }
  // The label is the citation form the map's introduction uses; the heading drops its own citation.
  const gp05 = byComponent(table, "General Permit options").provisions.find((p) => p.id === "sec-gp05-I-A")!;
  assert.equal(gp05.label, "GP05 I.A");
  assert.equal(gp05.title, "Heading of sec-gp05-I-A");
});

test("/sample: 'Why it matters' is a curated sentence that exists already, each introduction sentence on one row at most", () => {
  const rows = fakeRows();
  const ask = layoutSampleAsk(rows);
  const table = sampleMapRows(ask, rows, false);
  const factors = ask.map!.factors.map((f) => f.text);
  const mapWhys = ask.map!.provisions.map((p) => p.why);
  const used: string[] = [];
  for (const r of table) {
    if (!r.why) continue;
    if (r.why.source === "intro") {
      assert.ok(factors.includes(r.why.text), `${r.component}: an introduction sentence verbatim`);
      used.push(r.why.text);
    } else if (r.why.source === "map") {
      assert.ok(mapWhys.includes(r.why.text), `${r.component}: a canonical row's why verbatim`);
    } else if (r.why.source === "note") {
      const notes = (ask.map!.notes ?? {}) as Record<string, string>;
      assert.equal(r.why.text, notes[r.component], `${r.component}: the map's curated note verbatim`);
    }
  }
  assert.equal(new Set(used).size, used.length, "a sentence is used for one row only");
  // The general permits row takes the sentence that cites GP01, GP05 and GP08; the federal row the one that cites the four (e) paragraphs.
  assert.match(byComponent(table, "General Permit options").why!.text, /^What the tank stores matters to the general permits/);
  assert.match(byComponent(table, "Federal NSPS").why!.text, /^Each subpart sets its own storage vessel test/);
  assert.match(byComponent(table, "Colorado standards").why!.text, /^Regulation 7 Part B Section I\.D\.3\.a requires/);
  assert.equal(byComponent(table, "Colorado standards").why!.source, "intro");
  // No sentence cites a Regulation 3 or a definitions row: those take the map's curated note (v3.1, 13 Oct 2026), ahead of
  // the first canonical row's own reason, which read as a label ("Reg 7 Part B I.B — 'Storage tank'").
  assert.deepEqual(byComponent(table, "Colorado permitting and APEN").why, {
    text: "Regulation 3 decides whether the tank battery must file an APEN and hold a construction permit, or is exempt from either, before any emission standard applies.",
    source: "note",
  });
  assert.equal(byComponent(table, "Definitions").why!.source, "note");
  assert.match(byComponent(table, "Definitions").why!.text, /^Whether a vessel is a storage tank/);
  // Retrieval-only ECMC rows for a visitor: no canonical reason and no summary hydrated; the note says what the group is, never invented text.
  assert.deepEqual(byComponent(table, "ECMC rules").why, {
    text: "The Commission's own rules for the tanks, flowlines and venting at the site apply alongside the air regulations; an air permit does not satisfy them.",
    source: "note",
  });
  // Every row of the example has a line: no dash on /sample (the tenth review's "No note for this component").
  for (const r of table) assert.ok(r.why, r.component);
});

test("the summary fallback: the top provision's first overview sentence, only for an approved or edited summary", () => {
  const map = { factors: [] };
  const hit = (id: string) => ({ id, citation: id, title: "", reg_key: "gp05", jurisdiction_level: "state", path: null });
  const grouped = { groups: [{ group: "General Permit options" as const, canonical: [], hits: [hit("sec-gp05-I-A"), hit("sec-gp05-I-B")] }], other: [] };
  const run = (summaryOf: (id: string) => string | null) =>
    askMapRows({ map, grouped, source: () => undefined, hrefFor: hrefForHit, summaryOf });
  assert.deepEqual(run((id) => (id === "sec-gp05-I-B" ? "Second row says this. And more." : null))[0].why, {
    text: "Second row says this.",
    source: "summary",
  }, "the first provision with a summary");
  assert.deepEqual(run((id) => (id === "sec-gp05-I-A" ? "Top row says this. And more." : "Other row.")) [0].why, {
    text: "Top row says this.",
    source: "summary",
  });
  assert.equal(run(() => null)[0].why, null);
});

test("destinations: a visitor's GP05 rows open the reader, every other row the focused preview; a subscriber's all open the reader", () => {
  const rows = fakeRows();
  const ask = layoutSampleAsk(rows);
  const visitor = sampleMapRows(ask, rows, false).flatMap((r) => r.provisions);
  const subscriber = sampleMapRows(ask, rows, true).flatMap((r) => r.provisions);
  assert.equal(visitor.length, subscriber.length);
  for (const p of visitor) {
    if (regKeyOf(p.id) === "gp05") assert.equal(p.href, `/regulations/gp05#${p.id}`);
    else assert.match(p.href, new RegExp(`^/regulations/[^/]+/preview\\?p=${encodeURIComponent(p.id).replace(/[()]/g, "\\$&")}$`), p.id);
  }
  assert.ok(visitor.some((p) => /\/preview\?p=/.test(p.href)));
  for (const p of subscriber) assert.match(p.href, /^\/regulations\/[^/]+#/, p.id);
});

test("leak check: the table quotes a summary only from a row the page hydrated, which for a visitor is GP05's alone", () => {
  // The page reads summaries for GP05 only (summaryIds); the table's only summary text comes through that same map.
  const rows = fakeRows();
  const table = sampleMapRows(layoutSampleAsk(rows), rows, false);
  const html = renderToStaticMarkup(createElement(AskResearchMap, { rows: table }));
  for (const [id, r] of rows) if (regKeyOf(id) !== "gp05") assert.equal(r.ai_summary, undefined, id);
  for (const r of table) {
    if (r.why?.source === "summary") assert.ok(r.provisions.some((p) => regKeyOf(p.id) === "gp05"), r.component);
  }
  // A closed row's label is all the table shows of it: its citation and heading, the same as its locked card.
  const ecmc = table.find((r) => r.component === "ECMC rules")!;
  assert.ok(ecmc.provisions.length > 0);
  assert.equal(ecmc.why?.source, "note");
  assert.ok(html.includes("Heading of sec-ecmc-608-a-(1)"));
});

test("markup: the finds-provisions line, then the table with its three columns, then (AskReading) the smaller heading and the introduction", () => {
  const rows = fakeRows();
  const ask = layoutSampleAsk(rows);
  const table = sampleMapRows(ask, rows, false);
  const html = renderToStaticMarkup(
    createElement(Fragment, null, createElement(AskResearchMap, { rows: table }), createElement(AskReading, { factors: ask.map!.factors, hasAccess: false }))
  );
  const at = (s: string) => html.indexOf(s);
  assert.ok(at(ASK_FINDS_LINE) > -1);
  assert.equal(ASK_FINDS_LINE, "It finds provisions; it does not decide what applies to you.");
  assert.ok(at(ASK_FINDS_LINE) < at("<table"), "the line is above the table");
  for (const col of ["Question component", "Provision", "Why it matters"]) assert.ok(at(`>${col}</th>`) > -1, col);
  assert.ok(at("</table>") < at(READING_HEADING), "the reading is under the table");
  assert.ok(at(READING_HEADING) < at('data-testid="map-intro"'), "the heading is above the introduction");
  assert.match(html, /<h3[^>]*>Reading of the provisions above<\/h3>/);
  assert.ok(!/<h2/.test(html), "no h2: the page's h2s are the groups");
  assert.ok(!html.includes("<ol"), "the cards are the page's ol > li; the map uses ul");
  assert.equal((html.match(/data-testid="ask-map-row"/g) ?? []).length, table.length);
  // Every provision is a link to its destination.
  for (const r of table) for (const p of r.provisions) assert.ok(html.includes(`href="${p.href.replace(/&/g, "&amp;")}"`), p.id);
  // Phone width: rows stack below md (no sideways scroll); the labels appear only there.
  assert.match(html, /<table class="block [^"]*md:table"/);
  assert.match(html, /<thead class="hidden md:table-header-group"/);
  // The "why" cells carry no links of their own (the provisions are the links in the row).
  const whyCells = html.match(/<td[^>]*data-why-source[^>]*>.*?<\/td>/g) ?? [];
  assert.ok(whyCells.length > 0);
  for (const c of whyCells) assert.ok(!c.includes("<a "), c.slice(0, 80));
  // Every row of the example has its line (v3.1): the dash and its screen-reader note are not on /sample.
  assert.doesNotMatch(html, /No note for this component/);
  assert.ok(!html.includes("&mdash;</span>"), "no dash cell");
});

test("a row with no text at all still prints a dash and a screen-reader note (the live Ask, a map without notes)", () => {
  const html = renderToStaticMarkup(
    createElement(AskResearchMap, {
      rows: [{ component: "Other matches", provisions: [{ id: "sec-gp02-I-A", label: "GP02 I.A", title: "", href: "/regulations/gp02/preview?p=sec-gp02-I-A" }], why: null }],
    })
  );
  assert.match(html, /No note for this component/);
});

test("an empty table renders nothing (not even the line)", () => {
  assert.equal(renderToStaticMarkup(createElement(AskResearchMap, { rows: [] })), "");
});

test("live Ask: for every map, the rows are exactly the groups and provisions layoutAsk lays out (layoutAsk itself unchanged)", () => {
  const questions = [
    "What regulations apply to a natural gas-fired engine?",
    "What regulations apply to a diesel engine?",
    "What rules apply to a produced water storage tank at a well site?",
    "When is a GP01 required?",
    "What are the LDAR requirements for a well pad?",
  ];
  for (const q of questions) {
    const map = matchQuestionMap(q);
    assert.ok(map, q);
    // Every canonical row fetched; two retrieval hits from different documents.
    const hits = [
      { id: "sec-3-A-II-B", citation: "II.B.", title: "II.B. APEN", reg_key: "3", jurisdiction_level: "state", path: null },
      { id: "sec-ecmc-608-a-(1)", citation: "608.a.(1)", title: "608.a.(1)", reg_key: "ecmc", jurisdiction_level: "state", path: null },
    ];
    const canonicalIds = new Set(map!.provisions.map((p) => p.id));
    const layout = layoutAsk(q, hits, canonicalIds, false, null);
    const source = (id: string) => {
      const key = regKeyOf(id)!;
      return { id, citation: id, title: `Title ${id}`, reg_key: key };
    };
    const table = askMapRows({ map: layout.map!, grouped: layout.grouped!, source, hrefFor: hrefForHit, summaryOf: () => null });
    assert.deepEqual(table.flatMap((r) => r.provisions.map((p) => p.id)), layout.shownIds, q);
    assert.deepEqual(
      table.map((r) => r.component),
      layout.summary!.groups.map((g) => (g.group === "Other" ? OTHER_GROUP : g.group)),
      q
    );
    // Every "intro" why is one of the map's own sentences; every "map" why one of its rows' reasons.
    for (const r of table) {
      if (r.why?.source === "intro") assert.ok(map!.factors.some((f) => f.text === r.why!.text), `${q}: ${r.component}`);
      if (r.why?.source === "map") assert.ok(map!.provisions.some((p) => p.why === r.why!.text), `${q}: ${r.component}`);
    }
  }
  assert.ok(QUESTION_MAPS.length > 0);
  assert.equal(typeof groupHits, "function");
});

test("a canonical row the caller could not fetch is left out of its row, as its card is", () => {
  const map = QUESTION_MAPS.find((m) => m.key === "storage-tanks")!;
  const fetched = new Set(map.provisions.map((p) => p.id).filter((id) => id !== "sec-gp05-I-A"));
  const grouped = groupHits(map, [], fetched, {}, null);
  const table = askMapRows({
    map,
    grouped,
    source: (id) => (fetched.has(id) ? { id, citation: id, title: "", reg_key: regKeyOf(id) } : undefined),
    hrefFor: hrefForHit,
    summaryOf: () => null,
  });
  assert.ok(!table.flatMap((r) => r.provisions.map((p) => p.id)).includes("sec-gp05-I-A"));
  assert.ok(SNAPSHOT.ask.question.length > 0);
});
