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

/** The four is_public rows; a signed-in search must find something else. */
const PUBLIC_IDS = ["sec-7-B-I-D-3-a-(i)", "sec-gp02-II-A-2", "sec-ecmc-604-a-(1)", "sec-cp-I-G-90"];

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
    const res = await page.goto("/regulations/7");
    expect(res?.status()).toBe(200);
    expect(await page.locator("#doc .item").count()).toBeGreaterThan(100);

    // First visible cross-reference whose target is on this page.
    const slug = await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll("#doc .xref"))) {
        const target = el.getAttribute("data-target");
        if (target && document.getElementById(target) && el.getClientRects().length > 0) {
          el.setAttribute("data-smoke-xref", "");
          return target;
        }
      }
      return null;
    });
    expect(slug, "no in-page cross-reference found in Regulation 7").not.toBeNull();

    // The click handler is attached after hydration; retry until it takes.
    await expect(async () => {
      await page.locator("[data-smoke-xref]").click();
      await expect(page.locator("#backdrop")).toHaveClass(/\bshow\b/, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
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
      await expect(body.locator(".summary-badge")).toHaveText(/^AI reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?$/);
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
    for (const text of texts) expect(text).toMatch(/^(AI reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed)$/);
    // Never a bare "Reviewed" (owner decision, 4 Oct 2026): no summary claims human review.
    for (const text of texts) expect(text).not.toMatch(/^Reviewed\b/);
    expect(texts.some((t) => t.startsWith("AI reviewed") || t.startsWith("AI-generated"))).toBe(true);
    // The tooltip is added after hydration (reader-client.ts, fillSummaryBadges).
    await expect(badges.first()).toHaveAttribute("title", /Disclaimer page|Read the official text/);
    // No panel without a badge, and no reviewer named anywhere in the body.
    expect(await page.locator("#doc details.summary-panel").count()).toBe(texts.length);
    expect(await page.locator("#doc").innerText()).not.toMatch(/reviewed by/i);
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
    await expect(badge).toHaveText(/^(AI reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed)$/);
    await expect(badge).toHaveAttribute("title", /Disclaimer page|Read the official text/);
  });

  test("an engine question renders grouped under its question map; ?flat=1 shows the flat list", async ({ page }) => {
    // Ask Track B: "What regulations apply to a natural gas-fired engine?"
    // routes to the engines map (src/lib/question-maps.ts), so the page
    // shows the "Mapped question" line, the factors sentence and one h2 per
    // non-empty group, in MAP_GROUP_ORDER, with "Other matches" last if any.
    const q = "What regulations apply to a natural gas-fired engine?";
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(q));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Ask is part of the subscription")).toHaveCount(0);
    await expect(page.getByText("Mapped question: Natural gas-fired and diesel engines")).toHaveCount(1);
    await expect(page.getByText(/What applies depends on the fuel/)).toHaveCount(1);
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

    // The flat list: the retrieval order as before, no groups, a way back.
    const flat = await page.goto("/search?mode=ask&flat=1&q=" + encodeURIComponent(q));
    expect(flat?.status()).toBe(200);
    await expect(page.getByText("Mapped question:", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByText(/^\d+ provisions? most about/)).toHaveCount(1);
    await expect(page.getByText("Why it's here:", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show grouped" })).toHaveCount(1);
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
    await expect(page.getByText(/What applies depends on the tank's uncontrolled/)).toHaveCount(1);
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
    await expect(page.getByText(/What applies depends on the facility type/)).toHaveCount(1);
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
    const nonPublic = hrefs.map(idFromHref).filter((id) => id && !PUBLIC_IDS.includes(id));
    expect(nonPublic.length, `hits: ${hrefs.join(", ")}`).toBeGreaterThan(0);
  });
});
