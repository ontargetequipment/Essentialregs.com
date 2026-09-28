/**
 * The disclaimer gate in front of account creation (owner, 28 Sep 2026):
 * nobody gets to the email/password form on /signup?plan=... without having
 * scrolled through the full /disclaimer text and ticked the acceptance box,
 * and the signup action refuses to create an account unless the form says
 * so. Pure helpers only; src/app/signup/SignupSteps.tsx renders the gate and
 * src/app/auth/actions.ts enforces it. scripts/disclaimer.test.ts pins
 * these down.
 */

/**
 * Which revision of the disclaimer text the user accepted, stored in the
 * account's user metadata as `disclaimer_version`. Bump it (ISO date) when
 * the wording in src/components/DisclaimerText.tsx changes in substance;
 * LegalPage's "Last updated" line is the same date.
 */
export const DISCLAIMER_VERSION = "2026-09-12";

/** The hidden fields the account form carries once the gate has been passed. */
export const ACCEPT_FIELD = "accepted";
export const ACCEPT_VALUE = "1";
export const VERSION_FIELD = "disclaimer_version";

/** What goes into `auth.signUp({ options: { data } })` — no schema change. */
export type DisclaimerAcceptance = {
  disclaimer_accepted_at: string;
  disclaimer_version: string;
};

/** The subset of FormData this reads, so tests can pass a plain map. */
export type FormFields = { get(name: string): unknown };

/**
 * The acceptance the account form claims, or null when it is missing, not
 * the exact expected value, or for a disclaimer revision other than the
 * one the site currently shows (a stale tab from before a wording change
 * has to read the new text). `now` is the acceptance timestamp.
 */
export function readDisclaimerAcceptance(
  form: FormFields,
  now: Date = new Date()
): DisclaimerAcceptance | null {
  if (form.get(ACCEPT_FIELD) !== ACCEPT_VALUE) return null;
  if (form.get(VERSION_FIELD) !== DISCLAIMER_VERSION) return null;
  return {
    disclaimer_accepted_at: now.toISOString(),
    disclaimer_version: DISCLAIMER_VERSION,
  };
}
