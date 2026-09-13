import { NextResponse } from "next/server";
import { getStripe, requireEnv, siteUrl } from "@/lib/stripe";
import { getAccessStatus } from "@/lib/access";

export const runtime = "nodejs";

// POST /api/stripe/checkout — start a Stripe Checkout session for the
// annual plan and send the browser there. Called from a plain <form
// method="post"> so it works without any client JS.
export async function POST() {
  const access = await getAccessStatus();
  if (!access.user) {
    return NextResponse.json({ error: "Log in to subscribe." }, { status: 401 });
  }

  try {
    const base = siteUrl();

    // Already paying (or comped) — nothing to sell; just send them in.
    if (access.hasAccess) {
      return NextResponse.redirect(`${base}/regulations`, 303);
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: requireEnv("STRIPE_PRICE_ID_ANNUAL"), quantity: 1 }],
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
      subscription_data: { metadata: { supabase_user_id: access.user.id } },
      success_url: `${base}/account?checkout=success`,
      cancel_url: `${base}/#pricing`,
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
