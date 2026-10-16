/**
 * Where the walkthrough leaves the page when a step ARRIVES on a cited row
 * (16 Oct 2026): step 6 on Regulation 7 I.C.1, step 8 on I.D, step 9 back on
 * I.C.1 (the reader's row or the focused preview, a subscriber's or a
 * visitor's path alike) and the closing card back on GP05 VI.C. The pure
 * half: viewport rects in, one scrollBy delta out, so scripts/tour-landing.test.ts
 * can check it without a browser. ReaderTour.tsx measures the page and
 * scrolls. Dependency-free: it is in the client bundle.
 *
 * The rule, in order:
 *
 *   1. The landed row's heading sits at the top of the reading pane -- on its
 *      landing line (`landing`: the row's scroll-margin-top in the reader,
 *      130px under the sticky header and the way-back pills; the preview
 *      heading's line under the context strip), where the reader's own
 *      goToProvision and the browser's hash jump put it. A heading already
 *      there (within ARRIVAL_SLACK of the line, below the fixed chrome) is
 *      left alone, and so is one on a page that is at its very top with the
 *      heading in view under the chrome (the focused preview opens at its
 *      top: the strip, then the heading; nothing is scrolled away on arrival).
 *      Anything else -- the heading above the chrome, or further down the
 *      pane -- is scrolled onto the line.
 *   2. Then, only if the step's target (step 6: the summary toggle) ends
 *      below the fold, and only when the heading has room to rise without
 *      leaving its landing line (`room`: a preview at its top has a little,
 *      a reader row on its line has none), the heading goes onto the line
 *      and the target comes in at the BOTTOM of the pane -- never to the
 *      middle. One move, before the browser paints, that the settle pass
 *      agrees with. When the heading is on the line already, or the target
 *      is further below than the room allows, nothing moves: the heading
 *      stays at the top and the card's own words ("Open I.C.1.a's
 *      plain-English summary below") send the visitor down to it.
 *
 * Before this the destination steps scrolled their target to a third of
 * the way down the pane whenever it was not already inside the viewport,
 * which on a short window put I.C.1.a's toggle mid-pane and the I.C.1
 * heading above the pane, under the pill (production, 16 Oct 2026).
 */

export type ArrivalRect = { top: number; bottom: number };

/** How far below its landing line a heading may sit and still count as landed. */
export const ARRIVAL_SLACK = 8;

export type ArrivalInput = {
  /** The landed row's heading, in viewport pixels. */
  heading: ArrivalRect;
  /** The step's target when it is something that scrolls with the page (the summary toggle); null for a sticky pill or a button in the card. */
  target: ArrivalRect | null;
  /** The viewport y the heading's top is put on. */
  landing: number;
  /** The bottom of what is fixed over the top of the pane: the site header, the preview's strip, the reader's way-back pills. */
  chromeBottom: number;
  /** The viewport y nothing the visitor must see may sit below: the bottom edge less the docked card and some air. */
  fold: number;
  /** window.scrollY: a heading cannot be scrolled higher than the page's top allows. */
  scrollY: number;
};

/** Whether the heading is already at the top of the pane: on its landing line, or on a page at its top with the heading in view. */
export function headingLanded(input: Pick<ArrivalInput, "heading" | "landing" | "chromeBottom" | "scrollY">): boolean {
  const { heading, landing, chromeBottom, scrollY } = input;
  if (heading.top < chromeBottom) return false;
  return heading.top <= landing + ARRIVAL_SLACK || scrollY <= 0;
}

/**
 * The scrollBy delta (positive: down) that applies the rule above. 0 when
 * nothing should move.
 */
export function arrivalScroll(input: ArrivalInput): number {
  const { heading, target, landing, fold, scrollY } = input;
  let delta = 0;
  if (!headingLanded(input)) {
    // Onto the landing line; a page cannot scroll above its own top.
    delta = Math.max(-scrollY, heading.top - landing);
  }
  if (target) {
    const need = target.bottom - delta - fold;
    if (need > 0) {
      // How far the heading may still rise before it leaves its landing line:
      // enough for the target, and the heading goes onto the line.
      const room = heading.top - delta - landing;
      if (room >= need) delta += room;
    }
  }
  return Math.round(delta);
}
