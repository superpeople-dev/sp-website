"use client";

import Link from "next/link";
import { fill, localeHref, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { NewsPost } from "@/lib/news";

// A news post on /news and on the home page: its cover, category, date, title and summary. "featured"
// is the wide card of the post an admin pinned, on top of /news.

export const newsHref = (locale: Parameters<typeof localeHref>[0], slug: string) => `${localeHref(locale, "/news")}/${slug}`;

export function NewsDate({ at }: { at: number }) {
  const { locale } = useI18n();
  return (
    <time dateTime={new Date(at).toISOString()}>
      {new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }).format(at)}
    </time>
  );
}

export function NewsCard({ post, featured = false }: { post: NewsPost; featured?: boolean }) {
  const { locale, t } = useI18n();
  const n = t.news;
  return (
    <Link href={newsHref(locale, post.slug)} className={`panel news-card${featured ? " news-card--featured" : ""}`}>
      <span className="news-card__cover" style={post.cover ? { backgroundImage: `url("${post.cover}")` } : undefined} aria-hidden="true" />
      <span className="news-card__text">
        <span className="news-meta">
          <span className={`news-kind news-kind--${post.category}`}>{n.categories[post.category]}</span>
          <NewsDate at={post.publishedAt} />
          {featured && <span>- {fill(n.minRead, { n: String(post.readMinutes) })}</span>}
        </span>
        <span className="news-card__title">{post.title}</span>
        {post.excerpt && <span className="news-card__summary">{post.excerpt}</span>}
        {featured && <span className="news-card__more">{n.readMore} →</span>}
      </span>
    </Link>
  );
}
