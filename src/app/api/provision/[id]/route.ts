import { NextResponse } from "next/server";
import { getAccessStatus } from "@/lib/access";
import { loadProvisionPreview } from "@/lib/provision-preview";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/provision/<provision id>
 * Returns { id, reg_key, citation, title, html, summary } -- one provision's
 * sanitised text, plus its summary overview and review badge, for the
 * reader's preview of a link into another regulation (or of a whole
 * document, through its root row). Entitled
 * visitors only (401 signed out, 403 without access), read through the
 * visitor's own RLS-bound client; the gate itself is loadProvisionPreview.
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
          .select("id, citation, title, full_text, ai_summary, summary_status, reviewed_at")
          .eq("id", rowId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      },
    });
    return NextResponse.json(result.body, {
      status: result.status,
      // Same private 5-minute cache as /api/related for a hit; nothing is
      // cached for a refusal (a visitor who subscribes a minute later must
      // not keep seeing the 403).
      headers: { "Cache-Control": result.status === 200 ? "private, max-age=300" : "no-store" },
    });
  } catch (e) {
    console.error("provision preview:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Couldn't load this provision." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
