import Link from "next/link";
import {
  CHANGELOG_SECTIONS,
  SUMMARY_QUALITY_EXPLANATION,
  denverDateLabel,
  describeSection,
  fetchChangelog,
  foldChangelog,
  sectionLines,
  summaryDayTotal,
  type ChangelogLine,
  type ChangelogSection,
} from "@/lib/changelog";
import { regulationDisplayName } from "@/lib/regulation-names";

export const metadata = {
  title: "Changelog",
};

type Group = { key: string; label: string; lines: ChangelogLine[] };

/** The lines of a section grouped by Denver day, newest first (the lines arrive newest first). */
function groupByDay(lines: ChangelogLine[]): Group[] {
  const groups: Group[] = [];
  for (const line of lines) {
    const existing = groups.find((g) => g.key === line.dateKey);
    if (existing) existing.lines.push(line);
    else groups.push({ key: line.dateKey, label: denverDateLabel(line.dateKey), lines: [line] });
  }
  return groups;
}

/**
 * What changed in the corpus, for customers, in three sections (review 4,
 * 7 Oct 2026): regulatory changes first and open, then links and sources,
 * then summary quality collapsed to one line per day. One line per
 * regulation per day, counts only ("Regulation 7 — 1,496 provisions
 * updated"). The same page logged in or out. The per-row moderation log,
 * with its notes, is internal and stays in the database (changelog_public()
 * cannot return it).
 */
export default async function ChangelogPage() {
  const lines = foldChangelog(await fetchChangelog());

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold text-ink">
          Changelog
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          What&apos;s changed in the regulation corpus, in three parts: official text updated from the agency source and
          provisions added or removed; links between provisions and source links added or updated; and the plain-English
          summaries AI reviewed, corrected, or rewritten. Each regulation&apos;s page shows the date its text was last
          verified.
        </p>

        {lines.length === 0 && (
          <p className="mt-10 text-sm text-muted">No changes recorded yet.</p>
        )}

        {lines.length > 0 && (
          <div className="mt-8 flex flex-col gap-12">
            {CHANGELOG_SECTIONS.map((section) => (
              <Section key={section.key} section={section.key} title={section.title} collapsed={section.collapsed} lines={sectionLines(lines, section.key)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ section, title, collapsed, lines }: { section: ChangelogSection; title: string; collapsed: boolean; lines: ChangelogLine[] }) {
  const groups = groupByDay(lines);
  return (
    <section aria-labelledby={`changelog-${section}`}>
      <h2 id={`changelog-${section}`} className="font-serif text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      {section === "summaries" && (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{SUMMARY_QUALITY_EXPLANATION}</p>
      )}
      {groups.length === 0 && <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>}
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
                    <Line key={`${line.dateKey}-${line.regKey ?? ""}`} line={line} section={section} />
                  ))}
                </ul>
              </details>
            ) : (
              <div key={g.key}>
                <h3 className="font-mono text-eyebrow uppercase text-tag">{g.label}</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {g.lines.map((line) => (
                    <Line key={`${line.dateKey}-${line.regKey ?? ""}`} line={line} section={section} />
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
            href={`/regulations/${line.regKey}`}
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
