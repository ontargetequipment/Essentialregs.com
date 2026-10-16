/**
 * The walkthrough's landing on a cited row (src/lib/tour-landing.ts, 16 Oct
 * 2026): the heading at the top of the pane, the target scrolled in at the
 * bottom only when the heading can stay. The numbers are the Regulation 7
 * reader's at 1364px wide: the header 66px, the way-back pill's bottom at
 * 112, the rows' scroll-margin-top 130, and I.C.1.a's summary toggle at
 * 552-587 once I.C.1 is on its line (production and the harness, 16 Oct 2026).
 * Run by `npm test` (tsx --test scripts/*.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ARRIVAL_SLACK, arrivalScroll, headingLanded } from "../src/lib/tour-landing";

const READER = { landing: 130, chromeBottom: 112, scrollY: 6159 };
/** The fold at a given viewport height with no docked card: 16px of air above the bottom edge. */
const fold = (innerHeight: number, reserve = 0) => innerHeight - reserve - 16;
/** I.C.1 on its line (a 202px heading row: the heading and its contains box) and I.C.1.a's toggle under it. */
const landedIC1 = { heading: { top: 130, bottom: 332 }, target: { top: 552, bottom: 587 } };

test("a heading on its landing line with the target in view: nothing moves", () => {
  assert.equal(arrivalScroll({ ...READER, ...landedIC1, fold: fold(691) }), 0);
  assert.equal(arrivalScroll({ ...READER, ...landedIC1, fold: fold(640) }), 0);
});

test("the Brody case, a 600px viewport: the toggle ends 3px under the fold, and the heading stays at the top instead of being scrolled away", () => {
  // Before: the target went to a third of the way down (y 270) and the heading to y -152.
  assert.equal(arrivalScroll({ ...READER, ...landedIC1, fold: fold(600) }), 0);
  // The same with the card docked at the bottom (a 195px sheet): still nothing moves.
  assert.equal(arrivalScroll({ ...READER, ...landedIC1, fold: fold(691, 195) }), 0);
});

test("a heading scrolled above the chrome (the old centring, or the visitor) comes back onto its line", () => {
  const scrolledAway = { heading: { top: -152, bottom: 50 }, target: { top: 270, bottom: 305 } };
  assert.equal(arrivalScroll({ ...READER, ...scrolledAway, fold: fold(600) }), -282);
  // A heading just under the pill is not landed either: it is 100px above its line.
  assert.equal(arrivalScroll({ ...READER, heading: { top: 30, bottom: 232 }, target: null, fold: fold(691) }), -100);
});

test("before the reader's own landing the heading is far down the page: it is put on its line, and the target then fits", () => {
  const farDown = { heading: { top: 3000, bottom: 3202 }, target: { top: 3422, bottom: 3457 } };
  assert.equal(arrivalScroll({ ...READER, ...farDown, fold: fold(691) }), 2870);
  // Far up (the visitor had read past it): the same line, from the other side.
  const farUp = { heading: { top: -2000, bottom: -1798 }, target: { top: -1578, bottom: -1543 } };
  assert.equal(arrivalScroll({ ...READER, ...farUp, fold: fold(691) }), -2130);
});

test("a heading a few pixels off its line is left where it is; one further down is not", () => {
  const nearly = { heading: { top: 130 + ARRIVAL_SLACK, bottom: 340 }, target: null };
  assert.equal(arrivalScroll({ ...READER, ...nearly, fold: fold(691) }), 0);
  const further = { heading: { top: 130 + ARRIVAL_SLACK + 1, bottom: 341 }, target: null };
  assert.equal(arrivalScroll({ ...READER, ...further, fold: fold(691) }), ARRIVAL_SLACK + 1);
});

test("the focused preview opens at its top: the heading under the strip counts as landed, and is not nudged up to the strip", () => {
  // 1364x691: the strip's bottom at 111, the landing line 123, the I.C.1 heading at 183, the toggle at 589-624.
  const preview = { landing: 123, chromeBottom: 111, scrollY: 0 };
  const atTop = { heading: { top: 183, bottom: 219 }, target: { top: 589, bottom: 624 } };
  assert.equal(headingLanded({ ...preview, heading: atTop.heading }), true);
  assert.equal(arrivalScroll({ ...preview, ...atTop, fold: fold(691) }), 0);
});

test("the target below the fold brings the heading onto its line and the target in at the bottom, and only when the heading has the room", () => {
  const preview = { landing: 123, chromeBottom: 111, scrollY: 0 };
  const atTop = { heading: { top: 183, bottom: 219 }, target: { top: 589, bottom: 624 } };
  // 600px: the toggle ends 40px under the fold and the heading has 60px before it reaches its line: the heading goes onto the line
  // (60px, one move; the toggle ends 20px above the fold), never to the middle, and a second pass finds it landed.
  assert.equal(arrivalScroll({ ...preview, ...atTop, fold: fold(600) }), 60);
  assert.equal(arrivalScroll({ ...preview, scrollY: 60, heading: { top: 123, bottom: 159 }, target: { top: 529, bottom: 564 }, fold: fold(600) }), 0);
  // 560px: it would take 80px, more than the 60px the heading has: nothing moves, the heading stays at the top.
  assert.equal(arrivalScroll({ ...preview, ...atTop, fold: fold(560) }), 0);
  // A phone with the card docked (a 190px sheet in 740px): far more than the room, nothing moves.
  const phone = { landing: 158, chromeBottom: 146, scrollY: 0 };
  assert.equal(arrivalScroll({ ...phone, heading: { top: 230, bottom: 266 }, target: { top: 700, bottom: 744 }, fold: fold(740, 190) }), 0);
});

test("the page cannot scroll above its own top", () => {
  // The heading is 30px above its line but the page is only 20px down.
  assert.equal(arrivalScroll({ landing: 130, chromeBottom: 112, scrollY: 20, heading: { top: 100, bottom: 300 }, target: null, fold: fold(691) }), -20);
});

test("a sticky target (the way-back pill, a button in the card) is no target: only the heading is placed", () => {
  assert.equal(arrivalScroll({ ...READER, heading: { top: 130, bottom: 332 }, target: null, fold: fold(600) }), 0);
  assert.equal(arrivalScroll({ ...READER, heading: { top: 400, bottom: 602 }, target: null, fold: fold(600) }), 270);
});
