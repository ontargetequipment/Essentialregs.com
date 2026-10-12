import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { emblemDataUrl } from "@/components/Emblem";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// The site-wide Open Graph image (every page without its own): the paper
// background, the ER emblem (src/components/Emblem.tsx) at 160px, the name in
// Source Serif 4 Bold and the site description beneath in the Regular.
// Static, so it is rendered once at build. The fonts are the unmodified
// Google Fonts files (src/assets/fonts, SIL Open Font License); satori cannot
// read woff2.

// The description opens with the site name, so the alt text is the description alone.
export const alt = SITE_DESCRIPTION;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// globals.css tokens: --color-paper, --color-ink, --color-ink-soft.
const PAPER = "#f7f5f0";
const INK = "#1e2422";
const INK_SOFT = "#4b544f";

export default async function OpengraphImage() {
  const fonts = join(process.cwd(), "src/assets/fonts");
  const [serifBold, serifRegular] = await Promise.all([
    readFile(join(fonts, "SourceSerif4-Bold.ttf")),
    readFile(join(fonts, "SourceSerif4-Regular.ttf")),
  ]);

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
          fontFamily: "Source Serif 4",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <img src={emblemDataUrl()} width={160} height={160} alt="" />
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ marginTop: 48, maxWidth: 1000, fontSize: 34, fontWeight: 400, lineHeight: 1.4, color: INK_SOFT }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Source Serif 4", data: serifBold, weight: 700, style: "normal" },
        { name: "Source Serif 4", data: serifRegular, weight: 400, style: "normal" },
      ],
    },
  );
}
