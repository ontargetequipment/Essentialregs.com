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
