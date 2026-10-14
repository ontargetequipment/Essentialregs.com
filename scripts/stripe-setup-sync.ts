/**
 * The Stripe-facing half of scripts/stripe-setup.ts: the product, its two
 * Prices and the Customer Portal configuration. Takes the Stripe client as an
 * argument so scripts/stripe-setup.test.ts can drive it with a mock and check
 * what would be written without ever calling Stripe. The decisions themselves
 * are pure and live in stripe-setup-lib.ts.
 */
import type Stripe from "stripe";
import { PLAN_TAGLINE } from "../src/lib/pricing";
import { PORTAL_METADATA, decidePrice, portalParams, wantedPrices, type WantedPrice } from "./stripe-setup-lib";

const PRODUCT_NAME = "EssentialRegs";
/** Marks the product this script owns, so a rename in the dashboard doesn't lose it. */
const PRODUCT_METADATA_KEY = "essentialregs_product";
const PRODUCT_METADATA_VALUE = "individual";

export type SyncOptions = {
  dryRun: boolean;
  /** --replace-prices: move a lookup key whose Price has the wrong amount onto a new Price. */
  replacePrices: boolean;
  site: string;
  /** Where each decision is reported (stdout and the local report file). */
  note: (line: string) => void;
};

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function describe(price: Stripe.Price): string {
  const amount = price.unit_amount === null ? "(no unit amount)" : money(price.unit_amount);
  const interval = price.recurring?.interval ?? "(one-time)";
  return `${price.id} ${amount} / ${interval}${price.active ? "" : " (archived)"}`;
}

export function createSync(stripe: Stripe, { dryRun, replacePrices, site, note }: SyncOptions) {
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
    if (named.data[0]) return named.data[0];

    if (dryRun) {
      note(`product: would create "${PRODUCT_NAME}"`);
      return { id: "prod_DRYRUN", name: PRODUCT_NAME } as Stripe.Product;
    }
    const created = await stripe.products.create({
      name: PRODUCT_NAME,
      description: PLAN_TAGLINE,
      metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
    });
    note(`product: created ${created.id} "${created.name}"`);
    return created;
  }

  async function createPrice(product: Stripe.Product, w: WantedPrice, transferLookupKey: boolean): Promise<string> {
    const label = `${w.name} ${money(w.cents)} / ${w.interval} (lookup key ${w.lookupKey})`;
    if (dryRun) {
      note(`price ${w.lookupKey}: would create ${label}`);
      return `price_DRYRUN_${w.interval}`;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: w.cents,
      recurring: { interval: w.interval },
      lookup_key: w.lookupKey,
      transfer_lookup_key: transferLookupKey,
      nickname: w.name,
    });
    note(`price ${w.lookupKey}: created ${describe(price)}`);
    return price.id;
  }

  /** Returns the two price ids (in PRICE_LOOKUP order) or throws after reporting mismatches. */
  async function ensurePrices(): Promise<{ product: Stripe.Product; priceIds: string[] }> {
    const wanted = wantedPrices();
    const existing = new Map<string, Stripe.Price | null>();
    for (const w of wanted) existing.set(w.lookupKey, await findPriceByLookupKey(w.lookupKey));

    const product = await findOrCreateProduct([...existing.values()].find((p) => p) ?? null);
    note(`product: ${product.id} "${product.name}"`);

    const priceIds: string[] = [];
    const mismatches: string[] = [];
    for (const w of wanted) {
      const current = existing.get(w.lookupKey) ?? null;
      const decision = decidePrice(current, w, product.id, replacePrices);
      switch (decision.action) {
        case "create":
          priceIds.push(await createPrice(product, w, false));
          break;
        case "keep":
          note(`price ${w.lookupKey}: ok ${describe(current!)}`);
          priceIds.push(current!.id);
          break;
        case "replace": {
          // New Price first (transfer_lookup_key moves the key onto it), old
          // one archived second, so the checkout's lookup never finds the key
          // without an active Price behind it.
          note(`price ${w.lookupKey}: ${describe(current!)} does not match ${money(w.cents)} / ${w.interval}`);
          const id = await createPrice(product, w, true);
          if (dryRun) {
            note(`price ${w.lookupKey}: would move the lookup key to the new Price and archive ${decision.oldId}`);
          } else {
            await stripe.prices.update(decision.oldId, { active: false });
            note(`price ${w.lookupKey}: archived ${decision.oldId}`);
          }
          priceIds.push(id);
          break;
        }
        case "mismatch":
          note(`price ${w.lookupKey}: MISMATCH ${describe(current!)}, wanted ${money(w.cents)} / ${w.interval}`);
          mismatches.push(w.lookupKey);
          priceIds.push(current!.id);
          break;
      }
    }
    if (mismatches.length) {
      throw new Error(
        `${mismatches.length} price(s) do not match src/lib/pricing.ts (${mismatches.join(", ")}). Nothing was changed.\n` +
          "Either change src/lib/pricing.ts back to match Stripe, or re-run with --replace-prices to create a Price\n" +
          "at the new amount, move the lookup key to it and archive the old one."
      );
    }
    return { product, priceIds };
  }

  /**
   * The portal may switch a subscriber between exactly `priceIds` (the
   * current holders of the two lookup keys). portalParams replaces the
   * product's price list outright, so an archived Price drops out of it and
   * nobody can switch back onto an old amount.
   */
  async function ensurePortal(productId: string, priceIds: string[]): Promise<string> {
    const { data } = await stripe.billingPortal.configurations.list({ limit: 100 });
    // Ours by marker first; else the account's default (the one the dashboard
    // manages), which gets our features and the marker; else a new one. The
    // API cannot flip is_default, so src/lib/stripe-portal.ts pins the marked
    // configuration on every portal session instead of relying on the default.
    const mine =
      data.find((c) => c.metadata?.app === PORTAL_METADATA.app) ?? data.find((c) => c.is_default) ?? null;
    const params = portalParams(site, productId, priceIds);

    if (mine) {
      if (dryRun) {
        note(`portal: would update ${mine.id}${mine.is_default ? " (account default)" : ""}`);
        return mine.id;
      }
      const updated = await stripe.billingPortal.configurations.update(mine.id, { ...params, active: true });
      note(`portal: updated ${updated.id}${updated.is_default ? " (account default)" : ""}`);
      return updated.id;
    }
    if (dryRun) {
      note("portal: would create a configuration");
      return "bpc_DRYRUN";
    }
    const created = await stripe.billingPortal.configurations.create(params);
    note(`portal: created ${created.id}`);
    return created.id;
  }

  return { ensurePrices, ensurePortal };
}
