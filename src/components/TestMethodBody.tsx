import type { ReactNode } from "react";
import type { TestMethod } from "@/data/test-methods";
import { formatUsDate } from "@/lib/reader-nav";
import { sanitizeHtml } from "@/lib/regulation-pure";

/**
 * The body of a /test-methods/<slug> page, in two clearly separated parts:
 *
 *   1. "From the method — official text": sections 1.0 and 2.0 of the method,
 *      verbatim from the eCFR (officialText, written by
 *      scripts/fetch_method_sections.py), with its source and retrieval date.
 *      Rendered through the reader's sanitizer, with the reader's table styles
 *      (.method-text in globals.css).
 *   2. "EssentialRegs notes": our plain-English editorial sections.
 *
 * `children` (related methods, cited by) follow the notes.
 */

function NoteSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} className="text-base font-semibold text-ink">
        {title}
      </h3>
      <div className="mt-2 font-serif text-[17px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/** "Sections 1.0 and 2.0", or "Sections 1 and 2" for a method that numbers them "1." / "2.". */
function sectionsLabel(source: string): string {
  return /sections 1–2$/.test(source) ? "Sections 1 and 2" : "Sections 1.0 and 2.0";
}

export function MethodOfficialText({ method }: { method: TestMethod }) {
  return (
    <section
      id="official-text"
      aria-labelledby="official-text-heading"
      className="rounded-md border border-line bg-panel px-5 py-5"
    >
      <h2 id="official-text-heading" className="text-lg font-semibold text-ink">
        From the method — official text
      </h2>
      <p className="mt-1 text-sm text-muted">
        {sectionsLabel(method.officialTextSource)} of {method.officialTitle}, as published at {method.source}.
        Retrieved {formatUsDate(method.officialTextRetrieved)}. The full method is on the{" "}
        <a href={method.ecfrUrl} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-accent">
          eCFR
        </a>
        .
      </p>
      <div
        className="method-text mt-4 font-serif text-[16px] leading-relaxed text-ink"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(method.officialText) }}
      />
    </section>
  );
}

export function TestMethodBody({ method, children }: { method: TestMethod; children?: ReactNode }) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      <MethodOfficialText method={method} />

      <section id="notes" aria-labelledby="notes-heading" className="flex flex-col gap-6">
        <div>
          <h2 id="notes-heading" className="text-lg font-semibold text-ink">
            EssentialRegs notes
          </h2>
          <p className="mt-1 text-sm text-muted">
            Our plain-English reading of {method.shortName}. Not the method text.
          </p>
        </div>
        <NoteSection id="measures" title="What it measures">
          <p>{method.measures}</p>
        </NoteSection>
        <NoteSection id="principle" title="How it works">
          <p>{method.principle}</p>
        </NoteSection>
        <NoteSection id="equipment" title="Equipment">
          <p>{method.equipment}</p>
        </NoteSection>
        <NoteSection id="when-cited" title="When a rule cites it">
          <p>{method.whenCited}</p>
        </NoteSection>
        {method.readerNotes && (
          <NoteSection id="reader-notes" title="Notes for compliance staff">
            <p>{method.readerNotes}</p>
          </NoteSection>
        )}
      </section>

      {children}
    </div>
  );
}
