/**
 * Keyword-search acceptance report (the reviewer's seven rows, 6 Oct 2026, plus
 * the "OOOO" row of 8 Oct 2026):
 * the same search_provisions() RPC the /search page calls, run with the
 * service role -- which has_full_access() and provision_path() treat as an
 * entitled subscriber, so the pool-stage multipliers (Definitions,
 * applicability, closed permits) apply exactly as they do for a paying
 * reader -- with Statements of Basis hidden, the page default. Prints the
 * top 5 of every row and the verdict, and exits non-zero when a row outside
 * KEYWORD_KNOWN_FAILURES fails, so the "Keyword eval" workflow is a pull
 * request gate like the Ask eval (scripts/ask-eval.ts). Read-only.
 *
 *   npx tsx scripts/keyword-eval.ts
 *   npx tsx scripts/keyword-eval.ts --q "pneumatic controller" --q "surface coating"   # extra rows, printed only
 */
import { appendFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { KEYWORD_KNOWN_FAILURES, KEYWORD_ROWS, evaluateKeywordRow, keywordRowsNeeded, type KeywordHit } from "../src/lib/keyword-eval";

type Hit = KeywordHit & { citation: string; title: string; reg_key: string | null; rank: number };

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function search(supabase: SupabaseClient, q: string, lim: number): Promise<Hit[]> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc("search_provisions", { q, lim, include_basis: false });
    if (!error) return (data ?? []) as Hit[];
    if (!/statement timeout/i.test(error.message) || attempt >= 4) throw new Error(`${q}: ${error.message}`);
    console.error(`${q}: statement timeout (attempt ${attempt}), retrying...`);
    await new Promise((r) => setTimeout(r, 5_000 * attempt));
  }
}

function line(h: Hit, i: number): string {
  const title = h.title && h.title !== h.citation ? ` — ${h.title}` : "";
  return `${i + 1}. \`${h.id}\` ${h.citation}${title} (${h.rank.toFixed(4)})`;
}

async function main(): Promise<void> {
  const extra: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--q" && argv[i + 1]) extra.push(argv[++i]);

  const supabase = createClient(env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const out: string[] = [];
  const results: { q: string; pass: boolean; known: boolean; failures: string[] }[] = [];
  out.push("### Keyword acceptance rows (search_provisions, Statements of Basis hidden)", "");
  for (const row of KEYWORD_ROWS) {
    const hits = await search(supabase, row.q, Math.max(10, keywordRowsNeeded(row)));
    const r = evaluateKeywordRow(row, hits);
    const known = row.q in KEYWORD_KNOWN_FAILURES;
    results.push({ q: row.q, pass: r.pass, known, failures: r.failures });
    out.push(`**${row.q}** — ${row.condition}: ${r.pass ? "✅ pass" : known ? "❌ fail (known)" : "❌ fail"}`, "");
    hits.slice(0, 5).forEach((h, i) => out.push(line(h, i)));
    if (!r.pass) out.push("", ...r.failures.map((f) => `- ${f}`));
    if (!r.pass && known) out.push(`- known failure: ${KEYWORD_KNOWN_FAILURES[row.q]}`);
    out.push("");
  }
  for (const q of extra) {
    const hits = await search(supabase, q, 10);
    out.push(`**${q}** (printed only)`, "");
    hits.slice(0, 10).forEach((h, i) => out.push(line(h, i)));
    out.push("");
  }
  const passed = results.filter((r) => r.pass).length;
  const unexpected = results.filter((r) => !r.pass && !r.known);
  out.push(
    `### Keyword eval: ${passed} of ${results.length} rows passed; ${unexpected.length} unexpected ${unexpected.length === 1 ? "failure" : "failures"} (known failures: ${Object.keys(KEYWORD_KNOWN_FAILURES).length})`
  );

  const text = out.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  if (unexpected.length > 0) {
    console.error(`keyword-eval: ${unexpected.length} row(s) outside KEYWORD_KNOWN_FAILURES failed: ${unexpected.map((r) => r.q).join(" | ")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
