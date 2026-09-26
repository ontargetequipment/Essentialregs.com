import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessStatus } from "@/lib/access";
import {
  fetchRegulationList,
  normalizeCitationLabel,
  regKeyOf,
  regulationDisplayName,
  summaryParagraphs,
  titleWithoutCitation,
} from "@/lib/regulation";
import {
  MAX_QUERY_LENGTH,
  sanitizeHeadline,
  searchProvisions,
  type SearchHit,
} from "@/lib/search";
import {
  MAX_ASK_LENGTH,
  SemanticError,
  hrefForHit,
  jurisdictionOfKey,
  regBadge,
  semanticSearch,
  type Jurisdiction,
  type SemanticHit,
} from "@/lib/semantic";

export const metadata = {
  title: "Search",
};

type Mode = "keyword" | "ask";

/** Where a keyword hit links: the reader (scroll + flash on the hash) when the id belongs to a regulation, else the standalone card. */
function hrefFor(hit: SearchHit): string {
  return hit.reg_key ? `/regulations/${hit.reg_key}#${hit.id}` : `/regs/${hit.id}`;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * A good Ask hit scores ~0.6–0.9 cosine similarity. When the best result is
 * below this and nothing matched the visitor's words, the corpus probably
 * doesn't talk about the thing they asked about (e.g. a permit number).
 */
const WEAK_SCORE = 0.5;
function isWeakMatch(hits: SemanticHit[]): boolean {
  if (hits.some((h) => h.keyword_hit)) return false;
  const best = Math.max(...hits.map((h) => h.score ?? 0));
  return best < WEAK_SCORE;
}

/** Leading separators dropped after a citation or title is cut off the front of a string; same set as titleWithoutCitation. */
const LEADING_SEPARATORS = /^[\s.:;,—–-]+/;

/**
 * Plain text of a sanitized headline: only <mark> tags survive
 * sanitizeHeadline, so removing those is enough.
 */
function headlineText(html: string): string {
  return normalizeCitationLabel(html.replace(/<\/?mark>/g, ""));
}

/**
 * Cuts the first `label` (already normalized) off the front of the headline
 * HTML, walking past <mark> tags so the highlighting on whatever remains is
 * kept. A <mark> that was open at the cut is re-opened, so the remainder
 * never starts with a stray closing tag. Returns "" if nothing is left.
 */
function stripLeadingLabel(html: string, label: string): string {
  let plain = "";
  let inMark = false;
  let i = 0;
  let matched = false;
  while (i < html.length) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) break;
      inMark = html[i + 1] !== "/";
      i = end + 1;
      continue;
    }
    plain += html[i];
    i += 1;
    if (normalizeCitationLabel(plain) === label) {
      matched = true;
      break;
    }
  }
  if (!matched) return html;
  let rest = html.slice(i);
  if (inMark && rest.startsWith("</mark>")) {
    rest = rest.slice("</mark>".length);
    inMark = false;
  }
  rest = rest.replace(LEADING_SEPARATORS, "");
  if (inMark) rest = `<mark>${rest}`;
  return headlineText(rest) ? rest : "";
}

/**
 * ts_headline's one fragment for a row whose text is nothing but its heading
 * is that heading, so the card printed the title line and then the same words
 * again as the snippet. This drops a leading title (the stored title, or the
 * heading as displayed) from the sanitized headline HTML. Returns "" when the
 * snippet was only the title; the caller then skips the <p> entirely.
 *
 * Same test and digit guard as titleWithoutCitation: the label must match at
 * the very start of the plain text and not be followed by a digit.
 */
function snippetWithoutTitle(html: string, labels: string[]): string {
  const text = headlineText(html);
  for (const raw of labels) {
    const label = normalizeCitationLabel(raw);
    if (!label) continue;
    if (text === label) return "";
    if (!text.startsWith(label)) continue;
    // Titles must end at a word boundary (unlike titleWithoutCitation's digit-only guard for citations).
    if (/[A-Za-z0-9]/.test(text.charAt(label.length))) continue;
    return stripLeadingLabel(html, label);
  }
  return html;
}

export default async function SearchPage(props: PageProps<"/search">) {
  const params = await props.searchParams;
  const mode: Mode = first(params.mode) === "ask" ? "ask" : "keyword";
  const rawQ = first(params.q).trim();
  const q = rawQ.slice(0, mode === "ask" ? MAX_ASK_LENGTH : MAX_QUERY_LENGTH);
  const jParam = first(params.j);
  const jurisdiction: Jurisdiction | null = jParam === "state" || jParam === "federal" ? jParam : null;
  const regParam = first(params.reg).toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The root rows: the Ask filter's options, and the regulation name on
  // every hit. Cheap enough to always fetch. RLS-bound, so an anonymous
  // visitor gets none; regulationDisplayName then derives the same names
  // from the key alone (a user never sees a raw reg_key).
  const [access, regs] = await Promise.all([getAccessStatus(), fetchRegulationList()]);
  const rootByKey = new Map<string, (typeof regs)[number]>();
  for (const r of regs) {
    const key = regKeyOf(r.id)?.toLowerCase();
    if (key) rootByKey.set(key, r);
  }
  const nameOf = (regKey: string | null) =>
    regKey ? regulationDisplayName(regKey, rootByKey.get(regKey.toLowerCase())) : "";
  const regOptions = Array.from(rootByKey, ([key, r]) => ({
    key,
    label: nameOf(key),
    jurisdiction: r.jurisdiction_level,
  })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const regFilter = regOptions.some((r) => r.key === regParam) ? regParam : "";

  let hits: SearchHit[] = [];
  let askHits: SemanticHit[] = [];
  let searchError: string | null = null;
  let askError: { code: SemanticError["code"]; message: string } | null = null;

  if (q && mode === "keyword") {
    try {
      hits = await searchProvisions(q);
    } catch (e) {
      // Most likely cause: supabase/migrations/003_search.sql hasn't been
      // applied yet, so the RPC doesn't exist. Surface it rather than 500.
      searchError = e instanceof Error ? e.message : String(e);
    }
  }
  if (q && mode === "ask" && access.hasAccess) {
    try {
      askHits = await semanticSearch(q, {
        regFilter: regFilter ? [regFilter] : null,
        jurisdiction,
      });
    } catch (e) {
      askError =
        e instanceof SemanticError
          ? { code: e.code, message: e.message }
          : { code: "db", message: e instanceof Error ? e.message : String(e) };
      if (askError.code !== "rate_limited") console.error("ask:", askError.message);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Search</h1>

      <div className="mt-4 inline-flex gap-1 rounded-lg border border-zinc-200 bg-white p-1" role="tablist">
        <Link href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"} className={tabClass(mode === "keyword")} role="tab" aria-selected={mode === "keyword"}>
          Keyword
        </Link>
        <Link href={q ? `/search?mode=ask&q=${encodeURIComponent(q)}` : "/search?mode=ask"} className={tabClass(mode === "ask")} role="tab" aria-selected={mode === "ask"}>
          Ask
        </Link>
      </div>

      {mode === "keyword" ? (
        <p className="mt-3 text-sm text-zinc-600">
          Full-text search across every regulation in the corpus. Use quotes for
          an exact phrase, a leading <code className="font-mono">-</code> to
          exclude a word, and <code className="font-mono">or</code> between
          alternatives.
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">
          Describe the situation in your own words — a tank, a piece of equipment, a
          deadline, a question you&apos;d ask a coworker. Ask finds the provisions that
          are <em>about</em> that, across Colorado, ECMC and federal rules, even when
          they don&apos;t use the same words. It returns real provisions only; it never
          writes an answer.
        </p>
      )}

      <form action="/search" method="get" role="search" className="mt-6 flex flex-col gap-3">
        {mode === "ask" && <input type="hidden" name="mode" value="ask" />}
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={mode === "ask" ? MAX_ASK_LENGTH : MAX_QUERY_LENGTH}
            placeholder={
              mode === "ask"
                ? "e.g. do I need to report a tank that only vents during truck loading?"
                : "e.g. fugitive emissions, storage tank, 604"
            }
            aria-label={mode === "ask" ? "Ask a question about the regulations" : "Search regulations"}
            autoComplete="off"
            autoFocus={!q}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {mode === "ask" ? "Ask" : "Search"}
          </button>
        </div>

        {mode === "ask" && access.hasAccess && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
            <span className="inline-flex gap-1 rounded-md border border-zinc-200 bg-white p-0.5">
              {(
                [
                  ["", "All"],
                  ["state", "Colorado"],
                  ["federal", "Federal"],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className={`cursor-pointer rounded px-2.5 py-1 has-[:checked]:bg-zinc-900 has-[:checked]:text-white`}
                >
                  <input type="radio" name="j" value={val} defaultChecked={(jurisdiction ?? "") === val} className="sr-only" />
                  {label}
                </label>
              ))}
            </span>
            <label className="inline-flex items-center gap-2">
              <span>Regulation</span>
              <select
                name="reg"
                defaultValue={regFilter}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
              >
                <option value="">Any</option>
                {regOptions.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </form>

      {mode === "keyword" && !user && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;re not logged in, so only the free sample content is
          searchable.{" "}
          <Link href="/login" className="font-medium underline hover:text-amber-950">
            Log in
          </Link>{" "}
          to search the full corpus.
        </p>
      )}

      {mode === "ask" && !access.hasAccess && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ask is part of the subscription.{" "}
          {user ? (
            <Link href="/regulations" className="font-medium underline hover:text-amber-950">
              Subscribe
            </Link>
          ) : (
            <Link href="/login" className="font-medium underline hover:text-amber-950">
              Log in
            </Link>
          )}{" "}
          to search the full corpus by meaning. Keyword search of the free sample is still
          available on the Keyword tab.
        </p>
      )}

      {searchError && (
        <p className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Search isn&apos;t available right now: {searchError}. If this is a
          fresh Supabase project, make sure{" "}
          <code className="font-mono">supabase/migrations/003_search.sql</code>{" "}
          has been applied.
        </p>
      )}

      {askError && (
        <p
          className={`mt-6 rounded-md p-4 text-sm ${
            askError.code === "rate_limited" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-700"
          }`}
        >
          {askError.code === "rate_limited"
            ? askError.message
            : "Ask isn't available right now. Please try again in a moment, or use the Keyword tab."}
        </p>
      )}

      {!q && (
        <p className="mt-10 text-sm text-zinc-500">
          {mode === "ask"
            ? "Type a question above. Examples: “inspection frequency for a well pad with 20 wells”, “setback from a school for a new well”, “when is a flowline abandonment notice due”."
            : "Type a word, phrase, or citation above to search."}
        </p>
      )}

      {mode === "keyword" && q && !searchError && hits.length === 0 && (
        <p className="mt-10 text-sm text-zinc-500">
          No results for <span className="font-medium text-zinc-700">&ldquo;{q}&rdquo;</span>.
          Try fewer or different words{!user ? ", or log in to search beyond the sample" : ""}.
          {user && access.hasAccess && (
            <>
              {" "}Or try the same words on the{" "}
              <Link href={`/search?mode=ask&q=${encodeURIComponent(q)}`} className="font-medium text-zinc-700 underline">
                Ask tab
              </Link>
              .
            </>
          )}
        </p>
      )}

      {mode === "ask" && q && access.hasAccess && !askError && askHits.length === 0 && (
        <p className="mt-10 text-sm text-zinc-500">
          Nothing close enough for that question{regFilter || jurisdiction ? " with those filters" : ""}. Try rephrasing, or
          widen the filters.
        </p>
      )}

      {mode === "keyword" && hits.length > 0 && (
        <>
          <p className="mt-8 text-xs uppercase tracking-wide text-zinc-500">
            {`${hits.length} ${hits.length === 1 ? "result" : "results"} for \u201c${q}\u201d`}
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {hits.map((hit) => {
              const heading = titleWithoutCitation(hit.title, hit.citation);
              const snippet = snippetWithoutTitle(sanitizeHeadline(hit.headline ?? ""), [hit.title, heading]);
              return (
                <li key={hit.id}>
                  <Link
                    href={hrefFor(hit)}
                    className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                  >
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      {hit.reg_key && (
                        <>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700">
                            {regBadge(hit.reg_key, jurisdictionOfKey(hit.reg_key))}
                          </span>
                          <span className="font-medium text-zinc-500">{nameOf(hit.reg_key)}</span>
                          <span className="text-zinc-300">·</span>
                        </>
                      )}
                      <span className="font-mono uppercase tracking-wide text-emerald-700">{hit.citation}</span>
                    </p>
                    {hit.path && <p className="mt-1 text-xs leading-snug text-zinc-500">{hit.path}</p>}
                    {heading && (
                      <p className="mt-1 font-semibold text-zinc-900">{heading}</p>
                    )}
                    {snippet && (
                      <p
                        className="mt-2 text-sm leading-relaxed text-zinc-600 [&_mark]:rounded-sm [&_mark]:bg-amber-100 [&_mark]:px-0.5 [&_mark]:text-zinc-900"
                        dangerouslySetInnerHTML={{ __html: snippet }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {mode === "ask" && askHits.length > 0 && isWeakMatch(askHits) && (
        <p className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nothing in the regulations closely matches this. The rules may not use that term (permit numbers, program
          names and vendor names usually aren&rsquo;t in the text) — try describing the equipment or activity instead, e.g.
          &ldquo;general permit for engines&rdquo; rather than a permit number. The closest provisions are shown below.
        </p>
      )}

      {mode === "ask" && askHits.length > 0 && (
        <>
          <p className="mt-8 text-xs uppercase tracking-wide text-zinc-500">
            {`${askHits.length} ${askHits.length === 1 ? "provision" : "provisions"} most about \u201c${q}\u201d`}
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {askHits.map((hit) => {
              const paras = summaryParagraphs(hit.summary ?? "");
              const badge = regBadge(hit.reg_key, hit.jurisdiction_level);
              const heading = titleWithoutCitation(hit.title, hit.citation);
              return (
                <li key={hit.id}>
                  <Link
                    href={hrefForHit(hit)}
                    className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          badge === "Federal"
                            ? "bg-blue-50 text-blue-700"
                            : badge === "ECMC"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {badge}
                      </span>
                      <span className="text-xs text-zinc-500">{nameOf(hit.reg_key)}</span>
                      {hit.is_basis && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500" title="Rulemaking history: the Commission's explanation of why a rule was adopted, not the rule itself">
                          Statement of basis
                        </span>
                      )}
                      <span className="ml-auto text-xs tabular-nums text-zinc-400" title={hit.keyword_hit ? "Matched your words and your meaning" : "How close this provision's meaning is to your question"}>
                        {hit.score == null ? "keyword match" : `${Math.round(hit.score * 100)}% match`}
                        {hit.keyword_hit && hit.score != null ? " · words" : ""}
                      </span>
                    </div>
                    {hit.path && <p className="mt-2 text-xs leading-snug text-zinc-500">{hit.path}</p>}
                    <p className="mt-1 font-mono text-xs uppercase tracking-wide text-emerald-700">
                      {hit.citation}
                    </p>
                    {heading && (
                      <p className="mt-1 font-semibold text-zinc-900">{heading}</p>
                    )}
                    {paras.length > 0 ? (
                      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-600">{paras[0]}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-zinc-400">No plain-English summary yet — open the provision to read the text.</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-xs text-zinc-400">
            Results are the regulation&apos;s own provisions, ranked by meaning and by your words together;
            statements of basis (rulemaking history) are shown but ranked below the rules. They are not legal advice; read the full
            text and check the official source before relying on them.
          </p>
        </>
      )}
    </div>
  );
}
