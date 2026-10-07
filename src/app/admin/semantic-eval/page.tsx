import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQueries, hrefForHit, regLabel, type SemanticHit } from "@/lib/semantic";
import { expandAcronyms, keywordQuery } from "@/lib/acronyms";
import { layoutAsk } from "@/lib/question-maps";
import { DEFAULT_TOP_N, EVAL_QUESTIONS, KNOWN_FAILURES, evaluateQuestion, rowsNeeded } from "@/lib/semantic-eval";

export const metadata = { title: "Ask acceptance test" };
export const dynamic = "force-dynamic";

const TOP_N = DEFAULT_TOP_N;
/** ≥ 85% of the list (17/20 in the original plan). */
const PASS_TARGET = Math.ceil(EVAL_QUESTIONS.length * 0.85);

type Row = {
  q: string;
  note: string;
  expect: string[];
  hits: SemanticHit[];
  pass: boolean;
  matchRank: number | null;
  /** why it failed, one line per condition (empty on a pass) */
  failures: string[];
  /** rows fetched for this question (5, or wider when the question asks) */
  window: number;
  /** the question map the question routes to (src/lib/question-maps.ts), or null */
  mapKey: string | null;
  /** the question is in KNOWN_FAILURES: a miss is expected and does not fail the CI gate */
  known: boolean;
};

/**
 * /admin/semantic-eval — runs the 20 acceptance questions from
 * lib/semantic-eval.ts against the live corpus and shows pass/fail.
 * Admin-only (ADMIN_EMAILS). One Voyage call for all questions (a fraction
 * of a cent) and one match_provisions RPC per question with the service
 * role (allowed by migration 007). Logged as mode='eval'.
 */
export default async function SemanticEvalPage() {
  await requireAdmin();
  const admin = createAdminClient();

  let rows: Row[] = [];
  let fatal: string | null = null;
  try {
    const expanded = EVAL_QUESTIONS.map((e) => expandAcronyms(e.q));
    const embeddings = await embedQueries(expanded);
    rows = await Promise.all(
      EVAL_QUESTIONS.map(async (e, i) => {
        // Same call the Ask tab makes by default (hybrid: full-text + vector,
        // Statements of Basis hidden) unless the question opts in.
        // A question with a wider window (top 10) or a forbid list fetches
        // as many rows as its widest condition needs; the rest fetch TOP_N.
        const window = rowsNeeded(e);
        const { data, error } = await admin.rpc("match_provisions_hybrid", {
          query_text: expanded[i],
          query_embedding: embeddings[i],
          match_count: window,
          reg_filter: null,
          jurisdiction_filter: null,
          include_basis: e.includeBasis ?? false,
          keyword_query: keywordQuery(e.q) || null,
        });
        if (error) throw new Error(`${e.q}: ${error.message}`);
        const hits = (data ?? []) as SemanticHit[];
        // Same pure routing and layout calls the Ask page makes; the map key
        // is checked by questions that set `map`, the shown order by those
        // that set `premise`, `title` or `shown` (review 4, 7 Oct 2026).
        const layout = layoutAsk(e.q, hits);
        const mapKey = layout.map?.key ?? null;
        const result = evaluateQuestion(e, hits, mapKey, { ids: layout.shownIds, noteKey: layout.note?.key ?? null, title: layout.summary?.title ?? null });
        return { q: e.q, note: e.note, expect: e.expect, hits, window, mapKey, known: KNOWN_FAILURES.includes(e.q), ...result };
      })
    );
    await admin.from("search_queries").insert(
      rows.map((r) => ({
        mode: "eval",
        query: r.q,
        result_ids: r.hits.map((h) => h.id),
        top_score: r.hits[0]?.score ?? null,
      }))
    );
  } catch (e) {
    fatal = e instanceof Error ? e.message : String(e);
  }

  const passed = rows.filter((r) => r.pass).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Ask acceptance test</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {EVAL_QUESTIONS.length} real compliance questions; a question passes when an expected provision appears in the
        top {TOP_N} (a few look at the top 10, or also forbid a provision). Target: {PASS_TARGET} of {EVAL_QUESTIONS.length}. Every load re-runs the set (about {(EVAL_QUESTIONS.length * 30 / 1e6 * 0.02 * 100).toFixed(4)}¢).
      </p>

      {fatal && <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">Run failed: {fatal}</p>}

      {!fatal && (
        <p
          className={`mt-6 rounded-md p-4 text-sm font-semibold ${
            passed >= PASS_TARGET ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          {passed} of {rows.length} passed {passed >= PASS_TARGET ? "— acceptance met." : "— below target."}
        </p>
      )}

      <ol className="mt-8 flex flex-col gap-6">
        {rows.map((r, i) => (
          <li key={i} className={`rounded-lg border p-5 ${r.pass ? "border-emerald-200 bg-white" : "border-amber-300 bg-amber-50/40"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-900">
                  {i + 1}. {r.q}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Expect: {r.note} <span className="font-mono">({r.expect.join(", ")})</span>
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${r.pass ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                {r.pass ? `PASS (rank ${r.matchRank})` : r.known ? "MISS (known)" : "MISS"}
              </span>
            </div>
            {r.failures.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-amber-900">
                {r.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {r.window !== TOP_N && (
              <p className="mt-2 text-xs text-zinc-500">Top {r.window} shown: this question&apos;s conditions look past the top {TOP_N}.</p>
            )}
            {(r.mapKey || EVAL_QUESTIONS[i].map !== undefined) && (
              <p className="mt-2 text-xs text-zinc-500">
                Question map: <span className="font-mono">{r.mapKey ?? "none"}</span>
                {EVAL_QUESTIONS[i].map !== undefined && ` (expected ${EVAL_QUESTIONS[i].map ?? "none"})`}
              </p>
            )}
            <ol className="mt-3 flex flex-col gap-1 text-sm">
              {r.hits.map((h, j) => {
                const expected = r.expect.some((p) => h.id.startsWith(p));
                return (
                  <li key={h.id} className={`flex flex-wrap items-baseline gap-2 ${expected ? "text-emerald-900" : "text-zinc-600"}`}>
                    <span className="w-5 text-right tabular-nums text-zinc-400">{j + 1}.</span>
                    <span className="text-xs text-zinc-500">{regLabel(h.reg_key)}</span>
                    <Link href={hrefForHit(h)} className="font-mono text-xs text-emerald-700 hover:underline">
                      {h.citation}
                    </Link>
                    <span className={expected ? "font-medium" : ""}>{h.title !== h.citation ? h.title : ""}</span>
                    {h.is_basis && <span className="rounded bg-zinc-100 px-1.5 text-[10px] uppercase text-zinc-500">basis</span>}
                    {h.keyword_hit && <span className="rounded bg-amber-50 px-1.5 text-[10px] uppercase text-amber-700">kw</span>}
                    <span className="ml-auto text-xs tabular-nums text-zinc-400">{h.score == null ? "—" : `${Math.round(h.score * 100)}%`}</span>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
