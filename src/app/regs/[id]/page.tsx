import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProvisionCard, cardAccess } from "@/components/ProvisionCard";
import { RelatedProvisions } from "@/components/RelatedProvisions";
import { regKeyOf, regulationDisplayName, withReviewerKind } from "@/lib/regulation-pure";
import { provisionBackLink } from "@/lib/provision-back";
import { displayCitation } from "@/lib/federal-citation";
import { PROVISION_ID, type Provision } from "@/lib/types";
import { pageContainerClass } from "@/lib/ui";

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
  // reviewed_by (an email on some rows) is reduced to a boolean for the badge.
  return { ...withReviewerKind(data), cross_references: data.cross_references ?? [] } as Provision;
});

/** "I.D.3.a.(i). · Regulation 7": the provision's citation and its regulation's display name. */
function pageTitle(provision: Provision): string {
  const regKey = regKeyOf(provision.id);
  return regKey ? `${displayCitation(regKey, provision.citation)} · ${regulationDisplayName(regKey)}` : provision.citation;
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

  // Where back goes depends on the row (provisionBackLink): a row with no
  // regulation key is a hand-written sample (/sample); GP05's rows go to its
  // open reader; a public row of a closed regulation (Regulation 7 I.C.1 and
  // below) goes to that document's visitor preview, focused on its Part; any
  // other row is a corpus provision reached from search or a link, and its
  // home is the reader (or the preview, for a visitor who cannot open it).
  const { hasAccess } = await cardAccess();
  const back = provisionBackLink(provision, { hasAccess });

  return (
    <div className={pageContainerClass("py-12")}>
      <Link href={back.href} className="text-sm text-blue-700 hover:underline">
        {back.label}
      </Link>
      <div className="mt-4 flex max-w-reading flex-col gap-3">
        <ProvisionCard provision={provision} />
        {/* A subscriber's related provisions are read through RLS (every
            neighbour). Anyone else gets the teaser (Sprint 4, 10 Oct 2026):
            the same neighbours as citation and title only (no summary, no
            path, no text outside GP05; teaserItem), each linking to its
            focused preview, so a visitor sees that related material exists
            without reading it. /sample used to carry this teaser;
            it now lives on the card pages. */}
        <RelatedProvisions provisionId={provision.id} teaser={!hasAccess} hasAccess={hasAccess} />
      </div>
    </div>
  );
}
