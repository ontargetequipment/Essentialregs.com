/**
 * Helpers shared by the walkthrough smoke tests (smoke-tour.spec.ts, and the
 * subscriber's run in smoke-signed-in.spec.ts). Not a spec: nothing here
 * registers a test.
 */
import { expect } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

export const TOUR = "/regulations/gp05?tour=1";
export const VI_D = "sec-gp05-VI-D";
export const VI_C = "sec-gp05-VI-C";
export const REG7_IC1 = "sec-7-B-I-C-1";
export const STORAGE_KEY = "er:tour";
export const OFFICIAL_CONTROLS = "The official text controls; the summary is a reading aid.";

/** The reader's row by id: #doc's child, never the popup's clone. */
export const row = (page: Page, id: string) => page.locator(`#doc > [id="${id}"]`);
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

/** A tour already at `step`, as a reload or an earlier page would have left it in sessionStorage. */
export async function seedTour(page: Page, step: number): Promise<void> {
  await page.goto("/robots.txt");
  await page.evaluate(
    ([key, s]) =>
      sessionStorage.setItem(
        key as string,
        JSON.stringify({
          v: 1,
          step: s,
          sid: "smoke-0000-0000-0000-000000000000",
          reported: Array.from({ length: s as number }, (_, i) => i + 1),
        })
      ),
    [STORAGE_KEY, step]
  );
}

export async function storedTour(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
}

export async function openTour(page: Page, step = 1): Promise<void> {
  await page.goto(TOUR);
  await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
  await expect(callout(page)).toHaveAttribute("data-step", String(step));
}

export async function jump(page: Page, citation: string): Promise<void> {
  const box = page.locator("#jumpbox");
  await box.click();
  await box.fill(citation);
  await box.press("Enter");
}

export type Box = { x: number; y: number; width: number; height: number };
export async function boxOf(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, "element has a box").not.toBeNull();
  return b as Box;
}

/** Steps 1-4 done by hand, as a visitor would: the tour ends up at step 5, VI.C on screen. */
export async function walkToStep5(page: Page): Promise<void> {
  await openTour(page);
  await jump(page, "VI.D");
  await expect(callout(page)).toHaveAttribute("data-step", "2");
  await callout(page).getByTestId("tour-next").click();
  await expect(callout(page)).toHaveAttribute("data-step", "3");
  await row(page, VI_D).locator(":scope > details.summary-panel > summary").click();
  await expect(callout(page)).toHaveAttribute("data-step", "4");
  await jump(page, "VI.C");
  await expect(callout(page)).toHaveAttribute("data-step", "5");
}
