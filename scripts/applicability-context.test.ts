/**
 * Applicability context on the reader's summary panels (9 Oct 2026): the
 * table's dates equal the subparts' own text (pipeline/sources), its setter
 * ids are live provisions, the server marks exactly the eligible rows, and
 * the browser fills the marker with the line and a link to the setter.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { APPLICABILITY_CONTEXTS, applicabilityContextFor, applicabilityContextHtml, applicabilityContextKey } from "../src/lib/applicability-context";
import { fillApplicabilityContexts, readReaderModel } from "../src/lib/reader-client";
import { renderReaderBody } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

const root = path.join(__dirname, "..");
const corpus = JSON.parse(readFileSync(path.join(root, "pipeline", "out", "corpus_ids.json"), "utf8")) as Record<string, string[]>;
const source = (name: string) => readFileSync(path.join(root, "pipeline", "sources", `${name}.txt`), "utf8").replace(/\s+/g, " ");

test("each window in the table is the one the subpart's applicability text states", () => {
  const oooo = source("OOOO");
  assert.match(oooo, /commence construction, modification, or reconstruction after August 23, 2011, and on or before September 18, 2015/);
  assert.match(source("OOOOa"), /commence construction, modification, or reconstruction after September 18, 2015, and on or before December 6, 2022/);
  assert.match(source("OOOOb"), /commence construction, modification, or reconstruction after December 6, 2022/);
  assert.match(source("OOOOc"), /Designated facilities in your state that commenced construction, modification, or reconstruction on or before December 6, 2022/);
  const text = (k: string) => APPLICABILITY_CONTEXTS.find((c) => c.key === k)!.text;
  assert.match(text("oooo"), /after August 23, 2011, and on or before September 18, 2015/);
  assert.match(text("ooooa"), /after September 18, 2015, and on or before December 6, 2022/);
  assert.match(text("oooob"), /after December 6, 2022\./);
  assert.match(text("ooooc"), /on or before December 6, 2022/);
});

test("every setter and exception id is a live provision of its own document", () => {
  for (const c of APPLICABILITY_CONTEXTS) {
    const ids = new Set(corpus[c.key]);
    assert.ok(ids.has(c.setter.id), `${c.setter.id} is not a live provision`);
    for (const id of [...c.exceptIds, ...c.exceptSubtrees]) assert.ok(ids.has(id), `${id} is not a live provision`);
    assert.ok(c.under.startsWith(`sec-${c.key}-`));
  }
});

test("§ 60.5365(e) carries the OOOO window line and a link to § 60.5365; the setters and definitions do not", () => {
  assert.equal(applicabilityContextKey("sec-oooo-60.5365-(e)"), "oooo");
  assert.equal(applicabilityContextKey("sec-oooo-60.5365-(e)-(3)-(i)"), "oooo");
  assert.equal(applicabilityContextKey("sec-oooo-60.5365"), null);
  assert.equal(applicabilityContextKey("sec-oooo-60.5360"), null);
  assert.equal(applicabilityContextKey("sec-oooo-60.5430"), null);
  assert.equal(applicabilityContextKey("sec-oooo-60.5430-(a)"), null);
  assert.equal(applicabilityContextKey("sec-oooo-TABLE-1"), null);
  assert.equal(applicabilityContextKey("sec-oooo-top-REG-oooo"), null);
  assert.equal(applicabilityContextKey("sec-ooooa-60.5365a-(e)"), "ooooa");
  assert.equal(applicabilityContextKey("sec-oooob-60.5395b"), "oooob");
  assert.equal(applicabilityContextKey("sec-ooooc-60.5396c"), "ooooc");
  assert.equal(applicabilityContextKey("sec-ooooc-60.5375c-(a)-(1)"), null);
  // Documents not read yet carry nothing.
  for (const id of ["sec-7-B-I-D", "sec-gp01-I-A", "sec-jjjj-60.4230", "sec-p192-192.3", "sec-3-A-II-A"]) assert.equal(applicabilityContextKey(id), null, id);
  const html = applicabilityContextHtml(applicabilityContextFor("oooo")!);
  assert.match(html, /Applicability context:/);
  assert.match(html, /after August 23, 2011, and on or before September 18, 2015/);
  assert.match(html, /<span class="xref summary-context-link" data-target="sec-oooo-60\.5365">§ 60\.5365<\/span>/);
});

const row = (id: string, parent: string | null, citation: string, extra: Partial<Provision> = {}): Provision =>
  ({
    id,
    parent_id: parent,
    citation,
    title: citation,
    full_text: `<p>${citation} text</p>`,
    ai_summary: `Summary of ${citation}.\n\nMore.`,
    summary_status: "approved",
    reviewed_at: "2026-10-08T12:00:00Z",
    source_url: null,
    jurisdiction_level: "federal",
    reg_key: "oooo",
    ...extra,
  }) as unknown as Provision;

test("the server leaves an empty marker under the badge of eligible rows only; the browser fills it", () => {
  const all = [
    row("sec-oooo-top-REG-oooo", null, "40 CFR Part 60 Subpart OOOO", { source_url: "https://www.ecfr.gov/x" }),
    row("sec-oooo-60.5365", "sec-oooo-top-REG-oooo", "60.5365"),
    row("sec-oooo-60.5365-(e)", "sec-oooo-60.5365", "(e)"),
  ];
  const reader = renderReaderBody(all);
  assert.ok(reader);
  const dom = new JSDOM(`<!doctype html><div id="doc">${reader.docHtml}</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll("p.summary-context").length, 1);
  const marker = doc.querySelector('[id="sec-oooo-60.5365-(e)"] p.summary-context')!;
  assert.equal(marker.getAttribute("data-ctx"), "oooo");
  assert.equal(marker.textContent, "");
  // Directly under the badge, before the summary text.
  assert.ok(marker.previousElementSibling?.classList.contains("summary-badge"));
  const model = readReaderModel(doc.getElementById("doc") as HTMLElement);
  fillApplicabilityContexts(model);
  assert.match(marker.textContent ?? "", /^Applicability context: .*August 23, 2011.*September 18, 2015.* § 60\.5365$/);
  assert.equal(marker.querySelector(".xref")?.getAttribute("data-target"), "sec-oooo-60.5365");
  // Idempotent.
  const before = marker.innerHTML;
  fillApplicabilityContexts(model);
  assert.equal(marker.innerHTML, before);
});
