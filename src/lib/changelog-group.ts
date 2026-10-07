/**
 * Page-side folding of the changelog_public() rows (one per Denver day,
 * regulation and change type -- see
 * supabase/migrations/20261003160524_changelog_public_rpc.sql) into one line
 * per regulation per day: "Regulation 7 — 1,496 provisions updated · 212
 * summaries AI reviewed". Since migration 20261007010000 the function
 * reports a summary rewritten and reviewed in the same run as one
 * summary_rewritten_reviewed / summary_rewritten_corrected row (the review
 * is not counted again), an unpaired rewrite as summary_rewritten_pending
 * while it is pending, else summary_rewritten_reviewed_later. Pure,
 * dependency-free; the rows carry counts only,
 * never a note or an id, so nothing here can leak the pipeline's working log.
 */

export type ChangelogCountRow = {
  /** Calendar day in America/Denver, "YYYY-MM-DD". */
  day: string;
  /** The regulation the provisions belong to, or null when the provision row is gone. */
  reg_key: string | null;
  change_type: string;
  provision_count: number;
  /** ISO timestamp of the most recent row in the group. */
  latest: string;
};

export type ChangelogLine = {
  dateKey: string;
  regKey: string | null;
  /** Importer rows: provisions whose official text changed. */
  textUpdated: number;
  /** Provisions added to the corpus. */
  added: number;
  /**
   * Provisions removed from the corpus (change_type 'removed', 4 Oct 2026):
   * logged against the surviving parent, one row per removed provision.
   */
  removed: number;
  /** Summaries the AI second pass approved as-is or corrected. */
  reviewed: number;
  /** Of those, the ones corrected before approving. */
  corrected: number;
  /**
   * Summaries rewritten by the pipeline and AI reviewed in the same run
   * (changelog_public() pairs the rewrite with the review that followed it
   * within 24 hours and reports the pair once, 7 Oct 2026).
   */
  rewrittenReviewed: number;
  /** Of those, the ones the reviewer corrected. */
  rewrittenCorrected: number;
  /** Summaries rewritten whose review came more than a day later (counted on its own day). */
  rewrittenReviewedLater: number;
  /** Summaries rewritten and still awaiting AI review now. */
  rewrittenPending: number;
  /** ISO timestamp of the most recent row folded into the line. */
  latest: string;
};

/**
 * One line per (day, regulation), newest first by the latest row folded in.
 * Change types the page has no words for are dropped rather than shown raw.
 */
export function foldChangelog(rows: ChangelogCountRow[]): ChangelogLine[] {
  const lines = new Map<string, ChangelogLine>();
  for (const row of rows) {
    const key = `${row.day}\u0000${row.reg_key ?? ""}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        dateKey: row.day,
        regKey: row.reg_key,
        textUpdated: 0,
        added: 0,
        removed: 0,
        reviewed: 0,
        corrected: 0,
        rewrittenReviewed: 0,
        rewrittenCorrected: 0,
        rewrittenReviewedLater: 0,
        rewrittenPending: 0,
        latest: row.latest,
      };
      lines.set(key, line);
    }
    const n = Number(row.provision_count) || 0;
    switch (row.change_type) {
      case "text_updated":
        line.textUpdated += n;
        break;
      case "added":
        line.added += n;
        break;
      case "removed":
        line.removed += n;
        break;
      case "summary_approved":
        line.reviewed += n;
        break;
      case "summary_edited":
        line.reviewed += n;
        line.corrected += n;
        break;
      case "summary_rewritten_reviewed":
        line.rewrittenReviewed += n;
        break;
      case "summary_rewritten_corrected":
        line.rewrittenReviewed += n;
        line.rewrittenCorrected += n;
        break;
      case "summary_rewritten_reviewed_later":
        line.rewrittenReviewedLater += n;
        break;
      case "summary_rewritten_pending":
      case "summary_regenerated":
        // summary_regenerated is what changelog_public() returned before
        // migration 20261007010000 split the rewrites by outcome; a page
        // deployed ahead of it still reads the old shape as "awaiting".
        line.rewrittenPending += n;
        break;
      default:
        // Unknown or internal change type: not a customer-facing event.
        break;
    }
    if (row.latest > line.latest) line.latest = row.latest;
  }
  return Array.from(lines.values())
    .filter(
      (l) => l.textUpdated + l.added + l.removed + l.reviewed + l.rewrittenReviewed + l.rewrittenReviewedLater + l.rewrittenPending > 0
    )
    .sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}

const COUNT = new Intl.NumberFormat("en-US");

function plural(n: number, one: string, many: string): string {
  return `${COUNT.format(n)} ${n === 1 ? one : many}`;
}

/**
 * The customer-facing phrases for one line, in the order a reader cares
 * about them: what changed in the official text first, then what happened
 * to the summaries. Empty when the line has nothing to say. Summaries are
 * "AI reviewed", never a bare "reviewed" (owner decision, 4 Oct 2026): the
 * review is the automated second pass, and the changelog must say the same
 * thing as the badge.
 */
export function describeLine(line: ChangelogLine): string[] {
  const parts: string[] = [];
  if (line.textUpdated > 0) parts.push(`${plural(line.textUpdated, "provision", "provisions")} updated`);
  if (line.added > 0) parts.push(`${plural(line.added, "provision", "provisions")} added`);
  if (line.removed > 0) parts.push(`${plural(line.removed, "provision", "provisions")} removed`);
  if (line.reviewed > 0) {
    const reviewed = `${plural(line.reviewed, "summary", "summaries")} AI reviewed`;
    parts.push(line.corrected > 0 ? `${reviewed} (${COUNT.format(line.corrected)} corrected)` : reviewed);
  }
  // A rewrite reviewed in the same run is one statement (6 Oct 2026 review:
  // the same five GP03 summaries read as both "AI reviewed" and "awaiting
  // AI review"). "Awaiting AI review" is only ever said of summaries that
  // are pending now.
  if (line.rewrittenReviewed > 0) {
    const rewritten = `${plural(line.rewrittenReviewed, "summary", "summaries")} rewritten and AI reviewed`;
    parts.push(line.rewrittenCorrected > 0 ? `${rewritten} (${COUNT.format(line.rewrittenCorrected)} corrected)` : rewritten);
  }
  if (line.rewrittenReviewedLater > 0) {
    parts.push(`${plural(line.rewrittenReviewedLater, "summary", "summaries")} rewritten (AI reviewed later)`);
  }
  if (line.rewrittenPending > 0) parts.push(`${plural(line.rewrittenPending, "summary", "summaries")} rewritten, awaiting AI review`);
  return parts;
}
