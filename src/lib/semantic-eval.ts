/**
 * Acceptance questions for Ask search (Phase 3/5 of the semantic-search
 * plan). Since Ask Track B (1 Oct 2026) the set is also the pull-request
 * gate: the "Ask eval" workflow runs scripts/ask-eval.ts on every PR to
 * main and fails on any miss outside KNOWN_FAILURES; sixteen questions also
 * pin question-map routing (`map`): the engines map's four from Track B,
 * since maps batch 2 (2 Oct 2026) storage-tanks, pneumatic-controllers,
 * dehydrators, apen and the bulk-plant question that must take no map, and
 * since maps batch 3 (2 Oct 2026) combustion-devices, ldar, general-permits
 * (one new question, the 28th) and the GP01 question on storage-tanks.
 * Since migration 20261002151233 (2 Oct 2026) the gate is 28/28 with no
 * known failures.
 *
 * Original description: Each is a question a Colorado oil & gas compliance person would
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
  /**
   * Question-map routing (Ask Track B, src/lib/question-maps.ts). A string:
   * matchQuestionMap(q) must return the map with that key (the API's
   * map.key). null: no map may match. Absent: routing is not checked.
   */
  map?: string | null;
};

/**
 * Questions that fail today and are allowed to: scripts/ask-eval.ts exits
 * non-zero only for a failure outside this list, so the gate holds the line
 * at the current score without pretending these pass. Each entry says why.
 *
 * Empty since migration 20261002151233 (2 Oct 2026): the civil-penalties
 * question passes now that "the Division" and "the Commission" count as
 * Colorado state words; Common Provisions III.B.2 is #3 (was #7).
 */
export const KNOWN_FAILURES: string[] = [];

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
 * `mapKey` is the key of the question map the question routed to (null for
 * none); it is only looked at when the question sets `map`. Pure, so it can
 * be tested without a database; /admin/semantic-eval and scripts/ask-eval.ts
 * call it with the live RPC output and matchQuestionMap(q).
 */
export function evaluateQuestion(e: EvalQuestion, hits: EvalHit[], mapKey: string | null = null): EvalResult {
  const top = e.topN ?? DEFAULT_TOP_N;
  const startsWithAny = (h: EvalHit, prefixes: string[]) => prefixes.some((p) => h.id.startsWith(p));
  const failures: string[] = [];

  if (e.map !== undefined && mapKey !== e.map) {
    failures.push(
      e.map === null ? `routed to question map "${mapKey}"; expected none` : `routed to ${mapKey === null ? "no question map" : `question map "${mapKey}"`}; expected "${e.map}"`
    );
  }

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
    map: "storage-tanks",
    note: "Reg 7 Part B I.D / II.C storage tank controls; OOOOb storage vessel standard; routes to the storage-tanks question map",
  },
  {
    q: "How often do I have to do leak inspections at a well production facility?",
    expect: ["sec-7-B-II-E", "sec-oooob-60.5397b"],
    map: "ldar",
    note: "Reg 7 Part B II.E LDAR frequency; OOOOb fugitive components; routes to the ldar question map",
  },
  {
    q: "Can I install a natural gas driven pneumatic controller at a new facility?",
    expect: ["sec-7-B-III", "sec-oooob-60.5390b"],
    map: "pneumatic-controllers",
    note: "Reg 7 Part B III pneumatic controllers; OOOOb process controllers; routes to the pneumatic-controllers question map",
  },
  {
    q: "When do I have to file an APEN for a new source and what is the threshold?",
    expect: ["sec-3-A-II"],
    map: "apen",
    note: "Reg 3 Part A II APEN requirements; routes to the apen question map",
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
    map: "engines",
    note: "Reg 26 engines (Part A/B) and incorporated Subpart JJJJ; routes to the engines question map",
  },
  {
    q: "What controls are required for a glycol dehydrator?",
    expect: ["sec-7-B-I-H", "sec-7-B-II-D"],
    map: "dehydrators",
    note: "Reg 7 Part B I.H / II.D glycol dehydrators; routes to the dehydrators question map",
  },
  {
    q: "What venting and control requirements apply to a centrifugal compressor with wet seals?",
    expect: ["sec-7-B-II-J", "sec-oooob-60.5380b"],
    map: null,
    note: "Reg 7 Part B II.J; OOOOb centrifugal compressors; a compressor question takes no engine map",
  },
  {
    q: "What do I have to do with the flowback during well completion?",
    expect: ["sec-7-B-VI-D", "sec-oooob-60.5375b", "sec-ooooa-60.5375a"],
    note: "Reg 7 Part B VI.D pre-production flowback; OOOOa/OOOOb well completions",
  },
  {
    q: "When does a source need a construction permit versus just an APEN?",
    expect: ["sec-3-B-I", "sec-3-B-II", "sec-3-A-II"],
    map: "apen",
    note: "Reg 3 Part B construction permit applicability; routes to the apen question map",
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
    map: "combustion-devices",
    note: "Reg 7 Part B II.B.2.h enclosed combustion device requirements (acronym expansion + keyword side); routes to the combustion-devices question map",
  },
  {
    q: "ecd testing",
    expect: ["sec-7-B-II-B-2-h", "sec-7-B-I-E-3"],
    map: "combustion-devices",
    note: "Lowercase acronym (Sept 19 miss: 'ECD' appears nowhere in the corpus; expansion must be case-insensitive and OR-grouped on the keyword side); routes to the combustion-devices question map",
  },
  {
    q: "flare testing",
    expect: ["sec-7-B-II-B-2-h", "sec-oooob-60.5412b", "sec-ooooa-60.5412a", "sec-oooob-60.5417b"],
    map: "combustion-devices",
    note: "Reg 7 combustion devices / OOOO flare control-device requirements — a two-word keyword-style query; routes to the combustion-devices question map",
  },
  {
    q: "APEN exemptions for small sources",
    expect: ["sec-3-A-II"],
    note: "Reg 3 Part A II.D APEN exemptions",
  },
  {
    q: "What are the requirements for loading gasoline into a tank truck at a bulk plant?",
    expect: ["sec-24-B-IV", "sec-24-B-APPENDIX"],
    map: null,
    note: "Reg 24 Part B IV petroleum liquid storage and transfer; a bare \"tank\" (tank truck) takes no map",
  },
  {
    q: "Which general permits can an oil and gas well production facility register under?",
    expect: ["sec-gp12-", "sec-gp11-", "sec-gp09-", "sec-gp10-"],
    map: "general-permits",
    note: "GP12 (and GP11 / the closed GP09-GP10) for a well production facility; routes to the general-permits map",
  },
  // ---- Ask Track A regression checks (reviewer questions, 30 Sep 2026) ----
  {
    q: "When is a GP01 required?",
    expect: ["sec-gp01-I-A", "sec-gp01-I-E"],
    forbid: ["sec-gp03-", "sec-gp10-"],
    map: "storage-tanks",
    note: "GP01 I.A / I.E applicability lead; no GP03 (dust permit, word-only match) or closed GP10 row in the top 5 (20260930003557, 20260930003325); routes to the storage-tanks question map (maps batch 3)",
  },
  {
    q: "What regulations apply to a natural gas-fired engine?",
    expect: ["sec-gp12-", "sec-26-"],
    topN: 10,
    forbid: ["sec-gp09-", "sec-gp10-"],
    forbidTopN: 3,
    checks: [{ any: ["sec-gp12-"] }, { any: ["sec-26-"] }],
    map: "engines",
    note: "GP12 and Reg 26 both in the top 10; the closed GP09 / GP10 never in the top 3 (20260930003325); routes to the engines question map",
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
    map: "storage-tanks",
    note: "A storage-tank general permit (GP08 / GP05) and an OOOOa/OOOOb storage-vessel section in the top 10; no Statement of Basis in the top 5; at least 3 federal rows in the top 10 (20260930002750, 20260930003040); routes to the storage-tanks question map (maps batch 2) — the retrieval checks are unchanged",
  },
];
