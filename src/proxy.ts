import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// `middleware.ts` was renamed to `proxy.ts` in Next 16 — see AGENTS.md.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimization requests; run on everything
    // else so the auth cookie is refreshed on every real page/action.
    // Also skip the Stripe webhook: it's called by Stripe, never carries a
    // user session, and shouldn't spend a Supabase round-trip per event.
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
