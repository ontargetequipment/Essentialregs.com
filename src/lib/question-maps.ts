import { expandAcronyms } from "@/lib/acronyms";
import { matchPremiseNote, premiseNoteForMapKey, type PremiseNote, type PremiseSentence } from "@/lib/premise-notes";
import { regKeyOf } from "@/lib/regulation-names";

/**
 * Question maps (Ask Track B, 1 Oct 2026).
 *
 * A flat list of twenty provisions does not answer an applicability
 * question. "What regulations apply to a natural gas-fired engine?" has a
 * structure -- Colorado permitting, the general-permit options, the Colorado
 * standards, the federal NSPS, the federal NESHAP, the definitions -- and two
 * of its canonical rows (JJJJ § 60.4230 and ZZZZ § 63.6585, heading-only
 * applicability sections) never reach the top 10 by retrieval alone.
 *
 * A map is data: a trigger, one sentence naming what decides applicability,
 * and the canonical rows in display order, each with its group and the reason
 * it is there. Retrieval is unchanged; the map is additive. The page shows
 * the canonical rows first inside each group, then the retrieval hits that
 * groupForHit() puts in the same group, then everything else under "Other
 * matches". Adding a map is a data-only change to QUESTION_MAPS (plus
 * `npx tsx scripts/question-map-ids.ts` to regenerate the id list that
 * scripts/corpus_qa.sql check 20 verifies against the database).
 *
 * Pure: no React, no Supabase. The eval script and the page both call
 * matchQuestionMap() so the two never disagree about which map a question
 * takes.
 */

export type MapGroup =
  | "Permit applicability"
  | "Colorado permitting and APEN"
  | "Alternatives if the permit does not fit"
  | "General Permit options"
  | "Colorado standards"
  | "Federal NSPS"
  | "Federal NESHAP"
  | "ECMC rules"
  | "Federal PHMSA"
  | "Definitions";

/**
 * The groups in display order. The first six of the original eight were
 * air-centric on purpose for the first maps; "ECMC rules" and "Federal
 * PHMSA" (maps batch 4, 2 Oct 2026) sit after the federal air groups and
 * before Definitions. "Permit applicability" and "Alternatives if the
 * permit does not fit" (premise notes, 7 Oct 2026) are used only by the
 * premise maps (src/lib/premise-notes.ts): the named permit's own Section I
 * rows lead, the Regulation 3 rows follow, then the alternatives, then
 * whatever retrieval found. groupForHit() never routes a hit into either,
 * so the ordinary maps are unchanged.
 */
export const MAP_GROUP_ORDER: MapGroup[] = [
  "Permit applicability",
  "Colorado permitting and APEN",
  "Alternatives if the permit does not fit",
  "General Permit options",
  "Colorado standards",
  "Federal NSPS",
  "Federal NESHAP",
  "ECMC rules",
  "Federal PHMSA",
  "Definitions",
];

/** The heading for retrieval hits groupForHit() puts in no group. */
export const OTHER_GROUP = "Other matches";

/** 40 CFR Part 60 subparts in the corpus: NSPS rows go under "Federal NSPS". */
export const FEDERAL_NSPS_REG_KEYS: readonly string[] = ["oooo", "ooooa", "oooob", "ooooc", "jjjj", "iiii"];

/** 40 CFR Part 63 subparts in the corpus: NESHAP rows go under "Federal NESHAP". */
export const FEDERAL_NESHAP_REG_KEYS: readonly string[] = ["zzzz"];

/** The ECMC 100-1200 Series rules (one reg_key): ECMC rows go under "ECMC rules". */
export const ECMC_REG_KEYS: readonly string[] = ["ecmc"];

/** 49 CFR Parts 190-199 in the corpus (reg_key p19x): PHMSA rows go under "Federal PHMSA". */
export const PHMSA_REG_KEYS: readonly string[] = ["p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"];

/**
 * AQCC regulation keys: the numbered regulations 1-31 plus the Common
 * Provisions ("cp") and the Air Quality Standards ("aqs"). A state row with
 * one of these keys goes under "Colorado standards" (Regulation 3, the
 * permitting regulation, is routed before this list is consulted). Keyed by
 * name, like ECMC_REG_KEYS and PHMSA_REG_KEYS above, so a group is a list
 * here plus one line in groupForHit().
 */
export const AQCC_REGULATION_KEYS: readonly string[] = [
  ...Array.from({ length: 31 }, (_, i) => String(i + 1)),
  "cp",
  "aqs",
];

/** Retrieval hits shown per group after the canonical rows. */
export const MAX_HITS_PER_GROUP = 3;
/** Retrieval hits shown under "Other matches". */
export const MAX_OTHER_HITS = 5;

/**
 * Facets (review 4, item 2, 7 Oct 2026): a fact the visitor can state in
 * the question that a map branches on. The reviewer asked about a "natural
 * gas-fired engine" and the engines map showed GP06, the diesel permit.
 * When the question states one value of a facet the map carries, the rows
 * tagged with another value are left out, the map is titled for the stated
 * value and one line under the results names what was left out and why.
 * When the question states nothing (or two values), the map behaves as
 * before. Only maps that already branch on the fact carry the facet.
 */
export type FacetName = "fuel" | "contents";

export type FacetValue = {
  /** The value as stored on rows and used in URLs: "natural gas", "diesel", "produced water". */
  value: string;
  /** How the omitted line names the stated fact: "you said natural gas". */
  said: string;
  /** Patterns on the raw question (never the acronym-expanded one) that state this value. */
  patterns: RegExp[];
  /** The noun phrase of this value's rows in the omitted line: "diesel engine provisions (GP06, Subpart IIII)". */
  omitted: string;
  /** Retrieval hits from these reg keys belong to this value only (dropped when another value is stated). */
  regKeys: string[];
};

export type Facet = { name: FacetName; label: string; values: FacetValue[] };

export const FACETS: Record<FacetName, Facet> = {
  fuel: {
    name: "fuel",
    label: "engine fuel",
    values: [
      {
        value: "natural gas",
        said: "natural gas",
        patterns: [/\bnatural[- ]gas\b/i, /\bgas[- ]fired\b/i, /\bspark[- ]ignition\b/i, /\b(?:rich|lean)[- ]burn\b/i, /\bsi\s+(?:rice|engines?)\b/i],
        omitted: "natural gas-fired engine provisions (GP02, Subpart JJJJ)",
        regKeys: ["gp02", "jjjj"],
      },
      {
        value: "diesel",
        said: "diesel",
        patterns: [/\bdiesel\b/i, /\bcompression[- ]ignition\b/i, /\bci\s+(?:rice|engines?)\b/i],
        omitted: "diesel engine provisions (GP06, Subpart IIII)",
        regKeys: ["gp06", "iiii"],
      },
    ],
  },
  contents: {
    name: "contents",
    label: "what the tank stores",
    values: [
      {
        value: "condensate",
        said: "condensate",
        patterns: [/\bcondensate\b/i],
        omitted: "condensate-only provisions (GP01, the condensate storage tank definition)",
        regKeys: ["gp01"],
      },
      {
        value: "crude oil",
        said: "crude oil",
        patterns: [/\bcrude(?:[- ]oil)?\b/i],
        omitted: "crude oil provisions",
        regKeys: [],
      },
      {
        value: "produced water",
        said: "produced water",
        patterns: [/\bproduced[- ]water\b/i],
        omitted: "produced water provisions (GP05)",
        regKeys: ["gp05"],
      },
    ],
  },
};

/** The facet values a row applies to; a facet the row does not name applies to every value. */
export type FacetTags = Partial<Record<FacetName, string[]>>;

export type MapProvision = {
  id: string;
  group: MapGroup;
  /** One line, shown as "Why it's here: …" on the card. */
  why: string;
  /** The facet values this row is specific to (absent: every value). */
  facets?: FacetTags;
};

/** A sentence of a map's introduction and the provisions that support it (see PremiseSentence). */
export type IntroSentence = PremiseSentence;

/** The introduction as one string: the sentences joined. */
export function introText(map: Pick<QuestionMap, "factors">): string {
  return map.factors.map((x) => x.text).join(" ");
}

export type QuestionMap = {
  key: string;
  name: string;
  /** Case-insensitive word-boundary patterns; any match routes the question here. */
  triggers: RegExp[];
  /**
   * What decides applicability, as cited sentences (9 Oct 2026; one string
   * until then). Shown above the groups, each sentence with its provisions
   * as reader links, like a premise note.
   */
  factors: IntroSentence[];
  /** Canonical rows, in display order. Every id must exist in provisions (corpus_qa.sql check 20). */
  provisions: MapProvision[];
  /** The facets this map branches on, with the title to use when the question states one value. */
  facets?: Partial<Record<FacetName, { titles: Record<string, string> }>>;
  /**
   * A premise map (src/lib/premise-notes.ts): retrieval hits from this
   * permit go under "Permit applicability" beside its canonical rows
   * rather than under "General Permit options".
   */
  permitRegKey?: string;
};

/** The facet values a question states, per facet of the matched map: exactly one value, or the facet is absent. */
export type StatedFacets = Partial<Record<FacetName, FacetValue>>;

/**
 * The facet values the raw question states among the facets `map` carries.
 * A facet is stated when exactly one of its values matches (a question
 * naming both fuels states neither). Runs on the raw question: acronym
 * expansion adds "natural gas fired" after GP02 and "condensate" after
 * GP01, which the visitor never said.
 */
export function detectFacets(rawQuestion: string, map: QuestionMap | null): StatedFacets {
  const out: StatedFacets = {};
  if (!map?.facets) return out;
  for (const name of Object.keys(map.facets) as FacetName[]) {
    const matched = FACETS[name].values.filter((v) => v.patterns.some((p) => p.test(rawQuestion)));
    if (matched.length === 1) out[name] = matched[0];
  }
  return out;
}

/** Whether a canonical row applies under the stated facets (a row tagged with another value does not). */
export function rowMatchesFacets(row: MapProvision, stated: StatedFacets): boolean {
  for (const name of Object.keys(stated) as FacetName[]) {
    const tags = row.facets?.[name];
    const value = stated[name]?.value;
    if (tags && value && !tags.includes(value)) return false;
  }
  return true;
}

/** Whether a retrieval hit applies under the stated facets (a hit from a reg key another value owns does not). */
export function hitMatchesFacets(hit: Pick<GroupableHit, "reg_key">, stated: StatedFacets): boolean {
  const key = (hit.reg_key ?? "").toLowerCase();
  for (const name of Object.keys(stated) as FacetName[]) {
    const value = stated[name]?.value;
    for (const v of FACETS[name].values) {
      if (v.value !== value && v.regKeys.includes(key)) return false;
    }
  }
  return true;
}

/** The map's title for the stated facets ("Natural gas-fired engines"), or its name. */
export function mapTitle(map: QuestionMap, stated: StatedFacets): string {
  for (const name of Object.keys(stated) as FacetName[]) {
    const title = map.facets?.[name]?.titles[stated[name]!.value];
    if (title) return title;
  }
  return map.name;
}

/** One omitted line per stated facet: what was left out and why. */
export type OmittedLine = { facet: FacetName; said: string; omitted: string };

export function omittedLines(map: QuestionMap, stated: StatedFacets): OmittedLine[] {
  const out: OmittedLine[] = [];
  for (const name of Object.keys(stated) as FacetName[]) {
    if (!map.facets?.[name]) continue;
    const value = stated[name]!;
    const others = FACETS[name].values.filter((v) => v.value !== value.value).map((v) => v.omitted);
    out.push({ facet: name, said: value.said, omitted: others.join("; ") });
  }
  return out;
}

/**
 * One intro sentence with the provisions that support it (9 Oct 2026). Same
 * shape as a premise note's sentences: the page shows the ids as reader
 * links beside the sentence. A sentence that states a date, a threshold or
 * an applicability conclusion must carry at least one id
 * (scripts/question-maps.test.ts checks the rule and that every id is in
 * pipeline/out/corpus_ids.json).
 */
const s = (text: string, ...cites: string[]): IntroSentence => ({ text, cites });

/**
 * The four NSPS date windows, read from the subparts' own applicability
 * sections (pipeline/sources/OOOO*.txt) and cited to them; shared by the maps
 * that explain which subpart reaches a facility.
 */
const WINDOW_OOOO = s(
  "Subpart OOOO reaches affected facilities that commence construction, modification or reconstruction after August 23, 2011, and on or before September 18, 2015.",
  "sec-oooo-60.5360",
  "sec-oooo-60.5365"
);
const WINDOW_OOOOA = s(
  "Subpart OOOOa reaches those that commence construction, modification or reconstruction after September 18, 2015, and on or before December 6, 2022.",
  "sec-ooooa-60.5360a-(a)",
  "sec-ooooa-60.5365a"
);
const WINDOW_OOOOB = s(
  "Subpart OOOOb reaches those that commence construction, modification or reconstruction after December 6, 2022.",
  "sec-oooob-60.5365b"
);
const WINDOW_OOOOC = s(
  "Subpart OOOOc is the emission guideline for existing facilities: a state or Tribal plan must address designated facilities that commenced construction, modification or reconstruction on or before December 6, 2022.",
  "sec-ooooc-60.5375c-(a)-(1)"
);
const WINDOW_MODIFY = s(
  "An affected facility under Subpart OOOO or OOOOa that modifies or reconstructs after December 6, 2022 becomes subject to Subpart OOOOb.",
  "sec-oooo-60.5365",
  "sec-ooooa-60.5365a"
);

/**
 * Matched first-match-wins in this order. The equipment maps come before the
 * APEN map on purpose: "do I need an APEN for my tank battery" routes to
 * storage-tanks (which carries the APEN rows for tanks), not to the generic
 * APEN map. Batch 2 (2 Oct 2026) added storage-tanks, pneumatic-controllers,
 * dehydrators and apen; every id was verified against the production
 * database on 1 Oct 2026.
 *
 * Two corpus gaps the tanks and dehydrator maps expose, left open on purpose
 * (the corpus roadmap owns the import; do not paper over them with a
 * look-alike row): 40 CFR 63 Subpart HH (the oil and natural gas production
 * NESHAP: glycol dehydrators and storage vessels with flash emissions) is
 * not in the corpus, so the Federal NESHAP group of both maps is empty; and
 * 40 CFR 60 Subpart Kb exists only as Regulation 6's adoption stub
 * (sec-6-A-SUBPART-Kb), which the tanks map lists under Colorado standards.
 *
 * Batch 3 (2 Oct 2026) added combustion-devices, ldar and general-permits,
 * and GP01 to the tanks map; every id was verified against the production
 * database on 2 Oct 2026. The equipment maps stay ahead of the two generic
 * ones, and general-permits sits after the equipment maps on purpose: a
 * GP02 question keeps routing to engines and a GP08 question to tanks, while
 * general-permits catches GP03, GP11 and "which general permit…" questions.
 * One more corpus gap, left open the same way: Regulation 7 Part B's
 * definition sections have no "Enclosed combustion device" or "Flare" row a
 * title search finds, so the combustion-devices map's Definitions group
 * uses the "Air pollution control equipment" and "Approved instrument
 * monitoring method" definitions instead.
 *
 * Batch 4 (2 Oct 2026) added enforcement, the first map that reaches past
 * the air rules, with the "ECMC rules" and "Federal PHMSA" groups; every id
 * was verified against the production database on 2 Oct 2026. It sits after
 * the equipment maps and before general-permits and apen so that "what is
 * the penalty for not filing an APEN" lands here, not on the generic APEN
 * map, while "LDAR enforcement" stays on ldar. The triggers are the
 * enforcement vocabulary (penalty, NOAV, OFV, AOC, compliance advisory,
 * cease and desist, consent order); a bare "violation" does not route, so
 * the odor-dilution eval question keeps taking no map. One more corpus gap,
 * left open the same way: the corpus has no row for the APCD
 * compliance-advisory process or for the Air Act's penalty procedure (CRS
 * §§ 25-7-115 and 25-7-122 are statute, not AQCC rules), so the map's
 * Colorado group leans on Common Provisions III and Procedural Rules
 * VI.D.1. Left open for the corpus roadmap, not papered over with a
 * look-alike row.
 */
export const QUESTION_MAPS: QuestionMap[] = [
  {
    key: "engines",
    name: "Natural gas-fired and diesel engines",
    // Review 4, item 2 (7 Oct 2026): the map branches on fuel. A question
    // that says "natural gas" hides the diesel rows (GP06, Subpart IIII) and
    // vice versa; the omitted line names them.
    facets: { fuel: { titles: { "natural gas": "Natural gas-fired engines", diesel: "Diesel engines" } } },
    // Not "compressor" alone: a centrifugal / reciprocating compressor
    // question is a different map.
    triggers: [/\b(?:engines?|rice|gen-?sets?|generators?|reciprocating|jjjj|iiii|zzzz|gp\s?0?2|gp\s?0?6|gp\s?12|gp\s?0?9|gp\s?10)\b/i],
    factors: [
      s("The fuel splits the rules: GP02 covers natural gas-fired reciprocating internal combustion engines and GP06 diesel fuel-fired ones, and the federal NSPS split the same way, Subpart JJJJ for spark-ignition engines and Subpart IIII for compression-ignition engines.", "sec-gp02-I-A", "sec-gp06-I-A", "sec-jjjj-60.4230", "sec-iiii-60.4200"),
      s("Each NSPS turns on dates: Subpart JJJJ on the date the engine was manufactured, its maximum engine power and whether it is an emergency engine, and Subpart IIII on whether construction commenced after July 11, 2005, when the engine was manufactured, and whether it was modified or reconstructed after that date.", "sec-jjjj-60.4230", "sec-iiii-60.4200"),
      s("Subpart IIII sets separate standards for emergency engines, and Regulation 3's construction permit exemption for engines covers power portable drilling rigs, emergency power generators that operate no more than 250 hours per year, and engines with uncontrolled actual emissions under 5 tons per year or a site-rated horsepower under 50.", "sec-iiii-60.4205", "sec-3-B-II-D-1-c", "sec-3-B-II-D-1-c-(i)", "sec-3-B-II-D-1-c-(ii)", "sec-3-B-II-D-1-c-(iii)"),
      s("Subpart ZZZZ reaches a stationary reciprocating internal combustion engine at a major or area source of hazardous air pollutant emissions.", "sec-zzzz-63.6585"),
      s("In Colorado, Regulation 26 Part B sets control requirements for engines (Section I) and for stationary and portable combustion equipment in the 8-Hour Ozone Control Area (Section II), including a nitrogen oxides allowance for engines of 1,000 horsepower or more in the 8-Hour Ozone Control Area or Northern Weld County.", "sec-26-B-I", "sec-26-B-II", "sec-26-B-I-D-4-c"),
    ],
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-B", group: "Colorado permitting and APEN", why: "APEN filing: when a notice is required and the reporting thresholds" },
      { id: "sec-3-A-II-D-1", group: "Colorado permitting and APEN", why: "APEN exemptions — II.D.1.l exempts engines powering portable drilling rigs" },
      { id: "sec-3-B-II-A", group: "Colorado permitting and APEN", why: "Construction permit: general considerations" },
      { id: "sec-3-B-II-D-1-c", group: "Colorado permitting and APEN", why: "Construction-permit exemption for engines: drilling rigs, emergency generators ≤ 250 hr/yr, < 5 tpy uncontrolled or < 50 hp" },
      // General Permit options
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — oil and gas well production facilities; natural gas-fired (I.A.1) and diesel (I.A.2) engines; replaced GP09/GP10 for new applicants" },
      { id: "sec-gp02-I-A", group: "General Permit options", why: "GP02 — natural gas-fired RICE at an oil and gas stationary source", facets: { fuel: ["natural gas"] } },
      { id: "sec-gp06-I-A", group: "General Permit options", why: "GP06 — diesel fuel-fired reciprocating internal combustion engines", facets: { fuel: ["diesel"] } },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — closed to new registrations July 15, 2026; existing registrations remain active", facets: { fuel: ["natural gas"] } },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — closed to new registrations July 15, 2026; existing registrations remain active", facets: { fuel: ["natural gas"] } },
      // Colorado standards
      { id: "sec-26-B-I-D", group: "Colorado standards", why: "Reg 26 Part B I.D — natural gas-fired RICE: new, modified and relocated (I.D.3), existing (I.D.4), additional requirements (I.D.5, I.D.6)", facets: { fuel: ["natural gas"] } },
      { id: "sec-26-B-I", group: "Colorado standards", why: "Reg 26 Part B I — control technology requirements for new and existing engines (I.A, I.B) and their exemptions (I.C)" },
      { id: "sec-26-B-II", group: "Colorado standards", why: "Reg 26 Part B II — stationary and portable combustion equipment in the 8-hour Ozone Control Area or Northern Weld County" },
      // Federal NSPS. Regulation 26 cites Subpart JJJJ (Part B I.D.5.d, I.D.6.c,
      // III.A.1, III.B.1) and links to this document; the copy of JJJJ it used
      // to carry under Part C (sec-26-C-FEDJJJJ) was removed on 4 Oct 2026.
      { id: "sec-jjjj-top-REG-jjjj", group: "Federal NSPS", why: "40 CFR Part 60 Subpart JJJJ — the federal standard for spark-ignition engines that Regulation 26 incorporates by reference", facets: { fuel: ["natural gas"] } },
      { id: "sec-jjjj-60.4230", group: "Federal NSPS", why: "Subpart JJJJ applicability — spark-ignition (natural gas) engines, by manufacture date and horsepower", facets: { fuel: ["natural gas"] } },
      { id: "sec-jjjj-60.4233", group: "Federal NSPS", why: "Subpart JJJJ emission standards for owners and operators", facets: { fuel: ["natural gas"] } },
      { id: "sec-iiii-60.4200", group: "Federal NSPS", why: "Subpart IIII applicability — compression-ignition (diesel) engines", facets: { fuel: ["diesel"] } },
      { id: "sec-iiii-60.4204", group: "Federal NSPS", why: "Subpart IIII standards — non-emergency engines", facets: { fuel: ["diesel"] } },
      { id: "sec-iiii-60.4205", group: "Federal NSPS", why: "Subpart IIII standards — emergency engines", facets: { fuel: ["diesel"] } },
      // Federal NESHAP
      { id: "sec-zzzz-63.6585", group: "Federal NESHAP", why: "Subpart ZZZZ applicability — stationary RICE at major and area sources of HAP" },
      { id: "sec-zzzz-63.6590", group: "Federal NESHAP", why: "Subpart ZZZZ — which engines are covered and which are exempt or deferred" },
      { id: "sec-zzzz-63.6595", group: "Federal NESHAP", why: "Subpart ZZZZ compliance dates" },
      // Definitions
      { id: "sec-jjjj-60.4248", group: "Definitions", why: "Subpart JJJJ definitions (emergency engine, rich/lean burn, maximum engine power, …)", facets: { fuel: ["natural gas"] } },
      { id: "sec-3-A-I-B-36", group: "Definitions", why: "Regulation 3 definition of a non-road engine" },
    ],
  },
  {
    key: "storage-tanks",
    name: "Storage tanks and tank batteries",
    // Review 4, item 2 (7 Oct 2026): the map branches on what the tank
    // stores. GP01 and the condensate storage tank definition are
    // condensate-only, GP05 is produced water only, GP07 loads condensate
    // and crude oil; GP08, GP12 and the Regulation 7 and NSPS rows cover
    // every listed liquid and stay.
    facets: {
      contents: {
        titles: {
          condensate: "Condensate storage tanks and tank batteries",
          "crude oil": "Crude oil storage tanks",
          "produced water": "Produced water storage tanks and tank batteries",
        },
      },
    },
    // Not a bare "tank": a tank truck at a bulk plant is Regulation 24, not
    // this map. GP01 (condensate storage tank batteries) already routes here
    // through its acronym expansion, as GP02 routes to engines through its
    // own; since batch 3 it is also an explicit trigger.
    triggers: [
      /\b(?:storage (?:tanks?|vessels?)|tank batter(?:y|ies)|(?:condensate|produced[- ]water|crude[- ]oil|oil|hydrocarbon liquid) tanks?|thief hatch(?:es)?|gp\s?0?1|gp\s?0?5|gp\s?0?8|gp\s?0?7)\b/i,
    ],
    factors: [
      s("Regulation 7 Part B Section I.D.3.a requires storage tanks with uncontrolled actual VOC emissions of 4 tons per year or more, or 2 tons per year or more where the first test does not reach them, on a rolling twelve-month total, to be controlled to 95% efficiency.", "sec-7-B-I-D-3-a-(i)", "sec-7-B-I-D-3-a-(ii)"),
      s("Section II.C.1 sets control and monitoring requirements for storage tanks at oil and gas exploration and production operations, Class II disposal well facilities, well production facilities, natural gas compressor stations and natural gas processing plants.", "sec-7-B-II-C"),
      s("What the tank stores matters to the general permits: GP01 covers condensate storage tank batteries, GP05 produced water storage tank batteries, and GP08 oil and gas industry storage tanks.", "sec-gp01-I-A", "sec-gp05-I-A", "sec-gp08-I-B"),
      WINDOW_OOOO,
      WINDOW_OOOOA,
      WINDOW_OOOOB,
      WINDOW_OOOOC,
      WINDOW_MODIFY,
      s("Each subpart sets its own storage vessel test in paragraph (e) of its applicability section: a single vessel with a potential for VOC emissions of 6 tons per year or more under Subparts OOOO and OOOOa, a tank battery with a potential for VOC emissions of 6 tons per year or more or for methane emissions of 20 tons per year or more under Subpart OOOOb, and a tank battery with a potential for methane emissions of 20 tons per year or more under Subpart OOOOc.", "sec-oooo-60.5365-(e)", "sec-ooooa-60.5365a-(e)", "sec-oooob-60.5365b-(e)-(1)", "sec-ooooc-60.5386c-(e)-(1)"),
    ],
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "APENs are required for new, modified and existing sources unless exempt under II.D" },
      { id: "sec-3-A-II-B-3", group: "Colorado permitting and APEN", why: "APEN applicability: the uncontrolled actual emission thresholds" },
      { id: "sec-3-A-II-D-1-fff", group: "Colorado permitting and APEN", why: "APEN exemption for storage tanks under 400,000 gallons per year storing listed liquids" },
      { id: "sec-3-B-II-D", group: "Colorado permitting and APEN", why: "Construction permit exemptions — a permit exemption does not remove the APEN requirement" },
      // General Permit options
      { id: "sec-gp01-I-A", group: "General Permit options", why: "GP01 — condensate storage tank batteries", facets: { contents: ["condensate"] } },
      { id: "sec-gp08-I-B", group: "General Permit options", why: "GP08 — oil and gas industry storage tanks (condensate, crude oil, intermediate hydrocarbon liquids, produced water)" },
      { id: "sec-gp05-I-A", group: "General Permit options", why: "GP05 — produced water storage tank batteries", facets: { contents: ["produced water"] } },
      { id: "sec-gp12-I-A-3", group: "General Permit options", why: "GP12 — storage tanks at well production facilities, as one of the covered source types" },
      { id: "sec-gp07-I-A", group: "General Permit options", why: "GP07 — hydrocarbon liquid loadout from tanks", facets: { contents: ["condensate", "crude oil"] } },
      // Colorado standards
      { id: "sec-7-B-I-D", group: "Colorado standards", why: "Reg 7 Part B I.D — storage tank emission controls (I.D.3 control strategy)" },
      { id: "sec-7-B-I-E", group: "Colorado standards", why: "Reg 7 Part B I.E — monitoring of storage tanks and their air pollution control equipment" },
      { id: "sec-7-B-I-F", group: "Colorado standards", why: "Reg 7 Part B I.F — storage tank recordkeeping and reporting" },
      { id: "sec-7-B-II-C", group: "Colorado standards", why: "Reg 7 Part B II.C — storage tanks at E&P operations, well production facilities, disposal wells and compressor stations: controls and monitoring" },
      { id: "sec-6-A-SUBPART-Kb", group: "Colorado standards", why: "NSPS Subpart Kb (volatile organic liquid storage vessels) as adopted by Regulation 6" },
      // Federal NSPS
      { id: "sec-oooob-60.5365b-(e)", group: "Federal NSPS", why: "OOOOb applicability — storage vessel affected facility (tank battery potential-to-emit test)" },
      { id: "sec-oooob-60.5395b", group: "Federal NSPS", why: "OOOOb — GHG and VOC standards for storage vessel affected facilities" },
      { id: "sec-ooooa-60.5365a-(e)", group: "Federal NSPS", why: "OOOOa applicability — storage vessel affected facility (built Sept 18, 2015 – Dec 6, 2022)" },
      { id: "sec-ooooa-60.5395a", group: "Federal NSPS", why: "OOOOa — VOC standards for storage vessel affected facilities" },
      { id: "sec-oooo-60.5365-(e)", group: "Federal NSPS", why: "OOOO applicability — storage vessel affected facility (built Aug 23, 2011 – Sept 18, 2015)" },
      { id: "sec-oooo-60.5395", group: "Federal NSPS", why: "OOOO — VOC standards for storage vessel affected facilities" },
      { id: "sec-ooooc-60.5386c-(e)", group: "Federal NSPS", why: "OOOOc applicability — storage vessel designated facility (existing tank batteries)" },
      { id: "sec-ooooc-60.5396c", group: "Federal NSPS", why: "OOOOc — GHG standards for storage vessel designated facilities" },
      // Federal NESHAP: none. 40 CFR 63 Subpart HH is not in the corpus (see the note above QUESTION_MAPS).
      // Definitions
      { id: "sec-7-B-I-B-30", group: "Definitions", why: "Reg 7 Part B I.B — 'Storage tank'" },
      { id: "sec-7-B-I-B-9", group: "Definitions", why: "Reg 7 Part B I.B — 'Condensate storage tank'", facets: { contents: ["condensate"] } },
      { id: "sec-7-B-II-A-43", group: "Definitions", why: "Reg 7 Part B II.A — 'Storage tank' (Section II)" },
      { id: "sec-7-B-I-B-34", group: "Definitions", why: "Reg 7 Part B I.B — 'Well production facility'" },
      { id: "sec-oooob-60.5430b", group: "Definitions", why: "OOOOb definitions (storage vessel, tank battery, potential for VOC emissions)" },
      { id: "sec-oooo-60.5430", group: "Definitions", why: "OOOO definitions (storage vessel, the original subpart)" },
    ],
  },
  {
    key: "pneumatic-controllers",
    name: "Pneumatic controllers and pneumatic pumps",
    triggers: [
      /\b(?:pneumatic (?:controllers?|devices?|pumps?)|process controllers?|(?:high|low|no|zero)[- ]bleed|natural gas[- ](?:driven|actuated) controllers?|intermittent (?:vent )?controllers?)\b/i,
    ],
    factors: [
      s("Regulation 7 Part B Section III applies to pneumatic controllers that are actuated by natural gas and located at, or upstream of, natural gas processing plants.", "sec-7-B-III-A"),
      s("Its requirements for continuous bleed, natural gas-driven controllers turn on where the controller sits and when it was placed in service: in the 8-Hour Ozone Control Area a controller placed in service on or after February 1, 2009 must emit no more than a low-bleed controller, and in northern Weld County the same holds for one placed in service on or after February 14, 2023.", "sec-7-B-III-C-1-a", "sec-7-B-III-C-1-c"),
      s("Well production facilities that commence operations on or after February 14, 2023, and natural gas compressor stations that commence operations or increase compression horsepower on or after that date, must use only non-emitting controllers, except as Section III.C.1.e.(iv) provides.", "sec-7-B-III-C-1-e", "sec-7-B-III-C-1-e-(i)", "sec-7-B-III-C-1-e-(iii)", "sec-7-B-III-C-1-e-(iv)"),
      WINDOW_OOOO,
      WINDOW_OOOOA,
      WINDOW_OOOOB,
      WINDOW_OOOOC,
      s("The affected facility differs by subpart: under Subpart OOOO a single continuous bleed natural gas-driven controller operating at a bleed rate greater than 6 standard cubic feet per hour, under Subparts OOOOa and OOOOb a pneumatic or process controller affected facility, and under Subpart OOOOc the collection of natural gas-driven process controllers at a well site, centralized production facility, onshore natural gas processing plant or compressor station.", "sec-oooo-60.5365-(d)", "sec-ooooa-60.5365a-(d)", "sec-oooob-60.5365b-(d)", "sec-ooooc-60.5386c-(d)"),
    ],
    provisions: [
      // Colorado standards
      { id: "sec-7-B-III", group: "Colorado standards", why: "Reg 7 Part B III — natural gas-actuated pneumatic controllers and pumps (the section)" },
      { id: "sec-7-B-III-A", group: "Colorado standards", why: "Reg 7 Part B III.A — applicability" },
      { id: "sec-7-B-III-C", group: "Colorado standards", why: "Reg 7 Part B III.C — controller requirements (no-bleed, low-bleed, retrofit schedules)" },
      { id: "sec-7-B-III-D", group: "Colorado standards", why: "Reg 7 Part B III.D — monitoring" },
      { id: "sec-7-B-III-F", group: "Colorado standards", why: "Reg 7 Part B III.F — (State Only) inspection and enhanced response" },
      { id: "sec-7-B-I-K", group: "Colorado standards", why: "Reg 7 Part B I.K — pneumatic pumps" },
      // Federal NSPS
      { id: "sec-oooob-60.5365b-(d)", group: "Federal NSPS", why: "OOOOb applicability — process controller affected facility" },
      { id: "sec-oooob-60.5390b", group: "Federal NSPS", why: "OOOOb — GHG and VOC standards for process controllers (zero emissions; Alaska exception)" },
      { id: "sec-oooob-60.5393b", group: "Federal NSPS", why: "OOOOb — standards for pump affected facilities" },
      { id: "sec-ooooa-60.5365a-(d)", group: "Federal NSPS", why: "OOOOa applicability — pneumatic controller affected facility" },
      { id: "sec-ooooa-60.5390a", group: "Federal NSPS", why: "OOOOa — GHG and VOC standards for pneumatic controllers (bleed-rate limits)" },
      { id: "sec-oooo-60.5365-(d)", group: "Federal NSPS", why: "OOOO applicability — pneumatic controller affected facility (built Aug 23, 2011 – Sept 18, 2015)" },
      { id: "sec-oooo-60.5390", group: "Federal NSPS", why: "OOOO — VOC standards for pneumatic controller affected facilities (bleed-rate limits)" },
      { id: "sec-ooooc-60.5386c-(d)", group: "Federal NSPS", why: "OOOOc applicability — process controller designated facility (existing)" },
      { id: "sec-ooooc-60.5394c", group: "Federal NSPS", why: "OOOOc — GHG standards for process controller designated facilities" },
      // Definitions
      { id: "sec-7-B-III-B-17", group: "Definitions", why: "Reg 7 Part B III.B — 'Pneumatic controller'" },
      { id: "sec-7-B-III-B-9", group: "Definitions", why: "Reg 7 Part B III.B — 'High-bleed pneumatic controller'" },
      { id: "sec-7-B-III-B-11", group: "Definitions", why: "Reg 7 Part B III.B — 'Low-bleed pneumatic controller'" },
      { id: "sec-7-B-III-B-10", group: "Definitions", why: "Reg 7 Part B III.B — 'Intermittent pneumatic controller'" },
      { id: "sec-7-B-III-B-14", group: "Definitions", why: "Reg 7 Part B III.B — 'No-bleed pneumatic controller'" },
      { id: "sec-7-B-III-B-12", group: "Definitions", why: "Reg 7 Part B III.B — 'Natural gas-driven pneumatic controller' (Colorado 111(d) plan)" },
    ],
  },
  {
    key: "dehydrators",
    name: "Glycol natural gas dehydrators",
    triggers: [/\b(?:dehydrators?|dehy|glycol|still vents?|reboilers?)\b/i],
    factors: [
      s("Regulation 7 Part B Section I.H requires still vents and flash tank vents on a glycol natural gas dehydrator in the 8-Hour Ozone Control Area to reduce uncontrolled actual VOC emissions by at least 90 percent, where the dehydrator's actual uncontrolled VOC emissions are 1 ton per year or more and the sum for a single dehydrator or grouping at a stationary source is 15 tons per year or more.", "sec-7-B-I-H-1", "sec-7-B-I-H-3", "sec-7-B-I-H-3-a", "sec-7-B-I-H-3-b"),
      s("In northern Weld County, beginning February 14, 2023, a dehydrator constructed on or after that date with uncontrolled actual VOC emissions of 2 tons per year or more must reduce them by at least 95 percent.", "sec-7-B-I-H-4", "sec-7-B-I-H-4-a"),
      s("Section II.D is a State Only provision with a similar test of 2 tons per year for a single dehydrator and 15 tons per year in total, and from May 1, 2015 a 95 percent reduction for a dehydrator constructed on or after that date with uncontrolled actual VOC emissions of 2 tons per year or more.", "sec-7-B-II-D-1", "sec-7-B-II-D-2", "sec-7-B-II-D-3", "sec-7-B-II-D-4", "sec-7-B-II-D-4-a"),
      s("Section II.D.3 also turns on whether a building unit or designated outside activity area is located within 1,320 feet of the facility.", "sec-7-B-II-D-3", "sec-7-B-II-D-3-b"),
      s("40 CFR 63 Subpart HH is not in this corpus, so this map has no federal NESHAP group."),
    ],
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "APENs are required for new, modified and existing sources unless exempt under II.D" },
      { id: "sec-3-A-II-B-3", group: "Colorado permitting and APEN", why: "APEN applicability: the uncontrolled actual emission thresholds" },
      // Colorado standards
      { id: "sec-7-B-I-H", group: "Colorado standards", why: "Reg 7 Part B I.H — emission reductions from glycol natural gas dehydrators (statewide)" },
      { id: "sec-7-B-I-H-1", group: "Colorado standards", why: "Reg 7 Part B I.H.1 — still vent and flash tank control requirement since May 1, 2005" },
      { id: "sec-7-B-I-H-3", group: "Colorado standards", why: "Reg 7 Part B I.H.3 — the thresholds and locations where I.H.1 and I.H.2 apply" },
      { id: "sec-7-B-II-D", group: "Colorado standards", why: "Reg 7 Part B II.D — (State Only) dehydrator controls in the ozone nonattainment area" },
      { id: "sec-7-B-II-D-2", group: "Colorado standards", why: "Reg 7 Part B II.D.2 — where the II.D.1 control requirement applies" },
      { id: "sec-7-B-II-D-3", group: "Colorado standards", why: "Reg 7 Part B II.D.3 — control requirement since May 1, 2015" },
      // Federal NESHAP: none. 40 CFR 63 Subpart HH is not in the corpus (see the note above QUESTION_MAPS).
      // Definitions
      { id: "sec-7-B-I-B-17", group: "Definitions", why: "Reg 7 Part B I.B — 'Glycol natural gas dehydrator'" },
      { id: "sec-7-B-II-A-16", group: "Definitions", why: "Reg 7 Part B II.A — 'Glycol natural gas dehydrator' (Section II)" },
    ],
  },
  {
    key: "combustion-devices",
    name: "Flares and enclosed combustion devices",
    // After the equipment maps: "flare on my tank battery" is a tanks question
    // that happens to name its control device.
    triggers: [
      /\b(?:flares?|flaring|enclosed combustion devices?|ecds?|combustors?|vapor combust(?:ors?|ion)|thermal oxidi[sz]ers?|control devices?|destruction efficiency|auto-?igniters?)\b/i,
    ],
    factors: [
      s("Regulation 7 Part B Section I.C.1 requires a flare or other combustion device that controls VOC emissions to comply with Sections I.D., I.J. and I.K. to be enclosed, have no visible emissions and be designed so that an observer can tell whether it is operating properly, and to be equipped with and operate an auto-igniter.", "sec-7-B-I-C-1-d", "sec-7-B-I-C-1-e"),
      s("Beginning February 14, 2022, performance tests are required for each enclosed combustion device that Regulation 7 Part B requires to achieve at least 95% control efficiency for hydrocarbons.", "sec-7-B-II-B-2-h"),
      s("The destruction efficiency depends on the rule that sends the emissions to the device: a combustion device used for storage tank emissions under Section I.D.3.a must have a design destruction efficiency of at least 98% for VOC, and one used for a dehydrator under Section II.D.3 at least 98% for hydrocarbons.", "sec-7-B-I-D-3-a", "sec-7-B-II-D-3"),
      s("Federally, each NSPS subpart carries its own control device requirements, in Sections 60.5412 (OOOO), 60.5412a (OOOOa), 60.5412b (OOOOb) and 60.5412c (OOOOc), and which one applies follows the subpart that covers the controlled affected facility.", "sec-oooo-60.5412", "sec-ooooa-60.5412a", "sec-oooob-60.5412b", "sec-ooooc-60.5412c"),
      WINDOW_OOOO,
      WINDOW_OOOOA,
      WINDOW_OOOOB,
      WINDOW_OOOOC,
    ],
    provisions: [
      // Colorado standards
      { id: "sec-7-B-II-B-1", group: "Colorado standards", why: "Reg 7 Part B II.B.1 — good air pollution control practices and prevention of emissions" },
      { id: "sec-7-B-II-B-2", group: "Colorado standards", why: "Reg 7 Part B II.B.2 — general requirements for air pollution control equipment used to comply with Section II" },
      { id: "sec-7-B-II-B-2-h", group: "Colorado standards", why: "Reg 7 Part B II.B.2.h — performance tests for enclosed combustion devices (since February 14, 2022)" },
      { id: "sec-7-B-I-C-1", group: "Colorado standards", why: "Reg 7 Part B I.C.1 — general requirements for Section I control equipment" },
      { id: "sec-7-B-I-E-2", group: "Colorado standards", why: "Reg 7 Part B I.E.2 — monitoring requirements for storage-tank control equipment" },
      { id: "sec-7-B-I-E-3", group: "Colorado standards", why: "Reg 7 Part B I.E.3 — performance testing requirements" },
      // Federal NSPS
      { id: "sec-oooob-60.5412b", group: "Federal NSPS", why: "OOOOb — control device requirements for initial compliance (destruction efficiency, design)" },
      { id: "sec-oooob-60.5413b", group: "Federal NSPS", why: "OOOOb — performance testing procedures for control devices" },
      { id: "sec-oooob-60.5417b", group: "Federal NSPS", why: "OOOOb — continuous monitoring requirements for control devices" },
      { id: "sec-ooooa-60.5412a", group: "Federal NSPS", why: "OOOOa — control device requirements for initial compliance" },
      { id: "sec-ooooa-60.5413a", group: "Federal NSPS", why: "OOOOa — performance testing procedures for control devices" },
      { id: "sec-oooo-60.5412", group: "Federal NSPS", why: "OOOO — control device requirements for initial compliance (the original subpart)" },
      { id: "sec-oooo-60.5413", group: "Federal NSPS", why: "OOOO — performance testing procedures for control devices" },
      { id: "sec-ooooc-60.5412c", group: "Federal NSPS", why: "OOOOc — control device requirements for existing designated facilities" },
      // Definitions: no "Enclosed combustion device" or "Flare" row in Reg 7 Part B's
      // definition sections (see the note above QUESTION_MAPS).
      { id: "sec-7-B-II-A-1", group: "Definitions", why: "Reg 7 Part B II.A — 'Air pollution control equipment' (combustion devices, VRUs)" },
      { id: "sec-7-B-II-A-2", group: "Definitions", why: "Reg 7 Part B II.A — 'Approved instrument monitoring method'" },
    ],
  },
  {
    key: "ldar",
    name: "Leak detection and repair at well production facilities and compressor stations",
    triggers: [
      /\b(?:ldar|leak detection|leak inspections?|leak surveys?|fugitive emissions?|fugitives|avo|audio,? visual|ogi|infra-?red camera|ir camera|method 21|component inspections?|compressor stations?)\b/i,
    ],
    factors: [
      s("Regulation 7 Part B Section II.E is a State Only leak detection and repair program for well production facilities and natural gas compressor stations that uses an approved instrument monitoring method: an infra-red camera, EPA Method 21 or another method the Division approves.", "sec-7-B-II-E", "sec-7-B-I-B-3", "sec-7-B-II-A-2"),
      s("For a well production facility the first inspection depends on whether it was constructed on or after October 15, 2014 or before it.", "sec-7-B-II-E-4-a", "sec-7-B-II-E-4-b"),
      s("The inspection frequency turns on the facility's estimated uncontrolled actual VOC emissions, for example at least semi-annually for 2 to 12 tons per year beginning calendar year 2020, and on whether it is within 1,000 feet of an occupied area.", "sec-7-B-II-E-4-c", "sec-7-B-II-E-4-d"),
      s("Federally, Subparts OOOOa and OOOOb each cover the collection of fugitive emissions components at a well site and Subpart OOOOc a fugitive emissions components designated facility.", "sec-ooooa-60.5365a-(i)", "sec-oooob-60.5365b-(i)", "sec-ooooc-60.5386c-(h)"),
      WINDOW_OOOOA,
      WINDOW_OOOOB,
      WINDOW_OOOOC,
      s("The original Subpart OOOO has no fugitive emissions components standard; its equipment leak standards in Section 60.5400 reach equipment at an onshore natural gas processing plant.", "sec-oooo-60.5365-(f)", "sec-oooo-60.5365-(f)-(2)", "sec-oooo-60.5400"),
    ],
    provisions: [
      // General Permit options
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — well production facilities (replaced GP09/GP10 for new applicants)" },
      { id: "sec-gp11-I-A", group: "General Permit options", why: "GP11 — routine or predictable gas venting at well production and centralized production facilities" },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — well production facilities, attainment areas; closed to new registrations July 15, 2026" },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — well production facilities, nonattainment areas; closed to new registrations July 15, 2026" },
      // Colorado standards
      { id: "sec-7-B-I-L", group: "Colorado standards", why: "Reg 7 Part B I.L — statewide leak detection and repair program for well production facilities and compressor stations" },
      { id: "sec-7-B-I-L-2", group: "Colorado standards", why: "Reg 7 Part B I.L.2 — well production facilities" },
      { id: "sec-7-B-I-L-1", group: "Colorado standards", why: "Reg 7 Part B I.L.1 — natural gas compressor stations" },
      { id: "sec-7-B-I-L-4", group: "Colorado standards", why: "Reg 7 Part B I.L.4 — leaks requiring repair" },
      { id: "sec-7-B-II-E", group: "Colorado standards", why: "Reg 7 Part B II.E — (State Only) LDAR program" },
      { id: "sec-7-B-II-E-4", group: "Colorado standards", why: "Reg 7 Part B II.E.4 — well production facility requirements: inspection frequency by emissions tier" },
      { id: "sec-7-B-II-E-6", group: "Colorado standards", why: "Reg 7 Part B II.E.6 — leaks requiring repair and the approved methods" },
      { id: "sec-7-B-II-F", group: "Colorado standards", why: "Reg 7 Part B II.F — well operation and maintenance at well production facilities" },
      { id: "sec-7-B-II-G", group: "Colorado standards", why: "Reg 7 Part B II.G — (State Only) downhole maintenance and liquids unloading" },
      // Federal NSPS
      { id: "sec-oooob-60.5365b-(i)", group: "Federal NSPS", why: "OOOOb applicability — fugitive emissions components affected facility" },
      { id: "sec-oooob-60.5397b", group: "Federal NSPS", why: "OOOOb — fugitive emissions standards (monitoring frequency, repair)" },
      { id: "sec-oooob-60.5398b", group: "Federal NSPS", why: "OOOOb — alternative fugitive emissions standards (advanced methods)" },
      { id: "sec-ooooa-60.5365a-(i)", group: "Federal NSPS", why: "OOOOa applicability — collection of fugitive emissions components" },
      { id: "sec-ooooa-60.5397a", group: "Federal NSPS", why: "OOOOa — fugitive emissions standards" },
      { id: "sec-ooooc-60.5386c-(h)", group: "Federal NSPS", why: "OOOOc applicability — fugitive emissions components designated facility (existing)" },
      { id: "sec-ooooc-60.5397c", group: "Federal NSPS", why: "OOOOc — fugitive emissions standards for designated facilities" },
      // Definitions
      { id: "sec-7-B-I-B-34", group: "Definitions", why: "Reg 7 Part B I.B — 'Well production facility'" },
      { id: "sec-7-B-I-B-21", group: "Definitions", why: "Reg 7 Part B I.B — 'Natural gas compressor station'" },
      { id: "sec-7-B-I-B-3", group: "Definitions", why: "Reg 7 Part B I.B — 'Approved instrument monitoring method'" },
      { id: "sec-7-B-II-A-10", group: "Definitions", why: "Reg 7 Part B II.A — 'Component'" },
      { id: "sec-3-A-I-B-56", group: "Definitions", why: "Regulation 3 — 'Well production facility'" },
    ],
  },
  {
    key: "enforcement",
    name: "Enforcement and penalties: APCD, ECMC and PHMSA",
    // After the equipment maps (an "LDAR enforcement" question stays on
    // ldar) and before general-permits and apen ("the penalty for not filing
    // an APEN" is an enforcement question). No bare "violation": an odor
    // violation measured in dilutions is a Regulation 2 question, not this.
    triggers: [
      /\b(?:civil penalt(?:y|ies)|penalt(?:y|ies)|noavs?|notices? of (?:alleged|probable) violation|enforcement(?: actions?| matters?| proceedings?)?|compliance advisor(?:y|ies)|orders? finding violation|ofvs?|cease[- ]and[- ]desist|consent orders?|administrative orders? on consent|aocs?)\b/i,
    ],
    factors: [
      s("For a violation of an AQCC regulation, the SIP or an APCD permit, Common Provisions III provides for a civil penalty per day of violation up to a maximum that the Commission adjusts annually by the Consumer Price Index.", "sec-cp-III-A", "sec-cp-III-B-1", "sec-cp-III-B-3"),
      s("The Division has the burden of proof in proceedings regarding alleged violations of the Act.", "sec-proc-A-VI-D-1"),
      s("For an ECMC rule, order or permit, the Director may begin an enforcement action with a notice of alleged violation (Rule 523.a), and Rule 525.c calculates the base penalty from the Penalty Schedule by rule class (Class 1, 2 or 3) and the degree of actual or threatened adverse impact, with a maximum of $15,000 per day per violation, after the days of violation (Rule 525.b) and voluntary disclosure (Rule 525.e) are considered.", "sec-ecmc-523-a", "sec-ecmc-525-b", "sec-ecmc-525-c", "sec-ecmc-525-e"),
      s("For a PHMSA pipeline-safety regulation, 49 CFR Part 190 Subpart B begins with a notice of probable violation (Section 190.207), gives the respondent 30 days to answer it in the ways Section 190.208 lists, and sets the maximum penalties (Section 190.223) and the assessment considerations (Section 190.225).", "sec-p190-190.207", "sec-p190-190.208", "sec-p190-190.223", "sec-p190-190.225"),
    ],
    provisions: [
      // General Permit options
      { id: "sec-gp12-XI-C-8", group: "General Permit options", why: "GP12 General Terms — violating a permit condition, the Act or an AQCC regulation can bring administrative, civil or criminal enforcement" },
      { id: "sec-gp01-VIII-C-8", group: "General Permit options", why: "GP01 General Terms — the same enforcement clause every general permit carries" },
      // Colorado standards (AQCC Common Provisions and Procedural Rules)
      { id: "sec-cp-III", group: "Colorado standards", why: "Common Provisions III — (State Only) Civil Penalties" },
      { id: "sec-cp-III-A", group: "Colorado standards", why: "Common Provisions III.A — who is liable and the civil penalty per day of violation (CRS § 25-7-122)" },
      { id: "sec-cp-III-B-1", group: "Colorado standards", why: "Common Provisions III.B.1 — the maximum is adjusted annually by the CPI" },
      { id: "sec-cp-III-B-3", group: "Colorado standards", why: "Common Provisions III.B.3 — the current maximum per day of violation" },
      { id: "sec-proc-A-VI-D-1", group: "Colorado standards", why: "AQCC Procedural Rules VI.D.1 — the Division has the burden of proof in enforcement adjudications" },
      // ECMC rules
      { id: "sec-ecmc-523-a", group: "ECMC rules", why: "Rule 523.a — the Director's Notice of Alleged Violation (NOAV)" },
      { id: "sec-ecmc-523-c", group: "ECMC rules", why: "Rule 523.c — when the Director seeks penalties: the enforcement action" },
      { id: "sec-ecmc-525-a", group: "ECMC rules", why: "Rule 525.a — the Commission's authority to impose penalties and other remedies" },
      { id: "sec-ecmc-525-b", group: "ECMC rules", why: "Rule 525.b — days of violation and continuing violations" },
      { id: "sec-ecmc-525-c", group: "ECMC rules", why: "Rule 525.c — the Penalty Schedule: rule class × degree of harm" },
      { id: "sec-ecmc-525-e", group: "ECMC rules", why: "Rule 525.e — voluntary disclosure" },
      { id: "sec-ecmc-525-g", group: "ECMC rules", why: "Rule 525.g — paying the penalty (30 days, certified funds)" },
      // Federal PHMSA
      { id: "sec-p190-190.207", group: "Federal PHMSA", why: "49 CFR § 190.207 — notice of probable violation" },
      { id: "sec-p190-190.208", group: "Federal PHMSA", why: "49 CFR § 190.208 — the operator's response options" },
      { id: "sec-p190-190.221", group: "Federal PHMSA", why: "49 CFR § 190.221 — civil penalties generally" },
      { id: "sec-p190-190.223", group: "Federal PHMSA", why: "49 CFR § 190.223 — maximum penalties" },
      { id: "sec-p190-190.225", group: "Federal PHMSA", why: "49 CFR § 190.225 — assessment considerations" },
      { id: "sec-p196-196.205", group: "Federal PHMSA", why: "49 CFR § 196.205 — administrative civil penalties for excavation-damage violations" },
      { id: "sec-p196-196.207", group: "Federal PHMSA", why: "49 CFR § 196.207 — the maximum administrative civil penalties under Part 196" },
    ],
  },
  {
    key: "general-permits",
    name: "APCD general permits: which one fits",
    // After the equipment maps on purpose: a GP02 question keeps routing to
    // engines and a GP08 question to tanks; this map catches GP03, GP11 and
    // "which general permit…" questions. The gp\d\d catch-all is reached only
    // when no earlier map claimed the number.
    triggers: [/\b(?:general permits?|which (?:gp|general permit)|gp\s?0?1|gp\s?0?3|gp\s?11|gp\s?\d\d|register(?:ing|ed)? under)\b/i],
    factors: [
      s("Which general permit fits starts with the equipment: GP01 covers condensate storage tank batteries, GP05 produced water storage tank batteries, GP08 oil and gas industry storage tanks, GP02 natural gas-fired and GP06 diesel fuel-fired reciprocating internal combustion engines, GP07 hydrocarbon liquid loadout, GP11 routine or predictable gas venting, GP12 well production facilities, and GP03 land development.", "sec-gp01-I-A", "sec-gp05-I-A", "sec-gp08-I-B", "sec-gp02-I-A", "sec-gp06-I-A", "sec-gp07-I-A", "sec-gp11-I-A", "sec-gp12-I-A", "sec-gp03-I-A"),
      s("A facility may register only if it can comply with every condition of the permit.", "sec-gp12-I-B", "sec-gp08-I-B"),
      s("The permits are open only to equipment at a true minor or synthetic minor source: GP12 applies only to a source that is a true minor or synthetic minor source for the Operating Permit, NSR, PSD and MACT programs.", "sec-gp12-I-E", "sec-gp02-I-A-1", "sec-gp06-I-A-1"),
      s("GP09 applies only to well production facilities located in an attainment area for all criteria pollutants or in a marginal or moderate non-attainment area.", "sec-gp09-I-D"),
      s("GP09 and GP10 closed to new registrations on July 15, 2026, and GP12 replaced them for new applicants.", "sec-gp09-top-REG-gp09", "sec-gp10-top-REG-gp10", "sec-gp12-I-A"),
    ],
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-B-II-A", group: "Colorado permitting and APEN", why: "Regulation 3 Part B II.A — construction permits: general considerations (a general permit is one route to one)" },
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "Regulation 3 Part A II.A — an APEN is still required under a general permit" },
      // General Permit options
      { id: "sec-gp01-I-A", group: "General Permit options", why: "GP01 — condensate storage tank batteries" },
      { id: "sec-gp05-I-A", group: "General Permit options", why: "GP05 — produced water storage tank batteries" },
      { id: "sec-gp08-I-B", group: "General Permit options", why: "GP08 — storage tanks (condensate, crude oil, intermediate hydrocarbon liquids, produced water)" },
      { id: "sec-gp02-I-A", group: "General Permit options", why: "GP02 — natural gas-fired reciprocating internal combustion engines" },
      { id: "sec-gp06-I-A", group: "General Permit options", why: "GP06 — diesel fuel-fired reciprocating internal combustion engines" },
      { id: "sec-gp07-I-A", group: "General Permit options", why: "GP07 — hydrocarbon liquid loadout" },
      { id: "sec-gp11-I-A", group: "General Permit options", why: "GP11 — routine or predictable gas venting emissions" },
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — well production facilities (natural gas and diesel engines, tanks, loading, separator venting)" },
      { id: "sec-gp12-I-B", group: "General Permit options", why: "GP12 — who may register: a well production facility that can comply with every condition" },
      { id: "sec-gp03-I-A", group: "General Permit options", why: "GP03 — land development projects (land clearing such as excavating or grading; fugitive dust control)" },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — well production facilities, attainment areas; closed to new registrations July 15, 2026" },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — well production facilities, nonattainment areas; closed to new registrations July 15, 2026" },
    ],
  },
  {
    key: "apen",
    name: "APEN filing: when a notice is required",
    // Last on purpose: an APEN question that names equipment with a map of
    // its own (a tank battery, an engine) routes to that map first.
    triggers: [/\b(?:apens?|air pollutant emission notices?|emission notices?)\b/i],
    factors: [
      s("An Air Pollutant Emission Notice is required for the emissions of a stationary source unless the source is exempt under Regulation 3 Part A Section II.D.", "sec-3-A-II-A-1"),
      s("For criteria pollutants it is required for each individual emission point with uncontrolled actual emissions of 1 ton per year or more of a pollutant for which the area is nonattainment, or 2 tons per year or more in an attainment or attainment/maintenance area, and for lead above 100 pounds per year wherever the source is located.", "sec-3-A-II-B-3", "sec-3-A-II-B-3-a"),
      s("An APEN is valid for no more than five years.", "sec-3-A-II-B-2"),
      s("A revised APEN is required, among other triggers, annually when a significant change in annual actual emissions occurs, when new control equipment is installed and before the APEN expires.", "sec-3-A-II-C-1", "sec-3-A-II-C-2"),
      s("Section II.D.1 lists the emission units exempt from the APEN requirement, and a construction permit exemption under Part B Section II.D is a separate list that does not affect the applicability of other regulations.", "sec-3-A-II-D-1", "sec-3-B-II-D"),
    ],
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-A", group: "Colorado permitting and APEN", why: "APENs for new, modified and existing sources — the basic requirement (II.A.1)" },
      { id: "sec-3-A-II-B-3", group: "Colorado permitting and APEN", why: "APEN applicability — the uncontrolled actual emission thresholds" },
      { id: "sec-3-A-II-B-1", group: "Colorado permitting and APEN", why: "What the APEN must include — the annual actual emission estimate" },
      { id: "sec-3-A-II-B-2", group: "Colorado permitting and APEN", why: "APEN term — valid for no more than five years" },
      { id: "sec-3-A-II-B-4", group: "Colorado permitting and APEN", why: "Source grouping on one APEN" },
      { id: "sec-3-A-II-C", group: "Colorado permitting and APEN", why: "Revised APENs — when a change requires a new filing" },
      { id: "sec-3-A-II-D", group: "Colorado permitting and APEN", why: "Exemptions from APEN requirements" },
      { id: "sec-3-A-II-D-1", group: "Colorado permitting and APEN", why: "The list of exempt emission units (II.D.1.a – II.D.1.dddd)" },
      { id: "sec-3-A-II-D-3", group: "Colorado permitting and APEN", why: "Emergency and backup generators still need an APEN" },
      { id: "sec-3-B-II-D", group: "Colorado permitting and APEN", why: "Construction permit exemptions — separate from APEN exemptions" },
      { id: "sec-3-B-II-D-2", group: "Colorado permitting and APEN", why: "Facility-wide permit exemption thresholds in nonattainment areas" },
      { id: "sec-3-B-II-D-3", group: "Colorado permitting and APEN", why: "Facility-wide permit exemption thresholds in attainment / maintenance areas" },
      // Definitions
      { id: "sec-3-A-I-B-55", group: "Definitions", why: "Regulation 3 — 'Uncontrolled actual emissions'" },
      { id: "sec-3-A-I-B-56", group: "Definitions", why: "Regulation 3 — 'Well production facility'" },
      { id: "sec-3-A-I-B-15", group: "Definitions", why: "Regulation 3 — 'Commencement of operation'" },
    ],
  },
];

/**
 * The first map whose trigger matches the acronym-expanded question, or
 * null. Expands acronyms itself (so "GP02 limits" routes on the spelled-out
 * "reciprocating internal combustion engines"); passing an already-expanded
 * string is harmless, expansion only adds words.
 *
 * A premise note (src/lib/premise-notes.ts) is consulted first: "When is a
 * GP01 required?" takes the GP01 premise map, not the storage-tank map.
 */
export function matchQuestionMap(question: string): QuestionMap | null {
  const note = matchPremiseNote(question);
  if (note) return note.map;
  const expanded = expandAcronyms(question);
  for (const map of QUESTION_MAPS) {
    if (map.triggers.some((t) => t.test(expanded))) return map;
  }
  return null;
}

/** The premise note behind a matched map, or null for an ordinary map. */
export function premiseNoteOf(map: QuestionMap | null): PremiseNote | null {
  return premiseNoteForMapKey(map?.key);
}

export { matchPremiseNote };
export type { PremiseNote };

/** The fields of a hit groupForHit() reads (a subset of SemanticHit). */
export type GroupableHit = {
  id: string;
  reg_key: string | null;
  jurisdiction_level: string;
  path?: string | null;
  title: string;
};

const DEFINITIONS_PATH = /\bdefinitions?\b/i;
const DEFINITIONS_TITLE = /what definitions apply/i;

/**
 * The group for a retrieval hit that is not one of the map's canonical rows,
 * or "Other". Tested in this order:
 *   1. a path or title under a Definitions heading, or a "What definitions
 *      apply" section (the same tests the ranking SQL uses) → Definitions;
 *   2. a general permit (reg_key gp..) → General Permit options;
 *   3. Regulation 3 → Colorado permitting and APEN;
 *   4. a FEDERAL_NESHAP_REG_KEYS row → Federal NESHAP;
 *   5. a FEDERAL_NSPS_REG_KEYS row → Federal NSPS;
 *   6. an ECMC_REG_KEYS row → ECMC rules;
 *   7. a PHMSA_REG_KEYS row (49 CFR Parts 190-199) → Federal PHMSA;
 *   8. a state row keyed by an AQCC regulation (AQCC_REGULATION_KEYS) →
 *      Colorado standards;
 *   9. everything else (proc, sip, county) → "Other".
 */
export function groupForHit(hit: GroupableHit): MapGroup | "Other" {
  if (DEFINITIONS_PATH.test(hit.path ?? "") || DEFINITIONS_PATH.test(hit.title) || DEFINITIONS_TITLE.test(hit.title)) {
    return "Definitions";
  }
  const key = (hit.reg_key ?? "").toLowerCase();
  if (key.startsWith("gp")) return "General Permit options";
  if (key === "3") return "Colorado permitting and APEN";
  if (FEDERAL_NESHAP_REG_KEYS.includes(key)) return "Federal NESHAP";
  if (FEDERAL_NSPS_REG_KEYS.includes(key)) return "Federal NSPS";
  if (ECMC_REG_KEYS.includes(key)) return "ECMC rules";
  if (PHMSA_REG_KEYS.includes(key)) return "Federal PHMSA";
  if (hit.jurisdiction_level === "state" && AQCC_REGULATION_KEYS.includes(key)) return "Colorado standards";
  return "Other";
}

export type GroupedHits<T extends GroupableHit> = {
  /**
   * Non-empty groups: first the ones with at least one canonical row, then
   * the ones with retrieval hits only, each run in MAP_GROUP_ORDER. Within a
   * group the canonical rows lead, then at most MAX_HITS_PER_GROUP hits, in
   * retrieval order.
   */
  groups: { group: MapGroup; canonical: MapProvision[]; hits: T[] }[];
  /** Hits groupForHit() put in no group, at most MAX_OTHER_HITS, in retrieval order. */
  other: T[];
  /** Rows (canonical or retrieved) left out because the question stated another facet value. */
  omittedIds: string[];
};

/**
 * Lays the retrieval hits out under a matched map: canonical rows first in
 * each group, then the hits groupForHit() routes there that are not already
 * canonical (at most MAX_HITS_PER_GROUP per group), empty groups omitted,
 * the rest under "Other matches" (at most MAX_OTHER_HITS). `canonicalIds`
 * limits the canonical rows to the ones the caller could fetch (RLS, the
 * visitor's filters); when omitted every row of the map is listed.
 *
 * Groups that carry a canonical row come before groups that only collected
 * retrieval hits, each run in MAP_GROUP_ORDER (3 Oct 2026): a stray
 * Regulation 3 hit on the enforcement map used to open "Colorado permitting
 * and APEN" above the groups that answer the question.
 *
 * `within` (9 Oct 2026) is the one document the question named (ask-scope.ts):
 * a map may group the results but never widens them, so canonical rows and
 * hits from any other document are dropped, and the per-group caps are lifted
 * (the visitor asked about one document; "Method 21 under Subpart OOOO" has
 * six sibling paragraphs of 60.5416(b), and a cap of three would hide half).
 * Dropped rows are not "omitted" in the stated-fact sense: nothing is said
 * about them, the chip above the results says what the search is limited to.
 *
 * `stated` (7 Oct 2026) drops the canonical rows tagged with another value
 * of a stated facet and the retrieval hits from a reg key another value
 * owns; their ids come back in `omittedIds` so the page can say what was
 * left out. A premise map's own permit (`permitRegKey`) collects its
 * retrieval hits under "Permit applicability".
 */
export function groupHits<T extends GroupableHit>(
  map: QuestionMap,
  hits: T[],
  canonicalIds?: Set<string>,
  stated: StatedFacets = {},
  within: string | null = null
): GroupedHits<T> {
  const inDocument = (id: string, regKey?: string | null) => !within || (regKey ?? regKeyOf(id) ?? "").toLowerCase() === within;
  const maxPerGroup = within ? Infinity : MAX_HITS_PER_GROUP;
  const maxOther = within ? Infinity : MAX_OTHER_HITS;
  const available = canonicalIds ? map.provisions.filter((p) => canonicalIds.has(p.id)) : map.provisions;
  const fetched = available.filter((p) => inDocument(p.id));
  const canonical = fetched.filter((p) => rowMatchesFacets(p, stated));
  const omittedIds = fetched.filter((p) => !rowMatchesFacets(p, stated)).map((p) => p.id);
  const canonicalSet = new Set(map.provisions.map((p) => p.id));
  const byGroup = new Map<MapGroup, T[]>();
  const other: T[] = [];
  for (const hit of hits) {
    if (canonicalSet.has(hit.id) || !inDocument(hit.id, hit.reg_key)) continue;
    if (!hitMatchesFacets(hit, stated)) {
      omittedIds.push(hit.id);
      continue;
    }
    const g: MapGroup | "Other" =
      map.permitRegKey && (hit.reg_key ?? "").toLowerCase() === map.permitRegKey ? "Permit applicability" : groupForHit(hit);
    if (g === "Other") {
      if (other.length < maxOther) other.push(hit);
      continue;
    }
    const list = byGroup.get(g) ?? [];
    if (list.length < maxPerGroup) list.push(hit);
    byGroup.set(g, list);
  }
  const withCanonical: GroupedHits<T>["groups"] = [];
  const hitsOnly: GroupedHits<T>["groups"] = [];
  for (const group of MAP_GROUP_ORDER) {
    const rows = canonical.filter((p) => p.group === group);
    const extra = byGroup.get(group) ?? [];
    if (rows.length === 0 && extra.length === 0) continue;
    (rows.length > 0 ? withCanonical : hitsOnly).push({ group, canonical: rows, hits: extra });
  }
  return { groups: [...withCanonical, ...hitsOnly], other, omittedIds };
}

/** The `map` field of /api/search/semantic: the matched map and its groups as id lists. */
export type QuestionMapSummary = {
  key: string;
  name: string;
  /** The title the page shows: the map's name, or its title for a stated facet value. */
  title: string;
  /** The introduction, joined (kept for API readers). */
  factors: string;
  /** The introduction, sentence by sentence with the provisions that support each. */
  intro: IntroSentence[];
  groups: { group: MapGroup | "Other"; provisions: string[] }[];
  /** The premise note shown above the results, when the question matched one. */
  note: { key: string; title: string; sentences: { text: string; cites: string[] }[] } | null;
  /** The facet values the question stated, as "facet=value". */
  stated: string[];
  /** One line per stated facet naming what was left out and why. */
  omitted: OmittedLine[];
  /** The ids left out. */
  omittedIds: string[];
};

export function summariseGroups<T extends GroupableHit>(map: QuestionMap, grouped: GroupedHits<T>, stated: StatedFacets = {}): QuestionMapSummary {
  const groups: QuestionMapSummary["groups"] = grouped.groups.map((g) => ({
    group: g.group,
    provisions: [...g.canonical.map((p) => p.id), ...g.hits.map((h) => h.id)],
  }));
  if (grouped.other.length > 0) groups.push({ group: "Other", provisions: grouped.other.map((h) => h.id) });
  const note = premiseNoteOf(map);
  return {
    key: map.key,
    name: map.name,
    title: mapTitle(map, stated),
    factors: introText(map),
    intro: map.factors,
    groups,
    note: note ? { key: note.key, title: note.title, sentences: note.sentences } : null,
    stated: (Object.keys(stated) as FacetName[]).map((n) => `${n}=${stated[n]!.value}`),
    omitted: omittedLines(map, stated),
    omittedIds: grouped.omittedIds,
  };
}

/**
 * Everything the Ask page decides from the question and the retrieval hits
 * alone, in one call: the map, the premise note, the stated facets, the
 * grouped layout and the ids in the order shown. The eval scores `shownIds`
 * (what the visitor sees), the API route returns the summary, the page
 * renders the pieces. `canonicalIds` is what the caller could fetch;
 * `allFacets` is the "Show them" link (?facets=all), which turns the
 * stated-fact filter off. `within` is the document the question named
 * (askScope() in ask-scope.ts; null for none, or for a premise question).
 */
export function layoutAsk<T extends GroupableHit>(
  rawQuestion: string,
  hits: T[],
  canonicalIds?: Set<string>,
  allFacets = false,
  within: string | null = null
): { map: QuestionMap | null; note: PremiseNote | null; stated: StatedFacets; grouped: GroupedHits<T> | null; summary: QuestionMapSummary | null; shownIds: string[] } {
  const map = matchQuestionMap(rawQuestion);
  if (!map) return { map: null, note: null, stated: {}, grouped: null, summary: null, shownIds: hits.map((h) => h.id) };
  const stated = allFacets ? {} : detectFacets(rawQuestion, map);
  const grouped = groupHits(map, hits, canonicalIds, stated, within);
  const summary = summariseGroups(map, grouped, stated);
  return { map, note: premiseNoteOf(map), stated, grouped, summary, shownIds: summary.groups.flatMap((g) => g.provisions) };
}
