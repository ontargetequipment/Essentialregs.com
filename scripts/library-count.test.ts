/**
 * "The full library has N provisions matching ..." under a visitor's empty
 * keyword search (Sprint 8, 11 Oct 2026): the sentence and its quoting, when
 * the line is shown (N above 0) and when it is not (0, a failed call, a thrown
 * call, anything but a whole number), the one RPC call it makes, and the
 * markup of the notice with its trial link, rendered with react-dom/server.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryCountNotice } from "../src/components/LibraryCountNotice";
import { fetchLibraryMatchCount, libraryCountSentence, type LibraryCountClient } from "../src/lib/library-count";

function client(answer: { data?: unknown; error?: string | Error }): LibraryCountClient & { calls: { fn: string; args: Record<string, unknown> }[] } {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc(fn, args) {
      calls.push({ fn, args });
      if (answer.error instanceof Error) return Promise.reject(answer.error);
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ? { message: answer.error } : null });
    },
  };
}

test("the sentence: the page's curly quotes around the visitor's words, the count with a thousands separator", () => {
  assert.equal(
    libraryCountSentence("dehydrator", 47),
    "No matches in GP05. The full library has 47 provisions matching “dehydrator”."
  );
  assert.equal(libraryCountSentence("method 21", 1234), "No matches in GP05. The full library has 1,234 provisions matching “method 21”.");
  assert.equal(libraryCountSentence("flare", 1), "No matches in GP05. The full library has 1 provision matching “flare”.");
});

test("the sentence is hidden for 0, a missing count and anything that is not a whole number of 1 or more", () => {
  for (const n of [0, null, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(libraryCountSentence("dehydrator", n), null, String(n));
  }
});

test("one RPC call, count_provisions_matching with the query; the number comes back", async () => {
  const c = client({ data: 47 });
  assert.equal(await fetchLibraryMatchCount(c, "dehydrator"), 47);
  assert.deepEqual(c.calls, [{ fn: "count_provisions_matching", args: { q: "dehydrator" } }]);
});

test("a count of 0 is returned as 0 (the line is hidden by the sentence, not by the fetch)", async () => {
  assert.equal(await fetchLibraryMatchCount(client({ data: 0 }), "zzzqqq"), 0);
});

test("an error, a thrown call and a non-number all read as unavailable", async () => {
  assert.equal(await fetchLibraryMatchCount(client({ error: 'function public.count_provisions_matching(q => text) does not exist' }), "dehydrator"), null);
  assert.equal(await fetchLibraryMatchCount(client({ error: new Error("fetch failed") }), "dehydrator"), null);
  assert.equal(await fetchLibraryMatchCount(client({ data: "47" }), "dehydrator"), null);
  assert.equal(await fetchLibraryMatchCount(client({ data: [{ id: "sec-7-B" }] }), "dehydrator"), null);
  assert.equal(await fetchLibraryMatchCount(client({ data: 1.5 }), "dehydrator"), null);
  assert.equal(await fetchLibraryMatchCount(client({ data: -1 }), "dehydrator"), null);
});

test("an empty query makes no call", async () => {
  const c = client({ data: 5 });
  assert.equal(await fetchLibraryMatchCount(c, "   "), null);
  assert.deepEqual(c.calls, []);
});

test("the notice: the sentence and a trial link; /signup with no account, /pricing signed in without a plan", () => {
  const out = renderToStaticMarkup(createElement(LibraryCountNotice, { query: "dehydrator", count: 47, signedIn: false }));
  assert.match(out, /data-testid="library-count"/);
  assert.match(out, /No matches in GP05\. The full library has 47 provisions matching “dehydrator”\./);
  assert.match(out, /<a [^>]*href="\/signup"[^>]*>Start your 7-day trial<\/a>/);
  const signedIn = renderToStaticMarkup(createElement(LibraryCountNotice, { query: "dehydrator", count: 47, signedIn: true }));
  assert.match(signedIn, /href="\/pricing"/);
});

test("the notice renders nothing when the count is 0 or unavailable", () => {
  for (const count of [0, null]) {
    assert.equal(renderToStaticMarkup(createElement(LibraryCountNotice, { query: "dehydrator", count, signedIn: false })), "", String(count));
  }
});

test("leak check: the notice carries the visitor's own words and a number, nothing else, and escapes the words", () => {
  const out = renderToStaticMarkup(createElement(LibraryCountNotice, { query: '<img src=x onerror=1> "flare"', count: 3, signedIn: false }));
  assert.ok(!out.includes("<img"), "the query is escaped");
  assert.ok(out.includes("&lt;img"));
  const text = out.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, " ");
  // Strip the sentence, the escaped query and the link text: what is left is the trial wording only.
  assert.match(text, /No matches in GP05\. The full library has 3 provisions matching/);
  assert.ok(!/sec-|§|citation|Regulation \d/i.test(out), "no id, citation or regulation name");
});

test("the migration: count-only, SECURITY DEFINER, pinned search_path, search_provisions' predicate, staged excluded, granted to the API roles, no statement that removes an object", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261011190000_count_provisions_matching.sql", import.meta.url), "utf8");
  // The Supabase connector holds any statement containing the word, comments included.
  assert.ok(!/drop/i.test(sql), "no DROP anywhere in the file");
  assert.match(sql, /create or replace function public\.count_provisions_matching\(q text\)\s+returns integer/i);
  assert.match(sql, /\bstable\b/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = public\b/i);
  assert.match(sql, /p\.search_vector @@ query\.tsq/);
  assert.match(sql, /websearch_to_tsquery\('english', left\(btrim\(coalesce\(q, ''\)\), 200\)\)/);
  assert.match(sql, /not public\.is_basis_provision\(p\.id\)/);
  assert.match(sql, /public\.reg_is_released\(p\.reg_key\)/);
  // Returns the count and reads nothing else for output: no id, text or rank in the select list.
  const body = /\$function\$([\s\S]*?)\$function\$/.exec(sql)![1];
  assert.match(body, /select count\(\*\)::integer\s+from public\.provisions p/i);
  assert.ok(!/\b(p\.title|p\.citation|p\.full_text|ts_rank|ts_headline)\b/.test(body), "no column or rank is read for output");
  assert.match(sql, /revoke all on function public\.count_provisions_matching\(text\) from public;/i);
  assert.match(sql, /grant execute on function public\.count_provisions_matching\(text\) to anon, authenticated, service_role;/i);
  // Same match as the latest search_provisions.
  const search = readFileSync(new URL("../supabase/migrations/20261008013528_keyword_search_named_document_first.sql", import.meta.url), "utf8");
  assert.match(search, /websearch_to_tsquery\('english', q\)/);
  assert.match(search, /p\.search_vector @@ query\.tsq/);
});
