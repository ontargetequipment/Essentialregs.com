import Link from "next/link";
import { fetchRegulationList } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { RegulationList } from "@/components/RegulationList";

export const metadata = {
  title: "Colorado regulations",
};

export default async function RegulationsIndexPage() {
  // RLS decides what fetchRegulationList() returns; getAccessStatus() just
  // tells us whether an empty list means "not subscribed" or "corpus empty".
  const [access, allRegs] = await Promise.all([
    getAccessStatus(),
    fetchRegulationList(),
  ]);
  // The federal NSPS subparts share the corpus (and the /regulations/<reg>
  // reader URLs) but get their own index at /federal.
  const regs = allRegs.filter((r) => r.jurisdiction_level === "state");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Colorado regulations</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Full cross-referenced text, browsable with the same sidebar and
        click-to-preview citations as the source document. More regulations
        and states get added here over time.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Looking for the federal NSPS subparts? See{" "}
        <Link href="/federal" className="font-medium text-zinc-900 underline underline-offset-2">
          Federal regulations
        </Link>
        .
      </p>

      <RegulationList regs={regs} access={access} />
    </div>
  );
}
