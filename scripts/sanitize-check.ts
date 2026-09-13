/**
 * Standalone assertions for `sanitizeHtml()` (src/lib/regulation.ts).
 * Run with: npx tsx scripts/sanitize-check.ts
 *
 * Exercises exactly the cases called out in the security audit: reader
 * cross-reference markup that must survive, and XSS/DOM-collision vectors
 * that must not.
 */
import { sanitizeHtml } from "../src/lib/regulation";

let failures = 0;

function check(label: string, actual: string, predicate: (html: string) => boolean) {
  const pass = predicate(actual);
  console.log(`${pass ? "PASS" : "FAIL"} - ${label}`);
  console.log(`  output: ${actual}`);
  if (!pass) failures++;
}

check(
  'xref span with data-target survives',
  sanitizeHtml('<span class="xref" data-target="sec-7-x">II.A.4</span>'),
  (html) =>
    html.includes('class="xref"') &&
    html.includes('data-target="sec-7-x"')
);

check(
  "div#backdrop loses its id (reserved id collision)",
  sanitizeHtml('<div id="backdrop">content</div>'),
  (html) => !/id="backdrop"/.test(html)
);

check(
  "style=\"position:fixed\" is stripped",
  sanitizeHtml('<div style="position:fixed">x</div>'),
  (html) => !html.includes("position")
);

check(
  'style="text-align:center" survives',
  sanitizeHtml('<div style="text-align:center">x</div>'),
  (html) => html.includes("text-align:center") || html.includes("text-align: center")
);

check(
  'javascript: href is stripped',
  sanitizeHtml('<a href="javascript:alert(1)">click</a>'),
  (html) => !html.includes("javascript:")
);

check(
  "http image src is stripped (img restricted to https/data)",
  sanitizeHtml('<img src="http://x/y.png">'),
  (html) => !html.includes("http://x/y.png")
);

check(
  'https link gains rel="noopener noreferrer"',
  sanitizeHtml('<a href="https://x">link</a>'),
  (html) => html.includes('href="https://x"') && html.includes('rel="noopener noreferrer"')
);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
