/**
 * Smoke test, the guided GP05 walkthrough (Sprint 6, 10 Oct 2026; seven
 * steps and a closing card in Sprint 7, 11 Oct 2026; src/lib/tour.ts,
 * src/components/ReaderTour.tsx). Anonymous: runs against every deployment,
 * previews and production. Read-only: every POST to /api/tour-event is
 * answered here (captureTourEvents), so a smoke run never writes a count.
 * The subscriber's version is in smoke-signed-in.spec.ts.
 *
 * The seven steps, logged out:
 *   1  GP05 reader, the jump box: type frequency, pick VI.D from the matches
 *   2  VI.D, Next                       3  VI.D's summary control
 *   4  the open summary, jump to VI.C   5  VI.C's Regulation 7 I.C.1 link
 *   6  the focused preview of I.C.1: open I.C.1.a's summary
 *   7  the preview's "Back to GP05 · VI.C"
 *   then the closing card, back at VI.C in the GP05 reader.
 *
 * The ids in tour-helpers.ts are what the tour resolves "VI.D" and "VI.C" to
 * through the jump box (jumpTargetFor); the tour itself never hard-codes them.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  CLOSING,
  COMPLETE,
  FULL_RUN,
  OFFICIAL_CONTROLS,
  REG7_IC1,
  REG7_IC1_A,
  TOUR,
  VI_C,
  VI_D,
  WAY_BACK,
  boxOf,
  callout,
  captureTourEvents,
  expectDocked,
  expectNoBackBar,
  inViewportNow,
  jump,
  jumpToVID,
  jumpToVIDByKeyboard,
  openAtStep,
  openTour,
  overlap,
  previewRow,
  row,
  sawEvent,
  seedTour,
  storedTour,
  summaryControl,
  summaryPanel,
  tagsOf,
  typeFrequency,
  walkToClosing,
  walkToStep5,
} from "./tour-helpers";

/** On a wide screen a reader-page callout stays in the sidebar column (0-320px), clear of the reading column. */
async function expectBesideTheText(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const c = await boxOf(callout(page));
      const sidebar = await boxOf(page.locator("#sidebar"));
      return c.x >= sidebar.x && c.x + c.width <= sidebar.x + sidebar.width + 1;
    })
    .toBe(true);
}

/**
 * The visitor preview has no sidebar and is one centred text column. At 1280px
 * its gutter (280px) is wide enough for the card: fixed in the bottom-right
 * corner, as wide as the gutter allows less 12px each side (at most 296px),
 * below the site header -- and entirely to the right of #preview-doc, so none
 * of the column's text is under it, and clear of the anchor.
 */
async function expectFloatingCorner(page: Page, anchor: Locator): Promise<void> {
  const vp = page.viewportSize()!;
  const c = callout(page);
  await expect(c).toHaveAttribute("data-mode", "floating");
  await expect
    .poll(async () => {
      const cb = await boxOf(c);
      // 12px from the right edge (a classic scrollbar may take a few more) and 16px from the bottom.
      return (
        cb.width >= 220 &&
        cb.width <= 297 &&
        cb.x + cb.width <= vp.width - 12 + 1 &&
        cb.x + cb.width >= vp.width - 12 - 24 &&
        Math.abs(cb.y + cb.height - (vp.height - 16)) <= 1 &&
        cb.y >= 66
      );
    }, { message: "the card is in the bottom-right corner" })
    .toBe(true);
  await expect
    .poll(async () => !overlap(await boxOf(c), await boxOf(page.locator("#preview-doc"))), { message: "no part of #preview-doc is under the card" })
    .toBe(true);
  await expect
    .poll(async () => !overlap(await boxOf(c), await boxOf(anchor)), { message: "the card is never over its anchor" })
    .toBe(true);
}

const SHOTS_DIR = path.join(process.cwd(), "e2e-screenshots");
async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

const count = (page: Page) => callout(page).getByTestId("tour-count");

test.describe("guided walkthrough", () => {
  test("logged out, all seven steps at 1280px: the copy, where each card sits, the counts and the way back to VI.C", async ({ page }, testInfo) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    const c = callout(page);

    // 1 -- the scenario and the jump box.
    await expect(count(page)).toHaveText("Step 1 of 7");
    await expect(c).toContainText("You run storage tanks under GP05 using site-specific emission factors. How often do you have to sample?");
    await expect(c).toContainText("Type frequency in the box and pick VI.D from the matches.");
    await expect(c.getByTestId("tour-skip")).toHaveText("Skip tour");
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

    // Typed, not picked: nothing moves.
    await typeFrequency(page);
    await page.waitForTimeout(500);
    await expect(c).toHaveAttribute("data-step", "1");
    expect(new URL(page.url()).hash).toBe("");
    // Picking VI.D from the matches is the step.
    await page.locator(`#jump-results .jr-item[data-slug="${VI_D}"]`).click();
    await expect(c).toHaveAttribute("data-step", "2");
    expect(new URL(page.url()).hash).toBe(`#${VI_D}`);
    await expect(row(page, VI_D)).toBeInViewport();

    // 2 -- VI.D as issued.
    await expect(count(page)).toHaveText("Step 2 of 7");
    await expect(c).toContainText("This is the regulation as issued. Table 2 below sets the parameters and frequency.");
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step2");
    await c.getByTestId("tour-next").click();

    // 3 -- VI.D's summary control, on screen with its card.
    await expect(c).toHaveAttribute("data-step", "3");
    await expect(count(page)).toHaveText("Step 3 of 7");
    await expect(c).toContainText("Open the plain-English summary.");
    const control = summaryControl(row(page, VI_D));
    await expect(control).toHaveAttribute("data-tour-target", "3");
    expect(await inViewportNow(control), "the control is on screen as soon as the card says so").toBe(true);
    await expect(summaryPanel(row(page, VI_D))).not.toHaveAttribute("open", "");
    await page.waitForTimeout(500);
    await expect(c).toHaveAttribute("data-step", "3");
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step3");
    await control.click();
    await expect(summaryPanel(row(page, VI_D))).toHaveAttribute("open", "");

    // 4 -- the summary is a reading aid; now VI.C.
    await expect(c).toHaveAttribute("data-step", "4");
    await expect(count(page)).toHaveText("Step 4 of 7");
    await expect(c.getByTestId("tour-official-controls")).toHaveText(OFFICIAL_CONTROLS);
    await expect(c.getByTestId("tour-official-controls")).toBeVisible();
    await expect(c).toContainText("Now jump to VI.C.");
    await expect(c).toContainText("Type VI.C in the jump box and press Enter.");
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step4");
    await jump(page, "VI.C");

    // 5 -- VI.C's Regulation 7 citation.
    await expect(c).toHaveAttribute("data-step", "5");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
    await expect(count(page)).toHaveText("Step 5 of 7");
    await expect(c).toContainText("Click the Regulation 7 citation.");
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`);
    await expect(link).toHaveAttribute("data-tour-target", "5");
    await expect(link).toBeInViewport();
    await expectBesideTheText(page);
    await shot(page, testInfo, "tour-1280-step5");
    await sawEvent(events, "tour_step:5");

    // 6 -- arrival on the focused preview moves the step on, not the click.
    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    const arrived = new URL(page.url());
    expect(arrived.searchParams.get("p")).toBe(REG7_IC1);
    expect(arrived.searchParams.get("from")).toBe(VI_C);
    expect(arrived.searchParams.get("tour")).toBe("1");
    await expect(c).toHaveAttribute("data-step", "6");
    await expect(count(page)).toHaveText("Step 6 of 7");
    await expect(c).toContainText("This is the cited requirement. Open I.C.1.a's summary.");
    const back = page.locator("#preview-return");
    await expect(back).toBeVisible();
    await expect(back).toContainText("Back to GP05 · VI.C");
    await expect(back).toHaveAttribute("href", WAY_BACK);
    await expect(previewRow(page, REG7_IC1)).toBeVisible();
    const aControl = summaryControl(previewRow(page, REG7_IC1_A));
    await expect(aControl).toHaveAttribute("data-tour-target", "6");
    expect(await inViewportNow(aControl), "I.C.1.a's control is on screen with the card").toBe(true);
    await expectFloatingCorner(page, aControl);
    await shot(page, testInfo, "tour-1280-step6");
    await expect(c.getByTestId("tour-trial")).toHaveCount(0);

    // 7 -- any summary of the cited provision's subtree opens; the way back.
    await aControl.click();
    await expect(summaryPanel(previewRow(page, REG7_IC1_A))).toHaveAttribute("open", "");
    await expect(c).toHaveAttribute("data-step", "7");
    await expect(count(page)).toHaveText("Step 7 of 7");
    await expect(c).toContainText("Click Back to GP05 VI.C.");
    await expect(back).toHaveAttribute("data-tour-target", "7");
    expect(await inViewportNow(back), "the way back is on screen with the card").toBe(true);
    await expectFloatingCorner(page, back);
    await shot(page, testInfo, "tour-1280-step7");
    await sawEvent(events, "tour_step:7");

    // The closing card: back at VI.C in the GP05 reader.
    await back.click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    const home = new URL(page.url());
    expect(home.searchParams.get("tour")).toBe("1");
    expect(home.hash).toBe(`#${VI_C}`);
    await expect(c).toHaveAttribute("data-step", "closing");
    await expect(count(page)).toHaveText(COMPLETE);
    await expect(c.getByTestId("tour-closing")).toHaveText(CLOSING);
    await expect(row(page, VI_C)).toBeInViewport();
    await expectBesideTheText(page);
    await expect(c.getByTestId("tour-explore")).toHaveText("Explore GP05 yourself");
    await expect(c.getByTestId("tour-explore")).toHaveAttribute("href", "/regulations/gp05");
    await expect(c.getByTestId("tour-trial")).toHaveText("Start your 7-day trial");
    await expect(c.getByTestId("tour-trial")).toHaveAttribute("href", "/signup");
    await expect(c.getByTestId("tour-skip")).toHaveText("End tour");
    await expect(c.getByTestId("tour-restart")).toBeVisible();
    await expectNoBackBar(page);
    await shot(page, testInfo, "tour-1280-closing");

    await sawEvent(events, "tour_complete:7");
    expect(tagsOf(events)).toEqual(FULL_RUN);
  });

  test("step 1 moves on only when the reader lands on VI.D through the jump box", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    const c = callout(page);
    const stays = async (what: string) => {
      await page.waitForTimeout(400);
      await expect(c, what).toHaveAttribute("data-step", "1");
    };

    // A typed hash.
    await page.evaluate((id) => {
      window.location.hash = id;
    }, VI_D);
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${VI_D}`);
    await stays("a typed hash to VI.D");

    // A sidebar link to VI.D (the reader lands on it, focuses it, the hash is VI.D: still not the jump box).
    // Clicked by script: the link sits far down a collapsed tree, and the callout stands in this column.
    await page.locator(`#sidebar a.nav-link[href="#${VI_D}"]`).evaluate((el) => (el as HTMLElement).click());
    await expect(row(page, VI_D)).toBeFocused();
    await stays("a sidebar link to VI.D");

    // Back, then Forward onto VI.D.
    await page.goBack();
    await stays("Back");
    await page.goForward();
    await expect(row(page, VI_D)).toBeFocused();
    await stays("Forward to VI.D");

    // Typed into the jump box but not picked.
    await typeFrequency(page);
    await stays("frequency typed, nothing picked");
    expect(tagsOf(events)).toEqual(["tour_start:1", "tour_step:1"]);

    // Enter in the jump box on the VI.D match is the jump box: it moves on.
    await jumpToVIDByKeyboard(page);
    await expect(c).toHaveAttribute("data-step", "2");
    expect(tagsOf(events)).toEqual(["tour_start:1", "tour_step:1", "tour_step:2"]);
  });

  test("step 1 also takes a citation typed with Enter (VI.D), as the jump box resolves it", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await jump(page, "VI.D");
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    expect(new URL(page.url()).hash).toBe(`#${VI_D}`);
  });

  test("step 3's control is on screen the moment its card is: the scroll is instant, before the card shows", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await jumpToVID(page);
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    const control = summaryControl(row(page, VI_D));
    await callout(page).getByTestId("tour-next").click();
    // Step 3 is up (data-step is set when its card is placed): from this
    // instant on, with no waiting, the control it names is on screen. A
    // smooth scroll would still be under way.
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await expect(callout(page)).toBeVisible();
    expect(await inViewportNow(control)).toBe(true);
    const cb = await boxOf(callout(page));
    expect(overlap(cb, await boxOf(control)), "the card does not cover the control").toBe(false);
    // And it stays there.
    await page.waitForTimeout(600);
    expect(await inViewportNow(control)).toBe(true);
  });

  test("the closing card's \"Explore GP05 yourself\" ends the tour on the reader", async ({ page }) => {
    await captureTourEvents(page);
    await openAtStep(page, "closing");
    await callout(page).getByTestId("tour-explore").click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05" && url.search === "");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveCount(0);
    expect(await storedTour(page)).toBeNull();
  });

  test("the closing card's \"Start your 7-day trial\" goes to the trial start and is counted", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openAtStep(page, "closing");
    await callout(page).getByTestId("tour-trial").click();
    await page.waitForURL((url) => url.pathname === "/signup");
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    expect(events).toContainEqual({ event: "tour_trial_click", step: 7 });
    expect(await storedTour(page)).toBeNull();
  });

  test("Skip at every step, and End tour on the closing card, clears the tour without reloading; a reload shows no tour", async ({ page }) => {
    const events = await captureTourEvents(page);
    for (const step of [1, 2, 3, 4, 5, 6, 7, "closing"] as const) {
      await openAtStep(page, step);
      await page.evaluate(() => {
        (window as unknown as { __kept?: boolean }).__kept = true;
      });
      await callout(page).getByTestId("tour-skip").click();
      await expect(callout(page), `step ${step}`).toHaveCount(0);
      expect(await storedTour(page), `step ${step}`).toBeNull();
      expect(new URL(page.url()).searchParams.get("tour"), `step ${step}`).toBeNull();
      expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept), `step ${step}: Skip does not reload`).toBe(true);
      await expectNoBackBar(page);
      await page.reload();
      if (typeof step === "number" && step >= 6) await expect(page.locator("#preview-doc")).toBeVisible();
      else await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
      await page.waitForTimeout(300);
      await expect(callout(page), `step ${step} after reload`).toHaveCount(0);
      expect(await storedTour(page), `step ${step} after reload`).toBeNull();
    }
    // The step shown is the step counted (the closing card is step 7).
    expect(events.filter((e) => e.event === "tour_skip").map((e) => e.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 7]);
  });

  test("Restart at step 4 goes back to step 1 with the jump box focused and no Back bar; the counts are not repeated", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    await jumpToVID(page);
    await callout(page).getByTestId("tour-next").click();
    await summaryControl(row(page, VI_D)).click();
    await expect(callout(page)).toHaveAttribute("data-step", "4");
    // The jump left a Back bar behind.
    await expect(page.locator("#return-trail")).toBeVisible();
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "1");
    await expect(page.locator("#jumpbox")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("");
    await expectNoBackBar(page);
    await expect(summaryPanel(row(page, VI_D))).not.toHaveAttribute("open", "");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // And it runs again from there, counting nothing twice.
    await jumpToVID(page);
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    await callout(page).getByTestId("tour-next").click();
    await summaryControl(row(page, VI_D)).click();
    await expect(callout(page)).toHaveAttribute("data-step", "4");
    expect(tagsOf(events)).toEqual(["tour_start:1", "tour_step:1", "tour_step:2", "tour_step:3", "tour_step:4"]);
  });

  test("Restart from the closing card: no Back bar anywhere, step 1 again, and the next jump does not offer Back to VI.C", async ({ page }) => {
    const events = await captureTourEvents(page);
    await walkToClosing(page, events);
    await sawEvent(events, "tour_complete:7");
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "1");
    await expect(page.locator("#jumpbox")).toBeFocused();
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectNoBackBar(page);
    // The first jump of the new run: its Back bar, if any, names where it started, not VI.C.
    await jumpToVID(page);
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    await expect(page.locator("#return-trail")).toBeVisible();
    expect((await page.locator("#return-trail").textContent()) ?? "").not.toContain("VI.C");
    await expect(page.locator("#return-trail-ext:visible")).toHaveCount(0);
    // The run's own counts are kept: no second start, no step counted twice.
    await page.waitForTimeout(300);
    expect(tagsOf(events)).toEqual(FULL_RUN);
  });

  test("Restart after coming back with the browser's Back button (the reader may be restored with its Back bar) leaves no bar", async ({ page }) => {
    const events = await captureTourEvents(page);
    await walkToStep5(page);
    await sawEvent(events, "tour_step:5");
    await row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    await summaryControl(previewRow(page, REG7_IC1_A)).click();
    await expect(callout(page)).toHaveAttribute("data-step", "7");
    await sawEvent(events, "tour_step:7");
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    await expect(callout(page)).toHaveAttribute("data-step", "closing");
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "1");
    await expectNoBackBar(page);
    await jumpToVID(page);
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    expect((await page.locator("#return-trail").textContent()) ?? "").not.toContain("VI.C");
  });

  test("Restart on the preview (step 6) goes back to GP05's step 1 with no Back bar", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openAtStep(page, 6);
    await callout(page).getByTestId("tour-restart").click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05" && url.searchParams.get("tour") === "1");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "1");
    await expectNoBackBar(page);
    // The seeded run's counts are kept: nothing new is started.
    expect(tagsOf(events)).toEqual([]);
  });

  test("a reload resumes at the same step: 3 on GP05, 6 and 7 on the preview, the closing card at VI.C", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await jumpToVID(page);
    await callout(page).getByTestId("tour-next").click();
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await page.reload();
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await expect(callout(page)).toContainText("Open the plain-English summary.");
    // The reader re-lands the deep link a moment after it mounts; the control is on screen once that has settled.
    await expect.poll(() => inViewportNow(summaryControl(row(page, VI_D)))).toBe(true);

    for (const step of [6, 7] as const) {
      await openAtStep(page, step);
      await page.reload();
      await expect(page.locator("#preview-doc")).toBeVisible();
      await expect(callout(page), `step ${step}`).toHaveAttribute("data-step", String(step));
      await expect(callout(page)).toContainText(step === 6 ? "Open I.C.1.a's summary." : "Click Back to GP05 VI.C.");
      const anchor = step === 6 ? summaryControl(previewRow(page, REG7_IC1_A)) : page.locator("#preview-return");
      await expect(anchor).toHaveAttribute("data-tour-target", String(step));
      await expect.poll(() => inViewportNow(anchor), { message: `step ${step} anchor` }).toBe(true);
    }

    await openAtStep(page, "closing");
    await page.reload();
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "closing");
    await expect(count(page)).toHaveText(COMPLETE);
  });

  test("at 375px every callout docks to the bottom and leaves what it points at uncovered, on GP05 and on the preview", async ({ page }, testInfo) => {
    const H = 740;
    await page.setViewportSize({ width: 375, height: H });
    const events = await captureTourEvents(page);

    // 1 -- Tap Contents, type frequency, pick VI.D.
    await openTour(page);
    await expectDocked(page, 1, null, H);
    await expect(count(page)).toHaveText("Step 1 of 7");
    await expect(callout(page)).toContainText("You run storage tanks under GP05 using site-specific emission factors.");
    await expect(callout(page)).toContainText("Tap Contents, type frequency in the box at the top and pick VI.D from the matches.");
    await shot(page, testInfo, "tour-375-step1");
    // "Contents" stays above the dock and opens the sidebar with the jump box.
    const toggle = page.locator("#mobile-toggle");
    const tb = await boxOf(toggle);
    const cb1 = await boxOf(callout(page));
    expect(tb.y + tb.height).toBeLessThanOrEqual(cb1.y);
    await toggle.click();
    await expect(page.locator("#sidebar")).toHaveClass(/open/);
    await jumpToVID(page);
    // Landing closes the sidebar, so the provision is not behind it.
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/);

    // 2, 3, 4
    await expectDocked(page, 2, row(page, VI_D), H);
    await shot(page, testInfo, "tour-375-step2");
    await callout(page).getByTestId("tour-next").click();
    const control = summaryControl(row(page, VI_D));
    await expectDocked(page, 3, control, H);
    const dockTop = (await boxOf(callout(page))).y;
    expect(await inViewportNow(control, dockTop), "the control is above the dock the moment step 3 shows").toBe(true);
    await shot(page, testInfo, "tour-375-step3");
    await control.click();
    await expectDocked(page, 4, summaryPanel(row(page, VI_D)), H);
    await expect(callout(page).getByTestId("tour-official-controls")).toBeVisible();
    await expect(callout(page)).toContainText("Tap Contents, type VI.C and press Enter.");
    await shot(page, testInfo, "tour-375-step4");

    // 5
    await toggle.click();
    await jump(page, "VI.C");
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`);
    await expectDocked(page, 5, link, H);
    await shot(page, testInfo, "tour-375-step5");
    await sawEvent(events, "tour_step:5");

    // 6 -- the focused preview, docked like GP05.
    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    const aControl = summaryControl(previewRow(page, REG7_IC1_A));
    await expectDocked(page, 6, aControl, H);
    const dock6 = (await boxOf(callout(page))).y;
    expect(await inViewportNow(aControl, dock6), "I.C.1.a's control is above the dock the moment step 6 shows").toBe(true);
    await shot(page, testInfo, "tour-375-step6");

    // 7
    await aControl.click();
    const back = page.locator("#preview-return");
    await expectDocked(page, 7, back, H);
    await shot(page, testInfo, "tour-375-step7");
    await sawEvent(events, "tour_step:7");

    // The closing card, docked, with VI.C above it.
    await back.click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    await expectDocked(page, "closing", row(page, VI_C), H);
    await expect(count(page)).toHaveText(COMPLETE);
    await expect(callout(page).getByTestId("tour-trial")).toBeVisible();
    await shot(page, testInfo, "tour-375-closing");
    await sawEvent(events, "tour_complete:7");
    expect(tagsOf(events)).toEqual(FULL_RUN);
  });

  test("at 1100px the preview's gutter is too narrow for the card: it docks, and follows a resize both ways", async ({ page }) => {
    const H = 720;
    await page.setViewportSize({ width: 1100, height: H });
    await captureTourEvents(page);
    await openAtStep(page, 6);
    const aControl = summaryControl(previewRow(page, REG7_IC1_A));
    // A 190px gutter: docked like on a phone, with the control above the dock.
    await expectDocked(page, 6, aControl, H, 1100);
    // Wider: the card moves into the gutter, clear of the text.
    await page.setViewportSize({ width: 1280, height: H });
    await expectFloatingCorner(page, aControl);
    // Narrower again: docked.
    await page.setViewportSize({ width: 1100, height: H });
    await expectDocked(page, 6, aControl, H, 1100);
    await aControl.click();
    await expectDocked(page, 7, page.locator("#preview-return"), H, 1100);
  });

  test("outside the tour, a visitor's click on VI.C's Regulation 7 citation opens the locked popup, and its preview link carries VI.C", async ({ page }) => {
    await page.goto(`/regulations/gp05#${VI_C}`);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`).click();
    const panel = page.locator('#popup-body [data-testid="locked-destination"]');
    await expect(panel).toBeVisible();
    const preview = panel.locator("a.locked-secondary");
    await expect(preview).toHaveAttribute("href", `/regulations/7/preview?p=${REG7_IC1}&from=${VI_C}`);
    await expect(callout(page)).toHaveCount(0);
    // The preview draws the way back to where the visitor was (no tour: the plain reader link).
    await preview.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    const back = page.locator("#preview-return");
    await expect(back).toContainText("Back to GP05 · VI.C");
    await expect(back).toHaveAttribute("href", `/regulations/gp05#${VI_C}`);
    await expect(callout(page)).toHaveCount(0);
  });

  test("/sample leads with the walkthrough; the search and Ask example is collapsed and still opens", async ({ page }) => {
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    // The intro points at the walkthrough and at the comparison below it.
    await expect(page.locator("main")).toContainText("Walk through the research yourself, or compare the Search and Ask results below.");
    await expect(page.locator("main")).not.toContainText("Do the research once yourself");
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

  test("a stored v1 state (six steps) is ignored: ?tour=1 starts a fresh run", async ({ page }) => {
    const events = await captureTourEvents(page);
    await page.goto("/robots.txt");
    await page.evaluate(() =>
      sessionStorage.setItem("er:tour", JSON.stringify({ v: 1, step: 4, sid: "smoke-0000-0000-0000-000000000001", reported: [1, 2, 3, 4] }))
    );
    await page.goto(TOUR);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "1");
    await sawEvent(events, "tour_start:1");
    const stored = JSON.parse((await storedTour(page)) ?? "{}");
    expect(stored.v).toBe(2);
    expect(stored.step).toBe(1);
  });

  test("?tour=1 on another regulation is ignored: Regulation 7's reader is still a 404 for a visitor, with no tour", async ({ page }) => {
    await seedTour(page, 5);
    const res = await page.goto("/regulations/7?tour=1");
    expect(res?.status()).toBe(404);
    await expect(callout(page)).toHaveCount(0);
  });
});
