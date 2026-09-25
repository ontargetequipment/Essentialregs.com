/**
 * Measures what /regulations/[reg] ships and where the render time goes,
 * using real rows and the reader's actual pure functions -- no database,
 * no Next.
 *
 *   npx tsx scripts/reader-harness.ts ecmc
 *   npx tsx scripts/reader-harness.ts 7 --json
 *
 * Fixture: scripts/fixtures/<reg>.json -- a JSON array of `provisions` rows
 * for one reg_key, ordered by sort_order, with the columns
 * fetchRegulationProvisions selects (id, citation, title, jurisdiction_level,
 * issuing_body, parent_id, full_text, ai_summary, summary_status,
 * source_url, last_verified_date, is_public, sort_order). Pull it with the
 * Supabase connector / psql in chunks and concatenate; it is git-ignored
 * because it is the paid corpus.
 *
 * Two numbers matter for "bytes shipped". Every string the page hands to
 * dangerouslySetInnerHTML is sent TWICE by the app router: once as the
 * server-rendered HTML the browser paints, and once again inside the RSC
 * flight payload (`self.__next_f.push([1,"..."])` script tags) that React
 * uses to hydrate -- there it is JSON-encoded, then JSON-encoded again as
 * the script's string argument. The harness reports both columns so the
 * ratio to the real response size is honest.
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  buildSearchIndex,
  buildTree,
  containsBoxHtml,
  depthOf,
  escapeHtml,
  kindOf,
  promoteHeadingParagraph,
  sanitizeHtml,
  summaryPanelHtml,
  withItemIdBadge,
} from "../src/lib/regulation-pure";
import { renderNavHtml, renderReaderBody } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

const reg = process.argv[2];
const asJson = process.argv.includes("--json");
if (!reg) {
  console.error("usage: npx tsx scripts/reader-harness.ts <reg> [--json]");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(`scripts/fixtures/${reg}.json`, "utf8")) as Provision[];

const bytes = (s: string) => Buffer.byteLength(s, "utf8");
/** Size of `s` inside the flight payload: JSON row, JSON-encoded again as the push() argument. */
const flightBytes = (s: string) => bytes(JSON.stringify(JSON.stringify(s))) - 4;

type Component = { html: number; flight: number };
const comps = new Map<string, Component>();
function add(name: string, html: string | number, flight?: number) {
  const c = comps.get(name) ?? { html: 0, flight: 0 };
  if (typeof html === "string") {
    c.html += bytes(html);
    c.flight += flight ?? flightBytes(html);
  } else {
    c.html += html;
    c.flight += flight ?? 0;
  }
  comps.set(name, c);
}

const ms = new Map<string, number>();
function timed<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  const out = fn();
  ms.set(name, (ms.get(name) ?? 0) + (performance.now() - t0));
  return out;
}

// ---- fetch stage: sanitizeHtml runs inside fetchRegulationProvisions ----
const rawTextBytes = raw.reduce((n, p) => n + bytes(p.full_text), 0);
const all: Provision[] = timed("sanitizeHtml", () =>
  raw.map((p) => ({ ...p, full_text: sanitizeHtml(p.full_text) }))
);

const { childrenOf, root, byId } = buildTree(all);
if (!root) throw new Error("no root row in fixture");
const depthCache = new Map<string, number>();

// ---- per-item furniture, exactly as page.tsx concatenates it ----
const XREF_TAG = /<span class="xref"[^>]*>/g;
let xrefBytes = 0;
for (const p of all) {
  const kind = kindOf(p.id);
  const children = childrenOf.get(p.id) ?? [];
  for (const m of p.full_text.match(XREF_TAG) ?? []) xrefBytes += bytes(m) + bytes("</span>");

  let text = p.full_text;
  if (kind === "item") {
    const promoted = timed("promoteHeadingParagraph", () => promoteHeadingParagraph(text));
    const badged = timed("withItemIdBadge", () => withItemIdBadge(promoted, p.citation));
    add("badges + heading promotion", bytes(badged) - bytes(text), flightBytes(badged) - flightBytes(text));
    text = badged;
  }
  add("sanitised full_text", p.full_text);

  const summary = timed("summaryPanelHtml", () => summaryPanelHtml(p, root.source_url));
  add("summary panels", summary);

  const box = timed("containsBoxHtml", () => containsBoxHtml(children));
  add("contains boxes", box);

  // The React wrapper element: <div id class data-citation> / <section id class>.
  let wrapper: string;
  if (kind === "reg") {
    const src = p.source_url
      ? `<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener noreferrer" class="reg-source-link">View official source ↗</a>`
      : "";
    wrapper = `<section id="${p.id}" class="reg-block"></section><div class="reg-eyebrow">${escapeHtml(p.citation)}</div>${src}`;
  } else if (kind === "part") {
    wrapper = `<section id="${p.id}" class="part-block"></section><div class="part-tag">${escapeHtml(p.citation)}</div>`;
  } else if (kind === "appendix") {
    wrapper = `<section id="${p.id}" class="appendix-block"></section>`;
  } else {
    const depth = depthOf(p.id, byId, depthCache);
    wrapper = `<div id="${p.id}" class="item depth-${depth}" data-citation="${escapeHtml(p.citation)}"></div>`;
  }
  // The wrapper's attributes ride the flight payload as JSON props, roughly the same size again.
  add("item wrappers", wrapper, bytes(wrapper));
}
add("  of which cross-reference markup (inside full_text)", xrefBytes, xrefBytes);

// ---- jump box search index: a prop of the <RegulationReader> client component,
// so it rides the flight payload only (JSON, then JSON-encoded again). ----
const searchIndex = timed("buildSearchIndex", () => buildSearchIndex(all));
add("search index (flight only)", 0, bytes(JSON.stringify(JSON.stringify(searchIndex))));

// ---- sidebar nav: server-rendered JSX, hence HTML + flight ----
const nav = timed("sidebar nav (renderNavHtml)", () => renderNavHtml(all));
add("sidebar nav", nav);
// The root blurb, jump box, reader chrome, layout header, CSS link tags etc.
add("shell (fixed, estimate)", 6_000, 6_000);

// ---- totals ----
const total = { html: 0, flight: 0 };
for (const [name, c] of comps) {
  if (name.startsWith("  of which")) continue;
  total.html += c.html;
  total.flight += c.flight;
}

const wholeBody = timed("renderReaderBody (whole page, one call)", () => renderReaderBody(all));
if (!wholeBody) throw new Error("renderReaderBody returned null");

const result = {
  reg,
  items: all.length,
  raw_full_text_bytes: rawTextBytes,
  components: Object.fromEntries(
    Array.from(comps.entries()).map(([k, v]) => [k, { html: v.html, flight: v.flight, total: v.html + v.flight }])
  ),
  total: { ...total, total: total.html + total.flight },
  render_module_total_html: bytes(wholeBody.navHtml) + bytes(wholeBody.docHtml),
  ms: Object.fromEntries(Array.from(ms.entries()).map(([k, v]) => [k, Math.round(v * 10) / 10])),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const kb = (n: number) => (n / 1024).toFixed(0).padStart(7) + " KB";
  console.log(`\n${reg}: ${all.length} items, raw full_text ${kb(rawTextBytes)}\n`);
  console.log("bytes by component".padEnd(52) + "HTML".padStart(10) + "flight".padStart(10) + "shipped".padStart(10));
  for (const [name, c] of comps) {
    console.log(name.padEnd(52) + kb(c.html) + kb(c.flight) + kb(c.html + c.flight));
  }
  console.log("TOTAL".padEnd(52) + kb(total.html) + kb(total.flight) + kb(total.html + total.flight));
  console.log(`\n(renderReaderBody, one call, HTML only: ${kb(result.render_module_total_html)})\n`);
  console.log("ms by function");
  for (const [name, v] of ms) console.log("  " + name.padEnd(45) + v.toFixed(1).padStart(9) + " ms");
}
