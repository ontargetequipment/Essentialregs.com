/**
 * Test-method detection for keyword search (src/lib/test-method-search.ts):
 * the forms that must name a method, and the ones that must not.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { detectTestMethod } from "../src/lib/test-method-search";

const slugOf = (q: string) => detectTestMethod(q)?.slug ?? null;

test("clear forms of a method name find its page", () => {
  assert.equal(slugOf("Method 21"), "method-21");
  assert.equal(slugOf("method 21"), "method-21");
  assert.equal(slugOf("  EPA Method 21 "), "method-21");
  assert.equal(slugOf("EPA  method   21"), "method-21");
  assert.equal(slugOf("Method 25A"), "method-25a");
  assert.equal(slugOf("method-25a"), "method-25a");
  assert.equal(slugOf("EPA Reference Method 9"), "method-9");
  assert.equal(slugOf("Method 21 test method"), "method-21");
  assert.equal(slugOf("Performance Specification 8"), "ps-8");
  assert.equal(slugOf("PS 8"), "ps-8");
  assert.equal(slugOf("EPA Method 301"), "method-301");
});

test("a method is matched exactly: 2 is not 2A, and other words make it a provision search", () => {
  assert.equal(slugOf("Method 2"), "method-2");
  assert.equal(slugOf("Method 2A"), "method-2a");
  assert.equal(slugOf("Method 20"), null); // not in the data file
  assert.equal(slugOf("Method 21 leak definition"), null);
  assert.equal(slugOf("monitoring method 21 requirements"), null);
  assert.equal(slugOf("storage tank requirements"), null);
  assert.equal(slugOf("method"), null);
  assert.equal(slugOf(""), null);
  assert.equal(slugOf("   "), null);
});
