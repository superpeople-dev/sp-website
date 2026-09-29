import type { Metadata } from "next";
import { localeHref, localeInfo, locales, type Locale, type PagePath } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { monthYear } from "./format";
import type { Release } from "./github";
import { plain } from "./rich";
import { contactEmail, history, openStatuses, releasesUrl, repoUrl, seoHiddenFaq, site } from "./site";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://superpeople.dev").replace(/\/$/, "");

export const siteName = "SUPER PEOPLE Revival";

export const localeUrl = (locale: Locale, page: PagePath = "") =>
  locale === "en" && !page ? siteUrl : `${siteUrl}${localeHref(locale, page)}`;

// Home keeps its hand-made image; every other page has one built by app/og/[lang]/[image]/route.tsx.
export const ogImagePath = (locale: Locale, page: PagePath = "") => (page ? `/og/${locale}${page}.png` : `/og/${locale}.jpg`);

export function languageAlternates(absolute = false, page: PagePath = "", suffix = ""): Record<string, string> {
  const link = (l: Locale) => (absolute ? localeUrl(l, page) : localeHref(l, page)) + suffix;
  return {
    ...Object.fromEntries(locales.map((l) => [localeInfo[l].hreflang, link(l)])),
    "x-default": link("en"),
  };
}

function subpageSeo(locale: Locale, page: Exclude<PagePath, "">) {
  const d = dictionaries[locale];
  switch (page) {
    case "/servers":
      return { title: d.servers.seoTitle, description: d.servers.seoDescription };
    case "/ideas":
      return { title: d.ideas.seoTitle, description: d.ideas.seoDescription };
    case "/roadmap":
      return { title: d.plan.seoTitle, description: d.plan.seoDescription };
    case "/completed":
      return { title: d.completed.seoTitle, description: d.completed.seoDescription };
    case "/terms":
      return { title: d.legal.terms, description: d.legal.termsDescription };
    case "/privacy":
      return { title: d.legal.privacy, description: d.legal.privacyDescription };
  }
}

// An item page (/ideas/<id>/<slug>, lib/share.ts) is about the item: its title, its description led
// by its score (upvotes minus downvotes) and comment count like a Reddit post, and a preview image
// drawn from them (app/og/[lang]/item/[id]/route.tsx).
export type SharedItem = { id: string; title: string; slug: string; preview: string; score: number; comments: number };

export function pageMetadata(locale: Locale, page: PagePath = "", item?: SharedItem | null): Metadata {
  const d = dictionaries[locale];
  const t = d.seo;
  const info = localeInfo[locale];
  const sub = page ? subpageSeo(locale, page) : null;
  const pageTitle = sub ? `${sub.title} - ${siteName}` : t.title;
  const title = item ? `${item.title} - ${siteName}` : pageTitle;
  const suffix = item ? `/${item.id}${item.slug ? `/${item.slug}` : ""}` : "";
  const url = `${localeHref(locale, page)}${suffix}`;
  const votes = item ? `▲ ${item.score} - 💬 ${item.comments}` : "";
  const description = item ? [votes, item.preview].filter(Boolean).join(" - ") : sub ? sub.description : t.description;
  const share = item ? description : sub ? sub.description : t.shareDescription;
  const image = item
    ? { url: `/og/${locale}/item/${item.id}.png`, width: 1200, height: 630, alt: item.title, type: "image/png" }
    : sub
      ? { url: ogImagePath(locale, page), width: 1200, height: 630, alt: pageTitle, type: "image/png" }
      : { url: ogImagePath(locale), width: 1200, height: 630, alt: t.ogAlt, type: "image/jpeg" };
  return {
    metadataBase: new URL(siteUrl),
    title: item ? item.title : sub ? sub.title : { default: t.title, template: `%s - ${siteName}` },
    description,
    applicationName: siteName,
    keywords: t.keywords,
    authors: [{ name: `${siteName} team`, url: repoUrl }],
    creator: `${siteName} team`,
    publisher: siteName,
    category: "games",
    alternates: { canonical: url, languages: languageAlternates(false, page, suffix) },
    openGraph: {
      type: "website",
      url,
      siteName,
      locale: info.og,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeInfo[l].og),
      title,
      description: share,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description: share, images: [image] },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export function structuredData(release: Release, locale: Locale) {
  const t = dictionaries[locale];
  const lang = localeInfo[locale].htmlLang;
  const url = localeUrl(locale);
  const org = { "@id": `${siteUrl}/#org` };
  const game = { "@id": `${siteUrl}/#game` };
  const website = { "@id": `${siteUrl}/#website` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        ...website,
        url: siteUrl,
        name: siteName,
        inLanguage: locales.map((l) => localeInfo[l].htmlLang),
        publisher: org,
        about: game,
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: t.seo.title,
        description: t.seo.description,
        inLanguage: lang,
        isPartOf: website,
        about: game,
        primaryImageOfPage: `${siteUrl}${ogImagePath(locale)}`,
      },
      {
        "@type": "Organization",
        ...org,
        name: siteName,
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
        description: t.seo.orgDescription,
        email: contactEmail,
        sameAs: [site.discord, repoUrl],
      },
      {
        "@type": "VideoGame",
        ...game,
        name: "SUPER PEOPLE",
        alternateName: t.seo.gameAlternateNames,
        description: t.seo.gameDescription,
        url,
        image: `${siteUrl}${ogImagePath(locale)}`,
        genre: ["Battle royale", "Shooter"],
        gamePlatform: "PC",
        operatingSystem: "Windows",
        playMode: "MultiPlayer",
        numberOfPlayers: { "@type": "QuantitativeValue", maxValue: 100 },
        creator: { "@type": "Organization", name: "Wonder People" },
        sameAs: ["https://en.wikipedia.org/wiki/Super_People"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#launcher`,
        name: "SP Launcher",
        description: t.seo.launcherDescription,
        applicationCategory: "GameApplication",
        operatingSystem: "Windows 10, Windows 11",
        url,
        downloadUrl: release.downloadUrl,
        installUrl: releasesUrl,
        ...(release.tag && { softwareVersion: release.tag.replace(/^v/, "") }),
        ...(release.publishedAt && { dateModified: release.publishedAt }),
        ...(release.sizeBytes && { fileSize: `${(release.sizeBytes / 1_048_576).toFixed(1)} MB` }),
        publisher: org,
        about: game,
        sameAs: [repoUrl],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: lang,
        mainEntity: t.faq.items.filter((_, i) => !seoHiddenFaq.includes(i)).map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
}

export function llmsTxt() {
  const t = dictionaries.en;
  return `# ${siteName}

> SUPER PEOPLE was a superpowered battle royale by Korean studio Wonder People. It was shut down for good and removed from Steam on February 23, 2026. ${siteName} is a non-commercial, open-source fan project that is rebuilding the game's multiplayer backend from scratch so it can be played again on community servers.

## Key facts

- Status: playable during scheduled community playtests. Always-online servers are in progress.
- Platform: Windows 10 or 11, 64-bit. About 64 GB of disk space needed while installing.
- The official game never supported community servers, so the team is rebuilding login, the lobby and the game servers.
- Not affiliated with or endorsed by Wonder People.

## How to play

1. Download the launcher: ${siteUrl}/download
2. Join the Discord (${site.discord}) and type /authkey to the bot to get a personal launcher key.
3. In the launcher, pick a folder that already has the game or let it download the game, then press Play.

## Links

- [Website](${siteUrl})
- [Download the latest launcher](${siteUrl}/download)
- [Game servers and live status](${siteUrl}/servers)
- [Roadmap](${siteUrl}/roadmap)
- [Ideas and feature requests](${siteUrl}/ideas)
- [Completed work and release notes](${siteUrl}/completed)
- [Launcher source code on GitHub](${repoUrl})
- [Discord community](${site.discord})
- Contact: ${contactEmail}

## Languages

${locales.map((l) => `- [${localeInfo[l].name}](${localeUrl(l)})`).join("\n")}

## History

${history.map((h, i) => `- ${monthYear(h.date, "en")}: ${t.story.history[i]}`).join("\n")}

## Fixed so far

${t.progress.doneItems.map((item) => `- ${item}`).join("\n")}

## In progress

${t.progress.openItems
  .map((item, i) => `- ${item.title}${item.note ? ` (${item.note})` : ""}${openStatuses[i] === "next" ? " [up next]" : ""}`)
  .join("\n")}

## FAQ

${t.faq.items
  .filter((_, i) => !seoHiddenFaq.includes(i))
  .map(({ q, a }) => `### ${q}\n\n${plain(a)}`).join("\n\n")}
`;
}
