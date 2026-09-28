# Auth email templates (Supabase) and the Stripe terms URL

Two one-time dashboard changes that go with the sign-up hardening PR
(28 Sep 2026). Neither needs a deploy; both take effect at once.

## 1. Why: confirmation links must work from any device

Supabase's **default** "Confirm signup" template links to
`{{ .ConfirmationURL }}`, Supabase's own verify page, which bounces the
browser to `/auth/confirm?code=...`. That PKCE code can only be exchanged by
the browser that submitted the sign-up (the code verifier lives in its
cookies). Sign up on a laptop, tap the link on a phone: the email is marked
confirmed, but the phone lands on `/login?error=confirmation-failed`, logged
out. Same for the password-reset link.

The fix is a template that links **straight to our `/auth/confirm` route with
the token hash**. The route verifies it with `verifyOtp` and sets the session
in whichever browser opened the link. The route already handles both shapes,
so switching templates is safe at any time, and switching back is too.

## 2. Supabase: replace the two templates

Supabase dashboard → the project → **Authentication** → **Email Templates**.

Both templates use `{{ .SiteURL }}`, which is the **Site URL** under
Authentication → URL Configuration and must be `https://www.essentialregs.com`
(set 28 Sep 2026, with `https://www.essentialregs.com/**` and
`https://essentialregs.com/**` on the Redirect URLs allow-list).

### Confirm signup

Replace the body with:

```html
<h2>Confirm your email</h2>

<p>Thanks for signing up for EssentialRegs. Open this link to confirm your
email address and start your free trial:</p>

<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm my email</a></p>

<p>The link works on any device and expires after an hour. If you didn't
create an account, you can ignore this email.</p>
```

What each part does:

- `token_hash={{ .TokenHash }}&type=email` is what `/auth/confirm` hands to
  `verifyOtp`.
- `next={{ .RedirectTo }}` is the `emailRedirectTo` the sign-up action built
  (`https://www.essentialregs.com/auth/confirm?next=%2Fpricing%3Fplan%3Dyear`),
  passed through as is. `/auth/confirm` unwraps it to `/pricing?plan=year`,
  so the confirmed user still lands on the plan they chose
  (`nextFromConfirmLink` in `src/lib/safe-redirect.ts`). Anything not on our
  origin is dropped.

### Reset password

Replace the body with:

```html
<h2>Reset your password</h2>

<p>Open this link to choose a new password for your EssentialRegs account:</p>

<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset my password</a></p>

<p>The link works on any device and expires after an hour. If you didn't ask
for this, you can ignore this email; your password is unchanged.</p>
```

Leave the other templates (Magic Link, Change Email Address, Reauthentication)
alone; the site doesn't send them.

Optional, same page: the subject lines. "Confirm your EssentialRegs email"
and "Reset your EssentialRegs password" read better than the defaults.

### Test it

1. On a PC: `/signup` → choose a plan → read the disclaimer, tick, Continue →
   create an account with a fresh `+alias` address. You land on
   `/check-email`.
2. On the phone (any browser, not the one that signed up): open the newest
   email, tap the link. Expected: `/pricing?confirmed=1&plan=<the plan>`,
   signed in, with that card highlighted.
3. Tap the link a second time: `/login?error=confirmation-failed` with the
   "link didn't work" notice (the token is single-use). Logging in works.
4. `/forgot-password` on the PC, open the reset link on the phone: the
   "Set a new password" page.

If step 2 lands on `/login?error=confirmation-failed` on the first tap, check
Supabase → Logs → Auth for the `verify` request: `otp_expired` means the
email took longer than the OTP expiry (Authentication → Providers → Email →
"Email OTP Expiration", 3600 s by default); `token not found` usually means
the template is still the default one.

## 3. Stripe: Terms of Service URL (for the Checkout consent box)

The checkout now asks Stripe for `consent_collection.terms_of_service =
required`, which adds an "I agree to the terms" checkbox on the Stripe
Checkout page as a second layer under the site's own disclaimer gate. Stripe
only allows that once the account has a Terms of Service URL; until then the
site falls back to a session without the checkbox and logs
`no Terms of Service URL set` on every checkout.

Stripe dashboard → **Settings** → **Business** → **Public details** (the
page at `dashboard.stripe.com/settings/public`) → **Terms of service URL** =
`https://www.essentialregs.com/terms`, and while there **Privacy policy URL**
= `https://www.essentialregs.com/privacy`. Save. Do it with **Test mode off**
(the live account) and again in the sandbox; the setting is per mode.

Check: start a checkout from `/pricing`; the Stripe page shows the checkbox
above the Subscribe button, and the runtime logs stop printing the fallback
line.
