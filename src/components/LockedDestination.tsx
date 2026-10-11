import Link from "next/link";
import { TRIAL_DAYS } from "@/lib/pricing";

/**
 * The "locked destination" panel of the focused preview
 * (/regulations/<reg>/preview?p=<id>, Sprint 4, 10 Oct 2026): a visitor
 * followed a link to one provision the reader would not open for them. Says
 * which provision it is and offers the trial. Server component, no data of
 * its own -- the page passes the labels.
 *
 * `readerHref` is where a login should land (the provision in the reader);
 * the login page validates `next` as a same-site path (safe-redirect.ts).
 */
export function LockedDestination({
  regName,
  citation,
  title,
  readerHref,
}: {
  regName: string;
  citation: string;
  /** Already citation-stripped; "" or undefined omits the line. */
  title?: string;
  readerHref?: string;
}) {
  return (
    <section
      data-testid="locked-destination"
      className="mt-6 rounded-lg border border-line bg-accent-soft p-6"
    >
      <h2 className="font-serif text-card font-semibold text-ink">
        {regName} {citation} is in the full corpus.
      </h2>
      {title && <p className="mt-1 text-sm font-medium text-ink-soft">{title}</p>}
      <p className="mt-2 text-sm text-ink-soft">
        Start your {TRIAL_DAYS}-day trial to open it in the cross-referenced reader.
      </p>
      <LockedActions readerHref={readerHref} />
    </section>
  );
}

/**
 * What stays locked under a public subtree (the focused preview of a row
 * that IS public, Sprint 7): the subtree above is readable, the rest of the
 * regulation is the subscription. Same two buttons as LockedDestination.
 * `readerHref` is where a login should land.
 */
export function LockedRest({ regName, readerHref }: { regName: string; readerHref?: string }) {
  return (
    <section
      data-testid="locked-rest"
      className="mt-6 rounded-lg border border-line bg-accent-soft p-6"
    >
      <h2 className="font-serif text-card font-semibold text-ink">
        The rest of {regName} is in the full corpus.
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        Start your {TRIAL_DAYS}-day trial to read all of it in the cross-referenced reader.
      </p>
      <LockedActions readerHref={readerHref} />
    </section>
  );
}

/** The trial and log-in buttons both panels end with. */
function LockedActions({ readerHref }: { readerHref?: string }) {
  const loginHref = readerHref ? `/login?next=${encodeURIComponent(readerHref)}` : "/login";
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <Link
        href="/signup"
        className="rounded-md bg-accent px-5 py-3 text-center text-sm font-semibold text-white hover:bg-accent/90"
      >
        Start your {TRIAL_DAYS}-day trial
      </Link>
      <Link
        href={loginHref}
        className="rounded-md border border-line bg-panel px-5 py-3 text-center text-sm font-semibold text-ink-soft hover:bg-accent-soft"
      >
        Log in
      </Link>
    </div>
  );
}
