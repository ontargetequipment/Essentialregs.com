/**
 * The marketing pages (/sample, /federal, /general-permits) are read by
 * logged-out prospects, whose RLS-bound client sees only `is_public` rows
 * -- never a regulation's root row. This proves the page logic produces
 * the same cards for a prospect as for a subscriber once the roots come
 * from the anonymous-safe fetchRegulationRoots (src/lib/regulation.ts),
 * using the live root rows' id/citation/title metadata as the fixture (no
 * database, no Next).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { regKeyOf, rootIdOf, sampleCards } from "../src/lib/regulation-pure";

// The four public sample rows as stored (id, bare citation, title).
const PUBLIC_ROWS = [
  { id: "sec-cp-I-G-90", citation: "I.G.90.", title: "I.G.90. POTENTIAL TO EMIT" },
  { id: "sec-ecmc-604-a-(1)", citation: "604.a.(1).", title: "604.a.(1)." },
  { id: "sec-gp02-II-A-2", citation: "II.A.2.", title: "II.A.2." },
  { id: "sec-7-B-I-D-3-a-(i)", citation: "I.D.3.a.(i).", title: "I.D.3.a.(i)." },
];

// Their regulations' root rows, as fetchRegulationRoots returns them.
const SAMPLE_ROOTS = [
  { id: "sec-7-top-REG-7", citation: "Regulation 7" },
  { id: "sec-cp-top-REG-cp", citation: "Code of Colorado Regulations · Common Provisions Regulation" },
  { id: "sec-ecmc-top-REG-ecmc", citation: "Code of Colorado Regulations · 2 CCR 404-1" },
  { id: "sec-gp02-top-REG-gp02", citation: "APCD General Permit GP02" },
];

const SAMPLE_ORDER = ["sec-7-B-I-D-3-a-(i)", "sec-gp02-II-A-2", "sec-ecmc-604-a-(1)", "sec-cp-I-G-90"];

test("/sample asks for exactly its rows' root ids", () => {
  const keys = Array.from(new Set(PUBLIC_ROWS.map((p) => regKeyOf(p.id))));
  assert.deepEqual(keys.map((k) => rootIdOf(k!)), [
    "sec-cp-top-REG-cp",
    "sec-ecmc-top-REG-ecmc",
    "sec-gp02-top-REG-gp02",
    "sec-7-top-REG-7",
  ]);
});

test("/sample cards carry the regulation name, in order, whoever fetched the roots", () => {
  const cards = sampleCards(PUBLIC_ROWS, SAMPLE_ROOTS, SAMPLE_ORDER);
  assert.deepEqual(
    cards.map((c) => [c.id, c.citation, c.title]),
    [
      ["sec-7-B-I-D-3-a-(i)", "Regulation 7 · I.D.3.a.(i).", null],
      ["sec-gp02-II-A-2", "APCD General Permit GP02 · II.A.2.", null],
      ["sec-ecmc-604-a-(1)", "2 CCR 404-1 · 604.a.(1).", null],
      ["sec-cp-I-G-90", "Common Provisions Regulation · I.G.90.", "POTENTIAL TO EMIT"],
    ]
  );
});

test("/sample with no roots is the raw-key label a prospect used to see (never again)", () => {
  // What the RLS-bound root read returned for an anonymous visitor: nothing.
  const cards = sampleCards(PUBLIC_ROWS, [], SAMPLE_ORDER);
  assert.deepEqual(
    cards.map((c) => c.citation),
    ["7 · I.D.3.a.(i).", "GP02 · II.A.2.", "ECMC · 604.a.(1).", "CP · I.G.90."]
  );
});

test("/sample sorts unlisted public rows after the listed ones, by id", () => {
  const extra = { id: "sec-3-A-I", citation: "I.", title: "I." };
  const cards = sampleCards([extra, ...PUBLIC_ROWS], SAMPLE_ROOTS, SAMPLE_ORDER.slice(0, 2));
  assert.deepEqual(
    cards.map((c) => c.id),
    ["sec-7-B-I-D-3-a-(i)", "sec-gp02-II-A-2", "sec-3-A-I", "sec-cp-I-G-90", "sec-ecmc-604-a-(1)"]
  );
});
