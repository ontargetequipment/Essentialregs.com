/**
 * Smoke test, the guided GP05 walkthrough (Sprint 6, 10 Oct 2026;
 * src/lib/tour.ts, src/components/ReaderTour.tsx). Anonymous: runs against
 * every deployment, previews and production. Read-only: every POST to
 * /api/tour-event is answered here (captureTourEvents), so a smoke run never
 * writes a count. The subscriber's version is in smoke-signed-in.spec.ts.
 *
 * The ids below are what the tour resolves "VI.D" and "VI.C" to through the
 * jump box (jumpTargetFor); the tour itself never hard-codes them.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  OFFICIAL_CONTROLS,
  REG7_IC1,
  TOUR,
  VI_C,
  VI_D,
  boxOf,
  callout,
  captureTourEvents,
  jump,
  openTour,
  row,
  seedTour,
  storedTour,
} from "./tour-helpers";

/** On a wide screen a callout stays in the sidebar column (0-320px), clear of the reading column. */
async function expectBesideTheText(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const c = await boxOf(callout(page));
      const sidebar = await boxOf(page.locator("#sidebar"));
      return c.x >= sidebar.x && c.x + c.width <= sidebar.x + sidebar.width + 1;
    })
    .toBe(true);
}

const SHOTS_DIR = path.join(process.cwd(), "e2e-screenshots");
async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test.describe("guided walkthrough", () => {
  test("logged out, step 1 sits at the jump box and moves on only when Enter lands the reader on VI.D", async ({ page }, testInfo) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    const c = callout(page);
    await expect(c).toContainText("Step 1 of 6");
    await expect(c).toContainText("You operate a produced-water tank battery under GP05. Find the site-specific sampling requirements.");
    await expect(c).toContainText("Type VI.D and press Enter.");
    await expect(c.getByTestId("tour-skip")).toBeVisible();
    await expect(c.getByTestId("tour-restart")).toBeVisible();
    // Anchored to the jump box: in the sidebar column, right above or below it.
    await expectBesideTheText(page);
    await expect
      .poll(async () => {
        const cb = await boxOf(c);
        const jb = await boxOf(page.locator("#jumpbox"));
        const gap = cb.y >= jb.y ? cb.y - (jb.y + jb.height) : jb.y - (cb.y + cb.height);
        return gap >= 0 && gap <= 40;
      })
      .toBe(true);
    await expect(page.locator("#jumpbox")).toHaveAttribute("data-tour-target", "1");
    await shot(page, testInfo, "tour-1280-step1");

    // Typed, not entered: nothing moves.
    await page.locator("#jumpbox").click();
    await page.locator("#jumpbox").fill("VI.D");
    await expect(page.locator("#jump-results")).toHaveClass(/show/);
    await page.waitForTimeout(500);
    await expect(c).toHaveAttribute("data-step", "1");
    expect(new URL(page.url()).hash).toBe("");

    await page.locator("#jumpbox").press("Enter");
    await expect(c).toHaveAttribute("data-step", "2");
    expect(new URL(page.url()).hash).toBe(`#${VI_D}`);
    await expect(row(page, VI_D)).toBeInViewport();
    await expect(c).toContainText("This is the regulation as issued. Table 2 below sets the parameters and frequency.");
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step2");
    expect(events).toEqual([
      { event: "tour_start", step: 1 },
      { event: "tour_step", step: 2 },
    ]);
  });

  test("step 3 moves on only once the summary is open; the next callout says the official text controls", async ({ page }, testInfo) => {
    await captureTourEvents(page);
    await openTour(page);
    await jump(page, "VI.D");
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    await callout(page).getByTestId("tour-next").click();
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await expect(callout(page)).toContainText("Open the plain-English summary.");

    const panel = row(page, VI_D).locator(":scope > details.summary-panel");
    const control = panel.locator(":scope > summary");
    await expect(control).toHaveAttribute("data-tour-target", "3");
    await expect(control).toBeInViewport();
    await expect(panel).not.toHaveAttribute("open", "");
    await page.waitForTimeout(500);
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step3");

    await control.click();
    await expect(panel).toHaveAttribute("open", "");
    await expect(callout(page)).toHaveAttribute("data-step", "4");
    await expect(callout(page).getByTestId("tour-official-controls")).toHaveText(OFFICIAL_CONTROLS);
    await expect(callout(page).getByTestId("tour-official-controls")).toBeVisible();
    await expect(callout(page)).toContainText("Now jump to VI.C.");
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step4");
  });

  test("step 5's Regulation 7 click lands on the focused preview with step 6; Explore GP05 goes to the reader with the tour off", async ({ page }, testInfo) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    await jump(page, "VI.D");
    await callout(page).getByTestId("tour-next").click();
    await row(page, VI_D).locator(":scope > details.summary-panel > summary").click();
    await expect(callout(page)).toHaveAttribute("data-step", "4");

    await jump(page, "VI.C");
    await expect(callout(page)).toHaveAttribute("data-step", "5");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
    await expect(callout(page)).toContainText("Click the Regulation 7 citation.");
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`);
    await expect(link).toHaveAttribute("data-tour-target", "5");
    await expect(link).toBeInViewport();
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step5");

    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_IC1);
    const locked = page.getByTestId("locked-destination");
    await expect(locked).toBeVisible();
    const c = callout(page);
    await expect(c).toHaveAttribute("data-step", "6");
    await expect(c).toContainText("Step 6 of 6");
    await expect(c).toContainText(
      "That is the workflow: find the provision, read the text, check the summary, follow the citation. Every Colorado and federal rule in the library works the same way."
    );
    // Near the locked notice: right under it.
    const lb = await boxOf(locked);
    const cb = await boxOf(c);
    expect(cb.y).toBeGreaterThanOrEqual(lb.y + lb.height - 1);
    expect(cb.y - (lb.y + lb.height)).toBeLessThan(80);
    await expect(c.getByTestId("tour-explore")).toHaveText("Explore GP05 yourself");
    await expect(c.getByTestId("tour-explore")).toHaveAttribute("href", "/regulations/gp05");
    await expect(c.getByTestId("tour-trial")).toHaveText("Start your 7-day trial");
    await expect(c.getByTestId("tour-trial")).toHaveAttribute("href", "/signup");
    await shot(page, testInfo, "tour-1280-step6");
    expect(events.map((e) => `${e.event}:${e.step}`)).toEqual([
      "tour_start:1",
      "tour_step:2",
      "tour_step:3",
      "tour_step:4",
      "tour_step:5",
      "tour_step:6",
      "tour_complete:6",
    ]);

    await c.getByTestId("tour-explore").click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    expect(new URL(page.url()).search).toBe("");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveCount(0);
    expect(await storedTour(page)).toBeNull();
  });

  test("Start your 7-day trial on step 6 goes to the trial start and is counted", async ({ page }) => {
    const events = await captureTourEvents(page);
    await seedTour(page, 6);
    await page.goto(`/regulations/7/preview?p=${REG7_IC1}&tour=1`);
    await expect(callout(page)).toHaveAttribute("data-step", "6");
    await callout(page).getByTestId("tour-trial").click();
    await page.waitForURL((url) => url.pathname === "/signup");
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    expect(events).toContainEqual({ event: "tour_trial_click", step: 6 });
    expect(await storedTour(page)).toBeNull();
  });

  test("Skip at any step ends the tour and clears it; a reload shows no tour", async ({ page }) => {
    const events = await captureTourEvents(page);
    for (const step of [1, 2, 3, 4, 5, 6]) {
      await seedTour(page, step);
      if (step === 6) await page.goto(`/regulations/7/preview?p=${REG7_IC1}&tour=1`);
      else await openTour(page, step);
      await expect(callout(page), `step ${step}`).toHaveAttribute("data-step", String(step));
      await callout(page).getByTestId("tour-skip").click();
      await expect(callout(page), `step ${step}`).toHaveCount(0);
      expect(await storedTour(page), `step ${step}`).toBeNull();
      expect(new URL(page.url()).searchParams.get("tour"), `step ${step}`).toBeNull();
      await page.reload();
      if (step < 6) await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
      else await expect(page.getByTestId("locked-destination")).toBeVisible();
      await page.waitForTimeout(300);
      await expect(callout(page), `step ${step} after reload`).toHaveCount(0);
      expect(events, `step ${step}`).toContainEqual({ event: "tour_skip", step });
    }
  });

  test("Restart at step 4 goes back to step 1 with the jump box focused", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await jump(page, "VI.D");
    await callout(page).getByTestId("tour-next").click();
    await row(page, VI_D).locator(":scope > details.summary-panel > summary").click();
    await expect(callout(page)).toHaveAttribute("data-step", "4");
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "1");
    await expect(page.locator("#jumpbox")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("");
    // And it runs again from there.
    await page.locator("#jumpbox").fill("VI.D");
    await page.locator("#jumpbox").press("Enter");
    await expect(callout(page)).toHaveAttribute("data-step", "2");
  });

  test("a reload at step 3 resumes at step 3", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await jump(page, "VI.D");
    await callout(page).getByTestId("tour-next").click();
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await page.reload();
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await expect(callout(page)).toContainText("Open the plain-English summary.");
  });

  test("at 375px every callout docks to the bottom and leaves the provision it points at uncovered", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await captureTourEvents(page);
    const expectDocked = async (step: number, anchor: Locator | null) => {
      const c = callout(page);
      await expect(c).toHaveAttribute("data-step", String(step));
      await expect(c).toHaveAttribute("data-mode", "docked");
      await expect
        .poll(async () => {
          const cb = await boxOf(c);
          return Math.abs(cb.y + cb.height - 740) <= 1 && cb.x === 0 && Math.abs(cb.width - 375) <= 1;
        }, { message: `step ${step} docked` })
        .toBe(true);
      if (!anchor) return;
      // The provision the step points at starts above the dock.
      await expect
        .poll(async () => {
          const cb = await boxOf(c);
          const ab = await boxOf(anchor);
          return ab.y >= 66 && Math.min(ab.y + ab.height, ab.y + 40) <= cb.y;
        }, { message: `step ${step} anchor clear of the dock` })
        .toBe(true);
    };

    await openTour(page);
    await expectDocked(1, null);
    await expect(callout(page)).toContainText("Tap Contents, type VI.D in the box at the top and press Enter.");
    await shot(page, testInfo, "tour-375-step1");
    // "Contents" stays above the dock and opens the sidebar with the jump box.
    const toggle = page.locator("#mobile-toggle");
    const tb = await boxOf(toggle);
    const cb1 = await boxOf(callout(page));
    expect(tb.y + tb.height).toBeLessThanOrEqual(cb1.y);
    await toggle.click();
    await expect(page.locator("#sidebar")).toHaveClass(/open/);
    await page.locator("#jumpbox").fill("VI.D");
    await page.locator("#jumpbox").press("Enter");
    // Landing closes the sidebar, so the provision is not behind it.
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
    await expectDocked(2, row(page, VI_D));
    await shot(page, testInfo, "tour-375-step2");

    await callout(page).getByTestId("tour-next").click();
    const control = row(page, VI_D).locator(":scope > details.summary-panel > summary");
    await expectDocked(3, control);
    await shot(page, testInfo, "tour-375-step3");
    await control.click();
    await expectDocked(4, row(page, VI_D).locator(":scope > details.summary-panel"));
    await expect(callout(page).getByTestId("tour-official-controls")).toBeVisible();
    await shot(page, testInfo, "tour-375-step4");

    await toggle.click();
    await page.locator("#jumpbox").fill("VI.C");
    await page.locator("#jumpbox").press("Enter");
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`);
    await expectDocked(5, link);
    await shot(page, testInfo, "tour-375-step5");

    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    await expectDocked(6, page.getByRole("heading", { level: 1 }));
    await shot(page, testInfo, "tour-375-step6");
  });

  test("/sample leads with the walkthrough; the search and Ask example is collapsed and still opens", async ({ page }) => {
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    const walkthrough = page.getByTestId("sample-walkthrough");
    await expect(walkthrough.getByRole("heading", { level: 2 })).toHaveText("Take the 60-second walkthrough");
    await expect(walkthrough.getByRole("link")).toHaveCount(1);
    await expect(walkthrough.getByRole("link", { name: "Start the walkthrough" })).toHaveAttribute("href", TOUR);
    // First on the page: above the buttons and the example.
    const example = page.getByTestId("sample-example");
    const wb = await boxOf(walkthrough);
    const eb = await boxOf(example);
    expect(wb.y).toBeLessThan(eb.y);
    expect(await page.locator("main h2").first().textContent()).toBe("Take the 60-second walkthrough");
    // Collapsed: its results are in the page but not shown.
    await expect(example).not.toHaveAttribute("open", "");
    await expect(page.getByTestId("sample-keyword")).toBeHidden();
    await example.locator(":scope > summary").click();
    await expect(page.getByTestId("sample-keyword")).toBeVisible();
    await expect(page.getByTestId("sample-ask")).toBeVisible();
  });

  test("?tour=1 on another regulation is ignored: Regulation 7's reader is still a 404 for a visitor, with no tour", async ({ page }) => {
    const res = await page.goto("/regulations/7?tour=1");
    expect(res?.status()).toBe(404);
    await expect(callout(page)).toHaveCount(0);
  });
});
