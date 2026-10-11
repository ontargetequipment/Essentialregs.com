/**
 * The visitor's related-provisions teaser (Sprint 4, 10 Oct 2026): a
 * neighbour outside the public regulations is citation and title only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { teaserItem } from "../src/lib/related-teaser";

const base = {
  id: "sec-gp12-VI-A-1",
  citation: "VI.A.1.",
  title: "Storage tank control",
  reg_key: "gp12",
  path: "VI. Requirements › VI.A. Storage Tanks",
  summary: "Tanks must route vapors to a control device.",
  summary_badge: { kind: "reviewed", label: "AI-generated", compactLabel: "AI", title: "x" },
};

test("a neighbour in a paid regulation keeps citation and title, loses summary, badge and path", () => {
  const out = teaserItem(base);
  assert.equal(out.citation, "VI.A.1.");
  assert.equal(out.title, "Storage tank control");
  assert.equal(out.summary, null);
  assert.equal(out.summary_badge, null);
  assert.equal(out.path, null);
  assert.ok(!("full_text" in out));
});

test("a GP05 neighbour keeps what GP05's open reader already shows", () => {
  const gp05 = { ...base, id: "sec-gp05-I-A-1", reg_key: "gp05" };
  assert.deepEqual(teaserItem(gp05), gp05);
});

test("a row with no regulation key is treated as locked", () => {
  const out = teaserItem({ ...base, reg_key: null });
  assert.equal(out.summary, null);
  assert.equal(out.path, null);
});

test("a neighbour in the public Regulation 7 I.C.1 subtree is citation and title only too (Sprint 7)", () => {
  // The rows are public for the focused preview and /regs/<id>, but Regulation 7 is not a
  // PUBLIC_READER_REGS regulation: the related teaser (service role) shows no summary or path.
  const sub = { ...base, id: "sec-7-B-I-C-1-a", reg_key: "7", citation: "I.C.1.a.", title: "" };
  const out = teaserItem(sub);
  assert.equal(out.summary, null);
  assert.equal(out.summary_badge, null);
  assert.equal(out.path, null);
  assert.equal(out.citation, "I.C.1.a.");
});
