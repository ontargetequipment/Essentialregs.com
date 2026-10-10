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

function deps(over: { signedIn?: boolean; hasAccess?: boolean; row?: PreviewRow | null; label?: PreviewLabel | null } = {}) {
  const calls = { access: 0, fetch: [] as string[], label: [] as string[] };
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
