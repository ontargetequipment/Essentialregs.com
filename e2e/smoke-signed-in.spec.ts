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
    await page.waitForURL(/\/account(\?|$)/, { timeout: 30_000 });
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
    await expect(page.locator("#popup-eyebrow")).toHaveText(slug!);
    await expect(page.locator("#popup-title")).not.toBeEmpty();
    await expect(page.locator(`#popup-body [id="${slug}"]`)).toHaveCount(1);
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
