/**
 * The guided GP05 walkthrough (Sprint 6, 10 Oct 2026): the pure half. The
 * callouts, the DOM watching and the positioning live in
 * src/components/ReaderTour.tsx; everything here is plain data and string
 * work, so scripts/tour.test.ts can check it without a browser. It is in the
 * client bundle (ReaderTour imports it) and in the /api/tour-event route
 * (parseTourEvent), so it imports only dependency-free modules.
 *
 * /regulations/gp05?tour=1 runs six steps on the real, public GP05 reader.
 * The visitor does every action; the tour only watches the page and moves
 * on when the action has happened:
 *
 *   1. jump box: type VI.D and press Enter   -> advances when the reader lands on VI.D
 *   2. VI.D's official text and Table 2      -> Next
 *   3. VI.D's summary control                -> advances when the summary is open
 *   4. the open summary; jump to VI.C        -> advances when the reader lands on VI.C
 *   5. VI.C's Regulation 7 I.C.1 citation    -> the click opens the provision's
 *                                               destination (the focused preview for a
 *                                               visitor, the Reg 7 reader for a subscriber)
 *   6. the closing callout on that page      -> "Explore GP05 yourself" / the trial
 *
 * The state (step, an anonymous session id, the steps already counted) is in
 * sessionStorage, so a reload resumes and the step-6 page can pick it up.
 */
import { provisionDestination } from "@/lib/destination";
import { TRIAL_DAYS } from "@/lib/pricing";
import { regKeyOf } from "@/lib/regulation-names";
import { normalizeJumpKey } from "@/lib/snippet";
import { PROVISION_ID } from "@/lib/types";

/** The one regulation the tour runs on. ?tour=1 on any other reader is ignored. */
export const TOUR_REG = "gp05";
/** The query parameter that turns the tour on (`?tour=1`) and carries it to the step-6 page. */
export const TOUR_PARAM = "tour";
export const TOUR_STEP_COUNT = 6;
export type TourStep = 1 | 2 | 3 | 4 | 5 | 6;

/** What the visitor types in steps 1 and 4; resolved to ids the way the jump box resolves them (jumpTargetFor). */
export const TOUR_JUMPS = { first: "VI.D", second: "VI.C" } as const;

/**
 * The citation step 5 follows: the link in VI.C (step 4's provision) into
 * Regulation 7 whose text names this section (citationLinkOf).
 */
export const TOUR_CITATION = { reg: "7", section: "I.C.1" } as const;

/** Where the closing callout's two buttons go. The trial start is the plan choice /pricing's buttons lead to. */
export const TOUR_EXPLORE_HREF = `/regulations/${TOUR_REG}`;
export const TOUR_TRIAL_HREF = "/signup";

/** The URL that starts (or, mid-tour, resumes) the walkthrough. */
export const TOUR_START_HREF = `/regulations/${TOUR_REG}?${TOUR_PARAM}=1`;

/** The walkthrough's words. Every callout's text is here, in one place. */
export const TOUR_COPY = {
  scenario:
    "You operate a produced-water tank battery under GP05. Find the site-specific sampling requirements.",
  step1: "Type VI.D and press Enter.",
  step1Docked: "Tap Contents, type VI.D in the box at the top and press Enter.",
  step2: "This is the regulation as issued. Table 2 below sets the parameters and frequency.",
  step3: "Open the plain-English summary.",
  /** Not carried by the summary panel itself (its badge tooltip says only "The source text controls"), so the callout says it. */
  officialControls: "The official text controls; the summary is a reading aid.",
  step4: "Now jump to VI.C.",
  step4Hint: "Type VI.C in the jump box and press Enter.",
  step4HintDocked: "Tap Contents, type VI.C and press Enter.",
  step5: "Click the Regulation 7 citation.",
  step5Hint: `Regulation Number 7, Part B, Section ${TOUR_CITATION.section}, highlighted in the text.`,
  step6:
    "That is the workflow: find the provision, read the text, check the summary, follow the citation. Every Colorado and federal rule in the library works the same way.",
  explore: "Explore GP05 yourself",
  trial: `Start your ${TRIAL_DAYS}-day trial`,
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const TOUR_STORAGE_KEY = "er:tour";

export type TourState = {
  v: 1;
  step: TourStep;
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
  if (d.v !== 1 || !isTourStep(d.step) || typeof d.sid !== "string" || !SID.test(d.sid)) return null;
  const reported = Array.isArray(d.reported) ? d.reported.filter(isTourStep) : [];
  return { v: 1, step: d.step, sid: d.sid, reported };
}

export function newTourState(sid: string): TourState {
  return { v: 1, step: 1, sid, reported: [1] };
}

/**
 * The state after moving to `step`, and the events that move counts: a
 * tour_step the first time a step is reached, and tour_complete with step 6.
 * Going back to step 1 (Restart) keeps the steps already counted.
 */
export function advanceTour(state: TourState, step: TourStep): { state: TourState; events: TourEventInput[] } {
  const events: TourEventInput[] = [];
  const reported = state.reported.includes(step) ? state.reported : [...state.reported, step];
  if (!state.reported.includes(step)) {
    events.push({ event: "tour_step", step });
    if (step === TOUR_STEP_COUNT) events.push({ event: "tour_complete", step });
  }
  return { state: { ...state, step, reported }, events };
}

/**
 * The step a stored state shows on a given page. The reader (GP05) runs
 * steps 1-5; a state already at 6 there means the visitor came back from the
 * step-6 page (Back), so it shows step 5 again, the link still to click. The
 * step-6 page (`destination`) shows only step 6.
 */
export function stepForPage(state: TourState | null, page: "reader" | "destination"): TourStep | null {
  if (!state) return null;
  if (page === "destination") return state.step === TOUR_STEP_COUNT ? state.step : null;
  return state.step === TOUR_STEP_COUNT ? 5 : state.step;
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
 * subscriber), carrying ?tour=1 so the page shows step 6.
 */
export function citationDestination(targetId: string, hasAccess: boolean): string {
  return withTourParam(provisionDestination({ id: targetId, reg_key: regKeyOf(targetId) }, { hasAccess }));
}

/** `href` with tour=1 added to its query string (before any #hash). */
export function withTourParam(href: string): string {
  const hashAt = href.indexOf("#");
  const base = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${TOUR_PARAM}=1${hash}`;
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
