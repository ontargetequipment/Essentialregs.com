/**
 * The pure parts of the reader's "go to a provision" behaviour
 * (RegulationReader.tsx): the popup eyebrow, the row labels the return
 * trail prints, the trail itself and the "which row is the reader on"
 * lookup. No React, no DOM writes, so scripts/reader-nav.test.ts can run
 * them under jsdom against a rendered regulation. Dependency-free: this is
 * in the client bundle.
 */
import { publicDateKey } from "@/lib/dates";
import type { ReaderModel, ReaderRow } from "@/lib/reader-client";
import { regKeyOf, regulationDisplayName, rootIdOf } from "@/lib/regulation-names";
import { SOURCE_DATES, type SourceDate } from "@/lib/source-dates.generated";
import type { SummaryBadgeKind } from "@/lib/snippet";
import { PROVISION_ID } from "@/lib/types";
import { provisionDestination } from "@/lib/destination";
import { TRIAL_DAYS } from "@/lib/pricing";

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
 * the row's kind: Regulation 3's parts are "sec-3-P-A", which the reader's markup
 * keeps as items (readerKindOf; kindOf calls them parts), and their citation
 * is still "PART A".
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

/**
 * The row the "Back to ..." bar should name when the reader jumps away
 * (Sprint 5, 10 Oct 2026). The viewport-top row (rowAtViewportTop) is only a
 * guess at what the visitor was reading: on a long page it is often a row
 * they scrolled past, so the bar offered "Back to V.B.6" for a visitor who
 * started somewhere else. The row they last clicked in or focused is the
 * better answer, as long as it is still on screen -- a row clicked minutes
 * ago and scrolled far away is not where they are now.
 *
 *   touchedId  the row (id) the visitor most recently clicked in or moved
 *              focus into, or null when they have not touched any
 *   topId      the viewport-top row, the fallback
 *   onScreen   whether a row is currently in the reading pane
 *
 * Returns null only when there is neither.
 */
export function originRowId(
  touchedId: string | null | undefined,
  topId: string | null | undefined,
  onScreen: (id: string) => boolean
): string | null {
  if (touchedId && onScreen(touchedId)) return touchedId;
  return topId ?? null;
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
 * The regulation key of a link to a WHOLE document -- "/regulations/8",
 * "/regulations/gp12", with or without a query string, and no hash naming a
 * provision (hashTargetOf decides those). The importer writes such a link
 * for a citation that resolves only to a document ("Regulation Number 8" in
 * GP12 XII.E); the reader previews the document through its root row
 * (documentRootOf) instead of leaving the page. Lower-cased, letters and
 * digits only; null for anything else (another path, a provision hash,
 * junk).
 */
const DOCUMENT_HREF = /^\/regulations\/([A-Za-z0-9]{1,20})(?:\?[^#]*)?$/;
export function documentKeyOf(href: string | null | undefined): string | null {
  const m = href ? DOCUMENT_HREF.exec(href) : null;
  return m ? m[1].toLowerCase() : null;
}

/** The root row's id of a whole-document link ("/regulations/8" -> "sec-8-top-REG-8"), or null when the link is not one. */
export function documentRootOf(href: string | null | undefined): string | null {
  const key = documentKeyOf(href);
  return key ? rootIdOf(key) : null;
}

/**
 * The date line of a whole-document preview, from the manifest through the
 * generated table: "Effective 07/15/2026" for a rule, "Issued 05/28/2026"
 * for a general permit, "Current as of 09/10/2026" for an eCFR subpart. null
 * for a document whose date we do not hold.
 */
export function documentDateLine(key: string | null | undefined, dates: Readonly<Record<string, SourceDate>> = SOURCE_DATES): string | null {
  if (!key) return null;
  const d = dates[key.toLowerCase()];
  if (!d) return null;
  const date = formatUsDate(d.date);
  if (d.kind === "issued") return `Issued ${date}`;
  if (d.kind === "as_of") return `Current as of ${date}`;
  return `Effective ${date}`;
}

/**
 * The line under a reader page's title (trust copy pass, 9 Oct 2026):
 * "Current through 07/15/2026 · source checked 10/08/2026".
 *
 *   Current through  the version date of the document we hold, the same
 *                    manifest-generated SOURCE_DATES the previews use
 *                    (documentDateLine): a rule's effective date, a general
 *                    permit's issue date, an eCFR as-of date.
 *   source checked   the root row's last_verified_date, which the importer
 *                    writes as the day it last imported (and so compared) the
 *                    corpus copy with the source. freshness.py's weekly check
 *                    only reports; it does not write a per-document date, so
 *                    this column is the one record of when a copy was last
 *                    checked.
 *
 * Either half is left out when its date is not held; null when neither is.
 */
export function sourceStatusLine(
  key: string | null | undefined,
  lastVerified: string | null | undefined,
  dates: Readonly<Record<string, SourceDate>> = SOURCE_DATES
): string | null {
  const held = key ? dates[key.toLowerCase()] : undefined;
  const through = held ? `Current through ${formatUsDate(held.date)}` : null;
  // last_verified_date is a `date` column ("2026-10-08"): a calendar day, printed
  // as written. A value that carries a time is an instant and reads on the
  // America/Denver calendar (Sprint 5, 10 Oct 2026; publicDateKey).
  const v = publicDateKey(lastVerified);
  const checked = v ? `${through ? "source checked" : "Source checked"} ${formatUsDate(v)}` : null;
  const parts = [through, checked].filter((x): x is string => x !== null);
  return parts.length ? parts.join(" \u00b7 ") : null;
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
 * The version of a document we hold (pipeline/sources/manifest.json through
 * the generated src/lib/source-dates.generated.ts): a rule's effective date,
 * a permit's issuance date or an eCFR as-of date. null for an unknown key.
 */
export function sourceDateOf(key: string | null | undefined): SourceDate | null {
  if (!key) return null;
  return SOURCE_DATES[key.toLowerCase()] ?? null;
}

/** "2026-07-15" -> "07/15/2026", the way the AQCC prints effective dates. Anything else is returned as is. */
export function formatUsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

/**
 * The effective date a citing provision prints for the regulation it cites,
 * read from the text that FOLLOWS the clicked link in its paragraph:
 * "Section I.B.33 and Section II.A.46 (Adopted: 04/18/2025, Effective:
 * 06/14/2025)" gives "06/14/2025". Only a parenthetical in the next 200
 * characters counts, and only when nothing between the link and it names
 * another regulation or a CFR part (then it is that document's date, not
 * this one's). Dates come back as MM/DD/YYYY, zero-padded; null otherwise.
 */
const PRINTED_EFFECTIVE =
  /^([^]{0,200}?)\(\s*Adopted:?\s*\d{1,2}\/\d{1,2}\/\d{4}\s*[,;]?\s*Effective:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*\)/i;
export function printedEffectiveDate(textAfterLink: string | null | undefined): string | null {
  if (!textAfterLink) return null;
  const m = PRINTED_EFFECTIVE.exec(textAfterLink);
  if (!m) return null;
  if (/\b(?:Regulation|C\.?F\.?R\.?|C\.R\.S\.|U\.S\.C\.)\b/i.test(m[1])) return null;
  return `${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}/${m[4]}`;
}

/** "GP01 was issued 07/23/2025" / "Regulation 26 took effect 01/14/2026" / "40 CFR Part 60 Subpart OOOOb is current as of 09/10/2026". */
function datedName(name: string, d: SourceDate): string {
  const date = formatUsDate(d.date);
  if (d.kind === "issued") return `${name} was issued ${date}`;
  if (d.kind === "as_of") return `${name} is current as of ${date}`;
  return `${name} took effect ${date}`;
}

/**
 * The preview popup's version line for a link into another regulation, or
 * null when none is due: the citing document (`originKey`, this page) must
 * predate the cited regulation's current date (`targetKey`); a document of
 * the same age or newer, or one whose date is unknown, gets no line. With
 * the effective date the citing provision prints for the cited regulation
 * (`printed`, see printedEffectiveDate):
 *   "GP12 cites Regulation 7 as effective 06/14/2025; shown is the current
 *    text, effective 07/15/2026. Numbering may differ."
 * without one:
 *   "GP01 was issued 07/23/2025; shown is the current Regulation 7,
 *    effective 07/15/2026. Numbering may differ."
 * When the popup also shows the renumbered line (renumberedNote), which
 * already names both documents and says the numbering moved, the line
 * names neither again and drops its last sentence:
 *   "GP12 cites the version effective 06/14/2025; shown is the current
 *    text, effective 07/15/2026."
 */
export function versionNote(
  originKey: string | null | undefined,
  targetKey: string | null | undefined,
  printed: string | null,
  withRenumbered = false,
  dates: Readonly<Record<string, SourceDate>> = SOURCE_DATES
): string | null {
  if (!originKey || !targetKey) return null;
  const origin = dates[originKey.toLowerCase()];
  const target = dates[targetKey.toLowerCase()];
  if (!origin || !target) return null;
  if (origin.date >= target.date) return null;
  const originName = documentShortName(originKey);
  const targetName = regulationDisplayName(targetKey);
  const current = `effective ${formatUsDate(target.date)}`;
  if (withRenumbered) {
    return printed
      ? `${originName} cites the version effective ${printed}; shown is the current text, ${current}.`
      : `${datedName(originName, origin)}; shown is the current text, ${current}.`;
  }
  return printed
    ? `${originName} cites ${targetName} as effective ${printed}; shown is the current text, ${current}. Numbering may differ.`
    : `${datedName(originName, origin)}; shown is the current ${targetName}, ${current}. Numbering may differ.`;
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

/** The fields of /api/provision/<id> the reader's preview uses (src/lib/provision-preview.ts). */
export type ProvisionPreviewPayload = {
  id: string;
  citation: string;
  title?: string;
  html: string;
  summary?: { overview: string; badge: { kind: SummaryBadgeKind; label: string } | null } | null;
};

/**
 * What /api/provision/<id> answers for a viewer the corpus is closed to
 * (Sprint 4, 10 Oct 2026; src/lib/provision-preview.ts): not a refusal but a
 * label -- which provision it is and where it sits -- so the reader can say
 * "this is in the full corpus" instead of sending the click into a 404.
 * Never any text or summary.
 */
export type LockedPreviewPayload = {
  locked: true;
  id: string;
  reg_key: string;
  citation: string;
  title: string;
  path: string | null;
};

/** Whether a payload is the locked label for `targetId` (checked before isUsablePreview, which needs html). */
export function isLockedPreview(data: unknown, targetId: string): data is LockedPreviewPayload {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<LockedPreviewPayload>;
  return (
    d.locked === true &&
    d.id === targetId &&
    typeof d.citation === "string" &&
    typeof d.title === "string" &&
    `${d.citation}${d.title}`.trim().length > 0
  );
}

function escapeLockedHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The popup for a locked cross-regulation target (Sprint 4, 10 Oct 2026):
 * the regulation's name as the eyebrow, the citation as the title, the
 * provision's own title on the line below (the popup's note line), and a
 * panel that says it is in the full corpus with the two ways forward -- the
 * trial, and the focused preview (what the provision is, where it sits, no
 * text). For a whole document (a root row) the title is the document's
 * title, the citation moves to the note line, and "See what's in it" is the
 * regulation's preview page. Every string from the payload is escaped here;
 * `panelHtml` is the only markup, and nothing in it comes unescaped from
 * the network. Pure, so scripts/reader-nav.test.ts can check it.
 */
export function lockedPopup(
  data: LockedPreviewPayload,
  asDocument: boolean
): { eyebrow: string; title: string; note: string | null; panelHtml: string } {
  const key = regKeyOf(data.id) ?? data.reg_key;
  const name = key ? regulationDisplayName(key) : data.id;
  // The title with its own citation taken off the front is the caller's
  // business (the API sends the stored title); show it only when it adds
  // something to the citation.
  const title = data.title && data.title !== data.citation ? data.title : "";
  const previewHref = asDocument
    ? `/regulations/${encodeURIComponent(key)}/preview`
    : provisionDestination({ id: data.id, reg_key: key }, { hasAccess: false, publicRegs: [] });
  const what = asDocument ? name : `${name} ${data.citation}`;
  const panelHtml =
    `<section class="locked-destination" data-testid="locked-destination">` +
    (data.path && !asDocument ? `<p class="locked-path">${escapeLockedHtml(data.path)}</p>` : "") +
    `<p class="locked-heading">${escapeLockedHtml(what)} is in the full corpus.</p>` +
    `<p class="locked-sub">Start your ${TRIAL_DAYS}-day trial to open it.</p>` +
    `<div class="locked-actions">` +
    `<a class="locked-primary" href="/signup">Start your ${TRIAL_DAYS}-day trial</a>` +
    `<a class="locked-secondary" href="${escapeLockedHtml(previewHref)}">See what&#39;s in it</a>` +
    `</div></section>`;
  if (asDocument) {
    const heading = title || data.citation || name;
    const citation = data.citation && data.citation !== name && data.citation !== heading ? data.citation : null;
    return { eyebrow: name, title: heading, note: citation, panelHtml };
  }
  return { eyebrow: name, title: data.citation || data.id, note: title || null, panelHtml };
}

/**
 * Whether a /api/provision payload can fill the preview: the row asked for,
 * with a heading (citation or title) and text. Anything else -- the wrong
 * id, a payload with no heading and no text -- must not open a popup; the
 * reader follows the link instead (the fifth review, 9 Oct 2026, found PHMSA
 * cross-part links opening an empty preview with "Go to full section" on "#").
 */
export function isUsablePreview(data: unknown, targetId: string): data is ProvisionPreviewPayload {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<ProvisionPreviewPayload>;
  if (d.id !== targetId || typeof d.html !== "string") return false;
  const heading = `${d.citation ?? ""}${d.title ?? ""}`.trim();
  return heading.length > 0;
}
