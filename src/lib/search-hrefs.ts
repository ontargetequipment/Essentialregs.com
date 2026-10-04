/**
 * The /search tab URLs, shared by the server page and the client tablist
 * (SearchTabs). Pure string building, no React.
 */

/**
 * The id of the search box on /search itself. The site header carries its
 * own role="search" form (MobileNav, earlier in the DOM), so the tablist
 * reads the typed query by this id, never by the first search form found.
 */
export const SEARCH_BOX_ID = "search-query";

/** Keyword-tab URL for a query, keeping the Statements-of-Basis toggle (?basis=1) only when it is on. */
export function keywordHref(q: string, includeBasis: boolean): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (includeBasis) params.set("basis", "1");
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Ask-tab URL keeping the jurisdiction / regulation chips, ?basis=1 only when it is on, and ?flat=1 only when the visitor asked for the flat list. */
export function askHref(q: string, includeBasis: boolean, jurisdiction: string | null = null, reg = "", flat = false): string {
  const params = new URLSearchParams({ mode: "ask" });
  if (q) params.set("q", q);
  if (jurisdiction) params.set("j", jurisdiction);
  if (reg) params.set("reg", reg);
  if (includeBasis) params.set("basis", "1");
  if (flat) params.set("flat", "1");
  return `/search?${params.toString()}`;
}

/** The tab href for `mode` with the query the visitor has typed right now (SearchTabs). */
export function tabHref(mode: "keyword" | "ask", q: string, includeBasis: boolean): string {
  return mode === "ask" ? askHref(q, includeBasis) : keywordHref(q, includeBasis);
}
