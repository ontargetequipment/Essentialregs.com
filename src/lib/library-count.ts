/**
 * "The full library has N provisions matching ..." (Sprint 8, 11 Oct 2026).
 *
 * A logged-out visitor's keyword search reads only the public rows (GP05 and a
 * handful of sample rows). "No results" for "dehydrator" told them nothing
 * about the other 57 documents. When that search finds nothing, the page now
 * asks the database how many provisions the whole released library has for the
 * same words and says so, which is the reason to start a trial and nothing
 * else: a number, never a citation, a title, a snippet or an id.
 *
 * The number comes from public.count_provisions_matching(q)
 * (supabase/migrations/20261011190000_count_provisions_matching.sql), a
 * count-only SECURITY DEFINER function with the same match as
 * search_provisions, so the visitor's own client may call it. Pure and
 * dependency-free (no server imports), so scripts/library-count.test.ts runs
 * all of it; the page passes its Supabase client, a test a fake.
 *
 * It is a convenience, never a gate: any error, a missing function (the
 * migration not applied yet) or a count of 0 hides the line and nothing else
 * on the page changes.
 */

/** The minimal client surface the count needs; the page passes the real one, tests a fake. */
export type LibraryCountClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * How many provisions of the whole library match `query`, or null when the
 * count is unavailable (the call failed, threw, or returned anything but a
 * whole number of 0 or more). One RPC call. `query` is the string the keyword
 * search just ran, already trimmed and cut to MAX_QUERY_LENGTH; the function
 * trims and cuts it again on its side.
 */
export async function fetchLibraryMatchCount(client: LibraryCountClient, query: string): Promise<number | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const { data, error } = await client.rpc("count_provisions_matching", { q });
    if (error) return null;
    return typeof data === "number" && Number.isInteger(data) && data >= 0 ? data : null;
  } catch {
    return null;
  }
}

/**
 * The sentence, or null when it must not be shown (no count, or a count of 0:
 * "0 provisions" is just the "No results" the page already says).
 * "No matches in GP05. The full library has 47 provisions matching “dehydrator”."
 * The quotes are the page's own (“ ” as in "No results for ..."), the number
 * has thousands separators, and one match reads "1 provision".
 */
export function libraryCountSentence(query: string, count: number | null): string | null {
  if (count === null || !Number.isInteger(count) || count < 1) return null;
  const n = count.toLocaleString("en-US");
  return `No matches in GP05. The full library has ${n} ${count === 1 ? "provision" : "provisions"} matching “${query}”.`;
}
