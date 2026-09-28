/**
 * The pure pieces of the Stripe billing wiring in src/lib/pricing.ts: the
 * form-field parser the checkout route trusts, the lookup-key → plan-name
 * mapping the account page shows, and the display-string → cents parse
 * scripts/stripe-setup.ts uses to create the Prices. Also pins the two
 * amounts and the "two months free" arithmetic to the copy.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANNUAL_PLAN_NAME,
  ANNUAL_PRICE_DISPLAY,
  ANNUAL_SAVINGS_NOTE,
  MONTHLY_PLAN_NAME,
  MONTHLY_PRICE_DISPLAY,
  PRICE_DISPLAY,
  PRICE_LOOKUP,
  TRIAL_DAYS,
  parseBillingInterval,
  parsePriceDisplay,
  planDisplayName,
} from "../src/lib/pricing";

test("parseBillingInterval accepts exactly month and year", () => {
  assert.equal(parseBillingInterval("month"), "month");
  assert.equal(parseBillingInterval("year"), "year");
  for (const bad of ["", "Month", "annual", "monthly", "week", null, undefined, 1, ["year"]]) {
    assert.equal(parseBillingInterval(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("planDisplayName maps lookup keys to plan names and passes anything else through", () => {
  assert.equal(planDisplayName(PRICE_LOOKUP.month), MONTHLY_PLAN_NAME);
  assert.equal(planDisplayName(PRICE_LOOKUP.year), ANNUAL_PLAN_NAME);
  assert.equal(planDisplayName("price_123"), "price_123");
  assert.equal(planDisplayName("Yearly"), "Yearly");
  assert.equal(planDisplayName(null), null);
});

test("parsePriceDisplay reads the two display strings", () => {
  assert.deepEqual(parsePriceDisplay(MONTHLY_PRICE_DISPLAY), { cents: 2500, interval: "month" });
  assert.deepEqual(parsePriceDisplay(ANNUAL_PRICE_DISPLAY), { cents: 25000, interval: "year" });
  assert.deepEqual(parsePriceDisplay("$19.50 / month"), { cents: 1950, interval: "month" });
  assert.throws(() => parsePriceDisplay("$25 a month"));
  assert.throws(() => parsePriceDisplay("25 / month"));
  assert.throws(() => parsePriceDisplay("$25 / week"));
});

test("PRICE_DISPLAY intervals agree with their strings and the annual price is two months free", () => {
  for (const interval of Object.keys(PRICE_LOOKUP) as (keyof typeof PRICE_LOOKUP)[]) {
    assert.equal(parsePriceDisplay(PRICE_DISPLAY[interval]).interval, interval);
  }
  const monthly = parsePriceDisplay(MONTHLY_PRICE_DISPLAY).cents;
  const annual = parsePriceDisplay(ANNUAL_PRICE_DISPLAY).cents;
  assert.equal(12 * monthly - annual, 2 * monthly, `ANNUAL_SAVINGS_NOTE says "${ANNUAL_SAVINGS_NOTE}"`);
});

test("lookup keys are distinct, stable identifiers and the trial is a whole number of days", () => {
  assert.notEqual(PRICE_LOOKUP.month, PRICE_LOOKUP.year);
  for (const key of Object.values(PRICE_LOOKUP)) assert.match(key, /^[a-z_]+$/);
  assert.ok(Number.isInteger(TRIAL_DAYS) && TRIAL_DAYS > 0);
});

// --- scripts/stripe-setup-lib.ts: the decisions the setup script makes ------
// Pure functions only; nothing here constructs a Stripe client or makes a
// request. The Stripe objects are hand-built stand-ins with the fields the
// decisions read.

import {
  DEFAULT_SITE,
  WEBHOOK_EVENTS,
  checkMode,
  decidePrice,
  PORTAL_METADATA,
  parseArgs,
  portalParams,
  portalReturnUrl,
  wantedPrices,
  webhookEventsMatch,
  webhookUrl,
  type ExistingPrice,
} from "./stripe-setup-lib";

test("checkMode: a live key needs --live and a test key refuses it", () => {
  assert.deepEqual(checkMode("sk_test_abc", false), { mode: "test" });
  assert.deepEqual(checkMode("sk_live_abc", true), { mode: "live" });
  assert.deepEqual(checkMode("rk_live_abc", true), { mode: "live" });

  const liveWithoutFlag = checkMode("sk_live_abc", false);
  assert.ok("error" in liveWithoutFlag && /--live/.test(liveWithoutFlag.error));
  const testWithFlag = checkMode("sk_test_abc", true);
  assert.ok("error" in testWithFlag && /test key/.test(testWithFlag.error));
  const missing = checkMode(undefined, false);
  assert.ok("error" in missing && /STRIPE_SECRET_KEY is not set/.test(missing.error));
  const garbage = checkMode("pk_test_notasecret", false);
  assert.ok("error" in garbage);
});

const annual = wantedPrices().find((w) => w.interval === "year")!;
const monthly = wantedPrices().find((w) => w.interval === "month")!;

function stripePrice(over: Partial<ExistingPrice> = {}): ExistingPrice {
  return {
    id: "price_existing",
    unit_amount: annual.cents,
    currency: "usd",
    recurring: { interval: "year" },
    product: "prod_1",
    ...over,
  };
}

test("decidePrice: no Price under the key → create", () => {
  assert.deepEqual(decidePrice(null, annual, "prod_1", false), { action: "create" });
  assert.deepEqual(decidePrice(null, annual, "prod_1", true), { action: "create" });
});

test("decidePrice: a matching Price is kept, whether product is an id or an expanded object", () => {
  assert.deepEqual(decidePrice(stripePrice(), annual, "prod_1", false), { action: "keep" });
  assert.deepEqual(decidePrice(stripePrice({ product: { id: "prod_1" } }), annual, "prod_1", true), { action: "keep" });
});

test("decidePrice: an existing Price with a different amount is a mismatch, or a replace with --replace", () => {
  const repriced = stripePrice({ unit_amount: annual.cents + 500 });
  assert.deepEqual(decidePrice(repriced, annual, "prod_1", false), { action: "mismatch", oldId: "price_existing" });
  assert.deepEqual(decidePrice(repriced, annual, "prod_1", true), { action: "replace", oldId: "price_existing" });
});

test("decidePrice: interval, currency and product differences count as mismatches too", () => {
  assert.equal(decidePrice(stripePrice({ recurring: { interval: "month" } }), annual, "prod_1", false).action, "mismatch");
  assert.equal(decidePrice(stripePrice({ recurring: null }), annual, "prod_1", false).action, "mismatch");
  assert.equal(decidePrice(stripePrice({ currency: "cad" }), annual, "prod_1", false).action, "mismatch");
  assert.equal(decidePrice(stripePrice({ product: "prod_other" }), annual, "prod_1", false).action, "mismatch");
  assert.equal(decidePrice(stripePrice({ unit_amount: null }), annual, "prod_1", false).action, "mismatch");
  // The monthly key holding the annual amount is wrong even though both are ours.
  assert.equal(decidePrice(stripePrice(), monthly, "prod_1", false).action, "mismatch");
});

test("parseArgs: flags, --site normalisation and rejection of anything else", () => {
  assert.deepEqual(parseArgs([]), { dryRun: false, replace: false, live: false, site: DEFAULT_SITE });
  assert.deepEqual(parseArgs(["--dry-run", "--replace", "--live"]), {
    dryRun: true,
    replace: true,
    live: true,
    site: DEFAULT_SITE,
  });
  assert.equal(parseArgs(["--site", "https://preview.example.com/"]).site, "https://preview.example.com");
  assert.equal(parseArgs(["--site=https://preview.example.com"]).site, "https://preview.example.com");
  assert.throws(() => parseArgs(["--bogus"]), /Unknown flag --bogus/);
  assert.throws(() => parseArgs(["--site"]), /--site needs an origin/);
  assert.throws(() => parseArgs(["--site", "http://insecure.example.com"]), /https origin/);
  assert.throws(() => parseArgs(["--site", "https://example.com/path"]), /https origin/);
  assert.throws(() => parseArgs(["--site", "not a url"]), /not a URL/);
});

test("webhook and portal URLs derive from --site, and the event list is exact", () => {
  assert.equal(webhookUrl(DEFAULT_SITE), "https://www.essentialregs.com/api/stripe/webhook");
  assert.equal(portalReturnUrl(DEFAULT_SITE), "https://www.essentialregs.com/account");
  assert.ok(webhookEventsMatch([...WEBHOOK_EVENTS]));
  assert.ok(webhookEventsMatch([...WEBHOOK_EVENTS].reverse()));
  assert.ok(!webhookEventsMatch([...WEBHOOK_EVENTS, "invoice.paid"]));
  assert.ok(!webhookEventsMatch(WEBHOOK_EVENTS.slice(1)));
  assert.ok(!webhookEventsMatch(["*"]));
});

test("portalParams: cancel at period end, downgrades scheduled for period end, upgrades prorated", () => {
  const params = portalParams(DEFAULT_SITE, "prod_1", ["price_m", "price_y"]);
  assert.equal(params.default_return_url, "https://www.essentialregs.com/account");
  assert.deepEqual(params.metadata, PORTAL_METADATA);
  assert.deepEqual(params.business_profile, { headline: "EssentialRegs" });

  const f = params.features!;
  assert.deepEqual(f.invoice_history, { enabled: true });
  assert.deepEqual(f.payment_method_update, { enabled: true });
  assert.deepEqual(f.subscription_cancel, { enabled: true, mode: "at_period_end" });

  const update = f.subscription_update!;
  assert.equal(update.enabled, true);
  assert.deepEqual(update.default_allowed_updates, ["price"]);
  assert.equal(update.proration_behavior, "create_prorations");
  // Owner decision (27 Sep 2026): annual → monthly waits for the paid year to
  // end; both ways Stripe can express "downgrade" are listed.
  assert.deepEqual(update.schedule_at_period_end, {
    conditions: [{ type: "shortening_interval" }, { type: "decreasing_item_amount" }],
  });
  assert.deepEqual(update.products, [{ product: "prod_1", prices: ["price_m", "price_y"] }]);
});

// --- src/lib/stripe-checkout.ts: what the checkout route asks Stripe for ---

import { checkoutSessionParams, isMissingTermsUrlError, withoutTermsConsent } from "../src/lib/stripe-checkout";

const newSubscriber = {
  userId: "user_1",
  email: "new@example.com",
  stripeCustomerId: null,
  firstSubscription: true,
  priceId: "price_y",
  base: "https://www.essentialregs.com",
};

test("checkoutSessionParams: a first subscription gets the trial, a card up front and Stripe's terms checkbox", () => {
  const params = checkoutSessionParams(newSubscriber);
  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.line_items, [{ price: "price_y", quantity: 1 }]);
  assert.equal(params.payment_method_collection, "always");
  assert.equal(params.customer_email, "new@example.com");
  assert.equal(params.customer, undefined);
  assert.equal(params.client_reference_id, "user_1");
  assert.deepEqual(params.subscription_data, {
    metadata: { supabase_user_id: "user_1" },
    trial_period_days: TRIAL_DAYS,
  });
  // Owner decision (28 Sep 2026): Stripe's own "I agree to the terms"
  // checkbox as a second layer under the site's disclaimer gate.
  assert.deepEqual(params.consent_collection, { terms_of_service: "required" });
  assert.equal(params.success_url, "https://www.essentialregs.com/account?checkout=success");
  assert.equal(params.cancel_url, "https://www.essentialregs.com/pricing");
  assert.equal(params.allow_promotion_codes, true);
  // Left out on purpose: with a card collected, Stripe charges it itself.
  assert.equal("trial_settings" in (params.subscription_data ?? {}), false);
});

test("checkoutSessionParams: a returning subscriber reuses the customer and gets no trial", () => {
  const params = checkoutSessionParams({
    ...newSubscriber,
    stripeCustomerId: "cus_1",
    firstSubscription: false,
  });
  assert.equal(params.customer, "cus_1");
  assert.equal(params.customer_email, undefined);
  assert.deepEqual(params.subscription_data, { metadata: { supabase_user_id: "user_1" } });
  assert.deepEqual(params.consent_collection, { terms_of_service: "required" });
});

test("withoutTermsConsent drops only the checkbox", () => {
  const params = checkoutSessionParams(newSubscriber);
  const fallback = withoutTermsConsent(params);
  assert.equal("consent_collection" in fallback, false);
  const { consent_collection: _c, ...rest } = params;
  void _c;
  assert.deepEqual(fallback, rest);
  // The original is untouched.
  assert.deepEqual(params.consent_collection, { terms_of_service: "required" });
});

test("isMissingTermsUrlError recognises Stripe's refusal and nothing else", () => {
  assert.ok(
    isMissingTermsUrlError({
      type: "StripeInvalidRequestError",
      param: "consent_collection[terms_of_service]",
      message: "You must set a terms of service URL before collecting consent.",
    })
  );
  assert.ok(isMissingTermsUrlError({ type: "StripeInvalidRequestError", param: "consent_collection" }));
  assert.ok(
    isMissingTermsUrlError({
      type: "StripeInvalidRequestError",
      message: "In order to collect consent for your Terms of Service, you must set a URL in the Dashboard.",
    })
  );
  // A different invalid request, a different error class, or no error at all.
  assert.ok(!isMissingTermsUrlError({ type: "StripeInvalidRequestError", param: "line_items[0][price]", message: "No such price" }));
  assert.ok(!isMissingTermsUrlError({ type: "StripeCardError", param: "consent_collection", message: "terms of service" }));
  assert.ok(!isMissingTermsUrlError({ type: "StripeAPIError", message: "terms of service" }));
  assert.ok(!isMissingTermsUrlError(new Error("terms of service")));
  assert.ok(!isMissingTermsUrlError(null));
  assert.ok(!isMissingTermsUrlError("terms of service"));
});
