import type { MetadataRoute } from "next";
import hero from "@/assets/hero.jpg";
import { locales } from "@/i18n/config";
import { languageAlternates, localeUrl, ogImagePath, siteUrl } from "@/lib/seo";
import { galleryImages } from "@/lib/site";

const subpages = [
  { path: "/servers", changeFrequency: "always", priority: 0.8 },
  { path: "/roadmap", changeFrequency: "daily", priority: 0.8 },
  { path: "/ideas", changeFrequency: "daily", priority: 0.7 },
  { path: "/completed", changeFrequency: "weekly", priority: 0.7 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
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
    })),
  );
  return [...home, ...pages];
}
