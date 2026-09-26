// Display-only pricing copy. The amounts Stripe actually charges are whatever
// the Price objects behind the checkout say — these strings are NOT read from
// Stripe, so keep the two in sync by hand.
//
// Prices set by the owner on 26 Sep 2026: $25 / month or $250 / year (the
// annual plan is two months free: 12 × $25 = $300). Stripe is not configured
// yet; the Stripe workstream must create Price objects matching these two
// amounts (docs/stripe-setup.md). Update the dashboard and this file at the
// same time.
export const MONTHLY_PRICE_DISPLAY = "$25 / month";
export const ANNUAL_PRICE_DISPLAY = "$250 / year";

/** Both options in one phrase, for running text ("... is $25 / month or $250 / year"). */
export const PRICE_SUMMARY = `${MONTHLY_PRICE_DISPLAY} or ${ANNUAL_PRICE_DISPLAY}`;

/** Why annual is the better value. Factual: 12 × $25 − $250 = $50. */
export const ANNUAL_SAVINGS_NOTE = "two months free";

export const MONTHLY_PLAN_NAME = "Monthly";
export const ANNUAL_PLAN_NAME = "Annual";

/** The one plan's description: the corpus is Colorado and federal, so not "Colorado corpus". */
export const PLAN_TAGLINE = "Full corpus, updates included";
