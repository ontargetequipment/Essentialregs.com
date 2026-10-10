import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  fetchProvisionTeaser,
  fetchRegulationTeaser,
  sourceLinkTextFor,
  summaryParagraphs,
  titleWithoutCitation,
} from "@/lib/regulation";
import { regKeyOf, regulationDisplayName } from "@/lib/regulation-names";
import { getAccessStatus } from "@/lib/access";
import { LockedDestination } from "@/components/LockedDestination";
import { isPublicReaderReg } from "@/lib/destination";
import { PRICE_SUMMARY } from "@/lib/pricing";
import { PROVISION_ID } from "@/lib/types";

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
  const focused = id ? await fetchProvisionTeaser(reg, id) : null;
  if (focused) {
    return {
      title: `${focused.citation} — ${root.citation}`,
      description: `${focused.citation} of ${root.citation} is in the full EssentialRegs corpus. Start a trial to open it in the cross-referenced reader.`,
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
  const id = focusedId((await props.searchParams).p, reg);
  let focused = null;
  if (id) {
    // GP05's reader is open to everyone (PUBLIC_READER_REGS), so a link here
    // for one of its provisions goes straight to it, visitor or not.
    const { hasAccess } = await getAccessStatus();
    if (hasAccess || isPublicReaderReg(reg)) redirect(`/regulations/${reg}#${id}`);
    focused = await fetchProvisionTeaser(reg, id);
  }

  const { root, headings, summaries, pendingSummaries } = await fetchRegulationTeaser(reg);
  if (!root) {
    notFound();
  }
  const regName = regulationDisplayName(reg, root);
  const rootHeading = titleWithoutCitation(root.title, root.citation) || root.citation;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {focused && (
        <div className="mb-10 border-b border-line pb-10">
          <p className="text-sm text-ink-soft">{regName}</p>
          <h1 className="mt-1 font-serif text-section font-bold tracking-tight text-ink">
            {focused.citation}
          </h1>
          {titleWithoutCitation(focused.title, focused.citation) && (
            <p className="mt-1 text-lg text-ink-soft">
              {titleWithoutCitation(focused.title, focused.citation)}
            </p>
          )}
          {focused.context_path && (
            <p className="mt-2 text-xs leading-snug text-muted">{focused.context_path}</p>
          )}
          <LockedDestination
            regName={regName}
            citation={focused.citation}
            title={titleWithoutCitation(focused.title, focused.citation)}
            readerHref={`/regulations/${reg}#${focused.id}`}
          />
        </div>
      )}
      <p className="font-mono text-eyebrow uppercase text-tag">
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
                  <span className="block font-mono text-eyebrow uppercase text-tag">
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
                  <p className="font-mono text-eyebrow uppercase text-tag">
                    {s.citation}
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
            This regulation&apos;s summaries are being checked by the automated
            review — they appear here once the review has finished.
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
          plain-English summaries as they pass AI review —{" "}
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
  );
}
