import { notFound } from "next/navigation";
import { cache } from "react";
import { getAccessStatus } from "@/lib/access";
import { isAdmin } from "@/lib/admin";
import { isRegReleased } from "@/lib/release";
import {
  fetchPendingSummaryCounts,
  fetchReaderVersion,
  fetchRegulationProvisions,
  fetchRenderedReader,
  gatePublicSummaries,
} from "@/lib/regulation";
import Link from "next/link";
import { TRIAL_DAYS } from "@/lib/pricing";
import { loadReaderPage } from "@/lib/reader-page";
import { RegulationReader } from "@/components/RegulationReader";
import { jumpboxPlaceholder } from "@/lib/regulation-names";
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
//
// getAccessStatus is wrapped in cache() so the gate, the staged-document
// check and the page's own publicMode flag below cost one profile read per
// request, not three.
const accessOf = cache(getAccessStatus);

/**
 * The live, RLS-bound read an unentitled visitor gets (only for a
 * PUBLIC_READER_REGS regulation, GP05; loadReaderPage decides that). The
 * rows are what the visitor's own session may read, and their summaries pass
 * the same public gate /sample and the /preview teaser use (owner decision,
 * 5 Oct 2026): a summary is shown to a logged-out visitor only when its row
 * is AI-checked (approved or edited) and its regulation has no summary still
 * waiting for the automated check. A subscriber's reader shows every
 * non-rejected summary with its "not yet reviewed" badge; a visitor's shows
 * the checked ones or none. Text and structure are untouched.
 */
async function fetchPublicSample(reg: string) {
  const [rows, pending] = await Promise.all([fetchRegulationProvisions(reg), fetchPendingSummaryCounts([reg])]);
  return gatePublicSummaries(rows, pending);
}

const loadReader = cache((reg: string) =>
  loadReaderPage(reg, {
    // A staged document is visible only to an admin (who checks it before release).
    isVisible: async (r) => (await isRegReleased(r)) || isAdmin((await accessOf()).user),
    hasAccess: async () => (await accessOf()).hasAccess,
    fetchLive: fetchPublicSample,
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
  // Rendering without access means loadReaderPage let a visitor in: reg is
  // in PUBLIC_READER_REGS. The client gets the flag (the Recent list and the
  // cross-regulation popup behave for a visitor) and the page a slim banner.
  const publicMode = !(await accessOf()).hasAccess;

  // The sidebar tree and the document body are the same for everyone who
  // can see this regulation, so they are two HTML strings (reader-render.ts)
  // rather than a JSX tree per provision. What the browser gets is the same
  // DOM it always got -- minus the furniture RegulationReader now rebuilds
  // client-side (contains boxes, search index, summary source links); see
  // reader-render.ts for the list.
  return (
    <div className="reg-reader">
      <RegulationReader publicMode={publicMode} />

      <nav id="sidebar">
        <div id="sidebar-header">
          <div className="brand-eyebrow">Cross-Referenced Reader</div>
          <h1>{reader.title}</h1>
          {reader.blurb && <p>{reader.blurb}</p>}
          {/* Current through <version date> · source checked <date> (sourceStatusLine). */}
          {reader.dateLine && <p className="source-status-line">{reader.dateLine}</p>}
        </div>
        <div id="jump-wrap">
          <input
            id="jumpbox"
            type="text"
            placeholder={jumpboxPlaceholder(reg)}
            autoComplete="off"
          />
          <div id="jump-results" />
        </div>
        {/* The last provisions this browser visited (Sprint 3): filled by
            RegulationReader from sessionStorage, hidden while empty, a
            collapsed <details> so it takes one line on a phone. */}
        <details id="recent-wrap" hidden>
          <summary>Recent</summary>
          <ul id="recent-list" />
        </details>
        <div className="nav-reg" dangerouslySetInnerHTML={{ __html: reader.navHtml }} />
      </nav>

      <div id="main-scroll">
        {/* The free sample (Sprint 4, 10 Oct 2026): a visitor reading GP05
            gets the whole reader and this one slim, non-blocking line. It
            scrolls away with the page; nothing is gated behind it. */}
        {publicMode && (
          <div id="visitor-banner" data-testid="visitor-banner" role="note">
            <p>
              You are reading {reg.toUpperCase()}, the free sample. The rest of the corpus opens with a {TRIAL_DAYS}-day
              trial.
            </p>
            <div className="visitor-banner-actions">
              <Link href="/signup" className="visitor-banner-primary">
                Start your trial
              </Link>
              <Link href="/search" className="visitor-banner-secondary">
                Search the complete corpus
              </Link>
            </div>
          </div>
        )}
        {/* Return trail (backlog #18): after a "go to" (popup, sidebar,
            jump box) this sticks to the top of the reading pane with a way
            back to the provision the reader left. RegulationReader fills
            the label and shows/hides it; hidden until the first goto. */}
        <div id="return-trail" hidden>
          <button id="return-trail-back" type="button">
            ← Back to <span id="return-trail-label" />
          </button>
          <button id="return-trail-dismiss" type="button" aria-label="Dismiss">
            ✕
          </button>
        </div>
        <div id="doc" dangerouslySetInnerHTML={{ __html: reader.docHtml }} />
      </div>
    </div>
  );
}
