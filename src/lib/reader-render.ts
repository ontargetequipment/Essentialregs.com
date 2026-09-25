import {
  buildTree,
  depthOf,
  escapeHtml,
  kindOf,
  promoteHeadingParagraph,
  snippetAfterCitation,
  summaryPanelHtml,
  withItemIdBadge,
} from "@/lib/regulation-pure";
import { deriveParents, type TreeRow } from "@/lib/reader-tree";
import type { Provision } from "@/lib/types";

/**
 * The per-regulation, per-nobody parts of the reader page as HTML strings:
 * everything under <nav>'s .nav-reg and everything inside #doc. Pure --
 * takes the sanitised rows, touches no request state -- so the result can
 * be cached across requests (fetchRenderedReader in regulation.ts), and
 * scripts/reader-harness.ts measures these exact strings.
 *
 * What the page ships versus what the browser adds (RegulationReader.tsx,
 * via reader-client.ts), all of it with markup identical to what the server
 * used to emit:
 *
 *   - no contains boxes: the browser builds each one from the children
 *     already on the page (their data-citation and text);
 *   - no search index: the browser builds it from the same items;
 *   - an empty .summary-status row per summary panel: the browser fills in
 *     the "View official source" link from the root's source link, or from
 *     a wrapper's data-src when that row's own URL differs from the root's;
 *   - data-citation on every wrapper (items always had it; the three
 *     section kinds get it too, so the search index can be rebuilt);
 *   - data-parent only on the rows whose parent the browser cannot derive
 *     from document order -- see reader-tree.ts.
 *
 * `all` must already be sanitised (fetchRegulationProvisions does that).
 */
export type RenderedReader = {
  /** root.citation -- the <h1> and the <title>. */
  title: string;
  /** Root's text after its own citation, 160 chars; "" renders no <p>. */
  blurb: string;
  /** innerHTML of <div class="nav-reg">. */
  navHtml: string;
  /** innerHTML of <div id="doc">. */
  docHtml: string;
};

export function renderReaderBody(all: Provision[]): RenderedReader | null {
  const tree = buildTree(all);
  if (!tree.root) return null;
  const root = tree.root;
  return {
    title: root.citation,
    // "" when the root's text is nothing but its own citation -- the <h1>
    // above the blurb already prints that, so render no <p> at all.
    blurb: snippetAfterCitation(root.full_text, root.citation, 160),
    navHtml: renderNavHtml(all, tree),
    docHtml: renderDocHtml(all, tree),
  };
}

type Tree = ReturnType<typeof buildTree>;

export function renderNavHtml(all: Provision[], tree?: Pick<Tree, "childrenOf" | "root">): string {
  const { childrenOf, root } = tree ?? buildTree(all);
  if (!root) return "";
  const topLevel = childrenOf.get(root.id) ?? [];
  // "First group" (opened by default) is the first top-level node that
  // actually renders as a <details> -- i.e. has a section list -- not just
  // topLevel[0], since an appendix (or any node with no children) never
  // gets one (see the zero-children branch below).
  const firstDetailsIndex = topLevel.findIndex(
    (n) => kindOf(n.id) !== "appendix" && (childrenOf.get(n.id)?.length ?? 0) > 0
  );
  const parts = topLevel.map((node, i) => {
    const kind = kindOf(node.id);
    const link = `<a href="#${escapeHtml(node.id)}" class="nav-link nav-part-link">${escapeHtml(node.citation)}</a>`;
    if (kind === "appendix") {
      // node.title is frequently just the bare citation itself, in which
      // case snippetAfterCitation returns "" -- fall through to full_text
      // then, and render no sub-label at all when that is empty too,
      // rather than printing the citation twice.
      const titleSnippet = node.title ? snippetAfterCitation(node.title, node.citation, 60) : "";
      const appendixSub = titleSnippet || snippetAfterCitation(node.full_text, node.citation, 60);
      const sub = appendixSub ? `<div class="nav-part-sub">${escapeHtml(appendixSub)}</div>` : "";
      return `<div class="nav-part">${link}${sub}</div>`;
    }
    const sections = childrenOf.get(node.id) ?? [];
    const partSub = snippetAfterCitation(node.full_text, node.citation, 60);
    const summary = link + (partSub ? `<div class="nav-part-sub">${escapeHtml(partSub)}</div>` : "");
    if (sections.length === 0) {
      return `<div class="nav-part">${summary}</div>`;
    }
    // Native <details> so the huge ECMC-style sidebars (14 series x 20-60
    // rules) don't render every section list open at once.
    // id="navgroup-<id>" is how RegulationReader's hash-on-load / "go to"
    // handling finds and opens the right group.
    const items = sections
      .map((sec) => {
        const snip = snippetAfterCitation(sec.full_text, sec.citation, 40);
        return `<li><a href="#${escapeHtml(sec.id)}" class="nav-link">${escapeHtml(sec.citation)}${
          snip ? escapeHtml(` ${snip}`) : ""
        }</a></li>`;
      })
      .join("");
    return `<details class="nav-part" id="navgroup-${escapeHtml(node.id)}"${
      i === firstDetailsIndex ? ' open=""' : ""
    }><summary>${summary}</summary><ul class="nav-items">${items}</ul></details>`;
  });
  return `<div class="nav-reg-title">${escapeHtml(root.citation)}</div>${parts.join("")}`;
}

export function renderDocHtml(all: Provision[], tree?: Tree): string {
  const { root, byId } = tree ?? buildTree(all);
  if (!root) return "";
  const depthCache = new Map<string, number>();

  // Which rows need an explicit data-parent: those where the document-order
  // rule the browser applies (reader-tree.ts) disagrees with parent_id.
  const treeRows: TreeRow[] = all.map((p) => {
    const kind = kindOf(p.id);
    return { id: p.id, kind, depth: kind === "item" ? depthOf(p.id, byId, depthCache) : 0 };
  });
  const derived = deriveParents(treeRows);

  const out: string[] = [];
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    const kind = treeRows[i].kind;
    const summary = summaryPanelHtml(p, root.source_url);

    // Invisible attributes the browser rebuilds the furniture from.
    let attrs = ` data-citation="${escapeHtml(p.citation)}"`;
    if (derived[i] !== p.parent_id) attrs += ` data-parent="${escapeHtml(p.parent_id ?? "")}"`;
    // summaryPanelHtml resolves the link URL as p.source_url ?? root's; the
    // browser resolves it as data-src ?? the root's source link. They agree
    // exactly when data-src is written for every row whose own URL differs.
    if (p.source_url && p.source_url !== root.source_url) attrs += ` data-src="${escapeHtml(p.source_url)}"`;

    if (kind === "reg") {
      const sourceLinkHtml = p.source_url
        ? `<a href="${escapeHtml(
            p.source_url
          )}" target="_blank" rel="noopener noreferrer" class="reg-source-link">View official source ↗</a>`
        : "";
      out.push(
        `<section id="${escapeHtml(p.id)}" class="reg-block"${attrs}><div class="reg-eyebrow">${escapeHtml(
          p.citation
        )}</div>${sourceLinkHtml}${p.full_text}${summary}</section>`
      );
      continue;
    }
    if (kind === "part") {
      out.push(
        `<section id="${escapeHtml(p.id)}" class="part-block"${attrs}><div class="part-tag">${escapeHtml(
          p.citation
        )}</div>${p.full_text}${summary}</section>`
      );
      continue;
    }
    if (kind === "appendix") {
      out.push(`<section id="${escapeHtml(p.id)}" class="appendix-block"${attrs}>${p.full_text}${summary}</section>`);
      continue;
    }
    const depth = treeRows[i].depth;
    // Only the top of an embedded federal block gets the dashed "fed-block"
    // divider (matching the source document) — its own full_text already
    // carries the "Federal reference" badge and heading. Descendants are
    // plain items; jurisdiction_level is enough to know they're federal
    // without re-bordering each one.
    const isFedRoot =
      p.jurisdiction_level === "federal" &&
      byId.get(p.parent_id ?? "")?.jurisdiction_level !== "federal";
    // promoteHeadingParagraph runs first so a promoted first <p> still gets
    // its citation badge (withItemIdBadge targets the first <p>, class
    // attribute or not) -- see promoteHeadingParagraph's doc comment for
    // the heuristic. withItemIdBadge skips the badge entirely when a row's
    // own text already opens with its citation.
    out.push(
      `<div id="${escapeHtml(p.id)}" class="item depth-${depth}${isFedRoot ? " fed-block" : ""}"${attrs}>${withItemIdBadge(
        promoteHeadingParagraph(p.full_text),
        p.citation
      )}${summary}</div>`
    );
  }
  return out.join("");
}
