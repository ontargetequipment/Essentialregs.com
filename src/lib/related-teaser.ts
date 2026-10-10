import { isPublicReaderReg } from "@/lib/destination";

/**
 * What a visitor without access may see of one related provision on the
 * public teaser (fetchRelatedTeaser, the /regs/<id> card pages). Pure, so the
 * tests can pin it (Sprint 4, 10 Oct 2026).
 *
 * A neighbour in a regulation the visitor cannot open (anything outside
 * PUBLIC_READER_REGS) is its citation and title only, under its regulation's
 * name: no summary, no breadcrumb, and never text. Before this the teaser
 * also carried an approved summary's first paragraph and the context path,
 * which was more of a paid regulation than the focused preview it links to
 * shows. A neighbour in a public regulation (GP05) keeps what the reader
 * already shows everyone.
 */
export function teaserItem<
  T extends { reg_key: string | null; path: string | null; summary: string | null; summary_badge: unknown }
>(item: T, publicRegs?: readonly string[]): T {
  if (isPublicReaderReg(item.reg_key, publicRegs)) return item;
  return { ...item, path: null, summary: null, summary_badge: null };
}
