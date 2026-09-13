import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for use in Server Components / route handlers.
// Same anon key as the browser client — access control is enforced by RLS,
// not by this key. This is where the user's session cookie gets read (set
// by src/proxy.ts) so RLS can tell a logged-in, access-granted subscriber
// apart from an anonymous visitor.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // `secure` is left off in dev so the session cookie still works over
      // plain http://localhost; `sameSite: "lax"` still blocks it being
      // sent on cross-site requests while allowing normal top-level
      // navigation (e.g. following the Supabase auth email link).
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore when
            // middleware is also refreshing the session.
          }
        },
      },
    }
  );
}
