/**
 * Citations keep their stored case (Sprint 8, 11 Oct 2026). Previews showed
 * "§ 60.5365B(E)" and "§ 60.4230(A)" where professionals write
 * "§ 60.5365b(e)" and "§ 60.4230(a)": the stored citation and
 * federal-citation.ts were right, and the eyebrow's CSS `uppercase` turned
 * the text into capitals. Colorado citations have lower-case letters too
 * ("I.D.3.a.(i)." printed as "I.D.3.A.(I).").
 *
 * Three layers:
 *   1. the formatter returns the right case for every spelling that reaches
 *      it, and leaves a Colorado citation unchanged;
 *   2. a rendered card prints the citation in an element that does not
 *      transform it;
 *   3. a source scan: no element that prints a citation carries `uppercase`
 *      in any component or page, and the reader's citation selectors carry
 *      no `text-transform: uppercase`. A new eyebrow that prints a citation
 *      fails here.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AskCard, type AskRow } from "../src/components/AskCard";
import { displayCitation, federalIdLabel, formatFederalCitation, normalizeFederalSection } from "../src/lib/federal-citation";
import { citeLabel } from "../src/lib/premise-notes";
import { sampleCards } from "../src/lib/regulation-pure";
import { CITATION_EYEBROW_CLASS } from "../src/lib/ui";

// ---- 1. the formatter ----

const CASES: { reg: string; id: string; stored: string; spaced: string[]; label: string }[] = [
  { reg: "oooob", id: "sec-oooob-60.5365b-(e)", stored: "§ 60.5365b(e)", spaced: ["60.5365b.(e)", "§ 60.5365b (e)", "§60.5365b (e)", "60.5365b. (e)"], label: "OOOOb § 60.5365b(e)" },
  { reg: "ooooa", id: "sec-ooooa-60.5365a-(e)", stored: "§ 60.5365a(e)", spaced: ["60.5365a.(e)", "§ 60.5365a (e)"], label: "OOOOa § 60.5365a(e)" },
  { reg: "jjjj", id: "sec-jjjj-60.4230-(a)", stored: "§ 60.4230(a)", spaced: ["60.4230.(a)", "§ 60.4230 (a)"], label: "JJJJ § 60.4230(a)" },
];

test("the stored, id-tail and spaced spellings of 60.5365b(e), 60.5365a(e) and 60.4230(a) all print in lower case", () => {
  for (const c of CASES) {
    const tail = c.id.replace(`sec-${c.reg}-`, "");
    const section = c.stored; // "§ 60.5365b(e)"
    // Every spelling normalises to the one stored spelling.
    for (const spelling of [c.stored, tail, ...c.spaced]) {
      assert.equal(normalizeFederalSection(spelling), section, `normalize ${spelling}`);
      assert.equal(formatFederalCitation(c.reg, spelling), c.label, `format ${spelling}`);
      assert.equal(displayCitation(c.reg, spelling), section, `display ${spelling}`);
    }
    assert.equal(federalIdLabel(c.id), c.label, `id label ${c.id}`);
    assert.equal(citeLabel(c.id), c.label, `cite label ${c.id}`);
    // The paragraph letter and the section's suffix are never capitals.
    const paragraph = /\(([a-z])\)$/.exec(section)?.[1];
    assert.ok(paragraph, "the paragraph is a lower-case letter");
    assert.ok(!section.includes(`(${paragraph!.toUpperCase()})`));
    assert.ok(!/\d[A-Z]/.test(section), "no capital suffix on the section number");
  }
});

test("the named examples, spelled out", () => {
  assert.equal(displayCitation("oooob", "§ 60.5365b(e)"), "§ 60.5365b(e)");
  assert.equal(displayCitation("ooooa", "§ 60.5365a(e)"), "§ 60.5365a(e)");
  assert.equal(displayCitation("jjjj", "§ 60.4230(a)"), "§ 60.4230(a)");
  assert.equal(formatFederalCitation("oooob", "§ 60.5365b(e)"), "OOOOb § 60.5365b(e)");
  assert.equal(federalIdLabel("sec-jjjj-60.4230-(a)"), "JJJJ § 60.4230(a)");
});

test("a Colorado citation is returned unchanged, whatever its letters", () => {
  for (const [reg, citation] of [
    ["7", "I.D.3.a.(i)."],
    ["7", "II.A.4."],
    ["3", "II.B.1.b.(ii)(A)."],
    ["gp05", "VI.C.1.b.(ii)."],
    ["cp", "I.G.90."],
    ["ecmc", "604.a.(1)."],
    [null, "I.D.3.a.(i)."],
  ] as const) {
    assert.equal(displayCitation(reg, citation), citation);
  }
  assert.equal(formatFederalCitation("7", "I.D.3.a.(i)."), null);
  assert.equal(federalIdLabel("sec-7-B-I-D-3-a-(i)"), null);
});

test("a federal id the formatter cannot parse still keeps the subpart's case in the fallbacks", () => {
  assert.equal(citeLabel("sec-oooob-top-REG-oooob"), "OOOOb (document)");
  assert.equal(citeLabel("sec-oooob-some-odd-tail"), "OOOOb some.odd.tail");
  assert.equal(citeLabel("sec-gp05-VI-C-1-b"), "GP05 VI.C.1.b");
  assert.equal(citeLabel("sec-7-B-I-D"), "Regulation 7 Part B I.D");
  // The sample card label with no root row.
  const cards = sampleCards([{ id: "sec-oooob-60.5365b-(e)", citation: "§ 60.5365b(e)", title: "§ 60.5365b(e)" }], [], []);
  assert.equal(cards[0].citation, "OOOOb · § 60.5365b(e)");
});

// ---- 2. a rendered card ----

const FEDERAL_ROW: AskRow = {
  id: "sec-oooob-60.5365b-(e)",
  citation: "§ 60.5365b(e)",
  title: "§ 60.5365b(e)",
  reg_key: "oooob",
  jurisdiction_level: "federal",
  summary: null,
  score: 0.8,
  retrieved: true,
};
const COLORADO_ROW: AskRow = { ...FEDERAL_ROW, id: "sec-7-B-I-D-3-a-(i)", citation: "I.D.3.a.(i).", title: "I.D.3.a.(i).", reg_key: "7", jurisdiction_level: "state" };

function citationElement(html: string, citation: string): string {
  const escaped = citation.replace(/[.*+?^${}()|[\]\\§]/g, "\\$&");
  const m = new RegExp(`<(\\w+)([^>]*)>\\s*${escaped}\\s*</\\1>`).exec(html);
  assert.ok(m, `an element holding exactly ${citation}`);
  return m![2];
}

test("an Ask card prints the citation in an element that does not transform it", () => {
  for (const [row, name] of [[FEDERAL_ROW, "40 CFR Part 60 Subpart OOOOb"], [COLORADO_ROW, "Regulation 7"]] as const) {
    const html = renderToStaticMarkup(
      createElement(AskCard, { row, name, review: undefined, headingChildren: new Map(), href: "/regulations/x" })
    );
    const shown = displayCitation(row.reg_key, row.citation);
    const attrs = citationElement(html, shown);
    assert.match(attrs, /\bnormal-case\b/);
    assert.doesNotMatch(attrs, /\buppercase\b/);
    assert.ok(attrs.includes(CITATION_EYEBROW_CLASS.split(" ")[2]));
  }
});

test("the citation class keeps the eyebrow look and drops the transform", () => {
  assert.deepEqual(CITATION_EYEBROW_CLASS.split(" "), ["font-mono", "text-eyebrow", "normal-case", "text-tag"]);
});

// ---- 3. the source scan ----

const SRC = join(__dirname, "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * Every JSX element in a file whose className contains the `uppercase`
 * utility, with the text up to its closing tag. A citation expression
 * inside one is a transformed citation.
 */
function uppercaseElements(source: string): { tag: string; body: string }[] {
  const found: { tag: string; body: string }[] = [];
  const re = /<(\w+)\b[^<>]*\buppercase\b[^<>]*>([\s\S]*?)<\/\1>/g;
  for (let m = re.exec(source); m; m = re.exec(source)) found.push({ tag: m[1], body: m[2] });
  return found;
}

/** What marks an expression that prints a citation. */
const PRINTS_A_CITATION = /displayCitation\(|\.citation\b|citeLabel\(|federalIdLabel\(|formatFederalCitation\(|\bcitation\}/;

test("no element that prints a citation carries the uppercase utility (components and pages)", () => {
  const files = walk(SRC).filter((f) => f.endsWith(".tsx"));
  assert.ok(files.length > 30, "the scan reads the app");
  let scanned = 0;
  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const el of uppercaseElements(source)) {
      scanned++;
      if (PRINTS_A_CITATION.test(el.body)) offenders.push(`${relative(SRC, file)}: <${el.tag}> ${el.body.trim().slice(0, 80)}`);
    }
  }
  assert.ok(scanned > 20, "the scan found the eyebrows");
  assert.deepEqual(offenders, []);
});

test("the scan itself catches the old markup", () => {
  const old = `<span className="font-mono text-eyebrow uppercase text-tag">{displayCitation(hit.reg_key, hit.citation)}</span>`;
  assert.equal(uppercaseElements(old).filter((e) => PRINTS_A_CITATION.test(e.body)).length, 1);
  const fixed = `<span className={CITATION_EYEBROW_CLASS}>{displayCitation(hit.reg_key, hit.citation)}</span>`;
  assert.equal(uppercaseElements(fixed).length, 0);
});

/** The declaration block of the rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\#]/g, "\\$&");
  const m = new RegExp(`(?:^|\\n|,\\s*)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `a rule for ${selector}`);
  return m![1];
}

test("the reader's citation selectors do not transform their text", () => {
  const css = readFileSync(join(SRC, "app", "regulations", "reader.css"), "utf8");
  // Root citation in the sidebar and above the regulation's text; the
  // section links; the popup's eyebrow; the badge in front of a popup item.
  for (const selector of [
    ".reg-reader .nav-reg-title",
    ".reg-reader .reg-eyebrow",
    ".reg-reader a.nav-link",
    ".reg-reader #popup-eyebrow",
    ".reg-reader .item-id",
    ".reg-reader #popup-body .item-id",
  ]) {
    assert.doesNotMatch(ruleBody(css, selector), /text-transform:\s*uppercase/, selector);
  }
  // No transform anywhere in the preview subtree's styles.
  const preview = readFileSync(join(SRC, "components", "preview-subtree.css"), "utf8");
  assert.doesNotMatch(preview, /text-transform:\s*uppercase/);
});
