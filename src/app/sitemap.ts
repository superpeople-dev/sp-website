import type { MetadataRoute } from "next";
import type { FeedbackItem } from "reflet-sdk";
import hero from "@/assets/hero.jpg";
import { locales, type PagePath } from "@/i18n/config";
import { slugOf } from "@/lib/board";
import { newsReady, publishedSlugs } from "@/lib/news";
import { listByStatus, safely } from "@/lib/reflet";
import { itemSuffix, languageAlternates, localeUrl, ogImagePath, siteUrl } from "@/lib/seo";
import { pageOf } from "@/lib/share";
import { galleryImages, legalUpdated } from "@/lib/site";

// The sitemap is rebuilt at most every ten minutes, so ideas and roadmap items people post show up in
// it quickly. Home and the main pages are listed in every language, each with its other languages as
// alternates. Ideas, roadmap items and news posts are the same English in every language, so they are
// listed once, in English, the page their other languages name as canonical (lib/seo.ts): ten copies
// each made the sitemap 2,290 pages, most of them duplicates.
export const revalidate = 600;

const subpages = [
  { path: "/news", changeFrequency: "daily", priority: 0.8 },
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
  const posts = items.map((item) => ({
    url: `${localeUrl("en", pageOf(item.status))}${itemSuffix({ id: item.id, slug: slugOf(item.title) })}`,
    lastModified: new Date(item.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.5,
    images: [`${siteUrl}/og/en/item/${item.id}.png`],
  }));
  // Every published news post (/news/<slug>), once, in English.
  const newsPosts = newsReady ? await publishedSlugs().catch(() => []) : [];
  const news = newsPosts.map(({ slug, updatedAt }) => ({
    url: `${localeUrl("en", "/news")}/${slug}`,
    lastModified: new Date(updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [...home, ...pages, ...posts, ...news];
}
