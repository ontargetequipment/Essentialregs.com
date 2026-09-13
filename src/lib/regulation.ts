import sanitizeHtmlLib from "sanitize-html";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // "rel" is added by the transformTags.a transform below (noopener
  // noreferrer) -- it has to be allow-listed here too or the attribute
  // filter strips it right back out after the transform runs.
  a: ["href", "name", "target", "rel"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  img: ["src", "alt", "width", "height"],
};

// Inline styling actually used by the source document's layout (alignment,
// emphasis, table/column widths, indentation). Anything else -- position,
// display, filters, etc. -- is stripped, which is what keeps a bad row from
// e.g. `position:fixed`-ing a full-screen overlay over the page.
const ALLOWED_STYLES: NonNullable<sanitizeHtmlLib.IOptions["allowedStyles"]> = {
  "*": {
    "text-align": [/^(left|right|center|justify)$/],
    "font-weight": [/^(bold|normal|\d{3})$/],
    "font-style": [/^(italic|normal)$/],
    "margin-left": [/^\d+(px|em|pt|%)$/],
    "padding-left": [/^\d+(px|em|pt|%)$/],
    "text-indent": [/^\d+(px|em|pt|%)$/],
    width: [/^\d+(px|%)$/],
    "text-decoration": [/^(underline|none)$/],
  },
};

// Ids the reader shell itself renders (see RegulationReader.tsx / the JSX in
// regulations/[reg]/page.tsx) -- a provision whose id collided with one of
// these could hijack the popup/sidebar/search DOM via `getElementById`, so
// any of these coming out of stored HTML gets dropped rather than kept.
const RESERVED_IDS = new Set([
  "sidebar",
  "sidebar-header",
  "jump-wrap",
  "jumpbox",
  "jump-results",
  "main-scroll",
  "doc",
  "backdrop",
  "popup",
  "popup-head",
  "popup-head-text",
  "popup-eyebrow",
  "popup-title",
  "popup-close",
  "popup-body",
  "popup-footer",
  "popup-goto",
  "mobile-toggle",
  "sidebar-scrim",
]);

const VALID_ID = /^[A-Za-z0-9_.:-]+$/;

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
    allowedStyles: ALLOWED_STYLES,
    // Links still get http/https/mailto (this content is jurisdiction/legal
    // citations that legitimately point at http:// gov sites); images are
    // tightened to https/data since there's no legitimate reason for this
    // content to hotlink a plaintext http:// image.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "data"] },
    transformTags: {
      // Every link becomes noopener/noreferrer regardless of `target`, so a
      // citation link out of the reader can't get a `window.opener` handle
      // back on this page.
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer" }),
      "*": (tagName, attribs) => {
        const id = attribs.id;
        if (id !== undefined && (!VALID_ID.test(id) || RESERVED_IDS.has(id))) {
          const attribsWithoutId = { ...attribs };
          delete attribsWithoutId.id;
          return { tagName, attribs: attribsWithoutId };
        }
        return { tagName, attribs };
      },
    },
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
        "id, citation, title, jurisdiction_level, issuing_body, parent_id, full_text, ai_summary, summary_status, source_url, last_verified_date, is_public, sort_order"
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

/** Columns the public teaser is ever allowed to read. Never add full_text here. */
const TEASER_COLUMNS = "id, citation, title, ai_summary, summary_status, source_url";

/** Row shape returned by fetchRegulationTeaser — deliberately excludes full_text. */
export type TeaserProvision = Pick<
  Provision,
  "id" | "citation" | "title" | "ai_summary" | "summary_status" | "source_url"
>;

export type RegulationTeaser = {
  root: TeaserProvision | null;
  /** Top-level Part/Appendix headings only (see kindOf) -- no section bodies. */
  headings: TeaserProvision[];
  /** Up to TEASER_SUMMARY_LIMIT reviewed, non-empty summaries for the teaser. */
  summaries: TeaserProvision[];
};

/** Max plain-English summaries shown on a public /preview teaser page. */
export const TEASER_SUMMARY_LIMIT = 5;

/**
 * Public, anonymous-safe read path for the SEO teaser page
 * (/regulations/[reg]/preview). The real corpus is not `is_public` (see
 * supabase/schema.sql), so an anonymous visitor's RLS-bound client
 * (fetchRegulationProvisions above) returns nothing for it. This function
 * deliberately bypasses RLS with the service-role client to expose a small,
 * fixed slice of marketing-safe data:
 *
 *   - the regulation's own citation/title,
 *   - its top-level Part/Appendix headings (citation/title only), and
 *   - up to TEASER_SUMMARY_LIMIT already human-reviewed ai_summary rows.
 *
 * It NEVER selects `full_text` and is capped to a handful of rows. Do not
 * widen this into a general-purpose fetch or add columns beyond
 * TEASER_COLUMNS -- write a new, separately-scoped function instead.
 */
export async function fetchRegulationTeaser(
  regNumber: string
): Promise<RegulationTeaser> {
  const supabase = createAdminClient();
  const scopedToReg = () =>
    supabase.from("provisions").select(TEASER_COLUMNS).like("id", `sec-${regNumber}-%`);

  const [rootResult, headingsResult, summariesResult] = await Promise.all([
    // The regulation's own top-level row (id contains "-top-REG-").
    scopedToReg().like("id", "%-top-REG-%").limit(1),
    // Top-level Part/Appendix headings only -- every such row's parent_id is
    // the regulation root itself (verified against the live corpus), so no
    // section body ever matches this filter.
    scopedToReg()
      .or("id.like.%-PART-%,id.like.%-APPENDIX-%")
      .order("sort_order", { ascending: true }),
    // A capped teaser of already-reviewed, non-empty plain-English summaries.
    scopedToReg()
      .in("summary_status", ["approved", "edited"])
      .not("ai_summary", "is", null)
      .neq("ai_summary", "")
      .order("sort_order", { ascending: true })
      .limit(TEASER_SUMMARY_LIMIT),
  ]);

  if (rootResult.error) throw new Error(rootResult.error.message);
  if (headingsResult.error) throw new Error(headingsResult.error.message);
  if (summariesResult.error) throw new Error(summariesResult.error.message);

  return {
    root: (rootResult.data?.[0] as TeaserProvision) ?? null,
    headings: (headingsResult.data ?? []) as TeaserProvision[],
    summaries: (summariesResult.data ?? []) as TeaserProvision[],
  };
}

/**
 * Reg-number list for enumerating /regulations/[reg]/preview URLs in
 * src/app/sitemap.ts. NOTE: this deliberately does NOT reuse the ordinary
 * (RLS-bound) fetchRegulationList() above -- that function is subject to the
 * same anon-role RLS policy described on fetchRegulationTeaser (only
 * `is_public` rows are visible), and none of the real regulations are
 * `is_public`. Sitemap generation runs with no user session, so calling the
 * RLS-bound version here would silently enumerate zero regulations and the
 * teaser pages would never get linked/indexed. Bypasses RLS the same way,
 * with the same full_text-free column list.
 */
export async function fetchRegulationRootsForSitemap(): Promise<TeaserProvision[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("provisions")
    .select(TEASER_COLUMNS)
    .like("id", "sec-%-top-REG-%")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeaserProvision[];
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a Postgres `date` string ("2026-09-12") as "Sep 12, 2026". Parsed
 * by hand rather than via `new Date()` so a date-only value isn't shifted a
 * day by the server's timezone. Anything that doesn't look like a date is
 * returned untouched.
 */
export function formatReviewDate(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return isoDate;
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/**
 * Provenance line shown under every AI summary, so a reader always knows
 * whether a human has checked it against the official text yet.
 */
export function summaryStatusText(lastVerifiedDate: string | null): string {
  return lastVerifiedDate
    ? `AI-generated · reviewed ${formatReviewDate(lastVerifiedDate)}`
    : "AI-generated · not yet human-reviewed — verify against the official text";
}

/** Splits plain-text summary into paragraphs on blank lines (drops empties). */
export function summaryParagraphs(summary: string): string[] {
  return summary
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The collapsible "Plain-English summary" panel rendered directly under a
 * provision's text in the reader. Returns "" when there's no summary yet
 * (the whole corpus starts out that way), so callers can concatenate it
 * unconditionally like containsBoxHtml. `ai_summary` is plain text, not
 * HTML, so it's escaped here; blank lines become paragraph breaks.
 */
export function summaryPanelHtml(
  p: Pick<Provision, "ai_summary" | "last_verified_date" | "summary_status">
): string {
  // A rejected summary is withheld from every reader entirely — it failed
  // human review, so showing it (even labeled "not yet reviewed") would be
  // actively misleading rather than just incomplete.
  if (p.summary_status === "rejected") return "";
  const paragraphs = summaryParagraphs(p.ai_summary ?? "");
  if (!paragraphs.length) return "";
  const body = paragraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join("");
  return (
    `<details class="summary-panel">` +
    `<summary>Plain-English summary</summary>` +
    `<div class="summary-body">${body}</div>` +
    `<div class="summary-status">${escapeHtml(summaryStatusText(p.last_verified_date))}</div>` +
    `</details>`
  );
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
