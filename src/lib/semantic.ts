import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessStatus } from "@/lib/access";
import { expandAcronyms } from "@/lib/acronyms";

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
  /** reciprocal-rank-fusion score the hybrid results are ordered by */
  fused?: number;
};

export type SemanticOptions = {
  regFilter?: string[] | null;
  jurisdiction?: Jurisdiction | null;
  count?: number;
  /** false hides statements of basis entirely (default: shown, demoted) */
  includeBasis?: boolean;
  /** "hybrid" (default) fuses full-text + vector; "vector" is meaning only */
  mode?: "hybrid" | "vector";
};

export class SemanticError extends Error {
  constructor(
    message: string,
    public readonly code: "unauthenticated" | "forbidden" | "rate_limited" | "config" | "upstream" | "db"
  ) {
    super(message);
  }
}

/** Human label for the reg badge on results and related panels. */
export function regBadge(regKey: string | null, jurisdiction: string): string {
  if (jurisdiction === "federal") return "Federal";
  if (regKey === "ecmc") return "ECMC";
  return "Colorado";
}

/** Short display name for a reg key: "Reg 7", "OOOOb", "ECMC", "Common Provisions". */
export function regLabel(regKey: string | null): string {
  if (!regKey) return "";
  if (regKey.startsWith("oooo")) return "Subpart " + regKey.replace("oooo", "OOOO");
  if (regKey === "ecmc") return "ECMC rules";
  if (regKey === "cp") return "Common Provisions";
  return `Reg ${regKey}`;
}

/** Reader link for a hit; mirrors hrefFor() on the keyword search page. */
export function hrefForHit(hit: Pick<SemanticHit, "id" | "reg_key">): string {
  return hit.reg_key ? `/regulations/${hit.reg_key}#${hit.id}` : `/regs/${hit.id}`;
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
 * code the caller can map to a message / HTTP status.
 */
export async function semanticSearch(
  question: string,
  opts: SemanticOptions = {}
): Promise<SemanticHit[]> {
  const q = cleanQuestion(question);
  if (!q) return [];

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
  const includeBasis = opts.includeBasis ?? true;
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
        });
  if (error) {
    if (error.code === "42501") throw new SemanticError("Ask is available to subscribers.", "forbidden");
    throw new SemanticError(error.message, "db");
  }
  const hits = (data ?? []) as SemanticHit[];

  // Log (best effort; never fails the search).
  const { error: logErr } = await admin.from("search_queries").insert({
    user_id: access.user.id,
    mode: "ask",
    query: q + (expanded !== q ? `  ⟶ ${expanded}` : ""),
    reg_filter: regFilter.length ? regFilter : null,
    jurisdiction,
    result_ids: hits.map((h) => h.id),
    top_score: hits[0]?.score ?? null,
    latency_ms: Date.now() - started,
  });
  if (logErr) console.error("ask: could not log query", logErr.message);

  return hits;
}
