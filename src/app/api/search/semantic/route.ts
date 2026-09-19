import { NextResponse } from "next/server";
import {
  MAX_ASK_LENGTH,
  SemanticError,
  semanticSearch,
  type Jurisdiction,
} from "@/lib/semantic";

export const runtime = "nodejs";

const STATUS: Record<SemanticError["code"], number> = {
  unauthenticated: 401,
  forbidden: 403,
  rate_limited: 429,
  config: 500,
  upstream: 502,
  db: 500,
};

/**
 * POST /api/search/semantic
 * Body: { q: string, regs?: string[], jurisdiction?: "state" | "federal", count?: number }
 * Returns: { hits: SemanticHit[] }
 *
 * Same behaviour as the Ask mode on /search, as JSON. Subscriber-only,
 * rate-limited, logged — all enforced inside semanticSearch().
 */
export async function POST(req: Request) {
  let body: { q?: unknown; regs?: unknown; jurisdiction?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const q = typeof body.q === "string" ? body.q.slice(0, MAX_ASK_LENGTH) : "";
  if (!q.trim()) {
    return NextResponse.json({ error: "q is required." }, { status: 400 });
  }
  const regs = Array.isArray(body.regs) ? body.regs.filter((r): r is string => typeof r === "string") : null;
  const jurisdiction: Jurisdiction | null =
    body.jurisdiction === "state" || body.jurisdiction === "federal" ? body.jurisdiction : null;
  const count = typeof body.count === "number" ? body.count : undefined;

  try {
    const hits = await semanticSearch(q, { regFilter: regs, jurisdiction, count });
    return NextResponse.json({ hits });
  } catch (e) {
    if (e instanceof SemanticError) {
      if (e.code === "config" || e.code === "db" || e.code === "upstream") console.error("ask:", e.message);
      return NextResponse.json({ error: e.message }, { status: STATUS[e.code] });
    }
    console.error("ask: unexpected", e);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
