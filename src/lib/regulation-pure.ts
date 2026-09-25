import sanitizeHtmlLib from "sanitize-html";
import type { Provision } from "@/lib/types";
import {
  containsBoxFromRows,
  escapeHtml,
  normalizeCitationLabel,
  SNIPPET_LEN,
  snippetAfterCitation,
  type SearchRow,
} from "@/lib/snippet";

// The text helpers the browser also needs (snippets, escaping, the contains
// box and summary-link templates) live in snippet.ts so RegulationReader can
// import them without dragging sanitize-html into the client bundle. They
// are re-exported here so server callers keep one import path.
export * from "@/lib/snippet";

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

/**
 * The part of a provision's `title` that is NOT already its citation, for
 * every surface that prints the citation right next to the title.
 *
 * Two corpus shapes made those headings say the label twice:
 *   (a) title IS the citation     -- "II.A.2."  / "II.A.2."
 *   (b) title OPENS with it       -- "I.G.90."  / "I.G.90. POTENTIAL TO EMIT"
 *
 * Returns "" when nothing but the label is left. Callers render the title
 * element only when the result is non-empty -- same contract as
 * snippetAfterCitation.
 *
 * The matching rule is deliberately identical to snippetAfterCitation and
 * textAlreadyOpensWithCitation, and is the one proven against all 36,517
 * rows: compare through normalizeCitationLabel, and only treat the text as
 * opening with the citation when the character right after it is NOT a
 * digit -- otherwise a citation of "I.D.3." swallows the prefix of a title
 * reading "I.D.30. ...". Do not invent a second rule here.
 */
export function titleWithoutCitation(
  title: string | null | undefined,
  citation: string | null | undefined
): string {
  const text = normalizeCitationLabel(title);
  const label = normalizeCitationLabel(citation);
  if (!text) return "";
  if (!label) return text;
  if (text === label) return "";
  if (!text.startsWith(label)) return text;
  if (/[0-9]/.test(text.charAt(label.length))) return text;
  return text.slice(label.length).replace(/^[\s.:;,—–-]+/, "").trim();
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
 * ("COMMON PROVISIONS REGULATION 5 CCR 1001-2", "PROCEDURAL RULES 5 CCR
 * 1001-1", "PRACTICE AND PROCEDURE 2 CCR 404-1" for ECMC). The index card
 * shows a friendlier alias instead -- "Regulation Number N — <title>",
 * "Common Provisions Regulation", "Procedural Rules", "ECMC Rules (Practice
 * and Procedure)" -- without changing what's actually stored. See
 * groupColoradoRegulations for the section heading these sit under.
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

// AQCC documents that carry NO regulation number and are keyed by name
// instead. Batch 6 added "aqs" (Air Quality Standards, Designations and
// Emission Budgets, 5 CCR 1001-14) and "sip" (the SIP Local Elements
// document, 5 CCR 1001-20); Batch 7 adds "proc" (the Commission's Procedural
// Rules, 5 CCR 1001-1). Their stored titles are the printed all-caps title
// plus the CCR suffix, like every numbered reg; the card shows this
// friendlier alias with the CCR cite (pulled from the stored title) as the
// subtitle.
//
// `rank` is the AQCC group's sort key directly (see groupColoradoRegulations
// / aqccRank), NOT a position within the named docs: "proc" sorts FIRST in
// the group, ahead of the Common Provisions Regulation (-1) and every
// numbered regulation, because it is the Commission's rules of procedure
// rather than a substantive regulation -- and because 5 CCR 1001-1 is
// literally the first document of the printed CCR series (Common Provisions
// is 1001-2). "aqs" and "sip" keep their Batch 6 position after every
// numbered regulation, aqs before sip. Display-only, like everything else in
// this file -- nothing stored changes.
const AQCC_NAMED_DOCS: Record<string, { title: string; rank: number }> = {
  proc: { title: "Procedural Rules", rank: -2 },
  aqs: { title: "Air Quality Standards, Designations and Emission Budgets", rank: 1_000_001 },
  sip: { title: "SIP — Local Elements for Nonattainment/Attainment-Maintenance Areas", rank: 1_000_002 },
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
  if (regNumber && AQCC_NAMED_DOCS[regNumber]) {
    const cite = reg.title.match(CCR_CITE)?.[0] ?? null;
    return { title: AQCC_NAMED_DOCS[regNumber].title, subtitle: cite };
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
  // citation the card already prints on its own line above the title.
  //
  // Same de-duplication as every provision heading (titleWithoutCitation):
  // normalized comparison plus the digit guard, instead of the old exact
  // "<citation> — " prefix match, which missed the space-separated shape and
  // missed title === citation entirely. The subtitle is dropped because
  // RegulationList already prints reg.citation on its own line above.
  const title = titleWithoutCitation(reg.title, reg.citation);
  return { title: title || reg.citation, subtitle: null };
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
 * number (1, 2, 3, 6, 7, 8, 9, 11, 12, 22, 24, 25, 26, 27, 30, ...) -- the
 * printed CCR series' own ordering, not id/insertion order (id order would
 * put "22" before "3" as strings). Batch 5's 11/12/25/27, Batch 6's
 * 16/18/19/20/21 and Batch 7's 4/10/15/23/28/29/31 all slot in by this same
 * numeric comparator with no per-reg list to maintain. The name-keyed AQCC
 * documents (see AQCC_NAMED_DOCS) have no number and take an explicit rank:
 * Batch 7's "proc" (the Procedural Rules, 5 CCR 1001-1) sorts FIRST, ahead
 * of Common Provisions and every numbered regulation; Batch 6's "aqs" and
 * "sip" sort AFTER every numbered regulation, aqs before sip.
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
  // Sort key: the Procedural Rules first (rank -2), then Common Provisions
  // (-1), then the numbered regs by number, then the remaining name-keyed
  // documents (aqs, sip) after every number. See AQCC_NAMED_DOCS.
  const aqccRank = (key: string | null): number => {
    if (key === "cp") return -1;
    if (key && AQCC_NAMED_DOCS[key]) return AQCC_NAMED_DOCS[key].rank;
    return Number(key) || 0;
  };
  aqcc.sort((a, b) => aqccRank(regulationNumber(a.id)) - aqccRank(regulationNumber(b.id)));
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
// from -- unlike the 40 CFR EPA groups (one heading per part), Parts 190
// through 196 and 199 are the same issuing body, the same subject
// (pipeline safety) and small enough in count that a per-part split would
// just be eight near-empty sections. See groupFederalRegulations below.
// The test for membership is the citation shape (/^49 CFR Part \d+/), not a
// list of keys, so neither Batch B's nor Batch C's new parts needed a change
// here. Within the group the parts keep the order fetchRegulationList()
// returns them in (root id ascending: sec-p190-... < sec-p191-... < ... <
// sec-p199-...), so Part 190 sorts first and 199 last without any per-part
// comparator.
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
 * 49 CFR parts (PHMSA, p190-p196/p199) are different: every "49 CFR Part N" row,
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

  return all.map((p) => [
    p.id,
    p.citation,
    snippetAfterCitation(p.full_text, p.citation, SNIPPET_LEN),
    topGroupOf(p),
  ]);
}

/**
 * True when a provision's own text already opens with its citation, so
 * re-inserting the badge would print the label twice.
 *
 * The digit guard is load-bearing, not redundant — do not "simplify" it away.
 * Measured against the live corpus on 2026-09-22: of the 5,941 rows that open
 * with their citation, 298 have citations of three characters or fewer ("1.",
 * "3.", "I.", "V.", "IX."). Without the guard a citation of "2." would match
 * text reading "2.5 tons per year" and strip a label that was needed. No row
 * in the corpus today is followed by a digit, so the guard changes nothing
 * now; it is here so a future import cannot introduce that silently.
 *
 * A following space is deliberately NOT required. 76 rows run the citation
 * straight into the body — "Additional SpecificationsThe useful life of…",
 * "Table 1 to Subpart IIII of Part 60—Emission Standards…", "Attachment A:
 * 2/14/2024" — and those are genuine duplicates too.
 */
function textAlreadyOpensWithCitation(html: string, label: string): boolean {
  label = normalizeCitationLabel(label);
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text.startsWith(label)) return false;
  return !/[0-9]/.test(text.charAt(label.length));
}

/**
 * Re-inserts the "I.B.4.a." style badge the importer stripped out of
 * full_text (it's stored separately as `citation` so the app can rebuild
 * navigation/search from structured data instead of scraping HTML). This
 * puts it back inside the opening <p> so it renders inline with the first
 * sentence, matching the original document's layout.
 *
 * The importer did not strip it from every row. 5,941 of 36,517 provisions
 * (16.3%) still carry the citation at the start of their own text — every
 * heading row and most short leaf items. Re-inserting the badge on those
 * printed the label twice, and because they cluster at the top of each
 * document the opening screen of a regulation read "PART A  PART A —
 * Applicability…", "I.  I. Applicability", "I.A.  I.A." Those rows are
 * skipped; the other 30,576 are unaffected.
 */
export function withItemIdBadge(html: string, citation: string): string {
  const label = citation.trim();
  if (label && textAlreadyOpensWithCitation(html, label)) {
    return html;
  }
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
  //
  // The link itself is no longer in the string: with one URL per regulation
  // it was the same 150 bytes under every one of thousands of panels (511 KB
  // of ECMC's HTML, shipped twice). The row is emitted empty and the browser
  // fills it from the regulation's source link (reader-client.ts,
  // fillSummaryLinks), using summarySourceLinkHtml for the identical markup.
  // A row whose own source_url differs from the root's gets a data-src on
  // its wrapper (reader-render.ts) so the browser still uses that one.
  const sourceUrl = p.source_url ?? fallbackSourceUrl ?? null;
  const sourceLinkHtml = sourceUrl ? `<div class="summary-status"></div>` : "";
  return (
    `<details class="summary-panel">` +
    `<summary>Plain-English summary</summary>` +
    `<div class="summary-body">${body}</div>` +
    sourceLinkHtml +
    `</details>`
  );
}

/**
 * The contains box for one provision's children, built on the server. The
 * page no longer ships this (RegulationReader builds the same markup in the
 * browser from the DOM through containsBoxFromRows); it stays here as the
 * reference the harness measures and scripts/reader-client.test.ts
 * compares the browser-built box against.
 */
export function containsBoxHtml(children: Provision[]): string {
  return containsBoxFromRows(
    children.map((c) => ({
      id: c.id,
      citation: c.citation,
      snippet: snippetAfterCitation(c.full_text, c.citation, SNIPPET_LEN),
    }))
  );
}

/**
 * The regulation-name prefix a /sample card carries in front of its own
 * citation ("Regulation Number 7 · I.D.3.a.(i)."): the root row's citation
 * with the "Code of Colorado Regulations · " series prefix dropped, since
 * every AQCC document shares it and the card has no room to say it four
 * times. Federal and permit roots have no such prefix and pass through.
 */
export function regulationLabel(rootCitation: string): string {
  return rootCitation.replace(/^Code of Colorado Regulations · /, "");
}

/** The "<reg>" of a provision id "sec-<reg>-...", or null for anything else. */
export function regKeyOf(id: string): string | null {
  return id.match(/^sec-([^-]+)-/)?.[1] ?? null;
}

/** The id of a regulation's root row, as stored: "sec-<reg>-top-REG-<reg>". */
export function rootIdOf(regKey: string): string {
  return `sec-${regKey}-top-REG-${regKey}`;
}

/**
 * The /sample cards: each public row relabelled with its regulation's name
 * (regulationLabel of the matching root's citation) in front of its own
 * citation, its title reduced to what it adds beyond that citation, and
 * the rows put in `order` (anything public but unlisted sorts after, by
 * id). Pure so scripts/marketing-index.test.ts can prove the labels are
 * the same whoever fetched `roots`.
 *
 * `roots` is expected to hold every regulation the rows belong to; a
 * missing root falls back to the upper-cased reg key ("GP02"), which is
 * exactly the wrong label an anonymous visitor used to see when the roots
 * were read through the RLS-bound client.
 */
export function sampleCards<T extends Pick<Provision, "id" | "citation" | "title">>(
  rows: T[],
  roots: Pick<Provision, "id" | "citation">[],
  order: string[]
): Array<Omit<T, "title"> & { title: string | null }> {
  const labelByKey = new Map<string, string>();
  for (const r of roots) {
    const key = r.id.match(/^sec-([^-]+)-top-REG-/)?.[1];
    if (key) labelByKey.set(key, regulationLabel(r.citation));
  }
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return rows
    .map((p) => {
      const key = regKeyOf(p.id);
      const label = key ? labelByKey.get(key) ?? key.toUpperCase() : null;
      // Corpus rows carry the bare label ("I.D.3.a.(i).") as the whole title
      // on some rows and as the OPENING of the title on others ("I.G.90.
      // POTENTIAL TO EMIT"). Strip it against the BARE citation here, before
      // the regulation label is prefixed on: once `citation` reads "Common
      // Provisions Regulation · I.G.90." the title no longer starts with it
      // and ProvisionCard's own call would match nothing.
      const heading = titleWithoutCitation(p.title, p.citation);
      return {
        ...p,
        citation: label ? `${label} · ${p.citation}` : p.citation,
        title: heading || null,
      };
    })
    .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

/**
 * Where a regulation index card opens. An entitled reader goes to the
 * gated reader at /regulations/<reg> (the federal subparts live at the
 * same reader URLs as the Colorado regulations, so stored cross-reference
 * hrefs keep working); anyone else goes to the public teaser at
 * /regulations/<reg>/preview -- the reader 404s for them by design, so a
 * card that linked there would look broken to the one audience an index
 * page is marketing to.
 */
export function regulationCardHref(reg: string, hasAccess: boolean): string {
  return hasAccess ? `/regulations/${reg}` : `/regulations/${reg}/preview`;
}
