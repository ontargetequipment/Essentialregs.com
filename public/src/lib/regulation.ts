import sanitizeHtmlLib from "sanitize-html";
import { createClient } from "@/lib/supabase/server";
import type { Provision } from "@/lib/types";

export type ProvisionKind = "reg" | "part" | "appendix" | "item";

// Tags/attributes beyond sanitize-html's own (already generous) defaults
// that show up in the imported regulation HTML -- tables, headings, and
// inline styling used to reproduce the source document's layout.
const ALLOWED_TAGS = sanitizeHtmlLib.defaults.allowedTags.concat([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "img",
  "font",
]);

const ALLOWED_ATTRIBUTES: sanitizeHtmlLib.IOptions["allowedAttributes"] = {
  ...sanitizeHtmlLib.defaults.allowedAttributes,
  "*": ["class", "id", "style", "data-target"],
  a: ["href", "name", "target"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  img: ["src", "alt", "width", "height"],
};

/**
 * Defense-in-depth for `full_text`: it's rendered with dangerouslySetInnerHTML
 * because it's real formatted regulatory HTML (paragraphs, tables, embedded
 * federal text), not plain strings. It's currently trusted content — it came
 * from Brody's own uploaded reference file, not arbitrary user input — but
 * sanitizing here means a bad row (a bad import, a future admin-entry path,
 * anything) can't inject a <script> tag or an event-handler attribute into
 * the page. `data-target` is explicitly allow-listed because the click-to-preview
 * cross-reference popups (see RegulationReader.tsx) read it directly off the
 * rendered DOM — stripping it would silently break every citation popup.
 *
 * Uses `sanitize-html` rather than DOMPurify/jsdom: jsdom's own dependency
 * chain (html-encoding-sniffer -> @exodus/bytes) ships a package that's
 * ESM-only, which Node's require() can't load in Vercel's serverless
 * runtime -- it crashed every request to a page that touched this module
 * with "ERR_REQUIRE_ESM", regardless of Next's bundling settings.
 * sanitize-html is pure CommonJS with no DOM emulation, so it doesn't hit
 * that problem at all.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
  });
}

/**
 * The reader HTML this app's content was imported from encodes structure in
 * the id itself (e.g. "sec-3-A-PART-A", "sec-3-A-APPENDIX-A",
 * "sec-3-top-REG-3"). There's no separate "kind" column in the schema, so we
 * derive it from the id the same way the importer did.
 */
export function kindOf(id: string): ProvisionKind {
  if (id.includes("-top-REG-")) return "reg";
  if (id.includes("-PART-")) return "part";
  if (id.includes("-APPENDIX-")) return "appendix";
  return "item";
}

/** Strip tags for use in search snippets / <title> text — not for display. */
export function stripHtml(html: string, maxLen = 100): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}

const PAGE_SIZE = 1000;

/**
 * Fetches every provision belonging to a regulation (id prefix "sec-{reg}-"),
 * paginating past PostgREST's default 1000-row cap. A regulation like
 * Colorado Reg 3 has 2,000+ rows, so a single .select() would silently
 * truncate without this.
 */
export async function fetchRegulationProvisions(
  regNumber: string
): Promise<Provision[]> {
  const supabase = await createClient();
  const all: Provision[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("provisions")
      .select(
        "id, citation, title, jurisdiction_level, issuing_body, parent_id, full_text, ai_summary, source_url, last_verified_date, is_public, sort_order"
      )
      .like("id", `sec-${regNumber}-%`)
      .order("sort_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(
      ...(data as Provision[]).map((p) => ({
        ...p,
        full_text: sanitizeHtml(p.full_text),
      }))
    );
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/** Every top-level regulation currently in the corpus (for the /regulations index). */
export async function fetchRegulationList(): Promise<Provision[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provisions")
    .select("id, citation, title, jurisdiction_level, issuing_body")
    .like("id", "sec-%-top-REG-%")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Provision[];
}

export type RegTree = {
  all: Provision[];
  byId: Map<string, Provision>;
  childrenOf: Map<string, Provision[]>;
  root: Provision | null;
};

export function buildTree(all: Provision[]): RegTree {
  const byId = new Map(all.map((p) => [p.id, p]));
  const childrenOf = new Map<string, Provision[]>();
  for (const p of all) {
    if (!p.parent_id) continue;
    const arr = childrenOf.get(p.parent_id);
    if (arr) arr.push(p);
    else childrenOf.set(p.parent_id, [p]);
  }
  const root = all.find((p) => kindOf(p.id) === "reg") ?? null;
  return { all, byId, childrenOf, root };
}

/**
 * Nesting depth relative to the nearest Part/Appendix/Regulation ancestor —
 * mirrors the "item depth-N" classes in the original reader, which drive
 * indentation (I. -> depth 1, I.A. -> depth 2, I.B.1.a. -> depth 4, etc).
 */
export function depthOf(
  id: string,
  byId: Map<string, Provision>,
  cache: Map<string, number>
): number {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  const p = byId.get(id);
  if (!p || !p.parent_id) {
    cache.set(id, 0);
    return 0;
  }

  const parentKind = kindOf(p.parent_id);
  const depth =
    parentKind === "part" || parentKind === "appendix" || parentKind === "reg"
      ? 1
      : depthOf(p.parent_id, byId, cache) + 1;

  cache.set(id, depth);
  return depth;
}

/** [id, citation, snippet] tuples for the client-side jump/search box. */
export type SearchRow = [string, string, string];

export function buildSearchIndex(all: Provision[]): SearchRow[] {
  return all.map((p) => [p.id, p.citation, stripHtml(p.full_text, 90)]);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Re-inserts the "I.B.4.a." style badge the importer stripped out of
 * full_text (it's stored separately as `citation` so the app can rebuild
 * navigation/search from structured data instead of scraping HTML). This
 * puts it back inside the opening <p> so it renders inline with the first
 * sentence, matching the original document's layout.
 */
export function withItemIdBadge(html: string, citation: string): string {
  const badge = `<span class="item-id">${escapeHtml(citation)}</span> `;
  const match = html.match(/^\s*<p[^>]*>/);
  if (match) {
    return html.slice(0, match[0].length) + badge + html.slice(match[0].length);
  }
  return badge + html;
}

/** The mini "here's what's inside this section" box shown under items/parts that have children. */
export function containsBoxHtml(children: Provision[]): string {
  if (!children.length) return "";
  const items = children
    .map(
      (c) =>
        `<li><span class="xref contains-link" data-target="${escapeHtml(
          c.id
        )}">${escapeHtml(c.citation)}</span> <span class="contains-snip">${escapeHtml(
          stripHtml(c.full_text, 90)
        )}</span></li>`
    )
    .join("");
  return `<ul class="contains">${items}</ul>`;
}
