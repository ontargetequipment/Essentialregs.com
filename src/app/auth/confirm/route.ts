import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // `next` comes back off the confirmation link's query string, which is
  // attacker-controlled (anyone can craft a link with their own `next`) —
  // validate it the same way actions.ts does before ever redirecting there.
  const next = safeNextPath(searchParams.get("next"), "/account");
  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  } else {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (!error) {
        redirect(next);
      }
    }
  }

  redirect("/login?error=confirmation-failed");
}
