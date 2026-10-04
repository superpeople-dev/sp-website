import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { NewsArticle } from "@/components/news/NewsArticle";
import { isLocale, localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { can } from "@/lib/board";
import { getLatestRelease } from "@/lib/github";
import { getNews, newsReady } from "@/lib/news";
import { pageMetadata, siteName, siteUrl } from "@/lib/seo";
import { currentSession } from "@/lib/session";

// Posts are published after the build, so their pages are made on the first visit.
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps<"/[lang]/news/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !newsReady) notFound();
  const post = await getNews(slug);
  if (!post) notFound();
  const base = pageMetadata(lang, "/news");
  const url = `${localeHref(lang, "/news")}/${slug}`;
  const images = post.cover ? [{ url: `${siteUrl}${post.cover}`, alt: post.title }] : base.openGraph?.images;
  return {
    ...base,
    title: post.title,
    description: post.excerpt || base.description,
    // The post is the same English in every language: the English page is the original.
    alternates: { canonical: `${localeHref("en", "/news")}/${slug}` },
    openGraph: {
      ...base.openGraph,
      type: "article",
      url,
      title: `${post.title} - ${siteName}`,
      description: post.excerpt || undefined,
      publishedTime: new Date(post.publishedAt).toISOString(),
      modifiedTime: new Date(post.updatedAt).toISOString(),
      images,
    },
    twitter: { card: "summary_large_image", title: `${post.title} - ${siteName}`, description: post.excerpt || undefined, images },
  };
}

export default async function NewsPostPage({ params }: PageProps<"/[lang]/news/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !newsReady) notFound();
  const [release, post, session] = await Promise.all([getLatestRelease(), getNews(slug), currentSession()]);
  if (!post) notFound();

  return (
    <>
      <Nav downloadUrl={release.downloadUrl} page="/news" />
      <main>
        <NewsArticle post={post} editHref={can(session, "manage") ? `/news/write?id=${post.id}` : null} />
      </main>
      <Footer t={getDictionary(lang)} locale={lang} />
    </>
  );
}
