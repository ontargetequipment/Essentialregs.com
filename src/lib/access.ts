import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Stripe subscription statuses that unlock the full corpus. Must match the
 *  RLS policies in supabase/migrations/002_subscriptions.sql. */
export const ACTIVE_STATUSES = ["active", "trialing"] as const;

export type AccessStatus = {
  user: User | null;
  /** true when the RLS policies will let this user read the full corpus. */
  hasAccess: boolean;
  /** Stripe's subscription status string (active, canceled, past_due, ...) or null if never subscribed. */
  status: string | null;
  /** ISO timestamp of the end of the current paid period, or null. */
  currentPeriodEnd: string | null;
  /** true when the user has canceled but the paid period hasn't ended yet (status is still active). */
  cancelAtPeriodEnd: boolean;
  /** profiles.access_granted — comped access set by hand, independent of Stripe. */
  manualOverride: boolean;
  /** Stripe customer id, used to decide whether the billing portal is available. */
  stripeCustomerId: string | null;
  /** Stripe Price nickname/id the subscription is on, or null. */
  plan: string | null;
};

const NO_ACCESS: Omit<AccessStatus, "user"> = {
  hasAccess: false,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  manualOverride: false,
  stripeCustomerId: null,
  plan: null,
};

/**
 * Server-side: who is logged in and whether they can read the full corpus.
 * Mirrors the RLS gate in the database (access_granted OR an active/trialing
 * subscription) so pages can decide what UI to show without a second
 * round-trip; the database is still the enforcement point.
 *
 * Reads via the cookie-scoped client, so it's subject to the "users can read
 * own profile" policy — it can only ever see the caller's own row.
 */
export async function getAccessStatus(): Promise<AccessStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, ...NO_ACCESS };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "access_granted, subscription_status, current_period_end, cancel_at_period_end, stripe_customer_id, plan"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    // A missing row (trigger hasn't fired yet) or a query failure means no
    // access — never fail open. The error is logged for diagnosis.
    if (error) console.error("getAccessStatus: profile lookup failed", error.message);
    return { user, ...NO_ACCESS };
  }

  const status: string | null = profile.subscription_status ?? null;
  const manualOverride = Boolean(profile.access_granted);
  const hasAccess =
    manualOverride ||
    (status !== null && (ACTIVE_STATUSES as readonly string[]).includes(status));

  return {
    user,
    hasAccess,
    status,
    currentPeriodEnd: profile.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(profile.cancel_at_period_end),
    manualOverride,
    stripeCustomerId: profile.stripe_customer_id ?? null,
    plan: profile.plan ?? null,
  };
}
