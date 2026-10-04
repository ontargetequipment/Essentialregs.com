/**
 * EssentialRegs notes inside official text (Sprint 3): the importer's "[sic]"
 * marker (span.er-sic with a tooltip) and the curated equation blocks
 * (figure.equation with stacked fractions, var/sub/sup and a copyable
 * pre.eq-text) must come through sanitizeHtml and sanitizeCardHtml intact,
 * while the rest of the allowlist stays as tight as it was.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeCardHtml, sanitizeHtml } from "../src/lib/regulation-pure";

const SIC =
  '<p>BSFC is the Break Specific Fuel Consumption<span class="er-sic" title="Printed this way in the official document."> [sic]</span> at 100% load</p>';

const EQUATION =
  '<div class="equation-block"><p class="er-note eq-note">Equation transcribed by EssentialRegs from page 18 of GP12.pdf.</p>' +
  '<figure class="equation"><div class="eq-math"><var>Fuel Consumption</var><sub>engine</sub> ' +
  '<span class="eq-paren">(</span><span class="eq-frac"><span class="eq-num">MMSCF</span><span class="eq-den">month</span></span><span class="eq-paren">)</span> = ' +
  '<span class="eq-frac"><span class="eq-num"><var>Hours of operation</var></span><span class="eq-den"><var>Fuel Gas Heat Content</var> × 10<sup>6</sup></span></span></div>' +
  '<pre class="eq-text">Fuel Consumption_engine (MMSCF/month) = [Hours of operation] / [Fuel Gas Heat Content × 10^6]</pre></figure></div>';

const TABLE_SUB = '<table class="doc-table"><thead><tr><th>NO<sub>X</sub> (g/hp-hr)</th></tr></thead></table>';

test("sanitizeHtml keeps the [sic] span, its class and its tooltip", () => {
  const out = sanitizeHtml(SIC);
  assert.ok(out.includes('<span class="er-sic" title="Printed this way in the official document."> [sic]</span>'), out);
});

test("title stays allowed on spans only", () => {
  assert.ok(!sanitizeHtml('<a href="https://example.com" title="t">x</a>').includes("title="));
  assert.ok(!sanitizeHtml('<p title="t">x</p>').includes("title="));
  assert.ok(sanitizeHtml('<span title="t">x</span>').includes('title="t"'));
});

test("sanitizeHtml carries the equation markup unchanged", () => {
  assert.equal(sanitizeHtml(EQUATION), EQUATION);
  assert.equal(sanitizeHtml(TABLE_SUB), TABLE_SUB);
});

test("sanitizeCardHtml carries the same markup for the logged-out card", () => {
  assert.equal(sanitizeCardHtml(EQUATION, false), EQUATION);
  assert.ok(sanitizeCardHtml(SIC, false).includes('class="er-sic"'));
});

test("the equation classes do not open a hole: scripts and handlers still go", () => {
  const out = sanitizeHtml('<figure class="equation" onclick="x()"><script>alert(1)</script><var style="position:fixed">E</var></figure>');
  assert.ok(!out.includes("onclick") && !out.includes("<script") && !out.includes("position"), out);
});
