/**
 * Smoke test, anonymous group: always runs, against any deployment
 * (previews and production). Read-only. See playwright.config.ts.
 *
 * Expected values were read from the corpus on 25 Sep 2026; if the sample
 * rows (is_public) or the regulation roots change, update them here.
 */
import { expect, protectionBypassHeaders, test, withProtectionBypass } from "./fixtures";
import { ANNUAL_PRICE_DISPLAY, MONTHLY_PRICE_DISPLAY } from "../src/lib/pricing";
import { DISCLAIMER_VERSION } from "../src/lib/disclaimer";

/**
 * The plan-first signup: logged out, every plan box's "Create an account"
 * link goes to /signup?plan=<that box's interval> (the account step), so
 * the plan the visitor clicked survives to /pricing after confirmation.
 */
async function expectPlanCtas(
  scope: import("@playwright/test").Locator | import("@playwright/test").Page,
  name = "Create an account to subscribe",
) {
  const ctas = scope.getByRole("link", { name });
  await expect(ctas).toHaveCount(2);
  for (const plan of ["month", "year"]) {
    const box = scope.locator(`[data-plan="${plan}"]`);
    await expect(box.getByRole("link", { name })).toHaveAttribute("href", `/signup?plan=${plan}`);
  }
}

/** The /pricing plan buttons (Sprint 5, 10 Oct 2026): same destination, the trial named. */
const PRICING_BUTTON = "Start your 7-day free trial!";

/**
 * What a review-status badge says (summaryStatusBadge): "AI-generated ·
 * automated check against source text" (dated in the reader), the pending
 * line, or "Reviewed" only for a person's approval (9 Oct 2026; none exist
 * today, the DB trigger refuses non-pipeline approvals).
 */
const BADGE_TEXT = /^(AI-generated · automated check against source text( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed|Reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?)$/;

/**
 * The Regulation 7 I.C.1 subtree, public since Sprint 7 (11 Oct 2026), in
 * document order. Every other Regulation 7 row is locked for a visitor except
 * the older sample row I.D.3.a.(i); the parent sec-7-B-I-C and siblings such
 * as sec-7-B-I-C-2 are locked. Approved summaries are on a, b, c, d, e,
 * e-(i), e-(ii), e-(iv), f-(i) and f-(ii); I.C.1, e-(iii) and f have none
 * (read from production on 11 Oct 2026; update here if that changes).
 */
const REG7_SUBTREE = [
  "sec-7-B-I-C-1",
  "sec-7-B-I-C-1-a",
  "sec-7-B-I-C-1-b",
  "sec-7-B-I-C-1-c",
  "sec-7-B-I-C-1-d",
  "sec-7-B-I-C-1-e",
  "sec-7-B-I-C-1-e-(i)",
  "sec-7-B-I-C-1-e-(ii)",
  "sec-7-B-I-C-1-e-(iii)",
  "sec-7-B-I-C-1-e-(iv)",
  "sec-7-B-I-C-1-f",
  "sec-7-B-I-C-1-f-(i)",
  "sec-7-B-I-C-1-f-(ii)",
];
const REG7_WITH_SUMMARY = REG7_SUBTREE.filter((id) => !["sec-7-B-I-C-1", "sec-7-B-I-C-1-e-(iii)", "sec-7-B-I-C-1-f"].includes(id));
/** The second hop of the walkthrough (13 Oct 2026, migration 20261013014006): I.D's heading and its one substantive child. */
const REG7_SECOND_HOP = ["sec-7-B-I-D", "sec-7-B-I-D-4"];
// The eight rows the /sample Ask example cites, public since migration 20261013051740 (walkthrough v3.1).
const REG7_ASK_CITES = ["sec-7-B-I-B-30", "sec-7-B-I-B-34", "sec-7-B-II-A-43", "sec-7-B-I-D-3-a-(ii)", "sec-7-B-I-E", "sec-7-B-I-F", "sec-7-B-II-C", "sec-7-B-V-C-2-w"];
const REG7_PUBLIC = new Set([...REG7_SUBTREE, ...REG7_SECOND_HOP, "sec-7-B-I-D-3-a-(i)", ...REG7_ASK_CITES]);

/**
 * Locked Regulation 7 rows and words of their official text (or, for a
 * heading, of the rows below it) from pipeline/sources/REG_7.txt, each on one
 * line of the source. None of them may reach a visitor by any path: the
 * focused preview, /regs, /api/provision or /search.
 */
const REG7_LOCKED = [
  // I.C. General Provisions: the parent of the subtree; its own text is a heading.
  { id: "sec-7-B-I-C", phrases: ["13.7 pounds of volatile organic", "manufacturer specifications and documentation of compliance"] },
  // I.C.2.: the next sibling of I.C.1.
  { id: "sec-7-B-I-C-2", phrases: ["must be demonstrated using one of the following emission factors", "13.7 pounds of volatile organic"] },
  // I.B.33.: a definition, in Part B Section I.
  { id: "sec-7-B-I-B-33", phrases: ["emission reductions from all atmospheric condensate storage tanks"] },
  // II.B.2.: another section's General Requirements (Section II.B.2.a is a near copy of I.C.1.a).
  {
    id: "sec-7-B-II-B-2",
    phrases: ["General requirements for air pollution control equipment used to comply", "reasonably foreseeable fluctuations in emissions of VOCs", "installation of controls on storage"],
  },
];

test.describe("anonymous", () => {
  test("home page returns 200 with the four hero buttons, Test Methods marked free", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    // The hero's four buttons, in order: the federal and state indexes,
    // the free Test Methods reference, then "See how it works!" (the sample)
    // on its own row. The Test Methods link
    // carries a FREE pill so it reads as free at a glance.
    const hero = page.locator("h1 ~ div").first();
    const buttons = hero.getByRole("link");
    await expect(buttons).toHaveText([
      "Federal Regulations",
      "State Regulations",
      /^Test Methods\s*Free$/,
      "See how it works!",
    ]);
    const hrefs = await buttons.evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["/federal", "/states", "/test-methods", "/sample"]);
    await expect(page.locator('a[href="/test-methods"]', { hasText: /free/i }).first()).toBeVisible();
  });

  test("the pricing card offers both prices, each with its own call to action", async ({ page }) => {
    await page.goto("/#pricing");
    const card = page.locator("#pricing");
    // Each amount and its period share one <p> ("$10" + " / month"), so
    // match the whole display string, which is also what pricing.ts promises.
    await expect(card.getByText(MONTHLY_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expect(card.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toBeVisible();
    // Logged out, each price box carries the create-an-account link for its
    // own plan rather than the checkout form; no stray third button below
    // the boxes.
    await expectPlanCtas(card);
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
    // Logged out: the prices and a trial link per plan (Sprint 5: "Start your 7-day free trial!",
    // still the plan-first signup, /signup?plan=<interval>).
    await expectPlanCtas(page, PRICING_BUTTON);
    // No plan picked yet: neither box is marked as the choice.
    await expect(page.getByText("Your choice")).toHaveCount(0);

    // What the subscription includes, and the free GP05 reader (Sprint 5, 10 Oct 2026).
    const includes = page.getByTestId("plan-includes");
    await expect(includes.getByRole("heading", { name: "What the subscription includes" })).toBeVisible();
    for (const lead of [
      "The full Colorado and federal corpus in the reader",
      "Plain-English summaries",
      "Keyword search",
      "Ask",
      "Cross-reference navigation",
      "Test methods",
    ]) {
      await expect(includes.getByText(`${lead}.`, { exact: false }).first()).toBeVisible();
    }
    await expect(includes.getByRole("link", { name: "Open the free GP05 reader" })).toHaveAttribute("href", "/regulations/gp05");
    // The prices are the owner's, exactly once each.
    await expect(page.getByText(MONTHLY_PRICE_DISPLAY, { exact: true })).toHaveCount(1);
    await expect(page.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toHaveCount(1);
  });

  test("/pricing?plan=month highlights the monthly box and keeps the annual one", async ({ page }) => {
    // Where /auth/confirm lands a new account that chose monthly on /signup.
    await page.goto("/pricing?plan=month");
    await expect(page.locator('[data-plan="month"]').getByText("Your choice")).toBeVisible();
    await expect(page.locator('[data-plan="year"]').getByText("Your choice")).toHaveCount(0);
    await expect(page.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expectPlanCtas(page, PRICING_BUTTON);
  });

  test("/signup asks for a plan first", async ({ page }) => {
    const res = await page.goto("/signup");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    await expect(page.getByText(MONTHLY_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expect(page.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose Monthly" })).toHaveAttribute("href", "/signup?plan=month");
    await expect(page.getByRole("link", { name: "Choose Annual" })).toHaveAttribute("href", "/signup?plan=year");
    await expect(page.getByText(/^7 days free, then the price you picked\./)).toBeVisible();
    // No account form on this step.
    await expect(page.getByLabel("Email")).toHaveCount(0);
  });

  test("/signup?plan=year shows the disclaimer first; the account form only after it is read and accepted", async ({ page }) => {
    const res = await page.goto("/signup?plan=year");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByText("Your plan: Annual")).toBeVisible();
    await expect(page.getByRole("link", { name: "Change plan" })).toHaveAttribute("href", "/signup");

    // Screen 2: the full disclaimer (the same sections as /disclaimer) in a
    // scroll box; no account form yet, and nothing to click through with.
    const box = page.getByTestId("disclaimer-scroll");
    await expect(box).toBeVisible();
    await expect(box.getByRole("heading", { name: /Informational and reference purposes only/ })).toBeVisible();
    await expect(box.getByRole("heading", { name: /No warranty; your responsibility/ })).toBeAttached();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    const checkbox = page.getByRole("checkbox", { name: /I have read the disclaimer/ });
    const cont = page.getByRole("button", { name: "Continue" });
    await expect(checkbox).toBeDisabled();
    await expect(cont).toBeDisabled();
    // The label links to the two documents it names (the disclaimer text
    // itself links to /terms too, so scope to the label).
    const label = page.locator("label").filter({ hasText: "I have read the disclaimer" });
    await expect(label.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    await expect(label.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");

    // Reading to the end unlocks the checkbox; ticking it unlocks Continue.
    await box.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(checkbox).toBeEnabled();
    await expect(cont).toBeDisabled();
    await checkbox.check();
    await expect(cont).toBeEnabled();
    await cont.click();

    // Screen 3: the account form, still on the same URL, carrying the plan
    // and the acceptance as hidden fields for the signup action.
    await expect(page).toHaveURL(/\/signup\?plan=year$/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    await expect(page.locator('input[name="plan"]')).toHaveValue("year");
    await expect(page.locator('input[name="accepted"]')).toHaveValue("1");
    await expect(page.locator('input[name="disclaimer_version"]')).toHaveValue(DISCLAIMER_VERSION);
    await expect(box).toHaveCount(0);

    // The server enforces it too: a submission without the acceptance field
    // is refused before Supabase is ever contacted (no account is created).
    await page.locator('input[name="accepted"]').evaluate((el) => el.remove());
    await page.getByLabel("Email").fill("smoke-never-created@example.com");
    await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
    await page.getByLabel("Confirm password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Please read and accept the disclaimer before creating an account.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup\?plan=year$/);
  });

  test("no query string skips the disclaimer", async ({ page }) => {
    // The step lives in component state, not the URL: claiming acceptance
    // in the address bar still lands on the disclaimer with no form.
    await page.goto(`/signup?plan=month&accepted=1&disclaimer_version=${DISCLAIMER_VERSION}`);
    await expect(page.getByTestId("disclaimer-scroll")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("/check-email is the screen after sign-up, with a resend form", async ({ page }) => {
    // Where the signup action redirects a new account (read-only here: the
    // resend button is never pressed).
    const res = await page.goto("/check-email?email=someone%40example.com&plan=month");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText("someone@example.com")).toBeVisible();
    await expect(page.getByText(/Monthly plan/)).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("someone@example.com");
    await expect(page.locator('input[name="plan"]')).toHaveValue("month");
    await expect(page.getByRole("button", { name: "Resend confirmation email" })).toBeEnabled();
    // The header has its own "Log in"; this is the one in the page body.
    await expect(page.getByRole("main").getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  test("/login?error=confirmation-failed explains and points at a new link", async ({ page }) => {
    // Where /auth/confirm sends a link it couldn't verify.
    await page.goto("/login?error=confirmation-failed");
    const main = page.getByRole("main");
    await expect(main.getByRole("alert")).toContainText("That confirmation link didn't work.");
    await expect(main.getByRole("link", { name: "request a new link" })).toHaveAttribute("href", "/check-email");
    await expect(page.getByLabel("Email")).toBeVisible();
    // A plain /login carries no such notice.
    await page.goto("/login");
    await expect(main.getByRole("alert")).toHaveCount(0);
  });

  test("/signup with an unknown plan falls back to the plan choice", async ({ page }) => {
    await page.goto("/signup?plan=weekly");
    await expect(page.getByRole("heading", { name: "Choose your plan" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
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

  test("the Stripe canary passes: the deployment's key works and both Prices match pricing.ts", async ({ request, baseURL }) => {
    // GET /api/health/stripe (14 Oct 2026: an expired live key broke checkout
    // and nothing noticed). Production deployments run with SMOKE_SCOPE=anonymous
    // (ci.yml), the same signal smoke-signed-in.spec.ts skips on; a manual run
    // against the production host counts too. A preview whose environment has
    // no STRIPE_SECRET_KEY answers 503 "misconfigured", which skips here
    // rather than failing an unrelated pull request. Any other failure fails.
    const isProduction =
      process.env.SMOKE_SCOPE === "anonymous" || /(^|\.)essentialregs\.com$/.test(new URL(baseURL ?? "http://x").hostname);
    const res = await request.get("/api/health/stripe", { headers: protectionBypassHeaders() });
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.json();
    test.skip(
      !isProduction && res.status() === 503 && body.reason === "misconfigured",
      "Preview without STRIPE_SECRET_KEY: the Stripe canary answers misconfigured."
    );
    expect(body, JSON.stringify(body)).toMatchObject({ ok: true });
    expect(res.status()).toBe(200);
  });

  test("/sample answers one canned search and one canned Ask around GP05", async ({ page }) => {
    // Sprint 4, 10 Oct 2026: the page replays a frozen snapshot (src/data/
    // sample-snapshot.json). GP05 results are open cards; every other result
    // is a locked card linking to its focused preview.
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "See how EssentialRegs answers a real Colorado oil and gas compliance question",
    );

    // The intro (v3.1, 13 Oct 2026) says what a visitor gets, with no "open in place" promise the logged-out path breaks.
    await expect(page.locator("main")).toContainText("is free to read in full");
    await expect(page.locator("main")).toContainText("cross-references that open in place for subscribers (in this walkthrough they open as free preview pages)");
    // One primary and one secondary, in the walkthrough card (v3.1); the trial button is at the bottom, not here.
    const top = page.getByTestId("sample-walkthrough");
    await expect(top.getByRole("link", { name: "Start the walkthrough" })).toHaveClass(/bg-accent/);
    await expect(top.getByRole("link", { name: "Explore GP05 on your own" })).toHaveAttribute("href", "/regulations/gp05");
    await expect(top.getByRole("link", { name: "Explore GP05 on your own" })).not.toHaveClass(/(^|\s)bg-accent(\s|$)/);
    await expect(page.getByTestId("sample-top-cta")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open the free GP05 reader" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Read GP05 in the full reader" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("60-second");
    // Sprint 6: the search and Ask example is a collapsed second section, under
    // the walkthrough (smoke-tour.spec.ts checks the walkthrough itself).
    const example = page.getByTestId("sample-example");
    await expect(example).not.toHaveAttribute("open", "");
    await example.locator(":scope > summary").click();
    await expect(example).toHaveAttribute("open", "");
    const keywordBox0 = await page.getByTestId("sample-keyword").boundingBox();
    const topBox = await top.boundingBox();
    expect(keywordBox0 && topBox && topBox.y + topBox.height <= keywordBox0.y + 1).toBe(true);

    // Keyword search: a recommended starting point, five results open and five more behind a disclosure.
    const keyword = page.getByTestId("sample-keyword");
    await expect(keyword.getByRole("heading", { name: /^Keyword search/ })).toBeVisible();
    await expect(keyword.getByTestId("sample-recommended")).toHaveText(
      "Recommended starting point: GP05 \u2014 Produced Water Storage Tank Batteries",
    );
    await expect(keyword.getByTestId("sample-recommended").getByRole("link")).toHaveAttribute("href", "/regulations/gp05");
    await expect(keyword.getByText("Showing 5 of 25 results")).toBeVisible();
    const keywordLinks = keyword.locator("ol > li > a");
    await expect(keywordLinks).toHaveCount(10);
    await expect(keyword.locator("ol > li > a:visible")).toHaveCount(5);
    const more = keyword.getByTestId("sample-keyword-more");
    await expect(more.locator("summary")).toContainText("Show 5 more results (10 of 25)");
    await more.locator("summary").click();
    await expect(keyword.locator("ol > li > a:visible")).toHaveCount(10);
    const keywordHrefs = await keywordLinks.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(keywordHrefs.some((h) => h.startsWith("/regulations/gp05#"))).toBe(true);
    expect(keywordHrefs.some((h) => /\/preview\?p=/.test(h))).toBe(true);
    for (const href of keywordHrefs) expect(href, href).toMatch(/^\/regulations\/gp05#|\/preview\?p=/);
    const keywordLocked = keyword.getByTestId("locked-result");
    expect(await keywordLocked.count()).toBeGreaterThan(0);
    await expect(keywordLocked.first().locator("a")).toHaveAttribute("href", /\/preview\?p=/);
    await expect(keywordLocked.first()).toContainText("In the full corpus");
    await expect(keywordLocked.first()).toContainText("start your 7-day trial");

    // Ask: the mapped answer opens with three provisions per group; the rest is behind a disclosure.
    const ask = page.getByTestId("sample-ask");
    await expect(ask.getByRole("heading", { name: /^Ask:/ })).toBeVisible();
    await expect(ask.getByTestId("map-title")).toHaveText("Produced water storage tanks and tank batteries");
    await expect(ask.getByTestId("map-intro")).toBeVisible();
    expect(await ask.getByTestId("locked-result").count()).toBeGreaterThan(0);
    await expect(ask.getByText("Not shown because you said produced water:")).toBeVisible();

    // Sprint 8 (11 Oct 2026): the answer is a research map first. The line that
    // says what Ask is, then the table (one row per group, every provision a
    // link), then the map's introduction under the smaller "Reading of the
    // provisions above", then the cards behind the one disclosure.
    const map = ask.getByTestId("ask-map");
    await expect(map.getByTestId("ask-finds-line")).toHaveText("It finds provisions; it does not decide what applies to you.");
    await expect(map.getByRole("columnheader")).toHaveText(["Question component", "Provision", "Why it matters"]);
    const mapRows = map.getByTestId("ask-map-row");
    expect(await mapRows.count()).toBeGreaterThan(3);
    const mapHrefs = await map.locator("tbody a").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(mapHrefs.length).toBeGreaterThan(5);
    // A visitor's destinations are the cards' own: GP05 opens the reader, everything else the focused preview.
    expect(mapHrefs.some((h) => h.startsWith("/regulations/gp05#"))).toBe(true);
    expect(mapHrefs.some((h) => /\/preview\?p=/.test(h))).toBe(true);
    for (const href of mapHrefs) expect(href, href).toMatch(/^\/regulations\/gp05#|\/preview\?p=/);
    const reading = ask.getByTestId("ask-reading");
    await expect(reading.getByRole("heading", { level: 3, name: "Reading of the provisions above" })).toBeVisible();
    await expect(reading.getByTestId("map-intro")).toBeVisible();
    const [lineBox, tableBox, readingBox] = [await map.getByTestId("ask-finds-line").boundingBox(), await map.locator("table").boundingBox(), await reading.boundingBox()];
    expect(lineBox && tableBox && readingBox && lineBox.y + lineBox.height <= tableBox.y + 1 && tableBox.y + tableBox.height <= readingBox.y + 1).toBe(true);
    const askMore = ask.getByTestId("sample-ask-more");
    await expect(askMore.locator("summary")).toContainText("See the complete sample answer");
    const moreBox = await askMore.boundingBox();
    expect(readingBox && moreBox && readingBox.y + readingBox.height <= moreBox.y + 1).toBe(true);
    const openAtFirst = await ask.locator("ol > li:visible").count();
    expect(await askMore.locator("ol > li").count()).toBeGreaterThan(0);
    await askMore.locator("summary").click();
    expect(await ask.locator("ol > li:visible").count()).toBeGreaterThan(openAtFirst);

    // A line into the real reader.
    await expect(page.locator('a[href="/regulations/gp05"]').first()).toBeVisible();

    // The closing buttons, after the Ask section: the trial and the search link (v3.1: no second reader button).
    const cta = page.getByTestId("sample-cta");
    await expect(cta.getByRole("link", { name: "Start your 7-day trial!" })).toHaveAttribute("href", "/signup");
    await expect(cta.getByRole("link", { name: "Search the free GP05 sample" })).toHaveAttribute("href", "/search");
    await expect(cta.getByRole("link")).toHaveCount(2);
    const askBox = await ask.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(askBox && ctaBox && ctaBox.y > askBox.y + askBox.height - 1).toBe(true);

    const text = await page.locator("main").innerText();
    expect(text).not.toContain("exactly as subscribers see them");
    expect(text).not.toContain("cross-references resolved");
    expect(text).not.toContain("is open in the full reader");
    // The stamp is 03:46 UTC on 10 Oct: still 9 Oct in Colorado.
    expect(text).toContain("snapshot from 9 Oct 2026");
  });

  test("the /sample Ask research map stacks at phone width: no sideways scroll, the labels move into each row", async ({ page }) => {
    // Sprint 8, 11 Oct 2026: below md the table is not a table; each row is a
    // block with its three labels (the column headers are hidden there).
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/sample");
    await page.getByTestId("sample-example").locator(":scope > summary").click();
    const map = page.getByTestId("ask-map");
    await expect(map).toBeVisible();
    await expect(map.getByRole("columnheader")).toHaveCount(0);
    const first = map.getByTestId("ask-map-row").first();
    await expect(first.getByText("Provision", { exact: true })).toBeVisible();
    await expect(first.getByText("Why it matters", { exact: true })).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
    // The map itself stays inside the viewport.
    const box = await map.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
  });

  test("a related link on a public card page opens the focused preview of that provision, not the whole-document preview (GP12 VI.A.1)", async ({ page }) => {
    // Sprint 4, 10 Oct 2026. GP12 VI.A.1 is a rank-3 neighbour of Reg 7
    // I.D.3.a.(i). The link used to go to /regulations/gp12/preview, which
    // shows generic teaser content whatever was clicked. /sample no longer
    // carries related blocks; the card page does, as a teaser for a visitor.
    await page.goto("/regs/sec-7-B-I-D-3-a-(i)");
    const related = page.locator("section").filter({ has: page.getByRole("heading", { name: "Related by meaning, not cited" }) });
    await expect(related).toBeVisible();
    const link = related.getByRole("link").filter({ hasText: "VI.A.1" }).first();
    await expect(link).toHaveAttribute("href", "/regulations/gp12/preview?p=sec-gp12-VI-A-1");
    // Locked neighbours are citation and title only: no summary prose, no breadcrumb.
    await expect(link).not.toContainText("Plain-English summary");
    await expect(link.locator("p.line-clamp-2")).toHaveCount(0);
    await link.click();
    await page.waitForURL(/\/regulations\/gp12\/preview\?p=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("VI.A.1");
    const panel = page.locator("[data-testid=locked-destination]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Start your 7-day trial");
    await expect(panel.getByRole("link", { name: "Start your 7-day trial" })).toHaveAttribute("href", "/signup");
  });

  test("GP05 opens in the real reader for a logged-out visitor (Sprint 4 free sample)", async ({ page }) => {
    // Needs the data migration 20261010120000_gp05_public_sample.sql applied.
    const res = await page.goto("/regulations/gp05");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#sidebar")).toBeVisible();
    await expect(page.locator("#jumpbox")).toBeVisible();
    // Hydrated: the reader sets the combobox role last, after its click handler is attached.
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    await expect(page.locator(".source-status-line")).toContainText(/Current through/);
    const source = page.locator("#doc a.reg-source-link").first();
    await expect(source).toHaveAttribute("href", /^https?:\/\//);
    expect(await page.locator("#doc details.summary-panel").count()).toBeGreaterThan(0);

    // The slim, non-blocking banner.
    const banner = page.getByTestId("visitor-banner");
    await expect(banner).toContainText("You are reading GP05, the free sample.");
    await expect(banner).toContainText("The rest of the corpus opens with a 7-day trial.");
    await expect(banner.getByRole("link", { name: "Start your trial" })).toHaveAttribute("href", "/signup");
    await expect(banner.getByRole("link", { name: "Search the free GP05 sample" })).toHaveAttribute("href", "/search");

    // A summary panel carries a review badge and, once opened, the official-source link.
    const panel = page.locator("#doc details.summary-panel").first();
    await panel.locator(":scope > summary").click();
    await expect(panel.locator(".summary-badge")).toHaveText(BADGE_TEXT);
    await expect(panel.locator(".summary-status a")).toHaveAttribute("href", /^https?:\/\//);

    // Jump box: a citation typed in, Enter, and the reader moves (the hash changes).
    const citation = await page.locator("#doc > .item[data-citation]").first().getAttribute("data-citation");
    expect(citation).toBeTruthy();
    expect(new URL(page.url()).hash).toBe("");
    await page.locator("#jumpbox").fill(citation!);
    await page.locator("#jumpbox").press("Enter");
    await expect.poll(() => new URL(page.url()).hash).toMatch(/^#sec-gp05-/);

    // A same-document cross-reference opens the popup in place.
    const xref = page.locator("#doc .xref:visible").first();
    await xref.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    await page.locator("#popup-close").click();
    await expect(page.locator("#backdrop")).not.toHaveClass(/show/);
  });

  // The sidebar's part label is one link (14 Oct 2026): the numeral and the
  // description under it. A click on the description alone goes to the part
  // and opens (never collapses) its group; Enter on the focused link does the same.
  test("GP05's sidebar: clicking a part's description goes to the part and opens its group", async ({ page }) => {
    await page.goto("/regulations/gp05");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const link = page.locator('#sidebar a.nav-part-link[href="#sec-gp05-II"]');
    const group = page.locator("#navgroup-sec-gp05-II");
    await expect(link.locator(".nav-part-cite")).toHaveText("II.");
    await expect(link.locator(".nav-part-sub")).toHaveText("Operating Terms and Conditions");
    // Nothing of the label is outside the anchor.
    await expect(group.locator("summary > .nav-part-sub")).toHaveCount(0);

    // Closed group: the description text opens it and lands on the part.
    await group.evaluate((d) => ((d as HTMLDetailsElement).open = false));
    await page.locator("#sidebar").getByText("Operating Terms and Conditions", { exact: true }).click();
    await expect.poll(() => new URL(page.url()).hash).toBe("#sec-gp05-II");
    await expect(group).toHaveAttribute("open", "");
    await expect(page.locator('#doc > [id="sec-gp05-II"]')).toBeVisible();

    // Open group: the same click navigates and leaves it open (it used to toggle).
    await page.locator("#sidebar").getByText("Operating Terms and Conditions", { exact: true }).click();
    await expect(group).toHaveAttribute("open", "");

    // Keyboard: Enter on the focused link behaves like the click.
    await group.evaluate((d) => ((d as HTMLDetailsElement).open = false));
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(group).toHaveAttribute("open", "");
    await expect.poll(() => new URL(page.url()).hash).toBe("#sec-gp05-II");
  });

  // The jump box searches the whole provision text through /api/reader-search
  // (11 Oct 2026): "sampling" is in GP05 VI.D past the first 90 characters.
  test("GP05's jump box: 'sampling' lists VI.D with a highlighted excerpt, 'VI.D' still jumps at once, 'zzzz' says No matches", async ({ page }) => {
    await page.goto("/regulations/gp05");
    const box = page.locator("#jumpbox");
    await expect(box).toHaveAttribute("role", "combobox");
    const results = page.locator("#jump-results");
    const VI_D = "sec-gp05-VI-D";

    // A word from deep in the text.
    await box.fill("sampling");
    const item = results.locator(`.jr-item[data-slug="${VI_D}"]`);
    await expect(item).toBeVisible();
    await expect(item.locator(".jr-id")).toHaveText("VI.D.");
    await expect(item.locator(".jr-excerpt mark").first()).toContainText(/sampl/i);
    expect(await item.locator(".jr-excerpt").innerText()).toMatch(/sampling/i);
    // The excerpt reaches past the first-line snippet (90 characters, which ended at "…storage tanks utilizing si…").
    expect((await item.locator(".jr-excerpt").innerText()).length).toBeGreaterThan(130);
    await expect(results.locator(".jr-empty")).toHaveCount(0);

    // A citation: listed first, with no wait for the server, and Enter lands on it.
    await box.fill("VI.D");
    await expect(results.locator(".jr-item").first()).toHaveAttribute("data-slug", VI_D);
    await box.press("Enter");
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${VI_D}`);
    await expect(results).not.toHaveClass(/show/);

    // Nothing in the document.
    await box.fill("zzzz");
    await expect(results).toHaveClass(/show/);
    await expect(results.locator(".jr-empty")).toHaveText("No matches");
    await expect(results.locator('.jr-item[role="option"]')).toHaveCount(0);
    await box.press("Escape");
    await expect(results).not.toHaveClass(/show/);
  });

  // -------------------------------------------------------------------------
  // The leak guard for the jump box's text search: scoped to one document,
  // read through the visitor's own RLS-bound client, so a locked document
  // returns nothing and a partly public one only its public rows.
  // -------------------------------------------------------------------------

  test("/api/reader-search gives a visitor GP05's own rows, only public rows of Regulation 7, and nothing of a locked document", async ({ request }) => {
    const get = async (reg: string, q: string) => {
      const res = await request.get(`/api/reader-search?reg=${encodeURIComponent(reg)}&q=${encodeURIComponent(q)}`, { headers: protectionBypassHeaders() });
      return { res, text: await res.text() };
    };
    // GP05: VI.D, highlighted, never cached.
    const gp05 = await get("gp05", "sampling");
    expect(gp05.res.status()).toBe(200);
    expect(gp05.res.headers()["cache-control"]).toContain("no-store");
    const found = JSON.parse(gp05.text).results as { id: string; citation: string; headline: string | null }[];
    expect(found.map((r) => r.id)).toContain("sec-gp05-VI-D");
    expect(found.length).toBeLessThanOrEqual(10);
    for (const r of found) expect(r.id, r.id).toMatch(/^sec-gp05-/);
    expect(found.find((r) => r.id === "sec-gp05-VI-D")?.headline).toContain("<mark>");
    // Latency as the visitor's browser sees it (round trip to the deployment, which asks the database). Logged, not asserted past a generous ceiling.
    const timings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const again = await get("gp05", "sampling");
      timings.push(Date.now() - t0);
      expect(again.res.status()).toBe(200);
    }
    console.log(`reader-search latency, GP05 "sampling", 5 requests (ms): ${timings.join(", ")}`);
    test.info().annotations.push({ type: "reader-search latency ms", description: timings.join(", ") });
    expect(Math.min(...timings), "a warm request answers well inside the debounce-plus-patience budget").toBeLessThan(3000);

    // A document that is entirely locked: nothing, for a word it certainly has.
    for (const reg of ["3", "gp12", "26"]) {
      const locked = await get(reg, "emissions");
      expect(locked.res.status(), reg).toBe(200);
      expect(JSON.parse(locked.text).results, `reg ${reg} is locked`).toEqual([]);
    }

    // Regulation 7: a phrase only a locked row has finds nothing ...
    const lockedPhrase = await get("7", "13.7 pounds of volatile organic compounds per barrel of condensate");
    expect(JSON.parse(lockedPhrase.text).results).toEqual([]);
    expect(lockedPhrase.text).not.toContain("13.7 pounds");
    // ... and one both a public and a locked row have finds the public row only.
    const both = await get("7", "separator dumps into the tank");
    const ids = (JSON.parse(both.text).results as { id: string }[]).map((r) => r.id);
    expect(ids, "the public subtree row is found").toContain("sec-7-B-I-C-1-a");
    for (const id of ids) expect(REG7_PUBLIC.has(id), `${id} is not a public row`).toBe(true);
    expect(both.text).not.toContain("sec-7-B-II-B-2");

    // Not a document key: refused, not searched.
    for (const reg of ["", "../3", "gp05;drop", "a".repeat(40)]) {
      const bad = await get(reg, "sampling");
      expect(bad.res.status(), JSON.stringify(reg)).toBe(400);
    }
  });

  test("on GP05, a link into Regulation 7 opens a locked popup in place, never a redirect into a 404", async ({ page }) => {
    await page.goto("/regulations/gp05");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    // The first Regulation 7 link in the document, whatever its row (the
    // reader marks every cross-regulation link a.xref-external-reg).
    const link = page.locator('#doc a.xref-external-reg[href^="/regulations/7"]').first();
    await expect(link).toHaveCount(1);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    const panel = page.locator("#popup-body [data-testid=locked-destination]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("is in the full corpus.");
    await expect(panel).toContainText("Start your 7-day trial");
    await expect(panel.getByRole("link", { name: "Start your 7-day trial" })).toHaveAttribute("href", "/signup");
    await expect(panel.getByRole("link", { name: "See what's in it" })).toHaveAttribute("href", /^\/regulations\/7\/preview/);
    await expect(page.locator("#popup-eyebrow")).toHaveText("Regulation 7");
    await expect(page.locator("#popup-title")).not.toHaveText("");
    // Still on GP05: the click did not navigate.
    expect(new URL(page.url()).pathname).toBe("/regulations/gp05");
    // Closing returns to the document.
    await page.locator("#popup-close").click();
    await expect(page.locator("#backdrop")).not.toHaveClass(/show/);

    // Outside the tour (no ?tour=1), VI.C's Regulation 7 I.C.1 citation is a PUBLIC row (11 Oct
    // 2026, after Sprint 7): the popup shows its text instead of the locked label. I.C.1's own
    // text is a heading, so the requirement itself, I.C.1.a, is read in the popup, with the
    // summary control and source link of the row, and a footer that opens the focused preview.
    const ic1 = page.locator('#doc > [id="sec-gp05-VI-C"] a.xref-external-reg[href$="p=sec-7-B-I-C-1"]');
    await expect(ic1).toHaveCount(1);
    await ic1.scrollIntoViewIfNeeded();
    await ic1.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    const popup = page.locator("#popup-body");
    await expect(popup).toContainText("manufacturer specifications and documentation of compliance");
    await expect(popup.getByTestId("locked-destination")).toHaveCount(0);
    await expect(popup).not.toContainText("is in the full corpus.");
    await expect(page.locator("#popup-eyebrow")).toHaveText("Regulation 7");
    await expect(page.locator("#popup-title")).toHaveText("I.C.1.");
    const popupPanel = popup.locator("details.summary-panel").first();
    await expect(popupPanel).not.toHaveAttribute("open", "");
    await popupPanel.locator(":scope > summary").click();
    await expect(popupPanel).toHaveAttribute("open", "");
    await expect(popupPanel.locator(".summary-badge")).toHaveText(BADGE_TEXT);
    await expect(popupPanel.locator(".summary-status a")).toHaveText("View official source ↗");
    await expect(popupPanel.locator(".summary-status a")).toHaveAttribute("href", /^https?:\/\//);
    await expect(page.locator("#popup-goto")).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C");
    expect(new URL(page.url()).pathname, "the click did not navigate").toBe("/regulations/gp05");
    await page.locator("#popup-close").click();
    await expect(page.locator("#backdrop")).not.toHaveClass(/show/);

    // The part between the regulation and the section is a link too (11 Oct
    // 2026): VI.A's "Regulation Number 7, Part B, Section I.A.1". Its locked
    // popup offers the focused preview of the part root, and that page opens.
    const partB = page.locator('#doc > [id="sec-gp05-VI-A"] a.xref-external-reg[href="/regulations/7/preview?p=sec-7-P-B"]');
    await expect(partB).toHaveText("Part B");
    await partB.scrollIntoViewIfNeeded();
    await partB.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    const partPanel = page.locator("#popup-body [data-testid=locked-destination]");
    await expect(partPanel).toContainText("Regulation 7 PART B is in the full corpus.");
    const inside = partPanel.getByRole("link", { name: "See what's in it" });
    // Sprint 7: the link carries the GP05 row it came from, and the preview offers the way back.
    await expect(inside).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-P-B&from=sec-gp05-VI-A");
    expect(new URL(page.url()).pathname).toBe("/regulations/gp05");
    await inside.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === "sec-7-P-B");
    await expect(page.locator("h1")).toHaveText("PART B");
    await expect(page.locator("[data-testid=locked-destination]")).toContainText("Regulation 7 PART B is in the full corpus.");
    await expect(page.locator("#preview-return")).toHaveText("← Back to GP05 · VI.A");
    await expect(page.locator("#preview-return")).toHaveAttribute("href", "/regulations/gp05#sec-gp05-VI-A");
  });

  test("a cross-regulation click opens the popup at once, loading, while a slow /api/provision answers; the answer then fills it", async ({ page }) => {
    // 15 Oct 2026: on a freshly deployed production, the first /api/provision
    // answer took longer than the popup assertion's 15 s, and until the
    // answer came the click showed nothing at all. Now the popup opens on
    // the click with the citation and a "Loading" line, and the answer
    // replaces it. The endpoint is held back 3 s here to see both states.
    // fallback(), not continue(): the fixtures' context route (the
    // protection-bypass header) still has to see the request.
    await page.route(/\/api\/provision\//, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fallback();
    });
    await page.goto("/regulations/gp05");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const link = page.locator('#doc > [id="sec-gp05-VI-A"] a.xref-external-reg[href="/regulations/7/preview?p=sec-7-P-B"]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    // Pending, within a second of the click: the backdrop, the regulation,
    // the citation as the link printed it, the loading line, no footer.
    await expect(page.locator("#backdrop")).toHaveClass(/show/, { timeout: 1500 });
    await expect(page.locator("#popup-eyebrow")).toHaveText("Regulation 7");
    await expect(page.locator("#popup-title")).toHaveText("Part B");
    await expect(page.getByTestId("popup-pending")).toHaveText("Loading…");
    await expect(page.locator("#popup-body")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#popup-goto")).toBeHidden();
    // Answered: the locked panel replaces the loading line.
    const panel = page.locator("#popup-body [data-testid=locked-destination]");
    await expect(panel).toContainText("Regulation 7 PART B is in the full corpus.");
    await expect(page.getByTestId("popup-pending")).toHaveCount(0);
    await expect(page.locator("#popup-body")).not.toHaveAttribute("aria-busy", "true");
    expect(new URL(page.url()).pathname, "the click did not navigate").toBe("/regulations/gp05");
  });

  test("a cross-regulation click whose /api/provision fails closes the pending popup and follows the link instead", async ({ page }) => {
    // The failure path is unchanged by the pending state: a route that does
    // not answer cleanly never leaves a "Loading" popup behind. The click is
    // replayed as plain navigation to the link's own href.
    await page.route(/\/api\/provision\//, (route) => route.fulfill({ status: 500, body: "" }));
    await page.goto("/regulations/gp05");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const link = page.locator('#doc > [id="sec-gp05-VI-A"] a.xref-external-reg[href="/regulations/7/preview?p=sec-7-P-B"]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === "sec-7-P-B");
    await expect(page.locator("h1")).toHaveText("PART B");
  });

  test("GP05 IX.B links every code of \"Subpart OOOO, OOOOa, or OOOOb\", and a click on OOOOb opens the OOOOb preview", async ({ page }) => {
    // 14 Oct 2026: only the first code of the list was a link. Each code is
    // its own cross-regulation link to its subpart's document (the visitor's
    // body carries the preview form), and the click opens that document's
    // preview in place, like any other whole-document citation.
    await page.goto("/regulations/gp05");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const row = page.locator('#doc > [id="sec-gp05-IX-B"]');
    await expect(row).toHaveCount(1);
    for (const [code, key] of [
      ["OOOO", "oooo"],
      ["OOOOa", "ooooa"],
      ["OOOOb", "oooob"],
    ] as const) {
      const link = row.locator("a.xref-external-reg", { hasText: new RegExp(`^(Subpart )?${code}$`) });
      await expect(link, `${code} is a link`).toHaveCount(1);
      await expect(link).toHaveAttribute("href", `/regulations/${key}/preview`);
    }
    // Nothing of the sentence's text changed: the codes still read as printed.
    await expect(row).toContainText("Subpart OOOO, OOOOa, or OOOOb");
    const oooob = row.locator("a.xref-external-reg", { hasText: /^OOOOb$/ });
    await oooob.scrollIntoViewIfNeeded();
    await oooob.click();
    await expect(page.locator("#backdrop")).toHaveClass(/show/);
    await expect(page.locator("#popup-eyebrow")).toHaveText("40 CFR Part 60 Subpart OOOOb");
    const panel = page.locator("#popup-body [data-testid=locked-destination]");
    await expect(panel).toContainText("40 CFR Part 60 Subpart OOOOb is in the full corpus.");
    const inside = panel.getByRole("link", { name: "See what's in it" });
    await expect(inside).toHaveAttribute("href", "/regulations/oooob/preview");
    // The click did not navigate; the preview page itself opens.
    expect(new URL(page.url()).pathname).toBe("/regulations/gp05");
    const res = await page.goto("/regulations/oooob/preview");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("/api/provision answers a visitor with a locked label, no text, never cached, for a locked row", async ({ request }) => {
    const res = await request.get("/api/provision/sec-7-B-I-B-33", { headers: protectionBypassHeaders() });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ locked: true, id: "sec-7-B-I-B-33", reg_key: "7" });
    expect(Object.keys(body).sort()).toEqual(["citation", "id", "locked", "path", "reg_key", "title"]);
    const missing = await request.get("/api/provision/sec-7-B-no-such-row", { headers: protectionBypassHeaders() });
    expect(missing.status()).toBe(404);
  });

  test("/api/provision gives a visitor a public Regulation 7 row's text, summary control and source link, and sub-rows", async ({ request }) => {
    // 11 Oct 2026, after Sprint 7: the reader's citation popup shows what the preview shows.
    const leaf = await request.get("/api/provision/sec-7-B-I-C-1-a", { headers: protectionBypassHeaders() });
    expect(leaf.status()).toBe(200);
    expect(leaf.headers()["cache-control"]).not.toContain("no-store");
    const a = await leaf.json();
    expect(a).toMatchObject({ id: "sec-7-B-I-C-1-a", reg_key: "7", public: true });
    expect(a.locked).toBeUndefined();
    expect(a.html).toContain("manufacturer specifications and documentation of compliance");
    expect(a.panel).toContain('<details class="summary-panel">');
    expect(a.panel).toContain("View official source");
    expect(a.below).toBe("");
    // The parent of the subtree's own text is a heading; the requirement is in the rows under it.
    const parent = await request.get("/api/provision/sec-7-B-I-C-1", { headers: protectionBypassHeaders() });
    const ic1 = await parent.json();
    expect(ic1).toMatchObject({ id: "sec-7-B-I-C-1", public: true });
    expect(ic1.html).toContain("General Requirements");
    expect(ic1.below).toContain("manufacturer specifications and documentation of compliance");
    // Its 12 public descendants, and no more.
    expect((ic1.below.match(/<div class="item" data-citation="I\.C\.1\./g) ?? []).length).toBe(REG7_SUBTREE.length - 1);
    expect((ic1.below.match(/<div class="item" data-citation="/g) ?? []).length).toBe(REG7_SUBTREE.length - 1);
    // The older public sample row is public too.
    const sample = await request.get("/api/provision/sec-7-B-I-D-3-a-(i)", { headers: protectionBypassHeaders() });
    expect(await sample.json()).toMatchObject({ id: "sec-7-B-I-D-3-a-(i)", reg_key: "7", public: true });
    // Nothing outside the subtree rides along.
    for (const { phrases } of REG7_LOCKED) for (const phrase of phrases.slice(0, 1)) expect(JSON.stringify(ic1), phrase).not.toContain(phrase);
  });

  test("the focused preview answers 200 and ignores a ?p= that is not a provision of that regulation", async ({ page }) => {
    const ok = await page.goto("/regulations/gp12/preview?p=sec-gp12-VI-A-1");
    expect(ok?.status()).toBe(200);
    await expect(page.locator("[data-testid=locked-destination]")).toBeVisible();
    for (const bad of ["sec-7-B-I-D-3-a-(i)", "not%20an%20id", "sec-gp12-no-such-row"]) {
      const res = await page.goto(`/regulations/gp12/preview?p=${bad}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("[data-testid=locked-destination]")).toHaveCount(0);
    }
  });

  test("/states lists Colorado with live counts and links to its index", async ({ page }) => {
    const res = await page.goto("/states");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "State Regulations" })).toBeVisible();
    // The card is the only link to /states/colorado (the header and footer
    // link to /states); its counts come from the same roots the index lists.
    const card = page.getByRole("main").locator('a[href="/states/colorado"]');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Colorado");
    await expect(card).toContainText(/\d+ regulations · \d+ General Permits/);
    await expect(page.getByText("More states are on the way.")).toBeVisible();
  });

  test("/states/colorado lists the Colorado regulations for a logged-out visitor", async ({ page }) => {
    // The list is the same for a prospect as for a subscriber; only the card
    // targets differ (the public /preview teaser here, the reader when
    // entitled). The reader route itself stays 404 anonymously (below).
    const res = await page.goto("/states/colorado");
    expect(res?.status()).toBe(200);
    const cards = page.locator('a[href^="/regulations/"][href$="/preview"]');
    expect(await cards.count()).toBeGreaterThan(10);
    await expect(page.getByRole("heading", { name: "Subscribe to open the full regulations" })).toBeVisible();
  });

  test("the Regulations nav lists the two jurisdictions, Test Methods and the request link; General Permits hang off Colorado", async ({ page }) => {
    // The APCD General Permits are a Colorado category, not a jurisdiction,
    // so the header dropdown, the mobile drawer and the footer's Regulations
    // column each carry exactly Federal Regulations, State Regulations,
    // (since 9 Oct 2026) the free Test Methods reference and (since 12 Oct
    // 2026) "Request a regulation" last, in that order. The permits index
    // keeps its URL (sitemap, external links) and is reached from the
    // Colorado index's group heading.
    const TWO = ["Federal Regulations", "State Regulations", "Test Methods", "Request a regulation"];
    await page.goto("/states/colorado");
    const footer = page.getByRole("navigation", { name: "Footer" }).locator("ul").first();
    await expect(footer.getByRole("link")).toHaveText(TWO);

    // The dropdown (desktop) and the drawer (phone) render from the same
    // list; the project runs Desktop Chrome, so the drawer is checked at a
    // phone width. Each hides the other's DOM (sm:hidden / hidden sm:flex).
    await page.getByRole("button", { name: "Regulations" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(TWO);
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer.getByRole("list").first().getByRole("link")).toHaveText(TWO);
    await drawer.getByRole("button", { name: "Close menu" }).click();

    const gpLink = page.getByRole("main").locator('a[href="/general-permits"]');
    await expect(gpLink).toHaveCount(1);
    await expect(gpLink).toHaveText("APCD General Permits");

    const res = await page.goto("/general-permits");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("link", { name: "← Colorado regulations" })).toHaveAttribute("href", "/states/colorado");
    const sitemap = await page.request.get("/sitemap.xml", { headers: protectionBypassHeaders() });
    expect(await sitemap.text()).toContain("/general-permits</loc>");
  });

  test("/test-methods and a method page render for a logged-out visitor, no subscribe prompt", async ({ page }) => {
    const index = await page.goto("/test-methods");
    expect(index?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Test Methods" })).toBeVisible();
    await expect(page.getByRole("main").locator('a[href="/test-methods/method-21"]')).toHaveCount(1);

    const res = await page.goto("/test-methods/method-21");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Method 21" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the method on the eCFR →" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.ecfr\.gov\/current\/title-40\//,
    );
    // Sections 1.0-2.0 as official text first, then our editorial copy.
    await expect(page.getByRole("heading", { level: 2, name: "From the method — regulatory text", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "EssentialRegs notes", exact: true })).toBeVisible();
    const h2s = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(h2s.indexOf("From the method — regulatory text")).toBeGreaterThanOrEqual(0);
    expect(h2s.indexOf("EssentialRegs notes")).toBeGreaterThan(h2s.indexOf("From the method — regulatory text"));
    await expect(page.locator("#official-text .method-text")).toContainText("1.0");
    for (const heading of ["What it measures", "How it works", "Equipment", "When a rule cites it"]) {
      await expect(page.getByRole("heading", { level: 3, name: heading })).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 2, name: "Cited by" })).toBeVisible();
    await expect(page.getByText("Everything under ‘EssentialRegs notes’ is our reference copy, not the method.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Subscribe to open the full regulations" })).toHaveCount(0);

    const missing = await page.goto("/test-methods/method-7400");
    expect(missing?.status()).toBe(404);
  });

  test("every 'Cited by' link on Method 21 opens for a logged-out visitor (none is a 404)", async ({ page, baseURL }) => {
    // Sprint 5 (10 Oct 2026): the citations used to link to the full reader,
    // /regulations/<reg>#<id>, which 404s for a visitor outside GP05. Now they
    // go through provisionDestination: the focused preview, or the GP05 reader.
    // Method 21 has a few hundred citing provisions, so the links are requested
    // (redirects followed, a few at a time), not opened in a page.
    test.setTimeout(240_000);
    const res = await page.goto("/test-methods/method-21");
    expect(res?.status()).toBe(200);
    // Expand every "Show all" disclosure; the full list is already in the HTML.
    await page.locator("#cited-by details").evaluateAll((els) => els.forEach((d) => ((d as HTMLDetailsElement).open = true)));
    await expect(page.locator("#cited-by details:not([open])")).toHaveCount(0);
    const hrefs = await page.locator("#cited-by ul a[href]").evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);

    // One request per path + query; the #fragment is never sent.
    const targets = new Map<string, string>();
    for (const href of hrefs) {
      const url = new URL(href, baseURL);
      targets.set(url.pathname + url.search, url.pathname + url.search);
    }
    const failures: string[] = [];
    const queue = [...targets.keys()];
    const worker = async () => {
      for (let target = queue.shift(); target !== undefined; target = queue.shift()) {
        const r = await page.request.get(target, { headers: protectionBypassHeaders() });
        if (r.status() === 404) failures.push(`${target} -> 404`);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    expect(failures, `${failures.length} of ${targets.size} Cited by links 404 for a visitor:\n${failures.join("\n")}`).toEqual([]);
  });

  test("/regulations is a permanent redirect to /states/colorado", async ({ page, baseURL }) => {
    // Unfollowed, so the status and Location can be read. page.request
    // bypasses context.route (fixtures.ts), so it carries the
    // deployment-protection header itself.
    const res = await page.request.get("/regulations", {
      maxRedirects: 0,
      headers: protectionBypassHeaders(),
    });
    expect([301, 308]).toContain(res.status());
    const location = res.headers()["location"] ?? "";
    expect(new URL(location, baseURL).pathname).toBe("/states/colorado");
  });

  test("/contact-sales is a permanent redirect to /pricing", async ({ page, baseURL }) => {
    // Multi-seat pricing is not offered (12 Oct 2026); the page is gone and
    // next.config.ts sends indexed links to the plans.
    const res = await page.request.get("/contact-sales", {
      maxRedirects: 0,
      headers: protectionBypassHeaders(),
    });
    expect(res.status()).toBe(308);
    const location = res.headers()["location"] ?? "";
    expect(new URL(location, baseURL).pathname).toBe("/pricing");
  });

  test("/request renders the regulation request form for a visitor", async ({ page }) => {
    // Request a regulation (12 Oct 2026): the public form, no sign-in needed.
    const res = await page.goto("/request");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Request a regulation" })).toBeVisible();
    await expect(page.getByText("What people ask for decides what we build next.")).toBeVisible();
    const form = page.locator("form").filter({ has: page.locator('input[name="regulation"]') });
    await expect(form).toHaveCount(1);
    await expect(form.locator('input[name="regulation"]')).toHaveAttribute("required", "");
    await expect(form.locator('select[name="jurisdiction"]')).toHaveAttribute("required", "");
    // Federal first, the fifty states, Other last (plus the "Choose one" placeholder).
    const options = form.locator('select[name="jurisdiction"] option');
    await expect(options).toHaveCount(53);
    await expect(options.nth(1)).toHaveText("Federal");
    await expect(options.nth(2)).toHaveText("Alabama");
    await expect(options.last()).toHaveText("Other");
    for (const name of ["agency", "source_url", "reason", "email", "company"]) {
      await expect(form.locator(`[name="${name}"]`), name).toHaveCount(1);
    }
    // Logged out, the email field is editable and empty.
    await expect(form.locator('input[name="email"]')).toBeEditable();
    await expect(form.locator('input[name="email"]')).toHaveValue("");
    // The hidden render time and the honeypot are there, and the honeypot is empty and not announced.
    await expect(form.locator('input[name="rendered_at"]')).toHaveCount(1);
    const honeypot = form.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toHaveValue("");
    await expect(honeypot).not.toBeInViewport();
    await expect(form.getByRole("button", { name: "Send request" })).toBeVisible();
    // No "legal advice" language on the page.
    await expect(page.locator("main")).not.toContainText(/legal advice/i);
  });

  test("/request at 375px: no horizontal overflow, the button is a full row", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/request");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const button = page.getByRole("button", { name: "Send request" });
    const box = await button.boundingBox();
    expect(box && box.height >= 44).toBe(true);
    expect(box && box.width >= 300).toBe(true);
  });

  test("the six entry points link to /request", async ({ page }) => {
    await page.goto("/");
    // Homepage coverage line and the footer's Regulations group.
    await expect(page.getByRole("link", { name: "Request a regulation →" })).toHaveAttribute("href", "/request");
    await expect(page.locator("footer").getByRole("link", { name: "Request a regulation" })).toHaveAttribute("href", "/request");
    await page.goto("/states");
    await expect(page.getByRole("main").getByRole("link", { name: "Request it" })).toHaveAttribute("href", "/request");
    await page.goto("/federal");
    await expect(page.getByRole("main").getByRole("link", { name: "Request it" })).toHaveAttribute("href", "/request");
    await page.goto("/contact");
    await expect(page.getByRole("main").getByRole("link", { name: "Request a regulation" })).toHaveAttribute("href", "/request");
    const sitemap = await page.request.get("/sitemap.xml", { headers: protectionBypassHeaders() });
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/request</loc>");
  });

  test("/admin/requests sends a visitor to /login", async ({ page, baseURL }) => {
    const res = await page.request.get("/admin/requests", { maxRedirects: 0, headers: protectionBypassHeaders() });
    expect([302, 303, 307, 308]).toContain(res.status());
    const location = res.headers()["location"] ?? "";
    expect(new URL(location, baseURL).pathname).toBe("/login");
  });

  test("an unknown state is 404", async ({ page }) => {
    const res = await page.goto("/states/atlantis");
    expect(res?.status()).toBe(404);
  });

  test("a regulation preview returns 200", async ({ page }) => {
    const res = await page.goto("/regulations/7/preview");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("/changelog has three sections in order; summary quality is collapsed to one line per day with its explanation", async ({ page }) => {
    // Review 4 (7 Oct 2026): regulatory changes first and open, links and
    // sources second, summary quality last, collapsed by default. Since the
    // second review of the page (7 Oct 2026) the regulatory section lists
    // only what came from the agency, so it normally shows one line saying
    // none is recorded; the links section carries our own corrections.
    const res = await page.goto("/changelog");
    expect(res?.status()).toBe(200);
    const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
    expect(headings).toEqual(["Regulatory changes", "Links, sources and transcription", "Summary quality"]);
    await expect(page.getByText("The changelog could not be loaded right now", { exact: false })).toHaveCount(0);
    await expect(page.getByText("An automated second pass compares each plain-English summary with the official text.", { exact: false })).toHaveCount(1);
    const summaryDays = page.locator("section[aria-labelledby='changelog-summaries'] details");
    expect(await summaryDays.count()).toBeGreaterThan(0);
    await expect(summaryDays.first()).not.toHaveAttribute("open", "");
    await expect(summaryDays.first().locator("summary")).toContainText(/summar(y|ies)/);
    // The regulatory section either lists agency changes (days open, each
    // line naming a regulation) or says in one line that none is recorded.
    const regulatory = page.locator("section[aria-labelledby='changelog-regulatory']");
    const regulatoryLines = await regulatory.locator("li").count();
    if (regulatoryLines > 0) {
      expect(await regulatory.locator("h3").count()).toBeGreaterThan(0);
      await expect(regulatory.locator("li").first()).toContainText(/provisions? (updated|added|removed)|agency's new version/);
    } else {
      await expect(regulatory.locator("p[data-empty-section='regulatory']")).toContainText(/^No agency rule changes recorded since .+\. Each regulation's page shows its current version and effective date\.$/);
    }
    // Our own work never reads as an agency change: the links section
    // carries the corrections and the link imports.
    const links = page.locator("section[aria-labelledby='changelog-links']");
    expect(await links.locator("li").count()).toBeGreaterThan(0);
    await expect(links.locator("li").filter({ hasText: "corrections to our copy of the text" }).first()).toBeVisible();
    await expect(regulatory.locator("li").filter({ hasText: /corrections to our copy|links added/ })).toHaveCount(0);
    // What "a correction to our copy" means is said once, under the links heading (11 Oct 2026).
    await expect(links.getByText("A correction to our copy is a fix to our transcription of the text, with the official text unchanged.")).toHaveCount(1);
    // The summaries are "checked against source text", never "AI reviewed" (the badge's own wording since 9 Oct 2026).
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/AI[\s-]+review/i);
    await expect(summaryDays.first().locator("summary")).toContainText(/checked against source text|rewritten|corrected/);
  });

  test("/about lists the corpus from the database, dated and counted by jurisdiction, with no 'More is coming'", async ({ page }) => {
    // Sprint 8 (11 Oct 2026): "What's covered today" was a hand-written list
    // of four documents; it is now the released regulation roots grouped like
    // the /states/colorado and /federal indexes. The database always holds
    // the Colorado and federal documents the groups below name.
    const res = await page.goto("/about");
    expect(res?.status()).toBe(200);
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "What's covered today" }) });
    await expect(section).toContainText(/the corpus holds \d+ documents: \d+ from Colorado and \d+ federal\./);
    await expect(section).toContainText("Air Quality Control Commission (5 CCR 1001)");
    await expect(section).toContainText("APCD General Permits");
    await expect(section).toContainText("Energy and Carbon Management Commission (2 CCR 404-1)");
    await expect(section).toContainText(/40 CFR Part 60/);
    await expect(section).toContainText("PHMSA");
    await expect(section).not.toContainText("More is coming");
    await expect(section.locator('a[href="/states"]')).toHaveCount(1);
    await expect(section.locator('a[href="/sample"]')).toHaveCount(1);
    expect(await page.locator("main").innerText()).not.toMatch(/AI[\s-]+review/i);
  });

  test("citations print in their stored case: no uppercase transform on an index or reader citation", async ({ page }) => {
    // Previews showed "§ 60.5365B(E)" for "§ 60.5365b(e)" because the eyebrow
    // CSS upper-cased its text (11 Oct 2026). The text in the DOM was always
    // right; the computed style is what a reader saw.
    await page.goto("/states/colorado");
    const indexCitation = page.locator('a[href$="/preview"] p').first();
    expect(await indexCitation.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
    await page.goto("/regulations/gp05");
    for (const selector of [".reg-eyebrow", ".nav-reg-title"]) {
      const el = page.locator(selector).first();
      await expect(el, selector).toBeAttached();
      expect(await el.evaluate((node) => getComputedStyle(node).textTransform), selector).toBe("none");
    }
  });

  test("/sitemap.xml lists more than 50 URLs", async ({ page }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
    const xml = (await res?.text()) ?? "";
    const urls = xml.match(/<loc>/g) ?? [];
    expect(urls.length).toBeGreaterThan(50);
  });

  test("keyword search for 'emissions' answers a logged-out visitor with open or locked cards and no error", async ({ page }) => {
    // GP05 became public on 10 Oct 2026, so the count is no longer the four
    // old sample rows; what holds is that something comes back and every
    // card goes somewhere a visitor can follow: GP05's reader, a focused
    // preview, or a standalone /regs/ card.
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Search isn't available right now")).toHaveCount(0);
    await expect(page.getByText(/^\d+ results? for/)).toBeVisible();
    const cards = page.locator("ol > li > a");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const href of await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""))) {
      expect(href, href).toMatch(/^\/regulations\/gp05#|\/preview\?p=|^\/regs\//);
    }
    // Every keyword card with a summary labels it and badges its review
    // status (owner decision, 29 Sep 2026).
    const badges = page.locator("ol > li > a .summary-badge");
    expect(await badges.count()).toBeGreaterThan(0);
    for (const text of await badges.allTextContents()) expect(text).toMatch(BADGE_TEXT);
  });

  test("a logged-out keyword search card never links into a gated reader", async ({ page }) => {
    // The full reader 404s for an anonymous visitor except GP05's; a card for
    // any other regulation goes to the focused preview (or /regs/ for a row
    // with no regulation key). Sprint 4, 10 Oct 2026.
    await page.goto("/search?q=emissions");
    const hrefs = await page.locator("ol > li > a").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      if (/^\/regulations\/[^/]+#/.test(href)) expect(href, href).toMatch(/^\/regulations\/gp05#/);
      else expect(href, href).toMatch(/\/preview\?p=|^\/regs\//);
    }
  });

  test("/search shows the Keyword / Ask tabs to a visitor who is not logged in; the Ask tab carries the query", async ({ page }) => {
    // Ask is a first-class mode for every visitor (3 Oct 2026, reversing the
    // keyword-first layout of 30 Sep): the tablist sits under the heading.
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
    const tabs = page.getByRole("tablist").getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText("Keyword");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toHaveText("Ask");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");
    await expect(tabs.nth(1)).toHaveAttribute("href", "/search?mode=ask&q=emissions");
    // The not-logged-in notice offers the trial beside "Log in" (Sprint 5, 10 Oct 2026).
    const loginNotice = page.getByText("You're not logged in", { exact: false });
    await expect(loginNotice.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    await expect(loginNotice.getByRole("link", { name: "start your 7-day trial" })).toHaveAttribute("href", "/signup");
    expect(await page.locator("body").innerText()).not.toMatch(/\bbeta\b/i);
  });

  test("a logged-out search that GP05 cannot answer says how many provisions the full library has; a nonsense search says neither", async ({ page }) => {
    // Sprint 8, 11 Oct 2026 (src/lib/library-count.ts, migration
    // 20261011210829_count_provisions_matching). "glycol dehydrator" is in no
    // GP05 row (pipeline/sources/GP05.txt has neither word) and in no other
    // public row, and it is in Regulation 7, ECMC and the NSPS subparts, so the
    // free search finds nothing and the count is above 0 (38 on 13 Oct 2026). It
    // was "dehydrator" until walkthrough v3.1 made Regulation 7 I.B.34 public,
    // whose "well production facility" definition names dehydration. It passes
    // against production once the migration is applied; before that the RPC
    // does not exist, the line is hidden by design, and this step fails on the
    // missing line.
    const term = "glycol dehydrator";
    const res = await page.goto(`/search?q=${encodeURIComponent(term)}`);
    expect(res?.status()).toBe(200);
    const main = page.getByRole("main");
    await expect(main.getByText(`No results for “${term}”`)).toBeVisible();
    const line = main.getByTestId("library-count");
    await expect(line).toBeVisible();
    const m = /^No matches in GP05\. The full library has ([\d,]+) provisions? matching “glycol dehydrator”\./.exec((await line.innerText()).replace(/\s+/g, " "));
    expect(m, await line.innerText()).not.toBeNull();
    expect(Number(m![1].replace(/,/g, ""))).toBeGreaterThan(0);
    await expect(line.getByRole("link", { name: "Start your 7-day trial" })).toHaveAttribute("href", "/signup");
    // Leak check: the count is the only thing that came from outside GP05. No result
    // card, no link into another document, no locked citation anywhere in main.
    await expect(main.locator("ol > li")).toHaveCount(0);
    const hrefs = await main.locator("a").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    for (const href of hrefs) expect(href, href).not.toMatch(/\/regulations\/(?!gp05)|\/preview|\/regs\/sec-/);
    expect(await main.innerText()).not.toMatch(/Regulation \d|Subpart [IJOZ]|§ ?\d|ECMC/);

    // Nonsense: no count, no line.
    await page.goto(`/search?q=${encodeURIComponent("zzqxjvkwy")}`);
    await expect(main.getByText("No results for", { exact: false })).toBeVisible();
    await expect(main.getByTestId("library-count")).toHaveCount(0);
    expect(await main.innerText()).not.toMatch(/The full library has|No matches in GP05/);
  });

  test("clicking the Ask tab switches the page on click (not only on Enter), carries the typed query, and Keyword switches back", async ({ page }) => {
    // Sprint 3: the tabs are links whose click navigates right away with
    // whatever is in the search box at that moment (SearchTabs.tsx).
    const res = await page.goto("/search?q=emissions");
    expect(res?.status()).toBe(200);
    const tabs = page.getByRole("tablist").getByRole("tab");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    // Type a different question, then click Ask: the Ask page opens with
    // that question, no Enter pressed.
    // #search-query is the page's own box; the header has a search box too.
    await page.locator("#search-query").fill("do I need a permit for a flare");
    await tabs.nth(1).click();
    await page.waitForURL((url) => url.searchParams.get("mode") === "ask", { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("q")).toBe("do I need a permit for a flare");
    const askTabs = page.getByRole("tablist").getByRole("tab");
    await expect(askTabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(askTabs.nth(0)).toHaveAttribute("aria-selected", "false");
    await expect(page.locator("#search-query")).toHaveValue("do I need a permit for a flare");
    // The Ask content is on the page: a visitor who is not logged in gets no live Ask button
    // but a way in, "Start a 7-day trial to use Ask" (Sprint 5, 10 Oct 2026), and the
    // subscription notice.
    // Scoped to main: the site header has a submit button named "Search" too.
    await expect(page.getByRole("main").getByRole("button", { name: "Ask", exact: true })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: "Start a 7-day trial to use Ask" })).toHaveAttribute("href", "/signup");
    await expect(page.getByText("Ask is part of the subscription.", { exact: false })).toBeVisible();
    // Keyword switches back on click too, keeping the query.
    await askTabs.nth(0).click();
    await page.waitForURL((url) => url.searchParams.get("mode") === null && url.searchParams.get("q") === "do I need a permit for a flare", {
      timeout: 15_000,
    });
    await expect(page.getByRole("tablist").getByRole("tab").nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("main").getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });

  test("/search?mode=ask tells a visitor who is not a subscriber that Ask is part of the subscription", async ({ page }) => {
    const res = await page.goto("/search?mode=ask");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
    const tabs = page.getByRole("tablist").getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(0)).toHaveAttribute("href", "/search");
    const notice = page.getByText("Ask is part of the subscription.", { exact: false });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Keyword search of the free sample is still available on the Keyword tab.");
    await expect(notice.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    // A signup link beside "Log in" (Sprint 5, 10 Oct 2026).
    await expect(notice.getByRole("link", { name: "start your 7-day trial" })).toHaveAttribute("href", "/signup");
    expect(await page.locator("body").innerText()).not.toMatch(/\bbeta\b/i);
  });

  test("a parenthesised /regs/<id> returns 200", async ({ page }) => {
    const res = await page.goto("/regs/sec-7-B-I-D-3-a-(i)");
    expect(res?.status()).toBe(200);
    await expect(page.locator("article > h2")).toContainText("I.D.3.a.(i).");
    // Provenance (backlog #16): the title names the provision and its
    // regulation, and the summary and the official text are each labelled.
    await expect(page).toHaveTitle(/^I\.D\.3\.a\.\(i\)\. · Regulation 7 — /);
    // The summary toggle carries the review-status badge after its label
    // (SummaryBadge.tsx); this row has been approved since 15 Sep 2026.
    await expect(page.locator("article details > summary")).toHaveText([
      /^Plain-English summary\s*AI-generated · automated check against source text$/,
      "Original regulatory text",
    ]);
    await expect(page.locator("article .summary-badge")).toHaveAttribute("title", /Disclaimer page/);
    // 11 Oct 2026: a Regulation 7 row goes back to Regulation 7 (the visitor preview, on its Part), not to the sample.
    const back = page.getByRole("link", { name: "← Back to Regulation 7" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-P-B");
    await expect(page.getByRole("link", { name: "← Back to sample" })).toHaveCount(0);
  });

  test("each of the 13 public Regulation 7 pages at /regs/<id> links back to Regulation 7's preview on Part B, and the link opens", async ({ page, request }) => {
    for (const id of REG7_SUBTREE) {
      const res = await request.get(`/regs/${id}`, { headers: protectionBypassHeaders() });
      expect(res.status(), id).toBe(200);
      const html = await res.text();
      expect(html, id).toMatch(/<a [^>]*href="\/regulations\/7\/preview\?p=sec-7-P-B"[^>]*>← Back to Regulation 7<\/a>/);
      expect(html, id).not.toContain("Back to sample");
    }
    await page.goto("/regs/sec-7-B-I-C-1-a");
    await page.getByRole("link", { name: "← Back to Regulation 7" }).click();
    await page.waitForURL((url) => url.pathname === "/regulations/7/preview" && url.searchParams.get("p") === "sec-7-P-B");
    await expect(page.locator("h1")).toHaveText("PART B");
  });

  test("an injection-shaped /regs/<id> returns 404", async ({ page }) => {
    const res = await page.goto(`/regs/${encodeURIComponent("sec-7-B-I-D-3-a-(i),is_public.eq.false")}`);
    expect(res?.status()).toBe(404);
  });

  test("the reader /regulations/7 is never shown to an anonymous visitor, and no longer a 404: the redirect page sends them to the preview", async ({ page }) => {
    // Regulation 7's subtree is public, its reader is not (PUBLIC_READER_REGS is GP05 alone): the
    // focused preview is the only way in. Sprint 8 (11 Oct 2026): the request used to be a 404;
    // the page now renders a tiny redirect (the hash is read in the browser). ?tour=1 is dropped,
    // ?from= is carried, a provision in the hash becomes ?p=.
    const cases: [string, string][] = [
      ["/regulations/7", "/regulations/7/preview"],
      ["/regulations/7?tour=1", "/regulations/7/preview"],
      ["/regulations/7?from=sec-gp05-VI-C&tour=1", "/regulations/7/preview?from=sec-gp05-VI-C"],
      ["/regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B-I-C-1", "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C"],
    ];
    for (const [url, expected] of cases) {
      // A URL that differs from the one before it only in its #hash would be
      // a same-document navigation with no response: start each from a blank page.
      await page.goto("about:blank");
      // "commit": the page navigates away while it loads (location.replace), which a wait for the load event can report as an interrupted navigation.
      const res = await page.goto(url, { waitUntil: "commit" });
      expect(res?.status(), url).toBe(200);
      await page.waitForURL((u) => u.pathname === "/regulations/7/preview");
      const landed = new URL(page.url());
      expect(landed.pathname + landed.search, url).toBe(expected);
      await expect(page.locator("#doc"), url).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 }), url).toBeVisible();
    }
  });

  test("opened directly, a cross-reference into a locked regulation lands on its focused preview (new tab, copied link)", async ({ page }) => {
    // The ninth review's case: /regulations/7#sec-7-B-I-C-1 typed or pasted, no click in the GP05 reader.
    await page.goto("about:blank");
    await page.goto("/regulations/7#sec-7-B-I-C-1", { waitUntil: "commit" });
    await page.waitForURL((u) => u.pathname === "/regulations/7/preview");
    expect(page.url().endsWith("/regulations/7/preview?p=sec-7-B-I-C-1"), page.url()).toBe(true);
    // I.C.1 is public: its subtree is on the page.
    await expect(page.getByTestId("preview-subtree")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("I.C.1.");

    // A locked row: the focused preview says it is in the full corpus, with the way back.
    await page.goto("about:blank");
    await page.goto("/regulations/7?from=sec-gp05-VI-C#sec-7-B-II-B-2", { waitUntil: "commit" });
    await page.waitForURL((u) => u.pathname === "/regulations/7/preview");
    expect(page.url().endsWith("/regulations/7/preview?p=sec-7-B-II-B-2&from=sec-gp05-VI-C"), page.url()).toBe(true);
    await expect(page.getByTestId("locked-destination")).toContainText("is in the full corpus.");
    await expect(page.locator("#preview-return")).toHaveText("← Back to GP05 · VI.C");

    // An id of another regulation, or junk, in the hash: the plain preview of the regulation asked for.
    for (const hash of ["#sec-3-A-II-B-5", "#nonsense", "#%E0%A4%A"]) {
      await page.goto("about:blank");
      await page.goto(`/regulations/7${hash}`, { waitUntil: "commit" });
      await page.waitForURL((u) => u.pathname === "/regulations/7/preview");
      expect(new URL(page.url()).search, hash).toBe("");
    }
  });

  test("/regulations/7 with JavaScript off is no 404: a meta refresh and a plain link to the preview, and the page names nothing of the document", async ({ request, browser, baseURL }) => {
    const res = await request.get("/regulations/7", { headers: protectionBypassHeaders() });
    expect(res.status()).toBe(200);
    const html = await res.text();
    // The no-JavaScript fallback: a refresh (inside <noscript>, so a browser running the script is not raced by it) and a visible link.
    expect(html).toMatch(/<noscript><meta http-equiv="refresh" content="0;url=\/regulations\/7\/preview"\/><\/noscript>/);
    expect(html).toMatch(/<a href="\/regulations\/7\/preview"[^>]*>Open the preview of Regulation 7<\/a>/);
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).toMatch(/<title>Preview of Regulation 7/);
    // The script is there for the hash.
    expect(html).toContain("location.replace(");
    // Nothing of the locked document beyond its name: none of the phrases the leak guard knows.
    for (const { phrases } of REG7_LOCKED) for (const phrase of phrases) expect(html, phrase).not.toContain(phrase);
    expect(html).not.toContain("manufacturer specifications and documentation of compliance");

    // A browser with JavaScript off follows the refresh to the plain preview.
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      await withProtectionBypass(context, baseURL);
      const page = await context.newPage();
      await page.goto("/regulations/7", { waitUntil: "commit" });
      await page.waitForURL((u) => u.pathname === "/regulations/7/preview");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("#doc")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("an unknown regulation is still a 404 (the redirect page is only for one that exists)", async ({ page, request }) => {
    for (const path of ["/regulations/doesnotexist1", "/regulations/doesnotexist1?from=sec-gp05-VI-C"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    const api = await request.get("/regulations/doesnotexist1", { headers: protectionBypassHeaders() });
    expect(api.status()).toBe(404);
    expect(await api.text()).not.toContain("location.replace(");
    // A key that is not alphanumeric never reaches a query.
    const bad = await request.get("/regulations/7%3Bdrop", { headers: protectionBypassHeaders() });
    expect(bad.status()).toBe(404);
  });

  test("every cross-regulation link in the logged-out GP05 reader opens: none is a 404, and none is the closed reader's form", async ({ page, baseURL }) => {
    // Sprint 8 (11 Oct 2026). The importer writes /regulations/7#sec-..., the closed reader's URL;
    // the visitor's body now carries the preview form, so right-click, copy link, middle-click and
    // JavaScript-off all work. Request each one directly, as a new tab would.
    test.setTimeout(240_000);
    const res = await page.goto("/regulations/gp05");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const hrefs = await page.locator("#doc a.xref-external-reg").evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.length, "GP05 cites other regulations").toBeGreaterThan(0);
    // Not the reader form of any regulation but GP05 itself.
    const readerForm = hrefs.filter((h) => /^\/regulations\/(?!gp05(?:[?#]|$))[A-Za-z0-9]+(?:[?#]|$)/i.test(h));
    expect(readerForm, "links in the reader form of a closed regulation").toEqual([]);
    const preview = hrefs.filter((h) => /^\/regulations\/[A-Za-z0-9]+\/preview(\?|$)/.test(h));
    expect(preview.length, "links in the preview form").toBeGreaterThan(0);

    // One request per path + query (a #fragment is never sent).
    const targets = new Map<string, string>();
    for (const href of hrefs) {
      const url = new URL(href, baseURL);
      targets.set(url.pathname + url.search, href);
    }
    const failures: string[] = [];
    const queue = [...targets.keys()];
    const worker = async () => {
      for (let target = queue.shift(); target !== undefined; target = queue.shift()) {
        const r = await page.request.get(target, { headers: protectionBypassHeaders() });
        if (r.status() >= 400) failures.push(`${target} -> ${r.status()}`);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    test.info().annotations.push({ type: "cross-regulation links", description: `${hrefs.length} links, ${targets.size} distinct requests, ${failures.length} failed` });
    console.log(`GP05 cross-regulation links: ${hrefs.length} (${targets.size} distinct URLs requested), ${failures.length} failed`);
    expect(failures, `${failures.length} of ${targets.size} cross-regulation links fail for a visitor:\n${failures.join("\n")}`).toEqual([]);
  });

  test("a middle-click on a cross-regulation link in GP05 opens the focused preview in a new tab (no popup, no 404)", async ({ page, context }) => {
    await page.goto("/regulations/gp05");
    await expect(page.locator("#jumpbox")).toHaveAttribute("role", "combobox");
    const link = page.locator('#doc > [id="sec-gp05-VI-C"] a.xref-external-reg[href$="p=sec-7-B-I-C-1"]');
    await link.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([context.waitForEvent("page"), link.click({ modifiers: ["ControlOrMeta"] })]);
    await popup.waitForURL((u) => u.pathname === "/regulations/7/preview");
    expect(new URL(popup.url()).searchParams.get("p")).toBe("sec-7-B-I-C-1");
    await expect(popup.getByTestId("preview-subtree")).toBeVisible();
    await expect(page.locator("#backdrop")).not.toHaveClass(/show/);
    await popup.close();
  });

  // -------------------------------------------------------------------------
  // The leak guard (Sprint 7, 11 Oct 2026). A logged-out request for a
  // Regulation 7 row outside the I.C.1 subtree gets no text and no summary,
  // by any path: the focused preview, /regs, /api/provision, /search.
  // -------------------------------------------------------------------------

  for (const { id, phrases } of REG7_LOCKED) {
    test(`Regulation 7 ${id}: the focused preview is the locked panel, with no text, no summary and no subtree`, async ({ page }) => {
      const res = await page.goto(`/regulations/7/preview?p=${encodeURIComponent(id)}`);
      expect(res?.status()).toBe(200);
      // The HTML as the server sent it, flight data included.
      const html = (await res?.text()) ?? "";
      await expect(page.getByTestId("locked-destination")).toBeVisible();
      await expect(page.getByTestId("locked-destination")).toContainText("is in the full corpus.");
      await expect(page.getByTestId("preview-subtree")).toHaveCount(0);
      await expect(page.locator("#preview-doc")).toHaveCount(0);
      await expect(page.getByTestId("locked-rest")).toHaveCount(0);
      await expect(page.locator("details.summary-panel")).toHaveCount(0);
      await expect(page.locator(".summary-badge")).toHaveCount(0);
      for (const phrase of phrases) expect(html, `"${phrase}" is in the page for ${id}`).not.toContain(phrase);
      // A locked parent shows nothing of its public child either (I.C.1.a's wording, not its summary's).
      expect(html).not.toContain("manufacturer specifications and documentation of compliance");
    });

    test(`Regulation 7 ${id}: /regs/<id> and /api/provision/<id> give a visitor no text and no summary`, async ({ request }) => {
      // /regs/<id> reads through the visitor's own client, so a locked row is not found: 404.
      const card = await request.get(`/regs/${id}`, { headers: protectionBypassHeaders() });
      expect(card.status()).toBe(404);
      const cardHtml = await card.text();
      for (const phrase of phrases) expect(cardHtml, `"${phrase}" is in /regs/${id}`).not.toContain(phrase);

      // /api/provision answers a visitor with the label alone (never cached) -- exactly these keys.
      const api = await request.get(`/api/provision/${id}`, { headers: protectionBypassHeaders() });
      expect(api.status()).toBe(200);
      expect(api.headers()["cache-control"]).toContain("no-store");
      const text = await api.text();
      const body = JSON.parse(text);
      expect(body).toMatchObject({ locked: true, id, reg_key: "7" });
      expect(Object.keys(body).sort()).toEqual(["citation", "id", "locked", "path", "reg_key", "title"]);
      for (const phrase of phrases) expect(text, `"${phrase}" is in /api/provision/${id}`).not.toContain(phrase);
    });
  }

  test("a keyword search for a phrase only a locked Regulation 7 row has returns no card or snippet for it", async ({ page }) => {
    // I.C.2.a.(i): the default emission factor. A visitor's search reads public rows only.
    const phrase = "13.7 pounds of volatile organic compounds per barrel of condensate";
    const res = await page.goto(`/search?q=${encodeURIComponent(phrase)}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Search isn't available right now")).toHaveCount(0);
    const cards = page.locator("ol > li > a");
    const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    const texts = await cards.allInnerTexts();
    expect(hrefs.filter((h) => h.includes("/regulations/7/")), "no Regulation 7 card").toEqual([]);
    for (const t of texts) expect(t).not.toContain("13.7 pounds");
  });

  test("a keyword search that matches both a public and a locked Regulation 7 row shows only the public one", async ({ page }) => {
    // I.C.1.a (public) and II.B.2.a (locked) both say "when the separator dumps into the tank".
    const res = await page.goto(`/search?q=${encodeURIComponent("separator dumps into the tank")}`);
    expect(res?.status()).toBe(200);
    const hrefs = await page.locator("ol > li > a").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    const reg7 = hrefs.filter((h) => h.includes("/regulations/7/"));
    expect(reg7, "the public subtree row is found").toContain("/regulations/7/preview?p=sec-7-B-I-C-1-a");
    for (const href of reg7) {
      const p = new URL(href, "https://x.test").searchParams.get("p") ?? "";
      expect(REG7_PUBLIC.has(p), `${href} is not a public row`).toBe(true);
    }
    expect(hrefs.join("\n")).not.toContain("sec-7-B-II-B-2");
  });

  // -------------------------------------------------------------------------
  // The preview of the public subtree
  // -------------------------------------------------------------------------

  test("a cross-reference landing, outside the walkthrough: the context strip names the document, Part and provision, with the way back in it, at 1280px and 375px", async ({ page }) => {
    const strip = page.getByTestId("preview-context");
    const text = page.getByTestId("preview-context-text");
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C");
      // No walkthrough: no ?tour=1, no card.
      await expect(page.getByTestId("tour-callout")).toHaveCount(0);
      await expect(text).toHaveText("Regulation 7 · Part B · I.C.1 General Requirements");
      const back = strip.locator("#preview-return");
      await expect(back).toHaveText("← Back to GP05 · VI.C");
      await expect(back).toHaveAttribute("href", "/regulations/gp05#sec-gp05-VI-C");
      // Right under the header, the whole width, the I.C.1 heading below it.
      const sb = (await strip.boundingBox())!;
      expect(sb.y).toBe(66);
      expect(Math.round(sb.width)).toBe(width);
      const hb = (await page.locator("#preview-heading").boundingBox())!;
      expect(hb.y, `${width}px: the heading is under the strip`).toBeGreaterThanOrEqual(sb.y + sb.height);
      expect(hb.y + hb.height).toBeLessThanOrEqual(740);
      if (width === 1280) {
        // One line: the return link on the right of the text.
        const tb = (await text.boundingBox())!;
        const lb = (await back.boundingBox())!;
        expect(lb.x).toBeGreaterThanOrEqual(tb.x + tb.width);
        expect(sb.height).toBeLessThan(56);
      } else {
        // Two lines on a phone: the text, then the link; nothing scrolls sideways.
        const tb = (await text.boundingBox())!;
        const lb = (await back.boundingBox())!;
        expect(lb.y).toBeGreaterThanOrEqual(tb.y + tb.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      }
      // Sticky: still under the header, still saying where the visitor is, after a scroll down the text.
      await page.evaluate(() => window.scrollTo(0, 1200));
      await expect.poll(async () => (await strip.boundingBox())!.y).toBe(66);
      await expect(text).toBeInViewport();
    }
    // No from=: the strip without a way back. The whole-document preview has no strip.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-D");
    await expect(text).toHaveText("Regulation 7 · Part B · I.D Storage Tank Emission Controls");
    await expect(page.locator("#preview-return")).toHaveCount(0);
    await page.goto("/regulations/7/preview");
    await expect(strip).toHaveCount(0);
  });

  test("the focused preview of Regulation 7 I.C.1 shows the 13 public rows, their text and summaries, and the rest locked", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const res = await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1");
    expect(res?.status()).toBe(200);
    const html = (await res?.text()) ?? "";
    // The focused heading block stays.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("I.C.1.");
    await expect(page.getByTestId("locked-destination")).toHaveCount(0);
    await expect(page).toHaveTitle(/I\.C\.1\./);
    // Not indexed, and not described as locked.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(await page.locator('meta[name="description"]').getAttribute("content")).not.toMatch(/in the full EssentialRegs corpus|locked/i);

    // The 13 rows, in order, as the direct children of #preview-doc; nothing outside the subtree.
    const doc = page.locator("#preview-doc");
    await expect(doc).toBeVisible();
    await expect(page.getByTestId("preview-subtree")).toHaveAttribute("id", "preview-doc");
    expect(await doc.locator(":scope > *").evaluateAll((els) => els.map((e) => e.id))).toEqual(REG7_SUBTREE);
    for (const id of REG7_SUBTREE) {
      const row = doc.locator(`:scope > [id="${id}"]`);
      await expect(row, id).toHaveClass(/\bitem depth-\d\b/);
      await expect(row, id).toHaveAttribute("data-citation", /^I\.C\.1/);
    }

    // The official text, with its id badge.
    const a = doc.locator(':scope > [id="sec-7-B-I-C-1-a"]');
    await expect(a).toContainText("manufacturer specifications and documentation of compliance");
    await expect(a).toContainText("separator dumps into the tank");
    await expect(a.locator("span.item-id").first()).toHaveText("I.C.1.a.");
    await expect(doc.locator(':scope > [id="sec-7-B-I-C-1-e-(iv)"]')).toContainText("January 1, 2018");
    await expect(doc.locator(':scope > [id="sec-7-B-I-C-1"]')).toContainText("General Requirements");

    // Nothing of a locked row.
    for (const { phrases } of REG7_LOCKED) for (const phrase of phrases.slice(0, 1)) expect(html).not.toContain(phrase);
    expect(html).not.toContain("13.7 pounds");

    // The summary panels: on the ten rows that have a summary, none on the three that do not.
    expect(await doc.locator(":scope > .item").evaluateAll((els) => els.filter((e) => e.querySelector(":scope > details.summary-panel")).map((e) => e.id))).toEqual(
      REG7_WITH_SUMMARY,
    );
    const panel = a.locator(":scope > details.summary-panel");
    await expect(panel).not.toHaveAttribute("open", "");
    await panel.locator(":scope > summary").click();
    await expect(panel).toHaveAttribute("open", "");
    const badge = panel.locator(".summary-badge");
    await expect(badge).toHaveText(BADGE_TEXT);
    await expect(badge).toHaveAttribute("title", /Disclaimer page/);
    const source = panel.locator(".summary-status a");
    await expect(source).toHaveText("View official source ↗");
    await expect(source).toHaveAttribute("href", /^https?:\/\//);
    await expect(source).toHaveAttribute("target", "_blank");
    // A summary that has not been checked is never offered.
    for (const text of await doc.locator(".summary-badge").allTextContents()) expect(text).not.toMatch(/not yet reviewed/);
    // A parent's panel lists the rows below it, each a link to that row on this page.
    const parentList = doc.locator(':scope > [id="sec-7-B-I-C-1-e"] a.summary-child-link');
    if ((await parentList.count()) > 0) {
      for (const href of await parentList.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""))) {
        expect(REG7_SUBTREE).toContain(href.slice(1));
      }
    }

    // The rest stays locked.
    const rest = page.getByTestId("locked-rest");
    await expect(rest).toBeVisible();
    await expect(rest).toContainText("The rest of Regulation 7 is in the full corpus.");
    await expect(rest.getByRole("link", { name: "Start your 7-day trial" })).toHaveAttribute("href", "/signup");
    await expect(rest.getByRole("link", { name: "Log in" })).toHaveAttribute("href", /^\/login\?next=/);
    const docBox = await doc.boundingBox();
    const restBox = await rest.boundingBox();
    expect(docBox && restBox && restBox.y >= docBox.y + docBox.height - 1, "locked-rest is below the rows").toBe(true);

    // Every link in the text answers, none is 404, and none points at the closed reader.
    const hrefs = await doc.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => /^\/regulations\/7#/.test(h)), "no link into the closed Regulation 7 reader").toEqual([]);
    for (const h of hrefs.filter((x) => x.startsWith("#"))) {
      await expect(page.locator(`[id="${h.slice(1)}"]`), h).toHaveCount(1);
    }
    const targets = new Set<string>();
    for (const href of hrefs.filter((x) => !x.startsWith("#"))) {
      const url = new URL(href, baseURL);
      if (url.origin === new URL(baseURL ?? url.origin).origin) targets.add(url.pathname + url.search);
    }
    expect(targets.size, "the text links onward (Sections I.D., I.J., I.K.)").toBeGreaterThan(0);
    const failures: string[] = [];
    for (const target of targets) {
      const r = await page.request.get(target, { headers: protectionBypassHeaders() });
      if (r.status() === 404) failures.push(`${target} -> 404`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("the preview's rows look like the reader's: its indentation, its summary panel, and none of its page layout", async ({ page }) => {
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1");
    const doc = page.locator("#preview-doc");
    await expect(doc).toBeVisible();
    const margin = (id: string) => doc.locator(`:scope > [id="${id}"]`).evaluate((el) => getComputedStyle(el).marginLeft);
    // reader.css: depth-4 is 36px, depth-5 54px, depth-6 72px.
    expect(await margin("sec-7-B-I-C-1")).toBe("36px");
    expect(await margin("sec-7-B-I-C-1-a")).toBe("54px");
    expect(await margin("sec-7-B-I-C-1-e-(i)")).toBe("72px");
    // The summary panel: the reader's tinted box.
    const panel = doc.locator(":scope > [id=\"sec-7-B-I-C-1-a\"] > details.summary-panel");
    expect(await panel.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(228, 236, 232)");
    expect(await panel.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("6px");
    // The reader's page rules stay in the reader: this is a block in the page's column, not a flex shell with a gutter.
    const wrapper = page.locator(".preview-reader");
    expect(await wrapper.evaluate((el) => getComputedStyle(el).display)).toBe("block");
    expect(await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    expect(await wrapper.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
    expect(await doc.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("0px");
    await expect(page.locator("#sidebar, #jumpbox, #main-scroll")).toHaveCount(0);
  });

  test("the preview has no horizontal scroll at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1");
    await expect(page.locator("#preview-doc")).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });

  test("a deeper public row is its own focused preview: I.C.1.e and the rows below it", async ({ page }) => {
    const res = await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1-e");
    expect(res?.status()).toBe(200);
    expect(await page.locator("#preview-doc > *").evaluateAll((els) => els.map((e) => e.id))).toEqual([
      "sec-7-B-I-C-1-e",
      "sec-7-B-I-C-1-e-(i)",
      "sec-7-B-I-C-1-e-(ii)",
      "sec-7-B-I-C-1-e-(iii)",
      "sec-7-B-I-C-1-e-(iv)",
    ]);
    await expect(page.getByTestId("locked-rest")).toBeVisible();
  });

  test("the preview draws the way back to the provision the visitor came from, and keeps the walkthrough's parameter", async ({ page }) => {
    // Public focused provision, from GP05 VI.C.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C");
    const back = page.locator("#preview-return");
    await expect(back).toHaveCount(1);
    await expect(page.getByTestId("preview-return")).toHaveText("← Back to GP05 · VI.C");
    await expect(back).toHaveAttribute("href", "/regulations/gp05#sec-gp05-VI-C");
    // At the top of the focused block, above the regulation's name and the heading.
    const backBox = await back.boundingBox();
    const h1Box = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(backBox && h1Box && backBox.y < h1Box.y).toBe(true);
    await expect(page.getByTestId("preview-subtree")).toBeVisible();

    // With the walkthrough on: tour=1 carried to the reader.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C&tour=1");
    await expect(page.locator("#preview-return")).toHaveAttribute("href", "/regulations/gp05?tour=1#sec-gp05-VI-C");
    await expect(page.locator("#preview-return")).toHaveText("← Back to GP05 · VI.C");

    // A locked provision draws it too.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-2&from=sec-gp05-VI-C");
    await expect(page.getByTestId("locked-destination")).toBeVisible();
    await expect(page.locator("#preview-return")).toHaveAttribute("href", "/regulations/gp05#sec-gp05-VI-C");
    await expect(page.getByTestId("preview-subtree")).toHaveCount(0);

    // A same-regulation origin (walkthrough v3, 13 Oct 2026: the second hop's way back) draws it too, to that provision's
    // preview. This session came GP05 VI.C -> I.C.1 -> I.D, so the bar's trail (sessionStorage) names the hop after it.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-D&from=sec-7-B-I-C-1");
    await expect(page.locator("#preview-return > span").first()).toHaveText("← Back to Regulation 7 · I.C.1");
    await expect(page.locator("#preview-return")).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-B-I-C-1");
    await expect(page.getByTestId("preview-return-then")).toHaveText("· then GP05 · VI.C");
    await expect(page.locator("#preview-return")).toHaveAttribute("data-hops", "2");
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-7-B-I-D&tour=1");
    await expect(page.locator("#preview-return > span").first()).toHaveText("← Back to Regulation 7 · I.D");
    await expect(page.locator("#preview-return")).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-B-I-D&tour=1");
    // A fresh session, no trail: the URL's one hop alone.
    await page.evaluate(() => sessionStorage.removeItem("er:preview-trail"));
    await page.goto("/regulations/7/preview?p=sec-7-B-I-D&from=sec-7-B-I-C-1");
    await expect(page.locator("#preview-return")).toHaveText("← Back to Regulation 7 · I.C.1");
    await expect(page.locator("#preview-return")).toHaveAttribute("data-hops", "1");

    // Not for a missing or junk origin, the focused provision itself, nor without a focused provision.
    for (const query of [
      "p=sec-7-B-I-C-1",
      "p=sec-7-B-I-C-1&from=sec-7-B-I-C-1",
      "p=sec-7-B-I-C-1&from=not-an-id",
      "p=sec-7-B-I-C-1&from=%3Cscript%3E",
      "from=sec-gp05-VI-C",
    ]) {
      await page.goto(`/regulations/7/preview?${query}`);
      await expect(page.locator("#preview-return"), query).toHaveCount(0);
    }

    // And the link works: back in the GP05 reader at VI.C.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C");
    await page.locator("#preview-return").click();
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    expect(new URL(page.url()).hash).toBe("#sec-gp05-VI-C");
    await expect(page.locator("#jumpbox")).toBeVisible();
  });

  test("the focused preview of Regulation 7 I.D (the walkthrough's second hop) shows its public rows and nothing of I.D.1-3 or I.D.4's children", async ({ page }) => {
    // 13 Oct 2026 (migration 20261013014006): I.D and I.D.4 are public; the older sample row I.D.3.a.(i) sits under I.D too,
    // and since migration 20261013051740 so does I.D.3.a.(ii), a citation of the sample page's Ask example.
    const res = await page.goto("/regulations/7/preview?p=sec-7-B-I-D");
    expect(res?.status()).toBe(200);
    const html = (await res?.text()) ?? "";
    await expect(page.getByRole("heading", { level: 1 })).toContainText("I.D.");
    await expect(page.getByTestId("locked-destination")).toHaveCount(0);
    const doc = page.locator("#preview-doc");
    expect(await doc.locator(":scope > *").evaluateAll((els) => els.map((e) => e.id))).toEqual(["sec-7-B-I-D", "sec-7-B-I-D-3-a-(i)", "sec-7-B-I-D-3-a-(ii)", "sec-7-B-I-D-4"]);
    await expect(doc.locator(':scope > [id="sec-7-B-I-D"]')).toContainText("Storage Tank Emission Controls");
    await expect(doc.locator(':scope > [id="sec-7-B-I-D-4"]')).toContainText("Alternative emissions control equipment and pollution prevention devices");
    // The repealed stubs I.D.1 and I.D.2, the I.D.3 heading and I.D.4's children stay locked: none of their words.
    expect(html).not.toContain("Repealed (December 16, 2022)");
    expect(html).not.toContain("obtains a construction permit authorizing such use of the alternative emissions control equipment");
    expect(html).not.toContain("Storage Tank Control Strategy");
    await expect(page.getByTestId("locked-rest")).toBeVisible();
    // v3.1 (13 Oct 2026): the excerpt says it is one. The eyebrow above the rows, and under each shown row that locked
    // rows follow, how many: I.D.1, I.D.2, I.D.3 and I.D.3.a after I.D; nothing between (i) and (ii); (iii), (iv) and
    // I.D.3.b's 13 after (ii); I.D.4's 8 after it.
    await expect(page.getByTestId("partial-excerpt")).toHaveText("Selected provisions — not the complete section");
    const markers = doc.locator(":scope > [id] > p.omitted-rows");
    await expect(markers).toHaveCount(3);
    expect(await markers.evaluateAll((els) => els.map((e) => [e.parentElement?.id, e.getAttribute("data-omitted"), e.textContent]))).toEqual([
      ["sec-7-B-I-D", "4", "… 4 more provisions in the full corpus"],
      ["sec-7-B-I-D-3-a-(ii)", "16", "… 16 more provisions in the full corpus"],
      ["sec-7-B-I-D-4", "8", "… 8 more provisions in the full corpus"],
    ]);
    // Under the row's text, before its summary panel.
    expect(await doc.locator(':scope > [id="sec-7-B-I-D-4"] > *').evaluateAll((els) => els.map((e) => e.className.split(" ")[0] || e.tagName.toLowerCase()))).toEqual(
      expect.arrayContaining(["omitted-rows"]),
    );
    const order = await doc.locator(':scope > [id="sec-7-B-I-D-4"] > *').evaluateAll((els) => els.map((e) => e.tagName.toLowerCase() + "." + (e.className.split(" ")[0] ?? "")));
    expect(order.indexOf("p.omitted-rows")).toBeLessThan(order.indexOf("details.summary-panel"));
    // I.D.4's own citation back to I.D is a link to the row on this page; a citation to a locked row carries the way back here.
    const self = doc.locator(':scope > [id="sec-7-B-I-D-4"] a.xref[href="#sec-7-B-I-D"]');
    await expect(self).toHaveCount(1);
    // The I.C.1 preview's citation into I.D (the hop the walkthrough follows) carries from=, so this page draws its way back.
    await page.goto("/regulations/7/preview?p=sec-7-B-I-C-1");
    // The I.C.1 subtree is shown whole: no eyebrow and no marker.
    await expect(page.getByTestId("partial-excerpt")).toHaveCount(0);
    await expect(page.locator("#preview-doc p.omitted-rows")).toHaveCount(0);
    const hop = page.locator('#preview-doc > [id="sec-7-B-I-C-1-c"] a.xref[href^="/regulations/7/preview?p=sec-7-B-I-D"]');
    await expect(hop).toHaveText("Sections I.D.");
    await expect(hop).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-B-I-D&from=sec-7-B-I-C-1");
    await expect(page.locator('#preview-doc > [id="sec-7-B-I-C-1-c"] a.xref[href^="/regulations/7/preview?p=sec-7-B-I-J"]')).toHaveAttribute(
      "href",
      "/regulations/7/preview?p=sec-7-B-I-J&from=sec-7-B-I-C-1",
    );
  });

  test("a stale or unknown ?p= on Regulation 7 is the plain preview; a GP05 link opens the reader and keeps ?from=", async ({ page }) => {
    for (const p of ["sec-7-B-I-C-1-zz", "sec-gp05-VI-D", "not%20an%20id"]) {
      const res = await page.goto(`/regulations/7/preview?p=${p}`);
      expect(res?.status(), p).toBe(200);
      await expect(page.getByTestId("preview-subtree"), p).toHaveCount(0);
      await expect(page.getByTestId("locked-destination"), p).toHaveCount(0);
    }
    // GP05 is open to everyone: its focused preview sends the visitor to the reader, keeping ?from= (the reader's return bar reads it).
    await page.goto("/regulations/gp05/preview?p=sec-gp05-VI-D&from=sec-7-B-I-C-1");
    await page.waitForURL((url) => url.pathname === "/regulations/gp05");
    expect(new URL(page.url()).hash).toBe("#sec-gp05-VI-D");
    // The reader takes ?from= off the URL on load (into history.state), so the
    // proof that it arrived is the return bar it draws from it.
    const back = page.locator("#return-trail-ext");
    await expect(back).toHaveText("← Back to Regulation 7 · Part B · I.C.1");
    await expect(back).toHaveAttribute("href", "/regulations/7/preview?p=sec-7-B-I-C-1");
  });

  test("/regs/<id> of a public subtree row shows its text and summary", async ({ page }) => {
    const res = await page.goto("/regs/sec-7-B-I-C-1-a");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/^I\.C\.1\.a\. · Regulation 7/);
    await expect(page.locator("article > h2")).toContainText("I.C.1.a.");
    await expect(page.locator("article")).toContainText("manufacturer specifications and documentation of compliance");
    await expect(page.locator("article details > summary")).toHaveText([
      /^Plain-English summary\s*AI-generated · automated check against source text$/,
      "Original regulatory text",
    ]);
    await expect(page.locator("article .summary-badge")).toHaveAttribute("title", /Disclaimer page/);
  });

  test("the related teaser on a public subtree card page shows no summary and no path for a neighbour outside GP05", async ({ page }) => {
    await page.goto("/regs/sec-7-B-I-C-1-a");
    const related = page.locator("section").filter({ has: page.getByRole("heading", { name: "Related by meaning, not cited" }) });
    if ((await related.count()) === 0) {
      // No neighbours are stored for this row on this deployment; the GP12 VI.A.1 test above covers the teaser itself.
      test.info().annotations.push({ type: "note", description: "no related neighbours stored for sec-7-B-I-C-1-a here" });
      return;
    }
    const links = related.getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = (await link.getAttribute("href")) ?? "";
      if (/^\/regulations\/gp05#/.test(href)) continue; // GP05's reader shows its summaries to everyone
      await expect(link, href).not.toContainText("Plain-English summary");
      await expect(link.locator("p.line-clamp-2"), href).toHaveCount(0);
      await expect(link.locator("p.leading-snug"), `${href}: no breadcrumb`).toHaveCount(0);
      await expect(link, href).toContainText("Summary available to subscribers.");
    }
  });

  test("GP05's Table 2 (VI.D) has four header cells and seven body rows", async ({ page }) => {
    // Needs the Sprint 7 GP05 re-import (the table used to be flattened into text).
    await page.goto("/regulations/gp05");
    const table = page.locator("#doc > #sec-gp05-VI-D table.doc-table");
    await expect(table).toHaveCount(1);
    await expect(table.locator("thead th")).toHaveCount(4);
    await expect(table.locator("thead th").nth(3)).toHaveText("Frequency");
    await expect(table.locator("tbody tr")).toHaveCount(7);
    await expect(table.locator("tbody tr").first()).toContainText("Prior to Issuance 5");
  });
});
