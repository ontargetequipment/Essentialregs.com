import snapshotJson from "@/data/sample-snapshot.json";
import { formatDayMonthYear } from "@/lib/dates";
import { isPublicReaderReg, provisionDestination } from "@/lib/destination";
import { OTHER_GROUP, layoutAsk, matchQuestionMap, type QuestionMap } from "@/lib/question-maps";
import { regKeyOf } from "@/lib/regulation-names";

/**
 * The pure half of the /sample page (Sprint 4, 10 Oct 2026): the frozen
 * snapshot's shape, which ids it needs, who may open which result, and the
 * Ask layout. No server-only imports, so scripts/sample-snapshot.test.ts
 * runs all of it; the request-time hydration is src/lib/sample-snapshot.ts.
 *
 * What the snapshot is: ONE keyword search and ONE Ask, run on 10 Oct 2026
 * (the Ask by the Ask eval workflow, run 38020544005), stored as ids in
 * src/data/sample-snapshot.json. The page does not run a search. It looks
 * the ids up for their labels and lays them out with the same functions
 * /search?mode=ask uses (layoutAsk), so the grouped answer is the answer a
 * subscriber gets. Do not re-derive the ids when the corpus changes; the
 * page says it is a snapshot.
 */

export type SampleSnapshot = {
  /** When the snapshot was taken, as an instant (ISO 8601 with a zone); the page prints it in America/Denver. */
  generated: string;
  note: string;
  keyword: {
    query: string;
    provenance: string;
    /** How many results the full search returned. */
    total: number;
    /** How many of them the page shows. */
    show: number;
    ids: string[];
  };
  ask: {
    question: string;
    provenance: string;
    map_key: string;
    /** "facet=value" as the engine reported it. */
    stated: string;
    /** What the eval printed for this question, kept to check the layout against. */
    eval_printed: {
      shown_as: string;
      stated: string;
      not_shown: string;
      omitted_ids: string[];
      first_shown: string[];
    };
    /** Retrieval order. */
    hits: { id: string; score: number; keyword_hit: boolean }[];
  };
};

export const SNAPSHOT: SampleSnapshot = snapshotJson as SampleSnapshot;

/** The label columns every row is hydrated with, and nothing else. */
export type SampleLabel = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  jurisdiction_level: "state" | "federal" | "county";
  context_path: string | null;
};

/** The summary columns, hydrated only for rows a visitor may read (and only after the public summary gate). */
export type SampleSummary = {
  ai_summary: string | null;
  summary_status: string | null;
  reviewed_at: string | null;
  reviewed_by_human: boolean;
};

export type SampleRow = SampleLabel & Partial<SampleSummary>;

/** The keyword ids the page shows: the first `show` of the stored results. */
export function keywordShownIds(snapshot: SampleSnapshot = SNAPSHOT): string[] {
  return snapshot.keyword.ids.slice(0, snapshot.keyword.show);
}

/**
 * The snapshot's date as the page prints it: "9 Oct 2026". `generated` is an
 * instant, read on the America/Denver calendar (Sprint 5, 10 Oct 2026): the
 * snapshot was stamped 10 Oct (UTC) while it was still the evening of 9 Oct
 * in Colorado, and the page showed a date that had not happened yet.
 */
export function snapshotDateLabel(snapshot: SampleSnapshot = SNAPSHOT): string {
  return formatDayMonthYear(snapshot.generated);
}

/**
 * How many keyword results the page opens with (Sprint 5, 10 Oct 2026); a
 * server-rendered <details> under them reveals the rest of the snapshot's
 * `show` (ten). Five is a first screen a visitor can take in.
 */
export const KEYWORD_INITIAL = 5;

/** "Showing 5 of 25 results": what is open before the disclosure is. */
export function showingLine(snapshot: SampleSnapshot = SNAPSHOT): string {
  const { show, total } = snapshot.keyword;
  return `Showing ${Math.min(KEYWORD_INITIAL, show, total)} of ${total} results`;
}

/** The disclosure's summary: "Show 5 more results (10 of 25)". */
export function moreResultsLabel(snapshot: SampleSnapshot = SNAPSHOT): string {
  const { show, total } = snapshot.keyword;
  const shown = Math.min(show, total);
  const more = shown - Math.min(KEYWORD_INITIAL, shown);
  return `Show ${more} more ${more === 1 ? "result" : "results"} (${shown} of ${total})`;
}

/** The shown keyword hits split into the ones open at first and the ones behind the disclosure. */
export function splitKeywordHits<T>(hits: T[]): { first: T[]; more: T[] } {
  return { first: hits.slice(0, KEYWORD_INITIAL), more: hits.slice(KEYWORD_INITIAL) };
}

/** The line above the keyword results: the permit the sample recommends starting with. */
export const RECOMMENDED_START = {
  label: "GP05 \u2014 Produced Water Storage Tank Batteries",
  href: "/regulations/gp05",
} as const;

/** The map the snapshot's question routes to (the same router /search uses). */
export function snapshotMap(snapshot: SampleSnapshot = SNAPSHOT): QuestionMap | null {
  return matchQuestionMap(snapshot.ask.question);
}

/**
 * Every id the page needs a label for, once each, in first-seen order: the
 * keyword results it shows, the Ask hits and the map's canonical rows. One
 * `.in("id", ids)` read hydrates them all.
 */
export function sampleIds(snapshot: SampleSnapshot = SNAPSHOT): string[] {
  const out = new Set<string>(keywordShownIds(snapshot));
  for (const h of snapshot.ask.hits) out.add(h.id);
  for (const p of snapshotMap(snapshot)?.provisions ?? []) out.add(p.id);
  return Array.from(out);
}

/**
 * Whether the viewer may open this result in the reader: a subscriber
 * always, anyone for a PUBLIC_READER_REGS regulation (GP05). Everything else
 * is a locked card. The same rule as provisionDestination, which decides
 * the link; this decides the card.
 */
export function isOpenForViewer(regKey: string | null, hasAccess: boolean): boolean {
  return hasAccess || isPublicReaderReg(regKey);
}

/** Where a result opens: the reader if the viewer may open it, else the focused preview (provisionDestination). */
export function sampleHref(row: Pick<SampleLabel, "id" | "reg_key">, hasAccess: boolean): string {
  return provisionDestination(row, { hasAccess });
}

/**
 * The ids whose summaries the page may hydrate: only rows of a regulation
 * open to visitors. A subscriber's cards for the rest carry labels only, by
 * design (the page is a sample, not a second search).
 */
export function summaryIds(ids: string[]): string[] {
  return ids.filter((id) => isPublicReaderReg(regKeyOf(id)));
}

/** A hit as the Ask layout and AskCard read it. */
export type SampleHit = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  jurisdiction_level: "state" | "federal" | "county";
  summary: string | null;
  score: number | null;
  keyword_hit: boolean;
  path: string | null;
  retrieved: boolean;
};

function toHit(row: SampleRow, score: number | null, keywordHit: boolean, retrieved: boolean): SampleHit {
  return {
    id: row.id,
    citation: row.citation,
    title: row.title,
    reg_key: row.reg_key ?? regKeyOf(row.id)?.toLowerCase() ?? null,
    jurisdiction_level: row.jurisdiction_level,
    summary: row.summary_status === "rejected" ? null : (row.ai_summary ?? null),
    score,
    keyword_hit: keywordHit,
    path: row.context_path,
    retrieved,
  };
}

/** A keyword result as a card row (no score: the snapshot stores ids only). */
export function keywordHits(rows: Map<string, SampleRow>, snapshot: SampleSnapshot = SNAPSHOT): SampleHit[] {
  return keywordShownIds(snapshot)
    .map((id) => rows.get(id))
    .filter((r): r is SampleRow => !!r)
    .map((r) => toHit(r, null, false, false));
}

/**
 * The Ask answer, laid out by the same layoutAsk /search?mode=ask calls:
 * the retrieval hits in the snapshot's order (skipping ids that no longer
 * exist or belong to a staged regulation, which `rows` already left out),
 * the map's canonical rows that exist, no filters, nothing stated beyond
 * what the question says. `canonical` holds the map rows retrieval did not
 * return, keyed by id, for the groups' canonical lists.
 */
export function layoutSampleAsk(rows: Map<string, SampleRow>, snapshot: SampleSnapshot = SNAPSHOT) {
  const hits = snapshot.ask.hits
    .map((h) => {
      const row = rows.get(h.id);
      return row ? toHit(row, h.score, h.keyword_hit, true) : null;
    })
    .filter((h): h is SampleHit => h !== null);
  const map = snapshotMap(snapshot);
  const canonicalIds = new Set((map?.provisions ?? []).map((p) => p.id).filter((id) => rows.has(id)));
  const layout = layoutAsk(snapshot.ask.question, hits, canonicalIds, false, null);
  const hitById = new Map(hits.map((h) => [h.id, h]));
  const canonicalRows = new Map<string, SampleHit>();
  for (const id of canonicalIds) {
    const row = rows.get(id)!;
    // A canonical row retrieval also found keeps its hit (score and all).
    canonicalRows.set(id, hitById.get(id) ?? toHit(row, null, false, false));
  }
  return { ...layout, hits, canonicalRows };
}

/** One card in the Ask answer: the row, and the map's reason for it when it is a canonical row. */
export type AnswerItem = { hit: SampleHit; why?: string };
/** One group of the Ask answer, in the order the page lists them. */
export type AnswerSection = { title: string; items: AnswerItem[] };

/** Provisions per group the Ask answer opens with (Sprint 5, 10 Oct 2026). */
export const ANSWER_PER_GROUP = 3;

/**
 * The Ask answer as flat sections (the map's groups in order, canonical rows
 * leading, then "Other matches"), so the page can cut it in two.
 */
export function answerSections(ask: ReturnType<typeof layoutSampleAsk>): AnswerSection[] {
  const sections: AnswerSection[] = [];
  for (const g of ask.grouped?.groups ?? []) {
    const items: AnswerItem[] = [];
    for (const p of g.canonical) {
      const hit = ask.canonicalRows.get(p.id);
      if (hit) items.push({ hit, why: p.why });
    }
    for (const hit of g.hits) items.push({ hit });
    sections.push({ title: g.group, items });
  }
  const other = ask.grouped?.other ?? [];
  if (other.length > 0) sections.push({ title: OTHER_GROUP, items: other.map((hit) => ({ hit })) });
  return sections;
}

/**
 * Cuts the answer after the first `perGroup` provisions of every group
 * (Sprint 5, 10 Oct 2026). `head` is what the page shows; `rest` holds, per
 * group that has more, the provisions behind "See the complete sample
 * answer". Nothing is dropped or reordered: head and rest together are the
 * answer /search would lay out, and a group with `perGroup` or fewer rows has
 * no entry in `rest`.
 */
export function collapseAnswer(
  sections: AnswerSection[],
  perGroup: number = ANSWER_PER_GROUP
): { head: AnswerSection[]; rest: AnswerSection[] } {
  const head: AnswerSection[] = [];
  const rest: AnswerSection[] = [];
  for (const s of sections) {
    head.push({ title: s.title, items: s.items.slice(0, perGroup) });
    if (s.items.length > perGroup) rest.push({ title: s.title, items: s.items.slice(perGroup) });
  }
  return { head, rest };
}
