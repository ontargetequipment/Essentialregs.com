import "server-only";
import { provisionDestination } from "@/lib/destination";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessStatus } from "@/lib/access";
import { expandAcronyms, keywordQuery } from "@/lib/acronyms";
import { matchQuestionMap, type QuestionMap } from "@/lib/question-maps";
import { regulationDisplayName } from "@/lib/regulation-pure";

/**
 * Semantic ("Ask") search — Phase 3 of the semantic-search plan.
 *
 * Flow: the question is turned into a Voyage AI query embedding (same model
 * the corpus was embedded with, see pipeline/embed.py), then the
 * `match_provisions` RPC (supabase/migrations/005_embeddings.sql) returns the
 * nearest provisions. The RPC runs as the cookie session, so a caller without
 * an active subscription is refused by the database itself even if this code
 * were bypassed. Every Ask is logged to `search_queries` (service role,
 * owner-only) and rate-limited per user from that log.
 */

export const EMBED_MODEL = "voyage-3.5-lite";
export const EMBED_DIMS = 1024;
export const MAX_ASK_LENGTH = 500;
export const ASK_RESULT_COUNT = 20;
/** Ask searches per user per minute before we refuse. */
export const ASK_RATE_LIMIT = 30;

export type Jurisdiction = "state" | "federal";

export type SemanticHit = {
  id: string;
  citation: string;
  title: string;
  reg_key: string | null;
  jurisdiction_level: "state" | "federal" | "county";
  summary: string | null;
  /** cosine similarity, 0–1 (typically 0.6–0.9 for a good hit); null when only the keyword side found it */
  score: number | null;
  /** statement of basis / rulemaking history rather than an operative rule */
  is_basis?: boolean;
  /** the full-text search also matched this provision (hybrid only) */
  keyword_hit?: boolean;
  /**
   * The score the hybrid results are ordered by: reciprocal-rank fusion for
   * a query of five words or fewer, cosine-based (cosine minus a 0.40 floor,
   * plus a keyword bonus of up to 0.02) for a question of six or more, then
   * the ranking multipliers (migration 20261001042517; state words incl.
   * Division / Commission since 20261002151233).
   */
  fused?: number;
  /** ancestor headings below the regulation ("PART B — … › II. …"); null when directly under it */
  path?: string | null;
};

export type SemanticOptions = {
  regFilter?: string[] | null;
  jurisdiction?: Jurisdiction | null;
  count?: number;
  /**
   * true includes statements of basis, ranked below the rules (x0.5). Default
   * false: hidden, as on keyword search (default changed 2026-09-30).
   */
  includeBasis?: boolean;
  /** "hybrid" (default) fuses full-text + vector; "vector" is meaning only */
  mode?: "hybrid" | "vector";
};

/**
 * What an Ask returns: the retrieval hits, exactly as the RPC ranked them,
 * and the question map the question routed to (null when none matched).
 * The map is additive (Ask Track B): the page lays the hits out under its
 * groups, /api/search/semantic reports it beside the hits, the eval checks
 * the routing. Retrieval itself never changes because a map matched.
 */
export type AskResult = { hits: SemanticHit[]; map: QuestionMap | null };

export class SemanticError extends Error {
  constructor(
    message: string,
    public readonly code: "unauthenticated" | "forbidden" | "rate_limited" | "config" | "upstream" | "db"
  ) {
    super(message);
  }
}

export { jurisdictionOfKey, regBadge } from "@/lib/regulation-names";

/**
 * Display name for a hit's reg key ("Regulation 7", "40 CFR Part 60 Subpart
 * OOOOb", "2 CCR 404-1 (ECMC Rules)", "APCD General Permit GP02"); "" for a
 * row outside any regulation. Hits do not carry their root row, so this is
 * regulationDisplayName's derived path -- never the raw key.
 */
export function regLabel(regKey: string | null): string {
  return regKey ? regulationDisplayName(regKey) : "";
}

/**
 * Reader link for a hit. Ask is subscriber-only, so the viewer always has
 * access here; provisionDestination (destination.ts) is the one place that
 * also decides the link for everyone else (Sprint 4, 10 Oct 2026).
 */
export function hrefForHit(hit: Pick<SemanticHit, "id" | "reg_key">): string {
  return provisionDestination(hit, { hasAccess: true });
}

/**
 * Embeds one or more query strings with Voyage. `input_type: "query"` is the
 * asymmetric partner of the `"document"` embeddings in the corpus — Voyage
 * recommends the pair for retrieval. Never called for an empty list.
 */
export async function embedQueries(texts: string[]): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new SemanticError("VOYAGE_API_KEY is not set on the server.", "config");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: texts,
      model: EMBED_MODEL,
      input_type: "query",
      output_dimension: EMBED_DIMS,
      truncation: true,
    }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new SemanticError(`Embedding service error (${res.status}): ${detail}`, "upstream");
  }
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function cleanQuestion(q: string): string {
  return q.replace(/\s+/g, " ").trim().slice(0, MAX_ASK_LENGTH);
}

const VALID_REG = /^[a-z0-9]+$/;

/**
 * Runs an Ask search as the current visitor. Throws SemanticError with a
 * code the caller can map to a message / HTTP status. Statements of Basis
 * are left out unless opts.includeBasis is true. The question map (if any)
 * rides along in the result; it changes nothing about the RPC call.
 */
export async function semanticSearch(
  question: string,
  opts: SemanticOptions = {}
): Promise<AskResult> {
  const q = cleanQuestion(question);
  if (!q) return { hits: [], map: null };

  const access = await getAccessStatus();
  if (!access.user) throw new SemanticError("Log in to use Ask.", "unauthenticated");
  if (!access.hasAccess) throw new SemanticError("Ask is available to subscribers.", "forbidden");

  const regFilter = (opts.regFilter ?? []).map((r) => r.toLowerCase()).filter((r) => VALID_REG.test(r));
  const jurisdiction = opts.jurisdiction ?? null;
  const count = Math.min(Math.max(opts.count ?? ASK_RESULT_COUNT, 1), 50);

  // Rate limit from the log (service role: the log table has no policies).
  const admin = createAdminClient();
  const { data: recent, error: rateErr } = await admin.rpc("search_queries_recent_count", {
    p_user: access.user.id,
    window_seconds: 60,
  });
  if (rateErr) console.error("ask: rate-limit lookup failed", rateErr.message);
  if (typeof recent === "number" && recent >= ASK_RATE_LIMIT) {
    throw new SemanticError("Too many searches in the last minute — try again shortly.", "rate_limited");
  }

  const started = Date.now();
  // "ECD testing" → "ECD (enclosed combustion device) testing": the corpus
  // spells acronyms out; the embedding model and the keyword index both do
  // better with the phrase present.
  const expanded = expandAcronyms(q);
  const [embedding] = await embedQueries([expanded]);

  // The user's own session client, so the RPC's access check sees them.
  const supabase = await createClient();
  const mode = opts.mode ?? "hybrid";
  const includeBasis = opts.includeBasis ?? false;
  const { data, error } =
    mode === "vector"
      ? await supabase.rpc("match_provisions", {
          query_embedding: embedding,
          match_count: count,
          reg_filter: regFilter.length ? regFilter : null,
          jurisdiction_filter: jurisdiction,
          include_basis: includeBasis,
        })
      : await supabase.rpc("match_provisions_hybrid", {
          query_text: expanded,
          query_embedding: embedding,
          match_count: count,
          reg_filter: regFilter.length ? regFilter : null,
          jurisdiction_filter: jurisdiction,
          include_basis: includeBasis,
          // Structured full-text query: (ecd | enclosed<->combustion<->device) & testing
          keyword_query: keywordQuery(q) || null,
        });
  if (error) {
    if (error.code === "42501") throw new SemanticError("Ask is available to subscribers.", "forbidden");
    throw new SemanticError(error.message, "db");
  }
  const hits = (data ?? []) as SemanticHit[];

  // Question map (Ask Track B): routed after retrieval, never fed back into
  // it. matchQuestionMap() expands the question itself; it is given the raw
  // one so a premise note (src/lib/premise-notes.ts) sees what was typed.
  // Logged beside the expansion so the owner can see which questions took
  // a map.
  const map = matchQuestionMap(q);

  // Log (best effort; never fails the search).
  const { error: logErr } = await admin.from("search_queries").insert({
    user_id: access.user.id,
    mode: "ask",
    query: q + (expanded !== q ? `  ⟶ ${expanded}` : "") + (map ? `  ⟶ map:${map.key}` : ""),
    reg_filter: regFilter.length ? regFilter : null,
    jurisdiction,
    result_ids: hits.map((h) => h.id),
    top_score: hits[0]?.score ?? null,
    latency_ms: Date.now() - started,
  });
  if (logErr) console.error("ask: could not log query", logErr.message);

  return { hits, map };
}
