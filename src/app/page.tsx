import Link from "next/link";
import { getAccessStatus } from "@/lib/access";
import { PLAN_TAGLINE } from "@/lib/pricing";
import { PlanChoice } from "@/components/PlanChoice";
import { SubscribeControl } from "@/components/SubscribeControl";
import { FREE_PILL, buttonClass, pageContainerClass } from "@/lib/ui";

// Hero buttons (src/lib/ui.ts). Full-width 44px rows below `sm` (tap
// targets), inline from `sm` up (wrapping where three don't fit). The federal
// button lands on the federal list and the state button on the /states
// picker, whether or not the visitor is signed in (the index pages read the
// roots through the anonymous-safe fetchRegulationRoots).
const BUTTON = buttonClass();
// "See how it works!" sits on its own row below the three: the large size,
// and from `sm` up at least as wide as two buttons above.
const BUTTON_TOUR = buttonClass({ size: "lg", className: "sm:min-w-96 sm:self-start" });

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
    <div className={pageContainerClass()}>
      <section className="py-16 sm:py-24">
        <p className="font-mono text-eyebrow uppercase text-tag">
          Now featuring Colorado oil &amp; gas
        </p>
        <h1 className="mt-4 font-serif text-[36px] font-bold leading-[1.1] tracking-tight text-ink sm:text-display">
          State and federal regulations — searchable, cross-referenced, and
          easier to understand.
        </h1>
        {/* Owner wording, 12 Oct 2026. The first sentence is SITE_DESCRIPTION
            (src/lib/site.ts). Two paragraphs make the hero taller on a
            phone, so below `sm` the gaps around the second one are tighter
            (mt-3, and mt-6 above the buttons); the type scale is unchanged. */}
        <p className="mt-6 max-w-reading text-lg leading-relaxed text-ink-soft">
          EssentialRegs brings Colorado oil and gas regulations, General
          Permits, federal EPA standards, and PHMSA pipeline requirements into
          one searchable reader. Whether you manage compliance, advise clients,
          operate a facility, or want to understand activities near your home
          or land, you can find relevant provisions, follow related
          requirements, and read the rules in context.
        </p>
        <p className="mt-3 max-w-reading text-lg leading-relaxed text-ink-soft sm:mt-4">
          Clearly labeled plain-English summaries help you get oriented
          quickly, while links to official sources let you check the
          underlying regulatory text.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/federal" className={BUTTON}>
              Federal Regulations
            </Link>
            <Link href="/states" className={BUTTON}>
              State Regulations
            </Link>
            <Link href="/test-methods" className={BUTTON}>
              Test Methods
              <span className={FREE_PILL}>Free</span>
            </Link>
          </div>
          <Link href="/sample" className={BUTTON_TOUR}>
            See how it works!
          </Link>
        </div>

        <p className="mt-6 max-w-reading text-sm text-ink-soft">
          Spend less time finding rules, handle routine research yourself, and
          make more of the time you spend with a consultant.
        </p>

        {/* Coverage line. Names only what is in the corpus today; the
            "Coming soon" clause is the one forward-looking line on the site. */}
        <p className="mt-6 max-w-reading text-sm text-ink-soft">
          Now featuring Colorado — AQCC air-quality regulations, ECMC rules and
          APCD General Permits, alongside the federal EPA and PHMSA rules they
          reference. Coming soon: more states, plus OSHA, DOT (FMCSA) and FAA
          regulations.{" "}
          <Link
            href="/request"
            className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
          >
            Request a regulation →
          </Link>
        </p>
        {/* The free Test Methods reference, one sentence beside the
            regulation indexes above. */}
        <p className="mt-3 max-w-reading text-sm text-ink-soft">
          The EPA test methods those rules cite — Method 21, Method 22,
          Method 25A and more — each have a reference page under{" "}
          <Link
            href="/test-methods"
            className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-accent sm:inline sm:min-h-0"
          >
            Test Methods
          </Link>
          , free to read without an account.
        </p>
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

        <div className="mt-6 max-w-reading rounded-lg border border-line bg-panel p-6 shadow-sm">
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
        </div>
      </section>
    </div>
  );
}
