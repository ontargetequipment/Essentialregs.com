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
const PRICING_BUTTON = "Start your 7-day free trial";

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
const REG7_PUBLIC = new Set([...REG7_SUBTREE, "sec-7-B-I-D-3-a-(i)"]);

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
    // the free Test Methods reference, then "See how it works" (the sample)
    // on its own row. The Test Methods link
    // carries a FREE pill so it reads as free at a glance.
    const hero = page.locator("h1 ~ div").first();
    const buttons = hero.getByRole("link");
    await expect(buttons).toHaveText([
      "Federal Regulations",
      "State Regulations",
      /^Test Methods\s*Free$/,
      "See how it works",
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
    // Logged out: the prices and a trial link per plan (Sprint 5: "Start your 7-day free trial",
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

  test("/sample answers one canned search and one canned Ask around GP05", async ({ page }) => {
    // Sprint 4, 10 Oct 2026: the page replays a frozen snapshot (src/data/
    // sample-snapshot.json). GP05 results are open cards; every other result
    // is a locked card linking to its focused preview.
    const res = await page.goto("/sample");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "See how EssentialRegs answers a real Colorado oil and gas compliance question",
    );

    // Under the intro (Sprint 5, 10 Oct 2026): the free reader and the trial, before any results.
    await expect(page.locator("main")).toContainText("is available below in the complete reader");
    const top = page.getByTestId("sample-top-cta");
    await expect(top.getByRole("link", { name: "Open the free GP05 reader" })).toHaveAttribute("href", "/regulations/gp05");
    await expect(top.getByRole("link", { name: "Start your 7-day trial" })).toHaveAttribute("href", "/signup");
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
    const askMore = ask.getByTestId("sample-ask-more");
    await expect(askMore.locator("summary")).toContainText("See the complete sample answer");
    const openAtFirst = await ask.locator("ol > li:visible").count();
    expect(await askMore.locator("ol > li").count()).toBeGreaterThan(0);
    await askMore.locator("summary").click();
    expect(await ask.locator("ol > li:visible").count()).toBeGreaterThan(openAtFirst);

    // A line into the real reader.
    await expect(page.locator('a[href="/regulations/gp05"]').first()).toBeVisible();

    // The closing buttons, after the Ask section: the same two as at the top, and the search link.
    const cta = page.getByTestId("sample-cta");
    await expect(cta.getByRole("link", { name: "Start your 7-day trial" })).toHaveAttribute("href", "/signup");
    await expect(cta.getByRole("link", { name: "Open the free GP05 reader" })).toHaveAttribute("href", "/regulations/gp05");
    await expect(cta.getByRole("link", { name: "Search the free GP05 sample" })).toHaveAttribute("href", "/search");
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
    // The excerpt is the match in its sentence, not the first line of the provision.
    expect(await item.locator(".jr-excerpt").innerText()).not.toMatch(/^Table 2/);
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
    const ic1 = page.locator('#doc > [id="sec-gp05-VI-C"] a.xref-external-reg[href$="#sec-7-B-I-C-1"]');
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
    const partB = page.locator('#doc > [id="sec-gp05-VI-A"] a.xref-external-reg[href="/regulations/7#sec-7-P-B"]');
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
    // The not-logged-in notice offers the trial beside "Log in" (Sprint 5, 10 Oct 2026).
    const loginNotice = page.getByText("You're not logged in", { exact: false });
    await expect(loginNotice.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    await expect(loginNotice.getByRole("link", { name: "start your 7-day trial" })).toHaveAttribute("href", "/signup");
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

  test("the full reader /regulations/7 is 404 for an anonymous visitor, with or without the walkthrough's parameters", async ({ page }) => {
    // Regulation 7's subtree is public, its reader is not (PUBLIC_READER_REGS is GP05 alone): the
    // focused preview is the only way in. ?tour=1 and ?from= change nothing for a visitor.
    for (const url of [
      "/regulations/7",
      "/regulations/7?tour=1",
      "/regulations/7?from=sec-gp05-VI-C&tour=1",
      "/regulations/7?from=sec-gp05-VI-C&tour=1#sec-7-B-I-C-1",
    ]) {
      // A URL that differs from the one before it only in its #hash would be
      // a same-document navigation with no response: start each from a blank page.
      await page.goto("about:blank");
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(404);
      await expect(page.locator("#doc"), url).toHaveCount(0);
    }
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

    // Not for a missing, junk or same-regulation origin, nor without a focused provision.
    for (const query of [
      "p=sec-7-B-I-C-1",
      "p=sec-7-B-I-C-1&from=sec-7-B-I-D",
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
