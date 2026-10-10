import Link from "next/link";
import { fetchRelated, fetchRelatedTeaser, hrefForRelated, type RelatedItem } from "@/lib/related";
import { CLOSED_PERMIT_BADGE, isClosedPermit } from "@/lib/regulation-pure";
import { SummaryBadgeText } from "@/components/SummaryBadge";

// Jurisdiction badges. Federal and ECMC keep the blue/violet the reader's own
// related panel uses (.related-badge-federal / -ecmc in reader.css) so the
// same badge reads the same in both places; Colorado is the site's accent.
const BADGE_CLASS: Record<string, string> = {
  Federal: "bg-blue-50 text-blue-700",
  ECMC: "bg-violet-50 text-violet-700",
  Colorado: "bg-accent-soft text-accent",
};

/**
 * "Related provisions" block for the card pages (/sample, /regs/[id]): the
 * five provisions whose meaning is closest to this one, corpus-wide, with
 * cross-regulation matches first when they're as good. Server component —
 * it does its own fetch. `teaser` switches to the RLS-bypassing,
 * summary-only variant used on the public sample page. `hasAccess` picks
 * each link's destination (hrefForRelated): the exact provision in the reader
 * for a subscriber, the focused /preview?p= for everyone else.
 */
export async function RelatedProvisions({
  provisionId,
  teaser = false,
  hasAccess = false,
}: {
  provisionId: string;
  teaser?: boolean;
  /** The viewer's real access (getAccessStatus), which decides where each link opens. */
  hasAccess?: boolean;
}) {
  let items: RelatedItem[] = [];
  try {
    items = teaser ? await fetchRelatedTeaser(provisionId) : await fetchRelated(provisionId);
  } catch (e) {
    console.error("RelatedProvisions:", e instanceof Error ? e.message : e);
    return null;
  }
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-sm">
      <h3 className="font-mono text-eyebrow uppercase text-tag">Related provisions</h3>
      <p className="mt-1 text-xs text-muted">
        Closest in meaning across the corpus — not necessarily cited by this one.
      </p>
      <ol className="mt-3 divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="py-2.5">
            <Link href={hrefForRelated(item, hasAccess)} className="group block">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    BADGE_CLASS[item.badge] ?? BADGE_CLASS.Colorado
                  }`}
                >
                  {item.badge}
                </span>
                <span className="text-xs text-muted">{item.regLabel}</span>
                <span className="font-mono text-xs text-tag group-hover:underline">{item.citation}</span>
                {isClosedPermit(item.reg_key) && (
                  <span
                    className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
                    title={CLOSED_PERMIT_BADGE.title}
                  >
                    {CLOSED_PERMIT_BADGE.label}
                  </span>
                )}
              </div>
              {item.path && <p className="mt-0.5 text-xs leading-snug text-muted">{item.path}</p>}
              {item.title && (
                <p className="mt-0.5 text-sm font-medium text-ink">{item.title}</p>
              )}
              {item.summary ? (
                <>
                  {/* Same label and style as the Ask cards (backlog #16): no summary prose goes unlabelled. */}
                  <p className="mt-1.5 font-mono text-eyebrow uppercase text-tag">
                    Plain-English summary
                    <SummaryBadgeText badge={item.summary_badge} />
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{item.summary}</p>
                </>
              ) : teaser ? (
                <p className="mt-0.5 text-xs italic text-muted">Summary available to subscribers.</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
      {teaser && (
        <p className="mt-3 text-xs text-muted">
          Subscribers open any of these directly in the cross-referenced reader.
        </p>
      )}
    </section>
  );
}
