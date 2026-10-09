/**
 * The Test Methods data file (src/data/test-methods.json, read through the
 * typed wrapper src/data/test-methods.ts): the contract both the
 * /test-methods pages and the pipeline's citation linker
 * (pipeline/method_links.py) rely on. No database, no Next.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { MethodOfficialText, TestMethodBody } from "../src/components/TestMethodBody";
import {
  TEST_METHODS,
  TEST_METHOD_BY_SLUG,
  TEST_METHOD_CATEGORY_LABELS,
  TEST_METHOD_CATEGORY_ORDER,
  testMethodsInCategory,
} from "../src/data/test-methods";
import { TEST_METHOD_SLUGS_SQL, renderTestMethodSlugsSql } from "./test-method-slugs";

const CATEGORIES = new Set(Object.keys(TEST_METHOD_CATEGORY_LABELS));

test("the file has entries and every slug is unique and lowercase", () => {
  assert.ok(TEST_METHODS.length >= 30, `expected at least 30 entries, found ${TEST_METHODS.length}`);
  const seen = new Set<string>();
  for (const m of TEST_METHODS) {
    assert.match(m.slug, /^(method-\d+[a-z]?|ps-\d+)$/, `slug "${m.slug}" is not method-<n><letter> or ps-<n>`);
    assert.equal(m.slug, m.slug.toLowerCase(), `slug "${m.slug}" is not lowercase`);
    assert.ok(!seen.has(m.slug), `slug "${m.slug}" appears twice`);
    seen.add(m.slug);
  }
  assert.equal(TEST_METHOD_BY_SLUG.size, TEST_METHODS.length);
});

test("the slug is the shortName's number: the linker maps printed text to slugs this way", () => {
  for (const m of TEST_METHODS) {
    const method = m.shortName.match(/^Method (\d+[A-Z]?)$/);
    const ps = m.shortName.match(/^Performance Specification (\d+)$/);
    assert.ok(method || ps, `shortName "${m.shortName}" is not "Method N[A]" or "Performance Specification N"`);
    const expected = method ? `method-${method[1].toLowerCase()}` : `ps-${ps![1]}`;
    assert.equal(m.slug, expected, `${m.shortName} should have slug ${expected}, has ${m.slug}`);
  }
});

test("every relatedSlugs entry resolves to an entry, and never to itself", () => {
  for (const m of TEST_METHODS) {
    for (const s of m.relatedSlugs) {
      assert.ok(TEST_METHOD_BY_SLUG.has(s), `${m.slug}: related slug "${s}" does not exist`);
      assert.notEqual(s, m.slug, `${m.slug} lists itself as related`);
    }
    assert.equal(new Set(m.relatedSlugs).size, m.relatedSlugs.length, `${m.slug}: a related slug repeats`);
  }
});

test("every ecfrUrl points at the current Title 40 on the eCFR", () => {
  for (const m of TEST_METHODS) {
    assert.ok(
      m.ecfrUrl.startsWith("https://www.ecfr.gov/current/title-40/"),
      `${m.slug}: ecfrUrl "${m.ecfrUrl}" is not under https://www.ecfr.gov/current/title-40/`
    );
  }
});

test("every category is a TestMethodCategory, and the index order covers them all", () => {
  for (const m of TEST_METHODS) {
    assert.ok(CATEGORIES.has(m.category), `${m.slug}: category "${m.category}" is not a TestMethodCategory`);
  }
  const listed = TEST_METHOD_CATEGORY_ORDER.flatMap((c) => testMethodsInCategory(c));
  assert.equal(listed.length, TEST_METHODS.length, "an entry's category is not in TEST_METHOD_CATEGORY_LABELS");
});

test("the prose fields are present and prose-only (no formulas, no markup)", () => {
  for (const m of TEST_METHODS) {
    for (const field of ["shortName", "officialTitle", "source", "measures", "principle", "equipment", "whenCited"] as const) {
      assert.ok(typeof m[field] === "string" && m[field].trim().length > 0, `${m.slug}: ${field} is empty`);
    }
    for (const field of ["measures", "principle", "equipment", "whenCited", "readerNotes"] as const) {
      const text = m[field];
      if (text === undefined) continue;
      assert.ok(!/[<>]/.test(text), `${m.slug}: ${field} carries markup`);
      assert.ok(!/[=∑∫√]|\\frac|\^\d/.test(text), `${m.slug}: ${field} looks like a formula`);
    }
    assert.equal(typeof m.titleVerified, "boolean", `${m.slug}: titleVerified is not a boolean`);
  }
});

test("the JSON file is exactly what the wrapper exports (one source of truth for TypeScript and Python)", () => {
  const raw = JSON.parse(readFileSync(path.join(__dirname, "..", "src", "data", "test-methods.json"), "utf8"));
  assert.deepEqual(raw, TEST_METHODS);
});

// ---- official text: sections 1.0-2.0 (scripts/fetch_method_sections.py) ----

// What the script emits: the importer's provision-text HTML. Anything else in
// officialText means the file was edited by hand or the script changed.
const OFFICIAL_TAGS = new Set(["p", "h3", "h4", "i", "b", "sup", "sub", "br", "a", "div", "table", "thead", "tbody", "tfoot", "tr", "th", "td"]);
const OFFICIAL_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

test("every entry carries its official sections 1.0-2.0, source and retrieval date", () => {
  for (const m of TEST_METHODS) {
    assert.equal(typeof m.officialText, "string", `${m.slug}: officialText missing`);
    assert.ok(m.officialText.length >= 200 && m.officialText.length <= 20000, `${m.slug}: officialText is ${m.officialText.length} characters`);
    assert.equal(typeof m.officialTextSource, "string", `${m.slug}: officialTextSource missing`);
    assert.ok(
      m.officialTextSource.startsWith(`${m.source}, ${m.shortName}, sections 1`),
      `${m.slug}: officialTextSource "${m.officialTextSource}" does not name ${m.source}, ${m.shortName}`
    );
    assert.match(m.officialTextRetrieved, /^\d{4}-\d{2}-\d{2}$/, `${m.slug}: officialTextRetrieved is not YYYY-MM-DD`);
    const d = new Date(`${m.officialTextRetrieved}T00:00:00Z`);
    assert.ok(!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m.officialTextRetrieved, `${m.slug}: officialTextRetrieved is not a real date`);
    assert.equal(m.titleVerified, true, `${m.slug}: titleVerified is still false`);
  }
});

test("officialText parses as HTML with only the importer's tags and attributes", () => {
  for (const m of TEST_METHODS) {
    const doc = new JSDOM(`<body>${m.officialText}</body>`).window.document;
    const els = Array.from(doc.body.querySelectorAll("*"));
    assert.ok(els.length > 0, `${m.slug}: officialText has no elements`);
    for (const el of els) {
      const tag = el.tagName.toLowerCase();
      assert.ok(OFFICIAL_TAGS.has(tag), `${m.slug}: officialText has a <${tag}>`);
      for (const attr of Array.from(el.attributes)) {
        const ok = attr.name === "class" ? ["p", "div", "table"].includes(tag) : OFFICIAL_ATTRS[tag]?.has(attr.name);
        assert.ok(ok, `${m.slug}: <${tag} ${attr.name}> is not an attribute the script emits`);
      }
    }
    for (const a of Array.from(doc.body.querySelectorAll("a"))) {
      assert.ok(a.getAttribute("href")?.startsWith("https://www.ecfr.gov/"), `${m.slug}: a link in officialText leaves the eCFR`);
    }
    assert.ok(/^1\.0?\s/.test(doc.body.textContent ?? ""), `${m.slug}: officialText does not open with section 1`);
  }
});

test("the method-21 page shows the official text, then EssentialRegs notes", () => {
  const m = TEST_METHOD_BY_SLUG.get("method-21")!;
  const html = renderToStaticMarkup(createElement(TestMethodBody, { method: m }));
  const official = html.indexOf(">From the method — official text</h2>");
  const notes = html.indexOf(">EssentialRegs notes</h2>");
  const measures = html.indexOf(">What it measures</h3>");
  assert.ok(official >= 0, "no official-text heading");
  assert.ok(notes > official, "EssentialRegs notes does not follow the official text");
  assert.ok(measures > notes, "the editorial sections are not under EssentialRegs notes");
  const body = new JSDOM(html).window.document;
  const section = body.getElementById("official-text")!;
  assert.ok(section, "no #official-text section");
  const caption = section.querySelector("p")!.textContent!;
  assert.ok(caption.includes(`of ${m.officialTitle}, as published at ${m.source}.`), caption);
  assert.ok(caption.includes("The full method is on the eCFR."), caption);
  const text = section.querySelector(".method-text")!.textContent!;
  assert.ok(text.startsWith("1.0"), `official text starts "${text.slice(0, 40)}"`);
  assert.ok(text.includes("2.0"), "section 2.0 missing from the rendered official text");
  assert.ok(html.indexOf("1.0") < html.indexOf(">EssentialRegs notes<"));
});

test("the official text is rendered through the reader's sanitizer", () => {
  const m = { ...TEST_METHOD_BY_SLUG.get("method-21")!, officialText: '<p>1.0 x<script>alert(1)</script><img src=x onerror="alert(1)"></p>' };
  const html = renderToStaticMarkup(createElement(MethodOfficialText, { method: m }));
  assert.ok(!html.includes("<script"), "a script survived");
  assert.ok(!html.includes("onerror"), "an event handler survived");
});

// ---- the generated slug list (corpus_qa.sql check 26) -----------------------

test("scripts/test-method-slugs.sql is current: regenerate with `npx tsx scripts/test-method-slugs.ts`", () => {
  const onDisk = readFileSync(TEST_METHOD_SLUGS_SQL, "utf8");
  assert.equal(onDisk, renderTestMethodSlugsSql(), "scripts/test-method-slugs.sql is stale: run `npx tsx scripts/test-method-slugs.ts` and commit it");
  for (const m of TEST_METHODS) assert.ok(onDisk.includes(`('${m.slug}')`), `${m.slug} missing from the generated file`);
});
