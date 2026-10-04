import sanitizeHtmlLib from "sanitize-html";
import type { Provision } from "@/lib/types";
import {
  containsBoxFromRows,
  escapeHtml,
  normalizeCitationLabel,
  SNIPPET_LEN,
  snippetAfterCitation,
  summaryBadgeClass,
  SUMMARY_BADGE_TITLES,
  type SearchRow,
  type SummaryBadgeKind,
} from "@/lib/snippet";

// The text helpers the browser also needs (snippets, escaping, the contains
// box and summary-link templates) live in snippet.ts so RegulationReader can
// import them without dragging sanitize-html into the client bundle. They
// are re-exported here so server callers keep one import path.
export * from "@/lib/snippet";

// Likewise the regulation-name helpers (regulationDisplayName, regKeyOf,
// ...): the reader popup's eyebrow prints the display name in the browser.
import { GP_KEY, regKeyOf, regulationLabel } from "@/lib/regulation-names";
export * from "@/lib/regulation-names";

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
  // The importer's "[sic]" marker (span.er-sic, pipeline/curated_sic.json)
  // carries its explanation as a tooltip. Only spans get `title`: a title
  // on a link or image is not needed anywhere and stays stripped.
  span: ["title"],
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
  return sanitizeHtmlLib(html, sanitizeOptions());
}

// The importer links a citation of another regulation in the corpus as
// `<a class="xref-external-reg" href="/regulations/<reg>">` (see
// pipeline/import_ccr.py), i.e. straight at the gated reader.
// Since Sprint 2 the href may carry the cited provision as a hash
// ("/regulations/7#sec-7-B-I-B-33"); the hash is kept for a subscriber and
// dropped for the teaser, which has no such row to land on.
const EXTERNAL_REG_HREF = /^\/regulations\/([^/?#]+)(#[^\s"'<>]*)?$/;

/**
 * sanitizeHtml for a ProvisionCard (/sample, /regs/[id]). Those pages are
 * read logged out, and the reader an `xref-external-reg` link points at
 * 404s for anyone without access, so each such href is routed through
 * regulationCardHref: the reader for a subscriber, the public
 * /regulations/<reg>/preview teaser for everyone else. The reader itself
 * keeps using sanitizeHtml, since only entitled users ever see it.
 */
export function sanitizeCardHtml(html: string, hasAccess: boolean): string {
  const base = sanitizeOptions();
  return sanitizeHtmlLib(html, {
    ...base,
    transformTags: {
      ...base.transformTags,
      a: (tagName, attribs) => {
        const out: sanitizeHtmlLib.Attributes = { ...attribs, rel: "noopener noreferrer" };
        const m = /(^|\s)xref-external-reg(\s|$)/.test(attribs.class ?? "")
          ? EXTERNAL_REG_HREF.exec(attribs.href ?? "")
          : null;
        if (m) out.href = regulationCardHref(m[1], hasAccess) + (hasAccess ? (m[2] ?? "") : "");
        return { tagName, attribs: out };
      },
    },
  });
}

function sanitizeOptions(): sanitizeHtmlLib.IOptions {
  return {
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
  };
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
// Reg 22's root row prints the series in parentheses ("... (5 CCR 1001-26)"),
// so the optional parens are part of the suffix.
const CCR_TITLE_SUFFIX = /\s*\(?5 CCR 1001-\d+\)?\s*$/i;
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
// for new applicants. Never affects what's stored, only the card subtitle
// and, through isClosedPermit(), the "Closed to new registrations" badge on
// Ask, keyword and related-provision cards.
// Keep in sync with public.closed_permit_reg_keys() (migration 20260930003325).
const GP_CLOSURE_NOTE: Record<string, string> = {
  gp09: " · closed to new registrations July 15, 2026",
  gp10: " · closed to new registrations July 15, 2026",
};

/** The reg keys GP_CLOSURE_NOTE covers, lower-case, in key order. The one app-side list; the DB's is closed_permit_reg_keys(). */
export const CLOSED_PERMIT_REG_KEYS: readonly string[] = Object.keys(GP_CLOSURE_NOTE);

/**
 * Whether a regulation key ("gp09", "GP10") is a general permit CDPHE has
 * closed to new registrations. Built from GP_CLOSURE_NOTE, never a second
 * list. Null / unknown keys are not closed.
 */
export function isClosedPermit(regKey: string | null | undefined): boolean {
  if (!regKey) return false;
  return Object.prototype.hasOwnProperty.call(GP_CLOSURE_NOTE, regKey.toLowerCase());
}

/** The badge a result card shows for a closed permit; the tooltip is the one sentence the reader header also implies. */
export const CLOSED_PERMIT_BADGE = {
  label: "Closed to new registrations",
  title:
    "CDPHE closed this general permit to new registrations on July 15, 2026; existing registrations remain active. GP12 replaced GP09 and GP10 for new applicants.",
} as const;

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
    const label = `Regulation Number ${regNumber}`;
    // Most numbered roots store the bare printed title ("STATIONARY SOURCE
    // PERMITTING ... 5 CCR 1001-5"), but the two earliest imports do not:
    // Reg 22's title is "Regulation Number 22 — Colorado Greenhouse Gas ...
    // (5 CCR 1001-26)" and Reg 7's was the placeholder "Regulation 7" (see
    // pipeline/import_ccr.py REG_META). Prefixing the label onto those
    // printed it twice ("Regulation Number 22 — Regulation Number 22 — ...").
    // Strip a leading long or short label with the same digit-guarded rule
    // every provision heading uses, so the card says it exactly once
    // whichever shape a (re-)import stores.
    let rest = reg.title.replace(CCR_TITLE_SUFFIX, "").trim();
    rest = titleWithoutCitation(rest, label);
    rest = titleWithoutCitation(rest, `Regulation ${regNumber}`);
    return {
      title: rest ? `${label} — ${rest}` : label,
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
 * Groups the Colorado (/states/colorado) index by issuing_body. Within the AQCC
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

/**
 * Drops the Markdown emphasis a summary can carry from the model that wrote
 * it: `**bold**`, `__bold__` and `code` markers are removed and their text
 * kept (a fenced block keeps its body too). A stray, unpaired `**` or
 * backtick is removed as well -- neither means anything in plain English.
 * 251 stored summaries carried `**` on 2026-09-26 (backlog #16); this is the
 * one renderer every surface goes through (summaryParagraphs), so the
 * markers never reach a reader whether or not the rows are cleaned later.
 */
export function stripSummaryMarkdown(text: string): string {
  return text
    .replace(/```[^\n`]*\n?([\s\S]*?)```/g, "$1")
    .replace(/`([^`\n]*)`/g, "$1")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/__([^_]+?)__/g, "$1")
    .replace(/\*\*|`/g, "");
}

/**
 * Splits plain-text summary into paragraphs on blank lines (drops empties),
 * with the Markdown markers stripped (stripSummaryMarkdown). Every surface
 * that shows summary prose -- the reader panel and its popup clone, the
 * Ask cards, the related panels, /regs, /sample, the previews -- renders
 * through this, so it is the one place the text is cleaned.
 */
export function summaryParagraphs(summary: string): string[] {
  return stripSummaryMarkdown(summary)
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True for a row whose text is nothing but its own heading: a section, not
 * a provision. The same test search_provisions applies server-side to null
 * the keyword headline (migration 20260925013538): tags stripped, then the
 * text compared with the title and the citation after
 * normalizeCitationLabel's normalisation. Ask hits do not carry full_text,
 * so the search page reads it for the rows without a summary and asks here.
 */
export function isHeadingOnlyText(fullText: string, title: string | null, citation: string | null): boolean {
  const text = normalizeCitationLabel(fullText.replace(/<[^>]*>/g, ""));
  if (!text) return false;
  return text === normalizeCitationLabel(title) || text === normalizeCitationLabel(citation);
}

/**
 * The text badge every rendered summary carries, from the row's
 * summary_status and reviewed_at (owner decisions, Brody, 29 Sep and 4 Oct
 * 2026). Text with a date, not styling, so a reader can tell a checked
 * summary from one nobody has looked at yet:
 *
 *   approved / edited  -> "AI reviewed · Sept 17, 2026" (reviewed_at as
 *                         MMM d, yyyy; "AI reviewed" alone if the date is
 *                         null)
 *   pending (or unset) -> "AI-generated · not yet reviewed"
 *   rejected           -> null (the summary itself is withheld everywhere)
 *
 * "AI reviewed", never a bare "Reviewed": no summary on the site claims
 * human review (4 Oct 2026). The check behind the label is the automated
 * second pass that compares the summary with the official text; every
 * approved row has been through it (scripts/corpus_qa.sql check 21,
 * approved_without_ai_review, fails CI when one has not). It says nothing
 * about who reviewed: reviewed_by never reaches a public surface. `title`
 * is the tooltip; what "AI reviewed" means is defined on the Disclaimer
 * page (/disclaimer#what-reviewed-means). Pure, no React: the reader panel
 * (summaryPanelHtml) and every card (SummaryBadge.tsx) render the same
 * object.
 */
export function summaryStatusBadge(
  p: Pick<Provision, "summary_status" | "reviewed_at">
): { kind: SummaryBadgeKind; label: string; title: string } | null {
  const status = p.summary_status ?? "pending";
  if (status === "rejected") return null;
  if (status === "approved" || status === "edited") {
    const date = formatReviewedDate(p.reviewed_at);
    return {
      kind: "reviewed",
      label: date ? `AI reviewed · ${date}` : "AI reviewed",
      title: SUMMARY_BADGE_TITLES.reviewed,
    };
  }
  return { kind: "pending", label: "AI-generated · not yet reviewed", title: SUMMARY_BADGE_TITLES.pending };
}

/**
 * AP-style month abbreviations ("Sept", not "Sep"), the owner's wording for
 * the badge: "AI reviewed · Sept 17, 2026".
 */
const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/**
 * A reviewed_at timestamp as "Sept 17, 2026", in UTC so the reader body --
 * rendered once and cached for every subscriber -- never depends on the
 * server's zone. "" for null or anything that is not a date.
 */
export function formatReviewedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTH_ABBREVIATIONS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * The collapsible "Plain-English summary" panel rendered directly under a
 * provision's text in the reader. Returns "" when there's no summary yet
 * (the whole corpus starts out that way), so callers can concatenate it
 * unconditionally like containsBoxHtml. `ai_summary` is plain text, not
 * HTML, so it's escaped here; blank lines become paragraph breaks.
 */
export function summaryPanelHtml(
  p: Pick<Provision, "ai_summary" | "summary_status" | "reviewed_at" | "source_url">,
  fallbackSourceUrl?: string | null,
  children?: SummaryChild[]
): string {
  // A rejected summary is withheld from every reader entirely — it failed
  // human review, so showing it (even labeled "not yet reviewed") would be
  // actively misleading rather than just incomplete.
  if (p.summary_status === "rejected") return "";
  const paragraphs = summaryParagraphs(p.ai_summary ?? "");
  if (!paragraphs.length) return "";
  // A parent's summary (Sprint 3, Oct 2026): the Phase 0 regeneration wrote
  // parent summaries with every child in view, and they run to three
  // hundred words. In the reader a provision that has children and a
  // summary longer than two sentences shows the first two sentences as its
  // overview, the rest behind "Show full summary", and under that a list of
  // its direct children. Cards keep the whole first paragraph (they never
  // pass `children`). The badge stays above the overview, visible with the
  // panel collapsed either way.
  const overview = children && children.length ? summaryOverview(paragraphs) : null;
  const body = overview
    ? `<p class="summary-overview">${escapeHtml(overview.overview)}</p>` +
      `<details class="summary-more"><summary>Show full summary</summary>` +
      overview.rest.map((t) => `<p>${escapeHtml(t)}</p>`).join("") +
      `</details>` +
      summaryChildrenHtml(children ?? [])
    : paragraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join("");
  // The review-status badge is the first thing in the panel body: text
  // with a date ("AI reviewed · Sept 17, 2026" / "AI-generated · not yet
  // reviewed"), never a reviewer. History: the "AI-generated" line was
  // removed on 14 Sep 2026 [Brody] because it had become misleading once
  // review passes included an AI second pass alongside human review. On
  // 29 Sep 2026 [Brody] it came back as this two-state badge, because after
  // Phase 0 the reader could not tell a pending summary from a reviewed
  // one. On 4 Oct 2026 [Brody] "Reviewed" became "AI reviewed": no summary
  // claims a person checked it. What the label means lives on the
  // Disclaimer page (/disclaimer#what-reviewed-means), which the tooltip
  // points at. Only
  // the label and a state class are in the string -- the browser adds the
  // tooltip from SUMMARY_BADGE_TITLES (reader-client.ts, fillSummaryBadges),
  // for the same reason the source link below is filled in the browser.
  const badge = summaryStatusBadge(p);
  const badgeHtml = badge
    ? `<p class="summary-badge ${summaryBadgeClass(badge.kind)}">${escapeHtml(badge.label)}</p>`
    : "";
  // The source link itself is not in the string: with one URL per regulation
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
    `<div class="summary-body">${badgeHtml}${body}</div>` +
    sourceLinkHtml +
    `</details>`
  );
}

/** What the summary panel's child list needs to know about one direct child. */
export type SummaryChild = { id: string; citation: string; snippet: string };

/** At most this many children are listed under a parent's summary overview. */
export const SUMMARY_CHILDREN_MAX = 8;

/**
 * The list of a parent's direct children under its summary overview:
 * citation plus the child's first words, each a reader cross-reference
 * (the same `.xref` hook the contains boxes use, so a click previews the
 * child and "Go to full section" lands on it). "" for no children.
 */
export function summaryChildrenHtml(children: SummaryChild[]): string {
  if (!children.length) return "";
  const shown = children.slice(0, SUMMARY_CHILDREN_MAX);
  const items = shown
    .map((c) => {
      const snip = c.snippet ? ` <span class="summary-child-snip">${escapeHtml(c.snippet)}</span>` : "";
      return `<li><span class="xref summary-child-link" data-target="${escapeHtml(c.id)}">${escapeHtml(c.citation)}</span>${snip}</li>`;
    })
    .join("");
  const more =
    children.length > shown.length
      ? `<li class="summary-children-more">and ${children.length - shown.length} more below</li>`
      : "";
  return `<div class="summary-children-label">In this provision</div><ul class="summary-children">${items}${more}</ul>`;
}

/**
 * Abbreviations a period does not end a sentence after, when a capital
 * follows: "No.", "Sec.", "U.S.", "e.g.", a lowercase list letter ("a.")
 * and a one- or two-digit list number ("3."). A citation label ("II.A.7.",
 * "I.B.", "60.5395b.") and a year ("2021.") are NOT in the list: the
 * summaries are prose, and in 20 sampled GP parent summaries every label
 * followed by a space and a capitalised word ended its sentence ("...as
 * permitted under provision I.B. If the source...", "...Conditions III.A
 * and III.B. Specific monthly..."), while a label inside a sentence is
 * followed by a lowercase word, which the split never fires on anyway.
 */
const NOT_SENTENCE_END =
  /(?:^|[\s(])(?:No|Nos|Sec|Secs|Fig|Figs|vs|etc|approx|Dept|Inc|Co|Corp|Mr|Mrs|Ms|Dr|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Rev|Reg|Regs|Pt|Para|Paras|Art|Ch|St|U\.S|e\.g|i\.e|cf|al|[a-z]|\d{1,2})\.$/;

/**
 * Splits summary prose into sentences: at ". ", "! " or "? " (an optional
 * closing quote or bracket allowed) followed by a capital, a digit or an
 * opening quote or bracket, except after an abbreviation or a list marker
 * (NOT_SENTENCE_END). Pure; the reader and its tests share it.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?]["”’)\]]*\s+(?=["“(\[]?[A-Z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const candidate = text.slice(start, m.index + 1);
    if (m[0][0] === "." && NOT_SENTENCE_END.test(candidate)) continue;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * The first `n` sentences of a summary as its overview and the rest as
 * paragraphs (the original paragraph breaks kept), or null when the summary
 * has `n` sentences or fewer and needs no expander.
 */
export function summaryOverview(paragraphs: string[], n = 2): { overview: string; rest: string[] } | null {
  const sentences = paragraphs.map(splitSentences);
  const total = sentences.reduce((acc, s) => acc + s.length, 0);
  if (total <= n) return null;
  const head: string[] = [];
  const rest: string[] = [];
  for (const para of sentences) {
    const take = Math.max(0, Math.min(para.length, n - head.length));
    head.push(...para.slice(0, take));
    const left = para.slice(take);
    if (left.length) rest.push(left.join(" "));
  }
  return { overview: head.join(" "), rest };
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
