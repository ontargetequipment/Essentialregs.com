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
