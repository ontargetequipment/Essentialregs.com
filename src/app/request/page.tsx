import type { Metadata } from "next";
import Link from "next/link";
import { pageContainerClass } from "@/lib/ui";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = {
  title: "Request a regulation",
  description:
    "Tell us which regulation you need and we'll put it in the queue. What people ask for decides what we build next.",
};

/**
 * Public "Request a regulation" page (12 Oct 2026). Same shell and tokens as
 * /contact (the shared page container and LegalPage's heading, without its
 * "Last updated" line, which a form has no use for). The form is a client component so the
 * success state replaces it in place; the action is src/app/request/actions.ts.
 *
 * Dynamic by nature: it reads the session cookie (to prefill a signed-in
 * requester's email) and stamps the render time into the form for the
 * too-fast guard.
 */
/**
 * The render time the too-fast guard compares against. A Server Component
 * renders once per request (the page is dynamic: it reads cookies above), so
 * the clock is read exactly once per form; it lives in its own async function
 * because the purity lint rule rejects a bare Date.now() in render.
 */
async function renderTime(): Promise<number> {
  return Date.now();
}

export default async function RequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;
  const renderedAt = await renderTime();

  return (
    <div className={pageContainerClass("py-12")}>
      <h1 className="font-serif text-section font-bold tracking-tight text-ink">Request a regulation</h1>
      <div className="mt-4 max-w-reading text-base leading-relaxed text-ink-soft">
        <p>
          Tell us which regulation you need and we&rsquo;ll put it in the queue. What people
          ask for decides what we build next.
        </p>
      </div>

      <div className="mt-8 max-w-reading">
        <RequestForm renderedAt={renderedAt} userEmail={userEmail} />
      </div>

      <p className="mt-8 max-w-reading text-sm text-ink-soft">
        Something else? Account, billing and correction questions go through{" "}
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0"
        >
          Contact
        </Link>
        .
      </p>
    </div>
  );
}
