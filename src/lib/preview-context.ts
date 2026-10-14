/**
 * The focused preview's context strip (14 Oct 2026): the slim bar under the
 * site header that says where a visitor is after following a
 * cross-reference -- "Regulation 7 · Part B · I.C.1 General Requirements" --
 * so a page reached from GP05 VI.C never opens scrolled into a document the
 * visitor cannot name. The pure half: names in, text out, so
 * scripts/preview-context.test.ts checks it without a database.
 *
 * Every name is one the reader already uses:
 *   document  regulationDisplayName (the reader popup's eyebrow, the return bar)
 *   part      the Part root's citation as the eyebrow prints it ("PART B" ->
 *             "Part B", titleCaseHeading), found by partRootIdOf among the
 *             preview's headings (the root's Part rows); its stored title
 *             ("PART B — Oil and Natural Gas Operations") is kept for the
 *             tooltip. A Part the headings do not carry is named from its id
 *             (citationLabelFromId), so the strip never loses it; a document
 *             without Parts (the federal subparts, the general permits) has none.
 *   citation  the focused provision's citation as the page's heading prints it
 *             (displayCitation), without the trailing period
 *   title     the provision's title with its citation taken off (titleWithoutCitation)
 */
import { displayCitation } from "@/lib/federal-citation";
import { citationLabelFromId, partRootIdOf, titleCaseHeading } from "@/lib/reader-nav";
import { regulationDisplayName } from "@/lib/regulation-names";
import { titleWithoutCitation } from "@/lib/regulation-pure";

export type PreviewContext = {
  /** "Regulation 7" */
  document: string;
  /** "Part B", or null for a document without Parts (or when the focused row is the Part itself). */
  part: string | null;
  /** The Part root's stored title, re-cased ("Part B — Oil and Natural Gas Operations"), for the tooltip. */
  partTitle: string | null;
  /** "I.C.1" */
  citation: string;
  /** "General Requirements", or null when the title is only the citation. */
  title: string | null;
  /** The whole line: "Regulation 7 · Part B · I.C.1 General Requirements". */
  text: string;
};

type Row = { id: string; citation: string; title?: string | null };

export function previewContext(input: {
  reg: string;
  focusedId: string;
  root: { citation: string } | null;
  focused: { citation: string; title?: string | null };
  /** The preview's top-level headings (fetchRegulationTeaser): the Part rows among them. */
  headings: readonly Row[];
}): PreviewContext {
  const { reg, focusedId, focused } = input;
  const document = regulationDisplayName(reg, input.root);
  const partId = partRootIdOf(focusedId);
  let part: string | null = null;
  let partTitle: string | null = null;
  if (partId && partId !== focusedId) {
    const row = input.headings.find((h) => h.id === partId);
    part = row?.citation ? titleCaseHeading(row.citation) : citationLabelFromId(partId);
    partTitle = row?.title ? titleCaseHeading(row.title) : null;
  }
  const citation = titleCaseHeading(displayCitation(reg, focused.citation)).replace(/\.+$/, "");
  const title = titleWithoutCitation(focused.title, focused.citation) || null;
  const here = [citation, title].filter(Boolean).join(" ");
  return {
    document,
    part,
    partTitle,
    citation,
    title,
    text: [document, part, here].filter(Boolean).join(" · "),
  };
}
