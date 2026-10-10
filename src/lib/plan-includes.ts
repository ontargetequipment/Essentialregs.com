/**
 * What the subscription includes, as /pricing lists it (Sprint 5,
 * 10 Oct 2026). Each line restates something the homepage, the About page or
 * the product already says, in the same words where it can; nothing here is a
 * new claim. Display copy only: the amounts live in src/lib/pricing.ts and
 * are not repeated in this file (scripts/plan-includes.test.ts checks).
 */
export type PlanInclude = { lead: string; detail: string };

export const PLAN_INCLUDES: readonly PlanInclude[] = [
  {
    lead: "The full Colorado and federal corpus in the reader",
    detail:
      "AQCC air-quality regulations, ECMC rules and APCD General Permits, alongside the federal EPA and PHMSA rules they reference.",
  },
  {
    lead: "Plain-English summaries",
    detail: "Clearly labelled, beside the official text, to read a rule before you verify it against the source.",
  },
  {
    lead: "Keyword search",
    detail: "Search by citation, equipment, requirement or topic.",
  },
  {
    lead: "Ask",
    detail:
      "Describe a situation in your own words and get the provisions most about it. It finds provisions; it does not decide what applies to you.",
  },
  {
    lead: "Cross-reference navigation",
    detail: "Follow cross-references and preview cited sections without losing your place.",
  },
  {
    lead: "Test methods",
    detail: "A reference page for each EPA test method the rules cite, such as Method 21, Method 22 and Method 25A.",
  },
  {
    lead: "Updates",
    detail: "New regulations and revisions as they are added.",
  },
];
