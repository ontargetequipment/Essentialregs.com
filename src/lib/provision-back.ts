import { isPublicReaderReg } from "@/lib/destination";
import { partRootIdOf } from "@/lib/reader-nav";
import { regKeyOf, regulationDisplayName } from "@/lib/regulation-names";

/** The back link on a /regs/<id> card page: where it goes and what it says. */
export type BackLink = { href: string; label: string };

/**
 * Where "back" goes from a provision's own page, /regs/<id>. Pure, so
 * scripts/provision-back.test.ts can pin every case.
 *
 *   no regulation key in the id (a hand-written sample row)
 *                                    -> /sample, "← Back to sample";
 *   a row of a regulation whose reader is open to everyone (GP05, Sprint 4)
 *                                    -> the row in that reader, "← Back to <name>";
 *   a PUBLIC row of any other regulation (Regulation 7 I.C.1 and below, 11 Oct
 *   2026: the document itself is not public, only these rows)
 *                                    -> the document's visitor preview focused on the
 *                                       row's Part, "← Back to Regulation 7"
 *                                       (/regulations/7/preview?p=sec-7-P-B; the
 *                                       plain document preview when the id names no
 *                                       Part);
 *   any other row, and a public row seen by a subscriber (who can open the reader)
 *                                    -> the row in the reader for a subscriber, else
 *                                       the document's preview.
 *
 * Until 11 Oct 2026 the third case was "← Back to sample", which names the
 * wrong place for a Regulation 7 row.
 */
export function provisionBackLink(provision: { id: string; is_public: boolean }, viewer: { hasAccess: boolean }): BackLink {
  const regKey = regKeyOf(provision.id);
  if (!regKey) return { href: "/sample", label: "← Back to sample" };
  const label = `← Back to ${regulationDisplayName(regKey)}`;
  if (isPublicReaderReg(regKey)) return { href: `/regulations/${regKey}#${provision.id}`, label };
  if (provision.is_public && !viewer.hasAccess) {
    const part = partRootIdOf(provision.id);
    return { href: part ? `/regulations/${regKey}/preview?p=${encodeURIComponent(part)}` : `/regulations/${regKey}/preview`, label };
  }
  return { href: viewer.hasAccess ? `/regulations/${regKey}#${provision.id}` : `/regulations/${regKey}/preview`, label };
}
