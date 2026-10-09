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
import { OVERVIEW_MAX_WORDS, cutSentence, splitSentences, summaryOverview, summaryPanelHtml, wordCount } from "../src/lib/regulation-pure";
import type { Provision } from "../src/lib/types";

test("splitSentences: ends at . ! ? before a capital, not after abbreviations or list markers", () => {
  assert.deepEqual(splitSentences("The permit requires records. They are kept five years."), [
    "The permit requires records.",
    "They are kept five years.",
  ]);
  assert.deepEqual(
    splitSentences("See Regulation No. 7, Part B, Section II.A.7. The limit is 2.0 g/hp-hr (e.g. rich burn). Done!"),
    ["See Regulation No. 7, Part B, Section II.A.7.", "The limit is 2.0 g/hp-hr (e.g. rich burn).", "Done!"]
  );
  // A citation label or a year closing a sentence (the common case in the
  // summaries) is a sentence end; a label inside a sentence is followed by
  // a lowercase word and never splits.
  assert.deepEqual(splitSentences("Facilities are permitted under provision I.B. If the source is also subject to II.A.6., comply."), [
    "Facilities are permitted under provision I.B.",
    "If the source is also subject to II.A.6., comply.",
  ]);
  assert.deepEqual(splitSentences("Comply by May 1, 2021. Facilities built later comply at startup. Section II.A.7. applies too."), [
    "Comply by May 1, 2021.",
    "Facilities built later comply at startup.",
    "Section II.A.7. applies too.",
  ]);
  assert.deepEqual(splitSentences("The source must: 1. Keep records; 2. Report yearly; a. On time."), [
    "The source must: 1. Keep records; 2. Report yearly; a. On time.",
  ]);
  assert.deepEqual(splitSentences("Is it required? Yes. 40 CFR 60.5395b applies."), ["Is it required?", "Yes.", "40 CFR 60.5395b applies."]);
  assert.deepEqual(splitSentences("Comply with Condition II.A.6 or II.A.7, whichever is stricter."), [
    "Comply with Condition II.A.6 or II.A.7, whichever is stricter.",
  ]);
  assert.deepEqual(splitSentences(""), []);
});

test("summaryOverview: two sentences up front, the rest kept in their paragraphs; null when there is nothing to fold", () => {
  assert.equal(summaryOverview(["One. Two."]), null);
  assert.equal(summaryOverview(["One.", "Two."]), null);
  assert.deepEqual(summaryOverview(["One. Two. Three.", "Four. Five."]), { overview: "One. Two.", rest: ["Three.", "Four. Five."], cut: false });
  assert.deepEqual(summaryOverview(["One.", "Two. Three."]), { overview: "One. Two.", rest: ["Three."], cut: false });
});

// Capitalised so splitSentences sees a sentence start after each period.
const w = (n: number, word = "Word") => Array.from({ length: n }, (_, i) => `${word}${i + 1}`).join(" ");

test("summaryOverview: about 50 words (review 4, 7 Oct 2026) -- the second sentence joins only when both fit", () => {
  assert.equal(OVERVIEW_MAX_WORDS, 50);
  // 20 + 25 = 45 words: both sentences.
  const a = summaryOverview([`${w(20)}. ${w(25, "B")}. ${w(5, "C")}.`]);
  assert.equal(a?.overview, `${w(20)}. ${w(25, "B")}.`);
  assert.deepEqual(a?.rest, [`${w(5, "C")}.`]);
  // 20 + 45 = 65 words: the first sentence alone, the second behind the expander.
  const b = summaryOverview([`${w(20)}. ${w(45, "B")}. ${w(5, "C")}.`]);
  assert.deepEqual(b, { overview: `${w(20)}.`, rest: [`${w(45, "B")}. ${w(5, "C")}.`], cut: false });
  // 20 + 38 = 58 words: both, within the 60-word slack ("about 50"): the Regulation 7 document overview is 57.
  const both = summaryOverview([`${w(20)}. ${w(38, "B")}. ${w(5, "C")}.`]);
  assert.equal(both?.overview, `${w(20)}. ${w(38, "B")}.`);
  // A two-sentence summary over the slack now gets an expander too (1,339 parents had one or two long sentences and no expander).
  const c = summaryOverview([`${w(30)}. ${w(35, "B")}.`]);
  assert.deepEqual(c, { overview: `${w(30)}.`, rest: [`${w(35, "B")}.`], cut: false });
  // Two sentences of 57 words together: whole, no expander.
  assert.equal(summaryOverview([`${w(20)}. ${w(37, "B")}.`]), null);
  // A single sentence of 55 words is shown whole (within the 60-word slack), no expander.
  assert.equal(summaryOverview([`${w(55)}.`]), null);
  assert.equal(wordCount(" a  b\nc "), 3);
});

test("summaryOverview: a first sentence past 60 words is cut at a clause boundary with an ellipsis, and the expander shows the whole summary", () => {
  const first = `${w(30)}, ${w(18, "B")}; ${w(25, "C")} end.`; // 73 words; boundaries after word 30 (",") and 48 (";")
  const r = summaryOverview([`${first} Second one.`, "Third para."]);
  assert.equal(r?.cut, true);
  assert.equal(r?.overview, `${w(30)}, ${w(18, "B")}\u2026`);
  assert.equal(wordCount(r!.overview), 48);
  assert.deepEqual(r?.rest, [`${first} Second one.`, "Third para."]);
  // No boundary inside the window: cut at the word limit.
  const plain = summaryOverview([`${w(70)}.`]);
  assert.equal(plain?.overview, `${w(50)}\u2026`);
  assert.equal(plain?.cut, true);
  // A boundary before the 20-word minimum is ignored.
  const early = summaryOverview([`${w(10)}, ${w(60, "B")}.`]);
  assert.equal(wordCount(early!.overview), 50);
  assert.equal(cutSentence("short one.", 50), "short one.");
  // GP12 I.A (the reviewer's example): 19-word first sentence, 70-word second -> the first sentence alone.
  const gp12 = summaryOverview([
    "The permit may be used only for oil and gas well production facilities as defined in Regulation Number 7, Part B. Equipment covered is limited to natural gas-fired and diesel-fired reciprocating internal combustion engines; storage tanks for condensate, crude oil, intermediate hydrocarbon liquids, or produced water (with design capacity ≤10,000 barrels per vessel for the first three types); hydrocarbon liquid loading operations; gas venting from separators; fugitive component leak emissions; and Division-approved air pollution control equipment used to reduce emissions below the limits in Section III. The permit also covers routine or predictable emissions.",
  ]);
  assert.equal(gp12?.overview, "The permit may be used only for oil and gas well production facilities as defined in Regulation Number 7, Part B.");
  assert.equal(gp12?.cut, false);
  assert.ok(wordCount(gp12!.overview) <= 50);
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
      `<div class="summary-body"><p class="summary-badge is-reviewed">AI-generated · automated check against source text · Sept 17, 2026</p>` +
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
