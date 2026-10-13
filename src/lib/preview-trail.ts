/**
 * The focused preview's way back across more than one hop (walkthrough v3,
 * 13 Oct 2026): the pure half. PreviewReturn.tsx is the page side.
 *
 * Until v3 the preview drew "← Back to GP05 · VI.C" from a single `?from=`
 * (previewReturnLink, preview-subtree.ts) and the only hop a visitor could
 * make was GP05 -> the Regulation 7 I.C.1 preview. The walkthrough now has
 * them follow a second citation, I.C.1.c's "Sections I.D." to the I.D
 * preview, and come back through both pages. A URL carries one `from=`, so
 * the second page knows only the hop before it; the hop before THAT (GP05
 * VI.C) lives here, in sessionStorage, as a trail of hops:
 *
 *   [ { GP05 VI.C }, { Regulation 7 I.C.1 } ]      on the I.D page
 *   [ { GP05 VI.C } ]                              back on the I.C.1 page
 *   [ ]                                            back in the GP05 reader
 *
 * The URL is the source of the bar's link and label: a same-document link
 * writes the hops behind its page as further `from=` values
 * (preview-subtree.ts), so the way back through both hops works with no
 * storage at all, and the link always carries the page's own `tour=1`. A
 * page shows the stored trail only when the trail's top is the `from=` the
 * page arrived with (reconcilePreviewTrail makes that so on every load, and
 * refreshes the top's link from the URL), so a stale trail from an earlier
 * visit can never draw a bar the URL does not vouch for. What storage adds
 * is the count and the hop under the top one ("then GP05 · VI.C") for a
 * chain the URL does not carry.
 *
 * Shape: a sibling of the reader's own trail (ReturnTrail in reader-nav.ts
 * is in-memory and in-document; this one spans page loads), under its own
 * key. Dependency-free: it is in the client bundle.
 */
import { regKeyOf } from "@/lib/regulation-names";
import { PROVISION_ID } from "@/lib/types";

export const PREVIEW_TRAIL_KEY = "er:preview-trail";
/** Hops remembered; the walkthrough makes two. */
export const PREVIEW_TRAIL_CAP = 10;

/** One hop: the provision left behind, where its page is, and the bar's text for it ("← Back to GP05 · VI.C"). */
export type PreviewHop = { id: string; href: string; label: string };

/** What a page hands reconcilePreviewTrail: its nearest hop, as a PreviewHop; any further fields (the URL's chain) are not stored. */
export type PreviewOrigin = Pick<PreviewHop, "id" | "href" | "label">;

const isId = (s: unknown): s is string => typeof s === "string" && s.length <= 200 && PROVISION_ID.test(s) && !!regKeyOf(s);
/** A same-site path the bar may link to: nothing that could leave the site. */
const isHref = (s: unknown): s is string => typeof s === "string" && s.length <= 500 && /^\/[^/\\]/.test(s);

/** A stored trail, or [] for anything that is not one (missing, junk, a hop with a bad id or href). */
export function parsePreviewTrail(raw: string | null | undefined): PreviewHop[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const hops: PreviewHop[] = [];
  for (const h of data) {
    if (!h || typeof h !== "object") return [];
    const { id, href, label } = h as Partial<PreviewHop>;
    if (!isId(id) || !isHref(href) || typeof label !== "string" || label.length > 200) return [];
    hops.push({ id, href, label });
  }
  return hops.slice(-PREVIEW_TRAIL_CAP);
}

/** `href` with `from=<id>` added to its query (before any #hash) when it has none. */
export function withFromParam(href: string, fromId: string | null | undefined): string {
  if (!fromId || !isId(fromId)) return href;
  const hashAt = href.indexOf("#");
  const base = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  const q = base.indexOf("?");
  if (q >= 0 && new URLSearchParams(base.slice(q + 1)).has("from")) return href;
  return `${base}${q < 0 ? "?" : "&"}from=${encodeURIComponent(fromId)}${hash}`;
}

/**
 * The trail after a preview page of regulation `reg` loads with `origin`
 * (the hop its `?from=` names, as previewReturnLink resolves it; null for
 * no usable `from=`):
 *
 *   no origin                       -> []: a page reached from a search result
 *                                      or a bookmark starts no chain, and an
 *                                      old one must not show on it
 *   origin already on top           -> unchanged but for the top's link and
 *                                      label, refreshed from the URL (a reload,
 *                                      a Back landing; the page may have gained
 *                                      or lost tour=1 since the hop was stored)
 *   origin in ANOTHER regulation    -> [origin]: the first hop into this
 *                                      document starts the chain afresh
 *   origin in THIS regulation       -> pushed, its href carrying `from=` of
 *                                      the hop below it (the page it leads
 *                                      back to can then draw its own bar)
 */
export function reconcilePreviewTrail(trail: readonly PreviewHop[], origin: PreviewOrigin | null, reg: string): PreviewHop[] {
  if (!origin) return [];
  const hop: PreviewHop = { id: origin.id, href: origin.href, label: origin.label };
  const top = trail[trail.length - 1];
  if (top && top.id === hop.id) return [...trail.slice(0, -1), hop];
  if ((regKeyOf(hop.id) ?? "").toLowerCase() !== reg.toLowerCase()) return [hop];
  const next = [...trail, { ...hop, href: withFromParam(hop.href, top?.id) }];
  return next.slice(-PREVIEW_TRAIL_CAP);
}

/** The trail after the bar's link is taken: the top hop comes off. */
export function popPreviewTrail(trail: readonly PreviewHop[]): PreviewHop[] {
  return trail.slice(0, -1);
}

/**
 * What the stored trail adds to the bar, for a page whose `?from=` resolved
 * to `origin`: how many hops the trail holds, and the hop under the top one
 * ("then GP05 · VI.C"). The link and label are the origin's own (the URL's).
 * null when the trail does not vouch for the page's origin -- the page then
 * shows what the URL carries alone.
 */
export function previewTrailBar(trail: readonly PreviewHop[], origin: PreviewOrigin | null): { count: number; then: string | null } | null {
  const top = trail[trail.length - 1];
  if (!origin || !top || top.id !== origin.id) return null;
  const under = trail[trail.length - 2];
  return { count: trail.length, then: under ? hopName(under.label) : null };
}

/** "← Back to GP05 · VI.C" -> "GP05 · VI.C": the hop as the "then" part of the bar names it. */
export function hopName(label: string): string {
  return label.replace(/^\u2190\s*Back to\s+/, "");
}
