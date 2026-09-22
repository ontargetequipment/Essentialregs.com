import type { ReactNode } from "react";

/**
 * Shared shell for the static informational pages (/terms, /privacy,
 * /disclaimer, /about, /contact). Keeps the container, heading, and
 * "Last updated" line consistent so the five pages read as one set.
 *
 * The prose column is 720px (--container-reading), sitting inside and
 * left-aligned to the 1120px shell width the header/footer use — not its
 * own independently centered column.
 */
export const LAST_UPDATED = "September 12, 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 font-mono text-eyebrow uppercase text-tag">
          Last updated: {LAST_UPDATED}
        </p>
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

/** A numbered section. `number` is rendered as-is (e.g. "1", "12"). */
export function LegalSection({
  number,
  title,
  children,
}: {
  number?: string | number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
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
