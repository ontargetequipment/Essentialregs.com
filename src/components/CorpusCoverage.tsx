import { LegalList } from "@/components/LegalPage";
import { countPhrase, coverageSummaryLine, type CorpusCoverage as Coverage } from "@/lib/corpus-coverage";

/**
 * The About page's "What's covered today" body (Sprint 8, 11 Oct 2026): the
 * dated count line, then one list per jurisdiction with a bullet per index
 * group -- the heading the /states/colorado and /federal indexes use, the
 * count, and the names. Presentational: the page reads the roots and the
 * snapshot date and hands them in (src/lib/corpus-coverage.ts does the
 * grouping), so a test can render it from fixtures.
 */
export function CorpusCoverage({ coverage, asOf }: { coverage: Coverage; asOf: string | null }) {
  const sections = [
    { jurisdiction: "state" as const, label: "Colorado", total: coverage.colorado },
    { jurisdiction: "federal" as const, label: "Federal", total: coverage.federal },
  ];
  return (
    <>
      <p>{coverageSummaryLine(coverage, asOf)}</p>
      {sections.map((section) => {
        const groups = coverage.groups.filter((g) => g.jurisdiction === section.jurisdiction);
        if (groups.length === 0) return null;
        return (
          <div key={section.jurisdiction} className="flex flex-col gap-2">
            <p className="font-medium text-ink">
              {section.label} ({section.total})
            </p>
            <LegalList>
              {groups.map((g) => (
                <li key={g.key}>
                  <strong>{g.heading}</strong> — {countPhrase(g)}: {g.items.join(", ")}.
                </li>
              ))}
            </LegalList>
          </div>
        );
      })}
    </>
  );
}
