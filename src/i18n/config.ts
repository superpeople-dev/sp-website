export const locales = ["en", "fr", "es", "pt", "de", "ru", "hi", "ja", "ko", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

type LocaleInfo = { name: string; short: string; htmlLang: string; hreflang: string; intl: string; og: string };

export const localeInfo: Record<Locale, LocaleInfo> = {
  en: { name: "English", short: "EN", htmlLang: "en", hreflang: "en", intl: "en-US", og: "en_US" },
  fr: { name: "Français", short: "FR", htmlLang: "fr", hreflang: "fr", intl: "fr-FR", og: "fr_FR" },
  es: { name: "Español", short: "ES", htmlLang: "es", hreflang: "es", intl: "es-ES", og: "es_ES" },
  pt: { name: "Português", short: "PT", htmlLang: "pt-BR", hreflang: "pt", intl: "pt-BR", og: "pt_BR" },
  de: { name: "Deutsch", short: "DE", htmlLang: "de", hreflang: "de", intl: "de-DE", og: "de_DE" },
  ru: { name: "Русский", short: "RU", htmlLang: "ru", hreflang: "ru", intl: "ru-RU", og: "ru_RU" },
  hi: { name: "हिन्दी", short: "HI", htmlLang: "hi", hreflang: "hi", intl: "hi-IN", og: "hi_IN" },
  ja: { name: "日本語", short: "JA", htmlLang: "ja", hreflang: "ja", intl: "ja-JP", og: "ja_JP" },
  ko: { name: "한국어", short: "KO", htmlLang: "ko", hreflang: "ko", intl: "ko-KR", og: "ko_KR" },
  zh: { name: "简体中文", short: "中文", htmlLang: "zh-Hans", hreflang: "zh-Hans", intl: "zh-CN", og: "zh_CN" },
};

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

export const pagePaths = ["", "/servers", "/leaderboard", "/bugs-and-ideas", "/roadmap", "/completed", "/faq", "/terms", "/privacy"] as const;
export type PagePath = (typeof pagePaths)[number];

export const localeHref = (locale: Locale, page: PagePath = "") =>
  locale === defaultLocale ? page || "/" : `/${locale}${page}`;

export const localePath = (locale: Locale) => localeHref(locale);

export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
