/**
 * What /pricing says the subscription includes (Sprint 5, 10 Oct 2026,
 * src/lib/plan-includes.ts): the list covers what the product offers, repeats
 * no price (the amounts live in src/lib/pricing.ts and did not change), and
 * the plan's one price strings are what they were.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanChoice } from "../src/components/PlanChoice";
import { PLAN_INCLUDES } from "../src/lib/plan-includes";
import { ANNUAL_PRICE_DISPLAY, MONTHLY_PRICE_DISPLAY } from "../src/lib/pricing";

test("the list names the corpus, summaries, search, Ask, cross-references and test methods", () => {
  const leads = PLAN_INCLUDES.map((i) => i.lead.toLowerCase());
  for (const topic of ["corpus", "summaries", "search", "ask", "cross-reference", "test methods"]) {
    assert.ok(leads.some((l) => l.includes(topic)), topic);
  }
  assert.match(PLAN_INCLUDES[0].lead, /Colorado and federal/);
  for (const i of PLAN_INCLUDES) {
    assert.ok(i.lead.trim() && i.detail.trim(), i.lead);
  }
});

test("no amount in the list, and the prices are the owner's $25 / $250", () => {
  for (const i of PLAN_INCLUDES) assert.ok(!/\$|\d+\s*\/\s*(month|year)/i.test(`${i.lead} ${i.detail}`), i.lead);
  assert.equal(MONTHLY_PRICE_DISPLAY, "$25 / month");
  assert.equal(ANNUAL_PRICE_DISPLAY, "$250 / year");
});

test("Ask is described as finding provisions, not deciding applicability", () => {
  const ask = PLAN_INCLUDES.find((i) => i.lead === "Ask");
  assert.ok(ask);
  assert.match(ask!.detail, /does not decide what applies to you/);
});

// The plan buttons on /pricing (Sprint 5, 10 Oct 2026): "Start your 7-day free
// trial" wherever a trial is granted, the destination unchanged.
const NO_USER = {
  user: null,
  hasAccess: false,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  manualOverride: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  plan: null,
};

test("PlanChoice trialButtons: a visitor's two plan buttons read 'Start your 7-day free trial' and still go to /signup?plan=", () => {
  const html = renderToStaticMarkup(createElement(PlanChoice, { access: NO_USER, trialButtons: true }));
  assert.equal(html.match(/Start your 7-day free trial/g)?.length, 2);
  assert.ok(!html.includes("Create an account to subscribe"));
  assert.ok(html.includes('href="/signup?plan=month"') && html.includes('href="/signup?plan=year"'));
  // The amounts are the owner's, once each.
  assert.ok(html.includes("$25") && html.includes("$250"));
});

test("PlanChoice without trialButtons keeps the old wording (homepage card, /signup flow)", () => {
  const html = renderToStaticMarkup(createElement(PlanChoice, { access: NO_USER }));
  assert.equal(html.match(/Create an account to subscribe/g)?.length, 2);
  assert.ok(!html.includes("Start your 7-day free trial"));
});

test("an account that has had a subscription is not told it gets a trial", () => {
  const lapsed = { ...NO_USER, user: { id: "u", email: "a@b.c" } as never, stripeSubscriptionId: "sub_1" };
  const html = renderToStaticMarkup(createElement(PlanChoice, { access: lapsed, trialButtons: true }));
  assert.ok(!html.includes("free trial"));
  assert.equal(html.match(/>Subscribe</g)?.length, 2);
});
