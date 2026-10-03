import Link from "next/link";
import { SummaryBadge } from "@/components/SummaryBadge";
import { createClient } from "@/lib/supabase/server";
import { getAccessStatus } from "@/lib/access";
import {
  CLOSED_PERMIT_BADGE,
  fetchRegulationList,
  isClosedPermit,
  isHeadingOnlyText,
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
import { OTHER_GROUP, groupHits, type QuestionMap } from "@/lib/question-maps";

export const metadata = {
  title: "Search",
};

type Mode = "keyword" | "ask";

/** Where a keyword hit links: the reader (scroll + flash on the hash) when the id belongs to a regulation, else the standalone card. */
function hrefFor(hit: SearchHit): string {
  return hit.reg_key ? `/regulations/${hit.reg_key}#${hit.id}` : `/regs/${hit.id}`;
}

/**
 * The provenance label above prose on a result card. Text, not styling
 * alone, so a reader can tell generated prose from regulatory text at a
 * glance (backlog #16). "Plain-English summary" is the reader panel's own
 * heading, so the vocabulary is one thing everywhere.
 */
const PROVENANCE_LABEL_CLASS = "font-mono text-eyebrow uppercase text-tag";

/**
 * The small badge on a result card ("Statement of basis", the closed-permit
 * label) and, since 2026-09-30, the Beta pill after the Ask heading: one
 * style for every quiet qualifier.
 */
const BETA_PILL_CLASS =
  "rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted";

/**
 * The line an Ask card prints for a heading-only row (a section, not a
 * provision) in place of its missing summary. `children` is the count of
 * rows whose parent_id is the heading; null when the count failed.
 */
function headingLine(children: number | null): string {
  if (children == null || children === 0) return "Section heading — open it to read the provisions inside.";
  return `Section heading — ${children} ${children === 1 ? "provision" : "provisions"} inside. Open it to read them.`;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Keyword-search URL for a query, keeping the Statements-of-Basis toggle (?basis=1) only when it is on. */
function keywordHref(q: string, includeBasis: boolean): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (includeBasis) params.set("basis", "1");
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Ask URL keeping the jurisdiction / regulation chips, ?basis=1 only when it is on, and ?flat=1 only when the visitor asked for the flat list. */
function askHref(q: string, includeBasis: boolean, jurisdiction: string | null = null, reg = "", flat = false): string {
  const params = new URLSearchParams({ mode: "ask" });
  if (q) params.set("q", q);
  if (jurisdiction) params.set("j", jurisdiction);
  if (reg) params.set("reg", reg);
  if (includeBasis) params.set("basis", "1");
  if (flat) params.set("flat", "1");
  return `/search?${params.toString()}`;
}

/** The review state of a summary, for the badge beside it (and, on the keyword page, the summary itself). */
type ReviewRow = { id: string; ai_summary: string | null; summary_status: string | null; reviewed_at: string | null };

/**
 * One row on the Ask page: a retrieval hit, or a question map's canonical
 * provision read from the table. `retrieved` is false for a canonical row
 * retrieval did not return: it has no score, so the card shows none.
 */
type AskRow = SemanticHit & { retrieved: boolean };

/**
 * The Ask result card. One markup for the flat list and the grouped view
 * (Ask Track B): badge, regulation name, Statement-of-basis and closed-permit
 * badges, match score, breadcrumb, citation, heading, then the summary with
 * its review badge (or the heading-only line). `why` is the map's one-line
 * reason for a canonical row, printed above the summary label.
 */
function AskCard({
  row,
  why,
  name,
  review,
  headingChildren,
}: {
  row: AskRow;
  why?: string;
  name: string;
  review: ReviewRow | undefined;
  headingChildren: Map<string, number | null>;
}) {
  const paras = summaryParagraphs(row.summary ?? "");
  const badge = regBadge(row.reg_key, row.jurisdiction_level);
  const heading = titleWithoutCitation(row.title, row.citation);
  return (
    <li>
      <Link
        href={hrefForHit(row)}
        className="block rounded-lg border border-line bg-panel p-5 shadow-sm transition hover:border-accent hover:shadow-md"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              badge === "Federal"
                ? "bg-blue-50 text-blue-700"
                : badge === "ECMC"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-accent-soft text-accent"
            }`}
          >
            {badge}
          </span>
          <span className="text-xs text-muted">{name}</span>
          {row.is_basis && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted" title="Rulemaking history: the Commission's explanation of why a rule was adopted, not the rule itself">
              Statement of basis
            </span>
          )}
          {isClosedPermit(row.reg_key) && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted" title={CLOSED_PERMIT_BADGE.title}>
              {CLOSED_PERMIT_BADGE.label}
            </span>
          )}
          {/* Since 20260930003557 a keyword-only row carries its real cosine, so the
              null branch is rare: only a row with no embedding still lands here. A
              canonical map row retrieval did not return has no score at all. */}
          {row.retrieved && (
            <span
              className="ml-auto text-xs tabular-nums text-muted"
              title={
                row.score == null
                  ? "Matched your words; no meaning score available for this provision."
                  : row.keyword_hit
                    ? "Matched your words and your meaning"
                    : "How close this provision's meaning is to your question"
              }
            >
              {row.score == null ? "keyword match" : `${Math.round(row.score * 100)}% match`}
              {row.keyword_hit && row.score != null ? " · words" : ""}
            </span>
          )}
        </div>
        {row.path && <p className="mt-2 text-xs leading-snug text-muted">{row.path}</p>}
        <p className="mt-1 font-mono text-eyebrow uppercase text-tag">
          {row.citation}
        </p>
        {heading && (
          <p className="mt-1 font-semibold text-ink">{heading}</p>
        )}
        {why && (
          <p className="mt-2 text-xs leading-snug text-muted">
            <span className="font-medium">Why it&apos;s here:</span> {why}
          </p>
        )}
        {paras.length > 0 ? (
          <>
            <p className={`mt-3 ${PROVENANCE_LABEL_CLASS}`}>
              Plain-English summary
              {review && <SummaryBadge provision={review} />}
            </p>
            <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-ink-soft">{paras[0]}</p>
          </>
        ) : headingChildren.has(row.id) ? (
          <p className="mt-2 text-sm text-muted">{headingLine(headingChildren.get(row.id) ?? null)}</p>
        ) : (
          <p className="mt-2 text-sm italic text-muted">No plain-English summary yet — read the official text.</p>
        )}
      </Link>
    </li>
  );
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
  // Keyword search and Ask leave Statements of Basis (rulemaking history) out
  // unless asked: they are the longest rows in the corpus and used to fill the
  // whole first page (backlog #15). ?basis=1 brings them back, ranked below the
  // rules. Ask has read the same param since 2026-09-30.
  const includeBasis = first(params.basis) === "1";
  // Ask Track B: a question that routes to a question map renders grouped;
  // ?flat=1 shows the retrieval list as before (the "Show as a flat list"
  // link). Ignored when no map matched.
  const flat = first(params.flat) === "1";

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
  let askMap: QuestionMap | null = null;
  let searchError: string | null = null;
  let askError: { code: SemanticError["code"]; message: string } | null = null;

  if (q && mode === "keyword") {
    try {
      hits = await searchProvisions(q, { includeBasis });
    } catch (e) {
      // Most likely cause: supabase/migrations/003_search.sql hasn't been
      // applied yet, so the RPC doesn't exist. Surface it rather than 500.
      searchError = e instanceof Error ? e.message : String(e);
    }
  }
  if (q && mode === "ask" && access.hasAccess) {
    try {
      ({ hits: askHits, map: askMap } = await semanticSearch(q, {
        regFilter: regFilter ? [regFilter] : null,
        jurisdiction,
        includeBasis,
      }));
    } catch (e) {
      askError =
        e instanceof SemanticError
          ? { code: e.code, message: e.message }
          : { code: "db", message: e instanceof Error ? e.message : String(e) };
      if (askError.code !== "rate_limited") console.error("ask:", askError.message);
    }
  }

  // Question map rows (Ask Track B). When the question routed to a map and
  // the visitor did not ask for the flat list, the map's canonical provisions
  // are read through the visitor's own client (RLS-bound, like the
  // review-status lookup below) and laid out under the map's groups.
  // Retrieval above is untouched: the RPC call and the hits are what they
  // were. A canonical row retrieval also found keeps its hit (score, path);
  // the others get their breadcrumb from context_path, the computed column
  // on provisions that calls provision_path (the same function the hybrid
  // RPC calls for its own rows, with the same entitlement check), so the
  // whole map is one read rather than one RPC round trip per row. The
  // visitor's filters apply to the canonical rows too, so a "Federal" view
  // never shows a Colorado row. A failed read leaves mapRows empty and the
  // page renders the flat list. reviewed_by is never selected.
  const mapRows = new Map<string, AskRow>();
  if (askMap && !flat && !askError) {
    type MapRow = ReviewRow & {
      citation: string;
      title: string;
      reg_key: string | null;
      jurisdiction_level: SemanticHit["jurisdiction_level"];
      context_path: string | null;
    };
    const hitById = new Map(askHits.map((h) => [h.id, h]));
    const { data: rows, error: rowsErr } = await supabase
      .from("provisions")
      .select("id, citation, title, reg_key, jurisdiction_level, ai_summary, summary_status, reviewed_at, context_path")
      .in("id", askMap.provisions.map((p) => p.id));
    if (rowsErr) console.error("ask: question-map lookup failed", rowsErr.message);
    const kept = ((rows ?? []) as MapRow[]).filter(
      (r) => (!jurisdiction || r.jurisdiction_level === jurisdiction) && (!regFilter || r.id.startsWith(`sec-${regFilter}-`))
    );
    for (const r of kept) {
      const hit = hitById.get(r.id);
      if (hit) {
        mapRows.set(r.id, { ...hit, retrieved: true });
        continue;
      }
      mapRows.set(r.id, {
        id: r.id,
        citation: r.citation,
        title: r.title,
        reg_key: r.reg_key ?? regKeyOf(r.id)?.toLowerCase() ?? null,
        jurisdiction_level: r.jurisdiction_level,
        summary: r.summary_status === "rejected" ? null : r.ai_summary,
        score: null,
        path: r.context_path ?? null,
        retrieved: false,
      });
    }
  }
  // The rows the Ask page shows: the hits, plus the canonical rows retrieval
  // did not return. The review and heading lookups below cover all of them.
  const askRows: AskRow[] = [
    ...askHits.map((h) => ({ ...h, retrieved: true })),
    ...Array.from(mapRows.values()).filter((r) => !r.retrieved),
  ];
  const grouped = askMap && mapRows.size > 0 ? groupHits(askMap, askHits, new Set(mapRows.keys())) : null;

  // The review state of every hit's summary, for the badge beside it
  // (summaryStatusBadge; owner decision, 29 Sep 2026). Neither RPC returns
  // summary_status or reviewed_at and the SQL functions are not changed for
  // this, so it is one follow-up read of the hit ids through the visitor's
  // own client (RLS-bound: the same rows the RPC could see). For the
  // keyword page the read also carries ai_summary, which search_provisions
  // does not return, so a keyword card can show the summary under its badge.
  // A failed read leaves the map empty: the Ask cards then show their
  // summary with no badge and the keyword cards show no summary, never a
  // wrong badge. reviewed_by is never selected.
  const reviewOf = new Map<string, ReviewRow>();
  {
    const ids = mode === "ask" ? askRows.map((h) => h.id) : hits.map((h) => h.id);
    if (ids.length > 0) {
      const { data: rows, error: rowsErr } = await supabase
        .from("provisions")
        .select("id, ai_summary, summary_status, reviewed_at")
        .in("id", ids);
      if (rowsErr) console.error("search: review-status lookup failed", rowsErr.message);
      for (const r of (rows ?? []) as ReviewRow[]) reviewOf.set(r.id, r);
    }
  }

  // Heading-only rows among the Ask hits (a section, not a provision: its
  // text is nothing but its heading, the same test search_provisions uses to
  // null a keyword headline) and how many rows sit directly under each. Only
  // the hits without a summary are looked at -- a heading has nothing to
  // summarise -- and those rows' text is short (642 bytes at most on
  // 2026-09-26), so this is one small read plus one count per heading hit,
  // capped by the hits on the page. Any failure leaves the map empty and the
  // card falls back to its "No plain-English summary yet" line.
  const headingChildren = new Map<string, number | null>();
  if (askRows.length > 0) {
    const unsummarised = askRows.filter((h) => summaryParagraphs(h.summary ?? "").length === 0).map((h) => h.id);
    if (unsummarised.length > 0) {
      const { data: rows, error: rowsErr } = await supabase
        .from("provisions")
        .select("id, citation, title, full_text")
        .in("id", unsummarised);
      if (rowsErr) console.error("ask: heading lookup failed", rowsErr.message);
      const headings = (rows ?? []).filter((r) => isHeadingOnlyText(r.full_text ?? "", r.title, r.citation));
      const counts = await Promise.all(
        headings.map((h) => supabase.from("provisions").select("id", { count: "exact", head: true }).eq("parent_id", h.id))
      );
      headings.forEach((h, i) => {
        if (counts[i].error) console.error("ask: child count failed", counts[i].error.message);
        headingChildren.set(h.id, counts[i].error ? null : counts[i].count);
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {mode === "keyword" ? (
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">Search</h1>
      ) : (
        <>
          {/* Keyword search is the product; Ask is a labelled beta reached
              from the line under the keyword form (owner decision, 30 Sep
              2026). The pill is the same badge as "Statement of basis". */}
          <h1 className="flex flex-wrap items-center gap-x-3 font-serif text-section font-bold tracking-tight text-ink">
            Ask
            <span className={BETA_PILL_CLASS} title="Ask is in beta: results are improving as we tune it">
              Beta
            </span>
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Ask is in beta. Results are improving as we tune it; keyword search is the reference.{" "}
            <Link href={keywordHref(q, includeBasis)} className="font-medium underline hover:text-ink">
              &larr; Keyword search
            </Link>
          </p>
        </>
      )}

      {mode === "keyword" ? (
        <p className="mt-3 text-sm text-ink-soft">
          Full-text search across the whole corpus. Use quotes for
          an exact phrase, a leading <code className="font-mono">-</code> to
          exclude a word, and <code className="font-mono">or</code> between
          alternatives.
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">
          Describe the situation in your own words — a tank, a piece of equipment, a
          deadline, a question you&apos;d ask a coworker. Ask finds the provisions most{" "}
          <em>about</em> your question, across Colorado, ECMC and federal rules, even when
          they don&apos;t use the same words, and shows their plain-English summaries,
          clearly labelled. Rulemaking history (Statements of Basis) is hidden by default.
          It does not decide what applies to you and it is not legal advice — open each
          provision and read the official text.
        </p>
      )}

      <form action="/search" method="get" role="search" className="mt-6 flex flex-col gap-3">
        {mode === "ask" && <input type="hidden" name="mode" value="ask" />}
        {includeBasis && <input type="hidden" name="basis" value="1" />}
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
            className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            {mode === "ask" ? "Ask" : "Search"}
          </button>
        </div>

        {mode === "ask" && access.hasAccess && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span className="inline-flex gap-1 rounded-md border border-line bg-panel p-0.5">
              {(
                [
                  ["", "All"],
                  ["state", "Colorado"],
                  ["federal", "Federal"],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className={`cursor-pointer rounded px-2.5 py-1 has-[:checked]:bg-accent has-[:checked]:text-white`}
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
                className="rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
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

      {mode === "keyword" && access.hasAccess && (
        <p className="mt-3 text-sm text-ink-soft">
          <span className="font-medium">Ask (beta)</span> &mdash; describe the situation in your own words and Ask
          finds the provisions most about it.{" "}
          <Link href={askHref(q, includeBasis)} className="font-medium underline hover:text-ink">
            Try it &rarr;
          </Link>
        </p>
      )}

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
          Ask is a beta feature for subscribers.{" "}
          {user ? (
            <Link href="/states/colorado" className="font-medium underline hover:text-amber-950">
              Subscribe
            </Link>
          ) : (
            <Link href="/login" className="font-medium underline hover:text-amber-950">
              Log in
            </Link>
          )}{" "}
          to search the full corpus by meaning. Keyword search of the free sample is available{" "}
          <Link href={keywordHref(q, includeBasis)} className="font-medium underline hover:text-amber-950">
            here
          </Link>
          .
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
          {askError.code === "rate_limited" ? (
            askError.message
          ) : (
            <>
              Ask isn&apos;t available right now. Please try again in a moment, or use{" "}
              <Link href={keywordHref(q, includeBasis)} className="font-medium underline">
                keyword search
              </Link>
              .
            </>
          )}
        </p>
      )}

      {!q && (
        <p className="mt-10 text-sm text-muted">
          {mode === "ask"
            ? "Type a question above. Examples: “inspection frequency for a well pad with 20 wells”, “setback from a school for a new well”, “when is a flowline abandonment notice due”."
            : "Type a word, phrase, or citation above to search."}
        </p>
      )}

      {mode === "keyword" && q && !searchError && hits.length === 0 && (
        <p className="mt-10 text-sm text-muted">
          No results for <span className="font-medium text-ink-soft">&ldquo;{q}&rdquo;</span>.
          Try fewer or different words{!user ? ", or log in to search beyond the sample" : ""}.
          {user && access.hasAccess && (
            <>
              {" "}Or try the same words as a question in{" "}
              <Link href={askHref(q, includeBasis)} className="font-medium text-ink-soft underline">
                Ask (beta)
              </Link>
              .
            </>
          )}
        </p>
      )}

      {mode === "ask" && q && access.hasAccess && !askError && askHits.length === 0 && !grouped && (
        <p className="mt-10 text-sm text-muted">
          Nothing close enough for that question{regFilter || jurisdiction ? " with those filters" : ""}. Try rephrasing, or
          widen the filters.
        </p>
      )}

      {mode === "keyword" && q && user && !searchError && (
        <p className="mt-8 text-xs text-muted">
          {includeBasis ? (
            <>
              Statements of basis (rulemaking history) are included, ranked below the rules.{" "}
              <Link href={keywordHref(q, false)} className="font-medium text-ink-soft underline">
                Hide them
              </Link>
            </>
          ) : (
            <>
              Statements of basis (rulemaking history) are hidden.{" "}
              <Link href={keywordHref(q, true)} className="font-medium text-ink-soft underline">
                Include them
              </Link>
            </>
          )}
        </p>
      )}

      {mode === "keyword" && hits.length > 0 && (
        <>
          <p className="mt-6 font-mono text-eyebrow uppercase text-tag">
            {`${hits.length} ${hits.length === 1 ? "result" : "results"} for \u201c${q}\u201d`}
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {hits.map((hit) => {
              const heading = titleWithoutCitation(hit.title, hit.citation);
              const snippet = snippetWithoutTitle(sanitizeHeadline(hit.headline ?? ""), [hit.title, heading]);
              // The summary's first paragraph, labelled and badged like an
              // Ask card; a rejected summary is withheld here as everywhere.
              const review = reviewOf.get(hit.id);
              const summary =
                review && review.summary_status !== "rejected" ? summaryParagraphs(review.ai_summary ?? "")[0] ?? null : null;
              return (
                <li key={hit.id}>
                  <Link
                    href={hrefFor(hit)}
                    className="block rounded-lg border border-line bg-panel p-5 shadow-sm transition hover:border-accent hover:shadow-md"
                  >
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      {hit.reg_key && (
                        <>
                          <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-ink-soft">
                            {regBadge(hit.reg_key, jurisdictionOfKey(hit.reg_key))}
                          </span>
                          <span className="font-medium text-muted">{nameOf(hit.reg_key)}</span>
                          <span className="text-muted">·</span>
                        </>
                      )}
                      <span className="font-mono text-eyebrow uppercase text-tag">{hit.citation}</span>
                      {hit.is_basis && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted" title="Rulemaking history: the Commission's explanation of why a rule was adopted, not the rule itself">
                          Statement of basis
                        </span>
                      )}
                      {isClosedPermit(hit.reg_key) && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted" title={CLOSED_PERMIT_BADGE.title}>
                          {CLOSED_PERMIT_BADGE.label}
                        </span>
                      )}
                    </p>
                    {hit.path && <p className="mt-1 text-xs leading-snug text-muted">{hit.path}</p>}
                    {heading && (
                      <p className="mt-1 font-semibold text-ink">{heading}</p>
                    )}
                    {summary && review && (
                      <>
                        <p className={`mt-3 ${PROVENANCE_LABEL_CLASS}`}>
                          Plain-English summary
                          <SummaryBadge provision={review} />
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{summary}</p>
                      </>
                    )}
                    {snippet && (
                      <>
                        <p className={`mt-3 ${PROVENANCE_LABEL_CLASS}`}>From the official text</p>
                        <p
                          className="mt-1 text-sm leading-relaxed text-ink-soft [&_mark]:rounded-sm [&_mark]:bg-amber-100 [&_mark]:px-0.5 [&_mark]:text-ink"
                          dangerouslySetInnerHTML={{ __html: snippet }}
                        />
                      </>
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

      {mode === "ask" && grouped && askMap && (
        <>
          {/* Ask Track B: the question routed to a question map. The map's
              canonical rows lead each group; the retrieval hits follow,
              grouped by regulation; the rest go under "Other matches". */}
          <p className="mt-8 text-sm">
            <span className="font-mono text-eyebrow uppercase text-tag">Mapped question:</span>{" "}
            <span className="font-semibold text-ink">{askMap.name}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{askMap.factors}</p>
          <p className="mt-1 text-xs text-muted">
            <Link href={askHref(q, includeBasis, jurisdiction, regFilter, true)} className="font-medium text-ink-soft underline">
              Show as a flat list
            </Link>
            {" · "}
            {includeBasis ? (
              <>
                Statements of basis (rulemaking history) are included, ranked below the rules.{" "}
                <Link href={askHref(q, false, jurisdiction, regFilter)} className="font-medium text-ink-soft underline">
                  Hide them
                </Link>
              </>
            ) : (
              <>
                Statements of basis (rulemaking history) are hidden.{" "}
                <Link href={askHref(q, true, jurisdiction, regFilter)} className="font-medium text-ink-soft underline">
                  Include them
                </Link>
              </>
            )}
          </p>
          {grouped.groups.map((g) => (
            <section key={g.group} className="mt-8">
              <h2 className="font-serif text-lg font-bold tracking-tight text-ink">{g.group}</h2>
              <ol className="mt-3 flex flex-col gap-3">
                {g.canonical.map((p) => {
                  const row = mapRows.get(p.id);
                  return row ? (
                    <AskCard key={p.id} row={row} why={p.why} name={nameOf(row.reg_key)} review={reviewOf.get(p.id)} headingChildren={headingChildren} />
                  ) : null;
                })}
                {g.hits.map((hit) => (
                  <AskCard key={hit.id} row={{ ...hit, retrieved: true }} name={nameOf(hit.reg_key)} review={reviewOf.get(hit.id)} headingChildren={headingChildren} />
                ))}
              </ol>
            </section>
          ))}
          {grouped.other.length > 0 && (
            <section className="mt-8">
              <h2 className="font-serif text-lg font-bold tracking-tight text-ink">{OTHER_GROUP}</h2>
              <ol className="mt-3 flex flex-col gap-3">
                {grouped.other.map((hit) => (
                  <AskCard key={hit.id} row={{ ...hit, retrieved: true }} name={nameOf(hit.reg_key)} review={reviewOf.get(hit.id)} headingChildren={headingChildren} />
                ))}
              </ol>
            </section>
          )}
          <p className="mt-6 text-xs text-muted">
            The groups are a map of where the rules for this question live; the provisions inside them are the
            regulation&apos;s own, with the ones found by meaning and by your words marked with a match score. Statements
            of basis (rulemaking history) are{" "}
            {includeBasis ? "shown but ranked below the rules" : "hidden unless you include them"}. None of this is legal
            advice; read the full text and check the official source before relying on it.
          </p>
        </>
      )}

      {mode === "ask" && !grouped && askHits.length > 0 && (
        <>
          <p className="mt-8 font-mono text-eyebrow uppercase text-tag">
            {`${askHits.length} ${askHits.length === 1 ? "provision" : "provisions"} most about \u201c${q}\u201d`}
          </p>
          <p className="mt-1 text-xs text-muted">
            {askMap && flat && (
              <>
                <Link href={askHref(q, includeBasis, jurisdiction, regFilter)} className="font-medium text-ink-soft underline">
                  Show grouped
                </Link>
                {" · "}
              </>
            )}
            {includeBasis ? (
              <>
                Statements of basis (rulemaking history) are included, ranked below the rules.{" "}
                <Link href={askHref(q, false, jurisdiction, regFilter, flat)} className="font-medium text-ink-soft underline">
                  Hide them
                </Link>
              </>
            ) : (
              <>
                Statements of basis (rulemaking history) are hidden.{" "}
                <Link href={askHref(q, true, jurisdiction, regFilter, flat)} className="font-medium text-ink-soft underline">
                  Include them
                </Link>
              </>
            )}
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {askHits.map((hit) => (
              <AskCard key={hit.id} row={{ ...hit, retrieved: true }} name={nameOf(hit.reg_key)} review={reviewOf.get(hit.id)} headingChildren={headingChildren} />
            ))}
          </ol>
          <p className="mt-6 text-xs text-muted">
            Results are the regulation&apos;s own provisions, ranked by meaning and by your words together;
            statements of basis (rulemaking history) are{" "}
            {includeBasis ? "shown but ranked below the rules" : "hidden unless you include them"}. They are not legal advice; read the full
            text and check the official source before relying on them.
          </p>
        </>
      )}
    </div>
  );
}
