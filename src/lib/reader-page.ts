import { renderReaderBody, type RenderedReader } from "@/lib/reader-render";
import type { Provision } from "@/lib/types";

/**
 * What /regulations/[reg] needs to load, with every side effect injected so
 * scripts/reader-gate.test.ts can prove the invariant below without Next
 * or a database. page.tsx supplies the real implementations.
 */
export type ReaderPageDeps = {
  /** getAccessStatus().hasAccess -- the app's entitlement check, same predicate as the RLS policy. */
  hasAccess: () => Promise<boolean>;
  /** Today's path: the RLS-bound fetch for this request's own session. */
  fetchLive: (reg: string) => Promise<Provision[]>;
  /** count + max(updated_at) for the regulation -- the cache key's data version. */
  fetchVersion: (reg: string) => Promise<string>;
  /** The cross-request cache of the rendered body (fetchRenderedReader). */
  fetchCached: (reg: string, version: string) => Promise<RenderedReader | null>;
};

/**
 * Loads the rendered reader for one regulation, or null when there is
 * nothing to show (the page 404s).
 *
 * INVARIANT: the cached body is only ever filled by an entitled request and
 * only ever read after the entitlement gate, on every request. The cache
 * holds the full text of a paid regulation rendered for nobody in
 * particular (fetched with the service-role client, which bypasses RLS), so
 * the gate here is what stands between it and an anonymous visitor -- not
 * the database. An unentitled request never reaches fetchVersion or
 * fetchCached: it takes the same path it always did, the RLS-bound fetch
 * that returns only the rows its own session may read (the public root
 * row, or nothing), rendered live.
 */
export async function loadReaderPage(reg: string, deps: ReaderPageDeps): Promise<RenderedReader | null> {
  if (!(await deps.hasAccess())) {
    return renderReaderBody(await deps.fetchLive(reg));
  }
  // Entitled: any re-import or admin edit changes count or max(updated_at),
  // so a stale entry is simply never read again -- there is nothing to
  // invalidate.
  const version = await deps.fetchVersion(reg);
  return deps.fetchCached(reg, version);
}
