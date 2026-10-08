import { createClient } from "@/lib/supabase/server";
import type { ChangelogCountRow, ChangelogResult } from "@/lib/changelog-group";

export type { ChangelogCountRow, ChangelogLine, ChangelogResult, ChangelogSection, ChangelogView } from "@/lib/changelog-group";
export {
  CHANGELOG_SECTIONS,
  CHANGELOG_UNAVAILABLE_NOTICE,
  SUMMARY_QUALITY_EXPLANATION,
  buildChangelogView,
  describeLine,
  describeSection,
  foldChangelog,
  regulatoryEmptyLine,
  sectionLines,
  summaryDayTotal,
} from "@/lib/changelog-group";

/**
 * Today's date in America/Denver as "YYYY-MM-DD" — used to stamp
 * `provisions.last_verified_date` (a plain `date` column, not a timestamp)
 * when an admin approves or edits a summary. `en-CA` is a locale trick: its
 * short date format happens to already be YYYY-MM-DD.
 */
export function todayDenver(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Display label for a "YYYY-MM-DD" day key, e.g. "September 12, 2026". */
export function denverDateLabel(dateKey: string): string {
  // Parse as a plain date (noon UTC avoids any DST-adjacent day-shift) rather
  // than re-deriving from a timestamp, so the label always matches the key
  // it's a header for.
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** The "{reg}" segment of an id shaped like "sec-{reg}-...", or null. */
export function regKeyOf(id: string): string | null {
  return id.match(/^sec-([^-]+)-/)?.[1] ?? null;
}

/**
 * The last good result this server instance saw, so a transient database
 * error (the 7 Oct 2026 statement timeout while imports were writing) never
 * empties the page while the instance is warm.
 */
let lastGood: ChangelogResult | null = null;

/** The minimal client surface fetchChangelog() needs; the page passes the real one, tests a fake. */
export type ChangelogClient = {
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type SnapshotRow = { rows: ChangelogCountRow[] | null; computed_at: string | null };

/**
 * The customer-facing changelog: counts by Denver day, regulation and change
 * type. Read from the stored snapshot (changelog_snapshot_public(); one row,
 * refreshed by the pipeline after every write, see
 * supabase/migrations/20261007121000_changelog_snapshot.sql), never from
 * the live changelog_public() aggregate unless the snapshot has never been
 * written. When both fail the result carries the error and the last good
 * rows this instance saw, or none: the page renders either way. Both
 * functions are security definer and granted to `anon`, so a logged-out
 * visitor sees the same page a subscriber does; neither returns notes or ids.
 */
export async function fetchChangelogWith(client: ChangelogClient): Promise<ChangelogResult> {
  const errors: string[] = [];
  try {
    const { data, error } = await client.rpc("changelog_snapshot_public");
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as SnapshotRow | undefined;
    if (row && Array.isArray(row.rows)) {
      lastGood = { rows: row.rows, computedAt: row.computed_at, source: "snapshot", error: null };
      return lastGood;
    }
    errors.push("snapshot not written yet");
  } catch (e) {
    errors.push(`snapshot: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const { data, error } = await client.rpc("changelog_public");
    if (error) throw new Error(error.message);
    lastGood = { rows: (data ?? []) as ChangelogCountRow[], computedAt: null, source: "live", error: null };
    return lastGood;
  } catch (e) {
    errors.push(`live: ${e instanceof Error ? e.message : String(e)}`);
  }
  const error = errors.join("; ");
  if (lastGood) return { ...lastGood, source: "memory", error };
  return { rows: [], computedAt: null, source: "none", error };
}

export async function fetchChangelog(): Promise<ChangelogResult> {
  const supabase = await createClient();
  return fetchChangelogWith(supabase as unknown as ChangelogClient);
}

/** Test seam: forget the last good result. */
export function resetChangelogMemory(): void {
  lastGood = null;
}
