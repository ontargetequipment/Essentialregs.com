"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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
  isTourCitationLink,
  jumpTargetFor,
  linkTargetOf,
  newTourState,
  parseTourState,
  placeCallout,
  searchWithoutTour,
  stepForPage,
  type CalloutPlacement,
  type TourEventInput,
  type TourState,
  type TourStep,
} from "@/lib/tour";
import "./reader-tour.css";

/**
 * The guided GP05 walkthrough (Sprint 6, 10 Oct 2026). See src/lib/tour.ts
 * for the six steps and the state; this is the part that touches the page.
 *
 * It never drives the reader. RegulationReader stays exactly what a visitor
 * gets without the tour; this component only watches it -- a row taking
 * focus after a jump (goToProvision focuses the row it lands on, and its
 * pushState fires no hashchange), hashchange/popstate, the summary's
 * <details> toggle -- and moves on once the visitor has done the step. The
 * one thing it changes is where step 5's citation click goes: the provision's
 * destination page (the focused preview, or the Reg 7 reader for a
 * subscriber) instead of the reader's in-place popup, because step 6 lives
 * there. It does that by calling preventDefault in the capture phase, which
 * RegulationReader's own click handler already respects ("a click something
 * else already handled").
 *
 * Mounted by /regulations/[reg] when ?tour=1 (`page="reader"` on GP05,
 * `page="destination"` on any other regulation, where only a tour already
 * at step 6 shows) and by the focused preview (`placement="inline"`, under
 * the locked panel).
 *
 * Where the callout sits: on a phone (the reader's 860px breakpoint, where
 * the sidebar goes off-canvas) it docks to the bottom of the viewport and
 * the page gets that much room at the bottom. On a wider screen it is fixed
 * in the sidebar column beside its anchor (placeCallout), or to the right of
 * the text when the window is wide enough: never over the provision text.
 * No overlay, nothing dimmed.
 */

type TourPage = "reader" | "destination";

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

function commit(to: TourStep): void {
  const state = getState();
  if (!state) return;
  const next = advanceTour(state, to);
  saveState(next.state);
  for (const e of next.events) sendTourEvent(e, next.state.sid);
}

// ---------------------------------------------------------------------------
// The page: rows, anchors
// ---------------------------------------------------------------------------

function docEl(): HTMLElement | null {
  return document.getElementById("doc");
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

/** A row of #doc by id (never the popup's clone, which shares the id). */
function rowOf(doc: HTMLElement, id: string | null): HTMLElement | null {
  if (!id) return null;
  for (const el of Array.from(doc.children)) if (el.id === id) return el as HTMLElement;
  return null;
}

function summaryPanelOf(row: HTMLElement | null): HTMLDetailsElement | null {
  return (row?.querySelector(":scope > details.summary-panel") as HTMLDetailsElement | null) ?? null;
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

/** The element a step's callout points at on the reader page, or null. */
function anchorFor(step: TourStep, page: TourPage): HTMLElement | null {
  if (step === 1) return document.getElementById("jumpbox");
  const doc = docEl();
  if (!doc) return null;
  if (page === "destination") return rowOf(doc, hashId());
  const rows = readerRows(doc);
  const first = rowOf(doc, jumpTargetFor(TOUR_JUMPS.first, rows));
  if (step === 2) return first;
  if (step === 3) return (summaryPanelOf(first)?.querySelector(":scope > summary") as HTMLElement | null) ?? null;
  if (step === 4) return summaryPanelOf(first);
  if (step === 5) return citationLinkOf(rowOf(doc, jumpTargetFor(TOUR_JUMPS.second, rows)));
  return null;
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The site header's height (layout.tsx: h-[66px], sticky). */
const HEADER_PX = 66;
/** Where the reader lands a row (scroll-margin-top in reader.css): under the header and the return bar. */
const LANDING_PX = 130;

/**
 * Scrolls the anchor into the part of the viewport the callout leaves free,
 * only when it is not already there.
 */
function bringIntoView(anchor: HTMLElement, dockHeight: number): void {
  if (anchor.closest("#sidebar")) return; // the jump box: sticky, or behind Contents on a phone
  const rect = anchor.getBoundingClientRect();
  const top = LANDING_PX;
  const bottom = window.innerHeight - dockHeight - 16;
  const fits = rect.top >= HEADER_PX + 8 && Math.min(rect.bottom, rect.top + 48) <= bottom;
  if (fits) return;
  const room = Math.max(0, bottom - top - Math.min(rect.height, bottom - top));
  window.scrollBy({ top: rect.top - (top + room / 3), behavior: reducedMotion() ? "auto" : "smooth" });
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
  /** A subscriber: step 5 opens the Reg 7 reader, and step 6 has no trial button. */
  hasAccess: boolean;
  /** "inline": rendered in the page's flow (the focused preview) instead of beside an anchor. */
  placement?: "anchored" | "inline";
}) {
  const state = useSyncExternalStore(subscribeState, getState, serverState);
  const docked = useSyncExternalStore(subscribeDock, isDocked, serverDocked);
  const step = stepForPage(state, page);
  const boxRef = useRef<HTMLElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  // A fresh tour: GP05 with ?tour=1 and nothing stored. A stored state (a
  // reload, or Back from the step-6 page) resumes instead.
  useEffect(() => {
    if (page !== "reader" || getState()) return;
    const fresh = newTourState(newSessionId());
    saveState(fresh);
    sendTourEvent({ event: "tour_start", step: 1 }, fresh.sid);
  }, [page]);

  // What moves each step on. Everything here is the visitor's own action.
  useEffect(() => {
    if (page !== "reader" || step === null) return;
    const doc = docEl();
    if (!doc) return;

    if (step === 1 || step === 4) {
      // The reader lands on the provision the jump box resolves the typed
      // citation to: goToProvision pushes "#<id>" and then focuses the row
      // (focusin); a hash typed by hand or Back/Forward arrive as
      // hashchange/popstate.
      const target = jumpTargetFor(step === 1 ? TOUR_JUMPS.first : TOUR_JUMPS.second, readerRows(doc));
      if (!target) return;
      const next: TourStep = step === 1 ? 2 : 5;
      const onFocus = (e: FocusEvent) => {
        const el = e.target;
        if (el instanceof HTMLElement && el.parentElement === doc && el.id === target && hashId() === target) {
          commit(next);
        }
      };
      const onHash = () => {
        if (hashId() === target) commit(next);
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

    if (step === 3) {
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

    if (step === 5) {
      // Capture phase, ahead of RegulationReader's document handler, which
      // leaves a click alone once it is defaultPrevented. A modified click
      // (new tab, new window) is left to the browser as always.
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target instanceof Element ? e.target.closest("a.xref-external-reg") : null;
        if (!link || !isTourCitationLink(link.getAttribute("href"), link.textContent)) return;
        const id = linkTargetOf(link.getAttribute("href"));
        if (!id) return;
        e.preventDefault();
        commit(6);
        window.location.assign(citationDestination(id, hasAccess));
      };
      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }
  }, [page, step, hasAccess]);

  // The anchor: marked for its highlight ring, and brought into view when a
  // step starts (the summary control sits a screen below VI.D's heading).
  useEffect(() => {
    if (step === null || placement === "inline") return;
    const anchor = anchorFor(step, page);
    if (!anchor) return;
    anchor.setAttribute("data-tour-target", String(step));
    const frame = requestAnimationFrame(() => {
      const dock = docked ? (boxRef.current?.getBoundingClientRect().height ?? 0) : 0;
      bringIntoView(anchor, dock);
    });
    return () => {
      cancelAnimationFrame(frame);
      anchor.removeAttribute("data-tour-target");
    };
  }, [step, page, placement, docked]);

  // Position: docked (the page gets the dock's height as room at the bottom)
  // or beside the anchor, kept there on scroll, resize and layout changes
  // (the summary opening, the jump results showing).
  useEffect(() => {
    const box = boxRef.current;
    if (step === null || !box) return;
    const root = document.documentElement;
    let raf = 0;

    const unposition = () => {
      box.style.top = box.style.left = box.style.width = box.style.visibility = "";
      if (arrowRef.current) arrowRef.current.hidden = true;
    };
    const update = () => {
      raf = 0;
      if (docked) {
        unposition();
        root.style.setProperty("--tour-dock-h", `${Math.ceil(box.getBoundingClientRect().height)}px`);
        return;
      }
      if (placement === "inline") return;
      const anchor = anchorFor(step, page);
      const sidebar = document.getElementById("sidebar");
      // Nothing to point at (the page is not what the tour expects): the
      // callout still shows, in the corner, so Skip and Restart stay reachable.
      box.toggleAttribute("data-unanchored", !anchor || !sidebar);
      if (!anchor || !sidebar) {
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
      const inSidebar = !!anchor.closest("#sidebar");
      if (step === 4) {
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
        anchor: anchor.getBoundingClientRect(),
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
    schedule();
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
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      resize.disconnect();
      mutations.disconnect();
      root.removeAttribute("data-tour-docked");
      root.style.removeProperty("--tour-dock-h");
    };
  }, [step, page, placement, docked]);

  const skip = useCallback(() => {
    const s = getState();
    if (s && step !== null) sendTourEvent({ event: "tour_skip", step }, s.sid);
    saveState(null);
    // Off for good: a reload must not start it again.
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${searchWithoutTour(search)}${hash}`);
  }, [step]);

  const restart = useCallback(() => {
    const s = getState();
    if (!s) return;
    if (page === "destination") {
      saveState({ ...s, step: 1 });
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
    saveState({ ...s, step: 1 });
    window.scrollTo({ top: 0, behavior: "auto" });
    const jumpbox = document.getElementById("jumpbox") as HTMLInputElement | null;
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

  if (step === null) return null;

  const mode = docked ? "docked" : placement;
  return (
    <aside
      ref={boxRef}
      className="tour-callout"
      data-testid="tour-callout"
      data-step={step}
      data-mode={mode}
      aria-label="Guided walkthrough"
      aria-live="polite"
      style={mode === "anchored" ? { visibility: "hidden" } : undefined}
    >
      <span ref={arrowRef} className="tour-arrow" aria-hidden="true" hidden />
      <div className="tour-head">
        <span className="tour-count" data-testid="tour-count">
          Step {step} of {TOUR_STEP_COUNT}
        </span>
        <button type="button" className="tour-quiet" data-testid="tour-skip" onClick={skip}>
          {step === TOUR_STEP_COUNT ? "End tour" : "Skip tour"}
        </button>
      </div>
      <StepBody step={step} docked={docked} />
      <div className="tour-actions">
        {step === 2 && (
          <button type="button" className="tour-primary" data-testid="tour-next" onClick={() => commit(3)}>
            Next
          </button>
        )}
        {step === TOUR_STEP_COUNT && (
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

function StepBody({ step, docked }: { step: TourStep; docked: boolean }) {
  switch (step) {
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
  }
}
