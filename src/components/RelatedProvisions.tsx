import Link from "next/link";
import { fetchRelated, fetchRelatedTeaser, hrefForRelated, type RelatedItem } from "@/lib/related";

const BADGE_CLASS: Record<string, string> = {
  Federal: "bg-blue-50 text-blue-700",
  ECMC: "bg-violet-50 text-violet-700",
  Colorado: "bg-emerald-50 text-emerald-700",
};

/**
 * "Related provisions" block for the card pages (/sample, /regs/[id]): the
 * five provisions whose meaning is closest to this one, corpus-wide, with
 * cross-regulation matches first when they're as good. Server component —
 * it does its own fetch. `teaser` switches to the RLS-bypassing,
 * summary-only variant used on the public sample page.
 */
export async function RelatedProvisions({
  provisionId,
  teaser = false,
}: {
  provisionId: string;
  teaser?: boolean;
}) {
  let items: RelatedItem[] = [];
  try {
    items = teaser ? await fetchRelatedTeaser(provisionId) : await fetchRelated(provisionId);
  } catch (e) {
    console.error("RelatedProvisions:", e instanceof Error ? e.message : e);
    return null;
  }
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Related provisions</h3>
      <p className="mt-1 text-xs text-zinc-400">
        Closest in meaning across every regulation — not necessarily cited by this one.
      </p>
      <ol className="mt-3 divide-y divide-zinc-100">
        {items.map((item) => (
          <li key={item.id} className="py-2.5">
            <Link href={hrefForRelated(item, teaser)} className="group block">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    BADGE_CLASS[item.badge] ?? BADGE_CLASS.Colorado
                  }`}
                >
                  {item.badge}
                </span>
                <span className="text-xs text-zinc-500">{item.regLabel}</span>
                <span className="font-mono text-xs text-emerald-700 group-hover:underline">{item.citation}</span>
              </div>
              {item.path && <p className="mt-0.5 text-xs leading-snug text-zinc-400">{item.path}</p>}
              {item.title && (
                <p className="mt-0.5 text-sm font-medium text-zinc-900">{item.title}</p>
              )}
              {item.summary ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600">{item.summary}</p>
              ) : teaser ? (
                <p className="mt-0.5 text-xs italic text-zinc-400">Summary available to subscribers.</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
      {teaser && (
        <p className="mt-3 text-xs text-zinc-400">
          Subscribers open any of these directly in the cross-referenced reader.
        </p>
      )}
    </section>
  );
}
