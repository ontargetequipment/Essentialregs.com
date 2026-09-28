// DRAFT — attorney review required before launch
import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { DisclaimerIntro, DisclaimerSections } from "@/components/DisclaimerText";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "EssentialRegs is an informational reference only. Not legal advice, not affiliated with EPA, PHMSA, ECMC, CDPHE, or any agency. The official regulatory text always controls.",
};

// The text itself lives in src/components/DisclaimerText.tsx, shared with
// the signup gate that makes every new account read it first.
export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" intro={<DisclaimerIntro />}>
      <DisclaimerSections />
    </LegalPage>
  );
}
