/**
 * Method citation links in the reader and on provision cards, and the
 * "Cited by" grouping on a Test Methods page. No database, no Next.
 *
 *   - sanitizeHtml / sanitizeCardHtml keep an importer-written
 *     `<a class="xref-method" href="/test-methods/<slug>">` (class and
 *     relative href) and never rewrite it the way an xref-external-reg
 *     link is routed to the preview;
 *   - a hostile anchor wearing the class does not get through;
 *   - the reader's click delegation (RegulationReader.tsx) handles `.xref`
 *     and `a.xref-external-reg`; an xref-method anchor matches neither, so
 *     a click on it is plain navigation (proved on the DOM selectors);
 *   - groupCitedBy: regulation order, sort_order within, the cap and the
 *     "+N more" count, titles without their own label, reader hrefs.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { sanitizeCardHtml, sanitizeHtml } from "../src/lib/regulation-pure";
import {
  CITED_BY_CAP,
  compareRegulationKeys,
  groupCitedBy,
  type CitingProvision,
} from "../src/lib/test-method-citations-pure";

const LINKED =
  '<p>conduct annual <a class="xref-method" href="/test-methods/method-21">EPA Method 21</a> (August 3, 2017) inspections, ' +
  'see <span class="xref" data-target="sec-7-B-I-L-8">Section I.L.8.</span> and ' +
  '<a class="xref-external-reg" href="/regulations/oooob">Subpart OOOOb</a>.</p>';

test("sanitizeHtml keeps a method link's class and relative href (plus the noopener rel every link gets)", () => {
  const out = sanitizeHtml(LINKED);
  assert.ok(
    out.includes('<a class="xref-method" href="/test-methods/method-21" rel="noopener noreferrer">EPA Method 21</a>'),
    out
  );
  // The other two kinds of link are untouched beside it.
  assert.ok(out.includes('<span class="xref" data-target="sec-7-B-I-L-8">Section I.L.8.</span>'), out);
});

test("sanitizeCardHtml keeps the method href as is, whoever is looking (only xref-external-reg is rerouted)", () => {
  for (const hasAccess of [false, true]) {
    const out = sanitizeCardHtml(LINKED, hasAccess);
    assert.match(out, /href="\/test-methods\/method-21"/, out);
    assert.match(out, hasAccess ? /href="\/regulations\/oooob"/ : /href="\/regulations\/oooob\/preview"/, out);
  }
});

test("a hostile anchor wearing the class is defused: scheme and handler stripped", () => {
  const out = sanitizeHtml('<a class="xref-method" href="javascript:alert(1)" onclick="x()">Method 21</a>');
  assert.ok(!out.includes("javascript:"), out);
  assert.ok(!out.includes("onclick"), out);
  assert.ok(out.includes('class="xref-method"'), out);
});

test("the reader's click delegation does not catch a method link: it is neither .xref nor a.xref-external-reg", () => {
  const { window } = new JSDOM(`<div id="doc"><div id="sec-7-B-I-J-1-d">${sanitizeHtml(LINKED)}</div></div>`);
  const method = window.document.querySelector("a.xref-method")!;
  assert.ok(method);
  assert.equal(method.closest(".xref"), null);
  assert.equal(method.closest("a.xref-external-reg"), null);
  assert.equal(method.getAttribute("href"), "/test-methods/method-21");
  // And the two the delegation does handle still match themselves.
  assert.ok(window.document.querySelector("span.xref")!.closest(".xref"));
  assert.ok(window.document.querySelector("a.xref-external-reg")!.closest("a.xref-external-reg"));
});

// ---- Cited by -----------------------------------------------------------------

function row(id: string, sort_order: number, citation = id.split("-").slice(2).join("."), title = citation): CitingProvision {
  return { id, reg_key: id.split("-")[1], citation, title, sort_order };
}

test("regulations list in the index order: Colorado (proc, cp, numbered, aqs, sip, permits, ECMC) then federal", () => {
  const keys = ["p192", "oooob", "7", "gp08", "ecmc", "cp", "zzzz", "3", "aqs", "jjjj", "gp02", "proc", "oooo", "p190", "22", "sip"];
  assert.deepEqual([...keys].sort(compareRegulationKeys), [
    "proc", "cp", "3", "7", "22", "aqs", "sip", "gp02", "gp08", "ecmc", "jjjj", "oooo", "oooob", "zzzz", "p190", "p192",
  ]);
});

test("groupCitedBy: grouped by regulation in that order, sort_order within, titles without their label, reader hrefs", () => {
  const groups = groupCitedBy([
    row("sec-oooob-60.5397b-(a)", 40, "§ 60.5397b(a)", "§ 60.5397b(a) Fugitive emissions"),
    row("sec-7-B-I-J-1-d", 300, "I.J.1.d.", "I.J.1.d."),
    row("sec-7-B-I-B-3", 20, "I.B.3.", "I.B.3. Approved Instrument Monitoring Method"),
    row("sec-gp12-III-F-3", 5, "III.F.3.", "III.F.3."),
    { id: "sec-sample-1", reg_key: "", citation: "Sample", title: "Sample", sort_order: 1 },
  ]);
  // Sprint 5 (10 Oct 2026): the page is the same HTML for everyone, so every href is
  // the visitor's (provisionDestination, hasAccess false): the focused preview, not
  // the reader, which 404s logged out. A subscriber is redirected on from the preview.
  assert.deepEqual(
    groups.map((g) => [g.regKey, g.name, g.more, g.rows.map((r) => [r.href, r.citation, r.title])]),
    [
      ["7", "Regulation 7", 0, [
        ["/regulations/7/preview?p=sec-7-B-I-B-3", "I.B.3.", "Approved Instrument Monitoring Method"],
        ["/regulations/7/preview?p=sec-7-B-I-J-1-d", "I.J.1.d.", ""],
      ]],
      ["gp12", "APCD General Permit GP12", 0, [["/regulations/gp12/preview?p=sec-gp12-III-F-3", "III.F.3.", ""]]],
      ["oooob", "40 CFR Part 60 Subpart OOOOb", 0, [["/regulations/oooob/preview?p=sec-oooob-60.5397b-(a)", "§ 60.5397b(a)", "Fugitive emissions"]]],
    ]
  );
});

test("groupCitedBy: a GP05 citation still opens the reader (its reader is public); no href is a bare reader URL for anyone else", () => {
  const groups = groupCitedBy([row("sec-gp05-VIII-C-1", 1, "VIII.C.1."), row("sec-gp06-III-E-1", 1, "III.E.1."), row("sec-7-B-I-B-3", 1)]);
  const hrefs = Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [r.id, r.href])));
  assert.equal(hrefs["sec-gp05-VIII-C-1"], "/regulations/gp05#sec-gp05-VIII-C-1");
  assert.equal(hrefs["sec-gp06-III-E-1"], "/regulations/gp06/preview?p=sec-gp06-III-E-1");
  for (const g of groups) {
    for (const r of [...g.rows, ...g.rest]) {
      if (g.regKey !== "gp05") assert.ok(!/^\/regulations\/[^/]+#/.test(r.href), r.href);
    }
  }
});

test("groupCitedBy caps each regulation at CITED_BY_CAP rows and counts the rest", () => {
  const rows = Array.from({ length: CITED_BY_CAP + 7 }, (_, i) => row(`sec-7-B-I-${i}`, i));
  const [g] = groupCitedBy(rows);
  assert.equal(g.rows.length, CITED_BY_CAP);
  assert.equal(g.more, 7);
  assert.equal(g.rows[0].id, "sec-7-B-I-0");
  // "Show all": the rest follows the capped rows in the same order.
  assert.equal(g.rest.length, 7);
  assert.equal(g.rest[0].id, `sec-7-B-I-${CITED_BY_CAP}`);
  const [small] = groupCitedBy(rows.slice(0, 3), 3);
  assert.equal(small.more, 0);
  assert.deepEqual(small.rest, []);
  assert.deepEqual(groupCitedBy([]), []);
});
