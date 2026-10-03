-- News posts (lib/news.ts): written in English by admins on /news/write, shown on /news and on the home
-- page. status: "draft" until published. cover_key: the cover image in object storage (news/<uuid>).
-- Times are epoch milliseconds, as in the code.
create table news_posts (
  id text primary key,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  category text not null check (category in ('update', 'patch', 'event', 'dev')),
  title text not null,
  summary text not null default '',
  body text not null default '',
  cover_key text,
  author_id text not null,
  author_name text not null,
  author_avatar text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  published_at bigint
);
create index news_posts_published on news_posts (status, published_at desc);

-- A post in another language, made by lib/translate.ts when the post is published or edited. Replaced
-- whole on every retranslation; a missing row means that language shows the English post.
create table news_translations (
  post_id text not null references news_posts (id) on delete cascade,
  locale text not null,
  title text not null,
  summary text not null,
  body text not null,
  translated_at bigint not null,
  primary key (post_id, locale)
);
