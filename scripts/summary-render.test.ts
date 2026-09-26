/**
 * Summary prose as a reader sees it (backlog #16): the one renderer every
 * surface goes through strips the Markdown markers a stored summary can
 * carry, and the heading-only test the Ask cards use matches the one
 * search_provisions applies server-side.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isHeadingOnlyText, stripSummaryMarkdown, summaryParagraphs } from "../src/lib/regulation-pure";

test("stripSummaryMarkdown: **bold**, __bold__ and `code` markers go, their text stays", () => {
  assert.equal(
    stripSummaryMarkdown("**State-only definition.** An occupied area is a `home` where __people__ live."),
    "State-only definition. An occupied area is a home where people live."
  );
  assert.equal(stripSummaryMarkdown("```\n100 tpy\n```"), "100 tpy\n");
});

test("stripSummaryMarkdown: a stray marker is removed; ordinary asterisks and underscores survive", () => {
  assert.equal(stripSummaryMarkdown("Limit is 5 tpy** (see note)"), "Limit is 5 tpy (see note)");
  assert.equal(stripSummaryMarkdown("a * b, well_name"), "a * b, well_name");
  assert.equal(stripSummaryMarkdown(""), "");
});

test("summaryParagraphs: markers are stripped on every paragraph and the split is unchanged", () => {
  const stored = "**Plain-language summary:**\n\nBaseline concentration is the **ambient** level.\n\n\n  ";
  assert.deepEqual(summaryParagraphs(stored), [
    "Plain-language summary:",
    "Baseline concentration is the ambient level.",
  ]);
  assert.deepEqual(summaryParagraphs(""), []);
});

test("isHeadingOnlyText: a row whose text is only its heading is a section", () => {
  // GP01's applicability heading as stored (the first Ask hit for "When is a GP01 required?").
  assert.equal(isHeadingOnlyText("I. General Permit Applicability", "I. General Permit Applicability", "I."), true);
  // Tags, &nbsp; and doubled spaces do not defeat the comparison (same normalisation as the SQL).
  assert.equal(isHeadingOnlyText("<p>Rule&nbsp;604.  </p>", "Rule 604.", "604."), true);
  assert.equal(isHeadingOnlyText("<p>604.</p>", "Well location", "604."), true);
});

test("isHeadingOnlyText: a row with its own text is a provision", () => {
  assert.equal(
    isHeadingOnlyText("<p>I.A.1. This permit applies to engines rated above 500 hp.</p>", "I.A.1.", "I.A.1."),
    false
  );
  assert.equal(isHeadingOnlyText("", "I.", "I."), false);
});
