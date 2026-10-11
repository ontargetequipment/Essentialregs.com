/**
 * Is one Ask eval question stable from call to call? Repeats the question the
 * way scripts/ask-eval.ts scores it (same acronym expansion, scope, keyword
 * query, row count, RPC arguments) and separates the two ways a near-tie at
 * the cutoff can flip:
 *
 *   A. fresh embedding each run -- the query vector as the app gets it from
 *      Voyage, one call per run. Reports whether the vectors are bit-identical
 *      (sha256), the cosine to run 1 and the largest per-component difference,
 *      then the top rows with cosine (`score`) and fused score (`fused`).
 *   B. one embedding held fixed (run 1's), the RPC called again each time --
 *      any change here is the RPC (or the HNSW index), not the embedder.
 *
 * Read-only apart from Voyage query embeddings (a fraction of a cent). Runs in
 * the "Ask eval" workflow (workflow_dispatch input `stability`).
 *
 *   npx tsx scripts/ask-eval-stability.ts --ask "ECD testing requirements" --runs 10 --top 8
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expandAcronyms, keywordQuery } from "../src/lib/acronyms";
import { askScope } from "../src/lib/ask-scope";
import { completeListRows } from "../src/lib/list-completion";
import { EVAL_QUESTIONS, rowsNeeded } from "../src/lib/semantic-eval";

// Mirrors EMBED_MODEL / EMBED_DIMS in src/lib/semantic.ts (see ask-eval.ts).
const EMBED_MODEL = "voyage-3.5-lite";
const EMBED_DIMS = 1024;

type Row = { id: string; score: number | null; fused: number | null; keyword_hit?: boolean };

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function embedQuery(text: string, key: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text], model: EMBED_MODEL, input_type: "query", output_dimension: EMBED_DIMS, truncation: true }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data: { embedding: number[] }[] }).data[0].embedding;
}

async function hybrid(supabase: SupabaseClient, args: Record<string, unknown>): Promise<Row[]> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc("match_provisions_hybrid", args);
    if (!error) return (data ?? []) as Row[];
    if (!/statement timeout/i.test(error.message) || attempt >= 4) throw new Error(error.message);
    await new Promise((r) => setTimeout(r, 5_000 * attempt));
  }
}

const sha = (v: number[]) => createHash("sha256").update(Buffer.from(Float64Array.from(v).buffer)).digest("hex").slice(0, 12);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cosine = (a: number[], b: number[]) => dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));
const fmt = (n: number | null | undefined, d = 6) => (n == null ? "–" : n.toFixed(d));

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let q = "ECD testing requirements";
  let runs = 10;
  let top = 8;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ask" && argv[i + 1]) q = argv[++i];
    else if (argv[i] === "--runs" && argv[i + 1]) runs = Math.min(Math.max(parseInt(argv[++i], 10) || 10, 2), 30);
    else if (argv[i] === "--top" && argv[i + 1]) top = Math.min(Math.max(parseInt(argv[++i], 10) || 8, 5), 20);
  }
  const e = EVAL_QUESTIONS.find((x) => x.q === q);
  const matchCount = Math.max(e ? rowsNeeded(e) : 5, top);
  const expanded = expandAcronyms(q);
  const scope = askScope(q);
  const voyageKey = env("VOYAGE_API_KEY");
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const call = async (embedding: number[]) => {
    const found = await hybrid(supabase, {
      query_text: expanded,
      query_embedding: embedding,
      match_count: matchCount,
      reg_filter: scope.regFilter ? [scope.regFilter] : null,
      jurisdiction_filter: null,
      include_basis: e?.includeBasis ?? false,
      keyword_query: keywordQuery(q) || null,
    });
    return { raw: found, completed: (await completeListRows(supabase, found as never, scope.within)) as Row[] };
  };

  const out: string[] = [`### Ask stability: "${q}"`, "", `expanded: \`${expanded}\`; keyword query: \`${keywordQuery(q) || ""}\`; match_count ${matchCount}; scope ${scope.within ?? "none"}; expect ${e ? e.expect.join(", ") : "(not an eval question)"}`, ""];
  const expectIds = e?.expect ?? [];
  const mark = (id: string) => (expectIds.some((p) => id.startsWith(p)) ? " **(expected)**" : "");
  const table = (label: string, rows: Row[]) => {
    out.push(`${label}`, "", "| rank | id | cosine | fused |", "|---|---|---|---|");
    rows.slice(0, top).forEach((r, i) => out.push(`| ${i + 1} | \`${r.id}\`${mark(r.id)} | ${fmt(r.score)} | ${fmt(r.fused, 8)} |`));
    out.push("");
  };

  // --- A: fresh embedding every run -----------------------------------------
  out.push("#### A. fresh Voyage embedding each run", "");
  const vecs: number[][] = [];
  const topIdsA: string[][] = [];
  const summaryA: string[] = ["| run | vector sha256 | cosine to run 1 | max abs diff | rank 5 | rank 6 | pass (expected in top 5) | order = run 1 |", "|---|---|---|---|---|---|---|---|"];
  const detailA: { run: number; rows: Row[] }[] = [];
  for (let r = 1; r <= runs; r++) {
    const v = await embedQuery(expanded, voyageKey);
    vecs.push(v);
    const { raw, completed } = await call(v);
    const ids = completed.map((x) => x.id);
    topIdsA.push(ids.slice(0, top));
    detailA.push({ run: r, rows: raw });
    const maxDiff = Math.max(...v.map((x, i) => Math.abs(x - vecs[0][i])));
    const pass = ids.slice(0, 5).some((id) => expectIds.some((p) => id.startsWith(p)));
    summaryA.push(
      `| ${r} | ${sha(v)} | ${r === 1 ? "1" : cosine(v, vecs[0]).toFixed(10)} | ${r === 1 ? "0" : maxDiff.toExponential(2)} | \`${ids[4] ?? "–"}\` | \`${ids[5] ?? "–"}\` | ${pass ? "yes" : "NO"} | ${ids.slice(0, top).join() === topIdsA[0].join() ? "yes" : "NO"} |`
    );
  }
  out.push(...summaryA, "");
  const distinctVectors = new Set(vecs.map(sha)).size;
  const distinctOrders = new Set(topIdsA.map((x) => x.join())).size;
  out.push(`distinct query vectors: ${distinctVectors} of ${runs}; distinct top-${top} orders: ${distinctOrders} of ${runs}`, "");
  const seenOrders = new Map<string, number>();
  detailA.forEach((d) => {
    const key = d.rows.slice(0, top).map((x) => x.id).join();
    if (!seenOrders.has(key)) {
      seenOrders.set(key, d.run);
      table(`run ${d.run} (first run with this top-${top} order), raw RPC rows`, d.rows);
    }
  });

  // --- B: one embedding held fixed -----------------------------------------
  out.push("#### B. embedding held fixed (run 1's), RPC called again", "");
  const keyB = new Set<string>();
  let firstB: Row[] = [];
  for (let r = 1; r <= runs; r++) {
    const { raw } = await call(vecs[0]);
    if (r === 1) firstB = raw;
    keyB.add(raw.slice(0, top).map((x) => `${x.id}@${x.fused}`).join());
  }
  out.push(`distinct top-${top} (id and fused score) across ${runs} RPC calls with the same vector: ${keyB.size}`, "");
  table("run 1 vector, raw RPC rows", firstB);

  // Machine-readable copy for the record.
  out.push("<details><summary>raw JSON</summary>", "", "```json", JSON.stringify({ q, expanded, vecSha: vecs.map(sha), runs: detailA.map((d) => ({ run: d.run, top: d.rows.slice(0, top).map((x) => [x.id, x.score, x.fused]) })) }), "```", "</details>");

  const text = out.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
