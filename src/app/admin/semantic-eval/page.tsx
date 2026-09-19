import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQueries, hrefForHit, regLabel, type SemanticHit } from "@/lib/semantic";
import { EVAL_QUESTIONS } from "@/lib/semantic-eval";

export const metadata = { title: "Ask acceptance test" };
export const dynamic = "force-dynamic";

const TOP_N = 5;
const PASS_TARGET = 17;

type Row = {
  q: string;
  note: string;
  expect: string[];
  hits: SemanticHit[];
  pass: boolean;
  matchRank: number | null;
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
    const embeddings = await embedQueries(EVAL_QUESTIONS.map((e) => e.q));
    rows = await Promise.all(
      EVAL_QUESTIONS.map(async (e, i) => {
        const { data, error } = await admin.rpc("match_provisions", {
          query_embedding: embeddings[i],
          match_count: TOP_N,
          reg_filter: null,
          jurisdiction_filter: null,
        });
        if (error) throw new Error(`${e.q}: ${error.message}`);
        const hits = (data ?? []) as SemanticHit[];
        const idx = hits.findIndex((h) => e.expect.some((p) => h.id.startsWith(p)));
        return { q: e.q, note: e.note, expect: e.expect, hits, pass: idx >= 0, matchRank: idx >= 0 ? idx + 1 : null };
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
        top {TOP_N}. Target: {PASS_TARGET} of {EVAL_QUESTIONS.length}. Every load re-runs the set (about {(EVAL_QUESTIONS.length * 30 / 1e6 * 0.02 * 100).toFixed(4)}¢).
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
                {r.pass ? `PASS (rank ${r.matchRank})` : "MISS"}
              </span>
            </div>
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
                    <span className="ml-auto text-xs tabular-nums text-zinc-400">{Math.round(h.score * 100)}%</span>
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
