/**
 * A visitor's reader body points its cross-regulation links at pages that
 * exist (Sprint 8, 11 Oct 2026). Server only: it uses sanitize-html, which
 * the browser bundle must not pull in (the href rule itself is xref-href.ts).
 *
 * The importer writes a citation of another regulation as
 * <a class="xref-external-reg" href="/regulations/7#sec-7-B-I-C-1">, which
 * is the READER of Regulation 7 -- a 404 for a visitor, who can read only the
 * public GP05 reader (PUBLIC_READER_REGS). Until now only an in-page click was
 * rescued (the reader's popup); right-click, copy link, middle-click and
 * JavaScript-off opened an error page (ninth outside review, logged out).
 * The visitor's body is rendered live (resolveReaderPage, reader-page.ts), so
 * the rewrite happens there, on the rows before they are rendered:
 *
 *   /regulations/7#sec-7-B-I-C-1 -> /regulations/7/preview?p=sec-7-B-I-C-1
 *   /regulations/8               -> /regulations/8/preview
 *
 * A subscriber's body is the cached render shared by every subscriber
 * (fetchRenderedReader) and is never touched: its links stay reader hrefs.
 * Same-regulation references (spans with data-target) are not links to
 * another regulation and are left alone.
 */
import sanitizeHtmlLib from "sanitize-html";
import { sanitizeHtml } from "@/lib/regulation-pure";
import type { Provision } from "@/lib/types";
import { visitorXrefHref } from "@/lib/xref-href";

const XREF_EXTERNAL = /(^|\s)xref-external-reg(\s|$)/;

/**
 * One row's (already sanitised) text with every a.xref-external-reg href in
 * its preview form for a visitor (visitorXrefHref). Markup, text and every
 * other attribute are untouched. The result is sanitised again, as
 * rewriteSubtreeLinks (preview-subtree.ts) does, so nothing the rewrite adds
 * can be anything the first pass would have removed.
 */
export function rewriteVisitorXrefs(html: string, publicRegs?: readonly string[]): string {
  if (!html.includes("xref-external-reg")) return html;
  const rewritten = sanitizeHtmlLib(html, {
    // The input has been through sanitizeHtml: no script, style or event
    // handler is in it, and this pass only re-points hrefs. `allowedTags:
    // false` is the library's "keep every tag" and is why it needs
    // allowVulnerableTags (it warns about script and style, which cannot be here).
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href;
        if (href === undefined || !XREF_EXTERNAL.test(attribs.class ?? "")) return { tagName, attribs };
        const next = visitorXrefHref(href, publicRegs);
        return { tagName, attribs: next === href ? attribs : { ...attribs, href: next } };
      },
    },
  });
  return sanitizeHtml(rewritten);
}

/** The rows of a visitor's reader with their text rewritten (rewriteVisitorXrefs); rows without a cross-regulation link are returned as they are. */
export function visitorReaderRows(rows: Provision[], publicRegs?: readonly string[]): Provision[] {
  return rows.map((row) => {
    const full_text = rewriteVisitorXrefs(row.full_text, publicRegs);
    return full_text === row.full_text ? row : { ...row, full_text };
  });
}
