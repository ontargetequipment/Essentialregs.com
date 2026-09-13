import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import {
  ANNUAL_PLAN_NAME,
  ANNUAL_PLAN_TAGLINE,
  ANNUAL_PRICE_DISPLAY,
} from "@/lib/pricing";
import { SubscribeControl } from "@/components/SubscribeControl";

export default async function Home() {
  const access = await getAccessStatus();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Colorado oil &amp; gas regulations, in plain English — with every
        cross-reference already resolved.
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        Federal (OSHA), Colorado state (ECMC, CDPHE-APCD), and — coming soon —
        county building code requirements for oil &amp; gas operations, each
        with a plain-English summary and working links to every section it
        references.
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/regulations"
          className="rounded-md bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Browse the full regulations
        </Link>
        <Link
          href="/sample"
          className="rounded-md border border-zinc-300 px-5 py-3 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          See a sample entry
        </Link>
      </div>

      <section id="pricing" className="mt-20 scroll-mt-8 border-t border-zinc-200 pt-10">
        <h2 className="text-xl font-semibold text-zinc-900">Pricing</h2>
        <p className="mt-2 text-sm text-zinc-600">
          One plan. Every regulation in the corpus, every cross-reference
          resolved, and every update as the rules change.
        </p>

        <div className="mt-6 max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-mono uppercase tracking-wide text-emerald-700">
            {ANNUAL_PLAN_NAME}
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {ANNUAL_PLAN_TAGLINE}
          </p>
          <p className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">
            {ANNUAL_PRICE_DISPLAY}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
            <li>Full text of every Colorado regulation loaded</li>
            <li>Click-to-preview citations and a searchable sidebar</li>
            <li>New regulations and revisions as they&apos;re added</li>
            <li>Cancel any time from your account page</li>
          </ul>
          <SubscribeControl access={access} className="mt-6" />
          {access.user && !access.hasAccess && (
            <p className="mt-3 text-xs text-zinc-500">
              You&apos;ll be taken to Stripe&apos;s secure checkout and returned here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
