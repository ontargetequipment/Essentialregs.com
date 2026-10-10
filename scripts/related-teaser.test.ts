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
