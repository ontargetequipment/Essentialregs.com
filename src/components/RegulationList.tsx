import Link from "next/link";
import type { AccessStatus } from "@/lib/access";
import { ANNUAL_PRICE_DISPLAY } from "@/lib/pricing";
import { SubscribeControl } from "@/components/SubscribeControl";
import type { Provision } from "@/lib/types";

/**
 * The card list shared by the /regulations (Colorado) and /federal index
 * pages: the subscribe prompt for visitors without access, one card per
 * regulation root, and the "nothing loaded" note for subscribers when the
 * list is empty. Every card links to the gated reader at
 * /regulations/<reg> -- the federal subparts live at the same reader URLs
 * as the Colorado regulations, so stored cross-reference hrefs keep working.
 */
export function RegulationList({
  regs,
  access,
}: {
  regs: Pick<Provision, "id" | "citation" | "title">[];
  access: AccessStatus;
}) {
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

      <div className="mt-8 flex flex-col gap-4">
        {regs.map((r) => {
          const regNumber = r.id.match(/^sec-(.+)-top-REG-/)?.[1] ?? r.id;
          return (
            <Link
              key={r.id}
              href={`/regulations/${regNumber}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <p className="text-xs font-mono uppercase tracking-wide text-emerald-700">
                {r.citation}
              </p>
              <p className="mt-1 font-semibold text-zinc-900">{r.title}</p>
            </Link>
          );
        })}
      </div>

      {access.hasAccess && regs.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          No regulations loaded yet.
        </p>
      )}
    </>
  );
}
