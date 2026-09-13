import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with EssentialRegs support for account, billing, content corrections, and general questions.",
};

const SUPPORT_EMAIL = "support@essentialregs.com";

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro={
        <p>
          The fastest way to reach us is email. There is no ticket system or
          phone line — a real person reads every message.
        </p>
      }
    >
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Support email
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-1 block break-all text-xl font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
        >
          {SUPPORT_EMAIL}
        </a>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          We aim to reply within <strong>two business days</strong> (Mountain
          Time, Monday through Friday). Billing and account-access problems
          are handled first.
        </p>
      </section>

      <LegalSection title="What to include">
        <p>
          Including these details up front usually means we can resolve
          things in a single reply:
        </p>
        <LegalList>
          <li>
            <strong>Account or billing questions</strong> — the email address
            on your account. Please do not send card numbers; we never need
            them and cannot see them anyway.
          </li>
          <li>
            <strong>Content corrections</strong> — the regulation and section
            (for example &ldquo;Reg 7, Section II.C.1.b&rdquo;) or the page
            URL, what you believe is wrong, and where in the official source
            the correct text lives. Reports on summary accuracy are
            especially welcome.
          </li>
          <li>
            <strong>Broken or missing cross-reference links</strong> — the
            page URL and the citation text that did not link or linked to the
            wrong place.
          </li>
          <li>
            <strong>Bugs</strong> — what you did, what you expected, what
            happened instead, and your browser and device if it seems
            relevant.
          </li>
          <li>
            <strong>Coverage requests</strong> — which regulation you would
            like added next, and roughly how often you need it.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Privacy requests">
        <p>
          To access, correct, or delete the personal information we hold
          about you, email us from the address on your account with
          &ldquo;Privacy request&rdquo; in the subject line. See the{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for what we hold and how long we keep it.
        </p>
      </LegalSection>

      <LegalSection title="A note on what we can't help with">
        <p>
          We can help you find and navigate a regulation. We cannot tell you
          whether it applies to your facility or what you should do about
          it — that is a question for your attorney or compliance
          consultant. See the{" "}
          <Link href="/disclaimer" className="underline underline-offset-2">
            Disclaimer
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
