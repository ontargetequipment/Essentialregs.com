// DRAFT — attorney review required before launch
import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How EssentialRegs collects, uses, shares, and protects your information. No advertising, no selling of data, strictly necessary cookies only.",
};

const SUPPORT_EMAIL = "support@essentialregs.com";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This Privacy Policy explains what information EssentialRegs
          (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects
          when you use the EssentialRegs website and subscription service (the
          &ldquo;Service&rdquo;), why we collect it, who we share it with, and
          the choices you have. The short version: we collect the minimum
          needed to run a paid subscription, we do not run advertising, and
          we do not sell your data.
        </p>
      }
    >
      <LegalSection number={1} title="Information we collect">
        <p>
          <strong>Account information.</strong> When you sign up, we collect
          your email address and a password. Your password is stored only as
          a salted cryptographic hash by our authentication provider,
          Supabase; we never see or store your plain-text password.
        </p>
        <p>
          <strong>Billing information.</strong> When you subscribe, payment is
          handled by Stripe, our payment processor. Stripe collects your card
          number, expiration date, security code, and billing address
          directly. We never receive or store your full card number. We do
          receive and store a Stripe customer identifier, your subscription
          status and term dates, the last four digits and brand of your card,
          and a record of the charges made to your account.
        </p>
        <p>
          <strong>Usage and technical information.</strong> Like most web
          services, our hosting provider and application record basic server
          logs when you use the Service: your IP address, browser type and
          version, the pages you request, the time of each request, and the
          referring page. We use these logs to keep the Service running,
          secure, and performant.
        </p>
        <p>
          <strong>Session cookies.</strong> We set cookies that keep you
          logged in and protect your session. See Section 6.
        </p>
        <p>
          <strong>Communications.</strong> If you email us, we keep the
          message and our reply so we can help you and keep a record of the
          conversation.
        </p>
        <p>
          We do not collect precise location data, contacts, or information
          from your device beyond what your browser sends with each request.
        </p>
      </LegalSection>

      <LegalSection number={2} title="How we use information">
        <p>We use the information above to:</p>
        <LegalList>
          <li>create and secure your account and let you log in;</li>
          <li>
            process your subscription payments, renewals, and cancellations;
          </li>
          <li>
            send transactional emails — password resets, receipts, renewal
            notices, and important notices about the Service or these terms;
          </li>
          <li>respond to your questions and support requests;</li>
          <li>
            detect, prevent, and investigate abuse, fraud, security
            incidents, and violations of our{" "}
            <Link href="/terms" className="underline underline-offset-2">
              Terms of Service
            </Link>
            ;
          </li>
          <li>
            understand, in aggregate, how the Service is used so we can
            improve it; and
          </li>
          <li>comply with legal obligations.</li>
        </LegalList>
        <p>
          We do not use your information for advertising, and we do not send
          marketing email unless you have opted in to receive it. You can opt
          out of any non-transactional email at any time.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Who we share information with">
        <p>
          We do not sell, rent, or trade your personal information. We share
          it only with the service providers that we need to operate the
          Service, each of which processes data on our behalf and under
          contractual obligations to protect it:
        </p>
        <LegalList>
          <li>
            <strong>Supabase</strong> — hosts our database and provides
            authentication (email, password hash, session tokens).
          </li>
          <li>
            <strong>Stripe</strong> — processes payments and manages
            subscriptions (billing details and payment history). Stripe&rsquo;s
            handling of your data is also governed by Stripe&rsquo;s own
            privacy policy.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the website and application and
            generates the server logs described above.
          </li>
        </LegalList>
        <p>We may also disclose information:</p>
        <LegalList>
          <li>
            to comply with a law, regulation, subpoena, court order, or other
            legal process, or to respond to a lawful request from a
            government authority;
          </li>
          <li>
            to protect the rights, property, or safety of EssentialRegs, our
            users, or others, including to enforce our Terms;
          </li>
          <li>
            in connection with a merger, acquisition, financing, or sale of
            all or part of our business, in which case we will notify you
            before your information becomes subject to a different privacy
            policy; or
          </li>
          <li>with your consent or at your direction.</li>
        </LegalList>
      </LegalSection>

      <LegalSection number={4} title="No advertising, no tracking">
        <p>
          The Service does not display third-party advertising, does not
          embed advertising or social-media trackers, and does not share your
          information with data brokers or ad networks. We do not engage in
          cross-site tracking.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Data retention">
        <p>
          We keep your account information for as long as your account is
          open. If you close your account, we delete or anonymize your account
          record within 30 days, except that we retain:
        </p>
        <LegalList>
          <li>
            billing and transaction records for as long as required by tax,
            accounting, and payment-network rules (generally up to seven
            years);
          </li>
          <li>
            server logs, which are retained for a limited period (typically
            no more than 90 days) and then deleted or aggregated; and
          </li>
          <li>
            information we need to resolve a dispute, enforce our Terms, or
            comply with a legal obligation.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={6} title="Cookies">
        <p>
          We use only strictly necessary cookies: the session cookies our
          authentication provider sets to keep you logged in and to protect
          your session from forgery. These cookies are required for the
          Service to work and are not used for advertising or analytics. We
          do not use third-party analytics or advertising cookies. You can
          clear or block cookies in your browser settings, but you will not be
          able to stay logged in without them.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Security">
        <p>
          We use industry-standard measures to protect your information,
          including encrypted connections (HTTPS), hashed passwords, row-level
          access controls in our database, and delegation of card handling to
          a PCI-DSS-compliant payment processor. No system is perfectly
          secure, however, and we cannot guarantee the security of your
          information. Please use a strong, unique password and let us know
          immediately if you suspect your account has been compromised.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Your rights and choices">
        <p>
          You can view and update your email address and manage your
          subscription from your account page. In addition, you may ask us
          to:
        </p>
        <LegalList>
          <li>
            <strong>access</strong> a copy of the personal information we hold
            about you;
          </li>
          <li>
            <strong>correct</strong> information that is inaccurate or
            incomplete;
          </li>
          <li>
            <strong>delete</strong> your account and personal information,
            subject to the retention exceptions in Section 5; or
          </li>
          <li>
            <strong>opt out</strong> of non-transactional email.
          </li>
        </LegalList>
        <p>
          To exercise any of these rights, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>{" "}
          from the address associated with your account. We will verify your
          identity and respond within 45 days. We will not discriminate
          against you for exercising these rights. Colorado residents and
          residents of other states with comprehensive privacy laws may have
          additional rights under those laws; we honor all such rights that
          apply to us. If you are not satisfied with our response, you may
          contact us to appeal.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Children">
        <p>
          The Service is intended for working professionals and is not
          directed to anyone under 18 years of age. We do not knowingly
          collect personal information from children. If you believe a minor
          has provided us with personal information, contact us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection number={10} title="International users">
        <p>
          The Service is operated from the United States and is intended for
          users in the United States. If you access it from outside the U.S.,
          your information will be transferred to, stored, and processed in
          the U.S., where privacy laws may differ from those in your
          jurisdiction.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. If we make a
          material change, we will post the updated policy on this page with
          a new &ldquo;Last updated&rdquo; date and, where practical, notify
          you by email before it takes effect. Your continued use of the
          Service after the change takes effect means you accept the updated
          policy.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Contact">
        <p>
          Questions or requests about privacy? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>{" "}
          or see our{" "}
          <Link href="/contact" className="underline underline-offset-2">
            Contact
          </Link>{" "}
          page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
