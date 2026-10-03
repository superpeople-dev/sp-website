import type { Metadata, Viewport } from "next";
import {
  Barlow,
  Noto_Sans_Devanagari,
  Noto_Sans_JP,
  Noto_Sans_KR,
  Noto_Sans_SC,
  Sofia_Sans,
} from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { Consent } from "@/components/Consent";
import { MotionProvider } from "@/components/motion";
import { ScrollReset } from "@/components/ScrollReset";
import { isLocale, localeInfo, locales } from "@/i18n/config";
import { I18nProvider } from "@/i18n/context";
import { getDictionary } from "@/i18n/dictionaries";
import { pageMetadata } from "@/lib/seo";
import "../globals.css";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
// The game's own typefaces (licensed): Refrigerator Deluxe for every heading (it covers Cyrillic too),
// CG Fiorello Condensed for the home headline (Latin only; other scripts fall back per glyph).
const display = localFont({
  src: [
    { path: "../../assets/fonts/refrigerator-deluxe-400.woff2", weight: "400" },
    { path: "../../assets/fonts/refrigerator-deluxe-700.woff2", weight: "700" },
    { path: "../../assets/fonts/refrigerator-deluxe-800.woff2", weight: "800" },
    { path: "../../assets/fonts/refrigerator-deluxe-900.woff2", weight: "900" },
  ],
  variable: "--font-display",
});
const headline = localFont({ src: "../../assets/fonts/cg-fiorello-condensed.woff2", variable: "--font-headline" });
const cyrillicBody = Sofia_Sans({ subsets: ["cyrillic", "latin"], variable: "--font-body", preload: false, display: "swap" });
const japanese = Noto_Sans_JP({ weight: ["400", "700", "900"], variable: "--font-jp", preload: false, display: "swap" });
const korean = Noto_Sans_KR({ weight: ["400", "700", "900"], variable: "--font-kr", preload: false, display: "swap" });
const chinese = Noto_Sans_SC({ weight: ["400", "700", "900"], variable: "--font-sc", preload: false, display: "swap" });
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-deva",
  preload: false,
  display: "swap",
});

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang);
}

export const viewport: Viewport = { themeColor: "#ef4438", colorScheme: "dark" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const cjk = { ja: japanese.variable, ko: korean.variable, zh: chinese.variable, hi: devanagari.variable }[lang as string] ?? "";
  const latin = `${lang === "ru" ? cyrillicBody.variable : body.variable} ${display.variable} ${headline.variable}`;

  return (
    <html lang={localeInfo[lang].htmlLang} className={`${latin} ${cjk}`}>
      <body>
        <I18nProvider locale={lang} t={getDictionary(lang)}>
          <MotionProvider>{children}</MotionProvider>
          <ScrollReset />
          <Consent />
        </I18nProvider>
      </body>
    </html>
  );
}
