import { matchPremiseNote, PREMISE_GP_NUMBERS } from "@/lib/premise-notes";
import { ECMC_REG_KEYS, FEDERAL_NESHAP_REG_KEYS, FEDERAL_NSPS_REG_KEYS, PHMSA_REG_KEYS } from "@/lib/question-maps";

/**
 * The document an Ask question names (9 Oct 2026).
 *
 * The outside reviewer's 8-9 Oct question "What test methods apply to a
 * Method 21 inspection under Subpart OOOO?" with the document filter on Any
 * was routed to the broad LDAR question map and never showed 40 CFR 60.5416(b);
 * with the OOOO filter selected the same question returned (b)(1)-(b)(6) at
 * once. A question map overrode a document the visitor had named. Now a
 * question that names exactly one document of the corpus is searched within
 * that document, the way the Regulation filter would, and the page says so
 * with a removable chip ("Searching within: ... x"; `?within=any` turns it
 * off). A map may still group the results but never widens them (groupHits).
 *
 * Detection is on the RAW question (never the acronym-expanded one, which
 * adds "natural gas fired" after GP02 and so on that the visitor did not
 * say) and only for names that identify one document. It is deliberately
 * narrow: "Part 60", "Part A", "Regulation" or "Rule" alone name nothing, and
 * "OOOO" never matches inside "OOOOa". Two or more different documents named
 * -> no constraint (the question compares them). Pure: no React, no
 * Supabase; the page, the API route, the eval and the tests share it.
 */

/**
 * The numbered Colorado regulations in the corpus. Not 1-31: Regulations 5,
 * 13, 14 and 17 are not imported, and a "Regulation 5" constraint would
 * return nothing. scripts/ask-scope.test.ts compares this list, and every
 * other key this file can return, with pipeline/out/corpus_ids.json.
 */
export const NAMEABLE_NUMBERED_REGS: readonly string[] = [
  "1", "2", "3", "4", "6", "7", "8", "9", "10", "11", "12", "15", "16", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31",
];

/** Every reg key a question can be constrained to. */
export const NAMEABLE_KEYS: ReadonlySet<string> = new Set([
  ...FEDERAL_NSPS_REG_KEYS,
  ...FEDERAL_NESHAP_REG_KEYS,
  ...ECMC_REG_KEYS,
  ...PHMSA_REG_KEYS,
  ...PREMISE_GP_NUMBERS.map((n) => `gp${n}`),
  ...NAMEABLE_NUMBERED_REGS,
]);

/** The reg keys a question names, in the order first named, without repeats; unknown numbers (GP04, Part 197, Regulation 5) name nothing. */
export function namedDocumentKeys(question: string): string[] {
  const found: { key: string; at: number }[] = [];
  const add = (key: string, at: number) => {
    if (NAMEABLE_KEYS.has(key) && !found.some((f) => f.key === key)) found.push({ key, at });
  };
  // Subpart OOOO / OOOOa / OOOOb / OOOOc and the other single-document subparts. The
  // optional suffix is followed by a word boundary, so OOOO never matches inside OOOOa
  // and "OOOOd" names nothing.
  for (const m of question.matchAll(/\b(oooo[abc]?|jjjj|iiii|zzzz)\b/gi)) add(m[1].toLowerCase(), m.index);
  // GP01..GP12 ("GP 1", "GP-12" too).
  for (const m of question.matchAll(/\bgp[-\s]?(\d{1,2})\b/gi)) add(`gp${m[1].padStart(2, "0")}`, m.index);
  // Regulation 7, Reg 7, Reg. 7, Regulation Number 7, Regulation No. 7. Not "Regulation" alone.
  for (const m of question.matchAll(/\b(?:regulation|reg)\b\.?\s*(?:(?:number|no)\b\.?\s*|#\s*)?(\d{1,2})\b/gi)) add(String(Number(m[1])), m.index);
  // Part 190-199, with or without "49 CFR"; never 40 CFR (Part 60 and Part 63 are not documents of their own).
  for (const m of question.matchAll(/(?<!\b40\s*C\.?F\.?R\.?\s*)\bpart\s+(19\d)\b/gi)) add(`p${m[1]}`, m.index);
  for (const m of question.matchAll(/\b49\s*C\.?F\.?R\.?\s*(?:part\s+)?(19\d)\b/gi)) add(`p${m[1]}`, m.index);
  // ECMC rules: "ECMC Rule 604", "ECMC 900-series", "2 CCR 404-1".
  for (const m of question.matchAll(/\becmc\b|\b404-1\b/gi)) add("ecmc", m.index);
  return found.sort((a, b) => a.at - b.at).map((f) => f.key);
}

/** The one document a question names, or null for none or several. */
export function namedDocument(question: string): string | null {
  const keys = namedDocumentKeys(question);
  return keys.length === 1 ? keys[0] : null;
}

export type AskScope = {
  /** The reg key to pass to the search as its document filter, or null. */
  regFilter: string | null;
  /** The document the question named and the search is limited to (the chip), or null. */
  within: string | null;
  /** The document the question named but the visitor turned the limit off for (?within=any), or null. */
  released: string | null;
};

/**
 * What the Ask search is limited to. The visitor's own Regulation filter
 * wins and shows no chip (the dropdown is the control). A matched premise
 * note is never limited: "When is GP01 required?" names one permit on
 * purpose and its premise map shows the Regulation 3 rows beside the
 * permit's own. Otherwise exactly one named document limits the search
 * unless `unconstrained` (?within=any, the chip's x) is set.
 */
export function askScope(question: string, opts: { reg?: string | null; unconstrained?: boolean } = {}): AskScope {
  if (opts.reg) return { regFilter: opts.reg, within: null, released: null };
  if (matchPremiseNote(question)) return { regFilter: null, within: null, released: null };
  const named = namedDocument(question);
  if (!named) return { regFilter: null, within: null, released: null };
  if (opts.unconstrained) return { regFilter: null, within: null, released: named };
  return { regFilter: named, within: named, released: null };
}
