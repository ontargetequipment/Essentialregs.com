import { notFound } from "next/navigation";
import {
  buildSearchIndex,
  buildTree,
  containsBoxHtml,
  depthOf,
  escapeHtml,
  fetchRegulationProvisions,
  kindOf,
  stripHtml,
  summaryPanelHtml,
  withItemIdBadge,
} from "@/lib/regulation";
import { RegulationReader } from "@/components/RegulationReader";
import "../reader.css";

// `reg` gets interpolated straight into a `like "sec-{reg}-%"` filter
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

  return (
    <div className="reg-reader">
      <RegulationReader searchIndex={searchIndex} />

      <nav id="sidebar">
        <div id="sidebar-header">
          <div className="brand-eyebrow">Cross-Referenced Reader</div>
          <h1>{root.citation}</h1>
          <p>{stripHtml(root.full_text, 160)}</p>
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
          {topLevel.map((node) => {
            const kind = kindOf(node.id);
            if (kind === "appendix") {
              return (
                <div className="nav-part" key={node.id}>
                  <a href={`#${node.id}`} className="nav-link nav-part-link">
                    {node.citation}
                  </a>
                  <div className="nav-part-sub">{stripHtml(node.title || node.full_text, 60)}</div>
                </div>
              );
            }
            const sections = childrenOf.get(node.id) ?? [];
            return (
              <div className="nav-part" key={node.id}>
                <a href={`#${node.id}`} className="nav-link nav-part-link">
                  {node.citation}
                </a>
                <div className="nav-part-sub">{stripHtml(node.full_text, 60)}</div>
                {sections.length > 0 && (
                  <ul className="nav-items">
                    {sections.map((sec) => (
                      <li key={sec.id}>
                        <a href={`#${sec.id}`} className="nav-link">
                          {sec.citation} {stripHtml(sec.full_text, 40)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
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
                    __html: `<div class="reg-eyebrow">${escapeHtml(p.citation)}</div>${sourceLinkHtml}${p.full_text}${summaryPanelHtml(p)}`,
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
                      p
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
                    __html: `${p.full_text}${summaryPanelHtml(p)}${containsBoxHtml(children)}`,
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
                dangerouslySetInnerHTML={{
                  __html: `${withItemIdBadge(p.full_text, p.citation)}${summaryPanelHtml(p)}${containsBoxHtml(children)}`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
