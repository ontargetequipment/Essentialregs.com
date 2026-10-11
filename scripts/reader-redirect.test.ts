/**
 * The redirect a visitor gets for a reader they cannot open (Sprint 8, 11 Oct
 * 2026; src/lib/reader-redirect.ts, src/components/ReaderRedirect.tsx): the
 * #hash -> preview URL logic, and proof that the script the browser runs IS
 * that logic.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { ReaderRedirect } from "../src/components/ReaderRedirect";
import { plainPreviewHref, previewRedirectHref, previewRedirectTarget, redirectScript } from "../src/lib/reader-redirect";
import { regKeyOf } from "../src/lib/regulation-names";
import { PROVISION_ID } from "../src/lib/types";

test("a provision of the regulation in the hash goes to the focused preview", () => {
  assert.equal(previewRedirectHref("7", "#sec-7-B-I-C-1", ""), "/regulations/7/preview?p=sec-7-B-I-C-1");
  assert.equal(previewRedirectHref("gp12", "#sec-gp12-VI-A-1", ""), "/regulations/gp12/preview?p=sec-gp12-VI-A-1");
  assert.equal(previewRedirectHref("7", "#sec-7-P-B", ""), "/regulations/7/preview?p=sec-7-P-B");
});

test("no hash, an empty hash or a bare # go to the plain preview", () => {
  for (const hash of ["", "#", "#   "]) {
    assert.equal(previewRedirectHref("7", hash, ""), "/regulations/7/preview", JSON.stringify(hash));
  }
  assert.equal(plainPreviewHref("7"), "/regulations/7/preview");
});

test("the id is decoded, checked and encoded again", () => {
  // Parentheses are in the id alphabet; the browser may hand them over escaped (encodeURIComponent leaves them be).
  assert.equal(previewRedirectHref("7", "#sec-7-B-I-D-3-a-%28i%29", ""), "/regulations/7/preview?p=sec-7-B-I-D-3-a-(i)");
  assert.equal(previewRedirectHref("7", "#sec-7-B-I-D-3-a-(i)", ""), "/regulations/7/preview?p=sec-7-B-I-D-3-a-(i)");
  // What encodeURIComponent does escape stays escaped: a dot-and-colon id.
  assert.equal(previewRedirectHref("oooob", "#sec-oooob-60.5365b:x", ""), "/regulations/oooob/preview?p=sec-oooob-60.5365b%3Ax");
  // The same URL whichever way the hash was written.
  assert.equal(previewRedirectHref("7", "#sec-7-B-I-D-3-a-(i)", ""), previewRedirectHref("7", "#sec-7-B-I-D-3-a-%28i%29", ""));
});

test("an id of another regulation, a root row or junk falls back to the plain preview", () => {
  for (const hash of [
    "#sec-3-A-II-B-5", // another regulation's provision
    "#sec-gp05-VI-C", // ... even a public one
    "#sec-7-top-REG-7", // the document itself
    "#sec-", // not an id
    "#section-7", // not an id of the corpus
    "#<script>alert(1)</script>",
    "#sec-7-B-%3Cb%3E", // decodes to markup
    "#sec-7-B-I%20C-1", // a space
    "#%E0%A4%A", // malformed escape
    "#%", // malformed escape
    "#sec-7-" + "x".repeat(300), // too long
    "#javascript:alert(1)",
    "#sec-7-B-I-C-1&p=sec-3-A", // an injected parameter
    "#sec-7-B-I-C-1?x=1",
  ]) {
    assert.equal(previewRedirectHref("7", hash, ""), "/regulations/7/preview", hash);
  }
});

test("from= is carried when it is a provision id, and only then", () => {
  assert.equal(
    previewRedirectHref("7", "#sec-7-B-I-C-1", "?from=sec-gp05-VI-C"),
    "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C"
  );
  assert.equal(previewRedirectHref("7", "", "?from=sec-gp05-VI-C"), "/regulations/7/preview?from=sec-gp05-VI-C");
  // Among other parameters, escaped, and with other parameters dropped.
  assert.equal(
    previewRedirectHref("7", "#sec-7-B-I-C-1", "?tour=1&from=sec-gp05-VI-C&cited=I.B.33"),
    "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C"
  );
  assert.equal(
    previewRedirectHref("7", "#sec-7-B-I-C-1", "?from=sec-gp12-I-D-3-%28i%29"),
    "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp12-I-D-3-(i)"
  );
  // Junk is not carried.
  for (const search of ["?from=", "?from", "?from=%3Cb%3E", "?from=nonsense", "?from=%E0%A4%A", "?xfrom=sec-gp05-VI-C", "?from=" + "x".repeat(300)]) {
    assert.equal(previewRedirectHref("7", "#sec-7-B-I-C-1", search), "/regulations/7/preview?p=sec-7-B-I-C-1", search);
  }
  // The first from= decides.
  assert.equal(previewRedirectHref("7", "", "?from=junk&from=sec-gp05-VI-C"), "/regulations/7/preview");
});

test("the key check inside the function agrees with regKeyOf and the id check with PROVISION_ID", () => {
  const ids = ["sec-7-B-I-C-1", "sec-gp05-VI-C", "sec-oooob-60.5365b", "sec-7", "sec--x", "sec-7-", "nope", "sec-a.b-c"];
  for (const id of ids) {
    const key = regKeyOf(id);
    const expectOwn = !!key && PROVISION_ID.test(id) && key === "7" && !id.includes("-top-REG-");
    const got = previewRedirectHref("7", `#${id}`, "");
    assert.equal(got !== "/regulations/7/preview", expectOwn, id);
  }
});

/** Runs the page's inline script as a browser would, with a fake location. */
function runScript(reg: string, location: { hash: string; search: string }): string[] {
  const replaced: string[] = [];
  const context = vm.createContext({
    location: {
      get hash() {
        return location.hash;
      },
      get search() {
        return location.search;
      },
      replace: (url: string) => replaced.push(url),
    },
  });
  vm.runInContext(redirectScript(reg), context);
  return replaced;
}

test("the inline script is the tested function: it replaces the location with the same URL", () => {
  const cases: [string, string, string][] = [
    ["7", "#sec-7-B-I-C-1", ""],
    ["7", "#sec-7-B-I-C-1", "?from=sec-gp05-VI-C"],
    ["7", "", ""],
    ["7", "#sec-3-A-II-B-5", ""],
    ["gp12", "#sec-gp12-I-D-3-%28i%29", "?x=1"],
    ["7", "#%E0%A4%A", "?from=%"],
  ];
  for (const [reg, hash, search] of cases) {
    assert.deepEqual(runScript(reg, { hash, search }), [previewRedirectHref(reg, hash, search)], `${reg}${search}${hash}`);
  }
});

test("the inline script needs nothing from the module: it runs in an empty context", () => {
  // A new context has no imports, no constants and no helpers of this file's: a reference
  // the compiler left outside the function body is a ReferenceError here.
  const run = vm.runInNewContext(`(${previewRedirectTarget.toString()})`) as typeof previewRedirectTarget;
  assert.equal(run("7", "#sec-7-B-I-C-1", "?from=sec-gp05-VI-C", PROVISION_ID.source), "/regulations/7/preview?p=sec-7-B-I-C-1&from=sec-gp05-VI-C");
});

test("if the script throws, the visitor still gets the plain preview", () => {
  const replaced: string[] = [];
  const context = vm.createContext({
    location: {
      get hash(): string {
        throw new Error("boom");
      },
      search: "",
      replace: (url: string) => replaced.push(url),
    },
  });
  vm.runInContext(redirectScript("7"), context);
  assert.deepEqual(replaced, ["/regulations/7/preview"]);
});

test("the script text cannot end its own <script> element", () => {
  for (const reg of ["7", "gp05", "</script><b>", "a b"]) {
    const js = redirectScript(reg);
    assert.ok(!/<\/script/i.test(js), reg);
    assert.ok(!js.includes("<!--"), reg);
    assert.ok(!js.includes(" ") && !js.includes(" "), reg);
    // Still valid JavaScript.
    assert.doesNotThrow(() => new vm.Script(js), reg);
  }
});

test("the page: the regulation's name, a link to the plain preview, a noscript refresh, the script -- nothing else", () => {
  const html = renderToStaticMarkup(ReaderRedirect({ reg: "7", regName: "Regulation 7" }));
  assert.ok(html.includes('<a href="/regulations/7/preview"'), html);
  assert.ok(html.includes("Open the preview of Regulation 7"));
  // The refresh is inside <noscript>, so a browser that runs the script is not raced by it.
  assert.match(html, /<noscript><meta http-equiv="refresh" content="0;url=\/regulations\/7\/preview"\/><\/noscript>/);
  assert.ok(html.includes("<script>(function(){try{var f=function previewRedirectTarget("), "the inline script is the function's own source");
  // Visible text: the name, a line, the link label.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  assert.equal(text, "Regulation 7 Opening the preview… Open the preview of Regulation 7");
});
