import type { MetadataRoute } from "next";
import type { FeedbackItem } from "reflet-sdk";
import hero from "@/assets/hero.jpg";
import { locales, type PagePath } from "@/i18n/config";
import { slugOf } from "@/lib/board";
import { listByStatus, safely } from "@/lib/reflet";
import { itemSuffix, languageAlternates, localeUrl, ogImagePath, siteUrl } from "@/lib/seo";
import { pageOf } from "@/lib/share";
import { galleryImages, legalUpdated } from "@/lib/site";

// The sitemap is rebuilt at most every ten minutes, so ideas and roadmap items people post show up in
// it quickly. Every page is listed in every language, each with its other languages as alternates.
export const revalidate = 600;

const subpages = [
  { path: "/servers", changeFrequency: "always", priority: 0.8 },
  { path: "/leaderboard", changeFrequency: "hourly", priority: 0.7 },
  { path: "/roadmap", changeFrequency: "daily", priority: 0.8 },
  { path: "/bugs-and-ideas", changeFrequency: "daily", priority: 0.7 },
  { path: "/completed", changeFrequency: "weekly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

// When a page last changed, where that is known: the legal pages' date, or the newest change among a
// board's items. Home and Servers change all the time, so they have none.
function lastChange(path: PagePath, items: FeedbackItem[]) {
  if (path === "/terms" || path === "/privacy") return new Date(legalUpdated);
  const mine = items.filter((item) => pageOf(item.status) === path);
  return mine.length ? new Date(Math.max(...mine.map((item) => item.updatedAt))) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Every public idea and roadmap item has its own page (/bugs-and-ideas/<id>/<slug> and so on).
  const lists = await safely(() =>
    Promise.all((["open", "planned", "in_progress", "completed"] as const).map((status) => listByStatus(status))),
  );
  const items = (lists ?? []).flat();

  const shared = [`${siteUrl}${hero.src}`, ...galleryImages.map((img) => `${siteUrl}${img.src}`)];
  const home = locales.map((locale) => ({
    url: localeUrl(locale),
    changeFrequency: "weekly" as const,
    priority: locale === "en" ? 1 : 0.9,
    alternates: { languages: languageAlternates(true) },
    images: [`${siteUrl}${ogImagePath(locale)}`, ...shared],
  }));
  const pages = subpages.flatMap(({ path, changeFrequency, priority }) => {
    const lastModified = lastChange(path, items);
    return locales.map((locale) => ({
      url: localeUrl(locale, path),
      ...(lastModified && { lastModified }),
      changeFrequency,
      priority: locale === "en" ? priority : priority - 0.1,
      alternates: { languages: languageAlternates(true, path) },
      images: [`${siteUrl}${ogImagePath(locale, path)}`],
    }));
  });
  const posts = items.flatMap((item) => {
    const suffix = itemSuffix({ id: item.id, slug: slugOf(item.title) });
    const page = pageOf(item.status);
    const languages = languageAlternates(true, page, suffix);
    return locales.map((locale) => ({
      url: `${localeUrl(locale, page)}${suffix}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.5,
      alternates: { languages },
      images: [`${siteUrl}/og/${locale}/item/${item.id}.png`],
    }));
  });
  return [...home, ...pages, ...posts];
}
