import { notFound } from "next/navigation";
import { fetchRegulationProvisions, kindOf } from "@/lib/regulation";
import { renderReaderBody } from "@/lib/reader-render";
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

  // The sidebar tree and the document body are the same for everyone who
  // can see this regulation, so they are rendered as two HTML strings
  // (reader-render.ts) rather than a JSX tree per provision. What the
  // browser gets is the same DOM it always got -- minus the furniture
  // RegulationReader now rebuilds client-side (contains boxes, search
  // index, summary source links); see reader-render.ts for the list.
  const reader = renderReaderBody(all);
  if (!reader) {
    notFound();
  }

  return (
    <div className="reg-reader">
      <RegulationReader />

      <nav id="sidebar">
        <div id="sidebar-header">
          <div className="brand-eyebrow">Cross-Referenced Reader</div>
          <h1>{reader.title}</h1>
          {reader.blurb && <p>{reader.blurb}</p>}
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
        <div className="nav-reg" dangerouslySetInnerHTML={{ __html: reader.navHtml }} />
      </nav>

      <div id="main-scroll">
        <div id="doc" dangerouslySetInnerHTML={{ __html: reader.docHtml }} />
      </div>
    </div>
  );
}
