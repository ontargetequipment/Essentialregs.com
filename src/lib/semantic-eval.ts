/**
 * Acceptance questions for Ask search (Phase 3/5 of the semantic-search
 * plan). Each is a question a Colorado oil & gas compliance person would
 * actually type, with the provision(s) that should appear in the top 5,
 * given as id prefixes — any hit whose id starts with one of them passes.
 * Prefixes point at the *section* that governs the topic (e.g. Reg 7 Part B
 * I.D = storage tank emission controls), not one exact paragraph, because
 * several paragraphs in that section are legitimate answers.
 *
 * Target from the plan: ≥ 17 of 20 pass. Run at /admin/semantic-eval.
 *
 * The last three (Ask Track A, 30 Sep 2026) are the outside reviewer's
 * questions, pinned with `forbid` / `checks` so the ranking migrations
 * 20260930002750..20260930003741 cannot silently regress: no GP03 or closed
 * GP09/GP10 row leading "When is a GP01 required?", GP12 and Reg 26 above the
 * closed permits for the engine question, and real federal rows (not a
 * Statement of Basis) for "Colorado and federal ... storage vessels".
 */
export type EvalQuestion = {
  q: string;
  /** Any hit whose id starts with one of these, within the top `topN`, passes. */
  expect: string[];
  note: string;
  /** Window for `expect` (and for `checks` entries that name none). Default DEFAULT_TOP_N. */
  topN?: number;
  /** No hit whose id starts with one of these may appear within the top `forbidTopN`. */
  forbid?: string[];
  /** Window for `forbid`. Default: `topN`. */
  forbidTopN?: number;
  /** Further conditions, all of which must hold. */
  checks?: EvalCheck[];
  /**
   * Run this question with Statements of Basis included. Default: hidden,
   * which is what a subscriber sees on Ask. None of the current questions
   * set it.
   */
  includeBasis?: true;
};

/**
 * One extra condition on a question's hits. `topN` defaults to the
 * question's window. All optional and backwards-compatible: the original
 * 24 questions use none of them.
 */
export type EvalCheck =
  /** at least one hit whose id starts with one of the prefixes (a second required group) */
  | { any: string[]; topN?: number }
  /** no hit whose id starts with one of the prefixes */
  | { none: string[]; topN?: number }
  /** no Statement-of-Basis row (is_basis) */
  | { noBasis: true; topN?: number }
  /** at least this many rows with jurisdiction_level = 'federal' */
  | { minFederal: number; topN?: number };

export const DEFAULT_TOP_N = 5;

/** The fields of a hit the evaluator reads (a subset of SemanticHit). */
export type EvalHit = {
  id: string;
  is_basis?: boolean | null;
  jurisdiction_level?: string | null;
};

export type EvalResult = {
  pass: boolean;
  /** 1-based rank of the first `expect` hit, or null */
  matchRank: number | null;
  /** one line per condition that failed; empty when pass */
  failures: string[];
};

/** How many rows the question needs fetched: the widest of its windows. */
export function rowsNeeded(e: EvalQuestion): number {
  const top = e.topN ?? DEFAULT_TOP_N;
  let n = Math.max(top, e.forbidTopN ?? top);
  for (const c of e.checks ?? []) n = Math.max(n, c.topN ?? top);
  return n;
}

/**
 * Scores one question's hits (in rank order) against its expectations.
 * Pure, so it can be tested without a database; /admin/semantic-eval calls
 * it with the live RPC output.
 */
export function evaluateQuestion(e: EvalQuestion, hits: EvalHit[]): EvalResult {
  const top = e.topN ?? DEFAULT_TOP_N;
  const startsWithAny = (h: EvalHit, prefixes: string[]) => prefixes.some((p) => h.id.startsWith(p));
  const failures: string[] = [];

  const idx = hits.slice(0, top).findIndex((h) => startsWithAny(h, e.expect));
  const matchRank = idx >= 0 ? idx + 1 : null;
  if (matchRank == null) failures.push(`none of ${e.expect.join(", ")} in the top ${top}`);

  if (e.forbid && e.forbid.length > 0) {
    const n = e.forbidTopN ?? top;
    const bad = hits.slice(0, n).filter((h) => startsWithAny(h, e.forbid ?? []));
    if (bad.length > 0) failures.push(`forbidden in the top ${n}: ${bad.map((h) => h.id).join(", ")}`);
  }

  for (const c of e.checks ?? []) {
    const n = c.topN ?? top;
    const window = hits.slice(0, n);
    if ("any" in c) {
      if (!window.some((h) => startsWithAny(h, c.any))) failures.push(`none of ${c.any.join(", ")} in the top ${n}`);
    } else if ("none" in c) {
      const bad = window.filter((h) => startsWithAny(h, c.none));
      if (bad.length > 0) failures.push(`forbidden in the top ${n}: ${bad.map((h) => h.id).join(", ")}`);
    } else if ("noBasis" in c) {
      const bad = window.filter((h) => h.is_basis === true);
      if (bad.length > 0) failures.push(`Statement of Basis in the top ${n}: ${bad.map((h) => h.id).join(", ")}`);
    } else if ("minFederal" in c) {
      const got = window.filter((h) => h.jurisdiction_level === "federal").length;
      if (got < c.minFederal) failures.push(`${got} federal rows in the top ${n}; need ${c.minFederal}`);
    }
  }

  return { pass: failures.length === 0, matchRank, failures };
}

export const EVAL_QUESTIONS: EvalQuestion[] = [
  {
    q: "Do I need emission controls on a condensate storage tank at a well site?",
    expect: ["sec-7-B-I-D", "sec-7-B-II-C", "sec-oooob-60.5395b"],
    note: "Reg 7 Part B I.D / II.C storage tank controls; OOOOb storage vessel standard",
  },
  {
    q: "How often do I have to do leak inspections at a well production facility?",
    expect: ["sec-7-B-II-E", "sec-oooob-60.5397b"],
    note: "Reg 7 Part B II.E LDAR frequency; OOOOb fugitive components",
  },
  {
    q: "Can I install a natural gas driven pneumatic controller at a new facility?",
    expect: ["sec-7-B-III", "sec-oooob-60.5390b"],
    note: "Reg 7 Part B III pneumatic controllers; OOOOb process controllers",
  },
  {
    q: "When do I have to file an APEN for a new source and what is the threshold?",
    expect: ["sec-3-A-II"],
    note: "Reg 3 Part A II APEN requirements",
  },
  {
    q: "What notice do I have to give before removing asbestos from a building?",
    expect: ["sec-8-B-III"],
    note: "Reg 8 Part B III abatement/renovation/demolition notifications",
  },
  {
    q: "How is an odor violation measured with dilutions?",
    expect: ["sec-2-A-I", "sec-2-A-II"],
    note: "Reg 2 Part A odor dilution standard",
  },
  {
    q: "Do I need to notify the Commission before abandoning a flowline?",
    expect: ["sec-ecmc-1105"],
    note: "ECMC Rule 1105 flowline abandonment",
  },
  {
    q: "How far does a new well pad have to be from a house or a school?",
    expect: ["sec-ecmc-604"],
    note: "ECMC Rule 604 setbacks",
  },
  {
    q: "Do I need a permit to burn slash piles on a lease?",
    expect: ["sec-9-III", "sec-9-IV", "sec-9-II", "sec-9-I"],
    note: "Reg 9 open burning permits (Sept 18 miss: vocabulary — 'slash' vs 'open burning')",
  },
  {
    q: "Which oil and gas operators have to report annual greenhouse gas emissions to the state?",
    expect: ["sec-22-A-III", "sec-22-A-IV", "sec-7-B-VIII"],
    note: "Reg 22 GHG reporting; Reg 7 Part B VIII intensity reporting",
  },
  {
    q: "What are the noise limits at an oil and gas location near residences?",
    expect: ["sec-ecmc-423"],
    note: "ECMC Rule 423 noise",
  },
  {
    q: "What do I have to do after a spill of produced water?",
    expect: ["sec-ecmc-912"],
    note: "ECMC Rule 912 spills and releases",
  },
  {
    q: "What are the emission standards for a new natural gas fired compressor engine?",
    expect: ["sec-26-A", "sec-26-B-I", "sec-26-B-II", "sec-26-C-FEDJJJJ"],
    note: "Reg 26 engines (Part A/B) and incorporated Subpart JJJJ",
  },
  {
    q: "What controls are required for a glycol dehydrator?",
    expect: ["sec-7-B-I-H", "sec-7-B-II-D"],
    note: "Reg 7 Part B I.H / II.D glycol dehydrators",
  },
  {
    q: "What venting and control requirements apply to a centrifugal compressor with wet seals?",
    expect: ["sec-7-B-II-J", "sec-oooob-60.5380b"],
    note: "Reg 7 Part B II.J; OOOOb centrifugal compressors",
  },
  {
    q: "What do I have to do with the flowback during well completion?",
    expect: ["sec-7-B-VI-D", "sec-oooob-60.5375b", "sec-ooooa-60.5375a"],
    note: "Reg 7 Part B VI.D pre-production flowback; OOOOa/OOOOb well completions",
  },
  {
    q: "When does a source need a construction permit versus just an APEN?",
    expect: ["sec-3-B-I", "sec-3-B-II", "sec-3-A-II"],
    note: "Reg 3 Part B construction permit applicability",
  },
  {
    q: "How does the Division assess civil penalties for a violation?",
    expect: ["sec-cp-III"],
    note: "Common Provisions III civil penalties",
  },
  {
    q: "Am I subject to the federal OOOOb rules if I modified a well after December 2022?",
    expect: ["sec-oooob-60.5365b", "sec-oooob-60.5370b"],
    note: "OOOOb applicability and compliance dates",
  },
  {
    q: "ECD testing requirements",
    expect: ["sec-7-B-II-B-2-h", "sec-7-B-I-E"],
    note: "Reg 7 Part B II.B.2.h enclosed combustion device requirements (acronym expansion + keyword side)",
  },
  {
    q: "ecd testing",
    expect: ["sec-7-B-II-B-2-h", "sec-7-B-I-E-3"],
    note: "Lowercase acronym (Sept 19 miss: 'ECD' appears nowhere in the corpus; expansion must be case-insensitive and OR-grouped on the keyword side)",
  },
  {
    q: "flare testing",
    expect: ["sec-7-B-II-B-2-h", "sec-oooob-60.5412b", "sec-ooooa-60.5412a", "sec-oooob-60.5417b"],
    note: "Reg 7 combustion devices / OOOO flare control-device requirements — a two-word keyword-style query",
  },
  {
    q: "APEN exemptions for small sources",
    expect: ["sec-3-A-II"],
    note: "Reg 3 Part A II.D APEN exemptions",
  },
  {
    q: "What are the requirements for loading gasoline into a tank truck at a bulk plant?",
    expect: ["sec-24-B-IV", "sec-24-B-APPENDIX"],
    note: "Reg 24 Part B IV petroleum liquid storage and transfer",
  },
  // ---- Ask Track A regression checks (reviewer questions, 30 Sep 2026) ----
  {
    q: "When is a GP01 required?",
    expect: ["sec-gp01-I-A", "sec-gp01-I-E"],
    forbid: ["sec-gp03-", "sec-gp10-"],
    note: "GP01 I.A / I.E applicability lead; no GP03 (dust permit, word-only match) or closed GP10 row in the top 5 (20260930003557, 20260930003325)",
  },
  {
    q: "What regulations apply to a natural gas-fired engine?",
    expect: ["sec-gp12-", "sec-26-"],
    topN: 10,
    forbid: ["sec-gp09-", "sec-gp10-"],
    forbidTopN: 3,
    checks: [{ any: ["sec-gp12-"] }, { any: ["sec-26-"] }],
    note: "GP12 and Reg 26 both in the top 10; the closed GP09 / GP10 never in the top 3 (20260930003325)",
  },
  {
    q: "What Colorado and federal requirements could apply to storage vessels?",
    expect: ["sec-gp08-", "sec-gp05-"],
    topN: 10,
    checks: [
      { any: ["sec-oooob-60.5365b", "sec-oooob-60.5395b", "sec-ooooa-60.5365a", "sec-ooooa-60.5395a"] },
      { noBasis: true, topN: 5 },
      { minFederal: 3 },
    ],
    note: "A storage-tank general permit (GP08 / GP05) and an OOOOa/OOOOb storage-vessel section in the top 10; no Statement of Basis in the top 5; at least 3 federal rows in the top 10 (20260930002750, 20260930003040)",
  },
];
