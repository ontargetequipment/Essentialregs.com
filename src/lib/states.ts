import type { Provision } from "@/lib/types";
import { GP_KEY } from "@/lib/regulation-names";
import { regulationNumber } from "@/lib/regulation-pure";

/** A regulation root as the state pages see it (what fetchRegulationRoots returns). */
export type StateRoot = Pick<Provision, "id" | "jurisdiction_level">;

/**
 * One covered state. Adding a second state is one more object in STATES:
 * the /states picker card, the /states/<slug> index, its metadata and the
 * sitemap entry all come from here.
 */
export type StateConfig = {
  /** URL segment: /states/<slug>. */
  slug: string;
  /** Display name: the picker card title and the "<name> regulations" heading. */
  name: string;
  /** What the corpus covers for this state, one line on the picker card. */
  covers: string;
  /** The index page's intro, under the "<name> regulations" heading. */
  intro: string;
  /**
   * Picks this state's regulation roots out of everything
   * fetchRegulationRoots returns. Colorado is the only state in the corpus,
   * so every state-level root is its; a second state needs its own test
   * here (issuing_body, or a jurisdiction column the root read would have
   * to grow).
   */
  ownsRoot: (root: StateRoot) => boolean;
};

export const STATES: readonly StateConfig[] = [
  {
    slug: "colorado",
    name: "Colorado",
    covers: "Air Quality Control Commission regulations, ECMC rules, APCD General Permits",
    intro:
      "The AQCC air-quality regulations, the APCD General Permits and the ECMC rules, each browsable with a section sidebar and click-to-preview citations. More regulations get added here over time.",
    ownsRoot: (r) => r.jurisdiction_level === "state",
  },
];

/** The state behind /states/<slug>, or undefined (the page 404s). */
export function stateBySlug(slug: string): StateConfig | undefined {
  return STATES.find((s) => s.slug === slug);
}

/** The state's own roots out of the full root list. */
export function stateRoots<T extends StateRoot>(state: StateConfig, roots: T[]): T[] {
  return roots.filter(state.ownsRoot);
}

export type StateCoverage = {
  /** Numbered regulations and rules (everything that is not a general permit). */
  regulations: number;
  /** APCD general permits (gp01..gp12, see GP_KEY). */
  generalPermits: number;
};

/** Counts for the picker card, from the same roots the state index lists. */
export function stateCoverage(roots: StateRoot[]): StateCoverage {
  let generalPermits = 0;
  for (const r of roots) {
    const key = regulationNumber(r.id);
    if (key && GP_KEY.test(key)) generalPermits++;
  }
  return { regulations: roots.length - generalPermits, generalPermits };
}

/** "31 regulations · 11 General Permits" (the permits part only when there are any). */
export function coverageLabel({ regulations, generalPermits }: StateCoverage): string {
  const parts = [plural(regulations, "regulation")];
  if (generalPermits > 0) parts.push(plural(generalPermits, "General Permit"));
  return parts.join(" · ");
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
