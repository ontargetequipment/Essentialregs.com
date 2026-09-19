import Link from "next/link";
import { fetchRegulationList } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { RegulationList } from "@/components/RegulationList";

export const metadata = {
  title: "Federal regulations",
};

export default async function FederalIndexPage() {
  // Same fetch and access handling as the Colorado index at /regulations;
  // only the jurisdiction filter differs. The cards still open the shared
  // /regulations/<reg> reader, so no reader URL changes.
  const [access, allRegs] = await Promise.all([
    getAccessStatus(),
    fetchRegulationList(),
  ]);
  const regs = allRegs.filter((r) => r.jurisdiction_level === "federal");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Federal regulations</h1>
      <p className="mt-2 text-sm text-zinc-600">
        40 CFR Part 60 (New Source Performance Standards) and Part 63
        (NESHAP) subparts as printed in the eCFR, incorporated by
        reference in{" "}
        <Link href="/regulations/6" className="font-medium text-zinc-900 underline underline-offset-2">
          Colorado Regulation Number 6 Part A
        </Link>
        .
      </p>

      <RegulationList regs={regs} access={access} mode="federal" />
    </div>
  );
}
