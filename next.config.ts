import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // isomorphic-dompurify pulls in jsdom, which uses dynamic `require()`s that
  // Next's automatic server-component bundler doesn't trace correctly on
  // Vercel -- it built fine locally but crashed at runtime in production
  // with "Failed to load external module". Marking both packages external
  // makes Next load them straight from node_modules instead of bundling
  // them, which is what actually works on Vercel.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
};

export default nextConfig;
