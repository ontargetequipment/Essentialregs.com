import Link from "next/link";
import { LegalSection } from "@/components/LegalPage";

/**
 * The disclaimer, in full, as one shared piece of content. /disclaimer
 * (src/app/disclaimer/page.tsx) is the public page; the signup gate
 * (src/app/signup/SignupSteps.tsx) renders the very same text inline and
 * makes the visitor scroll through it before the account form appears
 * (owner, 28 Sep 2026). One source, so the two can never drift. When the
 * wording changes in substance, bump DISCLAIMER_VERSION in
 * src/lib/disclaimer.ts as well as LegalPage's LAST_UPDATED.
 */

const SUPPORT_EMAIL = "support@essentialregs.com";

/**
 * The disclaimer's own "Last updated" line (the other legal pages keep
 * LegalPage's shared date). Same revision as DISCLAIMER_VERSION in
 * src/lib/disclaimer.ts: 4 Oct 2026, when section 9 became "What 'AI
 * reviewed' means" (1 Oct 2026 had defined "Reviewed").
 */
export const DISCLAIMER_LAST_UPDATED = "October 4, 2026";

/** The anchor of section 9, which the summary badges' tooltips refer to as "the Disclaimer page". */
export const REVIEWED_SECTION_ID = "what-reviewed-means";

/** The amber "read this first" box above the numbered sections. */
export function DisclaimerIntro() {
  return (
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
  );
}

/** The numbered sections. */
export function DisclaimerSections() {
  return (
    <>
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
          assistance of artificial-intelligence tools and checked by a
          separate automated review, not by a person. They are intended as an
          orientation aid, not a
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

      {/* Owner decisions, 29 Sep and 4 Oct 2026: every summary carries a
          review-status badge ("AI reviewed · <date>" or "AI-generated · not
          yet reviewed"), no summary is presented as reviewed by a person,
          and this section is the definition the badge's tooltip points at. */}
      <LegalSection number={9} title={"What \u201cAI reviewed\u201d means"} id={REVIEWED_SECTION_ID}>
        <p>
          Every plain-English summary on EssentialRegs carries a label. A
          summary marked &ldquo;AI reviewed&rdquo; with a date was written by
          an artificial-intelligence model from the official regulation text
          and was then checked against that text by a separate automated
          review, which corrected the errors it found. No summary on this
          site is presented as having been reviewed by a person. A summary
          marked &ldquo;AI-generated &middot; not yet reviewed&rdquo; was
          written from the official text but has not had that second check,
          and should be read with that in mind. In every case the official
          text controls, a label is not a guarantee of accuracy, and the
          summary is not legal advice.
        </p>
      </LegalSection>
    </>
  );
}
