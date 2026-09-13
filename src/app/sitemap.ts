import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { fetchRegulationRootsForSitemap } from "@/lib/regulation";

/**
 * Static, public routes only. The gated full reader (/regulations/[reg])
 * lives behind login and is deliberately not enumerated here -- but each
 * regulation's public /preview teaser is (see the loop in the default
 * export below).
 */
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/sample", changeFrequency: "monthly", priority: 0.8 },
  { path: "/regulations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/changelog", changeFrequency: "daily", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/contact-sales", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 },
  { path: "/login", changeFrequency: "yearly", priority: 0.2 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.5 },
];

// fetchRegulationRootsForSitemap() reads with the service-role client (no
// cookies()/other Next.js "dynamic API" the framework can detect), so
// without this it would be treated as static and evaluated once at build
// time -- when the service-role secret may not yet be configured. Forcing
// dynamic rendering matches how every other Supabase-backed route in this
// app already behaves (they're implicitly dynamic via cookies()) and means
// the corpus is enumerated fresh on each crawl instead of frozen at build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      changeFrequency,
      priority,
    })
  );

  // A transient DB/config problem here should degrade to "the static routes
  // still get crawled" rather than take the whole sitemap down with a 500.
  let previewEntries: MetadataRoute.Sitemap = [];
  try {
    const roots = await fetchRegulationRootsForSitemap();
    previewEntries = roots.map((r) => {
      const regNumber = r.id.match(/^sec-(.+)-top-REG-/)?.[1] ?? r.id;
      return {
        url: `${SITE_URL}/regulations/${regNumber}/preview`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      };
    });
  } catch (error) {
    console.error("sitemap: failed to enumerate regulation preview pages", error);
  }

  return [...staticEntries, ...previewEntries];
}
