"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { signupNextPath } from "@/lib/signup-plan";
import { readDisclaimerAcceptance } from "@/lib/disclaimer";
import { SITE_URL } from "@/lib/site";
import type { AuthError } from "@supabase/supabase-js";

export type AuthFormState =
  | {
      error?: string;
      message?: string;
      /**
       * Set by `login` when the account exists but its email was never
       * confirmed, so the form can offer a "resend the link" way out
       * (/check-email) instead of a dead end.
       */
      unconfirmedEmail?: string;
    }
  | undefined;

type AuthErrorKind = "invalid_credentials" | "email_not_confirmed" | "already_exists" | "rate_limited" | "unknown";

const FRIENDLY: Record<AuthErrorKind, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Please confirm your email first — check your inbox for the link we sent you.",
  already_exists: "An account with that email already exists. Try logging in.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * Maps a raw Supabase auth error to a generic, user-facing message. Supabase's
 * `error.message` strings are meant for developers, not end users, and some
 * of them leak information an attacker can use (e.g. confirming an email is
 * already registered lets them enumerate accounts). Log the real message
 * server-side for debugging, but only ever return one of these fixed strings
 * to the client.
 */
function friendlyAuthError(error: AuthError, context: string): string {
  console.error(`[auth:${context}]`, error.message);
  return FRIENDLY[authErrorKind(error)];
}

function authErrorKind(error: AuthError): AuthErrorKind {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already registered")
  ) {
    return "already_exists";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    message.includes("rate limit")
  ) {
    return "rate_limited";
  }
  return "unknown";
}

/**
 * Where the emailed links point back to. NEXT_PUBLIC_SITE_URL (the canonical
 * https://www.essentialregs.com in production) rather than the request's
 * Origin/Host header: a link built from whatever host the form was posted
 * on (a preview URL, the bare apex) fell outside Supabase's redirect
 * allow-list and dropped the user on the homepage logged out (28 Sep 2026).
 * Every confirmation link now lands on the same, allow-listed origin.
 *
 * The emailRedirectTo built here is also what Supabase's token-hash
 * templates (docs/auth-email-templates.md) pass through as
 * `{{ .RedirectTo }}`; /auth/confirm unwraps it (nextFromConfirmLink).
 */
function confirmUrl(next: string): string {
  return `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const state: AuthFormState = { error: friendlyAuthError(error, "login") };
    if (authErrorKind(error) === "email_not_confirmed") state.unconfirmedEmail = email;
    return state;
  }

  // Home after a login (owner, 28 Sep 2026), unless the login page was given
  // a safe same-site `next` to return to. The password-reset flow doesn't
  // come through here: updatePassword below still ends on /account.
  const next = safeNextPath(formData.get("next"), "/");

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  // No account without the disclaimer having been read and accepted (owner,
  // 28 Sep 2026). The account form only renders behind that gate
  // (src/app/signup/SignupSteps.tsx) and says so in two hidden fields;
  // a POST without them, or for a stale disclaimer revision, is refused.
  const acceptance = readDisclaimerAcceptance(formData);
  if (!acceptance) {
    return { error: "Please read and accept the disclaimer before creating an account." };
  }

  const supabase = await createClient();
  // The plan picked on /signup (step 1) rides along as a hidden field, so
  // /auth/confirm can land the user on /pricing?confirmed=1&plan=<interval>
  // with that card already highlighted. signupNextPath drops any value that
  // isn't "month" or "year"; safeNextPath is what the confirm route applies
  // to the same value on the way back, so run it here too.
  const plan = String(formData.get("plan") ?? "");
  const next = safeNextPath(signupNextPath(plan), "/pricing");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // /auth/confirm forwards the user to `next` once the emailed link is
      // verified (the plan choice, with the chosen plan).
      emailRedirectTo: confirmUrl(next),
      // Kept on the account as user metadata (no schema change): when the
      // disclaimer was accepted and which revision of it.
      data: acceptance,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error, "signup") };
  }

  // signUp() returns no session when email confirmation is required — the
  // account exists but can't log in yet. A clear "check your email" screen
  // rather than a line under the (now empty) form, with a resend button.
  if (!data.session) {
    redirect(checkEmailPath(email, plan));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/** /check-email, carrying the address and plan so the page can resend. */
function checkEmailPath(email: string, plan: string): string {
  const params = new URLSearchParams({ email });
  if (plan) params.set("plan", plan);
  return `/check-email?${params}`;
}

/**
 * Send the sign-up confirmation email again (/check-email). For a user who
 * never got the first one, opened it in a browser where it couldn't
 * complete, or let it expire. Supabase rate-limits this per address; an
 * already-confirmed address gets the same neutral message as any other, so
 * this can't be used to tell which emails have accounts.
 */
export async function resendConfirmation(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email." };
  }

  const supabase = await createClient();
  const next = safeNextPath(signupNextPath(formData.get("plan")), "/pricing");

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: confirmUrl(next) },
  });

  if (error) {
    return { error: friendlyAuthError(error, "resend-confirmation") };
  }

  return {
    message: "If that address still needs confirming, a new link is on its way. Check your inbox and spam folder.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl("/reset-password"),
  });

  // Supabase deliberately doesn't say whether the email is registered, to
  // avoid leaking which addresses have accounts — surface the same message
  // either way, and only report an actual failure (e.g. rate limiting).
  if (error) {
    return { error: friendlyAuthError(error, "reset-password-request") };
  }

  return {
    message: "If an account exists for that email, a password reset link is on its way.",
  };
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();

  // Requires the short-lived "recovery" session that /auth/confirm just
  // established by verifying the emailed token — not a full login.
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: friendlyAuthError(error, "update-password") };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}
