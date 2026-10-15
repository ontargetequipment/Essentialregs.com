/**
 * The Stripe canary (src/lib/stripe-canary.ts, GET /api/health/stripe):
 * the price comparison against pricing.ts and the error → reason mapping,
 * run against a fake Stripe client. Never calls Stripe.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PRICE_LOOKUP, parsePriceDisplay, MONTHLY_PRICE_DISPLAY, ANNUAL_PRICE_DISPLAY } from "../src/lib/pricing";
import {
  classifyStripeError,
  comparePrices,
  expectedPrices,
  runStripeCanary,
  type CanaryPrice,
  type CanaryStripe,
} from "../src/lib/stripe-canary";

const MONTH_CENTS = parsePriceDisplay(MONTHLY_PRICE_DISPLAY).cents;
const YEAR_CENTS = parsePriceDisplay(ANNUAL_PRICE_DISPLAY).cents;

function price(over: Partial<CanaryPrice> & { lookup_key: string }): CanaryPrice {
  return { active: true, unit_amount: 0, currency: "usd", recurring: { interval: "month" }, ...over };
}

const GOOD: CanaryPrice[] = [
  price({ lookup_key: PRICE_LOOKUP.month, unit_amount: MONTH_CENTS, recurring: { interval: "month" } }),
  price({ lookup_key: PRICE_LOOKUP.year, unit_amount: YEAR_CENTS, recurring: { interval: "year" } }),
];

/** A fake client that records its calls and answers (or throws) as told. */
function fakeStripe(opts: { prices?: CanaryPrice[]; pricesError?: unknown; customersError?: unknown } = {}) {
  const calls: string[] = [];
  const client: CanaryStripe = {
    prices: {
      async list(params) {
        calls.push(`prices.list ${params.lookup_keys.join(",")} active=${params.active}`);
        if (opts.pricesError) throw opts.pricesError;
        return { data: opts.prices ?? GOOD };
      },
    },
    customers: {
      async list(params) {
        calls.push(`customers.list limit=${params.limit}`);
        if (opts.customersError) throw opts.customersError;
        return { data: [] };
      },
    },
  };
  return { client, calls };
}

const fixedNow = () => new Date("2026-10-15T13:00:00.000Z");

test("expectedPrices reads the amounts from the pricing.ts display strings", () => {
  const e = expectedPrices();
  assert.deepEqual(e.month, { lookupKey: PRICE_LOOKUP.month, cents: MONTH_CENTS, interval: "month" });
  assert.deepEqual(e.year, { lookupKey: PRICE_LOOKUP.year, cents: YEAR_CENTS, interval: "year" });
  // Pinned to today's copy ($10 / $100) so a silent change of either is noticed.
  assert.equal(MONTH_CENTS, 1000);
  assert.equal(YEAR_CENTS, 10000);
});

test("comparePrices: both keys at the right amount and interval match", () => {
  assert.equal(comparePrices(GOOD), null);
});

test("comparePrices: a missing or inactive key is price_missing", () => {
  assert.equal(comparePrices([GOOD[0]]), "price_missing");
  assert.equal(comparePrices([GOOD[1]]), "price_missing");
  assert.equal(comparePrices([]), "price_missing");
  assert.equal(comparePrices([GOOD[0], { ...GOOD[1], active: false }]), "price_missing");
});

test("comparePrices: wrong amount, interval or currency, or two Prices on one key, is price_mismatch", () => {
  // The old $25 / $250 Prices still holding the keys.
  assert.equal(comparePrices([{ ...GOOD[0], unit_amount: 2500 }, GOOD[1]]), "price_mismatch");
  assert.equal(comparePrices([GOOD[0], { ...GOOD[1], unit_amount: 25000 }]), "price_mismatch");
  assert.equal(comparePrices([GOOD[0], { ...GOOD[1], recurring: { interval: "month" } }]), "price_mismatch");
  assert.equal(comparePrices([GOOD[0], { ...GOOD[1], recurring: null }]), "price_mismatch");
  assert.equal(comparePrices([{ ...GOOD[0], unit_amount: null }, GOOD[1]]), "price_mismatch");
  assert.equal(comparePrices([{ ...GOOD[0], currency: "cad" }, GOOD[1]]), "price_mismatch");
  assert.equal(comparePrices([...GOOD, { ...GOOD[0], unit_amount: 2500 }]), "price_mismatch");
});

test("classifyStripeError maps Stripe error types to reason codes", () => {
  assert.equal(classifyStripeError({ type: "StripeAuthenticationError", message: "Expired API Key provided: sk_live_****" }), "auth");
  assert.equal(classifyStripeError({ type: "StripePermissionError" }), "permission");
  assert.equal(classifyStripeError({ type: "StripeConnectionError" }), "stripe_unreachable");
  assert.equal(classifyStripeError({ type: "StripeAPIError" }), "stripe_unreachable");
  assert.equal(classifyStripeError(new Error("boom")), "stripe_unreachable");
  assert.equal(classifyStripeError(undefined), "stripe_unreachable");
});

test("runStripeCanary: healthy key → ok, and only the two read calls are made", async () => {
  const { client, calls } = fakeStripe();
  assert.deepEqual(await runStripeCanary(client, fixedNow), { ok: true, checkedAt: "2026-10-15T13:00:00.000Z" });
  assert.deepEqual(calls, [
    `prices.list ${PRICE_LOOKUP.month},${PRICE_LOOKUP.year} active=true`,
    "customers.list limit=1",
  ]);
});

test("runStripeCanary: no key → misconfigured, without calling anything", async () => {
  assert.deepEqual(await runStripeCanary(null, fixedNow), { ok: false, reason: "misconfigured", checkedAt: "2026-10-15T13:00:00.000Z" });
});

test("runStripeCanary: an expired key → auth, and the result carries no message or key text", async () => {
  const err = Object.assign(new Error("Expired API Key provided: sk_live_****abcd"), { type: "StripeAuthenticationError" });
  const { client, calls } = fakeStripe({ pricesError: err });
  const result = await runStripeCanary(client, fixedNow);
  assert.deepEqual(result, { ok: false, reason: "auth", checkedAt: "2026-10-15T13:00:00.000Z" });
  assert.doesNotMatch(JSON.stringify(result), /sk_|Expired/);
  assert.equal(calls.length, 1);
});

test("runStripeCanary: price drift stops before the customer call", async () => {
  const { client, calls } = fakeStripe({ prices: [GOOD[0], { ...GOOD[1], unit_amount: 25000 }] });
  assert.deepEqual(await runStripeCanary(client, fixedNow), { ok: false, reason: "price_mismatch", checkedAt: "2026-10-15T13:00:00.000Z" });
  assert.equal(calls.filter((c) => c.startsWith("customers")).length, 0);
});

test("runStripeCanary: missing Price → price_missing", async () => {
  const { client } = fakeStripe({ prices: [GOOD[1]] });
  assert.deepEqual(await runStripeCanary(client, fixedNow), { ok: false, reason: "price_missing", checkedAt: "2026-10-15T13:00:00.000Z" });
});

test("runStripeCanary: a restricted key without Customer read → permission", async () => {
  const { client } = fakeStripe({ customersError: { type: "StripePermissionError", message: "The provided key 'rk_live_****' does not have access" } });
  assert.deepEqual(await runStripeCanary(client, fixedNow), { ok: false, reason: "permission", checkedAt: "2026-10-15T13:00:00.000Z" });
});

test("runStripeCanary: Stripe down → stripe_unreachable", async () => {
  const { client } = fakeStripe({ pricesError: { type: "StripeConnectionError" } });
  assert.deepEqual(await runStripeCanary(client, fixedNow), { ok: false, reason: "stripe_unreachable", checkedAt: "2026-10-15T13:00:00.000Z" });
});
