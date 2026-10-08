/**
 * /changelog never depends on the live aggregate (7 Oct 2026: a statement
 * timeout in changelog_public() while imports were writing made the page a
 * 500). fetchChangelogWith() reads the stored snapshot, falls back to the
 * live function only when the snapshot was never written, keeps the last
 * good rows this instance saw, and reports an error otherwise; the page
 * renders in every case.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ChangelogBody } from "../src/components/ChangelogBody";
import { CHANGELOG_UNAVAILABLE_NOTICE, buildChangelogView, type ChangelogCountRow } from "../src/lib/changelog-group";
import { fetchChangelogWith, resetChangelogMemory, type ChangelogClient } from "../src/lib/changelog";

const ROWS: ChangelogCountRow[] = [
  { day: "2026-10-06", reg_key: "7", change_type: "links_updated", provision_count: 22, latest: "2026-10-07T01:39:30Z" },
  { day: "2026-10-05", reg_key: "3", change_type: "summary_approved", provision_count: 2, latest: "2026-10-05T01:00:00Z" },
];

function client(answers: Record<string, { data?: unknown; error?: string | Error }>): ChangelogClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    rpc(fn: string) {
      calls.push(fn);
      const a = answers[fn];
      if (!a) return Promise.resolve({ data: null, error: { message: `no such function ${fn}` } });
      if (a.error instanceof Error) return Promise.reject(a.error);
      return Promise.resolve({ data: a.data ?? null, error: a.error ? { message: a.error } : null });
    },
  };
}

test("the snapshot answers: its rows and computed_at, no live call", async () => {
  resetChangelogMemory();
  const c = client({ changelog_snapshot_public: { data: [{ rows: ROWS, computed_at: "2026-10-07T12:00:00+00:00" }] } });
  const r = await fetchChangelogWith(c);
  assert.deepEqual(r, { rows: ROWS, computedAt: "2026-10-07T12:00:00+00:00", source: "snapshot", error: null });
  assert.deepEqual(c.calls, ["changelog_snapshot_public"]);
});

test("a snapshot never written falls back to the live function once", async () => {
  resetChangelogMemory();
  const c = client({ changelog_snapshot_public: { data: [] }, changelog_public: { data: ROWS } });
  const r = await fetchChangelogWith(c);
  assert.equal(r.source, "live");
  assert.deepEqual(r.rows, ROWS);
  assert.equal(r.error, null);
  assert.deepEqual(c.calls, ["changelog_snapshot_public", "changelog_public"]);
});

test("when both fail the result carries the error and no rows; after a good read, the last good rows", async () => {
  resetChangelogMemory();
  const failing = client({
    changelog_snapshot_public: { error: "canceling statement due to statement timeout" },
    changelog_public: { error: new Error("fetch failed") },
  });
  const none = await fetchChangelogWith(failing);
  assert.equal(none.source, "none");
  assert.deepEqual(none.rows, []);
  assert.match(none.error ?? "", /snapshot: canceling statement due to statement timeout; live: fetch failed/);
  // A good read, then the same failure: the rows this instance saw come back.
  await fetchChangelogWith(client({ changelog_snapshot_public: { data: [{ rows: ROWS, computed_at: "2026-10-07T12:00:00+00:00" }] } }));
  const memory = await fetchChangelogWith(failing);
  assert.equal(memory.source, "memory");
  assert.deepEqual(memory.rows, ROWS);
  assert.match(memory.error ?? "", /statement timeout/);
  resetChangelogMemory();
});

test("the page renders when the RPC errors: the three headings, the notice and the empty lines", () => {
  const view = buildChangelogView({ rows: [], computedAt: null, source: "none", error: "snapshot: timeout; live: timeout" }, (d) => d);
  const html = renderToStaticMarkup(createElement(ChangelogBody, { view }));
  assert.match(html, /<h1[^>]*>Changelog<\/h1>/);
  for (const [key, title] of [
    ["regulatory", "Regulatory changes"],
    ["links", "Links, sources and transcription"],
    ["summaries", "Summary quality"],
  ]) {
    assert.ok(html.includes(`<h2 id="changelog-${key}"`), key);
    assert.ok(html.includes(`>${title}</h2>`), title);
  }
  assert.ok(html.includes(CHANGELOG_UNAVAILABLE_NOTICE));
  assert.equal((html.match(/data-empty-section=/g) ?? []).length, 3);
  assert.ok(html.includes("An automated second pass compares each plain-English summary"));
  // No line, no details, no link to a regulation.
  assert.ok(!html.includes("<details"));
  assert.ok(!html.includes('href="/regulations/'));
});

test("the page renders the rows when they load: the regulatory empty line names the first day; links and summaries list theirs", () => {
  const view = buildChangelogView({ rows: ROWS, computedAt: "2026-10-07T12:00:00+00:00", source: "snapshot", error: null }, (d) => `Day ${d}`);
  const html = renderToStaticMarkup(createElement(ChangelogBody, { view }));
  assert.ok(!html.includes(CHANGELOG_UNAVAILABLE_NOTICE));
  assert.ok(html.includes("No agency rule changes recorded since Day 2026-10-05."));
  assert.ok(html.includes('href="/regulations/7"'));
  assert.ok(html.includes("links added or updated in 22 provisions"));
  assert.ok(html.includes("<details"));
  assert.ok(html.includes("2 summaries AI reviewed"));
});
