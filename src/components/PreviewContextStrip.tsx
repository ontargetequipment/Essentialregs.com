import type { ReactNode } from "react";
import type { PreviewContext } from "@/lib/preview-context";
import { pageContainerClass } from "@/lib/ui";

/**
 * The focused preview's context strip (14 Oct 2026): a slim bar, sticky
 * under the site header, that names where the visitor is --
 * "Regulation 7 · Part B · I.C.1 General Requirements" (previewContext,
 * preview-context.ts) -- with the way back ("← Back to GP05 · VI.C",
 * PreviewReturn) on its right when the page was reached from another
 * provision. On a phone the two wrap onto two lines. It takes its own height
 * in the page flow, so it never sits over provision text at rest; the rows'
 * scroll-margin-top (preview-subtree.css) and the walkthrough's landing
 * (ReaderTour) keep a landed row below it. The reader has its sidebar for
 * this and does not use it. Its inner wrapper is the shared page container
 * (pageContainerClass), so the document name starts where the page's heading
 * and the ER emblem do.
 */
export function PreviewContextStrip({ context, children }: { context: PreviewContext; children?: ReactNode }) {
  return (
    <nav
      id="preview-context"
      data-testid="preview-context"
      aria-label="Where you are"
      className="sticky top-[66px] z-40 border-b border-line bg-panel/95 backdrop-blur-sm"
    >
      <div className={pageContainerClass("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5")}>
        <p className="min-w-0 basis-full text-xs leading-snug text-ink-soft sm:basis-auto sm:flex-1 sm:text-sm" data-testid="preview-context-text">
          <span className="font-semibold text-ink">{context.document}</span>
          {context.part && (
            <>
              {" · "}
              <span title={context.partTitle ?? undefined}>{context.part}</span>
            </>
          )}
          {" · "}
          <span className="font-semibold text-ink">{context.citation}</span>
          {context.title && <> {context.title}</>}
        </p>
        {children}
      </div>
    </nav>
  );
}
