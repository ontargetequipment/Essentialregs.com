/**
 * The cached reader body is fetched with the service-role client and holds
 * a paid regulation's full text. This proves the gate in front of it
 * (loadReaderPage in src/lib/reader-page.ts): an unentitled request never
 * touches the cache -- not the version query, not the cached body -- and
 * takes the RLS-bound live path instead; an entitled request reads the
 * cache under the version it just fetched and never the live path.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadReaderPage, type ReaderPageDeps } from "../src/lib/reader-page";
import type { RenderedReader } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

const publicRoot: Provision = {
  id: "sec-t-top-REG-t",
  citation: "REGULATION T",
  title: "REGULATION T",
  jurisdiction_level: "state",
  issuing_body: "TEST",
  parent_id: null,
  full_text: "<p>REGULATION T The public root row</p>",
  ai_summary: null,
  source_url: null,
  last_verified_date: null,
  is_public: true,
  sort_order: 0,
};

const cached: RenderedReader = { title: "REGULATION T", blurb: "", navHtml: "<nav-from-cache>", docHtml: "<doc-from-cache>" };

function deps(entitled: boolean, liveRows: Provision[] = [publicRoot]) {
  const calls: string[] = [];
  const d: ReaderPageDeps = {
    hasAccess: async () => {
      calls.push("hasAccess");
      return entitled;
    },
    fetchLive: async (reg) => {
      calls.push(`fetchLive:${reg}`);
      return liveRows;
    },
    fetchVersion: async (reg) => {
      calls.push(`fetchVersion:${reg}`);
      return "6754:2026-09-20T15:13:42Z";
    },
    fetchCached: async (reg, version) => {
      calls.push(`fetchCached:${reg}:${version}`);
      return cached;
    },
  };
  return { d, calls };
}

test("an unentitled request never reaches the cached path", async () => {
  const { d, calls } = deps(false);
  const reader = await loadReaderPage("t", d);
  assert.deepEqual(calls, ["hasAccess", "fetchLive:t"]);
  // Rendered live from what RLS let through: the root row only.
  assert.ok(reader);
  assert.equal(reader.title, "REGULATION T");
  assert.ok(reader.docHtml.includes("The public root row"));
  assert.ok(!reader.docHtml.includes("from-cache"));
});

test("an unentitled request with nothing visible 404s without touching the cache", async () => {
  const { d, calls } = deps(false, []);
  assert.equal(await loadReaderPage("t", d), null);
  assert.deepEqual(calls, ["hasAccess", "fetchLive:t"]);
});

test("an entitled request reads the cache under the data version, never the live path", async () => {
  const { d, calls } = deps(true);
  const reader = await loadReaderPage("t", d);
  assert.deepEqual(calls, ["hasAccess", "fetchVersion:t", "fetchCached:t:6754:2026-09-20T15:13:42Z"]);
  assert.equal(reader, cached);
});

test("the gate runs before anything else, on every call", async () => {
  const { d, calls } = deps(false);
  await loadReaderPage("t", d);
  await loadReaderPage("t", d);
  assert.deepEqual(calls, ["hasAccess", "fetchLive:t", "hasAccess", "fetchLive:t"]);
});
