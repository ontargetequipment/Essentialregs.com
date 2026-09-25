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
 *
 * The page body is renderReaderBody()'s two strings, so their size is the
 * ground truth; the per-component rows are the harness's own attribution
 * of those bytes (the wrappers row is what is left after the parts it can
 * name). The "built in the browser" rows are what RegulationReader now
 * generates client-side and the page no longer ships, measured with the
 * same server functions for reference.
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  buildSearchIndex,
  buildTree,
  containsBoxHtml,
  kindOf,
  promoteHeadingParagraph,
  sanitizeHtml,
  summaryPanelHtml,
  summarySourceLinkHtml,
  withItemIdBadge,
} from "../src/lib/regulation-pure";
import { renderDocHtml, renderNavHtml } from "../src/lib/reader-render";
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
const shipped = new Map<string, Component>();
const clientBuilt = new Map<string, Component>();
function add(into: Map<string, Component>, name: string, html: number, flight: number) {
  const c = into.get(name) ?? { html: 0, flight: 0 };
  c.html += html;
  c.flight += flight;
  into.set(name, c);
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

const tree = buildTree(all);
if (!tree.root) throw new Error("no root row in fixture");
const root = tree.root;

// ---- the page body, as shipped ----
const docHtml = timed("renderDocHtml", () => renderDocHtml(all, tree));
const navHtml = timed("renderNavHtml", () => renderNavHtml(all, tree));

// ---- attribution of the body bytes ----
const XREF_TAG = /<span class="xref"[^>]*>/g;
let xrefBytes = 0;
for (const p of all) {
  for (const m of p.full_text.match(XREF_TAG) ?? []) xrefBytes += bytes(m) + bytes("</span>");
  add(shipped, "sanitised full_text", bytes(p.full_text), flightBytes(p.full_text));

  if (kindOf(p.id) === "item") {
    const promoted = timed("promoteHeadingParagraph", () => promoteHeadingParagraph(p.full_text));
    const badged = timed("withItemIdBadge", () => withItemIdBadge(promoted, p.citation));
    add(shipped, "badges + heading promotion", bytes(badged) - bytes(p.full_text), flightBytes(badged) - flightBytes(p.full_text));
  }

  const summary = timed("summaryPanelHtml", () => summaryPanelHtml(p, root.source_url));
  add(shipped, "summary panels (text + panel markup)", bytes(summary), flightBytes(summary));
  if (summary.includes('<div class="summary-status"></div>')) {
    const link = summarySourceLinkHtml(p.source_url ?? root.source_url ?? "");
    add(clientBuilt, "summary source links", bytes(link), flightBytes(link));
  }

  const box = timed("containsBoxHtml (reference)", () => containsBoxHtml(tree.childrenOf.get(p.id) ?? []));
  add(clientBuilt, "contains boxes", bytes(box), flightBytes(box));
}
add(shipped, "  of which cross-reference markup (inside full_text)", xrefBytes, xrefBytes);

const named = Array.from(shipped.entries())
  .filter(([k]) => !k.startsWith("  of which"))
  .reduce((n, [, c]) => ({ html: n.html + c.html, flight: n.flight + c.flight }), { html: 0, flight: 0 });
add(shipped, "item wrappers (ids, classes, data-* attributes)", bytes(docHtml) - named.html, flightBytes(docHtml) - named.flight);
add(shipped, "sidebar nav", bytes(navHtml), flightBytes(navHtml));
// The root blurb, jump box, reader chrome, layout header, CSS link tags etc.
add(shipped, "shell (fixed, estimate)", 6_000, 6_000);

const searchIndex = timed("buildSearchIndex (reference)", () => buildSearchIndex(all));
add(clientBuilt, "search index (was flight only)", 0, bytes(JSON.stringify(JSON.stringify(searchIndex))));

// ---- totals ----
const total = { html: 0, flight: 0 };
for (const [name, c] of shipped) {
  if (name.startsWith("  of which")) continue;
  total.html += c.html;
  total.flight += c.flight;
}
const totalClient = { html: 0, flight: 0 };
for (const c of clientBuilt.values()) {
  totalClient.html += c.html;
  totalClient.flight += c.flight;
}

const toObj = (m: Map<string, Component>) =>
  Object.fromEntries(Array.from(m.entries()).map(([k, v]) => [k, { html: v.html, flight: v.flight, total: v.html + v.flight }]));

const result = {
  reg,
  items: all.length,
  raw_full_text_bytes: rawTextBytes,
  shipped: toObj(shipped),
  shipped_total: { ...total, total: total.html + total.flight },
  built_in_browser: toObj(clientBuilt),
  built_in_browser_total: { ...totalClient, total: totalClient.html + totalClient.flight },
  ms: Object.fromEntries(Array.from(ms.entries()).map(([k, v]) => [k, Math.round(v * 10) / 10])),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const kb = (n: number) => (n / 1024).toFixed(0).padStart(7) + " KB";
  const table = (title: string, m: Map<string, Component>, t: Component) => {
    console.log(title.padEnd(54) + "HTML".padStart(10) + "flight".padStart(10) + "shipped".padStart(10));
    for (const [name, c] of m) console.log(name.padEnd(54) + kb(c.html) + kb(c.flight) + kb(c.html + c.flight));
    console.log("TOTAL".padEnd(54) + kb(t.html) + kb(t.flight) + kb(t.html + t.flight) + "\n");
  };
  console.log(`\n${reg}: ${all.length} items, raw full_text ${kb(rawTextBytes)}\n`);
  table("bytes by component, shipped", shipped, total);
  table("built in the browser instead (not shipped)", clientBuilt, totalClient);
  console.log("ms by function");
  for (const [name, v] of ms) console.log("  " + name.padEnd(45) + v.toFixed(1).padStart(9) + " ms");
}
