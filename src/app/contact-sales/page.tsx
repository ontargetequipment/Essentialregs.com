import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";
import { PRICE_SUMMARY, TRIAL_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Contact Sales",
  description:
    "Buying EssentialRegs for more than one person? Reach out for multi-seat and team pricing.",
};

const SALES_SUBJECT = "Multi-seat / team pricing inquiry";
const SUPPORT_EMAIL = "support@essentialregs.com";
const MAILTO_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SALES_SUBJECT)}`;

export default function ContactSalesPage() {
  return (
    <LegalPage
      title="Contact Sales"
      intro={
        <p>
          The {PRICE_SUMMARY} subscription is built for one person. If you need
          it for a whole team — several EHS or compliance staff, a
          multi-facility group — email us and we&apos;ll work out seat
          pricing together.
        </p>
      }
    >
      <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
        <p className="font-mono text-eyebrow uppercase text-tag">
          Sales email
        </p>
        <a
          href={MAILTO_HREF}
          className="mt-1 flex min-h-11 items-center break-all font-serif text-card font-semibold text-accent underline underline-offset-4 hover:text-ink sm:block sm:min-h-0"
        >
          {SUPPORT_EMAIL}
        </a>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          A real person replies — usually within two business days (Mountain
          Time, Monday through Friday).
        </p>
      </section>

      <LegalSection title="What to include">
        <p>To get you a quote in one reply, tell us:</p>
        <LegalList>
          <li>How many seats you need</li>
          <li>Your company or facility name</li>
          <li>Which regulations matter most to your team right now</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Just need one seat?">
        <p>
          You don&apos;t need to wait on us —{" "}
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0"
          >
            subscribe directly
          </Link>{" "}
          for {PRICE_SUMMARY} (the first {TRIAL_DAYS} days are free), or see the plan details on the{" "}
          <Link
            href="/states/colorado"
            className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 sm:inline sm:min-h-0"
          >
            regulations
          </Link>{" "}
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
