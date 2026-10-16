import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import {
  fetchProvisionTeaser,
  fetchRegulationTeaser,
  sourceLinkTextFor,
  summaryParagraphs,
  titleWithoutCitation,
  type ProvisionTeaser,
} from "@/lib/regulation";
import { regKeyOf, regulationDisplayName } from "@/lib/regulation-names";
import { getAccessStatus } from "@/lib/access";
import { LockedDestination } from "@/components/LockedDestination";
import { PreviewSubtree } from "@/components/PreviewSubtree";
import { PreviewReturn } from "@/components/PreviewReturn";
import { PreviewContextStrip } from "@/components/PreviewContextStrip";
import { previewContext } from "@/lib/preview-context";
import { isPublicReaderReg } from "@/lib/destination";
import { PRICE_SUMMARY } from "@/lib/pricing";
import { displayCitation } from "@/lib/federal-citation";
import { CITATION_EYEBROW_CLASS, pageContainerClass } from "@/lib/ui";
import { PROVISION_ID } from "@/lib/types";
import { ReaderTour } from "@/components/ReaderTour";
import { TOUR_PARAM, tourRequested } from "@/lib/tour";
import {
  previewReturnLink,
  publicSubtree,
  readerRedirectHref,
  renderSubtreeHtml,
  type SubtreeRow,
  type SubtreeShape,
} from "@/lib/preview-subtree";
import { fetchSubtreeRows } from "@/lib/preview-subtree-data";
import { fetchSubtreeShape } from "@/lib/preview-shape-data";

// `reg` goes straight into an `eq("reg_key", reg)` filter
// (fetchRegulationTeaser) -- restricting it to alphanumerics before it ever
// reaches that query closes off PostgREST filter-syntax injection via the
// URL segment, same as the gated reader at ../page.tsx.
const VALID_REG = /^[A-Za-z0-9]+$/;

/**
 * The provision a `?p=<id>` asks for, or null to render the plain preview:
 * only a string that passes PROVISION_ID and belongs to this regulation
 * (regKeyOf) is used, so the value never reaches a query unchecked.
 */
function focusedId(p: string | string[] | undefined, reg: string): string | null {
  if (typeof p !== "string" || p.length > 200 || !PROVISION_ID.test(p)) return null;
  return regKeyOf(p) === reg ? p : null;
}

/**
 * One load per request, shared by generateMetadata and the page (React's
 * cache() dedupes within a request): the focused provision's label, and the
 * rows the VISITOR's own session may read of it and below
 * (fetchSubtreeRows: RLS-bound, the database decides). A row the label read
 * does not find -- missing, or in a staged document -- shows nothing, public
 * or not. The rows are unfenced here; renderSubtreeHtml and publicSubtree
 * (preview-subtree.ts) fence them before anything reaches the page.
 *
 * A failed row read is logged and answers "no rows": the page is then what it
 * was before the subtree (the locked panel), which shows nothing it should
 * not, instead of turning every focused preview a search result links to into
 * an error page.
 */
const loadFocused = cache(
  async (reg: string, id: string): Promise<{ focused: ProvisionTeaser | null; rows: SubtreeRow[]; shape: SubtreeShape[] }> => {
    const [focused, rows, shape] = await Promise.all([
      fetchProvisionTeaser(reg, id),
      fetchSubtreeRows(reg, id).catch((e: unknown) => {
        console.error("preview subtree:", e instanceof Error ? e.message : e);
        return [] as SubtreeRow[];
      }),
      // The whole subtree's ids and order (v3.1), for the "… N more provisions"
      // markers. A failed read answers "no shape": the rows still render, with
      // no markers and no eyebrow, rather than an error page.
      fetchSubtreeShape(reg, id).catch((e: unknown) => {
        console.error("preview subtree shape:", e instanceof Error ? e.message : e);
        return [] as SubtreeShape[];
      }),
    ]);
    return { focused, rows: focused ? rows : [], shape: focused ? shape : [] };
  }
);

export async function generateMetadata(
  props: PageProps<"/regulations/[reg]/preview">
): Promise<Metadata> {
  const { reg } = await props.params;
  if (!VALID_REG.test(reg)) {
    notFound();
  }
  const { root } = await fetchRegulationTeaser(reg);
  if (!root) {
    notFound();
  }
  const id = focusedId((await props.searchParams).p, reg);
  const { focused, rows } = id ? await loadFocused(reg, id) : { focused: null, rows: [] as SubtreeRow[] };
  if (focused && id) {
    // A public provision (the Regulation 7 I.C.1 subtree, Sprint 7) is read
    // on this page; the description must not call it locked.
    const open = publicSubtree(rows, id).length > 0;
    return {
      title: `${displayCitation(reg, focused.citation)} — ${root.citation}`,
      description: open
        ? `${displayCitation(reg, focused.citation)} of ${root.citation}: the official text and plain-English summaries on EssentialRegs. The rest of the regulation opens with a trial.`
        : `${displayCitation(reg, focused.citation)} of ${root.citation} is in the full EssentialRegs corpus. Start a trial to open it in the cross-referenced reader.`,
      // A per-provision URL for every id in the corpus is not worth indexing.
      robots: { index: false },
    };
  }
  const rootTitle = titleWithoutCitation(root.title, root.citation) || root.title;
  return {
    title: root.citation,
    description: `${rootTitle} (${root.citation}) — structure and plain-English summaries on EssentialRegs. Subscribe for the full cross-referenced text.`,
  };
}

export default async function RegulationPreviewPage(
  props: PageProps<"/regulations/[reg]/preview">
) {
  const { reg } = await props.params;
  if (!VALID_REG.test(reg)) {
    notFound();
  }

  // Focused preview (Sprint 4, 10 Oct 2026): a result or related-provision
  // link for a provision the visitor cannot open lands here with ?p=<id>.
  // A subscriber is sent on to the exact provision (stale links included);
  // anyone else sees which provision it is and the offer to open it.
  const searchParams = await props.searchParams;
  const id = focusedId(searchParams.p, reg);
  let focused = null;
  let subtreeRows: SubtreeRow[] = [];
  let subtreeShape: SubtreeShape[] = [];
  if (id) {
    // GP05's reader is open to everyone (PUBLIC_READER_REGS), so a link here
    // for one of its provisions goes straight to it, visitor or not. The
    // redirect keeps ?from= and ?tour=1: a subscriber who lands on a preview
    // link from GP05 still gets the reader's return bar and the walkthrough.
    const { hasAccess } = await getAccessStatus();
    if (hasAccess || isPublicReaderReg(reg)) redirect(readerRedirectHref(reg, id, searchParams));
    ({ focused, rows: subtreeRows, shape: subtreeShape } = await loadFocused(reg, id));
  }

  const { root, headings, summaries, pendingSummaries } = await fetchRegulationTeaser(reg);
  if (!root) {
    notFound();
  }
  const regName = regulationDisplayName(reg, root);
  const rootHeading = titleWithoutCitation(root.title, root.citation) || root.citation;
  const tourOn = tourRequested(searchParams[TOUR_PARAM]);
  // "← Back to GP05 · VI.C" when the visitor came from a provision of another
  // regulation (?from=), or "← Back to Regulation 7 · I.C.1" from one of this
  // regulation (walkthrough v3), for a public and a locked provision alike.
  // PreviewReturn adds the hops behind it from sessionStorage once mounted.
  const returnLink = focused ? previewReturnLink(searchParams, reg) : null;
  // The focused provision when the visitor's own session may read it (it is
  // public), as the reader's rows; empty html when it is locked. The summary
  // gate takes the regulation's real pending count, the one the teaser uses.
  // The subtree's same-document links carry this page's hops on, and the
  // walkthrough when it is on.
  const chain = returnLink ? [returnLink.id, ...returnLink.chain] : undefined;
  const subtree = id
    ? renderSubtreeHtml(subtreeRows, {
        reg,
        focusedId: id,
        rootSourceUrl: root.source_url,
        pendingSummaries,
        tour: tourOn,
        chain,
        shape: subtreeShape,
      })
    : { ids: [], html: "", omitted: 0 };

  // Where the visitor is, in a strip under the site header (14 Oct 2026): a
  // page reached by a cross-reference names its document, Part and provision
  // before anything else, tour or not. The way back sits on its right.
  const context = focused ? previewContext({ reg, focusedId: focused.id, root, focused, headings }) : null;

  return (
    <>
      {context && (
        <PreviewContextStrip context={context}>
          {returnLink && <PreviewReturn origin={returnLink} reg={reg} />}
        </PreviewContextStrip>
      )}
      {/* The shared page container (src/lib/ui.ts pageContainerClass), so the
          heading lines up with the ER emblem like every other page. Inside it
          the reading column keeps the text measure it has always had -- 720px,
          what the old 768px max-w-3xl wrapper left after its 24px padding --
          anchored to the container's left edge rather than centred. The
          walkthrough's card measures this column's right edge
          (ReaderTour previewColumnRight: the nearest ancestor with a
          max-width) and floats in the gutter beside it when that is wide
          enough, else docks. */}
      <div className={pageContainerClass("py-12")}>
        <div className="max-w-reading">
          {focused && (
            <div className="mb-10 border-b border-line pb-10">
                <p className="text-sm text-ink-soft">{regName}</p>
              {/* #preview-heading: where the walkthrough's Regulation 7 step lands and anchors (ReaderTour). */}
              <h1 id="preview-heading" className="mt-1 font-serif text-section font-bold tracking-tight text-ink">
                {displayCitation(reg, focused.citation)}
              </h1>
              {titleWithoutCitation(focused.title, focused.citation) && (
                <p className="mt-1 text-lg text-ink-soft">
                  {titleWithoutCitation(focused.title, focused.citation)}
                </p>
              )}
              {focused.context_path && (
                <p className="mt-2 text-xs leading-snug text-muted">{focused.context_path}</p>
              )}
              {subtree.html ? (
                <PreviewSubtree
                  html={subtree.html}
                  regName={regName}
                  readerHref={`/regulations/${reg}#${focused.id}`}
                  partial={subtree.omitted > 0}
                />
              ) : (
                <LockedDestination
                  regName={regName}
                  citation={displayCitation(reg, focused.citation)}
                  title={titleWithoutCitation(focused.title, focused.citation)}
                  readerHref={`/regulations/${reg}#${focused.id}`}
                />
              )}
              {/* The walkthrough's Regulation 7 steps (Sprint 6, src/lib/tour.ts;
                  two hops since v3): a visitor who followed GP05 VI.C's citation
                  lands here with ?tour=1, and again on the I.D preview from
                  I.C.1.c's. Shows only while that tour is past step 5. */}
              {tourOn && <ReaderTour page="destination" hasAccess={false} placement="floating" />}
            </div>
          )}
          <p className={CITATION_EYEBROW_CLASS}>
            {root.citation}
          </p>
          {/* The citation is printed on its own line just above, so the <h1>
              carries only what the title adds. When the title is nothing but the
              citation, repeat the citation rather than ship an empty <h1> -- this
              page is the public SEO surface. */}
          {/* One <h1> per page: the provision's citation owns it when focused. */}
          {focused ? (
            <h2 className="mt-1 font-serif text-section font-bold tracking-tight text-ink">{rootHeading}</h2>
          ) : (
            <h1 className="mt-1 font-serif text-section font-bold tracking-tight text-ink">{rootHeading}</h1>
          )}
          {root.source_url && (
            <a
              href={root.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-11 items-center text-xs text-muted underline hover:text-ink sm:inline sm:min-h-0"
            >
              {sourceLinkTextFor(reg)} ↗
            </a>
          )}
          <p className="mt-3 text-sm text-ink-soft">
            A preview of {root.citation} — its structure, and a few AI-generated
            plain-English summaries. The full cross-referenced text is available
            to subscribers.
          </p>

          {headings.length > 0 && (
            <section className="mt-10">
              <h2 className="font-serif text-card font-semibold text-ink">
                What&apos;s inside
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {headings.map((h) => {
                  const heading = titleWithoutCitation(h.title, h.citation);
                  return (
                    <li
                      key={h.id}
                      className="rounded-md border border-line bg-panel px-4 py-3 text-sm"
                    >
                      <span className={`block ${CITATION_EYEBROW_CLASS}`}>
                        {h.citation}
                      </span>
                      {heading && <span className="mt-0.5 block text-ink-soft">{heading}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="font-serif text-card font-semibold text-ink">
              Plain-English summaries
            </h2>
            {summaries.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4">
                {summaries.map((s) => {
                  const heading = titleWithoutCitation(s.title, s.citation);
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-line bg-panel p-5 shadow-sm"
                    >
                      <p className={CITATION_EYEBROW_CLASS}>
                        {displayCitation(reg, s.citation)}
                      </p>
                      {heading && <p className="mt-1 font-semibold text-ink">{heading}</p>}
                      {summaryParagraphs(s.ai_summary ?? "").map((para, i) => (
                        <p
                          key={i}
                          className="mt-2 text-sm leading-relaxed text-ink-soft"
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : pendingSummaries > 0 ? (
              <p className="mt-4 text-sm text-muted">
                This regulation&apos;s summaries are being checked against the
                source text by an automated check — they appear here once it has
                finished.
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Detailed section-by-section summaries are being added — check
                back soon.
              </p>
            )}
          </section>

          <section className="mt-12 rounded-lg border border-line bg-accent-soft p-6">
            <h2 className="font-serif text-card font-semibold text-ink">
              Read the full text of {root.citation}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Subscribers get the full text, linked cross-references, and
              plain-English summaries as they pass the automated check against
              source text —{" "}
              {PRICE_SUMMARY}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-md bg-accent px-5 py-3 text-center text-sm font-semibold text-white hover:bg-accent/90"
              >
                Subscribe
              </Link>
              <Link
                href={`/regulations/${reg}`}
                className="rounded-md border border-line bg-panel px-5 py-3 text-center text-sm font-semibold text-ink-soft hover:bg-accent-soft"
              >
                Open the full reader
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
