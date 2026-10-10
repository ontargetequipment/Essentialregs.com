/**
 * provisionDestination (src/lib/destination.ts): where a result card or
 * related-provision link opens a provision, by who is looking.
 * Run by `npm test` (tsx --test scripts/*.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_READER_REGS, isPublicReaderReg, provisionDestination } from "../src/lib/destination";

const PAREN_IDS = ["sec-7-B-I-D-3-a-(i)", "sec-ecmc-604-a-(1)"];

test("a hit with no regulation key opens the standalone card, whoever is looking", () => {
  for (const hasAccess of [true, false]) {
    assert.equal(provisionDestination({ id: "sample-1", reg_key: null }, { hasAccess }), "/regs/sample-1");
  }
});

test("a subscriber gets the exact provision in the reader", () => {
  assert.equal(
    provisionDestination({ id: "sec-gp12-VI-A-1", reg_key: "gp12" }, { hasAccess: true }),
    "/regulations/gp12#sec-gp12-VI-A-1"
  );
});

test("anyone else gets the focused preview", () => {
  assert.equal(
    provisionDestination({ id: "sec-gp12-VI-A-1", reg_key: "gp12" }, { hasAccess: false }),
    "/regulations/gp12/preview?p=sec-gp12-VI-A-1"
  );
});

test("a regulation in publicRegs opens the reader for a visitor without access", () => {
  assert.equal(
    provisionDestination({ id: "sec-gp05-II-A", reg_key: "gp05" }, { hasAccess: false, publicRegs: ["gp05"] }),
    "/regulations/gp05#sec-gp05-II-A"
  );
  // ...but only that regulation.
  assert.equal(
    provisionDestination({ id: "sec-gp12-VI-A-1", reg_key: "gp12" }, { hasAccess: false, publicRegs: ["gp05"] }),
    "/regulations/gp12/preview?p=sec-gp12-VI-A-1"
  );
});

test("publicRegs defaults to PUBLIC_READER_REGS", () => {
  const reg = "gp12";
  assert.ok(!PUBLIC_READER_REGS.includes(reg));
  assert.equal(
    provisionDestination({ id: `sec-${reg}-I`, reg_key: reg }, { hasAccess: false }),
    `/regulations/${reg}/preview?p=sec-${reg}-I`
  );
  for (const r of PUBLIC_READER_REGS) {
    assert.equal(provisionDestination({ id: `sec-${r}-I`, reg_key: r }, { hasAccess: false }), `/regulations/${r}#sec-${r}-I`);
  }
});

test("ids with parentheses are percent-encoded in ?p= and left as-is in the hash", () => {
  const reg = (id: string) => /^sec-([^-]+)-/.exec(id)![1];
  for (const id of PAREN_IDS) {
    const hit = { id, reg_key: reg(id) };
    const preview = provisionDestination(hit, { hasAccess: false });
    assert.equal(preview, `/regulations/${hit.reg_key}/preview?p=${encodeURIComponent(id)}`);
    const p = new URL(preview, "https://x.test").searchParams.get("p");
    assert.equal(p, id, "round-trips through the query string");
    assert.equal(provisionDestination(hit, { hasAccess: true }), `/regulations/${hit.reg_key}#${id}`);
  }
});

test("GP05 is the one regulation whose reader is open to a visitor (Sprint 4, 10 Oct 2026)", () => {
  assert.deepEqual([...PUBLIC_READER_REGS], ["gp05"]);
  assert.equal(isPublicReaderReg("gp05"), true);
  assert.equal(isPublicReaderReg("GP05"), true);
  for (const other of ["gp12", "7", "3", "ecmc", "gp050", "", null, undefined]) {
    assert.equal(isPublicReaderReg(other), false, String(other));
  }
  assert.equal(
    provisionDestination({ id: "sec-gp05-II-D", reg_key: "gp05" }, { hasAccess: false }),
    "/regulations/gp05#sec-gp05-II-D"
  );
  assert.equal(
    provisionDestination({ id: "sec-7-B-V-C-2-w", reg_key: "7" }, { hasAccess: false }),
    "/regulations/7/preview?p=sec-7-B-V-C-2-w"
  );
});
