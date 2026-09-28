/**
 * Smoke test, anonymous group: always runs, against any deployment
 * (previews and production). Read-only. See playwright.config.ts.
 *
 * Expected values were read from the corpus on 25 Sep 2026; if the sample
 * rows (is_public) or the regulation roots change, update them here.
 */
import { expect, test } from "./fixtures";
import { ANNUAL_PRICE_DISPLAY, MONTHLY_PRICE_DISPLAY } from "../src/lib/pricing";

/** Each /sample card's heading, in SAMPLE_ORDER: regulation label · citation [— title]. */
const SAMPLE_HEADINGS = [
  "Regulation 7 · I.D.3.a.(i).",
  "APCD General Permit GP02 · II.A.2.",
  "2 CCR 404-1 · 604.a.(1).",
  "Common Provisions Regulation · I.G.90. — POTENTIAL TO EMIT",
];

test.describe("anonymous", () => {
  test("home page returns 200", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
  });

  test("the pricing card offers both prices, each with its own call to action", async ({ page }) => {
    await page.goto("/#pricing");
    const card = page.locator("#pricing");
    // Each amount and its period share one <p> ("$25" + " / month"), so
    // match the whole display string, which is also what pricing.ts promises.
    await expect(card.getByText(MONTHLY_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expect(card.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toBeVisible();
    // Logged out, each price box carries the create-an-account link (which
    // returns to /pricing) rather than the checkout form; no stray third
    // button below the boxes.
    const ctas = card.getByRole("link", { name: "Create an account to subscribe" });
    await expect(ctas).toHaveCount(2);
    for (const cta of await ctas.all()) {
      await expect(cta).toHaveAttribute("href", "/signup?next=/pricing");
    }
    await expect(card.getByText(/^7 days free, then the price you picked\./)).toBeVisible();
  });

  test("/pricing is a real page with both plans above a heading", async ({ page }) => {
    // Where /auth/confirm sends a new user; a 200, not the old redirect.
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    await expect(page.getByText(MONTHLY_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expect(page.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toBeVisible();
    // Logged out: the prices and one create-an-account link.
    await expect(page.getByRole("link", { name: "Create an account to subscribe" })).toHaveCount(1);
  });

  test("the checkout endpoint refuses an anonymous POST", async ({ page }) => {
    // Read-only: a 401 before Stripe is ever contacted. Sent from the page
    // so the deployment-protection bypass (fixtures.ts) applies.
    await page.goto("/");
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        body: new URLSearchParams({ interval: "year" }),
      });
      return res.status;
    });
    expect(status).toBe(401);
  });

  test("/sample shows the four sample cards with their regulation labels", async ({ page }) => {
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.locator("article > h2")).toHaveText(SAMPLE_HEADINGS);
  });

  test("/regulations lists the Colorado regulations for a logged-out visitor", async ({ page }) => {
    // The list is the same for a prospect as for a subscriber; only the card
    // targets differ (the public /preview teaser here, the reader when
    // entitled). The reader route itself stays 404 anonymously (below).
    const res = await page.goto("/regulations");
    expect(res?.status()).toBe(200);
    const cards = page.locator('a[href^="/regulations/"][href$="/preview"]');
    expect(await cards.count()).toBeGreaterThan(10);
    await expect(page.getByRole("heading", { name: "Subscribe to open the full regulations" })).toBeVisible();
  });

  test("a regulation preview returns 200", async ({ page }) => {
    const res = await page.goto("/regulations/7/preview");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("/sitemap.xml lists more than 50 URLs", async ({ page }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
    const xml = (await res?.text()) ?? "";
    const urls = xml.match(/<loc>/g) ?? [];
    expect(urls.length).toBeGreaterThan(50);
  });

  test("keyword search for 'emissions' returns the 3 public hits and no error", async ({ page }) => {
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Search isn't available right now")).toHaveCount(0);
    await expect(page.getByText(/^3 results for/)).toBeVisible();
    await expect(page.locator("ol > li > a")).toHaveCount(3);
  });

  test("a parenthesised /regs/<id> returns 200", async ({ page }) => {
    const res = await page.goto("/regs/sec-7-B-I-D-3-a-(i)");
    expect(res?.status()).toBe(200);
    await expect(page.locator("article > h2")).toContainText("I.D.3.a.(i).");
    // Provenance (backlog #16): the title names the provision and its
    // regulation, and the summary and the official text are each labelled.
    await expect(page).toHaveTitle(/^I\.D\.3\.a\.\(i\)\. · Regulation 7 — /);
    await expect(page.locator("article details > summary")).toHaveText([
      "Plain-English summary",
      "Original regulatory text",
    ]);
    await expect(page.getByRole("link", { name: "← Back to sample" })).toBeVisible();
  });

  test("an injection-shaped /regs/<id> returns 404", async ({ page }) => {
    const res = await page.goto(`/regs/${encodeURIComponent("sec-7-B-I-D-3-a-(i),is_public.eq.false")}`);
    expect(res?.status()).toBe(404);
  });

  test("the full reader /regulations/7 is 404 for an anonymous visitor", async ({ page }) => {
    const res = await page.goto("/regulations/7");
    expect(res?.status()).toBe(404);
  });
});
