/**
 * The pure parts of the reader's "go to a provision" behaviour
 * (RegulationReader.tsx): the popup eyebrow, the row labels the return
 * trail prints, the trail itself and the "which row is the reader on"
 * lookup. No React, no DOM writes, so scripts/reader-nav.test.ts can run
 * them under jsdom against a rendered regulation. Dependency-free: this is
 * in the client bundle.
 */
import type { ReaderModel, ReaderRow } from "@/lib/reader-client";
import { regKeyOf, regulationDisplayName } from "@/lib/regulation-names";

/** Ancestor labels the popup eyebrow prints before eliding the middle. */
export const EYEBROW_MAX_LEVELS = 4;
/** Provisions the return trail remembers. */
export const TRAIL_CAP = 10;

/** The heading words a citation can open with, stored shouting. */
const HEADING_WORD = /^(PART|APPENDIX|ATTACHMENT|SUBPART|SECTION|CHAPTER|SERIES|RULE)\b/;

/**
 * A Part/Appendix heading citation is stored shouting ("PART A",
 * "APPENDIX B"); the eyebrow and the return trail print it as a label,
 * "Part A". Only that opening heading word is re-cased: everything else in a
 * citation is numbering, or a code that must stay as it is ("VI.ZZZZ.",
 * "40 CFR Part 60 Subpart IIII", the ECMC 100 Series' all-caps terms).
 */
export function titleCaseHeading(citation: string): string {
  return citation.trim().replace(HEADING_WORD, (w) => w[0] + w.slice(1).toLowerCase());
}

/** The display name of the regulation a row belongs to: "Regulation 3", never the key. */
export function regulationNameOf(model: ReaderModel, id: string): string {
  const root = model.rows.find((r) => r.kind === "reg");
  const key = regKeyOf(id) ?? (root ? regKeyOf(root.id) : null);
  if (key) return regulationDisplayName(key, root ? { citation: root.citation } : null);
  return root?.citation ?? "";
}

/**
 * The short label of one row: the regulation's display name for the root,
 * otherwise its citation as stored ("II.B.4."), a heading word re-cased
 * ("Part A"). Never a long title, never an id. Goes by the citation, not
 * the row's kind: Regulation 3's parts are "sec-3-P-A", which kindOf files
 * under item, and their citation is still "PART A".
 */
export function rowLabel(model: ReaderModel, row: ReaderRow): string {
  if (row.kind === "reg") return regulationNameOf(model, row.id);
  return titleCaseHeading(row.citation);
}

/** Labels of a row's ancestors, top-down, the root excluded: ["Part A", "II.", "II.B."]. */
export function ancestorLabels(model: ReaderModel, id: string): string[] {
  const labels: string[] = [];
  const seen = new Set<string>([id]);
  let parent = model.byId.get(id)?.parent ?? null;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const row = model.byId.get(parent);
    if (!row) break;
    if (row.kind !== "reg") labels.unshift(rowLabel(model, row));
    parent = row.parent;
  }
  return labels;
}

/** At most `max` labels: past that, the first and the last three with "…" between. */
export function capLabels(labels: readonly string[], max = EYEBROW_MAX_LEVELS): string[] {
  if (labels.length <= max) return [...labels];
  return [labels[0], "…", ...labels.slice(-3)];
}

/**
 * The popup's eyebrow for a provision: the regulation's display name, then
 * the ancestor labels joined by " · " -- "Regulation 3 · Part A · II. · II.B."
 * for sec-3-A-II-B-4. The root alone for the root row.
 */
export function popupEyebrow(model: ReaderModel, id: string): string {
  const name = regulationNameOf(model, id);
  const labels = capLabels(ancestorLabels(model, id));
  return labels.length ? `${name} · ${labels.join(" · ")}` : name;
}

/**
 * Where the reader has "gone to" from, most recent last: the popup's "Go to
 * full section", a sidebar link or a jump-box landing push the provision
 * they left; the bar's Back button pops. In-page only, capped, and a
 * provision is not pushed twice in a row.
 */
export class ReturnTrail {
  private ids: string[] = [];
  constructor(private readonly cap = TRAIL_CAP) {}
  push(id: string): void {
    if (this.ids[this.ids.length - 1] === id) return;
    this.ids.push(id);
    if (this.ids.length > this.cap) this.ids.splice(0, this.ids.length - this.cap);
  }
  pop(): string | undefined {
    return this.ids.pop();
  }
  peek(): string | undefined {
    return this.ids[this.ids.length - 1];
  }
  clear(): void {
    this.ids.length = 0;
  }
  get length(): number {
    return this.ids.length;
  }
}

/**
 * The row the reader is on: the first row (in document order) whose bottom
 * edge is below `anchorY` viewport pixels -- the line just under the return
 * bar, where a landed target sits. Rows are #doc's direct children stacked
 * top to bottom, so their bottom edges are monotonic and a binary search
 * needs ~16 layout reads on the largest regulation, not 36,000.
 */
export function rowAtViewportTop(rows: readonly ReaderRow[], anchorY: number): ReaderRow | null {
  if (!rows.length) return null;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].el.getBoundingClientRect().bottom > anchorY) hi = mid;
    else lo = mid + 1;
  }
  return rows[lo];
}
