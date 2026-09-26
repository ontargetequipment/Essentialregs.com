/**
 * Page-side collapsing of the importer's changelog rows. Every re-import
 * writes one `text_updated` row per provision whose text changed (the
 * provisions_log_text_updated trigger), so a single Regulation 3 import
 * leaves ~2,000 identical "Regulatory text updated" lines. /changelog folds
 * them into one line per regulation per day ("Regulation 3 — 2,105
 * provisions updated"). Pure, dependency-free: no schema change, no
 * migration, nothing deleted; the rows are only grouped for display.
 */
import { regKeyOf } from "@/lib/regulation-names";

export type TextUpdateRow = {
  provision_id: string | null;
  created_at: string;
};

export type TextUpdateGroup = {
  /** Calendar day (the caller's date key, e.g. "2026-09-16" in Denver). */
  dateKey: string;
  /** The regulation the provisions belong to, or null when the provision row is gone. */
  regKey: string | null;
  /** Distinct provisions updated that day -- a provision touched twice counts once. */
  provisionCount: number;
  /** ISO timestamp of the most recent row in the group. */
  latest: string;
};

/**
 * Groups `text_updated` rows by (day, regulation). `dateKeyOf` turns a
 * timestamp into the day it belongs to (denverDateKey in changelog.ts).
 * Groups come back newest first, by their latest row.
 */
export function groupTextUpdates(
  rows: TextUpdateRow[],
  dateKeyOf: (iso: string) => string
): TextUpdateGroup[] {
  const groups = new Map<string, { dateKey: string; regKey: string | null; ids: Set<string>; latest: string }>();
  for (const row of rows) {
    const dateKey = dateKeyOf(row.created_at);
    const regKey = row.provision_id ? regKeyOf(row.provision_id) : null;
    const key = `${dateKey}\u0000${regKey ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { dateKey, regKey, ids: new Set(), latest: row.created_at };
      groups.set(key, g);
    }
    // A cascade-deleted provision has no id left to count; count the row.
    g.ids.add(row.provision_id ?? `\u0000${g.ids.size}`);
    if (row.created_at > g.latest) g.latest = row.created_at;
  }
  return Array.from(groups.values())
    .map((g) => ({ dateKey: g.dateKey, regKey: g.regKey, provisionCount: g.ids.size, latest: g.latest }))
    .sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}
