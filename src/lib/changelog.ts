import { createClient } from "@/lib/supabase/server";

/** Human-readable label for each provision_changes.change_type value. */
const CHANGE_TYPE_LABELS: Record<string, string> = {
  summary_approved: "Summary reviewed and approved",
  summary_edited: "Summary edited by a reviewer",
  summary_rejected: "Summary rejected",
  text_updated: "Regulatory text updated",
  added: "Added",
};

export function changeTypeLabel(changeType: string): string {
  return CHANGE_TYPE_LABELS[changeType] ?? changeType;
}

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

/** Grouping key for a timestamptz, by calendar date in America/Denver. */
export function denverDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Display label for a denverDateKey group header, e.g. "September 12, 2026". */
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

/** Display time for one change row, e.g. "2:14 PM". */
export function denverTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** The "{reg}" segment of an id shaped like "sec-{reg}-...", or null. */
export function regKeyOf(id: string): string | null {
  return id.match(/^sec-([^-]+)-/)?.[1] ?? null;
}

export type ProvisionChangeRow = {
  id: number;
  change_type: string;
  note: string | null;
  created_at: string;
  provisions: { id: string; citation: string; title: string } | null;
};

/**
 * Most recent provision_changes rows, joined to their provision's
 * citation/title. Reads through the cookie-scoped client, so RLS decides
 * what comes back: an anonymous visitor gets zero rows (provision_changes
 * has no `anon` select policy — see supabase/migrations/004_review.sql),
 * any signed-in user gets everything.
 */
export async function fetchRecentChanges(limit = 50): Promise<ProvisionChangeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provision_changes")
    .select("id, change_type, note, created_at, provisions(id, citation, title)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProvisionChangeRow[];
}
