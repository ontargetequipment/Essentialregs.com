/**
 * Test-method detection for keyword search (9 Oct 2026). A query that names
 * a test method ("Method 21", "EPA Method 25A", "method-21", "PS 8") puts
 * that method's page at the top of the keyword results, above the provision
 * hits: the page is the better answer to "Method 21" than the 266 provisions
 * that cite it. No database change: the match is against
 * src/data/test-methods.json through the typed wrapper, so the search and the
 * pages cannot disagree about which methods exist. Pure -- scripts/
 * test-method-search.test.ts holds it.
 *
 * Exact forms only. "Method 2" is Method 2, never Method 2A; a query with
 * other words ("method 21 leak definition") is a provision search, and the
 * ranked provisions answer it.
 */
import { TEST_METHODS, type TestMethod } from "@/data/test-methods";

/** Lowercase, hyphens and underscores to spaces, whitespace collapsed. */
function normalize(q: string): string {
  return q.toLowerCase().replace(/[-_–—]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Words that may lead or trail a method name without changing what it names. */
const LEADING = /^(?:epa |us epa |u s epa |40 cfr |reference |test )+/;
const TRAILING = / (?:test )?method$| test$/;

function aliasesOf(m: TestMethod): string[] {
  const short = normalize(m.shortName); // "method 21", "performance specification 8"
  const out = new Set([short, normalize(m.slug)]); // "method 21", "ps 8"
  const ps = short.match(/^performance specification (\d+[a-z]?)$/);
  if (ps) out.add(`ps ${ps[1]}`);
  return Array.from(out);
}

const ALIAS_TO_METHOD: ReadonlyMap<string, TestMethod> = new Map(
  TEST_METHODS.flatMap((m) => aliasesOf(m).map((a) => [a, m] as const))
);

/** The test method a keyword query names, or null. */
export function detectTestMethod(q: string): TestMethod | null {
  let n = normalize(q);
  if (!n) return null;
  n = n.replace(LEADING, "").replace(TRAILING, "").trim();
  return ALIAS_TO_METHOD.get(n) ?? null;
}
