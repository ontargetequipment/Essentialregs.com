import { LockedRest } from "@/components/LockedDestination";
// The reader's own stylesheet, for the rows' look. Every rule in it sits under
// `.reg-reader`, so it styles only the wrapper below; the overrides that keep
// the wrapper from being a reader page are in preview-subtree.css.
import "@/app/regulations/reader.css";
import "./preview-subtree.css";

/**
 * The public rows of a focused preview (Sprint 7, 11 Oct 2026): the official
 * text and approved summaries of the subtree, in the reader's markup and with
 * the reader's CSS, and under it the offer for the rest of the regulation.
 * `html` is renderSubtreeHtml's output (preview-subtree.ts), already fenced,
 * sanitised and linked for a visitor; this component only puts it on the page.
 *
 * #preview-doc's direct children are the rows, `<div id class="item depth-N"
 * data-citation>`; the walkthrough and the tests find them there.
 */
export function PreviewSubtree({
  html,
  regName,
  readerHref,
}: {
  html: string;
  regName: string;
  /** Where a login should land: the focused provision in the reader. */
  readerHref: string;
}) {
  return (
    <>
      <div className="reg-reader preview-reader">
        <div id="preview-doc" data-testid="preview-subtree" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <LockedRest regName={regName} readerHref={readerHref} />
    </>
  );
}
