import { createClient } from "@/lib/supabase/server";
import { ProvisionCard } from "@/components/ProvisionCard";
import type { Provision } from "@/lib/types";

export const metadata = {
  title: "Sample",
};

export default async function SamplePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provisions")
    .select(
      "*, cross_references!cross_references_from_provision_id_fkey(id, raw_text, target_type, target_provision_id, target_url)"
    )
    .in("id", ["osha-1910-119", "ecmc-rule-604", "cdphe-reg7-general"])
    .order("sort_order", { ascending: true });

  const provisions = (data ?? []).map((p) => ({
    ...p,
    cross_references: p.cross_references ?? [],
  })) as Provision[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">
        Sample: Colorado Oil &amp; Gas Regulations
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        A few real entries from the full corpus, left open so you can judge
        the quality of the summaries and links before subscribing. Every
        subscriber sees the full federal, state, and (eventually) county
        corpus in the same format.
      </p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load sample content: {error.message}. If this is a
          fresh Supabase project, make sure{" "}
          <code className="font-mono">schema.sql</code> and{" "}
          <code className="font-mono">seed_sample.sql</code> have been run.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {provisions.map((provision) => (
          <ProvisionCard key={provision.id} provision={provision} />
        ))}
      </div>

      {!error && provisions.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">
          No public sample entries yet — run{" "}
          <code className="font-mono">supabase/seed_sample.sql</code> against
          your project to see this page populated.
        </p>
      )}
    </div>
  );
}
