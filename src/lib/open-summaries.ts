/**
 * Which summary panels a visitor opened on the preview pages (v3.1, 13 Oct
 * 2026), so the way back re-opens them. The walkthrough's step 6 opens
 * I.C.1.a's summary on the I.C.1 preview; step 7 leaves for the I.D preview;
 * step 8's Back lands on I.C.1 again, and until now with every panel shut.
 *
 * Kept in sessionStorage under OPEN_SUMMARIES_KEY as a JSON array of the
 * provision ids whose panel is open, in the order they were opened, newest
 * last (PreviewSummaryMemory.tsx writes it on every toggle and re-opens the
 * listed panels on arrival). The walkthrough clears it with its trails: on
 * Restart, Skip, End tour, Explore and the trial click (ReaderTour's
 * resetTrails), and at a fresh start. No server change: the ids never leave
 * the browser.
 *
 * Pure: scripts/open-summaries.test.ts.
 */
import { validProvisionId } from "@/lib/reader-nav";

export const OPEN_SUMMARIES_KEY = "er:open-summaries";

/** More than this many remembered panels is not a reading session; the oldest go first. */
export const OPEN_SUMMARIES_MAX = 50;

/** The stored list, or [] for nothing, junk, or anything that is not an array of provision ids. */
export function parseOpenSummaries(raw: string | null | undefined): string[] {
  if (typeof raw !== "string" || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  for (const v of parsed) {
    const id = typeof v === "string" ? validProvisionId(v) : null;
    if (id && !out.includes(id)) out.push(id);
  }
  return out.slice(-OPEN_SUMMARIES_MAX);
}

/** The list after provision `id`'s panel was opened (`open` true: moved to the end) or closed (removed). */
export function withOpenSummary(ids: readonly string[], id: string, open: boolean): string[] {
  const rest = ids.filter((x) => x !== id);
  return open ? [...rest, id].slice(-OPEN_SUMMARIES_MAX) : rest;
}
