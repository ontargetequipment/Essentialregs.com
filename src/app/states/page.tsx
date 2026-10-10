import Link from "next/link";
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
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">
          State Regulations
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Choose a state to browse its air-quality and oil &amp; gas
          regulations. Looking for the federal EPA subparts and PHMSA parts?
          See{" "}
          <Link href="/federal" className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0">
            Federal regulations
          </Link>
          .
        </p>

        {/* Same card as the /federal and /states/<state> indexes
            (RegulationList): eyebrow, serif title, muted subtitle. */}
        <ul className="mt-8 flex flex-col gap-4">
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

        <p className="mt-6 text-sm text-muted">More states are on the way.</p>
      </div>
    </div>
  );
}
