/**
 * Browser-side reconstruction of the reader furniture the page no longer
 * ships: the provision tree, each item's text snippet, the contains boxes,
 * the summary panels' source links and the jump-box search index. Plain DOM
 * code, no React, so scripts/reader-client.test.ts can run it under jsdom
 * against the fixture regulations and compare its output with the server's.
 *
 * Every string it produces comes from the same functions the server used to
 * produce them (snippet.ts, reader-tree.ts) -- the only thing that differs
 * is where the input HTML comes from: the browser's serialisation of the
 * rendered DOM instead of the stored full_text. See fullTextHtml for why
 * those agree.
 */
import { deriveParents, topGroupResolver, type ReaderKind } from "@/lib/reader-tree";
import {
  containsBoxFromRows,
  SNIPPET_LEN,
  snippetAfterCitation,
  summarySourceLinkHtml,
  type SearchRow,
} from "@/lib/snippet";

export type ReaderRow = {
  el: HTMLElement;
  id: string;
  citation: string;
  kind: ReaderKind;
  depth: number;
  parent: string | null;
};

export type ReaderModel = {
  rows: ReaderRow[];
  byId: Map<string, ReaderRow>;
  childrenOf: Map<string, ReaderRow[]>;
  topGroupOf: (id: string) => string;
  /** The row's snippetAfterCitation(full_text, citation, SNIPPET_LEN), computed once. */
  snippetOf: (row: ReaderRow) => string;
  /** href of the root's "View official source" link, or null. */
  rootSourceUrl: string | null;
};

function kindOfElement(el: Element): ReaderKind | null {
  const c = el.classList;
  if (c.contains("item")) return "item";
  if (c.contains("reg-block")) return "reg";
  if (c.contains("part-block")) return "part";
  if (c.contains("appendix-block")) return "appendix";
  return null;
}

const DEPTH_CLASS = /(?:^|\s)depth-(\d+)(?:\s|$)/;

/** Reads the flat #doc back into the provision tree. Cheap: attributes only. */
export function readReaderModel(doc: Element): ReaderModel {
  const rows: ReaderRow[] = [];
  for (const el of Array.from(doc.children)) {
    const kind = kindOfElement(el);
    if (!kind || !el.id) continue;
    rows.push({
      el: el as HTMLElement,
      id: el.id,
      citation: el.getAttribute("data-citation") ?? "",
      kind,
      depth: kind === "item" ? Number(DEPTH_CLASS.exec(el.className)?.[1] ?? 0) : 0,
      parent: null,
    });
  }
  const derived = deriveParents(rows);
  const byId = new Map<string, ReaderRow>();
  const childrenOf = new Map<string, ReaderRow[]>();
  const parentOf = new Map<string, string | null>();
  rows.forEach((row, i) => {
    // The server writes data-parent only where the document-order rule is
    // wrong for that row (reader-tree.ts); it wins when present.
    const explicit = row.el.getAttribute("data-parent");
    row.parent = explicit !== null ? explicit || null : derived[i];
    byId.set(row.id, row);
    parentOf.set(row.id, row.parent);
  });
  for (const row of rows) {
    if (!row.parent) continue;
    const arr = childrenOf.get(row.parent);
    if (arr) arr.push(row);
    else childrenOf.set(row.parent, [row]);
  }
  const snippets = new Map<string, string>();
  const snippetOf = (row: ReaderRow) => {
    let s = snippets.get(row.id);
    if (s === undefined) {
      s = snippetAfterCitation(fullTextHtml(row.el), row.citation, SNIPPET_LEN);
      snippets.set(row.id, s);
    }
    return s;
  };
  const rootSourceUrl =
    doc.querySelector(":scope > section.reg-block > a.reg-source-link")?.getAttribute("href") ?? null;
  return { rows, byId, childrenOf, topGroupOf: topGroupResolver(parentOf), snippetOf, rootSourceUrl };
}

// Direct children of a wrapper that are not the provision's own full_text:
// the section labels the server puts before it and the panels/boxes after.
const FURNITURE = "details.summary-panel, ul.contains, .part-tag, .reg-eyebrow, .reg-source-link";

// The citation badge withItemIdBadge inserts inside the first <p> (or at the
// very start when the text doesn't open with a <p>), followed by one space.
// The server computed the snippet on the text WITHOUT it, so it is removed
// before the snippet runs. `[^<]*` rather than the exact citation because the
// serialiser writes a `"` in the badge text where escapeHtml wrote &quot;.
const BADGE = /^(\s*<p[^>]*>)?<span class="item-id">[^<]*<\/span> /;

/**
 * HTML-serialises a text node the way the browser's own serialiser does:
 * exactly &amp; &lt; &gt; and &nbsp; -- the same four entities the snippet
 * pipeline in snippet.ts knows about, which is what makes the browser's
 * innerHTML and the stored full_text interchangeable as its input.
 */
function serializeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The provision's own full_text, re-serialised from the rendered DOM. */
export function fullTextHtml(el: Element): string {
  let html = "";
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) {
      const e = n as Element;
      if (e.matches(FURNITURE)) continue;
      html += e.outerHTML;
    } else if (n.nodeType === 3) {
      html += serializeText(n.nodeValue ?? "");
    }
  }
  return html.replace(BADGE, "$1");
}

/** Appends every provision's contains box (children in document order). Idempotent. */
export function fillContainsBoxes(model: ReaderModel): void {
  for (const row of model.rows) {
    const children = model.childrenOf.get(row.id);
    if (!children || row.el.querySelector(":scope > ul.contains")) continue;
    row.el.insertAdjacentHTML(
      "beforeend",
      containsBoxFromRows(children.map((c) => ({ id: c.id, citation: c.citation, snippet: model.snippetOf(c) })))
    );
  }
}

/** Fills each summary panel's empty .summary-status row with its source link. Idempotent. */
export function fillSummaryLinks(model: ReaderModel): void {
  for (const row of model.rows) {
    const status = row.el.querySelector(":scope > details.summary-panel > .summary-status");
    if (!status || status.firstChild) continue;
    const url = row.el.getAttribute("data-src") ?? model.rootSourceUrl;
    if (url) status.innerHTML = summarySourceLinkHtml(url);
  }
}

/** The [id, citation, snippet, topGroupId] rows the jump box searches. */
export function buildSearchIndexFromDom(model: ReaderModel): SearchRow[] {
  return model.rows.map((row) => [row.id, row.citation, model.snippetOf(row), model.topGroupOf(row.id)]);
}
