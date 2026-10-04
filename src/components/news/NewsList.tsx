"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/context";
import type { NewsPost } from "@/lib/news";
import { newsCategories, type NewsCategory } from "@/lib/newskinds";
import { Reveal } from "../motion";
import { NewsCard } from "./NewsCard";

// /news: the categories that have posts as filters, then every post as a card, in rows of three.
export function NewsList({ posts }: { posts: NewsPost[] }) {
  const { t } = useI18n();
  const n = t.news;
  const [category, setCategory] = useState<NewsCategory | null>(null);
  const used = newsCategories.filter((c) => posts.some((post) => post.category === c));
  const shown = category ? posts.filter((post) => post.category === category) : posts;

  if (!posts.length) return <p className="servers__empty">{n.empty}</p>;

  return (
    <Reveal className="news-list" y={16}>
      {used.length > 1 && (
        <div className="ideas__sort news-list__filters" role="group">
          <button type="button" className={category === null ? "is-active" : undefined} aria-pressed={category === null} onClick={() => setCategory(null)}>
            {n.all}
          </button>
          {used.map((c) => (
            <button key={c} type="button" className={category === c ? "is-active" : undefined} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {n.categories[c]}
            </button>
          ))}
        </div>
      )}
      <div className="news-grid">
        {shown.map((post) => (
          <NewsCard key={post.id} post={post} />
        ))}
      </div>
    </Reveal>
  );
}
