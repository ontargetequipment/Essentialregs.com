/**
 * The focused preview's trail of hops (src/lib/preview-trail.ts, walkthrough
 * v3, 13 Oct 2026): how a stored trail is read, how a page's `?from=` starts,
 * extends or keeps it, what the bar shows from it, and what taking the bar's
 * link leaves. Run by `npm test` (tsx --test scripts/*.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PREVIEW_TRAIL_CAP,
  PREVIEW_TRAIL_KEY,
  parsePreviewTrail,
  popPreviewTrail,
  previewTrailBar,
  reconcilePreviewTrail,
  withFromParam,
  type PreviewHop,
} from "../src/lib/preview-trail";

const VIC: PreviewHop = { id: "sec-gp05-VI-C", href: "/regulations/gp05?tour=1#sec-gp05-VI-C", label: "← Back to GP05 · VI.C" };
const IC1: PreviewHop = { id: "sec-7-B-I-C-1", href: "/regulations/7/preview?p=sec-7-B-I-C-1&tour=1", label: "← Back to Regulation 7 · I.C.1" };

test("the walkthrough's two hops, there and back: GP05 VI.C -> I.C.1 preview -> I.D preview -> I.C.1 -> GP05", () => {
  assert.equal(PREVIEW_TRAIL_KEY, "er:preview-trail");
  // Arrival on the I.C.1 preview from GP05 VI.C (another regulation): the chain starts.
  let trail = reconcilePreviewTrail([], VIC, "7");
  assert.deepEqual(trail, [VIC]);
  assert.deepEqual(previewTrailBar(trail, VIC), { href: VIC.href, label: VIC.label, count: 1, then: null });
  // A reload: unchanged.
  assert.deepEqual(reconcilePreviewTrail(trail, VIC, "7"), [VIC]);

  // The I.D preview, from I.C.1.c's citation (?from=sec-7-B-I-C-1): I.C.1 is pushed, and its link
  // back carries the hop under it as from=, so the I.C.1 page can draw "Back to GP05" on its own.
  trail = reconcilePreviewTrail(trail, IC1, "7");
  assert.deepEqual(trail, [VIC, { ...IC1, href: "/regulations/7/preview?p=sec-7-B-I-C-1&tour=1&from=sec-gp05-VI-C" }]);
  const bar = previewTrailBar(trail, IC1);
  assert.deepEqual(bar, {
    href: "/regulations/7/preview?p=sec-7-B-I-C-1&tour=1&from=sec-gp05-VI-C",
    label: IC1.label,
    count: 2,
    then: VIC.label,
  });

  // Back (the bar's link is taken): the top comes off; landing on I.C.1 with ?from=sec-gp05-VI-C keeps the rest.
  trail = popPreviewTrail(trail);
  assert.deepEqual(trail, [VIC]);
  assert.deepEqual(reconcilePreviewTrail(trail, VIC, "7"), [VIC]);
  assert.equal(previewTrailBar(trail, VIC)?.count, 1);
  // Back again: nothing left.
  assert.deepEqual(popPreviewTrail(trail), []);
  assert.deepEqual(popPreviewTrail([]), []);
});

test("the URL vouches for the top hop: a trail that does not match the page's origin shows nothing, and no origin clears it", () => {
  const trail = [VIC, IC1];
  // A page with no ?from= (a search result, a bookmark): no chain, and the old one goes.
  assert.deepEqual(reconcilePreviewTrail(trail, null, "7"), []);
  assert.equal(previewTrailBar(trail, null), null);
  // A page whose ?from= is not the trail's top: the bar falls back to the server's one hop...
  assert.equal(previewTrailBar(trail, VIC), null);
  // ...and reconciling starts afresh for a hop from another regulation, or pushes a same-document one.
  const vid: PreviewHop = { id: "sec-gp05-VI-D", href: "/regulations/gp05#sec-gp05-VI-D", label: "← Back to GP05 · VI.D" };
  assert.deepEqual(reconcilePreviewTrail(trail, vid, "7"), [vid]);
  const id4: PreviewHop = { id: "sec-7-B-I-D", href: "/regulations/7/preview?p=sec-7-B-I-D", label: "← Back to Regulation 7 · I.D" };
  assert.deepEqual(reconcilePreviewTrail(trail, id4, "7"), [VIC, IC1, { ...id4, href: "/regulations/7/preview?p=sec-7-B-I-D&from=sec-7-B-I-C-1" }]);
  // The regulation key is compared without case.
  assert.deepEqual(reconcilePreviewTrail([], IC1, "7"), [IC1]);
  assert.deepEqual(reconcilePreviewTrail([VIC], { ...IC1 }, "7").length, 2);
  assert.deepEqual(reconcilePreviewTrail([], { id: "sec-gp12-VI-A-1", href: "/regulations/gp12/preview?p=sec-gp12-VI-A-1", label: "x" }, "GP12").length, 1);
  // Capped.
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `sec-7-B-I-C-${i + 1}`, href: `/regulations/7/preview?p=sec-7-B-I-C-${i + 1}`, label: `${i}` }));
  let t: PreviewHop[] = [];
  for (const h of many) t = reconcilePreviewTrail(t, h, "7");
  assert.equal(t.length, PREVIEW_TRAIL_CAP);
  assert.equal(t[t.length - 1].id, "sec-7-B-I-C-12");
});

test("a stored trail round-trips; junk, a bad id, an off-site href or a long label read as no trail", () => {
  const trail = [VIC, IC1];
  assert.deepEqual(parsePreviewTrail(JSON.stringify(trail)), trail);
  for (const raw of [
    null,
    undefined,
    "",
    "nope",
    "{}",
    JSON.stringify([{ id: "<script>", href: "/x", label: "x" }]),
    JSON.stringify([{ id: "sec-gp05-VI-C", href: "https://evil.example/x", label: "x" }]),
    JSON.stringify([{ id: "sec-gp05-VI-C", href: "//evil.example/x", label: "x" }]),
    JSON.stringify([{ id: "sec-gp05-VI-C", href: "/x", label: "x".repeat(201) }]),
    JSON.stringify([VIC, 7]),
    JSON.stringify([VIC, { id: "sec-7-B-I-C-1" }]),
  ]) {
    assert.deepEqual(parsePreviewTrail(raw), [], String(raw));
  }
  // Longer than the cap: the most recent hops.
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `sec-7-B-I-C-${i}`, href: "/regulations/7/preview", label: "x" }));
  assert.equal(parsePreviewTrail(JSON.stringify(many)).length, PREVIEW_TRAIL_CAP);
  assert.equal(parsePreviewTrail(JSON.stringify(many))[0].id, "sec-7-B-I-C-4");
});

test("withFromParam adds from= once, before the hash, and only for a provision id", () => {
  assert.equal(withFromParam("/regulations/7/preview?p=x", "sec-gp05-VI-C"), "/regulations/7/preview?p=x&from=sec-gp05-VI-C");
  assert.equal(withFromParam("/regulations/gp05#sec-gp05-VI-C", "sec-7-B-I-C-1"), "/regulations/gp05?from=sec-7-B-I-C-1#sec-gp05-VI-C");
  assert.equal(withFromParam("/regulations/7/preview?p=x&from=a", "sec-gp05-VI-C"), "/regulations/7/preview?p=x&from=a", "not twice");
  assert.equal(withFromParam("/regulations/7/preview?p=x", "sec-gp05-VI-D-3-a-(i)"), "/regulations/7/preview?p=x&from=sec-gp05-VI-D-3-a-(i)");
  for (const bad of [null, undefined, "", "<script>", "sec-nokey", "x".repeat(300)]) {
    assert.equal(withFromParam("/regulations/7/preview?p=x", bad), "/regulations/7/preview?p=x", String(bad));
  }
});
