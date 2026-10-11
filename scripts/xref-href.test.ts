/**
 * A visitor's cross-regulation links are the preview form from the start
 * (Sprint 8, 11 Oct 2026; src/lib/xref-href.ts, src/lib/reader-visitor.ts),
 * a subscriber's stay reader links, and the reader reads both forms:
 *
 *   - the href rule (visitorXrefHref) and the reader that finds the target of
 *     either form (previewTargetOf, hashTargetOf, documentRootOf, the tour's
 *     linkTargetOf / isTourCitationLink);
 *   - the HTML rewrite of a row's text (rewriteVisitorXrefs);
 *   - through loadReaderPage: the visitor's rendered body has the preview
 *     hrefs, the subscriber's cached body is the object it always was;
 *   - under jsdom with the real component's click handler: a click on the
 *     rewritten link still opens the popup and carries from=.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { documentRootOf, hashTargetOf, citedParamOf } from "../src/lib/reader-nav";
import { loadReaderPage, type ReaderPageDeps } from "../src/lib/reader-page";
import { rewriteVisitorXrefs, visitorReaderRows } from "../src/lib/reader-visitor";
import type { RenderedReader } from "../src/lib/reader-render";
import { sanitizeHtml } from "../src/lib/regulation-pure";
import { isTourCitationLink, linkTargetOf } from "../src/lib/tour";
import type { Provision } from "../src/lib/types";
import { previewTargetOf, visitorXrefHref } from "../src/lib/xref-href";

test("a reader-form link into a locked regulation becomes the preview form", () => {
  assert.equal(visitorXrefHref("/regulations/7#sec-7-B-I-C-1"), "/regulations/7/preview?p=sec-7-B-I-C-1");
  assert.equal(visitorXrefHref("/regulations/7#sec-7-P-B"), "/regulations/7/preview?p=sec-7-P-B");
  assert.equal(visitorXrefHref("/regulations/gp12#sec-gp12-VI-A-1"), "/regulations/gp12/preview?p=sec-gp12-VI-A-1");
  // An escaped paren in the hash is the same id.
  assert.equal(visitorXrefHref("/regulations/7#sec-7-B-I-D-3-a-%28i%29"), "/regulations/7/preview?p=sec-7-B-I-D-3-a-(i)");
});

test("a document-only link becomes the plain preview", () => {
  assert.equal(visitorXrefHref("/regulations/8"), "/regulations/8/preview");
  assert.equal(visitorXrefHref("/regulations/oooob"), "/regulations/oooob/preview");
  // A root-row hash, or one that is not a provision id, names the document.
  assert.equal(visitorXrefHref("/regulations/8#sec-8-top-REG-8"), "/regulations/8/preview");
  assert.equal(visitorXrefHref("/regulations/8#"), "/regulations/8/preview");
  assert.equal(visitorXrefHref("/regulations/8#nonsense"), "/regulations/8/preview");
  assert.equal(visitorXrefHref("/regulations/8#%E0%A4%A"), "/regulations/8/preview");
});

test("the importer's ?cited= is kept on the rewritten URL", () => {
  assert.equal(
    visitorXrefHref("/regulations/7?cited=I.B.33#sec-7-B-I-B-34"),
    "/regulations/7/preview?p=sec-7-B-I-B-34&cited=I.B.33"
  );
  assert.equal(
    visitorXrefHref("/regulations/7?cited=II.A.46#sec-7-B-II-A-48"),
    "/regulations/7/preview?p=sec-7-B-II-A-48&cited=II.A.46"
  );
  assert.equal(visitorXrefHref("/regulations/7?cited=I.D.3.b.%28x%29#sec-7-B-I-D-3-b-(x)"), "/regulations/7/preview?p=sec-7-B-I-D-3-b-(x)&cited=I.D.3.b.%28x%29");
  assert.equal(visitorXrefHref("/regulations/8?cited=x"), "/regulations/8/preview?cited=x");
  // A p= already in the query is not doubled.
  assert.equal(visitorXrefHref("/regulations/7?p=sec-3-A&cited=I.B.33#sec-7-B-I-B-34"), "/regulations/7/preview?p=sec-7-B-I-B-34&cited=I.B.33");
});

test("a regulation whose reader is public keeps the reader href", () => {
  for (const href of ["/regulations/gp05#sec-gp05-VI-C", "/regulations/gp05", "/regulations/gp05?cited=I.B.33#sec-gp05-II-B-1", "/regulations/GP05#sec-gp05-VI-C"]) {
    assert.equal(visitorXrefHref(href), href);
  }
  // The list is a parameter, as in provisionDestination: with Regulation 7 public, 7 stays a reader link.
  assert.equal(visitorXrefHref("/regulations/7#sec-7-B-I-C-1", ["7"]), "/regulations/7#sec-7-B-I-C-1");
  assert.equal(visitorXrefHref("/regulations/gp05#sec-gp05-VI-C", ["7"]), "/regulations/gp05/preview?p=sec-gp05-VI-C");
});

test("anything that is not a reader-form link is left alone", () => {
  for (const href of [
    "/regulations/7/preview?p=sec-7-B-I-C-1", // already the preview form
    "/regulations/7/preview",
    "/test-methods/method-21",
    "/regs/sec-7-B-I-D-3-a-(i)",
    "https://www.ecfr.gov/current/title-40/part-60",
    "mailto:a@b.c",
    "#sec-gp05-VI-C",
    "/regulations/",
    "/regulations/a.b#sec-a.b-x",
    "/regulations/7/extra#sec-7-B-I-C-1",
  ]) {
    assert.equal(visitorXrefHref(href), href);
  }
});

test("the target of either form is found, and only a valid one", () => {
  assert.equal(previewTargetOf("/regulations/7/preview?p=sec-7-B-I-C-1"), "sec-7-B-I-C-1");
  assert.equal(previewTargetOf("/regulations/7/preview?p=sec-7-B-I-B-34&cited=I.B.33"), "sec-7-B-I-B-34");
  assert.equal(previewTargetOf("/regulations/7/preview?cited=I.B.33&p=sec-7-B-I-B-34"), "sec-7-B-I-B-34");
  assert.equal(previewTargetOf("/regulations/7/preview?p=sec-7-B-I-D-3-a-%28i%29"), "sec-7-B-I-D-3-a-(i)");
  for (const bad of [
    "/regulations/7/preview",
    "/regulations/7/preview?p=",
    "/regulations/7/preview?p=sec-3-A-II-B-5", // another regulation's id: the page ignores it too
    "/regulations/7/preview?p=%3Cb%3E",
    "/regulations/7/preview?p=" + "x".repeat(300),
    "/regulations/7?p=sec-7-B-I-C-1",
    "/regulations/7/preview/x?p=sec-7-B-I-C-1",
    "/regs/7/preview?p=sec-7-B-I-C-1",
    "",
    null,
    undefined,
  ]) {
    assert.equal(previewTargetOf(bad), null, String(bad));
  }
  // The reader's own parsers: both forms name the same provision, the same document, the same ?cited=.
  for (const [reader, preview, id] of [
    ["/regulations/7#sec-7-B-I-C-1", "/regulations/7/preview?p=sec-7-B-I-C-1", "sec-7-B-I-C-1"],
    ["/regulations/7?cited=I.B.33#sec-7-B-I-B-34", "/regulations/7/preview?p=sec-7-B-I-B-34&cited=I.B.33", "sec-7-B-I-B-34"],
    ["/regulations/7#sec-7-P-B", "/regulations/7/preview?p=sec-7-P-B", "sec-7-P-B"],
  ] as const) {
    assert.equal(hashTargetOf(reader), id);
    assert.equal(hashTargetOf(preview), id);
    assert.equal(linkTargetOf(reader), id);
    assert.equal(linkTargetOf(preview), id);
    assert.equal(citedParamOf(preview), citedParamOf(reader));
    assert.equal(documentRootOf(preview), null, "a provision link is not a document link");
  }
  assert.equal(hashTargetOf("/regulations/8/preview"), null);
  assert.equal(documentRootOf("/regulations/8"), "sec-8-top-REG-8");
  assert.equal(documentRootOf("/regulations/8/preview"), "sec-8-top-REG-8");
  assert.equal(documentRootOf("/regulations/8/preview?cited=x"), "sec-8-top-REG-8");
});

test("the tour finds its citation in the preview form too (step 5 of the walkthrough)", () => {
  assert.equal(isTourCitationLink("/regulations/7/preview?p=sec-7-B-I-C-1", "Section I.C.1."), true);
  assert.equal(isTourCitationLink("/regulations/7/preview?p=sec-7-B-I-C-1", "I.C.1."), true);
  assert.equal(isTourCitationLink("/regulations/7/preview?p=sec-7-B-II-B-2", "II.B.2."), false);
  assert.equal(isTourCitationLink("/regulations/7/preview?p=sec-7-B-II-C-1", "Section II.C.1."), false);
  assert.equal(isTourCitationLink("/regulations/7/preview?p=sec-7-B-I-D-3", "Sections I.D.3."), false);
  assert.equal(isTourCitationLink("/regulations/7/preview", "Regulation Number 7"), false);
  assert.equal(isTourCitationLink("/regulations/3/preview?p=sec-3-A-I-C-1", "Section I.C.1."), false);
});

// ---------------------------------------------------------------------------
// The HTML of a row
// ---------------------------------------------------------------------------

// Rows reach the rewrite already sanitised (fetchRegulationProvisions), so the test's do too.
const ROW = sanitizeHtml(
  '<p>Comply with <a class="xref-external-reg" href="/regulations/7#sec-7-B-I-C-1">Section I.C.1.</a> of ' +
  '<a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, ' +
  '<a class="xref-external-reg" href="/regulations/7?cited=I.B.33#sec-7-B-I-B-34">Section I.B.33</a>, ' +
  '<a class="xref-external-reg" href="/regulations/gp05#sec-gp05-VI-C">GP05 VI.C</a>, ' +
  'and <span class="xref" data-target="sec-gp05-VI-D">Section VI.D.</span> ' +
  '(<a class="xref-method" href="/test-methods/method-21">Method 21</a>, <a href="/regulations/7#sec-7-B-I-C-1">a plain link</a>, ' +
  '<a href="https://example.com/x?y=1#z" target="_blank">elsewhere</a>).</p>'
);

test("a row's text: cross-regulation links re-pointed, everything else as it was", () => {
  const out = rewriteVisitorXrefs(ROW);
  assert.ok(out.includes('href="/regulations/7/preview?p=sec-7-B-I-C-1"'), out);
  assert.ok(/href="\/regulations\/7\/preview"[^>]*>Regulation Number 7</.test(out), out);
  assert.ok(out.includes('href="/regulations/7/preview?p=sec-7-B-I-B-34&amp;cited=I.B.33"'), out);
  // GP05 is the visitor's own reader.
  assert.ok(out.includes('href="/regulations/gp05#sec-gp05-VI-C"'), out);
  // Same-regulation references, the test method, a link that is not an xref-external-reg and an outside link: untouched.
  assert.ok(out.includes('<span class="xref" data-target="sec-gp05-VI-D">Section VI.D.</span>'), out);
  assert.ok(out.includes('href="/test-methods/method-21"'), out);
  assert.ok(out.includes('<a href="/regulations/7#sec-7-B-I-C-1"'), "only a.xref-external-reg is rewritten");
  assert.ok(out.includes('href="https://example.com/x?y=1#z"'), out);
  // The text a reader sees is identical.
  const text = (html: string) => html.replace(/<[^>]+>/g, "");
  assert.equal(text(out), text(ROW));
  // And no reader link into a locked regulation is left on an xref-external-reg.
  assert.ok(!/class="xref-external-reg"[^>]*href="\/regulations\/7[#"?]/.test(out), out);
  // Idempotent: a second pass finds nothing to change.
  assert.equal(rewriteVisitorXrefs(out), out);
});

test("a row with no cross-regulation link is returned as it is", () => {
  const html = '<p>See <span class="xref" data-target="sec-gp05-VI-D">Section VI.D.</span>.</p>';
  assert.equal(rewriteVisitorXrefs(html), html);
  const row = { id: "sec-gp05-VI", full_text: html } as Provision;
  assert.equal(visitorReaderRows([row])[0], row, "same object: nothing to rewrite");
});

// ---------------------------------------------------------------------------
// Through the reader page: visitor rewritten, subscriber untouched
// ---------------------------------------------------------------------------

function row(id: string, parent: string | null, text: string, sort: number): Provision {
  return {
    id,
    citation: id.replace(/^sec-gp05-/, ""),
    title: id,
    jurisdiction_level: "state",
    issuing_body: "TEST",
    parent_id: parent,
    full_text: text,
    ai_summary: null,
    source_url: null,
    last_verified_date: null,
    is_public: true,
    sort_order: sort,
  };
}

const gp05Rows = [
  row("sec-gp05-top-REG-gp05", null, "<p>GP05 root</p>", 0),
  row("sec-gp05-VI-C", "sec-gp05-top-REG-gp05", ROW, 1),
];

const cachedBody: RenderedReader = {
  title: "GP05",
  blurb: "",
  dateLine: null,
  navHtml: "<nav-from-cache>",
  docHtml: `<div id="sec-gp05-VI-C">${ROW}</div>`,
};

function deps(entitled: boolean, extra: Partial<ReaderPageDeps> = {}) {
  const calls: string[] = [];
  const d: ReaderPageDeps = {
    isVisible: async () => true,
    hasAccess: async () => entitled,
    fetchLive: async (reg) => {
      calls.push(`fetchLive:${reg}`);
      return gp05Rows;
    },
    fetchVersion: async (reg) => {
      calls.push(`fetchVersion:${reg}`);
      return "2:now";
    },
    fetchCached: async (reg) => {
      calls.push(`fetchCached:${reg}`);
      return cachedBody;
    },
    ...extra,
  };
  return { d, calls };
}

test("a visitor's GP05 body carries preview hrefs for Regulation 7 and keeps GP05's reader href", async () => {
  const { d, calls } = deps(false);
  const reader = await loadReaderPage("gp05", d);
  assert.ok(reader);
  assert.deepEqual(calls, ["fetchLive:gp05"], "the live, RLS-bound path, never the cache");
  const hrefs = [...reader.docHtml.matchAll(/<a class="xref-external-reg" href="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, [
    "/regulations/7/preview?p=sec-7-B-I-C-1",
    "/regulations/7/preview",
    "/regulations/7/preview?p=sec-7-B-I-B-34&amp;cited=I.B.33",
    "/regulations/gp05#sec-gp05-VI-C",
  ]);
});

test("a subscriber's body is the cached one, byte for byte: reader hrefs, no rewrite", async () => {
  const { d, calls } = deps(true);
  const reader = await loadReaderPage("gp05", d);
  assert.equal(reader, cachedBody, "the very object the cache returned");
  assert.deepEqual(calls, ["fetchVersion:gp05", "fetchCached:gp05"]);
  assert.ok(reader.docHtml.includes('href="/regulations/7#sec-7-B-I-C-1"'));
  assert.ok(!reader.docHtml.includes("/preview"));
});
