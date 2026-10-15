import { PRICE_DISPLAY, PRICE_LOOKUP, parsePriceDisplay, type BillingInterval } from "@/lib/pricing";

// The Stripe canary behind GET /api/health/stripe (14 Oct 2026: production
// checkout had been failing on an expired STRIPE_SECRET_KEY for an unknown
// period and nothing said so). Read-only: it lists the two Prices and one
// Customer with the deployment's own key, and creates nothing.
//
// Kept free of "server-only" and of the Stripe client itself so
// scripts/stripe-canary.test.ts can run it against a fake client; the route
// supplies the real one.

/** Why the canary failed. A code only: never Stripe's message or any part of the key. */
export type CanaryReason =
  | "auth"
  | "price_missing"
  | "price_mismatch"
  | "permission"
  | "stripe_unreachable"
  | "misconfigured";

export type CanaryResult = { ok: true; checkedAt: string } | { ok: false; reason: CanaryReason; checkedAt: string };

/** The fields of a Stripe Price the canary reads. */
export type CanaryPrice = {
  lookup_key: string | null;
  active: boolean;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
};

/** The two Stripe calls the canary makes; a real `Stripe` instance satisfies it. */
export type CanaryStripe = {
  prices: {
    list(params: { lookup_keys: string[]; active: boolean; limit: number }): PromiseLike<{ data: CanaryPrice[] }>;
  };
  customers: { list(params: { limit: number }): PromiseLike<unknown> };
};

/** What each lookup key must carry: the amount and interval typed in pricing.ts. */
export function expectedPrices(): Record<BillingInterval, { lookupKey: string; cents: number; interval: BillingInterval }> {
  const out = {} as Record<BillingInterval, { lookupKey: string; cents: number; interval: BillingInterval }>;
  for (const interval of Object.keys(PRICE_LOOKUP) as BillingInterval[]) {
    const parsed = parsePriceDisplay(PRICE_DISPLAY[interval]);
    out[interval] = { lookupKey: PRICE_LOOKUP[interval], cents: parsed.cents, interval: parsed.interval };
  }
  return out;
}

/**
 * Compare the Prices Stripe returned for the lookup keys with pricing.ts.
 * Missing (or inactive) for either key is price_missing; a wrong amount,
 * interval or currency (or a second active Price on one key, which makes the
 * checkout's pick arbitrary) is price_mismatch. Null when both match.
 */
export function comparePrices(prices: CanaryPrice[]): "price_missing" | "price_mismatch" | null {
  const expected = expectedPrices();
  let mismatch = false;
  for (const want of Object.values(expected)) {
    const found = prices.filter((p) => p.lookup_key === want.lookupKey && p.active);
    if (found.length === 0) return "price_missing";
    if (found.length > 1) mismatch = true;
    for (const p of found) {
      if (p.unit_amount !== want.cents || p.recurring?.interval !== want.interval || p.currency !== "usd") {
        mismatch = true;
      }
    }
  }
  return mismatch ? "price_mismatch" : null;
}

/**
 * Map a thrown Stripe error to a reason by its `type` (StripeAuthenticationError
 * for an expired, revoked or wrong key; StripePermissionError for a restricted
 * key without the access). Anything else — network, Stripe 5xx, rate limit,
 * an unexpected error — is stripe_unreachable.
 */
export function classifyStripeError(err: unknown): CanaryReason {
  const type = err && typeof err === "object" && "type" in err ? (err as { type: unknown }).type : undefined;
  if (type === "StripeAuthenticationError") return "auth";
  if (type === "StripePermissionError") return "permission";
  return "stripe_unreachable";
}

/** Run the canary once against `stripe` (null when STRIPE_SECRET_KEY is unset). Never throws. */
export async function runStripeCanary(stripe: CanaryStripe | null, now: () => Date = () => new Date()): Promise<CanaryResult> {
  const fail = (reason: CanaryReason): CanaryResult => ({ ok: false, reason, checkedAt: now().toISOString() });
  if (!stripe) return fail("misconfigured");

  let lookupKeys: string[];
  try {
    lookupKeys = Object.values(expectedPrices()).map((p) => p.lookupKey);
  } catch {
    // A display string in pricing.ts that parsePriceDisplay can't read.
    return fail("misconfigured");
  }

  try {
    const { data } = await stripe.prices.list({ lookup_keys: lookupKeys, active: true, limit: 10 });
    const priceProblem = comparePrices(data);
    if (priceProblem) return fail(priceProblem);
    // Checkout reads (and creates) Customers; a key without that access fails here.
    await stripe.customers.list({ limit: 1 });
  } catch (err) {
    return fail(classifyStripeError(err));
  }
  return { ok: true, checkedAt: now().toISOString() };
}

/** How long a result is reused, so the endpoint can't be used to hammer Stripe. */
export const CANARY_CACHE_MS = 5 * 60 * 1000;
