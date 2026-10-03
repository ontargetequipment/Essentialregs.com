import Link from "next/link";
import {
  denverDateLabel,
  describeLine,
  fetchChangelog,
  foldChangelog,
  type ChangelogLine,
} from "@/lib/changelog";
import { regulationDisplayName } from "@/lib/regulation-names";

export const metadata = {
  title: "Changelog",
};

type Group = { key: string; label: string; lines: ChangelogLine[] };

/**
 * What changed in the corpus, for customers: one line per regulation per
 * day, counts only ("Regulation 7 — 1,496 provisions updated · 212
 * summaries reviewed"). The same page logged in or out. The per-row
 * moderation log, with its notes, is internal and stays in the database
 * (changelog_public() cannot return it).
 */
export default async function ChangelogPage() {
  const lines = foldChangelog(await fetchChangelog());

  const groups: Group[] = [];
  for (const line of lines) {
    const existing = groups.find((g) => g.key === line.dateKey);
    if (existing) {
      existing.lines.push(line);
    } else {
      groups.push({ key: line.dateKey, label: denverDateLabel(line.dateKey), lines: [line] });
    }
  }

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold text-ink">
          Changelog
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          What&apos;s changed in the regulation corpus: official text updated
          from the agency source, and plain-English summaries reviewed,
          corrected, or rewritten. Each regulation&apos;s page shows the date
          its text was last verified.
        </p>

        {groups.length === 0 && (
          <p className="mt-10 text-sm text-muted">No changes recorded yet.</p>
        )}

        {groups.length > 0 && (
          <div className="mt-8 flex flex-col gap-8">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="font-mono text-eyebrow uppercase text-tag">
                  {g.label}
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {g.lines.map((line) => (
                    <Line key={`${line.dateKey}-${line.regKey ?? ""}`} line={line} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LINE_CLASS =
  "flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-panel px-4 py-3 shadow-sm";

/** One regulation's changes for one day, as a single line. */
function Line({ line }: { line: ChangelogLine }) {
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
        <span className="ml-2 text-sm text-ink-soft">— {describeLine(line).join(" · ")}</span>
      </div>
    </li>
  );
}
