/**
 * Smoke test, anonymous group: always runs, against any deployment
 * (previews and production). Read-only. See playwright.config.ts.
 *
 * Expected values were read from the corpus on 25 Sep 2026; if the sample
 * rows (is_public) or the regulation roots change, update them here.
 */
import { expect, test } from "./fixtures";

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

  test("/sample shows the four sample cards with their regulation labels", async ({ page }) => {
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.locator("article > h2")).toHaveText(SAMPLE_HEADINGS);
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
