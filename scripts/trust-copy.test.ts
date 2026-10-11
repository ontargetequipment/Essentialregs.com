/**
 * Trust copy pass (9 Oct 2026, outside reviewer's fifth review): federal
 * wording, the reader's "current through / source checked" line, the
 * suppressed empty summary, the initial-import changelog line and the
 * test-method heading repeat.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangelogBody } from "../src/components/ChangelogBody";
import { isFederalKey, sourceLinkTextFor, textLabelFor, summaryPanelHtml, summaryParagraphs } from "../src/lib/regulation-pure";
import { summarySourceLinkHtml } from "../src/lib/snippet";
import { sourceStatusLine } from "../src/lib/reader-nav";
import { renderReaderBody } from "../src/lib/reader-render";
import { LINKS_EXPLANATION, SUMMARY_QUALITY_EXPLANATION, buildChangelogView, describeLine, foldChangelog, summaryDayTotal, type ChangelogCountRow } from "../src/lib/changelog-group";
import { AI_CHECKED_LABEL, SUMMARY_BADGE_TITLES, summaryStatusBadge } from "../src/lib/regulation-pure";
import { previewSummary } from "../src/lib/provision-preview";
import { TEST_METHODS, titleWithoutMethodName } from "../src/data/test-methods";
import type { Provision } from "../src/lib/types";

test("federal documents say 'Regulatory text' and 'Verify on eCFR'; Colorado keeps its wording", () => {
  for (const k of ["oooo", "ooooa", "oooob", "ooooc", "jjjj", "iiii", "zzzz", "p192", "OOOO"]) {
    assert.equal(isFederalKey(k), true, k);
    assert.equal(textLabelFor(k), "Regulatory text");
    assert.equal(sourceLinkTextFor(k), "Verify on eCFR");
  }
  for (const k of ["7", "3", "gp01", "ecmc", null, undefined]) {
    assert.equal(textLabelFor(k), "Official text");
    assert.equal(sourceLinkTextFor(k), "View official source");
  }
  assert.match(summarySourceLinkHtml("https://www.ecfr.gov/x", true), />Verify on eCFR ↗<\/a>$/);
  assert.match(summarySourceLinkHtml("https://example.gov/x"), />View official source ↗<\/a>$/);
});

function row(id: string, parent_id: string | null, extra: Partial<Provision> = {}): Provision {
  return {
    id,
    citation: id.split("-").pop()!,
    title: id,
    jurisdiction_level: "federal",
    issuing_body: "EPA",
    parent_id,
    full_text: `<p>${id}</p>`,
    ai_summary: null,
    source_url: "https://www.ecfr.gov/current/title-40/part-60/subpart-OOOO",
    last_verified_date: "2026-10-08",
    is_public: false,
    sort_order: 0,
    summary_status: null,
    reviewed_at: null,
    ...extra,
  };
}

test("the reader root says 'Verify on eCFR' for a federal document and carries the date line", () => {
  const fed = renderReaderBody([row("sec-oooo-top-REG-oooo", null)])!;
  assert.match(fed.docHtml, /class="reg-source-link">Verify on eCFR ↗<\/a>/);
  assert.equal(fed.dateLine, "Current through 10/06/2026 · source checked 10/08/2026");
  const co = renderReaderBody([row("sec-7-top-REG-7", null, { source_url: "https://sos.example/7", last_verified_date: null })])!;
  assert.match(co.docHtml, /class="reg-source-link">View official source ↗<\/a>/);
  assert.match(co.dateLine ?? "", /^Current through \d\d\/\d\d\/\d{4}$/);
});

test("sourceStatusLine: both halves, either half, neither", () => {
  const dates = { "7": { kind: "effective", date: "2026-07-15" } } as const;
  assert.equal(sourceStatusLine("7", "2026-10-08", dates), "Current through 07/15/2026 · source checked 10/08/2026");
  assert.equal(sourceStatusLine("7", "2026-10-08T12:00:00Z", dates), "Current through 07/15/2026 · source checked 10/08/2026");
  assert.equal(sourceStatusLine("7", null, dates), "Current through 07/15/2026");
  assert.equal(sourceStatusLine("nope", "2026-10-08", dates), "Source checked 10/08/2026");
  assert.equal(sourceStatusLine("nope", "garbage", dates), null);
  assert.equal(sourceStatusLine(null, null, dates), null);
});

test("an empty or whitespace-only summary renders no 'Plain-English summary' block anywhere", () => {
  for (const ai_summary of ["", "   ", "\n\n \n", "**", "``` \n```", null]) {
    assert.deepEqual(summaryParagraphs(ai_summary ?? ""), [], JSON.stringify(ai_summary));
    assert.equal(summaryPanelHtml({ ai_summary, summary_status: "approved", reviewed_at: null, source_url: null }), "");
    assert.equal(previewSummary({ ai_summary, summary_status: "approved", reviewed_at: null }), null);
  }
  const html = renderReaderBody([
    row("sec-oooo-top-REG-oooo", null),
    row("sec-oooo-A-PART-A", "sec-oooo-top-REG-oooo", { ai_summary: "  \n ", summary_status: "approved" }),
  ])!.docHtml;
  assert.ok(!html.includes("Plain-English summary"));
});

test("the OOOO initial import reads as one, other days keep 'corrections'", () => {
  const lines = foldChangelog([
    { day: "2026-10-07", reg_key: "oooo", change_type: "transcription_corrected", provision_count: 725, latest: "2026-10-08T03:20:11Z" },
    { day: "2026-10-12", reg_key: "oooo", change_type: "transcription_corrected", provision_count: 3, latest: "2026-10-12T20:00:00Z" },
    { day: "2026-10-08", reg_key: "7", change_type: "transcription_corrected", provision_count: 5, latest: "2026-10-08T20:00:00Z" },
  ]);
  const by = (day: string, reg: string) => lines.find((l) => l.dateKey === day && l.regKey === reg)!;
  assert.deepEqual(describeLine(by("2026-10-07", "oooo")), ["Initial OOOO import normalized and checked against eCFR across 725 provisions"]);
  assert.deepEqual(describeLine(by("2026-10-12", "oooo")), ["corrections to our copy of the text in 3 provisions"]);
  assert.deepEqual(describeLine(by("2026-10-08", "7")), ["corrections to our copy of the text in 5 provisions"]);
});

test("a test-method title drops its leading repeat of the name; the data has no double period", () => {
  assert.equal(titleWithoutMethodName("Method 1", "Method 1—Sample and Velocity Traverses for Stationary Sources"), "Sample and Velocity Traverses for Stationary Sources");
  assert.equal(titleWithoutMethodName("Method 1", "Method 1A—Sample and Velocity Traverses"), "Method 1A—Sample and Velocity Traverses");
  assert.equal(titleWithoutMethodName("Method 320", "Test Method 320—Measurement of Vapor Phase Organic"), "Measurement of Vapor Phase Organic");
  assert.equal(titleWithoutMethodName("Method 5", "Determination of X"), "Determination of X");
  assert.equal(titleWithoutMethodName("Method 5", "Method 5—"), "Method 5—");
  for (const m of TEST_METHODS) {
    const t = titleWithoutMethodName(m.shortName, m.officialTitle);
    assert.ok(!t.startsWith(m.shortName), `${m.slug}: "${t}"`);
    for (const f of [m.measures, m.principle, m.equipment, m.whenCited, m.readerNotes ?? ""]) {
      assert.ok(!/[^.]\.\.(?!\.)/.test(f), `${m.slug}: double period`);
    }
  }
});

// ---- "AI reviewed" is gone from every user-visible string (11 Oct 2026) ----
//
// The badge stopped saying "AI reviewed" on 9 Oct 2026 because a reader took
// it to mean someone had reviewed the summary ("AI-generated · automated
// check against source text"). The changelog, the tooltips and the trust
// pages still did on 11 Oct. History may stay in code comments and in
// identifiers (summary_rewritten_reviewed, rewrittenReviewed); what a
// visitor reads may not say it.

const AI_REVIEWED = /\bAI[\s-]+review(?:ed|s)?\b/i;

/** One row of every change type the changelog has words for, so every phrase is rendered. */
const EVERY_CHANGE: ChangelogCountRow[] = [
  "text_updated",
  "links_updated",
  "added",
  "removed",
  "source_version_changed",
  "transcription_corrected",
  "duplicate_removed",
  "summary_approved",
  "summary_edited",
  "summary_rewritten_reviewed",
  "summary_rewritten_corrected",
  "summary_rewritten_reviewed_later",
  "summary_rewritten_pending",
  "summary_regenerated",
].flatMap((change_type, i) => [
  { day: "2026-10-06", reg_key: "7", change_type, provision_count: 3 + i, latest: `2026-10-06T0${i % 10}:00:00Z` },
  { day: "2026-10-05", reg_key: "gp08", change_type, provision_count: 1, latest: `2026-10-05T0${i % 10}:00:00Z` },
]);

test("the rendered changelog never says 'AI reviewed' (every change type, loaded and empty)", () => {
  const loaded = buildChangelogView({ rows: EVERY_CHANGE, computedAt: null, source: "snapshot", error: null }, (d) => d);
  const empty = buildChangelogView({ rows: [], computedAt: null, source: "none", error: "timeout" }, (d) => d);
  for (const view of [loaded, empty]) {
    const html = renderToStaticMarkup(createElement(ChangelogBody, { view }));
    assert.doesNotMatch(html, AI_REVIEWED);
  }
  const html = renderToStaticMarkup(createElement(ChangelogBody, { view: loaded }));
  assert.match(html, /summaries checked against source text/);
  assert.match(html, /rewritten \(checked later\)/);
  assert.ok(html.includes(LINKS_EXPLANATION));
  for (const phrase of [...foldChangelog(EVERY_CHANGE).flatMap(describeLine), summaryDayTotal(foldChangelog(EVERY_CHANGE)), SUMMARY_QUALITY_EXPLANATION, LINKS_EXPLANATION]) {
    assert.doesNotMatch(phrase, AI_REVIEWED, phrase);
  }
});

test("the badge and its tooltips say the agreed short form, never 'AI reviewed'", () => {
  assert.equal(AI_CHECKED_LABEL, "AI-generated \u00b7 automated check against source text");
  const badge = summaryStatusBadge({ summary_status: "approved", reviewed_at: "2026-10-05T18:00:00Z", reviewed_by: "Claude (automated pipeline)" })!;
  assert.equal(badge.compactLabel, AI_CHECKED_LABEL);
  assert.equal(badge.label, `${AI_CHECKED_LABEL} \u00b7 Oct 5, 2026`);
  for (const text of [badge.label, badge.compactLabel, badge.title, ...Object.values(SUMMARY_BADGE_TITLES)]) {
    assert.doesNotMatch(text, AI_REVIEWED);
  }
});

const SRC = join(__dirname, "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Source with its comments removed (block, JSX and line comments; a "//" after a colon is a URL). */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");
}

test("no source file that renders copy says 'AI reviewed' outside a comment (admin pages excepted)", () => {
  const files = walk(SRC).filter((f) => /\.(tsx?|json|md)$/.test(f) && !relative(SRC, f).startsWith(join("app", "admin")));
  assert.ok(files.length > 100, "the scan reads the app");
  const hits: string[] = [];
  for (const file of files) {
    const text = withoutComments(readFileSync(file, "utf8")).replace(/\s+/g, " ");
    const m = AI_REVIEWED.exec(text);
    if (m) hits.push(`${relative(SRC, file)}: ...${text.slice(Math.max(0, m.index - 40), m.index + 40)}...`);
  }
  assert.deepEqual(hits, []);
});

test("the copy-source scan itself sees the old wording and ignores a comment", () => {
  assert.match(withoutComments('const s = "5 summaries AI reviewed";'), AI_REVIEWED);
  assert.match(withoutComments("<p>the summaries AI\n reviewed, corrected</p>").replace(/\s+/g, " "), AI_REVIEWED);
  assert.doesNotMatch(withoutComments("// was AI reviewed\nconst s = 1; /* AI reviewed */ {/* AI review */}"), AI_REVIEWED);
});

test("the Disclaimer anchor the badge links to is kept", () => {
  const disclaimer = readFileSync(join(SRC, "components", "DisclaimerText.tsx"), "utf8");
  assert.match(disclaimer, /REVIEWED_SECTION_ID = "what-reviewed-means"/);
  // The two checked states point at the section; the pending one has nothing to explain yet.
  for (const title of [SUMMARY_BADGE_TITLES.reviewed, SUMMARY_BADGE_TITLES.human]) assert.match(title, /Disclaimer page, \u201cWhat AI-generated means\u201d/);
});
