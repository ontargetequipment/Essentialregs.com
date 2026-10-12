/**
 * Canonical public origin for absolute URLs (sitemap, robots, metadataBase).
 * Set NEXT_PUBLIC_SITE_URL per environment (e.g. a preview deployment);
 * falls back to the production domain. Trailing slash is stripped so callers
 * can safely append a path starting with "/".
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.essentialregs.com"
).replace(/\/+$/, "");

export const SITE_NAME = "EssentialRegs";

/** The site's meta description, and the line under the name on the Open Graph image. */
export const SITE_DESCRIPTION =
  "EssentialRegs brings Colorado oil and gas regulations, General Permits, federal EPA standards, and PHMSA pipeline requirements into one searchable reader.";
