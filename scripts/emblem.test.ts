/**
 * The ER emblem (src/components/Emblem.tsx) is the one definition behind the
 * favicon, the Apple touch icon, the header mark and the Open Graph image.
 * The three icon files in src/app are generated from it; if this fails, run
 * `npx tsx scripts/render-emblem.tsx` and commit what it writes.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMBLEM_ACCENT, Emblem, emblemSvg } from "../src/components/Emblem";
import { APPLE_ICON_SIZE, renderAppleIcon, renderFaviconIco } from "./render-emblem";

const app = join(process.cwd(), "src", "app");

test("the emblem's green is the site's accent token", async () => {
  const css = await readFile(join(app, "globals.css"), "utf8");
  assert.match(css, new RegExp(`--color-accent:\\s*${EMBLEM_ACCENT};`, "i"));
});

test("a rounded square, radius 18% of the side, with white letters", () => {
  const svg = emblemSvg();
  assert.match(svg, /viewBox="0 0 100 100"/);
  assert.match(svg, /<rect width="100" height="100" rx="18" fill="#2f5d50"\/>/);
  assert.equal(svg.match(/<path d="[^"]+" fill="#ffffff"\/>/g)?.length, 2);
  assert.match(emblemSvg({ square: true }), /rx="0"/);
});

test("the inline mark draws the same shapes as the SVG file", () => {
  const html = renderToStaticMarkup(createElement(Emblem, { size: 28 }));
  assert.match(html, /width="28" height="28"/);
  assert.match(html, /aria-hidden="true"/);
  const paths = (s: string) => [...s.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(paths(html), paths(emblemSvg()));
});

test("src/app/icon.svg is current", async () => {
  assert.equal(await readFile(join(app, "icon.svg"), "utf8"), emblemSvg());
});

test("src/app/apple-icon.png is current and 180 px", async () => {
  const png = await readFile(join(app, "apple-icon.png"));
  assert.equal(png.readUInt32BE(16), APPLE_ICON_SIZE);
  assert.equal(png.readUInt32BE(20), APPLE_ICON_SIZE);
  assert.ok(png.equals(await renderAppleIcon()), "re-run scripts/render-emblem.tsx");
});

test("src/app/favicon.ico is current", async () => {
  const ico = await readFile(join(app, "favicon.ico"));
  assert.ok(ico.equals(await renderFaviconIco()), "re-run scripts/render-emblem.tsx");
});
