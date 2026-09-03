import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EssentialRegs — Colorado Oil & Gas Compliance Reference",
  description:
    "Federal, Colorado state, and county oil & gas regulations with plain-English summaries and working cross-reference links.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              EssentialRegs
            </Link>
            <nav className="flex gap-6 text-sm font-medium text-zinc-600">
              <Link href="/regulations" className="hover:text-zinc-950">
                Regulations
              </Link>
              <Link href="/sample" className="hover:text-zinc-950">
                Sample
              </Link>
              <Link href="/#pricing" className="hover:text-zinc-950">
                Pricing
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-8 text-xs leading-relaxed text-zinc-500">
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
      </body>
    </html>
  );
}
