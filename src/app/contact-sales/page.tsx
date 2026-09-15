import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";
import { ANNUAL_PRICE_DISPLAY } from "@/lib/pricing";

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
          The {ANNUAL_PRICE_DISPLAY} plan is built for one person. If you need
          it for a whole team — several EHS or compliance staff, a
          multi-facility group — email us and we&apos;ll work out seat
          pricing together.
        </p>
      }
    >
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Sales email
        </p>
        <a
          href={MAILTO_HREF}
          className="mt-1 block break-all text-xl font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
        >
          {SUPPORT_EMAIL}
        </a>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
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
            className="font-medium text-zinc-900 underline underline-offset-2"
          >
            subscribe directly
          </Link>{" "}
          for {ANNUAL_PRICE_DISPLAY}, or see the plan details on the{" "}
          <Link
            href="/regulations"
            className="font-medium text-zinc-900 underline underline-offset-2"
          >
            regulations
          </Link>{" "}
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
