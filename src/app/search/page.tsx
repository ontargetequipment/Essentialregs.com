import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_QUERY_LENGTH,
  sanitizeHeadline,
  searchProvisions,
  type SearchHit,
} from "@/lib/search";

export const metadata = {
  title: "Search",
};

/** Where a hit links: the reader (scroll + flash on the hash) when the id belongs to a regulation, else the standalone card. */
function hrefFor(hit: SearchHit): string {
  return hit.reg_key ? `/regulations/${hit.reg_key}#${hit.id}` : `/regs/${hit.id}`;
}

export default async function SearchPage(props: PageProps<"/search">) {
  const params = await props.searchParams;
  const raw = params.q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim().slice(0, MAX_QUERY_LENGTH);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hits: SearchHit[] = [];
  let searchError: string | null = null;
  if (q) {
    try {
      hits = await searchProvisions(q);
    } catch (e) {
      // Most likely cause: supabase/migrations/003_search.sql hasn't been
      // applied yet, so the RPC doesn't exist. Surface it rather than 500.
      searchError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">Search</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Full-text search across every regulation in the corpus. Use quotes for
        an exact phrase, a leading <code className="font-mono">-</code> to
        exclude a word, and <code className="font-mono">or</code> between
        alternatives.
      </p>

      <form action="/search" method="get" role="search" className="mt-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="e.g. fugitive emissions, storage tank, 604"
          aria-label="Search regulations"
          autoComplete="off"
          autoFocus={!q}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Search
        </button>
      </form>

      {!user && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;re not logged in, so only the free sample content is
          searchable.{" "}
          <Link href="/login" className="font-medium underline hover:text-amber-950">
            Log in
          </Link>{" "}
          to search the full corpus.
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

      {!q && (
        <p className="mt-10 text-sm text-zinc-500">
          Type a word, phrase, or citation above to search.
        </p>
      )}

      {q && !searchError && hits.length === 0 && (
        <p className="mt-10 text-sm text-zinc-500">
          No results for <span className="font-medium text-zinc-700">&ldquo;{q}&rdquo;</span>.
          Try fewer or different words{!user ? ", or log in to search beyond the sample" : ""}.
        </p>
      )}

      {hits.length > 0 && (
        <>
          <p className="mt-8 text-xs uppercase tracking-wide text-zinc-500">
            {hits.length} result{hits.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {hits.map((hit) => (
              <li key={hit.id}>
                <Link
                  href={hrefFor(hit)}
                  className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <p className="font-mono text-xs uppercase tracking-wide text-emerald-700">
                    {hit.citation}
                  </p>
                  {hit.title && (
                    <p className="mt-1 font-semibold text-zinc-900">{hit.title}</p>
                  )}
                  <p
                    className="mt-2 text-sm leading-relaxed text-zinc-600 [&_mark]:rounded-sm [&_mark]:bg-amber-100 [&_mark]:px-0.5 [&_mark]:text-zinc-900"
                    dangerouslySetInnerHTML={{ __html: sanitizeHeadline(hit.headline) }}
                  />
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
