import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client. This key BYPASSES Row Level Security, so it
// must never reach the browser (the `server-only` import above makes any
// client-component import a build error) and should only be used where
// there is no user session to act as — the Stripe webhook, which runs on
// Stripe's request, not the subscriber's, and needs to write subscription
// state onto `profiles` (a table users can't update themselves); the
// anonymous-safe teaser, regulation-index and sitemap reads in
// lib/regulation.ts; and the
// cross-request reader body cache (fetchRenderedReader there), which is
// filled inside a cache scope that cannot read cookies and is reachable
// only behind the entitlement gate in lib/reader-page.ts.
//
// Constructed lazily so a missing key only fails the request that needs it.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — see docs/stripe-setup.md."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // No user session here; never try to read/write auth cookies or
      // refresh tokens on behalf of anyone.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
