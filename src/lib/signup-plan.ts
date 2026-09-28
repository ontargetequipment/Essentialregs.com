import { parseBillingInterval } from "@/lib/pricing";

/**
 * The plan a visitor picked on /signup (step 1) has to survive the email
 * round-trip: /signup?plan=month -> the signup action's `next` ->
 * /auth/confirm?next=... -> /pricing?confirmed=1&plan=month, where
 * PlanChoice highlights that card. These two helpers are the pure parts of
 * that hand-off; src/app/auth/actions.ts and src/app/auth/confirm/route.ts
 * call them, and scripts/signup-plan.test.ts pins them down.
 */

/**
 * Where a new account's confirmation link should send it: the plan choice,
 * carrying the plan chosen at signup. Anything that isn't exactly "month" or
 * "year" (a missing or tampered form field) is dropped, not passed through.
 */
export function signupNextPath(plan: unknown): string {
  const interval = parseBillingInterval(plan);
  return interval ? `/pricing?plan=${interval}` : "/pricing";
}

/**
 * The final URL for a freshly confirmed user. A `next` pointing at /pricing
 * (the normal signup path) gets ?confirmed=1 so the confirmation notice
 * shows, and keeps a valid `plan` so the card the user already picked is
 * highlighted; an unknown plan value is stripped. Any other path is
 * returned untouched. `target` must already have passed safeNextPath.
 */
export function confirmedDestination(target: string): string {
  const url = new URL(target, "http://local.invalid");
  if (url.pathname !== "/pricing") return target;
  const plan = parseBillingInterval(url.searchParams.get("plan"));
  return plan ? `/pricing?confirmed=1&plan=${plan}` : "/pricing?confirmed=1";
}
