import { citeLabel } from "@/lib/premise-notes";
import type { GroupableHit, GroupedHits, IntroSentence, QuestionMap } from "@/lib/question-maps";
import { OTHER_GROUP } from "@/lib/question-maps";
import { splitSentences, summaryOverview, summaryParagraphs, titleWithoutCitation } from "@/lib/regulation-pure";

/**
 * The research map above an Ask answer (Sprint 8, 11 Oct 2026): a table with
 * one row per group of the answer -- Question component | Provision | Why it
 * matters -- shown before the map's introduction and the cards. Pure and
 * dependency-light, so scripts/ask-map-rows.test.ts runs all of it; the markup
 * is src/components/AskResearchMap.tsx, shared by /search?mode=ask and /sample.
 *
 * It derives rows from what layoutAsk() already produced (the groups, in the
 * order the page lists them); nothing here changes which provisions are shown
 * or in what order, and no text is written at request time. Every sentence in
 * the "Why it matters" column is text that already exists and was reviewed:
 *
 *   1. "intro"   a sentence of the map's introduction (IntroSentence, cited
 *                and checked against corpus_ids.json by map-intros.test.ts)
 *                that cites a provision of this group. A cite relates to a
 *                group provision when it is that provision or one inside or
 *                above it ("sec-7-B-I-D-3-a-(i)" belongs to the group row
 *                "sec-7-B-I-D"). The sentence that cites the most of the
 *                group's provisions wins; a sentence is used for one row only,
 *                the strongest pairing first.
 *   2. "note"    else the map's curated line for the group (QuestionMap.notes,
 *                v3.1, 13 Oct 2026): written by hand for the groups whose
 *                cell read weakly on /sample (a canonical row's short reason
 *                for Definitions, a dash for Other matches).
 *   3. "map"     else the `why` of the group's first canonical row, the same
 *                line its card prints after "Why it's here:".
 *   4. "summary" else the first sentence of the overview of the top
 *                provision's summary (the overview the reader prints), only
 *                when that summary was approved or edited by the automated
 *                review -- the caller decides and passes `summaryOf`.
 *   otherwise no text: the cell prints a dash.
 */

/** The line printed above the map. Same sentence as the pricing page's Ask bullet (plan-includes.ts). */
export const ASK_FINDS_LINE = "It finds provisions; it does not decide what applies to you.";

/** The heading under the map for the map's introduction. */
export const READING_HEADING = "Reading of the provisions above";

/** What a row needs of a provision to link it. */
export type AskMapSource = { id: string; citation: string; title: string; reg_key: string | null };

export type AskMapProvision = {
  id: string;
  /** "GP05 I.A", "Regulation 7 Part B I.D.3.a", "OOOOb § 60.5365b(e)" (citeLabel, the label the introduction uses). */
  label: string;
  /** The heading without the citation; "" when the title is only the citation. */
  title: string;
  href: string;
};

export type AskMapWhySource = "intro" | "note" | "map" | "summary";

export type AskMapRow = {
  /** The group's name: a MapGroup or "Other matches". */
  component: string;
  provisions: AskMapProvision[];
  why: { text: string; source: AskMapWhySource } | null;
};

/** Whether `cite` is `id`, or sits inside it, or contains it (ids are dash-joined paths). */
export function citeRelatesTo(cite: string, id: string): boolean {
  return cite === id || cite.startsWith(`${id}-`) || id.startsWith(`${cite}-`);
}

/** How many of a group's provisions a sentence's cites reach. */
function reach(sentence: IntroSentence, ids: string[]): number {
  return ids.filter((id) => sentence.cites.some((c) => citeRelatesTo(c, id))).length;
}

/** The first sentence of a summary's overview, or null for no summary. */
export function summaryFirstSentence(summary: string | null | undefined): string | null {
  const paras = summaryParagraphs(summary ?? "");
  if (paras.length === 0) return null;
  const overview = summaryOverview(paras)?.overview ?? paras.join(" ");
  return splitSentences(overview)[0] ?? null;
}

/**
 * The rows of the research map, one per group `grouped` holds (canonical rows
 * first, then the retrieval hits, as the page lists them; "Other matches"
 * last). `source` reads a canonical row's label columns (a row the caller
 * could not fetch is left out, as its card is); a hit carries its own.
 * `hrefFor` is the page's own destination helper, so a locked destination
 * stays a locked destination. `summaryOf` returns a row's summary only when it
 * may be quoted (approved or edited).
 */
export function askMapRows<T extends GroupableHit & { citation: string }>(args: {
  map: Pick<QuestionMap, "factors" | "notes">;
  grouped: Pick<GroupedHits<T>, "groups" | "other">;
  source: (id: string) => AskMapSource | undefined;
  hrefFor: (row: { id: string; reg_key: string | null }) => string;
  summaryOf: (id: string) => string | null | undefined;
}): AskMapRow[] {
  const { map, grouped, source, hrefFor, summaryOf } = args;

  type Draft = { component: string; provisions: AskMapProvision[]; whyMap: string | null };
  const toProvision = (row: AskMapSource): AskMapProvision => ({
    id: row.id,
    label: citeLabel(row.id),
    title: titleWithoutCitation(row.title, row.citation),
    href: hrefFor({ id: row.id, reg_key: row.reg_key }),
  });

  const drafts: Draft[] = [];
  for (const g of grouped.groups) {
    const provisions: AskMapProvision[] = [];
    let whyMap: string | null = null;
    for (const p of g.canonical) {
      const row = source(p.id);
      if (!row) continue;
      provisions.push(toProvision(row));
      whyMap ??= p.why;
    }
    for (const hit of g.hits) provisions.push(toProvision(hit));
    drafts.push({ component: g.group, provisions, whyMap });
  }
  if (grouped.other.length > 0) {
    drafts.push({ component: OTHER_GROUP, provisions: grouped.other.map(toProvision), whyMap: null });
  }

  // Introduction sentences to rows: every (row, sentence) pair that cites at
  // least one of the row's provisions, strongest first; ties go to the earlier
  // row, then the earlier sentence. A row and a sentence are each used once.
  const pairs: { row: number; sentence: number; reach: number }[] = [];
  drafts.forEach((d, row) => {
    const ids = d.provisions.map((p) => p.id);
    map.factors.forEach((sentence, i) => {
      const r = reach(sentence, ids);
      if (r > 0) pairs.push({ row, sentence: i, reach: r });
    });
  });
  pairs.sort((a, b) => b.reach - a.reach || a.row - b.row || a.sentence - b.sentence);
  const introFor = new Map<number, number>();
  const used = new Set<number>();
  for (const p of pairs) {
    if (introFor.has(p.row) || used.has(p.sentence)) continue;
    introFor.set(p.row, p.sentence);
    used.add(p.sentence);
  }

  return drafts.map((d, row) => {
    const i = introFor.get(row);
    let why: AskMapRow["why"] = null;
    const note = map.notes?.[d.component as keyof NonNullable<QuestionMap["notes"]>];
    if (i !== undefined) why = { text: map.factors[i].text, source: "intro" };
    else if (note) why = { text: note, source: "note" };
    else if (d.whyMap) why = { text: d.whyMap, source: "map" };
    else {
      for (const p of d.provisions) {
        const sentence = summaryFirstSentence(summaryOf(p.id));
        if (sentence) {
          why = { text: sentence, source: "summary" };
          break;
        }
      }
    }
    return { component: d.component, provisions: d.provisions, why };
  });
}
