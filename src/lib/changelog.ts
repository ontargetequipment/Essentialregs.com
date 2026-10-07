import { createClient } from "@/lib/supabase/server";
import type { ChangelogCountRow } from "@/lib/changelog-group";

export type { ChangelogCountRow, ChangelogLine, ChangelogSection } from "@/lib/changelog-group";
export {
  CHANGELOG_SECTIONS,
  SUMMARY_QUALITY_EXPLANATION,
  describeLine,
  describeSection,
  foldChangelog,
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
 * The customer-facing changelog: counts by Denver day, regulation and change
 * type from changelog_public() (see
 * supabase/migrations/20261003160524_changelog_public_rpc.sql). The function
 * is security definer and granted to `anon`, so a logged-out visitor sees
 * the same page a subscriber does; it returns no notes and no ids, so the
 * pipeline's and the reviewers' working log stays in the database.
 */
export async function fetchChangelog(): Promise<ChangelogCountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("changelog_public");
  if (error) throw new Error(error.message);
  return (data ?? []) as ChangelogCountRow[];
}
