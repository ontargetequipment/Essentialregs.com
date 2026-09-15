import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { AuthStatus } from "@/components/AuthStatus";
import { MobileNav } from "@/components/MobileNav";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const SITE_NAME = "EssentialRegs";
const SITE_DESCRIPTION =
  "Federal, Colorado state, and county oil & gas regulations with plain-English summaries and working cross-reference links.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EssentialRegs — Colorado Oil & Gas Compliance Reference",
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // og:title / og:description / twitter:* fall back to each page's resolved
  // title and description, so they are intentionally not pinned here.
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
  },
};

const FOOTER_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/changelog", label: "Changelog" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="relative border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              EssentialRegs
            </Link>
            <MobileNav
              authSlot={
                <Suspense fallback={<span className="text-zinc-400">···</span>}>
                  <AuthStatus />
                </Suspense>
              }
            />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-8 text-xs leading-relaxed text-zinc-500">
            <nav aria-label="Footer" className="mb-4">
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {FOOTER_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="font-medium text-zinc-700 hover:text-emerald-700 hover:underline underline-offset-2"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="mb-2 font-medium text-zinc-700">
              EssentialRegs is not affiliated with any federal, state, or
              county government agency.
            </p>
            <p>
              Content is provided for informational and reference purposes
              only and is not legal advice. Regulations change — always
              verify current requirements against the official source
              (linked on every entry) before relying on them for compliance
              decisions.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
