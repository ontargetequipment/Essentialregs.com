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
 * Regulations whose full reader is open to anonymous visitors (Sprint 4,
 * 10 Oct 2026): GP05, the public sample. It must agree with three other
 * places, which is why it lives in this dependency-free file:
 *
 *   - the data: supabase/migrations/20261010120000_gp05_public_sample.sql
 *     marks the regulation's rows is_public, which is what RLS lets a
 *     visitor's own client read;
 *   - the reader gate: /regulations/<reg> renders for an unentitled
 *     request only when the regulation is listed here (reader-page.ts), and
 *     404s for every other one exactly as before;
 *   - the links: provisionDestination below opens the reader, not the
 *     focused preview, for these.
 *
 * Adding a key here without the data (or the reverse) gives a visitor a
 * reader that is empty or a link that 404s.
 */
export const PUBLIC_READER_REGS: readonly string[] = ["gp05"];

/** Whether a regulation's reader is open to a visitor with no access. Case-insensitive. */
export function isPublicReaderReg(
  regKey: string | null | undefined,
  publicRegs: readonly string[] = PUBLIC_READER_REGS
): boolean {
  return !!regKey && publicRegs.includes(regKey.toLowerCase());
}

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
  if (viewer.hasAccess || isPublicReaderReg(hit.reg_key, publicRegs)) {
    return `/regulations/${hit.reg_key}#${hit.id}`;
  }
  return `/regulations/${hit.reg_key}/preview?p=${encodeURIComponent(hit.id)}`;
}
