import type { ReactNode } from "react";
import { pageContainerClass } from "@/lib/ui";

/**
 * Shared shell for the static informational pages (/terms, /privacy,
 * /disclaimer, /about, /contact). Keeps the container, heading, and
 * "Last updated" line consistent so the five pages read as one set.
 *
 * The shared page container (src/lib/ui.ts pageContainerClass): the heading
 * spans it, and the prose below is capped at max-w-prose (65ch, about 70-75
 * characters), left-aligned to the container's edge — not its own
 * independently centered column.
 */
export const LAST_UPDATED = "September 12, 2026";

export function LegalPage({
  title,
  intro,
  lastUpdated = LAST_UPDATED,
  children,
}: {
  title: string;
  intro?: ReactNode;
  /** This page's own "Last updated" date when it has moved on from the set's shared one. */
  lastUpdated?: string;
  children: ReactNode;
}) {
  return (
    <div className={pageContainerClass("py-12")}>
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 font-mono text-eyebrow uppercase text-tag">
        Last updated: {lastUpdated}
      </p>
      <div className="max-w-prose">
        {intro && (
          <div className="mt-4 text-base leading-relaxed text-ink-soft">
            {intro}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}

/** A numbered section. `number` is rendered as-is (e.g. "1", "12"). `id` makes it linkable (#id). */
export function LegalSection({
  number,
  title,
  id,
  children,
}: {
  number?: string | number;
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id}>
      <h2 className="text-lg font-semibold text-ink">
        {number !== undefined && (
          <span className="mr-2 font-mono text-sm text-accent">
            {number}.
          </span>
        )}
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list with the same text styling as section body copy. */
export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc flex flex-col gap-1.5 pl-5 marker:text-muted">
      {children}
    </ul>
  );
}
