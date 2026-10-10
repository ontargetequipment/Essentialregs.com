import { NextResponse } from "next/server";
import {
  MAX_ASK_LENGTH,
  SemanticError,
  semanticSearch,
  type Jurisdiction,
} from "@/lib/semantic";
import { layoutAsk } from "@/lib/question-maps";
import { askScope } from "@/lib/ask-scope";
import { completeListRows } from "@/lib/list-completion";
import { createClient } from "@/lib/supabase/server";

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
 * Body: { q: string, regs?: string[], jurisdiction?: "state" | "federal", count?: number, includeBasis?: boolean, allFacets?: boolean, within?: "any" }
 * Returns: { hits: SemanticHit[], map: QuestionMapSummary | null }
 *
 * Same behaviour as the Ask mode on /search, as JSON. Subscriber-only,
 * rate-limited, logged — all enforced inside semanticSearch(). `hits` is the
 * retrieval list exactly as the RPC ranked it; `map` (Ask Track B) is the
 * question map the question routed to, with its groups as id lists in the
 * order the page shows them (canonical rows first, then the hits grouped
 * under them), or null when no map matched. Since 7 Oct 2026 the map also
 * carries the premise note (`note`), the facet values the question stated
 * (`stated`), the title for them and the omitted line (`omitted`,
 * `omittedIds`); `allFacets: true` turns the stated-fact filter off, like
 * the page's "Show them" link. Since 9 Oct 2026 a question that names one
 * document ("... under Subpart OOOO") is searched within it, like the page
 * (src/lib/ask-scope.ts): `within` in the response is that document's key,
 * or null; `within: "any"` in the body, like ?within=any, turns it off, and a
 * `regs` filter wins. The eval reads hits; the map check reads map.key.
 */
export async function POST(req: Request) {
  let body: { q?: unknown; regs?: unknown; jurisdiction?: unknown; count?: unknown; includeBasis?: unknown; allFacets?: unknown; within?: unknown };
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
  // Statements of Basis are hidden unless the caller sends includeBasis: true,
  // matching the Ask tab. Default changed from shown to hidden on 2026-09-30.
  const includeBasis = body.includeBasis === true;
  const allFacets = body.allFacets === true;
  const scope = askScope(q, { reg: regs && regs.length === 1 ? regs[0].toLowerCase() : null, unconstrained: body.within === "any" });

  try {
    const { hits: found } = await semanticSearch(q, { regFilter: regs && regs.length > 0 ? regs : scope.regFilter ? [scope.regFilter] : regs, jurisdiction, count, includeBasis });
    // A limited search lists a printed list whole, like the page (list-completion.ts).
    const hits = await completeListRows(await createClient(), found, scope.within);
    // The same pure layout the page and the eval use (semanticSearch's own
    // map is the same matchQuestionMap() result; layoutAsk re-derives it).
    return NextResponse.json({ hits, within: scope.within, map: layoutAsk(q, hits, undefined, allFacets, scope.within).summary });
  } catch (e) {
    if (e instanceof SemanticError) {
      if (e.code === "config" || e.code === "db" || e.code === "upstream") console.error("ask:", e.message);
      return NextResponse.json({ error: e.message }, { status: STATUS[e.code] });
    }
    console.error("ask: unexpected", e);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
