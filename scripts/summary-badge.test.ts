/**
 * The review-status badge every summary carries (owner decisions, Brody,
 * 29 Sep 2026 and 4 Oct 2026): the pure helper's four rows, the reader
 * panel's markup, and the tooltip the browser adds to it. Since 4 Oct 2026
 * the checked state reads "AI reviewed", never a bare "Reviewed": no
 * summary on the site claims human review.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  formatReviewedDate,
  SUMMARY_BADGE_TITLES,
  summaryPanelHtml,
  summaryStatusBadge,
} from "../src/lib/regulation-pure";
import { fillSummaryBadges, readReaderModel } from "../src/lib/reader-client";
import { renderDocHtml } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

const REVIEWED_TITLE =
  "Checked against the official text by an automated second review. The official text controls; see the Disclaimer page.";
const PENDING_TITLE = "Generated from the official text and not yet checked. Read the official text.";

test("approved or edited: 'AI reviewed · <date>' with reviewed_at as MMM d, yyyy", () => {
  assert.deepEqual(summaryStatusBadge({ summary_status: "approved", reviewed_at: "2026-09-17T18:04:10.123+00:00" }), {
    kind: "reviewed",
    label: "AI reviewed · Sept 17, 2026",
    title: REVIEWED_TITLE,
  });
  assert.deepEqual(summaryStatusBadge({ summary_status: "edited", reviewed_at: "2026-09-13T05:33:22.912Z" }), {
    kind: "reviewed",
    label: "AI reviewed · Sept 13, 2026",
    title: REVIEWED_TITLE,
  });
});

test("approved with a null reviewed_at: 'AI reviewed' alone, never an empty date", () => {
  assert.deepEqual(summaryStatusBadge({ summary_status: "approved", reviewed_at: null }), {
    kind: "reviewed",
    label: "AI reviewed",
    title: REVIEWED_TITLE,
  });
  assert.equal(summaryStatusBadge({ summary_status: "edited", reviewed_at: "not a date" })!.label, "AI reviewed");
});

test("no badge, in any state, opens with the bare word 'Reviewed' (owner decision, 4 Oct 2026)", () => {
  // Every status x date combination the helper can see. A label that starts
  // "Reviewed" would read as human review, which the site no longer claims.
  const dates = [null, undefined, "", "not a date", "2026-09-17T18:04:10Z", "2026-10-04T15:19:48.366041+00:00"];
  const statuses = ["approved", "edited", "pending", "rejected", null, undefined, "something-else"];
  let seen = 0;
  for (const summary_status of statuses) {
    for (const reviewed_at of dates) {
      const badge = summaryStatusBadge({ summary_status, reviewed_at } as Parameters<typeof summaryStatusBadge>[0]);
      if (!badge) continue;
      seen++;
      assert.doesNotMatch(badge.label, /^Reviewed\b/, `label for ${summary_status}/${reviewed_at}`);
      assert.doesNotMatch(badge.title, /^Reviewed\b/);
      assert.ok(badge.label.startsWith("AI reviewed") || badge.label.startsWith("AI-generated"), badge.label);
      // The tooltip never claims a person looked, and never names a reviewer.
      assert.doesNotMatch(badge.title, /human|person|founder|reviewed by/i);
    }
  }
  assert.ok(seen > 0);
  // The two tooltips, as shipped to the browser table too.
  for (const title of Object.values(SUMMARY_BADGE_TITLES)) assert.doesNotMatch(title, /^Reviewed\b/);
});

test("pending (or no status at all): 'AI-generated · not yet reviewed'", () => {
  const pending = { kind: "pending", label: "AI-generated · not yet reviewed", title: PENDING_TITLE };
  assert.deepEqual(summaryStatusBadge({ summary_status: "pending", reviewed_at: null }), pending);
  // A pending row keeps reviewed_at from an earlier pass: the date is not shown.
  assert.deepEqual(summaryStatusBadge({ summary_status: "pending", reviewed_at: "2026-09-13T05:33:22.912Z" }), pending);
  assert.deepEqual(summaryStatusBadge({ summary_status: null, reviewed_at: null }), pending);
  assert.deepEqual(summaryStatusBadge({}), pending);
});

test("rejected: no badge (the summary is withheld everywhere)", () => {
  assert.equal(summaryStatusBadge({ summary_status: "rejected", reviewed_at: "2026-09-13T05:33:22.912Z" }), null);
});

test("the tooltips are the agreed wording and name the Disclaimer page", () => {
  assert.equal(SUMMARY_BADGE_TITLES.reviewed, REVIEWED_TITLE);
  assert.equal(SUMMARY_BADGE_TITLES.pending, PENDING_TITLE);
});

test("formatReviewedDate: AP-style month, UTC date, '' for nothing", () => {
  assert.equal(formatReviewedDate("2026-09-22T01:06:57.401013+00:00"), "Sept 22, 2026");
  assert.equal(formatReviewedDate("2026-01-05T00:00:00Z"), "Jan 5, 2026");
  assert.equal(formatReviewedDate("2026-06-30T23:59:59Z"), "June 30, 2026");
  // Late evening in Denver is already the next day in UTC; the date is UTC.
  assert.equal(formatReviewedDate("2026-03-01T06:30:00+00:00"), "Mar 1, 2026");
  assert.equal(formatReviewedDate(null), "");
  assert.equal(formatReviewedDate(undefined), "");
  assert.equal(formatReviewedDate(""), "");
});

const base = {
  ai_summary: "A plain-English summary.\n\nSecond paragraph.",
  source_url: "https://example.gov/reg",
};

test("summaryPanelHtml: the badge is the first element in .summary-body, text and state class only", () => {
  const reviewed = summaryPanelHtml({ ...base, summary_status: "approved", reviewed_at: "2026-09-17T18:04:10Z" });
  assert.equal(
    reviewed,
    `<details class="summary-panel"><summary>Plain-English summary</summary>` +
      `<div class="summary-body"><p class="summary-badge is-reviewed">AI reviewed · Sept 17, 2026</p>` +
      `<p>A plain-English summary.</p><p>Second paragraph.</p></div>` +
      `<div class="summary-status"></div></details>`
  );
  const pending = summaryPanelHtml({ ...base, summary_status: "pending", reviewed_at: null });
  assert.ok(pending.includes(`<div class="summary-body"><p class="summary-badge is-pending">AI-generated · not yet reviewed</p><p>`));
  // No tooltip and no reviewer in the shipped string: the browser adds the title.
  assert.ok(!reviewed.includes("title="));
  assert.ok(!pending.includes("title="));
});

test("summaryPanelHtml: rejected and empty summaries render no panel, so no badge", () => {
  assert.equal(summaryPanelHtml({ ...base, summary_status: "rejected", reviewed_at: "2026-09-17T18:04:10Z" }), "");
  assert.equal(summaryPanelHtml({ ...base, ai_summary: null, summary_status: "approved", reviewed_at: "2026-09-17T18:04:10Z" }), "");
  assert.equal(summaryPanelHtml({ ...base, ai_summary: "  \n\n ", summary_status: "pending", reviewed_at: null }), "");
});

function row(id: string, parent_id: string | null, extra: Partial<Provision> = {}): Provision {
  return {
    id,
    citation: id.split("-").pop()!,
    title: id,
    jurisdiction_level: "state",
    issuing_body: "TEST",
    parent_id,
    full_text: `<p>${id}</p>`,
    ai_summary: null,
    source_url: null,
    last_verified_date: null,
    is_public: false,
    sort_order: 0,
    summary_status: null,
    reviewed_at: null,
    ...extra,
  };
}

test("fillSummaryBadges: the browser sets each badge's tooltip from its state class, once", () => {
  const all = [
    row("sec-t-top-REG-t", null, { source_url: "https://example.gov/t" }),
    row("sec-t-A-PART-A", "sec-t-top-REG-t", { ai_summary: "Checked.", summary_status: "approved", reviewed_at: "2026-09-17T18:04:10Z" }),
    row("sec-t-A-I", "sec-t-A-PART-A", { ai_summary: "Not yet.", summary_status: "pending" }),
    row("sec-t-A-II", "sec-t-A-PART-A", { ai_summary: "Withheld.", summary_status: "rejected", reviewed_at: "2026-09-17T18:04:10Z" }),
    row("sec-t-A-III", "sec-t-A-PART-A"),
  ];
  const dom = new JSDOM(`<!doctype html><div id="doc">${renderDocHtml(all)}</div>`);
  const doc = dom.window.document.getElementById("doc")!;
  const model = readReaderModel(doc);
  const badges = () => Array.from(doc.querySelectorAll(".summary-badge")).map((b) => [b.textContent, b.getAttribute("title")]);
  assert.deepEqual(badges(), [
    ["AI reviewed · Sept 17, 2026", null],
    ["AI-generated · not yet reviewed", null],
  ]);
  fillSummaryBadges(model);
  assert.deepEqual(badges(), [
    ["AI reviewed · Sept 17, 2026", REVIEWED_TITLE],
    ["AI-generated · not yet reviewed", PENDING_TITLE],
  ]);
  // Every panel body opens with its badge; the rejected and empty rows have no panel at all.
  for (const body of Array.from(doc.querySelectorAll(".summary-body"))) {
    assert.ok(body.firstElementChild?.classList.contains("summary-badge"), "badge first");
  }
  assert.equal(doc.querySelectorAll("details.summary-panel").length, 2);
  // Idempotent: a second pass changes nothing.
  fillSummaryBadges(model);
  assert.equal(doc.querySelectorAll(".summary-badge[title]").length, 2);
});
