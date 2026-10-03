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
import { loadProvisionPreview, validPreviewId, type PreviewDeps, type PreviewRow } from "../src/lib/provision-preview";

const ROW: PreviewRow = {
  id: "sec-7-B-I-B-33",
  citation: "I.B.33.",
  full_text:
    '<p>Opacity shall not exceed <span class="xref" data-target="sec-7-B-I-B-34">Section I.B.34</span>.</p>' +
    '<script>alert(1)</script><img src="x" onerror="alert(2)">',
};

function deps(over: { signedIn?: boolean; hasAccess?: boolean; row?: PreviewRow | null } = {}) {
  const calls = { access: 0, fetch: [] as string[] };
  const d: PreviewDeps = {
    access: async () => {
      calls.access++;
      return { signedIn: over.signedIn ?? true, hasAccess: over.hasAccess ?? true };
    },
    fetchRow: async (id) => {
      calls.fetch.push(id);
      return over.row === undefined ? ROW : over.row;
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
});

test("signed out is a 401 and nothing is read", async () => {
  const { d, calls } = deps({ signedIn: false, hasAccess: false });
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.equal(res.status, 401);
  assert.deepEqual(calls.fetch, []);
});

test("signed in without access is a 403 and nothing is read", async () => {
  const { d, calls } = deps({ signedIn: true, hasAccess: false });
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.equal(res.status, 403);
  assert.deepEqual(calls.fetch, []);
});

test("an entitled visitor asking for a row RLS hides or that does not exist gets a 404", async () => {
  const { d, calls } = deps({ row: null });
  const res = await loadProvisionPreview("sec-7-B-I-B-99", d);
  assert.equal(res.status, 404);
  assert.deepEqual(calls.fetch, ["sec-7-B-I-B-99"]);
});

test("an entitled visitor gets only id, reg_key, citation and sanitised, badged html", async () => {
  const { d, calls } = deps();
  const res = await loadProvisionPreview("sec-7-B-I-B-33", d);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.fetch, ["sec-7-B-I-B-33"]);
  const body = res.body as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["citation", "html", "id", "reg_key"]);
  assert.equal(body.id, "sec-7-B-I-B-33");
  assert.equal(body.reg_key, "7");
  assert.equal(body.citation, "I.B.33.");
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
