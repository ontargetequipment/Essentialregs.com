import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessStatus } from "@/lib/access";
import { safeNextPath } from "@/lib/safe-redirect";

// Landing point for whatever link Supabase's auth email sends the user to
// (emailRedirectTo / resetPasswordForEmail's redirectTo in auth/actions.ts).
//
// Supabase's *default* "Confirm signup" / "Reset Password" templates link to
// `{{ .ConfirmationURL }}`, which is Supabase's own hosted verify page — it
// checks the token server-side, then bounces the browser here with a `code`
// query param (PKCE flow, the default for @supabase/ssr clients). That's the
// path this route is built for, so no dashboard template edits are needed.
//
// If the templates are ever customized to link straight here instead (with
// `token_hash` + `type` in the URL), this also handles that shape — either
// way it ends with a real session, then sends the user on to `next`.
//
// With no explicit `next`, a user who can't read the corpus yet lands on the
// plan choice (/pricing?confirmed=1, the plans above the fold on a phone)
// rather than /account, so the first thing after confirming is picking
// monthly or annual (owner, 27 Sep 2026); anyone already entitled (comped,
// or a returning subscriber) goes to /account.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // `next` comes back off the confirmation link's query string, which is
  // attacker-controlled (anyone can craft a link with their own `next`) —
  // validate it the same way actions.ts does before ever redirecting there.
  // An empty fallback here means "nothing safe was given".
  const explicitNext = safeNextPath(searchParams.get("next"), "");
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
 * else the default below. Either way, a plain "/pricing" (the normal signup
 * path: SubscribeControl's link carries next=/pricing) gets ?confirmed=1 so
 * the confirmation notice shows there too.
 */
async function destination(explicitNext: string): Promise<string> {
  const target = explicitNext || (await defaultDestination());
  return target === "/pricing" ? "/pricing?confirmed=1" : target;
}

/** Where a confirmed user goes when the link carried no safe `next`. */
async function defaultDestination(): Promise<string> {
  // The session cookies set by the exchange above are visible to this
  // request's cookie store, so this sees the user who just confirmed. If
  // for any reason it doesn't (no user), fall back to /account as before.
  const access = await getAccessStatus();
  return access.user && !access.hasAccess ? "/pricing?confirmed=1" : "/account";
}
