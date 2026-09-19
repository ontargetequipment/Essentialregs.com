import Link from "next/link";
import { fetchRegulationList, regulationNumber } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { RegulationList } from "@/components/RegulationList";

export const metadata = {
  title: "APCD General Permits",
};

/** Matches an APCD general-permit key ("gp01".."gp12") as used in provision ids. */
const GP_KEY = /^gp\d\d$/;

// Display-only "Applies to ..." one-liner per permit, taken from CDPHE's own
// general-permits page (https://cdphe.colorado.gov/apcd/general-air-permits).
// Not stored data -- purely a card annotation, keyed by regulationNumber().
const APPLIES_TO: Record<string, string> = {
  gp01: "condensate storage tank batteries",
  gp02: "natural-gas-fired reciprocating internal combustion engines at oil and gas operations",
  gp03: "land development projects",
  gp05: "produced water storage tank batteries",
  gp06: "diesel-fired reciprocating internal combustion engines",
  gp07: "hydrocarbon liquid loadout at oil and gas operations",
  gp08: "oil and gas industry storage tanks (condensate, crude oil, produced water)",
  gp09:
    "oil and gas well production facilities in attainment areas (closed to new registrations July 15, 2026; existing registrations remain active)",
  gp10:
    "oil and gas well production facilities in nonattainment areas (closed to new registrations July 15, 2026; existing registrations remain active)",
  gp11: "routine or predictable gas venting emissions at oil and gas operations",
  gp12:
    "oil and gas well production facilities (accepting registrations since July 15, 2026; replaces GP09/GP10 for new registrations)",
};

export default async function GeneralPermitsIndexPage() {
  // Same RLS-safe fetch/access pattern as /regulations and /federal --
  // fetchRegulationList() is bound by RLS, getAccessStatus() just tells us
  // whether an empty result means "not subscribed" or "nothing loaded".
  const [access, allRegs] = await Promise.all([
    getAccessStatus(),
    fetchRegulationList(),
  ]);
  const regs = allRegs.filter((r) => GP_KEY.test(regulationNumber(r.id) ?? ""));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">APCD General Permits</h1>
      <p className="mt-2 text-sm text-zinc-600">
        The Colorado Air Pollution Control Division issues general
        construction permits covering common oil-and-gas source types --
        registering under one is faster than a source-specific
        construction permit, but only works if the source meets every
        condition the permit sets. A registrant has to meet all of them,
        not just most.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        The permit text here is the current issuance, with cross-references
        resolved to the AQCC regulations and federal rules it cites.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Looking for the numbered AQCC regulations or ECMC rules? See{" "}
        <Link href="/regulations" className="font-medium text-zinc-900 underline underline-offset-2">
          Colorado regulations
        </Link>
        .
      </p>

      {/* "flat" (not "state"): this page IS the "APCD General Permits"
          group's own destination, so it shows the permit cards directly
          rather than repeating that group heading as a self-link. */}
      <RegulationList regs={regs} access={access} mode="flat" appliesTo={APPLIES_TO} />

      <p className="mt-8 text-xs text-zinc-500">
        Application forms and filing fees aren&apos;t reproduced here (we
        don&apos;t track fees) -- see CDPHE&apos;s{" "}
        <a
          href="https://cdphe.colorado.gov/apcd/general-air-permits"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-700 underline underline-offset-2 hover:text-emerald-700"
        >
          General Air Permits page
        </a>{" "}
        to register.
      </p>
    </div>
  );
}
