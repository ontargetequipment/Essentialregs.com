import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TestMethodBody } from "@/components/TestMethodBody";
import { TEST_METHODS, TEST_METHOD_BY_SLUG, titleWithoutMethodName, type TestMethod } from "@/data/test-methods";
import { fetchCitedBy, type CitedByGroup } from "@/lib/test-method-citations";

/**
 * One Test Methods reference page. Free and public: no getAccessStatus(),
 * no subscribe panel; an anonymous visitor and a subscriber get the same
 * page. The entry comes from the data file; the "Cited by" list is the one
 * database read (fetchCitedBy, service role, labels only). The body
 * (TestMethodBody) opens with sections 1.0-2.0 of the method as official
 * text, then "EssentialRegs notes", our editorial copy.
 *
 * Prerendered for every slug at build (generateStaticParams, dynamicParams
 * false so an unknown slug is a 404 rather than a render) and refreshed
 * every hour (ISR), which is how a re-link of the corpus reaches the
 * cited-by lists without a deploy. The page is the same HTML for everyone,
 * so a citation link is the one a visitor can open (Sprint 5, 10 Oct 2026):
 * the focused preview of the provision (/regulations/<reg>/preview?p=<id>),
 * or the reader itself for GP05. A subscriber who follows it is redirected by
 * the preview page to the exact provision in the reader.
 */
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return TEST_METHODS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata(props: PageProps<"/test-methods/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const method = TEST_METHOD_BY_SLUG.get(slug);
  if (!method) return {};
  return {
    title: `${method.shortName} — Test Methods`,
    description: `${method.officialTitle}. ${method.measures}`,
  };
}

function CitedBy({ groups, method }: { groups: CitedByGroup[] | null; method: TestMethod }) {
  if (groups === null) {
    return (
      <p className="mt-2 text-sm text-muted">
        The list of provisions citing {method.shortName} could not be loaded just now.
      </p>
    );
  }
  if (groups.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted">
        No provision in the corpus is recorded as citing {method.shortName} yet.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.regKey}>
          <h3 className="font-mono text-eyebrow uppercase text-tag">{g.name}</h3>
          <ul className="mt-1.5 flex flex-col text-sm leading-relaxed text-ink-soft">
            {g.rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
                >
                  {r.citation}
                </Link>
                {r.title && <span> — {r.title}</span>}
              </li>
            ))}
          </ul>
          {g.more > 0 && (
            // Server-rendered disclosure (9 Oct 2026): the full list is already
            // in the HTML, so "Show all" needs no script and no request, and
            // the summary line is the "+N more" text that used to be static.
            <details className="group mt-1 text-sm">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted underline underline-offset-2 hover:text-accent sm:min-h-0">
                <span className="group-open:hidden">
                  +{g.more} more {g.more === 1 ? "provision" : "provisions"} in {g.name} cite {method.shortName}. Show all
                </span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <ul className="mt-1 flex flex-col leading-relaxed text-ink-soft">
                {g.rest.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
                    >
                      {r.citation}
                    </Link>
                    {r.title && <span> — {r.title}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function TestMethodPage(props: PageProps<"/test-methods/[slug]">) {
  const { slug } = await props.params;
  const method = TEST_METHOD_BY_SLUG.get(slug);
  if (!method) notFound();

  // A database or configuration problem (the table not created yet, the
  // service-role key absent at build) degrades to a one-line note under
  // "Cited by"; the reference page itself never fails for it.
  let citedBy: CitedByGroup[] | null = null;
  try {
    citedBy = await fetchCitedBy(method.slug);
  } catch (error) {
    console.error(`test-methods/${method.slug}: cited-by list unavailable:`, error instanceof Error ? error.message : error);
  }

  const related = method.relatedSlugs
    .map((s) => TEST_METHOD_BY_SLUG.get(s))
    .filter((m): m is TestMethod => m !== undefined);

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <p className="font-mono text-eyebrow uppercase text-tag">
          <Link href="/test-methods" className="hover:text-accent hover:underline">
            Test Methods
          </Link>
        </p>
        <h1 className="mt-2 font-serif text-section font-bold tracking-tight text-ink">{method.shortName}</h1>
        <p className="mt-2 text-base leading-relaxed text-ink-soft">{titleWithoutMethodName(method.shortName, method.officialTitle)}</p>
        <p className="mt-1 text-sm text-muted">{method.source}</p>
        <p className="mt-4">
          <a
            href={method.ecfrUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center rounded-md border border-line bg-panel px-4 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            Read the method on the eCFR →
          </a>
        </p>

        <TestMethodBody method={method}>
          {related.length > 0 && (
            <section id="related" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-lg font-semibold text-ink">
                Related methods
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {related.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`/test-methods/${m.slug}`}
                      className="inline-flex min-h-11 items-center rounded-full bg-accent-soft px-3 text-xs font-medium text-accent hover:bg-line sm:min-h-0 sm:py-1"
                    >
                      {m.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="cited-by" aria-labelledby="cited-by-heading">
            <h2 id="cited-by-heading" className="text-lg font-semibold text-ink">
              Cited by
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Provisions in the corpus whose text cites {method.shortName}.
              Subscribers land on the provision in the regulation reader;
              visitors see a preview of it (the GP05 sample opens in full).
            </p>
            <CitedBy groups={citedBy} method={method} />
          </section>
        </TestMethodBody>

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          The sections marked as regulatory text above are reproduced from the
          CFR. Everything under ‘EssentialRegs notes’ is our reference copy,
          not the method. The method as published in the CFR controls.
        </p>
      </div>
    </div>
  );
}
