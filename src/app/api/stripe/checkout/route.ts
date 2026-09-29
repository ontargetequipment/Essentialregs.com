import { NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { getPriceId } from "@/lib/stripe-prices";
import { getAccessStatus } from "@/lib/access";
import { parseBillingInterval, type BillingInterval } from "@/lib/pricing";
import { checkoutSessionParams, isMissingTermsUrlError, withoutTermsConsent } from "@/lib/stripe-checkout";

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
      return NextResponse.redirect(`${base}/states/colorado`, 303);
    }

    // One trial per customer: only an account that has never had a
    // subscription (no stripe_subscription_id on its profile) gets the
    // TRIAL_DAYS free days. A lapsed subscriber coming back pays from day
    // one. The rest of what Checkout is asked for, the card up front and
    // Stripe's own terms-of-service checkbox included, is in
    // src/lib/stripe-checkout.ts.
    const params = checkoutSessionParams({
      userId: access.user.id,
      email: access.user.email ?? null,
      stripeCustomerId: access.stripeCustomerId,
      firstSubscription: !access.stripeSubscriptionId,
      priceId: await getPriceId(interval),
      base,
    });

    const stripe = getStripe();
    let session;
    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (err) {
      // Stripe won't show its terms checkbox until the account has a Terms
      // of Service URL (Settings → Public details, per mode). Until that
      // is set, sell without the checkbox rather than turn everyone away;
      // the site's own disclaimer gate still stands. Loud in the logs.
      if (!isMissingTermsUrlError(err)) throw err;
      console.error(
        "stripe checkout: no Terms of Service URL set in this Stripe account (Settings → Public details); created the session without consent_collection. Set the URL to get the checkbox back."
      );
      session = await stripe.checkout.sessions.create(withoutTermsConsent(params));
    }

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
