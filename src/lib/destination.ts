/**
 * Where a result card or related-provision link opens a provision, given who
 * is looking (Sprint 4, 10 Oct 2026). Pure -- no server-only imports -- so
 * the unit tests can import it.
 *
 *   - no regulation key (the hand-written samples)  -> /regs/<id>
 *   - a subscriber, or a regulation anyone may read -> the exact provision in
 *     the reader, /regulations/<reg>#<id>
 *   - anyone else                                   -> the focused preview,
 *     /regulations/<reg>/preview?p=<id>: the full reader 404s for an
 *     anonymous visitor, so linking there was a dead end, and the plain
 *     /preview dropped the provision they had clicked.
 */

/**
 * Regulations whose full reader is open to anonymous visitors. Empty today;
 * the GP05 release (Sprint 4 PR 2) adds "gp05". Keep it in step with the
 * reader's own gate.
 */
export const PUBLIC_READER_REGS: readonly string[] = [];

export type Viewer = {
  hasAccess: boolean;
  /** Defaults to PUBLIC_READER_REGS. */
  publicRegs?: readonly string[];
};

export function provisionDestination(
  hit: { id: string; reg_key: string | null },
  viewer: Viewer
): string {
  if (!hit.reg_key) return `/regs/${hit.id}`;
  const publicRegs = viewer.publicRegs ?? PUBLIC_READER_REGS;
  if (viewer.hasAccess || publicRegs.includes(hit.reg_key)) {
    return `/regulations/${hit.reg_key}#${hit.id}`;
  }
  return `/regulations/${hit.reg_key}/preview?p=${encodeURIComponent(hit.id)}`;
}
