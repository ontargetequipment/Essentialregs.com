import { detectFacets, matchQuestionMap } from "@/lib/question-maps";
import { isClosedPermit } from "@/lib/regulation-pure";

/**
 * Acceptance questions for Ask search (Phase 3/5 of the semantic-search
 * plan). Since Ask Track B (1 Oct 2026) the set is also the pull-request
 * gate: the "Ask eval" workflow runs scripts/ask-eval.ts on every PR to
 * main and fails on any miss outside KNOWN_FAILURES; eighteen questions also
 * pin question-map routing (`map`): the engines map's four from Track B,
 * since maps batch 2 (2 Oct 2026) storage-tanks, pneumatic-controllers,
 * dehydrators, apen and the bulk-plant question that must take no map,
 * since maps batch 3 (2 Oct 2026) combustion-devices, ldar, general-permits
 * (one new question, the 28th) and the GP01 question on storage-tanks, and
 * since maps batch 4 (2 Oct 2026) the enforcement map: the civil-penalties
 * question and one new question, the 29th. Score since maps batch 4:
 * 29/29, no known failure.
 *
 * Review 4 (7 Oct 2026) added checks scored on what the page SHOWS
 * (`shown`, `premise`, `title`): the premise notes for "When is a GP01
 * required?" and "Do I need a GP12?", the natural gas / diesel facet of the
 * engines map and the produced-water facet of the storage-tanks map. The
 * shown order comes from layoutAsk() (src/lib/question-maps.ts): the map's
 * canonical rows under their groups, then the retrieval hits, minus what a
 * stated facet left out. Retrieval checks (`expect`, `forbid`, `checks`)
 * score the hits as the page lists them: in retrieval order, minus the rows
 * a stated fact left out (`omittedIds`); a question that states no fact is
 * scored on the raw hits. Added 7 Oct 2026 after the chained run's rewrite
 * of GP06 III.E.1 ranked it third for the natural-gas compressor question,
 * a row the page does not show for that question. The two reviewer rows
 * carry their new checks; three rows are new (the 30th to 32nd). Score: 32/32.
 * The five topic notes (7 Oct 2026) add the 33rd to 37th rows, each with
 * its premise key and shown checks. Score: 37/37.
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
  /**
   * Premise note (src/lib/premise-notes.ts). A string: matchPremiseNote(q)
   * must return the note with that key. null: no note may match. Absent:
   * not checked.
   */
  premise?: string | null;
  /** The title the page shows for the map ("Natural gas-fired engines" once the fuel is stated). */
  title?: string;
  /** Conditions on the ids the page shows, in page order (layoutAsk().shownIds). */
  shown?: ShownCheck[];
};

/**
 * One condition on the shown order. `topN` counts shown rows from the top;
 * absent means the whole shown list.
 */
export type ShownCheck =
  /** at least one shown id starts with one of the prefixes, within the first topN */
  | { any: string[]; topN?: number }
  /** no shown id starts with one of the prefixes */
  | { none: string[] }
  /** each id is shown and belongs to a permit the site badges "Closed to new registrations" */
  | { closedBadge: string[] };

/**
 * What the page shows for a question, for the `note`, `title` and `shown`
 * checks (layoutAsk()). `omittedIds` are the hits a stated fact left out:
 * the retrieval checks skip them, as the page does.
 */
export type ShownContext = { ids: string[]; noteKey: string | null; title: string | null; omittedIds?: string[] };

/**
 * Questions that fail today and are allowed to: scripts/ask-eval.ts exits
 * non-zero only for a failure outside this list, so the gate holds the line
 * at the current score without pretending these pass. Each entry says why.
 *
 * Empty since maps batch 4 (2 Oct 2026). The civil-penalties question was
 * the one entry: its vocabulary gap (CP III.A never says "assess") is closed
 * by the enforcement map, which puts CP III.A first on the page, and its
 * retrieval check is widened to either Colorado penalty section (CP III or
 * ECMC Rule 525). The gate is 29/29.
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

/**
 * Rows fetched per window when the question states a facet: the stated-fact
 * filter drops the other value's rows before scoring, so the window has to
 * stay full afterwards (the natural-gas compressor question had four diesel
 * rows in its raw top five).
 */
export const FACET_FETCH_FACTOR = 3;

/** Whether the raw question states a facet value of the map it routes to (detectFacets). */
export function statesFacet(q: string): boolean {
  return Object.keys(detectFacets(q, matchQuestionMap(q))).length > 0;
}

/** How many rows the question needs fetched: the widest of its windows, times FACET_FETCH_FACTOR when it states a facet. */
export function rowsNeeded(e: EvalQuestion): number {
  const top = e.topN ?? DEFAULT_TOP_N;
  let n = Math.max(top, e.forbidTopN ?? top);
  for (const c of e.checks ?? []) n = Math.max(n, c.topN ?? top);
  return statesFacet(e.q) ? n * FACET_FETCH_FACTOR : n;
}

/**
 * Scores one question's hits (in rank order) against its expectations.
 * `mapKey` is the key of the question map the question routed to (null for
 * none); it is only looked at when the question sets `map`. `shown` is the
 * page's layout; its `omittedIds` (the hits a stated fact left out) are
 * skipped by the retrieval checks, so the windows count the hits the page
 * lists. Pure, so it can be tested without a database; /admin/semantic-eval
 * and scripts/ask-eval.ts call it with the live RPC output and layoutAsk(q).
 */
export function evaluateQuestion(e: EvalQuestion, hits: EvalHit[], mapKey: string | null = null, shown?: ShownContext): EvalResult {
  const top = e.topN ?? DEFAULT_TOP_N;
  const startsWithAny = (h: EvalHit, prefixes: string[]) => prefixes.some((p) => h.id.startsWith(p));
  const failures: string[] = [];

  if (e.map !== undefined && mapKey !== e.map) {
    failures.push(
      e.map === null ? `routed to question map "${mapKey}"; expected none` : `routed to ${mapKey === null ? "no question map" : `question map "${mapKey}"`}; expected "${e.map}"`
    );
  }

  // The shown-order checks (review 4, 7 Oct 2026). A question that sets any
  // of them needs the page's layout; a caller that passes none fails them
  // rather than skipping them.
  if (e.premise !== undefined || e.title !== undefined || (e.shown && e.shown.length > 0)) {
    if (!shown) {
      failures.push("no shown order given (layoutAsk) for the note / title / shown checks");
    } else {
      if (e.premise !== undefined && shown.noteKey !== e.premise) {
        failures.push(e.premise === null ? `premise note "${shown.noteKey}" shown; expected none` : `premise note ${shown.noteKey === null ? "missing" : `"${shown.noteKey}"`}; expected "${e.premise}"`);
      }
      if (e.title !== undefined && shown.title !== e.title) failures.push(`map titled "${shown.title}"; expected "${e.title}"`);
      for (const c of e.shown ?? []) {
        if ("any" in c) {
          const window = c.topN ? shown.ids.slice(0, c.topN) : shown.ids;
          if (!window.some((id) => c.any.some((p) => id.startsWith(p)))) failures.push(`none of ${c.any.join(", ")} shown${c.topN ? ` in the first ${c.topN}` : ""}`);
        } else if ("none" in c) {
          const bad = shown.ids.filter((id) => c.none.some((p) => id.startsWith(p)));
          if (bad.length > 0) failures.push(`shown but should not be: ${bad.join(", ")}`);
        } else if ("closedBadge" in c) {
          for (const id of c.closedBadge) {
            if (!shown.ids.includes(id)) failures.push(`${id} not shown`);
            else if (!isClosedPermit(id.match(/^sec-([^-]+)-/)?.[1] ?? null)) failures.push(`${id} is shown without the closed-permit badge`);
          }
        }
      }
    }
  }

  // The hits the page lists: a stated fact's omissions are not shown, so
  // they are not scored either.
  const omitted = new Set(shown?.omittedIds ?? []);
  const scored = omitted.size > 0 ? hits.filter((h) => !omitted.has(h.id)) : hits;
  const filtered = scored.length < hits.length ? " (after the stated-fact filter)" : "";

  const idx = scored.slice(0, top).findIndex((h) => startsWithAny(h, e.expect));
  const matchRank = idx >= 0 ? idx + 1 : null;
  if (matchRank == null) failures.push(`none of ${e.expect.join(", ")} in the top ${top}${filtered}`);

  if (e.forbid && e.forbid.length > 0) {
    const n = e.forbidTopN ?? top;
    const bad = scored.slice(0, n).filter((h) => startsWithAny(h, e.forbid ?? []));
    if (bad.length > 0) failures.push(`forbidden in the top ${n}${filtered}: ${bad.map((h) => h.id).join(", ")}`);
  }

  for (const c of e.checks ?? []) {
    const n = c.topN ?? top;
    const window = scored.slice(0, n);
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
    expect: ["sec-26-A", "sec-26-B-I", "sec-26-B-II", "sec-jjjj"],
    map: "engines",
    note: "Reg 26 engines (Part A/B) or the Subpart JJJJ document it cites (its copy under Reg 26 Part C was removed 4 Oct 2026); routes to the engines question map. The fuel is stated, so the diesel rows (GP06, Subpart IIII) the page leaves out are not scored: after the 7 Oct 2026 rewrite, GP06 III.E.1 ranks third among the raw hits",
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
    expect: ["sec-cp-III", "sec-ecmc-525"],
    map: "enforcement",
    note: "a Colorado penalty-assessment section in the top 5 — Common Provisions III or ECMC Rule 525; the map puts CP III.A first on the page regardless of rank. Production 2 Oct: 525.c #1, 525.b.(7) #2, CP III.B.2 #3",
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
  {
    q: "What is the maximum civil penalty per day for violating an AQCC regulation?",
    expect: ["sec-cp-III"],
    map: "enforcement",
    note: "Common Provisions III.A/III.B.3 — the per-day maximum; routes to the enforcement map (production 2 Oct: CP III.A #1 at cosine 0.58)",
  },
  // ---- Ask Track A regression checks (reviewer questions, 30 Sep 2026) ----
  {
    q: "When is a GP01 required?",
    expect: ["sec-gp01-I-A", "sec-gp01-I-E"],
    forbid: ["sec-gp03-", "sec-gp10-"],
    map: "premise-gp01",
    premise: "gp01-required",
    shown: [
      { any: ["sec-gp01-I-A"], topN: 3 },
      { any: ["sec-3-A-II-A-1", "sec-3-B-II-A-1", "sec-3-B-I-A"] },
    ],
    note: "GP01 I.A / I.E applicability lead; no GP03 (dust permit, word-only match) or closed GP10 row in the top 5 (20260930003557, 20260930003325). Review 4 (7 Oct 2026): the GP01 premise note is present, GP01 I.A is in the first three shown rows, a Regulation 3 permit or APEN requirement provision is shown, and the question takes the GP01 premise map, not the storage-tank map",
  },
  {
    q: "What regulations apply to a natural gas-fired engine?",
    expect: ["sec-gp12-", "sec-26-"],
    topN: 10,
    forbid: ["sec-gp09-", "sec-gp10-"],
    forbidTopN: 3,
    checks: [{ any: ["sec-gp12-"] }, { any: ["sec-26-"] }],
    map: "engines",
    title: "Natural gas-fired engines",
    shown: [
      { none: ["sec-gp06-", "sec-iiii-"] },
      { any: ["sec-3-"] },
      { any: ["sec-gp12-"] },
      { any: ["sec-26-"] },
      { any: ["sec-jjjj-"] },
      { any: ["sec-zzzz-"] },
      { closedBadge: ["sec-gp09-I-A", "sec-gp10-I-A"] },
    ],
    note: "GP12 and Reg 26 both in the top 10; the closed GP09 / GP10 never in the top 3 (20260930003325); routes to the engines question map. Review 4 (7 Oct 2026): the fuel is stated, so no GP06 and no Subpart IIII provision is shown; Regulation 3, GP12, Regulation 26, JJJJ and ZZZZ still shown; GP09 and GP10 still shown and badged closed; the map is titled for the stated fuel",
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
  // ---- Review 4 (7 Oct 2026): premise notes and stated-fact filters, scored on the shown order ----
  {
    q: "Do I need a GP12?",
    expect: ["sec-gp12-"],
    topN: 10,
    map: "premise-gp12",
    premise: "gp12-required",
    shown: [{ any: ["sec-gp12-I-A"], topN: 3 }, { any: ["sec-3-A-II-A-1", "sec-3-B-II-A-1", "sec-3-B-I-A"] }],
    note: "the GP12 premise note is present; GP12 I.A in the first three shown rows; a Regulation 3 permit or APEN requirement provision is shown",
  },
  {
    q: "What applies to a diesel engine?",
    expect: ["sec-gp06-", "sec-iiii-", "sec-gp12-", "sec-26-", "sec-3-"],
    topN: 10,
    map: "engines",
    title: "Diesel engines",
    shown: [{ any: ["sec-gp06-"] }, { any: ["sec-iiii-"] }, { none: ["sec-jjjj-"] }],
    note: "diesel stated: GP06 and Subpart IIII shown, no Subpart JJJJ provision shown; the map titled for diesel",
  },
  {
    q: "What rules apply to a produced water storage tank at a well site?",
    expect: ["sec-7-B-I-D", "sec-7-B-II-C", "sec-gp05-", "sec-gp08-", "sec-gp12-", "sec-oooob-", "sec-ooooa-", "sec-ooooc-"],
    topN: 10,
    map: "storage-tanks",
    title: "Produced water storage tanks and tank batteries",
    shown: [{ any: ["sec-gp05-I-A"] }, { any: ["sec-gp08-I-B"] }, { none: ["sec-gp01-", "sec-gp07-", "sec-7-B-I-B-9"] }],
    note: "the contents are stated: GP05 and GP08 shown, GP01 (condensate), GP07 (hydrocarbon liquid loadout) and the condensate storage tank definition left out, the map titled for produced water",
  },
  // ---- The five topic notes (7 Oct 2026, shipped on the owner's instruction): note present, its cited rows shown first ----
  {
    q: "Do I need an APEN for every emission point at my site?",
    expect: ["sec-3-A-II-D", "sec-3-A-II-A", "sec-3-B-II-D"],
    topN: 10,
    map: "premise-apen-every-point",
    premise: "apen-every-point",
    shown: [{ any: ["sec-3-A-II-A-1"], topN: 3 }, { any: ["sec-3-A-II-D-1-a"] }, { any: ["sec-3-A-II-D-1-fff"] }],
    note: "the APEN note: Regulation 3 Part A II.A.1 leads, the emission-rate and storage-tank exemptions are shown; retrieval finds the APEN exemptions in the top 10",
  },
  {
    q: "Does my well site need a Title V operating permit?",
    expect: ["sec-3-C-", "sec-3-A-I-B", "sec-gp12-I-E", "sec-gp05-VIII-A", "sec-gp07-VIII-A", "sec-gp01-I-D", "sec-gp05-I-D", "sec-gp08-I-E", "sec-gp11-I-A-4"],
    topN: 10,
    map: "premise-title-v-well-site",
    premise: "title-v-well-site",
    shown: [{ any: ["sec-3-C-II-A-1"], topN: 3 }, { any: ["sec-gp12-I-E"] }, { any: ["sec-gp05-VIII-A"] }],
    note: "the Title V note: Regulation 3 Part C II.A.1 leads, the general permits' minor-source condition and their Title V rows shown; retrieval finds a Part C row, the major-source definition, or one of the general permits' own Title V provisions (a registered facility that becomes a major source must apply for a Title V permit: GP05 / GP07 VIII.A; sources that became subject to Title V on the Northern Weld County reclassification: GP01 I.D, GP05 I.D, GP08 I.E, GP11 I.A.4) in the top 10 (production 8 Oct 2026: GP11 I.A.4, GP05 VIII.A, GP07 VIII.A, GP08 I.E, GP05 I.D lead)",
  },
  {
    q: "If my tank battery is exempt from a construction permit, does Regulation 7 still apply?",
    expect: ["sec-3-B-II-D", "sec-3-A-II-D", "sec-7-B-I-A", "sec-7-B-II-C", "sec-7-B-I-D"],
    topN: 10,
    map: "premise-exempt-still-regulated",
    premise: "exempt-still-regulated",
    shown: [{ any: ["sec-3-B-II-D"], topN: 5 }, { any: ["sec-7-B-I-A"] }],
    note: "the exemption note: the Part B II.D sentence (a permit exemption does not affect other regulations) and Regulation 7 Part B I.A shown; retrieval finds an exemption row or a Regulation 7 Part B applicability or tank row in the top 10",
  },
  {
    q: "Does OOOOb apply to an existing well drilled before 2022?",
    expect: ["sec-oooob-60.5365b", "sec-ooooc-60.5360c", "sec-oooob-60.5370b"],
    topN: 10,
    map: "premise-oooob-existing-well",
    premise: "oooob-existing-well",
    shown: [{ any: ["sec-oooob-60.5365b"], topN: 1 }, { any: ["sec-oooob-60.5365b-(a)-(1)"] }, { any: ["sec-ooooc-60.5360c"] }],
    note: "the OOOOb note: § 60.5365b first, the well modification rule and OOOOc's emission guidelines shown; retrieval finds the applicability, compliance-date or OOOOc purpose row in the top 10",
  },
  {
    q: "Can I register a diesel engine under GP02?",
    expect: ["sec-gp02-I-A", "sec-gp06-I-A", "sec-gp12-I-A"],
    topN: 10,
    map: "premise-gp02-diesel",
    premise: "gp02-diesel",
    shown: [{ any: ["sec-gp02-I-A"], topN: 1 }, { any: ["sec-gp06-I-A"], topN: 3 }, { any: ["sec-gp12-I-A-2"] }],
    note: "the GP02 diesel note (tried before the 'Is GP02 required?' note): GP02 I.A first, GP06 I.A in the first three, GP12 I.A.2 shown; retrieval finds a GP02, GP06 or GP12 applicability row in the top 10",
  },
];
