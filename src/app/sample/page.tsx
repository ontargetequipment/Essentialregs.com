import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import { isPublicReaderReg } from "@/lib/destination";
import { AskCard } from "@/components/AskCard";
import { AskReading, AskResearchMap } from "@/components/AskResearchMap";
import { loadSampleRows } from "@/lib/sample-snapshot";
import { TRIAL_DAYS } from "@/lib/pricing";
import { buttonClass } from "@/lib/ui";
import { TOUR_START_HREF } from "@/lib/tour";
import {
  RECOMMENDED_START,
  SNAPSHOT,
  answerSections,
  isOpenCard,
  keywordHits,
  layoutSampleAsk,
  moreResultsLabel,
  sampleHref,
  sampleMapRows,
  showingLine,
  snapshotDateLabel,
  splitKeywordHits,
  type AnswerSection,
  type SampleHit,
  type SampleRow,
} from "@/lib/sample-pure";
import { mapTitle } from "@/lib/question-maps";
import { regulationDisplayName } from "@/lib/regulation-pure";
import type { SummaryBadgeInput } from "@/lib/regulation-pure";

export const metadata = {
  title: "Sample",
};

// The /sample page (Sprint 4, 10 Oct 2026). It used to show four hand-picked
// provisions as cards. It now shows one real compliance question answered
// two ways -- a keyword search and an Ask -- from a frozen snapshot
// (src/data/sample-snapshot.json, src/lib/sample-pure.ts), plus GP05, the one
// regulation open in the full reader to anyone (PUBLIC_READER_REGS). The page
// runs no search: it looks the stored ids up for labels (sample-snapshot.ts,
// label-only reads) and lays them out with the functions /search uses.
//
// Sprint 5 (10 Oct 2026) trimmed the page for a first-time visitor: the two
// buttons sit under the intro as well as at the bottom, a "Recommended
// starting point" line leads the keyword results, five results open at first
// (the other five behind a <details>), and the Ask answer opens with three
// provisions per group (the rest behind "See the complete sample answer").
// Both disclosures are server-rendered <details>, like the test-method page's
// "Show all": all the cards are in the HTML, no script runs.
//
// Sprint 6 (10 Oct 2026) leads with the guided walkthrough: one button into
// the real GP05 reader with ?tour=1 (src/lib/tour.ts), where the visitor does
// the research once. The search and Ask example is the second section, a
// collapsed <details> of its own, with its two inner disclosures unchanged.
//
// Sprint 8 (11 Oct 2026) turned the Ask example into a research map: the
// table first (Question component | Provision | Why it matters, one row per
// group, src/components/AskResearchMap.tsx), the map's cited introduction
// under it as "Reading of the provisions above", then the cards behind the one
// "See the complete sample answer" disclosure. /search?mode=ask renders the
// same component in the same order. The reviewer had read the narrative as
// the answer and the provisions as supporting detail; the order says the
// reverse.
//
// A result in GP05 is a normal card with its checked summary and opens in the
// reader. Every other result is a locked card: where it lives in the corpus,
// never its text or summary, linking to the focused preview. A subscriber who
// visits sees nothing locked; every card opens in the reader.
//
// Walkthrough v3.1 (13 Oct 2026, the tenth review): the walkthrough card is
// the page's one primary call to action, with "Explore GP05 on your own" as
// its secondary; the duplicate reader buttons and the "Read GP05 in the full
// reader" block are gone (its one useful sentence is in the intro, which now
// says that for a visitor a cross-reference opens as a free preview page).
// The trial button stays at the bottom, by the search link. The eight
// Regulation 7 rows the Ask example cites are public (migration
// 20261013051740), so their cards are open ones (isOpenCard) and their
// previews show the text.

// Every button here is the site's one green button (src/lib/ui.ts).
const BUTTON = buttonClass();

/** The secondary button beside a green one: the locked panels' "Log in" style (LockedDestination.tsx). */
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-panel px-5 py-3 text-center text-sm font-semibold text-ink-soft hover:bg-accent-soft";

/**
 * The page's closing buttons (Sprint 5, 10 Oct 2026; v3.1 keeps them at the
 * bottom only): a visitor gets the trial and the search of the free sample; a
 * subscriber has no trial to start, and their search is the whole corpus, so
 * they keep the old wording ("the component knows the viewer"). The reader
 * button that used to sit here is the walkthrough card's secondary now.
 */
function Buttons({ hasAccess, testId }: { hasAccess: boolean; testId: string }) {
  return (
    <div className="flex flex-wrap gap-3" data-testid={testId}>
      {!hasAccess && (
        <Link href="/signup" className={BUTTON}>
          Start your {TRIAL_DAYS}-day trial!
        </Link>
      )}
      <Link href="/search" className={BUTTON}>
        {hasAccess ? "Search the complete corpus" : "Search the free GP05 sample"}
      </Link>
    </div>
  );
}

/** What AskCard needs of a row's review state, for the badge beside its summary. */
function reviewOf(row: SampleRow | undefined): SummaryBadgeInput | undefined {
  if (!row || row.summary_status === undefined) return undefined;
  return {
    summary_status: row.summary_status,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by_human: row.reviewed_by_human ?? false,
  };
}

const NO_HEADING_CHILDREN = new Map<string, number | null>();

export default async function SamplePage() {
  const access = await getAccessStatus();
  const { hasAccess } = access;

  let rows = new Map<string, SampleRow>();
  let error: string | null = null;
  try {
    rows = await loadSampleRows();
  } catch (e) {
    console.error("sample:", e instanceof Error ? e.message : e);
    error = "Couldn't load the sample right now. Please try again in a moment.";
  }

  const keyword = keywordHits(rows);
  const ask = layoutSampleAsk(rows);
  const stated = ask.stated;
  const { first: keywordFirst, more: keywordMore } = splitKeywordHits(keyword);
  const answer = answerSections(ask);
  const mapRows = sampleMapRows(ask, rows, hasAccess);

  /** One card: a normal one for a row the viewer may open, a locked one for the rest. */
  const card = (hit: SampleHit, opts: { why?: string } = {}) => {
    const open = isOpenCard(rows.get(hit.id), hit.reg_key, hasAccess);
    return (
      <AskCard
        key={hit.id}
        row={hit}
        why={opts.why}
        name={hit.reg_key ? regulationDisplayName(hit.reg_key) : ""}
        review={open ? reviewOf(rows.get(hit.id)) : undefined}
        headingChildren={NO_HEADING_CHILDREN}
        href={sampleHref(hit, hasAccess)}
        locked={!open}
        noSummaryLine={!isPublicReaderReg(hit.reg_key)}
      />
    );
  };

  /** One group of the Ask answer: its heading and its cards. */
  const section = (g: AnswerSection) => (
    <section key={g.title} className="mt-8">
      <h3 className="font-serif text-lg font-bold tracking-tight text-ink">{g.title}</h3>
      <ol className="mt-3 flex flex-col gap-3">{g.items.map((it) => card(it.hit, { why: it.why }))}</ol>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">
        See how EssentialRegs answers a real Colorado oil and gas compliance question
      </h1>
      <p className="mt-3 max-w-reading text-sm leading-relaxed text-ink-soft">
        An operator with a produced water tank battery wants to know what applies. Walk through the research yourself, or
        compare the Search and Ask results below. GP05, the general permit for produced water storage tank batteries, is
        free to read in full: the official text with a plain-English summary beside each provision, and cross-references
        that open in place for subscribers (in this walkthrough they open as free preview pages).
      </p>

      <section
        className="mt-8 rounded-lg border border-line bg-accent-soft p-6"
        aria-labelledby="sample-walkthrough-title"
        data-testid="sample-walkthrough"
      >
        <h2 id="sample-walkthrough-title" className="font-serif text-card font-semibold text-ink">
          Take the short guided walkthrough
        </h2>
        <p className="mt-2 max-w-reading text-sm leading-relaxed text-ink-soft">
          You operate a produced-water tank battery under GP05 and need the site-specific sampling requirements. In about
          two minutes you find the provision, read the official text, check the plain-English summary and follow a
          citation into Regulation 7, in the real reader.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={TOUR_START_HREF} className={BUTTON}>
            Start the walkthrough
          </Link>
          <Link href="/regulations/gp05" className={SECONDARY}>
            Explore GP05 on your own
          </Link>
        </div>
      </section>

      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {/* The search and Ask example (Sprints 4 and 5), collapsed under the
          walkthrough (Sprint 6). Server-rendered: every card is in the HTML. */}
      <details className="group/example mt-10 rounded-lg border border-line bg-panel" data-testid="sample-example">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-5 py-4 font-serif text-lg font-bold tracking-tight text-ink">
          <span>Search and Ask: the same question answered two ways</span>
          <span className="shrink-0 font-sans text-sm font-medium text-ink-soft underline underline-offset-2 group-open/example:hidden">
            Show
          </span>
          <span className="hidden shrink-0 font-sans text-sm font-medium text-ink-soft underline underline-offset-2 group-open/example:inline">
            Hide
          </span>
        </summary>
        <div className="border-t border-line px-5 pb-6">
          <p className="mt-4 text-xs text-muted">
            These results are a snapshot from {snapshotDateLabel()}. The live search may differ.
          </p>

          <section className="mt-8" aria-labelledby="sample-keyword-title" data-testid="sample-keyword">
            <h2 id="sample-keyword-title" className="font-serif text-lg font-bold tracking-tight text-ink">
              Keyword search: &ldquo;{SNAPSHOT.keyword.query}&rdquo;
            </h2>
            <p className="mt-2 text-sm text-ink-soft" data-testid="sample-recommended">
              <span className="font-medium text-ink">Recommended starting point:</span>{" "}
              <Link href={RECOMMENDED_START.href} className="font-medium underline underline-offset-2 hover:text-accent">
                {RECOMMENDED_START.label}
              </Link>
            </p>
            <p className="mt-3 font-mono text-eyebrow uppercase text-tag">{showingLine()}</p>
            <ol className="mt-3 flex flex-col gap-3">{keywordFirst.map((hit) => card(hit))}</ol>
            {keywordMore.length > 0 && (
              // Server-rendered disclosure (Sprint 5, 10 Oct 2026): the next
              // results are already in the HTML, so no script and no request.
              <details className="group mt-3" data-testid="sample-keyword-more">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-soft underline underline-offset-2 hover:text-accent">
                  <span className="group-open:hidden">{moreResultsLabel()}</span>
                  <span className="hidden group-open:inline">Show fewer results</span>
                </summary>
                <ol className="mt-3 flex flex-col gap-3">{keywordMore.map((hit) => card(hit))}</ol>
              </details>
            )}
          </section>

          <section className="mt-12" aria-labelledby="sample-ask-title" data-testid="sample-ask">
            <h2 id="sample-ask-title" className="font-serif text-lg font-bold tracking-tight text-ink">
              Ask: &ldquo;{SNAPSHOT.ask.question}&rdquo;
            </h2>
            {ask.map && ask.grouped ? (
              <>
                <p className="mt-3 text-sm">
                  <span className="font-mono text-eyebrow uppercase text-tag">Mapped question:</span>{" "}
                  <span className="font-semibold text-ink" data-testid="map-title">
                    {mapTitle(ask.map, stated)}
                  </span>
                </p>
                {/* The research map first, the map's cited introduction under it as
                    the secondary reading, then the cards (Sprint 8, 11 Oct 2026). */}
                <AskResearchMap rows={mapRows} />
                <AskReading factors={ask.map.factors} hasAccess={hasAccess} />
                {answer.length > 0 && (
                  // The cards, group by group (Sprint 8, 11 Oct 2026): the table
                  // above already lists every provision of every group with its
                  // link, so the cards -- summary, badge, "why it's here" -- sit
                  // behind the one disclosure (Sprint 5 opened three per group
                  // and kept the rest behind it; now all of them are). They are
                  // still in the HTML; no script runs.
                  <details className="group mt-8" data-testid="sample-ask-more">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-soft underline underline-offset-2 hover:text-accent">
                      <span className="group-open:hidden">See the complete sample answer</span>
                      <span className="hidden group-open:inline">Show less of the sample answer</span>
                    </summary>
                    {answer.map((g) => section(g))}
                  </details>
                )}
                {ask.summary?.omitted.map((o) => (
                  <p key={o.facet} className="mt-6 rounded-md border border-line bg-panel px-4 py-3 text-sm text-ink-soft">
                    <span className="font-medium text-ink">Not shown because you said {o.said}:</span> {o.omitted}.
                  </p>
                ))}
                <p className="mt-6 text-xs text-muted">
                  The groups are a map of where the rules for this question live; the provisions inside them are the
                  regulation&apos;s own, with the ones found by meaning and by your words marked with a match score. Statements
                  of basis (rulemaking history) are hidden. None of this is legal advice; read the full text and check the
                  official source before relying on it.
                </p>
              </>
            ) : (
              !error && <p className="mt-3 text-sm text-muted">The Ask answer is not available right now.</p>
            )}
          </section>
        </div>
      </details>

      <div className="mt-12">
        <Buttons hasAccess={hasAccess} testId="sample-cta" />
      </div>
    </div>
  );
}
