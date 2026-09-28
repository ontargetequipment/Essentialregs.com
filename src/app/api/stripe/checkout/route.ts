import { NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { getPriceId } from "@/lib/stripe-prices";
import { getAccessStatus } from "@/lib/access";
import { parseBillingInterval, TRIAL_DAYS, type BillingInterval } from "@/lib/pricing";

export const runtime = "nodejs";

// POST /api/stripe/checkout — start a Stripe Checkout session for the
// monthly or annual price and send the browser there. Called from a plain
// <form method="post"> so it works without any client JS; the form's
// `interval` field ("month" | "year") picks the price.
export async function POST(request: Request) {
  const access = await getAccessStatus();
  if (!access.user) {
    return NextResponse.json({ error: "Log in to subscribe." }, { status: 401 });
  }

  const interval = await readInterval(request);
  if (!interval) {
    return new NextResponse('Choose a billing interval: "month" or "year".', {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const base = siteUrl();

    // Already paying (or comped) — nothing to sell; just send them in.
    if (access.hasAccess) {
      return NextResponse.redirect(`${base}/regulations`, 303);
    }

    // One trial per customer: only an account that has never had a
    // subscription (no stripe_subscription_id on its profile) gets the
    // TRIAL_DAYS free days. A lapsed subscriber coming back pays from day
    // one. Checkout always collects a card (payment_method_collection
    // "always"), so Stripe charges it itself when the trial ends —
    // trial_settings.end_behavior only applies when no card was collected,
    // so it is deliberately left out.
    const firstSubscription = !access.stripeSubscriptionId;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: await getPriceId(interval), quantity: 1 }],
      payment_method_collection: "always",
      // Reuse the Stripe customer if this account has one (e.g. a lapsed
      // subscriber coming back), otherwise let Checkout create one keyed to
      // the account's email.
      ...(access.stripeCustomerId
        ? { customer: access.stripeCustomerId }
        : { customer_email: access.user.email ?? undefined }),
      // Both of these carry the Supabase user id back to us: the webhook
      // reads client_reference_id off checkout.session.completed, and the
      // subscription metadata survives on every later subscription event.
      client_reference_id: access.user.id,
      subscription_data: {
        metadata: { supabase_user_id: access.user.id },
        ...(firstSubscription ? { trial_period_days: TRIAL_DAYS } : {}),
      },
      success_url: `${base}/account?checkout=success`,
      cancel_url: `${base}/pricing`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error("Stripe returned a Checkout session without a URL.");
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("stripe checkout: failed to create session", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again in a moment." },
      { status: 500 }
    );
  }
}

/**
 * The form's `interval` field. Absent (an old form with no field, or a body
 * that isn't a form at all) defaults to the annual price; present but not
 * "month" / "year" is a null, which the caller turns into a 400.
 */
async function readInterval(request: Request): Promise<BillingInterval | null> {
  let raw: FormDataEntryValue | null = null;
  try {
    raw = (await request.formData()).get("interval");
  } catch {
    // Not form-encoded — treat as no field.
  }
  if (raw === null) return "year";
  return parseBillingInterval(raw);
}
