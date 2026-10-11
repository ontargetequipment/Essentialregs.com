import type { Metadata } from "next";
import Link from "next/link";
import { CorpusCoverage } from "@/components/CorpusCoverage";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";
import { fetchSnapshotDateWith, type ChangelogClient } from "@/lib/changelog";
import { corpusCoverage, type CorpusCoverage as Coverage } from "@/lib/corpus-coverage";
import { formatDayMonthYear } from "@/lib/dates";
import { fetchRegulationRoots } from "@/lib/regulation";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "About",
  description:
    "EssentialRegs is a cross-referenced, plain-English reference for state and federal regulations, now featuring Colorado and federal oil & gas rules, built by someone who does this compliance work every day.",
};

/**
 * "What's covered today" is computed, not written (Sprint 8, 11 Oct 2026):
 * the released regulation roots grouped by jurisdiction
 * (src/lib/corpus-coverage.ts, the same grouping the /states/colorado and
 * /federal indexes use), dated by the changelog snapshot's computed_at in
 * America/Denver. Both reads are anonymous-safe service-role reads with no
 * visitor session, like the index pages (fetchRegulationRoots drops a staged
 * document, src/lib/release.ts).
 *
 * Rendering: server-rendered on demand, like /states, /federal and
 * /changelog. The root layout reads the session cookie (AuthStatus), and in
 * this app that makes every route dynamic: `next build` lists /about as
 * "ƒ (Dynamic)", so a `revalidate` export here would do nothing. A release
 * therefore shows on the next request, with no cache to refresh. A database
 * problem (a timeout) degrades to a one-line note with links to the index
 * pages; the rest of the page never fails for it.
 */
async function loadCoverage(): Promise<{ coverage: Coverage | null; asOf: string | null }> {
  try {
    const [roots, computedAt] = await Promise.all([
      fetchRegulationRoots(),
      fetchSnapshotDateWith(createAdminClient() as unknown as ChangelogClient),
    ]);
    return { coverage: corpusCoverage(roots), asOf: formatDayMonthYear(computedAt) || null };
  } catch (error) {
    console.error("about: corpus coverage unavailable:", error instanceof Error ? error.message : error);
    return { coverage: null, asOf: null };
  }
}

export default async function AboutPage() {
  const { coverage, asOf } = await loadCoverage();
  return (
    <LegalPage
      title="About EssentialRegs"
      lastUpdated="October 11, 2026"
      intro={
        <p>
          EssentialRegs is a subscription reference for state and federal
          regulations — with the cross-references linked and a plain-English
          summary beside the official text. It currently features the
          Colorado and federal rules that govern oil and gas operations.
        </p>
      }
    >
      <LegalSection title="What it is">
        <p>
          Each regulation on EssentialRegs is broken into its individual
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
        {coverage ? (
          <CorpusCoverage coverage={coverage} asOf={asOf} />
        ) : (
          <p>
            The list of what the corpus holds could not be loaded just now.
            The{" "}
            <Link href="/states" className="underline underline-offset-2">
              State
            </Link>{" "}
            and{" "}
            <Link href="/federal" className="underline underline-offset-2">
              Federal
            </Link>{" "}
            regulations pages show it.
          </p>
        )}
        <p>
          Counts are of released documents, read from the database. The{" "}
          <Link href="/states" className="underline underline-offset-2">
            State
          </Link>{" "}
          and{" "}
          <Link href="/federal" className="underline underline-offset-2">
            Federal
          </Link>{" "}
          regulations pages always show what is live, and the{" "}
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
          The plain-English summaries are AI-generated and then checked
          against the source text by a separate automated check (the badge
          reads &ldquo;AI-generated · automated check against source
          text&rdquo;); no summary on this site is presented as reviewed by
          a person. Checked or not, a summary
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
          EssentialRegs is not affiliated with EPA, PHMSA, ECMC, CDPHE, or any
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
