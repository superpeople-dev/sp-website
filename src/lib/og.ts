import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locale } from "@/i18n/config";

// Shared by the link preview images (app/og/…): fonts, pictures and colours.

export const ogSize = { width: 1200, height: 630 };
export const ogColors = { ink: "#0a0a0c", paper: "#f4f1ee", dim: "#d9d4cf", muted: "#bdb7b2", red: "#ef4438", blue: "#8fb0ff" };

// Only the glyphs in `text`, as TrueType (what Google Fonts serves to a client without a browser
// user agent). Glyphs these fonts lack (Korean, emoji…) are fetched by the renderer itself.
export async function googleFont(family: string, weight: number, text: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
  ).then((res) => res.text());
  const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!src) throw new Error(`No ${family} ${weight} from Google Fonts`);
  return fetch(src).then((res) => res.arrayBuffer());
}

export const assetDataUrl = async (file: string, type: string) =>
  `data:${type};base64,${(await readFile(join(process.cwd(), "src/assets", file))).toString("base64")}`;

// The image renderer does not shape Devanagari (vowel signs land on the wrong letter), so the
// Hindi pages get the English image text rather than misspelled Hindi.
export const imageLocale = (locale: Locale): Locale => (locale === "hi" ? "en" : locale);
