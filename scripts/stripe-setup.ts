/**
 * One-shot, re-runnable Stripe setup for everything the site needs from the
 * account behind STRIPE_SECRET_KEY:
 *
 *   1. the EssentialRegs product and its two recurring Prices, found by the
 *      lookup keys in src/lib/pricing.ts (PRICE_LOOKUP) with the amounts in
 *      the display strings there;
 *   2. a Customer Portal configuration (invoice history, card update, cancel
 *      at period end, switch between the two prices with proration);
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
 *   --replace        when a Price under a lookup key has the wrong amount or
 *                    interval (the copy in pricing.ts changed), create a new
 *                    Price with those values, move the lookup key onto it and
 *                    archive the old one. Existing subscriptions stay on the
 *                    old Price; only new checkouts see the new amount.
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
import { PLAN_TAGLINE } from "../src/lib/pricing";
import {
  WEBHOOK_EVENTS,
  checkMode,
  decidePrice,
  parseArgs,
  portalReturnUrl,
  wantedPrices,
  webhookEventsMatch,
  webhookUrl,
  type WantedPrice,
} from "./stripe-setup-lib";

const PRODUCT_NAME = "EssentialRegs";
/** Marks the product this script owns, so a rename in the dashboard doesn't lose it. */
const PRODUCT_METADATA_KEY = "essentialregs_product";
const PRODUCT_METADATA_VALUE = "individual";
/** Marks the portal configuration this script owns; src/lib/stripe-portal.ts finds it by this too. */
export const PORTAL_METADATA = { app: "essentialregs" } as const;
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
const { dryRun, replace, site } = args;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { appInfo: { name: "EssentialRegs setup script" } });

/** Lines for stripe-setup.local.txt; may include the webhook secret, so never echoed. */
const report: string[] = [];
/** Lines for stdout: ids and decisions, never secrets. */
const summary: string[] = [];
function note(line: string) {
  report.push(line);
  summary.push(line);
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function describe(price: Stripe.Price): string {
  const amount = price.unit_amount === null ? "(no unit amount)" : money(price.unit_amount);
  const interval = price.recurring?.interval ?? "(one-time)";
  return `${price.id} ${amount} / ${interval}${price.active ? "" : " (archived)"}`;
}

// --- product and prices -------------------------------------------------------

async function findPriceByLookupKey(lookupKey: string): Promise<Stripe.Price | null> {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return data[0] ?? null;
}

async function findOrCreateProduct(hint: Stripe.Price | null): Promise<Stripe.Product> {
  // 1. The product an existing price already hangs off.
  if (hint) {
    const id = typeof hint.product === "string" ? hint.product : hint.product.id;
    const product = await stripe.products.retrieve(id);
    if (!product.deleted) return product;
  }
  // 2. The product this script created before (metadata marker).
  const marked = await stripe.products.search({
    query: `active:'true' AND metadata['${PRODUCT_METADATA_KEY}']:'${PRODUCT_METADATA_VALUE}'`,
    limit: 1,
  });
  if (marked.data[0]) return marked.data[0];
  // 3. A product made by hand in the dashboard with the expected name.
  const named = await stripe.products.search({
    query: `active:'true' AND name:'${PRODUCT_NAME}'`,
    limit: 1,
  });
  if (named.data[0]) return named.data[0];

  if (dryRun) {
    note(`product: would create "${PRODUCT_NAME}"`);
    return { id: "prod_DRYRUN", name: PRODUCT_NAME } as Stripe.Product;
  }
  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    description: PLAN_TAGLINE,
    metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
  });
  note(`product: created ${created.id} "${created.name}"`);
  return created;
}

async function createPrice(product: Stripe.Product, w: WantedPrice, transferLookupKey: boolean): Promise<string> {
  const label = `${w.name} ${money(w.cents)} / ${w.interval} (lookup key ${w.lookupKey})`;
  if (dryRun) {
    note(`price ${w.lookupKey}: would create ${label}`);
    return `price_DRYRUN_${w.interval}`;
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: w.cents,
    recurring: { interval: w.interval },
    lookup_key: w.lookupKey,
    transfer_lookup_key: transferLookupKey,
    nickname: w.name,
  });
  note(`price ${w.lookupKey}: created ${describe(price)}`);
  return price.id;
}

/** Returns the two price ids (keyed by lookup key) or throws after reporting mismatches. */
async function ensurePrices(): Promise<{ product: Stripe.Product; priceIds: string[] }> {
  const wanted = wantedPrices();
  const existing = new Map<string, Stripe.Price | null>();
  for (const w of wanted) existing.set(w.lookupKey, await findPriceByLookupKey(w.lookupKey));

  const product = await findOrCreateProduct([...existing.values()].find((p) => p) ?? null);
  note(`product: ${product.id} "${product.name}"`);

  const priceIds: string[] = [];
  const mismatches: string[] = [];
  for (const w of wanted) {
    const current = existing.get(w.lookupKey) ?? null;
    const decision = decidePrice(current, w, product.id, replace);
    switch (decision.action) {
      case "create":
        priceIds.push(await createPrice(product, w, false));
        break;
      case "keep":
        note(`price ${w.lookupKey}: ok ${describe(current!)}`);
        priceIds.push(current!.id);
        break;
      case "replace": {
        note(`price ${w.lookupKey}: ${describe(current!)} does not match ${money(w.cents)} / ${w.interval}`);
        const id = await createPrice(product, w, true);
        if (dryRun) {
          note(`price ${w.lookupKey}: would move the lookup key to the new Price and archive ${decision.oldId}`);
        } else {
          await stripe.prices.update(decision.oldId, { active: false });
          note(`price ${w.lookupKey}: archived ${decision.oldId}`);
        }
        priceIds.push(id);
        break;
      }
      case "mismatch":
        note(`price ${w.lookupKey}: MISMATCH ${describe(current!)}, wanted ${money(w.cents)} / ${w.interval}`);
        mismatches.push(w.lookupKey);
        priceIds.push(current!.id);
        break;
    }
  }
  if (mismatches.length) {
    throw new Error(
      `${mismatches.length} price(s) do not match src/lib/pricing.ts (${mismatches.join(", ")}). Nothing was changed.\n` +
        "Either change src/lib/pricing.ts back to match Stripe, or re-run with --replace to create a Price at\n" +
        "the new amount, move the lookup key to it and archive the old one."
    );
  }
  return { product, priceIds };
}

// --- customer portal ----------------------------------------------------------

function portalParams(productId: string, priceIds: string[]): Stripe.BillingPortal.ConfigurationCreateParams {
  return {
    business_profile: { headline: "EssentialRegs" },
    default_return_url: portalReturnUrl(site),
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [{ product: productId, prices: priceIds }],
      },
    },
    metadata: PORTAL_METADATA,
  };
}

async function ensurePortal(productId: string, priceIds: string[]): Promise<string> {
  const { data } = await stripe.billingPortal.configurations.list({ limit: 100 });
  // Ours by marker first; else the account's default (the one the dashboard
  // manages), which gets our features and the marker; else a new one. The
  // API cannot flip is_default, so src/lib/stripe-portal.ts pins the marked
  // configuration on every portal session instead of relying on the default.
  const mine =
    data.find((c) => c.metadata?.app === PORTAL_METADATA.app) ?? data.find((c) => c.is_default) ?? null;
  const params = portalParams(productId, priceIds);

  if (mine) {
    if (dryRun) {
      note(`portal: would update ${mine.id}${mine.is_default ? " (account default)" : ""}`);
      return mine.id;
    }
    const updated = await stripe.billingPortal.configurations.update(mine.id, { ...params, active: true });
    note(`portal: updated ${updated.id}${updated.is_default ? " (account default)" : ""}`);
    return updated.id;
  }
  if (dryRun) {
    note("portal: would create a configuration");
    return "bpc_DRYRUN";
  }
  const created = await stripe.billingPortal.configurations.create(params);
  note(`portal: created ${created.id}`);
  return created.id;
}

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
