import Link from "next/link";
import { pageContainerClass } from "@/lib/ui";
import { fetchRegulationRoots } from "@/lib/regulation";
import { STATES, coverageLabel, stateCoverage, stateRoots } from "@/lib/states";

export const metadata = {
  title: "State Regulations",
};

export default async function StatesIndexPage() {
  // The same anonymous-safe root read the state, federal and general-permit
  // indexes use (the index of what is covered is marketing, not paywalled
  // content), so each card's counts are live and a visitor sees exactly
  // what a subscriber sees. No entitlement check here: a card only links to
  // the state's own index, which does the visitor/subscriber routing.
  const roots = await fetchRegulationRoots();

  return (
    <div className={pageContainerClass("py-12")}>
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">
        State Regulations
      </h1>
      <p className="mt-2 max-w-reading text-sm text-ink-soft">
        Choose a state to browse its air-quality and oil &amp; gas
        regulations. Looking for the federal EPA subparts and PHMSA parts?
        See{" "}
        <Link href="/federal" className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0">
          Federal regulations
        </Link>
        .
      </p>

      {/* Same card and grid as the /federal and /states/<state> indexes
          (RegulationList): eyebrow, serif title, muted subtitle. */}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATES.map((state) => (
          <li key={state.slug}>
            <Link
              href={`/states/${state.slug}`}
              className="block rounded-lg border border-line bg-panel p-5 shadow-sm transition hover:border-accent hover:shadow-md"
            >
              <p className="font-mono text-eyebrow uppercase text-tag">
                {coverageLabel(stateCoverage(stateRoots(state, roots)))}
              </p>
              <p className="mt-1 font-serif text-card font-semibold text-ink">{state.name}</p>
              <p className="mt-0.5 text-xs text-muted">{state.covers}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-reading text-sm text-muted">
        More states are on the way. Don&rsquo;t see your state?{" "}
        <Link
          href="/request"
          className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
        >
          Request it
        </Link>
        .
      </p>
    </div>
  );
}
