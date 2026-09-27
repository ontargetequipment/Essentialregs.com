// Display-only pricing copy. The amounts Stripe actually charges are whatever
// the Price objects behind the checkout say — these strings are NOT read from
// Stripe, so keep the two in sync by hand.
//
// Prices set by the owner on 26 Sep 2026: $25 / month or $250 / year (the
// annual plan is two months free: 12 × $25 = $300). The checkout finds the
// matching Stripe Price objects by lookup key (PRICE_LOOKUP below; created by
// `npm run stripe:setup`, see docs/stripe-setup.md). Change the amount in the
// Stripe dashboard and in this file at the same time.
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

/**
 * Stripe Price lookup keys, one per billing interval. The checkout route
 * resolves these to `price_...` ids at request time (src/lib/stripe-prices.ts)
 * so no Price id lives in an environment variable, and test and live mode
 * can each carry their own Price under the same key. The webhook stores the
 * key on `profiles.plan`, so PLAN_NAMES below turns it back into copy.
 */
export const PRICE_LOOKUP = {
  month: "individual_monthly",
  year: "individual_annual",
} as const;

export type BillingInterval = keyof typeof PRICE_LOOKUP;

/** Length of the card-up-front free trial a first-time subscriber gets at checkout. */
export const TRIAL_DAYS = 7;

/**
 * The Stripe amount behind a display string: "$25 / month" → 2500 cents,
 * interval "month". This is how scripts/stripe-setup.ts turns the copy above
 * into Price objects, so the copy stays the single place an amount is typed.
 */
export function parsePriceDisplay(display: string): { cents: number; interval: BillingInterval } {
  const m = /^\$(\d+)(?:\.(\d{2}))?\s*\/\s*(month|year)$/.exec(display.trim());
  if (!m) {
    throw new Error(`Price display "${display}" is not "$<amount> / month|year".`);
  }
  const cents = Number(m[1]) * 100 + (m[2] ? Number(m[2]) : 0);
  return { cents, interval: m[3] as BillingInterval };
}

/** Display string per interval, for code that starts from a BillingInterval. */
export const PRICE_DISPLAY: Record<BillingInterval, string> = {
  month: MONTHLY_PRICE_DISPLAY,
  year: ANNUAL_PRICE_DISPLAY,
};

/** Plan name to show for each lookup key (profiles.plan). */
export const PLAN_NAMES: Record<BillingInterval, string> = {
  month: MONTHLY_PLAN_NAME,
  year: ANNUAL_PLAN_NAME,
};

/**
 * Validate a billing interval from untrusted input (a form field). Returns
 * null for anything that isn't exactly "month" or "year".
 */
export function parseBillingInterval(value: unknown): BillingInterval | null {
  return value === "month" || value === "year" ? value : null;
}

/**
 * Human name for the value the webhook stored in profiles.plan: a lookup key
 * from PRICE_LOOKUP maps to its plan name; a legacy nickname or raw Price id
 * (subscriptions created before lookup keys existed) is shown as is.
 */
export function planDisplayName(plan: string | null): string | null {
  if (!plan) return null;
  for (const interval of Object.keys(PRICE_LOOKUP) as BillingInterval[]) {
    if (PRICE_LOOKUP[interval] === plan) return PLAN_NAMES[interval];
  }
  return plan;
}
