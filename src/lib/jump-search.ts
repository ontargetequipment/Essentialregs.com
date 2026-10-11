/**
 * The reader's jump box, as pure functions (11 Oct 2026). Dependency-free like
 * snippet.ts: it ends up in the client bundle and in scripts/jump-search.test.ts.
 *
 * Two lists, in this order:
 *   1. citation matches -- normalizeJumpKey prefix matches on the citation,
 *      computed in the browser from the reader's own rows, instant;
 *   2. text matches -- the server's keyword search inside this document
 *      (search_provisions_in_document, through /api/reader-search), with the
 *      highlighted excerpt it returns. These replace the old match on the
 *      first 90 characters of each provision, which could not find a word
 *      past them ("sampling" in GP05 VI.D).
 *
 * "No matches" is for both lists empty.
 */
import { escapeHtml, normalizeJumpKey, type SearchRow } from "@/lib/snippet";

/** How long the box waits after the last keystroke before asking the server. */
export const JUMP_DEBOUNCE_MS = 150;
/** Rows asked of the server. */
export const JUMP_TEXT_LIMIT = 10;
/** Citation matches listed (the old cap on the id list). */
export const JUMP_CITATION_MAX = 12;
/** Longest query sent (search.ts MAX_QUERY_LENGTH; the server cuts it again). */
export const JUMP_QUERY_MAX = 200;

/** One text match as /api/reader-search returns it. */
export type JumpTextHit = {
  id: string;
  citation: string;
  /** Plain text with <mark> around the query terms (already sanitised by the server); null for a heading-only row. */
  headline: string | null;
};

/** One line of the list. Exactly one of `snippet` (plain text) and `excerptHtml` (marks only) is set, or neither. */
export type JumpItem = {
  id: string;
  citation: string;
  snippet: string;
  excerptHtml: string;
};

/**
 * The citation matches, exactly as the box has always found them: the rows
 * whose normalized citation starts with the normalized query, in reading
 * order, at most JUMP_CITATION_MAX.
 */
export function citationMatches(index: readonly SearchRow[], qRaw: string): SearchRow[] {
  const qKey = normalizeJumpKey(qRaw);
  const out: SearchRow[] = [];
  if (!qKey) return out;
  for (const row of index) {
    if (normalizeJumpKey(row[1]).indexOf(qKey) === 0) out.push(row);
    if (out.length >= JUMP_CITATION_MAX) break;
  }
  return out;
}

/**
 * The text excerpt as HTML that is safe to set: only <mark> survives, any
 * other tag is dropped. The server already sanitises (sanitizeHeadline escapes
 * everything else as text); this is the second lock on the way in.
 */
export function excerptHtml(headline: string | null | undefined): string {
  if (!headline) return "";
  return headline
    .replace(/<(?!\/?mark[\s>])[^>]*>/gi, "")
    .replace(/<mark\b[^>]*>/gi, "<mark>")
    .replace(/<\/mark\s*>/gi, "</mark>");
}

/**
 * Citation matches first (with the first-line snippet), then the text
 * matches that are not already listed (with the highlighted excerpt).
 * `text` is null while the server has not answered; the result is then the
 * citation matches alone.
 */
export function mergeJumpResults(citation: readonly SearchRow[], text: readonly JumpTextHit[] | null): JumpItem[] {
  const items: JumpItem[] = citation.map((row) => ({ id: row[0], citation: row[1], snippet: row[2], excerptHtml: "" }));
  if (!text) return items;
  const seen = new Set(items.map((i) => i.id));
  for (const hit of text) {
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    items.push({ id: hit.id, citation: hit.citation, snippet: "", excerptHtml: excerptHtml(hit.headline) });
  }
  return items;
}

function attr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/** The listbox's rows. Nothing at all for an empty list; the caller decides whether that is "No matches". */
export function jumpItemsHtml(items: readonly JumpItem[]): string {
  return items
    .map((it) => {
      // A row whose text is only its own citation has no snippet; skip the span rather than emit an empty one.
      const snip = it.excerptHtml
        ? `<span class="jr-snip jr-excerpt">${it.excerptHtml}</span>`
        : it.snippet
          ? `<span class="jr-snip">${escapeHtml(it.snippet)}</span>`
          : "";
      return `<div class="jr-item" role="option" id="jump-opt-${attr(it.id)}" aria-selected="false" data-slug="${attr(
        it.id
      )}"><span class="jr-id">${escapeHtml(it.citation)}</span>${snip}</div>`;
    })
    .join("");
}

export const JUMP_EMPTY_HTML = '<div class="jr-item jr-empty">No matches</div>';
export const JUMP_ERROR_HTML = '<div class="jr-item jr-empty">Couldn’t search the text. Try again.</div>';

/** The query as the server and the cache see it: trimmed, whitespace collapsed, lower-case, cut. */
export function jumpQueryKey(qRaw: string): string {
  return qRaw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, JUMP_QUERY_MAX);
}
