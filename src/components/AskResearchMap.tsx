import Link from "next/link";
import { MapIntro } from "@/components/MapIntro";
import { PROVENANCE_LABEL_CLASS } from "@/components/AskCard";
import { ASK_FINDS_LINE, READING_HEADING, type AskMapRow } from "@/lib/ask-map-rows";
import type { IntroSentence } from "@/lib/question-maps";

/**
 * The research map above an Ask answer (Sprint 8, 11 Oct 2026), shared by
 * /search?mode=ask and the /sample Ask example so the two read the same way:
 *
 *   Question component | Provision | Why it matters
 *
 * one row per group of the answer, the provisions as links (citation and the
 * heading without it), each destination from the page's own helper so a
 * visitor's link to a closed document stays the focused preview. Where each
 * "Why it matters" comes from is in src/lib/ask-map-rows.ts; it is text that
 * already existed and carries no links of its own (the provisions it speaks
 * of are the links in the row). Until Sprint 8 the answer opened with the map's
 * introduction and the cards; the introduction now follows the map, set
 * smaller under "Reading of the provisions above" (AskReading), because a
 * reviewer read the narrative as the answer and the provisions as footnotes.
 *
 * Server component, no script. Below the `md` breakpoint the table is not a
 * table: each row stacks as a block with its three labels, so a phone never
 * scrolls sideways. `<ul>`, not `<ol>`: the cards below are the page's `ol >
 * li` and the specs count those.
 */
export function AskResearchMap({ rows, testId = "ask-map" }: { rows: AskMapRow[]; testId?: string }) {
  if (rows.length === 0) return null;
  return (
    <div data-testid={testId} className="mt-4">
      {/* Prominent and first: what Ask is, before the map (owner brief, Sprint 8). */}
      <p data-testid="ask-finds-line" className="text-sm font-medium text-ink">
        {ASK_FINDS_LINE}
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-line bg-panel">
        <table className="block w-full border-collapse text-left text-sm md:table">
          <caption className="sr-only">The provisions this answer found, by question component</caption>
          <thead className="hidden md:table-header-group">
            <tr className="bg-accent-soft">
              <th scope="col" className="w-1/5 px-4 py-2.5 font-semibold text-ink">
                Question component
              </th>
              <th scope="col" className="w-2/5 px-4 py-2.5 font-semibold text-ink">
                Provision
              </th>
              <th scope="col" className="w-2/5 px-4 py-2.5 font-semibold text-ink">
                Why it matters
              </th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {rows.map((row) => (
              <tr key={row.component} data-testid="ask-map-row" className="block border-t border-line first:border-t-0 md:table-row md:border-t md:first:border-t-0">
                <th scope="row" className="block px-4 pb-1 pt-4 align-top font-serif text-base font-bold text-ink md:table-cell md:py-3">
                  {row.component}
                </th>
                <td className="block px-4 py-2 align-top md:table-cell md:py-3">
                  <span className={`block md:hidden ${PROVENANCE_LABEL_CLASS}`} aria-hidden="true">
                    Provision
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {row.provisions.map((p) => (
                      <li key={p.id} className="leading-snug">
                        <Link href={p.href} className="break-words text-ink underline decoration-line underline-offset-2 hover:text-accent hover:decoration-accent">
                          <span className="font-medium">{p.label}</span>
                          {p.title && <span className="text-ink-soft"> &mdash; {p.title}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="block px-4 pb-4 pt-2 align-top text-ink-soft md:table-cell md:py-3" data-why-source={row.why?.source}>
                  <span className={`block md:hidden ${PROVENANCE_LABEL_CLASS}`} aria-hidden="true">
                    Why it matters
                  </span>
                  {row.why ? (
                    <span className="leading-relaxed">{row.why.text}</span>
                  ) : (
                    <>
                      <span className="text-muted" aria-hidden="true">
                        &mdash;
                      </span>
                      <span className="sr-only">No note for this component</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The map's introduction as the secondary reading (Sprint 8, 11 Oct 2026):
 * the same cited sentences MapIntro has always printed, under a smaller
 * heading that says what they are. An h3 on purpose: the page's h2s are the
 * groups, and the specs read them as such.
 */
export function AskReading({ factors, hasAccess }: { factors: IntroSentence[]; hasAccess: boolean }) {
  return (
    <section className="mt-6" aria-labelledby="ask-reading-title" data-testid="ask-reading">
      <h3 id="ask-reading-title" className="text-sm font-semibold text-ink-soft">
        {READING_HEADING}
      </h3>
      <MapIntro factors={factors} hasAccess={hasAccess} />
    </section>
  );
}
