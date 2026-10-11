/**
 * Where a visitor's request for a reader they cannot open goes (Sprint 8, 11
 * Oct 2026). Pure -- no Next, no database -- so scripts/reader-redirect.test.ts
 * runs the very code the browser runs.
 *
 * /regulations/7#sec-7-B-I-C-1 opened directly (a new tab, a copied link, a
 * bookmark) was a 404 for a logged-out visitor: the reader is closed to them
 * and the page said nothing was there (ninth outside review). The rule since
 * is that no cross-reference ever 404s, so the page renders a tiny redirect
 * (ReaderRedirect.tsx) to the focused preview, which exists for everyone.
 *
 * The server never sees the #hash, so the page cannot redirect with a status
 * code and keep the provision. An inline script reads location.hash instead
 * and sends the browser to /regulations/<reg>/preview?p=<id>; without
 * JavaScript, a <noscript> meta refresh and a visible link lead to the plain
 * preview of the document.
 */
import { PROVISION_ID } from "@/lib/types";

/**
 * The preview URL for a request of /regulations/<reg> with this location.hash
 * and location.search:
 *
 *   #sec-7-B-I-C-1            -> /regulations/7/preview?p=sec-7-B-I-C-1
 *   #sec-7-B-I-C-1 + ?from=sec-gp05-VI-C
 *                             -> /regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C
 *   no hash, a hash of another regulation's provision, a root row, junk,
 *   a malformed escape        -> /regulations/7/preview
 *
 * The id is decoded, checked (the pattern the rest of the app validates a
 * provision id with, 200 characters at most, and the "sec-<reg>-" of THIS
 * regulation) and encodeURIComponent-ed again, so nothing but a well-formed
 * provision id ever reaches the URL. `from` (the preview draws "← Back to
 * ..." from it) is carried when it is a well-formed provision id; the page
 * it goes to decides whether it is a valid origin.
 *
 * THIS FUNCTION IS ALSO THE SCRIPT. redirectScript below inlines its source
 * with toString(), so the browser runs exactly what the tests run. That
 * constrains it: no reference to anything outside its own body (no import, no
 * module constant, no helper), and plain syntax (no spread, classes or
 * optional chaining -- a compiler would turn those into helpers it could not
 * carry along). `idPattern` is PROVISION_ID's source, passed in instead of
 * repeated here.
 */
export function previewRedirectTarget(reg: string, hash: string, search: string, idPattern: string): string {
  const base = "/regulations/" + reg + "/preview";
  const ok = new RegExp(idPattern);
  // Two candidates, checked the same way: the hash (p) and the first from= of the query. (No inner
  // function: a compiler that names functions would add a helper this body cannot carry.)
  const names = ["p", "from"];
  const raws = [String(hash).replace(/^#/, ""), ""];
  const pairs = String(search).replace(/^\?/, "").split("&");
  for (let i = 0; i < pairs.length; i++) {
    const eq = pairs[i].indexOf("=");
    if (eq < 0 || pairs[i].slice(0, eq) !== "from") continue;
    raws[1] = pairs[i].slice(eq + 1).replace(/\+/g, " ");
    break;
  }
  const params: string[] = [];
  for (let k = 0; k < names.length; k++) {
    let id = "";
    try {
      id = decodeURIComponent(raws[k]);
    } catch {
      id = "";
    }
    if (id.length === 0 || id.length > 200 || !ok.test(id) || !/^sec-[^-]+-/.test(id)) continue;
    // The provision must be one of THIS regulation; its root row is the document, which the plain preview is.
    if (k === 0 && (/^sec-([^-]+)-/.exec(id)![1] !== reg || id.indexOf("-top-REG-") >= 0)) continue;
    params.push(names[k] + "=" + encodeURIComponent(id));
  }
  return params.length ? base + "?" + params.join("&") : base;
}

/** previewRedirectTarget with the app's provision-id pattern: what the tests call. */
export function previewRedirectHref(reg: string, hash: string, search: string): string {
  return previewRedirectTarget(reg, hash, search, PROVISION_ID.source);
}

/** Text safe inside an inline <script>: JSON, with "<" (so "</script", "<!--") and the two line separators escaped. */
function jsLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

/**
 * The inline script of the redirect page for `reg`: previewRedirectTarget's
 * own source, called with this page's location, and location.replace so the
 * Back button does not return to the page that redirects again. If anything
 * throws, the visitor still gets the plain preview rather than a dead page
 * (the link under it is there as well).
 *
 * `reg` is the route segment, already restricted to letters and digits by the
 * page; it is escaped anyway.
 */
export function redirectScript(reg: string): string {
  const plain = jsLiteral(`/regulations/${reg}/preview`);
  return (
    `(function(){try{var f=${previewRedirectTarget.toString()};` +
    `location.replace(f(${jsLiteral(reg)},location.hash,location.search,${jsLiteral(PROVISION_ID.source)}));` +
    `}catch(e){location.replace(${plain});}})();`
  );
}

/** Where the no-JavaScript meta refresh and the visible link go: the preview of the document, with nothing of the request in it. */
export function plainPreviewHref(reg: string): string {
  return `/regulations/${reg}/preview`;
}
