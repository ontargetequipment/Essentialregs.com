import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProvisionCard, cardAccess } from "@/components/ProvisionCard";
import { RelatedProvisions } from "@/components/RelatedProvisions";
import { regKeyOf, regulationCardHref, regulationDisplayName } from "@/lib/regulation-pure";
import { PROVISION_ID, type Provision } from "@/lib/types";

// One read per request, shared by generateMetadata and the page. Row Level
// Security means a provision that isn't public (and that the current
// visitor isn't a subscriber for) simply won't be returned here -- that
// shows up as null, same as a genuinely missing id.
const fetchProvision = cache(async (id: string): Promise<Provision | null> => {
  // Next decodes the dynamic segment before this runs, so `id` already
  // holds literal "(" / ")" -- do NOT decodeURIComponent it again.
  if (id.length > 200 || !PROVISION_ID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provisions")
    .select(
      "*, cross_references!cross_references_from_provision_id_fkey(id, raw_text, target_type, target_provision_id, target_url)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data, cross_references: data.cross_references ?? [] } as Provision;
});

/** "I.D.3.a.(i). · Regulation 7": the provision's citation and its regulation's display name. */
function pageTitle(provision: Provision): string {
  const regKey = regKeyOf(provision.id);
  return regKey ? `${provision.citation} · ${regulationDisplayName(regKey)}` : provision.citation;
}

export async function generateMetadata(props: PageProps<"/regs/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const provision = await fetchProvision(id);
  // A missing row falls through to the layout's default title; the page
  // itself 404s.
  return provision ? { title: pageTitle(provision) } : {};
}

export default async function ProvisionPage(
  props: PageProps<"/regs/[id]">
) {
  const { id } = await props.params;
  const provision = await fetchProvision(id);
  if (!provision) {
    notFound();
  }

  // The four public sample rows came from /sample, so they go back there.
  // Any other row is a corpus provision reached from search or a link, and
  // its home is the reader, at its own anchor (or the public teaser when
  // the visitor is not entitled to the reader, which 404s for them).
  const regKey = regKeyOf(provision.id);
  const { hasAccess } = await cardAccess();
  const back =
    provision.is_public || !regKey
      ? { href: "/sample", label: "← Back to sample" }
      : {
          href: hasAccess ? `/regulations/${regKey}#${provision.id}` : regulationCardHref(regKey, false),
          label: `← Back to ${regulationDisplayName(regKey)}`,
        };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href={back.href} className="text-sm text-blue-700 hover:underline">
        {back.label}
      </Link>
      <div className="mt-4 flex flex-col gap-3">
        <ProvisionCard provision={provision} />
        <RelatedProvisions provisionId={provision.id} />
      </div>
    </div>
  );
}
