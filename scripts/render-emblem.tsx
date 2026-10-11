/**
 * Writes the two emblem files Next serves as icons, from the one definition
 * in src/components/Emblem.tsx:
 *   - src/app/icon.svg        the favicon (rounded, any size)
 *   - src/app/favicon.ico     16 and 32 px, for browsers that ask for
 *                             /favicon.ico (it was the stock Next.js mark)
 *   - src/app/apple-icon.png  180 x 180, square: iOS rounds it itself
 * Run after changing the emblem: `npx tsx scripts/render-emblem.tsx`.
 * scripts/emblem.test.ts checks both are current.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { emblemDataUrl, emblemSvg } from "../src/components/Emblem";

export const APPLE_ICON_SIZE = 180;
const FAVICON_SIZES = [16, 32] as const;

/** The emblem as PNG bytes, `size` px square. */
async function renderPng(size: number, square = false): Promise<Buffer> {
  const res = new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- satori renders <img>, not next/image
    <img src={emblemDataUrl({ square })} width={size} height={size} alt="" />,
    { width: size, height: size },
  );
  return Buffer.from(await res.arrayBuffer());
}

/** The Apple touch icon's PNG bytes. */
export function renderAppleIcon(): Promise<Buffer> {
  return renderPng(APPLE_ICON_SIZE, true);
}

/** favicon.ico: one PNG-compressed entry per size (ICO allows PNG since Vista). */
export async function renderFaviconIco(): Promise<Buffer> {
  const pngs = await Promise.all(FAVICON_SIZES.map((size) => renderPng(size)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(FAVICON_SIZES[i], 0); // width
    e.writeUInt8(FAVICON_SIZES[i], 1); // height
    e.writeUInt8(0, 2); // no palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

async function main() {
  const app = join(process.cwd(), "src", "app");
  await writeFile(join(app, "icon.svg"), emblemSvg());
  await writeFile(join(app, "favicon.ico"), await renderFaviconIco());
  await writeFile(join(app, "apple-icon.png"), await renderAppleIcon());
  console.log("wrote src/app/icon.svg, src/app/favicon.ico and src/app/apple-icon.png");
}

if (process.argv[1]?.endsWith("render-emblem.tsx")) void main();
