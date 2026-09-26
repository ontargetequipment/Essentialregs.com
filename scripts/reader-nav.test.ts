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
 *   - the trail is capped and never repeats its top.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { sanitizeHtml } from "../src/lib/regulation-pure";
import { readReaderModel } from "../src/lib/reader-client";
import { ancestorLabels, capLabels, popupEyebrow, ReturnTrail, rowLabel, titleCaseHeading } from "../src/lib/reader-nav";
import { renderReaderBody } from "../src/lib/reader-render";
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

/** The [reg]/page.tsx shell around RegulationReader, with the deep link `hash`. */
function makeDom(hash = "") {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="reg-reader">
      <div id="reader-root"></div>
      <nav id="sidebar">
        <div id="jump-wrap"><input id="jumpbox" type="text"><div id="jump-results"></div></div>
        <div class="nav-reg">${reader.navHtml}</div>
      </nav>
      <div id="main-scroll">
        <div id="return-trail" hidden>
          <button id="return-trail-back" type="button">← Back to <span id="return-trail-label"></span></button>
          <button id="return-trail-dismiss" type="button" aria-label="Dismiss">✕</button>
        </div>
        <div id="doc">${reader.docHtml}</div>
      </div>
    </div></body></html>`,
    { url: `http://localhost/regulations/3${hash}`, pretendToBeVisual: true }
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
