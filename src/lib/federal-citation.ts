/**
 * The one formatter for a federal citation (Sprint 5, 10 Oct 2026). Pure and
 * dependency-free (it imports only the reg-key helpers), so the pages, the
 * client reader and the unit tests all share it.
 *
 * A federal citation prints as the subpart or part, a section sign, the
 * section, and the paragraph chain closed up against it:
 *
 *   OOOOa § 60.5365a(e)        40 CFR Part 60 Subpart OOOOa
 *   OOOO § 60.5416(b)(1)
 *   JJJJ § 60.4230             40 CFR Part 60 Subpart JJJJ
 *   ZZZZ § 63.6585             40 CFR Part 63 Subpart ZZZZ
 *   49 CFR § 192.605(b)        PHMSA, Parts 190-199 (reg keys p190..p199)
 *
 * Why it exists: a premise-note citation was derived from the provision id
 * ("sec-ooooa-60.5365a-(e)") by upper-casing the reg key and turning every
 * dash into a period, which printed "OOOOA 60.5365a.(e)" -- the subpart in
 * the wrong case, no section sign, and a period before the paragraph. A
 * reviewer read it as a typo (outside review, 9-10 Oct 2026). The stored
 * `citation` column already reads "§ 60.5365a(e)", so a card that prints it
 * beside the regulation's name only needs `displayCitation` (a guard that
 * closes up spacing and drops a stray period); a label that stands alone
 * (the cited ids in a map's introduction) uses `federalIdLabel`, which
 * leads with the subpart.
 *
 * Colorado citations ("II.A.4.", "I.D.3.a.(i).") are not touched by any of
 * this: each function returns null / the input unchanged for a reg key that
 * is not federal.
 */
import { isFederalKey } from "@/lib/regulation-names";

/** The subpart letters as the CFR prints them: the case is part of the name (OOOOa is not OOOOA). */
const SUBPART_CODES: Record<string, string> = {
  oooo: "OOOO",
  ooooa: "OOOOa",
  oooob: "OOOOb",
  ooooc: "OOOOc",
  jjjj: "JJJJ",
  iiii: "IIII",
  zzzz: "ZZZZ",
};

/**
 * What leads a federal citation: the subpart code for the 40 CFR documents
 * ("OOOOa"), "49 CFR" for a PHMSA part (a part has no subpart to name; its
 * section number carries the part). null for a key that is not federal.
 */
export function federalCitationPrefix(regKey: string | null | undefined): string | null {
  if (!isFederalKey(regKey)) return null;
  const key = regKey!.toLowerCase();
  return SUBPART_CODES[key] ?? (/^p\d{3}$/.test(key) ? "49 CFR" : null);
}

/** One section number: Part 60, 63 or 190-199, a dot, the section, an optional lettered suffix ("60.5365a"). */
const SECTION = String.raw`\d{2,3}\.\d+[a-z]?`;
const PARAGRAPH = String.raw`\(\s*[A-Za-z0-9]{1,4}\s*\)`;
/** "§ 60.5365a(e)" in any of the spellings that reach us: with or without the sign, a space or a period before the paragraph. */
const ONE_SECTION = new RegExp(String.raw`^\s*§?\s*(${SECTION})((?:[\s.\-]*${PARAGRAPH})*)[\s.]*$`);
/** "§§ 60.5433a-60.5439a", the reserved-range spelling. */
const SECTION_RANGE = new RegExp(String.raw`^\s*(?:§§?)?\s*(${SECTION})\s*[-–]\s*(${SECTION})[\s.]*$`);

/**
 * A federal section citation in its one spelling, "§ 60.5365a(e)", from any
 * of "§ 60.5365a(e)", "60.5365a.(e)", "§60.5416 (b)(1)", "60.5416-(b)-(1)"
 * (an id's tail) or a trailing period. A range stays a range
 * ("§§ 60.5433a-60.5439a"). null when the text is not a section citation
 * (a table, an appendix, a heading).
 */
export function normalizeFederalSection(text: string | null | undefined): string | null {
  if (!text) return null;
  const range = SECTION_RANGE.exec(text);
  if (range) return `§§ ${range[1]}-${range[2]}`;
  const m = ONE_SECTION.exec(text);
  if (!m) return null;
  const paragraphs = Array.from(m[2].matchAll(/\(\s*([A-Za-z0-9]{1,4})\s*\)/g), (p) => `(${p[1]})`).join("");
  return `§ ${m[1]}${paragraphs}`;
}

/**
 * A federal citation led by its subpart: "OOOOa § 60.5365a(e)",
 * "49 CFR § 192.605(b)". `text` is the stored citation or the tail of an id.
 * null when `regKey` is not federal or `text` is not a section citation.
 */
export function formatFederalCitation(regKey: string | null | undefined, text: string | null | undefined): string | null {
  const prefix = federalCitationPrefix(regKey);
  const section = normalizeFederalSection(text);
  return prefix && section ? `${prefix} ${section}` : null;
}

/**
 * The label of a federal provision from its id alone, for text that has no
 * row to read a citation from: "sec-ooooa-60.5365a-(e)" -> "OOOOa §
 * 60.5365a(e)". A table, an appendix and a document root get their own
 * wording ("OOOO Table 1", "ZZZZ Appendix A", "OOOOb (document)"); a PHMSA
 * definition row reads "49 CFR § 192.3 (excavator)". null for an id that is
 * not a federal document's.
 */
export function federalIdLabel(id: string): string | null {
  const m = /^sec-([^-]+)-(.+)$/.exec(id);
  if (!m) return null;
  const [, regKey, rest] = m;
  const prefix = federalCitationPrefix(regKey);
  if (!prefix) return null;
  if (rest.startsWith("top-REG-")) return `${prefix} (document)`;
  const whole = formatFederalCitation(regKey, rest);
  if (whole) return whole;
  const table = /^TABLE-(.+)$/i.exec(rest);
  if (table) return `${prefix} Table ${table[1]}`;
  const appendix = /^APPENDIX-(.+)$/i.exec(rest);
  if (appendix) return `${prefix} Appendix ${appendix[1]}`;
  // A definition row: "<section>-<term words>".
  const definition = new RegExp(`^(${SECTION})-([a-z][a-z0-9-]*)$`).exec(rest);
  if (definition) return `${prefix} § ${definition[1]} (${definition[2].replace(/-/g, " ")})`;
  return null;
}

/**
 * The citation a card prints beside its regulation's name: for a federal
 * document the stored "§ 60.5365a(e)" through `normalizeFederalSection`
 * (closing up "60.5365a. (e)" and the like); a Colorado citation, a heading
 * ("Table 1 to Subpart ...") or anything that is not a section is returned
 * as it is.
 */
export function displayCitation(regKey: string | null | undefined, citation: string): string {
  if (!isFederalKey(regKey)) return citation;
  return normalizeFederalSection(citation) ?? citation;
}
