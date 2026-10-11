/**
 * Ask acceptance report from outside the app: the same questions and
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
import { createClient } from "@supabase/supabase-js";
import { expandAcronyms, keywordQuery } from "../src/lib/acronyms";
import { layoutAsk } from "../src/lib/question-maps";
import { askScope } from "../src/lib/ask-scope";
import { MARGIN_FLAG, formatMargin, isThin } from "../src/lib/ask-margin";
import { completeListRows } from "../src/lib/list-completion";
import { EVAL_QUESTIONS, KNOWN_FAILURES } from "../src/lib/semantic-eval";
import { embedQuery, env, hybrid, runQuestion, timingLine, type Hit } from "./ask-eval-core";

const DEFAULT_ASK = [
  "When is a GP01 required?",
  "What regulations apply to a natural gas-fired engine?",
  "What Colorado and federal requirements could apply to storage vessels?",
  "Do I need a GP12?",
  "What applies to a diesel engine?",
  "What rules apply to a produced water storage tank at a well site?",
];
/** Ids to flag by name when they appear in an Ask top 10 (the engine question). */
const WATCH = ["sec-jjjj-60.4230", "sec-zzzz-63.6585"];

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
  for (let i = 0; i < askQuestions.length; i++) {
    const askWithin = askScope(askQuestions[i]);
    const found = await hybrid(supabase, {
      query_text: askExpanded[i],
      query_embedding: await embedQuery(askExpanded[i], voyageKey),
      match_count: askCount,
      reg_filter: askWithin.regFilter ? [askWithin.regFilter] : null,
      jurisdiction_filter: null,
      include_basis: false,
      keyword_query: keywordQuery(askQuestions[i]) || null,
    }, askQuestions[i]);
    const hits = (await completeListRows(supabase, found, askWithin.within)) as Hit[];
    out.push(`**${askQuestions[i]}**`, "");
    hits.forEach((h, j) => out.push(line(h, j)));
    const seen = WATCH.filter((w) => hits.some((h) => h.id === w || h.id.startsWith(`${w}-`)));
    out.push("", `watched: ${seen.length ? seen.join(", ") : `none of ${WATCH.join(", ")}`}`);
    // The page's routing is pure, so the same call tells us which map the
    // Ask tab would lay these hits out under, with the premise note, the
    // stated facets and what they left out (review 4, 7 Oct 2026).
    const layout = layoutAsk(askQuestions[i], hits, undefined, false, askWithin.within);
    const map = layout.map;
    out.push(`question map: ${map ? `${map.key} (${map.name})` : "none"}`);
    if (layout.summary) {
      out.push(`shown as: ${layout.summary.title}${layout.note ? `; premise note: ${layout.note.key}` : ""}${layout.summary.stated.length ? `; stated: ${layout.summary.stated.join(", ")}` : ""}`);
      for (const o of layout.summary.omitted) out.push(`not shown because you said ${o.said}: ${o.omitted} (${layout.summary.omittedIds.join(", ") || "none among the hits"})`);
      out.push(`first shown: ${layout.shownIds.slice(0, 5).join(", ")}`);
    }
    out.push("");
  }

  // --- Eval ---------------------------------------------------------------
  // Each question as the page asks it (scripts/ask-eval-core.ts), plus its
  // ranking margin (src/lib/ask-margin.ts).
  const rows: { q: string; pass: boolean; known: boolean; matchRank: number | null; failures: string[]; ids: string[]; omittedIds: string[]; top: number | null; margin: string; thin: boolean }[] = [];
  const rpcMs: number[] = [];
  for (const e of EVAL_QUESTIONS) {
    const r = await runQuestion(supabase, e, await embedQuery(expandAcronyms(e.q), voyageKey));
    const m = r.margin;
    rpcMs.push(r.rpcMs);
    rows.push({
      q: e.q,
      pass: r.result.pass,
      known: KNOWN_FAILURES.includes(e.q),
      matchRank: r.result.matchRank,
      failures: r.result.failures,
      ids: r.hits.map((h) => h.id),
      omittedIds: r.omittedIds,
      top: r.hits[0]?.score ?? null,
      margin: formatMargin(m) + (r.completed ? " (list completed)" : ""),
      thin: isThin(m),
    });
  }
  const passed = rows.filter((r) => r.pass).length;
  const mapChecked = EVAL_QUESTIONS.filter((e) => e.map !== undefined).length;
  out.push(`### Ask acceptance test: ${passed} of ${rows.length} passed`, "");
  out.push("| # | question | pass | rank | margin | map |", "|---|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const e = EVAL_QUESTIONS[i];
    const mapCell = e.map === undefined ? "" : `${e.map === null ? "none" : e.map} ${r.failures.some((f) => f.startsWith("routed to")) ? "❌" : "✅"}`;
    out.push(`| ${i + 1} | ${r.q} | ${r.pass ? "✅" : r.known ? "❌ (known)" : "❌"} | ${r.matchRank ?? "–"} | ${r.margin}${r.thin ? " ⚠️" : ""} | ${mapCell} |`);
  });
  const failed = rows.filter((r) => !r.pass);
  if (failed.length) {
    out.push("", "Failed:");
    for (const r of failed) {
      const left = new Set(r.omittedIds);
      const scored = r.ids.filter((id) => !left.has(id));
      out.push(
        `- **${r.q}**${r.known ? " (known failure)" : ""} — ${r.failures.join("; ")}; top: ${scored.slice(0, 5).join(", ")}` +
          (left.size ? ` (left out by the stated fact: ${r.omittedIds.join(", ")})` : "")
      );
    }
  }
  const thin = rows.filter((r) => r.thin);
  out.push(
    "",
    `Margin (src/lib/ask-margin.ts): sentence questions (score fusion), how far the fused score of every expected row could fall before the question fails, flagged under ${MARGIN_FLAG}; short questions (rank fusion), the best expected row's rank, flagged in the last slot of the window. ${thin.length ? `${thin.length} flagged (⚠️): ${thin.map((r) => r.q).join(" | ")}` : "none flagged"}.`,
    "",
    `match_provisions_hybrid, one call per question: ${timingLine(rpcMs)}.`
  );
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
