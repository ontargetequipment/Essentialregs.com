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
  /**
   * Provisions whose full_text changed without a change to the visible
   * letters and digits: cross-reference links added or retargeted by a
   * markup-only re-import (change_type 'links_updated', 7 Oct 2026). Not
   * an official-text change.
   */
  linksUpdated: number;
  /** Provisions added to the corpus. */
  added: number;
  /**
   * Provisions removed from the corpus (change_type 'removed', 4 Oct 2026):
   * logged against the surviving parent, one row per removed provision.
   */
  removed: number;
  /**
   * Imports that found the source document's version or effective date
   * changed (change_type 'source_version_changed', 7 Oct 2026): one row per
   * import, logged against the regulation root. With text_updated, added
   * and removed these are the only regulatory changes (owner decision,
   * 7 Oct 2026): the importer re-labels a run's text changes as
   * transcription_corrected unless it also logged one of these.
   */
  sourceVersionChanged: number;
  /**
   * Provisions whose text we corrected to match the official source
   * (change_type 'transcription_corrected'): [sic] markers, equations,
   * extraction errors, the September re-imports over our earlier copy, and
   * rows our copy had that the official text does not. Not an agency change.
   */
  transcriptionCorrected: number;
  /**
   * Provisions removed because they duplicated a document the corpus holds
   * elsewhere (change_type 'duplicate_removed': Regulation 26's copy of
   * Subpart JJJJ, 4 Oct 2026). Not an agency removal.
   */
  duplicateRemoved: number;
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
        linksUpdated: 0,
        added: 0,
        removed: 0,
        sourceVersionChanged: 0,
        transcriptionCorrected: 0,
        duplicateRemoved: 0,
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
      case "links_updated":
        line.linksUpdated += n;
        break;
      case "added":
        line.added += n;
        break;
      case "removed":
        line.removed += n;
        break;
      case "source_version_changed":
        line.sourceVersionChanged += n;
        break;
      case "transcription_corrected":
        line.transcriptionCorrected += n;
        break;
      case "duplicate_removed":
        line.duplicateRemoved += n;
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
      (l) =>
        l.textUpdated +
          l.linksUpdated +
          l.added +
          l.removed +
          l.sourceVersionChanged +
          l.transcriptionCorrected +
          l.duplicateRemoved +
          l.reviewed +
          l.rewrittenReviewed +
          l.rewrittenReviewedLater +
          l.rewrittenPending >
        0
    )
    .sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}

const COUNT = new Intl.NumberFormat("en-US");

function plural(n: number, one: string, many: string): string {
  return `${COUNT.format(n)} ${n === 1 ? one : many}`;
}

/**
 * Documents whose first-ever import is one line of this page, by reg key:
 * the Denver day the import ran, the name the line uses and the source the
 * import was checked against. The data cannot tell a first import from a
 * re-import: finalize_import_changelog() (pipeline/changelog_sources.py)
 * re-labels every run's inserts and text changes the same way
 * (transcription_corrected), so the first import of a new document and a
 * correction to a document we already held fold into the same count. The
 * 9 Oct 2026 review read "Corrections to our copy of the text in 725
 * provisions" under OOOO as a claim that the page had been wrong 725 times;
 * it was the first import. Add an entry here when a new document is
 * imported for the first time (the day is the line's day, in Denver time).
 * A line for that reg on any other day keeps the "corrections" wording.
 */
export const INITIAL_IMPORTS: Readonly<Record<string, { day: string; label: string; source: string }>> = {
  // The day changelog_public() files the 725-row import under (production, 9 Oct 2026).
  oooo: { day: "2026-10-07", label: "OOOO", source: "eCFR" },
};

/** The phrase for a line's transcription_corrected count: an initial import, or corrections to our copy. */
function transcriptionPhrase(line: ChangelogLine): string {
  const n = plural(line.transcriptionCorrected, "provision", "provisions");
  const initial = line.regKey ? INITIAL_IMPORTS[line.regKey.toLowerCase()] : undefined;
  if (initial && initial.day === line.dateKey) {
    return `Initial ${initial.label} import normalized and checked against ${initial.source} across ${n}`;
  }
  return `corrections to our copy of the text in ${n}`;
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
  // Regulatory changes: only what came from the agency (7 Oct 2026). The
  // version line comes first; the provision counts of the same import follow.
  if (line.sourceVersionChanged > 0) parts.push("official text updated to the agency's new version");
  if (line.textUpdated > 0) parts.push(`${plural(line.textUpdated, "provision", "provisions")} updated`);
  if (line.added > 0) parts.push(`${plural(line.added, "provision", "provisions")} added`);
  if (line.removed > 0) parts.push(`${plural(line.removed, "provision", "provisions")} removed`);
  // A markup-only re-import changes links, not official text (7 Oct 2026:
  // "22 provisions updated" for Regulation 7 under an intro that promised
  // agency-source text changes).
  if (line.linksUpdated > 0) parts.push(`links added or updated in ${plural(line.linksUpdated, "provision", "provisions")}`);
  // Our own corrections (7 Oct 2026): never "provisions updated", which
  // reads as an agency change.
  if (line.transcriptionCorrected > 0) parts.push(transcriptionPhrase(line));
  if (line.duplicateRemoved > 0) {
    parts.push(`${plural(line.duplicateRemoved, "provision", "provisions")} removed that duplicated another document in the corpus`);
  }
  // Passes are not logged as changes, so a day on which every logged
  // review was a correction must not read as "98 AI reviewed (98
  // corrected)", which says every reviewed summary was wrong (7 Oct 2026).
  if (line.reviewed > 0) {
    const n = plural(line.reviewed, "summary", "summaries");
    if (line.corrected >= line.reviewed) parts.push(`${n} corrected on AI review`);
    else if (line.corrected > 0) parts.push(`${n} AI reviewed (${COUNT.format(line.corrected)} corrected)`);
    else parts.push(`${n} AI reviewed`);
  }
  // A rewrite reviewed in the same run is one statement (6 Oct 2026 review:
  // the same five GP03 summaries read as both "AI reviewed" and "awaiting
  // AI review"). "Awaiting AI review" is only ever said of summaries that
  // are pending now.
  if (line.rewrittenReviewed > 0) {
    const n = plural(line.rewrittenReviewed, "summary", "summaries");
    if (line.rewrittenCorrected >= line.rewrittenReviewed) parts.push(`${n} rewritten and corrected on AI review`);
    else if (line.rewrittenCorrected > 0) parts.push(`${n} rewritten and AI reviewed (${COUNT.format(line.rewrittenCorrected)} corrected)`);
    else parts.push(`${n} rewritten and AI reviewed`);
  }
  if (line.rewrittenReviewedLater > 0) {
    parts.push(`${plural(line.rewrittenReviewedLater, "summary", "summaries")} rewritten (AI reviewed later)`);
  }
  if (line.rewrittenPending > 0) parts.push(`${plural(line.rewrittenPending, "summary", "summaries")} rewritten, awaiting AI review`);
  return parts;
}

/**
 * The three sections of /changelog (review 4, 7 Oct 2026): what changed in
 * the official text, shown first and open; the links, sources and
 * corrections to our own copy of the text (7 Oct 2026, second review of
 * the page); and the summary work, collapsed to one line per day. A line
 * can appear in more than one section (a regulation re-imported and
 * reviewed the same day).
 */
export type ChangelogSection = "regulatory" | "links" | "summaries";

export const CHANGELOG_SECTIONS: { key: ChangelogSection; title: string; collapsed: boolean }[] = [
  { key: "regulatory", title: "Regulatory changes", collapsed: false },
  { key: "links", title: "Links, sources and transcription", collapsed: false },
  { key: "summaries", title: "Summary quality", collapsed: true },
];

/**
 * The one line "Regulatory changes" shows when no agency change is recorded
 * (the normal state: every text change so far was ours). `sinceLabel` is
 * the earliest day the changelog covers, already formatted
 * ("September 14, 2026"), or null when nothing is recorded at all.
 */
export function regulatoryEmptyLine(sinceLabel: string | null): string {
  const since = sinceLabel ? ` since ${sinceLabel}` : "";
  return `No agency rule changes recorded${since}. Each regulation's page shows its current version and effective date.`;
}

/**
 * The explanation under the "Summary quality" heading. Every statement
 * holds for pipeline/review.py: the pass compares the summary with the
 * official text it was written from, "corrected" is its summary_edited
 * verdict, the reasons it gives are mostly wording-precision ones (the
 * October 2026 tally in docs/CEO_PHASE_PLAN.md), some are factual, and it
 * never writes to full_text.
 */
export const SUMMARY_QUALITY_EXPLANATION =
  "An automated second pass compares each plain-English summary with the official text. \u201cCorrected\u201d means that pass changed the summary. Most corrections make the summary match the rule\u2019s wording more exactly, such as who must act, a condition, or a list that is not exhaustive. Some fix a factual error, such as a deadline or a dropped exception. The official text is never changed by this.";

/** The counts of a line that belong to a section. */
export function sectionTotal(line: ChangelogLine, section: ChangelogSection): number {
  switch (section) {
    case "regulatory":
      return line.textUpdated + line.added + line.removed + line.sourceVersionChanged;
    case "links":
      return line.linksUpdated + line.transcriptionCorrected + line.duplicateRemoved;
    case "summaries":
      return line.reviewed + line.rewrittenReviewed + line.rewrittenReviewedLater + line.rewrittenPending;
  }
}

/** The lines that have something to say in a section, in their original (newest first) order. */
export function sectionLines(lines: ChangelogLine[], section: ChangelogSection): ChangelogLine[] {
  return lines.filter((l) => sectionTotal(l, section) > 0);
}

/**
 * The phrases of one line for one section only: the same words
 * describeLine() uses, split by section so a line read under "Regulatory
 * changes" never mentions its summaries.
 */
export function describeSection(line: ChangelogLine, section: ChangelogSection): string[] {
  const all = describeLine(line);
  const isLinks = (p: string) =>
    p.startsWith("links added or updated") ||
    p.startsWith("corrections to our copy") ||
    p.startsWith("Initial ") ||
    p.includes("duplicated another document");
  const isSummary = (p: string) => /\bsummar(?:y|ies)\b/.test(p);
  switch (section) {
    case "regulatory":
      return all.filter((p) => !isLinks(p) && !isSummary(p));
    case "links":
      return all.filter(isLinks);
    case "summaries":
      return all.filter(isSummary);
  }
}

/**
 * The one line a day gets under "Summary quality" while collapsed:
 * "212 summaries AI reviewed (12 corrected) · 5 rewritten and AI reviewed ·
 * 2 awaiting AI review", summed over the day's regulations.
 */
export function summaryDayTotal(lines: ChangelogLine[]): string {
  const t = { reviewed: 0, corrected: 0, rewrittenReviewed: 0, rewrittenCorrected: 0, later: 0, pending: 0 };
  for (const l of lines) {
    t.reviewed += l.reviewed;
    t.corrected += l.corrected;
    t.rewrittenReviewed += l.rewrittenReviewed;
    t.rewrittenCorrected += l.rewrittenCorrected;
    t.later += l.rewrittenReviewedLater;
    t.pending += l.rewrittenPending;
  }
  const parts: string[] = [];
  if (t.reviewed > 0) {
    const n = plural(t.reviewed, "summary", "summaries");
    parts.push(t.corrected >= t.reviewed ? `${n} corrected on AI review` : t.corrected > 0 ? `${n} AI reviewed (${COUNT.format(t.corrected)} corrected)` : `${n} AI reviewed`);
  }
  if (t.rewrittenReviewed > 0) {
    const n = plural(t.rewrittenReviewed, "summary", "summaries");
    parts.push(
      t.rewrittenCorrected >= t.rewrittenReviewed
        ? `${n} rewritten and corrected on AI review`
        : t.rewrittenCorrected > 0
          ? `${n} rewritten and AI reviewed (${COUNT.format(t.rewrittenCorrected)} corrected)`
          : `${n} rewritten and AI reviewed`
    );
  }
  if (t.later > 0) parts.push(`${plural(t.later, "summary", "summaries")} rewritten (AI reviewed later)`);
  if (t.pending > 0) parts.push(`${plural(t.pending, "summary", "summaries")} rewritten, awaiting AI review`);
  return parts.join(" \u00b7 ");
}

/**
 * What fetchChangelog() hands the page (src/lib/changelog.ts): the count
 * rows and where they came from. `error` is set when neither the stored
 * snapshot nor the live function answered; the page still renders.
 */
export type ChangelogResult = {
  rows: ChangelogCountRow[];
  /** When the rows were computed (the snapshot's computed_at), or null. */
  computedAt: string | null;
  /** "snapshot": the stored counts; "live": the aggregate (snapshot never written); "memory": the last good result this server saw; "none": nothing. */
  source: "snapshot" | "live" | "memory" | "none";
  error: string | null;
};

export type ChangelogDayGroup = { key: string; label: string; lines: ChangelogLine[] };

export type ChangelogSectionView = {
  key: ChangelogSection;
  title: string;
  collapsed: boolean;
  groups: ChangelogDayGroup[];
  /** The one line shown when the section has no groups. */
  emptyLine: string;
};

export type ChangelogView = {
  /** Set when the counts could not be loaded at all: the page says so and shows the sections empty. */
  notice: string | null;
  /** The earliest day recorded, as a key, or null. */
  firstDay: string | null;
  sections: ChangelogSectionView[];
};

export const CHANGELOG_UNAVAILABLE_NOTICE =
  "The changelog could not be loaded right now. The regulations and their summaries are unaffected; try again in a few minutes.";

/** The lines of a section grouped by day, newest first (the lines arrive newest first). */
export function groupByDay(lines: ChangelogLine[], label: (dateKey: string) => string): ChangelogDayGroup[] {
  const groups: ChangelogDayGroup[] = [];
  for (const line of lines) {
    const existing = groups.find((g) => g.key === line.dateKey);
    if (existing) existing.lines.push(line);
    else groups.push({ key: line.dateKey, label: label(line.dateKey), lines: [line] });
  }
  return groups;
}

/**
 * The page's model from a fetch result. Pure: the page passes its date
 * formatter in. With an error and no rows the notice is set and every
 * section renders its empty line; with rows the regulatory section's empty
 * line names the earliest recorded day.
 */
export function buildChangelogView(result: ChangelogResult, label: (dateKey: string) => string): ChangelogView {
  const lines = foldChangelog(result.rows);
  const firstDay = result.rows.reduce<string | null>((min, r) => (min === null || r.day < min ? r.day : min), null);
  const notice = result.error && result.rows.length === 0 ? CHANGELOG_UNAVAILABLE_NOTICE : null;
  const sections = CHANGELOG_SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    collapsed: section.collapsed,
    groups: groupByDay(sectionLines(lines, section.key), label),
    emptyLine:
      section.key === "regulatory" && !notice ? regulatoryEmptyLine(firstDay ? label(firstDay) : null) : "Nothing recorded yet.",
  }));
  return { notice, firstDay, sections };
}
