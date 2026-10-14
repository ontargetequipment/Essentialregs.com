/**
 * The guided GP05 walkthrough's pure half (src/lib/tour.ts, Sprint 6; seven
 * steps in Sprint 7; an introduction, nine steps, two hops and the candidate
 * placement in v3, 13 Oct 2026): how the typed citations resolve, which
 * links steps 5 and 7 follow and where they go, the stored state and its
 * closing-card flag, the counted events (each view as itself, 0-9), which
 * step each page shows, the destination pages' provisions and hops, and
 * where a callout sits -- the overlap cases included.
 * Run by `npm test` (tsx --test scripts/*.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { lockedPopup, type LockedPreviewPayload } from "../src/lib/reader-nav";
import {
  CALLOUT_CLEARANCE,
  CALLOUT_MIN_TOP,
  CALLOUT_WIDTH,
  COUNTED_STEP_MAX,
  FLOATING_MIN_WIDTH,
  FLOATING_SIDE_MARGIN,
  TOUR_COPY,
  TOUR_INTRO_STEP,
  TOUR_SECOND_HOP,
  TOUR_START_HREF,
  TOUR_STEP_COUNT,
  TOUR_TRIAL_HREF,
  advanceTour,
  chooseCalloutPlacement,
  citationDestination,
  completeTour,
  countedStep,
  destinationTarget,
  floatingFit,
  inCitedSubtree,
  inTourSection,
  isSecondHopLink,
  isTourCitationLink,
  isTourStep,
  jumpTargetFor,
  linkTargetOf,
  newTourState,
  parseTourEvent,
  parseTourState,
  pickSummaryRow,
  placeCallout,
  rectsOverlap,
  restartTour,
  searchWithoutTour,
  sectionOfId,
  startTour,
  stepForPage,
  tourRequested,
  viewStep,
  withTourParam,
  type Rect,
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

test("step 7 follows I.C.1.c's \"Sections I.D.\" and no other reference beside it; the hops are told apart by section, not by a hard-coded id", () => {
  assert.deepEqual(TOUR_SECOND_HOP, { reg: "7", section: "I.D" });
  // The reader's span (data-target) and the preview's link (href) name the same target.
  assert.equal(isSecondHopLink("sec-7-B-I-D", "Sections I.D."), true);
  assert.equal(isSecondHopLink(linkTargetOf("/regulations/7/preview?p=sec-7-B-I-D&from=sec-7-B-I-C-1&tour=1"), "Sections I.D."), true);
  assert.equal(isSecondHopLink("sec-7-B-I-D", "Section I.D."), true);
  assert.equal(isSecondHopLink("sec-7-B-I-D", "I.D."), true);
  // "I.J." and "I.K." beside it, and a reference INTO I.D's subtree, are not the hop.
  assert.equal(isSecondHopLink("sec-7-B-I-J", "I.J."), false);
  assert.equal(isSecondHopLink("sec-7-B-I-K", "I.K."), false);
  assert.equal(isSecondHopLink("sec-7-B-I-D-1", "Section I.D.1."), false);
  assert.equal(isSecondHopLink("sec-7-B-I-D", "Section II.D."), false);
  assert.equal(isSecondHopLink("sec-3-A-I-D", "Section I.D."), false, "another regulation");
  assert.equal(isSecondHopLink(null, "I.D."), false);
  assert.equal(isSecondHopLink("sec-7-B-I-D", null), false);

  // The section an id names, with the Part left off (citationLabelFromId).
  assert.equal(sectionOfId("sec-7-B-I-C-1"), "i.c.1");
  assert.equal(sectionOfId("sec-7-B-I-C-1-c"), "i.c.1.c");
  assert.equal(sectionOfId("sec-7-B-I-D"), "i.d");
  assert.equal(sectionOfId("sec-7-B-I-D-3-a-(i)"), "i.d.3.a.(i)");
  assert.equal(sectionOfId("sec-gp05-VI-C"), "vi.c");
  assert.equal(sectionOfId("sec-7-top-REG-7"), "");
  // Which hop a destination page is on.
  const cited = { reg: "7", section: "I.C.1" };
  for (const id of ["sec-7-B-I-C-1", "sec-7-B-I-C-1-a", "sec-7-B-I-C-1-c", "sec-7-B-I-C-1-e-(iv)"]) {
    assert.equal(inTourSection(id, cited), true, id);
    assert.equal(inTourSection(id, TOUR_SECOND_HOP), false, id);
  }
  for (const id of ["sec-7-B-I-D", "sec-7-B-I-D-4", "sec-7-B-I-D-3-a-(i)"]) {
    assert.equal(inTourSection(id, TOUR_SECOND_HOP), true, id);
    assert.equal(inTourSection(id, cited), false, id);
  }
  for (const id of ["sec-7-B-I-C-10", "sec-7-B-I-C", "sec-7-B-I-DD", "sec-7-B-II-D", "sec-gp05-VI-C", "sec-7-top-REG-7", ""]) {
    assert.equal(inTourSection(id, cited), false, id);
    assert.equal(inTourSection(id, TOUR_SECOND_HOP), false, id);
  }
  assert.equal(inTourSection(null, cited), false);
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

test("a stored state survives a round trip; v2, v1, junk and anything else read as no tour", () => {
  const s = newTourState(SID);
  assert.deepEqual(s, { v: 3, step: 0, done: false, completed: false, sid: SID, reported: [0] });
  assert.deepEqual(parseTourState(JSON.stringify({ ...s, step: 3, reported: [0, 1, 2, 3] })), { ...s, step: 3, reported: [0, 1, 2, 3] });
  // Nine steps now: 9 is a step; the closing-card flag survives with it.
  const closing = { ...s, step: 9, done: true, completed: true, reported: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
  assert.deepEqual(parseTourState(JSON.stringify(closing)), closing);
  // A v2 state (seven steps) or a v1 state (six) is ignored: a fresh run.
  assert.equal(parseTourState(JSON.stringify({ v: 2, step: 3, done: false, completed: false, sid: SID, reported: [1, 2, 3] })), null);
  assert.equal(parseTourState(JSON.stringify({ v: 1, step: 3, sid: SID, reported: [1, 2, 3] })), null);
  for (const raw of [null, "", "nope", "{}", "[]", JSON.stringify({ ...s, v: 2 }), JSON.stringify({ ...s, v: 4 }), JSON.stringify({ ...s, step: 10 }), JSON.stringify({ ...s, step: -1 }), JSON.stringify({ ...s, sid: "<script>" })]) {
    assert.equal(parseTourState(raw), null, String(raw));
  }
  // Junk in the counted steps is dropped, not fatal; 0 and 9 are counted steps.
  assert.deepEqual(parseTourState(JSON.stringify({ ...s, reported: [0, "x", 10, 2, 9] }))?.reported, [0, 2, 9]);
  // The closing card belongs to step 9 only; a missing flag is false.
  assert.equal(parseTourState(JSON.stringify({ ...s, step: 4, done: true }))?.done, false);
  assert.equal(parseTourState(JSON.stringify({ v: 3, step: 9, sid: SID, reported: [] }))?.done, false);
  assert.equal(parseTourState(JSON.stringify({ ...closing, completed: undefined }))?.completed, true, "done implies completed");
  assert.equal(isTourStep(0), true);
  assert.equal(isTourStep(9), true);
  assert.equal(isTourStep(10), false);
  assert.equal(TOUR_STEP_COUNT, 9);
  assert.equal(TOUR_INTRO_STEP, 0);
});

test("every view is counted as itself (0-9), what public.tour_events accepts since migration 20261013034619", () => {
  assert.equal(COUNTED_STEP_MAX, 9);
  for (const step of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const) assert.equal(countedStep(step), step, `step ${step}`);
  assert.equal(viewStep("closing"), 9);
  assert.equal(viewStep(0), 0);
  assert.equal(viewStep(8), 8);
  assert.equal(viewStep(3), 3);
});

test("a run counts tour_start and every counted step once, then tour_complete on the way back to VI.C", () => {
  const fresh = startTour(SID);
  assert.deepEqual(tags(fresh.events), ["tour_start:0", "tour_step:0"]);
  assert.deepEqual(fresh.state, newTourState(SID));

  let s = fresh.state;
  const seen: string[] = [];
  for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const r = advanceTour(s, step);
    s = r.state;
    seen.push(...tags(r.events));
    assert.equal(s.step, step);
    assert.equal(s.done, false, `step ${step} has no closing card`);
  }
  // Every step once, as itself. Reaching 9 is not the completion: that is the arrival back at VI.C.
  assert.deepEqual(seen, ["tour_step:1", "tour_step:2", "tour_step:3", "tour_step:4", "tour_step:5", "tour_step:6", "tour_step:7", "tour_step:8", "tour_step:9"]);
  assert.deepEqual(s.reported, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "every view reached is remembered, counted or not");

  const done = completeTour(s);
  assert.deepEqual(tags(done.events), ["tour_complete:9"]);
  assert.equal(done.state.done, true);
  assert.equal(done.state.step, 9);
  // Arriving at VI.C again does not count a second completion.
  assert.deepEqual(completeTour(done.state).events, []);

  // Restart: the introduction, the closing card gone, the run's id and counts kept -- no second tour_start, no step counted twice.
  const again = restartTour(done.state);
  assert.equal(again.step, 0);
  assert.equal(again.done, false);
  assert.equal(again.sid, SID);
  assert.deepEqual(again.reported, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  let t = again;
  for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const r = advanceTour(t, step);
    t = r.state;
    assert.deepEqual(r.events, [], `step ${step} again`);
  }
  // ... and finishing the second time round counts no second tour_complete either.
  assert.deepEqual(completeTour(t).events, []);
  assert.equal(completeTour(t).state.done, true);

  // A run that skipped a view (a reload landed it further on) still counts the step it reached.
  const jump = advanceTour(newTourState(SID), 8);
  assert.deepEqual(tags(jump.events), ["tour_step:8"]);
  assert.deepEqual(tags(advanceTour(jump.state, 9).events), ["tour_step:9"], "the next view counts on its own");
  assert.deepEqual(advanceTour(jump.state, 8).events, [], "a view reached before is not counted again");
});

test("completeTour only acts at step 9; leaving step 9 puts the closing card away", () => {
  const s = newTourState(SID);
  for (const step of [0, 1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const r = completeTour({ ...s, step });
    assert.deepEqual(r.events, [], `step ${step}`);
    assert.equal(r.state.done, false, `step ${step}`);
  }
  const closing: TourState = { ...s, step: 9, done: true, completed: true, reported: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
  assert.equal(advanceTour(closing, 5).state.done, false);
  assert.equal(advanceTour(closing, 9).state.done, true);
});

test("which step each page shows", () => {
  const s = newTourState(SID);
  const at = (step: TourStep, done = false): TourState => ({ ...s, step, done });
  // Nothing stored: no tour on any page.
  assert.equal(stepForPage(null, "reader"), null);
  assert.equal(stepForPage(null, "destination"), null);
  // The GP05 reader: the introduction and steps 1-5 as they are.
  for (const step of [0, 1, 2, 3, 4, 5] as const) assert.equal(stepForPage(at(step), "reader"), step);
  // A state at 6, 7 or 8 is Back from a destination page before the Regulation 7 steps were done: step 5 again, wherever the reader is.
  for (const step of [6, 7, 8] as const) {
    assert.equal(stepForPage(at(step), "reader"), 5, `step ${step}`);
    assert.equal(stepForPage(at(step), "reader", true), 5, `step ${step} at VI.C`);
  }
  // A state at 9: the closing card when the reader is at VI.C, else step 5.
  assert.equal(stepForPage(at(9), "reader", true), "closing");
  assert.equal(stepForPage(at(9), "reader", false), 5);
  assert.equal(stepForPage(at(9), "reader"), 5);
  // A finished tour keeps its closing card wherever the reader is.
  assert.equal(stepForPage(at(9, true), "reader", false), "closing");
  assert.equal(stepForPage(at(9, true), "reader", true), "closing");
  // The destination pages: 6-9 only; a state at 5 shows nothing until the page moves it on (arrival).
  for (const step of [0, 1, 2, 3, 4, 5] as const) assert.equal(stepForPage(at(step), "destination"), null, `step ${step}`);
  for (const step of [6, 7, 8, 9] as const) assert.equal(stepForPage(at(step), "destination"), step, `step ${step}`);
  assert.equal(stepForPage(at(9, true), "destination"), 9);
});

test("the destination pages: the provision from the location, the subtree, I.C.1.a's summary", () => {
  // The focused preview names the provision in ?p=, a subscriber's reader in the hash; only a Regulation 7 id counts.
  assert.equal(destinationTarget("floating", "?p=sec-7-B-I-C-1&from=sec-gp05-VI-C&tour=1", ""), IC1);
  assert.equal(destinationTarget("floating", "?p=sec-7-B-I-D&from=sec-7-B-I-C-1&tour=1", ""), "sec-7-B-I-D");
  assert.equal(destinationTarget("anchored", "?from=sec-gp05-VI-C&tour=1", "#sec-7-B-I-C-1"), IC1);
  assert.equal(destinationTarget("anchored", "?tour=1", "#sec-7-B-I-D"), "sec-7-B-I-D");
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

test("the event route accepts the five events with a step 0-9 and a session id, nothing else", () => {
  const ok = { event: "tour_start", step: 0, sid: SID };
  assert.deepEqual(parseTourEvent(ok), ok);
  for (const event of ["tour_step", "tour_complete", "tour_trial_click", "tour_skip"]) {
    assert.ok(parseTourEvent({ ...ok, event }), event);
  }
  for (const step of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.ok(parseTourEvent({ ...ok, event: "tour_step", step }), `step ${step}`);
  assert.deepEqual(parseTourEvent({ ...ok, event: "tour_complete", step: 9 }), { ...ok, event: "tour_complete", step: 9 });
  for (const bad of [
    null,
    "tour_start",
    { ...ok, event: "pageview" },
    { ...ok, step: -1 },
    { ...ok, step: 10 },
    { ...ok, step: 1.5 },
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
  assert.equal(
    TOUR_COPY.intro,
    "You're inside GP05, the General Permit for produced-water tank batteries. The box on the left (Contents on a phone) searches this permit only; the Search box in the header searches the whole library. Let's answer one real question in about a minute."
  );
  assert.equal(TOUR_COPY.introCount, "Guided walkthrough");
  assert.equal(TOUR_COPY.start, "Start");
  assert.equal(TOUR_COPY.scenario, "You run storage tanks under GP05 using site-specific emission factors. How often do you have to sample?");
  assert.equal(TOUR_COPY.step1, "Type sampling in the box. One match comes up — the site-specific sampling provision. Click it.");
  assert.equal(TOUR_COPY.step1Docked, "Tap Contents, then type sampling in the box at the top. One match comes up — the site-specific sampling provision. Tap it.");
  assert.equal(TOUR_COPY.step2, "This is the regulation as issued. Table 2 below sets the parameters and frequency.");
  assert.equal(TOUR_COPY.step3, "Open the plain-English summary.");
  assert.equal(TOUR_COPY.officialControls, "The official text controls; the summary is a reading aid.");
  assert.equal(TOUR_COPY.step4, "Now jump to VI.C.");
  assert.equal(TOUR_COPY.step4Hint, "Type VI.C in the jump box and press Enter.");
  assert.equal(TOUR_COPY.step5, "Click the Regulation 7 citation.");
  assert.equal(TOUR_COPY.step6, "You are now in Regulation 7, Part B. This is I.C.1, the requirement GP05 cited. Open I.C.1.a's plain-English summary below.");
  assert.equal(TOUR_COPY.step7, "Follow this one too.");
  assert.equal(TOUR_COPY.step7Hint, "I.C.1.c cites Sections I.D., I.J., and I.K. Click I.D., highlighted in the text.");
  assert.equal(TOUR_COPY.step7HintReader, "I.C.1.c cites Sections I.D., I.J., and I.K. Click I.D., highlighted in the text, then Go to full section in the preview.");
  assert.equal(TOUR_COPY.step8, "Click Back to Regulation 7 I.C.1.");
  assert.equal(TOUR_COPY.step8Hint, "The bar remembers every hop you made. This one takes you back to the first citation; the next takes you home.");
  assert.equal(TOUR_COPY.step9, "Click Back to GP05 VI.C.");
  assert.equal(TOUR_COPY.step9Hint, "The last hop, back to the permit the question started in.");
  assert.equal(
    TOUR_COPY.closing,
    "You found a requirement without knowing its number, read it, checked the summary, followed its citations two documents deep and came back. Every document in the library reads this way."
  );
  assert.equal(TOUR_COPY.complete, "Walkthrough complete");
  assert.equal(TOUR_COPY.explore, "Explore GP05 yourself");
  assert.equal(TOUR_COPY.trial, "Start your 7-day trial");
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
    path: "PART B — Oil and Natural Gas › I. Definitions",
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

test("the preview's card is as wide as the gutter beside its text column allows, else it docks", () => {
  assert.equal(FLOATING_MIN_WIDTH, 220);
  assert.equal(FLOATING_SIDE_MARGIN, 12);
  // 1280px: the max-w-3xl column (768px, 24px padding) ends at 1000, leaving a 280px gutter: 256px of card, 12px each side.
  assert.deepEqual(floatingFit(1280, 1000), { fits: true, width: 256 });
  // With a 15px scrollbar the page lays out in 1265px and the column ends at 992.5.
  assert.deepEqual(floatingFit(1265, 992.5), { fits: true, width: 248 });
  // A wide window: the usual 296px, however much gutter there is.
  assert.deepEqual(floatingFit(1920, 1176), { fits: true, width: CALLOUT_WIDTH });
  assert.deepEqual(floatingFit(1600, 1000), { fits: true, width: CALLOUT_WIDTH });
  // The threshold: 220px of card plus a 12px margin on both sides is a 244px gutter.
  assert.deepEqual(floatingFit(1244, 1000), { fits: true, width: 220 });
  assert.deepEqual(floatingFit(1243, 1000), { fits: false, width: 0 });
  // 1100px: the column ends at 910, a 190px gutter -- too narrow, the card docks.
  assert.deepEqual(floatingFit(1100, 910), { fits: false, width: 0 });
  // Nothing to measure: as if the gutter were wide.
  assert.deepEqual(floatingFit(1280, null), { fits: true, width: CALLOUT_WIDTH });
  // Whatever fits stays clear of the text, with the margin on both sides.
  for (const [vw, col] of [[1208, 964], [1280, 1000], [1440, 1080], [2000, 1376]] as const) {
    const f = floatingFit(vw, col);
    assert.ok(f.fits, `${vw}`);
    const left = vw - FLOATING_SIDE_MARGIN - f.width;
    assert.ok(left >= col + FLOATING_SIDE_MARGIN, `${vw}: the card starts ${left - col}px right of the text`);
    assert.ok(f.width >= FLOATING_MIN_WIDTH && f.width <= CALLOUT_WIDTH, `${vw}`);
  }
});

// The reader at 1280 x 720: site header 66px, sidebar 0-320, reading column
// 320-1280 with #doc 760px wide centred in it (420-1180, 48px padding).
const SIDEBAR = { top: 66, bottom: 720, left: 0, right: 320 };
const VIEW = { width: 1280, height: 720 };
const TEXT_RIGHT = 1180 - 48;
const overlaps = (a: { left: number; right: number }, b: { left: number; right: number }) =>
  a.left < b.right && b.left < a.right;

test("beside the anchor: a jump-box callout sits in the sidebar column, above it when there is room, else under it and under the results", () => {
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

test("beside the anchor: a provision callout sits level with it in the sidebar column at 1280px, right of the text when the window is wide", () => {
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

test("beside the anchor: a provision callout stays on screen, drops its pointer when the anchor scrolls away, and keeps below minTop", () => {
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

// ---------------------------------------------------------------------------
// The candidates (v3): rects in, a position out, never over what the step needs
// ---------------------------------------------------------------------------

const BOX = { width: CALLOUT_WIDTH, height: 180 };
const rect = (p: { top: number; left: number; width: number; height?: number }, h = BOX.height): Rect => ({
  top: p.top,
  bottom: p.top + (p.height ?? h),
  left: p.left,
  right: p.left + p.width,
});
/** The old placement's input for a sidebar anchor (the jump box) at 1280 x 720. */
const JUMPBOX = { top: 300, bottom: 336, left: 18, right: 302 };
const besideJumpbox = (belowFrom?: number) => ({
  anchor: JUMPBOX,
  height: BOX.height,
  viewport: VIEW,
  sidebar: SIDEBAR,
  textRight: TEXT_RIGHT,
  anchorInSidebar: true,
  belowFrom,
});

test("rectsOverlap counts a gap narrower than the margin as an overlap", () => {
  const a = { top: 0, bottom: 100, left: 0, right: 100 };
  assert.equal(rectsOverlap(a, { top: 50, bottom: 150, left: 50, right: 150 }), true);
  assert.equal(rectsOverlap(a, { top: 100, bottom: 150, left: 0, right: 100 }), false, "touching is not overlapping");
  assert.equal(rectsOverlap(a, { top: 104, bottom: 150, left: 0, right: 100 }, CALLOUT_CLEARANCE), true, "4px of air is not enough");
  assert.equal(rectsOverlap(a, { top: 108, bottom: 150, left: 0, right: 100 }, CALLOUT_CLEARANCE), false);
  assert.equal(rectsOverlap(a, { top: 0, bottom: 100, left: 200, right: 300 }, 50), false);
});

test("step 1 at 1280px: the jump box and its ten-row match list are in the sidebar, so the card takes the pane's top-right corner, clear of both", () => {
  // The results list under the box: ten rows of 34px, as the reader draws it (max-height 340px).
  const results = { top: JUMPBOX.bottom + 4, bottom: JUMPBOX.bottom + 4 + 340, left: 18, right: 302 };
  const choice = chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft: SIDEBAR.right, obstacles: [JUMPBOX, results], beside: besideJumpbox(results.bottom) });
  assert.equal(choice.mode, "fixed");
  if (choice.mode !== "fixed") return;
  assert.equal(choice.candidate, "top-right");
  assert.equal(choice.top, CALLOUT_MIN_TOP);
  assert.equal(choice.left, VIEW.width - 16 - CALLOUT_WIDTH);
  assert.equal(choice.width, CALLOUT_WIDTH);
  assert.equal(choice.arrow, null, "a corner has no pointer; the spotlight marks the target");
  const card = rect(choice);
  for (const o of [JUMPBOX, results]) assert.equal(rectsOverlap(card, o, CALLOUT_CLEARANCE), false);
  assert.ok(card.left >= SIDEBAR.right, "not over the sidebar");
  // With no results open: the same corner.
  assert.equal(chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft: SIDEBAR.right, obstacles: [JUMPBOX], beside: besideJumpbox() }).candidate, "top-right");
});

test("a target under the top-right corner sends the card to the next candidate: bottom-right, then top-left, then beside the anchor, then the dock", () => {
  const paneLeft = SIDEBAR.right;
  const topRight = { top: CALLOUT_MIN_TOP, left: VIEW.width - 16 - CALLOUT_WIDTH, width: CALLOUT_WIDTH };
  // A citation link (step 5) landed at 130px on the right half of the text column: it reaches under the top-right card.
  const control = { top: 130, bottom: 162, left: 700, right: TEXT_RIGHT };
  const beside = { anchor: control, height: BOX.height, viewport: VIEW, sidebar: SIDEBAR, textRight: TEXT_RIGHT, anchorInSidebar: false };
  const c1 = chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft, obstacles: [control], beside });
  assert.equal(c1.candidate, "bottom-right");
  if (c1.mode === "fixed") {
    assert.equal(c1.top, VIEW.height - 12 - BOX.height);
    assert.equal(c1.left, topRight.left);
    assert.equal(rectsOverlap(rect(c1), control, CALLOUT_CLEARANCE), false);
  }
  // Something else low on the right too (the open summary panel of step 4, say): top-left.
  const panel = { top: 130, bottom: 700, left: 900, right: TEXT_RIGHT };
  const c2 = chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft, obstacles: [control, panel], beside });
  assert.equal(c2.candidate, "top-left");
  if (c2.mode === "fixed") {
    assert.equal(c2.left, paneLeft + 16);
    assert.equal(c2.top, CALLOUT_MIN_TOP);
    assert.ok(c2.left >= paneLeft, "not over the sidebar");
    assert.equal(rectsOverlap(rect(c2), control, CALLOUT_CLEARANCE), false);
  }
  // A row spanning the whole column (step 2's VI.D, or step 4's open summary): every corner is on it; beside the anchor, in the sidebar column.
  const row = { top: 130, bottom: 900, left: 468, right: TEXT_RIGHT };
  const c3 = chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft, obstacles: [row], beside: { ...beside, anchor: row } });
  assert.equal(c3.candidate, "beside");
  if (c3.mode === "fixed") {
    assert.ok(c3.left + c3.width <= SIDEBAR.right, "in the sidebar column");
    assert.equal(c3.arrow, "right", "beside keeps its pointer");
    assert.equal(rectsOverlap(rect(c3), row, CALLOUT_CLEARANCE), false);
  }
  // Nothing clear anywhere (the preview, which has no sidebar, with its whole column in the way): the dock.
  const column = { top: 66, bottom: 720, left: 0, right: 1280 };
  const c4 = chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft: 0, obstacles: [column], beside: null });
  assert.deepEqual(c4, { mode: "dock", candidate: "dock" });
  // And on a reader page when even the sidebar column is taken (the open results under the jump box reach the bottom).
  const tallResults = { top: 100, bottom: 715, left: 0, right: 320 };
  const c5 = chooseCalloutPlacement({ box: BOX, viewport: VIEW, paneLeft, obstacles: [row, tallResults], beside: { ...beside, anchor: row } });
  assert.equal(c5.candidate, "dock");
});

test("step 4 at 1280px: the jump box is the target and VI.D's open summary fills the column, so the card goes beside the jump box, under its results", () => {
  const panel = { top: 130, bottom: 650, left: 468, right: TEXT_RIGHT };
  const results = { top: JUMPBOX.bottom + 4, bottom: JUMPBOX.bottom + 4 + 120, left: 18, right: 302 };
  const choice = chooseCalloutPlacement({
    box: BOX,
    viewport: VIEW,
    paneLeft: SIDEBAR.right,
    obstacles: [JUMPBOX, panel, results],
    beside: { ...besideJumpbox(results.bottom), minTop: results.bottom + 12 },
  });
  assert.equal(choice.candidate, "beside");
  if (choice.mode !== "fixed") return;
  assert.equal(choice.top, results.bottom + 12);
  assert.equal(choice.arrow, "up");
  for (const o of [JUMPBOX, panel, results]) assert.equal(rectsOverlap(rect(choice), o, CALLOUT_CLEARANCE), false);
});

test("the preview (no sidebar) at 1280px: the card takes the right gutter's corners at the gutter's width, never the column", () => {
  const { width } = floatingFit(1280, 1000);
  const box = { width, height: 180 };
  // Step 6: I.C.1.a's control, at 96px, inside the column (left 24 .. 976).
  const control = { top: 96, bottom: 128, left: 24, right: 976 };
  const c = chooseCalloutPlacement({ box, viewport: VIEW, paneLeft: 0, obstacles: [control], beside: null });
  assert.equal(c.candidate, "top-right");
  if (c.mode === "fixed") {
    assert.equal(c.left + c.width, 1280 - 16);
    assert.ok(c.left >= 1000 + 8, "right of the column");
    assert.equal(c.width, 256);
  }
  // The way back (steps 8 and 9) is a pill at the top of the column: the card still clears it in the gutter.
  const back = { top: 96, bottom: 140, left: 24, right: 300 };
  assert.equal(chooseCalloutPlacement({ box, viewport: VIEW, paneLeft: 0, obstacles: [back], beside: null }).candidate, "top-right");
  // A card taller than the viewport leaves: the dock.
  const tall = { width, height: 700 };
  assert.equal(chooseCalloutPlacement({ box: tall, viewport: VIEW, paneLeft: 0, obstacles: [control], beside: null }).candidate, "dock");
});

test("the preview's context strip: no corner sits above minTop, so the card stays under the strip", () => {
  const { width } = floatingFit(1280, 1000);
  const box = { width, height: 180 };
  // The strip runs the full width from 66 to 111; the card's top goes 8px under it.
  const c = chooseCalloutPlacement({ box, viewport: VIEW, paneLeft: 0, obstacles: [], beside: null, minTop: 119 });
  assert.equal(c.candidate, "top-right");
  if (c.mode === "fixed") assert.equal(c.top, 119);
  // A lower minTop than the header's never lifts the card over the header.
  const low = chooseCalloutPlacement({ box, viewport: VIEW, paneLeft: 0, obstacles: [], beside: null, minTop: 10 });
  if (low.mode === "fixed") assert.equal(low.top, CALLOUT_MIN_TOP);
  // Too little room under a tall strip for the card: the dock.
  assert.equal(chooseCalloutPlacement({ box: { width, height: 600 }, viewport: VIEW, paneLeft: 0, obstacles: [], beside: null, minTop: 119 }).candidate, "dock");
});

test("a corner candidate is narrowed to the pane when the pane is narrower than the card, and skipped when it would leave the viewport", () => {
  const narrow = { width: 600, height: 720 };
  const c = chooseCalloutPlacement({ box: BOX, viewport: narrow, paneLeft: 320, obstacles: [], beside: null });
  assert.equal(c.candidate, "top-right");
  if (c.mode === "fixed") {
    assert.equal(c.width, 600 - 320 - 32);
    assert.ok(c.left >= 320 && c.left + c.width <= 600);
  }
  // Bottom-right would start above the header for a card taller than the viewport allows: not a candidate.
  const tall = { width: CALLOUT_WIDTH, height: 640 };
  const c2 = chooseCalloutPlacement({ box: tall, viewport: VIEW, paneLeft: 320, obstacles: [{ top: 74, bottom: 100, left: 968, right: 1264 }], beside: null });
  assert.equal(c2.candidate, "dock");
});
