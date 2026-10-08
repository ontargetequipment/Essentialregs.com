import { renderReaderBody, type RenderedReader } from "@/lib/reader-render";
import type { Provision } from "@/lib/types";

/**
 * What /regulations/[reg] needs to load, with every side effect injected so
 * scripts/reader-gate.test.ts can prove the invariant below without Next
 * or a database. page.tsx supplies the real implementations.
 */
export type ReaderPageDeps = {
  /**
   * Release gate (src/lib/release.ts): false for a staged, not-yet-released
   * document unless the viewer is an admin. Checked before anything else;
   * a hidden document 404s for subscribers and prospects alike.
   */
  isVisible: (reg: string) => Promise<boolean>;
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
 * A staged document (regulation_releases, src/lib/release.ts) is hidden
 * first: isVisible runs before the entitlement gate and before any fetch,
 * and a false means 404 for everyone but an admin.
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
  if (!(await deps.isVisible(reg))) {
    return null;
  }
  if (!(await deps.hasAccess())) {
    return renderReaderBody(await deps.fetchLive(reg));
  }
  // Entitled: any re-import or admin edit changes count or max(updated_at),
  // so a stale entry is simply never read again -- there is nothing to
  // invalidate.
  const version = await deps.fetchVersion(reg);
  return deps.fetchCached(reg, version);
}
