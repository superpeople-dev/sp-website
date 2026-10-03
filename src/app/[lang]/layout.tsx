import type { Metadata, Viewport } from "next";
import {
  Barlow,
  Noto_Sans_Devanagari,
  Noto_Sans_JP,
  Noto_Sans_KR,
  Noto_Sans_SC,
  Saira_Condensed,
  Saira_Extra_Condensed,
  Sofia_Sans,
  Sofia_Sans_Condensed,
} from "next/font/google";
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
// Free lookalikes of the game's typefaces: Saira Condensed for Refrigerator Deluxe (every heading),
// Saira Extra Condensed for CG Fiorello Condensed (the home headline). Neither has Cyrillic, so
// Russian keeps Sofia Sans Condensed for both.
const display = Saira_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800", "900"], variable: "--font-display" });
const headline = Saira_Extra_Condensed({ subsets: ["latin"], weight: ["800"], variable: "--font-headline" });
const cyrillicBody = Sofia_Sans({ subsets: ["cyrillic", "latin"], variable: "--font-body", preload: false, display: "swap" });
const cyrillicDisplay = Sofia_Sans_Condensed({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display",
  preload: false,
  display: "swap",
});
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
  const latin = lang === "ru" ? `${cyrillicBody.variable} ${cyrillicDisplay.variable}` : `${body.variable} ${display.variable} ${headline.variable}`;

  // data-scroll-behavior: Next turns the CSS smooth scrolling off while it scrolls on a navigation.
  // Without it, its scroll calls animate against each other and a news post opened from /news ends
  // at the bottom of the page.
  return (
    <html lang={localeInfo[lang].htmlLang} className={`${latin} ${cjk}`} data-scroll-behavior="smooth">
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
