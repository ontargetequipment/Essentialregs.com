import type Stripe from "stripe";
import { TRIAL_DAYS } from "@/lib/pricing";

/**
 * The pure part of POST /api/stripe/checkout: what the Checkout Session is
 * asked for, given who is subscribing. No Stripe client, no request; the
 * route (src/app/api/stripe/checkout/route.ts) resolves the price id and
 * the account first, then calls Stripe with what this returns.
 * scripts/stripe-billing.test.ts pins it down.
 */
export type CheckoutInput = {
  /** Supabase user id; rides along so the webhook can find the profile. */
  userId: string;
  /** The account's email, for a customer Checkout creates itself. */
  email: string | null;
  /** Existing Stripe customer (a lapsed subscriber coming back), if any. */
  stripeCustomerId: string | null;
  /** True when this account has never had a subscription: the one free trial. */
  firstSubscription: boolean;
  /** The Stripe Price for the chosen interval (src/lib/stripe-prices.ts). */
  priceId: string;
  /** Site origin without a trailing slash, for the success/cancel URLs. */
  base: string;
};

/**
 * Checkout collects a card up front (payment_method_collection "always"),
 * so Stripe charges it itself when the trial ends — trial_settings'
 * end_behavior only applies when no card was collected, so it is left out.
 *
 * consent_collection makes Stripe show its own "I agree to the terms of
 * service" checkbox, a second layer under the site's disclaimer gate
 * (owner, 28 Sep 2026). Stripe only allows it once a Terms of Service URL
 * is set under Settings → Public details, in each mode; see
 * withoutTermsConsent for what the route does until then.
 */
export function checkoutSessionParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    payment_method_collection: "always",
    // Reuse the Stripe customer if this account has one, otherwise let
    // Checkout create one keyed to the account's email.
    ...(input.stripeCustomerId
      ? { customer: input.stripeCustomerId }
      : { customer_email: input.email ?? undefined }),
    // Both of these carry the Supabase user id back to us: the webhook
    // reads client_reference_id off checkout.session.completed, and the
    // subscription metadata survives on every later subscription event.
    client_reference_id: input.userId,
    subscription_data: {
      metadata: { supabase_user_id: input.userId },
      ...(input.firstSubscription ? { trial_period_days: TRIAL_DAYS } : {}),
    },
    consent_collection: { terms_of_service: "required" },
    success_url: `${input.base}/account?checkout=success`,
    cancel_url: `${input.base}/pricing`,
    allow_promotion_codes: true,
  };
}

/** The same params with the terms-of-service checkbox left off. */
export function withoutTermsConsent(
  params: Stripe.Checkout.SessionCreateParams
): Stripe.Checkout.SessionCreateParams {
  const { consent_collection: _dropped, ...rest } = params;
  void _dropped;
  return rest;
}

/** The fields of a Stripe error this decision reads. */
export type StripeErrorLike = { type?: string; param?: string; message?: string };

/**
 * True when Stripe refused the session because the account has no Terms
 * of Service URL yet (Settings → Public details), which is the one
 * `consent_collection` precondition the site can't satisfy from code. The
 * route then creates the session without the checkbox rather than turning
 * every subscription away, and logs it so the URL gets set.
 */
export function isMissingTermsUrlError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { type, param, message } = err as StripeErrorLike;
  if (type !== "StripeInvalidRequestError") return false;
  if (param?.startsWith("consent_collection")) return true;
  return typeof message === "string" && /terms[ _]of[ _]service/i.test(message);
}
