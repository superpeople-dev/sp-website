import { ImageResponse } from "next/og";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import type { Dictionary } from "@/i18n/types";
import { assetDataUrl, googleFont, imageLocale } from "@/lib/og";

// The link preview (og:image) of every page except home, which keeps its hand-made /og/<lang>.jpg:
// /og/<lang>/<page>.png, built at deploy time.

export const dynamicParams = false;

type Page = { art: string; title: (d: Dictionary) => string; line?: (d: Dictionary) => string };

const pages: Record<string, Page> = {
  servers: { art: "squad", title: (d) => d.servers.title, line: (d) => d.nav.serversHint },
  leaderboard: { art: "fight", title: (d) => d.leaderboard.title, line: (d) => d.nav.leaderboardHint },
  "bugs-and-ideas": { art: "powers", title: (d) => d.ideas.title, line: (d) => d.nav.ideasHint },
  roadmap: { art: "vehicle", title: (d) => d.plan.title, line: (d) => d.nav.roadmapHint },
  completed: { art: "tower", title: (d) => d.completed.title, line: (d) => d.nav.completedHint },
  faq: { art: "jetpack", title: (d) => d.faq.title },
  terms: { art: "fight", title: (d) => d.legal.terms },
  privacy: { art: "jetpack", title: (d) => d.legal.privacy },
};

export function generateStaticParams() {
  return locales.flatMap((lang) => Object.keys(pages).map((page) => ({ lang, image: `${page}.png` })));
}

// Barlow Condensed for Latin text (as on the site); the script's own font where it has no glyphs.
const scriptFont: Partial<Record<Locale, { family: string; weight: number }>> = {
  ru: { family: "Sofia Sans Condensed", weight: 800 },
  ja: { family: "Noto Sans JP", weight: 900 },
  ko: { family: "Noto Sans KR", weight: 900 },
  zh: { family: "Noto Sans SC", weight: 900 },
};

// Condensed Latin capitals are about half an em wide, CJK about a full em.
const widthPerChar = (locale: Locale) => ({ ja: 1, ko: 1, zh: 1, hi: 0.7 })[locale as string] ?? 0.52;
const fit = (text: string, locale: Locale, max: number, width: number) =>
  Math.min(max, Math.floor(width / (Math.max(text.length, 1) * widthPerChar(locale))));

export async function GET(_request: Request, { params }: RouteContext<"/og/[lang]/[image]">) {
  const { lang, image } = await params;
  const page = pages[image.replace(/\.png$/, "")];
  if (!isLocale(lang) || !page) return new Response("Not found", { status: 404 });

  const locale = imageLocale(lang);
  const d = dictionaries[locale];
  const upper = (text: string) => text.toLocaleUpperCase(locale);
  const tagline = upper(d.nav.tagline);
  const title = upper(page.title(d));
  const line = page.line ? upper(page.line(d)) : null;
  const text = [tagline, title, line].join("");

  const script = scriptFont[locale];
  const [latin, latinBold, own, art, logo] = await Promise.all([
    googleFont("Barlow Condensed", 800, text),
    googleFont("Barlow Condensed", 700, text),
    script ? googleFont(script.family, script.weight, text) : null,
    assetDataUrl(`og/${page.art}.jpg`, "image/jpeg"),
    assetDataUrl("sp-logo.png", "image/png"),
  ]);
  const family = script ? `Barlow Condensed, ${script.family}` : "Barlow Condensed";
  const textWidth = 1072;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: "#0a0a0c", fontFamily: family, color: "#f4f1ee" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={art} width={760} height={630} alt="" style={{ position: "absolute", top: 0, right: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage:
              "linear-gradient(90deg, #0a0a0c 0%, #0a0a0c 38%, rgba(10,10,12,0.82) 55%, rgba(10,10,12,0.35) 78%, rgba(10,10,12,0.15) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, bottom: 0, width: 1200, height: 10, background: "#ef4438" }} />
        <div style={{ display: "flex", flexDirection: "column", width: 1200, height: 620, padding: "60px 64px 56px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
            <img src={logo} width={118} height={54} alt="" />
            <div style={{ marginLeft: 24, fontSize: 26, fontWeight: 700, letterSpacing: 1.5, color: "#d9d4cf" }}>{tagline}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", maxWidth: textWidth }}>
            <div style={{ fontSize: fit(title, locale, 150, textWidth), fontWeight: 800, lineHeight: 1 }}>{title}</div>
            {line && (
              <div style={{ marginTop: 14, fontSize: fit(line, locale, 72, textWidth), fontWeight: 800, lineHeight: 1.05, color: "#ef4438" }}>
                {line}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Barlow Condensed", data: latin, weight: 800, style: "normal" },
        { name: "Barlow Condensed", data: latinBold, weight: 700, style: "normal" },
        ...(script && own
          ? [
              { name: script.family, data: own, weight: 800 as const, style: "normal" as const },
              { name: script.family, data: own, weight: 700 as const, style: "normal" as const },
            ]
          : []),
      ],
    },
  );
}
