/**
 * The /sample snapshot (Sprint 4, 10 Oct 2026): the shape and order of the
 * stored keyword search and Ask, which ids the page hydrates, the
 * locked-versus-open decision for a viewer, and that the Ask is laid out by
 * the same layoutAsk /search uses, to the answer the Ask eval printed.
 * Pure parts only (src/lib/sample-pure.ts); the hydration is a service-role
 * read and is not run here.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PUBLIC_READER_REGS } from "../src/lib/destination";
import { detectFacets, mapTitle, omittedLines } from "../src/lib/question-maps";
import { jurisdictionOfKey, regKeyOf } from "../src/lib/regulation-names";
import {
  ANSWER_PER_GROUP,
  KEYWORD_INITIAL,
  RECOMMENDED_START,
  SNAPSHOT,
  answerSections,
  collapseAnswer,
  isOpenForViewer,
  keywordHits,
  keywordShownIds,
  layoutSampleAsk,
  moreResultsLabel,
  sampleHref,
  sampleIds,
  showingLine,
  snapshotDateLabel,
  snapshotMap,
  splitKeywordHits,
  summaryIds,
  type SampleRow,
} from "../src/lib/sample-pure";

const KEYWORD_IDS = [
  "sec-7-B-V-C-2-w",
  "sec-ecmc-314-e-(10)-J-v-cc",
  "sec-gp08-I-B-1-c",
  "sec-gp08-II-C-1",
  "sec-gp05-II-D",
  "sec-gp12-I-A-3-d",
  "sec-ecmc-316-c-(4)-C-iii",
  "sec-gp05-I-A-1",
  "sec-ecmc-100-DEF-RECYCLED-PRODUCED-WATER-ALTERNATIVE",
  "sec-gp05-top-REG-gp05",
  "sec-ecmc-315-a-(5)-D",
  "sec-ecmc-100-DEF-TANK",
  "sec-gp01-I-A-1",
  "sec-7-B-I-F-2-c-(i)",
  "sec-ecmc-431-a",
  "sec-ecmc-609-c-(2)",
  "sec-ecmc-603-o",
  "sec-3-A-II-D-1-uuu",
  "sec-3-C-II-E-3-yyy",
  "sec-3-A-IX-A-2-b-(lvi)",
  "sec-ecmc-411-a-(2)-B-ii",
  "sec-7-B-I-C-2-a-(iv)",
  "sec-gp12-VII-A-2",
  "sec-ecmc-309-e-(5)-D-i-bb",
  "sec-ecmc-1202-a-(10)-B",
];

/** Label rows for every id the page hydrates, as the service-role read would return them. */
function fakeRows(drop: (id: string) => boolean = () => false): Map<string, SampleRow> {
  const rows = new Map<string, SampleRow>();
  for (const id of sampleIds()) {
    if (drop(id)) continue;
    const key = regKeyOf(id)!;
    rows.set(id, {
      id,
      citation: id.replace(/^sec-[^-]+-/, ""),
      title: "",
      reg_key: key,
      jurisdiction_level: jurisdictionOfKey(key),
      context_path: null,
    });
  }
  return rows;
}

test("the keyword snapshot: 25 results in the stored order, the page shows the first 10 (5 open, 5 behind a disclosure)", () => {
  assert.equal(SNAPSHOT.keyword.query, "produced water tank");
  assert.deepEqual(SNAPSHOT.keyword.ids, KEYWORD_IDS);
  assert.equal(new Set(SNAPSHOT.keyword.ids).size, 25, "no repeats");
  assert.equal(SNAPSHOT.keyword.total, 25);
  assert.equal(SNAPSHOT.keyword.show, 10);
  assert.deepEqual(keywordShownIds(), KEYWORD_IDS.slice(0, 10));
  // Sprint 5, 10 Oct 2026: five open at first, the other five behind "Show 5 more results".
  assert.equal(KEYWORD_INITIAL, 5);
  assert.equal(showingLine(), "Showing 5 of 25 results");
  assert.equal(moreResultsLabel(), "Show 5 more results (10 of 25)");
  // The stamp is an instant: 03:46 UTC on 10 Oct is the evening of 9 Oct in Colorado.
  assert.equal(SNAPSHOT.generated, "2026-10-10T03:46:43Z");
  assert.equal(snapshotDateLabel(), "9 Oct 2026");
});

test("the dates the page prints are Colorado's: an instant shifts, a bare date does not", () => {
  const at = (generated: string) => ({ ...SNAPSHOT, generated });
  assert.equal(snapshotDateLabel(at("2026-10-10T05:59:00Z")), "9 Oct 2026");
  assert.equal(snapshotDateLabel(at("2026-10-10T06:00:00Z")), "10 Oct 2026");
  assert.equal(snapshotDateLabel(at("2026-10-10")), "10 Oct 2026");
});

test("splitKeywordHits: the first five open, the rest behind the disclosure, nothing lost or reordered", () => {
  const all = keywordHits(fakeRows());
  const { first, more } = splitKeywordHits(all);
  assert.equal(first.length, 5);
  assert.equal(more.length, 5);
  assert.deepEqual([...first, ...more].map((h) => h.id), all.map((h) => h.id));
  // Fewer hits than five: nothing to disclose.
  const few = splitKeywordHits(all.slice(0, 3));
  assert.equal(few.first.length, 3);
  assert.equal(few.more.length, 0);
  assert.equal(moreResultsLabel({ ...SNAPSHOT, keyword: { ...SNAPSHOT.keyword, show: 6 } }), "Show 1 more result (6 of 25)");
});

test("the recommended starting point is GP05, linked into its reader", () => {
  assert.equal(RECOMMENDED_START.label, "GP05 \u2014 Produced Water Storage Tank Batteries");
  assert.equal(RECOMMENDED_START.href, "/regulations/gp05");
  assert.ok(isOpenForViewer("gp05", false), "a visitor can open where it points");
});

test("the Ask answer opens with three provisions per group; the rest is behind 'See the complete sample answer'", () => {
  const ask = layoutSampleAsk(fakeRows());
  const sections = answerSections(ask);
  assert.ok(sections.length > 1);
  const { head, rest } = collapseAnswer(sections);
  assert.equal(ANSWER_PER_GROUP, 3);
  for (const g of head) assert.ok(g.items.length >= 1 && g.items.length <= 3, g.title);
  assert.deepEqual(head.map((g) => g.title), sections.map((g) => g.title), "every group keeps its heading and its place");
  // At least one group is long enough to be cut, or the disclosure would be empty.
  assert.ok(rest.length > 0);
  // Head and rest together are the whole answer, in order, once each.
  const rejoined = sections.map((g) => {
    const tail = rest.find((r) => r.title === g.title);
    return [...head.find((h) => h.title === g.title)!.items, ...(tail?.items ?? [])].map((i) => i.hit.id);
  });
  assert.deepEqual(rejoined, sections.map((g) => g.items.map((i) => i.hit.id)));
  const all = rejoined.flat();
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), [...ask.shownIds].sort(), "the same rows the layout shows");
  // The reasons a canonical row is there travel with it, in the head and in the rest.
  assert.ok(head.some((g) => g.items.some((i) => i.why)), "a canonical row keeps its reason");
});

test("collapseAnswer: a group with three or fewer rows has no entry behind the disclosure", () => {
  const item = (id: string) => ({ hit: { id } as never });
  const sections = [
    { title: "Short", items: [item("a"), item("b"), item("c")] },
    { title: "Long", items: [item("d"), item("e"), item("f"), item("g"), item("h")] },
  ];
  const { head, rest } = collapseAnswer(sections);
  assert.deepEqual(head.map((g) => g.items.length), [3, 3]);
  assert.deepEqual(rest.map((g) => [g.title, g.items.map((i) => i.hit.id)]), [["Long", ["g", "h"]]]);
  assert.deepEqual(collapseAnswer(sections, 5).rest, []);
});

test("the Ask snapshot: 20 hits in retrieval order, scores and keyword flags as the eval printed them", () => {
  const { ask } = SNAPSHOT;
  assert.equal(ask.question, "Produced water storage tanks and tank batteries");
  assert.equal(ask.hits.length, 20);
  assert.equal(new Set(ask.hits.map((h) => h.id)).size, 20);
  assert.deepEqual(ask.hits[0], { id: "sec-gp05-I-A-1", score: 0.576, keyword_hit: true });
  assert.deepEqual(ask.hits[5], { id: "sec-gp05-top-REG-gp05", score: 0.539, keyword_hit: true });
  assert.deepEqual(ask.hits[19], { id: "sec-ecmc-608-a-(1)-F", score: 0.521, keyword_hit: false });
  assert.deepEqual(
    ask.hits.filter((h) => h.keyword_hit).map((h) => h.id),
    ["sec-gp05-I-A-1", "sec-gp01-I-A-1", "sec-gp05-top-REG-gp05"]
  );
  for (const h of ask.hits) {
    assert.ok(h.score > 0.4 && h.score < 1, h.id);
    assert.ok(/^sec-[^-]+-/.test(h.id), h.id);
  }
  assert.match(ask.provenance, /38020544005/);
  assert.match(SNAPSHOT.keyword.provenance, /search_provisions/);
});

test("the snapshot's question routes to the stored map with the stated fact (the same router /search uses)", () => {
  const map = snapshotMap();
  assert.equal(map?.key, SNAPSHOT.ask.map_key);
  assert.equal(map?.key, "storage-tanks");
  const stated = detectFacets(SNAPSHOT.ask.question, map);
  assert.deepEqual(
    Object.entries(stated).map(([n, v]) => `${n}=${v!.value}`),
    [SNAPSHOT.ask.stated]
  );
  assert.equal(mapTitle(map!, stated), SNAPSHOT.ask.eval_printed.shown_as);
  assert.deepEqual(
    omittedLines(map!, stated).map((o) => `${o.said}: ${o.omitted}`),
    [`produced water: ${SNAPSHOT.ask.eval_printed.not_shown}`]
  );
});

test("sampleIds: every id once, the shown keyword ids, the Ask hits and the map's rows; nothing else", () => {
  const ids = sampleIds();
  assert.equal(new Set(ids).size, ids.length);
  for (const id of keywordShownIds()) assert.ok(ids.includes(id), id);
  for (const h of SNAPSHOT.ask.hits) assert.ok(ids.includes(h.id), h.id);
  for (const p of snapshotMap()!.provisions) assert.ok(ids.includes(p.id), p.id);
  assert.ok(!ids.includes("sec-ecmc-1202-a-(10)-B"), "a keyword result beyond the first 10 is not hydrated");
  // One .in("id", ids) read: a few dozen ids, not a query per row.
  assert.ok(ids.length < 80, String(ids.length));
});

test("summaryIds: summaries are hydrated only for the regulation open to visitors", () => {
  assert.deepEqual([...PUBLIC_READER_REGS], ["gp05"]);
  assert.deepEqual(summaryIds(sampleIds()).filter((id) => regKeyOf(id) !== "gp05"), []);
  assert.ok(summaryIds(sampleIds()).includes("sec-gp05-II-D"));
  assert.deepEqual(summaryIds(["sec-7-B-V-C-2-w", "sec-gp12-I-A-3-d", "sec-gp05-I-A-1", "sec-gp050-I"]), ["sec-gp05-I-A-1"]);
});

test("locked or open: GP05 opens for everyone, the rest only for a subscriber", () => {
  assert.equal(isOpenForViewer("gp05", false), true);
  assert.equal(isOpenForViewer("gp12", false), false);
  assert.equal(isOpenForViewer("7", false), false);
  assert.equal(isOpenForViewer("ecmc", false), false);
  assert.equal(isOpenForViewer(null, false), false);
  for (const reg of ["gp05", "gp12", "7", "ecmc"]) assert.equal(isOpenForViewer(reg, true), true, reg);

  // The link is the destination rule: reader for GP05 / subscribers, focused preview otherwise.
  assert.equal(sampleHref({ id: "sec-gp05-II-D", reg_key: "gp05" }, false), "/regulations/gp05#sec-gp05-II-D");
  assert.equal(sampleHref({ id: "sec-gp12-I-A-3-d", reg_key: "gp12" }, false), "/regulations/gp12/preview?p=sec-gp12-I-A-3-d");
  assert.equal(
    sampleHref({ id: "sec-ecmc-314-e-(10)-J-v-cc", reg_key: "ecmc" }, false),
    `/regulations/ecmc/preview?p=${encodeURIComponent("sec-ecmc-314-e-(10)-J-v-cc")}`
  );
  assert.equal(sampleHref({ id: "sec-ecmc-314-e-(10)-J-v-cc", reg_key: "ecmc" }, true), "/regulations/ecmc#sec-ecmc-314-e-(10)-J-v-cc");

  // On the page's own results: with no access, exactly the GP05 ones are open.
  const shown = keywordHits(fakeRows());
  assert.equal(shown.length, 10);
  assert.deepEqual(
    shown.filter((h) => isOpenForViewer(h.reg_key, false)).map((h) => h.id),
    ["sec-gp05-II-D", "sec-gp05-I-A-1", "sec-gp05-top-REG-gp05"]
  );
  assert.ok(shown.every((h) => isOpenForViewer(h.reg_key, true)), "a subscriber sees nothing locked");
  assert.ok(shown.every((h) => h.summary === null && h.score === null && !h.retrieved), "label rows: no summary, no score");
});

test("keyword results keep the stored order and skip ids that are gone or staged", () => {
  const missing = new Set(["sec-gp08-I-B-1-c", "sec-gp05-II-D"]);
  const shown = keywordHits(fakeRows((id) => missing.has(id)));
  assert.deepEqual(
    shown.map((h) => h.id),
    keywordShownIds().filter((id) => !missing.has(id))
  );
});

test("the Ask is laid out by layoutAsk to the answer the eval printed", () => {
  const ask = layoutSampleAsk(fakeRows());
  assert.equal(ask.map?.key, "storage-tanks");
  assert.ok(ask.grouped);
  assert.deepEqual(
    ask.shownIds.slice(0, 5),
    SNAPSHOT.ask.eval_printed.first_shown,
    "the first rows shown are the eval's"
  );
  assert.deepEqual(
    [...ask.grouped!.omittedIds].sort(),
    [...SNAPSHOT.ask.eval_printed.omitted_ids].sort(),
    "the rows left out because the question said produced water"
  );
  assert.deepEqual(ask.summary?.stated, ["contents=produced water"]);
  assert.equal(ask.summary?.title, "Produced water storage tanks and tank batteries");
  // Every shown id is laid out once, and a card exists for each.
  const shown = ask.shownIds;
  assert.equal(new Set(shown).size, shown.length);
  const known = new Set([...ask.hits.map((h) => h.id), ...ask.canonicalRows.keys()]);
  for (const id of shown) assert.ok(known.has(id), id);
  // A canonical row retrieval also found keeps its score; the others have none.
  assert.equal(ask.canonicalRows.get("sec-gp05-top-REG-gp05"), undefined, "not a canonical row of this map");
  const canon = ask.canonicalRows.get("sec-gp08-I-B");
  assert.equal(canon?.retrieved, false);
  assert.equal(canon?.score, null);
  // GP05 and the rest of the retrieval hits are scored cards.
  const gp05 = ask.hits.find((h) => h.id === "sec-gp05-I-A-1");
  assert.equal(gp05?.retrieved, true);
  assert.equal(gp05?.score, 0.576);
  assert.equal(gp05?.keyword_hit, true);
});

test("the Ask layout skips hits that no longer exist and canonical rows that are gone", () => {
  const gone = new Set(["sec-gp05-I-A-1", "sec-3-A-II-A"]);
  const ask = layoutSampleAsk(fakeRows((id) => gone.has(id)));
  for (const id of gone) assert.ok(!ask.shownIds.includes(id), id);
  assert.ok(!ask.canonicalRows.has("sec-3-A-II-A"));
  assert.ok(ask.shownIds.includes("sec-3-A-II-B-3"));
});
