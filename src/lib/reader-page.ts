import { renderReaderBody, type RenderedReader } from "@/lib/reader-render";
import { isPublicReaderReg } from "@/lib/destination";
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
  /**
   * The regulations an unentitled visitor may read in the reader. Defaults to
   * PUBLIC_READER_REGS (destination.ts); the tests pass their own.
   */
  publicRegs?: readonly string[];
};

/**
 * Loads the rendered reader for one regulation, or null when there is
 * nothing to show (the page 404s).
 *
 * A staged document (regulation_releases, src/lib/release.ts) is hidden
 * first: isVisible runs before the entitlement gate and before any fetch,
 * and a false means 404 for everyone but an admin.
 *
 * PUBLIC SAMPLE (Sprint 4, 10 Oct 2026): an unentitled request renders a
 * reader only for a regulation listed in PUBLIC_READER_REGS (GP05, whose rows
 * the database marks is_public). Any other regulation is null -- a 404 --
 * for them exactly as before, and without a query: before this the RLS-bound
 * fetch ran first and a regulation whose root was not public simply came back
 * empty, which made the 404 an accident of the data rather than a rule. Now
 * it is the rule, and marking some other row public (the four /regs/<id>
 * sample cards) can never turn its regulation's reader on by itself.
 *
 * INVARIANT: the cached body is only ever filled by an entitled request and
 * only ever read after the entitlement gate, on every request. The cache
 * holds the full text of a paid regulation rendered for nobody in
 * particular (fetched with the service-role client, which bypasses RLS), so
 * the gate here is what stands between it and an anonymous visitor -- not
 * the database. An unentitled request never reaches fetchVersion or
 * fetchCached, GP05 included: it takes the RLS-bound fetchLive, which
 * returns only the rows its own session may read (GP05's public rows, or
 * nothing), rendered live.
 */
export async function loadReaderPage(reg: string, deps: ReaderPageDeps): Promise<RenderedReader | null> {
  if (!(await deps.isVisible(reg))) {
    return null;
  }
  if (!(await deps.hasAccess())) {
    if (!isPublicReaderReg(reg, deps.publicRegs)) return null;
    return renderReaderBody(await deps.fetchLive(reg));
  }
  // Entitled: any re-import or admin edit changes count or max(updated_at),
  // so a stale entry is simply never read again -- there is nothing to
  // invalidate.
  const version = await deps.fetchVersion(reg);
  return deps.fetchCached(reg, version);
}
