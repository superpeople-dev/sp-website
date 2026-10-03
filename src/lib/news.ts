import { randomBytes, randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { defaultLocale, type Locale } from "@/i18n/config";
import { dbReady, query } from "./db";
import type { NewsCategory } from "./newskinds";
import { deleteObject, objectSize, uploadLink } from "./objects";

// News posts (db/migrations/003_news.sql): written in English by admins on /news/write
// (components/news/Editor.tsx, app/api/admin/news), translated into the other languages when published
// (lib/translate.ts), shown on /news, /news/<slug> and the home page. Public reads are cached under the
// tag "news"; every write revalidates it.

export const newsTag = "news";
export { isNewsCategory, newsCategories, type NewsCategory } from "./newskinds";

// A post as a page shows it, in one language: the translation when there is one, else the English post.
export type NewsPost = {
  id: string;
  slug: string;
  category: NewsCategory;
  title: string;
  summary: string;
  body: string;
  cover: string | null;
  author: { name: string; avatar: string };
  publishedAt: number;
  updatedAt: number;
  // Shown in another language than written (machine translated).
  translated: boolean;
  readMinutes: number;
};

// A post as the editor sees it: the English text, drafts included.
export type NewsDraft = {
  id: string;
  slug: string;
  status: "draft" | "published";
  category: NewsCategory;
  title: string;
  summary: string;
  body: string;
  coverKey: string | null;
  cover: string | null;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  translations: string[];
};

export type NewsInput = { title: string; summary: string; body: string; category: NewsCategory; coverKey: string | null };

type PostRow = {
  id: string;
  slug: string;
  status: "draft" | "published";
  category: NewsCategory;
  title: string;
  summary: string;
  body: string;
  cover_key: string | null;
  author_name: string;
  author_avatar: string;
  created_at: number;
  updated_at: number;
  published_at: number | null;
};
type TranslatedRow = PostRow & { t_title: string | null; t_summary: string | null; t_body: string | null };

export const newsReady = dbReady;

// Images (cover and pictures in the text) live in the private bucket; this route sends the browser on
// to a short-lived link (app/api/news/image/route.ts), so cached pages never hold an expired one.
export const newsImageUrl = (key: string) => `/api/news/image?key=${encodeURIComponent(key)}`;
export const isNewsKey = (key: unknown): key is string => typeof key === "string" && /^news\/[0-9a-f-]{36}$/.test(key);

const readMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

function view(row: TranslatedRow, locale: Locale): NewsPost {
  const translated = locale !== defaultLocale && row.t_title !== null;
  const body = translated ? (row.t_body ?? row.body) : row.body;
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: translated ? (row.t_title ?? row.title) : row.title,
    summary: translated ? (row.t_summary ?? row.summary) : row.summary,
    body,
    cover: row.cover_key ? newsImageUrl(row.cover_key) : null,
    author: { name: row.author_name, avatar: row.author_avatar },
    publishedAt: row.published_at ?? row.created_at,
    updatedAt: row.updated_at,
    translated,
    readMinutes: readMinutes(row.body),
  };
}

const translatedSelect = `select p.*, t.title as t_title, t.summary as t_summary, t.body as t_body
  from news_posts p left join news_translations t on t.post_id = p.id and t.locale = $1
  where p.status = 'published'`;

function cached<A extends unknown[], T>(name: string, load: (...args: A) => Promise<T>) {
  const wrapped = unstable_cache(load, [`news:${name}`], { revalidate: 3600, tags: [newsTag] });
  return (...args: A): Promise<T> => (process.env.NEXT_RUNTIME ? wrapped(...args) : load(...args));
}

// The newest published posts, in `locale`.
export const listNews = cached("list", async (locale: Locale, limit: number) => {
  const rows = await query<TranslatedRow>(`${translatedSelect} order by p.published_at desc limit $2`, [locale, limit]);
  return rows.map((row) => view(row, locale));
});

export const getNews = cached("post", async (slug: string, locale: Locale) => {
  const [row] = await query<TranslatedRow>(`${translatedSelect} and p.slug = $2`, [locale, slug]);
  return row ? view(row, locale) : null;
});

export const publishedSlugs = cached("slugs", async () =>
  (await query<{ slug: string; updated_at: number }>("select slug, updated_at from news_posts where status = 'published' order by published_at desc")).map(
    (row) => ({ slug: row.slug, updatedAt: row.updated_at }),
  ),
);

// The editor: every post, drafts first, then the newest.
export async function listDrafts(): Promise<NewsDraft[]> {
  const rows = await query<PostRow & { locales: string[] | null }>(
    `select p.*, array_remove(array_agg(t.locale), null) as locales from news_posts p
     left join news_translations t on t.post_id = p.id group by p.id
     order by (p.status = 'draft') desc, coalesce(p.published_at, p.updated_at) desc`,
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    category: row.category,
    title: row.title,
    summary: row.summary,
    body: row.body,
    coverKey: row.cover_key,
    cover: row.cover_key ? newsImageUrl(row.cover_key) : null,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    translations: row.locales ?? [],
  }));
}

// A post's address: its title in lowercase ASCII, with a number added when another post has it.
function slugBase(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return base || "post";
}

async function freeSlug(title: string) {
  const base = slugBase(title);
  const taken = new Set((await query<{ slug: string }>("select slug from news_posts where slug = $1 or slug like $2", [base, `${base}-%`])).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

const newId = () => randomBytes(12).toString("hex");

// Creates a draft (no id) or saves the English text of a post. The address of a published post stays
// as it was, so shared links keep working; a draft's follows its title.
export async function saveNews(id: string | null, input: NewsInput, author: { id: string; name: string; avatar: string }) {
  const now = Date.now();
  if (!id) {
    const newPost = newId();
    await query(
      `insert into news_posts (id, slug, category, title, summary, body, cover_key, author_id, author_name, author_avatar, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [newPost, await freeSlug(input.title), input.category, input.title, input.summary, input.body, input.coverKey, author.id, author.name, author.avatar, now],
    );
    return newPost;
  }
  const [current] = await query<{ status: string; title: string; cover_key: string | null }>("select status, title, cover_key from news_posts where id = $1", [id]);
  if (!current) throw new Error("No such post");
  const slug = current.status === "draft" && current.title !== input.title ? await freeSlug(input.title) : null;
  await query(
    `update news_posts set category = $2, title = $3, summary = $4, body = $5, cover_key = $6, updated_at = $7, slug = coalesce($8, slug) where id = $1`,
    [id, input.category, input.title, input.summary, input.body, input.coverKey, now, slug],
  );
  if (current.cover_key && current.cover_key !== input.coverKey) await deleteObject(current.cover_key).catch(() => {});
  return id;
}

export async function setNewsStatus(id: string, status: "draft" | "published") {
  const [row] = await query<{ published_at: number | null }>(
    `update news_posts set status = $2, published_at = case when $2 = 'published' then coalesce(published_at, $3) else published_at end, updated_at = $3
     where id = $1 returning published_at`,
    [id, status, Date.now()],
  );
  if (!row) throw new Error("No such post");
}

export async function deleteNews(id: string) {
  const [row] = await query<{ cover_key: string | null }>("delete from news_posts where id = $1 returning cover_key", [id]);
  if (row?.cover_key) await deleteObject(row.cover_key).catch(() => {});
}

export async function getNewsSource(id: string) {
  const [row] = await query<PostRow>("select * from news_posts where id = $1", [id]);
  return row ?? null;
}

// Replaces a post's translations with these (one per language).
export async function saveTranslations(id: string, translations: { locale: Locale; title: string; summary: string; body: string }[]) {
  await query("delete from news_translations where post_id = $1", [id]);
  const now = Date.now();
  for (const t of translations) {
    await query("insert into news_translations (post_id, locale, title, summary, body, translated_at) values ($1, $2, $3, $4, $5, $6)", [
      id,
      t.locale,
      t.title,
      t.summary,
      t.body,
      now,
    ]);
  }
}

// Where the editor uploads one image (a PUT with its Content-Type), and the key to save with the post.
export const newsUploadUrl = () => {
  const key = `news/${randomUUID()}`;
  return { uploadUrl: uploadLink(key), key };
};

export const newsImageStored = async (key: string) => (await objectSize(key)) !== null;
