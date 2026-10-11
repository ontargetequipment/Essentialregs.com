/**
 * The gate behind GET /api/provision/[id] (src/lib/provision-preview.ts),
 * with its two effects faked: param validation first (nothing is looked up
 * for a bad id), then 401 / 403 / 404, and a 200 that carries only what the
 * reader's preview popup needs, sanitised.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadProvisionPreview,
  previewCacheControl,
  previewSummary,
  validPreviewId,
  type PreviewDeps,
  type PreviewLabel,
  type PreviewRow,
} from "../src/lib/provision-preview";
import type { SubtreeRow } from "../src/lib/preview-subtree";

const ROW: PreviewRow = {
  id: "sec-7-B-I-B-33",
  citation: "I.B.33.",
  full_text:
    '<p>Opacity shall not exceed <span class="xref" data-target="sec-7-B-I-B-34">Section I.B.34</span>.</p>' +
    '<script>alert(1)</script><img src="x" onerror="alert(2)">',
};

const LABEL: PreviewLabel = {
  id: "sec-7-B-I-B-33",
  citation: "I.B.33.",
  title: "I.B.33. OPACITY",
  context_path: "PART B — Oil and Natural Gas › I. Definitions",
};

type DepsOver = {
  signedIn?: boolean;
  hasAccess?: boolean;
  row?: PreviewRow | null;
  label?: PreviewLabel | null;
  /** What the visitor's own RLS-bound subtree read returns; default none (every row locked). */
  subtree?: SubtreeRow[] | Error;
  /** The panel context; default: nothing pending, a root source link. null = staged; an Error = the read fails. */
  ctx?: { rootSourceUrl: string | null; pendingSummaries: number } | null | Error;
};

function deps(over: DepsOver = {}) {
  const calls = { access: 0, fetch: [] as string[], label: [] as string[], subtree: [] as string[], ctx: [] as string[] };
  const d: PreviewDeps = {
    access: async () => {
      calls.access++;
      return { signedIn: over.signedIn ?? true, hasAccess: over.hasAccess ?? true };
    },
    fetchRow: async (id) => {
      calls.fetch.push(id);
      return over.row === undefined ? ROW : over.row;
    },
    fetchLabel: async (id) => {
      calls.label.push(id);
      return over.label === undefined ? LABEL : over.label;
    },
    fetchSubtree: async (id) => {
      calls.subtree.push(id);
      if (over.subtree instanceof Error) throw over.subtree;
      return over.subtree ?? [];
    },
    fetchPanelContext: async (key) => {
      calls.ctx.push(key);
      if (over.ctx instanceof Error) throw over.ctx;
      return over.ctx === undefined ? { rootSourceUrl: "https://www.sos.state.co.us/CCR/reg7", pendingSummaries: 0 } : over.ctx;
    },
  };
  return { d, calls };
}

test("validPreviewId: the codebase's provision-id pattern, bounded, sec-<reg>- shaped", () => {
  for (const ok of ["sec-7-B-I-B-33", "sec-gp12-I-A-8-d-(i)", "sec-7-top-REG-7", "sec-3-A-II-B-4-a-(i)-(A)"]) {
    assert.equal(validPreviewId(ok), ok);
  }
  for (const bad of [
    "",
    "nonsense",
    "javascript:alert(1)",
    "sec-7-B'--",
    "sec-7-B;drop table provisions",
    "sec-7 B",
    "sec-7-B,id.eq.x", // PostgREST filter syntax
    "sec-7-B*",
    "sec-" + "x-".repeat(150),
  ]) {
    assert.equal(validPreviewId(bad), null, bad);
  }
});

test("a bad id is a 400 before anything is looked up", async () => {
  const { d, calls } = deps();
  for (const bad of ["", "nonsense", "sec-7-B'--", "sec-7-B,id.eq.x", "sec-" + "x-".repeat(150)]) {
    const res = await loadProvisionPreview(bad, d);
    assert.equal(res.status, 400, bad);
  }
  assert.equal(calls.access, 0, "not even the entitlement check ran");
  assert.deepEqual(calls.fetch, []);
  assert.deepEqual(calls.label, []);
});

test("signed out gets a locked label, not a 401, and the text is never read (Sprint 4, 10 Oct 2026)", async () => {
  const { d, calls } = deps({ signedIn: false, hasAccess: false });
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    locked: true,
    id: "sec-7-B-I-B-33",
    reg_key: "7",
    citation: "I.B.33.",
    title: "OPACITY",
    path: "PART B — Oil and Natural Gas › I. Definitions",
  });
  assert.deepEqual(calls.fetch, [], "the RLS-bound text read never ran");
  assert.deepEqual(calls.label, ["sec-7-B-I-B-33"]);
  assert.equal(previewCacheControl(res), "no-store");
});

test("signed in without access gets the same locked label, not a 403", async () => {
  const { d, calls } = deps({ signedIn: true, hasAccess: false });
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.equal(res.status, 200);
  assert.equal((res.body as { locked?: boolean }).locked, true);
  assert.deepEqual(calls.fetch, []);
});

test("the locked payload carries the label and nothing else: no html, text or summary", async () => {
  const { d } = deps({ signedIn: false, hasAccess: false });
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.deepEqual(Object.keys(res.body).sort(), ["citation", "id", "locked", "path", "reg_key", "title"]);
  assert.doesNotMatch(JSON.stringify(res.body), /html|full_text|ai_summary|<p>/);
});

test("a root row's locked label keeps the document title; a missing path is null", async () => {
  const { d } = deps({
    signedIn: false,
    hasAccess: false,
    label: { id: "sec-8-top-REG-8", citation: "Code of Colorado Regulations · Regulation Number 8", title: "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10", context_path: null },
  });
  const res = await loadProvisionPreview("sec-8-top-REG-8", d);
  assert.equal(res.status, 200);
  assert.equal((res.body as { title: string }).title, "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10");
  assert.equal((res.body as { path: string | null }).path, null);
});

test("an unentitled request for a row that does not exist, or whose regulation is staged, is a 404", async () => {
  const { d, calls } = deps({ signedIn: false, hasAccess: false, label: null });
  const res = await loadProvisionPreview("sec-7-B-I-B-99", d);
  assert.equal(res.status, 404);
  assert.deepEqual(calls.label, ["sec-7-B-I-B-99"]);
  assert.equal(previewCacheControl(res), "no-store");
});

test("an unentitled request for a PUBLIC_READER_REGS row gets the normal full payload through the RLS-bound read", async () => {
  const gp05: PreviewRow = { id: "sec-gp05-II-D", citation: "II.D.", title: "II.D. Emission limits", full_text: "<p>Limit.</p>" };
  const { d, calls } = deps({ signedIn: false, hasAccess: false, row: gp05 });
  const res = await loadProvisionPreview("sec-gp05-II-D", d);
  assert.equal(res.status, 200);
  assert.equal((res.body as { html?: string }).html?.includes("Limit."), true);
  assert.equal("locked" in res.body, false);
  assert.deepEqual(calls.fetch, ["sec-gp05-II-D"]);
  assert.deepEqual(calls.label, [], "no service-role read for a row RLS lets the visitor see");
  assert.equal(previewCacheControl(res), "private, max-age=300");
  // ...and RLS saying no (the migration not applied yet) is a 404, never a lock.
  const none = deps({ signedIn: false, hasAccess: false, row: null });
  assert.equal((await loadProvisionPreview("sec-gp05-II-D", none.d)).status, 404);
  // An entitled viewer never hits the label read.
  const sub = deps();
  await loadProvisionPreview("sec-7-B-I-B-33", sub.d);
  assert.deepEqual(sub.calls.label, []);
});

test("an entitled visitor asking for a row RLS hides or that does not exist gets a 404", async () => {
  const { d, calls } = deps({ row: null });
  const res = await loadProvisionPreview("sec-7-B-I-B-99", d);
  assert.equal(res.status, 404);
  assert.deepEqual(calls.fetch, ["sec-7-B-I-B-99"]);
});

test("an entitled visitor gets only id, reg_key, citation, title, sanitised badged html and the summary overview", async () => {
  const { d, calls } = deps();
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.fetch, ["sec-7-B-I-B-33"]);
  const body = res.body as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["citation", "html", "id", "reg_key", "summary", "title"]);
  assert.equal(previewCacheControl(res), "private, max-age=300");
  assert.equal(body.id, "sec-7-B-I-B-33");
  assert.equal(body.reg_key, "7");
  assert.equal(body.citation, "I.B.33.");
  assert.equal(body.title, "", "no title column in the row: empty, never undefined");
  assert.equal(body.summary, null, "no summary on the row");
  const html = String(body.html);
  assert.match(html, /Opacity shall not exceed/);
  assert.match(html, /data-target="sec-7-B-I-B-34"/, "cross-reference spans survive");
  assert.match(html, /<span class="item-id">I\.B\.33\.<\/span>/, "badged like a reader row");
  assert.doesNotMatch(html, /<script|onerror|alert\(/);
});

test("a parenthesised id is accepted (more than half the corpus has parens)", async () => {
  const { d, calls } = deps({ row: { id: "sec-gp12-I-A-8-d-(i)", citation: "I.A.8.d.(i)", full_text: "<p>x</p>" } });
  const res = await loadProvisionPreview("sec-gp12-I-A-8-d-(i)", d);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.fetch, ["sec-gp12-I-A-8-d-(i)"]);
  assert.equal((res.body as { reg_key: string }).reg_key, "gp12");
});

test("a whole-document preview carries the root's title and the two-sentence overview of its summary (7 Oct 2026)", async () => {
  const root: PreviewRow = {
    id: "sec-8-top-REG-8",
    citation: "Code of Colorado Regulations · Regulation Number 8",
    title: "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10",
    full_text: "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10",
    ai_summary: "Regulation 8 sets Colorado's hazardous air pollutant rules. It adopts the federal NESHAPs by reference. It also covers asbestos abatement.\n\nPart D covers lead.",
    summary_status: "approved",
    reviewed_at: "2026-10-05T04:45:29.910Z", // 22:45 on 4 Oct in Colorado (Sprint 5: the badge reads America/Denver)
  };
  const { d } = deps({ row: root });
  const res = await loadProvisionPreview("sec-8-top-REG-8", d);
  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body.title, "CONTROL OF HAZARDOUS AIR POLLUTANTS 5 CCR 1001-10");
  assert.deepEqual(body.summary, {
    overview: "Regulation 8 sets Colorado's hazardous air pollutant rules. It adopts the federal NESHAPs by reference.",
    badge: { kind: "reviewed", label: "AI-generated · automated check against source text · Oct 4, 2026" },
  });
  // No reviewer, no other metadata.
  assert.doesNotMatch(JSON.stringify(body), /reviewed_by|summary_original|Claude/);

  // Two sentences or fewer: the first paragraph whole. Pending: the pending badge. Markdown stripped.
  assert.deepEqual(previewSummary({ ai_summary: "**One.** Two.", summary_status: "pending", reviewed_at: null }), {
    overview: "One. Two.",
    badge: { kind: "pending", label: "AI-generated · not yet reviewed" },
  });
  // Rejected or absent: null.
  assert.equal(previewSummary({ ai_summary: "One. Two. Three.", summary_status: "rejected", reviewed_at: null }), null);
  assert.equal(previewSummary({ ai_summary: null, summary_status: "pending", reviewed_at: null }), null);
  assert.equal(previewSummary({ ai_summary: "   ", summary_status: "approved", reviewed_at: null }), null);
});

// ---------------------------------------------------------------------------
// A public row of a closed regulation, asked for by a visitor (11 Oct 2026,
// after Sprint 7): the reader's citation popup shows its text, summary control
// and source link; a locked row, and a locked parent of a public one, still
// get the label alone.
// ---------------------------------------------------------------------------

const PUBLIC_SOURCE = "https://www.sos.state.co.us/CCR/reg7";
function pub(id: string, citation: string, over: Partial<SubtreeRow> = {}): SubtreeRow {
  return {
    id,
    citation,
    title: citation,
    jurisdiction_level: "state",
    parent_id: null,
    full_text: `<p>${citation} text of ${id}.</p>`,
    ai_summary: null,
    source_url: null,
    is_public: true,
    sort_order: 0,
    summary_status: null,
    reviewed_at: null,
    reviewed_by_human: false,
    ...over,
  };
}
const IC1 = pub("sec-7-B-I-C-1", "I.C.1.", { sort_order: 1, full_text: "<p>General Requirements</p>" });
const IC1A = pub("sec-7-B-I-C-1-a", "I.C.1.a.", {
  sort_order: 2,
  parent_id: "sec-7-B-I-C-1",
  full_text: "<p>I.C.1.a. All air pollution control equipment used to demonstrate compliance.</p>",
  ai_summary: "Control equipment must be run to its specifications.",
  summary_status: "approved",
  reviewed_at: "2026-10-05T04:45:29.910Z",
});
const IC1B = pub("sec-7-B-I-C-1-b", "I.C.1.b.", {
  sort_order: 3,
  parent_id: "sec-7-B-I-C-1",
  ai_summary: "Pending summary text.",
  summary_status: "pending",
});

test("a visitor asking for a public row of a closed regulation gets its text, summary control, source link and public sub-rows", async () => {
  const { d, calls } = deps({ signedIn: false, hasAccess: false, subtree: [IC1, IC1A, IC1B] });
  const res = await loadProvisionPreview("sec-7-B-I-C-1", d);
  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown> & { html: string; panel: string; below: string };
  assert.equal("locked" in body, false);
  assert.deepEqual(Object.keys(body).sort(), ["below", "citation", "html", "id", "panel", "public", "reg_key", "summary", "title"]);
  assert.equal(body.public, true);
  assert.equal(body.reg_key, "7");
  assert.equal(body.citation, "I.C.1.");
  assert.match(body.html, /General Requirements/);
  assert.match(body.html, /<span class="item-id">I\.C\.1\.<\/span>/, "badged like a reader row");
  // I.C.1 has no summary: no control on the row itself.
  assert.equal(body.panel, "");
  // Its public children follow, each as an item with its text...
  assert.match(body.below, /<div class="item" data-citation="I\.C\.1\.a\.">/);
  assert.match(body.below, /All air pollution control equipment used to demonstrate compliance\./);
  // ...and I.C.1.a's approved summary as the reader's control: badge (with its tooltip) and the official-source link.
  assert.match(body.below, /<details class="summary-panel"><summary>Plain-English summary<\/summary>/);
  assert.match(body.below, /Control equipment must be run to its specifications\./);
  assert.match(body.below, /class="summary-badge [^"]*" title="[^"]*Disclaimer page/);
  assert.match(body.below, new RegExp(`<div class="summary-status"><a [^>]*href="${PUBLIC_SOURCE.replace(/[.?]/g, "\\$&")}"[^>]*>View official source`));
  // I.C.1.b's summary is still pending: never offered.
  assert.doesNotMatch(JSON.stringify(body), /Pending summary text/);
  assert.deepEqual(calls.fetch, [], "the single-row read of the entitled path never ran");
  assert.deepEqual(calls.label, [], "no service-role label read for a row the database lets the visitor read");
  assert.deepEqual(calls.subtree, ["sec-7-B-I-C-1"]);
  assert.equal(previewCacheControl(res), "private, max-age=300");
});

test("a public leaf row has its own summary control on the row and nothing below", async () => {
  const { d } = deps({ signedIn: false, hasAccess: false, subtree: [IC1A] });
  const res = await loadProvisionPreview("sec-7-B-I-C-1-a", d);
  const body = res.body as { html: string; panel: string; below: string; summary: { overview: string; badge: { kind: string } | null } | null };
  assert.match(body.html, /All air pollution control equipment/);
  assert.match(body.panel, /^<details class="summary-panel">/);
  assert.match(body.panel, /Control equipment must be run to its specifications\./);
  assert.match(body.panel, /View official source/);
  assert.equal(body.below, "");
  assert.equal(body.summary?.overview, "Control equipment must be run to its specifications.");
  assert.equal(body.summary?.badge?.kind, "reviewed");
  // The row's own source_url wins over the root's.
  const own = deps({ signedIn: false, hasAccess: false, subtree: [{ ...IC1A, source_url: "https://example.test/own" }] });
  const res2 = await loadProvisionPreview("sec-7-B-I-C-1-a", own.d);
  assert.match((res2.body as { panel: string }).panel, /href="https:\/\/example\.test\/own"/);
});

test("signed in without access gets the same public answer", async () => {
  const { d } = deps({ signedIn: true, hasAccess: false, subtree: [IC1A] });
  const res = await loadProvisionPreview("sec-7-B-I-C-1-a", d);
  assert.equal((res.body as { public?: boolean }).public, true);
});

test("leak guard: a locked row is the label alone, the visitor's read returning nothing for it", async () => {
  const { d, calls } = deps({
    signedIn: false,
    hasAccess: false,
    subtree: [],
    label: { id: "sec-7-B-I-B-33", citation: "I.B.33.", title: "I.B.33. OPACITY", context_path: "PART B › I." },
  });
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.deepEqual(Object.keys(res.body).sort(), ["citation", "id", "locked", "path", "reg_key", "title"]);
  assert.deepEqual(calls.subtree, ["sec-7-B-I-B-33"], "the database was asked, and said no");
  assert.deepEqual(calls.label, ["sec-7-B-I-B-33"]);
  assert.equal(previewCacheControl(res), "no-store");
  assert.doesNotMatch(JSON.stringify(res.body), /html|panel|below|summary|text of/);
});

test("leak guard: a locked parent of a public child is the label alone (the fence needs the focused row itself public)", async () => {
  // sec-7-B-I-C is locked; its descendants include the public I.C.1 subtree, which the database returns for the `like` read.
  const { d } = deps({
    signedIn: false,
    hasAccess: false,
    subtree: [IC1, IC1A, IC1B],
    label: { id: "sec-7-B-I-C", citation: "I.C.", title: "I.C. General Provisions", context_path: null },
  });
  const res = await loadProvisionPreview("sec-7-B-I-C", d);
  assert.equal((res.body as { locked?: boolean }).locked, true);
  assert.doesNotMatch(JSON.stringify(res.body), /General Requirements|All air pollution control|Control equipment/);
  assert.equal(previewCacheControl(res), "no-store");
});

test("leak guard: rows the database should not have returned (not public, or outside the subtree) are dropped", async () => {
  // The focused row is public; a sibling and a lookalike come back too, and one child has a null flag.
  const sibling = pub("sec-7-B-I-C-2", "I.C.2.", { full_text: "<p>SIBLING SECRET</p>" });
  const lookalike = pub("sec-7-B-I-C-10", "I.C.10.", { full_text: "<p>LOOKALIKE SECRET</p>" });
  const flagged = pub("sec-7-B-I-C-1-z", "I.C.1.z.", { full_text: "<p>NOT PUBLIC SECRET</p>", is_public: false });
  const nullFlag = { ...pub("sec-7-B-I-C-1-y", "I.C.1.y.", { full_text: "<p>NULL FLAG SECRET</p>" }), is_public: null } as unknown as SubtreeRow;
  const { d } = deps({ signedIn: false, hasAccess: false, subtree: [IC1, IC1A, sibling, lookalike, flagged, nullFlag] });
  const res = await loadProvisionPreview("sec-7-B-I-C-1", d);
  const text = JSON.stringify(res.body);
  assert.doesNotMatch(text, /SECRET/);
  assert.match(text, /All air pollution control equipment/);
});

test("leak guard: a read that fails, or a focused row that is not public, falls back to the label, never an error or text", async () => {
  const label = { id: "sec-7-B-I-C-1-a", citation: "I.C.1.a.", title: "I.C.1.a.", context_path: null };
  const failed = deps({ signedIn: false, hasAccess: false, subtree: new Error("boom"), label });
  const r1 = await loadProvisionPreview("sec-7-B-I-C-1-a", failed.d);
  assert.equal((r1.body as { locked?: boolean }).locked, true);
  const notPublic = deps({ signedIn: false, hasAccess: false, subtree: [{ ...IC1A, is_public: false }], label });
  const r2 = await loadProvisionPreview("sec-7-B-I-C-1-a", notPublic.d);
  assert.equal((r2.body as { locked?: boolean }).locked, true);
  assert.doesNotMatch(JSON.stringify(r2.body), /All air pollution control/);
});

test("summaries stay withheld while the regulation's review run is unfinished or the panel context cannot be read; the text does not", async () => {
  for (const ctx of [{ rootSourceUrl: PUBLIC_SOURCE, pendingSummaries: 3 }, new Error("boom")]) {
    const { d } = deps({ signedIn: false, hasAccess: false, subtree: [IC1A], ctx });
    const res = await loadProvisionPreview("sec-7-B-I-C-1-a", d);
    const body = res.body as { html: string; panel: string; summary: unknown };
    assert.match(body.html, /All air pollution control equipment/);
    assert.equal(body.panel, "");
    assert.equal(body.summary, null);
    assert.doesNotMatch(JSON.stringify(body), /Control equipment must be run/);
  }
  // A staged regulation has no public popup: 404.
  const staged = deps({ signedIn: false, hasAccess: false, subtree: [IC1A], ctx: null });
  assert.equal((await loadProvisionPreview("sec-7-B-I-C-1-a", staged.d)).status, 404);
});

test("a rejected or unreviewed summary is not offered on a public row", async () => {
  for (const summary_status of ["rejected", "pending", null]) {
    const { d } = deps({ signedIn: false, hasAccess: false, subtree: [{ ...IC1A, summary_status }] });
    const res = await loadProvisionPreview("sec-7-B-I-C-1-a", d);
    const body = res.body as { panel: string; summary: unknown };
    assert.equal(body.panel, "", String(summary_status));
    assert.equal(body.summary, null, String(summary_status));
  }
});

test("an entitled viewer, and a GP05 row for a visitor, never take the public-row path", async () => {
  const sub = deps();
  await loadProvisionPreview("sec-7-B-I-B-33", sub.d);
  assert.deepEqual(sub.calls.subtree, []);
  assert.deepEqual(sub.calls.ctx, []);
  const gp05: PreviewRow = { id: "sec-gp05-II-D", citation: "II.D.", title: "II.D.", full_text: "<p>Limit.</p>" };
  const visitor = deps({ signedIn: false, hasAccess: false, row: gp05 });
  const res = await loadProvisionPreview("sec-gp05-II-D", visitor.d);
  assert.deepEqual(Object.keys(res.body).sort(), ["citation", "html", "id", "reg_key", "summary", "title"]);
  assert.deepEqual(visitor.calls.subtree, []);
});
