import { randomBytes, randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { dbReady, query } from "./db";
import type { NewsCategory } from "./newskinds";
import { deleteObject, objectSize, uploadLink } from "./objects";

// News posts: written in English by admins on /news/write (components/news/Editor.tsx,
// app/api/admin/news), shown in English in every language on /news, /news/<slug> and the home page.
// Public reads are cached under the tag "news"; every write revalidates it. The table is created here on
// first use (ensureTables), so nothing has to be run by hand when this ships.

export const newsTag = "news";
export { isNewsCategory, newsCategories, type NewsCategory } from "./newskinds";

// A post as a page shows it.
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
export const newsReady = dbReady;

// The table, created once per server instance before the first query. Two instances doing it at the
// same moment can collide on Postgres' catalog (duplicate type or table): the other one made it.
let tables: Promise<void> | null = null;
function ensureTables() {
  tables ??= query(`
    create table if not exists news_posts (
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
    create index if not exists news_posts_published on news_posts (status, published_at desc);
  `)
    .then(() => undefined)
    .catch((error: { code?: string }) => {
      if (error.code === "23505" || error.code === "42P07") return;
      tables = null;
      throw error;
    });
  return tables;
}

async function run<T extends Record<string, unknown>>(text: string, values: unknown[] = []) {
  await ensureTables();
  return query<T>(text, values);
}

// Images (cover and pictures in the text) live in the private bucket; this route sends the browser on
// to a short-lived link (app/api/news/image/route.ts), so cached pages never hold an expired one.
export const newsImageUrl = (key: string) => `/api/news/image?key=${encodeURIComponent(key)}`;
export const isNewsKey = (key: unknown): key is string => typeof key === "string" && /^news\/[0-9a-f-]{36}$/.test(key);

const readMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

function view(row: PostRow): NewsPost {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    summary: row.summary,
    body: row.body,
    cover: row.cover_key ? newsImageUrl(row.cover_key) : null,
    author: { name: row.author_name, avatar: row.author_avatar },
    publishedAt: row.published_at ?? row.created_at,
    updatedAt: row.updated_at,
    readMinutes: readMinutes(row.body),
  };
}

function cached<A extends unknown[], T>(name: string, load: (...args: A) => Promise<T>) {
  const wrapped = unstable_cache(load, [`news:${name}`], { revalidate: 3600, tags: [newsTag] });
  return (...args: A): Promise<T> => (process.env.NEXT_RUNTIME ? wrapped(...args) : load(...args));
}

// The newest published posts.
export const listNews = cached("list", async (limit: number) =>
  (await run<PostRow>("select * from news_posts where status = 'published' order by published_at desc limit $1", [limit])).map(view),
);

export const getNews = cached("post", async (slug: string) => {
  const [row] = await run<PostRow>("select * from news_posts where status = 'published' and slug = $1", [slug]);
  return row ? view(row) : null;
});

export const publishedSlugs = cached("slugs", async () =>
  (await run<{ slug: string; updated_at: number }>("select slug, updated_at from news_posts where status = 'published' order by published_at desc")).map(
    (row) => ({ slug: row.slug, updatedAt: row.updated_at }),
  ),
);

// The editor: every post, drafts first, then the newest.
export async function listDrafts(): Promise<NewsDraft[]> {
  const rows = await run<PostRow>("select * from news_posts order by (status = 'draft') desc, coalesce(published_at, updated_at) desc");
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
  const taken = new Set((await run<{ slug: string }>("select slug from news_posts where slug = $1 or slug like $2", [base, `${base}-%`])).map((r) => r.slug));
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
    await run(
      `insert into news_posts (id, slug, category, title, summary, body, cover_key, author_id, author_name, author_avatar, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [newPost, await freeSlug(input.title), input.category, input.title, input.summary, input.body, input.coverKey, author.id, author.name, author.avatar, now],
    );
    return newPost;
  }
  const [current] = await run<{ status: string; title: string; cover_key: string | null }>("select status, title, cover_key from news_posts where id = $1", [id]);
  if (!current) throw new Error("No such post");
  const slug = current.status === "draft" && current.title !== input.title ? await freeSlug(input.title) : null;
  await run(
    `update news_posts set category = $2, title = $3, summary = $4, body = $5, cover_key = $6, updated_at = $7, slug = coalesce($8, slug) where id = $1`,
    [id, input.category, input.title, input.summary, input.body, input.coverKey, now, slug],
  );
  if (current.cover_key && current.cover_key !== input.coverKey) await deleteObject(current.cover_key).catch(() => {});
  return id;
}

export async function setNewsStatus(id: string, status: "draft" | "published") {
  const [row] = await run<{ published_at: number | null }>(
    `update news_posts set status = $2, published_at = case when $2 = 'published' then coalesce(published_at, $3) else published_at end, updated_at = $3
     where id = $1 returning published_at`,
    [id, status, Date.now()],
  );
  if (!row) throw new Error("No such post");
}

export async function deleteNews(id: string) {
  const [row] = await run<{ cover_key: string | null }>("delete from news_posts where id = $1 returning cover_key", [id]);
  if (row?.cover_key) await deleteObject(row.cover_key).catch(() => {});
}

export async function getNewsSource(id: string) {
  const [row] = await run<PostRow>("select * from news_posts where id = $1", [id]);
  return row ?? null;
}

// Where the editor uploads one image (a PUT with its Content-Type), and the key to save with the post.
export const newsUploadUrl = () => {
  const key = `news/${randomUUID()}`;
  return { uploadUrl: uploadLink(key), key };
};

export const newsImageStored = async (key: string) => (await objectSize(key)) !== null;
