import type { Metadata } from "next";
import Link from "next/link";
import {
  TEST_METHOD_CATEGORY_LABELS,
  TEST_METHOD_CATEGORY_ORDER,
  TEST_METHODS,
  testMethodsInCategory,
} from "@/data/test-methods";

export const metadata: Metadata = {
  title: "Test Methods",
  description:
    "EssentialRegs reference pages for the EPA test methods and performance specifications the regulations on this site cite, each linked to the method text on the eCFR.",
};

/**
 * The Test Methods index: every entry in src/data/test-methods.json, grouped
 * by category in TEST_METHOD_CATEGORY_LABELS order. Free and public -- no
 * entitlement check, no subscribe panel: the page reads nothing but the data
 * file, so it is prerendered once and served as static HTML to everyone.
 */
export default function TestMethodsIndexPage() {
  const groups = TEST_METHOD_CATEGORY_ORDER.map((category) => ({
    category,
    label: TEST_METHOD_CATEGORY_LABELS[category],
    methods: testMethodsInCategory(category),
  })).filter((g) => g.methods.length > 0);

  return (
    <div className="mx-auto max-w-shell px-6 py-12">
      <div className="max-w-reading">
        <h1 className="font-serif text-section font-bold tracking-tight text-ink">Test Methods</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          EssentialRegs reference pages describing the EPA test methods the
          regulations on this site cite: {TEST_METHODS.length} methods and
          performance specifications from 40 CFR Part 60 and Part 63. Each
          page says what the method measures, how it works, what it needs
          and when a rule calls for it, and links to the authoritative text
          on the eCFR. These pages are not the method text; the method as
          published in the CFR controls.
        </p>

        {groups.map((g) => (
          <section key={g.category} className="mt-10" aria-labelledby={`cat-${g.category}`}>
            <h2 id={`cat-${g.category}`} className="font-mono text-eyebrow uppercase text-tag">
              {g.label}
            </h2>
            <ul className="mt-3 flex flex-col">
              {g.methods.map((m) => (
                <li key={m.slug} className="border-t border-line">
                  <Link
                    href={`/test-methods/${m.slug}`}
                    className="group block py-3 hover:bg-accent-soft/60 sm:-mx-3 sm:rounded-md sm:px-3"
                  >
                    <p className="font-serif text-card font-semibold text-ink group-hover:text-accent">
                      {m.shortName}
                      <span className="font-normal text-ink-soft"> — {m.officialTitle}</span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{m.measures}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          Methods not listed here (NIOSH, CARB, ASTM and other EPA methods the
          corpus cites only in passing) are left as plain text in the
          regulations.
        </p>
      </div>
    </div>
  );
}
