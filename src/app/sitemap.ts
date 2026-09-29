import type { MetadataRoute } from "next";
import hero from "@/assets/hero.jpg";
import { locales } from "@/i18n/config";
import { slugOf } from "@/lib/board";
import { listByStatus, safely } from "@/lib/reflet";
import { languageAlternates, localeUrl, ogImagePath, siteUrl } from "@/lib/seo";
import { pageOf } from "@/lib/share";
import { galleryImages } from "@/lib/site";

// The sitemap is rebuilt at most every hour, so new ideas and roadmap items show up in it.
export const revalidate = 3600;

const subpages = [
  { path: "/servers", changeFrequency: "always", priority: 0.8 },
  { path: "/roadmap", changeFrequency: "daily", priority: 0.8 },
  { path: "/ideas", changeFrequency: "daily", priority: 0.7 },
  { path: "/completed", changeFrequency: "weekly", priority: 0.7 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const languages = languageAlternates(true);
  const shared = [`${siteUrl}${hero.src}`, ...galleryImages.map((img) => `${siteUrl}${img.src}`)];
  const home = locales.map((locale) => ({
    url: localeUrl(locale),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: locale === "en" ? 1 : 0.9,
    alternates: { languages },
    images: [`${siteUrl}${ogImagePath(locale)}`, ...shared],
  }));
  const pages = subpages.flatMap(({ path, changeFrequency, priority }) =>
    locales.map((locale) => ({
      url: localeUrl(locale, path),
      lastModified: new Date(),
      changeFrequency,
      priority: locale === "en" ? priority : priority - 0.1,
      alternates: { languages: languageAlternates(true, path) },
      images: [`${siteUrl}${ogImagePath(locale, path)}`],
    })),
  );
  // Every public idea and roadmap item has its own page (/ideas/<id>/<slug> and so on).
  const lists = await safely(() =>
    Promise.all((["open", "planned", "in_progress", "completed"] as const).map((status) => listByStatus(status))),
  );
  const items = (lists ?? []).flat().map((item) => {
    const slug = slugOf(item.title);
    const suffix = `/${item.id}${slug ? `/${slug}` : ""}`;
    const page = pageOf(item.status);
    return {
      url: `${localeUrl("en", page)}${suffix}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.5,
      alternates: { languages: languageAlternates(true, page, suffix) },
      images: [`${siteUrl}/og/en/item/${item.id}.png`],
    };
  });
  return [...home, ...pages, ...items];
}
