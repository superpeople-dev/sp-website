import { localeInfo, type Locale } from "@/i18n/config";

export function monthYear(value: string, locale: Locale, month: "short" | "long" = "short") {
  if (value.length === 4) return value;
  return new Intl.DateTimeFormat(localeInfo[locale].intl, { month, year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}-01T00:00:00Z`),
  );
}
