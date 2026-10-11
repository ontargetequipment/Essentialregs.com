/**
 * The href of a cross-regulation link (`a.xref-external-reg`) in its two
 * forms, and the one place that converts and reads them (Sprint 8, 11 Oct
 * 2026). Pure and dependency-light, so the browser (RegulationReader, the
 * tour) and the server (the visitor's reader body) share it.
 *
 *   reader form   /regulations/7#sec-7-B-I-C-1       what the importer writes and
 *                 /regulations/7?cited=I.B.33#sec-... what a subscriber's cached body keeps
 *                 /regulations/8
 *   preview form  /regulations/7/preview?p=sec-7-B-I-C-1[&cited=I.B.33]
 *                 /regulations/8/preview             what a visitor's body carries
 *
 * Why a visitor's body carries the preview form (ninth outside review, 11
 * Oct 2026, logged out): the reader form is a 404 for every regulation that
 * is not public, so right-click, copy link, middle-click and JavaScript-off
 * all ended on an error page and only an in-page click (the reader's popup)
 * was rescued. The preview form is a page that exists for everyone. The
 * popup still intercepts the click as before: hashTargetOf / documentRootOf
 * (reader-nav.ts) and linkTargetOf (tour.ts) read BOTH forms through the
 * functions below, so a visitor's click finds the same target either way.
 */
import { isPublicReaderReg, provisionDestination } from "@/lib/destination";
import { regKeyOf } from "@/lib/regulation-names";
import { PROVISION_ID } from "@/lib/types";

function safeDecode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** A provision id as the reader and the API accept it: the strict pattern, bounded, "sec-<reg>-" shaped. */
function validId(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 200 || !PROVISION_ID.test(raw)) return null;
  return regKeyOf(raw) ? raw : null;
}

const REG_KEY = /^[A-Za-z0-9]+$/;

/** "/regulations/<reg>" + optional query + optional hash: the reader form, nothing below the regulation. */
const READER_HREF = /^\/regulations\/([A-Za-z0-9]+)(\?[^#]*)?(#.*)?$/;

/** "/regulations/<reg>/preview" + optional query + optional hash: the preview form. */
const PREVIEW_HREF = /^\/regulations\/([A-Za-z0-9]{1,20})\/preview(?:\?([^#]*))?(?:#.*)?$/;

/**
 * The preview form of one reader-form href, for a viewer with no access
 * (provisionDestination with hasAccess false), or the href unchanged when it
 * is not a reader-form link:
 *
 *   /regulations/7#sec-7-B-I-C-1            -> /regulations/7/preview?p=sec-7-B-I-C-1
 *   /regulations/7?cited=I.B.33#sec-7-B-I-B-34
 *                                           -> /regulations/7/preview?p=sec-7-B-I-B-34&cited=I.B.33
 *   /regulations/8                          -> /regulations/8/preview
 *   /regulations/7#sec-7-top-REG-7, junk hash -> /regulations/7/preview (the document)
 *   a regulation whose reader is open to everyone (GP05, PUBLIC_READER_REGS)
 *                                           -> unchanged (the reader is where it opens)
 *   anything else (an external link, /test-methods/..., /regulations/7/preview...)
 *                                           -> unchanged
 *
 * Other query parameters the importer put in the href (`?cited=`, which the
 * popup's renumbered-definition note reads) are kept on the new URL.
 */
export function visitorXrefHref(href: string, publicRegs?: readonly string[]): string {
  const m = READER_HREF.exec(href);
  if (!m) return href;
  const [, pathReg, query = "", hash = ""] = m;
  const decoded = hash ? safeDecode(hash.slice(1)) : null;
  const target = validId(decoded);
  // A provision of the regulation it names; a link to a document's root row is a link to the document.
  const provision = target && !target.includes("-top-REG-") ? target : null;
  const key = (provision && regKeyOf(provision)) || pathReg;
  if (!REG_KEY.test(key) || isPublicReaderReg(key, publicRegs)) return href;
  // Whatever the importer carried besides the provision itself.
  const rest = query
    .slice(1)
    .split("&")
    .filter((part) => part !== "" && !/^p=/.test(part));
  const base = provision
    ? provisionDestination({ id: provision, reg_key: key }, { hasAccess: false, publicRegs })
    : `/regulations/${key}/preview`;
  return rest.length ? `${base}${base.includes("?") ? "&" : "?"}${rest.join("&")}` : base;
}

/**
 * The provision a preview-form href names (`/regulations/7/preview?p=<id>`),
 * or null: no `p`, a `p` that is not a provision id, or one of another
 * regulation than the path's (the preview page applies the same test, so a
 * link the page would ignore is not a target here either).
 */
export function previewTargetOf(href: string | null | undefined): string | null {
  const m = href ? PREVIEW_HREF.exec(href) : null;
  if (!m) return null;
  let p: string | null;
  try {
    p = new URLSearchParams(m[2] ?? "").get("p");
  } catch {
    return null;
  }
  const id = validId(p);
  return id && regKeyOf(id) === m[1] ? id : null;
}
