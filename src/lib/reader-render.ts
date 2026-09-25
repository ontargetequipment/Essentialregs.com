import {
  buildTree,
  containsBoxHtml,
  depthOf,
  escapeHtml,
  kindOf,
  promoteHeadingParagraph,
  snippetAfterCitation,
  summaryPanelHtml,
  withItemIdBadge,
} from "@/lib/regulation-pure";
import type { Provision } from "@/lib/types";

/**
 * The per-regulation, per-nobody parts of the reader page as HTML strings:
 * everything under <nav>'s .nav-reg and everything inside #doc. Same markup
 * the page used to build with JSX, byte-for-byte at the DOM level (the only
 * differences are React's `&#x27;` entity choice and the `<!-- -->` it puts
 * between adjacent text nodes) -- scripts/reader-harness.ts measures these
 * exact strings, and the page renders them with dangerouslySetInnerHTML.
 *
 * Pure: takes the sanitised rows, touches no request state, so the result
 * can be cached across requests (see fetchRenderedReader in regulation.ts).
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
  const { childrenOf, root, byId } = buildTree(all);
  if (!root) return null;
  return {
    title: root.citation,
    // "" when the root's text is nothing but its own citation -- the <h1>
    // above the blurb already prints that, so render no <p> at all.
    blurb: snippetAfterCitation(root.full_text, root.citation, 160),
    navHtml: renderNavHtml(all, { childrenOf, root }),
    docHtml: renderDocHtml(all, { childrenOf, root, byId }),
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
  const { childrenOf, root, byId } = tree ?? buildTree(all);
  if (!root) return "";
  const depthCache = new Map<string, number>();
  const out: string[] = [];
  for (const p of all) {
    const kind = kindOf(p.id);
    const children = childrenOf.get(p.id) ?? [];
    const summary = summaryPanelHtml(p, root.source_url);

    if (kind === "reg") {
      const sourceLinkHtml = p.source_url
        ? `<a href="${escapeHtml(
            p.source_url
          )}" target="_blank" rel="noopener noreferrer" class="reg-source-link">View official source ↗</a>`
        : "";
      out.push(
        `<section id="${escapeHtml(p.id)}" class="reg-block"><div class="reg-eyebrow">${escapeHtml(
          p.citation
        )}</div>${sourceLinkHtml}${p.full_text}${summary}</section>`
      );
      continue;
    }
    if (kind === "part") {
      out.push(
        `<section id="${escapeHtml(p.id)}" class="part-block"><div class="part-tag">${escapeHtml(
          p.citation
        )}</div>${p.full_text}${summary}${containsBoxHtml(children)}</section>`
      );
      continue;
    }
    if (kind === "appendix") {
      out.push(
        `<section id="${escapeHtml(p.id)}" class="appendix-block">${p.full_text}${summary}${containsBoxHtml(
          children
        )}</section>`
      );
      continue;
    }
    const depth = depthOf(p.id, byId, depthCache);
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
      `<div id="${escapeHtml(p.id)}" class="item depth-${depth}${isFedRoot ? " fed-block" : ""}" data-citation="${escapeHtml(
        p.citation
      )}">${withItemIdBadge(promoteHeadingParagraph(p.full_text), p.citation)}${summary}${containsBoxHtml(
        children
      )}</div>`
    );
  }
  return out.join("");
}
