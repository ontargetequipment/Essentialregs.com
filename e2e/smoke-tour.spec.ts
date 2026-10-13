/**
 * Smoke test, the guided GP05 walkthrough (Sprint 6, 10 Oct 2026; seven
 * steps and a closing card in Sprint 7, 11 Oct 2026; an introduction, nine
 * steps, two citation hops, a spotlight and a card that never covers its
 * target in v3, 13 Oct 2026; src/lib/tour.ts, src/components/ReaderTour.tsx).
 * Anonymous: runs against every deployment, previews and production.
 * Read-only: every POST to /api/tour-event is answered here
 * (captureTourEvents), so a smoke run never writes a count. The
 * subscriber's version is in smoke-signed-in.spec.ts.
 *
 * The views, logged out:
 *   0  GP05 reader, where you are (Start)
 *   1  the jump box: type sampling, click the one match (VI.D)
 *   2  VI.D, Next                       3  VI.D's summary control
 *   4  the open summary, jump to VI.C   5  VI.C's Regulation 7 I.C.1 link
 *   6  the focused preview of I.C.1: open I.C.1.a's summary
 *   7  I.C.1.c's "Sections I.D." -> the focused preview of I.D
 *   8  the I.D preview's "Back to Regulation 7 · I.C.1" (then GP05 · VI.C)
 *   9  the I.C.1 preview's "Back to GP05 · VI.C"
 *   then the closing card, back at VI.C in the GP05 reader.
 *
 * At every step the card's box is measured against everything the step
 * asks the visitor to use (expectClear: the spotlit target, the open jump
 * results and their rows, the summary control and panel, the citation link,
 * the way-back pills) and must cover none of it, at 1280px and at 375px.
 * The rects of step 1 with the match list open are printed for the report.
 *
 * The ids in tour-helpers.ts are what the tour resolves "VI.D" and "VI.C" to
 * through the jump box (jumpTargetFor); the tour itself never hard-codes them.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, withProtectionBypass } from "./fixtures";
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  CLOSING,
  COMPLETE,
  FULL_RUN,
  INTRO_COUNT,
  OFFICIAL_CONTROLS,
  PREVIEW_ID,
  REG7_IC1,
  REG7_IC1_A,
  REG7_ID,
  REG7_ID_4,
  STEP_COUNT,
  TOUR,
  VI_C,
  VI_D,
  WAY_BACK,
  WAY_BACK_TO_IC1,
  boxOf,
  callout,
  captureTourEvents,
  describeRects,
  expectClear,
  expectDocked,
  expectNoBackBar,
  expectSpotlight,
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
  secondHopLink,
  seedTour,
  startTour,
  storedTour,
  storedTrail,
  summaryControl,
  summaryPanel,
  tagsOf,
  typeSampling,
  walkToClosing,
  walkToStep5,
} from "./tour-helpers";

/** On a wide reader page the card is in the reading pane or the sidebar column, never over the sidebar's edge or off screen. */
async function expectFixedOnPage(page: Page): Promise<void> {
  await expect(callout(page)).toHaveAttribute("data-mode", "anchored");
  await expect
    .poll(async () => {
      const c = await boxOf(callout(page));
      const vp = page.viewportSize()!;
      return c.x >= 0 && c.x + c.width <= vp.width + 1 && c.y >= 66 && c.y + c.height <= vp.height + 1;
    })
    .toBe(true);
}

/**
 * The visitor preview has no sidebar and is one centred text column. At 1280px
 * its gutter (280px) is wide enough for the card: fixed in a corner of the
 * gutter, as wide as the gutter allows less 12px each side (at most 296px),
 * below the site header -- and entirely to the right (or left) of
 * #preview-doc, so none of the column's text is under it, and clear of the
 * anchor.
 */
async function expectFloatingInGutter(page: Page, anchor: Locator): Promise<void> {
  const vp = page.viewportSize()!;
  const c = callout(page);
  await expect(c).toHaveAttribute("data-mode", "floating");
  await expect
    .poll(async () => {
      const cb = await boxOf(c);
      const doc = await boxOf(page.locator("#preview-doc"));
      return cb.width >= 220 && cb.width <= 297 && cb.y >= 66 && cb.y + cb.height <= vp.height && (cb.x >= doc.x + doc.width || cb.x + cb.width <= doc.x);
    }, { message: "the card is in the gutter beside the text column" })
    .toBe(true);
  await expect
    .poll(async () => !overlap(await boxOf(c), await boxOf(page.locator("#preview-doc"))), { message: "no part of #preview-doc is under the card" })
    .toBe(true);
  await expect
    .poll(async () => !overlap(await boxOf(c), await boxOf(anchor)), { message: "the card is never over its anchor" })
    .toBe(true);
}

const SHOTS_DIR = path.join(process.cwd(), "e2e-screenshots", "walkthrough-v3");
async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

/** The measured rects, in the test's output and its report. */
function report(testInfo: TestInfo, label: string, rects: { card: { x: number; y: number; width: number; height: number }; obstacles: { what: string; box: { x: number; y: number; width: number; height: number } }[] }): void {
  const line = `${label}: ${describeRects(rects.card, rects.obstacles)}`;
  console.log(line);
  testInfo.annotations.push({ type: "rects", description: line });
}

const count = (page: Page) => callout(page).getByTestId("tour-count");
const back = (page: Page) => page.locator("#preview-return");

test.describe("guided walkthrough", () => {
  test("logged out, the whole walkthrough at 1280px: the copy, the spotlight, a card clear of every target, the counts and the two hops back", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const events = await captureTourEvents(page);
    await openTour(page);
    const c = callout(page);

    // 0 -- where you are.
    await expect(count(page)).toHaveText(INTRO_COUNT);
    await expect(c).toContainText(
      "You're inside GP05, the General Permit for produced-water tank batteries. The box on the left (Contents on a phone) searches this permit only; the Search box in the header searches the whole library. Let's answer one real question in about a minute."
    );
    await expect(c.getByTestId("tour-start")).toHaveText("Start");
    await expect(c.getByTestId("tour-start")).toHaveClass(/bg-accent/);
    await expect(c.getByTestId("tour-skip")).toHaveText("Skip tour");
    await expect(c.getByTestId("tour-restart")).toBeVisible();
    await expectSpotlight(page, 0, page.locator("#jumpbox"));
    await expectFixedOnPage(page);
    await expect(c).toHaveAttribute("data-placement", "top-right");
    await expectClear(page, "step 0");
    await shot(page, testInfo, "tour-1280-step0");

    // 1 -- the scenario and the jump box, away from the card.
    await startTour(page);
    await expect(count(page)).toHaveText(`Step 1 of ${STEP_COUNT}`);
    await expect(c).toContainText("You run storage tanks under GP05 using site-specific emission factors. How often do you have to sample?");
    await expect(c).toContainText("Type sampling in the box. One match comes up — the site-specific sampling provision. Click it.");
    await expect(page.locator("#jumpbox")).toBeFocused();
    await expectSpotlight(page, 1, page.locator("#jumpbox"));
    await expectClear(page, "step 1 before typing");
    // Typed, not picked: nothing moves. Exactly one match, and it is spotlit; the card covers neither it nor the box.
    await typeSampling(page);
    await expect(page.locator("#jump-results .jr-item")).toHaveCount(1);
    await expect(page.locator("#jump-results .jr-item.jr-empty")).toHaveCount(0);
    const match = page.locator(`#jump-results .jr-item[data-slug="${VI_D}"]`);
    await expectSpotlight(page, 1, page.locator("#jumpbox"), match);
    report(testInfo, "1280px, step 1 with the match list open", await expectClear(page, "step 1 with the match list open"));
    await page.waitForTimeout(500);
    await expect(c).toHaveAttribute("data-step", "1");
    expect(new URL(page.url()).hash).toBe("");
    await shot(page, testInfo, "tour-1280-step1");
    // Picking VI.D from the matches is the step.
    await match.click();
    await expect(c).toHaveAttribute("data-step", "2");
    expect(new URL(page.url()).hash).toBe(`#${VI_D}`);
    await expect(row(page, VI_D)).toBeInViewport();

    // 2 -- VI.D as issued: the row is the target, so the card leaves the whole column.
    await expect(count(page)).toHaveText(`Step 2 of ${STEP_COUNT}`);
    await expect(c).toContainText("This is the regulation as issued. Table 2 below sets the parameters and frequency.");
    await expect(c.getByTestId("tour-next")).toHaveClass(/bg-accent/);
    await expectSpotlight(page, 2, row(page, VI_D));
    await expectFixedOnPage(page);
    await expectClear(page, "step 2");
    await shot(page, testInfo, "tour-1280-step2");
    await c.getByTestId("tour-next").click();

    // 3 -- VI.D's summary control, on screen with its card.
    await expect(c).toHaveAttribute("data-step", "3");
    await expect(count(page)).toHaveText(`Step 3 of ${STEP_COUNT}`);
    await expect(c).toContainText("Open the plain-English summary.");
    const control = summaryControl(row(page, VI_D));
    await expectSpotlight(page, 3, control);
    expect(await inViewportNow(control), "the control is on screen as soon as the card says so").toBe(true);
    await expect(summaryPanel(row(page, VI_D))).not.toHaveAttribute("open", "");
    await page.waitForTimeout(500);
    await expect(c).toHaveAttribute("data-step", "3");
    await expectFixedOnPage(page);
    await expectClear(page, "step 3");
    await shot(page, testInfo, "tour-1280-step3");
    await control.click();
    await expect(summaryPanel(row(page, VI_D))).toHaveAttribute("open", "");

    // 4 -- the summary is a reading aid; now VI.C: the card is clear of the open summary and of the jump box.
    await expect(c).toHaveAttribute("data-step", "4");
    await expect(count(page)).toHaveText(`Step 4 of ${STEP_COUNT}`);
    await expect(c.getByTestId("tour-official-controls")).toHaveText(OFFICIAL_CONTROLS);
    await expect(c.getByTestId("tour-official-controls")).toBeVisible();
    await expect(c).toContainText("Now jump to VI.C.");
    await expect(c).toContainText("Type VI.C in the jump box and press Enter.");
    await expectSpotlight(page, 4, page.locator("#jumpbox"));
    await expectFixedOnPage(page);
    await expectClear(page, "step 4");
    await shot(page, testInfo, "tour-1280-step4");
    await page.locator("#jumpbox").click();
    await page.locator("#jumpbox").fill("VI.C");
    await expect(page.locator("#jump-results")).toHaveClass(/show/);
    await expectClear(page, "step 4 with the jump results open");
    await page.locator("#jumpbox").press("Enter");

    // 5 -- VI.C's Regulation 7 citation.
    await expect(c).toHaveAttribute("data-step", "5");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
    await expect(count(page)).toHaveText(`Step 5 of ${STEP_COUNT}`);
    await expect(c).toContainText("Click the Regulation 7 citation.");
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="p=${REG7_IC1}"]`);
    await expectSpotlight(page, 5, link);
    await expect(link).toBeInViewport();
    await expectFixedOnPage(page);
    await expectClear(page, "step 5");
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
    await expect(count(page)).toHaveText(`Step 6 of ${STEP_COUNT}`);
    await expect(c).toContainText("This is the cited requirement. Open I.C.1.a's summary.");
    await expect(back(page)).toBeVisible();
    await expect(back(page)).toContainText("Back to GP05 · VI.C");
    await expect(back(page)).toHaveAttribute("href", WAY_BACK);
    await expect(back(page)).toHaveAttribute("data-hops", "1");
    await expect(page.getByTestId("preview-return-then")).toHaveCount(0);
    await expect(previewRow(page, REG7_IC1)).toBeVisible();
    const aControl = summaryControl(previewRow(page, REG7_IC1_A));
    await expectSpotlight(page, 6, aControl);
    expect(await inViewportNow(aControl), "I.C.1.a's control is on screen with the card").toBe(true);
    await expectFloatingInGutter(page, aControl);
    await expectClear(page, "step 6");
    await shot(page, testInfo, "tour-1280-step6");
    await expect(c.getByTestId("tour-trial")).toHaveCount(0);

    // 7 -- any summary of the cited provision's subtree opens; the second hop is spotlit.
    await aControl.click();
    await expect(summaryPanel(previewRow(page, REG7_IC1_A))).toHaveAttribute("open", "");
    await expect(c).toHaveAttribute("data-step", "7");
    await expect(count(page)).toHaveText(`Step 7 of ${STEP_COUNT}`);
    await expect(c).toContainText("Follow this one too.");
    await expect(c).toContainText("I.C.1.c cites Sections I.D., I.J., and I.K. Click I.D., highlighted in the text.");
    const hop = secondHopLink(page);
    await expect(hop).toHaveText("Sections I.D.");
    await expect(hop).toHaveAttribute("href", PREVIEW_ID);
    await expectSpotlight(page, 7, hop);
    expect(await inViewportNow(hop), "the second hop's link is on screen with the card").toBe(true);
    await expectFloatingInGutter(page, hop);
    await expectClear(page, "step 7");
    await shot(page, testInfo, "tour-1280-step7");
    await sawEvent(events, "tour_step:7");

    // 8 -- the I.D preview: I.D, I.D.4 (and the older public sample row under I.D.3), nothing locked; the bar remembers both hops.
    await hop.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_ID);
    expect(new URL(page.url()).searchParams.get("from")).toBe(REG7_IC1);
    expect(new URL(page.url()).searchParams.get("tour")).toBe("1");
    await expect(c).toHaveAttribute("data-step", "8");
    await expect(count(page)).toHaveText(`Step 8 of ${STEP_COUNT}`);
    await expect(c).toContainText("Click Back to Regulation 7 I.C.1.");
    await expect(c).toContainText("The bar remembers every hop you made.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("I.D.");
    await expect(previewRow(page, REG7_ID)).toContainText("Storage Tank Emission Controls");
    await expect(previewRow(page, REG7_ID_4)).toContainText("Alternative emissions control equipment");
    for (const locked of ["sec-7-B-I-D-1", "sec-7-B-I-D-2", "sec-7-B-I-D-3", "sec-7-B-I-D-4-a"]) await expect(previewRow(page, locked)).toHaveCount(0);
    await expect(page.getByTestId("locked-destination")).toHaveCount(0);
    await expect(page.getByTestId("locked-rest")).toBeVisible();
    await expect(back(page)).toContainText("Back to Regulation 7 · I.C.1");
    await expect(page.getByTestId("preview-return-then")).toHaveText("· then GP05 · VI.C");
    await expect(back(page)).toHaveAttribute("data-hops", "2");
    await expect(back(page)).toHaveAttribute("href", WAY_BACK_TO_IC1);
    expect(JSON.parse((await storedTrail(page)) ?? "[]").map((h: { id: string }) => h.id)).toEqual([VI_C, REG7_IC1]);
    await expectSpotlight(page, 8, back(page));
    expect(await inViewportNow(back(page)), "the way back is on screen with the card").toBe(true);
    await expectFloatingInGutter(page, back(page));
    await expectClear(page, "step 8");
    await shot(page, testInfo, "tour-1280-step8");

    // 9 -- back on the I.C.1 preview, one hop left.
    await back(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_IC1);
    expect(new URL(page.url()).searchParams.get("from")).toBe(VI_C);
    expect(new URL(page.url()).searchParams.get("tour")).toBe("1");
    await expect(c).toHaveAttribute("data-step", "9");
    await expect(count(page)).toHaveText(`Step 9 of ${STEP_COUNT}`);
    await expect(c).toContainText("Click Back to GP05 VI.C.");
    await expect(back(page)).toContainText("Back to GP05 · VI.C");
    await expect(back(page)).toHaveAttribute("href", WAY_BACK);
    await expect(back(page)).toHaveAttribute("data-hops", "1");
    await expect(page.getByTestId("preview-return-then")).toHaveCount(0);
    expect(JSON.parse((await storedTrail(page)) ?? "[]").map((h: { id: string }) => h.id)).toEqual([VI_C]);
    await expectSpotlight(page, 9, back(page));
    expect(await inViewportNow(back(page)), "the way back is on screen with the card").toBe(true);
    await expectFloatingInGutter(page, back(page));
    await expectClear(page, "step 9");
    await shot(page, testInfo, "tour-1280-step9");

    // The closing card: back at VI.C in the GP05 reader, the spotlight on its button.
    await back(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    const home = new URL(page.url());
    expect(home.searchParams.get("tour")).toBe("1");
    expect(home.hash).toBe(`#${VI_C}`);
    await expect(c).toHaveAttribute("data-step", "closing");
    await expect(count(page)).toHaveText(COMPLETE);
    await expect(c.getByTestId("tour-closing")).toHaveText(CLOSING);
    await expect(row(page, VI_C)).toBeInViewport();
    await expectFixedOnPage(page);
    const explore = c.getByTestId("tour-explore");
    await expect(explore).toHaveText("Explore GP05 yourself");
    await expect(explore).toHaveClass(/bg-accent/);
    await expect(explore).toHaveRole("button");
    await expect(c.getByTestId("tour-trial")).toHaveText("Start your 7-day trial");
    await expect(c.getByTestId("tour-trial")).toHaveAttribute("href", "/signup");
    await expect(c.getByTestId("tour-trial")).toHaveClass(/tour-secondary/);
    await expect(c.getByTestId("tour-skip")).toHaveText("End tour");
    await expect(c.getByTestId("tour-restart")).toBeVisible();
    await expectSpotlight(page, "closing", explore);
    await expectNoBackBar(page);
    await expectClear(page, "the closing card");
    expect(await storedTrail(page)).toBeNull();
    await shot(page, testInfo, "tour-1280-closing");

    await sawEvent(events, "tour_complete:9");
    expect(tagsOf(events)).toEqual(FULL_RUN);

    // Explore GP05 yourself: the tour is over, in place, the spotlight gone.
    await explore.click();
    await expect(callout(page)).toHaveCount(0);
    await expect(page.locator("[data-tour-target]")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/regulations/gp05");
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
    await expect(row(page, VI_C)).toBeInViewport();
    expect(await storedTour(page)).toBeNull();
    expect(tagsOf(events)).toEqual(FULL_RUN);
  });

  test("step 1 moves on only when the reader lands on VI.D through the jump box", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    await startTour(page);
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
    // Clicked by script: the link sits far down a collapsed tree.
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
    await typeSampling(page);
    await stays("sampling typed, nothing picked");
    expect(tagsOf(events)).toEqual(["tour_start:0", "tour_step:0", "tour_step:1"]);

    // Enter in the jump box on the VI.D match is the jump box: it moves on.
    await jumpToVIDByKeyboard(page);
    await expect(c).toHaveAttribute("data-step", "2");
    expect(tagsOf(events)).toEqual(["tour_start:0", "tour_step:0", "tour_step:1", "tour_step:2"]);
  });

  test("step 1 also takes a citation typed with Enter (VI.D), as the jump box resolves it", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await startTour(page);
    await jump(page, "VI.D");
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    expect(new URL(page.url()).hash).toBe(`#${VI_D}`);
  });

  test("step 3's control is on screen the moment its card is: the scroll is instant, before the card shows", async ({ page }) => {
    await captureTourEvents(page);
    await openTour(page);
    await startTour(page);
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

  test("the spotlight pulses once and moves no layout: outline and shadow only, none for reduced motion", async ({ page, browser, baseURL }) => {
    await captureTourEvents(page);
    await openTour(page);
    const box = page.locator("#jumpbox");
    await expect(box).toHaveAttribute("data-tour-target", "0");
    const styled = await box.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, width: s.outlineWidth, animation: s.animationName, rect: el.getBoundingClientRect().toJSON() as { width: number; height: number } };
    });
    expect(styled.outline).toBe("solid");
    expect(styled.width).toBe("2px");
    expect(styled.animation).toBe("tour-spotlight");
    // Taking the spotlight off changes no size.
    const plain = await box.evaluate((el) => {
      el.removeAttribute("data-tour-target");
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(plain.width).toBe(styled.rect.width);
    expect(plain.height).toBe(styled.rect.height);
    // A visitor who asked for less motion gets the ring without the pulse.
    // A context of its own (the fixture's carries the deployment's protection bypass; this one must too).
    const quiet = await browser.newContext({ reducedMotion: "reduce", baseURL });
    await withProtectionBypass(quiet, baseURL);
    const p2 = await quiet.newPage();
    await captureTourEvents(p2);
    await openTour(p2);
    expect(await p2.locator("#jumpbox").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    expect(await p2.locator("#jumpbox").evaluate((el) => getComputedStyle(el).outlineWidth)).toBe("2px");
    await quiet.close();
  });

  test("the closing card's \"Explore GP05 yourself\" ends the tour on the reader, in place at VI.C", async ({ page }) => {
    await captureTourEvents(page);
    await openAtStep(page, "closing");
    await callout(page).getByTestId("tour-explore").click();
    await expect(callout(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/regulations/gp05");
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(page.locator("[data-tour-target]")).toHaveCount(0);
    expect(await storedTour(page)).toBeNull();
    // A reload shows no tour.
    await page.reload();
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await page.waitForTimeout(300);
    await expect(callout(page)).toHaveCount(0);
  });

  test("the closing card's \"Start your 7-day trial\" goes to the trial start and is counted", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openAtStep(page, "closing");
    await callout(page).getByTestId("tour-trial").click();
    await page.waitForURL((url) => url.pathname === "/signup");
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    expect(events).toContainEqual({ event: "tour_trial_click", step: 9 });
    expect(await storedTour(page)).toBeNull();
  });

  test("Skip at every step, and End tour on the closing card, clears the tour without reloading; a reload shows no tour", async ({ page }) => {
    test.setTimeout(120_000);
    const events = await captureTourEvents(page);
    for (const step of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "closing"] as const) {
      await openAtStep(page, step);
      await page.evaluate(() => {
        (window as unknown as { __kept?: boolean }).__kept = true;
      });
      await callout(page).getByTestId("tour-skip").click();
      await expect(callout(page), `step ${step}`).toHaveCount(0);
      await expect(page.locator("[data-tour-target]"), `step ${step}: the spotlight goes`).toHaveCount(0);
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
    // The step shown is the step sent (the closing card counts as 9).
    expect(events.filter((e) => e.event === "tour_skip").map((e) => e.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9]);
  });

  test("Restart at step 4 goes back to the introduction with no Back bar; Start focuses the jump box; the counts are not repeated", async ({ page }) => {
    const events = await captureTourEvents(page);
    await openTour(page);
    await startTour(page);
    await jumpToVID(page);
    await callout(page).getByTestId("tour-next").click();
    await summaryControl(row(page, VI_D)).click();
    await expect(callout(page)).toHaveAttribute("data-step", "4");
    // The jump left a Back bar behind.
    await expect(page.locator("#return-trail")).toBeVisible();
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "0");
    expect(new URL(page.url()).hash).toBe("");
    await expectNoBackBar(page);
    await expect(summaryPanel(row(page, VI_D))).not.toHaveAttribute("open", "");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await startTour(page);
    await expect(page.locator("#jumpbox")).toBeFocused();
    // And it runs again from there, counting nothing twice.
    await jumpToVID(page);
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    await callout(page).getByTestId("tour-next").click();
    await summaryControl(row(page, VI_D)).click();
    await expect(callout(page)).toHaveAttribute("data-step", "4");
    expect(tagsOf(events)).toEqual(["tour_start:0", "tour_step:0", "tour_step:1", "tour_step:2", "tour_step:3", "tour_step:4"]);
  });

  test("Restart from the closing card: no Back bar anywhere, the introduction again, and the next jump does not offer Back to VI.C", async ({ page }) => {
    test.setTimeout(120_000);
    const events = await captureTourEvents(page);
    await walkToClosing(page, events);
    await sawEvent(events, "tour_complete:9");
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "0");
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectNoBackBar(page);
    expect(await storedTrail(page)).toBeNull();
    await startTour(page);
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
    await row(page, VI_C).locator(`a.xref-external-reg[href$="p=${REG7_IC1}"]`).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    await summaryControl(previewRow(page, REG7_IC1_A)).click();
    await expect(callout(page)).toHaveAttribute("data-step", "7");
    await sawEvent(events, "tour_step:7");
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    // Back before the Regulation 7 steps were done: the citation is still to click.
    await expect(callout(page)).toHaveAttribute("data-step", "5");
    await callout(page).getByTestId("tour-restart").click();
    await expect(callout(page)).toHaveAttribute("data-step", "0");
    await expectNoBackBar(page);
    await startTour(page);
    await jumpToVID(page);
    await expect(callout(page)).toHaveAttribute("data-step", "2");
    expect((await page.locator("#return-trail").textContent()) ?? "").not.toContain("VI.C");
  });

  test("Restart on the previews (steps 6 and 8) goes back to GP05's introduction with no Back bar and no trail", async ({ page }) => {
    const events = await captureTourEvents(page);
    for (const step of [6, 8] as const) {
      await openAtStep(page, step);
      await callout(page).getByTestId("tour-restart").click();
      await page.waitForURL((url) => url.pathname === "/regulations/gp05" && url.searchParams.get("tour") === "1");
      await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
      await expect(callout(page)).toHaveAttribute("data-step", "0");
      await expectNoBackBar(page);
      expect(await storedTrail(page)).toBeNull();
    }
    // The seeded run's counts are kept: nothing new is started.
    expect(tagsOf(events)).toEqual([]);
  });

  test("a reload resumes at the same step: 3 on GP05, 6 and 7 on the I.C.1 preview, 8 on the I.D preview, 9 on I.C.1, the closing card at VI.C", async ({ page }) => {
    test.setTimeout(120_000);
    await captureTourEvents(page);
    await openTour(page);
    await startTour(page);
    await jumpToVID(page);
    await callout(page).getByTestId("tour-next").click();
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await page.reload();
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "3");
    await expect(callout(page)).toContainText("Open the plain-English summary.");
    // The reader re-lands the deep link a moment after it mounts; the control is on screen once that has settled.
    await expect.poll(() => inViewportNow(summaryControl(row(page, VI_D)))).toBe(true);

    const anchors: Record<number, (p: Page) => Locator> = {
      6: (p) => summaryControl(previewRow(p, REG7_IC1_A)),
      7: (p) => secondHopLink(p),
      8: (p) => p.locator("#preview-return"),
      9: (p) => p.locator("#preview-return"),
    };
    const copy: Record<number, string> = { 6: "Open I.C.1.a's summary.", 7: "Follow this one too.", 8: "Click Back to Regulation 7 I.C.1.", 9: "Click Back to GP05 VI.C." };
    for (const step of [6, 7, 8, 9] as const) {
      await openAtStep(page, step);
      await page.reload();
      await expect(page.locator("#preview-doc")).toBeVisible();
      await expect(callout(page), `step ${step}`).toHaveAttribute("data-step", String(step));
      await expect(callout(page)).toContainText(copy[step]);
      const anchor = anchors[step](page);
      await expect(anchor).toHaveAttribute("data-tour-target", String(step));
      await expect.poll(() => inViewportNow(anchor), { message: `step ${step} anchor` }).toBe(true);
      await expectClear(page, `step ${step} after a reload`);
    }

    await openAtStep(page, "closing");
    await page.reload();
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "closing");
    await expect(count(page)).toHaveText(COMPLETE);
  });

  test("at 375px every callout docks to the bottom and leaves what it points at uncovered, on GP05 and on both previews", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const H = 740;
    await page.setViewportSize({ width: 375, height: H });
    const events = await captureTourEvents(page);

    // 0 -- where you are.
    await openTour(page);
    await expectDocked(page, 0, null, H);
    await expect(count(page)).toHaveText(INTRO_COUNT);
    await expect(callout(page)).toContainText("The box on the left (Contents on a phone) searches this permit only");
    await shot(page, testInfo, "tour-375-step0");
    await startTour(page);

    // 1 -- Tap Contents, type sampling, tap the one match.
    await expectDocked(page, 1, null, H);
    await expect(count(page)).toHaveText(`Step 1 of ${STEP_COUNT}`);
    await expect(callout(page)).toContainText("You run storage tanks under GP05 using site-specific emission factors.");
    await expect(callout(page)).toContainText("Tap Contents, then type sampling in the box at the top. One match comes up — the site-specific sampling provision. Tap it.");
    // "Contents" stays above the dock and opens the sidebar with the jump box.
    const toggle = page.locator("#mobile-toggle");
    const tb = await boxOf(toggle);
    const cb1 = await boxOf(callout(page));
    expect(tb.y + tb.height).toBeLessThanOrEqual(cb1.y);
    await toggle.click();
    await expect(page.locator("#sidebar")).toHaveClass(/open/);
    await typeSampling(page);
    const match = page.locator(`#jump-results .jr-item[data-slug="${VI_D}"]`);
    await expectSpotlight(page, 1, page.locator("#jumpbox"), match);
    // The open sidebar sits over the site header (z 55 over 45) and scrolls its own header away to show the box at the top.
    const dock1 = (await boxOf(callout(page))).y;
    expect(await inViewportNow(page.locator("#jumpbox"), dock1, 0), "the box is above the dock").toBe(true);
    expect(await inViewportNow(match, dock1, 0), "the one match is above the dock").toBe(true);
    report(testInfo, "375px, step 1 with the match list open", await expectClear(page, "step 1 with the match list open, 375px"));
    await shot(page, testInfo, "tour-375-step1");
    await match.click();
    // Landing closes the sidebar, so the provision is not behind it.
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/);

    // 2, 3, 4
    await expectDocked(page, 2, row(page, VI_D), H);
    await expectClear(page, "step 2, 375px");
    await shot(page, testInfo, "tour-375-step2");
    await callout(page).getByTestId("tour-next").click();
    const control = summaryControl(row(page, VI_D));
    await expectDocked(page, 3, control, H);
    const dockTop = (await boxOf(callout(page))).y;
    expect(await inViewportNow(control, dockTop), "the control is above the dock the moment step 3 shows").toBe(true);
    await expectClear(page, "step 3, 375px");
    await shot(page, testInfo, "tour-375-step3");
    await control.click();
    await expectDocked(page, 4, summaryPanel(row(page, VI_D)), H);
    await expect(callout(page).getByTestId("tour-official-controls")).toBeVisible();
    await expect(callout(page)).toContainText("Tap Contents, type VI.C and press Enter.");
    await expectClear(page, "step 4, 375px");
    await shot(page, testInfo, "tour-375-step4");

    // 5
    await toggle.click();
    await jump(page, "VI.C");
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="p=${REG7_IC1}"]`);
    await expectDocked(page, 5, link, H);
    await expectClear(page, "step 5, 375px");
    await shot(page, testInfo, "tour-375-step5");
    await sawEvent(events, "tour_step:5");

    // 6 -- the focused preview, docked like GP05.
    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    const aControl = summaryControl(previewRow(page, REG7_IC1_A));
    await expectDocked(page, 6, aControl, H);
    const dock6 = (await boxOf(callout(page))).y;
    expect(await inViewportNow(aControl, dock6), "I.C.1.a's control is above the dock the moment step 6 shows").toBe(true);
    await expectClear(page, "step 6, 375px");
    await shot(page, testInfo, "tour-375-step6");

    // 7 -- the second hop.
    await aControl.click();
    await expectDocked(page, 7, secondHopLink(page), H);
    await expectClear(page, "step 7, 375px");
    await shot(page, testInfo, "tour-375-step7");
    await sawEvent(events, "tour_step:7");

    // 8 -- the I.D preview, its way back naming both hops.
    await secondHopLink(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_ID);
    await expectDocked(page, 8, back(page), H);
    await expect(back(page)).toContainText("Back to Regulation 7 · I.C.1");
    await expect(page.getByTestId("preview-return-then")).toHaveText("· then GP05 · VI.C");
    await expectClear(page, "step 8, 375px");
    await shot(page, testInfo, "tour-375-step8");

    // 9 -- I.C.1 again.
    await back(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_IC1);
    await expectDocked(page, 9, back(page), H);
    await expect(back(page)).toContainText("Back to GP05 · VI.C");
    await expectClear(page, "step 9, 375px");
    await shot(page, testInfo, "tour-375-step9");

    // The closing card, docked, with VI.C above it.
    await back(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
    await expectDocked(page, "closing", row(page, VI_C), H);
    await expect(count(page)).toHaveText(COMPLETE);
    await expect(callout(page).getByTestId("tour-trial")).toBeVisible();
    await expect(callout(page).getByTestId("tour-explore")).toHaveClass(/bg-accent/);
    await shot(page, testInfo, "tour-375-closing");
    await sawEvent(events, "tour_complete:9");
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
    await expectFloatingInGutter(page, aControl);
    // Narrower again: docked.
    await page.setViewportSize({ width: 1100, height: H });
    await expectDocked(page, 6, aControl, H, 1100);
    await aControl.click();
    await expectDocked(page, 7, secondHopLink(page), H, 1100);
  });

  test("outside the tour, a visitor's click on VI.C's Regulation 7 citation shows the public row in the popup, and its preview link carries VI.C", async ({ page }) => {
    await page.goto(`/regulations/gp05#${VI_C}`);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await row(page, VI_C).locator(`a.xref-external-reg[href$="p=${REG7_IC1}"]`).click();
    // I.C.1 is public (11 Oct 2026): the popup reads it instead of saying it is in the full corpus.
    const popup = page.locator("#popup-body");
    await expect(popup).toContainText("manufacturer specifications and documentation of compliance");
    await expect(popup.getByTestId("locked-destination")).toHaveCount(0);
    const preview = page.locator("#popup-goto");
    await expect(preview).toHaveAttribute("href", `/regulations/7/preview?p=${REG7_IC1}&from=${VI_C}`);
    await expect(callout(page)).toHaveCount(0);
    // The preview draws the way back to where the visitor was (no tour: the plain reader link).
    await preview.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    await expect(back(page)).toContainText("Back to GP05 · VI.C");
    await expect(back(page)).toHaveAttribute("href", `/regulations/gp05#${VI_C}`);
    await expect(callout(page)).toHaveCount(0);
    // The second hop outside the tour: I.C.1.c's "Sections I.D." opens the I.D preview with no tour, which remembers both hops
    // (the link carries them: this page's own origin after its id).
    const hop = previewRow(page, "sec-7-B-I-C-1-c").locator(`a.xref[href^="/regulations/7/preview?p=${REG7_ID}"]`);
    await expect(hop).toHaveAttribute("href", `/regulations/7/preview?p=${REG7_ID}&from=${REG7_IC1}&from=${VI_C}`);
    await hop.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_ID);
    expect(new URL(page.url()).searchParams.get("tour")).toBeNull();
    await expect(back(page)).toContainText("Back to Regulation 7 · I.C.1");
    await expect(page.getByTestId("preview-return-then")).toHaveText("· then GP05 · VI.C");
    await expect(back(page)).toHaveAttribute("href", `/regulations/7/preview?p=${REG7_IC1}&from=${VI_C}`);
    await expect(callout(page)).toHaveCount(0);
    await back(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_IC1);
    await expect(back(page)).toContainText("Back to GP05 · VI.C");
    await expect(page.getByTestId("preview-return-then")).toHaveCount(0);
    await back(page).click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
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

  test("a stored v2 state (seven steps) is ignored: ?tour=1 starts a fresh run at the introduction", async ({ page }) => {
    const events = await captureTourEvents(page);
    await page.goto("/robots.txt");
    await page.evaluate(() =>
      sessionStorage.setItem("er:tour", JSON.stringify({ v: 2, step: 4, done: false, completed: false, sid: "smoke-0000-0000-0000-000000000001", reported: [1, 2, 3, 4] }))
    );
    await page.goto(TOUR);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(callout(page)).toHaveAttribute("data-step", "0");
    await sawEvent(events, "tour_start:0");
    const stored = JSON.parse((await storedTour(page)) ?? "{}");
    expect(stored.v).toBe(3);
    expect(stored.step).toBe(0);
  });

  test("?tour=1 on another regulation is ignored: Regulation 7's reader is not shown to a visitor (it redirects to the preview), with no tour", async ({ page }) => {
    await seedTour(page, 5);
    // Sprint 8: no reader, and no 404 either -- the redirect page sends a visitor to the plain preview.
    const res = await page.goto("/regulations/7?tour=1");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#doc")).toHaveCount(0);
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview");
    await expect(callout(page)).toHaveCount(0);
  });
});
