import { notFound } from "next/navigation";
import { cache } from "react";
import { getAccessStatus } from "@/lib/access";
import { fetchReaderVersion, fetchRegulationProvisions, fetchRenderedReader } from "@/lib/regulation";
import { loadReaderPage } from "@/lib/reader-page";
import { RegulationReader } from "@/components/RegulationReader";
import "../reader.css";

// `reg` goes straight into an `eq("reg_key", reg)` filter
// (fetchRegulationProvisions) -- restricting it to alphanumerics before it
// ever reaches that query closes off any PostgREST filter-syntax injection
// via the URL segment, on top of just being a legitimate 404 for garbage input.
const VALID_REG = /^[A-Za-z0-9]+$/;

// One load per request, shared by generateMetadata and the page (React's
// cache() dedupes within a request) -- the title used to cost a second
// full fetch of the regulation.
//
// The entitlement gate and the cross-request body cache live in
// loadReaderPage; see the invariant there. Everything below it is the
// per-user shell.
const loadReader = cache((reg: string) =>
  loadReaderPage(reg, {
    hasAccess: async () => (await getAccessStatus()).hasAccess,
    fetchLive: fetchRegulationProvisions,
    fetchVersion: fetchReaderVersion,
    fetchCached: fetchRenderedReader,
  })
);

export async function generateMetadata(props: PageProps<"/regulations/[reg]">) {
  const { reg } = await props.params;
  if (!VALID_REG.test(reg)) {
    notFound();
  }
  const reader = await loadReader(reg);
  return {
    title: reader ? reader.title : "Regulation",
  };
}

export default async function RegulationPage(props: PageProps<"/regulations/[reg]">) {
  const { reg } = await props.params;
  if (!VALID_REG.test(reg)) {
    notFound();
  }
  const reader = await loadReader(reg);
  if (!reader) {
    notFound();
  }

  // The sidebar tree and the document body are the same for everyone who
  // can see this regulation, so they are two HTML strings (reader-render.ts)
  // rather than a JSX tree per provision. What the browser gets is the same
  // DOM it always got -- minus the furniture RegulationReader now rebuilds
  // client-side (contains boxes, search index, summary source links); see
  // reader-render.ts for the list.
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
