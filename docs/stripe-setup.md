# Stripe setup checklist

One-time steps to turn on paid subscriptions. Do them in order; nothing charges
anyone until step 6 is done in **live** mode.

Do everything below in Stripe's **Test mode** first (toggle at the top right of
the Stripe dashboard), confirm it works with the test card in step 7, then
repeat steps 1, 2, 3 and 5 in **Live mode** and swap the live keys into Vercel.

## 1. Create the product and annual price

1. Stripe dashboard → **Product catalog** → **+ Add product**.
2. Name: `EssentialRegs Annual` (this is what appears on the customer's receipt).
3. Under pricing choose **Recurring**, billing period **Yearly**, and enter the
   price. (The site currently displays a placeholder of `$299 / year` — if you
   pick a different amount, tell Claude to update `src/lib/pricing.ts` to match.)
4. Save. On the product page, click the price you just made and copy its id —
   it starts with `price_`. That's `STRIPE_PRICE_ID_ANNUAL`.

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
| `STRIPE_PRICE_ID_ANNUAL` | Step 1 |
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
   homepage **Pricing** section and click **Subscribe**.
2. On Stripe's checkout page use card number `4242 4242 4242 4242`, any future
   expiry date, any 3-digit CVC, any ZIP.
3. You land on `/account?checkout=success`. Within a few seconds the Plan line
   should read *active, renews <date a year out>* and `/regulations` should list
   the corpus. If it still says "No subscription" after ~10 seconds, check
   Stripe → Developers → Webhooks → your endpoint for a failed delivery and its
   error message.
4. Click **Manage billing**, cancel the subscription, come back — the Plan line
   should read *Canceled — access until <date>*.

Other useful test cards: `4000 0000 0000 0341` (card attaches but the first
payment fails) and `4000 0000 0000 9995` (insufficient funds).

## Going live

Repeat steps 1, 2, 3 and 6 with the dashboard in **Live mode**, replace
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_ID_ANNUAL` in
Vercel with the live values, and redeploy. The Supabase key and site URL don't
change.
