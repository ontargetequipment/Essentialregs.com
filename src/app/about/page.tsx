import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "About",
  description:
    "EssentialRegs is a cross-referenced, plain-English reference for Colorado oil & gas regulations, built by someone who does this compliance work every day.",
};

export default function AboutPage() {
  return (
    <LegalPage
      title="About EssentialRegs"
      intro={
        <p>
          EssentialRegs is a subscription reference for the federal and
          Colorado regulations that govern oil and gas operations — with the
          cross-references already resolved and a plain-English summary next
          to every section.
        </p>
      }
    >
      <LegalSection title="What it is">
        <p>
          Every regulation on EssentialRegs is broken into its individual
          provisions and presented in a browsable reader with a sidebar table
          of contents, the full official text, a short plain-English summary,
          and clickable links for every citation the section makes to another
          rule. When Reg 7 says &ldquo;as defined in Section I.B.4,&rdquo; you
          click it and read Section I.B.4 in place. When a Colorado rule
          points at 40 CFR 60, you follow the link instead of opening a
          second PDF and searching.
        </p>
        <p>
          Each entry also links to the official source published by the
          issuing agency, because the official text is what controls. We are
          a reference layer on top of the regulations, not a replacement for
          them.
        </p>
      </LegalSection>

      <LegalSection title="Who it's for">
        <LegalList>
          <li>
            <strong>EHS managers and safety directors</strong> who need to
            answer &ldquo;what does the rule actually say?&rdquo; several
            times a week without re-reading a 200-page PDF.
          </li>
          <li>
            <strong>Small and mid-sized operators</strong> who do not have a
            regulatory department and need one person to be able to find the
            right section fast.
          </li>
          <li>
            <strong>Compliance consultants</strong> who work across multiple
            clients and multiple rules and want one place to check
            applicability, thresholds, and deadlines.
          </li>
          <li>
            Anyone else — engineers, landmen, attorneys, students — who
            works with these rules and would rather navigate than scroll.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Why it exists">
        <p>
          EssentialRegs was built by a founder who works in Colorado
          environmental compliance professionally and was tired of chasing
          cross-references across PDFs. The regulations that apply to a
          Colorado oil and gas facility are spread across federal code, state
          air-quality rules, and state energy-commission rules, and they cite
          each other constantly. Answering one question often meant having
          four documents open and losing track of which one you were in.
        </p>
        <p>
          The rules are public. The problem was never access — it was
          navigation. EssentialRegs is the tool the founder wanted to have on
          the second monitor: the whole corpus, structured, linked, and
          summarized, so the time goes into the compliance decision instead
          of into finding the paragraph.
        </p>
      </LegalSection>

      <LegalSection title="What's covered today">
        <p>The current corpus includes:</p>
        <LegalList>
          <li>
            <strong>Colorado Regulation 3</strong> (5 CCR 1001-5) —
            stationary source permitting and Air Pollutant Emission Notice
            requirements.
          </li>
          <li>
            <strong>Colorado Regulation 7</strong> (5 CCR 1001-9) — control
            of ozone precursors, hydrocarbons, and greenhouse gases,
            including the oil and gas sections.
          </li>
          <li>
            <strong>Colorado Regulation 26</strong> (5 CCR 1001-31) —
            greenhouse gas reporting and intensity requirements for oil and
            gas operations.
          </li>
          <li>
            <strong>40 CFR Part 60, Subpart OOOOb</strong> — federal New
            Source Performance Standards for crude oil and natural gas
            facilities.
          </li>
        </LegalList>
        <p>
          More is coming: additional CDPHE and ECMC rules, the federal OSHA
          and EPA provisions that apply to oil and gas, and county-level
          requirements. The{" "}
          <Link href="/regulations" className="underline underline-offset-2">
            Regulations
          </Link>{" "}
          page always shows what is live, and the{" "}
          <Link href="/sample" className="underline underline-offset-2">
            sample
          </Link>{" "}
          page lets you inspect real entries before subscribing.
        </p>
      </LegalSection>

      <LegalSection title="How updates work">
        <p>
          Agencies amend these rules regularly. When a regulation is revised,
          we re-import the current official text, regenerate the affected
          provisions and their cross-references, and re-run summaries for any
          section whose text changed. Each entry links to the official
          source so you can confirm the effective version yourself. We aim to
          reflect adopted revisions promptly, but there will be a lag between
          an agency&rsquo;s adoption and our update — during that window the
          official source, not this site, controls.
        </p>
      </LegalSection>

      <LegalSection title="An honest note about the summaries">
        <p>
          The plain-English summaries are generated with the help of
          AI tools and reviewed by the founder on a rolling basis, starting
          with the sections that get the most use. Reviewed or not, a summary
          is an orientation aid — it tells you what a section is about so
          you can decide whether to read it, not what the section requires
          of you. Always read the regulatory text before acting on it, and
          if you spot a summary that is wrong or misleading, please{" "}
          <Link href="/contact" className="underline underline-offset-2">
            tell us
          </Link>
          . Our full{" "}
          <Link href="/disclaimer" className="underline underline-offset-2">
            Disclaimer
          </Link>{" "}
          explains the limits of the service in more detail.
        </p>
      </LegalSection>

      <LegalSection title="Independent and ad-free">
        <p>
          EssentialRegs is not affiliated with OSHA, EPA, ECMC, CDPHE, or any
          other government agency. It is funded entirely by subscriptions:
          no advertising, no sponsored content, and no selling of subscriber
          data. See the{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
