/**
 * The disclaimer gate in front of account creation (src/lib/disclaimer.ts):
 * the signup action only accepts a form that says the current revision of
 * the disclaimer was accepted, and what it stores on the account.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCEPT_FIELD,
  ACCEPT_VALUE,
  DISCLAIMER_VERSION,
  VERSION_FIELD,
  readDisclaimerAcceptance,
} from "../src/lib/disclaimer";

const form = (fields: Record<string, unknown>) => ({ get: (name: string) => fields[name] ?? null });
const NOW = new Date("2026-09-28T13:10:00Z");

test("the version is an ISO date, so it sorts and reads as one", () => {
  assert.match(DISCLAIMER_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(new Date(DISCLAIMER_VERSION).getTime()));
});

test("the account form's two hidden fields are what unlocks sign-up", () => {
  assert.deepEqual(
    readDisclaimerAcceptance(form({ [ACCEPT_FIELD]: ACCEPT_VALUE, [VERSION_FIELD]: DISCLAIMER_VERSION }), NOW),
    { disclaimer_accepted_at: "2026-09-28T13:10:00.000Z", disclaimer_version: DISCLAIMER_VERSION }
  );
});

test("no acceptance, a wrong value, or the wrong field type is refused", () => {
  assert.equal(readDisclaimerAcceptance(form({}), NOW), null);
  assert.equal(readDisclaimerAcceptance(form({ [VERSION_FIELD]: DISCLAIMER_VERSION }), NOW), null);
  for (const bad of ["", "0", "true", "yes", 1, true, ["1"]]) {
    assert.equal(
      readDisclaimerAcceptance(form({ [ACCEPT_FIELD]: bad, [VERSION_FIELD]: DISCLAIMER_VERSION }), NOW),
      null,
      `should refuse accepted=${JSON.stringify(bad)}`
    );
  }
});

test("accepting an older or unknown revision of the text is refused", () => {
  for (const bad of ["2020-01-01", "", "latest", undefined, null]) {
    assert.equal(
      readDisclaimerAcceptance(form({ [ACCEPT_FIELD]: ACCEPT_VALUE, [VERSION_FIELD]: bad }), NOW),
      null,
      `should refuse version=${JSON.stringify(bad)}`
    );
  }
});
