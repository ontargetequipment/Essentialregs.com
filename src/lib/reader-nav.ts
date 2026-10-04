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
import { PROVISION_ID } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Cross-regulation navigation: the preview popup for a link into another
// regulation and the "Back to <origin regulation>" bar the target reader
// shows. All pure string work, so scripts/reader-nav.test.ts covers it.
// ---------------------------------------------------------------------------

/** A provision id as the reader and the API accept it: the strict pattern, bounded, and "sec-<reg>-" shaped. */
export function validProvisionId(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 200 || !PROVISION_ID.test(raw)) return null;
  return regKeyOf(raw) ? raw : null;
}

/** The provision id in a link's "#hash", or null when there is none / it is not a provision id. */
export function hashTargetOf(href: string | null | undefined): string | null {
  if (!href) return null;
  const i = href.indexOf("#");
  if (i < 0) return null;
  let raw = href.slice(i + 1);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep the raw text; validProvisionId decides */
  }
  return validProvisionId(raw);
}

/**
 * "/regulations/<reg>#<id>", with `?from=<origin>` between them when the
 * origin is known and `cited=<printed section>` when the link is a
 * renumbered definition citation (see citedParamOf).
 */
export function regulationHref(targetId: string, fromId?: string | null, cited?: string | null): string {
  const key = regKeyOf(targetId) ?? "";
  const params: string[] = [];
  if (fromId) params.push(`from=${encodeURIComponent(fromId)}`);
  if (cited) params.push(`cited=${encodeURIComponent(cited)}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  return `/regulations/${key}${qs}#${targetId}`;
}

/**
 * A printed section citation as the importer carries it in a renumbered
 * link's `?cited=`: "I.B.33", "II.A.46", "I.D.3.b.(x)". Bounded, letters,
 * digits, dots and parentheses only; a trailing dot is dropped. Anything
 * else is null -- the value is printed into the page.
 */
const CITED_SECTION = /^[IVXLCDM]{1,7}(?:\.[A-Za-z0-9]{1,4})*(?:\.?\([A-Za-z0-9]{1,4}\))*\.?$/;
export function validCitedSection(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 40) return null;
  const s = raw.trim();
  return CITED_SECTION.test(s) ? s.replace(/\.$/, "") : null;
}

/** The `?cited=` of a link's href ("/regulations/7?cited=I.B.33#sec-7-B-I-B-34" -> "I.B.33"), validated, else null. */
export function citedParamOf(href: string | null | undefined): string | null {
  if (!href) return null;
  const q = href.indexOf("?");
  if (q < 0) return null;
  const h = href.indexOf("#", q);
  const query = href.slice(q + 1, h < 0 ? undefined : h);
  try {
    return validCitedSection(new URLSearchParams(query).get("cited"));
  } catch {
    return null;
  }
}

/**
 * The popup's one-line note under the title for a renumbered definition
 * citation: "GP12 cites this as Section I.B.33; in the current Regulation 7
 * it is I.B.34." `currentCitation` is the target row's citation as stored
 * ("I.B.34."); when it is unknown the note says only that the numbering
 * differs.
 */
export function renumberedNote(originName: string, cited: string, currentCitation: string | null | undefined, targetName: string): string {
  const current = (currentCitation ?? "").trim().replace(/\.$/, "");
  const head = `${originName} cites this as Section ${cited};`;
  return current ? `${head} in the current ${targetName} it is ${current}.` : `${head} the current ${targetName} numbers it differently.`;
}

/**
 * The query string with the named reader parameters removed ("?x=1&from=..."
 * -> "?x=1"; "" when nothing is left). Other parameters keep their order.
 */
export function stripReaderParams(search: string, names: readonly string[]): string {
  const params = new URLSearchParams(search);
  for (const n of names) params.delete(n);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * How a document is named in a line of text: a general permit by its number
 * ("GP12"), the way permit holders say it; anything else by its display
 * name ("Regulation 7").
 */
export function documentShortName(key: string | null | undefined): string {
  if (!key) return "";
  return /^gp\d+$/i.test(key) ? key.toUpperCase() : regulationDisplayName(key);
}

/**
 * The `?from=` of a reader URL, validated: a provision id of a DIFFERENT
 * regulation than `currentKey`, else null (absent, junk, or the same
 * regulation -- the in-document trail owns that case).
 */
export function foreignOriginOf(search: string, currentKey: string | null): string | null {
  const from = validProvisionId(new URLSearchParams(search).get("from"));
  if (!from || !currentKey) return null;
  return regKeyOf(from)!.toLowerCase() === currentKey.toLowerCase() ? null : from;
}

/** Roman numerals I..XX: the section level of the AQCC regulations and the general permits. */
const SECTION_ROMAN = /^(?:XX|X?(?:IX|IV|V?I{0,3}))$/;
const isSectionRoman = (s: string) => s !== "" && SECTION_ROMAN.test(s);

/**
 * A provision id's short citation, derived from the id alone -- no row, no
 * network: "sec-gp12-I-A-8-d-(i)" -> "I.A.8.d.(i)"; "sec-7-B-I-B-33" ->
 * "Part B · I.B.33" (a leading single letter that is not itself a section
 * numeral and is followed by one is the Part); "sec-3-P-A" -> "Part A";
 * "sec-3-A-APPENDIX-B" -> "Appendix B". Consecutive parenthesised levels
 * join without a dot, as citations are stored ("II.B.4.a.(i)(A)"). null for
 * a regulation root or an id that yields nothing.
 */
export function citationLabelFromId(id: string): string | null {
  const key = regKeyOf(id);
  if (!key || id.includes("-top-REG-")) return null;
  let segs = id.slice(`sec-${key}-`.length).split("-").filter(Boolean);
  if (!segs.length) return null;
  if (segs.length >= 2) {
    const word = segs[segs.length - 2];
    const last = segs[segs.length - 1];
    if (/^(PART|APPENDIX|ATTACHMENT|SUBPART)$/.test(word)) return `${word[0]}${word.slice(1).toLowerCase()} ${last}`;
    if (segs.length === 2 && word === "P") return `Part ${last}`;
  }
  let part = "";
  if (segs.length > 1 && /^[A-Z]$/.test(segs[0]) && !isSectionRoman(segs[0]) && isSectionRoman(segs[1])) {
    part = `Part ${segs[0]}`;
    segs = segs.slice(1);
  }
  let cit = "";
  for (const seg of segs) {
    cit += cit && !(seg.startsWith("(") && cit.endsWith(")")) ? `.${seg}` : seg;
  }
  return [part, cit].filter(Boolean).join(" · ") || null;
}

/**
 * The return bar's text for an origin in another regulation: the
 * regulation's display name (never the key), then the short citation when
 * the id yields one -- "Regulation 7 · Part B · I.B.33". A general permit
 * goes by its number alone ("GP12 · I.A"), the way permit holders say it;
 * the bar has no room for "APCD General Permit GP12".
 */
export function originTrailLabel(originId: string): string {
  return [documentShortName(regKeyOf(originId)), citationLabelFromId(originId)].filter(Boolean).join(" · ");
}
