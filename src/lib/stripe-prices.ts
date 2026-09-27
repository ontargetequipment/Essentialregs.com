import "server-only";
import { getStripe } from "@/lib/stripe";
import { PRICE_LOOKUP, type BillingInterval } from "@/lib/pricing";

// Resolves a billing interval to the id of the active Stripe Price carrying
// its lookup key (PRICE_LOOKUP). Looked up at request time rather than kept
// in an environment variable so the same deployment works against whichever
// Stripe mode STRIPE_SECRET_KEY selects, and so replacing a Price (new
// amount, new key holder via transfer_lookup_key) needs no redeploy.
//
// The ids are cached in module memory for CACHE_TTL_MS: one Stripe round
// trip per interval per warm instance every few minutes, not one per
// checkout.

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { id: string; expiresAt: number };
const cache = new Map<BillingInterval, CacheEntry>();

export async function getPriceId(interval: BillingInterval): Promise<string> {
  const now = Date.now();
  const hit = cache.get(interval);
  if (hit && hit.expiresAt > now) return hit.id;

  const lookupKey = PRICE_LOOKUP[interval];
  const { data } = await getStripe().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = data[0];
  if (!price) {
    throw new Error(
      `No active Stripe Price has lookup key "${lookupKey}". Run \`npm run stripe:setup\` against this Stripe account (docs/stripe-setup.md, step 1).`
    );
  }

  cache.set(interval, { id: price.id, expiresAt: now + CACHE_TTL_MS });
  return price.id;
}
