import { renderReaderBody, type RenderedReader } from "@/lib/reader-render";
import { isPublicReaderReg } from "@/lib/destination";
import { visitorReaderRows } from "@/lib/reader-visitor";
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
  /**
   * The regulation's root (id, citation) when it exists and is released, else
   * null: fetchRegulationRoot (regulation.ts), the rule the preview page
   * itself applies. Asked only for a request that has no access to a
   * regulation that is not public, to tell "exists, but not open to you" (the
   * redirect to its preview) from "no such thing" (a 404). Left out, the
   * answer is always the 404.
   */
  fetchRoot?: (reg: string) => Promise<{ id: string; citation: string } | null>;
};

/**
 * What /regulations/[reg] shows:
 *   reader     the reader (`reader`)
 *   preview    nothing of the document, a redirect to its focused preview
 *              (ReaderRedirect): it exists and is released, the viewer has no
 *              access to it, and its reader is not public. `root` is only for
 *              its name.
 *   not-found  a 404: unknown, staged, or (for a subscriber) empty
 */
export type ReaderPageResult =
  | { kind: "reader"; reader: RenderedReader }
  | { kind: "preview"; root: { id: string; citation: string } }
  | { kind: "not-found" };

const NOT_FOUND: ReaderPageResult = { kind: "not-found" };

function asResult(reader: RenderedReader | null): ReaderPageResult {
  return reader ? { kind: "reader", reader } : NOT_FOUND;
}

/**
 * Resolves what /regulations/[reg] shows for one regulation
 * (ReaderPageResult).
 *
 * A staged document (regulation_releases, src/lib/release.ts) is hidden
 * first: isVisible runs before the entitlement gate and before any fetch,
 * and a false means 404 for everyone but an admin.
 *
 * PUBLIC SAMPLE (Sprint 4, 10 Oct 2026): an unentitled request renders a
 * reader only for a regulation listed in PUBLIC_READER_REGS (GP05, whose rows
 * the database marks is_public). For any other regulation there is no reader
 * for them, and no read of its rows: before this the RLS-bound
 * fetch ran first and a regulation whose root was not public simply came back
 * empty, which made the 404 an accident of the data rather than a rule. Now
 * it is the rule, and marking some other row public (the four /regs/<id>
 * sample cards) can never turn its regulation's reader on by itself.
 *
 * NO CROSS-REFERENCE EVER 404s (Sprint 8, 11 Oct 2026). That "no reader" used
 * to be a 404, so a cross-reference opened directly (/regulations/7#sec-7-B-I-C-1
 * in a new tab, a copied link) was an error page. It is now `preview` when the
 * regulation exists and is released (deps.fetchRoot), and still `not-found`
 * for an unknown or staged one. That is for a request WITHOUT access only: a
 * subscriber whose reader comes back empty stays `not-found`, because the
 * focused preview sends a subscriber back to the reader (readerRedirectHref)
 * and the two would loop. The existence check reads the root row's id and
 * citation and nothing else; no text of the document reaches the answer.
 *
 * A visitor's body (GP05) is rendered with its cross-regulation links in the
 * preview form (visitorReaderRows, reader-visitor.ts), so they open a page
 * that exists with no script; a subscriber's cached body is never touched.
 *
 * INVARIANT: the cached body is only ever filled by an entitled request and
 * only ever read after the entitlement gate, on every request. The cache
 * holds the full text of a paid regulation rendered for nobody in
 * particular (fetched with the service-role client, which bypasses RLS), so
 * the gate here is what stands between it and an anonymous visitor -- not
 * the database. An unentitled request never reaches fetchVersion or
 * fetchCached, GP05 included: it takes the RLS-bound fetchLive, which
 * returns only the rows its own session may read (GP05's public rows, or
 * nothing), rendered live. The new `preview` answer is on that side of the
 * gate too: it calls fetchRoot, never the cache.
 */
export async function resolveReaderPage(reg: string, deps: ReaderPageDeps): Promise<ReaderPageResult> {
  if (!(await deps.isVisible(reg))) {
    return NOT_FOUND;
  }
  if (!(await deps.hasAccess())) {
    if (!isPublicReaderReg(reg, deps.publicRegs)) {
      const root = deps.fetchRoot ? await deps.fetchRoot(reg) : null;
      return root ? { kind: "preview", root } : NOT_FOUND;
    }
    return asResult(renderReaderBody(visitorReaderRows(await deps.fetchLive(reg), deps.publicRegs)));
  }
  // Entitled: any re-import or admin edit changes count or max(updated_at),
  // so a stale entry is simply never read again -- there is nothing to
  // invalidate.
  const version = await deps.fetchVersion(reg);
  return asResult(await deps.fetchCached(reg, version));
}

/** The reader resolveReaderPage finds, or null for anything else (a preview redirect included). */
export async function loadReaderPage(reg: string, deps: ReaderPageDeps): Promise<RenderedReader | null> {
  const result = await resolveReaderPage(reg, deps);
  return result.kind === "reader" ? result.reader : null;
}
