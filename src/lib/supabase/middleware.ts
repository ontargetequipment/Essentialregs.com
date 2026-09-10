import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs on every request from proxy.ts. Its only job is to keep the Supabase
// auth session cookie fresh — Server Components can *read* cookies but can't
// set them, so if a session's access token expires mid-render there'd be no
// way to refresh it without this running first, in front of every route.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching auth.getUser() is what actually triggers a token refresh (and
  // the setAll above) when the access token is stale. Do not remove this
  // even though the return value is unused here.
  await supabase.auth.getUser();

  return supabaseResponse;
}
