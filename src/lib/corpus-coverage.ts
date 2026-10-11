/**
 * What the corpus covers, by jurisdiction, for the About page (Sprint 8,
 * 11 Oct 2026). The "What's covered today" section used to be a hand-written
 * list of Regulations 3, 7, 26 and Subpart OOOOb with "More is coming",
 * long after the corpus held 31 AQCC regulations, 11 general permits, the
 * ECMC rules, the EPA subparts and the PHMSA parts. The page now prints
 * this, computed from the released regulation roots.
 *
 * Pure and dependency-free of the database: the page hands in the roots
 * fetchRegulationRoots() returns (already filtered to released documents,
 * src/lib/release.ts), and the grouping is the one the /states/colorado and
 * /federal indexes use (groupColoradoRegulations, groupFederalRegulations),
 * so a count here is the count of cards on those pages and there is no second
 * classifier to drift. Colorado is the roots with jurisdiction_level
 * "state" (stateRoots in states.ts does the same), federal those with
 * "federal" (the /federal filter).
 */
import type { Provision } from "@/lib/types";
import {
  groupColoradoRegulations,
  groupFederalRegulations,
  regulationDisplayName,
  regulationNumber,
  type RegulationGroup,
} from "@/lib/regulation-pure";

/** A root as the About page reads it: the columns fetchRegulationRoots selects. */
export type CoverageRoot = Pick<Provision, "id" | "citation" | "issuing_body" | "jurisdiction_level">;

export type CoverageGroup = {
  /** "aqcc" | "gp" | "ecmc" | "other" for Colorado; the CFR part ("60", "63", "49") or the raw key for federal. */
  key: string;
  jurisdiction: "state" | "federal";
  /** The index page's own heading for the group (groupColoradoRegulations / groupFederalRegulations). */
  heading: string;
  count: number;
  /** "regulation", "permit", "rule", "subpart", "part" -- the noun the count is of. */
  noun: string;
  /** Short names in display order: ["Regulations 1, 2, 3, ...", "Common Provisions Regulation", ...]. */
  items: string[];
};

export type CorpusCoverage = {
  groups: CoverageGroup[];
  /** Every released regulation root counted: the sum of the groups. */
  total: number;
  colorado: number;
  federal: number;
};

const NOUN_BY_KEY: Record<string, string> = {
  aqcc: "regulation",
  gp: "permit",
  ecmc: "rule",
  other: "document",
  "60": "subpart",
  "63": "subpart",
  "49": "part",
};

/**
 * The name a group's item list uses for one root: the display name every
 * other surface uses (regulationDisplayName), cut down where the group
 * heading already says the rest -- "APCD General Permit GP02" under the
 * "APCD General Permits" heading is "GP02", "40 CFR Part 60 Subpart OOOOb"
 * under the Part 60 heading is "Subpart OOOOb", "49 CFR Part 192" under the
 * PHMSA heading is "Part 192".
 */
export function coverageItemName(root: CoverageRoot): string {
  const key = regulationNumber(root.id) ?? root.id;
  const name = regulationDisplayName(key, root);
  return name
    .replace(/^APCD General Permit /, "")
    .replace(/^40 CFR Part \d+ (?=Subpart )/, "")
    .replace(/^49 CFR (?=Part )/, "");
}

/**
 * The numbered "Regulation N" names folded into one leading entry
 * ("Regulations 1, 2, 3, 6"), in the order given, followed by the rest in
 * their order. One entry reads better than thirty "Regulation N, Regulation
 * M"; a single numbered regulation keeps its singular name.
 */
export function collapseNumbered(names: string[]): string[] {
  const numbers: string[] = [];
  const rest: string[] = [];
  for (const name of names) {
    const m = /^Regulation (\d+)$/.exec(name);
    if (m) numbers.push(m[1]);
    else rest.push(name);
  }
  if (numbers.length === 0) return rest;
  const lead = numbers.length === 1 ? `Regulation ${numbers[0]}` : `Regulations ${numbers.join(", ")}`;
  return [lead, ...rest];
}

function toCoverageGroup(
  jurisdiction: "state" | "federal",
  group: RegulationGroup<CoverageRoot>
): CoverageGroup {
  return {
    key: group.key,
    jurisdiction,
    heading: group.heading,
    count: group.regs.length,
    noun: NOUN_BY_KEY[group.key] ?? "document",
    items: collapseNumbered(group.regs.map(coverageItemName)),
  };
}

/**
 * The corpus by jurisdiction. Colorado first, in the order of the
 * /states/colorado index (AQCC regulations, APCD general permits, ECMC
 * rules), then federal in the order of /federal (40 CFR Part 60, Part 63,
 * the PHMSA 49 CFR parts). A root that is neither "state" nor "federal" is
 * not counted anywhere, as on the index pages.
 */
export function corpusCoverage(roots: CoverageRoot[]): CorpusCoverage {
  const state = roots.filter((r) => r.jurisdiction_level === "state");
  const federal = roots.filter((r) => r.jurisdiction_level === "federal");
  const groups = [
    ...groupColoradoRegulations(state).map((g) => toCoverageGroup("state", g)),
    ...groupFederalRegulations(federal).map((g) => toCoverageGroup("federal", g)),
  ];
  return {
    groups,
    total: groups.reduce((n, g) => n + g.count, 0),
    colorado: state.length,
    federal: federal.length,
  };
}

/**
 * The sentence that opens the section: "As of 11 Oct 2026, the corpus holds
 * 69 documents: 43 from Colorado and 26 federal." `asOf` is the changelog
 * snapshot's date already formatted (formatDayMonthYear, America/Denver), or
 * null when the snapshot has not been written, in which case the sentence
 * carries no date rather than a made-up one.
 */
export function coverageSummaryLine(coverage: Pick<CorpusCoverage, "total" | "colorado" | "federal">, asOf: string | null): string {
  const { total, colorado, federal } = coverage;
  const lead = asOf ? `As of ${asOf}, the corpus holds` : "The corpus holds";
  return `${lead} ${total} ${total === 1 ? "document" : "documents"}: ${colorado} from Colorado and ${federal} federal.`;
}

/** "31 regulations", "1 rule": the count with its noun, pluralised. */
export function countPhrase(group: Pick<CoverageGroup, "count" | "noun">): string {
  const { count, noun } = group;
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
