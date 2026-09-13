# Security next steps (owner action required)

These three items came out of the security audit but need access to
accounts this coding pass doesn't have (Cloudflare, Supabase dashboard,
Resend) — they're manual, one-time setup steps for whoever owns those
accounts (Brody).

## 1. Enable Cloudflare Turnstile on auth forms (replaces CAPTCHA)

Turnstile is Cloudflare's invisible/low-friction CAPTCHA replacement.
Supabase Auth has first-class support for it — this blocks the login,
signup, and password-reset endpoints from being scripted/brute-forced.

**Where to click:**
1. In the Cloudflare dashboard, go to **Turnstile** (left sidebar) →
   **Add site**. Enter `essentialregs.com` as the domain, choose the
   **Managed** widget mode, and create it.
2. Copy the **Site Key** and **Secret Key** it gives you.
3. In the Supabase dashboard for this project: **Authentication** →
   **Attack Protection** (or **Settings** → **Auth**, depending on
   dashboard version) → **Enable Captcha protection** → provider
   **Turnstile** → paste the **Secret Key**.
4. In the app code (follow-up PR), add the Turnstile widget script/embed
   to the login, signup, and forgot-password forms, and pass the
   resulting token as `captchaToken` in the `options` object of the
   corresponding `supabase.auth.signInWithPassword` /
   `supabase.auth.signUp` / `supabase.auth.resetPasswordForEmail` calls
   in `src/app/auth/actions.ts`. The Site Key from step 2 goes in the
   client-side widget (safe to expose); the Secret Key from step 2 stays
   server-side only, inside Supabase.

## 2. Enable leaked-password protection

Supabase can reject signups/password changes that use a password already
present in known breach dumps (via the HaveIBeenPwned range API), at no
cost and no code change.

**Where to click:**
1. Supabase dashboard → **Authentication** → **Policies** (or **Attack
   Protection** section, depending on dashboard version).
2. Toggle on **"Prevent use of leaked passwords"** (sometimes labeled
   **"Leaked password protection"**).
3. Save. No app code changes needed — Supabase now returns a
   `weak_password` error for a leaked password, which the existing
   `friendlyAuthError` fallback message in `src/app/auth/actions.ts`
   already covers ("Something went wrong. Please try again."); consider
   adding a specific case for `weak_password` /
   `error.message.includes("leaked")` that tells the user to pick a
   different password, since that one isn't really "wrong."

## 3. Configure custom SMTP (Resend) for auth emails

Supabase's built-in email sender is rate-limited (a few emails/hour) and
not meant for production — signup confirmations and password resets can
get delayed or dropped under any real traffic. Routing them through a
dedicated provider (Resend) fixes deliverability and removes the rate cap.

**Where to click:**
1. Sign in to (or create) a Resend account at resend.com.
2. **Domains** → **Add Domain** → enter `essentialregs.com` → add the
   DNS records (SPF/DKIM, and DMARC if desired) it gives you to your DNS
   provider (Cloudflare DNS, most likely, given Turnstile above) → wait
   for verification (usually minutes, sometimes longer for DNS
   propagation).
3. **API Keys** → **Create API Key** (Sending access is enough) → copy
   it.
4. Resend also publishes SMTP credentials for this key — or use
   **API Keys** → the SMTP tab if shown — you need: SMTP host
   (`smtp.resend.com`), port `465` (SSL) or `587` (TLS), username
   `resend`, and the API key as the password.
5. Supabase dashboard → **Project Settings** → **Authentication** →
   **SMTP Settings** → toggle **Enable Custom SMTP** → fill in the host/
   port/username/password from step 4, and set **Sender email** to an
   address at the verified domain (e.g. `noreply@essentialregs.com`) and
   **Sender name** to `EssentialRegs`.
6. Save, then use Supabase's **Send test email** button to confirm
   delivery before relying on it.
