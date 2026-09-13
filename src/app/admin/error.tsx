"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for /admin/**, most importantly the review queue's
 * approve/edit/reject Server Actions (src/app/admin/review/actions.ts).
 *
 * Without this file, any exception thrown in that tree (including inside a
 * Server Action, e.g. `createAdminClient()` throwing because
 * `SUPABASE_SERVICE_ROLE_KEY` is missing/misconfigured in this deployment)
 * fell through to Next's bare built-in fallback UI instead of this app's
 * design — which is what a non-technical user is liable to describe as
 * "a page cannot be loaded."
 *
 * Note for Next.js 16 (this repo pins 16.3.4): the retry callback prop is
 * named `retry`, not the `reset` you may expect from older Next/React
 * error-boundary examples — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 *
 * Also per that doc: in production, an error thrown from a Server
 * Component/Server Action is redacted to a generic message + `digest`
 * before it reaches this Client Component — the real message (e.g. the
 * missing-env-var text from createAdminClient) only shows up in Vercel's
 * function logs, keyed by that digest.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-xl font-bold text-zinc-900">Something went wrong</h1>
      <p className="text-sm text-zinc-600">
        That action didn&apos;t go through. Nothing you had unsaved should be
        lost — the row is still in the queue, so it&apos;s safe to try again.
      </p>
      {error.digest && (
        <p className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-500">
          Reference: {error.digest}
          <br />
          Share this with the dev if the problem repeats — it matches this
          error to the server logs.
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => retry()}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Try again
        </button>
        <Link
          href="/admin/review"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to review queue
        </Link>
      </div>
    </div>
  );
}
