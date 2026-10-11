import { NextResponse } from "next/server";
import { getAccessStatus } from "@/lib/access";
import { loadProvisionPreview, previewCacheControl } from "@/lib/provision-preview";
import { fetchSubtreeRows } from "@/lib/preview-subtree-data";
import { fetchProvisionTeaser, fetchRegulationTeaser } from "@/lib/regulation";
import { regKeyOf } from "@/lib/regulation-names";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/provision/<provision id>
 * Returns { id, reg_key, citation, title, html, summary } -- one provision's
 * sanitised text, plus its summary overview and review badge, for the
 * reader's preview of a link into another regulation (or of a whole
 * document, through its root row). Entitled
 * visitors get the text, read through their own RLS-bound client; anyone else
 * gets 200 { locked: true, id, reg_key, citation, title, path } -- the label
 * of the provision, read with the service role from four columns and never
 * its text (Sprint 4, 10 Oct 2026; was 401 / 403) -- except for a row that is
 * is_public (Regulation 7 I.C.1 and below, 11 Oct 2026), which anyone gets
 * as text with its summary panel and public sub-rows. The gate itself is
 * loadProvisionPreview.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Next has already decoded the segment: "(" and ")" arrive literally, so
  // the id is NOT decoded again.
  const { id } = await ctx.params;
  try {
    const result = await loadProvisionPreview(id, {
      access: async () => {
        const status = await getAccessStatus();
        return { signedIn: status.user !== null, hasAccess: status.hasAccess };
      },
      fetchRow: async (rowId) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("provisions")
          .select("id, citation, title, full_text, ai_summary, summary_status, reviewed_at, reviewed_by")
          .eq("id", rowId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      },
      // A viewer who cannot read the corpus still reads a row the database
      // marks is_public (Regulation 7 I.C.1 and below): the row and its
      // descendants through the visitor's own RLS-bound client, which is the
      // gate. loadProvisionPreview fences what comes back.
      fetchSubtree: async (rowId) => {
        const key = regKeyOf(rowId);
        return key ? fetchSubtreeRows(key, rowId) : [];
      },
      // What a public row's summary panel needs of its regulation: the root's
      // source link and how many summaries are still pending (the gate).
      fetchPanelContext: async (key) => {
        const { root, pendingSummaries } = await fetchRegulationTeaser(key);
        return root ? { rootSourceUrl: root.source_url ?? null, pendingSummaries } : null;
      },
      // The label of a provision the viewer cannot read: fetchProvisionTeaser
      // selects id, citation, title and context_path only and is null for a
      // staged regulation.
      fetchLabel: async (rowId) => {
        const key = regKeyOf(rowId);
        return key ? fetchProvisionTeaser(key, rowId) : null;
      },
    });
    return NextResponse.json(result.body, {
      status: result.status,
      // Same private 5-minute cache as /api/related for a full payload;
      // nothing is cached for a refusal or a locked label (a visitor who
      // subscribes a minute later must not keep seeing the lock).
      headers: { "Cache-Control": previewCacheControl(result) },
    });
  } catch (e) {
    console.error("provision preview:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Couldn't load this provision." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
