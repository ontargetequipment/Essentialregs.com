/**
 * The Ask eval's per-question path, shared by scripts/ask-eval.ts (the pull
 * request gate) and scripts/ask-eval-stability.ts (repeats and the margin
 * report), so both score a question the same way: the same acronym
 * expansion, scope, keyword query, RPC arguments, list completion, layout
 * and pass rules as the Ask page and /admin/semantic-eval.
 *
 * Margin (11 Oct 2026, src/lib/ask-margin.ts): the RPC is asked for
 * MARGIN_ROWS rows when the question needs fewer, so the rows below the
 * window are there to measure against. The pool the RPC fuses over is
 * greatest(match_count * 3, 60) rows, the same for every match_count up to
 * 20, so the first rowsNeeded(e) rows are exactly what a call for
 * rowsNeeded(e) returns; the pass is scored on those, as before.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { expandAcronyms, keywordQuery } from "../src/lib/acronyms";
import { askScope } from "../src/lib/ask-scope";
import { expectMargin, type Margin } from "../src/lib/ask-margin";
import { completeListRows } from "../src/lib/list-completion";
import { layoutAsk } from "../src/lib/question-maps";
import { DEFAULT_TOP_N, evaluateQuestion, rowsNeeded, type EvalHit, type EvalQuestion, type EvalResult } from "../src/lib/semantic-eval";

// Mirrors EMBED_MODEL / EMBED_DIMS in src/lib/semantic.ts, which cannot be
// imported here (it pulls in the Next.js server client).
export const EMBED_MODEL = "voyage-3.5-lite";
export const EMBED_DIMS = 1024;

/** Rows read per eval question so the margin has rows below the window (see the file comment). */
export const MARGIN_ROWS = 20;

export type Hit = EvalHit & { citation: string; title: string; reg_key: string | null; jurisdiction_level: string; score: number | null; fused: number | null; keyword_hit?: boolean };

export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export async function embedQueries(texts: string[], key: string): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: texts, model: EMBED_MODEL, input_type: "query", output_dimension: EMBED_DIMS, truncation: true }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// One question per Voyage call, the way the app embeds (one string per
// request): a batch embedding differs slightly from the single one (about
// 0.0014 cosine on the same question, 2 Oct), enough to swap two rows within
// 0.0004 of each other, so the gate must score the embedding production uses.
export async function embedQuery(text: string, key: string): Promise<number[]> {
  return (await embedQueries([text], key))[0];
}

/**
 * One hybrid search, retried on a Postgres statement timeout (the embedder
 * and the neighbour rebuild can hold the database busy for minutes; a
 * timed-out probe says nothing about the ranking).
 */
export async function hybrid(supabase: SupabaseClient, args: Record<string, unknown>, label: string): Promise<Hit[]> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc("match_provisions_hybrid", args);
    if (!error) return (data ?? []) as Hit[];
    if (!/statement timeout/i.test(error.message) || attempt >= 4) throw new Error(`${label}: ${error.message}`);
    console.error(`${label}: statement timeout (attempt ${attempt}), retrying...`);
    await new Promise((r) => setTimeout(r, 5_000 * attempt));
  }
}

/** The RPC arguments the Ask page sends for a question, for `count` rows. */
export function askArgs(q: string, embedding: number[], count: number, includeBasis = false): Record<string, unknown> {
  const scope = askScope(q);
  return {
    query_text: expandAcronyms(q),
    query_embedding: embedding,
    match_count: count,
    reg_filter: scope.regFilter ? [scope.regFilter] : null,
    jurisdiction_filter: null,
    include_basis: includeBasis,
    keyword_query: keywordQuery(q) || null,
  };
}

export type QuestionRun = {
  /** the hits the eval scored (after list completion), as the page lists them */
  hits: Hit[];
  /** every row the RPC returned (MARGIN_ROWS or rowsNeeded, whichever is larger), in its order */
  raw: Hit[];
  result: EvalResult;
  omittedIds: string[];
  mapKey: string | null;
  margin: Margin;
  /** list completion changed the eval's rows (a question limited to one document): the margin is over retrieval's own order */
  completed: boolean;
};

/** Scores one eval question with a given query embedding. */
export async function runQuestion(supabase: SupabaseClient, e: EvalQuestion, embedding: number[]): Promise<QuestionRun> {
  const scope = askScope(e.q);
  const need = rowsNeeded(e);
  const raw = await hybrid(supabase, askArgs(e.q, embedding, need <= MARGIN_ROWS ? MARGIN_ROWS : need, e.includeBasis ?? false), e.q);
  // A limited search lists a printed list whole, as the page does (list-completion.ts).
  const hits = (await completeListRows(supabase, raw.slice(0, need), scope.within)) as Hit[];
  // Same routing and layout calls the page makes (pure); the map key is
  // looked at by questions that set `map`, the shown order by those that
  // set `premise`, `title` or `shown`.
  const layout = layoutAsk(e.q, hits, undefined, false, scope.within);
  const omittedIds = layout.summary?.omittedIds ?? [];
  const result = evaluateQuestion(e, hits, layout.map?.key ?? null, {
    ids: layout.shownIds,
    noteKey: layout.note?.key ?? null,
    title: layout.summary?.title ?? null,
    omittedIds,
    within: scope.within,
  });
  // The margin reads every returned row; a stated fact leaves rows out by
  // what they are, not where they rank, so the layout of all of them gives
  // the rows to skip below the window too.
  const omittedAll = layoutAsk(e.q, raw, undefined, false, scope.within).summary?.omittedIds ?? [];
  const margin = expectMargin(raw, e.expect, e.topN ?? DEFAULT_TOP_N, expandAcronyms(e.q), omittedAll);
  const completed = hits.map((h) => h.id).join() !== raw.slice(0, need).map((h) => h.id).join();
  return { hits, raw, result, omittedIds, mapKey: layout.map?.key ?? null, margin, completed };
}
