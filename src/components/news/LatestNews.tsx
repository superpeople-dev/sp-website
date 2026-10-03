"use client";

import Link from "next/link";
import { localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { NewsPost } from "@/lib/news";
import { Reveal } from "../motion";
import { NewsCard } from "./NewsCard";

// The home page's row of the three newest news posts, with a link to /news. Not shown without posts.
export function LatestNews({ posts }: { posts: NewsPost[] }) {
  const { locale, t } = useI18n();
  if (!posts.length) return null;
  return (
    <section id="news">
      <div className="wrap">
        <Reveal className="news-latest__head">
          <h2>{t.news.latest}</h2>
          <Link href={localeHref(locale, "/news")} className="news-card__more">
            {t.news.allNews} →
          </Link>
        </Reveal>
        <Reveal className="news-grid" delay={0.08} y={16}>
          {posts.map((post) => (
            <NewsCard key={post.id} post={post} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
