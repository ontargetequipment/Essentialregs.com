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
