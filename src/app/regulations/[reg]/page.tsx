import { notFound } from "next/navigation";
import {
  buildSearchIndex,
  buildTree,
  containsBoxHtml,
  depthOf,
  escapeHtml,
  fetchRegulationProvisions,
  kindOf,
  promoteHeadingParagraph,
  snippetAfterCitation,
  summaryPanelHtml,
  withItemIdBadge,
} from "@/lib/regulation";
import { RegulationReader } from "@/components/RegulationReader";
import "../reader.css";

// `reg` goes straight into an `eq("reg_key", reg)` filter
// (fetchRegulationProvisions) -- restricting it to alphanumerics before it
// ever reaches that query closes off any PostgREST filter-syntax injection
// via the URL segment, on top of just being a legitimate 404 for garbage input.
const VALID_REG = /^[A-Za-z0-9]+$/;

export async function generateMetadata(props: PageProps<"/regulations/[reg]">) {
  const { reg } = await props.params;
  if (!VALID_REG.test(reg)) {
    notFound();
  }
  const all = await fetchRegulationProvisions(reg);
  const root = all.find((p) => kindOf(p.id) === "reg");
  return {
    title: root ? root.citation : "Regulation",
  };
}

export default async function RegulationPage(props: PageProps<"/regulations/[reg]">) {
  const { reg } = await props.params;
  if (!VALID_REG.test(reg)) {
    notFound();
  }
  const all = await fetchRegulationProvisions(reg);

  if (all.length === 0) {
    notFound();
  }

  const { childrenOf, root } = buildTree(all);
  if (!root) {
    notFound();
  }

  const byId = new Map(all.map((p) => [p.id, p]));
  const depthCache = new Map<string, number>();
  const searchIndex = buildSearchIndex(all);
  const topLevel = childrenOf.get(root.id) ?? [];
  // "" when the root's text is nothing but its own citation -- the <h1>
  // above the blurb already prints that, so render no <p> at all.
  const rootBlurb = snippetAfterCitation(root.full_text, root.citation, 160);

  return (
    <div className="reg-reader">
      <RegulationReader searchIndex={searchIndex} />

      <nav id="sidebar">
        <div id="sidebar-header">
          <div className="brand-eyebrow">Cross-Referenced Reader</div>
          <h1>{root.citation}</h1>
          {rootBlurb && <p>{rootBlurb}</p>}
        </div>
        <div id="jump-wrap">
          <input
            id="jumpbox"
            type="text"
            placeholder='Jump to a section (e.g. II.A.4 or "fugitive emissions")'
            autoComplete="off"
          />
          <div id="jump-results" />
        </div>
        <div className="nav-reg">
          <div className="nav-reg-title">{root.citation}</div>
          {(() => {
            // "First group" (opened by default) is the first top-level node
            // that actually renders as a <details> -- i.e. has a section
            // list -- not just topLevel[0], since an appendix (or any node
            // with no children) never gets one (see the zero-children branch
            // below, unchanged from before this sidebar became collapsible).
            const firstDetailsIndex = topLevel.findIndex(
              (n) => kindOf(n.id) !== "appendix" && (childrenOf.get(n.id)?.length ?? 0) > 0
            );
            return topLevel.map((node, i) => {
              const kind = kindOf(node.id);
              if (kind === "appendix") {
                // node.title is frequently just the bare citation itself, in
                // which case snippetAfterCitation returns "" -- fall through
                // to full_text then, and render no sub-label at all when that
                // is empty too, rather than printing the citation twice.
                const titleSnippet = node.title
                  ? snippetAfterCitation(node.title, node.citation, 60)
                  : "";
                const appendixSub =
                  titleSnippet || snippetAfterCitation(node.full_text, node.citation, 60);
                return (
                  <div className="nav-part" key={node.id}>
                    <a href={`#${node.id}`} className="nav-link nav-part-link">
                      {node.citation}
                    </a>
                    {appendixSub && <div className="nav-part-sub">{appendixSub}</div>}
                  </div>
                );
              }
              const sections = childrenOf.get(node.id) ?? [];
              const partSub = snippetAfterCitation(node.full_text, node.citation, 60);
              const summary = (
                <>
                  <a href={`#${node.id}`} className="nav-link nav-part-link">
                    {node.citation}
                  </a>
                  {partSub && <div className="nav-part-sub">{partSub}</div>}
                </>
              );
              if (sections.length === 0) {
                return (
                  <div className="nav-part" key={node.id}>
                    {summary}
                  </div>
                );
              }
              return (
                // Native <details> so the huge ECMC-style sidebars (14
                // series x 20-60 rules) don't render every section list open
                // at once. id="navgroup-<id>" is how RegulationReader's
                // hash-on-load / "go to" handling finds and opens the
                // right group -- see its buildGroupIndex-backed lookup.
                <details className="nav-part" id={`navgroup-${node.id}`} key={node.id} open={i === firstDetailsIndex}>
                  <summary>{summary}</summary>
                  <ul className="nav-items">
                    {sections.map((sec) => {
                      const snip = snippetAfterCitation(sec.full_text, sec.citation, 40);
                      return (
                        <li key={sec.id}>
                          <a href={`#${sec.id}`} className="nav-link">
                            {sec.citation}
                            {snip ? ` ${snip}` : ""}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            });
          })()}
        </div>
      </nav>

      <div id="main-scroll">
        <div id="doc">
          {all.map((p) => {
            const kind = kindOf(p.id);
            const children = childrenOf.get(p.id) ?? [];

            if (kind === "reg") {
              const sourceLinkHtml = p.source_url
                ? `<a href="${escapeHtml(
                    p.source_url
                  )}" target="_blank" rel="noopener noreferrer" class="reg-source-link">View official source ↗</a>`
                : "";
              return (
                <section
                  key={p.id}
                  id={p.id}
                  className="reg-block"
                  dangerouslySetInnerHTML={{
                    __html: `<div class="reg-eyebrow">${escapeHtml(p.citation)}</div>${sourceLinkHtml}${p.full_text}${summaryPanelHtml(p, root.source_url)}`,
                  }}
                />
              );
            }
            if (kind === "part") {
              return (
                <section
                  key={p.id}
                  id={p.id}
                  className="part-block"
                  dangerouslySetInnerHTML={{
                    __html: `<div class="part-tag">${escapeHtml(p.citation)}</div>${p.full_text}${summaryPanelHtml(
                      p,
                      root.source_url
                    )}${containsBoxHtml(children)}`,
                  }}
                />
              );
            }
            if (kind === "appendix") {
              return (
                <section
                  key={p.id}
                  id={p.id}
                  className="appendix-block"
                  dangerouslySetInnerHTML={{
                    __html: `${p.full_text}${summaryPanelHtml(p, root.source_url)}${containsBoxHtml(children)}`,
                  }}
                />
              );
            }
            const depth = depthOf(p.id, byId, depthCache);
            // Only the top of an embedded federal block gets the dashed
            // "fed-block" divider (matching the source document) — its own
            // full_text already carries the "Federal reference" badge and
            // heading. Descendants are plain items; jurisdiction_level is
            // enough to know they're federal without re-bordering each one.
            const isFedRoot =
              p.jurisdiction_level === "federal" &&
              byId.get(p.parent_id ?? "")?.jurisdiction_level !== "federal";
            return (
              <div
                key={p.id}
                id={p.id}
                className={`item depth-${depth}${isFedRoot ? " fed-block" : ""}`}
                data-citation={p.citation}
                dangerouslySetInnerHTML={{
                  // promoteHeadingParagraph runs first so a promoted first
                  // <p> still gets its citation badge (withItemIdBadge targets
                  // the first <p>, class attribute or not) -- see
                  // promoteHeadingParagraph's doc comment for the heuristic.
                  // withItemIdBadge skips the badge entirely when a row's own
                  // text already opens with its citation.
                  __html: `${withItemIdBadge(promoteHeadingParagraph(p.full_text), p.citation)}${summaryPanelHtml(p, root.source_url)}${containsBoxHtml(children)}`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
