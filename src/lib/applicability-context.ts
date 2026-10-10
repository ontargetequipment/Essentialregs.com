/**
 * Applicability context for the reader's summary panels (9 Oct 2026).
 *
 * The outside reviewer's Oct 8-9 pass found the summary of OOOO 60.5365(e)
 * (the storage vessel affected facility) saying what the paragraph covers
 * without saying that it sits inside a subpart that reaches only facilities
 * which commenced construction, modification or reconstruction in a date
 * window (August 23, 2011 to September 18, 2015 for the original OOOO).
 * The summary is written from the row and its children, so the window set
 * by the parent never reached it. This table adds it as one curated line
 * under the badge of every descendant row's summary panel: "Applicability
 * context: Sits inside Subpart OOOO's window ... § 60.5365", the citation a
 * link to the provision that sets the window.
 *
 * Data, not generation. One entry per document; every date below was read
 * from the repo's source text (pipeline/sources/*.txt, the eCFR print of
 * 6 Oct 2026 for OOOO and the Sept 2026 prints of the others) and the
 * provision named as the setter carries the same words:
 *   OOOO  60.5365 (and 60.5360): after Aug 23, 2011, and on or before Sept 18, 2015
 *   OOOOa 60.5365a (and 60.5360a(a)): after Sept 18, 2015, and on or before Dec 6, 2022
 *   OOOOb 60.5365b (and 60.5360b(a)): after Dec 6, 2022
 *   OOOOc 60.5375c(a)(1) (and 60.5361c(a)): designated facilities that commenced
 *         construction, modification or reconstruction on or before Dec 6, 2022
 * scripts/applicability-context.test.ts checks each line against those
 * source files and each setter id against pipeline/out/corpus_ids.json.
 * Other documents (Colorado regulations, the general permits, PHMSA) are not
 * here: nothing has been read for them yet, and a date window is only
 * written down once it is verified.
 *
 * The server writes an empty marker per eligible panel (the text would be
 * the same ~250 bytes under thousands of panels; the reader's source link
 * is handled the same way) and the browser fills it from this table
 * (reader-client.ts, fillApplicabilityContexts). Pure and dependency-free
 * so the client bundle takes only this file.
 */

export type ApplicabilityContext = {
  /** The document's reg key; also the marker's data-ctx value. */
  key: string;
  /** Only rows whose id starts with this carry the line (the document's sections; not its tables or headings). */
  under: string;
  /** Rows that carry no line: the ones that set the window, by exact id. */
  exceptIds: string[];
  /** Rows that carry no line, with everything under them (definitions). */
  exceptSubtrees: string[];
  /** The provision that sets the window: the link at the end of the line. */
  setter: { id: string; label: string };
  /** The line after "Applicability context: ", ending without its citation. */
  text: string;
};

export const APPLICABILITY_CONTEXTS: ApplicabilityContext[] = [
  {
    key: "oooo",
    under: "sec-oooo-60.",
    exceptIds: ["sec-oooo-60.5360", "sec-oooo-60.5365"],
    exceptSubtrees: ["sec-oooo-60.5430"],
    setter: { id: "sec-oooo-60.5365", label: "§ 60.5365" },
    text: "This provision sits inside Subpart OOOO's construction window: the subpart reaches affected facilities that commence construction, modification or reconstruction after August 23, 2011, and on or before September 18, 2015.",
  },
  {
    key: "ooooa",
    under: "sec-ooooa-60.",
    exceptIds: ["sec-ooooa-60.5360a", "sec-ooooa-60.5365a"],
    exceptSubtrees: ["sec-ooooa-60.5430a"],
    setter: { id: "sec-ooooa-60.5365a", label: "§ 60.5365a" },
    text: "This provision sits inside Subpart OOOOa's construction window: the subpart reaches affected facilities that commence construction, modification or reconstruction after September 18, 2015, and on or before December 6, 2022.",
  },
  {
    key: "oooob",
    under: "sec-oooob-60.",
    exceptIds: ["sec-oooob-60.5360b", "sec-oooob-60.5365b"],
    exceptSubtrees: ["sec-oooob-60.5430b"],
    setter: { id: "sec-oooob-60.5365b", label: "§ 60.5365b" },
    text: "This provision sits inside Subpart OOOOb's construction window: the subpart reaches affected facilities that commence construction, modification or reconstruction after December 6, 2022.",
  },
  {
    key: "ooooc",
    under: "sec-ooooc-60.",
    exceptIds: ["sec-ooooc-60.5360c", "sec-ooooc-60.5375c", "sec-ooooc-60.5375c-(a)", "sec-ooooc-60.5375c-(a)-(1)"],
    exceptSubtrees: ["sec-ooooc-60.5430c"],
    setter: { id: "sec-ooooc-60.5375c-(a)-(1)", label: "§ 60.5375c(a)(1)" },
    text: "This provision sits inside Subpart OOOOc, the emission guidelines for existing facilities: a state or Tribal plan must address designated facilities that commenced construction, modification or reconstruction on or before December 6, 2022.",
  },
];

const BY_KEY = new Map(APPLICABILITY_CONTEXTS.map((c) => [c.key, c]));

const inSubtree = (id: string, root: string) => id === root || id.startsWith(`${root}-`);

/** The key of the context a row's summary panel carries, or null (most rows). */
export function applicabilityContextKey(id: string): string | null {
  for (const c of APPLICABILITY_CONTEXTS) {
    if (!id.startsWith(c.under)) continue;
    if (c.exceptIds.includes(id) || c.exceptSubtrees.some((r) => inSubtree(id, r))) return null;
    return c.key;
  }
  return null;
}

/** The context for a marker's data-ctx value, or null. */
export function applicabilityContextFor(key: string): ApplicabilityContext | null {
  return BY_KEY.get(key) ?? null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The line's inner HTML: the label, the text, and the setter's citation as a
 * reader cross-reference (`.xref`, the hook the contains boxes and the
 * summary's child list use: a click previews the provision and "Go to full
 * section" lands on it).
 */
export function applicabilityContextHtml(c: ApplicabilityContext): string {
  return (
    `<span class="summary-context-label">Applicability context:</span> ${esc(c.text)} ` +
    `<span class="xref summary-context-link" data-target="${esc(c.setter.id)}">${esc(c.setter.label)}</span>`
  );
}
