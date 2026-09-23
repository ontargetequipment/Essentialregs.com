import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchRegulationTeaser, summaryParagraphs, titleWithoutCitation } from "@/lib/regulation";
import { ANNUAL_PRICE_DISPLAY } from "@/lib/pricing";

// `reg` gets interpolated into a `like "sec-{reg}-%"` filter
// (fetchRegulationTeaser) -- restricting it to alphanumerics before it ever
// reaches that query closes off PostgREST filter-syntax injection via the
// URL segment, same as the gated reader at ../page.tsx.
const VALID_REG = /^[A-Za-z0-9]+$/;

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

  const { root, headings, summaries } = await fetchRegulationTeaser(reg);
  if (!root) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-mono uppercase tracking-wide text-emerald-700">
        {root.citation}
      </p>
      {/* The citation is printed on its own line just above, so the <h1>
          carries only what the title adds. When the title is nothing but the
          citation, repeat the citation rather than ship an empty <h1> -- this
          page is the public SEO surface. */}
      <h1 className="mt-1 text-2xl font-bold text-zinc-900">
        {titleWithoutCitation(root.title, root.citation) || root.citation}
      </h1>
      {root.source_url && (
        <a
          href={root.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-zinc-500 underline hover:text-zinc-700"
        >
          View official source ↗
        </a>
      )}
      <p className="mt-3 text-sm text-zinc-600">
        A preview of {root.citation} — its structure, and a few
        already-reviewed, plain-English summaries. The full cross-referenced
        text is available to subscribers.
      </p>

      {headings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-900">
            What&apos;s inside
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {headings.map((h) => {
              const heading = titleWithoutCitation(h.title, h.citation);
              return (
                <li
                  key={h.id}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm"
                >
                  <span className="block font-mono text-xs uppercase tracking-wide text-emerald-700">
                    {h.citation}
                  </span>
                  {heading && <span className="mt-0.5 block text-zinc-700">{heading}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900">
          Plain-English summaries
        </h2>
        {summaries.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {summaries.map((s) => {
              const heading = titleWithoutCitation(s.title, s.citation);
              return (
                <div
                  key={s.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-mono uppercase tracking-wide text-emerald-700">
                    {s.citation}
                  </p>
                  {heading && <p className="mt-1 font-semibold text-zinc-900">{heading}</p>}
                  {summaryParagraphs(s.ai_summary ?? "").map((para, i) => (
                    <p
                      key={i}
                      className="mt-2 text-sm leading-relaxed text-zinc-600"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Detailed section-by-section summaries are being added — check
            back soon.
          </p>
        )}
      </section>

      <section className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Read the full text of {root.citation}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Subscribers get every section, every cross-reference resolved, and
          plain-English summaries as they&apos;re reviewed —{" "}
          {ANNUAL_PRICE_DISPLAY}.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Subscribe
          </Link>
          <Link
            href={`/regulations/${reg}`}
            className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Open the full reader
          </Link>
        </div>
      </section>
    </div>
  );
}
