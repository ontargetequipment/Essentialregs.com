import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST /api/stripe/webhook — Stripe calls this (not the browser). It is the
// ONLY thing that writes subscription state onto `profiles`, and it does so
// with the service-role key because Stripe's request carries no user
// session. Authenticity comes from the signature check, so this route must
// receive the raw, unparsed body.
//
// Events subscribed in the Stripe dashboard (docs/stripe-setup.md):
//   checkout.session.completed   — first purchase: link customer + subscription to the user
//   customer.subscription.updated — renewals, payment failures, cancel-at-period-end, plan changes
//   customer.subscription.deleted — subscription fully ended (status 'canceled')

type ProfileSubscriptionFields = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  plan?: string | null;
};

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    console.error("stripe webhook: missing signature header or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  // Raw text, not JSON — the signature is computed over the exact bytes.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("stripe webhook: signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object, "updated");
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object, "deleted");
        break;
      default:
        // Not one we act on; acknowledge so Stripe doesn't retry.
        break;
    }
  } catch (err) {
    // 500 makes Stripe retry with backoff, which is what we want for a
    // transient Supabase failure. The event id lets it be found in the
    // Stripe dashboard's webhook log.
    console.error(`stripe webhook: failed handling ${event.type} (${event.id})`, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// --- handlers --------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const userId = session.client_reference_id;
  const customerId = idOf(session.customer);
  const subscriptionId = idOf(session.subscription);

  if (!userId) {
    console.error(
      `stripe webhook: checkout.session.completed ${session.id} has no client_reference_id; cannot link to a user`
    );
    return;
  }

  // Link customer + subscription first so a later event can always find
  // this user by customer id even if the subscription retrieve below fails.
  const fields: ProfileSubscriptionFields = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  };

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    Object.assign(fields, subscriptionFields(subscription));
  }

  await updateProfile(userId, fields);
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  kind: "updated" | "deleted"
) {
  const admin = createAdminClient();
  const customerId = idOf(subscription.customer);

  // Prefer the user id we stamped into metadata at checkout; fall back to
  // the customer id link written by checkout.session.completed.
  const metadataUserId = subscription.metadata?.supabase_user_id || null;
  const lookupColumn = metadataUserId ? "id" : "stripe_customer_id";
  const lookupValue = metadataUserId ?? customerId;

  let userId: string | null = null;
  let currentSubscriptionId: string | null = null;

  if (lookupValue) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, stripe_subscription_id")
      .eq(lookupColumn, lookupValue)
      .maybeSingle();
    if (error) throw new Error(`profile lookup failed: ${error.message}`);
    if (data) {
      userId = data.id as string;
      currentSubscriptionId = (data.stripe_subscription_id as string | null) ?? null;
    }
  }

  if (!userId) {
    console.error(
      `stripe webhook: customer.subscription.${kind} ${subscription.id} — no profile for customer ${customerId ?? "(none)"}`
    );
    return;
  }

  // Guard against out-of-order delivery: if the profile has already moved on
  // to a different (newer) subscription, the end of an old one must not
  // clobber it. An `updated` event is always applied — a new subscription's
  // first update is how the profile switches over.
  if (
    kind === "deleted" &&
    currentSubscriptionId &&
    currentSubscriptionId !== subscription.id
  ) {
    console.log(
      `stripe webhook: ignoring deleted ${subscription.id}; profile ${userId} is on ${currentSubscriptionId}`
    );
    return;
  }

  await updateProfile(userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    ...subscriptionFields(subscription),
  });
}

// --- helpers ---------------------------------------------------------------

/** The columns derived from a Subscription object. */
function subscriptionFields(subscription: Stripe.Subscription): ProfileSubscriptionFields {
  // Since Stripe API 2025-03-31 the billing period lives on each
  // subscription item rather than the subscription. Take the latest end
  // across items (there's only one for this product).
  const periodEnd = subscription.items.data.reduce<number | null>(
    (max, item) =>
      max === null || item.current_period_end > max ? item.current_period_end : max,
    null
  );
  const price = subscription.items.data[0]?.price;

  return {
    subscription_status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    plan: price ? (price.nickname ?? price.id) : null,
  };
}

async function updateProfile(userId: string, fields: ProfileSubscriptionFields) {
  const admin = createAdminClient();
  const { error, count } = await admin
    .from("profiles")
    .update(fields, { count: "exact" })
    .eq("id", userId);
  if (error) throw new Error(`profile update failed for ${userId}: ${error.message}`);
  if (count === 0) {
    // Nothing matched — the user id from Stripe doesn't exist here. Log
    // rather than throw: retrying won't help.
    console.error(`stripe webhook: no profiles row for user ${userId}`);
  }
}

/** Stripe fields that may be an id string or an expanded object. */
function idOf(
  ref: string | { id: string } | null | undefined
): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
