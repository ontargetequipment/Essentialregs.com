/**
 * Every code of a subpart list is a link (14 Oct 2026): GP05 IX.B's "Subpart
 * OOOO, OOOOa, or OOOOb" used to link only the first code. The importer and the
 * one-time UPDATE (supabase/migrations/RUN_ME_20261014_subpart_list_links.sql)
 * write each listed code as its own a.xref-external-reg to the corpus document.
 * The reader must keep those anchors through the sanitizer, give a visitor the
 * preview form of each, and open the document the code names on a click
 * (documentRootOf; the click itself is in e2e/smoke-anonymous.spec.ts).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { documentRootOf } from "../src/lib/reader-nav";
import { rewriteVisitorXrefs } from "../src/lib/reader-visitor";
import { sanitizeHtml } from "../src/lib/regulation-pure";

const link = (key: string, text: string) => `<a class="xref-external-reg" href="/regulations/${key}">${text}</a>`;
// sec-gp05-IX-B as the database stores it once the list is linked.
const IX_B =
  "The owner or operator must maintain documentation clearly outlining applicable requirements of New Source Performance Standard (NSPS) " +
  `${link("oooo", "Subpart OOOO")}, ${link("ooooa", "OOOOa")}, or ${link("oooob", "OOOOb")} – Standards of Performance for Crude Oil and Natural Gas Facilities`;

test("the sanitizer keeps every anchor of a linked subpart list", () => {
  const clean = sanitizeHtml(IX_B);
  // The sanitizer adds rel="noopener noreferrer" to every anchor; nothing else changes.
  assert.equal(clean.replaceAll(' rel="noopener noreferrer"', ""), IX_B);
  const hrefs = [...clean.matchAll(/<a class="xref-external-reg" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/regulations/oooo", "/regulations/ooooa", "/regulations/oooob"]);
});

test("a visitor's list links are the preview form, one document each, text unchanged", () => {
  const html = rewriteVisitorXrefs(sanitizeHtml(IX_B));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/regulations/oooo/preview", "/regulations/ooooa/preview", "/regulations/oooob/preview"]);
  assert.equal(html.replace(/<[^>]+>/g, ""), IX_B.replace(/<[^>]+>/g, ""));
});

test("the reader opens the document a listed code names, from either href form", () => {
  assert.equal(documentRootOf("/regulations/oooob"), "sec-oooob-top-REG-oooob");
  assert.equal(documentRootOf("/regulations/oooob/preview"), "sec-oooob-top-REG-oooob");
  assert.equal(documentRootOf("/regulations/ooooa/preview"), "sec-ooooa-top-REG-ooooa");
});
