/**
 * Public dates (Sprint 5, 10 Oct 2026, src/lib/dates.ts): an instant is read
 * on the America/Denver calendar, a date-only value is a calendar day and is
 * never shifted. The snapshot that read "10 Oct 2026" while it was still the
 * evening of 9 Oct in Colorado is the case this exists for.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatApDate,
  formatDayMonthYear,
  isDateOnly,
  publicDateKey,
  publicDateParts,
} from "../src/lib/dates";
import { sourceStatusLine } from "../src/lib/reader-nav";

test("an instant is read in America/Denver: 03:46 UTC on 10 Oct is still 9 Oct in Colorado", () => {
  assert.equal(formatDayMonthYear("2026-10-10T03:46:43Z"), "9 Oct 2026");
  assert.equal(publicDateKey("2026-10-10T03:46:43Z"), "2026-10-09");
  // Six hours behind in October (MDT), so 06:00 UTC is midnight and the new day begins.
  assert.equal(publicDateKey("2026-10-10T05:59:59Z"), "2026-10-09");
  assert.equal(publicDateKey("2026-10-10T06:00:00Z"), "2026-10-10");
  // An offset in the string is honoured: 22:00 on the 9th in Colorado is 04:00 UTC on the 10th.
  assert.equal(publicDateKey("2026-10-09T22:00:00-06:00"), "2026-10-09");
});

test("the zone follows daylight saving: seven hours behind in winter, six in summer", () => {
  assert.equal(publicDateKey("2026-01-05T06:59:59Z"), "2026-01-04");
  assert.equal(publicDateKey("2026-01-05T07:00:00Z"), "2026-01-05");
  assert.equal(publicDateKey("2026-07-05T05:59:59Z"), "2026-07-04");
  assert.equal(publicDateKey("2026-07-05T06:00:00Z"), "2026-07-05");
  // Daylight time ends at 08:00 UTC on 1 Nov 2026; from then on it is seven hours behind.
  assert.equal(publicDateKey("2026-11-01T07:30:00Z"), "2026-11-01");
  assert.equal(publicDateKey("2026-11-02T06:59:59Z"), "2026-11-01");
  assert.equal(publicDateKey("2026-11-02T07:00:00Z"), "2026-11-02");
});

test("a date-only value is a calendar day: it is printed as written, never shifted to the day before", () => {
  assert.equal(isDateOnly("2026-10-10"), true);
  assert.equal(isDateOnly("2026-10-10T00:00:00Z"), false);
  assert.deepEqual(publicDateParts("2026-10-10"), { year: 2026, month: 10, day: 10 });
  assert.equal(publicDateKey("2026-10-10"), "2026-10-10");
  // UTC midnight of the same day, read as an instant, IS the evening before in Denver; that is the
  // difference between the two kinds of value, and a bare date must not take the second path.
  assert.equal(publicDateKey("2026-10-10T00:00:00Z"), "2026-10-09");
  assert.equal(formatDayMonthYear("2026-10-10"), "10 Oct 2026");
  assert.equal(formatApDate("2026-01-01"), "Jan 1, 2026");
  assert.equal(formatApDate("2026-09-22"), "Sept 22, 2026");
  assert.equal(formatApDate(" 2026-09-22 "), "Sept 22, 2026");
});

test("anything that is not a date formats as nothing", () => {
  for (const bad of [null, undefined, "", "   ", "garbage", "2026-02-31", "2026-13-01", "10/09/2026x"]) {
    assert.equal(publicDateParts(bad), null, String(bad));
    assert.equal(publicDateKey(bad), null, String(bad));
    assert.equal(formatDayMonthYear(bad), "", String(bad));
    assert.equal(formatApDate(bad), "", String(bad));
  }
});

test("the AP month names: Sept, June, July; the others abbreviated", () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  months.forEach((m, i) => {
    const mm = String(i + 1).padStart(2, "0");
    assert.equal(formatApDate(`2026-${mm}-15`), `${m} 15, 2026`);
  });
});

test("the reader's date line: a `date` column prints as written, a timestamp as its Colorado day", () => {
  const dates = { "7": { kind: "effective", date: "2026-07-15" } } as const;
  assert.equal(sourceStatusLine("7", "2026-10-08", dates), "Current through 07/15/2026 · source checked 10/08/2026");
  // The same instant at two hours: evening of the 8th in Colorado, then the 9th.
  assert.equal(sourceStatusLine("7", "2026-10-09T03:00:00Z", dates), "Current through 07/15/2026 · source checked 10/08/2026");
  assert.equal(sourceStatusLine("7", "2026-10-09T07:00:00Z", dates), "Current through 07/15/2026 · source checked 10/09/2026");
  assert.equal(sourceStatusLine("nope", "2026-10-08", dates), "Source checked 10/08/2026");
  assert.equal(sourceStatusLine("nope", "2026-02-31", dates), null);
});
