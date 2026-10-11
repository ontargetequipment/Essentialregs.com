/**
 * The reader's jump box as pure functions (src/lib/jump-search.ts): the merge
 * order (citation matches first, then the server's text matches), the empty
 * states, and what an excerpt is allowed to carry into the page.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  citationMatches,
  excerptHtml,
  JUMP_CITATION_MAX,
  JUMP_EMPTY_HTML,
  jumpItemsHtml,
  jumpQueryKey,
  mergeJumpResults,
  type JumpTextHit,
} from "../src/lib/jump-search";
import type { SearchRow } from "../src/lib/snippet";

const row = (id: string, citation: string, snippet = "", group = "g"): SearchRow => [id, citation, snippet, group];
const INDEX: SearchRow[] = [
  row("sec-gp05-VI", "VI.", "Sampling"),
  row("sec-gp05-VI-C", "VI.C.", "The owner or operator shall comply with"),
  row("sec-gp05-VI-D", "VI.D.", "Table 2, the owner or operator of storage tanks utilizing si…"),
  row("sec-gp05-VII", "VII.", "Records"),
];
const hit = (id: string, citation: string, headline: string | null = null): JumpTextHit => ({ id, citation, headline });

test("citationMatches: prefix match on the normalized citation, in reading order", () => {
  assert.deepEqual(citationMatches(INDEX, "VI.D").map((r) => r[0]), ["sec-gp05-VI-D"]);
  assert.deepEqual(citationMatches(INDEX, "vi.").map((r) => r[0]), ["sec-gp05-VI", "sec-gp05-VI-C", "sec-gp05-VI-D"]);
  // Case, spaces and a section sign do not matter.
  assert.deepEqual(citationMatches(INDEX, " § v i . d ").map((r) => r[0]), ["sec-gp05-VI-D"]);
  // A word is not a citation, and neither is nothing.
  assert.deepEqual(citationMatches(INDEX, "sampling"), []);
  assert.deepEqual(citationMatches(INDEX, "  "), []);
  assert.deepEqual(citationMatches(INDEX, "§"), []);
});

test("citationMatches: at most JUMP_CITATION_MAX, the first ones", () => {
  const many = Array.from({ length: 30 }, (_, i) => row(`sec-x-${i}`, `A.${i}.`));
  const got = citationMatches(many, "A.");
  assert.equal(got.length, JUMP_CITATION_MAX);
  assert.equal(got[0][0], "sec-x-0");
  assert.equal(got[JUMP_CITATION_MAX - 1][0], `sec-x-${JUMP_CITATION_MAX - 1}`);
});

test("mergeJumpResults: citations first, then the text matches, in the server's order", () => {
  const cit = citationMatches(INDEX, "VI");
  const merged = mergeJumpResults(cit, [hit("sec-gp05-X-1", "X.1.", "a <mark>b</mark>"), hit("sec-gp05-IV-B", "IV.B.", "c")]);
  assert.deepEqual(
    merged.map((m) => m.id),
    ["sec-gp05-VI", "sec-gp05-VI-C", "sec-gp05-VI-D", "sec-gp05-VII", "sec-gp05-X-1", "sec-gp05-IV-B"]
  );
  // Citation matches keep the first-line snippet; text matches carry the excerpt.
  assert.equal(merged[0].snippet, "Sampling");
  assert.equal(merged[0].excerptHtml, "");
  assert.equal(merged[4].snippet, "");
  assert.equal(merged[4].excerptHtml, "a <mark>b</mark>");
});

test("mergeJumpResults: a text match already listed as a citation match is listed once, as a citation match", () => {
  const merged = mergeJumpResults(citationMatches(INDEX, "VI.D"), [hit("sec-gp05-VI-D", "VI.D.", "x <mark>sampling</mark>"), hit("sec-gp05-VII", "VII.", "y")]);
  assert.deepEqual(merged.map((m) => m.id), ["sec-gp05-VI-D", "sec-gp05-VII"]);
  assert.equal(merged[0].excerptHtml, "", "the citation match's own snippet stays");
  assert.equal(merged[0].snippet, "Table 2, the owner or operator of storage tanks utilizing si…");
  // A repeated id in the server's own list is listed once too.
  assert.equal(mergeJumpResults([], [hit("a", "A."), hit("a", "A.")]).length, 1);
});

test("mergeJumpResults: empty states", () => {
  // Nothing from either list: empty (the caller prints "No matches" only once the server has answered).
  assert.deepEqual(mergeJumpResults([], []), []);
  assert.deepEqual(mergeJumpResults([], null), []);
  // Citation matches alone, while the server has not answered.
  assert.equal(mergeJumpResults(citationMatches(INDEX, "VI.C"), null).length, 1);
  // Text matches alone, no citation match.
  const only = mergeJumpResults([], [hit("sec-gp05-VI-D", "VI.D.", "<mark>sampling</mark>")]);
  assert.deepEqual(only.map((m) => m.id), ["sec-gp05-VI-D"]);
  assert.match(JUMP_EMPTY_HTML, /No matches/);
  assert.equal(jumpItemsHtml([]), "");
});

test("excerptHtml keeps <mark> and nothing else", () => {
  assert.equal(excerptHtml("must complete site-specific <mark>sampling</mark> of"), "must complete site-specific <mark>sampling</mark> of");
  assert.equal(excerptHtml('a <script>alert(1)</script> <img src=x onerror=y> <mark class="x">b</mark>'), "a alert(1)  <mark>b</mark>");
  assert.equal(excerptHtml(null), "");
  assert.equal(excerptHtml(""), "");
  // Escaped text stays text: the server's sanitiser writes "&lt;" for a literal "<".
  assert.equal(excerptHtml("x &lt;b&gt; <mark>y</mark>"), "x &lt;b&gt; <mark>y</mark>");
});

test("jumpItemsHtml: roles, ids, escaping, and the two kinds of snippet", () => {
  const html = jumpItemsHtml(
    mergeJumpResults([row('sec-a"b', "A & B.", "if x < y")], [hit("sec-gp05-VI-D", "VI.D.", "site-specific <mark>sampling</mark>")])
  );
  assert.match(html, /<div class="jr-item" role="option" id="jump-opt-sec-a&quot;b" aria-selected="false" data-slug="sec-a&quot;b">/);
  assert.match(html, /<span class="jr-id">A &amp; B\.<\/span><span class="jr-snip">if x &lt; y<\/span>/);
  assert.match(html, /<span class="jr-id">VI\.D\.<\/span><span class="jr-snip jr-excerpt">site-specific <mark>sampling<\/mark><\/span>/);
  // No snippet at all: no empty span.
  assert.doesNotMatch(jumpItemsHtml(mergeJumpResults([row("a", "A.", "")], null)), /jr-snip/);
});

test("jumpQueryKey: trimmed, one space, lower-case", () => {
  assert.equal(jumpQueryKey("  Site   Specific\tSAMPLING "), "site specific sampling");
  assert.equal(jumpQueryKey("x".repeat(500)).length, 200);
});
