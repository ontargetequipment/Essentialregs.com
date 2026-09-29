/**
 * Smoke test, anonymous group: always runs, against any deployment
 * (previews and production). Read-only. See playwright.config.ts.
 *
 * Expected values were read from the corpus on 25 Sep 2026; if the sample
 * rows (is_public) or the regulation roots change, update them here.
 */
import { expect, protectionBypassHeaders, test } from "./fixtures";
import { ANNUAL_PRICE_DISPLAY, MONTHLY_PRICE_DISPLAY } from "../src/lib/pricing";
import { DISCLAIMER_VERSION } from "../src/lib/disclaimer";

/**
 * The plan-first signup: logged out, every plan box's "Create an account"
 * link goes to /signup?plan=<that box's interval> (the account step), so
 * the plan the visitor clicked survives to /pricing after confirmation.
 */
async function expectPlanCtas(scope: import("@playwright/test").Locator | import("@playwright/test").Page) {
  const ctas = scope.getByRole("link", { name: "Create an account to subscribe" });
  await expect(ctas).toHaveCount(2);
  for (const plan of ["month", "year"]) {
    const box = scope.locator(`[data-plan="${plan}"]`);
    await expect(box.getByRole("link", { name: "Create an account to subscribe" })).toHaveAttribute(
      "href",
      `/signup?plan=${plan}`,
    );
  }
}

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
    // Logged out: the prices and a create-an-account link per plan.
    await expectPlanCtas(page);
    // No plan picked yet: neither box is marked as the choice.
    await expect(page.getByText("Your choice")).toHaveCount(0);
  });

  test("/pricing?plan=month highlights the monthly box and keeps the annual one", async ({ page }) => {
    // Where /auth/confirm lands a new account that chose monthly on /signup.
    await page.goto("/pricing?plan=month");
    await expect(page.locator('[data-plan="month"]').getByText("Your choice")).toBeVisible();
    await expect(page.locator('[data-plan="year"]').getByText("Your choice")).toHaveCount(0);
    await expect(page.getByText(ANNUAL_PRICE_DISPLAY, { exact: true })).toBeVisible();
    await expectPlanCtas(page);
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

  test("/sample shows the four sample cards with their regulation labels", async ({ page }) => {
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.locator("article > h2")).toHaveText(SAMPLE_HEADINGS);
  });

  test("/states lists Colorado with live counts and links to its index", async ({ page }) => {
    const res = await page.goto("/states");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "State regulations" })).toBeVisible();
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

  test("the Regulations nav lists the two jurisdictions; General Permits hang off Colorado", async ({ page }) => {
    // The APCD General Permits are a Colorado category, not a jurisdiction,
    // so the header dropdown, the mobile drawer and the footer's Regulations
    // column each carry exactly State regulations and Federal. The permits
    // index keeps its URL (sitemap, external links) and is reached from the
    // Colorado index's group heading.
    const TWO = ["State regulations", "Federal"];
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
    await page.getByRole("button", { name: "Menu" }).click();
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

  test("an unknown state is 404", async ({ page }) => {
    const res = await page.goto("/states/atlantis");
    expect(res?.status()).toBe(404);
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
