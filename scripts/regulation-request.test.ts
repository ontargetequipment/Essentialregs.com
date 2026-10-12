/**
 * The /request form's server-side rules (src/lib/regulation-request.ts): the
 * validator (lengths, email shape, URL scheme, jurisdiction list), the
 * honeypot and too-fast guards, and the notification's subject and body. No
 * database, no Next.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HONEYPOT_FIELD,
  JURISDICTION_OPTIONS,
  LIMITS,
  MIN_SUBMIT_MS,
  RENDERED_AT_FIELD,
  REQUEST_STATUSES,
  US_STATES,
  honeypotTripped,
  isAllowedSourceUrl,
  jurisdictionLabel,
  readRequestFields,
  requestEmailBody,
  requestSubject,
  submittedTooFast,
  validateRegulationRequest,
  type RequestFields,
} from "../src/lib/regulation-request";

const GOOD: RequestFields = {
  regulation: "OSHA 29 CFR 1910",
  jurisdiction: "federal",
  agency: "OSHA",
  source_url: "https://www.ecfr.gov/current/title-29/part-1910",
  reason: "Annual safety audit at two compressor stations.",
  email: "Someone@Example.com",
  company: "Example Midstream",
};

test("jurisdictions: Federal, the fifty states alphabetically, Other", () => {
  assert.equal(US_STATES.length, 50);
  assert.deepEqual([...US_STATES].sort((a, b) => a.localeCompare(b)), [...US_STATES]);
  assert.equal(JURISDICTION_OPTIONS[0].label, "Federal");
  assert.equal(JURISDICTION_OPTIONS.at(-1)?.label, "Other");
  assert.equal(JURISDICTION_OPTIONS.length, 52);
  assert.equal(jurisdictionLabel("federal"), "Federal");
  assert.equal(jurisdictionLabel("Wyoming"), "Wyoming");
  assert.equal(jurisdictionLabel("other"), "Other");
  assert.deepEqual([...REQUEST_STATUSES], ["new", "planned", "building", "done", "declined"]);
});

test("a good request validates: trimmed, email lower-cased, empty optionals null", () => {
  const r = validateRegulationRequest({ ...GOOD, agency: "  ", company: "" });
  assert.ok(r.ok);
  assert.deepEqual(r.value, {
    regulation: "OSHA 29 CFR 1910",
    jurisdiction: "federal",
    agency: null,
    source_url: "https://www.ecfr.gov/current/title-29/part-1910",
    reason: "Annual safety audit at two compressor stations.",
    email: "someone@example.com",
    company: null,
  });
});

test("every state and Other are accepted as a jurisdiction; anything else is not", () => {
  for (const j of ["Colorado", "Wyoming", "New Mexico", "other"]) {
    assert.ok(validateRegulationRequest({ ...GOOD, jurisdiction: j }).ok, j);
  }
  for (const j of ["", "colorado", "CO", "Canada", "federal "]) {
    const r = validateRegulationRequest({ ...GOOD, jurisdiction: j });
    // "federal " trims to a valid value; the rest are rejected.
    if (j === "federal ") assert.ok(r.ok);
    else assert.ok(!r.ok && r.errors.jurisdiction, j);
  }
});

test("lengths: regulation 3-200, agency/company 200, reason 1000, url 2000", () => {
  const long = (n: number) => "x".repeat(n);
  let r = validateRegulationRequest({ ...GOOD, regulation: "ab" });
  assert.ok(!r.ok && r.errors.regulation);
  r = validateRegulationRequest({ ...GOOD, regulation: "   a b  " }); // collapses to "a b" (3)
  assert.ok(r.ok);
  r = validateRegulationRequest({ ...GOOD, regulation: long(LIMITS.regulationMax + 1) });
  assert.ok(!r.ok && r.errors.regulation);
  r = validateRegulationRequest({ ...GOOD, regulation: long(LIMITS.regulationMax) });
  assert.ok(r.ok);
  r = validateRegulationRequest({ ...GOOD, agency: long(201), company: long(201), reason: long(1001) });
  assert.ok(!r.ok);
  assert.deepEqual(Object.keys(r.errors).sort(), ["agency", "company", "reason"]);
  r = validateRegulationRequest({ ...GOOD, source_url: "https://example.com/" + long(2000) });
  assert.ok(!r.ok && r.errors.source_url);
});

test("email shape", () => {
  for (const bad of ["", "   ", "nobody", "a@b", "a b@c.com", "@example.com", "a@@b.com"]) {
    const r = validateRegulationRequest({ ...GOOD, email: bad });
    assert.ok(!r.ok && r.errors.email, JSON.stringify(bad));
  }
  for (const good of ["a@b.co", "first.last+tag@sub.example.org", " brodykerr95+req1@gmail.com "]) {
    assert.ok(validateRegulationRequest({ ...GOOD, email: good }).ok, good);
  }
});

test("the link is optional, and must be http(s) when given", () => {
  assert.ok(validateRegulationRequest({ ...GOOD, source_url: "" }).ok);
  assert.ok(validateRegulationRequest({ ...GOOD, source_url: "http://osha.gov/x" }).ok);
  for (const bad of ["javascript:alert(1)", "ftp://example.com/x", "ecfr.gov/title-29", "mailto:a@b.com", "https://user:pw@example.com/"]) {
    const r = validateRegulationRequest({ ...GOOD, source_url: bad });
    assert.ok(!r.ok && r.errors.source_url, bad);
    assert.equal(isAllowedSourceUrl(bad), false, bad);
  }
});

test("honeypot: anything in the hidden field trips it; empty or absent does not", () => {
  assert.equal(honeypotTripped(""), false);
  assert.equal(honeypotTripped("   "), false);
  assert.equal(honeypotTripped(null), false);
  assert.equal(honeypotTripped(undefined), false);
  assert.equal(honeypotTripped("https://spam.example"), true);
  assert.equal(honeypotTripped("x"), true);
  assert.equal(HONEYPOT_FIELD, "website");
});

test("timing: under 3 s after render, missing, malformed or future render times are too fast", () => {
  const now = 1_760_000_000_000;
  const at = (ms: number) => String(now - ms);
  assert.equal(submittedTooFast(at(0), now), true);
  assert.equal(submittedTooFast(at(MIN_SUBMIT_MS - 1), now), true);
  assert.equal(submittedTooFast(at(MIN_SUBMIT_MS), now), false);
  assert.equal(submittedTooFast(at(45_000), now), false);
  assert.equal(submittedTooFast(String(now + 10), now), true, "future");
  assert.equal(submittedTooFast(undefined, now), true, "missing");
  assert.equal(submittedTooFast(null, now), true);
  assert.equal(submittedTooFast("", now), true);
  assert.equal(submittedTooFast("yesterday", now), true);
  assert.equal(submittedTooFast("12", now), true, "too short to be ms since the epoch");
  assert.equal(RENDERED_AT_FIELD, "rendered_at");
});

test("readRequestFields: strings pass through, anything else is empty", () => {
  const fd = new Map<string, unknown>([
    ["regulation", "Reg 7"],
    ["jurisdiction", "Colorado"],
    ["email", new Blob(["x"])],
  ]);
  const f = readRequestFields((n) => fd.get(n));
  assert.equal(f.regulation, "Reg 7");
  assert.equal(f.jurisdiction, "Colorado");
  assert.equal(f.email, "");
  assert.equal(f.company, "");
});

test("the notification: subject names the regulation and jurisdiction; body has every field and the admin link", () => {
  const r = validateRegulationRequest(GOOD);
  assert.ok(r.ok);
  assert.equal(requestSubject(r.value), "Regulation request: OSHA 29 CFR 1910 (Federal)");
  const body = requestEmailBody(r.value, {
    id: "00000000-0000-0000-0000-000000000001",
    createdAt: "2026-10-12T03:14:24.000Z",
    userId: null,
    adminUrl: "https://www.essentialregs.com/admin/requests",
  });
  for (const line of [
    "Regulation: OSHA 29 CFR 1910",
    "Jurisdiction: Federal",
    "Agency: OSHA",
    "Link to the official text: https://www.ecfr.gov/current/title-29/part-1910",
    "What they are working on: Annual safety audit at two compressor stations.",
    "Email: someone@example.com",
    "Company: Example Midstream",
    "Signed in: no",
    "Triage it: https://www.essentialregs.com/admin/requests",
  ]) {
    assert.ok(body.includes(line), line);
  }
  const noOptionals = requestEmailBody({ ...r.value, agency: null, company: null }, { id: "x", createdAt: "t", userId: "u1", adminUrl: "a" });
  assert.ok(noOptionals.includes("Agency: -"));
  assert.ok(noOptionals.includes("Signed in: yes (user u1)"));
});
