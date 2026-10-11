/**
 * The About page's "What's covered today" (Sprint 8, 11 Oct 2026) is
 * computed from the released regulation roots by src/lib/corpus-coverage.ts,
 * not written by hand. This proves the grouping against an independent
 * count over the same rows (by the shape of the reg key, not through the
 * grouping functions the page uses), that every jurisdiction in the corpus
 * has a group, that a staged document is not counted, the dated sentence,
 * and the rendered section. No database, no Next.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CorpusCoverage } from "../src/components/CorpusCoverage";
import { fetchSnapshotDateWith, type ChangelogClient } from "../src/lib/changelog";
import {
  collapseNumbered,
  corpusCoverage,
  countPhrase,
  coverageItemName,
  coverageSummaryLine,
  type CoverageRoot,
} from "../src/lib/corpus-coverage";
import { formatDayMonthYear } from "../src/lib/dates";
import { filterReleased, rootIdOf } from "../src/lib/regulation-pure";

function root(key: string, citation: string, issuing_body: string, jurisdiction_level: "state" | "federal"): CoverageRoot {
  return { id: rootIdOf(key), citation, issuing_body, jurisdiction_level };
}

const aqcc = (key: string, citation: string) => root(key, citation, "CDPHE-APCD", "state");

/** One root of every kind the corpus holds, in id order like fetchRegulationRoots returns them. */
const ROOTS: CoverageRoot[] = [
  aqcc("26", "Code of Colorado Regulations · Regulation Number 26"),
  aqcc("3", "Code of Colorado Regulations · Regulation Number 3"),
  aqcc("7", "Regulation 7"),
  aqcc("aqs", "Code of Colorado Regulations · Air Quality Standards, Designations and Emission Budgets"),
  aqcc("cp", "Code of Colorado Regulations · Common Provisions Regulation"),
  aqcc("proc", "Code of Colorado Regulations · AQCC Procedural Rules"),
  aqcc("gp01", "APCD General Permit GP01"),
  aqcc("gp05", "APCD General Permit GP05"),
  aqcc("gp12", "APCD General Permit GP12"),
  root("ecmc", "2 CCR 404-1", "ECMC", "state"),
  root("iiii", "40 CFR Part 60 Subpart IIII", "EPA", "federal"),
  root("oooo", "40 CFR Part 60 Subpart OOOO", "EPA", "federal"),
  root("oooob", "40 CFR Part 60 Subpart OOOOb", "EPA", "federal"),
  root("zzzz", "40 CFR Part 63 Subpart ZZZZ", "EPA", "federal"),
  root("p192", "49 CFR Part 192", "PHMSA", "federal"),
  root("p195", "49 CFR Part 195", "PHMSA", "federal"),
];

/** The independent count: from the reg key and the two stored columns, no grouping function involved. */
function directCounts(rows: CoverageRoot[]) {
  const keyOf = (r: CoverageRoot) => r.id.split("-")[1];
  const state = rows.filter((r) => r.jurisdiction_level === "state");
  const federal = rows.filter((r) => r.jurisdiction_level === "federal");
  return {
    colorado: state.length,
    federal: federal.length,
    gp: state.filter((r) => /^gp\d\d$/.test(keyOf(r))).length,
    ecmc: state.filter((r) => keyOf(r) === "ecmc").length,
    aqcc: state.filter((r) => !/^gp\d\d$/.test(keyOf(r)) && keyOf(r) !== "ecmc").length,
    part60: federal.filter((r) => /^40 CFR Part 60 /.test(r.citation)).length,
    part63: federal.filter((r) => /^40 CFR Part 63 /.test(r.citation)).length,
    phmsa: federal.filter((r) => /^49 CFR Part \d+/.test(r.citation)).length,
  };
}

function countOf(coverage: ReturnType<typeof corpusCoverage>, key: string): number {
  return coverage.groups.find((g) => g.key === key)?.count ?? 0;
}

test("the About counts equal a direct count by jurisdiction over the same rows", () => {
  const coverage = corpusCoverage(ROOTS);
  const direct = directCounts(ROOTS);
  assert.equal(coverage.colorado, direct.colorado);
  assert.equal(coverage.federal, direct.federal);
  assert.equal(coverage.total, ROOTS.length);
  assert.equal(countOf(coverage, "aqcc"), direct.aqcc);
  assert.equal(countOf(coverage, "gp"), direct.gp);
  assert.equal(countOf(coverage, "ecmc"), direct.ecmc);
  assert.equal(countOf(coverage, "60"), direct.part60);
  assert.equal(countOf(coverage, "63"), direct.part63);
  assert.equal(countOf(coverage, "49"), direct.phmsa);
  // Nothing falls between the groups and nothing is counted twice.
  assert.equal(coverage.groups.reduce((n, g) => n + g.count, 0), ROOTS.length);
  // The fixture really covers each jurisdiction the brief names.
  assert.deepEqual(direct, { colorado: 10, federal: 6, gp: 3, ecmc: 1, aqcc: 6, part60: 3, part63: 1, phmsa: 2 });
});

test("the same holds for the production-sized shape /states and /federal print", () => {
  // The root list states.test.ts and marketing-index.test.ts pin: 32
  // Colorado documents besides the permits, 11 permits, 15 federal.
  const keys = (list: string[], citation: (k: string) => string, body: string, level: "state" | "federal") =>
    list.map((k) => root(k, citation(k), body, level));
  const rows: CoverageRoot[] = [
    ...keys(["1", "10", "11", "12", "15", "16", "18", "19", "2", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "3", "30", "31", "4", "6", "7", "8", "9", "aqs", "cp", "proc", "sip"], (k) => `Code of Colorado Regulations · ${k}`, "CDPHE-APCD", "state"),
    ...keys(["ecmc"], () => "2 CCR 404-1", "ECMC", "state"),
    ...keys(["gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12"], (k) => `APCD General Permit ${k.toUpperCase()}`, "CDPHE-APCD", "state"),
    ...keys(["iiii", "jjjj", "oooo", "ooooa", "oooob", "ooooc"], (k) => `40 CFR Part 60 Subpart ${k.toUpperCase()}`, "EPA", "federal"),
    ...keys(["zzzz"], () => "40 CFR Part 63 Subpart ZZZZ", "EPA", "federal"),
    ...keys(["p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"], (k) => `49 CFR Part ${k.slice(1)}`, "PHMSA", "federal"),
  ];
  const coverage = corpusCoverage(rows);
  const direct = directCounts(rows);
  assert.equal(countOf(coverage, "aqcc"), direct.aqcc);
  assert.equal(countOf(coverage, "gp"), 11);
  assert.equal(countOf(coverage, "ecmc"), 1);
  assert.equal(countOf(coverage, "60"), 6);
  assert.equal(countOf(coverage, "63"), 1);
  assert.equal(countOf(coverage, "49"), 8);
  assert.equal(coverage.total, rows.length);
  assert.equal(coverage.colorado, 43);
  assert.equal(coverage.federal, 15);
});

test("groups come Colorado first in the index order, then federal, each with its index heading", () => {
  const coverage = corpusCoverage(ROOTS);
  assert.deepEqual(
    coverage.groups.map((g) => [g.jurisdiction, g.key]),
    [["state", "aqcc"], ["state", "gp"], ["state", "ecmc"], ["federal", "60"], ["federal", "63"], ["federal", "49"]]
  );
  assert.deepEqual(
    coverage.groups.map((g) => g.heading),
    [
      "Air Quality Control Commission (5 CCR 1001)",
      "APCD General Permits",
      "Energy and Carbon Management Commission (2 CCR 404-1)",
      "EPA — 40 CFR Part 60 (New Source Performance Standards)",
      "EPA — 40 CFR Part 63 (NESHAP)",
      "PHMSA — 49 CFR Pipeline Safety",
    ]
  );
});

test("names: numbered regulations fold into one entry, the rest keep their display names", () => {
  const byKey = (k: string) => corpusCoverage(ROOTS).groups.find((g) => g.key === k)!;
  // Order: the Procedural Rules, Common Provisions, the numbered regulations (folded into the lead entry), then aqs.
  assert.deepEqual(byKey("aqcc").items, [
    "Regulations 3, 7, 26",
    "AQCC Procedural Rules",
    "Common Provisions Regulation",
    "Air Quality Standards, Designations and Emission Budgets",
  ]);
  assert.deepEqual(byKey("gp").items, ["GP01", "GP05", "GP12"]);
  assert.deepEqual(byKey("ecmc").items, ["2 CCR 404-1 (ECMC Rules)"]);
  assert.deepEqual(byKey("60").items, ["Subpart IIII", "Subpart OOOO", "Subpart OOOOb"]);
  assert.deepEqual(byKey("63").items, ["Subpart ZZZZ"]);
  assert.deepEqual(byKey("49").items, ["Part 192", "Part 195"]);
  assert.equal(coverageItemName(ROOTS[0]), "Regulation 26");
  assert.deepEqual(collapseNumbered(["Regulation 3"]), ["Regulation 3"]);
  assert.deepEqual(collapseNumbered(["Common Provisions Regulation"]), ["Common Provisions Regulation"]);
});

test("a staged document is not counted: the released filter runs before the grouping", () => {
  const released = filterReleased(ROOTS, new Set(["oooob", "gp12"]));
  const coverage = corpusCoverage(released);
  assert.equal(coverage.total, ROOTS.length - 2);
  assert.equal(countOf(coverage, "gp"), 2);
  assert.equal(countOf(coverage, "60"), 2);
  assert.ok(!coverage.groups.flatMap((g) => g.items).some((n) => /OOOOb|GP12/.test(n)));
});

test("an empty corpus has no groups; a federal-only set has no Colorado group", () => {
  assert.deepEqual(corpusCoverage([]), { groups: [], total: 0, colorado: 0, federal: 0 });
  const federalOnly = corpusCoverage(ROOTS.filter((r) => r.jurisdiction_level === "federal"));
  assert.equal(federalOnly.colorado, 0);
  assert.ok(federalOnly.groups.every((g) => g.jurisdiction === "federal"));
});

test("count phrases pluralise", () => {
  assert.equal(countPhrase({ count: 1, noun: "rule" }), "1 rule");
  assert.equal(countPhrase({ count: 31, noun: "regulation" }), "31 regulations");
  assert.equal(countPhrase({ count: 8, noun: "part" }), "8 parts");
});

test("the section is dated by the snapshot, in Denver time, and says nothing made-up without one", () => {
  const coverage = corpusCoverage(ROOTS);
  // 03:30 UTC on the 12th is still the evening of 11 Oct in Colorado.
  const asOf = formatDayMonthYear("2026-10-12T03:30:00+00:00");
  assert.equal(asOf, "11 Oct 2026");
  assert.equal(coverageSummaryLine(coverage, asOf), "As of 11 Oct 2026, the corpus holds 16 documents: 10 from Colorado and 6 federal.");
  assert.equal(coverageSummaryLine(coverage, null), "The corpus holds 16 documents: 10 from Colorado and 6 federal.");
});

test("the snapshot date comes from changelog_snapshot_public alone, and a failure is null, not a live aggregate", async () => {
  const calls: string[] = [];
  const client = (answer: { data?: unknown; error?: string } | Error): ChangelogClient => ({
    rpc(fn: string) {
      calls.push(fn);
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ? { message: answer.error } : null });
    },
  });
  assert.equal(await fetchSnapshotDateWith(client({ data: [{ rows: [], computed_at: "2026-10-12T03:30:00+00:00" }] })), "2026-10-12T03:30:00+00:00");
  assert.equal(await fetchSnapshotDateWith(client({ data: [] })), null);
  assert.equal(await fetchSnapshotDateWith(client({ error: "statement timeout" })), null);
  assert.equal(await fetchSnapshotDateWith(client(new Error("fetch failed"))), null);
  assert.deepEqual([...new Set(calls)], ["changelog_snapshot_public"]);
});

test("the rendered section shows the dated sentence, every group's count and name, and drops 'More is coming'", () => {
  const html = renderToStaticMarkup(createElement(CorpusCoverage, { coverage: corpusCoverage(ROOTS), asOf: "11 Oct 2026" }));
  assert.match(html, /As of 11 Oct 2026, the corpus holds 16 documents: 10 from Colorado and 6 federal\./);
  assert.match(html, /Colorado \(10\)/);
  assert.match(html, /Federal \(6\)/);
  assert.match(html, /<strong>Air Quality Control Commission \(5 CCR 1001\)<\/strong> — 6 regulations: Regulations 3, 7, 26/);
  assert.match(html, /<strong>APCD General Permits<\/strong> — 3 permits: GP01, GP05, GP12\./);
  assert.match(html, /<strong>Energy and Carbon Management Commission \(2 CCR 404-1\)<\/strong> — 1 rule: /);
  assert.match(html, /40 CFR Part 60 \(New Source Performance Standards\)<\/strong> — 3 subparts: Subpart IIII, Subpart OOOO, Subpart OOOOb\./);
  assert.match(html, /40 CFR Part 63 \(NESHAP\)<\/strong> — 1 subpart: Subpart ZZZZ\./);
  assert.match(html, /PHMSA — 49 CFR Pipeline Safety<\/strong> — 2 parts: Part 192, Part 195\./);
  assert.doesNotMatch(html, /More is coming/);
});
