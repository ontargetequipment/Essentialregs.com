/**
 * Smoke test, signed-in group. Runs only when SMOKE_EMAIL and SMOKE_PASSWORD
 * are set -- an existing, subscribed account; this file never creates one,
 * never pays, never writes anything -- and SMOKE_SCOPE is not "anonymous"
 * (production deployments run the anonymous group only).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, withProtectionBypass } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";
import {
  CLOSING,
  COMPLETE,
  FULL_RUN,
  REG7_IC1,
  REG7_IC1_A,
  REG7_IC1_C,
  REG7_ID,
  STEP_COUNT,
  VI_C,
  boxOf,
  callout,
  captureTourEvents,
  expectClear,
  expectNoBackBar,
  expectSpotlight,
  inViewportNow,
  row,
  sawEvent,
  secondHopSpan,
  summaryControl,
  tagsOf,
  walkToStep5,
} from "./tour-helpers";

/**
 * Where the acceptance screenshots go (6 Oct 2026 review items 1 and 5):
 * attached to the report and written to e2e-screenshots/ (git-ignored), which
 * ci.yml uploads as the "smoke-screenshots" artifact whether or not the run
 * passed, so a before/after can be read off a run without re-running it.
 */
const SHOTS_DIR = path.join(process.cwd(), "e2e-screenshots");
async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

/**
 * The is_public rows: the four hand-picked sample rows and, since 10 Oct 2026
 * (migration 20261010120000_gp05_public_sample.sql), every row of GP05. A
 * signed-in search must find something else.
 */
const PUBLIC_IDS = ["sec-7-B-I-D-3-a-(i)", "sec-gp02-II-A-2", "sec-ecmc-604-a-(1)", "sec-cp-I-G-90"];
const isPublicId = (id: string) => PUBLIC_IDS.includes(id) || id.startsWith("sec-gp05-");

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The provision id a search result links to (/regulations/<reg>#<id> or /regs/<id>). */
function idFromHref(href: string): string {
  const hash = href.indexOf("#");
  if (hash !== -1) return decodeURIComponent(href.slice(hash + 1));
  return decodeURIComponent(href.replace(/^.*\/regs\//, ""));
}

// Traces record the session cookie; never keep one for this file, even locally.
test.use({ trace: "off" });

test.describe("signed in", () => {
  const email = process.env.SMOKE_EMAIL ?? "";
  const password = process.env.SMOKE_PASSWORD ?? "";
  test.skip(
    process.env.SMOKE_SCOPE === "anonymous",
    "SMOKE_SCOPE=anonymous (production deployment): the signed-in group runs on previews only."
  );
  test.skip(
    !email || !password,
    "SMOKE_EMAIL / SMOKE_PASSWORD secrets are not set: signed-in checks skipped. Add an existing subscribed account's credentials as repository secrets to run them."
  );
  test.describe.configure({ mode: "serial" });

  const stateDir = mkdtempSync(path.join(tmpdir(), "smoke-"));
  const statePath = path.join(stateDir, "state.json");
  writeFileSync(statePath, JSON.stringify({ cookies: [], origins: [] }));
  test.use({ storageState: statePath });

  test.beforeAll(async ({ browser, baseURL }) => {
    // Its own untraced context, so the password typed below is never recorded.
    const context = await browser.newContext({ baseURL, storageState: undefined });
    await withProtectionBypass(context, baseURL);
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    // A login lands on the homepage (src/app/auth/actions.ts `login`).
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
    await context.storageState({ path: statePath });
    await context.close();
  });

  test.afterAll(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  test("the /regulations/7 reader renders provisions and a cross-reference popup opens", async ({ page }) => {
    // Browser-side errors are collected so a failure here says why the
    // reader did not take the click (a script error, a missing element),
    // not just that it did not.
    const browserErrors: string[] = [];
    page.on("pageerror", (e) => browserErrors.push(`pageerror: ${String(e)}`));
    page.on("console", (m) => {
      if (m.type() === "error") browserErrors.push(`console: ${m.text()}`);
    });
    const res = await page.goto("/regulations/7");
    expect(res?.status()).toBe(200);
    expect(await page.locator("#doc .item").count()).toBeGreaterThan(100);

    // First visible cross-reference whose target is on this page. A link
    // inside a closed <details> (a summary panel's child list) reports a
    // degenerate rect in Chrome but cannot be clicked: skipped.
    const slug = await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll("#doc .xref"))) {
        const target = el.getAttribute("data-target");
        if (el.closest("details:not([open])")) continue;
        if (target && document.getElementById(target) && el.getClientRects().length > 0) {
          el.setAttribute("data-smoke-xref", "");
          return target;
        }
      }
      return null;
    });
    expect(slug, "no in-page cross-reference found in Regulation 7").not.toBeNull();

    // The click handler is attached after hydration; retry until it takes.
    try {
      await expect(async () => {
        await page.locator("[data-smoke-xref]").click();
        await expect(page.locator("#backdrop")).toHaveClass(/\bshow\b/, { timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
    } catch (e) {
      const state = await page.evaluate(() => {
        const x = document.querySelector("[data-smoke-xref]");
        const row = x?.closest("#doc > [id]");
        return {
          xref: x?.outerHTML.slice(0, 300) ?? null,
          target: x?.getAttribute("data-target") ?? null,
          inRow: row?.id ?? null,
          backdrop: document.getElementById("backdrop") !== null,
          readerRootChildren: document.getElementById("reader-root")?.children.length ?? -1,
          docRows: document.querySelectorAll("#doc > [id]").length,
          htmlBytes: document.documentElement.outerHTML.length,
        };
      });
      throw new Error(`${String(e)}\nreader state: ${JSON.stringify(state)}\nbrowser errors: ${browserErrors.join(" | ") || "none"}`);
    }
    // The eyebrow is the regulation's display name, then the target's
    // ancestor labels ("Regulation 7 · Part B · I. · I.D."), never the id.
    await expect(page.locator("#popup-eyebrow")).toHaveText(/^Regulation 7( · .+)?$/);
    await expect(page.locator("#popup-eyebrow")).not.toContainText(slug!);
    await expect(page.locator("#popup-title")).not.toBeEmpty();
    await expect(page.locator(`#popup-body [id="${slug}"]`)).toHaveCount(1);

    // "Go to full section": the popup closes, the hash names the target, the
    // target itself (the #doc row, not the popup's clone) is in the viewport,
    // and the return trail offers the way back to the row the reference was in.
    const originId = await page.locator("[data-smoke-xref]").evaluate((el) => el.closest("#doc > [id]")?.id ?? null);
    await page.locator("#popup-goto").click();
    await expect(page.locator("#backdrop")).not.toHaveClass(/\bshow\b/);
    await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(slug!)}$`));
    await expect(page.locator(`#doc [id="${slug}"]`)).toBeInViewport();
    await expect(page.locator("#return-trail")).toBeVisible();
    if (originId) {
      const originLabel = await page.locator(`#doc [id="${originId}"]`).evaluate((el) => el.getAttribute("data-citation"));
      await expect(page.locator("#return-trail-back")).toHaveText(`← Back to ${originLabel}`);
      await page.locator("#return-trail-back").click();
      await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(originId)}$`));
      await expect(page.locator(`#doc [id="${originId}"]`)).toBeInViewport();
    }
    await expect(page.locator("#return-trail")).toBeHidden();
  });

  test("the Regulation 7 jump box searches the whole text: 'enclosed combustion device' lists Part B rows with a highlighted excerpt", async ({ page }) => {
    await page.goto("/regulations/7");
    const box = page.locator("#jumpbox");
    await expect(box).toHaveAttribute("role", "combobox");
    await box.fill("enclosed combustion device");
    const items = page.locator('#jump-results .jr-item[role="option"]');
    await expect(items.first()).toBeVisible();
    await expect(page.locator("#jump-results .jr-empty")).toHaveCount(0);
    const slugs = await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slug ?? ""));
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.length).toBeLessThanOrEqual(22);
    for (const slug of slugs) expect(slug, slug).toMatch(/^sec-7-/);
    expect(slugs.some((slug) => slug.startsWith("sec-7-B-")), "Part B rows are listed").toBe(true);
    await expect(page.locator("#jump-results .jr-excerpt mark").first()).toBeVisible();
    // Picking one lands on it.
    const first = slugs[0];
    await items.first().click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${first}`);
  });

  test("a citation of a whole document previews it and opens it with a way back (GP12 XII.E → Regulation 8)", async ({ page }, testInfo) => {
    // Acceptance row "Click a citation in GP12 XII.E" (6 Oct 2026): the
    // importer links "Regulation Number 8" to /regulations/8 with no
    // provision in the hash; the reader must preview the document in place
    // (title, citation, effective date, the overview of its top-level
    // summary) with a separate "Open Regulation 8 →" that carries from=, and
    // Regulation 8 must then show the way back. Checked at a desktop width
    // and at a phone width (390px), where the same click path applies.
    test.setTimeout(180_000);
    for (const [width, label] of [
      [1280, "desktop"],
      [390, "phone"],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      // The second pass starts on this very URL (the back link landed here),
      // so the navigation is a same-document hash change and goto() returns
      // no response; only a real navigation has a status to check.
      const res = await page.goto("/regulations/gp12#sec-gp12-XII-E");
      if (res) expect(res.status()).toBe(200);
      const link = page.locator('#doc [id="sec-gp12-XII-E"] a.xref-external-reg[href="/regulations/8"]');
      await expect(link).toHaveCount(1);
      // The click handler is attached after hydration; retry until it takes.
      await expect(async () => {
        await link.click();
        await expect(page.locator("#backdrop")).toHaveClass(/\bshow\b/, { timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await expect(page).toHaveURL(/\/regulations\/gp12/, { timeout: 1_000 });
      await expect(page.locator("#popup-eyebrow")).toHaveText("Regulation 8");
      await expect(page.locator("#popup-title")).not.toBeEmpty();
      await expect(page.locator("#popup-note")).toContainText("Regulation Number 8");
      await expect(page.locator("#popup-version-note")).toHaveText(/^Effective \d{2}\/\d{2}\/\d{4}$/);
      // The body is the overview of Regulation 8's top-level summary (every
      // document root carries an AI-reviewed summary since 7 Oct 2026), with
      // its review badge.
      const body = page.locator("#popup-body");
      await expect(body.locator(".summary-overview")).toHaveCount(1);
      await expect(body.locator(".summary-overview")).not.toBeEmpty();
      await expect(body.locator(".doc-preview-empty")).toHaveCount(0);
      await expect(body.locator(".summary-badge")).toHaveText(/^(AI-generated · automated check against source text|Reviewed)( · [A-Z][a-z]+ \d{1,2}, \d{4})?$/);
      const open = page.locator("#popup-goto");
      await expect(open).toHaveText("Open Regulation 8 →");
      await expect(open).toHaveAttribute("href", "/regulations/8?from=sec-gp12-XII-E#sec-8-top-REG-8");
      await shot(page, testInfo, `item1-${label}-preview`);

      await open.click();
      await page.waitForURL((url) => url.pathname === "/regulations/8", { timeout: 60_000 });
      await expect(page.locator("#doc .item").first()).toBeAttached();
      // from= is consumed into the return bar and stripped from the URL.
      await expect(page).not.toHaveURL(/from=/);
      await expect(page.locator("#return-trail")).toBeVisible();
      const back = page.locator("#return-trail-ext");
      await expect(back).toHaveText("← Back to GP12 · XII.E");
      await expect(back).toHaveAttribute("href", "/regulations/gp12#sec-gp12-XII-E");
      await shot(page, testInfo, `item1-${label}-back-bar`);
      await back.click();
      await page.waitForURL((url) => url.pathname === "/regulations/gp12" && url.hash === "#sec-gp12-XII-E", { timeout: 60_000 });
      await expect(page.locator('#doc [id="sec-gp12-XII-E"]')).toBeInViewport({ timeout: 15_000 });
    }
  });

  // Fifth review (9 Oct 2026), P1: from 49 CFR Part 192, "49 CFR 190.9" and
  // "part 191 of this chapter" opened an empty preview with "Go to full
  // section" on "#". Every cross-part link must either preview its target
  // (a heading, text, and an "Open ..." link into that part) or, when it
  // cannot, leave the page for the target -- never an empty popup.
  for (const [rowId, partKey, label] of [
    ["sec-p192-192.1-(b)-(2)", "p190", "49 CFR 190.9"],
    ["sec-p192-192.8-(c)", "p191", "part 191 of this chapter"],
  ] as const) {
    test(`a PHMSA cross-part link previews or opens its target (${label} in ${rowId})`, async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const res = await page.goto(`/regulations/p192#${rowId}`);
      if (res) expect(res.status()).toBe(200);
      const link = page.locator(`#doc [id="${rowId}"] a.xref-external-reg[href^="/regulations/${partKey}"]`).first();
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText(label);
      const statuses: string[] = [];
      page.on("response", (r) => {
        if (r.url().includes("/api/provision/")) statuses.push(`${r.status()} ${r.url()}`);
      });
      // The click handler is attached after hydration; retry until it takes
      // (a popup opens, or the page leaves for the target).
      await expect(async () => {
        if (new URL(page.url()).pathname === "/regulations/p192") await link.click();
        await expect
          .poll(
            async () =>
              new URL(page.url()).pathname === `/regulations/${partKey}` ||
              /\bshow\b/.test((await page.locator("#backdrop").getAttribute("class")) ?? ""),
            { timeout: 5_000 }
          )
          .toBe(true);
      }).toPass({ timeout: 60_000 });
      await shot(page, testInfo, `phmsa-${partKey}`);
      testInfo.annotations.push({ type: "api/provision", description: statuses.join(" | ") || "(none)" });
      if (new URL(page.url()).pathname === `/regulations/${partKey}`) return; // fell back to navigation
      await expect(page.locator("#popup-title")).not.toBeEmpty();
      await expect(page.locator("#popup-body")).not.toBeEmpty();
      const goto = page.locator("#popup-goto");
      await expect(goto).toHaveAttribute("href", new RegExp(`^/regulations/${partKey}[?#]`));
      await expect(goto).not.toHaveText(/Go to full section/);
    });
  }

  for (const reg of ["7", "8", "gp12"]) {
    test(`/regulations/${reg} does not scroll sideways at 390 and 526 px`, async ({ page }, testInfo) => {
      // 6 Oct 2026 review: at 526px /regulations/8 was 129px wider than the
      // viewport (a 73-character form blank in VI.QQ) and the "View official
      // source" link ran into the title; /regulations/7 (long URLs) scrolled
      // too. No horizontal page scroll at either width; wide tables scroll
      // inside their own container; the source link sits on its own line
      // above the title.
      test.setTimeout(240_000);
      for (const width of [390, 526]) {
        await page.setViewportSize({ width, height: 844 });
        const res = await page.goto(`/regulations/${reg}`);
        expect(res?.status()).toBe(200);
        expect(await page.locator("#doc .item").count()).toBeGreaterThan(10);
        // Let the browser-built furniture (contains boxes) land before measuring.
        await expect(page.locator("#doc ul.contains").first()).toBeAttached({ timeout: 30_000 });
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const link = document.querySelector("#doc .reg-source-link");
          let linkBottom: number | null = null;
          let textTop: number | null = null;
          if (link) {
            linkBottom = link.getBoundingClientRect().bottom;
            for (let n = link.nextSibling; n; n = n.nextSibling) {
              if (n.nodeType === 3 && (n.nodeValue ?? "").trim()) {
                const range = document.createRange();
                range.selectNodeContents(n);
                textTop = range.getClientRects()[0]?.top ?? null;
                break;
              }
              if (n.nodeType === 1) {
                textTop = (n as Element).getBoundingClientRect().top;
                break;
              }
            }
          }
          const wraps = Array.from(document.querySelectorAll<HTMLElement>("#doc .doc-table-wrap"));
          const wideTables = wraps.filter((w) => w.scrollWidth > w.clientWidth + 1).length;
          const tableOverflowsPage = wraps.filter((w) => w.getBoundingClientRect().right > de.clientWidth + 1).length;
          return {
            scrollWidth: de.scrollWidth,
            clientWidth: de.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
            linkBottom,
            textTop,
            tables: wraps.length,
            wideTables,
            tableOverflowsPage,
          };
        });
        expect(m.scrollWidth, `${reg} at ${width}px: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
        expect(m.bodyScrollWidth, `${reg} at ${width}px: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
        expect(m.tableOverflowsPage, `${reg} at ${width}px: a table container reaches past the viewport`).toBe(0);
        if (m.linkBottom !== null && m.textTop !== null) {
          expect(m.textTop, `${reg} at ${width}px: the title starts under the source link`).toBeGreaterThanOrEqual(m.linkBottom - 1);
        }
        await shot(page, testInfo, `item5-${reg}-${width}`);
      }
    });
  }

  test("the /regulations/gp01 reader labels every summary with its review status", async ({ page }) => {
    // Trust badge (owner decision, 29 Sep 2026): every summary panel opens
    // with text saying whether the summary was checked. GP01 had 64
    // summaries on 1 Oct 2026 (60 approved, 4 pending).
    const res = await page.goto("/regulations/gp01");
    expect(res?.status()).toBe(200);
    const badges = page.locator("#doc details.summary-panel > .summary-body > .summary-badge");
    expect(await badges.count()).toBeGreaterThan(0);
    const texts = await badges.allTextContents();
    for (const text of texts) expect(text).toMatch(/^(AI-generated · automated check against source text( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed|Reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?)$/);
    // Never a bare "Reviewed" (owner decision, 4 Oct 2026): no summary claims human review.
    for (const text of texts) expect(text).not.toMatch(/^Reviewed\b/);
    expect(texts.some((t) => t.startsWith("AI-generated"))).toBe(true);
    // The tooltip is added after hydration (reader-client.ts, fillSummaryBadges).
    await expect(badges.first()).toHaveAttribute("title", /Disclaimer page|Read the source text/);
    // No panel without a badge, and no reviewer named anywhere in the body.
    expect(await page.locator("#doc details.summary-panel").count()).toBe(texts.length);
    expect(await page.locator("#doc").innerText()).not.toMatch(/reviewed by/i);
  });

  test("a related link on a card page opens the exact provision in the reader (GP12 VI.A.1)", async ({ page }) => {
    // Sprint 4, 10 Oct 2026: for a subscriber the related link is the
    // provision itself, not the whole-document preview. /sample no longer
    // carries related blocks; the public card page does.
    await page.goto("/regs/sec-7-B-I-D-3-a-(i)");
    const related = page.locator("section").filter({ has: page.getByRole("heading", { name: "Related by meaning, not cited" }) });
    await expect(related).toBeVisible();
    const link = related.getByRole("link").filter({ hasText: "VI.A.1" }).first();
    await expect(link).toHaveAttribute("href", "/regulations/gp12#sec-gp12-VI-A-1");
    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp12" && url.hash === "#sec-gp12-VI-A-1");
    // Attribute selector: the id has no characters that need escaping here,
    // but this form is safe for the parenthesised ids too.
    await expect(page.locator('[id="sec-gp12-VI-A-1"]')).toBeInViewport({ timeout: 30_000 });
  });

  test("/sample shows a subscriber nothing locked: every result opens in the reader", async ({ page }) => {
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("locked-result")).toHaveCount(0);
    const hrefs = await page
      .getByTestId("sample-keyword")
      .locator("ol > li > a")
      .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.length).toBe(10);
    for (const href of hrefs) expect(href, href).toMatch(/^\/regulations\/[^/]+#/);
    // No trial to start (Sprint 5, 10 Oct 2026): the free reader stays, the search keeps its old wording.
    await expect(page.getByTestId("sample-top-cta").getByRole("link", { name: "Open the free GP05 reader" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start your 7-day trial" })).toHaveCount(0);
    await expect(page.getByTestId("sample-cta").getByRole("link", { name: "Search the complete corpus" })).toHaveAttribute("href", "/search");
  });

  test("GP05 shows a subscriber the reader without the visitor banner", async ({ page }) => {
    const res = await page.goto("/regulations/gp05");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#sidebar")).toBeVisible();
    await expect(page.getByTestId("visitor-banner")).toHaveCount(0);

    // VI.A's "Part B" (linked since 11 Oct 2026) previews Regulation 7's part
    // root in place, and the popup's footer opens it in the Regulation 7 reader.
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const partB = row(page, "sec-gp05-VI-A").locator('a.xref-external-reg[href="/regulations/7#sec-7-P-B"]');
    await expect(partB).toHaveText("Part B");
    await partB.scrollIntoViewIfNeeded();
    await partB.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    await expect(page.locator("#popup-eyebrow")).toHaveText("Regulation 7");
    await expect(page.locator("#popup-title")).toHaveText("PART B");
    const open = page.locator("#popup-goto");
    await expect(open).toHaveAttribute("href", "/regulations/7?from=sec-gp05-VI-A#sec-7-P-B");
    await open.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7" && url.hash === "#sec-7-P-B");
    await expect(row(page, "sec-7-P-B")).toBeInViewport({ timeout: 30_000 });
  });

  test("a subscriber gets the walkthrough too: steps 6-9 run in the Regulation 7 reader, the second hop through its popup and the way back through its own bar, and the closing card has no trial button", async ({ page }, testInfo) => {
    // v3 (src/lib/tour.ts, 13 Oct 2026): the same ten views. Step 5's citation
    // goes to the subscriber's destination (provisionDestination, with the
    // GP05 row as ?from= and ?tour=1): the Reg 7 reader. Steps 6-9 are
    // anchored callouts there as on GP05. Step 7's "Sections I.D." opens the
    // reader's popup and its "Go to full section" lands on I.D (step 8); the
    // reader's in-document bar comes back to I.C.1.c (step 9); its "← Back
    // to GP05 · VI.C" bar's click the tour takes to add ?tour=1. The closing
    // card drops "Start your 7-day trial".
    test.setTimeout(120_000);
    const events = await captureTourEvents(page);
    await walkToStep5(page);
    const link = row(page, VI_C).locator(`a.xref-external-reg[href$="#${REG7_IC1}"]`);
    await expectSpotlight(page, 5, link);
    await sawEvent(events, "tour_step:5");
    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7" && url.hash === `#${REG7_IC1}`);
    // The reader takes ?from= off the URL (it keeps it for the bar); ?tour=1 stays.
    await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBeNull();
    expect(new URL(page.url()).searchParams.get("tour")).toBe("1");
    await expect(row(page, REG7_IC1)).toBeInViewport({ timeout: 30_000 });
    const c = callout(page);
    const onThePage = async () =>
      expect
        .poll(async () => {
          const cb = await boxOf(c);
          const vp = page.viewportSize()!;
          return cb.x >= 0 && cb.x + cb.width <= vp.width + 1 && cb.y >= 66 && cb.y + cb.height <= vp.height + 1;
        }, { message: "a fixed card on the page" })
        .toBe(true);

    // 6 -- the cited requirement, in the reader.
    await expect(c).toHaveAttribute("data-step", "6");
    await expect(c).toHaveAttribute("data-mode", "anchored");
    await expect(c.getByTestId("tour-count")).toHaveText(`Step 6 of ${STEP_COUNT}`);
    await expect(c).toContainText("This is the cited requirement. Open I.C.1.a's summary.");
    const bar = page.locator("#return-trail-ext");
    await expect(bar).toBeVisible();
    await expect(bar).toHaveText("← Back to GP05 · VI.C");
    await expect(bar).toHaveAttribute("href", `/regulations/gp05#${VI_C}`);
    const aControl = summaryControl(row(page, REG7_IC1_A));
    await expectSpotlight(page, 6, aControl);
    // The reader re-lands the deep link a moment after it mounts; the control is on screen once that has settled.
    await expect.poll(() => inViewportNow(aControl)).toBe(true);
    await onThePage();
    await expectClear(page, "subscriber step 6");
    await shot(page, testInfo, "tour-subscriber-step6");

    // 7 -- the second hop: I.C.1.c's "Sections I.D." span, which the reader's popup opens.
    await aControl.click();
    await expect(c).toHaveAttribute("data-step", "7");
    await expect(c.getByTestId("tour-count")).toHaveText(`Step 7 of ${STEP_COUNT}`);
    await expect(c).toContainText("Follow this one too.");
    await expect(c).toContainText("then Go to full section in the preview");
    const hop = secondHopSpan(page);
    await expect(hop).toHaveText("Sections I.D.");
    await expectSpotlight(page, 7, hop);
    await expect.poll(() => inViewportNow(hop)).toBe(true);
    await onThePage();
    await expectClear(page, "subscriber step 7");
    await shot(page, testInfo, "tour-subscriber-step7");
    await sawEvent(events, "tour_step:7");

    // 8 -- the popup's "Go to full section" lands on I.D; the reader's in-document bar is the way back.
    await hop.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    await expect(page.locator("#popup-title")).toHaveText("I.D.");
    await expect(c).toHaveAttribute("data-step", "7");
    await page.locator("#popup-goto").click();
    await page.waitForURL((url) => url.hash === `#${REG7_ID}`);
    await expect(page.locator("#backdrop")).not.toHaveClass(/show/);
    await expect(c).toHaveAttribute("data-step", "8");
    await expect(c.getByTestId("tour-count")).toHaveText(`Step 8 of ${STEP_COUNT}`);
    await expect(c).toContainText("Click Back to Regulation 7 I.C.1.");
    await expect(row(page, REG7_ID)).toBeInViewport();
    const inDoc = page.locator("#return-trail-back");
    await expect(inDoc).toBeVisible();
    await expect(page.locator("#return-trail-label")).toHaveText("I.C.1.c.");
    await expect(bar).toBeHidden();
    await expectSpotlight(page, 8, inDoc);
    await onThePage();
    await expectClear(page, "subscriber step 8");
    await shot(page, testInfo, "tour-subscriber-step8");

    // 9 -- Back lands on I.C.1.c; the bar to GP05 is back.
    await inDoc.click();
    await page.waitForURL((url) => url.hash === `#${REG7_IC1_C}`);
    await expect(c).toHaveAttribute("data-step", "9");
    await expect(c.getByTestId("tour-count")).toHaveText(`Step 9 of ${STEP_COUNT}`);
    await expect(c).toContainText("Click Back to GP05 VI.C.");
    await expect(bar).toBeVisible();
    await expect(inDoc).toBeHidden();
    await expectSpotlight(page, 9, bar);
    await expect.poll(() => inViewportNow(bar)).toBe(true);
    await onThePage();
    await expectClear(page, "subscriber step 9");
    await shot(page, testInfo, "tour-subscriber-step9");

    // The way back keeps the tour on: GP05 at VI.C, the closing card.
    await bar.click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05" && url.searchParams.get("tour") === "1" && url.hash === `#${VI_C}`);
    await expect(c).toHaveAttribute("data-step", "closing");
    await expect(c.getByTestId("tour-count")).toHaveText(COMPLETE);
    await expect(c.getByTestId("tour-closing")).toHaveText(CLOSING);
    await expect(c.getByTestId("tour-trial")).toHaveCount(0);
    await expect(c.getByTestId("tour-explore")).toHaveText("Explore GP05 yourself");
    await expect(c.getByTestId("tour-explore")).toHaveClass(/bg-accent/);
    await expect(c.getByTestId("tour-skip")).toHaveText("End tour");
    await expect(row(page, VI_C)).toBeInViewport();
    await expectNoBackBar(page);
    await onThePage();
    await shot(page, testInfo, "tour-subscriber-closing");
    await sawEvent(events, "tour_complete:7");
    expect(tagsOf(events)).toEqual(FULL_RUN);
    expect(tagsOf(events)).not.toContain("tour_trial_click:7");
    // Explore ends it where it is.
    await c.getByTestId("tour-explore").click();
    await expect(callout(page)).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe(`#${VI_C}`);
  });

  test("?tour=1 on another regulation is ignored: /regulations/7?tour=1 is the normal reader", async ({ page }) => {
    const res = await page.goto("/regulations/7?tour=1");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await page.waitForTimeout(500);
    await expect(callout(page)).toHaveCount(0);
  });

  test("a stale focused-preview link sends a subscriber to the provision in the reader", async ({ page }) => {
    await page.goto("/regulations/gp12/preview?p=sec-gp12-VI-A-1");
    await page.waitForURL((url) => url.pathname === "/regulations/gp12" && url.hash === "#sec-gp12-VI-A-1");
    await expect(page.locator('[id="sec-gp12-VI-A-1"]')).toBeInViewport({ timeout: 30_000 });
  });

  test("/search shows a subscriber the Keyword / Ask tabs; the Ask tab carries the query", async ({ page }) => {
    // Ask is a first-class mode again (3 Oct 2026): the tablist from before
    // the keyword-first layout of 30 Sep, for every visitor.
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
    const tabs = page.getByRole("tablist").getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText("Keyword");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toHaveText("Ask");
    await expect(tabs.nth(1)).toHaveAttribute("href", "/search?mode=ask&q=emissions");
    expect(await page.locator("body").innerText()).not.toMatch(/\bbeta\b/i);
  });

  test("keyword search for 'Method 21' puts the test-method page above the provisions", async ({ page }) => {
    // 9 Oct 2026: a query that names a test method shows its page as the first
    // result (detectTestMethod), ahead of the provisions that cite it.
    const res = await page.goto("/search?q=" + encodeURIComponent("Method 21"));
    expect(res?.status()).toBe(200);
    const card = page.getByTestId("test-method-result");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/test-methods/method-21");
    const cardBox = await card.boundingBox();
    const firstHit = page.locator("main ol a").first();
    if (await firstHit.count()) {
      const hitBox = await firstHit.boundingBox();
      expect(cardBox!.y).toBeLessThan(hitBox!.y);
    }
  });

  test("an Ask card carries the review-status badge beside its summary", async ({ page }) => {
    // The smoke account is a subscriber (Ask is part of the subscription);
    // the first hit for this question has carried a summary since Phase 0.
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent("When is a GP01 required?"));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Ask is part of the subscription")).toHaveCount(0);
    await expect(page.getByRole("tablist").getByRole("tab", { name: "Ask" })).toHaveAttribute("aria-selected", "true");
    expect(await page.locator("body").innerText()).not.toMatch(/\bbeta\b/i);
    const cards = page.locator("ol > li > a");
    expect(await cards.count()).toBeGreaterThan(0);
    const first = cards.first();
    const summaryLabel = first.getByText("Plain-English summary", { exact: false });
    test.skip(
      (await summaryLabel.count()) === 0,
      "the first Ask card has no summary (a heading-only row): no badge to check on it",
    );
    const badge = first.locator(".summary-badge");
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText(/^(AI-generated · automated check against source text( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed|Reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?)$/);
    await expect(badge).toHaveAttribute("title", /Disclaimer page|Read the source text/);
  });

  test("an engine question renders grouped under its question map; ?flat=1 shows the flat list", async ({ page }) => {
    // Ask Track B: "What regulations apply to a natural gas-fired engine?"
    // routes to the engines map (src/lib/question-maps.ts), so the page
    // shows the "Mapped question" line, the factors sentence and one h2 per
    // non-empty group, in MAP_GROUP_ORDER, with "Other matches" last if any.
    // Review 4 (7 Oct 2026): the question states the fuel, so the map is
    // titled "Natural gas-fired engines", the diesel rows (GP06, Subpart
    // IIII) are left out and one line under the results says so, with a
    // "Show them" link (?facets=all) that brings the whole map back.
    const q = "What regulations apply to a natural gas-fired engine?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Ask is part of the subscription")).toHaveCount(0);
    await expect(page.getByText("Mapped question: Natural gas-fired engines")).toHaveCount(1);
    await expect(page.getByTestId("map-intro").getByText(/The fuel splits the rules/)).toHaveCount(1);
    await expect(page.getByText("Not shown because you said natural gas:", { exact: false })).toHaveCount(1);
    await expect(page.getByText("diesel engine provisions (GP06, Subpart IIII)", { exact: false })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Show them" })).toHaveAttribute("href", /[?&]facets=all/);
    // The result rows, not the introduction: its fuel-split sentence cites
    // GP06 and Subpart IIII on purpose (sentence-level citations, 9 Oct 2026).
    const rows = (href: string) => page.locator(`a[href*="${href}"]:not([data-testid="map-intro"] a)`);
    expect(await rows("/regulations/gp06").count()).toBe(0);
    expect(await rows("/regulations/iiii").count()).toBe(0);
    expect(await rows("/regulations/jjjj").count()).toBeGreaterThan(0);
    expect(await rows("/regulations/gp09").count()).toBeGreaterThan(0);
    const groups = ["Colorado permitting and APEN", "General Permit options", "Colorado standards", "Federal NSPS", "Federal NESHAP", "Definitions"];
    const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
    expect(headings.length).toBeGreaterThan(0);
    const named = headings.filter((h) => h !== "Other matches");
    for (const h of named) expect(groups).toContain(h);
    // In display order, and "Other matches" only ever last.
    expect(named.map((h) => groups.indexOf(h))).toEqual([...named.map((h) => groups.indexOf(h))].sort((a, b) => a - b));
    const otherAt = headings.indexOf("Other matches");
    expect(otherAt === -1 || otherAt === headings.length - 1).toBe(true);
    // The map's canonical rows carry their reason; every card is still one link.
    expect(await page.getByText("Why it's here:", { exact: false }).count()).toBeGreaterThan(0);
    expect(await page.locator("ol > li > a").count()).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Show as a flat list" })).toHaveAttribute("href", /[?&]flat=1/);

    // Sprint 8 (11 Oct 2026): the research map comes first. The line that says
    // what Ask is, the table with one row per group (the same groups, in the
    // same order, as the h2s below it), the introduction under "Reading of the
    // provisions above", then the cards.
    const map = page.getByTestId("ask-map");
    await expect(map.getByTestId("ask-finds-line")).toHaveText("It finds provisions; it does not decide what applies to you.");
    await expect(map.getByRole("columnheader")).toHaveText(["Question component", "Provision", "Why it matters"]);
    expect(await map.getByRole("rowheader").allInnerTexts()).toEqual(headings);
    // Every provision of the table is a reader link (Ask is for subscribers), and the omitted fuel's rows are not in it.
    const mapHrefs = await map.locator("tbody a").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(mapHrefs.length).toBeGreaterThan(5);
    for (const href of mapHrefs) expect(href, href).toMatch(/^\/regulations\/[^/]+#/);
    expect(mapHrefs.some((h) => h.startsWith("/regulations/gp06") || h.startsWith("/regulations/iiii"))).toBe(false);
    const reading = page.getByTestId("ask-reading");
    await expect(reading.getByRole("heading", { level: 3, name: "Reading of the provisions above" })).toBeVisible();
    const mapBox = await map.boundingBox();
    const readingBox = await reading.boundingBox();
    const firstGroup = await page.getByRole("heading", { level: 2 }).first().boundingBox();
    expect(mapBox && readingBox && firstGroup && mapBox.y + mapBox.height <= readingBox.y + 1 && readingBox.y < firstGroup.y).toBe(true);
    // The finds line is above the map and below the "Mapped question" line.
    const mapped = await page.getByText("Mapped question:", { exact: false }).boundingBox();
    const lineBox = await map.getByTestId("ask-finds-line").boundingBox();
    expect(mapped && lineBox && mapped.y < lineBox.y && lineBox.y < mapBox!.y + mapBox!.height).toBe(true);
    // Phone width: no sideways scroll.
    // On failure the message names what sticks out (the elements in <main>
    // whose right edge passes the viewport), since the answer is live data.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = Array.from(document.querySelectorAll("main *"))
        .filter((el) => el.getBoundingClientRect().right > vw + 1)
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)} [${Math.round(el.getBoundingClientRect().width)}px] ${(el.textContent ?? "").slice(0, 60)}`);
      return { by: document.documentElement.scrollWidth - vw, wide };
    });
    expect(overflow.by, `sideways scroll at 390px; widest: ${overflow.wide.join(" | ")}`).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1280, height: 720 });

    // "Show them": the whole map, titled for both fuels, GP06 back, no omitted line.
    const all = await page.goto("/search?mode=ask&facets=all&q=" + encodeURIComponent(q));
    expect(all?.status()).toBe(200);
    await expect(page.getByText("Mapped question: Natural gas-fired and diesel engines")).toHaveCount(1);
    await expect(page.getByText("Not shown because you said", { exact: false })).toHaveCount(0);
    expect(await page.locator('a[href*="/regulations/gp06"]').count()).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Back to the filtered view" })).toHaveCount(1);

    // The flat list: the retrieval order as before, no groups, a way back.
    const flat = await page.goto("/search?mode=ask&flat=1&q=" + encodeURIComponent(q));
    expect(flat?.status()).toBe(200);
    await expect(page.getByText("Mapped question:", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByText(/^\d+ provisions? most about/)).toHaveCount(1);
    await expect(page.getByText("Why it's here:", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show grouped" })).toHaveCount(1);
  });

  test("the GP01 premise question shows the note above the results, the permit's applicability first and Regulation 3 after it", async ({ page }) => {
    // Review 4 (7 Oct 2026): "When is a GP01 required?" matches the premise
    // note (src/lib/premise-notes.ts): a fixed, cited note above the
    // results, the GP01 Section I rows first, the Regulation 3 permit and
    // APEN requirement rows second, the alternatives third; the storage-tank
    // map no longer leads.
    const q = "When is a GP01 required?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Ask is part of the subscription")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Is GP01 required?" })).toHaveCount(1);
    await expect(page.getByText("GP01 is not automatically required", { exact: false })).toHaveCount(1);
    // The note's Regulation 3 sentence and the premise map's factors line both say it.
    expect(await page.getByText("decided under Regulation 3", { exact: false }).count()).toBeGreaterThan(0);
    // exact: a result card below carries the same words in its accessible name; first(): the premise map's introduction (9 Oct 2026) cites the same provisions.
    await expect(page.getByRole("link", { name: "GP01 VIII.D.3", exact: true }).first()).toHaveAttribute("href", "/regulations/gp01#sec-gp01-VIII-D-3");
    await expect(page.getByRole("link", { name: "Regulation 3 Part A II.A.1", exact: true }).first()).toHaveAttribute("href", "/regulations/3#sec-3-A-II-A-1");
    await expect(page.getByText("Mapped question: Storage tanks and tank batteries")).toHaveCount(0);
    const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
    expect(headings.slice(0, 4)).toEqual(["Is GP01 required?", "Permit applicability", "Colorado permitting and APEN", "Alternatives if the permit does not fit"]);
    const first = page.locator("ol > li > a").first();
    await expect(first).toHaveAttribute("href", "/regulations/gp01#sec-gp01-I-A");
    expect(await page.locator('a[href="/regulations/3#sec-3-B-II-A-1"]').count()).toBeGreaterThan(0);
  });

  test("the civil-penalties question renders grouped with no weak-match notice and a canonical group first", async ({ page }) => {
    // 3 Oct 2026: a question that routed to a map is answered by the map's
    // rows, so the amber "Nothing in the regulations closely matches this"
    // notice stays off the grouped view, and a stray Regulation 3 hit no
    // longer opens "Colorado permitting and APEN" above the enforcement
    // map's own groups (groupHits puts hits-only groups after the ones with
    // a canonical row).
    const q = "How does the Division assess civil penalties for a violation?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Mapped question: ", { exact: false })).toHaveCount(1);
    await expect(page.getByText("Nothing in the regulations closely matches this", { exact: false })).toHaveCount(0);
    const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
    expect(headings.length).toBeGreaterThan(0);
    expect(["General Permit options", "Colorado standards"]).toContain(headings[0]);
    expect(headings[0]).not.toBe("Colorado permitting and APEN");
  });

  test("a storage-vessel question renders grouped under the storage-tanks map (maps batch 2)", async ({ page }) => {
    // Until maps batch 2 (2 Oct 2026) this question took no map and this
    // test checked the flat list; the bulk-plant test below now does that.
    const q = "What Colorado and federal requirements could apply to storage vessels?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Mapped question: Storage tanks and tank batteries")).toHaveCount(1);
    await expect(page.getByTestId("map-intro").getByText(/Regulation 7 Part B Section I\.D\.3\.a requires storage tanks/)).toHaveCount(1);
    expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(0);
    // Subpart HH is not in the corpus: the tanks map has no Federal NESHAP row, and an
    // empty group is not rendered.
    await expect(page.getByRole("heading", { level: 2, name: "Federal NESHAP" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show as a flat list" })).toHaveAttribute("href", /[?&]flat=1/);
  });

  test("a leak-inspection question renders grouped under the ldar map (maps batch 3)", async ({ page }) => {
    // Maps batch 3 (2 Oct 2026): the LDAR eval question routes to the ldar map.
    // No Colorado permitting and APEN row on that map, so the first group is
    // General Permit options; no Federal NESHAP row either.
    const q = "How often do I have to do leak inspections at a well production facility?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Mapped question: Leak detection and repair at well production facilities and compressor stations")).toHaveCount(1);
    await expect(page.getByTestId("map-intro").getByText(/Regulation 7 Part B Section II\.E is a State Only leak detection/)).toHaveCount(1);
    expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { level: 2, name: "Colorado standards" })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: "Federal NESHAP" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show as a flat list" })).toHaveAttribute("href", /[?&]flat=1/);
  });

  test("a tank-truck question (a bare 'tank') routes to no map and renders the flat list", async ({ page }) => {
    const q = "What are the requirements for loading gasoline into a tank truck at a bulk plant?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Mapped question:", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show grouped" })).toHaveCount(0);
    await expect(page.getByText(/^\d+ provisions? most about/)).toHaveCount(1);
  });

  test("search returns provisions beyond the public sample", async ({ page }) => {
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("You're not logged in")).toHaveCount(0);
    await expect(page.getByText("Search isn't available right now")).toHaveCount(0);
    const hrefs = await page.locator("ol > li > a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    const nonPublic = hrefs.map(idFromHref).filter((id) => id && !isPublicId(id));
    expect(nonPublic.length, `hits: ${hrefs.join(", ")}`).toBeGreaterThan(0);
  });
});
