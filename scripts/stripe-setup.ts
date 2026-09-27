/**
 * One-shot, re-runnable Stripe setup: makes sure the Stripe account behind
 * STRIPE_SECRET_KEY has the product and the two recurring Prices the
 * checkout sells, found by the lookup keys in src/lib/pricing.ts
 * (PRICE_LOOKUP) with the amounts in the display strings there.
 *
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
 *   npx tsx --env-file=.env.local scripts/stripe-setup.ts   (same, reading the key from .env.local)
 *
 * Run it once with a test-mode key and once with the live key (docs/
 * stripe-setup.md, step 1). Safe to repeat: an existing Price with the right
 * amount and interval is left alone and reported.
 *
 * Flags:
 *   --dry-run   print what would change and exit without writing anything
 *   --replace   when a Price under a lookup key has the wrong amount or
 *               interval (the copy in pricing.ts changed), create a new
 *               Price with those values, move the lookup key onto it and
 *               archive the old one. Existing subscriptions stay on the old
 *               Price; only new checkouts see the new amount.
 *
 * Nothing here touches the database or the site; the checkout route finds
 * the Prices at request time (src/lib/stripe-prices.ts).
 */
import Stripe from "stripe";
import {
  PLAN_NAMES,
  PLAN_TAGLINE,
  PRICE_DISPLAY,
  PRICE_LOOKUP,
  parsePriceDisplay,
  type BillingInterval,
} from "../src/lib/pricing";

const PRODUCT_NAME = "EssentialRegs";
/** Marks the product this script owns, so a rename in the dashboard doesn't lose it. */
const PRODUCT_METADATA_KEY = "essentialregs_product";
const PRODUCT_METADATA_VALUE = "individual";

const INTERVALS = Object.keys(PRICE_LOOKUP) as BillingInterval[];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const replace = args.has("--replace");
for (const a of args) {
  if (a !== "--dry-run" && a !== "--replace") {
    console.error(`Unknown flag ${a}. Flags: --dry-run, --replace`);
    process.exit(2);
  }
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY is not set. Run as\n" +
      "  STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup\n" +
      "or, with the key in .env.local,\n" +
      "  npx tsx --env-file=.env.local scripts/stripe-setup.ts"
  );
  process.exit(2);
}
const mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "LIVE" : "test";
const stripe = new Stripe(key, { appInfo: { name: "EssentialRegs setup script" } });

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function describe(price: Stripe.Price): string {
  const amount = price.unit_amount === null ? "(no unit amount)" : money(price.unit_amount);
  const interval = price.recurring?.interval ?? "(one-time)";
  return `${price.id} ${amount} / ${interval}${price.active ? "" : " (archived)"}`;
}

async function findPriceByLookupKey(lookupKey: string): Promise<Stripe.Price | null> {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return data[0] ?? null;
}

async function findOrCreateProduct(hint: Stripe.Price | null): Promise<Stripe.Product> {
  // 1. The product an existing price already hangs off.
  if (hint) {
    const id = typeof hint.product === "string" ? hint.product : hint.product.id;
    const product = await stripe.products.retrieve(id);
    if (!product.deleted) return product;
  }
  // 2. The product this script created before (metadata marker).
  const marked = await stripe.products.search({
    query: `active:'true' AND metadata['${PRODUCT_METADATA_KEY}']:'${PRODUCT_METADATA_VALUE}'`,
    limit: 1,
  });
  if (marked.data[0]) return marked.data[0];
  // 3. A product made by hand in the dashboard with the expected name.
  const named = await stripe.products.search({
    query: `active:'true' AND name:'${PRODUCT_NAME}'`,
    limit: 1,
  });
  if (named.data[0]) {
    console.log(`Product: using existing "${named.data[0].name}" (${named.data[0].id}) found by name`);
    return named.data[0];
  }

  console.log(`Product: ${dryRun ? "would create" : "creating"} "${PRODUCT_NAME}"`);
  if (dryRun) {
    return { id: "prod_DRYRUN", name: PRODUCT_NAME } as Stripe.Product;
  }
  return stripe.products.create({
    name: PRODUCT_NAME,
    description: PLAN_TAGLINE,
    metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
  });
}

async function createPrice(
  product: Stripe.Product,
  interval: BillingInterval,
  cents: number,
  transferLookupKey: boolean
): Promise<Stripe.Price | null> {
  const lookupKey = PRICE_LOOKUP[interval];
  const label = `${PLAN_NAMES[interval]} ${money(cents)} / ${interval} (lookup key ${lookupKey})`;
  if (dryRun) {
    console.log(`  would create ${label}`);
    return null;
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: cents,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: transferLookupKey,
    nickname: PLAN_NAMES[interval],
  });
  console.log(`  created ${describe(price)} as ${label}`);
  return price;
}

async function main() {
  console.log(`Stripe ${mode} mode${dryRun ? " (dry run: nothing will be written)" : ""}`);
  if (mode === "LIVE" && !dryRun) {
    console.log("This is the LIVE account: Prices created here can be sold for real money.");
  }

  const wanted = INTERVALS.map((interval) => {
    const parsed = parsePriceDisplay(PRICE_DISPLAY[interval]);
    if (parsed.interval !== interval) {
      throw new Error(
        `pricing.ts: PRICE_DISPLAY.${interval} is "${PRICE_DISPLAY[interval]}", which is not a per-${interval} price.`
      );
    }
    return { interval, cents: parsed.cents, lookupKey: PRICE_LOOKUP[interval] };
  });

  const existing = new Map<BillingInterval, Stripe.Price | null>();
  for (const w of wanted) existing.set(w.interval, await findPriceByLookupKey(w.lookupKey));

  const product = await findOrCreateProduct([...existing.values()].find((p) => p) ?? null);
  console.log(`Product: "${product.name}" (${product.id})`);

  let problems = 0;
  for (const w of wanted) {
    const current = existing.get(w.interval) ?? null;
    console.log(`${PLAN_NAMES[w.interval]} (${w.lookupKey}): want ${money(w.cents)} / ${w.interval}`);

    if (!current) {
      await createPrice(product, w.interval, w.cents, false);
      continue;
    }

    const matches =
      current.unit_amount === w.cents &&
      current.currency === "usd" &&
      current.recurring?.interval === w.interval &&
      (typeof current.product === "string" ? current.product : current.product.id) === product.id;
    if (matches) {
      console.log(`  ok: ${describe(current)}`);
      continue;
    }

    console.log(`  MISMATCH: lookup key is on ${describe(current)}`);
    if (!replace) {
      problems += 1;
      console.log(
        "  Either change src/lib/pricing.ts back to match Stripe, or re-run with --replace to\n" +
          "  create a Price at the new amount, move the lookup key to it and archive this one."
      );
      continue;
    }
    const created = await createPrice(product, w.interval, w.cents, true);
    if (created) {
      await stripe.prices.update(current.id, { active: false });
      console.log(`  archived ${current.id}`);
    } else {
      console.log(`  would move lookup key ${w.lookupKey} to the new Price and archive ${current.id}`);
    }
  }

  if (problems) {
    console.error(`\n${problems} price(s) do not match src/lib/pricing.ts. Nothing was changed for them.`);
    process.exit(1);
  }
  console.log(
    dryRun
      ? "\nDry run finished."
      : `\nDone. The checkout resolves these by lookup key; no Price id needs to go into Vercel.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
