// DRAFT — attorney review required before launch
import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for the EssentialRegs subscription: accounts, billing and cancellation, acceptable use, intellectual property, disclaimers, and limitation of liability.",
};

const SUPPORT_EMAIL = "support@essentialregs.com";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) govern your access
          to and use of the EssentialRegs website and subscription service
          (the &ldquo;Service&rdquo;). By creating an account, purchasing a
          subscription, or using the Service, you agree to these Terms. If you
          do not agree, do not use the Service.
        </p>
      }
    >
      <LegalSection number={1} title="Who we are and what the Service is">
        <p>
          EssentialRegs (&ldquo;EssentialRegs,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a paid, subscription-based
          reference service that compiles federal, Colorado state, and (where
          available) local regulations applicable to oil and gas operations,
          together with plain-English summaries and a cross-reference index
          linking related provisions. The Service is an informational
          reference tool. It is not a substitute for the official regulatory
          text, for legal advice, or for the judgment of a qualified
          professional.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Eligibility">
        <p>
          You must be at least 18 years old and able to form a binding
          contract to use the Service. If you use the Service on behalf of a
          company or other organization, you represent that you have
          authority to bind that organization to these Terms, and
          &ldquo;you&rdquo; includes that organization.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Your account">
        <p>
          You need an account to access subscriber content. You agree to:
        </p>
        <LegalList>
          <li>provide an accurate email address and keep it current;</li>
          <li>
            keep your password confidential and not share your login
            credentials with anyone outside the scope of your subscription;
          </li>
          <li>
            notify us promptly at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>{" "}
            if you believe your account has been accessed without
            authorization; and
          </li>
          <li>
            accept responsibility for all activity that occurs under your
            account, whether or not you authorized it, until you notify us of
            a compromise.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={4} title="Subscriptions, billing, and auto-renewal">
        <p>
          <strong>Subscription term.</strong> Access to subscriber content is
          sold as a subscription for the term (for example, one year) and at
          the price shown at checkout. Prices are in U.S. dollars unless
          stated otherwise.
        </p>
        <p>
          <strong>Automatic renewal.</strong> Unless you cancel before the end
          of the current term, your subscription will automatically renew for
          another term of the same length at the then-current price, and the
          payment method on file will be charged. We will give you reasonable
          advance notice of any price change before it applies to a renewal.
        </p>
        <p>
          <strong>Payment processing.</strong> Payments are processed by our
          third-party payment processor, Stripe. We do not store your full
          card number. By providing a payment method, you authorize us and
          Stripe to charge it for the subscription and any applicable taxes.
        </p>
        <p>
          <strong>Taxes.</strong> Prices may not include sales, use, or
          similar taxes. Where we are required to collect them, they will be
          added to your charge.
        </p>
        <p>
          <strong>Failed payments.</strong> If a renewal payment fails, we may
          retry it and may suspend or terminate your access until payment is
          received.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Cancellation and refunds">
        <p>
          <strong>Cancel anytime.</strong> You can cancel your subscription at
          any time from your account page or by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          . Cancellation stops future renewals.
        </p>
        <p>
          <strong>Access through the paid period.</strong> After you cancel,
          you keep access to subscriber content until the end of the term you
          have already paid for. Access ends when that term ends.
        </p>
        <p>
          <strong>No prorated refunds.</strong> Subscription fees are
          non-refundable, and we do not issue partial or prorated refunds for
          unused time in a term, except where a refund is required by
          applicable law or where we choose to offer one in our sole
          discretion.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Acceptable use">
        <p>
          Your subscription grants you a limited, non-exclusive,
          non-transferable, revocable license to access and use the Service
          for your own personal use or for the internal business purposes of
          your organization. You agree that you will not, and will not allow
          anyone else to:
        </p>
        <LegalList>
          <li>
            copy, download, scrape, crawl, or otherwise extract content from
            the Service in bulk, whether manually or with automated tools;
          </li>
          <li>
            redistribute, publish, sell, rent, sublicense, or otherwise make
            subscriber content available to third parties, including by
            reproducing it in a competing product or database;
          </li>
          <li>
            resell access to the Service or share a single subscription
            across people or organizations beyond what your plan allows;
          </li>
          <li>
            circumvent, disable, or interfere with any access control,
            security feature, or rate limit of the Service;
          </li>
          <li>
            use the Service to build a product or service that competes with
            EssentialRegs, or to train a machine-learning model without our
            written permission;
          </li>
          <li>
            remove or alter any copyright, trademark, or other proprietary
            notice; or
          </li>
          <li>
            use the Service in violation of any applicable law or in a way
            that could harm the Service or other users.
          </li>
        </LegalList>
        <p>
          Ordinary use — reading entries, following cross-reference links,
          printing or saving individual entries for your own reference, and
          quoting short excerpts with attribution in your own internal work —
          is permitted.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Intellectual property">
        <p>
          <strong>Regulatory text.</strong> The underlying text of federal,
          state, and local regulations is public record. We do not claim
          ownership of it, and nothing in these Terms restricts your right to
          obtain that text from its official source.
        </p>
        <p>
          <strong>Our content.</strong> Everything else in the Service — the
          selection, arrangement, and organization of the compilation; the
          site structure and navigation; the plain-English summaries; the
          cross-reference index and links; the software; and the EssentialRegs
          name, logo, and design — is owned by us or our licensors and is
          protected by copyright, trademark, and other intellectual-property
          laws. Except for the limited license in Section 6, we reserve all
          rights.
        </p>
        <p>
          <strong>Feedback.</strong> If you send us suggestions, corrections,
          or other feedback, you grant us a perpetual, irrevocable,
          royalty-free license to use it without obligation to you.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Informational purposes only; no legal advice">
        <p>
          The Service is provided for informational and reference purposes
          only. It is not legal advice, does not create an attorney-client or
          other professional relationship, and should not be relied on as a
          substitute for the official regulatory text or for advice from a
          qualified attorney or compliance professional who knows your
          specific facts.
        </p>
        <p>
          EssentialRegs is not affiliated with, endorsed by, or acting on
          behalf of the Occupational Safety and Health Administration (OSHA),
          the U.S. Environmental Protection Agency (EPA), the Colorado Energy
          &amp; Carbon Management Commission (ECMC), the Colorado Department
          of Public Health and Environment (CDPHE), or any other federal,
          state, or local government agency.
        </p>
        <p>
          Regulations change. Summaries are generated with the assistance of
          artificial-intelligence tools and reviewed on a rolling basis; they
          may contain errors or omissions. In every case the official text
          published by the issuing agency controls. Our full{" "}
          <Link href="/disclaimer" className="underline underline-offset-2">
            Disclaimer
          </Link>{" "}
          is incorporated into these Terms by reference.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Disclaimer of warranties">
        <p>
          THE SERVICE AND ALL CONTENT ARE PROVIDED &ldquo;AS IS&rdquo; AND
          &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, WHETHER
          EXPRESS, IMPLIED, OR STATUTORY. TO THE FULLEST EXTENT PERMITTED BY
          LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
          NON-INFRINGEMENT, AND ANY WARRANTY THAT THE CONTENT IS ACCURATE,
          COMPLETE, CURRENT, OR ERROR-FREE, OR THAT THE SERVICE WILL BE
          UNINTERRUPTED OR SECURE. YOU USE THE SERVICE AT YOUR OWN RISK.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Limitation of liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, ESSENTIALREGS AND ITS
          OWNERS, OFFICERS, EMPLOYEES, CONTRACTORS, AND SUPPLIERS WILL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS,
          REVENUE, DATA, OR BUSINESS OPPORTUNITY, OR FOR ANY REGULATORY FINE,
          PENALTY, ENFORCEMENT ACTION, OR COMPLIANCE COST, ARISING OUT OF OR
          RELATED TO THE SERVICE OR THESE TERMS, HOWEVER CAUSED AND UNDER ANY
          THEORY OF LIABILITY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY
          OF SUCH DAMAGES.
        </p>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL
          CLAIMS ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS WILL
          NOT EXCEED THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE (12)
          MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.
        </p>
        <p>
          Some jurisdictions do not allow the exclusion of certain warranties
          or the limitation of certain damages. In those jurisdictions, the
          exclusions and limitations above apply to the maximum extent
          permitted.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless EssentialRegs and
          its owners, officers, employees, and contractors from any claim,
          loss, or expense (including reasonable attorneys&rsquo; fees)
          arising out of your breach of these Terms or your misuse of the
          Service.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Termination">
        <p>
          You may stop using the Service and close your account at any time
          by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          . We may suspend or terminate your access, with or without notice,
          if you breach these Terms, if required by law, or if we discontinue
          the Service. If we terminate your paid subscription for a reason
          other than your breach, we will refund the unused portion of your
          current term on a prorated basis. Sections 7 through 11 and 13
          through 15 survive termination.
        </p>
      </LegalSection>

      <LegalSection number={13} title="Changes to the Service or these Terms">
        <p>
          We may add, change, or remove features and content over time. We may
          also update these Terms. If a change is material, we will post the
          updated Terms on this page with a new &ldquo;Last updated&rdquo;
          date and, where practical, notify you by email before it takes
          effect. Continued use of the Service after a change takes effect
          means you accept the updated Terms. If you do not agree, you should
          cancel your subscription before the change takes effect.
        </p>
      </LegalSection>

      <LegalSection number={14} title="Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Colorado, USA,
          without regard to its conflict-of-laws rules. Any dispute arising
          out of or relating to these Terms or the Service will be brought
          exclusively in the state or federal courts located in Colorado, and
          you consent to the personal jurisdiction of those courts. Nothing in
          this section prevents either party from seeking relief in small
          claims court where eligible.
        </p>
      </LegalSection>

      <LegalSection number={15} title="General">
        <p>
          These Terms, together with the{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/disclaimer" className="underline underline-offset-2">
            Disclaimer
          </Link>
          , are the entire agreement between you and us about the Service. If
          any provision is found unenforceable, the rest remain in effect.
          Our failure to enforce a provision is not a waiver of it. You may
          not assign these Terms without our consent; we may assign them in
          connection with a merger, acquisition, or sale of assets.
        </p>
      </LegalSection>

      <LegalSection number={16} title="Contact">
        <p>
          Questions about these Terms? Email{" "}
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
