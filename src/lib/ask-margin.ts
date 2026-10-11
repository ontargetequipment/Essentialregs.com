/**
 * Ranking margin of an Ask eval question (11 Oct 2026): how far its answer
 * is from falling out of (or getting into) the window the eval scores.
 *
 * Why: "ECD testing requirements" passed at exactly rank 5 of 5 in every run
 * on record, 0.00035 of fused score above rank 6. Voyage returns a slightly
 * different query vector about one call in ten (cosine 0.9999 to the usual
 * one), which moves fused scores by about 0.001, so the question failed at
 * random. A pass/fail gate cannot see a pass that thin; this number can.
 *
 * Definition. The `expect` check passes when at least one expected row is
 * among the first `topN` hits the page lists (raw retrieval order minus the
 * rows a stated fact left out). The margin is the largest amount by which
 * every expected row's fused score could fall, the other rows unchanged,
 * before that stops being true; negative when the question fails, then the
 * amount the expected rows would have to rise. When the order is plain
 * fused order this is the best expected row's fused score minus the topN-th
 * best unexpected row's. The RPC's jurisdiction ordering (a question naming
 * federal and/or Colorado rules; see match_provisions_hybrid) is not plain
 * fused order, so the margin is found by re-ranking the returned rows with
 * the same ORDER BY (`orderRows`) and bisecting on the shift.
 *
 * Only the `expect` check is measured (not `forbid`, `checks`, the map or
 * the shown order). Rows the RPC did not return cannot move up, so a margin
 * larger than the gap to the last returned row is reported as a lower bound.
 * Pure: no database, unit-tested in scripts/ask-margin.test.ts.
 */

/** The fields of an RPC row the margin needs. */
export type MarginRow = { id: string; fused: number | null; score: number | null; jurisdiction_level?: string | null };

/** A margin below this is flagged: about five times the score jitter one changed query vector causes (~0.001). */
export const MARGIN_FLAG = 0.005;

// Same word lists as match_provisions_hybrid's want_fed / want_state (the
// RPC tests them on the expanded question text, lower-cased; \m and \M are
// Postgres word boundaries).
const FED_WORDS = String.raw`federal|federally|epa|cfr|nsps|neshap|subpart|oooo[abc]?|jjjj|iiii|zzzz|phmsa|u\.?s\.?`;
const STATE_WORDS = String.raw`colorado|state|cdphe|apcd|aqcc|ecmc|cogcc|division|commission|regulation\s*[0-9]+|reg\s*[0-9]+|gp\s?[0-9]{2}|general permit`;
const wordRe = (alts: string) => new RegExp(String.raw`(?<![A-Za-z0-9_])(?:${alts})(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])`);

/** Which jurisdictions the question names, as the RPC decides it (query_text is the acronym-expanded question). */
export function namedJurisdictions(queryText: string): { wantFed: boolean; wantState: boolean } {
  const q = queryText.toLowerCase();
  return { wantFed: wordRe(FED_WORDS).test(q), wantState: wordRe(STATE_WORDS).test(q) };
}

/**
 * The RPC's final ORDER BY over the returned rows: both jurisdictions named,
 * a strict interleave by rank within jurisdiction (state first in each
 * pair); one named, its three best rows lead; then fused desc, cosine desc.
 * (The RPC's last key, sort_order, is not returned; ties on fused and cosine
 * are left in input order.)
 */
export function orderRows<T extends MarginRow>(rows: T[], named: { wantFed: boolean; wantState: boolean }, fusedOf: (r: T) => number = (r) => r.fused ?? 0): T[] {
  const { wantFed, wantState } = named;
  const byScore = (a: T, b: T) => fusedOf(b) - fusedOf(a) || (b.score ?? -1) - (a.score ?? -1);
  const jrank = new Map<T, number>();
  const byJur = new Map<string, T[]>();
  for (const r of rows) {
    const j = r.jurisdiction_level ?? "";
    if (!byJur.has(j)) byJur.set(j, []);
    byJur.get(j)!.push(r);
  }
  for (const list of byJur.values()) [...list].sort(byScore).forEach((r, i) => jrank.set(r, i + 1));
  const weighted = (r: T) => (wantFed !== wantState && ((wantFed && r.jurisdiction_level === "federal") || (wantState && r.jurisdiction_level === "state")));
  const key = (r: T): number[] => {
    if (wantFed && wantState) return [jrank.get(r)!, r.jurisdiction_level === "state" ? 0 : 1];
    if (wantFed !== wantState) return [weighted(r) && jrank.get(r)! <= 3 ? 0 : 1];
    return [];
  };
  return rows
    .map((r, i) => ({ r, i, k: key(r) }))
    .sort((a, b) => {
      for (let n = 0; n < a.k.length; n++) if (a.k[n] !== b.k[n]) return a.k[n] - b.k[n];
      return byScore(a.r, b.r) || a.i - b.i;
    })
    .map((x) => x.r);
}

export type Margin = {
  /** the margin (see the file comment); null when no expected row was returned at all */
  margin: number | null;
  /** true when the margin is a lower bound: more rows would have to be read to find the real one */
  atLeast: boolean;
  /** re-ranking the returned rows with orderRows gives the RPC's own order (a check on the simulation) */
  orderMatches: boolean;
};

/**
 * The margin of one question's `expect` check over the rows the RPC
 * returned (in its order). `omittedIds`: the rows a stated fact left out
 * (layoutAsk), which the eval does not score.
 */
export function expectMargin(rows: MarginRow[], expect: string[], topN: number, queryText: string, omittedIds: Iterable<string> = []): Margin {
  const named = namedJurisdictions(queryText);
  const omitted = new Set(omittedIds);
  const isExpected = (r: MarginRow) => expect.some((p) => r.id.startsWith(p));
  const orderMatches = orderRows(rows, named).every((r, i) => r === rows[i]);
  if (!rows.some(isExpected)) return { margin: null, atLeast: false, orderMatches };

  // shift > 0 lowers every expected row by `shift`; < 0 raises them.
  const passes = (shift: number) => {
    const ranked = orderRows(rows, named, (r) => (r.fused ?? 0) - (isExpected(r) ? shift : 0)).filter((r) => !omitted.has(r.id));
    return ranked.slice(0, topN).some(isExpected);
  };
  const fused = rows.map((r) => r.fused ?? 0);
  const span = Math.max(...fused) - Math.min(...fused) + 1e-6;
  const passing = passes(0);
  // The furthest shift that can still change anything among these rows.
  if (passing && passes(span)) return { margin: span, atLeast: true, orderMatches };
  if (!passing && !passes(-span)) return { margin: -span, atLeast: true, orderMatches };
  let lo = 0;
  let hi = passing ? span : -span;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (passes(mid) === passing) lo = mid;
    else hi = mid;
  }
  // `hi` is the first shift that changes the outcome: the boundary.
  return { margin: hi, atLeast: false, orderMatches };
}

/** "0.00035", "≥ 0.0412", "−0.0021", "absent" -- for the reports. */
export function formatMargin(m: Margin): string {
  if (m.margin == null) return "absent";
  const v = m.margin < 0 ? `−${(-m.margin).toFixed(5)}` : m.margin.toFixed(5);
  return m.atLeast ? (m.margin < 0 ? `≤ ${v}` : `≥ ${v}`) : v;
}
