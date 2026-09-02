import Link from "next/link";

export default function Home() {
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

      <div className="mt-8 flex gap-4">
        <Link
          href="/sample"
          className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          See a sample entry
        </Link>
        <a
          href="#pricing"
          className="rounded-md border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Pricing
        </a>
      </div>

      <section id="pricing" className="mt-20 border-t border-zinc-200 pt-10">
        <h2 className="text-xl font-semibold text-zinc-900">Pricing</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Subscription checkout isn&apos;t wired up yet — that&apos;s the
          next build phase, once there&apos;s enough reviewed content to sell.
          For now, reach out directly if you want early access.
        </p>
      </section>
    </div>
  );
}
