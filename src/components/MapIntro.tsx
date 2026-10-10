import Link from "next/link";
import { provisionDestination } from "@/lib/destination";
import { citeLabel, citeRegKey } from "@/lib/premise-notes";
import type { IntroSentence } from "@/lib/question-maps";

/**
 * A question map's introduction, sentence by sentence, each with the
 * provisions that support it as small links (9 Oct 2026), the way a premise
 * note shows them. Shared by /search?mode=ask and /sample (Sprint 4,
 * 10 Oct 2026). Each citation opens where provisionDestination says for
 * this viewer: the exact provision in the reader for a subscriber or a
 * GP05 citation, the focused preview for a visitor and anything else.
 */
export function MapIntro({ factors, hasAccess }: { factors: IntroSentence[]; hasAccess: boolean }) {
  return (
    <p data-testid="map-intro" className="mt-2 text-sm leading-relaxed text-ink-soft">
      {factors.map((sentence, i) => (
        <span key={i}>
          {i > 0 && " "}
          {sentence.text}
          {sentence.cites.length > 0 && (
            <span className="whitespace-nowrap text-xs text-muted">
              {" "}
              {sentence.cites.map((id, j) => (
                <span key={id}>
                  {j > 0 && ", "}
                  <Link href={provisionDestination({ id, reg_key: citeRegKey(id) }, { hasAccess })} className="underline hover:text-accent">
                    {citeLabel(id)}
                  </Link>
                </span>
              ))}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
