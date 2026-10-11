import Link from "next/link";
import { TRIAL_DAYS } from "@/lib/pricing";
import { libraryCountSentence } from "@/lib/library-count";

/**
 * The line under a visitor's empty keyword search: how many provisions the
 * full library has for the same words, with the way in (Sprint 8, 11 Oct
 * 2026; src/lib/library-count.ts). Renders nothing when the count is missing
 * or 0. The trial link is the page's other notices': /signup for a visitor
 * with no account, /pricing for a signed-in one with no plan (the Ask button's
 * rule). It shows a number and the visitor's own words, nothing from any
 * document.
 */
export function LibraryCountNotice({ query, count, signedIn }: { query: string; count: number | null; signedIn: boolean }) {
  const sentence = libraryCountSentence(query, count);
  if (!sentence) return null;
  return (
    <p
      data-testid="library-count"
      className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {sentence}{" "}
      <Link href={signedIn ? "/pricing" : "/signup"} className="font-medium underline hover:text-amber-950">
        Start your {TRIAL_DAYS}-day trial
      </Link>{" "}
      to search all of it.
    </p>
  );
}
