/**
 * Page-width alignment check (16 Oct 2026): opens every top-level page at
 * 1360px and 390px and asserts that the first block of <main> has the same
 * left and right edges (within 1px) as the header's inner wrapper -- the one
 * shared container, src/lib/ui.ts pageContainerClass -- and that nothing
 * scrolls sideways. Prints a table; exits 1 if any page is off.
 *
 *   BASE_URL=https://<deployment> npx tsx scripts/page-alignment.ts
 *   BASE_URL=http://127.0.0.1:3100 npx tsx scripts/page-alignment.ts   # the local harness (e2e/harness/README.md)
 *
 * Optional environment:
 *   VERCEL_AUTOMATION_BYPASS_SECRET  for a protected Vercel preview (e2e/fixtures.ts)
 *   SMOKE_EMAIL / SMOKE_PASSWORD     log in first, so /account (and the admin
 *                                    pages, when that account is on ADMIN_EMAILS)
 *                                    are measured as themselves rather than as
 *                                    the /login they redirect a visitor to
 *   SHOTS=<dir>                      also save full-page screenshots of /,
 *                                    /sample and /pricing at 1360px into <dir>
 *
 * Not a test file: `npm test` runs scripts/*.test.ts only.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { withProtectionBypass } from "../e2e/fixtures";
import { WIDTHS, measurePageWidth, pageWidthProblems } from "../e2e/page-width";

/** Every top-level page outside the regulation reader (the reader itself keeps its own full-bleed layout). */
const PAGES = [
  "/",
  "/sample",
  "/pricing",
  "/states",
  "/states/colorado",
  "/federal",
  "/general-permits",
  "/test-methods",
  "/test-methods/method-21",
  "/request",
  "/contact",
  "/about",
  "/changelog",
  "/search",
  "/search?q=emissions",
  "/search?mode=ask", // Ask lives on /search (there is no /ask route)
  "/terms",
  "/privacy",
  "/disclaimer",
  "/login",
  "/signup",
  "/signup?plan=year",
  "/forgot-password",
  "/check-email",
  "/account",
  "/regs/sec-7-B-I-D-3-a-(i)",
  "/regulations/7/preview", // the whole-document preview; a focused one (?p=) opens with its context strip
  "/admin/requests",
  "/admin/review",
  "/admin/semantic-eval",
] as const;

const SHOT_PAGES = ["/", "/sample", "/pricing"] as const;

const baseURL = process.env.BASE_URL;
if (!baseURL) {
  console.error("page-alignment: set BASE_URL to the deployment to check");
  process.exit(2);
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
}

async function main(): Promise<number> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  await withProtectionBypass(context, baseURL);
  const page = await context.newPage();

  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (email && password) {
    await login(page, email, password);
    console.log(`signed in as ${email}`);
  }
  const shots = process.env.SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });

  let failures = 0;
  const rows: string[] = [];
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(path);
      const landed = new URL(page.url()).pathname + new URL(page.url()).search;
      const where = landed === path ? path : `${path} → ${landed}`;
      const status = response?.status() ?? 0;
      let line: string;
      try {
        const m = await measurePageWidth(page);
        const problems = pageWidthProblems(m);
        if (problems.length) failures += 1;
        line = `${problems.length ? "FAIL" : "ok  "} ${String(width).padStart(4)}  ${where.padEnd(44)} header ${m.header.left.toFixed(0)}–${m.header.right.toFixed(0)}  main ${m.main.left.toFixed(0)}–${m.main.right.toFixed(0)}  overflow ${m.overflow}${problems.length ? "  " + problems.join("; ") : ""}`;
      } catch (error) {
        failures += 1;
        line = `FAIL ${String(width).padStart(4)}  ${where.padEnd(44)} HTTP ${status}: ${error instanceof Error ? error.message : String(error)}`;
      }
      rows.push(line);
      console.log(line);
      if (shots && width === 1360 && (SHOT_PAGES as readonly string[]).includes(path)) {
        const name = path === "/" ? "home" : path.slice(1).replace(/[^a-z0-9]+/gi, "-");
        await page.screenshot({ path: join(shots, `${name}-1360.png`), fullPage: true });
      }
    }
  }
  await browser.close();
  console.log(`\n${rows.length} measurements, ${failures} off`);
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
