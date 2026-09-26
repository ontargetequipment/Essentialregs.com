import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  changeTypeLabel,
  denverDateKey,
  denverDateLabel,
  denverTimeLabel,
  fetchRecentChanges,
  fetchTextUpdates,
  groupTextUpdates,
  regKeyOf,
  type ProvisionChangeRow,
  type TextUpdateGroup,
} from "@/lib/changelog";
import { regulationDisplayName } from "@/lib/regulation-names";

export const metadata = {
  title: "Changelog",
};

/**
 * One line of the changelog: a moderation entry as stored (one row), or the
 * importer's `text_updated` rows for one regulation on one day folded into
 * a single "Regulation 7 — 1,496 provisions updated" line (see
 * changelog-group.ts). Page-side grouping only; nothing in the database
 * changes.
 */
type Item =
  | { kind: "entry"; at: string; row: ProvisionChangeRow }
  | { kind: "import"; at: string; group: TextUpdateGroup };

type Group = { key: string; label: string; items: Item[] };

const COUNT = new Intl.NumberFormat("en-US");

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS on provision_changes has no `anon` select policy (see
  // supabase/migrations/004_review.sql), so a logged-out visitor always gets
  // zero rows here — that's expected, not an error, and is why the "log in"
  // banner below doesn't depend on `changes.length === 0`.
  const [changes, textUpdates] = await Promise.all([fetchRecentChanges(50), fetchTextUpdates()]);

  const items: Item[] = [
    ...changes.map((row): Item => ({ kind: "entry", at: row.created_at, row })),
    ...groupTextUpdates(textUpdates, denverDateKey).map(
      (group): Item => ({ kind: "import", at: group.latest, group })
    ),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const groups: Group[] = [];
  for (const item of items) {
    const key = denverDateKey(item.at);
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ key, label: denverDateLabel(key), items: [item] });
    }
  }

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold text-ink">
          Changelog
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          What&apos;s changed in the regulation corpus — plain-English
          summaries reviewed, edited, or rejected by a human, and regulatory
          text updates.
        </p>

        {!user && (
          <div className="mt-6 rounded-lg border border-line bg-accent-soft p-5 text-sm text-ink">
            <p className="font-medium">
              <Link href="/login" className="inline-flex min-h-11 items-center underline hover:text-accent sm:inline sm:min-h-0">
                Log in
              </Link>{" "}
              to see the full update history.
            </p>
            <p className="mt-2 text-ink-soft">
              The{" "}
              <Link href="/regulations" className="inline-flex min-h-11 items-center underline hover:text-accent sm:inline sm:min-h-0">
                Colorado
              </Link>{" "}
              and{" "}
              <Link href="/federal" className="inline-flex min-h-11 items-center underline hover:text-accent sm:inline sm:min-h-0">
                federal
              </Link>{" "}
              indexes list what the corpus covers today.
            </p>
          </div>
        )}

        {user && groups.length === 0 && (
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
                  {g.items.map((item) =>
                    item.kind === "import" ? (
                      <ImportLine key={`import-${item.group.dateKey}-${item.group.regKey ?? ""}`} group={item.group} />
                    ) : (
                      <EntryLine key={item.row.id} c={item.row} />
                    )
                  )}
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

/** A moderation entry, rendered as it always was. */
function EntryLine({ c }: { c: ProvisionChangeRow }) {
  const p = c.provisions;
  const reg = p ? regKeyOf(p.id) : null;
  const href = p ? (reg ? `/regulations/${reg}#${p.id}` : `/regs/${p.id}`) : null;
  return (
    <li className={LINE_CLASS}>
      <div className="min-w-0">
        {href && p ? (
          <Link href={href} className="font-mono text-sm font-semibold text-accent hover:underline">
            {p.citation}
          </Link>
        ) : (
          <span className="font-mono text-sm font-semibold text-muted">(provision removed)</span>
        )}
        <span className="ml-2 text-sm text-ink-soft">{changeTypeLabel(c.change_type)}</span>
        {c.note && (
          <p className="mt-1 text-xs italic text-muted">
            &ldquo;{c.note}&rdquo;
          </p>
        )}
      </div>
      <span className="whitespace-nowrap text-xs text-muted">{denverTimeLabel(c.created_at)}</span>
    </li>
  );
}

/** One regulation's importer rows for one day, as a single line. */
function ImportLine({ group }: { group: TextUpdateGroup }) {
  const noun = group.provisionCount === 1 ? "provision" : "provisions";
  return (
    <li className={LINE_CLASS}>
      <div className="min-w-0">
        {group.regKey ? (
          <Link
            href={`/regulations/${group.regKey}`}
            className="font-serif text-card font-semibold text-ink hover:text-accent hover:underline"
          >
            {regulationDisplayName(group.regKey)}
          </Link>
        ) : (
          <span className="font-serif text-card font-semibold text-muted">Removed provisions</span>
        )}
        <span className="ml-2 text-sm text-ink-soft">
          — {COUNT.format(group.provisionCount)} {noun} updated
        </span>
      </div>
      <span className="whitespace-nowrap text-xs text-muted">{denverTimeLabel(group.latest)}</span>
    </li>
  );
}
