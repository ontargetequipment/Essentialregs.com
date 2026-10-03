/**
 * Page-side folding of the changelog_public() rows (one per Denver day,
 * regulation and change type -- see
 * supabase/migrations/20261003160524_changelog_public_rpc.sql) into one line
 * per regulation per day: "Regulation 7 — 1,496 provisions updated · 212
 * summaries reviewed". Pure, dependency-free; the rows carry counts only,
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
  /** Summaries a reviewer approved as-is or corrected. */
  reviewed: number;
  /** Of those, the ones the reviewer corrected before approving. */
  corrected: number;
  /** Summaries rewritten by the pipeline (back in the review queue). */
  regenerated: number;
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
        reviewed: 0,
        corrected: 0,
        regenerated: 0,
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
      case "summary_approved":
        line.reviewed += n;
        break;
      case "summary_edited":
        line.reviewed += n;
        line.corrected += n;
        break;
      case "summary_regenerated":
        line.regenerated += n;
        break;
      default:
        // Unknown or internal change type: not a customer-facing event.
        break;
    }
    if (row.latest > line.latest) line.latest = row.latest;
  }
  return Array.from(lines.values())
    .filter((l) => l.textUpdated + l.added + l.reviewed + l.regenerated > 0)
    .sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}

const COUNT = new Intl.NumberFormat("en-US");

function plural(n: number, one: string, many: string): string {
  return `${COUNT.format(n)} ${n === 1 ? one : many}`;
}

/**
 * The customer-facing phrases for one line, in the order a reader cares
 * about them: what changed in the official text first, then what happened
 * to the summaries. Empty when the line has nothing to say.
 */
export function describeLine(line: ChangelogLine): string[] {
  const parts: string[] = [];
  if (line.textUpdated > 0) parts.push(`${plural(line.textUpdated, "provision", "provisions")} updated`);
  if (line.added > 0) parts.push(`${plural(line.added, "provision", "provisions")} added`);
  if (line.reviewed > 0) {
    const reviewed = `${plural(line.reviewed, "summary", "summaries")} reviewed`;
    parts.push(line.corrected > 0 ? `${reviewed} (${COUNT.format(line.corrected)} corrected)` : reviewed);
  }
  if (line.regenerated > 0) parts.push(`${plural(line.regenerated, "summary", "summaries")} rewritten, awaiting review`);
  return parts;
}
