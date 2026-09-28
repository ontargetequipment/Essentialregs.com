import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessStatus } from "@/lib/access";
import { nextFromConfirmLink } from "@/lib/safe-redirect";
import { confirmedDestination } from "@/lib/signup-plan";
import { SITE_URL } from "@/lib/site";

// Landing point for whatever link Supabase's auth email sends the user to
// (emailRedirectTo / resetPasswordForEmail's redirectTo in auth/actions.ts).
//
// Two link shapes arrive here, and both end with a real session before the
// user is sent on to `next`:
//
//   - `token_hash` + `type`: the templates in docs/auth-email-templates.md
//     link straight here and verifyOtp checks the token. This is the shape
//     production uses (28 Sep 2026): it completes in whatever browser opens
//     the link, so signing up on a laptop and tapping the link on a phone
//     works.
//   - `code`: Supabase's *default* templates link to `{{ .ConfirmationURL }}`,
//     Supabase's own hosted verify page, which bounces the browser here with
//     a PKCE code. That exchange needs the code verifier cookie the sign-up
//     left behind, so it only works in the browser that created the
//     account; anywhere else it confirmed the email but landed on
//     /login?error=confirmation-failed. Kept so a project still on the
//     default templates keeps working.
//
// With no explicit `next`, a user who can't read the corpus yet lands on the
// plan choice (/pricing?confirmed=1, the plans above the fold on a phone)
// rather than /account, so the first thing after confirming is picking
// monthly or annual (owner, 27 Sep 2026); anyone already entitled (comped,
// or a returning subscriber) goes to /account. The normal signup path sets
// next=/pricing?plan=<month|year> (the plan chosen on /signup), which comes
// out as /pricing?confirmed=1&plan=<month|year> so that card is highlighted.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // `next` comes back off the confirmation link's query string, which is
  // attacker-controlled (anyone can craft a link with their own `next`) —
  // reduce it to a safe same-site path before ever redirecting there. It
  // is either the path actions.ts put there, or (token-hash templates) the
  // whole emailRedirectTo URL wrapping that path; "" means nothing safe.
  const explicitNext = nextFromConfirmLink(searchParams.get("next"), SITE_URL);
  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(await destination(explicitNext));
    }
  } else {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (!error) {
        redirect(await destination(explicitNext));
      }
    }
  }

  redirect("/login?error=confirmation-failed");
}

/**
 * Where a confirmed user goes: the explicit safe `next` if there was one,
 * else the default below. Either way, a `next` on /pricing (the normal
 * signup path: the signup action sets next=/pricing?plan=<interval>) gets
 * ?confirmed=1 so the confirmation notice shows, and keeps a valid `plan`
 * (an unknown one is stripped) -- see confirmedDestination.
 */
async function destination(explicitNext: string): Promise<string> {
  const target = explicitNext || (await defaultDestination());
  return confirmedDestination(target);
}

/** Where a confirmed user goes when the link carried no safe `next`. */
async function defaultDestination(): Promise<string> {
  // The session cookies set by the exchange above are visible to this
  // request's cookie store, so this sees the user who just confirmed. If
  // for any reason it doesn't (no user), fall back to /account as before.
  const access = await getAccessStatus();
  return access.user && !access.hasAccess ? "/pricing?confirmed=1" : "/account";
}
