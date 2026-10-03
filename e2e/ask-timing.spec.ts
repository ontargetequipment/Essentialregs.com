/**
 * Ask timing report, signed-in group. Fetches the civil-penalties question's
 * Ask page grouped (the question map) and flat (?flat=1), three times each,
 * and prints the wall-clock time of each document request; then prints the
 * grouped page's rows (group, regulation, citation, breadcrumb) so the
 * breadcrumbs can be checked against the PR screenshot. A report, not a
 * test: nothing here asserts on latency or on the breadcrumbs. It exists to
 * show the cost of the question-map read on the page (PR "one-read
 * breadcrumbs for map rows").
 *
 * Runs only with SMOKE_EMAIL / SMOKE_PASSWORD set and SMOKE_SCOPE not
 * "anonymous", exactly like ask-report. Read-only.
 */
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, protectionBypassHeaders, withProtectionBypass } from "./fixtures";

const QUESTION = "How does the Division assess civil penalties for a violation?";
const RUNS = 3;

function report(lines: string[]): void {
  const text = lines.join("\n");
  console.log(text);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, text + "\n");
}

// Traces record the session cookie; never keep one for this file, even locally.
test.use({ trace: "off" });

test.describe("ask timing", () => {
  const email = process.env.SMOKE_EMAIL ?? "";
  const password = process.env.SMOKE_PASSWORD ?? "";
  test.skip(
    process.env.SMOKE_SCOPE === "anonymous",
    "SMOKE_SCOPE=anonymous (production deployment): the signed-in group runs on previews only."
  );
  test.skip(!email || !password, "SMOKE_EMAIL / SMOKE_PASSWORD secrets are not set: Ask timing skipped.");

  const stateDir = mkdtempSync(path.join(tmpdir(), "ask-timing-"));
  const statePath = path.join(stateDir, "state.json");
  writeFileSync(statePath, JSON.stringify({ cookies: [], origins: [] }));
  test.use({ storageState: statePath });

  test.beforeAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: undefined });
    await withProtectionBypass(context, baseURL);
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
    await context.storageState({ path: statePath });
    await context.close();
  });

  test.afterAll(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  test("grouped vs flat page time for the civil-penalties question", async ({ page }) => {
    const base = "/search?mode=ask&q=" + encodeURIComponent(QUESTION);
    const variants = [
      ["grouped", base],
      ["flat", base + "&flat=1"],
    ] as const;
    const ms: Record<string, number[]> = { grouped: [], flat: [] };
    // One warm-up per variant so a cold function is not counted, then the
    // runs alternate so neither variant gets all the warm or all the cold.
    for (const [, url] of variants) {
      const res = await page.request.get(url, { headers: protectionBypassHeaders(), timeout: 60_000 });
      expect(res.status()).toBe(200);
    }
    for (let i = 0; i < RUNS; i++) {
      for (const [name, url] of variants) {
        const t0 = performance.now();
        const res = await page.request.get(url, { headers: protectionBypassHeaders(), timeout: 60_000 });
        const html = await res.text();
        ms[name].push(Math.round(performance.now() - t0));
        expect(res.status()).toBe(200);
        // The grouped page must still be the grouped page (the map's link
        // to the flat list) and the flat one the flat list.
        if (name === "grouped") expect(html).toContain("flat=1");
        else expect(html).not.toContain("Show as a flat list");
      }
    }
    const fmt = (xs: number[]) => xs.map((x) => `${x} ms`).join(", ");
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    report([
      "### Ask timing (signed in): civil penalties, grouped vs flat",
      "",
      "| page | runs | median |",
      "| --- | --- | --- |",
      `| grouped | ${fmt(ms.grouped)} | ${median(ms.grouped)} ms |`,
      `| flat | ${fmt(ms.flat)} | ${median(ms.flat)} ms |`,
      "",
    ]);
  });

  test("breadcrumbs on the grouped civil-penalties page", async ({ page }) => {
    const res = await page.goto("/search?mode=ask&q=" + encodeURIComponent(QUESTION));
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("link", { name: "Show as a flat list" })).toBeVisible();
    // One line per card: group heading | regulation | citation | breadcrumb
    // (or "(no path)") | "retrieved" when the card carries a match score.
    // The breadcrumb is the mt-2 paragraph without a child span; the
    // "Why it's here" paragraph carries one.
    const rows = await page.locator("main section").evaluateAll((sections) =>
      sections.flatMap((section) => {
        const group = section.querySelector("h2")?.textContent?.trim() ?? "";
        return Array.from(section.querySelectorAll("li > a")).map((a) => {
          const name = a.querySelector(":scope > div span.text-xs")?.textContent?.trim() ?? "";
          const cite = a.querySelector(":scope > p.font-mono")?.textContent?.trim() ?? "";
          const crumb = Array.from(a.querySelectorAll(":scope > p.mt-2")).find((p) => !p.querySelector("span"));
          const retrieved = a.querySelector(":scope > div .ml-auto") ? "retrieved" : "canonical only";
          return `${group} | ${name} | ${cite} | ${crumb?.textContent?.trim() || "(no path)"} | ${retrieved}`;
        });
      })
    );
    report(["### Ask grouped page (signed in): civil penalties, rows and breadcrumbs", "", ...rows.map((r) => `- ${r}`), ""]);
  });
});
