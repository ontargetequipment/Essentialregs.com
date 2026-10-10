/**
 * Where a result card opens a provision: the gated reader at
 * /regulations/<reg> with the provision id as the hash (the reader resolves
 * it on load: scroll, flash, focus), or the standalone card page for a row
 * with no regulation key (the hand-written samples). One function for the
 * Ask cards (semantic.ts) and the keyword cards (search page), pure so the
 * tests can check every eval and question-map id against it.
 *
 * This is the subscriber's destination. Result cards go through
 * provisionDestination (destination.ts), which returns this same href for a
 * viewer with access and the focused preview for everyone else.
 */
export function readerHrefFor(hit: { id: string; reg_key: string | null }): string {
  return hit.reg_key ? `/regulations/${hit.reg_key}#${hit.id}` : `/regs/${hit.id}`;
}
