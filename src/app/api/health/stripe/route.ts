import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { CANARY_CACHE_MS, runStripeCanary, type CanaryResult } from "@/lib/stripe-canary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health/stripe — the Stripe canary (src/lib/stripe-canary.ts).
// Checks this deployment's own STRIPE_SECRET_KEY: both Prices exist under
// their lookup keys at the pricing.ts amounts, and the key can read
// Customers. Creates nothing. 200 { ok: true, checkedAt } or
// 503 { ok: false, reason, checkedAt }, reason a code only.
//
// Called by the anonymous smoke on every deploy (e2e/smoke-anonymous.spec.ts)
// and daily by .github/workflows/stripe-canary.yml. The result (or the check
// in flight) is reused for CANARY_CACHE_MS per warm instance, so however often
// this is hit, Stripe sees at most two list calls per instance per 5 minutes.

let last: { result: Promise<CanaryResult>; expiresAt: number } | null = null;

async function check(): Promise<CanaryResult> {
  try {
    const stripe = process.env.STRIPE_SECRET_KEY ? getStripe() : null;
    const result = await runStripeCanary(stripe);
    if (!result.ok) {
      console.error(`[stripe-canary] check failed: reason=${result.reason}`);
    }
    return result;
  } catch {
    // runStripeCanary doesn't throw; this is the belt to its braces.
    console.error("[stripe-canary] check failed: reason=stripe_unreachable (unexpected error)");
    return { ok: false, reason: "stripe_unreachable", checkedAt: new Date().toISOString() };
  }
}

export async function GET() {
  const now = Date.now();
  if (!last || last.expiresAt <= now) {
    last = { result: check(), expiresAt: now + CANARY_CACHE_MS };
  }
  const result = await last.result;
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
