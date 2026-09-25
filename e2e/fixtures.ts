import { test as base, type BrowserContext } from "@playwright/test";

/**
 * Vercel Deployment Protection puts every preview behind a login wall. With
 * VERCEL_AUTOMATION_BYPASS_SECRET set, every request to the deployment
 * carries x-vercel-protection-bypass, and the first document request also
 * asks Vercel to set the bypass cookie (x-vercel-set-bypass-cookie) so
 * anything the page fetches on its own passes too.
 *
 * The header is added per request, to the deployment's own origin only --
 * not through extraHTTPHeaders, which would also hand the secret to every
 * third-party host the page talks to (Supabase, Stripe, Vercel analytics).
 */
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

export async function withProtectionBypass(context: BrowserContext, baseURL: string | undefined): Promise<void> {
  if (!BYPASS || !baseURL) return;
  const origin = new URL(baseURL).origin;
  let cookieRequested = false;
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const headers: Record<string, string> = {
        ...route.request().headers(),
        "x-vercel-protection-bypass": BYPASS,
      };
      if (!cookieRequested && route.request().isNavigationRequest()) {
        headers["x-vercel-set-bypass-cookie"] = "true";
        cookieRequested = true;
      }
      await route.continue({ headers });
    }
  );
}

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await withProtectionBypass(context, baseURL);
    await provide(context);
  },
});

export { expect } from "@playwright/test";
