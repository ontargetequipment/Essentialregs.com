import { expandAcronyms } from "@/lib/acronyms";

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
  | "Colorado permitting and APEN"
  | "General Permit options"
  | "Colorado standards"
  | "Federal NSPS"
  | "Federal NESHAP"
  | "Definitions";

/** The six groups in display order. Air-centric on purpose for the first maps. */
export const MAP_GROUP_ORDER: MapGroup[] = [
  "Colorado permitting and APEN",
  "General Permit options",
  "Colorado standards",
  "Federal NSPS",
  "Federal NESHAP",
  "Definitions",
];

/** The heading for retrieval hits groupForHit() puts in no group. */
export const OTHER_GROUP = "Other matches";

/** 40 CFR Part 60 subparts in the corpus: NSPS rows go under "Federal NSPS". */
export const FEDERAL_NSPS_REG_KEYS: readonly string[] = ["ooooa", "oooob", "ooooc", "jjjj", "iiii"];

/** 40 CFR Part 63 subparts in the corpus: NESHAP rows go under "Federal NESHAP". */
export const FEDERAL_NESHAP_REG_KEYS: readonly string[] = ["zzzz"];

/**
 * AQCC regulation keys: the numbered regulations 1-31 plus the Common
 * Provisions ("cp") and the Air Quality Standards ("aqs"). A state row with
 * one of these keys goes under "Colorado standards" (Regulation 3, the
 * permitting regulation, is routed before this list is consulted). Keyed by
 * name so a later map for ECMC or PHMSA topics can add a group by adding a
 * list here, without touching groupForHit().
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

export type MapProvision = {
  id: string;
  group: MapGroup;
  /** One line, shown as "Why it's here: …" on the card. */
  why: string;
};

export type QuestionMap = {
  key: string;
  name: string;
  /** Case-insensitive word-boundary patterns; any match routes the question here. */
  triggers: RegExp[];
  /** One sentence naming what decides applicability. Shown above the groups. */
  factors: string;
  /** Canonical rows, in display order. Every id must exist in provisions (corpus_qa.sql check 20). */
  provisions: MapProvision[];
};

export const QUESTION_MAPS: QuestionMap[] = [
  {
    key: "engines",
    name: "Natural gas-fired and diesel engines",
    // Not "compressor" alone: a centrifugal / reciprocating compressor
    // question is a different map.
    triggers: [/\b(?:engines?|rice|gen-?sets?|generators?|reciprocating|jjjj|iiii|zzzz|gp\s?0?2|gp\s?12|gp\s?0?9|gp\s?10)\b/i],
    factors:
      "What applies depends on the fuel (natural gas or diesel), the site-rated horsepower, the date of manufacture, construction or modification, whether the engine is an emergency unit, whether the facility is a major or area source of hazardous air pollutants, and whether it sits in the 8-hour Ozone Control Area or Northern Weld County.",
    provisions: [
      // Colorado permitting and APEN
      { id: "sec-3-A-II-B", group: "Colorado permitting and APEN", why: "APEN filing: when a notice is required and the reporting thresholds" },
      { id: "sec-3-A-II-D-1", group: "Colorado permitting and APEN", why: "APEN exemptions — II.D.1.l exempts engines powering portable drilling rigs" },
      { id: "sec-3-B-II-A", group: "Colorado permitting and APEN", why: "Construction permit: general considerations" },
      { id: "sec-3-B-II-D-1-c", group: "Colorado permitting and APEN", why: "Construction-permit exemption for engines: drilling rigs, emergency generators ≤ 250 hr/yr, < 5 tpy uncontrolled or < 50 hp" },
      // General Permit options
      { id: "sec-gp12-I-A", group: "General Permit options", why: "GP12 — oil and gas well production facilities; natural gas-fired (I.A.1) and diesel (I.A.2) engines; replaced GP09/GP10 for new applicants" },
      { id: "sec-gp02-I-A", group: "General Permit options", why: "GP02 — natural gas-fired RICE at an oil and gas stationary source" },
      { id: "sec-gp09-I-A", group: "General Permit options", why: "GP09 — closed to new registrations July 15, 2026; existing registrations remain active" },
      { id: "sec-gp10-I-A", group: "General Permit options", why: "GP10 — closed to new registrations July 15, 2026; existing registrations remain active" },
      // Colorado standards
      { id: "sec-26-B-I-D", group: "Colorado standards", why: "Reg 26 Part B I.D — natural gas-fired RICE: new, modified and relocated (I.D.3), existing (I.D.4), additional requirements (I.D.5, I.D.6)" },
      { id: "sec-26-B-I", group: "Colorado standards", why: "Reg 26 Part B I — control technology requirements for new and existing engines (I.A, I.B) and their exemptions (I.C)" },
      { id: "sec-26-B-II", group: "Colorado standards", why: "Reg 26 Part B II — stationary and portable combustion equipment in the 8-hour Ozone Control Area or Northern Weld County" },
      { id: "sec-26-C-FEDJJJJ", group: "Colorado standards", why: "Subpart JJJJ as incorporated into Regulation 26, Part C" },
      // Federal NSPS
      { id: "sec-jjjj-60.4230", group: "Federal NSPS", why: "Subpart JJJJ applicability — spark-ignition (natural gas) engines, by manufacture date and horsepower" },
      { id: "sec-jjjj-60.4233", group: "Federal NSPS", why: "Subpart JJJJ emission standards for owners and operators" },
      { id: "sec-iiii-60.4200", group: "Federal NSPS", why: "Subpart IIII applicability — compression-ignition (diesel) engines" },
      { id: "sec-iiii-60.4204", group: "Federal NSPS", why: "Subpart IIII standards — non-emergency engines" },
      { id: "sec-iiii-60.4205", group: "Federal NSPS", why: "Subpart IIII standards — emergency engines" },
      // Federal NESHAP
      { id: "sec-zzzz-63.6585", group: "Federal NESHAP", why: "Subpart ZZZZ applicability — stationary RICE at major and area sources of HAP" },
      { id: "sec-zzzz-63.6590", group: "Federal NESHAP", why: "Subpart ZZZZ — which engines are covered and which are exempt or deferred" },
      { id: "sec-zzzz-63.6595", group: "Federal NESHAP", why: "Subpart ZZZZ compliance dates" },
      // Definitions
      { id: "sec-jjjj-60.4248", group: "Definitions", why: "Subpart JJJJ definitions (emergency engine, rich/lean burn, maximum engine power, …)" },
      { id: "sec-3-A-I-B-36", group: "Definitions", why: "Regulation 3 definition of a non-road engine" },
    ],
  },
];

/**
 * The first map whose trigger matches the acronym-expanded question, or
 * null. Expands acronyms itself (so "GP02 limits" routes on the spelled-out
 * "reciprocating internal combustion engines"); passing an already-expanded
 * string is harmless, expansion only adds words.
 */
export function matchQuestionMap(question: string): QuestionMap | null {
  const expanded = expandAcronyms(question);
  for (const map of QUESTION_MAPS) {
    if (map.triggers.some((t) => t.test(expanded))) return map;
  }
  return null;
}

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
 *   6. a state row keyed by an AQCC regulation (AQCC_REGULATION_KEYS) →
 *      Colorado standards;
 *   7. everything else (ECMC, PHMSA p19x, proc, sip, county) → "Other".
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
  if (hit.jurisdiction_level === "state" && AQCC_REGULATION_KEYS.includes(key)) return "Colorado standards";
  return "Other";
}

export type GroupedHits<T extends GroupableHit> = {
  /** Non-empty groups in MAP_GROUP_ORDER: the canonical rows (ids), then at most MAX_HITS_PER_GROUP hits, in retrieval order. */
  groups: { group: MapGroup; canonical: MapProvision[]; hits: T[] }[];
  /** Hits groupForHit() put in no group, at most MAX_OTHER_HITS, in retrieval order. */
  other: T[];
};

/**
 * Lays the retrieval hits out under a matched map: canonical rows first in
 * each group, then the hits groupForHit() routes there that are not already
 * canonical (at most MAX_HITS_PER_GROUP per group), empty groups omitted,
 * the rest under "Other matches" (at most MAX_OTHER_HITS). `canonicalIds`
 * limits the canonical rows to the ones the caller could fetch (RLS, the
 * visitor's filters); when omitted every row of the map is listed.
 */
export function groupHits<T extends GroupableHit>(map: QuestionMap, hits: T[], canonicalIds?: Set<string>): GroupedHits<T> {
  const canonical = canonicalIds ? map.provisions.filter((p) => canonicalIds.has(p.id)) : map.provisions;
  const canonicalSet = new Set(map.provisions.map((p) => p.id));
  const byGroup = new Map<MapGroup, T[]>();
  const other: T[] = [];
  for (const hit of hits) {
    if (canonicalSet.has(hit.id)) continue;
    const g = groupForHit(hit);
    if (g === "Other") {
      if (other.length < MAX_OTHER_HITS) other.push(hit);
      continue;
    }
    const list = byGroup.get(g) ?? [];
    if (list.length < MAX_HITS_PER_GROUP) list.push(hit);
    byGroup.set(g, list);
  }
  const groups: GroupedHits<T>["groups"] = [];
  for (const group of MAP_GROUP_ORDER) {
    const rows = canonical.filter((p) => p.group === group);
    const extra = byGroup.get(group) ?? [];
    if (rows.length === 0 && extra.length === 0) continue;
    groups.push({ group, canonical: rows, hits: extra });
  }
  return { groups, other };
}

/** The `map` field of /api/search/semantic: the matched map and its groups as id lists. */
export type QuestionMapSummary = {
  key: string;
  name: string;
  factors: string;
  groups: { group: MapGroup | "Other"; provisions: string[] }[];
};

export function summariseGroups<T extends GroupableHit>(map: QuestionMap, grouped: GroupedHits<T>): QuestionMapSummary {
  const groups: QuestionMapSummary["groups"] = grouped.groups.map((g) => ({
    group: g.group,
    provisions: [...g.canonical.map((p) => p.id), ...g.hits.map((h) => h.id)],
  }));
  if (grouped.other.length > 0) groups.push({ group: "Other", provisions: grouped.other.map((h) => h.id) });
  return { key: map.key, name: map.name, factors: map.factors, groups };
}
