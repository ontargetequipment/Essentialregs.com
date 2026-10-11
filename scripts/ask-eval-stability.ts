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
 * Margin report (--margins, 11 Oct 2026): every eval question once, with its
 * pass, rank and ranking margin -- how far the fused score of every expected
 * row could fall before the question fails (src/lib/ask-margin.ts) -- and a
 * flag (src/lib/ask-margin.ts isThin): a sentence question (score fusion)
 * under MARGIN_FLAG (0.005, about five times the jitter one changed query
 * vector causes); a short question (rank fusion) whose best expected row
 * sits in the last slot of the window. Also the time of each RPC call. The regression guard for ranking
 * changes: run it before and after, compare the column. The PR gate
 * (scripts/ask-eval.ts) prints the same margins with its score.
 *
 * Read-only apart from Voyage query embeddings (a fraction of a cent). Runs in
 * the "Ask eval" workflow (workflow_dispatch inputs `stability`, `margins`).
 *
 *   npx tsx scripts/ask-eval-stability.ts --ask "ECD testing requirements" --runs 10 --top 8
 *   npx tsx scripts/ask-eval-stability.ts --margins
 *   npx tsx scripts/ask-eval-stability.ts --ask "..." --runs 2 --vector   # also print run 1's query vector (JSON)
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expandAcronyms, keywordQuery } from "../src/lib/acronyms";
import { askScope } from "../src/lib/ask-scope";
import { MARGIN_FLAG, formatMargin, isThin } from "../src/lib/ask-margin";
import { completeListRows } from "../src/lib/list-completion";
import { EVAL_QUESTIONS, rowsNeeded } from "../src/lib/semantic-eval";
import { askArgs, embedQuery, env, hybrid, runQuestion, timingLine, type Hit } from "./ask-eval-core";

type Row = Hit;

const sha = (v: number[]) => createHash("sha256").update(Buffer.from(Float64Array.from(v).buffer)).digest("hex").slice(0, 12);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cosine = (a: number[], b: number[]) => dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));
const fmt = (n: number | null | undefined, d = 6) => (n == null ? "–" : n.toFixed(d));

async function margins(supabase: SupabaseClient, voyageKey: string, out: string[]): Promise<void> {
  out.push(`### Ask margin report: ${EVAL_QUESTIONS.length} questions, one run each`, "");
  out.push(
    "Margin, by how the RPC fuses the question. Score fusion (6+ words): how far the fused score of every expected row could fall, the other rows unchanged, before the question fails (negative: the rise it needs to pass), flagged ⚠️ under " +
      `${MARGIN_FLAG}; re-ranked with the RPC's own ORDER BY, "≥" = larger than the gap to the last row read. Rank fusion (5 words or fewer): fused scores only move when ranks swap, so the best expected row's rank is reported, flagged ⚠️ in the last slot of the window.`,
    ""
  );
  out.push("| # | question | fusion | pass | margin | best expected (fused) | row it must stay above (fused) | rpc ms |", "|---|---|---|---|---|---|---|---|");
  const rpcMs: number[] = [];
  const json: { q: string; mode: string; pass: boolean; rank: number | null; margin: number | null; atLeast: boolean; flagged: boolean; rpcMs: number }[] = [];
  let thin = 0;
  let mismatched = 0;
  for (let i = 0; i < EVAL_QUESTIONS.length; i++) {
    const e = EVAL_QUESTIONS[i];
    const r = await runQuestion(supabase, e, await embedQuery(expandAcronyms(e.q), voyageKey));
    const m = r.margin;
    const flagged = isThin(m);
    if (flagged) thin++;
    rpcMs.push(r.rpcMs);
    if (!m.orderMatches) mismatched++;
    const omitted = new Set(r.omittedIds);
    const listed = r.raw.filter((h) => !omitted.has(h.id));
    const isExp = (h: Row) => e.expect.some((p) => h.id.startsWith(p));
    const best = listed.find(isExp);
    const n = e.topN ?? 5;
    // In plain fused order the row to beat is the n-th unexpected row; shown for reading, the margin itself comes from the re-rank.
    const rival = listed.filter((h) => !isExp(h))[n - 1];
    out.push(
      `| ${i + 1} | ${e.q} | ${m.mode} | ${r.result.pass ? "✅" : "❌"} | ${formatMargin(m)}${flagged ? " ⚠️" : ""}${r.completed ? " (list completed)" : ""}${m.orderMatches ? "" : " (order re-rank differs)"} | ${best ? `\`${best.id}\` (${fmt(best.fused)})` : "–"} | ${rival ? `\`${rival.id}\` (${fmt(rival.fused)})` : "–"} | ${r.rpcMs.toFixed(0)} |`
    );
    json.push({ q: e.q, mode: m.mode, pass: r.result.pass, rank: m.rank, margin: m.margin, atLeast: m.atLeast, flagged, rpcMs: Math.round(r.rpcMs) });
  }
  out.push("", `${thin} of ${EVAL_QUESTIONS.length} flagged. match_provisions_hybrid: ${timingLine(rpcMs)}.${mismatched ? ` ${mismatched} question(s) where the re-rank did not reproduce the RPC order (ties on fused and cosine; the RPC's last key is sort_order).` : ""}`, "");
  out.push("<details><summary>raw JSON</summary>", "", "```json", JSON.stringify(json), "```", "</details>");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let q = "ECD testing requirements";
  let runs = 10;
  let top = 8;
  let marginMode = false;
  let printVector = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ask" && argv[i + 1]) q = argv[++i];
    else if (argv[i] === "--runs" && argv[i + 1]) runs = Math.min(Math.max(parseInt(argv[++i], 10) || 10, 2), 30);
    else if (argv[i] === "--top" && argv[i + 1]) top = Math.min(Math.max(parseInt(argv[++i], 10) || 8, 5), 20);
    else if (argv[i] === "--margins") marginMode = true;
    else if (argv[i] === "--vector") printVector = true;
  }
  const voyageKey = env("VOYAGE_API_KEY");
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const out: string[] = [];
  const finish = () => {
    const text = out.join("\n");
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  };
  if (marginMode) {
    await margins(supabase, voyageKey, out);
    return finish();
  }

  const e = EVAL_QUESTIONS.find((x) => x.q === q);
  const expanded = expandAcronyms(q);
  const scope = askScope(q);
  // An eval question is scored exactly as the gate scores it (runQuestion);
  // any other question gets the page's arguments for `top` rows.
  const call = async (embedding: number[]): Promise<{ raw: Row[]; ids: string[]; pass: boolean | null; margin: string; flagged: boolean; ms: number }> => {
    if (e) {
      const r = await runQuestion(supabase, e, embedding);
      return { raw: r.raw, ids: r.hits.map((h) => h.id).concat(r.raw.slice(r.hits.length).map((h) => h.id)), pass: r.result.pass, margin: formatMargin(r.margin), flagged: isThin(r.margin), ms: r.rpcMs };
    }
    const t0 = performance.now();
    const raw = await hybrid(supabase, askArgs(q, embedding, top), q);
    const ms = performance.now() - t0;
    const completed = (await completeListRows(supabase, raw, scope.within)) as Row[];
    return { raw, ids: completed.map((h) => h.id), pass: null, margin: "–", flagged: false, ms };
  };

  out.push(`### Ask stability: "${q}"`, "", `expanded: \`${expanded}\`; keyword query: \`${keywordQuery(q) || ""}\`; rows read ${e ? Math.max(rowsNeeded(e), 20) : top}; scope ${scope.within ?? "none"}; expect ${e ? e.expect.join(", ") : "(not an eval question)"}`, "");
  const expectIds = e?.expect ?? [];
  const mark = (id: string) => (expectIds.some((p) => id.startsWith(p)) ? " **(expected)**" : "");
  const table = (label: string, rows: Row[]) => {
    out.push(`${label}`, "", "| rank | id | cosine | fused | kw |", "|---|---|---|---|---|");
    rows.slice(0, top).forEach((r, i) => out.push(`| ${i + 1} | \`${r.id}\`${mark(r.id)} | ${fmt(r.score)} | ${fmt(r.fused, 8)} | ${r.keyword_hit ? "kw" : ""} |`));
    out.push("");
  };

  // --- A: fresh embedding every run -----------------------------------------
  out.push("#### A. fresh Voyage embedding each run", "");
  const vecs: number[][] = [];
  const topIdsA: string[][] = [];
  const summaryA: string[] = ["| run | vector sha256 | cosine to run 1 | max abs diff | rank 5 | rank 6 | pass | margin | order = run 1 |", "|---|---|---|---|---|---|---|---|---|"];
  const detailA: { run: number; rows: Row[] }[] = [];
  for (let r = 1; r <= runs; r++) {
    const v = await embedQuery(expanded, voyageKey);
    vecs.push(v);
    const res = await call(v);
    const ids = res.ids;
    topIdsA.push(ids.slice(0, top));
    detailA.push({ run: r, rows: res.raw });
    const maxDiff = Math.max(...v.map((x, i) => Math.abs(x - vecs[0][i])));
    summaryA.push(
      `| ${r} | ${sha(v)} | ${r === 1 ? "1" : cosine(v, vecs[0]).toFixed(10)} | ${r === 1 ? "0" : maxDiff.toExponential(2)} | \`${ids[4] ?? "–"}\` | \`${ids[5] ?? "–"}\` | ${res.pass == null ? "–" : res.pass ? "yes" : "NO"} | ${res.margin}${res.flagged ? " ⚠️" : ""} | ${ids.slice(0, top).join() === topIdsA[0].join() ? "yes" : "NO"} |`
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
  const msB: number[] = [];
  let firstB: Row[] = [];
  for (let r = 1; r <= runs; r++) {
    const { raw, ms } = await call(vecs[0]);
    msB.push(ms);
    if (r === 1) firstB = raw;
    keyB.add(raw.slice(0, top).map((x) => `${x.id}@${x.fused}`).join());
  }
  out.push(`distinct top-${top} (id and fused score) across ${runs} RPC calls with the same vector: ${keyB.size}`, "");
  out.push(`match_provisions_hybrid, same vector, wall time from the runner: ${timingLine(msB)}`, "");
  table("run 1 vector, raw RPC rows", firstB);

  // Machine-readable copy for the record.
  out.push("<details><summary>raw JSON</summary>", "", "```json", JSON.stringify({ q, expanded, vecSha: vecs.map(sha), runs: detailA.map((d) => ({ run: d.run, top: d.rows.slice(0, top).map((x) => [x.id, x.score, x.fused]) })) }), "```", "</details>");
  // The query vector itself is not a secret; printed only on request, for
  // replaying a question's ranking in SQL.
  if (printVector) console.log(`VECTOR_RUN1 ${JSON.stringify(vecs[0])}`);
  finish();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
