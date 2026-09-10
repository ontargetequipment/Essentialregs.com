import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the public anon key, which is safe to
// expose — access control is enforced by the Row Level Security policies in
// supabase/schema.sql, not by keeping this key secret.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
