/**
 * The reader's "go to a provision" behaviour (backlog #18), on the real
 * RegulationReader under React in jsdom, against a small Regulation-3-shaped
 * regulation rendered by renderReaderBody:
 *
 *   - the popup's eyebrow is the display name plus the ancestors' labels
 *     ("Regulation 3 · Part A · II. · II.B."), never the internal id, and
 *     elides the middle past four levels;
 *   - "Go to full section" closes the popup, scrolls the #doc row (not the
 *     popup's clone of it), flashes and focuses it, pushes "#<id>", and shows
 *     the return bar naming the row the reference was clicked in;
 *   - the bar's Back button goes back, pops the trail and hides the bar;
 *   - browser Back after a goto lands on the origin too, and pops the trail;
 *   - sidebar links and jump-box landings go through the same path;
 *   - a deep link on load lands without a history entry or a trail;
 *   - the trail is capped and never repeats its top;
 *   - the jump box is an ARIA combobox: ArrowDown/ArrowUp move the active
 *     option, Enter opens it (or the first result, or an exact id/citation
 *     when nothing is listed), Escape closes the list;
 *   - a hashed link into another regulation previews through the gated
 *     /api/provision route ("Open in Regulation 7" carries ?from=) and falls
 *     back to plain navigation whenever it cannot (or must not) preview;
 *   - a link to a WHOLE document ("/regulations/8", no provision in the
 *     hash -- the reviewer's GP12 XII.E "Regulation Number 8") previews the
 *     document through its root row: title, citation, the date we hold it
 *     as of, the two-sentence overview of its top-level summary, and
 *     "Open Regulation 8 →" carrying ?from= (6-7 Oct 2026);
 *   - a reader opened with ?from=<provision of another regulation> shows a
 *     link back to it and strips `from` from the URL;
 *   - a renumbered definition citation (?cited=<printed section> in the
 *     link) previews with a one-line note saying which section the origin
 *     cites and what it is now; `cited` is stripped on arrival like `from`;
 *   - a preview opened from a document older than the cited regulation's
 *     current text shows the version line ("GP12 cites Regulation 7 as
 *     effective 06/14/2025; shown is the current text, effective
 *     07/15/2026. Numbering may differ."), from the manifest's dates; none
 *     for documents of the same age (Regulation 3 citing Regulation 7),
 *     and beside the renumbered line when both apply.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";
import { sanitizeHtml } from "../src/lib/regulation-pure";
import { readReaderModel } from "../src/lib/reader-client";
import {
  ancestorLabels,
  capLabels,
  citationLabelFromId,
  citedParamOf,
  documentDateLine,
  documentKeyOf,
  documentRootOf,
  documentShortName,
  foreignOriginOf,
  formatUsDate,
  hashTargetOf,
  isLockedPreview,
  isUsablePreview,
  lockedPopup,
  originTrailLabel,
  popupEyebrow,
  printedEffectiveDate,
  regulationHref,
  renumberedNote,
  ReturnTrail,
  rowLabel,
  sourceDateOf,
  stripReaderParams,
  titleCaseHeading,
  validCitedSection,
  validProvisionId,
  versionNote,
} from "../src/lib/reader-nav";
import { renderReaderBody } from "../src/lib/reader-render";
import { SOURCE_DATES } from "../src/lib/source-dates.generated";
import type { Provision } from "../src/lib/types";

const ROOT = "sec-3-top-REG-3";
const rows: Provision[] = [
  row(ROOT, "Code of Colorado Regulations · Regulation Number 3", null, "<p>Regulation Number 3 Stationary Source Permitting</p>", {
    source_url: "https://example.gov/reg-3",
  }),
  row("sec-3-P-A", "PART A", ROOT, "<p>PART A Concerning General Provisions</p>"),
  row("sec-3-A-I", "I.", "sec-3-P-A", "<p>Applicability</p>"),
  row("sec-3-A-II", "II.", "sec-3-P-A", "<p>Air Pollutant Emission Notice (APEN) Requirements</p>"),
  row("sec-3-A-II-B", "II.B.", "sec-3-A-II", "<p>APEN requirements</p>"),
  row(
    "sec-3-A-II-B-3",
    "II.B.3.",
    "sec-3-A-II-B",
    '<p>An APEN is valid for five years unless <span class="xref" data-target="sec-3-A-II-B-4">Section II.B.4.</span> applies.</p>'
  ),
  row("sec-3-A-II-B-4", "II.B.4.", "sec-3-A-II-B", "<p>Revised APENs must be filed when emissions change.</p>"),
  row(
    "sec-3-A-II-B-5",
    "II.B.5.",
    "sec-3-A-II-B",
    '<p>See <a class="xref-external-reg" href="/regulations/7#sec-7-B-I-B-33">Section I.B.33</a> of ' +
      '<a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a> and ' +
      '<a class="xref-external-reg" href="/regulations/gp12">General Permit 12</a>. Well production facilities as defined in ' +
      '<a class="xref-external-reg" href="/regulations/7?cited=I.B.33#sec-7-B-I-B-34">Section I.B.33</a> are covered.</p>'
  ),
  row("sec-3-A-II-B-4-a", "II.B.4.a.", "sec-3-A-II-B-4", "<p>A change in ownership.</p>"),
  row("sec-3-A-II-B-4-a-(i)", "II.B.4.a.(i)", "sec-3-A-II-B-4-a", "<p>Within thirty days.</p>"),
  row("sec-3-A-II-B-4-a-(i)-(A)", "II.B.4.a.(i)(A)", "sec-3-A-II-B-4-a-(i)", "<p>By certified mail.</p>"),
  row("sec-3-A-APPENDIX-A", "APPENDIX A", ROOT, "<h2>APPENDIX A Fee schedule</h2><p>Fees.</p>"),
];

function row(id: string, citation: string, parent_id: string | null, full_text: string, extra: Partial<Provision> = {}): Provision {
  return {
    id,
    citation,
    title: citation,
    jurisdiction_level: "state",
    issuing_body: "CDPHE-APCD",
    parent_id,
    full_text: sanitizeHtml(full_text),
    ai_summary: null,
    source_url: null,
    last_verified_date: null,
    is_public: false,
    sort_order: 0,
    summary_status: null,
    ...extra,
  };
}

const reader = renderReaderBody(rows)!;

// A general permit written against an older Regulation 7 (GP12, issued
// 05/28/2026 per the manifest; Regulation 7 is effective 07/15/2026): the
// version-note cases. I.A carries renumbered links and the printed effective
// date, I.C a plain link with the printed date, I.B a plain link without one.
const GP_ROOT = "sec-gp12-top-REG-gp12";
const gpRows: Provision[] = [
  row(GP_ROOT, "APCD General Permit GP12", null, "<p>General Permit GP12 Oil and Gas Well Production Facilities</p>"),
  row("sec-gp12-I", "I.", GP_ROOT, "<p>General Permit Applicability</p>"),
  row(
    "sec-gp12-I-A",
    "I.A",
    "sec-gp12-I",
    '<p>This general permit may be used only for oil and gas well production facilities as defined in ' +
      '<a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, Part B, ' +
      '<a class="xref-external-reg" href="/regulations/7?cited=I.B.33#sec-7-B-I-B-34">Section I.B.33</a> and ' +
      '<a class="xref-external-reg" href="/regulations/7?cited=II.A.46#sec-7-B-II-A-48">Section II.A.46</a> ' +
      "(Adopted: 04/18/2025, Effective: 06/14/2025). Equipment covered by this general permit is limited to the following sources:</p>"
  ),
  row(
    "sec-gp12-I-B",
    "I.B",
    "sec-gp12-I",
    '<p>Combustion devices must comply with <a class="xref-external-reg" href="/regulations/7#sec-7-B-II-B-2-d">Section II.B.2.d.</a> ' +
      "of Regulation Number 7.</p>"
  ),
  row(
    "sec-gp12-I-C",
    "I.C",
    "sec-gp12-I",
    '<p>8-hour Ozone Control Area is as defined in <a class="xref-external-reg" href="/regulations/7">Regulation Number 7</a>, Part A, ' +
      '<a class="xref-external-reg" href="/regulations/7#sec-7-A-II-A-1">Section II.A.1.</a> (Adopted 12/14/2023, Effective 02/14/2024).</p>'
  ),
];
const gpReader = renderReaderBody(gpRows)!;

/** The [reg]/page.tsx shell around RegulationReader, with the deep link `hash`. */
function makeDom(hash = "", search = "", virtualConsole?: VirtualConsole, body = reader, regPath = "3") {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="reg-reader">
      <div id="reader-root"></div>
      <nav id="sidebar">
        <div id="jump-wrap"><input id="jumpbox" type="text"><div id="jump-results"></div></div>
        <div class="nav-reg">${body.navHtml}</div>
      </nav>
      <div id="main-scroll">
        <div id="return-trail" hidden>
          <button id="return-trail-back" type="button">← Back to <span id="return-trail-label"></span></button>
          <button id="return-trail-dismiss" type="button" aria-label="Dismiss">✕</button>
        </div>
        <div id="doc">${body.docHtml}</div>
      </div>
    </div></body></html>`,
    { url: `http://localhost/regulations/${regPath}${search}${hash}`, pretendToBeVisual: true, virtualConsole }
  );
  return dom;
}

test("eyebrow, labels and trail (pure)", () => {
  const { window } = makeDom();
  const model = readReaderModel(window.document.getElementById("doc")!);

  assert.equal(titleCaseHeading("PART A"), "Part A");
  assert.equal(titleCaseHeading("APPENDIX IV"), "Appendix IV");
  assert.equal(titleCaseHeading("II.B."), "II.B.");
  assert.equal(titleCaseHeading("VI.ZZZZ."), "VI.ZZZZ.");
  assert.equal(titleCaseHeading("40 CFR Part 60 Subpart IIII"), "40 CFR Part 60 Subpart IIII");
  assert.equal(titleCaseHeading("100 Series — ABANDONED WELL"), "100 Series — ABANDONED WELL");
  assert.equal(rowLabel(model, model.byId.get(ROOT)!), "Regulation 3");
  assert.equal(rowLabel(model, model.byId.get("sec-3-A-APPENDIX-A")!), "Appendix A");
  assert.equal(rowLabel(model, model.byId.get("sec-3-A-II-B-4")!), "II.B.4.");

  assert.deepEqual(ancestorLabels(model, "sec-3-A-II-B-4"), ["Part A", "II.", "II.B."]);
  assert.equal(popupEyebrow(model, "sec-3-A-II-B-4"), "Regulation 3 · Part A · II. · II.B.");
  assert.equal(popupEyebrow(model, "sec-3-P-A"), "Regulation 3");
  assert.equal(popupEyebrow(model, ROOT), "Regulation 3");
  // Six ancestors: the first, "…", the last three.
  assert.equal(
    popupEyebrow(model, "sec-3-A-II-B-4-a-(i)-(A)"),
    "Regulation 3 · Part A · … · II.B.4. · II.B.4.a. · II.B.4.a.(i)"
  );
  assert.deepEqual(capLabels(["a", "b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.deepEqual(capLabels(["a", "b", "c", "d", "e"]), ["a", "…", "c", "d", "e"]);

  const trail = new ReturnTrail(3);
  trail.push("a");
  trail.push("a");
  assert.equal(trail.length, 1, "no consecutive repeat");
  trail.push("b");
  trail.push("c");
  trail.push("d");
  assert.equal(trail.length, 3, "capped");
  assert.equal(trail.pop(), "d");
  assert.equal(trail.pop(), "c");
  assert.equal(trail.peek(), "b");
  trail.clear();
  assert.equal(trail.peek(), undefined);
});

test("RegulationReader: go to full section, return trail, Back", async (t) => {
  // Loaded with a deep link, like /regulations/3#sec-3-A-II-B-3 after a search.
  const dom = makeDom("#sec-3-A-II-B-3");
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    self: window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLDetailsElement: window.HTMLDetailsElement,
    Element: window.Element,
    Node: window.Node,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
    PopStateEvent: window.PopStateEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  // jsdom has no layout: record what the reader asks the window to scroll to.
  const scrolls: number[] = [];
  window.scrollTo = ((opts: ScrollToOptions) => {
    scrolls.push(opts.top ?? -1);
  }) as typeof window.scrollTo;

  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { RegulationReader } = await import("../src/components/RegulationReader");

  const document = window.document;
  const $ = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    assert.ok(el, `missing ${sel}`);
    return el;
  };
  const docRow = (id: string) => $(`#doc > [id="${id}"]`);
  const click = async (el: Element) => {
    await act(async () => {
      el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const backdrop = () => $("#backdrop");
  const bar = () => $("#return-trail");
  const isShown = () => backdrop().classList.contains("show");

  const historyAtStart = window.history.length;
  const root = createRoot($("#reader-root"));
  await act(async () => {
    root.render(React.createElement(RegulationReader));
  });

  await t.test("deep link: lands after hydration, no history entry, no trail", async () => {
    await sleep(80);
    assert.deepEqual(scrolls.splice(0), [0], "one scroll (jsdom rects are 0)");
    assert.ok(docRow("sec-3-A-II-B-3").classList.contains("flash"));
    assert.equal(window.history.length, historyAtStart);
    assert.equal(bar().hidden, true);
    assert.equal(window.location.hash, "#sec-3-A-II-B-3");
  });

  await t.test("popup: readable eyebrow, title, clone", async () => {
    await click($('#doc > [id="sec-3-A-II-B-3"] .xref[data-target="sec-3-A-II-B-4"]'));
    assert.equal(isShown(), true);
    assert.equal($("#popup-eyebrow").textContent, "Regulation 3 · Part A · II. · II.B.");
    assert.equal($("#popup-title").textContent, "II.B.4.");
    assert.equal(document.querySelectorAll('#popup-body [id="sec-3-A-II-B-4"]').length, 1);
    assert.equal($("#popup-goto").getAttribute("href"), "#sec-3-A-II-B-4");
  });

  await t.test("Go to full section: popup closed, hash pushed, #doc row scrolled/flashed/focused, bar shows the origin", async () => {
    await click($("#popup-goto"));
    assert.equal(isShown(), false);
    assert.equal(window.location.hash, "#sec-3-A-II-B-4");
    assert.equal(window.history.length, historyAtStart + 1);
    assert.deepEqual(window.history.state?.readerAnchor, "sec-3-A-II-B-4");
    assert.equal(scrolls.length, 1);
    const target = docRow("sec-3-A-II-B-4");
    assert.ok(target.classList.contains("flash"));
    assert.equal(document.activeElement, target, "focus is on the #doc row, not the popup's clone");
    assert.equal(bar().hidden, false);
    assert.equal($("#return-trail-back").textContent?.replace(/\s+/g, " ").trim(), "← Back to II.B.3.");
  });

  await t.test("Back button: returns to the origin, pops the trail, hides the bar", async () => {
    scrolls.length = 0;
    await click($("#return-trail-back"));
    assert.equal(window.location.hash, "#sec-3-A-II-B-3");
    assert.equal(scrolls.length, 1);
    assert.equal(document.activeElement, docRow("sec-3-A-II-B-3"));
    assert.equal(bar().hidden, true);
  });

  await t.test("browser Back after a goto: lands on the origin and pops the trail", async () => {
    await click($('#doc > [id="sec-3-A-II-B-3"] .xref[data-target="sec-3-A-II-B-4"]'));
    await click($("#popup-goto"));
    assert.equal(window.location.hash, "#sec-3-A-II-B-4");
    assert.equal(bar().hidden, false);
    scrolls.length = 0;
    const popped = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history.back();
    await popped;
    await act(async () => {});
    assert.equal(window.location.hash, "#sec-3-A-II-B-3");
    assert.equal(window.history.state?.readerAnchor, "sec-3-A-II-B-3", "the entry left was stamped with the origin");
    assert.equal(scrolls.length, 1, "popstate scrolled to the origin");
    assert.equal(document.activeElement, docRow("sec-3-A-II-B-3"));
    assert.equal(bar().hidden, true, "returning to the trail's top pops it");
  });

  await t.test("sidebar link and jump box go through the same path; dismiss clears", async () => {
    await click($('#sidebar a.nav-link[href="#sec-3-A-II"]'));
    assert.equal(window.location.hash, "#sec-3-A-II");
    assert.equal(window.history.state?.readerAnchor, "sec-3-A-II", "pushed its own entry");
    assert.ok(docRow("sec-3-A-II").classList.contains("flash"));
    assert.equal(bar().hidden, false);
    assert.equal(($("#navgroup-sec-3-P-A") as HTMLDetailsElement).open, true);

    const jumpbox = $("#jumpbox") as HTMLInputElement;
    jumpbox.value = "II.B.4";
    await act(async () => {
      jumpbox.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    const hit = $('#jump-results .jr-item[data-slug="sec-3-A-II-B-4"]');
    await click(hit);
    assert.equal(window.location.hash, "#sec-3-A-II-B-4");
    assert.equal(bar().hidden, false);

    await click($("#return-trail-dismiss"));
    assert.equal(bar().hidden, true);
  });

  await act(async () => {
    root.unmount();
  });
});

// ---------------------------------------------------------------------------
// Cross-regulation navigation, pure parts
// ---------------------------------------------------------------------------

test("cross-regulation helpers (pure)", () => {
  // The short citation is derived from the id alone.
  assert.equal(citationLabelFromId("sec-gp12-I-A"), "I.A");
  assert.equal(citationLabelFromId("sec-gp12-I-A-8-d-(i)"), "I.A.8.d.(i)");
  assert.equal(citationLabelFromId("sec-gp12-I-C-2"), "I.C.2", "C after a section numeral is a letter, not a Part");
  assert.equal(citationLabelFromId("sec-7-B-I-B-33"), "Part B · I.B.33");
  assert.equal(citationLabelFromId("sec-3-A-II-B-4-a-(i)-(A)"), "Part A · II.B.4.a.(i)(A)");
  assert.equal(citationLabelFromId("sec-3-P-A"), "Part A");
  assert.equal(citationLabelFromId("sec-3-A-APPENDIX-B"), "Appendix B");
  assert.equal(citationLabelFromId("sec-gp12-ATTACHMENT-2"), "Attachment 2");
  assert.equal(citationLabelFromId("sec-7-top-REG-7"), null, "a root has no citation label");
  assert.equal(originTrailLabel("sec-gp12-I-A"), "GP12 · I.A");
  assert.equal(originTrailLabel("sec-7-B-I-B-33"), "Regulation 7 · Part B · I.B.33");
  assert.equal(originTrailLabel("sec-7-top-REG-7"), "Regulation 7");

  // Ids and hashes.
  assert.equal(validProvisionId("sec-gp12-I-A-8-d-(i)"), "sec-gp12-I-A-8-d-(i)");
  for (const bad of ["", null, undefined, "nonsense", "javascript:alert(1)", "sec-7-B'--", "sec-7 B", "sec-7-" + "x".repeat(250), "<b>"]) {
    assert.equal(validProvisionId(bad as string), null, String(bad));
  }
  assert.equal(hashTargetOf("/regulations/7#sec-7-B-I-B-33"), "sec-7-B-I-B-33");
  assert.equal(hashTargetOf("/regulations/7#sec-gp12-I-A-8-d-%28i%29"), "sec-gp12-I-A-8-d-(i)", "percent-encoded parens decode");
  assert.equal(hashTargetOf("/regulations/7"), null);
  assert.equal(hashTargetOf("/regulations/7#"), null);
  assert.equal(hashTargetOf("/regulations/7#not-a-provision"), null);
  assert.equal(hashTargetOf("/regulations/7#%E0%A4%A"), null, "malformed escape is junk, not a throw");
  assert.equal(regulationHref("sec-7-B-I-B-33", "sec-3-A-II-B-5"), "/regulations/7?from=sec-3-A-II-B-5#sec-7-B-I-B-33");
  assert.equal(regulationHref("sec-7-B-I-B-33"), "/regulations/7#sec-7-B-I-B-33");

  // Renumbered definition citations: the printed section rides in ?cited=.
  assert.equal(regulationHref("sec-7-B-I-B-34", "sec-3-A-II-B-5", "I.B.33"), "/regulations/7?from=sec-3-A-II-B-5&cited=I.B.33#sec-7-B-I-B-34");
  assert.equal(regulationHref("sec-7-B-I-B-34", null, "I.B.33"), "/regulations/7?cited=I.B.33#sec-7-B-I-B-34");
  assert.equal(citedParamOf("/regulations/7?cited=I.B.33#sec-7-B-I-B-34"), "I.B.33");
  assert.equal(citedParamOf("/regulations/7?from=sec-gp12-I-A&cited=II.A.46.#sec-7-B-II-A-48"), "II.A.46", "trailing dot dropped");
  assert.equal(citedParamOf("/regulations/7?cited=I.D.3.b.%28x%29#sec-7-B-I-D-3-b-(x)"), "I.D.3.b.(x)");
  assert.equal(citedParamOf("/regulations/7#sec-7-B-I-B-34"), null);
  assert.equal(citedParamOf("/regulations/7?cited=#sec-7-B-I-B-34"), null);
  for (const bad of ["<b>I.B.33</b>", "javascript:alert(1)", "I.B.33; drop", "x".repeat(50), "section 33"]) {
    assert.equal(validCitedSection(bad), null, bad);
  }
  assert.equal(validCitedSection("I.B.33."), "I.B.33");
  // Whole-document links: the key, the root id, the date line.
  assert.equal(documentKeyOf("/regulations/8"), "8");
  assert.equal(documentKeyOf("/regulations/GP12"), "gp12");
  assert.equal(documentKeyOf("/regulations/oooob?x=1"), "oooob");
  assert.equal(documentKeyOf("/regulations/7#sec-7-B-I-B-33"), null, "a provision link is not a document link");
  assert.equal(documentKeyOf("/regulations/7#"), null);
  assert.equal(documentKeyOf("/regulations/"), null);
  assert.equal(documentKeyOf("/regulations/8/preview"), null);
  assert.equal(documentKeyOf("https://example.com/regulations/8"), null);
  assert.equal(documentKeyOf("/regs/sec-8-top-REG-8"), null);
  assert.equal(documentKeyOf("/regulations/" + "x".repeat(30)), null);
  assert.equal(documentKeyOf(null), null);
  assert.equal(documentRootOf("/regulations/8"), "sec-8-top-REG-8");
  assert.equal(documentRootOf("/regulations/7#sec-7-B-I-B-33"), null);
  const dateTable = {
    "8": { kind: "effective" as const, date: "2025-12-15" },
    gp12: { kind: "issued" as const, date: "2026-05-28" },
    oooob: { kind: "as_of" as const, date: "2026-09-10" },
  };
  assert.equal(documentDateLine("8", dateTable), "Effective 12/15/2025");
  assert.equal(documentDateLine("GP12", dateTable), "Issued 05/28/2026");
  assert.equal(documentDateLine("oooob", dateTable), "Current as of 09/10/2026");
  assert.equal(documentDateLine("zz", dateTable), null);
  assert.equal(documentDateLine(null, dateTable), null);
  assert.equal(documentDateLine("8"), `Effective ${formatUsDate(SOURCE_DATES["8"].date)}`, "the real table");

  assert.equal(documentShortName("gp12"), "GP12");
  assert.equal(documentShortName("7"), "Regulation 7");
  assert.equal(documentShortName(null), "");
  assert.equal(
    renumberedNote("GP12", "I.B.33", "I.B.34.", "Regulation 7"),
    "GP12 cites this as Section I.B.33; in the current Regulation 7 it is I.B.34."
  );
  assert.equal(
    renumberedNote("GP12", "I.B.33", null, "Regulation 7"),
    "GP12 cites this as Section I.B.33; the current Regulation 7 numbers it differently."
  );
  // The version line: dates from the manifest (injected here), wording by case.
  const dates = {
    "7": { kind: "effective" as const, date: "2026-07-15" },
    "3": { kind: "effective" as const, date: "2026-07-15" },
    "26": { kind: "effective" as const, date: "2026-01-14" },
    gp01: { kind: "issued" as const, date: "2025-07-23" },
    gp12: { kind: "issued" as const, date: "2026-05-28" },
    oooob: { kind: "as_of" as const, date: "2026-09-10" },
  };
  assert.equal(formatUsDate("2026-07-15"), "07/15/2026");
  assert.equal(formatUsDate("junk"), "junk");
  assert.equal(
    versionNote("gp12", "7", "06/14/2025", false, dates),
    "GP12 cites Regulation 7 as effective 06/14/2025; shown is the current text, effective 07/15/2026. Numbering may differ."
  );
  assert.equal(
    versionNote("gp01", "7", null, false, dates),
    "GP01 was issued 07/23/2025; shown is the current Regulation 7, effective 07/15/2026. Numbering may differ."
  );
  assert.equal(
    versionNote("26", "7", null, false, dates),
    "Regulation 26 took effect 01/14/2026; shown is the current Regulation 7, effective 07/15/2026. Numbering may differ."
  );
  assert.equal(versionNote("3", "7", null, false, dates), null, "same date: no line");
  assert.equal(versionNote("3", "7", "02/14/2024", false, dates), null, "same date: a printed date changes nothing");
  assert.equal(versionNote("7", "26", null, false, dates), null, "the citing document is newer: no line");
  assert.equal(versionNote("oooob", "7", null, false, dates), null, "newer, whatever its kind");
  assert.equal(versionNote("gp12", "7", null, false, { ...dates, gp12: undefined as never }), null, "unknown origin date");
  assert.equal(versionNote("gp12", "zz", null, false, dates), null, "unknown target date");
  assert.equal(versionNote(null, "7", null, false, dates), null);
  // Beside the renumbered line, which already names both documents and says the numbering moved.
  assert.equal(
    versionNote("gp12", "7", "06/14/2025", true, dates),
    "GP12 cites the version effective 06/14/2025; shown is the current text, effective 07/15/2026."
  );
  assert.equal(versionNote("gp01", "7", null, true, dates), "GP01 was issued 07/23/2025; shown is the current text, effective 07/15/2026.");
  // The real table is the generated one.
  assert.deepEqual(sourceDateOf("GP12"), SOURCE_DATES.gp12);
  assert.equal(sourceDateOf("nope"), null);
  assert.equal(sourceDateOf(null), null);

  // The effective date a citing provision prints after the link, when it prints one for THIS regulation.
  assert.equal(printedEffectiveDate(" (Adopted: 04/18/2025, Effective: 06/14/2025). Equipment covered"), "06/14/2025");
  assert.equal(printedEffectiveDate(" and Section II.A.46 (Adopted: 04/18/2025, Effective: 06/14/2025). Equipment"), "06/14/2025");
  assert.equal(printedEffectiveDate(". (Adopted 12/14/2023, Effective 02/14/2024)."), "02/14/2024");
  assert.equal(printedEffectiveDate(" (Adopted 1/4/2023, Effective 2/5/2024)"), "02/05/2024", "zero-padded");
  assert.equal(printedEffectiveDate("; and be designed so that an observer can determine"), null);
  assert.equal(printedEffectiveDate(" and Regulation Number 3, Part A (Adopted 12/14/2023, Effective 02/14/2024)."), null, "another regulation's date");
  assert.equal(printedEffectiveDate(" and 40 CFR Part 60 (Adopted 12/14/2023, Effective 02/14/2024)."), null);
  assert.equal(printedEffectiveDate(`${"x".repeat(240)} (Adopted 12/14/2023, Effective 02/14/2024).`), null, "too far from the link");
  assert.equal(printedEffectiveDate(""), null);
  assert.equal(printedEffectiveDate(null), null);

  assert.equal(stripReaderParams("?x=1&from=sec-gp12-I-A&cited=I.B.33", ["from", "cited"]), "?x=1");
  assert.equal(stripReaderParams("?from=sec-gp12-I-A", ["from", "cited"]), "");
  assert.equal(stripReaderParams("?cited=I.B.33&from=sec-gp12-I-A", ["cited"]), "?from=sec-gp12-I-A");

  // ?from=: another regulation's id only.
  assert.equal(foreignOriginOf("?from=sec-gp12-I-A", "3"), "sec-gp12-I-A");
  assert.equal(foreignOriginOf("?x=1&from=sec-gp12-I-A", "3"), "sec-gp12-I-A");
  assert.equal(foreignOriginOf("?from=sec-3-A-II-B-4", "3"), null, "same regulation");
  assert.equal(foreignOriginOf("?from=SEC-3-A", "3"), null, "not an id");
  assert.equal(foreignOriginOf("?from=%3Cscript%3E", "3"), null);
  assert.equal(foreignOriginOf("", "3"), null);
  assert.equal(foreignOriginOf("?from=sec-gp12-I-A", null), null);
});

// ---------------------------------------------------------------------------
// The reader under React in jsdom, for the new behaviour
// ---------------------------------------------------------------------------

async function bootReader(dom: JSDOM) {
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    self: window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLDetailsElement: window.HTMLDetailsElement,
    HTMLAnchorElement: window.HTMLAnchorElement,
    Element: window.Element,
    Node: window.Node,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
    PopStateEvent: window.PopStateEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  window.scrollTo = (() => {}) as typeof window.scrollTo;

  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { RegulationReader } = await import("../src/components/RegulationReader");
  const document = window.document;
  const $ = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    assert.ok(el, `missing ${sel}`);
    return el;
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let root: ReturnType<typeof createRoot> | null = null;
  const mount = async () => {
    root = createRoot($("#reader-root"));
    await act(async () => {
      root!.render(React.createElement(RegulationReader));
    });
  };
  const unmount = async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  };
  const click = async (el: Element, init: MouseEventInit = {}) => {
    const ev = new window.MouseEvent("click", { bubbles: true, cancelable: true, ...init });
    await act(async () => {
      el.dispatchEvent(ev);
      await sleep(15);
    });
    return ev;
  };
  const key = async (el: Element, k: string) => {
    const ev = new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
    await act(async () => {
      el.dispatchEvent(ev);
    });
    return ev;
  };
  const type = async (value: string) => {
    const input = $("#jumpbox") as HTMLInputElement;
    input.value = value;
    await act(async () => {
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  return { window, document, $, sleep, mount, unmount, click, key, type };
}

test("jump box: combobox ARIA, arrows, Enter, Escape, exact entry", async (t) => {
  const r = await bootReader(makeDom());
  const { window, document, $, mount, unmount, click, key, type } = r;
  await mount();
  const input = $("#jumpbox") as HTMLInputElement;
  const list = $("#jump-results");
  const options = () => Array.from(document.querySelectorAll<HTMLElement>('#jump-results [role="option"]'));
  const selected = () => options().filter((o) => o.getAttribute("aria-selected") === "true");
  const shown = () => list.classList.contains("show");

  await t.test("ARIA wiring", async () => {
    assert.equal(input.getAttribute("role"), "combobox");
    assert.equal(input.getAttribute("aria-controls"), "jump-results");
    assert.equal(input.getAttribute("aria-expanded"), "false");
    assert.equal(input.getAttribute("aria-autocomplete"), "list");
    assert.equal(list.getAttribute("role"), "listbox");
    await type("II.B");
    assert.equal(shown(), true);
    assert.equal(input.getAttribute("aria-expanded"), "true");
    assert.ok(options().length >= 3);
    const ids = options().map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, "option ids are unique");
    for (const o of options()) {
      assert.equal(o.id, `jump-opt-${o.dataset.slug}`, "stable id from the provision id");
      assert.equal(o.getAttribute("aria-selected"), "false");
    }
    assert.equal(input.hasAttribute("aria-activedescendant"), false);
  });

  await t.test("ArrowDown / ArrowUp move the active option (and wrap)", async () => {
    const n = options().length;
    const ev = await key(input, "ArrowDown");
    assert.equal(ev.defaultPrevented, true);
    assert.equal(selected().length, 1);
    assert.equal(options()[0].getAttribute("aria-selected"), "true");
    assert.equal(input.getAttribute("aria-activedescendant"), options()[0].id);
    await key(input, "ArrowDown");
    assert.equal(input.getAttribute("aria-activedescendant"), options()[1].id);
    assert.equal(selected().length, 1, "exactly one selected");
    await key(input, "ArrowUp");
    assert.equal(input.getAttribute("aria-activedescendant"), options()[0].id);
    await key(input, "ArrowUp");
    assert.equal(input.getAttribute("aria-activedescendant"), options()[n - 1].id, "wraps to the last");
    await key(input, "ArrowDown");
    assert.equal(input.getAttribute("aria-activedescendant"), options()[0].id, "wraps to the first");
  });

  await t.test("Enter opens the active result", async () => {
    await key(input, "ArrowDown"); // second option
    const slug = options()[1].dataset.slug!;
    const ev = await key(input, "Enter");
    assert.equal(ev.defaultPrevented, true);
    assert.equal(window.location.hash, `#${slug}`);
    assert.equal(shown(), false);
    assert.equal(input.getAttribute("aria-expanded"), "false");
    assert.equal(input.hasAttribute("aria-activedescendant"), false);
    assert.equal(input.value, "");
  });

  await t.test("Enter with nothing active opens the first result", async () => {
    await type("II.B.4");
    assert.equal(selected().length, 0);
    const first = options()[0].dataset.slug!;
    await key(input, "Enter");
    assert.equal(window.location.hash, `#${first}`);
    assert.equal(shown(), false);
  });

  await t.test("Escape closes the results and clears the active state", async () => {
    await type("II.B");
    await key(input, "ArrowDown");
    assert.equal(selected().length, 1);
    await key(input, "Escape");
    assert.equal(shown(), false);
    assert.equal(input.getAttribute("aria-expanded"), "false");
    assert.equal(input.hasAttribute("aria-activedescendant"), false);
    assert.equal(selected().length, 0);
    // Arrow keys reopen the list from the typed value.
    await key(input, "ArrowDown");
    assert.equal(shown(), true);
    assert.equal(selected().length, 1);
    await key(input, "Escape");
  });

  await t.test("Enter on an exact provision id with no results goes to it; junk does nothing", async () => {
    const before = window.location.hash;
    await type("sec-3-A-II-B-4-a");
    assert.equal(options().length, 0, "the index does not match raw ids: 'No matches'");
    assert.equal(shown(), true);
    await key(input, "Enter");
    assert.equal(window.location.hash, "#sec-3-A-II-B-4-a");
    assert.notEqual(window.location.hash, before);

    const here = window.location.hash;
    await type("zzzz nothing like it");
    await key(input, "Enter");
    assert.equal(window.location.hash, here, "no match, nowhere to go");
    await key(input, "Escape");
  });

  await t.test("the mouse still works", async () => {
    await type("II.B.4");
    const hit = document.querySelector<HTMLElement>('#jump-results [data-slug="sec-3-A-II-B-4"]');
    assert.ok(hit);
    await click(hit);
    assert.equal(window.location.hash, "#sec-3-A-II-B-4");
    assert.equal(shown(), false);
  });

  await unmount();
});

/** The popup + link fixtures of the cross-regulation tests. */
function crossRegSetup() {
  const messages: string[] = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => messages.push(e.message));
  return { dom: makeDom("#sec-3-A-II-B-5", "", vc), messages };
}

type FetchStub = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
function stubFetch(impl: FetchStub) {
  const calls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    calls.push(String(input));
    return impl(String(input));
  }) as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = real) };
}
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const PREVIEW = {
  id: "sec-7-B-I-B-33",
  reg_key: "7",
  citation: "I.B.33.",
  html: '<p><span class="item-id">I.B.33.</span> Opacity shall not exceed twenty percent.</p>',
};

test("cross-regulation preview through /api/provision", async (t) => {
  const { dom, messages } = crossRegSetup();
  const r = await bootReader(dom);
  const { window, document, $, mount, unmount, click, sleep } = r;
  await mount();
  await sleep(80);

  const link = () => $('#doc > [id="sec-3-A-II-B-5"] a.xref-external-reg[href$="#sec-7-B-I-B-33"]');
  const noHash = () => $('#doc > [id="sec-3-A-II-B-5"] a.xref-external-reg[href="/regulations/gp12"]');
  const isShown = () => $("#backdrop").classList.contains("show");
  // Every click that reaches the window, with whether it was already handled.
  const seen: { target: Element; prevented: boolean }[] = [];
  window.addEventListener("click", (e) => seen.push({ target: e.target as Element, prevented: e.defaultPrevented }));

  await t.test("a hashed link previews the other regulation's provision", async () => {
    const f = stubFetch(async () => okJson(PREVIEW));
    try {
      const ev = await click(link());
      assert.deepEqual(f.calls, ["/api/provision/sec-7-B-I-B-33"]);
      assert.equal(ev.defaultPrevented, true);
      assert.equal(isShown(), true);
      assert.equal($("#popup-eyebrow").textContent, "Regulation 7");
      assert.equal($("#popup-title").textContent, "I.B.33.");
      assert.match($("#popup-body").textContent ?? "", /Opacity shall not exceed twenty percent/);
      // Regulation 3 and Regulation 7 carry the same effective date in the
      // manifest (both 07/15/2026 as of this writing): no version line.
      const sameAge = SOURCE_DATES["3"].date >= SOURCE_DATES["7"].date;
      assert.ok(sameAge, "the manifest now dates Regulation 3 before Regulation 7; revisit this case");
      assert.equal(($("#popup-version-note") as HTMLElement).hidden, true);
      assert.equal($("#popup-version-note").textContent, "");
      const open = $("#popup-goto");
      assert.equal(open.getAttribute("href"), "/regulations/7?from=sec-3-A-II-B-5#sec-7-B-I-B-33");
      assert.equal(open.textContent, "Open in Regulation 7 →");
      // The footer of a remote preview is a real link: its click is left alone.
      const goto = await click(open);
      assert.equal(goto.defaultPrevented, false);
      assert.equal(window.location.hash, "#sec-3-A-II-B-5", "this page did not move");
    } finally {
      f.restore();
    }
  });

  await t.test("a renumbered definition citation: the note names both sections, the footer link carries cited", async () => {
    await click($("#popup-close"));
    const renumbered = $('#doc > [id="sec-3-A-II-B-5"] a.xref-external-reg[href="/regulations/7?cited=I.B.33#sec-7-B-I-B-34"]');
    assert.ok(renumbered, "the sanitiser keeps the ?cited= href");
    const f = stubFetch(async () => okJson({ ...PREVIEW, id: "sec-7-B-I-B-34", citation: "I.B.34." }));
    try {
      await click(renumbered);
      assert.deepEqual(f.calls, ["/api/provision/sec-7-B-I-B-34"]);
      assert.equal(isShown(), true);
      assert.equal($("#popup-title").textContent, "I.B.34.");
      const note = $("#popup-note") as HTMLElement;
      assert.equal(note.hidden, false);
      assert.equal(note.textContent, "Regulation 3 cites this as Section I.B.33; in the current Regulation 7 it is I.B.34.");
      assert.equal(($("#popup-version-note") as HTMLElement).hidden, true, "same-age documents: the renumbered line alone");
      assert.equal($("#popup-goto").getAttribute("href"), "/regulations/7?from=sec-3-A-II-B-5&cited=I.B.33#sec-7-B-I-B-34");
    } finally {
      f.restore();
    }
    // A plain cross-regulation preview afterwards has no note.
    await click($("#popup-close"));
    const f2 = stubFetch(async () => okJson(PREVIEW));
    try {
      await click(link());
      assert.equal(($("#popup-note") as HTMLElement).hidden, true);
      assert.equal($("#popup-note").textContent, "");
    } finally {
      f2.restore();
    }
  });

  await t.test("a same-regulation reference afterwards restores the normal footer", async () => {
    // Close the remote popup, open a local one.
    await click($("#popup-close"));
    assert.equal(isShown(), false);
    await click($('#doc > [id="sec-3-A-II-B-3"] .xref[data-target="sec-3-A-II-B-4"]'));
    assert.equal($("#popup-goto").textContent, "Go to full section →");
    assert.equal($("#popup-goto").getAttribute("href"), "#sec-3-A-II-B-4");
    assert.equal(($("#popup-note") as HTMLElement).hidden, true, "a local popup never carries the note");
    await click($("#popup-close"));
  });

  for (const [name, impl] of [
    ["403", async () => ({ ok: false, status: 403, json: async () => ({}) })],
    ["401", async () => ({ ok: false, status: 401, json: async () => ({}) })],
    ["404", async () => ({ ok: false, status: 404, json: async () => ({}) })],
    ["network error", async () => Promise.reject(new TypeError("offline"))],
    ["a payload for another provision", async () => okJson({ ...PREVIEW, id: "sec-7-B-I-B-34" })],
    ["a payload with no html", async () => okJson({ id: PREVIEW.id, citation: "x" })],
  ] as [string, FetchStub][]) {
    await t.test(`${name}: falls back to plain navigation (the click is replayed, not swallowed)`, async () => {
      const f = stubFetch(impl);
      seen.length = 0;
      messages.length = 0;
      try {
        await click(link());
        assert.equal(f.calls.length, 1);
        assert.equal(isShown(), false, "no popup");
        const mine = seen.filter((s) => s.target === link());
        assert.deepEqual(
          mine.map((s) => s.prevented),
          [true, false],
          "the first click was held for the fetch, the replay is left to the browser"
        );
        assert.ok(
          messages.some((m) => /navigation/i.test(m)),
          "jsdom was asked to navigate"
        );
      } finally {
        f.restore();
      }
    });
  }

  await t.test("a link to a whole document previews the document: title, citation, date, summary overview, Open <document> →", async () => {
    const DOC = {
      id: "sec-gp12-top-REG-gp12",
      reg_key: "gp12",
      citation: "APCD General Permit GP12",
      title: "GENERAL PERMIT 12 (GP12) — Well Production Facilities — GP12 Issuance 1, May 28, 2026",
      html: "GENERAL PERMIT 12 (GP12) — Well Production Facilities — GP12 Issuance 1, May 28, 2026",
      summary: {
        overview: "GP12 is the general permit for well production facilities. It replaced GP09 and GP10 for new registrations.",
        badge: { kind: "reviewed", label: "AI-generated · automated check against source text · Oct 5, 2026" },
      },
    };
    const f = stubFetch(async () => okJson(DOC));
    seen.length = 0;
    try {
      const ev = await click(noHash());
      assert.deepEqual(f.calls, ["/api/provision/sec-gp12-top-REG-gp12"], "the document's root row");
      assert.equal(ev.defaultPrevented, true);
      assert.equal(isShown(), true);
      assert.equal($("#popup-eyebrow").textContent, "APCD General Permit GP12");
      assert.equal($("#popup-title").textContent, DOC.title);
      // The citation line is the display name here, so it is not repeated.
      assert.equal(($("#popup-note") as HTMLElement).hidden, true);
      const dateLine = $("#popup-version-note") as HTMLElement;
      assert.equal(dateLine.hidden, false);
      assert.equal(dateLine.textContent, `Issued ${formatUsDate(SOURCE_DATES.gp12.date)}`);
      // The overview under the reader's own panel markup, open, with the badge.
      const panel = $("#popup-body details.summary-panel") as HTMLDetailsElement;
      assert.equal(panel.open, true);
      assert.equal($("#popup-body .summary-badge").textContent, "AI-generated · automated check against source text · Oct 5, 2026");
      assert.ok($("#popup-body .summary-badge").classList.contains("is-reviewed"));
      assert.equal($("#popup-body .summary-overview").textContent, DOC.summary.overview);
      assert.doesNotMatch($("#popup-body").textContent ?? "", /GENERAL PERMIT 12/, "the root's text is its title again: not repeated");
      assert.equal(($("#popup-text-label") as HTMLElement).hidden, true);
      const open = $("#popup-goto");
      assert.equal(open.textContent, "Open GP12 →");
      assert.equal(open.getAttribute("href"), "/regulations/gp12?from=sec-3-A-II-B-5#sec-gp12-top-REG-gp12");
      const goto = await click(open);
      assert.equal(goto.defaultPrevented, false, "a real link to the document");
    } finally {
      f.restore();
    }
  });

  await t.test("a document with no summary yet says so; the citation shows when it is not the display name", async () => {
    await click($("#popup-close"));
    const docLink = $('#doc > [id="sec-3-A-II-B-5"] a.xref-external-reg[href="/regulations/7"]');
    const f = stubFetch(async () =>
      okJson({
        id: "sec-7-top-REG-7",
        reg_key: "7",
        citation: "Code of Colorado Regulations · Regulation Number 7",
        title: "CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9",
        html: "CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9",
        summary: null,
      })
    );
    try {
      await click(docLink);
      assert.deepEqual(f.calls, ["/api/provision/sec-7-top-REG-7"]);
      assert.equal(isShown(), true);
      assert.equal($("#popup-eyebrow").textContent, "Regulation 7");
      assert.equal($("#popup-title").textContent, "CONTROL OF EMISSIONS FROM OIL AND GAS EMISSIONS OPERATIONS 5 CCR 1001-9");
      assert.equal(($("#popup-note") as HTMLElement).hidden, false);
      assert.equal($("#popup-note").textContent, "Code of Colorado Regulations · Regulation Number 7");
      assert.equal($("#popup-version-note").textContent, `Effective ${formatUsDate(SOURCE_DATES["7"].date)}`);
      assert.equal(document.querySelector("#popup-body details.summary-panel"), null);
      assert.match($("#popup-body .doc-preview-empty").textContent ?? "", /no plain-English summary yet/);
      assert.equal($("#popup-goto").textContent, "Open Regulation 7 →");
      assert.equal($("#popup-goto").getAttribute("href"), "/regulations/7?from=sec-3-A-II-B-5#sec-7-top-REG-7");
    } finally {
      f.restore();
    }
    // A provision preview afterwards is back to normal: no date line.
    await click($("#popup-close"));
    const f2 = stubFetch(async () => okJson(PREVIEW));
    try {
      await click(link());
      assert.equal($("#popup-title").textContent, "I.B.33.");
      assert.equal(($("#popup-version-note") as HTMLElement).hidden, true);
      assert.equal($("#popup-goto").textContent, "Open in Regulation 7 →");
    } finally {
      f2.restore();
    }
    await click($("#popup-close"));
  });

  await t.test("a document link that cannot be previewed falls back to plain navigation", async () => {
    const f = stubFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    seen.length = 0;
    messages.length = 0;
    try {
      await click(noHash());
      assert.equal(f.calls.length, 1);
      assert.equal(isShown(), false);
      const mine = seen.filter((s) => s.target === noHash());
      assert.deepEqual(mine.map((s) => s.prevented), [true, false]);
      assert.ok(messages.some((m) => /navigation/i.test(m)));
    } finally {
      f.restore();
    }
  });

  await t.test("a link to this regulation's own document is not intercepted", async () => {
    // A self-mention links to the page's own root; it is on the page.
    const self = document.createElement("a");
    self.className = "xref-external-reg";
    self.setAttribute("href", "/regulations/3");
    self.textContent = "Regulation Number 3";
    $('#doc > [id="sec-3-A-II-B-5"] p').appendChild(self);
    const f = stubFetch(async () => okJson(PREVIEW));
    seen.length = 0;
    try {
      const ev = await click(self);
      assert.equal(f.calls.length, 0);
      assert.equal(ev.defaultPrevented, false);
      assert.equal(isShown(), false);
    } finally {
      f.restore();
      self.remove();
    }
  });

  await t.test("modifier and non-primary clicks are not intercepted", async () => {
    const f = stubFetch(async () => okJson(PREVIEW));
    try {
      for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
        const ev = await click(link(), init);
        assert.equal(ev.defaultPrevented, false, JSON.stringify(init));
      }
      assert.equal(f.calls.length, 0, "no fetch for any of them");
      assert.equal(isShown(), false);
    } finally {
      f.restore();
    }
  });

  await t.test("closing the popup while the fetch is in flight cancels it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const f = stubFetch(async () => {
      await gate;
      return okJson(PREVIEW);
    });
    try {
      // Not through click(): act() calls must not overlap.
      link().dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
      await sleep(5);
      assert.equal(f.calls.length, 1);
      await click($("#popup-close"));
      release();
      await sleep(30);
      assert.equal(isShown(), false, "the late answer opens nothing");
    } finally {
      f.restore();
    }
  });

  void document;
  await unmount();
});

test("version line: a permit older than the regulation it cites", async (t) => {
  const vc = new VirtualConsole();
  const r = await bootReader(makeDom("#sec-gp12-I-A", "", vc, gpReader, "gp12"));
  const { $, mount, unmount, click, sleep } = r;
  await mount();
  await sleep(80);
  const current = formatUsDate(SOURCE_DATES["7"].date);
  const issued = formatUsDate(SOURCE_DATES.gp12.date);
  assert.ok(SOURCE_DATES.gp12.date < SOURCE_DATES["7"].date, "the manifest now dates GP12 after Regulation 7; revisit these cases");
  const versionNoteEl = () => $("#popup-version-note") as HTMLElement;
  const isShown = () => $("#backdrop").classList.contains("show");

  await t.test("a plain link with the printed effective date: the version line names the printed and the current date", async () => {
    const f = stubFetch(async () => okJson({ ...PREVIEW, id: "sec-7-A-II-A-1", citation: "II.A.1." }));
    try {
      await click($('#doc > [id="sec-gp12-I-C"] a.xref-external-reg[href="/regulations/7#sec-7-A-II-A-1"]'));
      assert.deepEqual(f.calls, ["/api/provision/sec-7-A-II-A-1"]);
      assert.equal(isShown(), true);
      assert.equal(($("#popup-note") as HTMLElement).hidden, true, "not renumbered");
      assert.equal(versionNoteEl().hidden, false);
      assert.equal(
        versionNoteEl().textContent,
        `GP12 cites Regulation 7 as effective 02/14/2024; shown is the current text, effective ${current}. Numbering may differ.`
      );
    } finally {
      f.restore();
    }
  });

  await t.test("a plain link without one: the permit's issuance date", async () => {
    await click($("#popup-close"));
    const f = stubFetch(async () => okJson({ ...PREVIEW, id: "sec-7-B-II-B-2-d", citation: "II.B.2.d." }));
    try {
      await click($('#doc > [id="sec-gp12-I-B"] a.xref-external-reg[href="/regulations/7#sec-7-B-II-B-2-d"]'));
      assert.equal(isShown(), true);
      assert.equal(versionNoteEl().hidden, false);
      assert.equal(
        versionNoteEl().textContent,
        `GP12 was issued ${issued}; shown is the current Regulation 7, effective ${current}. Numbering may differ.`
      );
    } finally {
      f.restore();
    }
  });

  await t.test("a renumbered link: both lines, the second naming neither document again", async () => {
    await click($("#popup-close"));
    const f = stubFetch(async () => okJson({ ...PREVIEW, id: "sec-7-B-I-B-34", citation: "I.B.34." }));
    try {
      // The printed date follows the SECOND link of the list; it is this regulation's all the same.
      await click($('#doc > [id="sec-gp12-I-A"] a.xref-external-reg[href="/regulations/7?cited=I.B.33#sec-7-B-I-B-34"]'));
      assert.equal($("#popup-title").textContent, "I.B.34.");
      const note = $("#popup-note") as HTMLElement;
      assert.equal(note.hidden, false);
      assert.equal(note.textContent, "GP12 cites this as Section I.B.33; in the current Regulation 7 it is I.B.34.");
      assert.equal(versionNoteEl().hidden, false);
      assert.equal(versionNoteEl().textContent, `GP12 cites the version effective 06/14/2025; shown is the current text, effective ${current}.`);
      assert.equal($("#popup-goto").getAttribute("href"), "/regulations/7?from=sec-gp12-I-A&cited=I.B.33#sec-7-B-I-B-34");
    } finally {
      f.restore();
    }
    // The second renumbered link, right before the parenthetical, reads the same date.
    await click($("#popup-close"));
    const f2 = stubFetch(async () => okJson({ ...PREVIEW, id: "sec-7-B-II-A-48", citation: "II.A.48." }));
    try {
      await click($('#doc > [id="sec-gp12-I-A"] a.xref-external-reg[href="/regulations/7?cited=II.A.46#sec-7-B-II-A-48"]'));
      assert.equal($("#popup-note").textContent, "GP12 cites this as Section II.A.46; in the current Regulation 7 it is II.A.48.");
      assert.equal(versionNoteEl().textContent, `GP12 cites the version effective 06/14/2025; shown is the current text, effective ${current}.`);
    } finally {
      f2.restore();
    }
  });

  await t.test("closing clears both lines", async () => {
    await click($("#popup-close"));
    assert.equal(($("#popup-note") as HTMLElement).hidden, true);
    assert.equal(versionNoteEl().hidden, true);
    await unmount();
  });
});

test("?from= another regulation: return link, stripped from the URL", async (t) => {
  const FROM = "sec-gp12-I-A";

  await t.test("shows the link back and strips only `from` (hash and other params stay)", async () => {
    const r = await bootReader(makeDom("#sec-3-A-II-B-3", `?x=1&from=${FROM}`));
    const { window, $, mount, unmount, click, sleep } = r;
    await mount();
    await sleep(80);
    const bar = $("#return-trail");
    assert.equal(bar.hidden, false);
    const back = $("#return-trail-ext") as HTMLAnchorElement;
    assert.equal(back.textContent, "← Back to GP12 · I.A");
    assert.equal(back.getAttribute("href"), "/regulations/gp12#sec-gp12-I-A");
    assert.equal(back.hidden, false);
    assert.equal(($("#return-trail-back") as HTMLElement).hidden, true, "the in-document button yields to the link");
    assert.equal(window.location.search, "?x=1");
    assert.equal(window.location.hash, "#sec-3-A-II-B-3");
    assert.equal((window.history.state as { readerReturnFrom?: string }).readerReturnFrom, FROM);

    // The in-document trail still works on top of it, and gives way back to it.
    await click($('#doc > [id="sec-3-A-II-B-3"] .xref[data-target="sec-3-A-II-B-4"]'));
    await click($("#popup-goto"));
    assert.equal(($("#return-trail-back") as HTMLElement).hidden, false);
    assert.equal(back.hidden, true);
    assert.equal($("#return-trail-back").textContent?.replace(/\s+/g, " ").trim(), "← Back to II.B.3.");
    await click($("#return-trail-back"));
    assert.equal(back.hidden, false, "trail popped: the way back to the other regulation is shown again");

    // Dismiss forgets it, for good.
    await click($("#return-trail-dismiss"));
    assert.equal(bar.hidden, true);
    assert.equal((window.history.state as { readerReturnFrom?: string }).readerReturnFrom, undefined);
    await unmount();
  });

  await t.test("?cited= is stripped with `from`, and on its own; `from` keeps working beside it", async () => {
    let r = await bootReader(makeDom("#sec-3-A-II-B-3", `?from=${FROM}&cited=I.B.33`));
    await r.mount();
    await r.sleep(80);
    assert.equal(r.window.location.search, "");
    assert.equal(r.window.location.hash, "#sec-3-A-II-B-3");
    assert.equal(r.$("#return-trail").hidden, false);
    assert.equal(r.$("#return-trail-ext").getAttribute("href"), "/regulations/gp12#sec-gp12-I-A");
    assert.equal((r.window.history.state as { readerReturnFrom?: string }).readerReturnFrom, FROM);
    await r.unmount();

    r = await bootReader(makeDom("#sec-3-A-II-B-3", "?cited=I.B.33&x=1"));
    await r.mount();
    await r.sleep(80);
    assert.equal(r.window.location.search, "?x=1", "only `cited` goes; no origin, so no bar");
    assert.equal(r.$("#return-trail").hidden, true);
    assert.equal((r.window.history.state as { readerReturnFrom?: string } | null)?.readerReturnFrom, undefined);
    await r.unmount();
  });

  await t.test("survives the effect running again (strict mode / reload): the URL is clean but the entry remembers", async () => {
    const r = await bootReader(makeDom("", `?from=${FROM}`));
    const { window, $, mount, unmount, sleep } = r;
    await mount();
    assert.equal(window.location.search, "");
    assert.equal($("#return-trail").hidden, false);
    await unmount();
    assert.equal(document.getElementById("return-trail-ext"), null, "unmount takes its link away");
    await r.mount();
    await sleep(10);
    assert.equal($("#return-trail").hidden, false);
    assert.equal($("#return-trail-ext").getAttribute("href"), "/regulations/gp12#sec-gp12-I-A");
    await r.unmount();
  });

  for (const [name, search] of [
    ["the same regulation", "?from=sec-3-A-II-B-4"],
    ["not a provision id", "?from=nonsense"],
    ["script-ish junk", "?from=%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["a javascript: URL", "?from=javascript:alert(1)"],
    ["an over-long id", `?from=sec-gp12-${"A-".repeat(200)}`],
    ["empty", "?from="],
  ] as [string, string][]) {
    await t.test(`ignored: ${name}`, async () => {
      const r = await bootReader(makeDom("", search));
      const { window, $, mount, unmount, sleep } = r;
      await mount();
      await sleep(20);
      assert.equal($("#return-trail").hidden, true);
      assert.equal(document.getElementById("return-trail-ext"), null);
      assert.equal(window.location.search, search, "left exactly as it came");
      await unmount();
    });
  }
});

test("isUsablePreview: only the requested row, with a heading, fills a preview", () => {
  const ok = { id: "sec-p190-190.9", citation: "§ 190.9", title: "Petitions", html: "<p>x</p>" };
  assert.equal(isUsablePreview(ok, "sec-p190-190.9"), true);
  assert.equal(isUsablePreview({ ...ok, citation: "", title: "Petitions" }, "sec-p190-190.9"), true);
  assert.equal(isUsablePreview({ ...ok, id: "sec-p190-190.11" }, "sec-p190-190.9"), false);
  assert.equal(isUsablePreview({ ...ok, citation: "", title: "  " }, "sec-p190-190.9"), false);
  assert.equal(isUsablePreview({ id: "sec-p190-190.9", citation: "x" }, "sec-p190-190.9"), false);
  assert.equal(isUsablePreview(null, "sec-p190-190.9"), false);
  assert.equal(isUsablePreview({ error: "Not found." }, "sec-p190-190.9"), false);
});

// Federal jump box (9 Oct 2026): federal citations print with a section sign
// ("§ 60.5416(b)(1)"); the box used to match only that exact spelling.
const FED_ROOT = "sec-oooo-top-REG-oooo";
const fedRows: Provision[] = [
  row(FED_ROOT, "40 CFR Part 60 Subpart OOOO", null, "<p>Standards of performance for crude oil and natural gas</p>"),
  row("sec-oooo-60.5416", "§ 60.5416", FED_ROOT, "<p>What are the initial and continuous cover and closed vent system inspection and monitoring requirements?</p>"),
  row("sec-oooo-60.5416-(b)", "§ 60.5416(b)", "sec-oooo-60.5416", "<p>Cover and closed vent system inspections.</p>"),
  row("sec-oooo-60.5416-(b)-(1)", "§ 60.5416(b)(1)", "sec-oooo-60.5416-(b)", "<p>Visually inspect each closed vent system.</p>"),
];
const fedReader = renderReaderBody(fedRows)!;

test("jump box: a federal citation matches with or without the section sign and with stray spaces", async (t) => {
  const r = await bootReader(makeDom("", "", undefined, fedReader, "oooo"));
  const { $, document, mount, unmount, type, key, window } = r;
  await mount();
  const hit = () => document.querySelector<HTMLElement>('#jump-results [data-slug="sec-oooo-60.5416-(b)-(1)"]');
  for (const typed of ["60.5416(b)(1)", "60.5416 (b)(1)", "§60.5416(b)(1)", "§ 60.5416(b)(1)", " 60.5416 ( b ) ( 1 ) "]) {
    await t.test(`"${typed}" finds § 60.5416(b)(1)`, async () => {
      await type(typed);
      assert.ok(hit(), `no result for ${JSON.stringify(typed)}`);
      assert.equal(
        ($("#jump-results .jr-item[data-slug]") as HTMLElement).dataset.slug,
        "sec-oooo-60.5416-(b)-(1)",
        "the exact citation is the first result"
      );
    });
  }
  await t.test("Enter on an exact entry typed without the sign opens it", async () => {
    await type("60.5416(b)(1)");
    await key($("#jumpbox") as HTMLInputElement, "Enter");
    assert.equal(window.location.hash, "#sec-oooo-60.5416-(b)-(1)");
  });
  await unmount();
});

// ---------------------------------------------------------------------------
// Sprint 4 (10 Oct 2026): a visitor's click on a cross-regulation link.
// /api/provision answers { locked: true, ... } and the popup says so.
// ---------------------------------------------------------------------------

const LOCKED = {
  locked: true as const,
  id: "sec-7-B-I-B-33",
  reg_key: "7",
  citation: "I.B.33.",
  title: "OPACITY",
  path: "PART B \u2014 Oil and Natural Gas \u203a I. Definitions",
};

test("isLockedPreview and lockedPopup (pure)", () => {
  assert.equal(isLockedPreview(LOCKED, "sec-7-B-I-B-33"), true);
  assert.equal(isLockedPreview(LOCKED, "sec-7-B-I-B-34"), false, "the row asked for");
  assert.equal(isLockedPreview({ ...LOCKED, locked: false }, "sec-7-B-I-B-33"), false);
  assert.equal(isLockedPreview({ ...LOCKED, citation: "", title: "" }, "sec-7-B-I-B-33"), false, "no heading, no popup");
  assert.equal(isLockedPreview(null, "x"), false);
  assert.equal(isUsablePreview(LOCKED, "sec-7-B-I-B-33"), false, "a locked label is not a usable full preview");

  const p = lockedPopup(LOCKED, false);
  assert.equal(p.eyebrow, "Regulation 7");
  assert.equal(p.title, "I.B.33.");
  assert.equal(p.note, "OPACITY");
  assert.match(p.panelHtml, /data-testid="locked-destination"/);
  assert.match(p.panelHtml, /Regulation 7 I\.B\.33\. is in the full corpus\./);
  assert.match(p.panelHtml, /Start your 7-day trial to open it\./);
  assert.match(p.panelHtml, /href="\/signup">Start your 7-day trial</);
  assert.match(p.panelHtml, /href="\/regulations\/7\/preview\?p=sec-7-B-I-B-33">See what&#39;s in it</);

  // A title that only repeats the citation adds nothing: no note line.
  assert.equal(lockedPopup({ ...LOCKED, title: "" }, false).note, null);
  // Parenthesised ids are encoded in ?p= like everywhere else.
  assert.match(
    lockedPopup({ ...LOCKED, id: "sec-gp12-VI-A-1-(i)", reg_key: "gp12", citation: "VI.A.1.(i)" }, false).panelHtml,
    /preview\?p=sec-gp12-VI-A-1-\(i\)"|preview\?p=sec-gp12-VI-A-1-%28i%29"/
  );

  // A whole document: its title, the citation on the note line, the regulation's preview page.
  const doc = lockedPopup(
    { ...LOCKED, id: "sec-8-top-REG-8", reg_key: "8", citation: "Code of Colorado Regulations \u00b7 Regulation Number 8", title: "CONTROL OF HAZARDOUS AIR POLLUTANTS", path: null },
    true
  );
  assert.equal(doc.eyebrow, "Regulation 8");
  assert.equal(doc.title, "CONTROL OF HAZARDOUS AIR POLLUTANTS");
  assert.equal(doc.note, "Code of Colorado Regulations \u00b7 Regulation Number 8");
  assert.match(doc.panelHtml, /Regulation 8 is in the full corpus\./);
  assert.match(doc.panelHtml, /href="\/regulations\/8\/preview">See what&#39;s in it</);

  // Everything from the payload is escaped.
  const evil = lockedPopup(
    { ...LOCKED, citation: '<img src=x onerror=alert(1)>', title: '"><script>x</script>', path: "<b>p</b>" },
    false
  );
  assert.doesNotMatch(evil.panelHtml, /<img|<script|<b>/);
  assert.match(evil.panelHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("a visitor's click on a cross-regulation link opens the locked popup, not a redirect", async (t) => {
  const { dom, messages } = crossRegSetup();
  const r = await bootReader(dom);
  const { window, $, mount, unmount, click, sleep } = r;
  await mount();
  await sleep(80);
  const isShown = () => $("#backdrop").classList.contains("show");
  const link = () => $('#doc > [id="sec-3-A-II-B-5"] a.xref-external-reg[href$="#sec-7-B-I-B-33"]');
  const docLink = () => $('#doc > [id="sec-3-A-II-B-5"] a.xref-external-reg[href="/regulations/7"]');
  const before = window.location.href;
  messages.length = 0;

  await t.test("a provision", async () => {
    const f = stubFetch(async () => okJson(LOCKED));
    try {
      const ev = await click(link());
      assert.deepEqual(f.calls, ["/api/provision/sec-7-B-I-B-33"]);
      assert.equal(ev.defaultPrevented, true);
      assert.equal(isShown(), true);
      assert.equal($("#popup-eyebrow").textContent, "Regulation 7");
      assert.equal($("#popup-title").textContent, "I.B.33.");
      assert.equal($("#popup-note").textContent, "OPACITY");
      assert.equal(($("#popup-note") as HTMLElement).hidden, false);
      const panel = $('#popup-body [data-testid="locked-destination"]');
      assert.match(panel.textContent ?? "", /Regulation 7 I\.B\.33\. is in the full corpus\./);
      assert.match(panel.textContent ?? "", /Start your 7-day trial to open it\./);
      assert.equal(panel.querySelector('a[href="/signup"]')?.textContent, "Start your 7-day trial");
      assert.equal(
        panel.querySelector("a.locked-secondary")?.getAttribute("href"),
        "/regulations/7/preview?p=sec-7-B-I-B-33"
      );
      // The footer "Open in Regulation 7" link would navigate into a 404: hidden.
      assert.equal(($("#popup-goto") as HTMLElement).style.display, "none");
      assert.equal(window.location.href, before, "no navigation");
      assert.equal(messages.length, 0, "no replayed navigation either");
    } finally {
      f.restore();
    }
  });

  await t.test("a whole document, then a normal preview restores the footer link", async () => {
    await click($("#popup-close"));
    const f = stubFetch(async () =>
      okJson({ ...LOCKED, id: "sec-7-top-REG-7", citation: "Code of Colorado Regulations \u00b7 Regulation Number 7", title: "CONTROL OF OZONE", path: null })
    );
    try {
      await click(docLink());
      assert.deepEqual(f.calls, ["/api/provision/sec-7-top-REG-7"]);
      assert.equal(isShown(), true);
      assert.equal($("#popup-title").textContent, "CONTROL OF OZONE");
      assert.match($('#popup-body [data-testid="locked-destination"]').textContent ?? "", /Regulation 7 is in the full corpus\./);
      assert.equal(($("#popup-goto") as HTMLElement).style.display, "none");
    } finally {
      f.restore();
    }
    await click($("#popup-close"));
    const f2 = stubFetch(async () => okJson(PREVIEW));
    try {
      await click(link());
      assert.equal($("#popup-body").querySelector('[data-testid="locked-destination"]'), null);
      assert.equal(($("#popup-goto") as HTMLElement).style.display, "");
      assert.equal($("#popup-goto").textContent, "Open in Regulation 7 →");
    } finally {
      f2.restore();
    }
    await click($("#popup-close"));
  });

  await t.test("real failures still replay the click as navigation", async () => {
    const f = stubFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    messages.length = 0;
    try {
      await click(link());
      assert.equal(isShown(), false);
      assert.ok(messages.some((m) => /navigation/i.test(m)));
    } finally {
      f.restore();
    }
  });

  await unmount();
});
