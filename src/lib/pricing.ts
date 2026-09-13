// Display-only pricing copy. The amount Stripe actually charges is whatever
// the Price behind STRIPE_PRICE_ID_ANNUAL says — this string is NOT read
// from Stripe, so keep the two in sync by hand.
//
// PLACEHOLDER: $299 / year is a stand-in until the real annual Price is
// created in the Stripe dashboard (docs/stripe-setup.md). Update it there
// and here at the same time.
export const ANNUAL_PRICE_DISPLAY = "$299 / year";

export const ANNUAL_PLAN_NAME = "Annual";
export const ANNUAL_PLAN_TAGLINE =
  "Full Colorado corpus, updates included";
