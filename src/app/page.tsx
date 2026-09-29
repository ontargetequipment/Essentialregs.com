import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import { PLAN_TAGLINE } from "@/lib/pricing";
import { PlanChoice } from "@/components/PlanChoice";
import { SubscribeControl } from "@/components/SubscribeControl";

// Hero buttons. Full-width 44px rows below `sm` (tap targets), inline from
// `sm` up. The state button lands on the /states picker and the federal one
// on the federal list, whether or not the visitor is signed in (the index
// pages read the roots through the anonymous-safe fetchRegulationRoots).
const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-3 text-sm font-semibold";
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white hover:bg-accent/90`;
const BUTTON_OUTLINE = `${BUTTON} border border-line bg-panel text-ink hover:bg-accent-soft`;

// The six things the reader does. `lead` is a short serif label; `detail`
// is the reviewer-approved sentence, kept word for word.
const FEATURES = [
  { lead: "Exact provisions", detail: "Find exact provisions across Colorado, EPA and PHMSA rules." },
  { lead: "Cross-references", detail: "Follow cross-references without opening another PDF." },
  { lead: "General Permits", detail: "Navigate General Permits down to individual conditions." },
  { lead: "Search", detail: "Search by citation, equipment, requirement or topic." },
  {
    lead: "Plain-English summaries",
    detail: "Clearly labelled plain-English summaries beside the official text.",
  },
  { lead: "Official sources", detail: "Verify every provision through its official agency source." },
] as const;

export default async function Home() {
  const access = await getAccessStatus();

  return (
    <div className="mx-auto max-w-shell px-6">
      <section className="py-16 sm:py-24">
        <p className="font-mono text-eyebrow uppercase text-tag">
          Colorado · EPA · PHMSA
        </p>
        <h1 className="mt-4 max-w-[900px] font-serif text-[36px] font-bold leading-[1.1] tracking-tight text-ink sm:text-display">
          Colorado oil &amp; gas regulations — searchable, cross-referenced,
          and easier to use.
        </h1>
        <p className="mt-6 max-w-reading text-lg leading-relaxed text-ink-soft">
          Navigate Colorado air-quality rules, ECMC requirements, General
          Permits, federal EPA standards and PHMSA pipeline regulations in one
          connected reader. Jump straight to a provision, preview cited
          sections without losing your place, and use plain-English summaries
          to understand a rule before verifying it against the official
          source.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/states" className={BUTTON_PRIMARY}>
            State regulations
          </Link>
          <Link href="/federal" className={BUTTON_OUTLINE}>
            Federal regulations
          </Link>
          <Link href="/sample" className={BUTTON_OUTLINE}>
            See a sample entry
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="border-t border-line py-14">
        <h2 id="features-heading" className="font-mono text-eyebrow uppercase text-tag">
          What the reader does
        </h2>
        <ul className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.lead}>
              <p className="font-serif text-card font-semibold text-ink">{f.lead}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* scroll-mt: the 66px sticky site header plus the 32px this had before. */}
      <section id="pricing" className="scroll-mt-[98px] border-t border-line py-14">
        <h2 className="font-serif text-section font-bold tracking-tight text-ink">Pricing</h2>
        <p className="mt-2 max-w-reading text-sm text-ink-soft">
          One plan, billed monthly or yearly: the full corpus, linked
          cross-references, and updates as the rules change.
        </p>

        <div className="mt-6 max-w-md rounded-lg border border-line bg-panel p-6 shadow-sm">
          <p className="font-mono text-eyebrow uppercase text-tag">Subscription</p>
          <p className="mt-1 font-serif text-card font-semibold text-ink">{PLAN_TAGLINE}</p>

          {/* The two plans (src/components/PlanChoice.tsx), shared with the
              account page and the /states/colorado panel. A subscriber gets the
              one "open the regulations" link instead. */}
          <PlanChoice access={access} className="mt-5" />
          {access.hasAccess && <SubscribeControl access={access} interval="year" className="mt-5" />}

          <ul className="mt-5 space-y-1.5 text-sm text-ink-soft">
            <li>Full text of the Colorado air-quality and oil &amp; gas regulations in the corpus</li>
            <li>Click-to-preview citations and a searchable sidebar</li>
            <li>New regulations and revisions as they&apos;re added</li>
            <li>Cancel any time from your account page</li>
          </ul>
          {access.user && !access.hasAccess && (
            <p className="mt-4 text-xs text-muted">
              You&apos;ll be taken to Stripe&apos;s secure checkout and returned here.
            </p>
          )}
          <p className="mt-4 text-xs text-muted">
            Need multiple seats for your team?{" "}
            {/* inline-flex + min-h-11 below `sm` grows this inline link to a
                44px-tall tap target (the line it sits on grows with it);
                `sm:` puts it back to a plain inline link in the sentence. */}
            <Link
              href="/contact-sales"
              className="inline-flex min-h-11 items-center font-medium text-ink-soft underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
            >
              Contact sales
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
