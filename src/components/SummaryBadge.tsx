import { summaryStatusBadge } from "@/lib/regulation-pure";
import type { Provision } from "@/lib/types";

/**
 * The review-status badge beside a card's "Plain-English summary" label:
 * the same text summaryPanelHtml puts in every reader panel ("AI reviewed ·
 * Sept 17, 2026" / "AI-generated · not yet reviewed"), as small text next
 * to the label rather than a line of its own. Renders nothing for a
 * rejected summary (the caller has already dropped the prose) and nothing
 * when the row carries no status. A <span> with a title, never a link: the
 * Ask, keyword and related cards are each one <a>, and an anchor cannot
 * nest another. What "AI reviewed" means is on the Disclaimer page
 * (/disclaimer#what-reviewed-means), which the tooltip names.
 */
export function SummaryBadge({ provision }: { provision: Pick<Provision, "summary_status" | "reviewed_at"> }) {
  return <SummaryBadgeText badge={summaryStatusBadge(provision)} />;
}

/** The badge from an already-computed summaryStatusBadge result (a RelatedItem carries one). */
export function SummaryBadgeText({ badge }: { badge: ReturnType<typeof summaryStatusBadge> }) {
  if (!badge) return null;
  return (
    <span
      className={`summary-badge ml-2 font-mono text-[11px] normal-case tracking-normal ${
        badge.kind === "pending" ? "text-amber-800" : "text-ink-soft"
      }`}
      title={badge.title}
    >
      {badge.label}
    </span>
  );
}
