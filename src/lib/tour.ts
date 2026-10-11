/**
 * The guided GP05 walkthrough (Sprint 6, 10 Oct 2026; v2 in Sprint 7, 11 Oct
 * 2026): the pure half. The callouts, the DOM watching and the positioning
 * live in src/components/ReaderTour.tsx; everything here is plain data and
 * string work, so scripts/tour.test.ts can check it without a browser. It is
 * in the client bundle (ReaderTour imports it) and in the /api/tour-event
 * route (parseTourEvent), so it imports only dependency-free modules.
 *
 * /regulations/gp05?tour=1 runs seven steps on the real, public GP05 reader
 * and the page its citation opens. The visitor does every action; the tour
 * only watches the page and moves on when the action has happened:
 *
 *   1. the jump box: type "frequency", pick VI.D -> advances ONLY when the
 *                                                  reader lands on VI.D through the jump box
 *   2. VI.D's official text and Table 2           -> Next
 *   3. VI.D's summary control                     -> advances when the summary is open
 *   4. the open summary; jump to VI.C             -> advances when the reader lands on VI.C
 *   5. VI.C's Regulation 7 I.C.1 citation         -> the click opens the provision's
 *                                                    destination (the focused preview for a
 *                                                    visitor, the Reg 7 reader for a
 *                                                    subscriber); the step becomes 6 on
 *                                                    ARRIVAL there, not on the click
 *   6. the cited requirement: I.C.1.a's summary   -> advances when a summary of the
 *                                                    cited provision's subtree opens
 *   7. the way back: "Back to GP05 VI.C"          -> advances on arrival at VI.C in the GP05
 *                                                    reader, where the closing card shows
 *
 * The state (step, the closing-card flag, an anonymous session id, the steps
 * already counted) is in sessionStorage, so a reload resumes on any page.
 */
import { provisionDestination } from "@/lib/destination";
import { TRIAL_DAYS } from "@/lib/pricing";
import { regKeyOf } from "@/lib/regulation-names";
import { normalizeJumpKey } from "@/lib/snippet";
import { PROVISION_ID } from "@/lib/types";

/** The one regulation the tour runs on. ?tour=1 on any other reader is ignored. */
export const TOUR_REG = "gp05";
/** The query parameter that turns the tour on (`?tour=1`) and carries it to the destination page. */
export const TOUR_PARAM = "tour";
export const TOUR_STEP_COUNT = 7;
export type TourStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** What a callout shows: one of the seven steps, or the closing card after step 7. */
export type TourView = TourStep | "closing";

/**
 * What the visitor opens in steps 1 and 4, resolved to ids the way the jump
 * box resolves a typed citation (jumpTargetFor). Step 1 types a WORD, not the
 * citation (copy: "Type frequency in the box and pick VI.D from the
 * matches"); VI.D is what it must land on.
 */
export const TOUR_JUMPS = { first: "VI.D", second: "VI.C" } as const;

/**
 * The citation step 5 follows: the link in VI.C (step 4's provision) into
 * Regulation 7 whose text names this section (citationLinkOf).
 */
export const TOUR_CITATION = { reg: "7", section: "I.C.1" } as const;

/**
 * Step 6's summary: the cited provision's child "a" (I.C.1.a) when it has a
 * summary, else the first row of the cited provision's subtree that has one.
 */
export const TOUR_SUMMARY_CHILD = "a";

/** Where the closing card's two buttons go. The trial start is the plan choice /pricing's buttons lead to. */
export const TOUR_EXPLORE_HREF = `/regulations/${TOUR_REG}`;
export const TOUR_TRIAL_HREF = "/signup";

/** The URL that starts (or, mid-tour, resumes) the walkthrough. */
export const TOUR_START_HREF = `/regulations/${TOUR_REG}?${TOUR_PARAM}=1`;

/** The walkthrough's words. Every callout's text is here, in one place. */
export const TOUR_COPY = {
  scenario: "You run storage tanks under GP05 using site-specific emission factors. How often do you have to sample?",
  step1: "Type frequency in the box and pick VI.D from the matches.",
  step1Docked: "Tap Contents, type frequency in the box at the top and pick VI.D from the matches.",
  step2: "This is the regulation as issued. Table 2 below sets the parameters and frequency.",
  step3: "Open the plain-English summary.",
  /** Not carried by the summary panel itself (its badge tooltip says only "The source text controls"), so the callout says it. */
  officialControls: "The official text controls; the summary is a reading aid.",
  step4: "Now jump to VI.C.",
  step4Hint: "Type VI.C in the jump box and press Enter.",
  step4HintDocked: "Tap Contents, type VI.C and press Enter.",
  step5: "Click the Regulation 7 citation.",
  step5Hint: `Regulation Number 7, Part B, Section ${TOUR_CITATION.section}, highlighted in the text.`,
  step6: "This is the cited requirement. Open I.C.1.a's summary.",
  step7: "Click Back to GP05 VI.C.",
  /** The closing card, at VI.C in the GP05 reader after step 7. */
  closing:
    "You found a requirement without knowing its number, read it, checked the summary, followed its citation into another regulation and came back. Every document in the library reads this way.",
  /** The count line of the closing card, in place of "Step N of 7". */
  complete: "Walkthrough complete",
  explore: "Explore GP05 yourself",
  trial: `Start your ${TRIAL_DAYS}-day trial`,
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const TOUR_STORAGE_KEY = "er:tour";

/**
 * v2 (Sprint 7): seven steps and the closing card. A stored v1 state (six
 * steps, the old copy) is ignored, so a tab that still holds one starts a
 * fresh run.
 */
export type TourState = {
  v: 2;
  step: TourStep;
  /**
   * The closing card is showing (GP05, at VI.C, after step 7). Only ever true
   * with step 7; a Restart or any step below 7 clears it.
   */
  done: boolean;
  /** tour_complete has been counted for this run, so a Restart and a second finish do not count twice. */
  completed: boolean;
  /** Anonymous id of this run of the tour (tour_events.session_id). Never tied to an account. */
  sid: string;
  /** Steps already counted (tour_step), so a reload or a Restart does not count one twice. */
  reported: number[];
};

const SID = /^[A-Za-z0-9-]{8,64}$/;

export function isTourStep(n: unknown): n is TourStep {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= TOUR_STEP_COUNT;
}

/** A stored state, or null for anything that is not one (missing, junk, an older shape). */
export function parseTourState(raw: string | null | undefined): TourState | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<TourState>;
  if (d.v !== 2 || !isTourStep(d.step) || typeof d.sid !== "string" || !SID.test(d.sid)) return null;
  const reported = Array.isArray(d.reported) ? d.reported.filter(isTourStep) : [];
  const done = d.done === true && d.step === TOUR_STEP_COUNT;
  return { v: 2, step: d.step, done, completed: d.completed === true || done, sid: d.sid, reported };
}

export function newTourState(sid: string): TourState {
  return { v: 2, step: 1, done: false, completed: false, sid, reported: [1] };
}

/** A fresh run: its state and the two events it counts (tour_start, and step 1 reached). */
export function startTour(sid: string): { state: TourState; events: TourEventInput[] } {
  return {
    state: newTourState(sid),
    events: [
      { event: "tour_start", step: 1 },
      { event: "tour_step", step: 1 },
    ],
  };
}

/**
 * The state after moving to `step`, and the events that move counts: a
 * tour_step the first time a step is reached. Going back (Restart, or the
 * reader showing step 5 again) keeps the steps already counted. Leaving
 * step 7 puts the closing card away.
 */
export function advanceTour(state: TourState, step: TourStep): { state: TourState; events: TourEventInput[] } {
  const events: TourEventInput[] = [];
  const first = !state.reported.includes(step);
  const reported = first ? [...state.reported, step] : state.reported;
  if (first) events.push({ event: "tour_step", step });
  return { state: { ...state, step, done: step === TOUR_STEP_COUNT ? state.done : false, reported }, events };
}

/**
 * Arrival back at VI.C after step 7: the closing card, and tour_complete
 * (step 7) the first time this run gets there. Nothing happens from any
 * other step.
 */
export function completeTour(state: TourState): { state: TourState; events: TourEventInput[] } {
  if (state.step !== TOUR_STEP_COUNT) return { state, events: [] };
  const events: TourEventInput[] = state.completed ? [] : [{ event: "tour_complete", step: TOUR_STEP_COUNT }];
  return { state: { ...state, done: true, completed: true }, events };
}

/** Restart: step 1 again, the closing card gone; the run's id and its counted steps stay (no second tour_start). */
export function restartTour(state: TourState): TourState {
  return { ...state, step: 1, done: false };
}

/**
 * What a stored state shows on a given page.
 *
 *   reader       GP05 shows steps 1-5 and the closing card. A state at 6 means
 *                the visitor came back from the destination page (Back, or the
 *                way back before opening a summary), so it shows step 5 again,
 *                the link still to click. A state at 7 shows the closing card
 *                when the reader is at VI.C (`atVIC`: arrival back from the
 *                destination), else step 5. A finished tour (`done`) keeps its
 *                closing card wherever the visitor goes in the reader.
 *   destination  the page step 5's citation opens (the focused preview, or a
 *                subscriber's Regulation 7 reader) shows steps 6 and 7 only.
 *                A state at 5 shows nothing yet: the page moves it to 6 on
 *                ARRIVAL, once the cited provision is on it.
 */
export function stepForPage(state: TourState | null, page: "reader" | "destination", atVIC = false): TourView | null {
  if (!state) return null;
  if (page === "destination") return state.step === 6 || state.step === 7 ? state.step : null;
  if (state.done) return "closing";
  if (state.step === 7) return atVIC ? "closing" : 5;
  return state.step === 6 ? 5 : state.step;
}

/** The step a view counts as in events (the closing card is step 7). */
export function viewStep(view: TourView): TourStep {
  return view === "closing" ? TOUR_STEP_COUNT : view;
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/**
 * The provision the jump box opens when `query` is typed and Enter pressed,
 * from the reader's rows in document order ({id, data-citation}): the first
 * row whose normalised citation starts with the normalised query (the
 * reader's citation match, RegulationReader runSearch, whose first option
 * Enter opens), else a row whose citation equals it ignoring trailing dots
 * (exactMatch there). The same normalizeJumpKey, so "VI.D" lands where the
 * reader would take it -- never a guessed id.
 */
export function jumpTargetFor(query: string, rows: readonly { id: string; citation: string }[]): string | null {
  const key = normalizeJumpKey(query);
  if (!key) return null;
  const hit = rows.find((r) => r.citation && normalizeJumpKey(r.citation).indexOf(key) === 0);
  if (hit) return hit.id;
  const bare = key.replace(/\.+$/, "");
  return rows.find((r) => r.citation && normalizeJumpKey(r.citation).replace(/\.+$/, "") === bare)?.id ?? null;
}

/** The provision id in a "/regulations/<reg>#<id>" link, or null. */
export function linkTargetOf(href: string | null | undefined): string | null {
  if (!href) return null;
  const i = href.indexOf("#");
  if (i < 0) return null;
  let raw = href.slice(i + 1);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return raw.length <= 200 && PROVISION_ID.test(raw) && regKeyOf(raw) ? raw : null;
}

/**
 * Whether a cross-regulation link is step 5's citation: it points at a
 * provision of TOUR_CITATION.reg and its text names TOUR_CITATION.section
 * ("Section I.C.1." in GP05 VI.C).
 */
export function isTourCitationLink(href: string | null | undefined, text: string | null | undefined): boolean {
  const target = linkTargetOf(href);
  if (!target || regKeyOf(target) !== TOUR_CITATION.reg) return false;
  // "Section I.C.1." -> "i.c.1"; "Sections I.D.3." -> "i.d.3". Equality, not
  // a suffix: "II.C.1" must not pass for "I.C.1".
  const words = normalizeJumpKey(text ?? "")
    .replace(/^sections?/, "")
    .replace(/\.+$/, "");
  return words === normalizeJumpKey(TOUR_CITATION.section);
}

/**
 * Where step 5's click goes: the provision's destination for this viewer
 * (provisionDestination: the focused preview for a visitor, the reader for a
 * subscriber), carrying `from` (the GP05 row the link sits in, so the page
 * can draw its way back) and ?tour=1 (so the page shows step 6):
 *
 *   visitor     /regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C&tour=1
 *   subscriber  /regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B-I-C-1
 */
export function citationDestination(targetId: string, hasAccess: boolean, fromId?: string | null): string {
  return withTourParam(provisionDestination({ id: targetId, reg_key: regKeyOf(targetId) }, { hasAccess }), fromId);
}

/**
 * `href` with `from=<provision id>` (when it is a valid id) and tour=1 added
 * to its query string, in that order and before any #hash. A parameter the
 * href already carries is not added twice, so the result of one call can go
 * through another. The existing query is not re-encoded.
 */
export function withTourParam(href: string, from?: string | null): string {
  const hashAt = href.indexOf("#");
  const base = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  const q = base.indexOf("?");
  const have = new URLSearchParams(q < 0 ? "" : base.slice(q + 1));
  const add: string[] = [];
  if (from && from.length <= 200 && PROVISION_ID.test(from) && !have.has("from")) add.push(`from=${encodeURIComponent(from)}`);
  if (!have.has(TOUR_PARAM)) add.push(`${TOUR_PARAM}=1`);
  if (!add.length) return `${base}${hash}`;
  return `${base}${q < 0 ? "?" : "&"}${add.join("&")}${hash}`;
}

/** A location.search with the tour parameter removed ("" when nothing is left). */
export function searchWithoutTour(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(TOUR_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** Whether a page's searchParams turn the tour on. */
export function tourRequested(value: string | string[] | undefined): boolean {
  return value === "1";
}

// ---------------------------------------------------------------------------
// The destination page (steps 6 and 7)
// ---------------------------------------------------------------------------

/**
 * The provision the destination page is about, from its location: the
 * focused preview names it in `?p=` (placement "floating"), a subscriber's
 * Regulation 7 reader in the hash (placement "anchored"). Only a valid
 * provision id of TOUR_CITATION.reg counts, so a state left at step 5 does
 * not move on a page that is not the citation's.
 */
export function destinationTarget(placement: "anchored" | "floating", search: string, hash: string): string | null {
  let raw: string;
  if (placement === "floating") {
    raw = new URLSearchParams(search).get("p") ?? "";
  } else {
    raw = hash.replace(/^#/, "");
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  if (!raw || raw.length > 200 || !PROVISION_ID.test(raw)) return null;
  return regKeyOf(raw) === TOUR_CITATION.reg ? raw : null;
}

/**
 * Whether a row belongs to the cited provision's public subtree: the
 * provision itself or anything under it (every descendant's id starts with
 * the provision's id and a dash).
 */
export function inCitedSubtree(rowId: string, citedId: string): boolean {
  return rowId === citedId || rowId.startsWith(`${citedId}-`);
}

/**
 * The row whose summary step 6 points at: the cited provision's child
 * TOUR_SUMMARY_CHILD ("a": I.C.1.a) when it has a summary panel, else the
 * first row of the cited provision's subtree (document order) that has one.
 * `rows` are the destination's rows in document order.
 */
export function pickSummaryRow(citedId: string, rows: readonly { id: string; hasSummary: boolean }[]): string | null {
  const preferred = `${citedId}-${TOUR_SUMMARY_CHILD}`;
  if (rows.some((r) => r.id === preferred && r.hasSummary)) return preferred;
  return rows.find((r) => r.hasSummary && inCitedSubtree(r.id, citedId))?.id ?? null;
}

// ---------------------------------------------------------------------------
// Where a callout sits on a wide screen (ReaderTour; a phone docks instead)
// ---------------------------------------------------------------------------

export type Rect = { top: number; bottom: number; left: number; right: number; height?: number; width?: number };

export type CalloutPlacement = {
  top: number;
  left: number;
  width: number;
  /** Which edge of the callout the pointer sits on, pointing at the anchor; null when the anchor is off the callout's span. */
  arrow: "up" | "down" | "left" | "right" | null;
  /** The pointer's offset along that edge, from the callout's top (left/right) or left (up/down). */
  arrowAt: number;
};

export const CALLOUT_WIDTH = 296;
/** Below the site header (66px, sticky) with a little air. */
export const CALLOUT_MIN_TOP = 74;
const GAP = 12;
const EDGE = 16;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * The callout's box on a wide screen, from viewport rects. Never over the
 * provision text: an anchor in the sidebar (the jump box) gets the callout
 * in the sidebar column, above it when there is room under the site header,
 * else under it (and under the jump results when they are open:
 * `belowFrom`); an anchor in the document gets it to the right of the text
 * when the window leaves room for it there, else in the sidebar column,
 * level with the anchor. `minTop` keeps it below something the step needs
 * (step 4: the jump box and its results).
 */
export function placeCallout(input: {
  anchor: Rect;
  height: number;
  viewport: { width: number; height: number };
  sidebar: Rect;
  /** Right edge of the reading column's text (the #doc box less its padding), when known. */
  textRight: number | null;
  anchorInSidebar: boolean;
  minTop?: number;
  belowFrom?: number;
}): CalloutPlacement {
  const { anchor, height, viewport, sidebar } = input;
  const columnWidth = Math.min(CALLOUT_WIDTH, Math.max(0, sidebar.right - sidebar.left - 2 * GAP));
  const minTop = Math.max(CALLOUT_MIN_TOP, input.minTop ?? 0);
  const maxTop = Math.max(minTop, viewport.height - height - GAP);

  if (input.anchorInSidebar) {
    const left = sidebar.left + GAP;
    const arrowAt = clamp(anchor.left + 28 - left, EDGE, columnWidth - EDGE);
    const above = anchor.top - GAP - height;
    if (above >= minTop) return { top: above, left, width: columnWidth, arrow: "down", arrowAt };
    const below = Math.max(anchor.bottom, input.belowFrom ?? 0) + GAP;
    return { top: clamp(below, minTop, maxTop), left, width: columnWidth, arrow: "up", arrowAt };
  }

  const roomRight = input.textRight === null ? 0 : viewport.width - input.textRight - 3 * GAP;
  const onRight = roomRight >= CALLOUT_WIDTH;
  const width = onRight ? CALLOUT_WIDTH : columnWidth;
  const left = onRight ? (input.textRight as number) + 2 * GAP : sidebar.left + GAP;
  const top = clamp(anchor.top - 6, minTop, maxTop);
  // The pointer aims at the anchor's first line; hidden when that line is
  // off screen or beyond the callout's own height.
  const aim = anchor.top + 16;
  const visible = anchor.bottom > CALLOUT_MIN_TOP && anchor.top < viewport.height;
  const arrowAt = aim - top;
  const arrow = visible && arrowAt >= EDGE && arrowAt <= height - EDGE ? (onRight ? "left" : "right") : null;
  return { top, left, width, arrow, arrowAt };
}

// ---------------------------------------------------------------------------
// The focused preview's card ("floating": a page with no sidebar)
// ---------------------------------------------------------------------------

/** The narrowest the floating card may be, and the gap it keeps from the text column and from the viewport's right edge. */
export const FLOATING_MIN_WIDTH = 220;
export const FLOATING_SIDE_MARGIN = 12;

/**
 * Where the preview's card goes above 860px. The preview is one centred text
 * column; the card may only sit in the gutter to the right of it, never over
 * any of the column's text. `viewportWidth` is the width the page lays out in
 * (clientWidth, without a scrollbar) and `columnRight` the right edge of the
 * text column (null: unknown, as if the gutter were wide).
 *
 *   gutter = viewportWidth - columnRight
 *   gutter >= MIN_WIDTH + 2 * MARGIN  -> fits: width min(CALLOUT_WIDTH, gutter - 2 * MARGIN),
 *                                        right-aligned with a MARGIN gap to the viewport's edge
 *   narrower                          -> does not fit: the card docks to the bottom, as at 860px and below
 */
export function floatingFit(viewportWidth: number, columnRight: number | null): { fits: boolean; width: number } {
  if (columnRight === null) return { fits: true, width: CALLOUT_WIDTH };
  const gutter = viewportWidth - columnRight;
  if (gutter < FLOATING_MIN_WIDTH + 2 * FLOATING_SIDE_MARGIN) return { fits: false, width: 0 };
  return { fits: true, width: Math.floor(Math.min(CALLOUT_WIDTH, gutter - 2 * FLOATING_SIDE_MARGIN)) };
}

// ---------------------------------------------------------------------------
// Counting (POST /api/tour-event -> public.tour_events)
// ---------------------------------------------------------------------------

/**
 * The events the tour sends. Counts only: an event name, a step and the
 * tour's own random session id -- no user id, no URL, no IP.
 */
export const TOUR_EVENTS = ["tour_start", "tour_step", "tour_complete", "tour_trial_click", "tour_skip"] as const;
export type TourEventName = (typeof TOUR_EVENTS)[number];
export type TourEventInput = { event: TourEventName; step: TourStep };
export type TourEventBody = TourEventInput & { sid: string };

/** A request body the route accepts, or null. */
export function parseTourEvent(body: unknown): TourEventBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.event !== "string" || !(TOUR_EVENTS as readonly string[]).includes(b.event)) return null;
  if (!isTourStep(b.step)) return null;
  if (typeof b.sid !== "string" || !SID.test(b.sid)) return null;
  return { event: b.event as TourEventName, step: b.step, sid: b.sid };
}
