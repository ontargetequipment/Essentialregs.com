import { NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { getPortalConfigurationId } from "@/lib/stripe-portal";
import { getAccessStatus } from "@/lib/access";

export const runtime = "nodejs";

// POST /api/stripe/portal — open the Stripe Customer Portal (update card,
// cancel, download invoices) for the logged-in user's Stripe customer.
export async function POST() {
  const access = await getAccessStatus();
  if (!access.user) {
    return NextResponse.json({ error: "Log in to manage billing." }, { status: 401 });
  }
  if (!access.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet — subscribe first." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const configuration = await getPortalConfigurationId();
    const session = await stripe.billingPortal.sessions.create({
      customer: access.stripeCustomerId,
      return_url: `${siteUrl()}/account`,
      // The configuration scripts/stripe-setup.ts set up (cancel at period
      // end, switch between the two prices); undefined = account default.
      ...(configuration ? { configuration } : {}),
    });
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("stripe portal: failed to create session", err);
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Please try again in a moment." },
      { status: 500 }
    );
  }
}
