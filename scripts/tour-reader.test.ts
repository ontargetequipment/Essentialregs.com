/**
 * The guided GP05 walkthrough on the real RegulationReader and ReaderTour
 * under React in jsdom (Sprint 7): what moves each step on, with a reader
 * shaped like GP05 -- VI.C (with the Regulation 7 I.C.1 link) and VI.D (with
 * a summary and the word "frequency").
 *
 *   - step 1 moves on only when VI.D is reached through the jump box (a click
 *     on its match, or Enter on it): a typed hash, a sidebar link and
 *     Back/Forward to VI.D leave it where it is, and so does a landing on VI.D
 *     that comes after a different match was opened;
 *   - steps 2-4 move on as before; step 5's click is taken, not the reader's
 *     popup, and does not move the step (the destination page does);
 *   - Restart and Skip tell the reader to forget its trail;
 *   - a tour already at step 7 shows the closing card when the reader is at
 *     VI.C, step 5 when it is not, and counts tour_complete once;
 *   - the destination page (steps 6 and 7) moves from 5 to 6 on arrival, to 7
 *     when any summary of the cited provision's subtree opens, and a
 *     subscriber's way back is taken to add ?tour=1.
 *
 * jsdom has no layout, so where a callout sits and what is on screen is the
 * browser tests' business (e2e/smoke-tour.spec.ts). Navigation (the
 * citation click, the way back) is not implemented in jsdom: the pure URLs
 * are in tour.test.ts.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";
import { sanitizeHtml } from "../src/lib/regulation-pure";
import { renderReaderBody } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

// ReaderTour keeps its state in module-level variables, so each boot loads a fresh copy of it.
const nodeRequire = createRequire(__filename);

const ROOT = "sec-gp05-top-REG-gp05";
const row = (id: string, citation: string, parent_id: string | null, full_text: string, extra: Partial<Provision> = {}): Provision => ({
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
  is_public: true,
  sort_order: 0,
  summary_status: null,
  ...extra,
});
const gp05 = renderReaderBody([
  row(ROOT, "APCD General Permit GP05", null, "<p>General Permit GP05</p>"),
  row("sec-gp05-VI", "VI.", ROOT, "<p>Sampling</p>"),
  row(
    "sec-gp05-VI-C",
    "VI.C.",
    "sec-gp05-VI",
    '<p>The owner or operator shall comply with <a class="xref-external-reg" href="/regulations/7#sec-7-B-I-C-1">Section I.C.1.</a> of Regulation Number 7 and ' +
      '<a class="xref-external-reg" href="/regulations/7#sec-7-B-II-B-2">II.B.2.</a></p>'
  ),
  row("sec-gp05-VI-D", "VI.D.", "sec-gp05-VI", "<p>At the frequency specified in Table 2, the owner or operator of storage tanks shall sample.</p>", {
    ai_summary: "Sampling happens at the frequency in Table 2.",
    summary_status: "approved",
  }),
  row("sec-gp05-VII", "VII.", ROOT, "<p>Records</p>"),
])!;

/** A subscriber's Regulation 7 reader, with the cited provision's subtree. */
const reg7 = renderReaderBody([
  row("sec-7-top-REG-7", "Code of Colorado Regulations · Regulation Number 7", null, "<p>Regulation Number 7</p>"),
  row("sec-7-B-I-C", "I.C.", "sec-7-top-REG-7", "<p>Parent</p>"),
  row("sec-7-B-I-C-1", "I.C.1.", "sec-7-B-I-C", "<p>I.C.1. General Requirements</p>"),
  row("sec-7-B-I-C-1-a", "I.C.1.a.", "sec-7-B-I-C-1", "<p>Opacity.</p>", { ai_summary: "Limits opacity.", summary_status: "approved" }),
  row("sec-7-B-I-C-1-b", "I.C.1.b.", "sec-7-B-I-C-1", "<p>Records.</p>", { ai_summary: "Keep records.", summary_status: "approved" }),
  row("sec-7-B-I-C-2", "I.C.2.", "sec-7-B-I-C", "<p>Other.</p>", { ai_summary: "Other.", summary_status: "approved" }),
])!;

function pageHtml(body: { navHtml: string; docHtml: string }, extra = "") {
  return `<!doctype html><html><body><div class="reg-reader">
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
    </div>${extra}
  </div></body></html>`;
}

type Sent = { event: string; step: number };

/** The visitor preview's markup (the focused provision's block): the way back and the public subtree. */
const previewShell = `<!doctype html><html><body>
  <div id="reader-root"></div>
  <div class="focused">
    <a id="preview-return" data-testid="preview-return" href="/regulations/gp05?tour=1#sec-gp05-VI-C">← Back to GP05 · VI.C</a>
    <div id="preview-doc" data-testid="preview-subtree">
      <div id="sec-7-B-I-C-1" class="item depth-3" data-citation="I.C.1."><p>I.C.1. General Requirements</p></div>
      <div id="sec-7-B-I-C-1-a" class="item depth-4" data-citation="I.C.1.a."><p>Opacity.</p>
        <details class="summary-panel"><summary>Plain-English summary</summary><div class="summary-body"><p>Limits opacity.</p></div></details></div>
      <div id="sec-7-B-I-C-1-e-(iii)" class="item depth-5" data-citation="I.C.1.e.(iii)"><p>Pending.</p></div>
    </div>
  </div></body></html>`;

async function boot(opts: {
  path: string;
  /** The preview's I.C.1.a summary is open from the start. */
  panelOpen?: boolean;
  /** The reader's page (GP05 or a subscriber's Reg 7); omit for the visitor preview. */
  body?: { navHtml: string; docHtml: string };
  placement?: "anchored" | "floating";
  stored?: unknown;
  page: "reader" | "destination";
  hasAccess?: boolean;
  publicMode?: boolean;
  extra?: string;
}) {
  const messages: string[] = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => messages.push(e.message));
  const dom = new JSDOM(
    opts.body ? pageHtml(opts.body, opts.extra) : opts.panelOpen ? previewShell.replace('<details class="summary-panel">', '<details class="summary-panel" open>') : previewShell,
    { url: `http://localhost${opts.path}`, pretendToBeVisual: true, virtualConsole: vc }
  );
  const { window } = dom;
  const sent: Sent[] = [];
  const scrolls: number[] = [];
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
    FocusEvent: window.FocusEvent,
    Event: window.Event,
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  Object.defineProperty(window, "matchMedia", {
    value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }),
    configurable: true,
  });
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  window.scrollBy = ((o: ScrollToOptions) => void scrolls.push(o.top ?? 0)) as typeof window.scrollBy;
  if (opts.stored) window.sessionStorage.setItem("er:tour", JSON.stringify(opts.stored));
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
    if (String(url) === "/api/tour-event") {
      const b = JSON.parse(init?.body ?? "{}");
      sent.push({ event: b.event, step: b.step });
    }
    return { ok: true, status: 204, json: async () => ({}) };
  }) as typeof fetch;

  // A fresh ReaderTour module (its state store is module-level) each boot.
  // (The component imports its stylesheet; Node has nothing to do with one.)
  (nodeRequire.extensions as Record<string, unknown>)[".css"] = (m: { exports: unknown }) => {
    m.exports = {};
  };
  for (const k of Object.keys(nodeRequire.cache)) if (k.includes("/ReaderTour")) delete nodeRequire.cache[k];
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { RegulationReader } = await import("../src/components/RegulationReader");
  const { ReaderTour } = nodeRequire("../src/components/ReaderTour") as typeof import("../src/components/ReaderTour");

  const document = window.document;
  const $ = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    assert.ok(el, `missing ${sel}`);
    return el;
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const root = createRoot($("#reader-root"));
  await act(async () => {
    root.render(
      React.createElement(
        React.Fragment,
        null,
        opts.body ? React.createElement(RegulationReader as React.ComponentType<{ publicMode?: boolean }>, { publicMode: opts.publicMode ?? !opts.hasAccess }) : null,
        React.createElement(ReaderTour, { page: opts.page, hasAccess: opts.hasAccess ?? false, placement: opts.placement })
      )
    );
  });
  await act(async () => {
    await sleep(80);
  });
  const click = async (el: Element, init: MouseEventInit = {}) => {
    const ev = new window.MouseEvent("click", { bubbles: true, cancelable: true, ...init });
    await act(async () => {
      el.dispatchEvent(ev);
      await sleep(15);
    });
    return ev;
  };
  const keydown = async (el: Element, k: string) => {
    await act(async () => {
      el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    });
  };
  const type = async (value: string) => {
    const input = $("#jumpbox") as HTMLInputElement;
    input.focus(); // a visitor clicks into the box: focus leaves whatever row it was on
    input.value = value;
    await act(async () => {
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  const callout = () => document.querySelector<HTMLElement>('[data-testid="tour-callout"]');
  const stored = () => JSON.parse(window.sessionStorage.getItem("er:tour") ?? "null");
  const tags = () => sent.map((e) => `${e.event}:${e.step}`);
  const settle = async (ms = 30) => {
    await act(async () => {
      await sleep(ms);
    });
  };
  const stop = async () => {
    await act(async () => root.unmount());
    globalThis.fetch = realFetch;
  };
  return { window, document, $, click, keydown, type, callout, stored, tags, settle, stop, messages, scrolls, act, sleep };
}

const GP05_PATH = "/regulations/gp05?tour=1";
const rowIn = (document: Document, id: string) => document.querySelector<HTMLElement>(`#doc > [id="${id}"]`)!;

test("step 1 moves on only through the jump box; steps 2-4 move as the visitor acts; step 5 is taken, and moves nothing", async (t) => {
  const r = await boot({ path: GP05_PATH, body: gp05, page: "reader" });
  const { window, document, $, click, keydown, type, callout, stored, tags, settle } = r;

  await t.test("a fresh tour counts its start and step 1", () => {
    assert.equal(callout()?.getAttribute("data-step"), "1");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 1 of 7");
    assert.equal(stored().v, 2);
    assert.deepEqual(tags(), ["tour_start:1", "tour_step:1"]);
    assert.equal($("#jumpbox").getAttribute("data-tour-target"), "1");
  });

  await t.test("a typed hash, a sidebar link and Back/Forward to VI.D do not move it", async () => {
    window.location.hash = "#sec-gp05-VI-D";
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "1", "a typed hash");
    await click($('#sidebar a.nav-link[href="#sec-gp05-VI-D"]'));
    assert.equal(document.activeElement, rowIn(document, "sec-gp05-VI-D"), "the reader landed on it and focused it");
    assert.equal(callout()?.getAttribute("data-step"), "1", "a sidebar link");
    const popped = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history.back();
    await popped;
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "1", "Back");
    const forward = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history.forward();
    await forward;
    await settle();
    assert.equal(window.location.hash, "#sec-gp05-VI-D");
    assert.equal(callout()?.getAttribute("data-step"), "1", "Forward onto VI.D");
    assert.deepEqual(tags(), ["tour_start:1", "tour_step:1"]);
  });

  await t.test("frequency typed but nothing picked: still step 1; the match for VI.D is offered", async () => {
    await type("frequency");
    assert.ok($('#jump-results .jr-item[data-slug="sec-gp05-VI-D"]'), "VI.D is among the matches for the word");
    await settle(60);
    assert.equal(callout()?.getAttribute("data-step"), "1");
  });

  await t.test("Enter on the VI.D match moves it to step 2", async () => {
    const input = $("#jumpbox");
    // ArrowDown to VI.D, then Enter.
    const options = () => Array.from(document.querySelectorAll<HTMLElement>('#jump-results [role="option"]'));
    for (let i = 0; i < options().length && options().find((o) => o.dataset.slug === "sec-gp05-VI-D")?.getAttribute("aria-selected") !== "true"; i++) {
      await keydown(input, "ArrowDown");
    }
    await keydown(input, "Enter");
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "2");
    assert.deepEqual(tags(), ["tour_start:1", "tour_step:1", "tour_step:2"]);
    assert.equal(rowIn(document, "sec-gp05-VI-D").getAttribute("data-tour-target"), "2");
  });

  await t.test("step 2 -> Next -> 3; opening VI.D's summary -> 4 (the official-text line is there)", async () => {
    await click($('[data-testid="tour-next"]'));
    assert.equal(callout()?.getAttribute("data-step"), "3");
    const panel = rowIn(document, "sec-gp05-VI-D").querySelector<HTMLDetailsElement>(":scope > details.summary-panel")!;
    assert.equal(panel.querySelector(":scope > summary")?.getAttribute("data-tour-target"), "3");
    await r.act(async () => {
      panel.open = true;
      await r.sleep(20);
    });
    assert.equal(callout()?.getAttribute("data-step"), "4");
    assert.equal($('[data-testid="tour-official-controls"]').textContent, "The official text controls; the summary is a reading aid.");
    assert.equal(panel.getAttribute("data-tour-target"), "4");
  });

  await t.test("step 4 -> 5 when the reader lands on VI.C, however it got there", async () => {
    await type("VI.C");
    await keydown($("#jumpbox"), "Enter");
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "5");
    const link = rowIn(document, "sec-gp05-VI-C").querySelector('a.xref-external-reg[href$="#sec-7-B-I-C-1"]')!;
    assert.equal(link.getAttribute("data-tour-target"), "5");
    // The other Regulation 7 link in VI.C is not the tour's.
    assert.equal(rowIn(document, "sec-gp05-VI-C").querySelectorAll("[data-tour-target]").length, 1, "only the tour's link is marked, not the row's other Regulation 7 link");
  });

  await t.test("step 5: the click is taken (no popup), and the step stays 5 until the destination page loads", async () => {
    const link = rowIn(document, "sec-gp05-VI-C").querySelector('a.xref-external-reg[href$="#sec-7-B-I-C-1"]')!;
    const ev = await click(link);
    assert.equal(ev.defaultPrevented, true);
    assert.equal($("#backdrop").classList.contains("show"), false, "no popup");
    assert.equal(callout()?.getAttribute("data-step"), "5");
    assert.equal(stored().step, 5);
    // A click with a modifier is left to the browser (a new tab), as ever.
    const other = await click(link, { ctrlKey: true });
    assert.equal(other.defaultPrevented, false);
  });

  await t.test("Restart: step 1, the summary closed, the hash gone, and the reader's Back bar gone with it; no second tour_start", async () => {
    assert.equal($("#return-trail").hidden, false, "the jumps left a Back bar");
    await click($('[data-testid="tour-restart"]'));
    assert.equal(callout()?.getAttribute("data-step"), "1");
    assert.equal($("#return-trail").hidden, true);
    assert.equal(window.location.hash, "");
    assert.equal(rowIn(document, "sec-gp05-VI-D").querySelector<HTMLDetailsElement>(":scope > details.summary-panel")!.open, false);
    assert.equal(document.activeElement, $("#jumpbox"));
    assert.equal(tags().filter((x) => x === "tour_start:1").length, 1);
    assert.deepEqual(tags(), ["tour_start:1", "tour_step:1", "tour_step:2", "tour_step:3", "tour_step:4", "tour_step:5"]);
  });

  await t.test("a different match opened by Enter uses the arming up: a sidebar click on VI.D right after does not count", async () => {
    await type("VI.C");
    await keydown($("#jumpbox"), "Enter"); // lands on VI.C, not VI.D
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "1");
    await click($('#sidebar a.nav-link[href="#sec-gp05-VI-D"]'));
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "1");
  });

  await t.test("a click on the VI.D match moves it on (the pointer path)", async () => {
    await type("frequency");
    await click($('#jump-results .jr-item[data-slug="sec-gp05-VI-D"]'));
    await settle();
    assert.equal(callout()?.getAttribute("data-step"), "2");
  });

  await t.test("Skip clears the tour and the reader's trail, drops ?tour=1 and does not reload", async () => {
    assert.equal($("#return-trail").hidden, false);
    await click($('[data-testid="tour-skip"]'));
    assert.equal(callout(), null);
    assert.equal(window.sessionStorage.getItem("er:tour"), null);
    assert.equal(window.location.search, "");
    assert.equal($("#return-trail").hidden, true);
    assert.ok(tags().includes("tour_skip:2") || r.tags().includes("tour_skip:2"), `the step shown was counted: ${tags().join(",")}`);
  });

  await r.stop();
});

test("a tour at step 7 shows the closing card at VI.C (and step 5 elsewhere); the completion is counted once", async (t) => {
  const stored = { v: 2, step: 7, done: false, completed: false, sid: "test-0000-0000-0000", reported: [1, 2, 3, 4, 5, 6, 7] };

  await t.test("arrived back at VI.C: the closing card, tour_complete:7 once", async () => {
    const r = await boot({ path: `/regulations/gp05?tour=1#sec-gp05-VI-C`, body: gp05, page: "reader", stored });
    assert.equal(r.callout()?.getAttribute("data-step"), "closing");
    assert.equal(r.$('[data-testid="tour-count"]').textContent, "Walkthrough complete");
    assert.match(r.$('[data-testid="tour-closing"]').textContent ?? "", /^You found a requirement without knowing its number/);
    assert.equal(r.$('[data-testid="tour-explore"]').getAttribute("href"), "/regulations/gp05");
    assert.equal(r.$('[data-testid="tour-trial"]').getAttribute("href"), "/signup");
    assert.equal(r.$('[data-testid="tour-skip"]').textContent, "End tour");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);
    assert.equal(r.stored().done, true);
    assert.equal(r.$("#return-trail").hidden, true, "arriving draws no Back bar");

    // It stays wherever the reader goes afterwards; nothing is counted again.
    await r.click(r.$('#sidebar a.nav-link[href="#sec-gp05-VI-D"]'));
    assert.equal(r.callout()?.getAttribute("data-step"), "closing");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);

    // Restart from it: step 1, no Back bar (the jump above left one), nothing counted.
    assert.equal(r.$("#return-trail").hidden, false);
    await r.click(r.$('[data-testid="tour-restart"]'));
    assert.equal(r.callout()?.getAttribute("data-step"), "1");
    assert.equal(r.stored().done, false);
    assert.equal(r.$("#return-trail").hidden, true);
    assert.equal(r.window.location.hash, "");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);
    await r.stop();
  });

  await t.test("not at VI.C: step 5 again; landing on VI.C then completes it", async () => {
    const r = await boot({ path: GP05_PATH, body: gp05, page: "reader", stored });
    assert.equal(r.callout()?.getAttribute("data-step"), "5");
    assert.deepEqual(r.tags(), []);
    await r.type("VI.C");
    await r.keydown(r.$("#jumpbox"), "Enter");
    await r.settle();
    assert.equal(r.callout()?.getAttribute("data-step"), "closing");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);
    await r.stop();
  });

  await t.test("a run that was already counted as complete is not counted again", async () => {
    const r = await boot({ path: `/regulations/gp05?tour=1#sec-gp05-VI-C`, body: gp05, page: "reader", stored: { ...stored, completed: true } });
    assert.equal(r.callout()?.getAttribute("data-step"), "closing");
    assert.deepEqual(r.tags(), []);
    await r.stop();
  });

  await t.test("a stored v1 state is ignored: a fresh run starts", async () => {
    const r = await boot({
      path: GP05_PATH,
      body: gp05,
      page: "reader",
      stored: { v: 1, step: 4, sid: "test-0000-0000-0000", reported: [1, 2, 3, 4] },
    });
    assert.equal(r.callout()?.getAttribute("data-step"), "1");
    assert.deepEqual(r.tags(), ["tour_start:1", "tour_step:1"]);
    await r.stop();
  });

  await t.test("a tour at step 6 shows step 5 in the reader (Back from the destination page)", async () => {
    const r = await boot({ path: GP05_PATH, body: gp05, page: "reader", stored: { ...stored, step: 6 } });
    assert.equal(r.callout()?.getAttribute("data-step"), "5");
    assert.deepEqual(r.tags(), []);
    await r.stop();
  });
});

const AT = (step: number, extra: Record<string, unknown> = {}) => ({
  v: 2,
  step,
  done: false,
  completed: false,
  sid: "test-0000-0000-0000",
  reported: Array.from({ length: step }, (_, i) => i + 1),
  ...extra,
});
const IC1 = "sec-7-B-I-C-1";
const panelOf = (document: Document, scope: string, id: string) =>
  document.querySelector<HTMLDetailsElement>(`${scope} > [id="${id}"] > details.summary-panel`)!;

test("a subscriber's Regulation 7 reader: 5 -> 6 on arrival, 6 -> 7 when a summary of the subtree opens, and the reader's own way back keeps the tour on", async (t) => {
  const r = await boot({
    path: `/regulations/7?from=sec-gp05-VI-C&tour=1#${IC1}`,
    body: reg7,
    page: "destination",
    hasAccess: true,
    stored: AT(5),
  });
  const { window, document, $, click, callout, stored, tags, settle, act, sleep } = r;

  await t.test("arrival moves the step on; the reader's bar is the way back; the anchor is I.C.1.a's summary control", () => {
    // The reader took ?from= off the URL and drew its bar.
    assert.equal(window.location.search, "?tour=1");
    assert.equal($("#return-trail-ext").textContent, "← Back to GP05 · VI.C");
    assert.equal($("#return-trail-ext").getAttribute("href"), "/regulations/gp05#sec-gp05-VI-C");
    assert.equal(callout()?.getAttribute("data-step"), "6");
    assert.equal(callout()?.getAttribute("data-mode"), "anchored");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 6 of 7");
    assert.deepEqual(tags(), ["tour_step:6"]);
    assert.equal(panelOf(document, "#doc", `${IC1}-a`).querySelector(":scope > summary")?.getAttribute("data-tour-target"), "6");
  });

  await t.test("a summary outside the cited provision's subtree does not move it; any inside does (here I.C.1.b)", async () => {
    await act(async () => {
      panelOf(document, "#doc", "sec-7-B-I-C-2").open = true;
      await sleep(20);
    });
    assert.equal(callout()?.getAttribute("data-step"), "6", "I.C.2 is not under I.C.1");
    await act(async () => {
      panelOf(document, "#doc", `${IC1}-b`).open = true;
      await sleep(20);
    });
    assert.equal(callout()?.getAttribute("data-step"), "7");
    assert.deepEqual(tags(), ["tour_step:6", "tour_step:7"]);
    assert.equal($("#return-trail-ext").getAttribute("data-tour-target"), "7", "the reader's bar is step 7's anchor");
  });

  await t.test("the way back is taken (the tour adds ?tour=1 and loads it); a modified click is left alone", async () => {
    const link = $("#return-trail-ext");
    const ctrl = await click(link, { ctrlKey: true });
    assert.equal(ctrl.defaultPrevented, false);
    r.messages.length = 0;
    const ev = await click(link);
    assert.equal(ev.defaultPrevented, true);
    assert.ok(r.messages.some((m) => /navigation/i.test(m)), "it loads a page (jsdom has no navigation to do it with)");
    assert.equal(callout()?.getAttribute("data-step"), "7", "the step moves on at VI.C, not here");
  });

  await t.test("Skip clears the tour and the bar that names GP05, and drops ?tour=1", async () => {
    await click($('[data-testid="tour-skip"]'));
    assert.equal(callout(), null);
    assert.equal(stored(), null);
    assert.equal(window.location.search, "");
    assert.equal($("#return-trail").hidden, true);
    assert.equal(($("#return-trail-ext") as HTMLElement).hidden, true);
    assert.ok(tags().includes("tour_skip:7"));
    await settle();
  });
  await r.stop();
});

test("the visitor's focused preview (floating): 5 -> 6 on arrival, 6 -> 7 on a subtree summary, the preview's own link is the way back", async (t) => {
  const path = `/regulations/7/preview?p=${IC1}&from=sec-gp05-VI-C&tour=1`;

  await t.test("arrival, the anchors, and counting", async () => {
    const r = await boot({ path, page: "destination", placement: "floating", stored: AT(5) });
    assert.equal(r.callout()?.getAttribute("data-step"), "6");
    assert.equal(r.callout()?.getAttribute("data-mode"), "floating");
    assert.deepEqual(r.tags(), ["tour_step:6"]);
    const aPanel = panelOf(r.document, "#preview-doc", `${IC1}-a`);
    assert.equal(aPanel.querySelector(":scope > summary")?.getAttribute("data-tour-target"), "6");
    await r.act(async () => {
      aPanel.open = true;
      await r.sleep(20);
    });
    assert.equal(r.callout()?.getAttribute("data-step"), "7");
    assert.equal(r.$("#preview-return").getAttribute("data-tour-target"), "7");
    assert.equal(r.$('[data-testid="tour-count"]').textContent, "Step 7 of 7");
    assert.deepEqual(r.tags(), ["tour_step:6", "tour_step:7"]);
    // The visitor's link already carries ?tour=1: the tour leaves its click alone.
    r.messages.length = 0;
    const ev = await r.click(r.$("#preview-return"));
    assert.equal(ev.defaultPrevented, false);
    await r.stop();
  });

  await t.test("a reload resumes at 6 and at 7", async () => {
    for (const step of [6, 7]) {
      const r = await boot({ path, page: "destination", placement: "floating", stored: AT(step) });
      assert.equal(r.callout()?.getAttribute("data-step"), String(step));
      assert.deepEqual(r.tags(), [], "nothing is counted again");
      await r.stop();
    }
  });

  await t.test("a subtree summary already open when step 6 shows: the step is done", async () => {
    const r = await boot({ path, page: "destination", placement: "floating", stored: AT(6), panelOpen: true });
    assert.equal(r.callout()?.getAttribute("data-step"), "7");
    assert.deepEqual(r.tags(), ["tour_step:7"]);
    await r.stop();
  });

  await t.test("a state at 5 does nothing on a page that is not the citation's", async () => {
    const r = await boot({ path: `/regulations/7/preview?p=sec-7-B-I-D-3&tour=1`, page: "destination", placement: "floating", stored: AT(5) });
    assert.equal(r.callout(), null);
    assert.deepEqual(r.tags(), []);
    assert.equal(r.stored().step, 5);
    await r.stop();
  });

  await t.test("Restart sends the visitor to the top of GP05 (step 1) without a second tour_start", async () => {
    const r = await boot({ path, page: "destination", placement: "floating", stored: AT(6) });
    r.messages.length = 0;
    await r.click(r.$('[data-testid="tour-restart"]'));
    assert.equal(r.stored().step, 1);
    assert.equal(r.stored().done, false);
    assert.deepEqual(r.stored().reported, [1, 2, 3, 4, 5, 6], "the counted steps are kept");
    assert.ok(r.messages.some((m) => /navigation/i.test(m)), "it loads /regulations/gp05?tour=1");
    assert.deepEqual(r.tags(), []);
    await r.stop();
  });
});
