# Stripe setup checklist

One-time steps to turn on paid subscriptions: $25 / month or $250 / year
(`src/lib/pricing.ts`, set by the owner on 26 Sep 2026), with a **7-day free
trial** for every first-time subscriber. Stripe Checkout collects the card up
front and charges it itself when the trial ends; the site only decides who is
offered the trial (an account that has never had a subscription).

Most of the Stripe side is done by one script, `npm run stripe:setup`. It
creates the product and its two Prices, the Customer Portal configuration and
the webhook endpoint, and writes every id to a local file. Do everything in
**Test mode** first, run the test checklist in step 6, then repeat with the
live key (step 7).

## 1. Before the script (owner, in the browser)

1. **Stripe account.** Sign up at dashboard.stripe.com if there isn't one, and
   complete **Activate payments** (business details, bank account). Test mode
   works before activation; live payments don't.
2. **Secret key.** Dashboard → **Developers** → **API keys**, with the *Test
   mode* toggle (top right) **on**. Click *Reveal* on **Secret key**
   (`sk_test_...`) and copy it.
3. **`.env.local`.** In your checkout of the repo, copy `.env.local.example` to
   `.env.local` if it doesn't exist and set

   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```

   `.env.local` is git-ignored. Never paste the key anywhere else.
4. **Customer emails.** Dashboard → **Settings** → **Billing** →
   **Subscriptions and emails**. Turn on the three customer emails: *Send
   emails about upcoming trial ends* (Stripe sends it 3 days before the first
   charge), *Successful payments* (receipts) and *Failed payments*. These are
   account-level toggles the API can't set.
5. **Terms of Service URL.** **Settings** → **Business** → **Public details**
   → *Terms of service URL* = `https://www.essentialregs.com/terms` (and
   *Privacy policy URL* = `https://www.essentialregs.com/privacy`). The
   checkout asks Stripe to show an "I agree to the terms" checkbox
   (`consent_collection`), which Stripe refuses until this URL is set; until
   then the site creates the session without the checkbox and logs a line
   saying so. Per mode, like the emails. See `docs/auth-email-templates.md`
   §3.

## 2. Run the script

From the repo root, after `npm ci`:

```sh
npm run stripe:setup
```

It reads `STRIPE_SECRET_KEY` from `.env.local`, refuses a live key unless you
pass `--live`, and then, idempotently:

- finds or creates the **EssentialRegs** product and its two recurring Prices,
  **Monthly** `$25.00` and **Yearly** `$250.00`, each carrying the lookup key
  the checkout looks for (`individual_monthly`, `individual_annual`). No Price
  id ever goes into an environment variable: the checkout resolves the keys at
  request time, so test and live mode each carry their own Prices under the
  same keys.
- creates (or adopts the account's default and updates) a **Customer Portal
  configuration**: invoice history, update card, cancel at the end of the
  period, and switch between the two prices. An upgrade (monthly → annual)
  happens at once and the customer pays the prorated difference; a downgrade
  (annual → monthly) is **scheduled for the end of the paid period**, so
  nobody who paid for a year is refunded or credited for switching (owner
  decision, 27 Sep 2026). It is tagged
  `metadata.app = essentialregs`; the site's *Manage billing* button opens the
  portal with that configuration by id.
- creates the **webhook endpoint** `https://www.essentialregs.com/api/stripe/webhook`
  with exactly the three events the site handles (`checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`).

Output goes to **`stripe-setup.local.txt`** in the repo root (git-ignored):
the mode, every id, and, **only when the webhook endpoint was created on this
run**, its signing secret (`STRIPE_WEBHOOK_SECRET=whsec_...`). Stripe shows
that secret exactly once, so if the endpoint already existed the file says so
instead; get the secret from Developers → Webhooks → the endpoint → *Signing
secret* → **Roll** (or *Reveal*, if it was never used). The terminal prints
only the ids, never the secret.

Flags: `-- --dry-run` prints what would change and writes nothing;
`-- --site https://<preview-host>` points the webhook and portal return URL at
a preview deployment; `-- --replace` is for repricing (below); `-- --live` for
step 7.

**Changing the price later:** edit the two display strings in
`src/lib/pricing.ts` first (that file is what the site shows), then run
`npm run stripe:setup -- --replace`. It creates a Price at the new amount,
moves the lookup key onto it, archives the old one and updates the portal
configuration; existing subscribers stay on what they signed up for and new
checkouts get the new amount. Without `--replace`, a mismatch stops the script
and changes nothing.

## 3. Add the environment variables in Vercel

Vercel dashboard → the essentialregs project → **Settings** → **Environment
Variables**, environment **Production**. Exactly three come from this setup
(`SUPABASE_SERVICE_ROLE_KEY` is already there):

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | the key from `.env.local` |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` line in `stripe-setup.local.txt` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.essentialregs.com` (no trailing slash) |

Then **redeploy** (Deployments → ⋯ on the latest → Redeploy). Environment
variables only take effect on a new deployment.

## 4. The Customer Portal, briefly

The script configured it; nothing to click. Downgrades are scheduled for the
end of the paid period and upgrades are immediate with proration; the account
page tells subscribers so under *Manage billing*. If you ever open **Settings** →
**Billing** → **Customer portal** in the dashboard, note that the dashboard
edits the account's *default* configuration, which may or may not be the one
the script tagged. The site pins the tagged configuration by id, so re-run the
script after dashboard changes you want to keep.

## 5. Database

Already done: `supabase/migrations/20260913000000_subscriptions_and_keyword_search.sql`
is applied in production, and `has_full_access()` treats a `trialing`
subscription as entitled. Nothing to run. A logged-in user without a
subscription sees only sample content; anyone comped (`access_granted = true`
on their `profiles` row) keeps full access regardless of Stripe.

## 6. Test it end to end (test mode)

1. Open the site, create a fresh account, confirm the email, then go to the
   homepage **Pricing** section (`/pricing` also lands there) and click
   **Start 7-day free trial** in the Annual box.
2. Stripe's checkout page shows **7 days free**, then **$250.00 / year**, and
   asks for a card even though nothing is charged today. Use
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
3. You land on `/account?checkout=success`. Within a few seconds the Plan line
   reads **Annual — trial, first charge <date 7 days out>**, with *Cancel before
   then from Manage billing and you won't be charged.* under it, and
   `/regulations` opens the full corpus. If it still says "No subscription"
   after ~10 seconds, check Stripe → Developers → Webhooks → your endpoint for
   a failed delivery and its error message.
4. In the Stripe dashboard open the subscription and click **End trial now**.
   Reload `/account`: the Plan line flips to **Annual — active, renews
   <date a year out>**.
5. Click **Manage billing**. In the portal, **Update plan** → switch to
   Monthly. The portal says the change is **scheduled for the end of the
   current period** and shows **no charge and no credit**; confirm. Back on
   `/account` the Plan line still reads **Annual — active, renews <date a year
   out>** (the switch hasn't happened yet). Then in the portal **Cancel
   plan**: the Plan line reads **Canceled — access until <date>**.
6. Card that fails at conversion: create another fresh account and subscribe
   with `4000 0000 0000 0341`. The trial starts fine (Plan line shows the
   trial). **End trial now** in the dashboard: the charge fails, the
   subscription goes `past_due`, and the Plan line reads **payment failed.
   Update your card to keep access.**
7. One trial per customer: with the first account (canceled in step 5), go
   back to **Pricing** and subscribe again. Checkout shows **no** trial line
   and charges immediately; the button on the site said **Subscribe**, not
   *Start 7-day free trial*.

To watch a trial convert on its own without waiting a week, use a **test
clock** (Developers → Test clocks): create a customer under the clock,
subscribe it to `individual_monthly` with a 7-day trial and a test card, then
advance the clock past the trial end.

## 7. Going live

1. Dashboard → toggle **Test mode off** → **Developers** → **API keys** →
   reveal the live **Secret key** (`sk_live_...`). Replace the value in
   `.env.local`.
2. `npm run stripe:setup -- --live`. Same product, prices, portal and webhook
   in the live account; `stripe-setup.local.txt` now holds the live ids and
   the live webhook secret.
3. In Vercel replace the two Stripe variables, `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET`, with the live values, and redeploy.
   `NEXT_PUBLIC_SITE_URL` and the Supabase key don't change.
4. Repeat steps 1.4 (customer emails) and 1.5 (Terms of Service URL) with
   Test mode off; both are per mode.
