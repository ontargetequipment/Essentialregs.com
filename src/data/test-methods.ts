// Test Methods reference — EssentialRegs editorial content, not regulation text.
// Written 2026-10-08 by the CEO chat: 3 exemplar entries by Claude (Fable), 27 by Sonnet agents from a
// written brief, one adversarial Sonnet accuracy review (13 fixes applied), owner-approved for publication.
// Every entry links to the authoritative text on the eCFR. Keep entries prose-only; no formulas.
//
// The entries themselves live in test-methods.json (same objects, same order), the one file both this
// typed wrapper and the Python citation linker (pipeline/method_links.py) read, so the app and the
// pipeline can never disagree about which methods exist. To add a method: append an entry to the JSON,
// keep slugs unique and lowercase, run `npm test` (scripts/test-methods.test.ts checks the file) and
// `npm run lint`; the linker links any "Method N" / "Performance Specification N" text whose slug exists
// there on the next import or re-link.

import entries from "./test-methods.json";

export type TestMethodCategory =
  | "fugitives" | "stack-sampling" | "gas-analysis" | "particulate" | "opacity"
  | "organics" | "sulfur-nitrogen" | "continuous-monitoring" | "validation";

export type TestMethod = {
  /** URL slug: /test-methods/<slug>. Lowercase; "method-25a", "ps-8". */
  slug: string;
  /** How rules cite it: "Method 21", "Performance Specification 8". */
  shortName: string;
  /** Title as printed in the CFR. */
  officialTitle: string;
  /** false when the title was written from memory and not checked against the CFR. */
  titleVerified: boolean;
  /** e.g. "40 CFR Part 60, Appendix A-7". */
  source: string;
  /** Link to the appendix on the eCFR. */
  ecfrUrl: string;
  measures: string;
  principle: string;
  equipment: string;
  whenCited: string;
  readerNotes?: string;
  relatedSlugs: string[];
  category: TestMethodCategory;
};

export const TEST_METHOD_CATEGORY_LABELS: Record<TestMethodCategory, string> = {
  "stack-sampling": "Stack sampling fundamentals",
  "gas-analysis": "Gas composition and molecular weight",
  "particulate": "Particulate matter",
  "opacity": "Opacity and visible emissions",
  "fugitives": "Leaks and fugitive emissions",
  "organics": "Organic compounds",
  "sulfur-nitrogen": "Sulfur and nitrogen compounds",
  "continuous-monitoring": "Continuous emission monitoring systems",
  "validation": "Method validation",
};

/** The categories in the order the index lists them (the key order of TEST_METHOD_CATEGORY_LABELS). */
export const TEST_METHOD_CATEGORY_ORDER = Object.keys(TEST_METHOD_CATEGORY_LABELS) as TestMethodCategory[];

/**
 * Every entry, in the JSON file's order. The JSON is the source of truth;
 * the cast is what the file promises and scripts/test-methods.test.ts holds
 * it to (slugs, categories, URLs, related slugs).
 */
export const TEST_METHODS: readonly TestMethod[] = entries as TestMethod[];

export const TEST_METHOD_BY_SLUG: ReadonlyMap<string, TestMethod> = new Map(
  TEST_METHODS.map((m) => [m.slug, m])
);

/** The entries of one category, in file order. */
export function testMethodsInCategory(category: TestMethodCategory): TestMethod[] {
  return TEST_METHODS.filter((m) => m.category === category);
}
