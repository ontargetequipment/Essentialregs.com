// DRAFT — attorney review required before launch
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "EssentialRegs is an informational reference only. Not legal advice, not affiliated with OSHA, EPA, ECMC, CDPHE, or any agency. The official regulatory text always controls.",
};

const SUPPORT_EMAIL = "support@essentialregs.com";

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      intro={
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <p className="font-semibold">Please read this before relying on anything on this site.</p>
          <p className="mt-1">
            EssentialRegs is a reference tool built to help you find and
            understand oil and gas regulations faster. It is not the
            regulation, it is not legal advice, and it is not the government.
            The official text published by the issuing agency always
            controls.
          </p>
        </div>
      }
    >
      <LegalSection number={1} title="Informational and reference purposes only">
        <p>
          All content on EssentialRegs — including regulatory text,
          plain-English summaries, cross-reference links, section headings,
          navigation, and any notes or commentary — is provided for general
          informational and reference purposes only. It is intended to help
          you locate and orient yourself within applicable regulations. It is
          not intended to be, and should not be treated as, a complete or
          authoritative statement of your legal obligations.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Not legal advice">
        <p>
          Nothing on this site is legal advice, and nothing on this site
          should be relied on as a substitute for advice from a licensed
          attorney or qualified compliance professional who has reviewed your
          specific facts, operations, permits, and locations. Regulatory
          applicability depends on details that a general reference cannot
          account for: facility type and size, emissions thresholds, well
          classification, permit conditions, dates of construction or
          modification, local ordinances, and more.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Not affiliated with any government agency">
        <p>
          EssentialRegs is an independent, privately operated service. It is
          not affiliated with, endorsed by, sponsored by, or acting on behalf
          of the Occupational Safety and Health Administration (OSHA), the
          U.S. Environmental Protection Agency (EPA), the Colorado Energy
          &amp; Carbon Management Commission (ECMC), the Colorado Department
          of Public Health and Environment (CDPHE) or its Air Pollution
          Control Division (APCD), the Colorado Air Quality Control
          Commission (AQCC), or any other federal, state, county, or municipal
          government agency. Agency names are used only to identify the
          source of the regulations described.
        </p>
      </LegalSection>

      <LegalSection number={4} title="The official source controls">
        <p>
          Regulations are amended, renumbered, repealed, and reinterpreted
          regularly. While we work to keep the site current, there will be
          periods when content here lags behind the official version. Every
          entry on EssentialRegs links to the official source published by
          the issuing agency (for example, the Code of Federal Regulations,
          the Colorado Code of Regulations, or the agency&rsquo;s own rules
          page). In any conflict between content on this site and the
          official source, the official source controls. Always verify
          current requirements against the official source before making a
          compliance decision.
        </p>
      </LegalSection>

      <LegalSection number={5} title="AI-generated summaries may contain errors">
        <p>
          The plain-English summaries on EssentialRegs are generated with the
          assistance of artificial-intelligence tools and are reviewed on a
          rolling basis. They are intended as an orientation aid, not a
          restatement of the rule. AI-generated text can misstate thresholds,
          dates, exceptions, and defined terms; omit conditions; or describe
          a requirement as applying more broadly or narrowly than it actually
          does. You must verify every summary against the underlying
          regulatory text before relying on it. If you find an error, please
          tell us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection number={6} title="Cross-references are aids, not authority">
        <p>
          Cross-reference links are generated by parsing citations in the
          regulatory text and matching them to other provisions in our
          database. A link may point to the wrong revision of a provision,
          may be missing where a citation was not recognized, or may resolve
          to a provision that has since been renumbered. Treat links as a
          navigation convenience and confirm the target against the official
          source.
        </p>
      </LegalSection>

      <LegalSection number={7} title="No professional relationship">
        <p>
          Using this site, subscribing, or contacting us does not create an
          attorney-client, consultant-client, or any other professional or
          fiduciary relationship between you and EssentialRegs or the people
          who build it. Any communication with us is not privileged.
        </p>
      </LegalSection>

      <LegalSection number={8} title="No warranty; your responsibility">
        <p>
          The content is provided &ldquo;as is&rdquo; without warranty of any
          kind. We do not warrant that it is accurate, complete, current, or
          fit for any particular purpose. Compliance with applicable law is
          your responsibility. To the fullest extent permitted by law, we are
          not liable for any loss, fine, penalty, enforcement action, or other
          consequence resulting from reliance on this site. The full
          disclaimer of warranties and limitation of liability are set out in
          our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms of Service
          </Link>
          , into which this Disclaimer is incorporated.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
