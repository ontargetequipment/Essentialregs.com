/**
 * One-shot, re-runnable Stripe setup for everything the site needs from the
 * account behind STRIPE_SECRET_KEY:
 *
 *   1. the EssentialRegs product and its two recurring Prices, found by the
 *      lookup keys in src/lib/pricing.ts (PRICE_LOOKUP) with the amounts in
 *      the display strings there;
 *   2. a Customer Portal configuration (invoice history, card update, cancel
 *      at period end, switch between the two prices: upgrades at once with
 *      proration, downgrades scheduled for the end of the paid period);
 *   3. the webhook endpoint at <site>/api/stripe/webhook with the three
 *      events the webhook route handles.
 *
 * Run from the repo root after `npm ci`, with the key in .env.local:
 *
 *   npm run stripe:setup                 test-mode key (sk_test_...)
 *   npm run stripe:setup -- --live       live key (sk_live_...); refused without the flag
 *
 * Flags:
 *   --dry-run        print what would change; write nothing (not even the file below)
 *   --replace-prices when a Price under a lookup key has the wrong amount or
 *                    interval (the copy in pricing.ts changed), create a new
 *                    Price with those values, move the lookup key onto it
 *                    (transfer_lookup_key), archive the old one, and give the
 *                    portal configuration the new ids only. Existing
 *                    subscriptions stay on the old Price; only new checkouts
 *                    see the new amount. A second run finds the amounts
 *                    matching and changes no Price. Without the flag a
 *                    mismatch is reported and the script exits having
 *                    changed nothing. (--replace is the old spelling, still
 *                    accepted.)
 *   --live           required with a live key, refused with a test key
 *   --site <origin>  the deployed site, default https://www.essentialregs.com;
 *                    sets the webhook URL and the portal return URL
 *
 * Output goes to ./stripe-setup.local.txt (git-ignored): the mode, every id,
 * and — only when the webhook endpoint was created on this run — its signing
 * secret, which Stripe returns exactly once. Stdout gets the ids and nothing
 * secret. Safe to repeat: everything that already exists is left or updated
 * in place.
 *
 * Nothing here touches the database or the site; the checkout and portal
 * routes find the Prices and the portal configuration at request time
 * (src/lib/stripe-prices.ts, src/lib/stripe-portal.ts).
 */
import { writeFileSync } from "node:fs";
import Stripe from "stripe";
import { WEBHOOK_EVENTS, checkMode, parseArgs, webhookEventsMatch, webhookUrl } from "./stripe-setup-lib";
import { createSync } from "./stripe-setup-sync";

const OUTPUT_FILE = "stripe-setup.local.txt";

// --- arguments, env, mode ----------------------------------------------------

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}

// .env.local is where the owner keeps the key (docs/stripe-setup.md). Missing
// file or no loadEnvFile (Node < 20.12): fall through to the environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // ignore
}

const modeCheck = checkMode(process.env.STRIPE_SECRET_KEY, args.live);
if ("error" in modeCheck) {
  console.error(modeCheck.error);
  process.exit(2);
}
const { mode } = modeCheck;
const { dryRun, replacePrices, site } = args;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { appInfo: { name: "EssentialRegs setup script" } });

/** Lines for stripe-setup.local.txt; may include the webhook secret, so never echoed. */
const report: string[] = [];
/** Lines for stdout: ids and decisions, never secrets. */
const summary: string[] = [];
function note(line: string) {
  report.push(line);
  summary.push(line);
}

// --- product, prices, customer portal (scripts/stripe-setup-sync.ts) ----------

const { ensurePrices, ensurePortal } = createSync(stripe, { dryRun, replacePrices, site, note });

// --- webhook endpoint ---------------------------------------------------------

async function ensureWebhook(): Promise<void> {
  const url = webhookUrl(site);
  const { data } = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = data.find((e) => e.url === url) ?? null;
  const events = [...WEBHOOK_EVENTS];

  if (existing) {
    const eventsOk = webhookEventsMatch(existing.enabled_events);
    const enabledOk = existing.status === "enabled";
    if (eventsOk && enabledOk) {
      note(`webhook: ok ${existing.id} ${url}`);
    } else if (dryRun) {
      note(`webhook: would update ${existing.id} ${url} (events/enabled)`);
    } else {
      await stripe.webhookEndpoints.update(existing.id, { enabled_events: events, disabled: false });
      note(`webhook: updated ${existing.id} ${url}`);
    }
    report.push(
      "webhook signing secret: not available — Stripe returns it only when the endpoint is created. If",
      "  STRIPE_WEBHOOK_SECRET in Vercel is missing or wrong, roll the secret in the Stripe dashboard",
      `  (Developers → Webhooks → ${url} → Signing secret → Roll) and copy the new value from there.`
    );
    return;
  }
  if (dryRun) {
    note(`webhook: would create ${url} for ${events.join(", ")}`);
    return;
  }
  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: events,
    description: "EssentialRegs site (created by scripts/stripe-setup.ts)",
  });
  note(`webhook: created ${created.id} ${url}`);
  if (created.secret) {
    report.push(`STRIPE_WEBHOOK_SECRET=${created.secret}`);
    summary.push("webhook: signing secret written to the file (not shown here)");
  } else {
    report.push("webhook signing secret: Stripe did not return one; roll it in the dashboard.");
  }
}

// --- main ---------------------------------------------------------------------

async function main() {
  note(`mode: ${mode}${dryRun ? " (dry run: nothing written)" : ""}`);
  note(`site: ${site}`);

  const { product, priceIds } = await ensurePrices();
  await ensurePortal(product.id, priceIds);
  await ensureWebhook();

  if (dryRun) {
    console.log(summary.join("\n"));
    console.log("\nDry run finished; nothing was written.");
    return;
  }
  report.push("", `written ${new Date().toISOString()} by scripts/stripe-setup.ts`);
  writeFileSync(OUTPUT_FILE, report.join("\n") + "\n", { mode: 0o600 });
  console.log(`Wrote ${OUTPUT_FILE}`);
  console.log(summary.join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
