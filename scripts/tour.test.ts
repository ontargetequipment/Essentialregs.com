/**
 * The guided GP05 walkthrough's pure half (src/lib/tour.ts, Sprint 6): how
 * the typed citations resolve, which link step 5 follows and where it goes,
 * the stored state, the counted events and where a callout sits.
 * Run by `npm test` (tsx --test scripts/*.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CALLOUT_MIN_TOP,
  CALLOUT_WIDTH,
  TOUR_COPY,
  TOUR_START_HREF,
  TOUR_TRIAL_HREF,
  advanceTour,
  citationDestination,
  isTourCitationLink,
  jumpTargetFor,
  linkTargetOf,
  newTourState,
  parseTourEvent,
  parseTourState,
  placeCallout,
  searchWithoutTour,
  stepForPage,
  tourRequested,
  withTourParam,
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

test("the citation opens the focused preview for a visitor and the Reg 7 reader for a subscriber, with the tour on", () => {
  assert.equal(linkTargetOf("/regulations/7#sec-7-B-I-C-1"), "sec-7-B-I-C-1");
  assert.equal(linkTargetOf("/regulations/7"), null);
  assert.equal(citationDestination("sec-7-B-I-C-1", false), "/regulations/7/preview?p=sec-7-B-I-C-1&tour=1");
  assert.equal(citationDestination("sec-7-B-I-C-1", true), "/regulations/7?tour=1#sec-7-B-I-C-1");
});

test("the tour parameter is added before the hash and removed cleanly", () => {
  assert.equal(withTourParam("/regulations/gp05"), "/regulations/gp05?tour=1");
  assert.equal(withTourParam("/regulations/7/preview?p=x"), "/regulations/7/preview?p=x&tour=1");
  assert.equal(withTourParam("/regulations/7#sec-7-B"), "/regulations/7?tour=1#sec-7-B");
  assert.equal(searchWithoutTour("?tour=1"), "");
  assert.equal(searchWithoutTour("?p=sec-7-B-I-C-1&tour=1"), "?p=sec-7-B-I-C-1");
  assert.equal(searchWithoutTour(""), "");
  assert.equal(TOUR_START_HREF, "/regulations/gp05?tour=1");
  assert.equal(tourRequested("1"), true);
  for (const v of [undefined, "", "0", "true", ["1"]]) assert.equal(tourRequested(v), false, String(v));
});

test("a stored state survives a round trip; anything else reads as no tour", () => {
  const s = newTourState("0b8f1c9e-6a5d-4a3b-9f00-1234567890ab");
  assert.deepEqual(s, { v: 1, step: 1, sid: "0b8f1c9e-6a5d-4a3b-9f00-1234567890ab", reported: [1] });
  assert.deepEqual(parseTourState(JSON.stringify({ ...s, step: 3, reported: [1, 2, 3] })), { ...s, step: 3, reported: [1, 2, 3] });
  for (const raw of [null, "", "nope", "{}", "[]", JSON.stringify({ ...s, v: 2 }), JSON.stringify({ ...s, step: 7 }), JSON.stringify({ ...s, sid: "<script>" })]) {
    assert.equal(parseTourState(raw), null, String(raw));
  }
  // Junk in the counted steps is dropped, not fatal.
  assert.deepEqual(parseTourState(JSON.stringify({ ...s, reported: [1, "x", 9, 2] }))?.reported, [1, 2]);
});

test("each step is counted once; reaching step 6 is the completion", () => {
  let s = newTourState("abcdefgh");
  const seen: string[] = [];
  for (const step of [2, 3, 4, 5, 6] as const) {
    const r = advanceTour(s, step);
    s = r.state;
    seen.push(...r.events.map((e) => `${e.event}:${e.step}`));
  }
  assert.deepEqual(seen, ["tour_step:2", "tour_step:3", "tour_step:4", "tour_step:5", "tour_step:6", "tour_complete:6"]);
  // Restart, then the same steps again: nothing counted twice.
  const again = advanceTour(advanceTour(s, 1).state, 2);
  assert.deepEqual(again.events, []);
  assert.equal(again.state.step, 2);
});

test("the reader shows steps 1-5 (a state at 6 is Back from the last page); the last page shows only 6", () => {
  const s = newTourState("abcdefgh");
  assert.equal(stepForPage(null, "reader"), null);
  assert.equal(stepForPage(s, "reader"), 1);
  assert.equal(stepForPage({ ...s, step: 4 }, "reader"), 4);
  assert.equal(stepForPage({ ...s, step: 6 }, "reader"), 5);
  assert.equal(stepForPage({ ...s, step: 5 }, "destination"), null);
  assert.equal(stepForPage({ ...s, step: 6 }, "destination"), 6);
});

test("the event route accepts the five events with a step and a session id, nothing else", () => {
  const ok = { event: "tour_start", step: 1, sid: "0b8f1c9e-6a5d-4a3b-9f00-1234567890ab" };
  assert.deepEqual(parseTourEvent(ok), ok);
  for (const event of ["tour_step", "tour_complete", "tour_trial_click", "tour_skip"]) {
    assert.ok(parseTourEvent({ ...ok, event }), event);
  }
  for (const bad of [
    null,
    "tour_start",
    { ...ok, event: "pageview" },
    { ...ok, step: 0 },
    { ...ok, step: 7 },
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
  assert.equal(TOUR_COPY.scenario, "You operate a produced-water tank battery under GP05. Find the site-specific sampling requirements.");
  assert.equal(TOUR_COPY.step1, "Type VI.D and press Enter.");
  assert.equal(TOUR_COPY.step2, "This is the regulation as issued. Table 2 below sets the parameters and frequency.");
  assert.equal(TOUR_COPY.step3, "Open the plain-English summary.");
  assert.equal(TOUR_COPY.officialControls, "The official text controls; the summary is a reading aid.");
  assert.equal(TOUR_COPY.step4, "Now jump to VI.C.");
  assert.equal(TOUR_COPY.step5, "Click the Regulation 7 citation.");
  assert.equal(
    TOUR_COPY.step6,
    "That is the workflow: find the provision, read the text, check the summary, follow the citation. Every Colorado and federal rule in the library works the same way."
  );
  assert.equal(TOUR_COPY.explore, "Explore GP05 yourself");
  assert.equal(TOUR_COPY.trial, "Start your 7-day trial");
  // The trial start every other trial button on the site uses (Sample, banner, locked panel).
  assert.equal(TOUR_TRIAL_HREF, "/signup");
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
