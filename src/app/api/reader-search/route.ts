import { NextResponse } from "next/server";
import { MAX_QUERY_LENGTH, sanitizeHeadline } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { JUMP_TEXT_LIMIT, type JumpTextHit } from "@/lib/jump-search";

export const runtime = "nodejs";

/** A document key as the corpus spells it: "gp05", "7", "oooob", "p192". */
const REG_KEY = /^[a-z0-9]{1,24}$/;

/**
 * GET /api/reader-search?reg=<reg key>&q=<words>
 * Returns { results: [{ id, citation, headline }] } -- the reader's jump box
 * text matches (11 Oct 2026): the keyword search inside one document, at most
 * JUMP_TEXT_LIMIT rows, headline = the excerpt with <mark> around the query
 * terms. It runs through the cookie-based client, so search_provisions_in_document
 * (SECURITY INVOKER) is RLS-bound to the caller: a logged-out visitor gets
 * only is_public rows (all of GP05, nothing of a locked document), a
 * subscriber the document. Never cached: a visitor who subscribes a minute
 * later must not keep seeing an empty list.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const reg = (params.get("reg") ?? "").trim().toLowerCase();
  const q = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!REG_KEY.test(reg)) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!q) return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_provisions_in_document", {
      q,
      doc_key: reg,
      lim: JUMP_TEXT_LIMIT,
    });
    if (error) throw new Error(error.message);
    const results: JumpTextHit[] = ((data ?? []) as { id: string; citation: string; headline: string | null }[]).map((r) => ({
      id: r.id,
      citation: r.citation,
      headline: r.headline ? sanitizeHeadline(r.headline) : null,
    }));
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("reader-search:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't search this document." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
