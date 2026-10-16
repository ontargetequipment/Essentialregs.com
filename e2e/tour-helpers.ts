/**
 * Helpers shared by the walkthrough smoke tests (smoke-tour.spec.ts, and the
 * subscriber's run in smoke-signed-in.spec.ts). Not a spec: nothing here
 * registers a test.
 *
 * The ids below are what the tour resolves "VI.D" and "VI.C" to through the
 * jump box (jumpTargetFor), the Regulation 7 provision VI.C cites, and the
 * one I.C.1.c cites (the second hop, v3); the tour itself never hard-codes
 * them.
 */
import { expect, withProtectionBypass } from "./fixtures";
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";

export const TOUR = "/regulations/gp05?tour=1";
export const VI_D = "sec-gp05-VI-D";
export const VI_C = "sec-gp05-VI-C";
export const REG7_IC1 = "sec-7-B-I-C-1";
export const REG7_IC1_A = `${REG7_IC1}-a`;
export const REG7_IC1_C = `${REG7_IC1}-c`;
/** The second hop (v3, 13 Oct 2026): I.D, Storage Tank Emission Controls, and its one public child. */
export const REG7_ID = "sec-7-B-I-D";
export const REG7_ID_4 = `${REG7_ID}-4`;
export const STORAGE_KEY = "er:tour";
export const TRAIL_KEY = "er:preview-trail";
export const OFFICIAL_CONTROLS = "The official text controls; the summary is a reading aid.";
/** Where a visitor's step-5 click goes (the focused preview), and where the way back from it goes. */
export const PREVIEW = `/regulations/7/preview?p=${REG7_IC1}&from=${VI_C}&tour=1`;
export const WAY_BACK = `/regulations/gp05?tour=1#${VI_C}`;
/**
 * Where step 7's click goes (the I.D preview, from I.C.1, with GP05 VI.C behind it: the URL carries the hops as repeated
 * from= values, nearest first), and its way back to the I.C.1 preview, which carries VI.C as that page's own from=.
 */
export const PREVIEW_ID = `/regulations/7/preview?p=${REG7_ID}&from=${REG7_IC1}&from=${VI_C}&tour=1`;
export const WAY_BACK_TO_IC1 = `/regulations/7/preview?p=${REG7_IC1}&from=${VI_C}&tour=1`;
/** The count line and the copy of the closing card. */
export const INTRO_COUNT = "Guided walkthrough";
export const COMPLETE = "Walkthrough complete";
export const CLOSING =
  "You found a requirement without knowing its number, read it, checked the summary, followed its citations two documents deep and came back. Every document in the library reads this way.";
export const STEP_COUNT = 9;

/** The reader's row by id: #doc's child, never the popup's clone. */
export const row = (page: Page, id: string) => page.locator(`#doc > [id="${id}"]`);
/** The visitor preview's row by id: a direct child of #preview-doc. */
export const previewRow = (page: Page, id: string) => page.locator(`#preview-doc > [id="${id}"]`);
export const summaryPanel = (rowLocator: Locator) => rowLocator.locator(":scope > details.summary-panel");
export const summaryControl = (rowLocator: Locator) => rowLocator.locator(":scope > details.summary-panel > summary");
export const callout = (page: Page) => page.getByTestId("tour-callout");
/** Step 7's link on the preview: I.C.1.c's "Sections I.D.", rewritten to the I.D preview with from= and tour=1. */
export const secondHopLink = (page: Page) => previewRow(page, REG7_IC1_C).locator(`a.xref[href^="/regulations/7/preview?p=${REG7_ID}"]`);
/** The same reference in a subscriber's reader: the span the reader's popup opens. */
export const secondHopSpan = (page: Page) => row(page, REG7_IC1_C).locator(`span.xref[data-target="${REG7_ID}"]`);

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

/**
 * The events of a whole run, in order: the start (the introduction, 0),
 * each view as it is reached, the completion (9). tour_events.step takes
 * 0-9 since migration 20261013034619.
 */
export const FULL_RUN = [
  "tour_start:0",
  "tour_step:0",
  "tour_step:1",
  "tour_step:2",
  "tour_step:3",
  "tour_step:4",
  "tour_step:5",
  "tour_step:6",
  "tour_step:7",
  "tour_step:8",
  "tour_step:9",
  "tour_complete:9",
];

/**
 * A tour already at `step`, as a reload or an earlier page would have left it
 * in sessionStorage (state v3). `done` is the closing card (GP05 at VI.C
 * after step 9).
 */
export async function seedTour(page: Page, step: number, opts: { done?: boolean } = {}): Promise<void> {
  await page.goto("/robots.txt");
  await page.evaluate(
    ([key, s, done]) =>
      sessionStorage.setItem(
        key as string,
        JSON.stringify({
          v: 3,
          step: s,
          done,
          completed: done,
          sid: "smoke-0000-0000-0000-000000000000",
          reported: Array.from({ length: (s as number) + 1 }, (_, i) => i),
        })
      ),
    [STORAGE_KEY, step, opts.done === true]
  );
}

export async function storedTour(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);
}

export async function storedTrail(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), TRAIL_KEY);
}

/** A fresh tour: GP05 with the introduction up. */
export async function openTour(page: Page, step: number | string = 0): Promise<void> {
  await page.goto(TOUR);
  await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
  await expect(callout(page)).toHaveAttribute("data-step", String(step));
}

/** The introduction's Start: step 1. */
export async function startTour(page: Page): Promise<void> {
  await callout(page).getByTestId("tour-start").click();
  await expect(callout(page)).toHaveAttribute("data-step", "1");
}

/** A seeded tour at `step` ("closing": the finished tour) on the page that step belongs to. */
export async function openAtStep(page: Page, step: number | "closing"): Promise<void> {
  if (step === "closing") {
    await seedTour(page, STEP_COUNT, { done: true });
    await page.goto(`/regulations/gp05?tour=1#${VI_C}`);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
  } else if (step === 8) {
    await seedTour(page, step);
    await page.goto(PREVIEW_ID);
    await expect(page.locator("#preview-doc")).toBeVisible();
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

/** Step 1 the way the copy says: type sampling, click the one match. */
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
 * below the 66px site header (`topLimit`: 0 inside a phone's open sidebar,
 * which sits over the header) and above the bottom of the viewport. For
 * "the control is in view the moment the card shows" -- an
 * expect(...).toBeInViewport() would wait out a smooth scroll and hide the
 * very bug this is for.
 */
export async function inViewportNow(locator: Locator, bottomLimit?: number, topLimit = 66): Promise<boolean> {
  return locator.evaluate(
    (el, [bottom, top]) => {
      const r = el.getBoundingClientRect();
      return r.top >= (top as number) && r.bottom <= ((bottom as number | undefined) ?? window.innerHeight) && r.left >= 0 && r.right <= window.innerWidth;
    },
    [bottomLimit, topLimit] as const
  );
}

/** No "Back to ..." bar is visible: the in-document bar is hidden and so is the link to another regulation. */
export async function expectNoBackBar(page: Page): Promise<void> {
  await expect(page.locator("#return-trail")).toBeHidden();
  await expect(page.locator("#return-trail-ext:visible")).toHaveCount(0);
  await expect(page.locator("#return-trail-back:visible")).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// The card never covers what the step asks for (v3)
// ---------------------------------------------------------------------------

/** One measured element: its box and what it is, for the report. */
export type Measured = { what: string; box: Box };

/**
 * What the card must not cover, measured right now: every spotlit element
 * (data-tour-target: the step's target, and at step 1 the match in the
 * results), the open jump results and each of their rows, the way-back
 * pills, the summary control and open panel of VI.D, and the citation link
 * in VI.C. Only elements with a box on screen are listed. A whole row (the
 * VI.D row at step 2, which runs past the bottom of any viewport) counts by
 * its first 48px, the lines the visitor must see to know where they are
 * (ReaderTour's bringIntoView keeps the same); a spotlit element inside the
 * card itself (the closing card's button) is the card's own.
 */
export async function obstaclesNow(page: Page): Promise<Measured[]> {
  return page.evaluate(() => {
    const out: { what: string; box: { x: number; y: number; width: number; height: number } }[] = [];
    const seen = new Set<Element>();
    const add = (el: Element | null, what: string) => {
      if (!el || seen.has(el) || el.closest('[data-testid="tour-callout"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      if (r.bottom <= 0 || r.top >= window.innerHeight) return; // off screen: nothing to cover
      seen.add(el);
      const wholeRow = el.matches("#doc > [id], #preview-doc > [id]");
      out.push({ what: wholeRow ? `${what} (first lines)` : what, box: { x: r.left, y: r.top, width: r.width, height: wholeRow ? Math.min(r.height, 48) : r.height } });
    };
    for (const el of document.querySelectorAll("[data-tour-target]")) add(el, `target ${el.id || el.className || el.tagName} (step ${el.getAttribute("data-tour-target")})`);
    const results = document.getElementById("jump-results");
    if (results?.classList.contains("show")) {
      add(results, "jump results");
      for (const item of results.querySelectorAll(".jr-item")) add(item, `jump result ${item.getAttribute("data-slug") ?? ""}`);
    }
    for (const id of ["return-trail-back", "return-trail-ext", "preview-return"]) {
      const el = document.getElementById(id);
      const bar = el?.closest("#return-trail") as HTMLElement | null;
      if (el && !(el as HTMLElement).hidden && !(bar && bar.hidden)) add(el, `back bar #${id}`);
    }
    const vid = document.querySelector('#doc > [id="sec-gp05-VI-D"]');
    if (vid) {
      // The control, not the open panel's body: VI.D's real summary runs
      // past a 375px viewport, so a docked card must be allowed under its
      // tail (the page pads for the dock; the visitor scrolls). The card
      // never covers the toggle itself.
      add(vid.querySelector(":scope > details.summary-panel > summary"), "VI.D summary control");
    }
    const vic = document.querySelector('#doc > [id="sec-gp05-VI-C"]');
    if (vic) add(vic.querySelector('a.xref-external-reg[href*="sec-7-B-I-C-1"]'), "VI.C citation link");
    return out;
  });
}

/** The card's box and every obstacle's, as one line for the report. */
export function describeRects(card: Box, obstacles: Measured[]): string {
  const fmt = (b: Box) => `x ${Math.round(b.x)}-${Math.round(b.x + b.width)}, y ${Math.round(b.y)}-${Math.round(b.y + b.height)}`;
  return [`card: ${fmt(card)}`, ...obstacles.map((o) => `${o.what}: ${fmt(o.box)}`)].join("; ");
}

/**
 * The card's box covers none of the obstacles (obstaclesNow), settled: the
 * check is repeated until it holds, so a card still being placed does not
 * fail it, and the final rects are returned for the report.
 */
export async function expectClear(page: Page, label: string): Promise<{ card: Box; obstacles: Measured[] }> {
  let last = { card: { x: 0, y: 0, width: 0, height: 0 }, obstacles: [] as Measured[] };
  await expect
    .poll(
      async () => {
        const card = await boxOf(callout(page));
        const obstacles = await obstaclesNow(page);
        last = { card, obstacles };
        const covered = obstacles.filter((o) => overlap(card, o.box));
        return covered.length ? `${label}: the card covers ${covered.map((o) => o.what).join(", ")} -- ${describeRects(card, obstacles)}` : "clear";
      },
      { message: label }
    )
    .toBe("clear");
  return last;
}

/** The spotlight is on exactly these elements, with the step's number. */
export async function expectSpotlight(page: Page, step: number | string, ...targets: Locator[]): Promise<void> {
  for (const t of targets) await expect(t).toHaveAttribute("data-tour-target", String(step));
  await expect(page.locator("[data-tour-target]")).toHaveCount(targets.length);
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

/** Steps 0-4 done by hand, as a visitor would (Start, jump box, Next, the summary, VI.C): the tour ends up at step 5, VI.C on screen. */
export async function walkToStep5(page: Page): Promise<void> {
  await openTour(page);
  await startTour(page);
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
 * steps 0-5 on GP05, the I.C.1 preview for 6 and 7, the I.D preview for 8,
 * I.C.1 again for 9, and the way back.
 */
export async function walkToClosing(page: Page, events: { event: string; step: number }[]): Promise<void> {
  await walkToStep5(page);
  await sawEvent(events, "tour_step:5");
  await row(page, VI_C).locator(`a.xref-external-reg[href$="p=${REG7_IC1}"]`).click();
  await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_IC1);
  await expect(callout(page)).toHaveAttribute("data-step", "6");
  await summaryControl(previewRow(page, REG7_IC1_A)).click();
  await expect(callout(page)).toHaveAttribute("data-step", "7");
  await sawEvent(events, "tour_step:7");
  await secondHopLink(page).click();
  await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_ID);
  await expect(callout(page)).toHaveAttribute("data-step", "8");
  await page.locator("#preview-return").click();
  await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === REG7_IC1);
  await expect(callout(page)).toHaveAttribute("data-step", "9");
  await page.locator("#preview-return").click();
  await page.waitForURL((url) => url.pathname === "/regulations/gp05");
  await expect(callout(page)).toHaveAttribute("data-step", "closing");
}

// ---------------------------------------------------------------------------
// Arrivals on a cited row (16 Oct 2026): the heading at the top of the pane
// ---------------------------------------------------------------------------

/**
 * A browser context signed in as the smoke account (SMOKE_EMAIL /
 * SMOKE_PASSWORD: an existing, subscribed account; nothing is created or
 * paid), at the given viewport. Its own untraced context, so the password
 * typed here is never recorded; the caller closes it.
 */
export async function signedInContext(
  browser: Browser,
  baseURL: string | undefined,
  viewport: { width: number; height: number }
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL, viewport });
  await withProtectionBypass(context, baseURL);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.SMOKE_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.SMOKE_PASSWORD ?? "");
  await page.getByRole("button", { name: "Log in" }).click();
  // A login lands on the homepage (src/app/auth/actions.ts `login`).
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await page.close();
  return context;
}

/** One measurement of where a landed row sits against the page's fixed chrome, in viewport pixels. */
export type Landing = {
  scrollY: number;
  innerHeight: number;
  /** The landed row (#doc's or #preview-doc's child). */
  row: { top: number; bottom: number };
  /** The row's first line of text: the first line box of its first text node. */
  firstLine: { top: number; bottom: number; left: number; right: number };
  /** The way-back pill: the reader's "← Back to GP05 · VI.C" (#return-trail-ext), or the preview's #preview-return. */
  pill: { top: number; bottom: number; left: number; right: number };
  /** The bottom of the sticky site header, or of the preview's context strip when it has one. */
  chromeBottom: number;
};

/**
 * Where the row with `rowId` has landed right now (one measurement, no
 * retrying): the row, its first text line, the way-back pill and the fixed
 * chrome above the pane. Throws when any of them is missing, which is a
 * failure of the page, not of the landing.
 */
export async function landingNow(page: Page, rowId: string): Promise<Landing> {
  return page.evaluate((id) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const root = document.getElementById("doc") ?? document.getElementById("preview-doc");
    const row = root?.querySelector(`:scope > [id="${id}"]`);
    if (!row) throw new Error(`landingNow: no row ${id}`);
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent && n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const text = walker.nextNode();
    if (!text) throw new Error(`landingNow: row ${id} has no text`);
    const range = document.createRange();
    range.selectNodeContents(text);
    const line = range.getClientRects()[0];
    if (!line) throw new Error(`landingNow: row ${id}'s first text has no line box`);
    const ext = document.getElementById("return-trail-ext");
    const bar = document.getElementById("return-trail");
    const pill = ext && !ext.hidden && bar && !bar.hidden ? ext : document.getElementById("preview-return");
    if (!pill) throw new Error("landingNow: no way-back pill on the page");
    const strip = document.getElementById("preview-context");
    const header = document.querySelector("header");
    return {
      scrollY: window.scrollY,
      innerHeight: window.innerHeight,
      row: { top: row.getBoundingClientRect().top, bottom: row.getBoundingClientRect().bottom },
      firstLine: { top: line.top, bottom: line.bottom, left: line.left, right: line.right },
      pill: box(pill),
      chromeBottom: Math.max(header ? header.getBoundingClientRect().bottom : 0, strip ? strip.getBoundingClientRect().bottom : 0),
    };
  }, rowId);
}

/**
 * The landing rule's observable outcome (ReaderTour landArrival): the row's
 * top is inside the pane -- below the way-back pill's bottom and the fixed
 * chrome, above the bottom edge -- and the pill sits on none of the row's
 * first line of text. The problems, one line each; empty when it holds.
 */
export function landingProblems(l: Landing): string[] {
  const out: string[] = [];
  if (l.row.top < l.pill.bottom) out.push(`the row's top (${Math.round(l.row.top)}) is above the pill's bottom (${Math.round(l.pill.bottom)})`);
  if (l.row.top < l.chromeBottom) out.push(`the row's top (${Math.round(l.row.top)}) is under the fixed chrome (bottom ${Math.round(l.chromeBottom)})`);
  if (l.row.top >= l.innerHeight) out.push(`the row's top (${Math.round(l.row.top)}) is below the viewport (${l.innerHeight})`);
  const line = l.firstLine;
  const p = l.pill;
  const intersects = line.left < p.right && p.left < line.right && line.top < p.bottom && p.top < line.bottom;
  if (intersects) out.push(`the pill (y ${Math.round(p.top)}-${Math.round(p.bottom)}) sits on the row's first line (y ${Math.round(line.top)}-${Math.round(line.bottom)})`);
  return out;
}
