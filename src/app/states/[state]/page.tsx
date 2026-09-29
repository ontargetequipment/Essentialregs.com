import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRegulationRoots } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { RegulationList } from "@/components/RegulationList";
import { stateBySlug, stateRoots } from "@/lib/states";

export async function generateMetadata(props: PageProps<"/states/[state]">): Promise<Metadata> {
  const { state: slug } = await props.params;
  const state = stateBySlug(slug);
  // An unknown slug 404s in the page below; the layout's default title
  // covers that response.
  return state ? { title: `${state.name} regulations` } : {};
}

export default async function StateIndexPage(props: PageProps<"/states/[state]">) {
  const { state: slug } = await props.params;
  const state = stateBySlug(slug);
  if (!state) notFound();

  // Same anonymous-safe read as /federal and /general-permits: the index of
  // what the corpus covers (citation and title per regulation root) is
  // marketing, not paywalled content, so it comes from fetchRegulationRoots
  // (service-role, root rows only) rather than the RLS-bound
  // fetchRegulationList, which returned zero cards to a logged-out visitor
  // and left this page as nothing but the subscribe prompt. Entitlement only
  // decides where a card links (RegulationList: the reader for a subscriber,
  // the public /preview teaser for everyone else) and whether the subscribe
  // panel shows above the list.
  const [access, allRegs] = await Promise.all([
    getAccessStatus(),
    fetchRegulationRoots(),
  ]);
  // The federal subparts and PHMSA parts share the corpus (and the
  // /regulations/<reg> reader URLs) but get their own index at /federal.
  const regs = stateRoots(state, allRegs);

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">
          {state.name} regulations
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{state.intro}</p>
        <p className="mt-2 text-sm text-ink-soft">
          Looking for the federal EPA subparts and PHMSA parts? See{" "}
          <Link href="/federal" className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0">
            Federal regulations
          </Link>
          .
        </p>

        {/* mode="state" is the Colorado grouping (AQCC / APCD General
            Permits / ECMC, see groupColoradoRegulations); a second state
            with different issuing bodies would need its own grouping. */}
        <RegulationList regs={regs} access={access} mode="state" />
      </div>
    </div>
  );
}
