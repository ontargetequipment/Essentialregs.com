/**
 * Smoke test, signed-in group. Runs only when SMOKE_EMAIL and SMOKE_PASSWORD
 * are set -- an existing, subscribed account; this file never creates one,
 * never pays, never writes anything -- and SMOKE_SCOPE is not "anonymous"
 * (production deployments run the anonymous group only).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, withProtectionBypass } from "./fixtures";

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

  test("the /regulations/gp01 reader labels every summary with its review status", async ({ page }) => {
    // Trust badge (owner decision, 29 Sep 2026): every summary panel opens
    // with text saying whether the summary was checked. GP01 had 64
    // summaries on 1 Oct 2026 (60 approved, 4 pending).
    const res = await page.goto("/regulations/gp01");
    expect(res?.status()).toBe(200);
    const badges = page.locator("#doc details.summary-panel > .summary-body > .summary-badge");
    expect(await badges.count()).toBeGreaterThan(0);
    const texts = await badges.allTextContents();
    for (const text of texts) expect(text).toMatch(/^(Reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed)$/);
    expect(texts.some((t) => t.startsWith("Reviewed") || t.startsWith("AI-generated"))).toBe(true);
    // The tooltip is added after hydration (reader-client.ts, fillSummaryBadges).
    await expect(badges.first()).toHaveAttribute("title", /Disclaimer page|Read the official text/);
    // No panel without a badge, and no reviewer named anywhere in the body.
    expect(await page.locator("#doc details.summary-panel").count()).toBe(texts.length);
    expect(await page.locator("#doc").innerText()).not.toMatch(/reviewed by/i);
  });

  test("/search shows a subscriber the one Ask (beta) line, linking to ?mode=ask with the query", async ({ page }) => {
    // The smoke account is a subscriber. The line sits under the keyword
    // form in place of the old Keyword / Ask tabs (owner decision, 30 Sep
    // 2026) and carries the current query into Ask.
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByText("Ask (beta)", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Try it →" })).toHaveAttribute("href", "/search?mode=ask&q=emissions");
  });

  test("an Ask card carries the review-status badge beside its summary", async ({ page }) => {
    // The smoke account is a subscriber (Ask is part of the subscription);
    // the first hit for this question has carried a summary since Phase 0.
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent("When is a GP01 required?"));
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Ask is a beta feature for subscribers")).toHaveCount(0);
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
    await expect(badge).toHaveText(/^(Reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed)$/);
    await expect(badge).toHaveAttribute("title", /Disclaimer page|Read the official text/);
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
