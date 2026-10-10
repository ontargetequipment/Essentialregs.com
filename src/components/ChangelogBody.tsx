import Link from "next/link";
import {
  SUMMARY_QUALITY_EXPLANATION,
  describeSection,
  summaryDayTotal,
  type ChangelogLine,
  type ChangelogSection,
  type ChangelogSectionView,
  type ChangelogView,
} from "@/lib/changelog-group";
import { regulationDisplayName } from "@/lib/regulation-names";
import { regulationCardHref } from "@/lib/regulation-pure";

/**
 * The body of /changelog from its view model (src/lib/changelog-group.ts
 * buildChangelogView): the intro, the notice when the counts could not be
 * loaded, and the three sections. Pure React, no data access, so a test
 * can render it for the error case (scripts/changelog-page.test.ts).
 */
export function ChangelogBody({ view }: { view: ChangelogView }) {
  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold text-ink">Changelog</h1>
        <p className="mt-2 text-sm text-ink-soft">
          What&apos;s changed in the regulation corpus, in three parts: rule changes that came from the agency (a new
          version of the official text, provisions it added or removed); links between provisions, source links and
          corrections to our own copy of the text; and the plain-English summaries AI reviewed, corrected, or
          rewritten. Each regulation&apos;s page shows its current version and effective date.
        </p>

        {view.notice && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            {view.notice}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-12">
          {view.sections.map((section) => (
            <Section key={section.key} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ section }: { section: ChangelogSectionView }) {
  const { key, title, collapsed, groups } = section;
  return (
    <section aria-labelledby={`changelog-${key}`}>
      <h2 id={`changelog-${key}`} className="font-serif text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      {key === "summaries" && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{SUMMARY_QUALITY_EXPLANATION}</p>}
      {groups.length === 0 && (
        <p className="mt-3 text-sm text-muted" data-empty-section={key}>
          {section.emptyLine}
        </p>
      )}
      {groups.length > 0 && (
        <div className="mt-4 flex flex-col gap-6">
          {groups.map((g) =>
            collapsed ? (
              /* Collapsed by default: the day's one-line total is the summary; the lines open on click. */
              <details key={g.key} className="group">
                <summary className="cursor-pointer list-none">
                  <span className="font-mono text-eyebrow uppercase text-tag">{g.label}</span>
                  <span className="ml-2 text-sm text-ink-soft">— {summaryDayTotal(g.lines)}</span>
                  <span className="ml-2 text-xs text-muted group-open:hidden">Show by regulation</span>
                </summary>
                <ul className="mt-3 flex flex-col gap-3">
                  {g.lines.map((line) => (
                    <Line key={`${line.dateKey}-${line.regKey ?? ""}`} line={line} section={key} />
                  ))}
                </ul>
              </details>
            ) : (
              <div key={g.key}>
                <h3 className="font-mono text-eyebrow uppercase text-tag">{g.label}</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {g.lines.map((line) => (
                    <Line key={`${line.dateKey}-${line.regKey ?? ""}`} line={line} section={key} />
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

const LINE_CLASS =
  "flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-panel px-4 py-3 shadow-sm";

/** One regulation's changes for one day in one section, as a single line. */
function Line({ line, section }: { line: ChangelogLine; section: ChangelogSection }) {
  return (
    <li className={LINE_CLASS}>
      <div className="min-w-0">
        {line.regKey ? (
          <Link
            // (Sprint 5, 10 Oct 2026) The page is the same logged in or out, and
            // the reader 404s for a visitor, so link where a visitor can land.
            href={regulationCardHref(line.regKey, false)}
            className="font-serif text-card font-semibold text-ink hover:text-accent hover:underline"
          >
            {regulationDisplayName(line.regKey)}
          </Link>
        ) : (
          <span className="font-serif text-card font-semibold text-muted">Removed provisions</span>
        )}
        <span className="ml-2 text-sm text-ink-soft">— {describeSection(line, section).join(" · ")}</span>
      </div>
    </li>
  );
}
