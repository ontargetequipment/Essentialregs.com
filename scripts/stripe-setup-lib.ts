/**
 * The pure decisions behind scripts/stripe-setup.ts, kept free of I/O so
 * scripts/stripe-billing.test.ts can exercise them without a Stripe client.
 */
import type Stripe from "stripe";
import { PLAN_NAMES, PRICE_DISPLAY, PRICE_LOOKUP, parsePriceDisplay, type BillingInterval } from "../src/lib/pricing";

export const DEFAULT_SITE = "https://www.essentialregs.com";

export type SetupArgs = {
  dryRun: boolean;
  replace: boolean;
  live: boolean;
  site: string;
};

/** Parse the command line. Throws with a plain message on an unknown flag or a bad --site. */
export function parseArgs(argv: string[]): SetupArgs {
  const args: SetupArgs = { dryRun: false, replace: false, live: false, site: DEFAULT_SITE };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--replace") args.replace = true;
    else if (a === "--live") args.live = true;
    else if (a === "--site" || a.startsWith("--site=")) {
      const value = a === "--site" ? argv[++i] : a.slice("--site=".length);
      if (!value) throw new Error("--site needs an origin, e.g. --site https://www.essentialregs.com");
      args.site = normalizeSite(value);
    } else {
      throw new Error(`Unknown flag ${a}. Flags: --dry-run, --replace, --live, --site <origin>`);
    }
  }
  return args;
}

/** "https://host/" → "https://host". Rejects anything that isn't an https origin. */
export function normalizeSite(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`--site "${value}" is not a URL.`);
  }
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`--site must be a bare https origin like ${DEFAULT_SITE}, not "${value}".`);
  }
  return url.origin;
}

export type Mode = "live" | "test";

/**
 * The live/test guard: the key's prefix must agree with the --live flag, so a
 * live key can't be used by accident and a test run isn't mistaken for the
 * real thing. Returns the mode, or a message to print before exiting 2.
 */
export function checkMode(key: string | undefined, liveFlag: boolean): { mode: Mode } | { error: string } {
  if (!key) {
    return {
      error:
        "STRIPE_SECRET_KEY is not set. Put it in .env.local (the script reads that file) or run\n" +
        "  STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup",
    };
  }
  const isLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  const isTest = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  if (!isLive && !isTest) {
    return { error: "STRIPE_SECRET_KEY does not look like a Stripe secret key (sk_test_... or sk_live_...)." };
  }
  if (isLive && !liveFlag) {
    return {
      error:
        "STRIPE_SECRET_KEY is a LIVE key but --live was not passed. Re-run with --live if you really mean\n" +
        "to set up the live account, or put the sk_test_ key in .env.local first.",
    };
  }
  if (isTest && liveFlag) {
    return { error: "--live was passed but STRIPE_SECRET_KEY is a test key. Drop --live, or use the sk_live_ key." };
  }
  return { mode: isLive ? "live" : "test" };
}

export type WantedPrice = { interval: BillingInterval; lookupKey: string; cents: number; name: string };

/** The two Prices the site sells, read from the display copy in src/lib/pricing.ts. */
export function wantedPrices(): WantedPrice[] {
  return (Object.keys(PRICE_LOOKUP) as BillingInterval[]).map((interval) => {
    const parsed = parsePriceDisplay(PRICE_DISPLAY[interval]);
    if (parsed.interval !== interval) {
      throw new Error(
        `pricing.ts: PRICE_DISPLAY.${interval} is "${PRICE_DISPLAY[interval]}", which is not a per-${interval} price.`
      );
    }
    return { interval, lookupKey: PRICE_LOOKUP[interval], cents: parsed.cents, name: PLAN_NAMES[interval] };
  });
}

/** The parts of a Stripe Price the decision below looks at. */
export type ExistingPrice = {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
  product: string | { id: string };
};

export type PriceDecision =
  | { action: "create" }
  | { action: "keep" }
  | { action: "replace"; oldId: string }
  | { action: "mismatch"; oldId: string };

/**
 * What to do about the Price currently holding a lookup key:
 *   - none                       → create it
 *   - same amount/currency/interval/product → keep it
 *   - anything else, --replace   → new Price, key moved, old one archived
 *   - anything else, no --replace → report and fail (nothing changed)
 */
export function decidePrice(
  existing: ExistingPrice | null,
  wanted: WantedPrice,
  productId: string,
  replace: boolean
): PriceDecision {
  if (!existing) return { action: "create" };
  const existingProduct = typeof existing.product === "string" ? existing.product : existing.product.id;
  const matches =
    existing.unit_amount === wanted.cents &&
    existing.currency === "usd" &&
    existing.recurring?.interval === wanted.interval &&
    existingProduct === productId;
  if (matches) return { action: "keep" };
  return replace ? { action: "replace", oldId: existing.id } : { action: "mismatch", oldId: existing.id };
}

/** The three events src/app/api/stripe/webhook/route.ts handles. */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export function webhookUrl(site: string): string {
  return `${site}/api/stripe/webhook`;
}

export function portalReturnUrl(site: string): string {
  return `${site}/account`;
}

/** True when an endpoint's event list is exactly WEBHOOK_EVENTS (order aside). */
export function webhookEventsMatch(enabled: readonly string[]): boolean {
  const want = new Set<string>(WEBHOOK_EVENTS);
  return enabled.length === want.size && enabled.every((e) => want.has(e));
}

/** Marks the portal configuration the setup script owns; src/lib/stripe-portal.ts finds it by this too. */
export const PORTAL_METADATA = { app: "essentialregs" } as const;

/**
 * The Customer Portal configuration the site needs. Owner decision, 27 Sep
 * 2026: a downgrade (annual → monthly, i.e. a shorter interval or a smaller
 * amount) is scheduled for the end of the paid period, so a subscriber who
 * paid for a year is never refunded or credited for switching; an upgrade
 * (monthly → annual) still happens at once, and proration_behavior then
 * charges the difference. Cancel is likewise at period end.
 */
export function portalParams(
  site: string,
  productId: string,
  priceIds: string[]
): Stripe.BillingPortal.ConfigurationCreateParams {
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
        schedule_at_period_end: {
          conditions: [{ type: "shortening_interval" }, { type: "decreasing_item_amount" }],
        },
        products: [{ product: productId, prices: priceIds }],
      },
    },
    metadata: PORTAL_METADATA,
  };
}
