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

// ---- the generated slug list (corpus_qa.sql check 26) -----------------------

test("scripts/test-method-slugs.sql is current: regenerate with `npx tsx scripts/test-method-slugs.ts`", () => {
  const onDisk = readFileSync(TEST_METHOD_SLUGS_SQL, "utf8");
  assert.equal(onDisk, renderTestMethodSlugsSql(), "scripts/test-method-slugs.sql is stale: run `npx tsx scripts/test-method-slugs.ts` and commit it");
  for (const m of TEST_METHODS) assert.ok(onDisk.includes(`('${m.slug}')`), `${m.slug} missing from the generated file`);
});
