/**
 * The visitor preview of a public subtree (Sprint 7, 11 Oct 2026;
 * src/lib/preview-subtree.ts): the leak guard around it and the markup it
 * renders.
 *
 * The Regulation 7 I.C.1 subtree (13 rows) is public; every other Regulation
 * 7 row is locked except the older sample row I.D.3.a.(i). These tests pin
 * that nothing outside the subtree can reach the page by the fence, the link
 * rewrite, the data read or the return link, and that what is inside it
 * renders as the reader renders it (depth, id badge, summary panel and its
 * badge, tooltip and source link), compared with renderDocHtml and the
 * browser-side fills in reader-client.ts under jsdom.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { fillApplicabilityContexts, fillSummaryBadges, fillSummaryLinks, readReaderModel } from "../src/lib/reader-client";
import {
  inSubtree,
  previewHref,
  previewReturnLink,
  publicSubtree,
  readerDepthBase,
  readerRedirectHref,
  renderSubtreeHtml,
  rewriteSubtreeLinks,
  subtreeLikePattern,
  type SubtreeRow,
} from "../src/lib/preview-subtree";
import { renderDocHtml } from "../src/lib/reader-render";
import { PUBLIC_READER_REGS } from "../src/lib/destination";
import { SUMMARY_BADGE_TITLES, sanitizeHtml } from "../src/lib/regulation-pure";
import type { Provision } from "../src/lib/types";

const root = path.join(__dirname, "..");
const corpus = JSON.parse(readFileSync(path.join(root, "pipeline", "out", "corpus_ids.json"), "utf8")) as Record<string, string[]>;

/** The public subtree, in document (sort_order) order. */
const SUBTREE = [
  "sec-7-B-I-C-1",
  "sec-7-B-I-C-1-a",
  "sec-7-B-I-C-1-b",
  "sec-7-B-I-C-1-c",
  "sec-7-B-I-C-1-d",
  "sec-7-B-I-C-1-e",
  "sec-7-B-I-C-1-e-(i)",
  "sec-7-B-I-C-1-e-(ii)",
  "sec-7-B-I-C-1-e-(iii)",
  "sec-7-B-I-C-1-e-(iv)",
  "sec-7-B-I-C-1-f",
  "sec-7-B-I-C-1-f-(i)",
  "sec-7-B-I-C-1-f-(ii)",
];
const SAMPLE_ROW = "sec-7-B-I-D-3-a-(i)";
const PUBLIC_REG7 = new Set([...SUBTREE, SAMPLE_ROW]);
const SOURCE = "https://www.sos.state.co.us/CCR/DisplayRule.do?action=ruleinfo&ruleId=2341&deptID=16&agencyID=7";

// ---------------------------------------------------------------------------
// A Regulation 7 in miniature: the real ids and parents of Part B, I.C and
// the neighbours the guard has to keep out, with the wording of the source.
// ---------------------------------------------------------------------------

let order = 0;
function mk(id: string, parent: string | null, citation: string, text: string, over: Partial<Provision> = {}): Provision {
  return {
    id,
    citation,
    title: citation,
    jurisdiction_level: "state",
    issuing_body: "AQCC",
    parent_id: parent,
    full_text: text,
    ai_summary: null,
    source_url: null,
    last_verified_date: null,
    is_public: false,
    sort_order: (order += 10),
    summary_status: "pending",
    reviewed_at: null,
    reviewed_by_human: false,
    ...over,
  };
}

const approved = (summary: string, at = "2026-10-05T04:46:13Z"): Partial<Provision> => ({
  ai_summary: summary,
  summary_status: "approved",
  reviewed_at: at,
});

const LONG_SUMMARY =
  "Any combustion device you use to control VOC emissions to comply with Sections I.D., I.J., and I.K. must have an auto-igniter installed and working. " +
  "The deadline depends on the equipment and when it was built. Condensate tanks built between May 1, 2009 and January 1, 2017 must have one from first production. " +
  "Existing tanks controlled by a combustion device had dates in 2009 and 2010. Devices installed from January 1, 2017 need one at installation, and the sub-items below set the rest.";

function reg7(): Provision[] {
  order = 0;
  const P = (over: Partial<Provision>) => ({ is_public: true, ...over });
  return [
    mk("sec-7-top-REG-7", null, "Regulation 7", "CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9", { source_url: SOURCE }),
    mk("sec-7-P-B", "sec-7-top-REG-7", "PART B", "PART B — Oil and Natural Gas Operations"),
    mk("sec-7-B-I", "sec-7-P-B", "I.", "I. Volatile Organic Compound Emissions from Oil and Gas Operations"),
    mk("sec-7-B-I-B-33", "sec-7-B-I", "I.B.33.", "<p>“System-Wide Control Strategy” means the collective emissions and emission reductions from all atmospheric condensate storage tanks under common ownership.</p>"),
    mk("sec-7-B-I-C", "sec-7-B-I", "I.C.", "I.C. General Provisions"),
    mk("sec-7-B-I-C-1", "sec-7-B-I-C", "I.C.1.", "I.C.1. General Requirements", P({})),
    mk(
      "sec-7-B-I-C-1-a",
      "sec-7-B-I-C-1",
      "I.C.1.a.",
      '<p>All air pollution control equipment used to demonstrate compliance with this <span class="xref" data-target="sec-7-B-I">Section I.</span> must be operated and maintained consistent with manufacturer specifications and good engineering and maintenance practices. Fluctuations in emissions that occur when the separator dumps into the tank are reasonably foreseeable.</p>',
      P(approved("This provision applies to owners or operators of oil and gas operations using air pollution control equipment to comply with Section I."))
    ),
    mk(
      "sec-7-B-I-C-1-b",
      "sec-7-B-I-C-1",
      "I.C.1.b.",
      "<p>All hydrocarbon liquids and produced water collection, storage, processing, and handling operations, regardless of size, must be designed, operated, and maintained so as to minimize emission of volatile organic compounds.</p>",
      P(approved("This provision applies to all hydrocarbon liquids and produced water operations.", "2026-10-05T05:53:52Z"))
    ),
    mk(
      "sec-7-B-I-C-1-c",
      "sec-7-B-I-C-1",
      "I.C.1.c.",
      '<p>All air pollution control equipment used to demonstrate compliance with <span class="xref" data-target="sec-7-B-I-D">Sections I.D.</span>, <span class="xref" data-target="sec-7-B-I-J">I.J.</span>, and <span class="xref" data-target="sec-7-B-I-K">I.K.</span> must meet a control efficiency of at least 95%.</p>',
      P(approved("Control equipment must reach 95% control efficiency."))
    ),
    mk("sec-7-B-I-C-1-d", "sec-7-B-I-C-1", "I.C.1.d.", "<p>If a flare or other combustion device is used to control emissions it must be enclosed, have no visible emissions.</p>", P(approved("Flares must be enclosed."))),
    mk(
      "sec-7-B-I-C-1-e",
      "sec-7-B-I-C-1",
      "I.C.1.e.",
      '<p>All combustion devices used to control emissions of volatile organic compounds to comply with <span class="xref" data-target="sec-7-B-I-D">Sections I.D.</span> must be equipped with and operate an auto-igniter as follows:</p>',
      P(approved(LONG_SUMMARY, "2026-10-04T23:48:55Z"))
    ),
    mk("sec-7-B-I-C-1-e-(i)", "sec-7-B-I-C-1-e", "I.C.1.e.(i).", "<p>(State Only) For condensate storage tanks that are constructed or modified after May 1, 2009, auto-igniters must be installed.</p>", P(approved("State-only auto-igniter dates."))),
    mk(
      "sec-7-B-I-C-1-e-(ii)",
      "sec-7-B-I-C-1-e",
      "I.C.1.e.(ii).",
      '<p>(State Only) For all existing condensate storage tanks controlled by a combustion device to comply with <span class="xref" data-target="sec-7-B-I-D-1">Section I.D.1.</span>, auto- igniters must be installed.</p>',
      P(approved("Existing tank auto-igniter dates."))
    ),
    mk("sec-7-B-I-C-1-e-(iii)", "sec-7-B-I-C-1-e", "I.C.1.e.(iii).", "<p>All combustion devices installed on or after January 1, 2017, must be equipped with an operational auto-igniter.</p>", P({})),
    mk("sec-7-B-I-C-1-e-(iv)", "sec-7-B-I-C-1-e", "I.C.1.e.(iv).", "<p>All combustion devices installed on or after January 1, 2018, must be equipped with an operational auto-igniter.</p>", P(approved("2018 devices."))),
    mk("sec-7-B-I-C-1-f", "sec-7-B-I-C-1", "I.C.1.f.", "<p>(State Only)If a combustion device is used to control emissions, surveillance systems must be employed and operational as follows:</p>", P({})),
    mk("sec-7-B-I-C-1-f-(i)", "sec-7-B-I-C-1-f", "I.C.1.f.(i).", "<p>(State Only) Beginning May 1, 2010, for all existing condensate storage tanks.</p>", P(approved("Surveillance from 2010."))),
    mk("sec-7-B-I-C-1-f-(ii)", "sec-7-B-I-C-1-f", "I.C.1.f.(ii).", "<p>(State Only) For all new and modified condensate storage tanks the first 90 days.</p>", P(approved("New tanks, first 90 days."))),
    // Locked neighbours, one of them a lookalike by prefix.
    mk("sec-7-B-I-C-10", "sec-7-B-I-C", "I.C.10.", "<p>A tenth requirement about leak detection with a distinctive phrase: infrared camera surveys.</p>", approved("Tenth requirement summary.")),
    mk("sec-7-B-I-C-2", "sec-7-B-I-C", "I.C.2.", '<p>The emission estimates and emission reductions required by <span class="xref" data-target="sec-7-B-I-D">Section I.D.</span> must be demonstrated using one of the following emission factors:</p>', approved("Emission factor summary.")),
    mk("sec-7-B-I-C-2-a-(i)", "sec-7-B-I-C-2", "I.C.2.a.(i).", "<p>a default emission factor of 13.7 pounds of volatile organic compounds per barrel of condensate</p>", approved("Default factor.")),
    mk("sec-7-B-I-D", "sec-7-B-I", "I.D.", "I.D. Storage tanks"),
    mk("sec-7-B-I-D-3-a-(i)", "sec-7-B-I-D", "I.D.3.a.(i).", "<p>The older sample row, public before the subtree.</p>", { is_public: true, ...approved("Sample.") }),
    mk("sec-7-B-II-B-2", "sec-7-B-I", "II.B.2.", "<p>General requirements for air pollution control equipment used to comply with Section II.</p>", approved("Section II controls.")),
  ];
}

/** What a visitor's RLS-bound read returns: the rows is_public lets through. */
const visibleTo = (rows: Provision[], prefix: string) => rows.filter((r) => r.is_public && (r.id === prefix || r.id.startsWith(`${prefix}-`)));

const asRow = (p: Provision): SubtreeRow => p;

const dom = (html: string) => new JSDOM(`<!doctype html><div id="x">${html}</div>`).window.document;

// ---------------------------------------------------------------------------
// The fence
// ---------------------------------------------------------------------------

test("publicSubtree keeps the 13 public rows of I.C.1 in order, and nothing else the database or a mistake returned", () => {
  const all = reg7();
  const kept = publicSubtree(all, "sec-7-B-I-C-1").map((r) => r.id);
  assert.deepEqual(kept, SUBTREE);
});

test("publicSubtree refuses a non-public row, a sibling, a lookalike, the parent and the sample row, even flagged public", () => {
  const all = reg7().map((r) => ({ ...r, is_public: true })); // every row flagged public: only the id fence is left
  const kept = publicSubtree(all, "sec-7-B-I-C-1").map((r) => r.id);
  assert.deepEqual(kept, SUBTREE, "the id fence alone confines the answer to the focused subtree");
  for (const out of ["sec-7-B-I-C", "sec-7-B-I-C-2", "sec-7-B-I-C-10", "sec-7-B-I-C-2-a-(i)", "sec-7-B-I-B-33", "sec-7-B-II-B-2", SAMPLE_ROW]) {
    assert.ok(!kept.includes(out), out);
  }
  // ...and the flag alone confines it when the ids all fit: e-(iii) not public.
  const some = reg7().map((r) => (r.id === "sec-7-B-I-C-1-e-(iii)" ? { ...r, is_public: false } : r));
  assert.ok(!publicSubtree(some, "sec-7-B-I-C-1").some((r) => r.id === "sec-7-B-I-C-1-e-(iii)"));
  // A missing or null flag is a refusal, not a pass.
  const loose = [
    { id: "sec-7-B-I-C-1", sort_order: 1, is_public: true },
    { id: "sec-7-B-I-C-1-a", sort_order: 2 },
    { id: "sec-7-B-I-C-1-b", sort_order: 3, is_public: null },
  ];
  assert.deepEqual(
    publicSubtree(loose, "sec-7-B-I-C-1").map((r) => r.id),
    ["sec-7-B-I-C-1"]
  );
});

test("a locked focused row shows nothing, even when its children are public", () => {
  const all = reg7();
  // sec-7-B-I-C is locked; its child I.C.1 and the subtree below are public. The database
  // answers with those (they match `like 'sec-7-B-I-C-%'`), but not with I.C itself.
  const returned = visibleTo(all, "sec-7-B-I-C");
  assert.ok(returned.some((r) => r.id === "sec-7-B-I-C-1"), "the database does return the public children");
  assert.deepEqual(publicSubtree(returned, "sec-7-B-I-C"), []);
  const out = renderSubtreeHtml(returned.map(asRow), { reg: "7", focusedId: "sec-7-B-I-C", rootSourceUrl: SOURCE, pendingSummaries: 0 });
  assert.deepEqual(out, { ids: [], html: "" });
  // The same for the siblings and the other locked rows the task names.
  for (const id of ["sec-7-B-I-C-2", "sec-7-B-I-B-33", "sec-7-B-II-B-2", "sec-7-B-I-C-10", "sec-7-B-I"]) {
    assert.deepEqual(publicSubtree(visibleTo(all, id), id), [], id);
    assert.equal(renderSubtreeHtml(all.map(asRow), { reg: "7", focusedId: id, rootSourceUrl: SOURCE, pendingSummaries: 0 }).html, "", id);
  }
});

test("for every Regulation 7 id as the focus, only the public rows can be returned", () => {
  const ids = corpus["7"];
  assert.ok(ids.length > 2000 && SUBTREE.every((id) => ids.includes(id)) && ids.includes(SAMPLE_ROW), "corpus_ids.json holds Regulation 7");
  // The visitor's read: only the public rows exist for it.
  const db: SubtreeRow[] = ids.map((id, i) => ({ ...asRow(mk(id, null, id, "", { is_public: PUBLIC_REG7.has(id) })), sort_order: i }));
  const readable = db.filter((r) => r.is_public);
  for (const focus of ids) {
    // Whatever the database returned for `id like '<focus>-%'` or `id = focus`, the fence keeps only public rows of the subtree.
    const returned = readable.filter((r) => inSubtree(r.id, focus));
    const kept = publicSubtree(returned, focus);
    for (const r of kept) assert.ok(PUBLIC_REG7.has(r.id) && inSubtree(r.id, focus), `${focus} -> ${r.id}`);
    if (!PUBLIC_REG7.has(focus)) assert.deepEqual(kept, [], `${focus} is locked`);
  }
  assert.deepEqual(publicSubtree(readable, "sec-7-B-I-C-1").map((r) => r.id), SUBTREE);
  assert.deepEqual(publicSubtree(readable, SAMPLE_ROW).map((r) => r.id), [SAMPLE_ROW]);
});

test("publicSubtree puts the rows in sort_order and drops a repeated id", () => {
  const rows = [
    { id: "sec-7-B-I-C-1-b", sort_order: 30, is_public: true },
    { id: "sec-7-B-I-C-1", sort_order: 10, is_public: true },
    { id: "sec-7-B-I-C-1-a", sort_order: 20, is_public: true },
    { id: "sec-7-B-I-C-1-a", sort_order: 20, is_public: true },
  ];
  assert.deepEqual(
    publicSubtree(rows, "sec-7-B-I-C-1").map((r) => r.id),
    ["sec-7-B-I-C-1", "sec-7-B-I-C-1-a", "sec-7-B-I-C-1-b"]
  );
});

test("the LIKE pattern for a row's descendants keeps the hyphen and escapes wildcards", () => {
  assert.equal(subtreeLikePattern("sec-7-B-I-C-1"), "sec-7-B-I-C-1-%");
  assert.equal(subtreeLikePattern("sec-x-a_b%c"), "sec-x-a\\_b\\%c-%");
  // As Postgres reads it: the hyphen keeps I.C.10 out, the row itself is not "below" itself.
  const toRegex = (p: string) => new RegExp("^" + p.replace(/\\(.)/g, "\\$1").replace(/%/g, ".*") + "$");
  const re = toRegex(subtreeLikePattern("sec-7-B-I-C-1"));
  assert.ok(re.test("sec-7-B-I-C-1-a") && re.test("sec-7-B-I-C-1-e-(iv)"));
  assert.ok(!re.test("sec-7-B-I-C-10") && !re.test("sec-7-B-I-C-1") && !re.test("sec-7-B-I-C-2"));
});

test("the data read uses the visitor's own client and never the service role", () => {
  const data = readFileSync(path.join(root, "src", "lib", "preview-subtree-data.ts"), "utf8");
  assert.match(data, /from "@\/lib\/supabase\/server"/);
  assert.doesNotMatch(data, /createAdminClient|supabase\/admin|service_role|SERVICE_ROLE/);
  // Both reads are scoped to the regulation, and ask for is_public so the fence can check it.
  assert.match(data, /\.eq\("reg_key", reg\)/);
  assert.match(data, /SUBTREE_COLUMNS =\s*"[^"]*\bis_public\b/);
  const page = readFileSync(path.join(root, "src", "app", "regulations", "[reg]", "preview", "page.tsx"), "utf8");
  assert.match(page, /renderSubtreeHtml\(/, "the page renders through the fenced renderer");
  assert.doesNotMatch(page, /createAdminClient/);
});

// ---------------------------------------------------------------------------
// Links in the text
// ---------------------------------------------------------------------------

const LINKS = { ids: new Set(SUBTREE) };

test("previewHref: a row on the page is an anchor, GP05 stays the reader, everything else the focused preview or the document's preview", () => {
  // On this page.
  assert.equal(previewHref("/regulations/7#sec-7-B-I-C-1-a", LINKS), "#sec-7-B-I-C-1-a");
  assert.equal(previewHref("/regulations/7#sec-7-B-I-C-1-e-(i)", LINKS), "#sec-7-B-I-C-1-e-(i)");
  assert.equal(previewHref("/regulations/7#sec-7-B-I-C-1-e-%28i%29", LINKS), "#sec-7-B-I-C-1-e-(i)");
  // Locked rows of the same regulation and rows of other ones.
  assert.equal(previewHref("/regulations/7#sec-7-B-I-D", LINKS), "/regulations/7/preview?p=sec-7-B-I-D");
  assert.equal(previewHref("/regulations/7#sec-7-B-I-C", LINKS), "/regulations/7/preview?p=sec-7-B-I-C");
  assert.equal(previewHref("/regulations/7#sec-7-B-I-C-10", LINKS), "/regulations/7/preview?p=sec-7-B-I-C-10");
  assert.equal(previewHref("/regulations/3#sec-3-A-II-B", LINKS), "/regulations/3/preview?p=sec-3-A-II-B");
  assert.equal(previewHref("/regulations/gp12#sec-gp12-VI-A-1", LINKS), "/regulations/gp12/preview?p=sec-gp12-VI-A-1");
  // GP05's reader is open: the link stays.
  assert.equal(previewHref("/regulations/gp05#sec-gp05-VI-C", LINKS), "/regulations/gp05#sec-gp05-VI-C");
  // A document, with or without a renumbering query, and the root row.
  assert.equal(previewHref("/regulations/7", LINKS), "/regulations/7/preview");
  assert.equal(previewHref("/regulations/3", LINKS), "/regulations/3/preview");
  assert.equal(previewHref("/regulations/gp12?cited=I.B.33", LINKS), "/regulations/gp12/preview");
  assert.equal(previewHref("/regulations/gp05", LINKS), "/regulations/gp05");
  assert.equal(previewHref("/regulations/gp05?cited=I.A#nonsense!", LINKS), "/regulations/gp05?cited=I.A");
  assert.equal(previewHref("/regulations/7#sec-7-top-REG-7", LINKS), "/regulations/7/preview");
  assert.equal(previewHref("/regulations/7?cited=I.B.33#sec-7-B-I-B-34", LINKS), "/regulations/7/preview?p=sec-7-B-I-B-34");
  // Not ours to rewrite.
  for (const same of [
    "/regulations/7/preview?p=sec-7-B-I-D",
    "/regulations/7/preview",
    "/test-methods/method-21",
    "https://www.ecfr.gov/current/title-40",
    "#sec-7-B-I-C-1-b",
    "mailto:apcd@state.co.us",
    "/regulations",
    "/regulations/",
  ]) {
    assert.equal(previewHref(same, LINKS), same);
  }
});

test("no link into any Regulation 7 row is ever left pointing at the closed reader", () => {
  // Every id of every document, as a hash link written the way the importer writes it.
  let checked = 0;
  for (const [reg, ids] of Object.entries(corpus)) {
    for (const id of ids) {
      const out = previewHref(`/regulations/${reg}#${id}`, LINKS);
      checked++;
      // A root row is the document: GP05's reader as it is, the others' /preview.
      if (id.includes("-top-REG-")) assert.equal(out, PUBLIC_READER_REGS.includes(reg) ? `/regulations/${reg}` : `/regulations/${reg}/preview`, id);
      else if (PUBLIC_READER_REGS.includes(reg)) assert.equal(out, `/regulations/${reg}#${id}`, id);
      else if (LINKS.ids.has(id)) assert.equal(out, `#${id}`, id);
      else {
        assert.doesNotMatch(out, /^\/regulations\/[^/?#]+#/, `${id} -> ${out}`);
        assert.match(out, /^\/regulations\/[A-Za-z0-9]+\/preview(\?p=|$)/, `${id} -> ${out}`);
      }
    }
  }
  assert.ok(checked > 30000, `checked ${checked} ids`);
});

test("rewriteSubtreeLinks: links and cross-reference spans, in the reader's own markup", () => {
  const html = sanitizeHtml(
    '<p>See <span class="xref" data-target="sec-7-B-I-C-1-e">Section I.C.1.e.</span> and ' +
      '<span class="xref" data-target="sec-7-B-I-D">Section I.D.</span>; <a class="xref-external-reg" href="/regulations/7#sec-7-B-I-C-1-a">Reg 7 I.C.1.a</a>, ' +
      '<a class="xref-external-reg" href="/regulations/7#sec-7-B-II-B-2">Reg 7 II.B.2</a>, <a class="xref-external-reg" href="/regulations/gp05#sec-gp05-VI-C">GP05 VI.C</a>, ' +
      '<a class="xref-external-reg" href="/regulations/8">Regulation Number 8</a>, <a class="xref-method" href="/test-methods/method-21">Method 21</a> and ' +
      '<a href="https://www.ecfr.gov/x" target="_blank">eCFR</a>. <span class="er-sic" title="as printed">[sic]</span><span class="xref">no target</span></p>'
  );
  const out = rewriteSubtreeLinks(html, LINKS);
  const doc = dom(out);
  const a = (text: string) => [...doc.querySelectorAll("a")].find((e) => e.textContent === text)!;
  assert.equal(a("Section I.C.1.e.").getAttribute("href"), "#sec-7-B-I-C-1-e");
  assert.equal(a("Section I.C.1.e.").className, "xref");
  assert.equal(a("Section I.C.1.e.").hasAttribute("data-target"), false);
  assert.equal(a("Section I.D.").getAttribute("href"), "/regulations/7/preview?p=sec-7-B-I-D");
  assert.equal(a("Section I.D.").className, "xref");
  assert.equal(a("Reg 7 I.C.1.a").getAttribute("href"), "#sec-7-B-I-C-1-a");
  assert.equal(a("Reg 7 I.C.1.a").className, "xref", "a link to this page is not marked external");
  assert.equal(a("Reg 7 II.B.2").getAttribute("href"), "/regulations/7/preview?p=sec-7-B-II-B-2");
  assert.equal(a("Reg 7 II.B.2").className, "xref-external-reg");
  assert.equal(a("GP05 VI.C").getAttribute("href"), "/regulations/gp05#sec-gp05-VI-C");
  assert.equal(a("Regulation Number 8").getAttribute("href"), "/regulations/8/preview");
  assert.equal(a("Method 21").getAttribute("href"), "/test-methods/method-21");
  assert.equal(a("eCFR").getAttribute("href"), "https://www.ecfr.gov/x");
  assert.equal(a("eCFR").getAttribute("target"), "_blank");
  // Untouched: a [sic] note, an xref with no target.
  assert.equal(doc.querySelectorAll("span.er-sic").length, 1);
  assert.equal(doc.querySelectorAll("span.xref").length, 1);
  assert.doesNotMatch(out, /\/regulations\/7#/);
  assert.doesNotMatch(out, /data-target/);
});

test("rewriteSubtreeLinks: the sanitiser still has the last word", () => {
  const out = rewriteSubtreeLinks(
    '<p>x<a href="javascript:alert(1)">bad</a><img src="x" onerror="alert(2)"><script>alert(3)</script>' +
      '<span class="xref" data-target="sec-7-B-I-C-1-a&quot; onclick=&quot;alert(4)">evil</span></p>',
    LINKS
  );
  const doc = dom(out);
  assert.equal(doc.querySelectorAll("script").length, 0);
  for (const el of doc.querySelectorAll("#x *")) {
    for (const attr of Array.from(el.attributes)) assert.doesNotMatch(attr.name, /^on/i, `${el.tagName} ${attr.name}`);
    assert.doesNotMatch(el.getAttribute("href") ?? "", /^\s*javascript:/i);
  }
  // A target that is not a provision id is not turned into a link.
  assert.equal(doc.querySelectorAll("a[href]").length, 0);
  assert.equal(doc.querySelectorAll("span.xref").length, 1);
});

// ---------------------------------------------------------------------------
// The way back
// ---------------------------------------------------------------------------

test("previewReturnLink: back to a provision of ANOTHER regulation, with the tour carried", () => {
  assert.deepEqual(previewReturnLink({ from: "sec-gp05-VI-C" }, "7"), {
    href: "/regulations/gp05#sec-gp05-VI-C",
    label: "\u2190 Back to GP05 \u00b7 VI.C",
  });
  assert.deepEqual(previewReturnLink({ from: "sec-gp05-VI-C", tour: "1" }, "7"), {
    href: "/regulations/gp05?tour=1#sec-gp05-VI-C",
    label: "\u2190 Back to GP05 \u00b7 VI.C",
  });
  // A repeated parameter: the first one; tour only for exactly "1".
  assert.equal(previewReturnLink({ from: ["sec-gp05-VI-C", "sec-gp12-I"], tour: "yes" }, "7")?.href, "/regulations/gp05#sec-gp05-VI-C");
  // An origin in a regulation whose reader is closed goes to its focused preview.
  assert.deepEqual(previewReturnLink({ from: "sec-gp12-VI-A-1", tour: "1" }, "7"), {
    href: "/regulations/gp12/preview?p=sec-gp12-VI-A-1&tour=1",
    label: "\u2190 Back to GP12 \u00b7 VI.A.1",
  });
  assert.equal(previewReturnLink({ from: "sec-3-A-II-B" }, "7")?.href, "/regulations/3/preview?p=sec-3-A-II-B");
});

test("previewReturnLink: no link for an absent, junk or same-regulation origin", () => {
  for (const from of [undefined, "", "not an id", "sec-7-B-I-D", "SEC-GP05-VI-C", "sec-gp05-VI-C<script>", "x".repeat(300), "/regulations/gp05", "sec-nokey", ["", "sec-gp05-VI-C"]]) {
    assert.equal(previewReturnLink({ from }, "7"), null, JSON.stringify(from));
  }
  assert.equal(previewReturnLink({}, "7"), null);
  assert.equal(previewReturnLink({ from: "sec-7-B-I-D" }, "7"), null, "the same regulation's own trail is the reader's");
  assert.equal(previewReturnLink({ from: "sec-gp05-VI-C" }, "gp05"), null);
});

test("readerRedirectHref keeps ?from= and ?tour=1, and is the old link without them", () => {
  assert.equal(readerRedirectHref("7", "sec-7-B-I-C-1", {}), "/regulations/7#sec-7-B-I-C-1");
  assert.equal(readerRedirectHref("7", "sec-7-B-I-C-1", { p: "sec-7-B-I-C-1" }), "/regulations/7#sec-7-B-I-C-1");
  assert.equal(
    readerRedirectHref("7", "sec-7-B-I-C-1", { from: "sec-gp05-VI-C", tour: "1" }),
    "/regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B-I-C-1"
  );
  assert.equal(readerRedirectHref("7", "sec-7-B-I-C-1", { from: "sec-gp05-VI-C" }), "/regulations/7?from=sec-gp05-VI-C#sec-7-B-I-C-1");
  assert.equal(readerRedirectHref("7", "sec-7-B-I-C-1", { tour: "1" }), "/regulations/7?tour=1#sec-7-B-I-C-1");
  // A junk or same-regulation origin is dropped, not passed on to the reader.
  assert.equal(readerRedirectHref("7", "sec-7-B-I-C-1", { from: "sec-7-B-I-D", tour: "1" }), "/regulations/7?tour=1#sec-7-B-I-C-1");
  assert.equal(readerRedirectHref("7", "sec-7-B-I-C-1", { from: "javascript:alert(1)" }), "/regulations/7#sec-7-B-I-C-1");
  // Parentheses in the origin survive as the reader reads them.
  const href = readerRedirectHref("7", "sec-7-B-I-C-1", { from: "sec-gp12-I-A-8-d-(i)" });
  assert.equal(new URL(href, "https://x.test").searchParams.get("from"), "sec-gp12-I-A-8-d-(i)");
});

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------

function render(rows: Provision[], over: Partial<Parameters<typeof renderSubtreeHtml>[1]> = {}) {
  return renderSubtreeHtml(rows.map(asRow), { reg: "7", focusedId: "sec-7-B-I-C-1", rootSourceUrl: SOURCE, pendingSummaries: 0, ...over });
}

test("the subtree renders as the reader's rows: ids in order, item depth-N, data-citation, the id badge", () => {
  const { ids, html } = render(reg7());
  assert.deepEqual(ids, SUBTREE);
  const doc = dom(html);
  const rows = [...doc.querySelectorAll("#x > *")];
  assert.deepEqual(rows.map((r) => r.id), SUBTREE, "the rows are the direct children");
  // The reader's depths for these rows (4 for I.C.1, 5 for a-f, 6 for the (i)s below e and f).
  assert.deepEqual(
    rows.map((r) => r.className),
    [
      "item depth-4", // I.C.1
      "item depth-5", // a
      "item depth-5", // b
      "item depth-5", // c
      "item depth-5", // d
      "item depth-5", // e
      "item depth-6", // e-(i)
      "item depth-6", // e-(ii)
      "item depth-6", // e-(iii)
      "item depth-6", // e-(iv)
      "item depth-5", // f
      "item depth-6", // f-(i)
      "item depth-6", // f-(ii)
    ]
  );
  assert.equal(rows[1].getAttribute("data-citation"), "I.C.1.a.");
  // The citation badge the reader puts back inside the first <p>; the heading row opens with its citation and gets none.
  assert.equal(rows[1].querySelector("p > span.item-id")?.textContent, "I.C.1.a.");
  assert.equal(rows[0].querySelector(".item-id"), null);
  assert.match(rows[1].textContent ?? "", /manufacturer specifications and good engineering and maintenance practices/);
  // Only the 13: no locked row's text anywhere.
  for (const phrase of ["infrared camera surveys", "13.7 pounds", "one of the following emission factors", "collective emissions and emission reductions", "General requirements for air pollution control", "General Provisions", "older sample row"]) {
    assert.ok(!html.includes(phrase), phrase);
  }
});

test("readerDepthBase is the reader's depth for the focused row", () => {
  assert.equal(readerDepthBase("sec-7-B-I-C-1"), 4);
  assert.equal(readerDepthBase("sec-7-B-I-C-1-e-(i)"), 6);
  assert.equal(readerDepthBase("sec-7-B-I"), 2);
  assert.equal(readerDepthBase("sec-gp05-VI-D"), 2);
  // Rendering a deeper focus puts it, and its children, at the reader's depths.
  const html = render(reg7(), { focusedId: "sec-7-B-I-C-1-e" }).html;
  const classes = [...dom(html).querySelectorAll("#x > *")].map((r) => `${r.id}:${r.className}`);
  assert.deepEqual(classes, [
    "sec-7-B-I-C-1-e:item depth-5",
    "sec-7-B-I-C-1-e-(i):item depth-6",
    "sec-7-B-I-C-1-e-(ii):item depth-6",
    "sec-7-B-I-C-1-e-(iii):item depth-6",
    "sec-7-B-I-C-1-e-(iv):item depth-6",
  ]);
});

test("the preview's rows are the reader's rows: class, citation, text and summary panel, compared with renderDocHtml and the browser-side fills", () => {
  const all = reg7();
  // The reader as a subscriber gets it: every row, rendered by renderDocHtml, then filled by reader-client.
  const readerDom = new JSDOM(`<!doctype html><div id="doc">${renderDocHtml(all)}</div>`).window.document;
  const readerDoc = readerDom.getElementById("doc")!;
  const model = readReaderModel(readerDoc);
  fillSummaryBadges(model);
  fillSummaryLinks(model);
  fillApplicabilityContexts(model);

  const previewDoc = dom(render(reg7()).html);
  const bare = (el: Element) => {
    // Links and cross-reference spans are the one place the preview differs on purpose; compare the rest.
    const copy = el.cloneNode(true) as Element;
    copy.querySelector(":scope > details.summary-panel")?.remove();
    for (const x of [...copy.querySelectorAll("a, span.xref")]) x.replaceWith(...Array.from(x.childNodes));
    return copy.innerHTML;
  };
  // The panel's "In this provision" rows are spans in the reader and links in the preview.
  const panel = (el: Element) =>
    (el.querySelector(":scope > details.summary-panel")?.outerHTML ?? "").replace(
      /<span class="xref summary-child-link" data-target="([^"]*)">([^<]*)<\/span>/g,
      '<a class="xref summary-child-link" href="#$1">$2</a>'
    );

  let panels = 0;
  let withChildren = 0;
  for (const id of SUBTREE) {
    const theirs = readerDoc.querySelector(`[id="${id}"]`)!;
    const mine = previewDoc.querySelector(`[id="${id}"]`)!;
    assert.equal(mine.className, theirs.className, `class of ${id}`);
    assert.equal(mine.getAttribute("data-citation"), theirs.getAttribute("data-citation"), `citation of ${id}`);
    assert.equal(bare(mine), bare(theirs), `text of ${id}`);
    assert.equal(panel(mine), panel(theirs), `panel of ${id}`);
    if (mine.querySelector("details.summary-panel")) panels++;
    if (mine.querySelector(".summary-children")) withChildren++;
  }
  assert.equal(panels, 10, "a, b, c, d, e, e-(i), e-(ii), e-(iv), f-(i), f-(ii)");
  assert.ok(withChildren >= 1, "the parent's panel lists its children");
  assert.ok(previewDoc.querySelector("details.summary-more"), "and keeps the overview and the full summary");
});

test("a summary panel carries its badge, the badge's tooltip and the official-source link, filled on the server", () => {
  const doc = dom(render(reg7()).html);
  const panel = doc.querySelector('[id="sec-7-B-I-C-1-a"] > details.summary-panel')!;
  assert.equal(panel.querySelector("summary")?.textContent, "Plain-English summary");
  const badge = panel.querySelector(".summary-body > p.summary-badge")!;
  assert.equal(badge.className, "summary-badge is-reviewed");
  assert.equal(badge.textContent, "AI-generated \u00b7 automated check against source text \u00b7 Oct 4, 2026");
  assert.equal(badge.getAttribute("title"), SUMMARY_BADGE_TITLES.reviewed);
  const link = panel.querySelector(":scope > .summary-status > a")!;
  assert.equal(link.getAttribute("href"), SOURCE);
  assert.equal(link.textContent, "View official source \u2197");
  assert.equal(link.getAttribute("target"), "_blank");
  assert.match(link.getAttribute("rel") ?? "", /noopener/);
  // No panel on the three rows whose summary is pending with no text.
  for (const id of ["sec-7-B-I-C-1", "sec-7-B-I-C-1-e-(iii)", "sec-7-B-I-C-1-f"]) assert.equal(doc.querySelector(`[id="${id}"] details`), null, id);
  // Every in-page "In this provision" entry points at a row on the page.
  const ids = new Set(SUBTREE);
  for (const a of doc.querySelectorAll("a.summary-child-link")) assert.ok(ids.has((a.getAttribute("href") ?? "").slice(1)));
});

test("a row's own source_url wins over the root's; a row with neither has no link", () => {
  const rows = reg7().map((r) => (r.id === "sec-7-B-I-C-1-b" ? { ...r, source_url: "https://example.gov/b" } : r));
  const doc = dom(render(rows).html);
  assert.equal(doc.querySelector('[id="sec-7-B-I-C-1-b"] .summary-status a')?.getAttribute("href"), "https://example.gov/b");
  assert.equal(doc.querySelector('[id="sec-7-B-I-C-1-a"] .summary-status a')?.getAttribute("href"), SOURCE);
  const none = dom(render(reg7(), { rootSourceUrl: null }).html);
  assert.equal(none.querySelector('[id="sec-7-B-I-C-1-a"] .summary-status'), null);
  assert.ok(none.querySelector('[id="sec-7-B-I-C-1-a"] details.summary-panel'), "the summary is still there");
});

test("the public summary gate: nothing shows while the regulation has summaries pending, or for a row not checked", () => {
  // A regulation with a pending summary somewhere: no panel anywhere.
  const gated = dom(render(reg7(), { pendingSummaries: 3 }).html);
  assert.equal(gated.querySelectorAll("details.summary-panel").length, 0);
  assert.equal(gated.querySelectorAll("#x > *").length, 13, "the official text is untouched");
  // A row whose own summary is still pending (with text), or rejected, shows none; an edited one shows.
  const rows = reg7().map((r) => {
    if (r.id === "sec-7-B-I-C-1-b") return { ...r, summary_status: "pending" };
    if (r.id === "sec-7-B-I-C-1-c") return { ...r, summary_status: "rejected" };
    if (r.id === "sec-7-B-I-C-1-d") return { ...r, summary_status: "edited" };
    return r;
  });
  const doc = dom(render(rows).html);
  assert.equal(doc.querySelector('[id="sec-7-B-I-C-1-b"] details'), null, "pending");
  assert.equal(doc.querySelector('[id="sec-7-B-I-C-1-c"] details'), null, "rejected");
  assert.ok(doc.querySelector('[id="sec-7-B-I-C-1-d"] details.summary-panel'), "edited");
  assert.doesNotMatch(doc.body.innerHTML, /not yet reviewed/);
});

test("a human reviewer's badge says Reviewed; the reviewer's name is never in the page", () => {
  const rows = reg7().map((r) => (r.id === "sec-7-B-I-C-1-a" ? { ...r, reviewed_by_human: true } : r));
  const html = render(rows).html;
  assert.match(html, /<p class="summary-badge is-reviewed is-human" title="Reviewed by a person/);
  assert.match(html, /Reviewed \u00b7 Oct 4, 2026/);
});

test("official text from the database is sanitised before it is rendered", () => {
  const rows = reg7().map((r) =>
    r.id === "sec-7-B-I-C-1-b" ? { ...r, full_text: '<p onclick="alert(1)">b <script>alert(2)</script><a href="javascript:alert(3)">x</a></p>' } : r
  );
  const html = render(rows).html;
  assert.doesNotMatch(html, /onclick|<script|javascript:|alert\(/);
});

test("rows outside the focused subtree are not rendered even if the caller passes them", () => {
  const html = render(reg7().map((r) => ({ ...r, is_public: true }))).html;
  for (const id of ["sec-7-B-I-C", "sec-7-B-I-C-2", "sec-7-B-I-C-10", "sec-7-B-I-B-33", "sec-7-B-II-B-2", SAMPLE_ROW, "sec-7-B-I-D"]) {
    assert.ok(!html.includes(`id="${id}"`), id);
  }
  assert.ok(!html.includes("infrared camera surveys") && !html.includes("13.7 pounds"));
});
