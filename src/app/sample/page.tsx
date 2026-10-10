import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import { isPublicReaderReg } from "@/lib/destination";
import { AskCard } from "@/components/AskCard";
import { MapIntro } from "@/components/MapIntro";
import { loadSampleRows } from "@/lib/sample-snapshot";
import { TRIAL_DAYS } from "@/lib/pricing";
import {
  RECOMMENDED_START,
  SNAPSHOT,
  answerSections,
  collapseAnswer,
  isOpenForViewer,
  keywordHits,
  layoutSampleAsk,
  moreResultsLabel,
  sampleHref,
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
// A result in GP05 is a normal card with its checked summary and opens in the
// reader. Every other result is a locked card: where it lives in the corpus,
// never its text or summary, linking to the focused preview. A subscriber who
// visits sees nothing locked; every card opens in the reader.

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-3 text-sm font-semibold";
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white hover:bg-accent/90`;
const BUTTON_OUTLINE = `${BUTTON} border border-line bg-panel text-ink hover:bg-accent-soft`;

/**
 * The page's buttons, shown under the intro and again at the bottom
 * (Sprint 5, 10 Oct 2026). A visitor gets the free reader and the trial;
 * `search` adds the search link, at the bottom only. A subscriber has no
 * trial to start, and their search is the whole corpus, so they keep the old
 * wording ("the component knows the viewer").
 */
function Buttons({ hasAccess, testId, search = false }: { hasAccess: boolean; testId: string; search?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3" data-testid={testId}>
      {!hasAccess && (
        <Link href="/signup" className={BUTTON_PRIMARY}>
          Start your {TRIAL_DAYS}-day trial
        </Link>
      )}
      <Link href="/regulations/gp05" className={hasAccess ? BUTTON_PRIMARY : BUTTON_OUTLINE}>
        Open the free GP05 reader
      </Link>
      {search && (
        <Link href="/search" className={BUTTON_OUTLINE}>
          {hasAccess ? "Search the complete corpus" : "Search the free GP05 sample"}
        </Link>
      )}
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
  const { head: answerHead, rest: answerRest } = collapseAnswer(answerSections(ask));

  /** One card: a normal one for a row the viewer may open, a locked one for the rest. */
  const card = (hit: SampleHit, opts: { why?: string } = {}) => {
    const open = isOpenForViewer(hit.reg_key, hasAccess);
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
  const section = (g: AnswerSection, suffix = "") => (
    <section key={g.title} className="mt-8">
      <h3 className="font-serif text-lg font-bold tracking-tight text-ink">
        {g.title}
        {suffix}
      </h3>
      <ol className="mt-3 flex flex-col gap-3">{g.items.map((it) => card(it.hit, { why: it.why }))}</ol>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">
        See how EssentialRegs answers a real Colorado oil and gas compliance question
      </h1>
      <p className="mt-3 max-w-reading text-sm leading-relaxed text-ink-soft">
        An operator with a produced water tank battery wants to know what applies. Below are the keyword search and the
        Ask answer a subscriber gets for it. GP05, the general permit for produced water storage tank batteries, is available
        below in the complete reader. Every other result shows where it lives in the corpus.
      </p>

      <div className="mt-5">
        <Buttons hasAccess={hasAccess} testId="sample-top-cta" />
      </div>

      <p className="mt-3 text-xs text-muted">
        These results are a snapshot from {snapshotDateLabel()}. The live search may differ.
      </p>

      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-10" aria-labelledby="sample-keyword-title" data-testid="sample-keyword">
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
            <MapIntro factors={ask.map.factors} hasAccess={hasAccess} />
            {answerHead.map((g) => section(g))}
            {answerRest.length > 0 && (
              // The rest of every group (Sprint 5, 10 Oct 2026): each group
              // above opens with its first three provisions; this reveals
              // the remainder, group by group, in the same order.
              <details className="group mt-8" data-testid="sample-ask-more">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-soft underline underline-offset-2 hover:text-accent">
                  <span className="group-open:hidden">See the complete sample answer</span>
                  <span className="hidden group-open:inline">Show less of the sample answer</span>
                </summary>
                {answerRest.map((g) => section(g, " (continued)"))}
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

      <section className="mt-12 rounded-lg border border-line bg-accent-soft p-6" data-testid="sample-reader">
        <h2 className="font-serif text-card font-semibold text-ink">
          <Link href="/regulations/gp05" className="underline underline-offset-2">
            Read GP05 in the full reader
          </Link>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          The official text with a plain-English summary beside each provision, and its cross-references to Regulation 3
          and Regulation 7 that open in place.
        </p>
      </section>

      <div className="mt-12">
        <Buttons hasAccess={hasAccess} testId="sample-cta" search />
      </div>
    </div>
  );
}
