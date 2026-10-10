/**
 * The one federal citation formatter (Sprint 5, 10 Oct 2026,
 * src/lib/federal-citation.ts). The bad example is the one a reviewer saw:
 * "OOOOA 60.5365a.(e)". Inputs are the shapes the corpus really has: ids
 * ("sec-ooooa-60.5365a-(e)", pipeline/out/corpus_ids.json) and stored
 * citations ("§ 60.5365a(e)", import_ecfr.py).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  displayCitation,
  federalCitationPrefix,
  federalIdLabel,
  formatFederalCitation,
  normalizeFederalSection,
} from "../src/lib/federal-citation";
import { citeLabel } from "../src/lib/premise-notes";

test("the reviewer's example: OOOOa section 60.5365a(e) reads 'OOOOa § 60.5365a(e)', never 'OOOOA 60.5365a.(e)'", () => {
  assert.equal(federalIdLabel("sec-ooooa-60.5365a-(e)"), "OOOOa § 60.5365a(e)");
  assert.equal(formatFederalCitation("ooooa", "§ 60.5365a(e)"), "OOOOa § 60.5365a(e)");
  assert.equal(formatFederalCitation("ooooa", "60.5365a.(e)"), "OOOOa § 60.5365a(e)");
  assert.equal(citeLabel("sec-ooooa-60.5365a-(e)"), "OOOOa § 60.5365a(e)");
  for (const s of [
    federalIdLabel("sec-ooooa-60.5365a-(e)"),
    citeLabel("sec-ooooa-60.5365a-(e)"),
    formatFederalCitation("ooooa", "60.5365a.(e)"),
  ]) {
    assert.ok(!/OOOOA/.test(s ?? ""), "the subpart keeps its real case");
    assert.ok(!/\.\(/.test(s ?? ""), "no period before a paragraph");
  }
});

test("subpart names keep their case: OOOO, OOOOa, OOOOb, OOOOc, JJJJ, IIII, ZZZZ", () => {
  assert.equal(federalCitationPrefix("oooo"), "OOOO");
  assert.equal(federalCitationPrefix("ooooa"), "OOOOa");
  assert.equal(federalCitationPrefix("oooob"), "OOOOb");
  assert.equal(federalCitationPrefix("OOOOC"), "OOOOc", "the key's own case does not matter");
  assert.equal(federalCitationPrefix("jjjj"), "JJJJ");
  assert.equal(federalCitationPrefix("iiii"), "IIII");
  assert.equal(federalCitationPrefix("zzzz"), "ZZZZ");
  assert.equal(federalCitationPrefix("p192"), "49 CFR");
  assert.equal(federalCitationPrefix("7"), null);
  assert.equal(federalCitationPrefix("gp05"), null);
  assert.equal(federalCitationPrefix("ecmc"), null);
  assert.equal(federalCitationPrefix(null), null);
});

test("paragraph chains close up against the section: 60.5416(b)(1), (a)(1)(i)", () => {
  assert.equal(federalIdLabel("sec-oooo-60.5416-(b)-(1)"), "OOOO § 60.5416(b)(1)");
  assert.equal(federalIdLabel("sec-oooob-60.5365b-(a)-(1)"), "OOOOb § 60.5365b(a)(1)");
  assert.equal(federalIdLabel("sec-oooob-60.5365b-(e)-(3)"), "OOOOb § 60.5365b(e)(3)");
  assert.equal(federalIdLabel("sec-ooooc-60.5375c-(a)-(1)"), "OOOOc § 60.5375c(a)(1)");
  assert.equal(federalIdLabel("sec-jjjj-60.4243-(b)-(2)-(i)"), "JJJJ § 60.4243(b)(2)(i)");
  assert.equal(normalizeFederalSection("§ 60.5416(b)(1)"), "§ 60.5416(b)(1)");
  assert.equal(normalizeFederalSection("§60.5416 (b)(1)"), "§ 60.5416(b)(1)");
  assert.equal(normalizeFederalSection("60.5416 ( b ) ( 1 ) "), "§ 60.5416(b)(1)");
  assert.equal(normalizeFederalSection("§ 60.5416(b).(1)"), "§ 60.5416(b)(1)");
  assert.equal(normalizeFederalSection("§ 60.5416(b)(1)."), "§ 60.5416(b)(1)", "a trailing period goes");
});

test("a whole section has a section sign and no paragraph", () => {
  assert.equal(federalIdLabel("sec-oooo-60.5365"), "OOOO § 60.5365");
  assert.equal(federalIdLabel("sec-ooooa-60.5365a"), "OOOOa § 60.5365a");
  assert.equal(federalIdLabel("sec-jjjj-60.4230"), "JJJJ § 60.4230");
  assert.equal(federalIdLabel("sec-zzzz-63.6585"), "ZZZZ § 63.6585");
  assert.equal(normalizeFederalSection("60.5365a"), "§ 60.5365a");
  assert.equal(normalizeFederalSection("§ 60.5365a"), "§ 60.5365a");
});

test("PHMSA, 49 CFR: '49 CFR § 192.605(b)', whole sections and Part 193's numbering", () => {
  assert.equal(federalIdLabel("sec-p192-192.605-(b)"), "49 CFR § 192.605(b)");
  assert.equal(federalIdLabel("sec-p192-192.1"), "49 CFR § 192.1");
  assert.equal(federalIdLabel("sec-p195-195.452-(h)-(4)-(iii)"), "49 CFR § 195.452(h)(4)(iii)");
  assert.equal(federalIdLabel("sec-p193-193.2001"), "49 CFR § 193.2001");
  assert.equal(federalIdLabel("sec-p190-190.207"), "49 CFR § 190.207");
  assert.equal(formatFederalCitation("p192", "§ 192.605(b)"), "49 CFR § 192.605(b)");
});

test("rows that are not a section: tables, appendices, documents, definitions, ranges", () => {
  assert.equal(federalIdLabel("sec-oooo-top-REG-oooo"), "OOOO (document)");
  assert.equal(federalIdLabel("sec-oooob-top-REG-oooob"), "OOOOb (document)");
  assert.equal(federalIdLabel("sec-oooo-TABLE-1"), "OOOO Table 1");
  assert.equal(federalIdLabel("sec-zzzz-TABLE-2a"), "ZZZZ Table 2a");
  assert.equal(federalIdLabel("sec-zzzz-APPENDIX-A"), "ZZZZ Appendix A");
  assert.equal(federalIdLabel("sec-p192-192.1001-excavation-damage"), "49 CFR § 192.1001 (excavation damage)");
  assert.equal(federalIdLabel("sec-ooooa-60.5433a-60.5439a"), "OOOOa §§ 60.5433a-60.5439a");
  assert.equal(normalizeFederalSection("§§ 60.5433a-60.5439a"), "§§ 60.5433a-60.5439a");
  // Not federal, or not understood: null, so the caller falls back to its own label.
  assert.equal(federalIdLabel("sec-gp01-I-A-1"), null);
  assert.equal(federalIdLabel("sec-3-A-II-A-1"), null);
  assert.equal(federalIdLabel("not-an-id"), null);
  assert.equal(federalIdLabel("sec-oooo-heading-1"), null);
  assert.equal(normalizeFederalSection("Table 1 to Subpart OOOO of Part 60"), null);
  assert.equal(normalizeFederalSection("II.A.4."), null);
  assert.equal(normalizeFederalSection(""), null);
  assert.equal(normalizeFederalSection(null), null);
});

test("displayCitation guards the stored citation a card prints beside the regulation's name", () => {
  assert.equal(displayCitation("ooooa", "§ 60.5365a(e)"), "§ 60.5365a(e)");
  assert.equal(displayCitation("ooooa", "60.5365a.(e)"), "§ 60.5365a(e)");
  assert.equal(displayCitation("OOOOA", "§ 60.5365a. (e)"), "§ 60.5365a(e)");
  assert.equal(displayCitation("p192", "§ 192.605(b)"), "§ 192.605(b)");
  // A heading, a table or a root is what it is.
  assert.equal(displayCitation("oooo", "Table 1 to Subpart OOOO of Part 60"), "Table 1 to Subpart OOOO of Part 60");
  assert.equal(displayCitation("oooo", "40 CFR Part 60 Subpart OOOO"), "40 CFR Part 60 Subpart OOOO");
  // Colorado citations are never touched, and neither is a missing key.
  assert.equal(displayCitation("7", "I.D.3.a.(i)."), "I.D.3.a.(i).");
  assert.equal(displayCitation("gp05", "I.A.1"), "I.A.1");
  assert.equal(displayCitation(null, "60.5365a.(e)"), "60.5365a.(e)");
});

test("citeLabel keeps the Colorado labels it always had", () => {
  assert.equal(citeLabel("sec-gp01-I-A-1"), "GP01 I.A.1");
  assert.equal(citeLabel("sec-3-A-II-A-1"), "Regulation 3 Part A II.A.1");
  assert.equal(citeLabel("sec-gp09-top-REG-gp09"), "GP09 (document)");
  assert.equal(citeLabel("sec-ecmc-314-e"), "ECMC 314.e");
});

test("every federal id in the corpus gets a label that never has the bad shapes", () => {
  const corpus = JSON.parse(readFileSync(new URL("../pipeline/out/corpus_ids.json", import.meta.url), "utf8")) as Record<string, string[]>;
  let labelled = 0;
  for (const key of ["oooo", "ooooa", "oooob", "ooooc", "jjjj", "iiii", "zzzz", "p190", "p191", "p192", "p193", "p194", "p195", "p196", "p199"]) {
    for (const id of corpus[key] ?? []) {
      const label = federalIdLabel(id);
      if (label === null) continue;
      labelled += 1;
      assert.ok(!/OOOO[A-Z]/.test(label), `${id}: ${label}`);
      assert.ok(!/\.\(|\)\.|\)-|\s{2}/.test(label), `${id}: ${label}`);
      assert.ok(/§| \(document\)$| Table | Appendix /.test(label), `${id}: ${label}`);
    }
  }
  assert.ok(labelled > 8000, `labelled ${labelled} federal ids`);
});
