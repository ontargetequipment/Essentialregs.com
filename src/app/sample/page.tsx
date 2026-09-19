import { createClient } from "@/lib/supabase/server";
import { ProvisionCard } from "@/components/ProvisionCard";
import { RelatedProvisions } from "@/components/RelatedProvisions";
import type { Provision } from "@/lib/types";

export const metadata = {
  title: "Sample",
};

// The order the public sample rows are shown in (the rows themselves are
// whichever provisions have `is_public = true`; flip that flag in the
// database to change the sample, no code change needed). Anything public
// but not listed here sorts after these, by id.
const SAMPLE_ORDER = [
  "sec-7-B-I-D-3-a-(i)", // Reg 7 storage-tank control requirement
  "sec-gp02-II-A-2", // GP02 facility-wide emission limits (permit + table)
  "sec-ecmc-604-a-(1)", // ECMC Rule 604 well location
  "sec-cp-I-G-90", // Common Provisions definition: Potential to Emit
];

export default async function SamplePage() {
  const supabase = await createClient();

  // RLS lets an anonymous visitor read only `is_public` rows, so this is the
  // same query a subscriber would run -- it just returns the public subset.
  const { data, error } = await supabase
    .from("provisions")
    .select(
      "*, cross_references!cross_references_from_provision_id_fkey(id, raw_text, target_type, target_provision_id, target_url)"
    )
    .eq("is_public", true);

  // Each sample row is labelled with its regulation's name (the root row's
  // citation, e.g. "Code of Colorado Regulations · Regulation Number 7"), so
  // a visitor sees which document a section comes from. The root rows are
  // not public, so read them with the same client: RLS returns nothing for
  // an anonymous visitor and the label falls back to the reg key.
  const regKeys = Array.from(
    new Set((data ?? []).map((p) => p.id.match(/^sec-([^-]+)-/)?.[1]).filter(Boolean))
  ) as string[];
  const rootIds = regKeys.map((k) => `sec-${k}-top-REG-${k}`);
  const { data: roots } = rootIds.length
    ? await supabase.from("provisions").select("id, citation").in("id", rootIds)
    : { data: [] as { id: string; citation: string }[] };
  const regLabel = new Map<string, string>();
  for (const r of roots ?? []) {
    const key = r.id.match(/^sec-([^-]+)-top-REG-/)?.[1];
    if (key) regLabel.set(key, r.citation.replace(/^Code of Colorado Regulations · /, ""));
  }

  const provisions = (data ?? [])
    .map((p) => {
      const key = p.id.match(/^sec-([^-]+)-/)?.[1];
      const label = key ? regLabel.get(key) ?? key.toUpperCase() : null;
      // Corpus rows carry the bare label ("I.D.3.a.(i).") as both citation
      // and title; on the card show "<regulation> · Section I.D.3.a.(i)."
      // once, and keep a real title only when it adds something.
      const bare = p.title === p.citation || !p.title;
      return {
        ...p,
        citation: label ? `${label} · ${p.citation}` : p.citation,
        title: bare ? null : p.title,
        cross_references: p.cross_references ?? [],
      };
    })
    .sort((a, b) => {
      const ia = SAMPLE_ORDER.indexOf(a.id);
      const ib = SAMPLE_ORDER.indexOf(b.id);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
      return a.id.localeCompare(b.id);
    }) as Provision[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">
        Sample: real entries from the corpus
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        A few sections exactly as subscribers see them: the official text, a
        reviewed plain-English summary, and the cross-references resolved. The
        full corpus covers the Colorado AQCC regulations, the ECMC rules, the
        APCD general permits, and the federal rules they cite, in the same
        format.
      </p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load sample content: {error.message}.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {provisions.map((provision) => (
          <div key={provision.id} className="flex flex-col gap-3">
            <ProvisionCard provision={provision} />
            {/* Public teaser: citation/title/reviewed summary only, links to /preview. */}
            <RelatedProvisions provisionId={provision.id} teaser />
          </div>
        ))}
      </div>

      {!error && provisions.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          No public sample entries are marked yet.
        </p>
      )}
    </div>
  );
}
