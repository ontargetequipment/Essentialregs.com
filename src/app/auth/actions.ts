"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import type { AuthError } from "@supabase/supabase-js";

export type AuthFormState = { error?: string; message?: string } | undefined;

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

  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already registered")
  ) {
    return "An account with that email already exists. Try logging in.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    message.includes("rate limit")
  ) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  return "Something went wrong. Please try again.";
}

async function siteOrigin() {
  const headersList = await headers();
  const origin = headersList.get("origin");
  if (origin) return origin;
  const host = headersList.get("host");
  return `https://${host}`;
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
    return { error: friendlyAuthError(error, "login") };
  }

  revalidatePath("/", "layout");
  redirect("/account");
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

  const supabase = await createClient();
  const origin = await siteOrigin();
  const next = safeNextPath(formData.get("next"), "/account");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // /auth/confirm forwards the user to `next` once the emailed link is
      // verified (e.g. back to the pricing card they came from).
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error, "signup") };
  }

  // signUp() returns no session when email confirmation is required — the
  // account exists but can't log in yet.
  if (!data.session) {
    return {
      message: "Check your email for a confirmation link to finish creating your account.",
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
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
  const origin = await siteOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
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
