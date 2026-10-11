/**
 * Helpers shared by the walkthrough smoke tests (smoke-tour.spec.ts, and the
 * subscriber's run in smoke-signed-in.spec.ts). Not a spec: nothing here
 * registers a test.
 *
 * The ids below are what the tour resolves "VI.D" and "VI.C" to through the
 * jump box (jumpTargetFor), and the Regulation 7 provision VI.C cites; the
 * tour itself never hard-codes them.
 */
import { expect } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

export const TOUR = "/regulations/gp05?tour=1";
export const VI_D = "sec-gp05-VI-D";
export const VI_C = "sec-gp05-VI-C";
export const REG7_IC1 = "sec-7-B-I-C-1";
export const REG7_IC1_A = `${REG7_IC1}-a`;
export const STORAGE_KEY = "er:tour";
export const OFFICIAL_CONTROLS = "The official text controls; the summary is a reading aid.";
/** Where a visitor's step-5 click goes (the focused preview), and where the way back from it goes. */
export const PREVIEW = `/regulations/7/preview?p=${REG7_IC1}&from=${VI_C}&tour=1`;
export const WAY_BACK = `/regulations/gp05?tour=1#${VI_C}`;
/** The count line and the copy of the closing card. */
export const COMPLETE = "Walkthrough complete";
export const CLOSING =
  "You found a requirement without knowing its number, read it, checked the summary, followed its citation into another regulation and came back. Every document in the library reads this way.";

/** The reader's row by id: #doc's child, never the popup's clone. */
export const row = (page: Page, id: string) => page.locator(`#doc > [id="${id}"]`);
/** The visitor preview's row by id: a direct child of #preview-doc. */
export const previewRow = (page: Page, id: string) => page.locator(`#preview-doc > [id="${id}"]`);
export const summaryPanel = (rowLocator: Locator) => rowLocator.locator(":scope > details.summary-panel");
export const summaryControl = (rowLocator: Locator) => rowLocator.locator(":scope > details.summary-panel > summary");
export const callout = (page: Page) => page.getByTestId("tour-callout");

/** Every tour event the page sends, answered here (204) instead of reaching the database. */
export async function captureTourEvents(page: Page): Promise<{ event: string; step: number }[]> {
  const events: { event: string; step: number }[] = [];
  await page.route("**/api/tour-event", async (route) => {
    try {
      const body = JSON.parse(route.request().postData() ?? "{}");
      events.push({ event: body.event, step: body.step });
    } catch {
      /* not JSON: not ours */
    }
    await route.fulfill({ status: 204 });
  });
  return events;
}

/** "tour_step:3" for each captured event. */
export const tagsOf = (events: { event: string; step: number }[]) => events.map((e) => `${e.event}:${e.step}`);

/** Waits until the page has sent an event (a keepalive POST racing a navigation is not left to chance). */
export async function sawEvent(events: { event: string; step: number }[], tag: string): Promise<void> {
  await expect.poll(() => tagsOf(events).includes(tag), { message: `sent ${tag}` }).toBe(true);
}

/** The events of a whole run, in order: the start, steps 1-7 as they are reached, the completion. */
export const FULL_RUN = [
  "tour_start:1",
  "tour_step:1",
  "tour_step:2",
  "tour_step:3",
  "tour_step:4",
  "tour_step:5",
  "tour_step:6",
  "tour_step:7",
  "tour_complete:7",
];

/**
 * A tour already at `step`, as a reload or an earlier page would have left it
 * in sessionStorage (state v2). `done` is the closing card (GP05 at VI.C
 * after step 7).
 */
export async function seedTour(page: Page, step: number, opts: { done?: boolean } = {}): Promise<void> {
  await page.goto("/robots.txt");
  await page.evaluate(
    ([key, s, done]) =>
      sessionStorage.setItem(
        key as string,
        JSON.stringify({
          v: 2,
          step: s,
          done,
          completed: done,
          sid: "smoke-0000-0000-0000-000000000000",
          reported: Array.from({ length: s as number }, (_, i) => i + 1),
        })
      ),
    [STORAGE_KEY, step, opts.done === true]
  );
}

export async function storedTour(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
}

export async function openTour(page: Page, step: number | string = 1): Promise<void> {
  await page.goto(TOUR);
  await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
  await expect(callout(page)).toHaveAttribute("data-step", String(step));
}

/** A seeded tour at `step` ("closing": the finished tour) on the page that step belongs to. */
export async function openAtStep(page: Page, step: number | "closing"): Promise<void> {
  if (step === "closing") {
    await seedTour(page, 7, { done: true });
    await page.goto(`/regulations/gp05?tour=1#${VI_C}`);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
  } else if (step >= 6) {
    await seedTour(page, step);
    await page.goto(PREVIEW);
    await expect(page.locator("#preview-doc")).toBeVisible();
  } else {
    await seedTour(page, step);
    await page.goto(TOUR);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
  }
  await expect(callout(page)).toHaveAttribute("data-step", String(step));
}

/** Types a citation in the jump box and presses Enter (step 4's way to VI.C). */
export async function jump(page: Page, citation: string): Promise<void> {
  const box = page.locator("#jumpbox");
  await box.click();
  await box.fill(citation);
  await box.press("Enter");
}

/** Step 1's search: the word, in the jump box, with VI.D among the matches. */
export async function typeSampling(page: Page): Promise<void> {
  const box = page.locator("#jumpbox");
  await box.click();
  await box.fill("sampling");
  await expect(page.locator("#jump-results")).toHaveClass(/show/);
  await expect(page.locator(`#jump-results .jr-item[data-slug="${VI_D}"]`)).toBeVisible();
}

/** Step 1 the way the copy says: type sampling, pick VI.D from the matches. */
export async function jumpToVID(page: Page): Promise<void> {
  await typeSampling(page);
  await page.locator(`#jump-results .jr-item[data-slug="${VI_D}"]`).click();
}

/** Step 1 from the keyboard: arrow to VI.D among the matches, then Enter. */
export async function jumpToVIDByKeyboard(page: Page): Promise<void> {
  await typeSampling(page);
  const box = page.locator("#jumpbox");
  const option = page.locator(`#jump-results .jr-item[data-slug="${VI_D}"]`);
  for (let i = 0; i < 15 && (await option.getAttribute("aria-selected")) !== "true"; i++) await box.press("ArrowDown");
  await expect(option).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
}

export type Box = { x: number; y: number; width: number; height: number };
export async function boxOf(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, "element has a box").not.toBeNull();
  return b as Box;
}

export const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Whether the element is on screen RIGHT NOW (one measurement, no retrying):
 * below the 66px site header and above the bottom of the viewport. For "the
 * control is in view the moment the card shows" -- an expect(...).toBeInViewport()
 * would wait out a smooth scroll and hide the very bug this is for.
 */
export async function inViewportNow(locator: Locator, bottomLimit?: number): Promise<boolean> {
  return locator.evaluate(
    (el, limit) => {
      const r = el.getBoundingClientRect();
      return r.top >= 66 && r.bottom <= (limit ?? window.innerHeight) && r.left >= 0 && r.right <= window.innerWidth;
    },
    bottomLimit
  );
}

/** No "Back to ..." bar is visible: the in-document bar is hidden and so is the link to another regulation. */
export async function expectNoBackBar(page: Page): Promise<void> {
  await expect(page.locator("#return-trail")).toBeHidden();
  await expect(page.locator("#return-trail-ext:visible")).toHaveCount(0);
  await expect(page.locator("#return-trail-back:visible")).toHaveCount(0);
}

/**
 * At 860px and below a callout is docked: the full width of the viewport, its
 * bottom edge on the viewport's, and the anchor (when there is one) starts
 * above it and below the site header.
 */
export async function expectDocked(page: Page, step: number | string, anchor: Locator | null, viewportHeight: number, viewportWidth = 375): Promise<void> {
  const c = callout(page);
  await expect(c).toHaveAttribute("data-step", String(step));
  await expect(c).toHaveAttribute("data-mode", "docked");
  await expect
    .poll(
      async () => {
        const cb = await boxOf(c);
        return Math.abs(cb.y + cb.height - viewportHeight) <= 1 && cb.x === 0 && Math.abs(cb.width - viewportWidth) <= 1;
      },
      { message: `step ${step} docked` }
    )
    .toBe(true);
  if (!anchor) return;
  // What the step points at starts above the dock.
  await expect
    .poll(
      async () => {
        const cb = await boxOf(c);
        const ab = await boxOf(anchor);
        return ab.y >= 66 && Math.min(ab.y + ab.height, ab.y + 40) <= cb.y;
      },
      { message: `step ${step} anchor clear of the dock` }
    )
    .toBe(true);
}

/** Steps 1-4 done by hand, as a visitor would (jump box, Next, the summary, VI.C): the tour ends up at step 5, VI.C on screen. */
export async function walkToStep5(page: Page): Promise<void> {
  await openTour(page);
  await jumpToVID(page);
  await expect(callout(page)).toHaveAttribute("data-step", "2");
  await callout(page).getByTestId("tour-next").click();
  await expect(callout(page)).toHaveAttribute("data-step", "3");
  await summaryControl(row(page, VI_D)).click();
  await expect(callout(page)).toHaveAttribute("data-step", "4");
  await jump(page, "VI.C");
  await expect(callout(page)).toHaveAttribute("data-step", "5");
}

/**
 * A visitor's whole walkthrough, by hand, to the closing card at VI.C:
 * steps 1-5 on GP05, the focused preview for 6 and 7, and the way back.
 */
export async function walkToClosing(page: Page, events: { event: string; step: number }[]): Promise<void> {
  await walkToStep5(page);
  await sawEvent(events, "tour_step:5");
  await row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`).click();
  await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
  await expect(callout(page)).toHaveAttribute("data-step", "6");
  await summaryControl(previewRow(page, REG7_IC1_A)).click();
  await expect(callout(page)).toHaveAttribute("data-step", "7");
  await sawEvent(events, "tour_step:7");
  await page.locator("#preview-return").click();
  await page.waitForURL((url) => url.pathname === "/regulations/gp05");
  await expect(callout(page)).toHaveAttribute("data-step", "closing");
}
