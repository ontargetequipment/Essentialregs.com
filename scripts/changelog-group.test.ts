/**
 * /changelog folds changelog_public()'s count rows (one per day, regulation
 * and change type) into one line per regulation per day, with customer
 * wording (src/lib/changelog-group.ts). Pure grouping, no database.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHANGELOG_SECTIONS,
  CHANGELOG_UNAVAILABLE_NOTICE,
  SUMMARY_QUALITY_EXPLANATION,
  buildChangelogView,
  describeLine,
  describeSection,
  foldChangelog,
  regulatoryEmptyLine,
  sectionLines,
  sectionTotal,
  summaryDayTotal,
} from "../src/lib/changelog-group";

test("one line per regulation per day, newest first, change types folded in", () => {
  const lines = foldChangelog([
    { day: "2026-09-14", reg_key: "7", change_type: "text_updated", provision_count: 1496, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_approved", provision_count: 200, latest: "2026-09-14T03:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_edited", provision_count: 12, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-16", reg_key: "3", change_type: "summary_rewritten_pending", provision_count: 40, latest: "2026-09-16T01:00:00Z" },
    // a cascade-deleted provision has no regulation: grouped under null
    { day: "2026-09-16", reg_key: null, change_type: "text_updated", provision_count: 2, latest: "2026-09-16T03:00:00Z" },
    // the one change type with no customer wording is dropped, not shown raw
    { day: "2026-09-19", reg_key: "7", change_type: "summary_rejected", provision_count: 1, latest: "2026-09-19T01:00:00Z" },
  ]);
  assert.deepEqual(
    lines.map((l) => [l.dateKey, l.regKey, l.textUpdated, l.reviewed, l.corrected, l.rewrittenPending, l.latest]),
    [
      ["2026-09-16", null, 2, 0, 0, 0, "2026-09-16T03:00:00Z"],
      ["2026-09-16", "3", 0, 0, 0, 40, "2026-09-16T01:00:00Z"],
      ["2026-09-14", "7", 1496, 212, 12, 0, "2026-09-14T03:00:00Z"],
    ]
  );
});

test("wording: text first, then summaries; corrected shown inside reviewed", () => {
  const [reg7] = foldChangelog([
    { day: "2026-09-14", reg_key: "7", change_type: "text_updated", provision_count: 1496, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_approved", provision_count: 200, latest: "2026-09-14T03:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_edited", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "added", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 3, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "removed", provision_count: 2, latest: "2026-09-14T01:00:00Z" },
  ]);
  assert.deepEqual(describeLine(reg7), [
    "1,496 provisions updated",
    "1 provision added",
    "2 provisions removed",
    "201 summaries AI reviewed (1 corrected)",
    "3 summaries rewritten, awaiting AI review",
  ]);
});

test("a rewrite reviewed in the same run is one statement (GP03, 6 Oct 2026)", () => {
  // Production before migration 20261007010000: changelog_public() returned
  // summary_regenerated 5, summary_approved 4 and summary_edited 1 for GP03
  // on 2026-10-06 (the chained run rewrote five summaries at 14:54 and
  // reviewed them at 15:01), and the page read "5 summaries AI reviewed (1
  // corrected) · 5 summaries rewritten, awaiting AI review" -- the same five
  // summaries twice, and "awaiting" for summaries that were not. The
  // function now pairs them; the page says it once.
  const [gp03] = foldChangelog([
    { day: "2026-10-06", reg_key: "gp03", change_type: "summary_rewritten_reviewed", provision_count: 4, latest: "2026-10-06T15:01:16Z" },
    { day: "2026-10-06", reg_key: "gp03", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-10-06T15:01:16Z" },
  ]);
  assert.deepEqual(describeLine(gp03), ["5 summaries rewritten and AI reviewed (1 corrected)"]);

  // Rewrites with no review within a day: pending ones say so; one reviewed
  // days later is not "awaiting" (its review is counted on its own day).
  const [mixed] = foldChangelog([
    { day: "2026-10-02", reg_key: "7", change_type: "summary_rewritten_reviewed_later", provision_count: 1, latest: "2026-10-03T03:49:43Z" },
    { day: "2026-10-02", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 2, latest: "2026-10-03T03:49:43Z" },
    { day: "2026-10-02", reg_key: "7", change_type: "summary_approved", provision_count: 3, latest: "2026-10-03T03:49:43Z" },
  ]);
  assert.deepEqual(describeLine(mixed), [
    "3 summaries AI reviewed",
    "1 summary rewritten (AI reviewed later)",
    "2 summaries rewritten, awaiting AI review",
  ]);
  // No corrected count when every paired review passed.
  const [plain] = foldChangelog([
    { day: "2026-10-06", reg_key: "1", change_type: "summary_rewritten_reviewed", provision_count: 1, latest: "2026-10-06T15:01:04Z" },
  ]);
  assert.deepEqual(describeLine(plain), ["1 summary rewritten and AI reviewed"]);
  // The pre-migration shape still folds, as pending.
  const [legacy] = foldChangelog([
    { day: "2026-09-16", reg_key: "3", change_type: "summary_regenerated", provision_count: 40, latest: "2026-09-16T01:00:00Z" },
  ]);
  assert.deepEqual(describeLine(legacy), ["40 summaries rewritten, awaiting AI review"]);
});

test("a markup-only re-import is 'links added or updated', not 'provisions updated' (7 Oct 2026)", () => {
  // Regulation 7's markup-only re-import after PR #69 logged 22 rows; the
  // trigger now logs them as links_updated (migration 20261007040000) and
  // the page must not call them official-text updates.
  const [reg7] = foldChangelog([
    { day: "2026-10-06", reg_key: "7", change_type: "links_updated", provision_count: 22, latest: "2026-10-07T01:39:30Z" },
  ]);
  assert.equal(reg7.linksUpdated, 22);
  assert.deepEqual(describeLine(reg7), ["links added or updated in 22 provisions"]);
  const [one] = foldChangelog([
    { day: "2026-10-06", reg_key: "gp08", change_type: "links_updated", provision_count: 1, latest: "2026-10-07T01:36:03Z" },
    { day: "2026-10-06", reg_key: "gp08", change_type: "text_updated", provision_count: 3, latest: "2026-10-07T01:36:03Z" },
  ]);
  assert.deepEqual(describeLine(one), ["3 provisions updated", "links added or updated in 1 provision"]);
});

test("when every logged review was a correction the line says so, not 'AI reviewed (N corrected)' (7 Oct 2026)", () => {
  // Passes are not logged as changes (pipeline/README.md: a pass writes no
  // provision_changes row), so "98 summaries AI reviewed (98 corrected)"
  // read as if every reviewed summary was wrong.
  const [all] = foldChangelog([
    { day: "2026-10-05", reg_key: "21", change_type: "summary_edited", provision_count: 98, latest: "2026-10-05T03:58:00Z" },
  ]);
  assert.deepEqual(describeLine(all), ["98 summaries corrected on AI review"]);
  const [single] = foldChangelog([
    { day: "2026-10-05", reg_key: "p196", change_type: "summary_edited", provision_count: 1, latest: "2026-10-05T03:55:27Z" },
  ]);
  assert.deepEqual(describeLine(single), ["1 summary corrected on AI review"]);
  // A mix still shows the corrected count inside the reviewed count.
  const [mix] = foldChangelog([
    { day: "2026-10-05", reg_key: "3", change_type: "summary_approved", provision_count: 3, latest: "2026-10-05T04:56:53Z" },
    { day: "2026-10-05", reg_key: "3", change_type: "summary_edited", provision_count: 97, latest: "2026-10-05T04:56:53Z" },
  ]);
  assert.deepEqual(describeLine(mix), ["100 summaries AI reviewed (97 corrected)"]);
  // Same rule for rewrites reviewed in the same run.
  const [rewrites] = foldChangelog([
    { day: "2026-10-06", reg_key: "11", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-10-06T15:01:05Z" },
  ]);
  assert.deepEqual(describeLine(rewrites), ["1 summary rewritten and corrected on AI review"]);
});

test("the removal of Regulation 26's Subpart JJJJ copy reads as one plain line (4 Oct 2026)", () => {
  // The migration logs one 'removed' row per removed provision against the
  // surviving Part C root; changelog_public() counts them by row.
  const [line] = foldChangelog([
    { day: "2026-10-04", reg_key: "26", change_type: "removed", provision_count: 20, latest: "2026-10-04T20:00:00Z" },
  ]);
  assert.equal(line.regKey, "26");
  assert.deepEqual(describeLine(line), ["20 provisions removed"]);
});

test("no changelog phrase says a summary was 'reviewed' without 'AI' (owner decision, 4 Oct 2026)", () => {
  const lines = foldChangelog([
    { day: "2026-09-14", reg_key: "7", change_type: "text_updated", provision_count: 5, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "links_updated", provision_count: 2, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "added", provision_count: 1, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "removed", provision_count: 1, latest: "2026-09-14T02:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_approved", provision_count: 1, latest: "2026-09-14T03:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_edited", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_reviewed", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
    { day: "2026-09-14", reg_key: "7", change_type: "summary_rewritten_reviewed_later", provision_count: 1, latest: "2026-09-14T01:00:00Z" },
  ]);
  for (const phrase of lines.flatMap(describeLine)) {
    // "reviewed"/"review" only ever directly after "AI".
    assert.doesNotMatch(phrase, /(?<!AI )\breview(ed)?\b/, phrase);
    assert.doesNotMatch(phrase, /^Reviewed\b/, phrase);
  }
});

test("counts arrive as strings from PostgREST bigint and still add up", () => {
  const [line] = foldChangelog([
    { day: "2026-09-14", reg_key: "gp12", change_type: "summary_approved", provision_count: "7" as unknown as number, latest: "2026-09-14T03:00:00Z" },
  ]);
  assert.equal(line.reviewed, 7);
  assert.deepEqual(describeLine(line), ["7 summaries AI reviewed"]);
});

test("no rows, no lines", () => {
  assert.deepEqual(foldChangelog([]), []);
});

// ---- the three sections (review 4, 7 Oct 2026) ---------------------------------

test("three sections: regulatory first and open, links second, summary quality last and collapsed", () => {
  assert.deepEqual(CHANGELOG_SECTIONS.map((s) => [s.key, s.title, s.collapsed]), [
    ["regulatory", "Regulatory changes", false],
    ["links", "Links, sources and transcription", false],
    ["summaries", "Summary quality", true],
  ]);
  assert.match(SUMMARY_QUALITY_EXPLANATION, /^An automated second pass compares each plain-English summary with the official text\./);
  assert.match(SUMMARY_QUALITY_EXPLANATION, /The official text is never changed by this\.$/);
});

test("a line is split by section with the same words, and lands only in the sections it has counts for", () => {
  const lines = foldChangelog([
    { day: "2026-10-06", reg_key: "gp08", change_type: "text_updated", provision_count: 3, latest: "2026-10-07T01:36:03Z" },
    { day: "2026-10-06", reg_key: "gp08", change_type: "links_updated", provision_count: 1, latest: "2026-10-07T01:36:03Z" },
    { day: "2026-10-06", reg_key: "gp08", change_type: "summary_approved", provision_count: 4, latest: "2026-10-07T01:36:03Z" },
    { day: "2026-10-06", reg_key: "gp08", change_type: "summary_edited", provision_count: 1, latest: "2026-10-07T01:36:03Z" },
    { day: "2026-10-06", reg_key: "7", change_type: "links_updated", provision_count: 22, latest: "2026-10-07T01:39:30Z" },
    { day: "2026-10-05", reg_key: "3", change_type: "summary_rewritten_pending", provision_count: 2, latest: "2026-10-05T01:00:00Z" },
    { day: "2026-10-05", reg_key: null, change_type: "removed", provision_count: 20, latest: "2026-10-05T02:00:00Z" },
  ]);
  const gp08 = lines.find((l) => l.regKey === "gp08")!;
  assert.deepEqual(describeSection(gp08, "regulatory"), ["3 provisions updated"]);
  assert.deepEqual(describeSection(gp08, "links"), ["links added or updated in 1 provision"]);
  assert.deepEqual(describeSection(gp08, "summaries"), ["5 summaries AI reviewed (1 corrected)"]);
  assert.deepEqual(describeLine(gp08), [...describeSection(gp08, "regulatory"), ...describeSection(gp08, "links"), ...describeSection(gp08, "summaries")]);
  assert.deepEqual(sectionLines(lines, "regulatory").map((l) => [l.dateKey, l.regKey]), [["2026-10-06", "gp08"], ["2026-10-05", null]]);
  assert.deepEqual(sectionLines(lines, "links").map((l) => [l.dateKey, l.regKey]), [["2026-10-06", "7"], ["2026-10-06", "gp08"]]);
  assert.deepEqual(sectionLines(lines, "summaries").map((l) => [l.dateKey, l.regKey]), [["2026-10-06", "gp08"], ["2026-10-05", "3"]]);
  assert.equal(sectionTotal(gp08, "regulatory"), 3);
  assert.equal(sectionTotal(gp08, "summaries"), 5);
  const removed = lines.find((l) => l.regKey === null)!;
  assert.deepEqual(describeSection(removed, "regulatory"), ["20 provisions removed"]);
  assert.deepEqual(describeSection(removed, "summaries"), []);
});

test("the summary section's one-line total per day sums the day's regulations in the changelog's own words", () => {
  const lines = foldChangelog([
    { day: "2026-10-06", reg_key: "gp08", change_type: "summary_approved", provision_count: 200, latest: "2026-10-06T03:00:00Z" },
    { day: "2026-10-06", reg_key: "gp08", change_type: "summary_edited", provision_count: 12, latest: "2026-10-06T03:00:00Z" },
    { day: "2026-10-06", reg_key: "gp03", change_type: "summary_rewritten_reviewed", provision_count: 4, latest: "2026-10-06T15:01:16Z" },
    { day: "2026-10-06", reg_key: "gp03", change_type: "summary_rewritten_corrected", provision_count: 1, latest: "2026-10-06T15:01:16Z" },
    { day: "2026-10-06", reg_key: "7", change_type: "summary_rewritten_pending", provision_count: 2, latest: "2026-10-06T01:00:00Z" },
    { day: "2026-10-06", reg_key: "7", change_type: "summary_rewritten_reviewed_later", provision_count: 1, latest: "2026-10-06T01:00:00Z" },
  ]);
  assert.equal(
    summaryDayTotal(lines),
    "212 summaries AI reviewed (12 corrected) · 5 summaries rewritten and AI reviewed (1 corrected) · 1 summary rewritten (AI reviewed later) · 2 summaries rewritten, awaiting AI review"
  );
  // Every logged review a correction: the total says so, like the line does.
  const [all] = foldChangelog([{ day: "2026-10-07", reg_key: "3", change_type: "summary_edited", provision_count: 98, latest: "2026-10-07T01:00:00Z" }]);
  assert.equal(summaryDayTotal([all]), "98 summaries corrected on AI review");
  assert.doesNotMatch(summaryDayTotal(lines), /(?<!AI )reviewed/);
});

test("regulatory changes are only what came from the agency; our corrections and duplicate removals read as such, under links (7 Oct 2026)", () => {
  const lines = foldChangelog([
    { day: "2026-10-04", reg_key: "gp12", change_type: "transcription_corrected", provision_count: 13, latest: "2026-10-04T20:00:00Z" },
    { day: "2026-10-04", reg_key: "26", change_type: "duplicate_removed", provision_count: 20, latest: "2026-10-04T21:00:00Z" },
    { day: "2026-10-04", reg_key: "26", change_type: "links_updated", provision_count: 11, latest: "2026-10-04T21:00:00Z" },
    { day: "2026-11-02", reg_key: "7", change_type: "source_version_changed", provision_count: 1, latest: "2026-11-02T15:00:00Z" },
    { day: "2026-11-02", reg_key: "7", change_type: "text_updated", provision_count: 40, latest: "2026-11-02T15:00:00Z" },
    { day: "2026-11-02", reg_key: "7", change_type: "added", provision_count: 3, latest: "2026-11-02T15:00:00Z" },
    { day: "2026-11-02", reg_key: "7", change_type: "removed", provision_count: 1, latest: "2026-11-02T15:00:00Z" },
    // the internal duplicate of a counted removal is never shown
    { day: "2026-10-04", reg_key: "26", change_type: "removal_note", provision_count: 19, latest: "2026-10-04T21:00:00Z" },
  ]);
  const gp12 = lines.find((l) => l.regKey === "gp12")!;
  assert.deepEqual(describeLine(gp12), ["corrections to our copy of the text in 13 provisions"]);
  assert.deepEqual(describeSection(gp12, "regulatory"), []);
  assert.deepEqual(describeSection(gp12, "links"), ["corrections to our copy of the text in 13 provisions"]);
  assert.equal(sectionTotal(gp12, "regulatory"), 0);
  assert.equal(sectionTotal(gp12, "links"), 13);
  const reg26 = lines.find((l) => l.regKey === "26")!;
  assert.deepEqual(describeSection(reg26, "links"), [
    "links added or updated in 11 provisions",
    "20 provisions removed that duplicated another document in the corpus",
  ]);
  assert.deepEqual(describeSection(reg26, "regulatory"), []);
  // An agency change: the version line first, then the counts of the same import.
  const reg7 = lines.find((l) => l.regKey === "7")!;
  assert.deepEqual(describeSection(reg7, "regulatory"), [
    "official text updated to the agency's new version",
    "40 provisions updated",
    "3 provisions added",
    "1 provision removed",
  ]);
  assert.equal(sectionTotal(reg7, "regulatory"), 45);
  assert.deepEqual(sectionLines(lines, "regulatory").map((l) => l.regKey), ["7"]);
  assert.deepEqual(sectionLines(lines, "links").map((l) => l.regKey), ["26", "gp12"]);
  // No phrase ever calls our own work "provisions updated".
  for (const l of [gp12, reg26]) for (const p of describeLine(l)) assert.doesNotMatch(p, /provisions? updated/);
});

test("the regulatory section's empty line names the earliest recorded day, and the view says so when nothing came from the agency", () => {
  assert.equal(
    regulatoryEmptyLine("September 14, 2026"),
    "No agency rule changes recorded since September 14, 2026. Each regulation's page shows its current version and effective date."
  );
  assert.equal(regulatoryEmptyLine(null), "No agency rule changes recorded. Each regulation's page shows its current version and effective date.");
  const label = (d: string) => `L(${d})`;
  const view = buildChangelogView(
    {
      rows: [
        { day: "2026-10-06", reg_key: "7", change_type: "links_updated", provision_count: 22, latest: "2026-10-07T01:39:30Z" },
        { day: "2026-09-14", reg_key: "7", change_type: "transcription_corrected", provision_count: 1400, latest: "2026-09-14T20:00:00Z" },
        { day: "2026-10-05", reg_key: "3", change_type: "summary_approved", provision_count: 2, latest: "2026-10-05T01:00:00Z" },
      ],
      computedAt: "2026-10-07T12:00:00Z",
      source: "snapshot",
      error: null,
    },
    label
  );
  assert.equal(view.notice, null);
  assert.equal(view.firstDay, "2026-09-14");
  assert.deepEqual(view.sections.map((s) => [s.key, s.title, s.collapsed, s.groups.length]), [
    ["regulatory", "Regulatory changes", false, 0],
    ["links", "Links, sources and transcription", false, 2],
    ["summaries", "Summary quality", true, 1],
  ]);
  assert.equal(view.sections[0].emptyLine, regulatoryEmptyLine("L(2026-09-14)"));
  assert.deepEqual(view.sections[1].groups.map((g) => [g.key, g.label, g.lines.length]), [["2026-10-06", "L(2026-10-06)", 1], ["2026-09-14", "L(2026-09-14)", 1]]);
  assert.equal(summaryDayTotal(view.sections[2].groups[0].lines), "2 summaries AI reviewed");
  assert.equal(CHANGELOG_SECTIONS.length, 3);
  assert.match(SUMMARY_QUALITY_EXPLANATION, /official text is never changed/);
});

test("when the counts could not be loaded the view carries the notice and every section its empty line (the page still renders)", () => {
  const view = buildChangelogView({ rows: [], computedAt: null, source: "none", error: "snapshot: timeout; live: timeout" }, (d) => d);
  assert.equal(view.notice, CHANGELOG_UNAVAILABLE_NOTICE);
  assert.equal(view.firstDay, null);
  assert.deepEqual(view.sections.map((s) => [s.key, s.groups.length, s.emptyLine]), [
    ["regulatory", 0, "Nothing recorded yet."],
    ["links", 0, "Nothing recorded yet."],
    ["summaries", 0, "Nothing recorded yet."],
  ]);
  // The last good rows with an error: no notice, the rows shown.
  const memory = buildChangelogView(
    { rows: [{ day: "2026-10-06", reg_key: "7", change_type: "links_updated", provision_count: 22, latest: "2026-10-07T01:39:30Z" }], computedAt: null, source: "memory", error: "snapshot: timeout" },
    (d) => d
  );
  assert.equal(memory.notice, null);
  assert.equal(memory.sections[1].groups.length, 1);
});
