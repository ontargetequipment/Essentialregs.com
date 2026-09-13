import "server-only";
import Stripe from "stripe";

// Lazily-constructed Stripe client. Deliberately NOT instantiated at import
// time: `next build` evaluates route modules without STRIPE_SECRET_KEY set,
// and a missing key should only fail the request that actually needs Stripe,
// with a message that says what to fix.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (or the Vercel project's environment variables) — see docs/stripe-setup.md."
    );
  }

  cached = new Stripe(key, {
    appInfo: { name: "EssentialRegs", url: "https://www.essentialregs.com" },
  });
  return cached;
}

/** Read a required Stripe-related env var, failing with a pointer to the setup doc. */
export function requireEnv(
  name:
    | "STRIPE_WEBHOOK_SECRET"
    | "STRIPE_PRICE_ID_ANNUAL"
    | "NEXT_PUBLIC_SITE_URL"
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see docs/stripe-setup.md.`);
  }
  return value;
}

/** Site origin without a trailing slash, for Stripe redirect URLs. */
export function siteUrl(): string {
  return requireEnv("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, "");
}
