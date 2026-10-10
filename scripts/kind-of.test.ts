/**
 * kindOf / readerKindOf / teaserHeadingFilter (src/lib/regulation-pure.ts),
 * Sprint 5, 10 Oct 2026: Regulation 7's preview "What's inside" listed only
 * Appendix A because its parts are "sec-7-P-A" ... and kindOf knew only
 * "-PART-". Pure -- no database, no Next.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTree,
  depthOf,
  isTopLevelPartId,
  kindOf,
  readerKindOf,
  teaserHeadingFilter,
} from "../src/lib/regulation-pure";
import { renderDocHtml, renderNavHtml } from "../src/lib/reader-render";
import type { Provision } from "../src/lib/types";

test("kindOf: sec-<reg>-P-<X> is a part; deeper rows with -P- in them, items, appendices and roots are unchanged", () => {
  // The new shape: Regulations 7, 3, 25, the Procedural Rules.
  for (const id of ["sec-7-P-A", "sec-7-P-B", "sec-7-P-C", "sec-3-P-F", "sec-25-P-A", "sec-proc-P-A", "sec-31-P-K", "sec-8-P-E"]) {
    assert.equal(kindOf(id), "part", id);
    assert.equal(isTopLevelPartId(id), true, id);
  }
  // The existing shape.
  assert.equal(kindOf("sec-7-PART-A"), "part");
  assert.equal(kindOf("sec-p192-A-PART-B"), "part");
  // Rows below a part, however their ids happen to read.
  for (const id of ["sec-7-B-I-B-3", "sec-3-A-II-B-4", "sec-gp12-I-A", "sec-7-B-I-J-1-d", "sec-25-P-A-I", "sec-25-P-A-I-B", "sec-8-P-B-1", "sec-ecmc-P-1-2"]) {
    assert.equal(kindOf(id), "item", id);
    assert.equal(isTopLevelPartId(id), false, id);
  }
  // Not the shape: no letter, a lower-case marker, a different prefix.
  for (const id of ["sec-7-P-", "sec-7-p-A", "sec-7-top-P-A", "7-P-A", "sec-7-A-P-B"]) {
    assert.equal(isTopLevelPartId(id), false, id);
  }
  assert.equal(kindOf("sec-7-A-APPENDIX-A"), "appendix");
  assert.equal(kindOf("sec-gp02-ATTACHMENT-1"), "appendix");
  assert.equal(kindOf("sec-7-top-REG-7"), "reg");
});

test("readerKindOf keeps the reader's markup kind: the P-shape parts stay items, everything else matches kindOf", () => {
  assert.equal(readerKindOf("sec-7-P-A"), "item");
  assert.equal(readerKindOf("sec-3-P-F"), "item");
  for (const id of ["sec-7-PART-A", "sec-7-A-APPENDIX-A", "sec-gp02-ATTACHMENT-1", "sec-7-top-REG-7", "sec-7-B-I-B-3"]) {
    assert.equal(readerKindOf(id), kindOf(id), id);
  }
});

test("teaserHeadingFilter: part, appendix, and a P-shape part only when it sits directly under the root", () => {
  assert.equal(
    teaserHeadingFilter("7"),
    "id.like.%-PART-%,id.like.%-APPENDIX-%,and(id.like.sec-7-P-%,parent_id.eq.sec-7-top-REG-7)"
  );
  assert.equal(
    teaserHeadingFilter("gp05"),
    "id.like.%-PART-%,id.like.%-APPENDIX-%,and(id.like.sec-gp05-P-%,parent_id.eq.sec-gp05-top-REG-gp05)"
  );
  // A key that is not letters and digits never reaches the filter string.
  assert.equal(teaserHeadingFilter("7,id.eq.x"), "id.like.%-PART-%,id.like.%-APPENDIX-%");
});

// ---- the reader does not change ---------------------------------------------

function row(id: string, citation: string, parent_id: string | null, full_text: string, sort_order: number): Provision {
  return {
    id,
    reg_key: id.split("-")[1],
    citation,
    title: citation,
    jurisdiction_level: "state",
    issuing_body: "t",
    parent_id,
    full_text,
    ai_summary: null,
    source_url: null,
    last_verified_date: null,
    is_public: false,
    sort_order,
  };
}

test("the reader's HTML for a P-shape part is the item markup it has always been (no READER_RENDER_VERSION bump)", () => {
  const ROOT = "sec-7-top-REG-7";
  const all = [
    row(ROOT, "REGULATION 7", null, "<p>REGULATION 7 Title</p>", 0),
    row("sec-7-P-B", "PART B", ROOT, "PART B — Oil and Natural Gas Operations", 10),
    row("sec-7-B-I", "I.", "sec-7-P-B", "<p>I. Applicability</p>", 20),
    row("sec-7-B-I-A", "I.A.", "sec-7-B-I", "<p>Scope</p>", 30),
    row("sec-7-A-APPENDIX-A", "Appendix A", ROOT, "<h2>Appendix A</h2>", 40),
  ];
  const tree = buildTree(all);
  const html = renderDocHtml(all, tree);
  // The part: a depth-1 item with its own text and no part-tag; its sections one step deeper.
  assert.match(html, /<div id="sec-7-P-B" class="item depth-1"/);
  assert.ok(!html.includes("part-block") && !html.includes("part-tag"), "no part-block markup for a P-shape part");
  assert.match(html, /<div id="sec-7-B-I" class="item depth-2"/);
  assert.match(html, /<div id="sec-7-B-I-A" class="item depth-3"/);
  assert.match(html, /<section id="sec-7-A-APPENDIX-A" class="appendix-block"/);
  // No data-parent: the browser's document-order rule already gives parent_id.
  assert.ok(!html.includes("data-parent"), html);
  // The sidebar: the part is a collapsible group of its sections, as before.
  const nav = renderNavHtml(all, tree);
  assert.match(nav, /<details class="nav-part" id="navgroup-sec-7-P-B" open="">/);
  // depthOf follows the reader's kind.
  assert.equal(depthOf("sec-7-B-I", tree.byId, new Map()), 2);
  // And the tree's root is still found.
  assert.equal(tree.root?.id, ROOT);
});
