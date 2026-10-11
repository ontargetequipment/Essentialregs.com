/**
 * The back link on a provision's own page, /regs/<id> (src/lib/provision-back.ts),
 * 11 Oct 2026. The 13 Regulation 7 rows made public in Sprint 7 (I.C.1 and
 * below) read "← Back to sample"; a Regulation 7 row goes back to Regulation 7,
 * to the document's visitor preview focused on the row's Part. Every other
 * case keeps what it did.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { provisionBackLink } from "../src/lib/provision-back";

const VISITOR = { hasAccess: false };
const SUBSCRIBER = { hasAccess: true };

const REG7_PUBLIC = [
  "sec-7-B-I-C-1",
  "sec-7-B-I-C-1-a",
  "sec-7-B-I-C-1-b",
  "sec-7-B-I-C-1-c",
  "sec-7-B-I-C-1-d",
  "sec-7-B-I-C-1-e",
  "sec-7-B-I-C-1-e-(i)",
  "sec-7-B-I-C-1-e-(ii)",
  "sec-7-B-I-C-1-e-(iii)",
  "sec-7-B-I-C-1-e-(iv)",
  "sec-7-B-I-C-1-f",
  "sec-7-B-I-C-1-f-(i)",
  "sec-7-B-I-C-1-f-(ii)",
];

test("each of the 13 public Regulation 7 rows goes back to Regulation 7's visitor preview, focused on Part B", () => {
  for (const id of REG7_PUBLIC) {
    assert.deepEqual(
      provisionBackLink({ id, is_public: true }, VISITOR),
      { href: "/regulations/7/preview?p=sec-7-P-B", label: "← Back to Regulation 7" },
      id
    );
  }
});

test("the older public Regulation 7 sample row (I.D.3.a.(i)) is a Regulation 7 row too", () => {
  assert.deepEqual(provisionBackLink({ id: "sec-7-B-I-D-3-a-(i)", is_public: true }, VISITOR), {
    href: "/regulations/7/preview?p=sec-7-P-B",
    label: "← Back to Regulation 7",
  });
});

test("a public row whose id names no Part goes back to the document's plain preview", () => {
  assert.deepEqual(provisionBackLink({ id: "sec-ecmc-100-DEF-TANK", is_public: true }, VISITOR), {
    href: "/regulations/ecmc/preview",
    label: "← Back to 2 CCR 404-1 (ECMC Rules)",
  });
  // A Part with the Part letter first, as Regulation 3 stores it.
  assert.equal(provisionBackLink({ id: "sec-3-A-II-D-1", is_public: true }, VISITOR).href, "/regulations/3/preview?p=sec-3-P-A");
});

test("a subscriber who lands on a public row goes back to it in the reader, as for any other row", () => {
  assert.deepEqual(provisionBackLink({ id: "sec-7-B-I-C-1-a", is_public: true }, SUBSCRIBER), {
    href: "/regulations/7#sec-7-B-I-C-1-a",
    label: "← Back to Regulation 7",
  });
});

test("GP05 rows are unchanged: back to the row in GP05's open reader, for a visitor and a subscriber", () => {
  for (const viewer of [VISITOR, SUBSCRIBER]) {
    const back = provisionBackLink({ id: "sec-gp05-VI-C", is_public: true }, viewer);
    assert.equal(back.href, "/regulations/gp05#sec-gp05-VI-C");
    assert.match(back.label, /^← Back to .*GP05/);
    assert.notEqual(back.label, "← Back to sample");
  }
});

test("a row with no regulation key (a hand-written sample) still goes back to the sample", () => {
  for (const id of ["sample-row-1", "nonsense"]) {
    for (const is_public of [true, false]) {
      assert.deepEqual(provisionBackLink({ id, is_public }, VISITOR), { href: "/sample", label: "← Back to sample" }, id);
    }
  }
});

test("a locked row keeps its old link: the reader for a subscriber, the preview for anyone else", () => {
  assert.deepEqual(provisionBackLink({ id: "sec-7-B-I-B-33", is_public: false }, SUBSCRIBER), {
    href: "/regulations/7#sec-7-B-I-B-33",
    label: "← Back to Regulation 7",
  });
  assert.deepEqual(provisionBackLink({ id: "sec-7-B-I-B-33", is_public: false }, VISITOR), {
    href: "/regulations/7/preview",
    label: "← Back to Regulation 7",
  });
});
