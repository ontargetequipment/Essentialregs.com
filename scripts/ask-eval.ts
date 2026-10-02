/**
 * Ask acceptance report from outside the app: the same 28 questions and
 * pass rules as /admin/semantic-eval (src/lib/semantic-eval.ts), the same
 * acronym expansion and keyword query (src/lib/acronyms.ts), the same
 * question-map routing (src/lib/question-maps.ts, pure), the same
 * match_provisions_hybrid RPC with the same arguments, run with the service
 * role -- plus the top 10 for a few fixed questions, the way the Ask tab
 * asks (count=10, Statements of Basis hidden).
 *
 * Why it exists: the eval page needs an admin's browser session and the
 * previews sit behind Vercel auth, so a re-summarize or re-embed could not
 * be scored from CI. This runs in the "Ask eval" workflow (every pull
 * request to main, and by hand) with VOYAGE_API_KEY / SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY and writes the report to stdout and, when set,
 * $GITHUB_STEP_SUMMARY. Read-only apart from the search_queries log rows
 * (mode='eval'), exactly like a page load.
 *
 * Exit status (Ask Track B, 1 Oct 2026): non-zero when any question outside
 * KNOWN_FAILURES fails, so the workflow is a regression gate; the score is
 * printed either way.
 *
 *   npx tsx scripts/ask-eval.ts
 *   npx tsx scripts/ask-eval.ts --ask "When is a GP01 required?" --ask "..." --count 25
 */
import { appendFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expandAcronyms, keywordQuery } from "../src/lib/acronyms";
import { matchQuestionMap } from "../src/lib/question-maps";
import { EVAL_QUESTIONS, KNOWN_FAILURES, evaluateQuestion, rowsNeeded, type EvalHit } from "../src/lib/semantic-eval";

// Mirrors EMBED_MODEL / EMBED_DIMS in src/lib/semantic.ts, which cannot be
// imported here (it pulls in the Next.js server client).
const EMBED_MODEL = "voyage-3.5-lite";
const EMBED_DIMS = 1024;

const DEFAULT_ASK = [
  "When is a GP01 required?",
  "What regulations apply to a natural gas-fired engine?",
  "What Colorado and federal requirements could apply to storage vessels?",
];
/** Ids to flag by name when they appear in an Ask top 10 (the engine question). */
const WATCH = ["sec-jjjj-60.4230", "sec-zzzz-63.6585"];

type Hit = EvalHit & { citation: string; title: string; reg_key: string | null; score: number | null; keyword_hit?: boolean };

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function embedQueries(texts: string[], key: string): Promise<number[][]> {
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

/**
 * One hybrid search, retried on a Postgres statement timeout (the embedder
 * and the neighbour rebuild can hold the database busy for minutes; a
 * timed-out probe says nothing about the ranking).
 */
async function hybrid(supabase: SupabaseClient, args: Record<string, unknown>, label: string): Promise<Hit[]> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc("match_provisions_hybrid", args);
    if (!error) return (data ?? []) as Hit[];
    if (!/statement timeout/i.test(error.message) || attempt >= 4) throw new Error(`${label}: ${error.message}`);
    console.error(`${label}: statement timeout (attempt ${attempt}), retrying...`);
    await new Promise((r) => setTimeout(r, 5_000 * attempt));
  }
}

function line(h: Hit, i: number): string {
  const score = h.score == null ? "kw" : h.score.toFixed(3);
  return `${i + 1}. \`${h.id}\` [${h.jurisdiction_level ?? "?"}] ${h.citation}${h.title && h.title !== h.citation ? ` — ${h.title}` : ""} (${score}${h.keyword_hit ? ", kw" : ""})`;
}

async function main(): Promise<void> {
  const askArgs: string[] = [];
  let askCount = 10;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ask" && argv[i + 1]) askArgs.push(argv[++i]);
    else if (argv[i] === "--count" && argv[i + 1]) askCount = Math.min(Math.max(parseInt(argv[++i], 10) || 10, 1), 50);
  }
  const askQuestions = askArgs.length ? askArgs : DEFAULT_ASK;

  const voyageKey = env("VOYAGE_API_KEY");
  const supabase = createClient(env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const out: string[] = [];

  // --- Ask top 10 -------------------------------------------------------
  out.push(`### Ask top ${askCount} (hybrid, Statements of Basis hidden)`, "");
  const askExpanded = askQuestions.map(expandAcronyms);
  const askEmbeddings = await embedQueries(askExpanded, voyageKey);
  for (let i = 0; i < askQuestions.length; i++) {
    const hits = await hybrid(supabase, {
      query_text: askExpanded[i],
      query_embedding: askEmbeddings[i],
      match_count: askCount,
      reg_filter: null,
      jurisdiction_filter: null,
      include_basis: false,
      keyword_query: keywordQuery(askQuestions[i]) || null,
    }, askQuestions[i]);
    out.push(`**${askQuestions[i]}**`, "");
    hits.forEach((h, j) => out.push(line(h, j)));
    const seen = WATCH.filter((w) => hits.some((h) => h.id === w || h.id.startsWith(`${w}-`)));
    out.push("", `watched: ${seen.length ? seen.join(", ") : `none of ${WATCH.join(", ")}`}`);
    // The page's routing is pure, so the same call tells us which map the
    // Ask tab would lay these hits out under.
    const map = matchQuestionMap(askQuestions[i]);
    out.push(`question map: ${map ? `${map.key} (${map.name})` : "none"}`, "");
  }

  // --- Eval ---------------------------------------------------------------
  const expanded = EVAL_QUESTIONS.map((e) => expandAcronyms(e.q));
  const embeddings = await embedQueries(expanded, voyageKey);
  const rows: { q: string; pass: boolean; known: boolean; matchRank: number | null; failures: string[]; ids: string[]; top: number | null }[] = [];
  for (let i = 0; i < EVAL_QUESTIONS.length; i++) {
    const e = EVAL_QUESTIONS[i];
    const hits = await hybrid(supabase, {
      query_text: expanded[i],
      query_embedding: embeddings[i],
      match_count: rowsNeeded(e),
      reg_filter: null,
      jurisdiction_filter: null,
      include_basis: e.includeBasis ?? false,
      keyword_query: keywordQuery(e.q) || null,
    }, e.q);
    // Same routing call the page makes (pure); only looked at by questions that set `map`.
    const r = evaluateQuestion(e, hits, matchQuestionMap(e.q)?.key ?? null);
    rows.push({ q: e.q, pass: r.pass, known: KNOWN_FAILURES.includes(e.q), matchRank: r.matchRank, failures: r.failures, ids: hits.map((h) => h.id), top: hits[0]?.score ?? null });
  }
  const passed = rows.filter((r) => r.pass).length;
  const mapChecked = EVAL_QUESTIONS.filter((e) => e.map !== undefined).length;
  out.push(`### Ask acceptance test: ${passed} of ${rows.length} passed`, "");
  out.push("| # | question | pass | rank | map |", "|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const e = EVAL_QUESTIONS[i];
    const mapCell = e.map === undefined ? "" : `${e.map === null ? "none" : e.map} ${r.failures.some((f) => f.startsWith("routed to")) ? "❌" : "✅"}`;
    out.push(`| ${i + 1} | ${r.q} | ${r.pass ? "✅" : r.known ? "❌ (known)" : "❌"} | ${r.matchRank ?? "–"} | ${mapCell} |`);
  });
  const failed = rows.filter((r) => !r.pass);
  if (failed.length) {
    out.push("", "Failed:");
    for (const r of failed) out.push(`- **${r.q}**${r.known ? " (known failure)" : ""} — ${r.failures.join("; ")}; top: ${r.ids.slice(0, 5).join(", ")}`);
  }
  const unexpected = failed.filter((r) => !r.known);
  out.push(
    "",
    `${mapChecked} question-map checks; ${unexpected.length} unexpected ${unexpected.length === 1 ? "failure" : "failures"} (known failures: ${KNOWN_FAILURES.length}).`
  );

  // Same log rows the page writes (mode='eval'); best effort.
  const { error: logErr } = await supabase
    .from("search_queries")
    .insert(rows.map((r) => ({ mode: "eval", query: r.q, result_ids: r.ids, top_score: r.top })));
  if (logErr) out.push("", `(search_queries log insert failed: ${logErr.message})`);

  const text = out.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  if (unexpected.length > 0) {
    console.error(`ask-eval: ${unexpected.length} question(s) outside KNOWN_FAILURES failed: ${unexpected.map((r) => r.q).join(" | ")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
