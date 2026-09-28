/**
 * Only accept a same-site path for a post-auth redirect — a bare "/..."
 * that isn't protocol-relative ("//evil.com" or "/\evil.com", which some
 * browsers still treat as protocol-relative) — so a crafted signup or
 * confirmation link can't bounce a user off-site.
 *
 * Shared by src/app/auth/actions.ts (building the emailRedirectTo `next`
 * param) and src/app/auth/confirm/route.ts (consuming it back from the
 * confirmation link's query string, which is attacker-controlled input).
 */
export function safeNextPath(value: unknown, fallback: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\")) {
    return s;
  }
  return fallback;
}

/**
 * The `next` a confirmation link carries, reduced to a safe same-site path.
 *
 * Two shapes reach /auth/confirm. Supabase's default templates bounce the
 * browser to the `emailRedirectTo` the signup action built,
 * `<site>/auth/confirm?next=/pricing?plan=year`, so `next` is already a
 * path. The token-hash templates in docs/auth-email-templates.md (the ones
 * that work from any device) link straight to
 * `<site>/auth/confirm?token_hash=...&next={{ .RedirectTo }}` instead, and
 * `.RedirectTo` is that whole `emailRedirectTo` URL — so `next` arrives as
 * an absolute URL on our own origin whose own `next` is the path we want.
 *
 * An absolute URL is accepted only on `siteUrl`'s origin; on /auth/confirm
 * its inner `next` is unwrapped, otherwise its path and query are used.
 * Anything else falls through safeNextPath. "" means nothing safe was given.
 */
export function nextFromConfirmLink(value: unknown, siteUrl: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!/^https?:\/\//i.test(s)) return safeNextPath(s, "");

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return "";
  }
  if (url.origin !== new URL(siteUrl).origin) return "";
  if (url.pathname === "/auth/confirm") {
    // Each level strictly shrinks the string, so this terminates.
    return nextFromConfirmLink(url.searchParams.get("next"), siteUrl);
  }
  return safeNextPath(url.pathname + url.search, "");
}
