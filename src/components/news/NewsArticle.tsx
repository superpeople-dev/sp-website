"use client";

import Image from "next/image";
import Link from "next/link";
import { fill, localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { NewsPost } from "@/lib/news";
import { DiscordButton } from "../Buttons";
import { Icon } from "../Icon";
import { Markdown } from "./Markdown";
import { NewsDate } from "./NewsCard";

// A news post's page: the cover across the top, then the post. Posts are written in English, which the
// text says to the browser in the other languages (lang="en").
export function NewsArticle({ post, editHref }: { post: NewsPost; editHref: string | null }) {
  const { locale, t } = useI18n();
  const n = t.news;
  const lang = locale === "en" ? undefined : "en";

  return (
    <article className="news-article">
      <div className="news-article__cover" style={post.cover ? { backgroundImage: `url("${post.cover}")` } : undefined} aria-hidden="true" />
      <div className="news-article__inner">
        <Link href={localeHref(locale, "/news")} className="news-article__back">
          <Icon name="left" /> {n.back}
        </Link>
        <div className="news-meta">
          <span className={`news-kind news-kind--${post.category}`}>{n.categories[post.category]}</span>
          <NewsDate at={post.publishedAt} />
          <span>- {fill(n.minRead, { n: String(post.readMinutes) })}</span>
        </div>
        <h1 lang={lang}>{post.title}</h1>
        <div className="news-article__byline">
          {post.author.avatar && <Image src={post.author.avatar} alt="" width={36} height={36} unoptimized />}
          <span>{fill(n.by, { name: post.author.name })}</span>
          {editHref && (
            <Link href={editHref} className="btn btn--sm">
              <Icon name="edit" /> {n.edit}
            </Link>
          )}
        </div>
        {post.summary && (
          <p className="news-article__summary" lang={lang}>
            {post.summary}
          </p>
        )}
        <div lang={lang}>
          <Markdown text={post.body} />
        </div>
        <div className="news-article__end">
          <DiscordButton label={t.hero.discord} />
        </div>
      </div>
    </article>
  );
}
