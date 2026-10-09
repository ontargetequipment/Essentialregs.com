/**
 * The regulation-name helpers the browser also needs (the reader popup's
 * eyebrow and the return-trail label -- RegulationReader.tsx via
 * reader-nav.ts) live here, dependency-free, so importing them does not drag
 * sanitize-html into the client bundle. regulation-pure.ts re-exports every
 * one of them, so server callers and the tests keep their one import path.
 */
import type { Provision } from "@/lib/types";

/** Matches an APCD general-permit key ("gp01".."gp12") as used in provision ids. */
export const GP_KEY = /^gp\d\d$/i;

/**
 * Overrides for regulationDisplayName: the keys whose root row does not
 * yield the name a professional uses (ecmc: the root citation is the bare
 * "2 CCR 404-1"), plus the name-keyed AQCC documents, whose names cannot be
 * derived from the key alone when no root row is at hand (search hits).
 * For cp/proc/aqs the value equals the root citation minus its series
 * prefix -- they are here only for the no-root path.
 */
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  ecmc: "2 CCR 404-1 (ECMC Rules)",
  cp: "Common Provisions Regulation",
  proc: "AQCC Procedural Rules",
  aqs: "Air Quality Standards, Designations and Emission Budgets",
  sip: "SIP Local Elements",
};

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

/**
 * The name a professional would use for a regulation, from its reg key
 * ("7", "gp02", "oooob", "p190", "ecmc" -- the "<reg>" of "sec-<reg>-...").
 * A `reg_key` is an internal id and must never be shown to a user; every
 * surface that labels something with its regulation (the Ask filter, search
 * result eyebrows, the related panel, the reader popup's eyebrow) goes
 * through this.
 *
 * Sourced the way the /sample labels are (sampleCards / regulationLabel):
 * the root row's citation with the "Code of Colorado Regulations · " series
 * prefix dropped, which already reads "40 CFR Part 60 Subpart OOOOb",
 * "49 CFR Part 190", "APCD General Permit GP02", "AQCC Procedural Rules".
 * Two departures from the raw citation:
 *   - numbered AQCC regulations are "Regulation 7", not the citation's
 *     "Regulation Number 7" (and Reg 7/22's bare "Regulation 7"), so the
 *     numbered set reads one way and sorts numerically;
 *   - DISPLAY_NAME_OVERRIDES above.
 * Without a root row (an anonymous keyword search cannot read the roots),
 * the same names are derived from the key's shape, so the label never
 * regresses to the key. Display-only; nothing stored changes.
 */
export function regulationDisplayName(
  regKey: string,
  root?: Pick<Provision, "citation"> | null
): string {
  const key = regKey.toLowerCase();
  if (DISPLAY_NAME_OVERRIDES[key]) return DISPLAY_NAME_OVERRIDES[key];
  if (/^\d+$/.test(key)) return `Regulation ${key}`;
  if (root?.citation) return regulationLabel(root.citation);
  if (GP_KEY.test(key)) return `APCD General Permit ${key.toUpperCase()}`;
  const part = key.match(/^p(\d{3})$/);
  if (part) return `49 CFR Part ${part[1]}`;
  if (key === "zzzz") return "40 CFR Part 63 Subpart ZZZZ";
  const subpart = key.match(/^(oooo)([abc]?)$|^(iiii|jjjj)$/);
  if (subpart) {
    const code = subpart[3] ? subpart[3].toUpperCase() : `OOOO${subpart[2]}`;
    return `40 CFR Part 60 Subpart ${code}`;
  }
  return key.toUpperCase();
}

/** The "<reg>" of a provision id "sec-<reg>-...", or null for anything else. */
export function regKeyOf(id: string): string | null {
  return id.match(/^sec-([^-]+)-/)?.[1] ?? null;
}

/** The id of a regulation's root row, as stored: "sec-<reg>-top-REG-<reg>". */
export function rootIdOf(regKey: string): string {
  return `sec-${regKey}-top-REG-${regKey}`;
}

/** Federal reg keys: 40 CFR 60 Subparts OOOO, OOOOa/b/c, JJJJ, IIII, 40 CFR 63 Subpart ZZZZ and the 49 CFR PHMSA parts (p190..p199). */
const FEDERAL_KEY = /^(oooo[abc]?|jjjj|iiii|zzzz|p\d{3})$/;

/**
 * Human label for the reg badge on results and related panels. The
 * DOCUMENT decides: a row inside a Colorado regulation is Colorado whatever
 * its own jurisdiction_level says, and a row of a federal document is
 * Federal. History: until 4 Oct 2026 Regulation 26 carried a copy of 40 CFR
 * 60 Subpart JJJJ under Part C (sec-26-C-FEDJJJJ and 19 children, stored
 * with jurisdiction_level 'federal'); a reviewer saw one of those rows
 * labeled "Federal" beside "Regulation 26" and read it as a provenance
 * error. The copy is gone (owner decision, 4 Oct 2026: Regulation 26 links
 * to the corpus's own JJJJ document instead), and no row in production has
 * a federal jurisdiction_level inside a Colorado document any more, but the
 * rule stays document-first so a future import cannot reintroduce the
 * mislabel. The row-level jurisdiction only decides when the row has no
 * regulation.
 */
export function regBadge(regKey: string | null, jurisdiction: string): string {
  if (regKey) {
    if (FEDERAL_KEY.test(regKey)) return "Federal";
    if (regKey === "ecmc") return "ECMC";
    return "Colorado";
  }
  return jurisdiction === "federal" ? "Federal" : "Colorado";
}

/** True for a federal document's reg key (see FEDERAL_KEY); case-insensitive, false for null. */
export function isFederalKey(regKey: string | null | undefined): boolean {
  return !!regKey && FEDERAL_KEY.test(regKey.toLowerCase());
}

/**
 * The label above a provision's own text where a summary sits beside it
 * (the reader popup). A federal document is the eCFR's rendering, which is
 * not the official edition, so it is "Regulatory text"; a Colorado
 * document keeps "Official text" (trust copy pass, 9 Oct 2026).
 */
export function textLabelFor(regKey: string | null | undefined): string {
  return isFederalKey(regKey) ? "Regulatory text" : "Official text";
}

/** The source link's text: "Verify on eCFR" for a federal document, "View official source" for a Colorado one. */
export function sourceLinkTextFor(regKey: string | null | undefined): string {
  return isFederalKey(regKey) ? "Verify on eCFR" : "View official source";
}

/** "state" | "federal" from the reg key alone (for rows that don't carry jurisdiction_level). */
export function jurisdictionOfKey(regKey: string | null): "state" | "federal" {
  return regKey && FEDERAL_KEY.test(regKey) ? "federal" : "state";
}

/**
 * The example in the reader's jump-box placeholder (9 Oct 2026). A federal
 * reader shows a citation of its own kind ("60.5416(b)(1)", no section sign
 * needed since the jump box normalizes it); Colorado documents keep the
 * Part/Section example. Derived from the reg key alone.
 */
const FEDERAL_JUMP_EXAMPLE: Record<string, string> = {
  oooo: "60.5416(b)(1)",
  ooooa: "60.5416a(b)(1)",
  oooob: "60.5416b(b)(1)",
  ooooc: "60.5397c(a)",
  jjjj: "60.4243(b)",
  iiii: "60.4205(b)",
  zzzz: "63.6603(a)",
  p192: "192.605(b)",
  p195: "195.452(h)",
  // Part 193 numbers its sections from 193.2001; there is no 193.1.
  p193: "193.2007",
};

export function jumpboxPlaceholder(regKey: string): string {
  const k = regKey.toLowerCase();
  if (!FEDERAL_KEY.test(k)) return 'Jump to a section (e.g. II.A.4 or "fugitive emissions")';
  const ex = FEDERAL_JUMP_EXAMPLE[k] ?? (k.startsWith("p") ? `${k.slice(1)}.1` : "60.5416(b)(1)");
  return `Jump to a section (e.g. ${ex} or "fugitive emissions")`;
}
