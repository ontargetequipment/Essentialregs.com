/**
 * Public-facing dates (Sprint 5, 10 Oct 2026). Pure, dependency-free, so the
 * reader, the pages and the unit tests share it.
 *
 * Two kinds of value reach a page, and they must not be formatted alike:
 *
 *   - an INSTANT (a timestamp: "2026-10-10T03:46:43Z", a reviewed_at, the
 *     snapshot's generated time). It is read on the calendar in Colorado,
 *     where every reader of this site lives: America/Denver. The sample
 *     snapshot was stamped 10 Oct 2026 (UTC) when it was still the evening
 *     of 9 Oct in Colorado, and a visitor saw a date from the future.
 *
 *   - a DATE-ONLY value ("2026-10-08", a `date` column such as
 *     last_verified_date, an effective date). It names a calendar day and has
 *     no time to convert. Read as UTC midnight and shifted to Denver it would
 *     print the day before, so it is never passed through a zone: its
 *     year, month and day are used as written.
 *
 * `publicDateParts` tells them apart by shape; every formatter below goes
 * through it.
 */

export const PUBLIC_TIME_ZONE = "America/Denver";

export type DateParts = { year: number; month: number; day: number };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for "YYYY-MM-DD" with nothing after it. */
export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value.trim());
}

const DENVER_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: PUBLIC_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** The calendar day an instant falls on in America/Denver. */
export function denverPartsOf(instant: Date): DateParts {
  const parts = DENVER_PARTS.formatToParts(instant);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/**
 * The calendar day to print for a stored value: a date-only value as
 * written, an instant as its America/Denver day. null for null, "" or
 * anything that is not a date (an impossible day included).
 */
export function publicDateParts(value: string | null | undefined): DateParts | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const m = DATE_ONLY.exec(v);
  if (m) {
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    // Reject 2026-02-31 and the like rather than printing them.
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    return { year, month, day };
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return denverPartsOf(d);
}

/** "YYYY-MM-DD" of the day to print for a value (see publicDateParts), or null. */
export function publicDateKey(value: string | null | undefined): string | null {
  const p = publicDateParts(value);
  if (!p) return null;
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(p.year, 4)}-${pad(p.month, 2)}-${pad(p.day, 2)}`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** AP-style month abbreviations ("Sept", not "Sep"), the wording of the summary badge. */
const AP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "9 Oct 2026" (the sample page's snapshot line); "" for a value that is not a date. */
export function formatDayMonthYear(value: string | null | undefined): string {
  const p = publicDateParts(value);
  return p ? `${p.day} ${SHORT_MONTHS[p.month - 1]} ${p.year}` : "";
}

/** "Sept 17, 2026" (the summary badge); "" for a value that is not a date. */
export function formatApDate(value: string | null | undefined): string {
  const p = publicDateParts(value);
  return p ? `${AP_MONTHS[p.month - 1]} ${p.day}, ${p.year}` : "";
}
