import Link from "next/link";
import { fetchRegulationList } from "@/lib/regulation";
import { getAccessStatus } from "@/lib/access";
import { ANNUAL_PRICE_DISPLAY } from "@/lib/pricing";
import { SubscribeControl } from "@/components/SubscribeControl";

export const metadata = {
  title: "Regulations",
};

export default async function RegulationsIndexPage() {
  // RLS decides what fetchRegulationList() returns; getAccessStatus() just
  // tells us whether an empty list means "not subscribed" or "corpus empty".
  const [access, regs] = await Promise.all([
    getAccessStatus(),
    fetchRegulationList(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Colorado Regulations</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Full cross-referenced text, browsable with the same sidebar and
        click-to-preview citations as the source document. More regulations
        and states get added here over time.
      </p>

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
    </div>
  );
}
