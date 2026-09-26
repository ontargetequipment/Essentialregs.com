import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { AuthStatus } from "@/components/AuthStatus";
import { MobileNav } from "@/components/MobileNav";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const SITE_NAME = "EssentialRegs";
const SITE_DESCRIPTION =
  "Federal and Colorado oil & gas regulations with plain-English summaries and linked cross-references.";

// Display headings and regulation text; citations and eyebrow labels. Body/UI
// copy stays on the system sans stack (see --font-sans in globals.css).
// `variable` puts a next/font-generated CSS variable on <html> — globals.css
// (--font-serif / --font-mono) and reader.css (--serif / --mono) both point
// at these variable names rather than the literal family name, which
// next/font does not register. See the comment on those tokens for why.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

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

const FOOTER_GROUPS = [
  {
    label: "Regulations",
    links: [
      { href: "/regulations", label: "Colorado (state)" },
      { href: "/general-permits", label: "General permits" },
      { href: "/federal", label: "Federal" },
    ],
  },
  {
    label: "Product",
    links: [
      { href: "/sample", label: "Sample" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${sourceSerif.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Restyle freely, but this row must measure exactly 66px — the
            regulation reader's sticky sidebar (reader.css) is pinned to
            `top: 66px` / `height: calc(100vh - 66px)` and misaligns on every
            regulation page if this height drifts. h-[66px] on the row itself
            (rather than padding that happens to add up to 66px) keeps that
            true regardless of font metrics. */}
        <header className="relative h-[66px] border-b border-line bg-panel">
          <div className="mx-auto flex h-full max-w-shell items-center justify-between px-6">
            <Link
              href="/"
              className="font-serif text-[20px] font-bold tracking-tight text-ink"
            >
              EssentialRegs
            </Link>
            <MobileNav
              authSlot={
                <Suspense fallback={<span className="text-muted">···</span>}>
                  <AuthStatus />
                </Suspense>
              }
            />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line bg-panel">
          <div className="mx-auto max-w-shell px-6 py-12">
            <nav
              aria-label="Footer"
              className="mb-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
            >
              {FOOTER_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="font-mono text-eyebrow uppercase text-tag">
                    {group.label}
                  </p>
                  {/* Below `sm` each link is a 44px-tall full-width row
                      (tap target) with no gap between rows, and the list's
                      top margin is dropped because the row's own vertical
                      centering already leaves 12px above the first label.
                      `sm:` restores the inline links, 8px gap and mt-3 the
                      desktop footer has always had. */}
                  <ul className="flex flex-col text-sm sm:mt-3 sm:gap-2">
                    {group.links.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          className="flex min-h-11 items-center text-ink-soft hover:text-accent hover:underline underline-offset-2 sm:inline sm:min-h-0"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
              <p className="mb-2 font-medium text-ink-soft">
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
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
