/**
 * Proves that the furniture RegulationReader rebuilds in the browser
 * (reader-client.ts) is what the server used to ship, item for item:
 *
 *   - the tree read back from the flat #doc equals parent_id for every row;
 *   - every contains box is byte-identical to containsBoxHtml(children);
 *   - the search index deep-equals buildSearchIndex(all);
 *   - every summary panel's source link points where summaryPanelHtml
 *     pointed it (p.source_url ?? root.source_url), and no panel that had
 *     no link grows one.
 *
 * Runs against a small synthetic regulation that covers every edge the
 * corpus has (citation badge inside/outside a <p>, text that already opens
 * with its citation, &lt; and &nbsp; in text, a quote in a citation, a Part
 * stored after an Appendix, a row with its own source_url), and against
 * every fixture regulation present in scripts/fixtures/ (real rows; see
 * scripts/reader-harness.ts for how to pull them -- they are git-ignored,
 * so CI runs the synthetic case only).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  buildSearchIndex,
  buildTree,
  containsBoxFromRows,
  containsBoxHtml,
  sanitizeHtml,
  summarySourceLinkHtml,
} from "../src/lib/regulation-pure";
import {
  buildSearchIndexFromDom,
  fillContainsBoxes,
  fillSummaryLinks,
  readReaderModel,
} from "../src/lib/reader-client";
import { renderReaderBody } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

/** jsdom's serialisation of a server HTML string, for DOM-level comparison. */
function domNormalize(document: Document, html: string): string {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.innerHTML;
}

function checkRegulation(all: Provision[]) {
  const reader = renderReaderBody(all);
  assert.ok(reader, "renderReaderBody found a root");
  const { childrenOf, root } = buildTree(all);
  assert.ok(root);

  const dom = new JSDOM(`<!doctype html><div id="doc">${reader.docHtml}</div>`);
  const { window } = dom;
  const doc = window.document.getElementById("doc")!;
  const model = readReaderModel(doc);

  // Tree: same rows, same order, same parents as the database.
  assert.deepEqual(
    model.rows.map((r) => [r.id, r.parent]),
    all.map((p) => [p.id, p.parent_id])
  );

  // Contains boxes: the string the browser inserts is byte-identical to the
  // one the server built from full_text, for every provision.
  fillSummaryLinks(model);
  fillContainsBoxes(model);
  let boxes = 0;
  for (const p of all) {
    const children = childrenOf.get(p.id) ?? [];
    const server = containsBoxHtml(children);
    const clientChildren = model.childrenOf.get(p.id) ?? [];
    const client = containsBoxFromRows(
      clientChildren.map((c) => ({ id: c.id, citation: c.citation, snippet: model.snippetOf(c) }))
    );
    assert.equal(client, server, `contains box of ${p.id}`);
    const inserted = model.byId.get(p.id)!.el.querySelector(":scope > ul.contains");
    if (server) {
      boxes++;
      assert.equal(inserted?.outerHTML, domNormalize(window.document, server), `inserted box of ${p.id}`);
      assert.equal(inserted, model.byId.get(p.id)!.el.lastElementChild, `box of ${p.id} is last`);
    } else {
      assert.equal(inserted, null, `${p.id} has no box`);
    }
  }
  assert.ok(boxes > 0, "the regulation has at least one contains box");

  // Search index: same rows, same snippets, same top groups.
  assert.deepEqual(buildSearchIndexFromDom(model), buildSearchIndex(all));

  // Summary source links: where summaryPanelHtml put one, with its URL.
  let links = 0;
  for (const p of all) {
    const el = model.byId.get(p.id)!.el;
    const status = el.querySelector(":scope > details.summary-panel > .summary-status");
    const expectedUrl: string | null = p.source_url ?? root.source_url ?? null;
    const hasPanel = el.querySelector(":scope > details.summary-panel") !== null;
    if (!hasPanel || !expectedUrl) {
      assert.equal(status, null, `${p.id} has no source link row`);
      continue;
    }
    links++;
    assert.equal(status?.innerHTML, domNormalize(window.document, summarySourceLinkHtml(expectedUrl)), `source link of ${p.id}`);
  }
  return { rows: all.length, boxes, links };
}

const ROOT = "sec-t-top-REG-t";
const SRC = "https://example.gov/reg-t";
const synthetic: Provision[] = [
  row(ROOT, "REGULATION T", null, "<p>REGULATION T Synthetic test regulation</p>", { source_url: SRC, ai_summary: "Root summary." }),
  row("sec-t-A-PART-A", "PART A", ROOT, "<p>PART A Applicability &amp; scope</p>", { ai_summary: "Part A summary.\n\nSecond paragraph." }),
  row("sec-t-A-I", "I.", "sec-t-A-PART-A", "<p>Definitions</p><p>Words mean things, 1 &lt; 2 and a&nbsp;b.</p>", {
    ai_summary: "Own-url summary.",
    source_url: "https://example.gov/other",
  }),
  row("sec-t-A-I-A", "I.A.", "sec-t-A-I", '<p>"Air" means the stuff you breathe -- 2.5 tons per year</p>'),
  row("sec-t-A-I-B", "I.B.", "sec-t-A-I", "<p>I.B. Text that already opens with its citation</p>"),
  row("sec-t-A-I-C", "I.C.", "sec-t-A-I", "<p>I.C.</p>"),
  row("sec-t-A-I-C-1", "1.", "sec-t-A-I-C", "<table><tr><td>No leading paragraph, table first</td></tr></table>"),
  row("sec-t-A-II", 'II. "Quoted"', "sec-t-A-PART-A", "<div>Starts with a div, <b>bold</b> &amp; <span class=\"xref\" data-target=\"sec-t-A-I\">I.</span></div>", { ai_summary: "Rejected.", summary_status: "rejected" }),
  row("sec-t-A-APPENDIX-A", "APPENDIX A", ROOT, "<h2>APPENDIX A Tables</h2><p>Some appendix text</p>", { ai_summary: "Appendix summary." }),
  row("sec-t-A-APPENDIX-A-1.0", "1.0", "sec-t-A-APPENDIX-A", "<p>An appendix sub-section whose id makes kindOf call it an appendix</p>"),
  // Stored after the appendix but a child of the root: the document-order
  // rule would hang it under APPENDIX A, so it needs data-parent.
  row("sec-t-P-B", "PART B", ROOT, "<p>A part stored after an appendix</p>"),
  row("sec-t-P-B-I", "I.", "sec-t-P-B", "<p>Under part B</p>"),
];

function row(
  id: string,
  citation: string,
  parent_id: string | null,
  full_text: string,
  extra: Partial<Provision> = {}
): Provision {
  return {
    id,
    citation,
    title: citation,
    jurisdiction_level: "state",
    issuing_body: "TEST",
    parent_id,
    full_text: sanitizeHtml(full_text),
    ai_summary: null,
    source_url: null,
    last_verified_date: null,
    is_public: false,
    sort_order: 0,
    summary_status: null,
    ...extra,
  };
}

test("synthetic regulation: browser-built furniture equals server-built", () => {
  // The synthetic rows exercise data-parent (PART B) and data-src (sec-t-A-I).
  const html = renderReaderBody(synthetic)!.docHtml;
  assert.match(html, /id="sec-t-P-B"[^>]* data-parent="sec-t-top-REG-t"/);
  assert.match(html, /id="sec-t-A-I"[^>]* data-src="https:\/\/example.gov\/other"/);
  assert.doesNotMatch(html, /id="sec-t-A-I-A"[^>]* data-parent=/);
  assert.doesNotMatch(html, /<ul class="contains">/);
  assert.doesNotMatch(html, /summary-status"><a/);
  const r = checkRegulation(synthetic);
  assert.equal(r.rows, synthetic.length);
  // root, PART A, sec-t-A-I (own URL), APPENDIX A; sec-t-A-II's summary is rejected.
  assert.equal(r.links, 4);
});

const fixtureDir = "scripts/fixtures";
const fixtures = existsSync(fixtureDir)
  ? readdirSync(fixtureDir).filter((f) => /^[A-Za-z0-9]+\.json$/.test(f) && f !== "tree.json")
  : [];

for (const file of fixtures) {
  test(`fixture ${file}: browser-built furniture equals server-built`, () => {
    const all = (JSON.parse(readFileSync(`${fixtureDir}/${file}`, "utf8")) as Provision[]).map((p) => ({
      ...p,
      full_text: sanitizeHtml(p.full_text),
    }));
    const r = checkRegulation(all);
    console.log(`  ${file}: ${r.rows} rows, ${r.boxes} contains boxes, ${r.links} source links`);
  });
}

test("fixtures present", { skip: fixtures.length === 0 ? "no scripts/fixtures/*.json (see reader-harness.ts)" : false }, () => {});
