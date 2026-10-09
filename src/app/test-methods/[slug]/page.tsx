import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TEST_METHODS, TEST_METHOD_BY_SLUG, type TestMethod } from "@/data/test-methods";
import { fetchCitedBy, type CitedByGroup } from "@/lib/test-method-citations";

/**
 * One Test Methods reference page. Free and public: no getAccessStatus(),
 * no subscribe panel; an anonymous visitor and a subscriber get the same
 * page. The entry comes from the data file; the "Cited by" list is the one
 * database read (fetchCitedBy, service role, labels only).
 *
 * Prerendered for every slug at build (generateStaticParams, dynamicParams
 * false so an unknown slug is a 404 rather than a render) and refreshed
 * every hour (ISR), which is how a re-link of the corpus reaches the
 * cited-by lists without a deploy. A citation link into a regulation goes
 * to the gated reader, which applies the normal entitlement check.
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

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-2 font-serif text-[17px] leading-relaxed text-ink">{children}</div>
    </section>
  );
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
            <p className="mt-1 text-sm text-muted">
              +{g.more} more {g.more === 1 ? "provision" : "provisions"} in {g.name} cite {method.shortName}.
            </p>
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
        <p className="mt-2 text-base leading-relaxed text-ink-soft">{method.officialTitle}</p>
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

        <div className="mt-8 flex flex-col gap-8">
          <Section id="measures" title="What it measures">
            <p>{method.measures}</p>
          </Section>
          <Section id="principle" title="How it works">
            <p>{method.principle}</p>
          </Section>
          <Section id="equipment" title="Equipment">
            <p>{method.equipment}</p>
          </Section>
          <Section id="when-cited" title="When a rule cites it">
            <p>{method.whenCited}</p>
          </Section>
          {method.readerNotes && (
            <Section id="reader-notes" title="Notes for compliance staff">
              <p>{method.readerNotes}</p>
            </Section>
          )}

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
              Provisions in the corpus whose text cites {method.shortName}. Each
              opens in the regulation reader.
            </p>
            <CitedBy groups={citedBy} method={method} />
          </section>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          This is an EssentialRegs reference page, not the method text. The
          method as published in the CFR controls.
        </p>
      </div>
    </div>
  );
}
