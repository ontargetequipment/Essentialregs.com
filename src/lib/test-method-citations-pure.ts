/**
 * The "Cited by" list on a Test Methods page (/test-methods/[slug]): the
 * provisions whose text links to the method, grouped by regulation. Pure --
 * the rows come from src/lib/test-method-citations.ts (the database read),
 * and scripts/test-method-links.test.ts proves the grouping, the ordering
 * and the cap without a database or Next.
 */
import { readerHrefFor } from "@/lib/provision-href";
import { GP_KEY, regulationDisplayName } from "@/lib/regulation-names";
import { titleWithoutCitation } from "@/lib/regulation-pure";

/** One citing provision, as fetched: the columns a navigation row needs and nothing of the text. */
export type CitingProvision = {
  id: string;
  reg_key: string;
  citation: string;
  title: string;
  sort_order: number;
};

export type CitedByRow = {
  id: string;
  /** The reader URL: /regulations/<reg>#<id> (readerHrefFor). */
  href: string;
  citation: string;
  /** The title with its own citation label removed, "" when it added nothing. */
  title: string;
};

export type CitedByGroup = {
  regKey: string;
  /** regulationDisplayName: "Regulation 7", "40 CFR Part 60 Subpart OOOOb", ... */
  name: string;
  rows: CitedByRow[];
  /** How many citing provisions of this regulation are not in `rows` (the cap). Always `rest.length`. */
  more: number;
  /**
   * The provisions past the cap, in the same order, for the "Show all"
   * disclosure under the capped list (9 Oct 2026). Rendered on the server
   * inside a <details>, so the full list needs no extra request.
   */
  rest: CitedByRow[];
};

/** The most provisions listed per regulation; the rest become a "+N more" line. */
export const CITED_BY_CAP = 50;

/**
 * The order regulations are listed in: the Colorado index's order (the
 * Procedural Rules, Common Provisions, the numbered AQCC regulations by
 * number, then the name-keyed documents, the general permits by number,
 * the ECMC rules), then the federal index's (40 CFR Part 60 subparts in
 * id order, Part 63, the PHMSA parts by number). Anything unknown last.
 */
export function regulationOrderKey(regKey: string): [number, number, string] {
  const k = regKey.toLowerCase();
  if (k === "proc") return [0, -2, k];
  if (k === "cp") return [0, -1, k];
  if (/^\d+$/.test(k)) return [0, Number(k), k];
  if (k === "aqs") return [0, 10_000, k];
  if (k === "sip") return [0, 10_001, k];
  if (GP_KEY.test(k)) return [1, Number(k.slice(2)), k];
  if (k === "ecmc") return [2, 0, k];
  if (/^(oooo[abc]?|iiii|jjjj)$/.test(k)) return [3, 0, k];
  if (k === "zzzz") return [4, 0, k];
  const part = k.match(/^p(\d{3})$/);
  if (part) return [5, Number(part[1]), k];
  return [6, 0, k];
}

export function compareRegulationKeys(a: string, b: string): number {
  const [ga, na, ka] = regulationOrderKey(a);
  const [gb, nb, kb] = regulationOrderKey(b);
  return ga - gb || na - nb || (ka < kb ? -1 : ka > kb ? 1 : 0);
}

/**
 * Groups the citing provisions by regulation (regulation order, then
 * sort_order within one), keeps at most `cap` rows per regulation and
 * counts the rest. A provision with no reg_key (the hand-written samples)
 * cannot be a corpus citation and is dropped.
 */
export function groupCitedBy(rows: CitingProvision[], cap = CITED_BY_CAP): CitedByGroup[] {
  const byReg = new Map<string, CitingProvision[]>();
  for (const r of rows) {
    if (!r.reg_key) continue;
    const list = byReg.get(r.reg_key);
    if (list) list.push(r);
    else byReg.set(r.reg_key, [r]);
  }
  return Array.from(byReg.entries())
    .sort(([a], [b]) => compareRegulationKeys(a, b))
    .map(([regKey, list]) => {
      const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const toRow = (p: CitingProvision): CitedByRow => ({
        id: p.id,
        href: readerHrefFor({ id: p.id, reg_key: p.reg_key }),
        citation: p.citation,
        title: titleWithoutCitation(p.title, p.citation),
      });
      const rest = sorted.slice(cap).map(toRow);
      return {
        regKey,
        name: regulationDisplayName(regKey),
        rows: sorted.slice(0, cap).map(toRow),
        more: rest.length,
        rest,
      };
    });
}
