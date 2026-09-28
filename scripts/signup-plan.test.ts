/**
 * The plan chosen on /signup has to come out the other end of the email
 * confirmation as /pricing?confirmed=1&plan=<month|year>, and nothing else
 * may ride along in that slot (src/lib/signup-plan.ts).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmedDestination, signupNextPath } from "../src/lib/signup-plan";

test("signupNextPath carries a valid plan to /pricing and drops anything else", () => {
  assert.equal(signupNextPath("month"), "/pricing?plan=month");
  assert.equal(signupNextPath("year"), "/pricing?plan=year");
  for (const bad of ["", "weekly", "Month", null, undefined, ["year"], "month&x=1"]) {
    assert.equal(signupNextPath(bad), "/pricing", `should drop ${JSON.stringify(bad)}`);
  }
});

test("confirmedDestination adds ?confirmed=1 to /pricing and keeps a valid plan", () => {
  assert.equal(confirmedDestination("/pricing"), "/pricing?confirmed=1");
  assert.equal(confirmedDestination("/pricing?plan=month"), "/pricing?confirmed=1&plan=month");
  assert.equal(confirmedDestination("/pricing?plan=year"), "/pricing?confirmed=1&plan=year");
  // Already the final form (the confirm route's own default): unchanged.
  assert.equal(confirmedDestination("/pricing?confirmed=1"), "/pricing?confirmed=1");
});

test("confirmedDestination strips an unknown plan and any other query noise", () => {
  assert.equal(confirmedDestination("/pricing?plan=weekly"), "/pricing?confirmed=1");
  assert.equal(confirmedDestination("/pricing?plan="), "/pricing?confirmed=1");
  assert.equal(confirmedDestination("/pricing?plan=month&utm=x"), "/pricing?confirmed=1&plan=month");
  assert.equal(confirmedDestination("/pricing?plan=year#top"), "/pricing?confirmed=1&plan=year");
});

test("confirmedDestination leaves any other path alone", () => {
  assert.equal(confirmedDestination("/account"), "/account");
  assert.equal(confirmedDestination("/reset-password"), "/reset-password");
  assert.equal(confirmedDestination("/pricing-faq?plan=month"), "/pricing-faq?plan=month");
  assert.equal(confirmedDestination("/regulations?plan=month"), "/regulations?plan=month");
});

// --- src/lib/safe-redirect.ts: the `next` a confirmation link carries -----
// Supabase's default templates hand /auth/confirm the path the signup
// action built; the token-hash templates (docs/auth-email-templates.md)
// hand it the whole emailRedirectTo URL as `{{ .RedirectTo }}`, with that
// path inside. Both have to come out as the same safe path, and nothing
// off-site ever may.

import { nextFromConfirmLink, safeNextPath } from "../src/lib/safe-redirect";

const SITE = "https://www.essentialregs.com";

test("a plain path passes through safeNextPath as before", () => {
  assert.equal(nextFromConfirmLink("/pricing?plan=year", SITE), "/pricing?plan=year");
  assert.equal(nextFromConfirmLink("/reset-password", SITE), "/reset-password");
  assert.equal(nextFromConfirmLink(" /account ", SITE), "/account");
  for (const bad of ["", null, undefined, "account", "//evil.com", "/\\evil.com", "javascript:alert(1)"]) {
    assert.equal(nextFromConfirmLink(bad, SITE), "", `should drop ${JSON.stringify(bad)}`);
  }
});

test("the emailRedirectTo URL the signup action built is unwrapped to its own next", () => {
  // Exactly what actions.ts puts in emailRedirectTo (next is URL-encoded).
  const redirectTo = `${SITE}/auth/confirm?next=${encodeURIComponent("/pricing?plan=month")}`;
  assert.equal(nextFromConfirmLink(redirectTo, SITE), "/pricing?plan=month");
  // The same value after the browser decoded it once, as the query parser
  // hands it over when the template embedded it raw.
  assert.equal(nextFromConfirmLink(`${SITE}/auth/confirm?next=/pricing?plan=month`, SITE), "/pricing?plan=month");
  assert.equal(nextFromConfirmLink(`${SITE}/auth/confirm?next=/reset-password`, SITE), "/reset-password");
  // Nested one level deeper still terminates on the innermost path.
  const nested = `${SITE}/auth/confirm?next=${encodeURIComponent(redirectTo)}`;
  assert.equal(nextFromConfirmLink(nested, SITE), "/pricing?plan=month");
  // /auth/confirm with nothing inside: nothing safe was given.
  assert.equal(nextFromConfirmLink(`${SITE}/auth/confirm`, SITE), "");
});

test("an absolute URL on our own origin becomes its path and query", () => {
  assert.equal(nextFromConfirmLink(`${SITE}/pricing?plan=year`, SITE), "/pricing?plan=year");
  assert.equal(nextFromConfirmLink(`${SITE}/account`, SITE), "/account");
  assert.equal(nextFromConfirmLink(`${SITE}/`, SITE), "/");
  // A trailing slash on the configured site URL doesn't matter.
  assert.equal(nextFromConfirmLink(`${SITE}/account`, `${SITE}/`), "/account");
});

test("an absolute URL on any other origin is dropped, whatever it wraps", () => {
  for (const bad of [
    "https://evil.com/pricing",
    "https://evil.com/auth/confirm?next=/pricing",
    "https://essentialregs.com/pricing", // the bare apex is not the configured origin
    "http://www.essentialregs.com/pricing", // nor plain http
    "https://www.essentialregs.com.evil.com/pricing",
    "https://www.essentialregs.com@evil.com/pricing",
    "https://[bad",
  ]) {
    assert.equal(nextFromConfirmLink(bad, SITE), "", `should drop ${bad}`);
  }
});

test("whatever comes out is a path safeNextPath would also accept", () => {
  for (const raw of [
    "/pricing?plan=year",
    `${SITE}/auth/confirm?next=/pricing?plan=year`,
    `${SITE}/reset-password`,
    "https://evil.com/x",
    "//evil.com",
  ]) {
    const out = nextFromConfirmLink(raw, SITE);
    assert.equal(safeNextPath(out, ""), out);
  }
});
