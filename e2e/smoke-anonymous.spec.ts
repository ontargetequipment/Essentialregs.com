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

/**
 * What a review-status badge says (summaryStatusBadge): "AI-generated ·
 * automated check against source text" (dated in the reader), the pending
 * line, or "Reviewed" only for a person's approval (9 Oct 2026; none exist
 * today, the DB trigger refuses non-pipeline approvals).
 */
const BADGE_TEXT = /^(AI-generated · automated check against source text( · [A-Z][a-z]+ \d{1,2}, \d{4})?|AI-generated · not yet reviewed|Reviewed( · [A-Z][a-z]+ \d{1,2}, \d{4})?)$/;

test.describe("anonymous", () => {
  test("home page returns 200 with the four hero buttons, Test Methods marked free", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    // The hero's four buttons, in order: the federal and state indexes,
    // the free Test Methods reference, the sample. The Test Methods link
    // carries a FREE pill so it reads as free at a glance.
    const hero = page.locator("h1 ~ div").first();
    const buttons = hero.getByRole("link");
    await expect(buttons).toHaveText([
      "Federal Regulations",
      "State Regulations",
      /^Test Methods\s*Free$/,
      "See a sample answer",
    ]);
    const hrefs = await buttons.evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["/federal", "/states", "/test-methods", "/sample"]);
    await expect(page.locator('a[href="/test-methods"]', { hasText: /free/i }).first()).toBeVisible();
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

  test("/sample answers one canned search and one canned Ask around GP05", async ({ page }) => {
    // Sprint 4, 10 Oct 2026: the page replays a frozen snapshot (src/data/
    // sample-snapshot.json). GP05 results are open cards; every other result
    // is a locked card linking to its focused preview.
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "See how EssentialRegs answers a real Colorado oil and gas compliance question",
    );

    // Keyword search: ten results, GP05 open and the rest locked.
    const keyword = page.getByTestId("sample-keyword");
    await expect(keyword.getByRole("heading", { name: /^Keyword search/ })).toBeVisible();
    await expect(keyword.getByText("Showing 10 of 25 results")).toBeVisible();
    const keywordLinks = keyword.locator("ol > li > a");
    await expect(keywordLinks).toHaveCount(10);
    const keywordHrefs = await keywordLinks.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(keywordHrefs.some((h) => h.startsWith("/regulations/gp05#"))).toBe(true);
    expect(keywordHrefs.some((h) => /\/preview\?p=/.test(h))).toBe(true);
    for (const href of keywordHrefs) expect(href, href).toMatch(/^\/regulations\/gp05#|\/preview\?p=/);
    const keywordLocked = keyword.getByTestId("locked-result");
    expect(await keywordLocked.count()).toBeGreaterThan(0);
    await expect(keywordLocked.first().locator("a")).toHaveAttribute("href", /\/preview\?p=/);
    await expect(keywordLocked.first()).toContainText("In the full corpus");
    await expect(keywordLocked.first()).toContainText("start your 7-day trial");

    // Ask: the mapped answer, with locked cards beside the open GP05 ones.
    const ask = page.getByTestId("sample-ask");
    await expect(ask.getByRole("heading", { name: /^Ask:/ })).toBeVisible();
    await expect(ask.getByTestId("map-title")).toHaveText("Produced water storage tanks and tank batteries");
    await expect(ask.getByTestId("map-intro")).toBeVisible();
    expect(await ask.getByTestId("locked-result").count()).toBeGreaterThan(0);
    await expect(ask.getByText("Not shown because you said produced water:")).toBeVisible();

    // A line into the real reader.
    await expect(page.locator('a[href="/regulations/gp05"]').first()).toBeVisible();

    // The two closing buttons, after the Ask section.
    const cta = page.getByTestId("sample-cta");
    await expect(cta.getByRole("link", { name: "Start your trial" })).toHaveAttribute("href", "/signup");
    await expect(cta.getByRole("link", { name: "Search the complete corpus" })).toHaveAttribute("href", "/search");
    const askBox = await ask.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(askBox && ctaBox && ctaBox.y > askBox.y + askBox.height - 1).toBe(true);

    const text = await page.locator("main").innerText();
    expect(text).not.toContain("exactly as subscribers see them");
    expect(text).not.toContain("cross-references resolved");
    expect(text).toContain("snapshot from 10 Oct 2026");
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
    await expect(banner.getByRole("link", { name: "Search the complete corpus" })).toHaveAttribute("href", "/search");

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
  });

  test("/api/provision answers a visitor with a locked label, no text, never cached", async ({ request }) => {
    const res = await request.get("/api/provision/sec-7-B-I-D-3-a-(i)", { headers: protectionBypassHeaders() });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ locked: true, id: "sec-7-B-I-D-3-a-(i)", reg_key: "7" });
    expect(Object.keys(body).sort()).toEqual(["citation", "id", "locked", "path", "reg_key", "title"]);
    const missing = await request.get("/api/provision/sec-7-B-no-such-row", { headers: protectionBypassHeaders() });
    expect(missing.status()).toBe(404);
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

  test("the Regulations nav lists the two jurisdictions and Test Methods; General Permits hang off Colorado", async ({ page }) => {
    // The APCD General Permits are a Colorado category, not a jurisdiction,
    // so the header dropdown, the mobile drawer and the footer's Regulations
    // column each carry exactly Federal Regulations, State Regulations and
    // (since 9 Oct 2026) the free Test Methods reference, in that order. The
    // permits index keeps its URL (sitemap, external links) and is reached
    // from the Colorado index's group heading.
    const TWO = ["Federal Regulations", "State Regulations", "Test Methods"];
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
    expect(await page.locator("body").innerText()).not.toMatch(/\bbeta\b/i);
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
    // The Ask content is on the page: the submit button reads "Ask" and a
    // visitor who is not logged in sees the subscription notice.
    // Scoped to main: the site header has a submit button named "Search" too.
    await expect(page.getByRole("main").getByRole("button", { name: "Ask", exact: true })).toBeVisible();
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
