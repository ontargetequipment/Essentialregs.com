import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  changeTypeLabel,
  denverDateKey,
  denverDateLabel,
  denverTimeLabel,
  fetchRecentChanges,
  regKeyOf,
  type ProvisionChangeRow,
} from "@/lib/changelog";

export const metadata = {
  title: "Changelog",
};

type Group = { key: string; label: string; items: ProvisionChangeRow[] };

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS on provision_changes has no `anon` select policy (see
  // supabase/migrations/004_review.sql), so a logged-out visitor always gets
  // zero rows here — that's expected, not an error, and is why the "log in"
  // banner below doesn't depend on `changes.length === 0`.
  const changes = await fetchRecentChanges(50);

  const groups: Group[] = [];
  for (const c of changes) {
    const key = denverDateKey(c.created_at);
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.items.push(c);
    } else {
      groups.push({ key, label: denverDateLabel(key), items: [c] });
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
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-medium">
              <Link href="/login" className="underline hover:text-amber-950">
                Log in
              </Link>{" "}
              to see the full update history.
            </p>
            <p className="mt-2 text-amber-900/90">
              The corpus currently covers Colorado Reg 3, Colorado Reg 7,
              Colorado Reg 26, and 40 CFR 60 Subpart OOOOb.
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
                  {g.items.map((c) => {
                    const p = c.provisions;
                    const reg = p ? regKeyOf(p.id) : null;
                    const href = p ? (reg ? `/regulations/${reg}#${p.id}` : `/regs/${p.id}`) : null;
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-panel px-4 py-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          {href && p ? (
                            <Link
                              href={href}
                              className="font-mono text-sm font-semibold text-accent hover:underline"
                            >
                              {p.citation}
                            </Link>
                          ) : (
                            <span className="font-mono text-sm font-semibold text-muted">
                              (provision removed)
                            </span>
                          )}
                          <span className="ml-2 text-sm text-ink-soft">
                            {changeTypeLabel(c.change_type)}
                          </span>
                          {c.note && (
                            <p className="mt-1 text-xs italic text-muted">
                              &ldquo;{c.note}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted">
                          {denverTimeLabel(c.created_at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
