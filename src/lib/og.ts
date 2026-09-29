import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locale } from "@/i18n/config";

// Shared by the link preview images (app/og/…): fonts, pictures and colours.

export const ogSize = { width: 1200, height: 630 };
export const ogColors = { ink: "#0a0a0c", paper: "#f4f1ee", dim: "#d9d4cf", muted: "#bdb7b2", red: "#ef4438", blue: "#8fb0ff" };

// Only the glyphs in `text`, as TrueType (what Google Fonts serves to a client without a browser
// user agent). Glyphs these fonts lack (Korean, emoji…) are fetched by the renderer itself.
// Many images are drawn at once during a build, and Google Fonts then sometimes answers with an
// error page: a download only counts when it really is a font, and is tried three times.
export async function googleFont(family: string, weight: number, text: string) {
  // Digits and a few signs are always asked for too: a text with no glyph of this font at all (a
  // Japanese title from a Latin font) gets no font back.
  const glyphs = `${text} 0123456789-…`;
  const url = `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}&text=${encodeURIComponent(glyphs)}`;
  let problem = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    try {
      const css = await fetch(url).then((res) => (res.ok ? res.text() : ""));
      const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
      if (!src) {
        problem = "no font in the stylesheet";
        continue;
      }
      const font = await fetch(src).then((res) => (res.ok ? res.arrayBuffer() : null));
      if (font && isFont(font)) return font;
      problem = "the download was not a font";
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`No ${family} ${weight} from Google Fonts: ${problem}`);
}

// TrueType (00 01 00 00, "true") or OpenType ("OTTO") files, which is what the renderer reads.
function isFont(data: ArrayBuffer) {
  const head = new Uint8Array(data.slice(0, 4));
  const tag = String.fromCharCode(...head);
  return (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) || tag === "true" || tag === "OTTO";
}

export const assetDataUrl = async (file: string, type: string) =>
  `data:${type};base64,${(await readFile(join(process.cwd(), "src/assets", file))).toString("base64")}`;

// The image renderer does not shape Devanagari (vowel signs land on the wrong letter), so the
// Hindi pages get the English image text rather than misspelled Hindi.
export const imageLocale = (locale: Locale): Locale => (locale === "hi" ? "en" : locale);
