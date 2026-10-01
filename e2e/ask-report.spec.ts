/**
 * Ask report, signed-in group. Prints what a subscriber gets from Ask for a
 * fixed set of questions (the top 10 ids), and the /admin/semantic-eval score
 * when the smoke account is an admin. Nothing here asserts on ranking: it is
 * a report, written to the job log and to the Actions step summary, so a
 * corpus change (a re-summarize, a re-embed, a ranking migration) can be
 * checked against the previous run without a browser session.
 *
 * Runs only with SMOKE_EMAIL / SMOKE_PASSWORD set (an existing subscribed
 * account) and SMOKE_SCOPE not "anonymous", exactly like smoke-signed-in.
 * Never creates an account, never pays, never writes: the eval page's own
 * search_queries log rows (mode='eval') are the only side effect, the same
 * as an admin loading the page.
 */
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, protectionBypassHeaders, withProtectionBypass } from "./fixtures";

const QUESTIONS = [
  "When is a GP01 required?",
  "What regulations apply to a natural gas-fired engine?",
  "What Colorado and federal requirements could apply to storage vessels?",
];

/** Ids to call out by name when they appear (the engine question). */
const WATCH = ["sec-jjjj-60.4230", "sec-zzzz-63.6585"];

type Hit = { id: string; citation: string; title: string; reg_key: string | null; score: number | null };

function report(lines: string[]): void {
  const text = lines.join("\n");
  console.log(text);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, text + "\n");
}

// Traces record the session cookie; never keep one for this file, even locally.
test.use({ trace: "off" });

test.describe("ask report", () => {
  const email = process.env.SMOKE_EMAIL ?? "";
  const password = process.env.SMOKE_PASSWORD ?? "";
  test.skip(
    process.env.SMOKE_SCOPE === "anonymous",
    "SMOKE_SCOPE=anonymous (production deployment): the signed-in group runs on previews only."
  );
  test.skip(!email || !password, "SMOKE_EMAIL / SMOKE_PASSWORD secrets are not set: Ask report skipped.");
  test.describe.configure({ mode: "serial" });

  const stateDir = mkdtempSync(path.join(tmpdir(), "ask-report-"));
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

  test("Ask top 10 for the fixed questions", async ({ page }) => {
    const lines = ["### Ask top 10 (signed in)", ""];
    for (const q of QUESTIONS) {
      const res = await page.request.post("/api/search/semantic", {
        headers: protectionBypassHeaders(),
        data: { q, count: 10 },
      });
      expect(res.status(), `${q}: ${await res.text()}`).toBe(200);
      const { hits } = (await res.json()) as { hits: Hit[] };
      lines.push(`**${q}**`, "");
      hits.forEach((h, i) => {
        const score = h.score == null ? "kw" : h.score.toFixed(3);
        lines.push(`${i + 1}. \`${h.id}\` — ${h.citation} ${h.title ? `— ${h.title}` : ""} (${score})`);
      });
      const seen = WATCH.filter((w) => hits.some((h) => h.id === w || h.id.startsWith(w + "-")));
      if (seen.length) lines.push("", `watched ids present: ${seen.join(", ")}`);
      else lines.push("", `watched ids present: none of ${WATCH.join(", ")}`);
      lines.push("");
    }
    report(lines);
  });

  test("/admin/semantic-eval score", async ({ page }) => {
    const res = await page.goto("/admin/semantic-eval");
    const status = res?.status() ?? 0;
    if (status === 404) {
      report(["### /admin/semantic-eval", "", "The smoke account is not an admin (ADMIN_EMAILS): score not read."]);
      test.skip(true, "smoke account is not an admin");
    }
    expect(status).toBe(200);
    const banner = page.getByText(/\d+ of \d+ passed/);
    await expect(banner).toBeVisible({ timeout: 45_000 });
    const lines = ["### /admin/semantic-eval", "", (await banner.textContent())?.trim() ?? ""];
    // Failed questions: the amber cards list their conditions.
    const failed = await page.locator("li.border-amber-300").allTextContents();
    if (failed.length) {
      lines.push("", "Failed:");
      for (const f of failed) lines.push(`- ${f.replace(/\s+/g, " ").trim().slice(0, 400)}`);
    }
    report(lines);
  });
});
