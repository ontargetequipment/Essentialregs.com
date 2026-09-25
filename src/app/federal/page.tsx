import Link from "next/link";
import { fetchRegulationRoots, regulationCardHref } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { RegulationList } from "@/components/RegulationList";

export const metadata = {
  title: "Federal regulations",
};

// One-line "Applies to ..." card description per federal regulation number
// (keyed the same way regulationNumber() derives it from the id) -- display
// copy only, not stored data, same convention RegulationList already uses
// for the /general-permits page's appliesTo prop.
const APPLIES_TO: Record<string, string> = {
  p191: "Reporting: incidents, annual reports, safety-related conditions",
  p192: "Gas pipelines: design, construction, operation, maintenance, integrity management, OQ",
  p194: "Onshore oil pipelines: oil spill response plans, response zones, worst case discharge",
  p195: "Hazardous liquid pipelines: design, construction, pressure testing, operation, corrosion control, integrity management",
  p199: "Drug and alcohol testing programs for employees performing covered pipeline functions",
  p190: "Everyone PHMSA regulates: inspections, notices of probable violation, hearings, civil penalties, orders and rulemaking procedures",
  p193: "LNG plant operators: siting, design, construction, equipment, operations, maintenance, personnel, fire protection and security",
  p196: "Excavators digging near pipelines: one-call notification, protecting underground pipelines, reporting damage and PHMSA enforcement",
};

export default async function FederalIndexPage() {
  // The index of what is covered is marketing, not paywalled content, so
  // the roots come from the anonymous-safe fetchRegulationRoots (citation
  // and title, service-role) rather than the RLS-bound fetchRegulationList
  // that /regulations uses: a logged-out visitor used to get zero cards
  // here. Entitlement only decides where a card links (RegulationList:
  // the reader for a subscriber, the public /preview teaser otherwise).
  const [access, allRegs] = await Promise.all([
    getAccessStatus(),
    fetchRegulationRoots(),
  ]);
  const regs = allRegs.filter((r) => r.jurisdiction_level === "federal");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Federal regulations</h1>
      <p className="mt-2 text-sm text-zinc-600">
        40 CFR Part 60 (New Source Performance Standards) and Part 63
        (NESHAP) subparts as printed in the eCFR, incorporated by
        reference in{" "}
        {/* Same anonymous-vs-entitled target as the cards below: the reader
            404s for a logged-out visitor, so they get the public teaser. */}
        <Link
          href={regulationCardHref("6", access.hasAccess)}
          className="font-medium text-zinc-900 underline underline-offset-2"
        >
          Colorado Regulation Number 6 Part A
        </Link>
        . Also included: 49 CFR Parts 190 through 196 and 199, PHMSA&apos;s
        federal pipeline safety standards for gas, hazardous liquid and LNG
        facilities, its enforcement procedures and its excavation damage
        prevention rule, administered by the US DOT.
      </p>

      <RegulationList regs={regs} access={access} mode="federal" appliesTo={APPLIES_TO} />
    </div>
  );
}
