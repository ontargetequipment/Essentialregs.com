import "server-only";
import { getStripe } from "@/lib/stripe";

// The Customer Portal configuration scripts/stripe-setup.ts creates (or
// adopts) is marked metadata.app = "essentialregs". The Stripe API can't
// make an API-created configuration the account default, so the portal
// route pins it by id on every session. Falls back to the account default
// (undefined) when none is marked, e.g. before the script has run.
//
// Cached in module memory like the price ids: one list call per warm
// instance every few minutes.

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { id: string | undefined; expiresAt: number } | null = null;

export async function getPortalConfigurationId(): Promise<string | undefined> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.id;

  const { data } = await getStripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const id = data.find((c) => c.metadata?.app === "essentialregs")?.id;
  cached = { id, expiresAt: now + CACHE_TTL_MS };
  return id;
}
