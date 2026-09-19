import { NextResponse } from "next/server";
import { RELATED_ID, fetchRelated } from "@/lib/related";

export const runtime = "nodejs";

/**
 * GET /api/related?id=<provision id>
 * Returns { items: RelatedItem[] } — the "Related provisions" for one row,
 * as the current visitor (RLS-bound: subscribers see everything, anonymous
 * visitors only public↔public pairs). Used by the reader's collapsed panels.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id || id.length > 200 || !RELATED_ID.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  try {
    const items = await fetchRelated(id);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (e) {
    console.error("related:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load related provisions." }, { status: 500 });
  }
}
