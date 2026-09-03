import Link from "next/link";
import { fetchRegulationList } from "@/lib/regulation";

export const metadata = {
  title: "Regulations — EssentialRegs",
};

export default async function RegulationsIndexPage() {
  const regs = await fetchRegulationList();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Colorado Regulations</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Full cross-referenced text, browsable with the same sidebar and
        click-to-preview citations as the source document. More regulations
        and states get added here over time.
      </p>

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

      {regs.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          No regulations loaded yet.
        </p>
      )}
    </div>
  );
}
