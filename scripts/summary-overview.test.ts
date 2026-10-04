/**
 * Parent summaries in the reader (Sprint 3): a provision with children and a
 * summary longer than two sentences shows the first two sentences as its
 * overview, the rest behind "Show full summary", then links to its direct
 * children; the review badge stays first in the panel body. Cards and
 * childless rows keep the whole summary.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderReaderBody } from "../src/lib/reader-render";
import { splitSentences, summaryOverview, summaryPanelHtml } from "../src/lib/regulation-pure";
import type { Provision } from "../src/lib/types";

test("splitSentences: ends at . ! ? before a capital, not after abbreviations or citation labels", () => {
  assert.deepEqual(splitSentences("The permit requires records. They are kept five years."), [
    "The permit requires records.",
    "They are kept five years.",
  ]);
  assert.deepEqual(
    splitSentences("See Regulation No. 7, Part B, Section II.A.7. The limit is 2.0 g/hp-hr (e.g. rich burn). Done!"),
    ["See Regulation No. 7, Part B, Section II.A.7. The limit is 2.0 g/hp-hr (e.g. rich burn).", "Done!"]
  );
  assert.deepEqual(splitSentences("Is it required? Yes. 40 CFR 60.5395b applies."), ["Is it required?", "Yes.", "40 CFR 60.5395b applies."]);
  assert.deepEqual(splitSentences("Comply with Condition II.A.6 or II.A.7, whichever is stricter."), [
    "Comply with Condition II.A.6 or II.A.7, whichever is stricter.",
  ]);
  assert.deepEqual(splitSentences(""), []);
});

test("summaryOverview: two sentences up front, the rest kept in their paragraphs; null when there is nothing to fold", () => {
  assert.equal(summaryOverview(["One. Two."]), null);
  assert.equal(summaryOverview(["One.", "Two."]), null);
  assert.deepEqual(summaryOverview(["One. Two. Three.", "Four. Five."]), { overview: "One. Two.", rest: ["Three.", "Four. Five."] });
  assert.deepEqual(summaryOverview(["One.", "Two. Three."]), { overview: "One. Two.", rest: ["Three."] });
});

const long = {
  ai_summary: "First sentence here. Second sentence here. Third sentence here. Fourth sentence here.",
  summary_status: "approved",
  reviewed_at: "2026-09-17T18:04:10Z",
  source_url: "https://example.gov/reg",
};
const kids = [
  { id: "sec-t-A-I-A", citation: "I.A.", snippet: "Qualified sources" },
  { id: "sec-t-A-I-B", citation: "I.B.", snippet: "" },
];

test("summaryPanelHtml with children: badge, two-sentence overview, expander, child links", () => {
  const html = summaryPanelHtml(long, null, kids);
  assert.equal(
    html,
    `<details class="summary-panel"><summary>Plain-English summary</summary>` +
      `<div class="summary-body"><p class="summary-badge is-reviewed">AI reviewed · Sept 17, 2026</p>` +
      `<p class="summary-overview">First sentence here. Second sentence here.</p>` +
      `<details class="summary-more"><summary>Show full summary</summary><p>Third sentence here. Fourth sentence here.</p></details>` +
      `<div class="summary-children-label">In this provision</div><ul class="summary-children">` +
      `<li><span class="xref summary-child-link" data-target="sec-t-A-I-A">I.A.</span> <span class="summary-child-snip">Qualified sources</span></li>` +
      `<li><span class="xref summary-child-link" data-target="sec-t-A-I-B">I.B.</span></li></ul></div>` +
      `<div class="summary-status"></div></details>`
  );
});

test("summaryPanelHtml without children, or with a short summary, is unchanged", () => {
  const plain = summaryPanelHtml(long, null);
  assert.ok(plain.includes("<p>First sentence here. Second sentence here. Third sentence here. Fourth sentence here.</p>"));
  assert.ok(!plain.includes("summary-more"));
  const short = summaryPanelHtml({ ...long, ai_summary: "One. Two." }, null, kids);
  assert.ok(short.includes("<p>One. Two.</p>") && !short.includes("summary-more") && !short.includes("summary-children"));
});

test("the child list caps at eight and says how many more", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ id: `sec-t-A-I-${i}`, citation: `I.${i}.`, snippet: "x" }));
  const html = summaryPanelHtml(long, null, many);
  assert.equal((html.match(/summary-child-link/g) ?? []).length, 8);
  assert.ok(html.includes('<li class="summary-children-more">and 3 more below</li>'));
});

function row(id: string, citation: string, parent_id: string | null, full_text: string, extra: Partial<Provision> = {}): Provision {
  return {
    id,
    citation,
    title: citation,
    parent_id,
    sort_order: 0,
    full_text,
    reg_key: "t",
    jurisdiction_level: "state",
    issuing_body: null,
    source_url: null,
    ai_summary: null,
    summary_status: null,
    reviewed_at: null,
    reviewed_by: null,
    last_verified_date: null,
    summary_original: null,
    ...extra,
  } as Provision;
}

test("renderReaderBody passes a parent's direct children into its panel", () => {
  const all: Provision[] = [
    row("sec-t-top-REG-t", "REGULATION T", null, "<p>REGULATION T</p>"),
    row("sec-t-A-PART-A", "PART A", "sec-t-top-REG-t", "<p>PART A</p>"),
    row("sec-t-A-I", "I.", "sec-t-A-PART-A", "<p>I. Applicability</p>", {
      ai_summary: "One. Two. Three.",
      summary_status: "pending",
    }),
    row("sec-t-A-I-A", "I.A.", "sec-t-A-I", "<p>Qualified sources may register.</p>", { ai_summary: "One. Two. Three." }),
    row("sec-t-A-I-B", "I.B.", "sec-t-A-I", "<p>Not this one.</p>"),
  ];
  const rendered = renderReaderBody(all)!;
  // the parent: overview + expander + its two children
  const parent = rendered.docHtml.slice(rendered.docHtml.indexOf('id="sec-t-A-I"'), rendered.docHtml.indexOf('id="sec-t-A-I-A"'));
  assert.ok(parent.includes('<p class="summary-overview">One. Two.</p>'), parent);
  assert.ok(parent.includes('data-target="sec-t-A-I-A">I.A.</span> <span class="summary-child-snip">Qualified sources may register.</span>'));
  assert.ok(parent.includes('data-target="sec-t-A-I-B">I.B.</span>'));
  // the childless row with the same summary: no expander
  const leaf = rendered.docHtml.slice(rendered.docHtml.indexOf('id="sec-t-A-I-A"'), rendered.docHtml.indexOf('id="sec-t-A-I-B"'));
  assert.ok(leaf.includes("<p>One. Two. Three.</p>") && !leaf.includes("summary-more"), leaf);
});
