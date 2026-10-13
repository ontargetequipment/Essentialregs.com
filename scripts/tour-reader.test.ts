/**
 * The guided GP05 walkthrough on the real RegulationReader and ReaderTour
 * under React in jsdom (Sprint 7; v3 on 13 Oct 2026): what moves each step
 * on, with a reader shaped like GP05 -- VI.C (with the Regulation 7 I.C.1
 * link) and VI.D (with a summary and text that ends in the word "sampling",
 * past the first 90 characters) -- and a Regulation 7 shaped like the two
 * hops: I.C.1 with I.C.1.c's "Sections I.D." reference, and I.D.
 *
 *   - the introduction (step 0) moves on with Start;
 *   - step 1 moves on only when VI.D is reached through the jump box (a click
 *     on its match, or Enter on it): a typed hash, a sidebar link and
 *     Back/Forward to VI.D leave it where it is, and so does a landing on VI.D
 *     that comes after a different match was opened; the match row gets the
 *     spotlight while the results are open;
 *   - steps 2-4 move on as before; step 5's click is taken, not the reader's
 *     popup, and does not move the step (the destination page does);
 *   - Restart and Skip tell the reader to forget its trail;
 *   - a tour already at step 9 shows the closing card when the reader is at
 *     VI.C, step 5 when it is not, and counts tour_complete once; the closing
 *     card's "Explore GP05 yourself" ends the tour in place;
 *   - the destination pages (steps 6-9) move from 5 to 6 on arrival, to 7 when
 *     any summary of the cited provision's subtree opens, to 8 on arrival at
 *     I.D (the second hop), to 9 on arrival back at I.C.1, and a subscriber's
 *     last way back is taken to add ?tour=1.
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
  row("sec-gp05-VI-D", "VI.D.", "sec-gp05-VI", "<p>At the frequency specified in Table 2, the owner or operator of storage tanks utilizing site-specific emission factors must complete site-specific sampling.</p>", {
    ai_summary: "Sampling happens at the frequency in Table 2.",
    summary_status: "approved",
  }),
  row("sec-gp05-VII", "VII.", ROOT, "<p>Records</p>"),
])!;

/** A subscriber's Regulation 7 reader, with the cited provision's subtree and the second hop. */
const IC1 = "sec-7-B-I-C-1";
const ID = "sec-7-B-I-D";
const reg7 = renderReaderBody([
  row("sec-7-top-REG-7", "Code of Colorado Regulations · Regulation Number 7", null, "<p>Regulation Number 7</p>"),
  row("sec-7-B-I-C", "I.C.", "sec-7-top-REG-7", "<p>Parent</p>"),
  row(IC1, "I.C.1.", "sec-7-B-I-C", "<p>I.C.1. General Requirements</p>"),
  row(`${IC1}-a`, "I.C.1.a.", IC1, "<p>Opacity.</p>", { ai_summary: "Limits opacity.", summary_status: "approved" }),
  row(`${IC1}-b`, "I.C.1.b.", IC1, "<p>Records.</p>", { ai_summary: "Keep records.", summary_status: "approved" }),
  row(
    `${IC1}-c`,
    "I.C.1.c.",
    IC1,
    '<p>All air pollution control equipment used to demonstrate compliance with <span class="xref" data-target="sec-7-B-I-D">Sections I.D.</span>, ' +
      '<span class="xref" data-target="sec-7-B-I-J">I.J.</span>, and <span class="xref" data-target="sec-7-B-I-K">I.K.</span> must meet a control efficiency of at least 95%.</p>'
  ),
  row("sec-7-B-I-C-2", "I.C.2.", "sec-7-B-I-C", "<p>Other.</p>", { ai_summary: "Other.", summary_status: "approved" }),
  row(ID, "I.D.", "sec-7-top-REG-7", "<p>I.D. Storage Tank Emission Controls</p>"),
  row(`${ID}-4`, "I.D.4.", ID, "<p>Alternative emissions control equipment.</p>", { ai_summary: "Alternatives.", summary_status: "approved" }),
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

/**
 * The visitor preview's markup (the focused provision's block): the way back
 * and the public subtree. "ic1": the I.C.1 preview, from GP05 VI.C, with
 * I.C.1.c's link to the I.D preview (preview-subtree.ts rewrites the span
 * into it, with from= and tour=1). "id": the I.D preview, from I.C.1.
 */
function previewShell(kind: "ic1" | "id", panelOpen = false): string {
  const open = panelOpen ? " open" : "";
  if (kind === "id") {
    return `<!doctype html><html><body>
  <div id="reader-root"></div>
  <div class="focused">
    <a id="preview-return" data-testid="preview-return" href="/regulations/7/preview?p=${IC1}&tour=1">← Back to Regulation 7 · I.C.1</a>
    <div id="preview-doc" data-testid="preview-subtree">
      <div id="${ID}" class="item depth-3" data-citation="I.D."><p>I.D. Storage Tank Emission Controls</p></div>
      <div id="${ID}-4" class="item depth-4" data-citation="I.D.4."><p>Alternative emissions control equipment.</p>
        <details class="summary-panel"><summary>Plain-English summary</summary><div class="summary-body"><p>Alternatives.</p></div></details></div>
    </div>
  </div></body></html>`;
  }
  return `<!doctype html><html><body>
  <div id="reader-root"></div>
  <div class="focused">
    <a id="preview-return" data-testid="preview-return" href="/regulations/gp05?tour=1#sec-gp05-VI-C">← Back to GP05 · VI.C</a>
    <div id="preview-doc" data-testid="preview-subtree">
      <div id="${IC1}" class="item depth-3" data-citation="I.C.1."><p>I.C.1. General Requirements</p></div>
      <div id="${IC1}-a" class="item depth-4" data-citation="I.C.1.a."><p>Opacity.</p>
        <details class="summary-panel"${open}><summary>Plain-English summary</summary><div class="summary-body"><p>Limits opacity.</p></div></details></div>
      <div id="${IC1}-c" class="item depth-4" data-citation="I.C.1.c."><p>Comply with <a class="xref" href="/regulations/7/preview?p=${ID}&from=${IC1}&tour=1">Sections I.D.</a>, <a class="xref" href="/regulations/7/preview?p=sec-7-B-I-J&from=${IC1}&tour=1">I.J.</a>, and <a class="xref" href="/regulations/7/preview?p=sec-7-B-I-K&from=${IC1}&tour=1">I.K.</a></p></div>
      <div id="${IC1}-e-(iii)" class="item depth-5" data-citation="I.C.1.e.(iii)"><p>Pending.</p></div>
    </div>
  </div></body></html>`;
}

async function boot(opts: {
  path: string;
  /** The visitor preview to show, and whether its first summary is open from the start. */
  shell?: "ic1" | "id";
  panelOpen?: boolean;
  /** The window's width, and the right edge of the preview's text column (jsdom has no layout). */
  viewportWidth?: number;
  columnRight?: number;
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
  const viewport = { width: opts.viewportWidth ?? 1280, columnRight: opts.columnRight ?? 1000 };
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => messages.push(e.message));
  const dom = new JSDOM(opts.body ? pageHtml(opts.body, opts.extra) : previewShell(opts.shell ?? "ic1", opts.panelOpen), {
    url: `http://localhost${opts.path}`,
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;
  Object.defineProperty(window.document.documentElement, "clientWidth", { get: () => viewport.width, configurable: true });
  const column = window.document.getElementById("preview-doc");
  if (column) column.getBoundingClientRect = () => ({ right: viewport.columnRight, left: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
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
    // The jump box's text matches (/api/reader-search): the word "sampling" is in VI.D, past the first 90 characters.
    if (String(url).startsWith("/api/reader-search")) {
      const q = new URL(String(url), "http://localhost").searchParams.get("q") ?? "";
      const results = /sampl/i.test(q)
        ? [{ id: "sec-gp05-VI-D", citation: "VI.D.", headline: "must complete site-specific <mark>sampling</mark>." }]
        : [];
      return { ok: true, status: 200, json: async () => ({ results }) };
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
  const step = () => callout()?.getAttribute("data-step");
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
  return { window, document, $, click, keydown, type, callout, step, stored, tags, settle, stop, messages, scrolls, act, sleep, viewport };
}

const GP05_PATH = "/regulations/gp05?tour=1";
/** The jump box asks the server ~150 ms after the last keystroke; wait that and the answer. */
const JUMP_WAIT = 260;
const rowIn = (document: Document, id: string) => document.querySelector<HTMLElement>(`#doc > [id="${id}"]`)!;
const START = ["tour_start:1", "tour_step:1"];

test("the introduction, then step 1 only through the jump box; steps 2-4 move as the visitor acts; step 5 is taken, and moves nothing", async (t) => {
  const r = await boot({ path: GP05_PATH, body: gp05, page: "reader" });
  const { window, document, $, click, keydown, type, callout, step, stored, tags, settle } = r;

  await t.test("a fresh tour counts its start; the introduction points at the jump box and has a Start button", () => {
    assert.equal(step(), "0");
    assert.equal($('[data-testid="tour-count"]').textContent, "Guided walkthrough");
    assert.match($('[data-testid="tour-callout"]').textContent ?? "", /^Guided walkthroughSkip tourYou're inside GP05, the General Permit/);
    assert.equal(stored().v, 3);
    assert.equal(stored().step, 0);
    assert.deepEqual(tags(), START);
    assert.equal($("#jumpbox").getAttribute("data-tour-target"), "0");
    assert.equal($('[data-testid="tour-start"]').textContent, "Start");
    assert.ok($('[data-testid="tour-start"]').className.includes("bg-accent"), "the green button");
  });

  await t.test("Start: step 1, counted with the introduction (no new event), the spotlight on the jump box", async () => {
    await click($('[data-testid="tour-start"]'));
    assert.equal(step(), "1");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 1 of 9");
    assert.deepEqual(tags(), START);
    assert.equal($("#jumpbox").getAttribute("data-tour-target"), "1");
    assert.equal(document.activeElement, $("#jumpbox"));
    assert.match($('[data-testid="tour-callout"]').textContent ?? "", /Type sampling in the box\. One match comes up/);
  });

  await t.test("a typed hash, a sidebar link and Back/Forward to VI.D do not move it", async () => {
    window.location.hash = "#sec-gp05-VI-D";
    await settle();
    assert.equal(step(), "1", "a typed hash");
    await click($('#sidebar a.nav-link[href="#sec-gp05-VI-D"]'));
    assert.equal(document.activeElement, rowIn(document, "sec-gp05-VI-D"), "the reader landed on it and focused it");
    assert.equal(step(), "1", "a sidebar link");
    const popped = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history.back();
    await popped;
    await settle();
    assert.equal(step(), "1", "Back");
    const forward = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
    window.history.forward();
    await forward;
    await settle();
    assert.equal(window.location.hash, "#sec-gp05-VI-D");
    assert.equal(step(), "1", "Forward onto VI.D");
    assert.deepEqual(tags(), START);
  });

  await t.test("sampling typed but nothing picked: still step 1; the match for VI.D is offered, with the spotlight on it", async () => {
    await type("sampling");
    await settle(JUMP_WAIT);
    const match = $('#jump-results .jr-item[data-slug="sec-gp05-VI-D"]');
    await settle(60);
    assert.equal(step(), "1");
    assert.equal(match.getAttribute("data-tour-target"), "1", "the one match is spotlit while the list is open");
    assert.equal($("#jumpbox").getAttribute("data-tour-target"), "1", "and the box still is");
  });

  await t.test("Enter on the VI.D match moves it to step 2; the spotlight moves to the row", async () => {
    const input = $("#jumpbox");
    // ArrowDown to VI.D, then Enter.
    const options = () => Array.from(document.querySelectorAll<HTMLElement>('#jump-results [role="option"]'));
    for (let i = 0; i < options().length && options().find((o) => o.dataset.slug === "sec-gp05-VI-D")?.getAttribute("aria-selected") !== "true"; i++) {
      await keydown(input, "ArrowDown");
    }
    await keydown(input, "Enter");
    await settle();
    assert.equal(step(), "2");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 2 of 9");
    assert.deepEqual(tags(), [...START, "tour_step:2"]);
    assert.equal(rowIn(document, "sec-gp05-VI-D").getAttribute("data-tour-target"), "2");
    assert.equal($("#jumpbox").hasAttribute("data-tour-target"), false, "the spotlight left the box");
    assert.equal(document.querySelectorAll("[data-tour-target]").length, 1, "one spotlight at a time");
  });

  await t.test("step 2 -> Next -> 3; opening VI.D's summary -> 4 (the official-text line is there)", async () => {
    await click($('[data-testid="tour-next"]'));
    assert.equal(step(), "3");
    const panel = rowIn(document, "sec-gp05-VI-D").querySelector<HTMLDetailsElement>(":scope > details.summary-panel")!;
    assert.equal(panel.querySelector(":scope > summary")?.getAttribute("data-tour-target"), "3");
    await r.act(async () => {
      panel.open = true;
      await r.sleep(20);
    });
    assert.equal(step(), "4");
    assert.equal($('[data-testid="tour-official-controls"]').textContent, "The official text controls; the summary is a reading aid.");
    assert.equal($("#jumpbox").getAttribute("data-tour-target"), "4", "step 4's action is in the jump box, so it is the spotlight");
    assert.equal(panel.hasAttribute("data-tour-target"), false, "the open summary is beside the card, not lit");
  });

  await t.test("step 4 -> 5 when the reader lands on VI.C, however it got there", async () => {
    await type("VI.C");
    await keydown($("#jumpbox"), "Enter");
    await settle();
    assert.equal(step(), "5");
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
    assert.equal(step(), "5");
    assert.equal(stored().step, 5);
    // A click with a modifier is left to the browser (a new tab), as ever.
    const other = await click(link, { ctrlKey: true });
    assert.equal(other.defaultPrevented, false);
  });

  await t.test("Restart: the introduction, the summary closed, the hash gone, and the reader's Back bar gone with it; no second tour_start", async () => {
    assert.equal($("#return-trail").hidden, false, "the jumps left a Back bar");
    await click($('[data-testid="tour-restart"]'));
    assert.equal(step(), "0");
    assert.equal($("#return-trail").hidden, true);
    assert.equal(window.location.hash, "");
    assert.equal(rowIn(document, "sec-gp05-VI-D").querySelector<HTMLDetailsElement>(":scope > details.summary-panel")!.open, false);
    assert.equal(tags().filter((x) => x === "tour_start:1").length, 1);
    assert.deepEqual(tags(), [...START, "tour_step:2", "tour_step:3", "tour_step:4", "tour_step:5"]);
    await click($('[data-testid="tour-start"]'));
    assert.equal(step(), "1");
    assert.equal(document.activeElement, $("#jumpbox"));
  });

  await t.test("a different match opened by Enter uses the arming up: a sidebar click on VI.D right after does not count", async () => {
    await type("VI.C");
    await keydown($("#jumpbox"), "Enter"); // lands on VI.C, not VI.D
    await settle();
    assert.equal(step(), "1");
    await click($('#sidebar a.nav-link[href="#sec-gp05-VI-D"]'));
    await settle();
    assert.equal(step(), "1");
  });

  await t.test("a click on the VI.D match moves it on (the pointer path)", async () => {
    await type("sampling");
    await settle(JUMP_WAIT);
    await click($('#jump-results .jr-item[data-slug="sec-gp05-VI-D"]'));
    await settle();
    assert.equal(step(), "2");
  });

  await t.test("Skip clears the tour, the reader's trail and the spotlight, drops ?tour=1 and does not reload", async () => {
    assert.equal($("#return-trail").hidden, false);
    await click($('[data-testid="tour-skip"]'));
    assert.equal(callout(), null);
    assert.equal(window.sessionStorage.getItem("er:tour"), null);
    assert.equal(window.location.search, "");
    assert.equal($("#return-trail").hidden, true);
    assert.equal(document.querySelectorAll("[data-tour-target]").length, 0);
    assert.ok(tags().includes("tour_skip:2"), `the step shown was counted: ${tags().join(",")}`);
  });

  await r.stop();
});

const SID = "test-0000-0000-0000";
const AT = (step: number, extra: Record<string, unknown> = {}) => ({
  v: 3,
  step,
  done: false,
  completed: false,
  sid: SID,
  reported: Array.from({ length: step + 1 }, (_, i) => i),
  ...extra,
});

test("a tour at step 9 shows the closing card at VI.C (and step 5 elsewhere); the completion is counted once; Explore ends it in place", async (t) => {
  const stored = AT(9);

  await t.test("arrived back at VI.C: the closing card, tour_complete:7 once, the spotlight on its button", async () => {
    const r = await boot({ path: `/regulations/gp05?tour=1#sec-gp05-VI-C`, body: gp05, page: "reader", stored });
    assert.equal(r.step(), "closing");
    assert.equal(r.$('[data-testid="tour-count"]').textContent, "Walkthrough complete");
    assert.match(r.$('[data-testid="tour-closing"]').textContent ?? "", /^You found a requirement without knowing its number.*followed its citations two documents deep and came back\. Every document in the library reads this way\.$/);
    const explore = r.$('[data-testid="tour-explore"]');
    assert.equal(explore.tagName, "BUTTON", "ends the tour where it is; no link away from VI.C");
    assert.equal(explore.textContent, "Explore GP05 yourself");
    assert.ok(explore.className.includes("bg-accent"), "the green button");
    assert.equal(explore.getAttribute("data-tour-target"), "closing", "the final button is the spotlight");
    assert.equal(r.$('[data-testid="tour-trial"]').getAttribute("href"), "/signup");
    assert.equal(r.$('[data-testid="tour-trial"]').className, "tour-secondary");
    assert.equal(r.$('[data-testid="tour-skip"]').textContent, "End tour");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);
    assert.equal(r.stored().done, true);
    assert.equal(r.$("#return-trail").hidden, true, "arriving draws no Back bar");

    // It stays wherever the reader goes afterwards; nothing is counted again.
    await r.click(r.$('#sidebar a.nav-link[href="#sec-gp05-VI-D"]'));
    assert.equal(r.step(), "closing");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);

    // Restart from it: the introduction, no Back bar (the jump above left one), nothing counted.
    assert.equal(r.$("#return-trail").hidden, false);
    await r.click(r.$('[data-testid="tour-restart"]'));
    assert.equal(r.step(), "0");
    assert.equal(r.stored().done, false);
    assert.equal(r.$("#return-trail").hidden, true);
    assert.equal(r.window.location.hash, "");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);
    await r.stop();
  });

  await t.test("Explore GP05 yourself: the tour is over, ?tour=1 is gone, the hash and the page stay, the spotlight goes", async () => {
    const r = await boot({ path: `/regulations/gp05?tour=1#sec-gp05-VI-C`, body: gp05, page: "reader", stored });
    assert.equal(r.step(), "closing");
    r.messages.length = 0;
    await r.click(r.$('[data-testid="tour-explore"]'));
    assert.equal(r.callout(), null);
    assert.equal(r.window.sessionStorage.getItem("er:tour"), null);
    assert.equal(r.window.location.search, "");
    assert.equal(r.window.location.hash, "#sec-gp05-VI-C");
    assert.equal(r.window.location.pathname, "/regulations/gp05");
    assert.equal(r.document.querySelectorAll("[data-tour-target]").length, 0);
    assert.ok(!r.messages.some((m) => /navigation/i.test(m)), "no page load");
    assert.deepEqual(r.tags(), ["tour_complete:7"], "Explore is not a skip");
    await r.stop();
  });

  await t.test("not at VI.C: step 5 again; landing on VI.C then completes it", async () => {
    const r = await boot({ path: GP05_PATH, body: gp05, page: "reader", stored });
    assert.equal(r.step(), "5");
    assert.deepEqual(r.tags(), []);
    await r.type("VI.C");
    await r.keydown(r.$("#jumpbox"), "Enter");
    await r.settle();
    assert.equal(r.step(), "closing");
    assert.deepEqual(r.tags(), ["tour_complete:7"]);
    await r.stop();
  });

  await t.test("a run that was already counted as complete is not counted again", async () => {
    const r = await boot({ path: `/regulations/gp05?tour=1#sec-gp05-VI-C`, body: gp05, page: "reader", stored: { ...stored, completed: true } });
    assert.equal(r.step(), "closing");
    assert.deepEqual(r.tags(), []);
    await r.stop();
  });

  await t.test("a stored v2 state (seven steps) is ignored: a fresh run starts at the introduction", async () => {
    const r = await boot({
      path: GP05_PATH,
      body: gp05,
      page: "reader",
      stored: { v: 2, step: 4, done: false, completed: false, sid: SID, reported: [1, 2, 3, 4] },
    });
    assert.equal(r.step(), "0");
    assert.deepEqual(r.tags(), START);
    await r.stop();
  });

  await t.test("a tour at step 6, 7 or 8 shows step 5 in the reader (Back from a destination page)", async () => {
    for (const step of [6, 7, 8]) {
      const r = await boot({ path: GP05_PATH, body: gp05, page: "reader", stored: AT(step) });
      assert.equal(r.step(), "5", `step ${step}`);
      assert.deepEqual(r.tags(), []);
      await r.stop();
    }
  });
});

const panelOf = (document: Document, scope: string, id: string) =>
  document.querySelector<HTMLDetailsElement>(`${scope} > [id="${id}"] > details.summary-panel`)!;

test("a subscriber's Regulation 7 reader: 5 -> 6 on arrival, 6 -> 7 on a subtree summary, 7 -> 8 at I.D through the popup, 8 -> 9 back at I.C.1.c, and the reader's own way home keeps the tour on", async (t) => {
  const r = await boot({
    path: `/regulations/7?from=sec-gp05-VI-C&tour=1#${IC1}`,
    body: reg7,
    page: "destination",
    hasAccess: true,
    stored: AT(5),
  });
  const { window, document, $, click, callout, step, stored, tags, settle, act, sleep } = r;

  await t.test("arrival moves the step on; the reader's bar is the way back; the anchor is I.C.1.a's summary control", () => {
    // The reader took ?from= off the URL and drew its bar.
    assert.equal(window.location.search, "?tour=1");
    assert.equal($("#return-trail-ext").textContent, "← Back to GP05 · VI.C");
    assert.equal($("#return-trail-ext").getAttribute("href"), "/regulations/gp05#sec-gp05-VI-C");
    assert.equal(step(), "6");
    assert.equal(callout()?.getAttribute("data-mode"), "anchored");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 6 of 9");
    assert.deepEqual(tags(), ["tour_step:6"]);
    assert.equal(panelOf(document, "#doc", `${IC1}-a`).querySelector(":scope > summary")?.getAttribute("data-tour-target"), "6");
  });

  await t.test("a summary outside the cited provision's subtree does not move it; any inside does (here I.C.1.b); step 7 spotlights I.C.1.c's \"Sections I.D.\"", async () => {
    await act(async () => {
      panelOf(document, "#doc", "sec-7-B-I-C-2").open = true;
      await sleep(20);
    });
    assert.equal(step(), "6", "I.C.2 is not under I.C.1");
    await act(async () => {
      panelOf(document, "#doc", `${IC1}-b`).open = true;
      await sleep(20);
    });
    assert.equal(step(), "7");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 7 of 9");
    assert.deepEqual(tags(), ["tour_step:6", "tour_step:7"]);
    const span = $(`#doc > [id="${IC1}-c"] span.xref[data-target="${ID}"]`);
    assert.equal(span.textContent, "Sections I.D.");
    assert.equal(span.getAttribute("data-tour-target"), "7", "the second hop's reference is the spotlight");
    assert.equal(document.querySelectorAll('#doc [data-tour-target]').length, 1, "not I.J. or I.K.");
    assert.match(callout()?.textContent ?? "", /then Go to full section in the preview/, "a subscriber's hint names the popup's link");
  });

  await t.test("the reference opens the reader's popup; Go to full section lands on I.D, which is step 8 (counted as 7 already); the in-document bar is the anchor", async () => {
    await click($(`#doc > [id="${IC1}-c"] span.xref[data-target="${ID}"]`));
    assert.equal($("#backdrop").classList.contains("show"), true, "the reader's popup, as outside the tour");
    assert.equal($("#popup-title").textContent, "I.D.");
    assert.equal(step(), "7", "the popup is not the arrival");
    await click($("#popup-goto"));
    await settle();
    assert.equal(window.location.hash, `#${ID}`);
    assert.equal(document.activeElement, document.querySelector(`#doc > [id="${ID}"]`));
    assert.equal(step(), "8");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 8 of 9");
    assert.deepEqual(tags(), ["tour_step:6", "tour_step:7"], "8 counts as 7, already sent");
    assert.equal($("#return-trail").hidden, false);
    assert.equal(($("#return-trail-back") as HTMLElement).hidden, false);
    assert.equal($("#return-trail-label").textContent, "I.C.1.c.");
    assert.equal($("#return-trail-back").getAttribute("data-tour-target"), "8", "the reader's in-document bar is step 8's anchor");
    assert.equal(($("#return-trail-ext") as HTMLElement).hidden, true);
  });

  await t.test("Back lands on I.C.1.c, which is step 9; the bar to GP05 is the anchor", async () => {
    await click($("#return-trail-back"));
    await settle();
    assert.equal(window.location.hash, `#${IC1}-c`);
    assert.equal(step(), "9");
    assert.equal($('[data-testid="tour-count"]').textContent, "Step 9 of 9");
    assert.deepEqual(tags(), ["tour_step:6", "tour_step:7"]);
    assert.equal(($("#return-trail-ext") as HTMLElement).hidden, false);
    assert.equal($("#return-trail-ext").getAttribute("data-tour-target"), "9", "the reader's bar to GP05 is step 9's anchor");
    assert.equal(($("#return-trail-back") as HTMLElement).hidden, true);
  });

  await t.test("the way home is taken (the tour adds ?tour=1 and loads it); a modified click is left alone", async () => {
    const link = $("#return-trail-ext");
    const ctrl = await click(link, { ctrlKey: true });
    assert.equal(ctrl.defaultPrevented, false);
    r.messages.length = 0;
    const ev = await click(link);
    assert.equal(ev.defaultPrevented, true);
    assert.ok(r.messages.some((m) => /navigation/i.test(m)), "it loads a page (jsdom has no navigation to do it with)");
    assert.equal(step(), "9", "the step moves on at VI.C, not here");
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

test("the visitor's focused previews (floating): 5 -> 6 on arrival at I.C.1, 6 -> 7 on a subtree summary, 7 -> 8 on arrival at I.D, 8 -> 9 back at I.C.1; the preview's own bar is the way back", async (t) => {
  const ic1Path = `/regulations/7/preview?p=${IC1}&from=sec-gp05-VI-C&tour=1`;
  const idPath = `/regulations/7/preview?p=${ID}&from=${IC1}&tour=1`;

  await t.test("arrival at I.C.1, the anchors, and counting; the second hop's link is left to the browser", async () => {
    const r = await boot({ path: ic1Path, page: "destination", placement: "floating", stored: AT(5) });
    assert.equal(r.step(), "6");
    assert.equal(r.callout()?.getAttribute("data-mode"), "floating");
    assert.deepEqual(r.tags(), ["tour_step:6"]);
    const aPanel = panelOf(r.document, "#preview-doc", `${IC1}-a`);
    assert.equal(aPanel.querySelector(":scope > summary")?.getAttribute("data-tour-target"), "6");
    await r.act(async () => {
      aPanel.open = true;
      await r.sleep(20);
    });
    assert.equal(r.step(), "7");
    assert.equal(r.$('[data-testid="tour-count"]').textContent, "Step 7 of 9");
    assert.deepEqual(r.tags(), ["tour_step:6", "tour_step:7"]);
    const link = r.$(`#preview-doc > [id="${IC1}-c"] a.xref[href^="/regulations/7/preview?p=${ID}"]`);
    assert.equal(link.textContent, "Sections I.D.");
    assert.equal(link.getAttribute("data-tour-target"), "7");
    assert.equal(r.document.querySelectorAll("#preview-doc [data-tour-target]").length, 1, "not I.J. or I.K.");
    assert.match(r.callout()?.textContent ?? "", /Follow this one too\./);
    assert.doesNotMatch(r.callout()?.textContent ?? "", /Go to full section/);
    // The link already carries from= and tour=1: the tour leaves its click alone.
    r.messages.length = 0;
    const ev = await r.click(link);
    assert.equal(ev.defaultPrevented, false);
    assert.equal(r.step(), "7", "the arrival on the I.D page moves it, not the click");
    await r.stop();
  });

  await t.test("arrival at I.D with a tour at 7: step 8, the way back (to I.C.1) is the anchor; at 5 or 6 the page is not the citation's", async () => {
    const r = await boot({ path: idPath, shell: "id", page: "destination", placement: "floating", stored: AT(7) });
    assert.equal(r.step(), "8");
    assert.equal(r.$('[data-testid="tour-count"]').textContent, "Step 8 of 9");
    assert.deepEqual(r.tags(), [], "8 counts as 7, already sent");
    assert.equal(r.$("#preview-return").getAttribute("data-tour-target"), "8");
    assert.equal(r.$("#preview-return").textContent, "← Back to Regulation 7 · I.C.1");
    assert.match(r.callout()?.textContent ?? "", /Click Back to Regulation 7 I\.C\.1\./);
    assert.match(r.callout()?.textContent ?? "", /The bar remembers every hop you made/);
    // The preview's link already carries the tour: left alone.
    r.messages.length = 0;
    const ev = await r.click(r.$("#preview-return"));
    assert.equal(ev.defaultPrevented, false);
    await r.stop();
    for (const step of [5, 6]) {
      const s = await boot({ path: idPath, shell: "id", page: "destination", placement: "floating", stored: AT(step) });
      assert.equal(s.stored().step, step, `a state at ${step} does not move on the second hop's page`);
      assert.deepEqual(s.tags(), []);
      await s.stop();
    }
  });

  await t.test("arrival back at I.C.1 with a tour at 8: step 9, the way back (to GP05) is the anchor", async () => {
    const r = await boot({ path: ic1Path, page: "destination", placement: "floating", stored: AT(8) });
    assert.equal(r.step(), "9");
    assert.equal(r.$('[data-testid="tour-count"]').textContent, "Step 9 of 9");
    assert.deepEqual(r.tags(), []);
    assert.equal(r.$("#preview-return").getAttribute("data-tour-target"), "9");
    assert.match(r.callout()?.textContent ?? "", /Click Back to GP05 VI\.C\./);
    await r.stop();
  });

  await t.test("a reload resumes at 6, 7 (on I.C.1), 8 (on I.D) and 9 (on I.C.1)", async () => {
    for (const [step, path, shell] of [[6, ic1Path, "ic1"], [7, ic1Path, "ic1"], [8, idPath, "id"], [9, ic1Path, "ic1"]] as const) {
      const r = await boot({ path, shell, page: "destination", placement: "floating", stored: AT(step) });
      assert.equal(r.step(), String(step));
      assert.deepEqual(r.tags(), [], "nothing is counted again");
      await r.stop();
    }
  });

  await t.test("a subtree summary already open when step 6 shows: the step is done", async () => {
    const r = await boot({ path: ic1Path, page: "destination", placement: "floating", stored: AT(6), panelOpen: true });
    assert.equal(r.step(), "7");
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

  await t.test("the card is in the gutter beside the text column (its width set), and docks when the gutter is too narrow, again on every resize", async () => {
    const r = await boot({ path: ic1Path, page: "destination", placement: "floating", stored: AT(6), viewportWidth: 1280, columnRight: 1000 });
    assert.equal(r.callout()?.getAttribute("data-mode"), "floating");
    assert.equal(r.callout()?.style.width, "256px", "a 280px gutter less 12px each side");
    assert.equal(r.callout()?.getAttribute("data-placement"), "top-right");
    // A narrower window: the same column's gutter shrinks to 190px.
    await r.act(async () => {
      r.viewport.width = 1100;
      r.viewport.columnRight = 910;
      r.window.dispatchEvent(new r.window.Event("resize"));
      await r.sleep(20);
    });
    assert.equal(r.callout()?.getAttribute("data-mode"), "docked");
    assert.equal(r.window.document.documentElement.hasAttribute("data-tour-docked"), true, "the page gets room at the bottom");
    // And back.
    await r.act(async () => {
      r.viewport.width = 1440;
      r.viewport.columnRight = 1080;
      r.window.dispatchEvent(new r.window.Event("resize"));
      await r.sleep(20);
    });
    assert.equal(r.callout()?.getAttribute("data-mode"), "floating");
    assert.equal(r.callout()?.style.width, "296px", "a wide gutter: the usual width");
    assert.equal(r.window.document.documentElement.hasAttribute("data-tour-docked"), false);
    await r.stop();
  });

  await t.test("opened in a window too narrow for the card in the gutter, it docks at once", async () => {
    const r = await boot({ path: ic1Path, page: "destination", placement: "floating", stored: AT(6), viewportWidth: 1100, columnRight: 910 });
    assert.equal(r.callout()?.getAttribute("data-mode"), "docked");
    await r.stop();
  });

  await t.test("Restart sends the visitor to the top of GP05 (the introduction) without a second tour_start, and empties the preview's trail", async () => {
    const r = await boot({ path: idPath, shell: "id", page: "destination", placement: "floating", stored: AT(8) });
    r.window.sessionStorage.setItem("er:preview-trail", JSON.stringify([{ id: "sec-gp05-VI-C", href: "/regulations/gp05", label: "x" }]));
    r.messages.length = 0;
    await r.click(r.$('[data-testid="tour-restart"]'));
    assert.equal(r.stored().step, 0);
    assert.equal(r.stored().done, false);
    assert.deepEqual(r.stored().reported, [0, 1, 2, 3, 4, 5, 6, 7, 8], "the counted steps are kept");
    assert.ok(r.messages.some((m) => /navigation/i.test(m)), "it loads /regulations/gp05?tour=1");
    assert.deepEqual(r.tags(), []);
    assert.equal(r.window.sessionStorage.getItem("er:preview-trail"), null);
    await r.stop();
  });
});
