# Stripe setup checklist

One-time steps to turn on paid subscriptions. Do them in order; nothing charges
anyone until step 6 is done in **live** mode.

Do everything below in Stripe's **Test mode** first (toggle at the top right of
the Stripe dashboard), confirm it works with the test card in step 8, then
repeat steps 1, 2, 3 and 5 in **Live mode** and swap the live keys into Vercel.

## 1. Create the product and its two prices (script)

The site sells one product with two recurring prices, **Monthly** at `$25.00`
and **Yearly** at `$250.00` (`src/lib/pricing.ts`: `$25 / month` or
`$250 / year`, set by the owner on 26 Sep 2026). Every first-time subscriber
gets a **7-day free trial**: Stripe Checkout collects the card up front and
charges it itself when the trial ends, so nothing else has to be configured for
the trial to convert.

The checkout does not use Price ids from environment variables. It finds each
Price by its **lookup key** — `individual_monthly` and `individual_annual` —
so test mode and live mode each carry their own Prices under the same keys, and
a repriced Price needs no redeploy.

Create them with the script, from a checkout of the repo with `npm ci` done.
You need the secret key from step 2 first:

```sh
STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
```

It prints the mode it's in (test or LIVE), finds or creates the `EssentialRegs`
product, and creates whichever of the two Prices is missing. Re-running it is
safe: a Price that already exists with the right amount and interval is
reported and left alone. Add `-- --dry-run` to see what it would do without
writing anything.

If you made the product and prices by hand in the dashboard instead, give each
price its lookup key: **Product catalog** → the price → **⋯** → *Edit lookup
key*. The script accepts hand-made prices as long as the amount, `usd`
currency and interval match.

**Changing the price later:** edit the two display strings in
`src/lib/pricing.ts` first (that file is what the site shows), then run
`npm run stripe:setup -- --replace`. It creates a Price at the new amount,
moves the lookup key onto it and archives the old one; existing subscribers
stay on what they signed up for and new checkouts get the new amount.

## 2. Get your API keys

Stripe dashboard → **Developers** → **API keys**.

- **Secret key** (starts `sk_test_` in test mode, `sk_live_` in live mode). Click
  *Reveal* and copy it. That's `STRIPE_SECRET_KEY`. Never paste it anywhere
  public.

## 3. Create the webhook endpoint

This is how Stripe tells the site "this person paid" / "this person canceled".

1. **Developers** → **Webhooks** → **+ Add endpoint**.
2. Endpoint URL: `https://www.essentialregs.com/api/stripe/webhook`
3. Under *Select events to listen to*, add exactly these three:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**, then on the endpoint's page click **Reveal** under
   *Signing secret* and copy it (starts `whsec_`). That's `STRIPE_WEBHOOK_SECRET`.

Test mode and live mode each need their own endpoint and have different
signing secrets.

## 4. Get the Supabase service-role key

Supabase dashboard → your project → **Project Settings** → **API** →
under *Project API keys*, copy **service_role** (click *Reveal*).
That's `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses all row-level security,
so treat it like a password — it only ever lives in Vercel's environment
variables, never in the browser or in git.

## 5. Add the environment variables in Vercel

Vercel dashboard → the essentialregs project → **Settings** → **Environment
Variables**. Add each of these for the **Production** environment (and Preview
if you want previews to work):

| Name | Value comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Step 2 |
| `STRIPE_WEBHOOK_SECRET` | Step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 4 |
| `NEXT_PUBLIC_SITE_URL` | `https://www.essentialregs.com` (no trailing slash) |

Then **redeploy** (Deployments → ⋯ on the latest → Redeploy). Environment
variables only take effect on a new deployment.

## 6. Enable the Customer Portal

This is the "Manage billing" page where subscribers update their card, download
invoices, or cancel.

1. Stripe dashboard → **Settings** → **Billing** → **Customer portal**.
2. Turn on: *Invoice history*, *Update payment method*, *Cancel subscriptions*.
   Leave *Switch plans* off (there's only one plan).
3. Under *Business information* set the return/website link to
   `https://www.essentialregs.com/account`.
4. Save.

## 7. Run the database migration

Supabase dashboard → **SQL Editor** → **New query**. Paste the entire contents of
`supabase/migrations/002_subscriptions.sql` from the repo and click **Run**.
It's safe to run more than once.

After this, a logged-in user without a subscription sees only sample content.
Anyone you've comped (`access_granted = true` on their `profiles` row) keeps
full access regardless of Stripe.

## 8. Test it end to end (test mode)

1. Open the site, create a fresh account, confirm the email, then go to the
   homepage **Pricing** section and click **Start 7-day free trial** in the
   Annual box (the Monthly box has the same button for the monthly price).
2. On Stripe's checkout page — it says *7 days free*, then `$250.00` a year —
   use card number `4242 4242 4242 4242`, any future expiry date, any 3-digit
   CVC, any ZIP. A card is required even though nothing is charged today.
3. You land on `/account?checkout=success`. Within a few seconds the Plan line
   should read *Annual — trial, first charge <date 7 days out>* and
   `/regulations` should open the full corpus. If it still says "No
   subscription" after ~10 seconds, check Stripe → Developers → Webhooks → your
   endpoint for a failed delivery and its error message.
4. Click **Manage billing**, cancel the subscription, come back — the Plan line
   should read *Canceled — access until <date>*.
5. Subscribe again from the same account: this time Checkout shows no trial
   and charges the card straight away (one trial per customer — the site only
   offers it to an account that has never had a subscription), and the Plan
   line reads *Annual — active, renews <date a year out>*.

To watch a trial convert without waiting a week, use a Stripe **test clock**
(Developers → Test clocks): create a customer under the clock, subscribe it to
the `individual_monthly` price with a 7-day trial and a test card, then advance
the clock past the trial end; the subscription moves from `trialing` to
`active` and the webhook updates the profile's Plan line.

Other useful test cards: `4000 0000 0000 0341` (card attaches but the first
payment fails) and `4000 0000 0000 9995` (insufficient funds).

## Going live

Repeat steps 1 (run the script with the live `sk_live_` key), 2, 3 and 6 with
the dashboard in **Live mode**, replace `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` in Vercel with the live values, and redeploy. The
Supabase key and site URL don't change.
