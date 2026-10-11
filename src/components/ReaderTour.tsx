"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { READER_TRAIL_RESET_EVENT } from "@/lib/reader-nav";
import {
  TOUR_COPY,
  TOUR_EXPLORE_HREF,
  TOUR_JUMPS,
  TOUR_START_HREF,
  TOUR_STEP_COUNT,
  TOUR_STORAGE_KEY,
  TOUR_TRIAL_HREF,
  advanceTour,
  citationDestination,
  completeTour,
  destinationTarget,
  inCitedSubtree,
  isTourCitationLink,
  jumpTargetFor,
  linkTargetOf,
  parseTourState,
  pickSummaryRow,
  placeCallout,
  restartTour,
  searchWithoutTour,
  startTour,
  stepForPage,
  viewStep,
  withTourParam,
  type CalloutPlacement,
  type TourEventInput,
  type TourState,
  type TourStep,
  type TourView,
} from "@/lib/tour";
import "./reader-tour.css";

/**
 * The guided GP05 walkthrough (Sprint 6, 10 Oct 2026; v2 in Sprint 7, 11 Oct
 * 2026). See src/lib/tour.ts for the seven steps and the state; this is the
 * part that touches the page.
 *
 * It never drives the reader. RegulationReader stays exactly what a visitor
 * gets without the tour; this component only watches it -- a row taking
 * focus after a jump (goToProvision focuses the row it lands on, and its
 * pushState fires no hashchange), hashchange/popstate, the summary's
 * <details> toggle -- and moves on once the visitor has done the step. Three
 * things it does change:
 *
 *   - Step 1 counts only a landing on VI.D that came through the jump box (a
 *     click on a match, or Enter in the box): a sidebar link, a typed hash or
 *     Back/Forward to VI.D leaves the visitor on step 1. It arms on the click
 *     or the Enter (capture phase, ahead of the reader's own handlers) and
 *     waits a couple of seconds for the landing.
 *   - Step 5's click goes to the provision's destination page (the focused
 *     preview, or the Reg 7 reader for a subscriber) instead of the reader's
 *     in-place popup, because steps 6 and 7 live there. It calls
 *     preventDefault in the capture phase, which RegulationReader's own
 *     click handler already respects ("a click something else already
 *     handled"). The destination page, not the click, moves the step on.
 *   - Step 7 on a subscriber's Reg 7 reader takes the reader's own "Back to
 *     GP05" link the same way, adding ?tour=1 so GP05 knows the tour is on.
 *
 * Mounted by /regulations/[reg] when ?tour=1 (`page="reader"` on GP05,
 * `page="destination"` on any other regulation, where only a tour already
 * past step 5 shows) and by the focused preview (`placement="floating"`).
 *
 * Where the callout sits: on a phone (the reader's 860px breakpoint, where
 * the sidebar goes off-canvas) it docks to the bottom of the viewport and
 * the page gets that much room at the bottom -- GP05, the Reg 7 reader and
 * the preview alike. On a wider reader page it is fixed in the sidebar
 * column beside its anchor (placeCallout), or to the right of the text when
 * the window is wide enough: never over the provision text. The preview has
 * no sidebar: there ("floating") it is a card in the bottom-right corner and
 * the anchor is scrolled clear of it. No overlay, nothing dimmed.
 *
 * The callout is hidden until it is placed: each step first scrolls its
 * anchor into view (instantly, never a smooth scroll that would leave the
 * control off screen while the card is already up) and only then shows the
 * card, all before the browser paints.
 */

type TourPage = "reader" | "destination";
type Placement = "anchored" | "floating";

// ---------------------------------------------------------------------------
// The state store: sessionStorage behind useSyncExternalStore, so a reload
// resumes and the server render (which cannot know the step) shows nothing.
// Storage can be blocked; the tour then still runs, for this page only.
// ---------------------------------------------------------------------------

const stateListeners = new Set<() => void>();
let loaded = false;
let current: TourState | null = null;

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getState(): TourState | null {
  if (!loaded) {
    loaded = true;
    try {
      current = parseTourState(session()?.getItem(TOUR_STORAGE_KEY));
    } catch {
      current = null;
    }
  }
  return current;
}

function saveState(next: TourState | null): void {
  current = next;
  loaded = true;
  try {
    const s = session();
    if (next) s?.setItem(TOUR_STORAGE_KEY, JSON.stringify(next));
    else s?.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* blocked storage: the tour still runs in memory */
  }
  stateListeners.forEach((l) => l());
}

function subscribeState(listener: () => void) {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

const serverState = () => null;

// The reader's own breakpoint (reader.css): at 860px and below the sidebar is
// off-canvas and the callout docks to the bottom of the viewport.
const DOCK_QUERY = "(max-width: 860px)";

function subscribeDock(listener: () => void) {
  const mq = window.matchMedia(DOCK_QUERY);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
const isDocked = () => window.matchMedia(DOCK_QUERY).matches;
const serverDocked = () => false;

function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Counts one event (POST /api/tour-event). Fire and forget, keepalive so a
 * click that leaves the page is still counted. A browser driven by automation
 * (navigator.webdriver: the Playwright smoke suite) says so, and the route
 * stores nothing for it.
 */
function sendTourEvent(input: TourEventInput, sid: string): void {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (typeof navigator !== "undefined" && navigator.webdriver) headers["x-tour-automated"] = "1";
    void fetch("/api/tour-event", {
      method: "POST",
      keepalive: true,
      headers,
      body: JSON.stringify({ ...input, sid }),
    }).catch(() => {});
  } catch {
    /* counting never breaks the tour */
  }
}

/** Saves a state change and counts its events, unless it changes nothing. */
function apply(prev: TourState, next: { state: TourState; events: TourEventInput[] }): void {
  if (!next.events.length && next.state.step === prev.step && next.state.done === prev.done) return;
  saveState(next.state);
  for (const e of next.events) sendTourEvent(e, next.state.sid);
}

function commit(to: TourStep): void {
  const state = getState();
  if (state) apply(state, advanceTour(state, to));
}

/** Arrival back at VI.C after step 7: the closing card, and tour_complete. */
function finish(): void {
  const state = getState();
  if (state) apply(state, completeTour(state));
}

/** Tells the reader to forget its return trail (RegulationReader listens). */
function resetReaderTrail(): void {
  window.dispatchEvent(new Event(READER_TRAIL_RESET_EVENT));
}

// ---------------------------------------------------------------------------
// The page: rows, anchors
// ---------------------------------------------------------------------------

function docEl(): HTMLElement | null {
  return document.getElementById("doc");
}

/** The rows of a reader or of the preview's subtree: the container's direct children with an id. */
function childRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !!el.id);
}

/** The reader's rows in document order, as the jump box sees them (id + data-citation). */
function readerRows(doc: HTMLElement): { id: string; citation: string }[] {
  const rows: { id: string; citation: string }[] = [];
  for (const el of Array.from(doc.children)) {
    const citation = el.getAttribute("data-citation");
    if (el.id && citation !== null) rows.push({ id: el.id, citation });
  }
  return rows;
}

/** A row of `root` by id (never the popup's clone, which shares the id). */
function rowOf(root: HTMLElement, id: string | null): HTMLElement | null {
  if (!id) return null;
  for (const el of Array.from(root.children)) if (el.id === id) return el as HTMLElement;
  return null;
}

function summaryPanelOf(row: HTMLElement | null): HTMLDetailsElement | null {
  return (row?.querySelector(":scope > details.summary-panel") as HTMLDetailsElement | null) ?? null;
}

function summaryControlOf(row: HTMLElement | null): HTMLElement | null {
  return (summaryPanelOf(row)?.querySelector(":scope > summary") as HTMLElement | null) ?? null;
}

function citationLinkOf(row: HTMLElement | null): HTMLAnchorElement | null {
  if (!row) return null;
  for (const a of Array.from(row.querySelectorAll<HTMLAnchorElement>("a.xref-external-reg"))) {
    if (isTourCitationLink(a.getAttribute("href"), a.textContent)) return a;
  }
  return null;
}

function hashId(): string | null {
  const raw = window.location.hash.slice(1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** The container of the destination page's rows: the preview's subtree, or the Reg 7 reader's #doc. */
function destinationRoot(placement: Placement): HTMLElement | null {
  return document.getElementById(placement === "floating" ? "preview-doc" : "doc");
}

/** Whether the GP05 reader is at VI.C (the hash names the row the jump box resolves "VI.C" to). */
function readerAtVIC(): boolean {
  const doc = docEl();
  if (!doc) return false;
  const target = jumpTargetFor(TOUR_JUMPS.second, readerRows(doc));
  return !!target && hashId() === target;
}

/** The element a view's callout points at, or null. */
function anchorFor(view: TourView, page: TourPage, placement: Placement): HTMLElement | null {
  if (page === "destination") {
    // The way back: the focused preview's link, or the Reg 7 reader's own bar.
    if (view === 7) return document.getElementById("preview-return") ?? document.getElementById("return-trail-ext");
    if (view !== 6) return null;
    const root = destinationRoot(placement);
    const cited = destinationTarget(placement, window.location.search, window.location.hash);
    if (!root || !cited) return null;
    const rows = childRows(root).map((el) => ({ id: el.id, hasSummary: !!summaryPanelOf(el) }));
    return summaryControlOf(rowOf(root, pickSummaryRow(cited, rows)));
  }
  if (view === 1) return document.getElementById("jumpbox");
  const doc = docEl();
  if (!doc) return null;
  const rows = readerRows(doc);
  const first = rowOf(doc, jumpTargetFor(TOUR_JUMPS.first, rows));
  if (view === 2) return first;
  if (view === 3) return summaryControlOf(first);
  if (view === 4) return summaryPanelOf(first);
  if (view === 5) return citationLinkOf(rowOf(doc, jumpTargetFor(TOUR_JUMPS.second, rows)));
  if (view === "closing") return rowOf(doc, jumpTargetFor(TOUR_JUMPS.second, rows));
  return null;
}

/** The site header's height (layout.tsx: h-[66px], sticky). */
const HEADER_PX = 66;
/** Where the reader lands a row (scroll-margin-top in reader.css): under the header and the return bar. */
const LANDING_PX = 130;
/** The focused preview has no return bar: a little under the header. */
const FLOATING_LANDING_PX = 96;
/** The floating card's distance from the viewport's right and bottom edges (reader-tour.css). */
const FLOATING_MARGIN_PX = 16;
/** After the reader's own deep-link landing (RegulationReader: 50ms) has had its say. */
const SETTLE_MS = 150;

/**
 * Scrolls the anchor, instantly, into the part of the viewport the callout
 * leaves free -- only when it is not already there. `reserve` is the height
 * the callout takes at the bottom of the viewport (the dock, or the
 * floating card); `landing` is where the anchor's top is put.
 */
function bringIntoView(anchor: HTMLElement, reserve: number, landing: number): void {
  // The jump box (sticky, or behind Contents on a phone) and the return bar (sticky) never move.
  if (anchor.closest("#sidebar, #return-trail")) return;
  const rect = anchor.getBoundingClientRect();
  const bottom = window.innerHeight - reserve - 16;
  const fits = rect.top >= HEADER_PX + 8 && Math.min(rect.bottom, rect.top + 48) <= bottom;
  if (fits) return;
  const room = Math.max(0, bottom - landing - Math.min(rect.height, bottom - landing));
  window.scrollBy({ top: rect.top - (landing + room / 3), behavior: "auto" });
}

/** How long after Enter or a click on a match a landing on VI.D still counts as coming through the jump box. */
const JUMP_ARM_MS = 2000;

function plainLeftClick(e: MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export function ReaderTour({
  page,
  hasAccess,
  placement = "anchored",
}: {
  page: TourPage;
  /** A subscriber: step 5 opens the Reg 7 reader, steps 6-7 run there, and the closing card has no trial button. */
  hasAccess: boolean;
  /** "floating": the focused preview, which has no sidebar -- a card in the bottom-right corner instead of one beside its anchor. */
  placement?: Placement;
}) {
  const state = useSyncExternalStore(subscribeState, getState, serverState);
  const docked = useSyncExternalStore(subscribeDock, isDocked, serverDocked);
  // Back from the destination page: state 7 shows the closing card when the reader is at VI.C.
  const atVIC = page === "reader" && state !== null && state.step === TOUR_STEP_COUNT && !state.done && readerAtVIC();
  const view = stepForPage(state, page, atVIC);
  const storedStep = state?.step ?? null;
  const storedDone = state?.done ?? false;
  const boxRef = useRef<HTMLElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  // A fresh tour: GP05 with ?tour=1 and nothing stored. A stored state (a
  // reload, or Back from the destination page) resumes instead.
  useEffect(() => {
    if (page !== "reader" || getState()) return;
    const fresh = startTour(newSessionId());
    saveState(fresh.state);
    for (const e of fresh.events) sendTourEvent(e, fresh.state.sid);
  }, [page]);

  // Arrival on the destination page (steps 5 -> 6): the cited provision is on
  // the page -- in the preview's subtree, or in a subscriber's reader with the
  // hash on it. The click on the citation did not move the step.
  useEffect(() => {
    if (page !== "destination" || storedStep !== 5) return;
    const root = destinationRoot(placement);
    const cited = destinationTarget(placement, window.location.search, window.location.hash);
    if (root && cited && rowOf(root, cited)) commit(6);
  }, [page, placement, storedStep]);

  // Arrival back at VI.C after step 7 (steps 7 -> the closing card): by the
  // way-back link, by Back, or by any later landing on VI.C.
  useEffect(() => {
    if (page !== "reader" || storedStep !== TOUR_STEP_COUNT || storedDone) return;
    const doc = docEl();
    if (!doc) return;
    const target = jumpTargetFor(TOUR_JUMPS.second, readerRows(doc));
    if (!target) return;
    const check = () => {
      if (hashId() === target) finish();
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && el.parentElement === doc && el.id === target) check();
    };
    check();
    document.addEventListener("focusin", onFocus);
    window.addEventListener("hashchange", check);
    window.addEventListener("popstate", check);
    return () => {
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("hashchange", check);
      window.removeEventListener("popstate", check);
    };
  }, [page, storedStep, storedDone]);

  // What moves each step on. Everything here is the visitor's own action.
  useEffect(() => {
    if (view === null) return;

    if (page === "destination") {
      const root = destinationRoot(placement);
      if (!root) return;

      if (view === 6) {
        // Any summary panel of the cited provision's subtree. `toggle` does
        // not bubble, so it is heard in the capture phase.
        const cited = destinationTarget(placement, window.location.search, window.location.hash);
        if (!cited) return;
        const rowWithin = (el: Element): Element | null => {
          let node: Element | null = el;
          while (node && node.parentElement !== root) node = node.parentElement;
          return node;
        };
        const opened = (d: Element): boolean => {
          if (!(d instanceof HTMLDetailsElement) || !d.open || !d.classList.contains("summary-panel")) return false;
          const row = rowWithin(d);
          return !!row && inCitedSubtree(row.id, cited);
        };
        // Open already: the step is done.
        if (Array.from(root.querySelectorAll("details.summary-panel")).some(opened)) {
          commit(7);
          return;
        }
        const onToggle = (e: Event) => {
          if (e.target instanceof Element && opened(e.target)) commit(7);
        };
        root.addEventListener("toggle", onToggle, true);
        return () => root.removeEventListener("toggle", onToggle, true);
      }

      if (view === 7 && placement === "anchored") {
        // A subscriber's way back is the reader's own bar ("← Back to GP05 ·
        // VI.C", #return-trail-ext), whose href is the plain reader URL. The
        // tour takes the click in the capture phase and loads the same href
        // with ?tour=1 added, so GP05 knows the walkthrough is still on. (The
        // visitor's link, #preview-return, already carries it.)
        const onClick = (e: MouseEvent) => {
          if (!plainLeftClick(e)) return;
          const link = e.target instanceof Element ? e.target.closest("#return-trail-ext") : null;
          const href = link?.getAttribute("href");
          if (!link || !href) return;
          e.preventDefault();
          window.location.assign(withTourParam(href));
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
      }
      return;
    }

    const doc = docEl();
    if (!doc) return;

    if (view === 1) {
      // Only a landing on VI.D that came through the jump box. Armed by a
      // click on VI.D's match or by Enter in the box -- both heard in the
      // capture phase on the document, ahead of the reader's own handlers,
      // which land (and focus) the row inside the same event. A sidebar link,
      // a typed hash and Back/Forward arm nothing. Any landing in the
      // document uses the arming up, so a different match opened by Enter
      // cannot be followed by a sidebar click on VI.D within the window.
      const target = jumpTargetFor(TOUR_JUMPS.first, readerRows(doc));
      if (!target) return;
      let armedUntil = 0;
      const arm = () => {
        armedUntil = performance.now() + JUMP_ARM_MS;
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" && e.target instanceof Element && e.target.id === "jumpbox") arm();
      };
      const onMatch = (e: Event) => {
        const item = e.target instanceof Element ? e.target.closest("#jump-results .jr-item") : null;
        if (item instanceof HTMLElement && item.dataset.slug === target) arm();
      };
      const onFocus = (e: FocusEvent) => {
        const el = e.target;
        if (!(el instanceof HTMLElement) || el.parentElement !== doc) return;
        const armed = performance.now() <= armedUntil;
        armedUntil = 0;
        if (armed && el.id === target && hashId() === target) commit(2);
      };
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("pointerdown", onMatch, true);
      document.addEventListener("click", onMatch, true);
      document.addEventListener("focusin", onFocus);
      return () => {
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("pointerdown", onMatch, true);
        document.removeEventListener("click", onMatch, true);
        document.removeEventListener("focusin", onFocus);
      };
    }

    if (view === 4) {
      // The reader lands on VI.C by any means: the provision the jump box
      // resolves "VI.C" to (goToProvision pushes "#<id>" and then focuses the
      // row (focusin); a hash typed by hand or Back/Forward arrive as
      // hashchange/popstate).
      const target = jumpTargetFor(TOUR_JUMPS.second, readerRows(doc));
      if (!target) return;
      const onFocus = (e: FocusEvent) => {
        const el = e.target;
        if (el instanceof HTMLElement && el.parentElement === doc && el.id === target && hashId() === target) {
          commit(5);
        }
      };
      const onHash = () => {
        if (hashId() === target) commit(5);
      };
      document.addEventListener("focusin", onFocus);
      window.addEventListener("hashchange", onHash);
      window.addEventListener("popstate", onHash);
      return () => {
        document.removeEventListener("focusin", onFocus);
        window.removeEventListener("hashchange", onHash);
        window.removeEventListener("popstate", onHash);
      };
    }

    if (view === 3) {
      const panel = summaryPanelOf(rowOf(doc, jumpTargetFor(TOUR_JUMPS.first, readerRows(doc))));
      if (!panel) return;
      // Opened already (at step 2): the step is done.
      if (panel.open) {
        commit(4);
        return;
      }
      const onToggle = () => {
        if (panel.open) commit(4);
      };
      panel.addEventListener("toggle", onToggle);
      return () => panel.removeEventListener("toggle", onToggle);
    }

    if (view === 5) {
      // Capture phase, ahead of RegulationReader's document handler, which
      // leaves a click alone once it is defaultPrevented. A modified click
      // (new tab, new window) is left to the browser as always. The step
      // moves on when the destination page has loaded, not here.
      const onClick = (e: MouseEvent) => {
        if (!plainLeftClick(e)) return;
        const link = e.target instanceof Element ? e.target.closest("a.xref-external-reg") : null;
        if (!link || !isTourCitationLink(link.getAttribute("href"), link.textContent)) return;
        const id = linkTargetOf(link.getAttribute("href"));
        if (!id) return;
        // The row the link sits in (VI.C): the destination draws its way back to it.
        const from = link.closest("#doc > [id]")?.id ?? jumpTargetFor(TOUR_JUMPS.second, readerRows(doc));
        e.preventDefault();
        window.location.assign(citationDestination(id, hasAccess, from));
      };
      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }
  }, [page, placement, view, hasAccess]);

  // The anchor and the callout, before the browser paints: the callout is
  // hidden, the anchor marked for its ring and scrolled (instantly) into the
  // part of the viewport the callout leaves free, and only then is the
  // callout placed and shown -- so the control a step points at is on screen
  // the moment its card is. Then kept in place on scroll, resize and layout
  // changes (the summary opening, the jump results showing).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (view === null || !box) return;
    const root = document.documentElement;
    const floating = !docked && placement === "floating";
    let raf = 0;
    box.style.visibility = "hidden";

    // The anchor is looked up when the step starts and again once the page has
    // settled; a scroll in between (update runs on every one) reuses it, as
    // a lookup walks the reader's rows -- thousands of them in Regulation 7.
    let anchor: HTMLElement | null = null;
    const anchorNow = () => (anchor && anchor.isConnected ? anchor : (anchor = anchorFor(view, page, placement)));
    let marked: HTMLElement | null = null;
    const bringAnchorIntoView = () => {
      anchor = anchorFor(view, page, placement);
      if (!anchor) return;
      if (marked !== anchor) {
        marked?.removeAttribute("data-tour-target");
        anchor.setAttribute("data-tour-target", String(view));
        marked = anchor;
      }
      const height = box.getBoundingClientRect().height;
      if (docked) bringIntoView(anchor, height, LANDING_PX);
      else if (floating) bringIntoView(anchor, height + FLOATING_MARGIN_PX, FLOATING_LANDING_PX);
      else bringIntoView(anchor, 0, LANDING_PX);
    };

    const unposition = () => {
      box.style.top = box.style.left = box.style.width = box.style.visibility = "";
      if (arrowRef.current) arrowRef.current.hidden = true;
    };
    const update = () => {
      raf = 0;
      if (docked || floating) {
        box.removeAttribute("data-unanchored");
        unposition();
        const room = Math.ceil(box.getBoundingClientRect().height) + (floating ? FLOATING_MARGIN_PX : 0);
        root.style.setProperty("--tour-dock-h", `${room}px`);
        return;
      }
      const target = anchorNow();
      const sidebar = document.getElementById("sidebar");
      // Nothing to point at (the page is not what the tour expects): the
      // callout still shows, in the corner, so Skip and Restart stay reachable.
      box.toggleAttribute("data-unanchored", !target || !sidebar);
      if (!target || !sidebar) {
        unposition();
        return;
      }
      const doc = docEl();
      let textRight: number | null = null;
      if (doc) {
        const r = doc.getBoundingClientRect();
        textRight = r.right - (parseFloat(window.getComputedStyle(doc).paddingRight) || 0);
      }
      let minTop: number | undefined;
      const inSidebar = !!target.closest("#sidebar");
      if (view === 4) {
        // Step 4's action is in the jump box: never sit on it, or on its results.
        const wrap = document.getElementById("jump-wrap")?.getBoundingClientRect();
        const results = document.getElementById("jump-results");
        const resultsBottom = results?.classList.contains("show") ? results.getBoundingClientRect().bottom : 0;
        if (wrap) minTop = Math.max(wrap.bottom, resultsBottom) + 12;
      }
      let belowFrom: number | undefined;
      if (inSidebar) {
        const results = document.getElementById("jump-results");
        if (results?.classList.contains("show")) belowFrom = results.getBoundingClientRect().bottom;
      }
      const p: CalloutPlacement = placeCallout({
        anchor: target.getBoundingClientRect(),
        height: box.offsetHeight,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        sidebar: sidebar.getBoundingClientRect(),
        textRight,
        anchorInSidebar: inSidebar,
        minTop,
        belowFrom,
      });
      box.style.visibility = "";
      box.style.top = `${Math.round(p.top)}px`;
      box.style.left = `${Math.round(p.left)}px`;
      box.style.width = `${Math.round(p.width)}px`;
      const arrow = arrowRef.current;
      if (arrow) {
        arrow.dataset.side = p.arrow ?? "";
        arrow.hidden = p.arrow === null;
        const vertical = p.arrow === "left" || p.arrow === "right";
        arrow.style.top = vertical ? `${Math.round(p.arrowAt)}px` : "";
        arrow.style.left = vertical ? "" : `${Math.round(p.arrowAt)}px`;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    if (docked) root.setAttribute("data-tour-docked", "");
    if (floating) root.setAttribute("data-tour-floating", "");
    bringAnchorIntoView();
    update();
    // The reader lands a deep link ~50ms after it mounts (a reload, or
    // arriving with a hash), which moves the page under the anchor: look
    // once more after that.
    const settle = setTimeout(() => {
      bringAnchorIntoView();
      schedule();
    }, SETTLE_MS);

    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(box);
    const doc = docEl();
    if (doc) resize.observe(doc);
    const results = document.getElementById("jump-results");
    const mutations = new MutationObserver(schedule);
    if (results) mutations.observe(results, { attributes: true, attributeFilter: ["class"], childList: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      resize.disconnect();
      mutations.disconnect();
      marked?.removeAttribute("data-tour-target");
      root.removeAttribute("data-tour-docked");
      root.removeAttribute("data-tour-floating");
      root.style.removeProperty("--tour-dock-h");
    };
  }, [view, page, placement, docked]);

  const skip = useCallback(() => {
    const s = getState();
    if (s && view !== null) sendTourEvent({ event: "tour_skip", step: viewStep(view) }, s.sid);
    saveState(null);
    // The walkthrough's jumps leave a "Back to ..." bar behind; it goes with it.
    resetReaderTrail();
    // Off for good: a reload must not start it again.
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${searchWithoutTour(search)}${hash}`);
  }, [view]);

  const restart = useCallback(() => {
    const s = getState();
    if (!s) return;
    // Nothing of the finished run may show in the new one: the reader forgets
    // its return trail (the bar naming VI.C, the remembered origin row, the
    // way back to another regulation) before step 1 comes up.
    resetReaderTrail();
    if (page === "destination") {
      saveState(restartTour(s));
      window.location.assign(TOUR_START_HREF);
      return;
    }
    // Back to the top of GP05 with nothing in the hash (so step 1's landing
    // is a new one) and VI.D's summary closed again, the jump box ready.
    const doc = docEl();
    const panel = doc ? summaryPanelOf(rowOf(doc, jumpTargetFor(TOUR_JUMPS.first, readerRows(doc)))) : null;
    if (panel) panel.open = false;
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${search}`);
    saveState(restartTour(s));
    window.scrollTo({ top: 0, behavior: "auto" });
    const jumpbox = document.getElementById("jumpbox") as HTMLInputElement | null;
    if (jumpbox) jumpbox.value = "";
    // On a phone the jump box is behind "Contents"; focusing it there would
    // scroll an off-canvas panel, so the callout says where it is instead.
    if (jumpbox && !isDocked()) jumpbox.focus({ preventScroll: true });
  }, [page]);

  const leave = useCallback(() => saveState(null), []);
  const trialClick = useCallback(() => {
    const s = getState();
    if (s) sendTourEvent({ event: "tour_trial_click", step: TOUR_STEP_COUNT }, s.sid);
    saveState(null);
  }, []);

  if (view === null) return null;

  const closing = view === "closing";
  return (
    <aside
      ref={boxRef}
      className="tour-callout"
      data-testid="tour-callout"
      data-step={view}
      data-mode={docked ? "docked" : placement}
      aria-label="Guided walkthrough"
      aria-live="polite"
      style={{ visibility: "hidden" }}
    >
      <span ref={arrowRef} className="tour-arrow" aria-hidden="true" hidden />
      <div className="tour-head">
        <span className="tour-count" data-testid="tour-count">
          {closing ? TOUR_COPY.complete : `Step ${view} of ${TOUR_STEP_COUNT}`}
        </span>
        <button type="button" className="tour-quiet" data-testid="tour-skip" onClick={skip}>
          {closing ? "End tour" : "Skip tour"}
        </button>
      </div>
      <StepBody view={view} docked={docked} />
      <div className="tour-actions">
        {view === 2 && (
          <button type="button" className="tour-primary" data-testid="tour-next" onClick={() => commit(3)}>
            Next
          </button>
        )}
        {closing && (
          <>
            <Link href={TOUR_EXPLORE_HREF} className="tour-secondary" data-testid="tour-explore" onClick={leave}>
              {TOUR_COPY.explore}
            </Link>
            {!hasAccess && (
              <Link href={TOUR_TRIAL_HREF} className="tour-primary" data-testid="tour-trial" onClick={trialClick}>
                {TOUR_COPY.trial}
              </Link>
            )}
          </>
        )}
        <button type="button" className="tour-quiet tour-restart" data-testid="tour-restart" onClick={restart}>
          Restart
        </button>
      </div>
    </aside>
  );
}

function StepBody({ view, docked }: { view: TourView; docked: boolean }) {
  switch (view) {
    case 1:
      return (
        <>
          <p className="tour-scenario">{TOUR_COPY.scenario}</p>
          <p className="tour-text">{docked ? TOUR_COPY.step1Docked : TOUR_COPY.step1}</p>
        </>
      );
    case 2:
      return <p className="tour-text">{TOUR_COPY.step2}</p>;
    case 3:
      return <p className="tour-text">{TOUR_COPY.step3}</p>;
    case 4:
      return (
        <>
          <p className="tour-text" data-testid="tour-official-controls">
            {TOUR_COPY.officialControls}
          </p>
          <p className="tour-text">{TOUR_COPY.step4}</p>
          <p className="tour-hint">{docked ? TOUR_COPY.step4HintDocked : TOUR_COPY.step4Hint}</p>
        </>
      );
    case 5:
      return (
        <>
          <p className="tour-text">{TOUR_COPY.step5}</p>
          <p className="tour-hint">{TOUR_COPY.step5Hint}</p>
        </>
      );
    case 6:
      return <p className="tour-text">{TOUR_COPY.step6}</p>;
    case 7:
      return <p className="tour-text">{TOUR_COPY.step7}</p>;
    case "closing":
      return (
        <p className="tour-text" data-testid="tour-closing">
          {TOUR_COPY.closing}
        </p>
      );
  }
}
