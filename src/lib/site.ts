/**
 * Canonical public origin for absolute URLs (sitemap, robots, metadataBase).
 * Set NEXT_PUBLIC_SITE_URL per environment (e.g. a preview deployment);
 * falls back to the production domain. Trailing slash is stripped so callers
 * can safely append a path starting with "/".
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.essentialregs.com"
).replace(/\/+$/, "");
