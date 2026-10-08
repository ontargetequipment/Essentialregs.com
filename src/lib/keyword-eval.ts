/**
 * The keyword-search acceptance rows (the outside reviewer's table, 6 Oct
 * 2026) and the pure evaluator behind scripts/keyword-eval.ts, which runs
 * them against production's search_provisions() on every pull request (the
 * "Keyword eval" workflow), the way scripts/ask-eval.ts gates Ask. Keyword
 * search was scored 9 by the reviewer, so the rows that pass today are the
 * floor: a change that moves one of them fails the gate.
 *
 * A row names a query and the conditions on its top rows, as a subscriber
 * sees them (Statements of Basis hidden, the page default). Prefix matching
 * as in src/lib/semantic-eval.ts: a hit passes a condition when its id
 * starts with one of the prefixes.
 */
export type KeywordRow = {
  q: string;
  /** The reviewer's pass condition, in words. */
  condition: string;
  /** The first hit's id must start with one of these. */
  first?: string[];
  /** Each group: at least one hit in the top `topN` (default 5) starts with one of its prefixes. */
  any?: string[][];
  /** No hit in the top `topN` starts with one of these. */
  none?: string[];
  /**
   * For each subpart listed, the first of its rows to appear (within
   * `scanN`, default 25) must be an applicability row, not a definitions
   * row: the reviewer's "JJJJ, IIII or ZZZZ applicability above their
   * definitions". A subpart with no row in the window passes.
   */
  applicabilityBeforeDefinitions?: string[];
  topN?: number;
  scanN?: number;
};

export type KeywordHit = {
  id: string;
  title?: string | null;
  path?: string | null;
};

export const DEFAULT_TOP_N = 5;
export const DEFAULT_SCAN_N = 25;

/**
 * The seven rows of the acceptance table ("EssentialRegs: Path to 9/10",
 * keyword search), plus (8 Oct 2026, the original Subpart OOOO import) the
 * "OOOO" row: the shorter code must find its own document first and never
 * OOOOa/b/c, and "OOOOb" must still find OOOOb first.
 */
export const KEYWORD_ROWS: KeywordRow[] = [
  {
    q: "storage tank requirements",
    condition: "Regulation 7 Part B storage-tank controls first",
    first: ["sec-7-B-II-C", "sec-7-B-I-D"],
  },
  {
    q: "fugitive emissions",
    condition: "a Regulation 7 LDAR provision and an OOOOb fugitive provision in the top 5",
    any: [["sec-7-B-II-E", "sec-7-B-I-L"], ["sec-oooob-60.5397b", "sec-oooob-60.5398b", "sec-oooob-60.5399b"]],
  },
  {
    q: "produced water tank",
    condition: "GP08 applicability first",
    first: ["sec-gp08-I-"],
  },
  {
    q: "APEN requirements",
    condition: "Regulation 3 Part A Section II first",
    first: ["sec-3-A-II"],
  },
  {
    q: "well production facility",
    condition: "Regulation 7 operative provisions first",
    first: ["sec-7-A-", "sec-7-B-"],
  },
  {
    q: "OOOOb",
    condition: "the subpart document first, its tables below; never the original OOOO",
    first: ["sec-oooob-top-REG-oooob"],
    none: ["sec-oooob-TABLE-", "sec-oooo-"],
    topN: 1,
  },
  {
    q: "OOOO",
    condition: "the original subpart's document first; never OOOOa, OOOOb, OOOOc or its tables",
    first: ["sec-oooo-top-REG-oooo"],
    none: ["sec-oooo-TABLE-", "sec-ooooa-", "sec-oooob-", "sec-ooooc-"],
    topN: 1,
  },
  {
    q: "reciprocating internal combustion engine",
    condition: "GP12 and Regulation 26 in the top 5; JJJJ, IIII or ZZZZ applicability above their definitions",
    any: [["sec-gp12-"], ["sec-26-"]],
    applicabilityBeforeDefinitions: ["jjjj", "iiii", "zzzz"],
  },
];

/**
 * Rows that fail today and are allowed to, each with the reason, so the gate
 * holds the line at the current score without pretending they pass (the
 * same device as KNOWN_FAILURES in src/lib/semantic-eval.ts).
 *
 * "fugitive emissions": Regulation 7's leak detection and repair rules say
 * "leak detection and repair" and "component", so on these two words their
 * best row scores 0.075 against a top-5 cut near 0.18; no ranking multiplier
 * closes that, and the two changes that would (a synonym rule for the
 * query, or demoting GP12's "Fugitive component leak emissions" headings)
 * break corpus QA check 17, the oil-and-gas tie-break the previous review
 * asked for. The OOOOb half moved from eleventh to seventh with the closed
 * permits demoted (migration 20261007020000). Recorded 7 Oct 2026.
 */
export const KEYWORD_KNOWN_FAILURES: Record<string, string> = {
  "fugitive emissions":
    "Regulation 7 LDAR scores 0.075 at best on these words; lifting it would break corpus QA check 17 (see src/lib/keyword-eval.ts)",
};

const APPLICABILITY = /\b(applicability|am i subject|who must comply|applies to)\b/i;
const DEFINITIONS = /\bdefinitions?\b|what definitions apply/i;

/** How many rows a row needs fetched. */
export function keywordRowsNeeded(row: KeywordRow): number {
  const top = row.topN ?? DEFAULT_TOP_N;
  return row.applicabilityBeforeDefinitions ? Math.max(top, row.scanN ?? DEFAULT_SCAN_N) : top;
}

export type KeywordResult = { pass: boolean; failures: string[] };

/** Scores one row's hits (in rank order). Pure. */
export function evaluateKeywordRow(row: KeywordRow, hits: KeywordHit[]): KeywordResult {
  const top = row.topN ?? DEFAULT_TOP_N;
  const window = hits.slice(0, top);
  const startsWith = (h: KeywordHit, prefixes: string[]) => prefixes.some((p) => h.id.startsWith(p));
  const failures: string[] = [];

  if (row.first) {
    const h = hits[0];
    if (!h) failures.push("no results");
    else if (!startsWith(h, row.first)) failures.push(`first hit is ${h.id}; expected one of ${row.first.join(", ")}`);
  }
  for (const group of row.any ?? []) {
    if (!window.some((h) => startsWith(h, group))) failures.push(`none of ${group.join(", ")} in the top ${top}`);
  }
  if (row.none) {
    const bad = window.filter((h) => startsWith(h, row.none ?? []));
    if (bad.length) failures.push(`forbidden in the top ${top}: ${bad.map((h) => h.id).join(", ")}`);
  }
  for (const key of row.applicabilityBeforeDefinitions ?? []) {
    const first = hits.slice(0, row.scanN ?? DEFAULT_SCAN_N).find((h) => h.id.startsWith(`sec-${key}-`));
    if (!first) continue;
    const text = `${first.title ?? ""} ${first.path ?? ""}`;
    if (DEFINITIONS.test(text) && !APPLICABILITY.test(text)) {
      failures.push(`${key}: its first row is a definitions row (${first.id}), before any applicability row`);
    }
  }
  return { pass: failures.length === 0, failures };
}
