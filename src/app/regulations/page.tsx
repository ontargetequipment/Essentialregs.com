import Link from "next/link";
import { fetchRegulationRoots } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { RegulationList } from "@/components/RegulationList";

export const metadata = {
  title: "Colorado regulations",
};

export default async function RegulationsIndexPage() {
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
  const regs = allRegs.filter((r) => r.jurisdiction_level === "state");

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">
          Colorado regulations
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          The AQCC air-quality regulations, the APCD General Permits and the
          ECMC rules, each browsable with a section sidebar and
          click-to-preview citations. More regulations get added here over
          time.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Looking for the federal EPA subparts and PHMSA parts? See{" "}
          <Link href="/federal" className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0">
            Federal regulations
          </Link>
          .
        </p>

        <RegulationList regs={regs} access={access} mode="state" />
      </div>
    </div>
  );
}
