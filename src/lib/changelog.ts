import { createClient } from "@/lib/supabase/server";
import type { TextUpdateRow } from "@/lib/changelog-group";

export type { TextUpdateGroup, TextUpdateRow } from "@/lib/changelog-group";
export { groupTextUpdates } from "@/lib/changelog-group";

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
 *
 * `text_updated` rows (the importer's, one per provision) are left out
 * here and read separately by fetchTextUpdates: at ~5,000 of them the 50
 * most recent changes would otherwise all be importer rows and the human
 * review entries would never make the page.
 */
export async function fetchRecentChanges(limit = 50): Promise<ProvisionChangeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provision_changes")
    .select("id, change_type, note, created_at, provisions(id, citation, title)")
    .neq("change_type", "text_updated")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProvisionChangeRow[];
}

const TEXT_UPDATE_PAGE = 1000;
/** 10,000 rows; the corpus had 4,926 on 2026-09-26. Older rows past the cap are simply not shown. */
const TEXT_UPDATE_MAX_PAGES = 10;

/**
 * Every `text_updated` row (the importer's output), two columns only, for
 * /changelog to fold into one line per regulation per day (groupTextUpdates).
 * Paginates past PostgREST's default 1000-row cap the same way
 * fetchRegulationProvisions does: page 0 alone with the exact count, the
 * remaining pages at once. Same RLS as fetchRecentChanges: anonymous
 * visitors get nothing.
 */
export async function fetchTextUpdates(): Promise<TextUpdateRow[]> {
  const supabase = await createClient();
  const page = (i: number) =>
    supabase
      .from("provision_changes")
      .select("provision_id, created_at", i === 0 ? { count: "exact" } : undefined)
      .eq("change_type", "text_updated")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(i * TEXT_UPDATE_PAGE, (i + 1) * TEXT_UPDATE_PAGE - 1);

  const first = await page(0);
  if (first.error) throw new Error(first.error.message);
  const rows: TextUpdateRow[] = (first.data ?? []) as TextUpdateRow[];
  const total = first.count ?? rows.length;
  const pages = Math.min(Math.ceil(total / TEXT_UPDATE_PAGE), TEXT_UPDATE_MAX_PAGES);
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 1)));
    for (const r of rest) {
      if (r.error) throw new Error(r.error.message);
      rows.push(...((r.data ?? []) as TextUpdateRow[]));
    }
  }
  return rows;
}
