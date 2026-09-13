import sanitizeHtmlLib from "sanitize-html";
import { createClient } from "@/lib/supabase/server";

/** One row from the search_provisions() RPC (supabase/migrations/003_search.sql). */
export type SearchHit = {
  id: string;
  citation: string;
  title: string;
  /** The "{reg}" segment of a "sec-{reg}-..." id, or null for ids that don't follow that shape. */
  reg_key: string | null;
  /** ts_headline output: plain text with <mark>…</mark> around query terms. Sanitize before rendering. */
  headline: string;
  rank: number;
};

/** Longest query we'll pass to Postgres; anything past this is noise, not a search. */
export const MAX_QUERY_LENGTH = 200;

/**
 * Site-wide full-text search. Goes through the cookie-based server client so
 * the RPC (SECURITY INVOKER) runs as the current visitor and RLS decides what
 * they can see: only is_public rows when logged out, everything when logged
 * in. Returns [] for a blank query without touching the database.
 */
export async function searchProvisions(q: string, limit = 25): Promise<SearchHit[]> {
  const query = q.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_provisions", {
    q: query,
    lim: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SearchHit[];
}

/**
 * ts_headline emits the tag-stripped provision text with <mark> wrappers.
 * The text is trusted regulatory content, but it's rendered with
 * dangerouslySetInnerHTML, so allow exactly <mark> and nothing else.
 */
export function sanitizeHeadline(headline: string): string {
  return sanitizeHtmlLib(headline, {
    allowedTags: ["mark"],
    allowedAttributes: {},
  });
}
