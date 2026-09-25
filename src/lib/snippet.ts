/**
 * Dependency-free text helpers shared by the server renderer
 * (reader-render.ts, via regulation-pure.ts) and the browser
 * (reader-client.ts, via RegulationReader.tsx). Nothing in here may import
 * sanitize-html, Supabase or React: it ends up in the client bundle.
 *
 * The contains boxes and the jump-box search index used to be built on the
 * server from these functions and shipped in the page (a snippet of every
 * item, twice). They are now built in the browser from the DOM by the SAME
 * functions -- one implementation, not a port -- and
 * scripts/reader-client.test.ts proves the browser-built markup matches the
 * server-built markup item for item on the fixture regulations.
 */

/**
 * Normalize a citation for comparison against normalized provision text.
 * The citation column can carry a non-breaking space (common when the source
 * was pasted from a PDF — "§ 60.4231(d)"), a doubled space, or an HTML entity,
 * none of which survive into the normalized text. Without this the comparison
 * silently fails and the row keeps rendering its label twice.
 */
export function normalizeCitationLabel(citation: string | null | undefined): string {
  return (citation ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain-text snippet of a provision for places that already print its
 * citation right next to it — the sidebar tree, the "contains" boxes and the
 * jump/search index.
 *
 * 5,941 of 36,517 provisions are stored with the citation inside their own
 * text, so those surfaces rendered it twice ("I.A.1.  I.A.1. The provisions
 * of this regulation…"). The citation is removed BEFORE truncating, so the
 * snippet still gets its full `maxLen` of useful text.
 *
 * May return "": a row whose text is nothing but its own citation has no
 * snippet, and callers must not render the element in that case (see the
 * note in the body). It no longer falls back to the unstripped text.
 *
 * Same digit guard as withItemIdBadge: a citation of "2." must not match text
 * reading "2.5 tons per year". Do not drop it — see that function's comment
 * for the measurements behind it.
 *
 * `html` is the provision's stored (sanitised) full_text on the server and
 * the browser's re-serialisation of the same markup (innerHTML) on the
 * client. Those agree for this pipeline because every step only cares
 * about tags (stripped) and the four entities the HTML serialiser itself
 * emits in text (&amp; &lt; &gt; &nbsp;) -- see reader-client.ts.
 */
export function snippetAfterCitation(
  html: string,
  citation: string | null | undefined,
  maxLen = 100
): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const label = normalizeCitationLabel(citation);
  const body =
    label && text.startsWith(label) && !/[0-9]/.test(text.charAt(label.length))
      ? text.slice(label.length).replace(/^[\s.:;,—–-]+/, "")
      : text;
  // 90 rows in the corpus are exactly their own citation and nothing else,
  // so stripping the label leaves "". That empty string is returned as is:
  // every caller already prints the citation right next to the snippet, so
  // rendering nothing beats rendering the label a second time. Callers MUST
  // guard on the empty string -- see containsBoxFromRows below and the call
  // sites in reader-render.ts.
  return body.length > maxLen ? body.slice(0, maxLen).trimEnd() + "…" : body;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Snippet length used by the contains boxes and the search index alike. */
export const SNIPPET_LEN = 90;

/**
 * [id, citation, snippet, topGroupId] tuples for the client-side jump/search
 * box. The 4th element (added for the collapsible sidebar -- see
 * RegulationReader.tsx) is the id of this provision's top-level ancestor
 * (the Part/Appendix/series node whose sidebar entry is a <details> group),
 * so a hash-jump or popup "go to" can find and open the right group without
 * a second lookup table alongside this one.
 */
export type SearchRow = [id: string, citation: string, snippet: string, topGroupId: string];

/** What a contains box needs to know about one child. */
export type ContainsRow = { id: string; citation: string; snippet: string };

/** The mini "here's what's inside this section" box shown under items/parts that have children. */
export function containsBoxFromRows(children: ContainsRow[]): string {
  if (!children.length) return "";
  const items = children
    .map((c) => {
      // A child whose entire text is its own citation has no snippet left --
      // emit the link alone rather than an empty <span> preceded by a
      // dangling space. (.contains-link already carries margin-right: 4px.)
      const snipHtml = c.snippet ? ` <span class="contains-snip">${escapeHtml(c.snippet)}</span>` : "";
      return `<li><span class="xref contains-link" data-target="${escapeHtml(
        c.id
      )}">${escapeHtml(c.citation)}</span>${snipHtml}</li>`;
    })
    .join("");
  return `<ul class="contains">${items}</ul>`;
}

/**
 * The "View official source" link inside a summary panel's .summary-status
 * row. The server emits the (empty) row; the browser fills it in from the
 * regulation's one source URL (see reader-client.ts) instead of shipping the
 * same 150-byte link under every one of a regulation's thousands of panels.
 */
export function summarySourceLinkHtml(url: string): string {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View official source ↗</a>`;
}
