import Link from "next/link";
import { SummaryBadge } from "@/components/SummaryBadge";
import { TRIAL_DAYS } from "@/lib/pricing";
import {
  CLOSED_PERMIT_BADGE,
  isClosedPermit,
  isFederalKey,
  summaryParagraphs,
  titleWithoutCitation,
  type SummaryBadgeInput,
} from "@/lib/regulation-pure";
import { displayCitation } from "@/lib/federal-citation";
import { regBadge } from "@/lib/regulation-names";
import type { SemanticHit } from "@/lib/semantic";

/**
 * The provenance label above prose on a result card. Text, not styling
 * alone, so a reader can tell generated prose from regulatory text at a
 * glance (backlog #16). "Plain-English summary" is the reader panel's own
 * heading, so the vocabulary is one thing everywhere.
 */
export const PROVENANCE_LABEL_CLASS = "font-mono text-eyebrow uppercase text-tag";

/**
 * The line an Ask card prints for a heading-only row (a section, not a
 * provision) in place of its missing summary. `children` is the count of
 * rows whose parent_id is the heading; null when the count failed.
 */
function headingLine(children: number | null): string {
  if (children == null || children === 0) return "Section heading — open it to read the provisions inside.";
  return `Section heading — ${children} ${children === 1 ? "provision" : "provisions"} inside. Open it to read them.`;
}

/** "regulatory text" for a federal document, "official text" for a Colorado one (trust copy pass, 9 Oct 2026). */
export function textNoun(regKey: string | null): string {
  return isFederalKey(regKey) ? "regulatory text" : "official text";
}

/** The review state of a summary, for the badge beside it (and, on the keyword page, the summary itself). */
export type ReviewRow = {
  id: string;
  ai_summary: string | null;
  summary_status: string | null;
  reviewed_at: string | null;
  /** Server only: read to tell a person's approval from the pipeline's; never rendered or serialised. */
  reviewed_by: string | null;
};

/**
 * One row on the Ask page: a retrieval hit, or a question map's canonical
 * provision read from the table. `retrieved` is false for a canonical row
 * retrieval did not return: it has no score, so the card shows none.
 */
export type AskRow = SemanticHit & { retrieved: boolean };

/**
 * The Ask result card. One markup for the flat list and the grouped view
 * (Ask Track B): badge, regulation name, Statement-of-basis and closed-permit
 * badges, match score, breadcrumb, citation, heading, then the summary with
 * its review badge (or the heading-only line). `why` is the map's one-line
 * reason for a canonical row, printed above the summary label.
 *
 * Moved out of /search to this file on 10 Oct 2026 so /sample can render the
 * same card (Sprint 4); /search passes `href={hrefForHit(row)}` and nothing
 * else new, so its output is what it was. The three optional props are the
 * sample's:
 *
 *   href            where the card opens (the sample decides per viewer with
 *                   provisionDestination; /search always opens the reader).
 *   locked          the row is in the full corpus and closed to this viewer:
 *                   the summary is replaced by "In the full corpus — start
 *                   your 7-day trial" and the card links to its focused
 *                   preview. A card with a lock never carries summary text.
 *   noSummaryLine   print nothing where a missing summary would go: the
 *                   sample hydrates summaries only for the rows the visitor
 *                   may read, so "no summary yet" would be untrue for the rest.
 */
export function AskCard({
  row,
  why,
  name,
  review,
  headingChildren,
  href,
  locked = false,
  noSummaryLine = false,
}: {
  row: AskRow;
  why?: string;
  name: string;
  review: SummaryBadgeInput | undefined;
  headingChildren: Map<string, number | null>;
  href: string;
  locked?: boolean;
  noSummaryLine?: boolean;
}) {
  const paras = locked ? [] : summaryParagraphs(row.summary ?? "");
  const badge = regBadge(row.reg_key, row.jurisdiction_level);
  const heading = titleWithoutCitation(row.title, row.citation);
  return (
    <li data-testid={locked ? "locked-result" : undefined}>
      <Link
        href={href}
        className="block rounded-lg border border-line bg-panel p-5 shadow-sm transition hover:border-accent hover:shadow-md"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              badge === "Federal"
                ? "bg-blue-50 text-blue-700"
                : badge === "ECMC"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-accent-soft text-accent"
            }`}
          >
            {badge}
          </span>
          <span className="text-xs text-muted">{name}</span>
          {row.is_basis && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted" title="Rulemaking history: the Commission's explanation of why a rule was adopted, not the rule itself">
              Statement of basis
            </span>
          )}
          {isClosedPermit(row.reg_key) && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted" title={CLOSED_PERMIT_BADGE.title}>
              {CLOSED_PERMIT_BADGE.label}
            </span>
          )}
          {/* Since 20260930003557 a keyword-only row carries its real cosine, so the
              null branch is rare: only a row with no embedding still lands here. A
              canonical map row retrieval did not return has no score at all. */}
          {row.retrieved && (
            <span
              className="ml-auto text-xs tabular-nums text-muted"
              title={
                row.score == null
                  ? "Matched your words; no meaning score available for this provision."
                  : row.keyword_hit
                    ? "Matched your words and your meaning"
                    : "How close this provision's meaning is to your question"
              }
            >
              {row.score == null ? "keyword match" : `${Math.round(row.score * 100)}% match`}
              {row.keyword_hit && row.score != null ? " · words" : ""}
            </span>
          )}
        </div>
        {row.path && <p className="mt-2 text-xs leading-snug text-muted">{row.path}</p>}
        <p className="mt-1 font-mono text-eyebrow uppercase text-tag">
          {displayCitation(row.reg_key, row.citation)}
        </p>
        {heading && (
          <p className="mt-1 font-semibold text-ink">{heading}</p>
        )}
        {why && (
          <p className="mt-2 text-xs leading-snug text-muted">
            <span className="font-medium">Why it&apos;s here:</span> {why}
          </p>
        )}
        {locked ? (
          <p className="mt-3 text-sm font-medium text-ink-soft">
            In the full corpus — start your {TRIAL_DAYS}-day trial
          </p>
        ) : paras.length > 0 ? (
          <>
            <p className={`mt-3 ${PROVENANCE_LABEL_CLASS}`}>
              Plain-English summary
              {review && <SummaryBadge provision={review} />}
            </p>
            <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-ink-soft">{paras[0]}</p>
          </>
        ) : headingChildren.has(row.id) ? (
          <p className="mt-2 text-sm text-muted">{headingLine(headingChildren.get(row.id) ?? null)}</p>
        ) : noSummaryLine ? null : (
          <p className="mt-2 text-sm italic text-muted">No plain-English summary yet — read the {textNoun(row.reg_key)}.</p>
        )}
      </Link>
    </li>
  );
}
