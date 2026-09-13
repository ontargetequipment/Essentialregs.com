import type { NextConfig } from "next";

// Content-Security-Policy, one directive per line for readability (joined
// with "; " below — CSP has no native multi-line syntax).
const csp = [
  // Default fallback for any fetch directive not listed explicitly below.
  "default-src 'self'",
  // Next.js injects a small inline bootstrap script on every page; there's
  // no nonce wiring set up for it, so 'unsafe-inline' stays for scripts
  // rather than breaking hydration. All first-party bundles are still
  // same-origin ('self').
  "script-src 'self' 'unsafe-inline'",
  // Tailwind/Next also emit some inline styles (critical CSS, style attrs).
  "style-src 'self' 'unsafe-inline'",
  // https: covers regulation source images and any future remote imagery;
  // data: covers inline/base64 images (e.g. from sanitized regulation HTML).
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  // The Supabase client talks to the project's own REST/Realtime endpoints.
  "connect-src 'self' https://*.supabase.co",
  // Equivalent to (and a superset of) X-Frame-Options: DENY — blocks this
  // site from being framed anywhere.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Route handlers 303-redirect a form POST straight to Stripe Checkout /
  // the Stripe billing portal; without allowing these hosts here, browsers
  // block that redirect as a disallowed form submission target.
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // Force HTTPS for two years, including subdomains, and allow
            // preload-list submission.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Superseded by CSP's frame-ancestors above for modern browsers,
          // but kept for older ones that don't understand it.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops the browser from MIME-sniffing responses away from their
          // declared Content-Type (blocks some XSS/upload-confusion attacks).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the full origin on same-origin/HTTPS->HTTPS navigation, but
          // nothing more than the origin cross-origin or on downgrade.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser APIs this app never uses.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
