import Link from "next/link";
import type { AccessStatus } from "@/lib/access";
import { ANNUAL_PRICE_DISPLAY } from "@/lib/pricing";
import { SubscribeControl } from "@/components/SubscribeControl";
import type { Provision } from "@/lib/types";
import {
  groupColoradoRegulations,
  groupFederalRegulations,
  regulationCardHref,
  regulationCardInfo,
  regulationNumber,
  type RegulationGroup,
} from "@/lib/regulation";

export type RegulationListRow = Pick<Provision, "id" | "citation" | "title" | "issuing_body">;

/**
 * The card list shared by the /regulations (Colorado) and /federal index
 * pages: the subscribe prompt for visitors without access, one card per
 * regulation root, and the "nothing loaded" note for subscribers when the
 * list is empty. A card links to the gated reader at /regulations/<reg>
 * for an entitled reader and to the public /regulations/<reg>/preview
 * teaser for everyone else (see regulationCardHref).
 *
 * `mode` controls grouping: "state" groups by issuing_body with the AQCC/
 * GP/ECMC headings and AQCC ordering (see groupColoradoRegulations),
 * "federal" groups by CFR part (see groupFederalRegulations), and the
 * default "flat" renders one ungrouped list, same as before grouping
 * existed.
 *
 * `appliesTo` is an optional one-line "Applies to ..." description per
 * regulation number (keyed the same way regulationNumber() derives it from
 * the id, e.g. "gp02"), rendered under the card's subtitle. Used only by the
 * /general-permits page -- display copy that isn't stored data, so it's
 * passed in rather than taught to regulationCardInfo.
 */
export function RegulationList({
  regs,
  access,
  mode = "flat",
  appliesTo,
}: {
  regs: RegulationListRow[];
  access: AccessStatus;
  mode?: "flat" | "state" | "federal";
  appliesTo?: Record<string, string>;
}) {
  const groups: RegulationGroup<RegulationListRow>[] =
    mode === "state"
      ? groupColoradoRegulations(regs)
      : mode === "federal"
      ? groupFederalRegulations(regs)
      : regs.length
      ? [{ key: "all", heading: "", regs }]
      : [];

  return (
    <>
      {!access.hasAccess && (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Subscribe to open the full regulations
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            The complete Colorado corpus — every section, every cross-reference
            resolved, updates included — is {ANNUAL_PRICE_DISPLAY}. Not sure
            yet?{" "}
            <Link href="/sample" className="font-medium text-zinc-900 underline underline-offset-2">
              See a free sample entry
            </Link>{" "}
            first.
          </p>
          <SubscribeControl access={access} className="mt-5" />
          <p className="mt-4 text-xs text-zinc-500">
            Need multiple seats for your team?{" "}
            <Link
              href="/contact-sales"
              className="font-medium text-zinc-700 underline underline-offset-2 hover:text-emerald-700"
            >
              Contact sales
            </Link>
            .
          </p>
        </div>
      )}

      {groups.map((group) => (
        <div className="mt-8" key={group.key}>
          {group.heading && (
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {/* The Colorado index's "APCD General Permits" group heading
                  links out to the dedicated /general-permits page (its own
                  intro copy + "Applies to" lines); every other heading here
                  is a plain label. */}
              {mode === "state" && group.key === "gp" ? (
                <Link href="/general-permits" className="hover:text-zinc-700 hover:underline">
                  {group.heading}
                </Link>
              ) : (
                group.heading
              )}
            </h2>
          )}
          <div className="flex flex-col gap-4">
            {group.regs.map((r) => {
              const reg = regulationNumber(r.id) ?? r.id;
              const info = regulationCardInfo(r);
              return (
                <Link
                  key={r.id}
                  href={regulationCardHref(reg, access.hasAccess)}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <p className="text-xs font-mono uppercase tracking-wide text-emerald-700">
                    {r.citation}
                  </p>
                  <p className="mt-1 font-semibold text-zinc-900">{info.title}</p>
                  {info.subtitle && (
                    <p className="mt-0.5 text-xs text-zinc-500">{info.subtitle}</p>
                  )}
                  {appliesTo?.[reg] && (
                    <p className="mt-2 text-sm text-zinc-600">Applies to {appliesTo[reg]}.</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {access.hasAccess && regs.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          No regulations loaded yet.
        </p>
      )}
    </>
  );
}
