import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import { isPublicReaderReg } from "@/lib/destination";
import { AskCard } from "@/components/AskCard";
import { MapIntro } from "@/components/MapIntro";
import { loadSampleRows } from "@/lib/sample-snapshot";
import {
  SNAPSHOT,
  isOpenForViewer,
  keywordHits,
  layoutSampleAsk,
  sampleHref,
  showingLine,
  snapshotDateLabel,
  type SampleHit,
  type SampleRow,
} from "@/lib/sample-pure";
import { mapTitle, OTHER_GROUP } from "@/lib/question-maps";
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
// A result in GP05 is a normal card with its checked summary and opens in the
// reader. Every other result is a locked card: where it lives in the corpus,
// never its text or summary, linking to the focused preview. A subscriber who
// visits sees nothing locked; every card opens in the reader.

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-3 text-sm font-semibold";
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white hover:bg-accent/90`;
const BUTTON_OUTLINE = `${BUTTON} border border-line bg-panel text-ink hover:bg-accent-soft`;

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">
        See how EssentialRegs answers a real Colorado oil and gas compliance question
      </h1>
      <p className="mt-3 max-w-reading text-sm leading-relaxed text-ink-soft">
        An operator with a produced water tank battery wants to know what applies. Below are the keyword search and the
        Ask answer a subscriber gets for it. GP05, the general permit for produced water storage tank batteries, is open in
        the full reader. Every other result shows where it lives in the corpus.
      </p>

      <p className="mt-3 text-xs text-muted">
        These results are a snapshot from {snapshotDateLabel()}. The live search may differ.
      </p>

      {error && <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-10" aria-labelledby="sample-keyword-title" data-testid="sample-keyword">
        <h2 id="sample-keyword-title" className="font-serif text-lg font-bold tracking-tight text-ink">
          Keyword search: &ldquo;{SNAPSHOT.keyword.query}&rdquo;
        </h2>
        <p className="mt-1 font-mono text-eyebrow uppercase text-tag">{showingLine()}</p>
        <ol className="mt-3 flex flex-col gap-3">{keyword.map((hit) => card(hit))}</ol>
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
            {ask.grouped.groups.map((g) => (
              <section key={g.group} className="mt-8">
                <h3 className="font-serif text-lg font-bold tracking-tight text-ink">{g.group}</h3>
                <ol className="mt-3 flex flex-col gap-3">
                  {g.canonical.map((p) => {
                    const hit = ask.canonicalRows.get(p.id);
                    return hit ? card(hit, { why: p.why }) : null;
                  })}
                  {g.hits.map((hit) => card(hit))}
                </ol>
              </section>
            ))}
            {ask.grouped.other.length > 0 && (
              <section className="mt-8">
                <h3 className="font-serif text-lg font-bold tracking-tight text-ink">{OTHER_GROUP}</h3>
                <ol className="mt-3 flex flex-col gap-3">{ask.grouped.other.map((hit) => card(hit))}</ol>
              </section>
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

      <div className="mt-12 flex flex-wrap gap-3" data-testid="sample-cta">
        <Link href="/signup" className={BUTTON_PRIMARY}>
          Start your trial
        </Link>
        <Link href="/search" className={BUTTON_OUTLINE}>
          Search the complete corpus
        </Link>
      </div>
    </div>
  );
}
