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
import { loadReaderPage, resolveReaderPage, type ReaderPageDeps } from "../src/lib/reader-page";
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

const cached: RenderedReader = { title: "REGULATION T", blurb: "", dateLine: null, navHtml: "<nav-from-cache>", docHtml: "<doc-from-cache>" };

function deps(entitled: boolean, liveRows: Provision[] = [publicRoot], visible = true, publicRegs: readonly string[] = ["t"]) {
  const calls: string[] = [];
  const d: ReaderPageDeps = {
    isVisible: async (reg) => {
      calls.push(`isVisible:${reg}`);
      return visible;
    },
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
    publicRegs,
  };
  return { d, calls };
}

test("an unentitled request never reaches the cached path", async () => {
  const { d, calls } = deps(false);
  const reader = await loadReaderPage("t", d);
  assert.deepEqual(calls, ["isVisible:t", "hasAccess", "fetchLive:t"]);
  // Rendered live from what RLS let through: the root row only.
  assert.ok(reader);
  assert.equal(reader.title, "REGULATION T");
  assert.ok(reader.docHtml.includes("The public root row"));
  assert.ok(!reader.docHtml.includes("from-cache"));
});

test("an unentitled request with nothing visible 404s without touching the cache", async () => {
  const { d, calls } = deps(false, []);
  assert.equal(await loadReaderPage("t", d), null);
  assert.deepEqual(calls, ["isVisible:t", "hasAccess", "fetchLive:t"]);
});

test("an entitled request reads the cache under the data version, never the live path", async () => {
  const { d, calls } = deps(true);
  const reader = await loadReaderPage("t", d);
  assert.deepEqual(calls, ["isVisible:t", "hasAccess", "fetchVersion:t", "fetchCached:t:6754:2026-09-20T15:13:42Z"]);
  assert.equal(reader, cached);
});

test("the gate runs before anything else, on every call", async () => {
  const { d, calls } = deps(false);
  await loadReaderPage("t", d);
  await loadReaderPage("t", d);
  assert.deepEqual(calls, ["isVisible:t", "hasAccess", "fetchLive:t", "isVisible:t", "hasAccess", "fetchLive:t"]);
});

test("a staged document 404s before the entitlement gate and before any fetch, entitled or not", async () => {
  for (const entitled of [false, true]) {
    const { d, calls } = deps(entitled, [publicRoot], false);
    assert.equal(await loadReaderPage("oooo", d), null);
    assert.deepEqual(calls, ["isVisible:oooo"]);
  }
});

test("an unentitled request for a regulation that is not public 404s without a single read (Sprint 4)", async () => {
  // Even if some of its rows were public (the old /regs/<id> sample rows),
  // the reader is not on: only PUBLIC_READER_REGS opens one.
  const { d, calls } = deps(false, [publicRoot], true, ["gp05"]);
  assert.equal(await loadReaderPage("t", d), null);
  assert.deepEqual(calls, ["isVisible:t", "hasAccess"], "no fetchLive, fetchVersion or fetchCached");
});

test("the public sample regulation renders live for a visitor and never touches the cache", async () => {
  const gp05Root = { ...publicRoot, id: "sec-gp05-top-REG-gp05", citation: "GP05", title: "GP05" };
  const { d, calls } = deps(false, [gp05Root], true, ["gp05"]);
  const reader = await loadReaderPage("gp05", d);
  assert.ok(reader);
  assert.deepEqual(calls, ["isVisible:gp05", "hasAccess", "fetchLive:gp05"]);
  assert.ok(!reader.docHtml.includes("from-cache"));
});

test("with the real PUBLIC_READER_REGS: GP05 is open to a visitor, Regulation 7 is not", async () => {
  const sample = deps(false);
  delete (sample.d as { publicRegs?: unknown }).publicRegs;
  assert.ok(await loadReaderPage("gp05", sample.d));
  assert.equal(await loadReaderPage("7", sample.d), null);
  assert.deepEqual(sample.calls, ["isVisible:gp05", "hasAccess", "fetchLive:gp05", "isVisible:7", "hasAccess"]);
});

test("a staged public-sample regulation is still hidden from a visitor", async () => {
  const { d, calls } = deps(false, [publicRoot], false, ["t"]);
  assert.equal(await loadReaderPage("t", d), null);
  assert.deepEqual(calls, ["isVisible:t"]);
});

test("an entitled request is unaffected by the public list", async () => {
  const { d, calls } = deps(true, [publicRoot], true, []);
  assert.equal(await loadReaderPage("7", d), cached);
  assert.deepEqual(calls, ["isVisible:7", "hasAccess", "fetchVersion:7", "fetchCached:7:6754:2026-09-20T15:13:42Z"]);
});

test("Regulation 7's reader stays closed to a visitor although its I.C.1 subtree rows are public (Sprint 7)", async () => {
  // The subtree is public for the focused preview (preview-subtree.ts); marking rows public must
  // never open the reader: only PUBLIC_READER_REGS does, and it is GP05 alone.
  const sub = { ...publicRoot, id: "sec-7-B-I-C-1", citation: "I.C.1.", title: "I.C.1. General Requirements", parent_id: "sec-7-B-I-C" };
  const sample = deps(false, [sub]);
  delete (sample.d as { publicRegs?: unknown }).publicRegs;
  assert.equal(await loadReaderPage("7", sample.d), null);
  assert.deepEqual(sample.calls, ["isVisible:7", "hasAccess"], "no read of any kind, live or cached");
});

// ---------------------------------------------------------------------------
// Sprint 8 (11 Oct 2026): no cross-reference ever 404s. A request WITHOUT
// access for a regulation that exists and is released resolves to "preview"
// (the page renders a redirect to the focused preview); an unknown or staged
// one is still "not-found", and so is a subscriber's empty reader.
// ---------------------------------------------------------------------------

const root7 = { id: "sec-7-top-REG-7", citation: "Code of Colorado Regulations · Regulation Number 7" };

function gate(entitled: boolean, opts: { visible?: boolean; root?: typeof root7 | null; cachedBody?: RenderedReader | null } = {}) {
  const base = deps(entitled, [publicRoot], opts.visible ?? true, ["gp05"]);
  const calls = base.calls;
  const d: ReaderPageDeps = {
    ...base.d,
    fetchRoot: async (reg) => {
      calls.push(`fetchRoot:${reg}`);
      return opts.root === undefined ? root7 : opts.root;
    },
  };
  if (opts.cachedBody !== undefined) {
    d.fetchCached = async (reg, version) => {
      calls.push(`fetchCached:${reg}:${version}`);
      return opts.cachedBody ?? null;
    };
  }
  return { d, calls };
}

test("a visitor's request for a regulation that exists but is not public resolves to its preview, with one root read and nothing else", async () => {
  const { d, calls } = gate(false);
  assert.deepEqual(await resolveReaderPage("7", d), { kind: "preview", root: root7 });
  assert.deepEqual(calls, ["isVisible:7", "hasAccess", "fetchRoot:7"], "no fetchLive, fetchVersion or fetchCached");
  assert.equal(await loadReaderPage("7", d), null, "loadReaderPage keeps answering null: it is not a reader");
});

test("an unknown regulation is still not-found for a visitor", async () => {
  const { d, calls } = gate(false, { root: null });
  assert.deepEqual(await resolveReaderPage("doesnotexist1", d), { kind: "not-found" });
  assert.deepEqual(calls, ["isVisible:doesnotexist1", "hasAccess", "fetchRoot:doesnotexist1"]);
});

test("a staged document is not-found before the entitlement gate and before any root read", async () => {
  for (const entitled of [false, true]) {
    const { d, calls } = gate(entitled, { visible: false });
    assert.deepEqual(await resolveReaderPage("oooo", d), { kind: "not-found" });
    assert.deepEqual(calls, ["isVisible:oooo"]);
  }
});

test("an admin without access to a staged document gets not-found too: the root read (the teaser's release rule) finds nothing", async () => {
  const { d, calls } = gate(false, { visible: true, root: null });
  assert.deepEqual(await resolveReaderPage("oooo", d), { kind: "not-found" });
  assert.deepEqual(calls, ["isVisible:oooo", "hasAccess", "fetchRoot:oooo"]);
});

test("a subscriber whose reader comes back empty keeps the 404: the preview would redirect them straight back (no loop)", async () => {
  const { d, calls } = gate(true, { cachedBody: null });
  assert.deepEqual(await resolveReaderPage("7", d), { kind: "not-found" });
  assert.deepEqual(calls, ["isVisible:7", "hasAccess", "fetchVersion:7", "fetchCached:7:6754:2026-09-20T15:13:42Z"], "no root read");
});

test("a subscriber's reader is the cached body, whatever fetchRoot would say", async () => {
  const { d, calls } = gate(true);
  assert.deepEqual(await resolveReaderPage("7", d), { kind: "reader", reader: cached });
  assert.ok(!calls.some((c) => c.startsWith("fetchRoot")));
});

test("the public sample reader renders for a visitor without a root read", async () => {
  const gp05Root = { ...publicRoot, id: "sec-gp05-top-REG-gp05", citation: "GP05", title: "GP05" };
  const base = deps(false, [gp05Root], true, ["gp05"]);
  const d: ReaderPageDeps = { ...base.d, fetchRoot: async () => root7 };
  const result = await resolveReaderPage("gp05", d);
  assert.equal(result.kind, "reader");
  assert.deepEqual(base.calls, ["isVisible:gp05", "hasAccess", "fetchLive:gp05"]);
});

test("the preview answer carries a name and nothing of the document", async () => {
  const { d } = gate(false);
  const result = await resolveReaderPage("7", d);
  assert.deepEqual(Object.keys(result).sort(), ["kind", "root"]);
  assert.ok(result.kind === "preview");
  assert.deepEqual(Object.keys(result.root).sort(), ["citation", "id"]);
});
