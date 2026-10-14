/**
 * The focused preview's context strip (src/lib/preview-context.ts): the line
 * that says where a visitor is after a cross-reference. Run by `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { previewContext } from "../src/lib/preview-context";

// As production stores them (read 14 Oct 2026).
const ROOT7 = { citation: "Regulation 7" };
const HEADINGS7 = [
  { id: "sec-7-P-A", citation: "PART A", title: "PART A — Applicability and General Provisions" },
  { id: "sec-7-P-B", citation: "PART B", title: "PART B — Oil and Natural Gas Operations" },
  { id: "sec-7-P-C", citation: "PART C", title: "PART C — Statements of Basis, Specific Statutory Authority and Purpose" },
];

test("the walkthrough's landing, Regulation 7 I.C.1: document, Part, citation and title", () => {
  const ctx = previewContext({
    reg: "7",
    focusedId: "sec-7-B-I-C-1",
    root: ROOT7,
    focused: { citation: "I.C.1.", title: "I.C.1. General Requirements" },
    headings: HEADINGS7,
  });
  assert.equal(ctx.document, "Regulation 7");
  assert.equal(ctx.part, "Part B");
  assert.equal(ctx.partTitle, "Part B — Oil and Natural Gas Operations");
  assert.equal(ctx.citation, "I.C.1");
  assert.equal(ctx.title, "General Requirements");
  assert.equal(ctx.text, "Regulation 7 · Part B · I.C.1 General Requirements");
});

test("the second hop, I.D, and a deep row: the Part comes from the id, never from the row's own citation", () => {
  const id = previewContext({ reg: "7", focusedId: "sec-7-B-I-D", root: ROOT7, focused: { citation: "I.D.", title: "I.D. Storage Tank Emission Controls" }, headings: HEADINGS7 });
  assert.equal(id.text, "Regulation 7 · Part B · I.D Storage Tank Emission Controls");
  const deep = previewContext({ reg: "7", focusedId: "sec-7-B-I-D-3-a-(i)", root: ROOT7, focused: { citation: "I.D.3.a.(i)", title: null }, headings: HEADINGS7 });
  assert.equal(deep.text, "Regulation 7 · Part B · I.D.3.a.(i)");
  assert.equal(deep.title, null);
});

test("a Part the headings do not carry is named from its id; the Part itself is not named twice", () => {
  const noHeadings = previewContext({ reg: "7", focusedId: "sec-7-B-I-C-1", root: ROOT7, focused: { citation: "I.C.1.", title: "I.C.1. General Requirements" }, headings: [] });
  assert.equal(noHeadings.text, "Regulation 7 · Part B · I.C.1 General Requirements");
  assert.equal(noHeadings.partTitle, null);
  const partItself = previewContext({ reg: "7", focusedId: "sec-7-P-B", root: ROOT7, focused: { citation: "PART B", title: "PART B — Oil and Natural Gas Operations" }, headings: HEADINGS7 });
  assert.equal(partItself.part, null);
  assert.equal(partItself.text, "Regulation 7 · Part B Oil and Natural Gas Operations");
});

test("documents without Parts: a general permit, a federal subpart in the CFR's own case", () => {
  const gp = previewContext({ reg: "gp12", focusedId: "sec-gp12-I-A-8", root: { citation: "APCD General Permit GP12" }, focused: { citation: "I.A.8.", title: "I.A.8. Recordkeeping" }, headings: [] });
  assert.equal(gp.part, null);
  assert.equal(gp.text, "APCD General Permit GP12 · I.A.8 Recordkeeping");
  const fed = previewContext({ reg: "oooob", focusedId: "sec-oooob-60.5365b", root: { citation: "40 CFR Part 60 Subpart OOOOb" }, focused: { citation: "§ 60.5365b", title: null }, headings: [] });
  assert.equal(fed.document, "40 CFR Part 60 Subpart OOOOb");
  assert.equal(fed.part, null);
  assert.match(fed.text, /^40 CFR Part 60 Subpart OOOOb · § 60\.5365b$/);
});

test("the document is the display name, never the key: an AQCC root's series prefix is dropped", () => {
  const ctx = previewContext({ reg: "3", focusedId: "sec-3-A-II-B-4", root: { citation: "Code of Colorado Regulations · Regulation Number 3" }, focused: { citation: "II.B.4.", title: "II.B.4. Exemptions" }, headings: [{ id: "sec-3-P-A", citation: "PART A", title: "PART A — Concerning General Provisions" }] });
  assert.equal(ctx.text, "Regulation 3 · Part A · II.B.4 Exemptions");
});
