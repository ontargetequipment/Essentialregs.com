import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProvisionCard } from "@/components/ProvisionCard";
import type { Provision } from "@/lib/types";

export default async function ProvisionPage(
  props: PageProps<"/regs/[id]">
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provisions")
    .select(
      "*, cross_references!cross_references_from_provision_id_fkey(id, raw_text, target_type, target_provision_id, target_url)"
    )
    .eq("id", id)
    .maybeSingle();

  // Row Level Security means a provision that isn't public (and that the
  // current visitor isn't a subscriber for) simply won't be returned here —
  // that shows up as `data` being null, same as a genuinely missing id.
  if (error || !data) {
    notFound();
  }

  const provision = {
    ...data,
    cross_references: data.cross_references ?? [],
  } as Provision;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/sample" className="text-sm text-blue-700 hover:underline">
        ← Back to sample
      </Link>
      <div className="mt-4">
        <ProvisionCard provision={provision} />
      </div>
    </div>
  );
}
