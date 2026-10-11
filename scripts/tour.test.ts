/**
 * The guided GP05 walkthrough's pure half (src/lib/tour.ts, Sprint 6; seven
 * steps in Sprint 7): how the typed citations resolve, which link step 5
 * follows and where it goes, the stored state and its closing-card flag, the
 * counted events, which step each page shows, the destination page's
 * provision and summary, and where a callout sits.
 * Run by `npm test` (tsx --test scripts/*.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { lockedPopup, type LockedPreviewPayload } from "../src/lib/reader-nav";
import {
  CALLOUT_MIN_TOP,
  CALLOUT_WIDTH,
  TOUR_COPY,
  TOUR_EXPLORE_HREF,
  TOUR_START_HREF,
  TOUR_STEP_COUNT,
  TOUR_TRIAL_HREF,
  advanceTour,
  citationDestination,
  completeTour,
  destinationTarget,
  inCitedSubtree,
  isTourCitationLink,
  isTourStep,
  jumpTargetFor,
  linkTargetOf,
  newTourState,
  parseTourEvent,
  parseTourState,
  pickSummaryRow,
  placeCallout,
  restartTour,
  searchWithoutTour,
  startTour,
  stepForPage,
  tourRequested,
  viewStep,
  withTourParam,
  type TourEventInput,
  type TourState,
  type TourStep,
} from "../src/lib/tour";

/** GP05's Part VI rows as the reader ships them (id + data-citation, document order), with neighbours. */
const GP05_ROWS = [
  { id: "sec-gp05-top-REG-gp05", citation: "APCD General Permit GP05" },
  { id: "sec-gp05-I", citation: "I." },
  { id: "sec-gp05-V-D", citation: "V.D." },
  { id: "sec-gp05-VI", citation: "VI." },
  { id: "sec-gp05-VI-A", citation: "VI.A." },
  { id: "sec-gp05-VI-B", citation: "VI.B." },
  { id: "sec-gp05-VI-C", citation: "VI.C." },
  { id: "sec-gp05-VI-D", citation: "VI.D." },
  { id: "sec-gp05-VII", citation: "VII." },
];

test("the walkthrough's citations resolve the way the jump box resolves them", () => {
  assert.equal(jumpTargetFor("VI.D", GP05_ROWS), "sec-gp05-VI-D");
  assert.equal(jumpTargetFor("VI.C", GP05_ROWS), "sec-gp05-VI-C");
  // Case, spaces and a section sign do not matter (normalizeJumpKey).
  assert.equal(jumpTargetFor(" vi.d ", GP05_ROWS), "sec-gp05-VI-D");
  assert.equal(jumpTargetFor("§ VI. D", GP05_ROWS), "sec-gp05-VI-D");
  // A prefix match takes the first row in document order, as the reader's
  // first option does.
  assert.equal(jumpTargetFor("VI", GP05_ROWS), "sec-gp05-VI");
  assert.equal(jumpTargetFor("", GP05_ROWS), null);
  assert.equal(jumpTargetFor("IX.Z", GP05_ROWS), null);
});

test("step 5 follows VI.C's Regulation 7 Section I.C.1 link and no other", () => {
  assert.equal(isTourCitationLink("/regulations/7#sec-7-B-I-C-1", "Section I.C.1."), true);
  assert.equal(isTourCitationLink("/regulations/7#sec-7-B-I-C-1", "I.C.1."), true);
  // VI.C's other Regulation 7 links.
  assert.equal(isTourCitationLink("/regulations/7#sec-7-B-II-B-2", "II.B.2."), false);
  assert.equal(isTourCitationLink("/regulations/7#sec-7-B-I-D-3", "Sections I.D.3."), false);
  assert.equal(isTourCitationLink("/regulations/7", "Regulation Number 7"), false);
  // The part between them links its root since 11 Oct 2026; it is not the citation.
  assert.equal(isTourCitationLink("/regulations/7#sec-7-P-B", "Part B"), false);
  // A suffix is not a match: II.C.1 is not I.C.1.
  assert.equal(isTourCitationLink("/regulations/7#sec-7-B-II-C-1", "Section II.C.1."), false);
  // The right words into another regulation.
  assert.equal(isTourCitationLink("/regulations/3#sec-3-A-I-C-1", "Section I.C.1."), false);
});

const SID = "0b8f1c9e-6a5d-4a3b-9f00-1234567890ab";
const IC1 = "sec-7-B-I-C-1";
const VI_C = "sec-gp05-VI-C";
const tags = (events: TourEventInput[]) => events.map((e) => `${e.event}:${e.step}`);

test("the citation opens the focused preview for a visitor and the Reg 7 reader for a subscriber, carrying the GP05 row and the tour", () => {
  assert.equal(linkTargetOf("/regulations/7#sec-7-B-I-C-1"), IC1);
  assert.equal(linkTargetOf("/regulations/7"), null);
  assert.equal(citationDestination(IC1, false, VI_C), "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C&tour=1");
  assert.equal(citationDestination(IC1, true, VI_C), "/regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B-I-C-1");
  // No origin row: just the tour, as before. A junk origin is dropped, never put in a URL.
  assert.equal(citationDestination(IC1, false), "/regulations/7/preview?p=sec-7-B-I-C-1&tour=1");
  assert.equal(citationDestination(IC1, true, null), "/regulations/7?tour=1#sec-7-B-I-C-1");
  assert.equal(citationDestination(IC1, false, "<script>"), "/regulations/7/preview?p=sec-7-B-I-C-1&tour=1");
  assert.equal(citationDestination(IC1, true, "a b"), "/regulations/7?tour=1#sec-7-B-I-C-1");
});

test("the tour parameter is added before the hash, after from, once; and removed cleanly", () => {
  assert.equal(withTourParam("/regulations/gp05"), "/regulations/gp05?tour=1");
  assert.equal(withTourParam("/regulations/7/preview?p=x"), "/regulations/7/preview?p=x&tour=1");
  assert.equal(withTourParam("/regulations/7#sec-7-B"), "/regulations/7?tour=1#sec-7-B");
  assert.equal(withTourParam("/regulations/7#sec-7-B", VI_C), "/regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B");
  assert.equal(withTourParam("/regulations/7/preview?p=x", VI_C), "/regulations/7/preview?p=x&from=sec-gp05-VI-C&tour=1");
  // The subscriber's way back from Reg 7: the reader's own href, tour added.
  assert.equal(withTourParam("/regulations/gp05#sec-gp05-VI-C"), "/regulations/gp05?tour=1#sec-gp05-VI-C");
  // Idempotent: a link that already carries the tour (the preview's way back) is left alone.
  assert.equal(withTourParam("/regulations/gp05?tour=1#sec-gp05-VI-C"), "/regulations/gp05?tour=1#sec-gp05-VI-C");
  assert.equal(withTourParam(withTourParam("/regulations/7#a", VI_C), VI_C), "/regulations/7?from=sec-gp05-VI-C&tour=1#a");
  // The query already there is not re-encoded (parentheses stay as provisionDestination wrote them).
  assert.equal(withTourParam("/regulations/gp12/preview?p=sec-gp12-VI-A-1-(i)"), "/regulations/gp12/preview?p=sec-gp12-VI-A-1-(i)&tour=1");
  assert.equal(searchWithoutTour("?tour=1"), "");
  assert.equal(searchWithoutTour("?p=sec-7-B-I-C-1&from=sec-gp05-VI-C&tour=1"), "?p=sec-7-B-I-C-1&from=sec-gp05-VI-C");
  assert.equal(searchWithoutTour(""), "");
  assert.equal(TOUR_START_HREF, "/regulations/gp05?tour=1");
  assert.equal(tourRequested("1"), true);
  for (const v of [undefined, "", "0", "true", ["1"]]) assert.equal(tourRequested(v), false, String(v));
});

test("a stored state survives a round trip; v1, junk and anything else read as no tour", () => {
  const s = newTourState(SID);
  assert.deepEqual(s, { v: 2, step: 1, done: false, completed: false, sid: SID, reported: [1] });
  assert.deepEqual(parseTourState(JSON.stringify({ ...s, step: 3, reported: [1, 2, 3] })), { ...s, step: 3, reported: [1, 2, 3] });
  // Seven steps now: 7 is a step; the closing-card flag survives with it.
  const closing = { ...s, step: 7, done: true, completed: true, reported: [1, 2, 3, 4, 5, 6, 7] };
  assert.deepEqual(parseTourState(JSON.stringify(closing)), closing);
  // A v1 state (six steps, the old copy) is ignored: a fresh run.
  assert.equal(parseTourState(JSON.stringify({ v: 1, step: 3, sid: SID, reported: [1, 2, 3] })), null);
  for (const raw of [null, "", "nope", "{}", "[]", JSON.stringify({ ...s, v: 1 }), JSON.stringify({ ...s, v: 3 }), JSON.stringify({ ...s, step: 8 }), JSON.stringify({ ...s, step: 0 }), JSON.stringify({ ...s, sid: "<script>" })]) {
    assert.equal(parseTourState(raw), null, String(raw));
  }
  // Junk in the counted steps is dropped, not fatal; 7 is a counted step.
  assert.deepEqual(parseTourState(JSON.stringify({ ...s, reported: [1, "x", 9, 2, 7] }))?.reported, [1, 2, 7]);
  // The closing card belongs to step 7 only; a missing flag is false.
  assert.equal(parseTourState(JSON.stringify({ ...s, step: 4, done: true }))?.done, false);
  assert.equal(parseTourState(JSON.stringify({ v: 2, step: 7, sid: SID, reported: [] }))?.done, false);
  assert.equal(parseTourState(JSON.stringify({ ...closing, completed: undefined }))?.completed, true, "done implies completed");
  assert.equal(isTourStep(7), true);
  assert.equal(isTourStep(8), false);
  assert.equal(TOUR_STEP_COUNT, 7);
});

test("a run counts tour_start and every step 1-7 once, then tour_complete on the way back to VI.C", () => {
  const fresh = startTour(SID);
  assert.deepEqual(tags(fresh.events), ["tour_start:1", "tour_step:1"]);
  assert.deepEqual(fresh.state, newTourState(SID));

  let s = fresh.state;
  const seen: string[] = [];
  for (const step of [2, 3, 4, 5, 6, 7] as const) {
    const r = advanceTour(s, step);
    s = r.state;
    seen.push(...tags(r.events));
    assert.equal(s.step, step);
    assert.equal(s.done, false, `step ${step} has no closing card`);
  }
  // Reaching step 7 is not the completion: that is the arrival back at VI.C.
  assert.deepEqual(seen, ["tour_step:2", "tour_step:3", "tour_step:4", "tour_step:5", "tour_step:6", "tour_step:7"]);

  const done = completeTour(s);
  assert.deepEqual(tags(done.events), ["tour_complete:7"]);
  assert.equal(done.state.done, true);
  assert.equal(done.state.step, 7);
  // Arriving at VI.C again does not count a second completion.
  assert.deepEqual(completeTour(done.state).events, []);

  // Restart: step 1, the closing card gone, the run's id and counts kept -- no second tour_start, no step counted twice.
  const again = restartTour(done.state);
  assert.equal(again.step, 1);
  assert.equal(again.done, false);
  assert.equal(again.sid, SID);
  assert.deepEqual(again.reported, [1, 2, 3, 4, 5, 6, 7]);
  let t = again;
  for (const step of [2, 3, 4, 5, 6, 7] as const) {
    const r = advanceTour(t, step);
    t = r.state;
    assert.deepEqual(r.events, [], `step ${step} again`);
  }
  // ... and finishing the second time round counts no second tour_complete either.
  assert.deepEqual(completeTour(t).events, []);
  assert.equal(completeTour(t).state.done, true);
});

test("completeTour only acts at step 7; leaving step 7 puts the closing card away", () => {
  const s = newTourState(SID);
  for (const step of [1, 2, 3, 4, 5, 6] as const) {
    const r = completeTour({ ...s, step });
    assert.deepEqual(r.events, [], `step ${step}`);
    assert.equal(r.state.done, false, `step ${step}`);
  }
  const closing: TourState = { ...s, step: 7, done: true, completed: true, reported: [1, 2, 3, 4, 5, 6, 7] };
  assert.equal(advanceTour(closing, 5).state.done, false);
  assert.equal(advanceTour(closing, 7).state.done, true);
});

test("which step each page shows", () => {
  const s = newTourState(SID);
  const at = (step: TourStep, done = false): TourState => ({ ...s, step, done });
  // Nothing stored: no tour on any page.
  assert.equal(stepForPage(null, "reader"), null);
  assert.equal(stepForPage(null, "destination"), null);
  // The GP05 reader: steps 1-5 as they are.
  for (const step of [1, 2, 3, 4, 5] as const) assert.equal(stepForPage(at(step), "reader"), step);
  // A state at 6 is Back from the destination page: step 5 again, wherever the reader is.
  assert.equal(stepForPage(at(6), "reader"), 5);
  assert.equal(stepForPage(at(6), "reader", true), 5);
  // A state at 7: the closing card when the reader is at VI.C, else step 5.
  assert.equal(stepForPage(at(7), "reader", true), "closing");
  assert.equal(stepForPage(at(7), "reader", false), 5);
  assert.equal(stepForPage(at(7), "reader"), 5);
  // A finished tour keeps its closing card wherever the reader is.
  assert.equal(stepForPage(at(7, true), "reader", false), "closing");
  assert.equal(stepForPage(at(7, true), "reader", true), "closing");
  // The destination page: 6 and 7 only; a state at 5 shows nothing until the page moves it on (arrival).
  for (const step of [1, 2, 3, 4, 5] as const) assert.equal(stepForPage(at(step), "destination"), null, `step ${step}`);
  assert.equal(stepForPage(at(6), "destination"), 6);
  assert.equal(stepForPage(at(7), "destination"), 7);
  assert.equal(stepForPage(at(7, true), "destination"), 7);
  // A closing card counts as step 7 in the events.
  assert.equal(viewStep("closing"), 7);
  assert.equal(viewStep(3), 3);
});

test("the destination page: the cited provision from its location, the subtree, and I.C.1.a's summary", () => {
  // The focused preview names the provision in ?p=, a subscriber's reader in the hash; only a Regulation 7 id counts.
  assert.equal(destinationTarget("floating", "?p=sec-7-B-I-C-1&from=sec-gp05-VI-C&tour=1", ""), IC1);
  assert.equal(destinationTarget("anchored", "?from=sec-gp05-VI-C&tour=1", "#sec-7-B-I-C-1"), IC1);
  assert.equal(destinationTarget("anchored", "", "#sec-7-B-I-C-1-e-%28iv%29"), "sec-7-B-I-C-1-e-(iv)");
  assert.equal(destinationTarget("floating", "?tour=1", "#sec-7-B-I-C-1"), null, "the preview reads ?p=, not the hash");
  assert.equal(destinationTarget("anchored", "?p=sec-7-B-I-C-1", ""), null, "the reader reads the hash, not ?p=");
  assert.equal(destinationTarget("anchored", "", ""), null);
  assert.equal(destinationTarget("anchored", "", "#sec-3-A-II-B-4"), null, "another regulation's provision is not the citation's");
  assert.equal(destinationTarget("floating", "?p=sec-gp05-VI-C", ""), null);
  assert.equal(destinationTarget("anchored", "", "#%E0%A4%A"), null, "a malformed escape is junk, not a throw");
  assert.equal(destinationTarget("floating", "?p=<b>", ""), null);

  assert.equal(inCitedSubtree(IC1, IC1), true);
  assert.equal(inCitedSubtree("sec-7-B-I-C-1-a", IC1), true);
  assert.equal(inCitedSubtree("sec-7-B-I-C-1-e-(iv)", IC1), true);
  assert.equal(inCitedSubtree("sec-7-B-I-C-10", IC1), false, "I.C.10 is not under I.C.1");
  assert.equal(inCitedSubtree("sec-7-B-I-C-2", IC1), false);
  assert.equal(inCitedSubtree("sec-7-B-I-C", IC1), false, "the parent is not in the subtree");

  // I.C.1 itself has no summary; I.C.1.a is the first that does.
  const rows = [
    { id: IC1, hasSummary: false },
    { id: "sec-7-B-I-C-1-a", hasSummary: true },
    { id: "sec-7-B-I-C-1-b", hasSummary: true },
    { id: "sec-7-B-I-C-1-e-(iii)", hasSummary: false },
  ];
  assert.equal(pickSummaryRow(IC1, rows), "sec-7-B-I-C-1-a");
  // Child "a" without a summary: the first row of the subtree that has one, never one outside it.
  assert.equal(pickSummaryRow(IC1, [rows[0], { id: "sec-7-B-I-C-1-a", hasSummary: false }, rows[2]]), "sec-7-B-I-C-1-b");
  assert.equal(pickSummaryRow(IC1, [{ id: "sec-7-B-I-C-2", hasSummary: true }, rows[0]]), null);
  // The subtree's own summary, when it is the first.
  assert.equal(pickSummaryRow(IC1, [{ id: IC1, hasSummary: true }, { id: "sec-7-B-I-C-1-a", hasSummary: false }]), IC1);
  assert.equal(pickSummaryRow(IC1, []), null);
});

test("the event route accepts the five events with a step 1-7 and a session id, nothing else", () => {
  const ok = { event: "tour_start", step: 1, sid: SID };
  assert.deepEqual(parseTourEvent(ok), ok);
  for (const event of ["tour_step", "tour_complete", "tour_trial_click", "tour_skip"]) {
    assert.ok(parseTourEvent({ ...ok, event }), event);
  }
  for (const step of [1, 2, 3, 4, 5, 6, 7]) assert.ok(parseTourEvent({ ...ok, event: "tour_step", step }), `step ${step}`);
  assert.deepEqual(parseTourEvent({ ...ok, event: "tour_complete", step: 7 }), { ...ok, event: "tour_complete", step: 7 });
  for (const bad of [
    null,
    "tour_start",
    { ...ok, event: "pageview" },
    { ...ok, step: 0 },
    { ...ok, step: 8 },
    { ...ok, step: "2" },
    { ...ok, sid: "short" },
    { ...ok, sid: "has spaces in it" },
    { ...ok, sid: undefined },
  ]) {
    assert.equal(parseTourEvent(bad), null, JSON.stringify(bad));
  }
  // Extra keys (an email, a URL) are dropped, never passed on.
  assert.deepEqual(parseTourEvent({ ...ok, email: "a@b.c", url: "/x" }), ok);
});

test("the callouts say what the brief says", () => {
  assert.equal(TOUR_COPY.scenario, "You run storage tanks under GP05 using site-specific emission factors. How often do you have to sample?");
  assert.equal(TOUR_COPY.step1, "Type frequency in the box and pick VI.D from the matches.");
  assert.equal(TOUR_COPY.step1Docked, "Tap Contents, type frequency in the box at the top and pick VI.D from the matches.");
  assert.equal(TOUR_COPY.step2, "This is the regulation as issued. Table 2 below sets the parameters and frequency.");
  assert.equal(TOUR_COPY.step3, "Open the plain-English summary.");
  assert.equal(TOUR_COPY.officialControls, "The official text controls; the summary is a reading aid.");
  assert.equal(TOUR_COPY.step4, "Now jump to VI.C.");
  assert.equal(TOUR_COPY.step4Hint, "Type VI.C in the jump box and press Enter.");
  assert.equal(TOUR_COPY.step5, "Click the Regulation 7 citation.");
  assert.equal(TOUR_COPY.step6, "This is the cited requirement. Open I.C.1.a's summary.");
  assert.equal(TOUR_COPY.step7, "Click Back to GP05 VI.C.");
  assert.equal(
    TOUR_COPY.closing,
    "You found a requirement without knowing its number, read it, checked the summary, followed its citation into another regulation and came back. Every document in the library reads this way."
  );
  assert.equal(TOUR_COPY.complete, "Walkthrough complete");
  assert.equal(TOUR_COPY.explore, "Explore GP05 yourself");
  assert.equal(TOUR_COPY.trial, "Start your 7-day trial");
  assert.equal(TOUR_EXPLORE_HREF, "/regulations/gp05");
  // The trial start every other trial button on the site uses (Sample, banner, locked panel).
  assert.equal(TOUR_TRIAL_HREF, "/signup");
});

test("the visitor's locked popup hands the GP05 row it was opened from to the focused preview", () => {
  const locked: LockedPreviewPayload = {
    locked: true,
    id: IC1,
    reg_key: "7",
    citation: "I.C.1.",
    title: "General Requirements",
    path: "PART B \u2014 Oil and Natural Gas \u203a I. Definitions",
  };
  const href = (html: string) => /class="locked-secondary" href="([^"]*)"/.exec(html)?.[1];
  // The row the link was clicked in rides along as &from= (html-escaped in the attribute).
  assert.equal(href(lockedPopup(locked, false, VI_C).panelHtml), "/regulations/7/preview?p=sec-7-B-I-C-1&amp;from=sec-gp05-VI-C");
  // Without one, the link is what it always was.
  assert.equal(href(lockedPopup(locked, false).panelHtml), "/regulations/7/preview?p=sec-7-B-I-C-1");
  assert.equal(href(lockedPopup(locked, false, null).panelHtml), "/regulations/7/preview?p=sec-7-B-I-C-1");
  // Not a provision id, or a row of the target's own regulation: no origin to draw a way back to.
  for (const bad of ["<script>", "nonsense", "sec-7-B-I-B-33", ""]) {
    assert.equal(href(lockedPopup(locked, false, bad).panelHtml), "/regulations/7/preview?p=sec-7-B-I-C-1", bad);
  }
  // A whole document has no focused provision: its preview link is unchanged.
  const doc = { ...locked, id: "sec-7-top-REG-7", citation: "Regulation Number 7", title: "CONTROL OF OZONE", path: null };
  assert.equal(href(lockedPopup(doc, true, VI_C).panelHtml), "/regulations/7/preview");
});

// The reader at 1280 x 720: site header 66px, sidebar 0-320, reading column
// 320-1280 with #doc 760px wide centred in it (420-1180, 48px padding).
const SIDEBAR = { top: 66, bottom: 720, left: 0, right: 320 };
const VIEW = { width: 1280, height: 720 };
const TEXT_RIGHT = 1180 - 48;
const overlaps = (a: { left: number; right: number }, b: { left: number; right: number }) =>
  a.left < b.right && b.left < a.right;

test("a callout for the jump box sits in the sidebar column, above it when there is room, else under it and under the results", () => {
  const jumpbox = { top: 300, bottom: 336, left: 18, right: 302 };
  const above = placeCallout({ anchor: jumpbox, height: 180, viewport: VIEW, sidebar: SIDEBAR, textRight: TEXT_RIGHT, anchorInSidebar: true });
  assert.equal(above.arrow, "down");
  assert.equal(above.top + 180 + 12, jumpbox.top);
  assert.equal(above.left, 12);
  assert.equal(above.width, CALLOUT_WIDTH);
  assert.ok(above.left + above.width <= SIDEBAR.right, "stays out of the text column");

  const tall = placeCallout({ anchor: jumpbox, height: 260, viewport: VIEW, sidebar: SIDEBAR, textRight: TEXT_RIGHT, anchorInSidebar: true });
  assert.equal(tall.arrow, "up");
  assert.equal(tall.top, jumpbox.bottom + 12);
  const underResults = placeCallout({
    anchor: jumpbox,
    height: 260,
    viewport: VIEW,
    sidebar: SIDEBAR,
    textRight: TEXT_RIGHT,
    anchorInSidebar: true,
    belowFrom: 420,
  });
  assert.equal(underResults.top, 432);
});

test("a callout for a provision sits beside it in the sidebar column at 1280px, right of the text when the window is wide", () => {
  const row = { top: 130, bottom: 900, left: 468, right: TEXT_RIGHT };
  const p = placeCallout({ anchor: row, height: 150, viewport: VIEW, sidebar: SIDEBAR, textRight: TEXT_RIGHT, anchorInSidebar: false });
  assert.equal(p.arrow, "right");
  assert.ok(!overlaps({ left: p.left, right: p.left + p.width }, row), "never over the provision text");
  assert.equal(p.top, 124);

  const wide = { width: 1920, height: 1080 };
  const wideTextRight = 320 + (1600 - 760) / 2 + 760 - 48;
  const w = placeCallout({ anchor: { ...row, right: wideTextRight }, height: 150, viewport: wide, sidebar: SIDEBAR, textRight: wideTextRight, anchorInSidebar: false });
  assert.equal(w.arrow, "left");
  assert.ok(w.left >= wideTextRight, "right of the text");
  assert.ok(w.left + w.width <= wide.width);
});

test("a provision callout stays on screen, drops its pointer when the anchor scrolls away, and keeps below minTop", () => {
  const gone = placeCallout({
    anchor: { top: -400, bottom: -100, left: 468, right: TEXT_RIGHT },
    height: 150,
    viewport: VIEW,
    sidebar: SIDEBAR,
    textRight: TEXT_RIGHT,
    anchorInSidebar: false,
  });
  assert.equal(gone.top, CALLOUT_MIN_TOP);
  assert.equal(gone.arrow, null);
  const below = placeCallout({
    anchor: { top: 900, bottom: 1000, left: 468, right: TEXT_RIGHT },
    height: 150,
    viewport: VIEW,
    sidebar: SIDEBAR,
    textRight: TEXT_RIGHT,
    anchorInSidebar: false,
  });
  assert.equal(below.top, 720 - 150 - 12);
  assert.equal(below.arrow, null);
  // Step 4: never on the jump box or its results.
  const step4 = placeCallout({
    anchor: { top: 150, bottom: 400, left: 468, right: TEXT_RIGHT },
    height: 150,
    viewport: VIEW,
    sidebar: SIDEBAR,
    textRight: TEXT_RIGHT,
    anchorInSidebar: false,
    minTop: 360,
  });
  assert.equal(step4.top, 360);
});
