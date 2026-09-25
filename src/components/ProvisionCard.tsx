import Link from "next/link";
import { cache } from "react";
import { getAccessStatus } from "@/lib/access";
import { sanitizeCardHtml, summaryParagraphs, titleWithoutCitation } from "@/lib/regulation";
import type { Provision } from "@/lib/types";

// Renders one regulation entry: citation/title, the plain-English summary in
// a native <details> toggle (works with zero JavaScript), the full
// regulatory text, and every cross-reference as a real link — internal ones
// jump to another provision inside the site, external ones go to the
// canonical government source in a new tab.
// /sample renders several cards per request; look the visitor up once.
const cardAccess = cache(getAccessStatus);

export async function ProvisionCard({ provision }: { provision: Provision }) {
  // Links in full_text to another regulation go to the reader for a
  // subscriber and to its public preview for everyone else.
  const { hasAccess } = await cardAccess();
  // Many rows store their own label as the whole title ("II.A.2.") or as the
  // opening of it ("I.G.90. POTENTIAL TO EMIT"), so printing citation + title
  // said the label twice. "" means the title added nothing -- drop the span.
  const headingTitle = titleWithoutCitation(provision.title, provision.citation);
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {provision.jurisdiction_level} · {provision.issuing_body}
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">
        {provision.citation}
        {headingTitle ? (
          <span className="font-normal text-zinc-600"> — {headingTitle}</span>
        ) : null}
      </h2>

      {provision.summary_status !== "rejected" &&
        summaryParagraphs(provision.ai_summary ?? "").length > 0 && (
        <details className="mt-4 rounded-md bg-emerald-50 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-900">
            Plain-English summary
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-emerald-950">
            {summaryParagraphs(provision.ai_summary ?? "").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {/* No reviewer/AI-generated/reviewed-date mention here [Brody,
              Sep 14 2026] -- the card's own "View official source" link
              below already gives a reader a way to verify this directly,
              and the Disclaimer page covers that summaries are AI-generated. */}
        </details>
      )}

      <details className="mt-3 rounded-md bg-zinc-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
          Original regulatory text
        </summary>
        {/* full_text is the importer's HTML (paragraphs, tables, citation
            spans) for every corpus row, so it is sanitized and rendered as
            markup rather than printed as escaped text. The `.card-text`
            styles in globals.css space the paragraphs and style the
            citation spans (which are not clickable here -- the popups are a
            reader-only feature). */}
        <div
          className="card-text mt-2 text-sm leading-relaxed text-zinc-700"
          dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(provision.full_text, hasAccess) }}
        />
      </details>

      {provision.cross_references && provision.cross_references.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Related sections
          </div>
          <ul className="flex flex-wrap gap-2">
            {provision.cross_references.map((ref) => (
              <li key={ref.id}>
                {ref.target_type === "internal" && ref.target_provision_id ? (
                  <Link
                    href={`/regs/${ref.target_provision_id}`}
                    className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {ref.raw_text}
                  </Link>
                ) : ref.target_url ? (
                  <a
                    href={ref.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                  >
                    {ref.raw_text} ↗
                  </a>
                ) : (
                  <span className="inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-400">
                    {ref.raw_text}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
        <span>
          Last verified: {provision.last_verified_date ?? "not yet verified"}
        </span>
        {provision.source_url && (
          <a
            href={provision.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-600"
          >
            View official source ↗
          </a>
        )}
      </div>
    </article>
  );
}
