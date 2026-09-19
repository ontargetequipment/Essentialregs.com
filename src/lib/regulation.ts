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
  // "-ATTACHMENT-" is the GP02/GP12 general-permit importer's name for the
  // same structural role "-APPENDIX-" plays elsewhere in the corpus (a
  // top-level, appendix-like heading under the permit root) -- treated
  // identically here rather than as its own ProvisionKind.
  if (id.includes("-APPENDIX-") || id.includes("-ATTACHMENT-")) return "appendix";
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

/** Pulls "3" out of "sec-3-top-REG-3", "cp" out of "sec-cp-top-REG-cp", etc. */
export function regulationNumber(id: string): string | null {
  return id.match(/^sec-(.+)-top-REG-/)?.[1] ?? null;
}

/** Display-only heading/ordering info for a regulation index card. Never
 *  reads or writes stored data -- purely a presentation alias. */
export type RegulationCardInfo = {
  title: string;
  /** Secondary line under the title (the CCR/CFR cite), or null when the citation line above already covers it. */
  subtitle: string | null;
};

// The stored title carries the printed CCR series suffix ("... 5 CCR 1001-30")
// which the card repeats on its own subline -- stripped here so the title
// line doesn't say it twice.
const CCR_TITLE_SUFFIX = /\s*5 CCR 1001-\d+\s*$/i;
const CCR_CITE = /5 CCR 1001-\d+/i;

/**
 * Colorado AQCC regulations are stored under their bare printed title
 * ("COMMON PROVISIONS REGULATION 5 CCR 1001-2", "PRACTICE AND PROCEDURE
 * 2 CCR 404-1" for ECMC). The index card shows a friendlier alias instead --
 * "Regulation Number N — <title>", "Common Provisions Regulation", "ECMC
 * Rules (Practice and Procedure)" -- without changing what's actually
 * stored. See groupColoradoRegulations for the section heading these sit
 * under.
 */
/** Matches an APCD general-permit key ("gp01".."gp12") as used in provision ids. */
const GP_KEY = /^gp\d\d$/i;

// The stored GP title is CDPHE's full permit-application boilerplate
// ("GENERAL CONSTRUCTION PERMIT — Oil and Gas Industry — <subject> — GP02
// Issuance 4, July 23, 2025"). These are the known leading-boilerplate
// variants seen across gp01-gp12 (order matters -- the more specific "Oil
// and Gas Industry"/"Oil and Gas" variants have to be tried before the bare
// "GENERAL CONSTRUCTION PERMIT —" one, or they'd never match past it).
const GP_LEADING_BOILERPLATE = [
  /^GENERAL CONSTRUCTION PERMIT\s*[—-]\s*Oil and Gas Industry\s*[—-]\s*/i,
  /^GENERAL CONSTRUCTION PERMIT\s*[—-]\s*Oil and Gas\s*[—-]\s*/i,
  /^GENERAL CONSTRUCTION PERMIT\s*[—-]\s*/i,
  /^GENERAL PERMIT 12 \(GP12\)\s*[—-]\s*/i,
];

// Trailing "— GP02 Issuance 4, July 23, 2025" (GP12's is printed without the
// repeated "GP12" -- just "— Issuance 1, May 28, 2026"). Captures the
// issuance number and date for the subtitle.
const GP_TRAILING = /\s*[—-]\s*(?:GP\d{2}\s+)?Issuance\s+(\d+),\s+(.+)$/i;

// Display-only addendum for permits CDPHE has closed to new registrations
// (existing registrations stay active) -- see GP12, which replaces GP09/GP10
// for new applicants. Never affects what's stored, only the card subtitle.
const GP_CLOSURE_NOTE: Record<string, string> = {
  gp09: " · closed to new registrations July 15, 2026",
  gp10: " · closed to new registrations July 15, 2026",
};

export function regulationCardInfo(
  reg: Pick<Provision, "id" | "title" | "issuing_body" | "citation">
): RegulationCardInfo {
  const regNumber = regulationNumber(reg.id);
  if (reg.issuing_body === "ECMC") {
    return { title: "ECMC Rules (Practice and Procedure)", subtitle: "2 CCR 404-1" };
  }
  if (regNumber === "cp") {
    return { title: "Common Provisions Regulation", subtitle: null };
  }
  if (regNumber && GP_KEY.test(regNumber)) {
    const gpLabel = regNumber.toUpperCase();
    const trailingMatch = reg.title.match(GP_TRAILING);
    let subject = reg.title;
    if (trailingMatch) subject = subject.slice(0, trailingMatch.index);
    for (const re of GP_LEADING_BOILERPLATE) {
      const stripped = subject.replace(re, "");
      if (stripped !== subject) {
        subject = stripped;
        break;
      }
    }
    const subtitle = trailingMatch
      ? `Issuance ${trailingMatch[1]} · ${trailingMatch[2]}${GP_CLOSURE_NOTE[regNumber.toLowerCase()] ?? ""}`
      : null;
    return { title: `${gpLabel} — ${subject.trim()}`, subtitle };
  }
  if (regNumber && /^\d+$/.test(regNumber)) {
    const cite = reg.title.match(CCR_CITE)?.[0] ?? null;
    return {
      title: `Regulation Number ${regNumber} — ${reg.title.replace(CCR_TITLE_SUFFIX, "").trim()}`,
      subtitle: cite,
    };
  }
  // Federal (or anything else not covered above): the stored title is the
  // citation followed by the subpart's descriptive name ("40 CFR Part 60
  // Subpart JJJJ — Standards of Performance for..."), which repeats the
  // citation the card already prints on its own line above the title -- so
  // that leading "<citation> — " is stripped here the same way the CCR
  // suffix is stripped for AQCC regs, and the bare citation becomes the
  // subtitle instead of null.
  const citationPrefix = `${reg.citation} — `;
  const title = reg.title.startsWith(citationPrefix)
    ? reg.title.slice(citationPrefix.length)
    : reg.title;
  return { title, subtitle: reg.citation };
}

export type RegulationGroup<T> = {
  key: string;
  heading: string;
  regs: T[];
};

const AQCC_HEADING = "Air Quality Control Commission (5 CCR 1001)";
const GP_HEADING = "APCD General Permits";
const ECMC_HEADING = "Energy and Carbon Management Commission (2 CCR 404-1)";
const OTHER_HEADING = "Other";

/**
 * Groups the Colorado (/regulations) index by issuing_body. Within the AQCC
 * group, order is Common Provisions first, then numerically by regulation
 * number (1, 2, 3, 6, 7, 8, 9, 22, 24, 26, 30, ...) -- the printed CCR
 * series' own ordering, not id/insertion order (id order would put "22"
 * before "3" as strings).
 *
 * The eleven APCD general permits (gp01..gp12) share issuing_body
 * "CDPHE-APCD" with the numbered AQCC regulations but aren't AQCC
 * regulations at all -- they're separately issued general permits -- so
 * they're pulled into their own "APCD General Permits" group (ordered by
 * permit number) between AQCC and ECMC instead of landing in the AQCC list.
 */
export function groupColoradoRegulations<T extends Pick<Provision, "id" | "issuing_body">>(
  regs: T[]
): RegulationGroup<T>[] {
  const aqcc: T[] = [];
  const gp: T[] = [];
  const ecmc: T[] = [];
  const other: T[] = [];
  for (const r of regs) {
    const num = regulationNumber(r.id);
    if (r.issuing_body === "CDPHE-APCD" && num && GP_KEY.test(num)) gp.push(r);
    else if (r.issuing_body === "CDPHE-APCD") aqcc.push(r);
    else if (r.issuing_body === "ECMC") ecmc.push(r);
    else other.push(r);
  }
  aqcc.sort((a, b) => {
    const an = regulationNumber(a.id);
    const bn = regulationNumber(b.id);
    if (an === "cp") return bn === "cp" ? 0 : -1;
    if (bn === "cp") return 1;
    return (Number(an) || 0) - (Number(bn) || 0);
  });
  gp.sort((a, b) => {
    const an = Number((regulationNumber(a.id) ?? "").replace(/\D/g, ""));
    const bn = Number((regulationNumber(b.id) ?? "").replace(/\D/g, ""));
    return an - bn;
  });

  const groups: RegulationGroup<T>[] = [];
  if (aqcc.length) groups.push({ key: "aqcc", heading: AQCC_HEADING, regs: aqcc });
  if (gp.length) groups.push({ key: "gp", heading: GP_HEADING, regs: gp });
  if (ecmc.length) groups.push({ key: "ecmc", heading: ECMC_HEADING, regs: ecmc });
  if (other.length) groups.push({ key: "other", heading: OTHER_HEADING, regs: other });
  return groups;
}

// Friendly headings for the CFR parts currently in the corpus. A part number
// not listed here (a future addition) falls back to a generic "EPA — 40 CFR
// Part N" heading rather than disappearing into an unlabeled group.
const CFR_PART_HEADINGS: Record<string, string> = {
  "60": "EPA — 40 CFR Part 60 (New Source Performance Standards)",
  "63": "EPA — 40 CFR Part 63 (NESHAP)",
};

// PHMSA (49 CFR) rows share ONE heading regardless of which part they're
// from -- unlike the 40 CFR EPA groups (one heading per part), Parts 191,
// 192, 194, 195 and 199 are the same issuing body, the same subject
// (pipeline safety) and small enough in count that a per-part split would
// just be five near-empty sections. See groupFederalRegulations below.
// The test for membership is the citation shape (/^49 CFR Part \d+/), not a
// list of keys, so Batch B's three new parts needed no change here.
const PHMSA_GROUP_KEY = "49";
const PHMSA_HEADING = "PHMSA — 49 CFR Pipeline Safety";

/**
 * Groups the federal (/federal) index by CFR part, parsed out of each row's
 * citation ("40 CFR Part 60 Subpart JJJJ" -> part "60", "49 CFR Part 192" ->
 * PHMSA_GROUP_KEY). Was grouped by issuing_body alone back when every
 * federal row was a Part 60 NSPS subpart and "EPA" and "Part 60" were the
 * same group; Part 63 NESHAP subparts (zzzz) share issuing_body "EPA" but
 * belong in their own section, so the grouping key has to come from the
 * citation instead.
 *
 * 40 CFR parts each get their own group (one per part number, as before).
 * 49 CFR parts (PHMSA, p191/p192/p194/p195/p199) are different: every "49 CFR Part N" row,
 * whichever N, collapses into a single PHMSA_GROUP_KEY group under one
 * "PHMSA — 49 CFR Pipeline Safety" heading -- one shared section, not one
 * per part -- and that group sorts after every 40 CFR (EPA) group. Anything
 * whose citation doesn't parse as "40 CFR Part N" or "49 CFR Part N" falls
 * back to its raw issuing_body, same fallback as before.
 */
export function groupFederalRegulations<T extends Pick<Provision, "id" | "issuing_body" | "citation">>(
  regs: T[]
): RegulationGroup<T>[] {
  const byPart = new Map<string, T[]>();
  for (const r of regs) {
    const cfr40 = r.citation.match(/^40 CFR Part (\d+)/)?.[1];
    const isCfr49 = /^49 CFR Part \d+/.test(r.citation);
    const key = cfr40 ?? (isCfr49 ? PHMSA_GROUP_KEY : r.issuing_body ?? OTHER_HEADING);
    const arr = byPart.get(key);
    if (arr) arr.push(r);
    else byPart.set(key, [r]);
  }
  return Array.from(byPart.entries())
    .sort(([a], [b]) => {
      // The PHMSA group always sorts last, after every numbered 40 CFR
      // (EPA) part; everything else keeps the existing numeric-part order.
      if (a === PHMSA_GROUP_KEY) return b === PHMSA_GROUP_KEY ? 0 : 1;
      if (b === PHMSA_GROUP_KEY) return -1;
      return (Number(a) || 0) - (Number(b) || 0);
    })
    .map(([part, list]) => ({
      key: part,
      heading:
        part === PHMSA_GROUP_KEY
          ? PHMSA_HEADING
          : CFR_PART_HEADINGS[part] ?? (/^\d+$/.test(part) ? `EPA — 40 CFR Part ${part}` : part),
      regs: list,
    }));
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

/**
 * [id, citation, snippet, topGroupId] tuples for the client-side jump/search
 * box. The 4th element (added for the collapsible sidebar -- see
 * RegulationReader.tsx) is the id of this provision's top-level ancestor
 * (the Part/Appendix/series node whose sidebar entry is a <details> group),
 * so a hash-jump or popup "go to" can find and open the right group without
 * shipping a second lookup table alongside this one.
 */
export type SearchRow = [id: string, citation: string, snippet: string, topGroupId: string];

export function buildSearchIndex(all: Provision[]): SearchRow[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const groupCache = new Map<string, string>();

  // A provision's "top group" is itself once its parent is the regulation
  // root (parent.parent_id === null) -- i.e. it's a direct child of root,
  // same definition the reader's sidebar uses for "top-level node" -- or
  // its own group is whatever ancestor.
  function topGroupOf(p: Provision): string {
    const cached = groupCache.get(p.id);
    if (cached !== undefined) return cached;
    const parent = p.parent_id ? byId.get(p.parent_id) : undefined;
    const group = !parent || !parent.parent_id ? p.id : topGroupOf(parent);
    groupCache.set(p.id, group);
    return group;
  }

  return all.map((p) => [p.id, p.citation, stripHtml(p.full_text, 90), topGroupOf(p)]);
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


/**
 * Corpus convention: when a provision's printed heading sat on its own line
 * in the source document, the importer split it into its own leading <p>
 * (the row's `title` becomes the bare citation, e.g. "I.G.", and its
 * `full_text` starts with e.g. "<p>Definitions</p>"). Rendered as an
 * ordinary paragraph, that heading is visually indistinguishable from body
 * text ("I.G. Definitions" reads as one run-on sentence). This promotes
 * that first <p> to `<p class="item-heading">` when it looks like a heading
 * rather than the start of a sentence; otherwise it returns `html` unchanged.
 *
 * Heuristic (tuned against fixtures/*.json rows -- see scratch/promote_stats.mjs
 * for the promoted/not-promoted samples this was eyeballed against):
 *   - there must be at least one more <p> or <table> after it. A heading is
 *     never the *only* paragraph in a provision -- if it were, "promoting"
 *     it would hide the provision's entire content behind a bold label;
 *   - its tag-stripped text is <= 80 chars. Real headings in this corpus
 *     ("Definitions", "Scope", "ABSOLUTE VAPOR PRESSURE") are short; a long
 *     first paragraph is prose, not a heading;
 *   - it doesn't end in "." or ";" -- a heading doesn't end a sentence. A
 *     trailing ":" IS allowed: several headings are printed with the colon
 *     baked into the heading line itself ("Definitions:"), and a colon-
 *     terminated introductory clause long enough to read as a real sentence
 *     ("...shall mean the following:") already fails the length check above,
 *     so allowing trailing ":" doesn't pick up false positives in practice;
 *   - it doesn't start with a lowercase letter -- a heading is a title, not
 *     a sentence continuing from elsewhere.
 *
 * Idempotent: re-running it on already-promoted HTML is a no-op (checked via
 * the existing "item-heading" class) rather than double-applying the class.
 */
export function promoteHeadingParagraph(html: string): string {
  const match = html.match(/^\s*(<p\b[^>]*>)([\s\S]*?)<\/p>/i);
  if (!match) return html;
  const [whole, openTag, inner] = match;
  if (/\bclass\s*=\s*"[^"]*\bitem-heading\b/i.test(openTag)) return html;

  const rest = html.slice(whole.length);
  if (!/<(p|table)\b/i.test(rest)) return html;

  const text = inner
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > 80) return html;
  if (/[.;,]$/.test(text)) return html;
  if (/^[a-z]/.test(text)) return html;
  // "Definitions:" is a heading; "The following limits apply to each tank:"
  // is a lead-in sentence for the table that follows it. A trailing colon
  // only counts as a heading when the line is short enough to be a label.
  if (/:$/.test(text) && text.split(" ").length > 4) return html;

  const newOpenTag = /\bclass\s*=\s*"/i.test(openTag)
    ? openTag.replace(/\bclass\s*=\s*"([^"]*)"/i, 'class="$1 item-heading"')
    : openTag.replace(/^<p\b/i, '<p class="item-heading"');

  return newOpenTag + inner + "</p>" + rest;
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
  p: Pick<Provision, "ai_summary" | "summary_status" | "source_url">,
  fallbackSourceUrl?: string | null
): string {
  // A rejected summary is withheld from every reader entirely — it failed
  // human review, so showing it (even labeled "not yet reviewed") would be
  // actively misleading rather than just incomplete.
  if (p.summary_status === "rejected") return "";
  const paragraphs = summaryParagraphs(p.ai_summary ?? "");
  if (!paragraphs.length) return "";
  const body = paragraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join("");
  // No mention of who/what reviewed this or when, and no "AI-generated"
  // label -- [Brody, Sep 14 2026] that line risked misleading readers once
  // review passes started including an AI second-pass alongside human
  // review, and the Disclaimer page already covers that summaries are
  // AI-generated. A link to the source document lets a reader verify
  // directly instead.
  const sourceUrl = p.source_url ?? fallbackSourceUrl ?? null;
  const sourceLinkHtml = sourceUrl
    ? `<div class="summary-status"><a href="${escapeHtml(
        sourceUrl
      )}" target="_blank" rel="noopener noreferrer">View official source ↗</a></div>`
    : "";
  return (
    `<details class="summary-panel">` +
    `<summary>Plain-English summary</summary>` +
    `<div class="summary-body">${body}</div>` +
    sourceLinkHtml +
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
