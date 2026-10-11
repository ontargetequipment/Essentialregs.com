import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { emblemDataUrl } from "@/components/Emblem";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// The site-wide Open Graph image (every page without its own): the paper
// background, the ER emblem (src/components/Emblem.tsx) at 160px, the name in
// Source Serif 4 Bold and the site description beneath. Static, so it is
// rendered once at build. The font is the unmodified Google Fonts file
// (src/assets/fonts, SIL Open Font License); satori cannot read woff2.

export const alt = `${SITE_NAME} — ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// globals.css tokens: --color-paper, --color-ink, --color-ink-soft.
const PAPER = "#f7f5f0";
const INK = "#1e2422";
const INK_SOFT = "#4b544f";

export default async function OpengraphImage() {
  const serifBold = await readFile(join(process.cwd(), "src/assets/fonts/SourceSerif4-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: PAPER,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <img src={emblemDataUrl()} width={160} height={160} alt="" />
          <div style={{ fontFamily: "Source Serif 4", fontSize: 96, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ marginTop: 48, maxWidth: 1000, fontSize: 34, lineHeight: 1.4, color: INK_SOFT }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Source Serif 4", data: serifBold, weight: 700, style: "normal" }],
    },
  );
}
