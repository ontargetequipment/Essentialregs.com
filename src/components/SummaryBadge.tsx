import { summaryStatusBadge, type SummaryBadge as BadgeData, type SummaryBadgeInput } from "@/lib/regulation-pure";

/**
 * The review-status badge beside a card's "Plain-English summary" label:
 * the same wording summaryPanelHtml puts in every reader panel ("AI-generated ·
 * automated check against source text" / "AI-generated · not yet reviewed"),
 * as small text next to the label rather than a line of its own, without
 * the date (compactLabel; the reader panel carries the date). Renders nothing for a
 * rejected summary (the caller has already dropped the prose) and nothing
 * when the row carries no status. A <span> with a title, never a link: the
 * Ask, keyword and related cards are each one <a>, and an anchor cannot
 * nest another. What the label means is on the Disclaimer page
 * (/disclaimer#what-reviewed-means, "What AI-generated means"), which the tooltip names.
 */
export function SummaryBadge({ provision }: { provision: SummaryBadgeInput }) {
  return <SummaryBadgeText badge={summaryStatusBadge(provision)} />;
}

/** The badge from an already-computed summaryStatusBadge result (a RelatedItem carries one). */
export function SummaryBadgeText({ badge }: { badge: BadgeData | null }) {
  if (!badge) return null;
  return (
    <span
      className={`summary-badge ml-2 font-mono text-[11px] normal-case tracking-normal ${
        badge.kind === "pending" ? "text-amber-800" : "text-ink-soft"
      }`}
      title={badge.title}
    >
      {badge.compactLabel}
    </span>
  );
}
