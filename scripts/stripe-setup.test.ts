/**
 * scripts/stripe-setup-sync.ts against an in-memory stand-in for the Stripe
 * client: what `npm run stripe:setup` writes when the amounts in
 * src/lib/pricing.ts change, with and without --replace-prices. Nothing here
 * constructs a real Stripe client or makes a request.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type Stripe from "stripe";
import { PRICE_LOOKUP } from "../src/lib/pricing";
import { PORTAL_METADATA, wantedPrices } from "./stripe-setup-lib";
import { createSync } from "./stripe-setup-sync";

type FakePrice = {
  id: string;
  active: boolean;
  unit_amount: number;
  currency: string;
  recurring: { interval: string };
  product: string;
  lookup_key: string | null;
  nickname: string | null;
};

type FakePortal = {
  id: string;
  is_default: boolean;
  metadata: Record<string, string>;
  products: { product: string; prices: string[] }[];
};

/**
 * Just enough of the Stripe client for the sync: prices (list by lookup key,
 * create with transfer_lookup_key, archive), products.retrieve, and portal
 * configurations. A write to a lookup key that is already held, without
 * transfer_lookup_key, throws as Stripe does. Every write is logged in order.
 */
function fakeStripe(prices: FakePrice[], portals: FakePortal[]) {
  const writes: { op: string; id?: string; params: unknown }[] = [];
  let next = 1;
  const client = {
    prices: {
      async list(params: { lookup_keys: string[]; active: boolean }) {
        const data = prices.filter(
          (p) => p.lookup_key !== null && params.lookup_keys.includes(p.lookup_key) && p.active === params.active
        );
        return { data };
      },
      async create(params: Stripe.PriceCreateParams) {
        writes.push({ op: "prices.create", params });
        const holder = prices.find((p) => p.lookup_key === params.lookup_key);
        if (holder) {
          if (!params.transfer_lookup_key) throw new Error(`lookup key ${params.lookup_key} is already in use`);
          holder.lookup_key = null;
        }
        const price: FakePrice = {
          id: `price_new_${next++}`,
          active: true,
          unit_amount: params.unit_amount!,
          currency: params.currency,
          recurring: { interval: params.recurring!.interval },
          product: params.product as string,
          lookup_key: params.lookup_key ?? null,
          nickname: params.nickname ?? null,
        };
        prices.push(price);
        return price;
      },
      async update(id: string, params: { active?: boolean }) {
        writes.push({ op: "prices.update", id, params });
        const price = prices.find((p) => p.id === id)!;
        if (params.active !== undefined) price.active = params.active;
        return price;
      },
    },
    products: {
      async retrieve(id: string) {
        return { id, name: "EssentialRegs", deleted: undefined };
      },
      async search() {
        throw new Error("products.search should not be needed when a Price names its product");
      },
      async create() {
        throw new Error("products.create should not be needed when a Price names its product");
      },
    },
    billingPortal: {
      configurations: {
        async list() {
          return { data: portals };
        },
        async update(id: string, params: Stripe.BillingPortal.ConfigurationUpdateParams) {
          writes.push({ op: "portal.update", id, params });
          const portal = portals.find((c) => c.id === id)!;
          portal.products = (params.features?.subscription_update?.products ?? []) as FakePortal["products"];
          return portal;
        },
        async create(params: unknown) {
          writes.push({ op: "portal.create", params });
          return { id: "bpc_created" };
        },
      },
    },
  };
  return { stripe: client as unknown as Stripe, writes };
}

/** The account as the 26 Sep setup left it: $25 / $250 under the two keys, one marked portal. */
function oldAccount() {
  const prices: FakePrice[] = [
    {
      id: "price_old_month",
      active: true,
      unit_amount: 2500,
      currency: "usd",
      recurring: { interval: "month" },
      product: "prod_1",
      lookup_key: PRICE_LOOKUP.month,
      nickname: "Monthly",
    },
    {
      id: "price_old_year",
      active: true,
      unit_amount: 25000,
      currency: "usd",
      recurring: { interval: "year" },
      product: "prod_1",
      lookup_key: PRICE_LOOKUP.year,
      nickname: "Annual",
    },
  ];
  const portals: FakePortal[] = [
    {
      id: "bpc_1",
      is_default: false,
      metadata: { ...PORTAL_METADATA },
      products: [{ product: "prod_1", prices: ["price_old_month", "price_old_year"] }],
    },
  ];
  return { prices, portals };
}

async function run(stripe: Stripe, opts: { replacePrices: boolean; dryRun?: boolean }) {
  const notes: string[] = [];
  const sync = createSync(stripe, {
    dryRun: opts.dryRun ?? false,
    replacePrices: opts.replacePrices,
    site: "https://www.essentialregs.com",
    note: (line) => notes.push(line),
  });
  const { product, priceIds } = await sync.ensurePrices();
  await sync.ensurePortal(product.id, priceIds);
  return { priceIds, notes };
}

test("the copy asks Stripe for $10 / month and $100 / year (1000 and 10000 cents)", () => {
  assert.deepEqual(
    wantedPrices().map((w) => [w.lookupKey, w.cents, w.interval]),
    [
      [PRICE_LOOKUP.month, 1000, "month"],
      [PRICE_LOOKUP.year, 10000, "year"],
    ]
  );
});

test("--replace-prices: new Price per key with transfer_lookup_key, old one archived, portal gets only the new ids", async () => {
  const { prices, portals } = oldAccount();
  const { stripe, writes } = fakeStripe(prices, portals);

  const { priceIds } = await run(stripe, { replacePrices: true });

  const creates = writes.filter((w) => w.op === "prices.create").map((w) => w.params as Stripe.PriceCreateParams);
  assert.deepEqual(
    creates.map((c) => [c.lookup_key, c.unit_amount, c.recurring?.interval, c.transfer_lookup_key, c.currency, c.product]),
    [
      [PRICE_LOOKUP.month, 1000, "month", true, "usd", "prod_1"],
      [PRICE_LOOKUP.year, 10000, "year", true, "usd", "prod_1"],
    ]
  );
  const archives = writes.filter((w) => w.op === "prices.update");
  assert.deepEqual(
    archives.map((w) => [w.id, w.params]),
    [
      ["price_old_month", { active: false }],
      ["price_old_year", { active: false }],
    ]
  );
  // Each key's new Price is created before its old one is archived, so the
  // key never sits without an active Price behind it.
  const order = writes.filter((w) => w.op.startsWith("prices.")).map((w) => (w.op === "prices.create" ? "create" : w.id));
  assert.deepEqual(order, ["create", "price_old_month", "create", "price_old_year"]);

  // The keys now point at the new amounts; the old Prices are archived and keyless.
  for (const [key, cents] of [[PRICE_LOOKUP.month, 1000], [PRICE_LOOKUP.year, 10000]] as const) {
    const holders = prices.filter((p) => p.lookup_key === key);
    assert.equal(holders.length, 1);
    assert.equal(holders[0].unit_amount, cents);
    assert.equal(holders[0].active, true);
  }
  assert.ok(prices.filter((p) => p.id.startsWith("price_old_")).every((p) => !p.active && p.lookup_key === null));

  // Portal: exactly the two new ids, neither old one.
  const portalWrites = writes.filter((w) => w.op === "portal.update");
  assert.equal(portalWrites.length, 1);
  assert.equal(portalWrites[0].id, "bpc_1");
  const portalProducts = (portalWrites[0].params as Stripe.BillingPortal.ConfigurationUpdateParams).features
    ?.subscription_update?.products;
  assert.deepEqual(portalProducts, [{ product: "prod_1", prices: priceIds }]);
  assert.ok(priceIds.every((id) => id.startsWith("price_new_")));
  assert.ok(!priceIds.includes("price_old_month") && !priceIds.includes("price_old_year"));
});

test("--replace-prices is idempotent: a second run finds matching amounts and changes no Price", async () => {
  const { prices, portals } = oldAccount();
  const first = fakeStripe(prices, portals);
  const { priceIds: firstIds } = await run(first.stripe, { replacePrices: true });

  const second = fakeStripe(prices, portals);
  const { priceIds, notes } = await run(second.stripe, { replacePrices: true });

  assert.deepEqual(
    second.writes.filter((w) => w.op.startsWith("prices.")),
    [],
    "no Price created or archived on the second run"
  );
  assert.deepEqual(priceIds, firstIds);
  assert.equal(notes.filter((n) => / ok price_new_/.test(n)).length, 2);
  // The portal update is re-sent with the same ids, as on every run.
  assert.deepEqual(portals[0].products, [{ product: "prod_1", prices: firstIds }]);
});

test("without --replace-prices a changed amount stops the script and nothing is written", async () => {
  const { prices, portals } = oldAccount();
  const { stripe, writes } = fakeStripe(prices, portals);

  await assert.rejects(run(stripe, { replacePrices: false }), (err: Error) => {
    assert.match(err.message, /2 price\(s\) do not match src\/lib\/pricing\.ts/);
    assert.match(err.message, /Nothing was changed/);
    assert.match(err.message, /--replace-prices/);
    return true;
  });
  assert.deepEqual(writes, [], "no Price and no portal write");
  assert.deepEqual(portals[0].products, [{ product: "prod_1", prices: ["price_old_month", "price_old_year"] }]);
});

test("--replace-prices with --dry-run reports the replacement and writes nothing", async () => {
  const { prices, portals } = oldAccount();
  const { stripe, writes } = fakeStripe(prices, portals);

  const { notes } = await run(stripe, { replacePrices: true, dryRun: true });

  assert.deepEqual(writes, []);
  assert.ok(notes.some((n) => n.includes("would create Monthly $10.00 / month")));
  assert.ok(notes.some((n) => n.includes("would create Annual $100.00 / year")));
  assert.ok(notes.some((n) => n.includes("archive price_old_month")));
  assert.ok(notes.some((n) => n.includes("portal: would update bpc_1")));
});

test("only the key whose amount changed is replaced", async () => {
  const { prices, portals } = oldAccount();
  prices[0].unit_amount = 1000; // monthly already at the new amount
  const { stripe, writes } = fakeStripe(prices, portals);

  const { priceIds } = await run(stripe, { replacePrices: true });

  const creates = writes.filter((w) => w.op === "prices.create").map((w) => (w.params as Stripe.PriceCreateParams).lookup_key);
  assert.deepEqual(creates, [PRICE_LOOKUP.year]);
  assert.deepEqual(
    writes.filter((w) => w.op === "prices.update").map((w) => w.id),
    ["price_old_year"]
  );
  assert.equal(priceIds[0], "price_old_month");
  assert.notEqual(priceIds[1], "price_old_year");
});
