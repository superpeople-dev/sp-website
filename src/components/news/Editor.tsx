"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import type { NewsDraft } from "@/lib/news";
import { newsCategories, type NewsCategory } from "@/lib/newskinds";
import { mediaLimits } from "@/lib/site";
import { Icon } from "../Icon";
import { Markdown } from "./Markdown";

// /news/write: admins with "manage" write news posts in English (app/api/admin/news). The list of posts
// on the left, the form and a live preview on the right. Posts show in English in every language. The
// team reads English, so this page is in English only.

type Form = { id: string | null; title: string; summary: string; body: string; category: NewsCategory; coverKey: string | null; cover: string | null };
const empty: Form = { id: null, title: "", summary: "", body: "", category: "update", coverKey: null, cover: null };
const imageTypes = mediaLimits.types.filter((type) => type.startsWith("image/"));

async function api<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/admin/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

type Listing = { posts: NewsDraft[]; uploads: boolean };

// The posts, or the HTTP status when they can't be had.
async function fetchListing(): Promise<Listing | number> {
  const res = await fetch("/api/admin/news", { cache: "no-store" });
  return res.ok ? ((await res.json()) as Listing) : res.status;
}

// Uploads one picture; returns its key and the address pages show it at.
async function upload(file: File) {
  if (!imageTypes.includes(file.type)) throw new Error("Use a PNG, JPEG, WebP or GIF picture.");
  if (file.size > mediaLimits.image) throw new Error("Pictures can be up to 10 MB.");
  const { uploadUrl, key, url } = await api<{ uploadUrl: string; key: string; url: string }>({ action: "upload" });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error(`Upload failed (HTTP ${put.status})`);
  return { key, url };
}

export function Editor({ initialId }: { initialId: string | null }) {
  const { t } = useI18n();
  const n = t.news;
  const [posts, setPosts] = useState<NewsDraft[] | null>(null);
  const [uploads, setUploads] = useState(true);
  const [form, setForm] = useState<Form>(empty);
  const [status, setStatus] = useState<"draft" | "published" | null>(null);
  const [pinned, setPinned] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  const open = useCallback((post: NewsDraft | null) => {
    setMessage(null);
    setForm(post ? { id: post.id, title: post.title, summary: post.summary, body: post.body, category: post.category, coverKey: post.coverKey, cover: post.cover } : empty);
    setStatus(post?.status ?? null);
    setPinned(post?.pinned ?? false);
    setSlug(post?.slug ?? null);
  }, []);

  // Opened from a post's Edit button (/news/write?id=…): that post, the first time the list comes in.
  const pending = useRef(initialId);
  const apply = useCallback(
    (data: Listing | number) => {
      if (typeof data === "number") return setMessage({ text: data === 503 ? "The database is not set up." : "Could not load the posts.", error: true });
      setPosts(data.posts);
      setUploads(data.uploads);
      const wanted = data.posts.find((post) => post.id === pending.current);
      pending.current = null;
      if (wanted) open(wanted);
    },
    [open],
  );
  const load = useCallback(() => fetchListing().then(apply), [apply]);

  useEffect(() => {
    let live = true;
    void fetchListing().then((data) => live && apply(data));
    return () => {
      live = false;
    };
  }, [apply]);

  const run = async (label: string, work: () => Promise<string>) => {
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ text: await work() });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(null);
    }
  };

  const save = (publish: boolean) =>
    run(publish ? "Publishing…" : "Saving…", async () => {
      const { coverKey, title, summary, body: text, category } = form;
      const result = await api<{ id: string; slug: string; status: "draft" | "published" }>({
        action: "save",
        id: form.id,
        publish,
        announce,
        post: { title, summary, body: text, category, coverKey },
      });
      setForm((f) => ({ ...f, id: result.id }));
      setStatus(result.status);
      setSlug(result.slug);
      return result.status === "published" ? (publish ? "Published." : "Changes saved.") : "Draft saved.";
    });

  const pickCover = (file: File | undefined) =>
    file &&
    run("Uploading…", async () => {
      const { key, url } = await upload(file);
      setForm((f) => ({ ...f, coverKey: key, cover: url }));
      return "Cover uploaded. Save to keep it.";
    });

  const insertImage = (file: File | undefined) =>
    file &&
    run("Uploading…", async () => {
      const { url } = await upload(file);
      const area = body.current;
      const at = area?.selectionStart ?? form.body.length;
      const line = `\n\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n\n`;
      setForm((f) => ({ ...f, body: `${f.body.slice(0, at)}${line}${f.body.slice(at)}`.replace(/^\n+/, "") }));
      return "Picture added to the text. Edit its caption between the [ ].";
    });

  const unpublish = () =>
    form.id && run("Unpublishing…", async () => (await api({ action: "unpublish", id: form.id }), setStatus("draft"), setPinned(false), "Back to draft: hidden from the site."));

  // One post at most is pinned: pinning this one unpins the one that was.
  const pin = (on: boolean) =>
    form.id &&
    run(on ? "Pinning…" : "Unpinning…", async () => {
      await api({ action: on ? "pin" : "unpin", id: form.id });
      setPinned(on);
      return on ? "Pinned: the wide card on top of the News page." : "Unpinned: back in the rows with the others.";
    });

  const remove = () => {
    if (!form.id || !window.confirm(`Delete "${form.title}" for good?`)) return;
    void run("Deleting…", async () => {
      await api({ action: "delete", id: form.id });
      open(null);
      return "Post deleted.";
    });
  };

  const valid = form.title.trim().length > 0 && form.title.length <= 140 && form.summary.length <= 300;

  return (
    <div className="wrap news-editor">
      <aside className="news-editor__list">
        <button type="button" className="btn btn--sm btn--primary" onClick={() => open(null)}>
          <Icon name="plus" /> New post
        </button>
        {posts === null ? (
          <p className="news-editor__hint">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="news-editor__hint">No posts yet.</p>
        ) : (
          <ul>
            {posts.map((post) => (
              <li key={post.id}>
                <button type="button" className={post.id === form.id ? "is-active" : undefined} onClick={() => open(post)}>
                  <span className={`news-editor__state news-editor__state--${post.status}`}>{post.status === "draft" ? "Draft" : "Live"}</span>
                  {post.pinned && <span className="news-editor__state news-editor__state--pinned">Pinned</span>}
                  <b>{post.title || "Untitled"}</b>
                  <small>
                    {n.categories[post.category]} - {new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString("en-GB")}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="news-editor__main">
        <div className="panel news-editor__form">
          <label className="news-editor__field">
            <span>Title</span>
            <input value={form.title} maxLength={140} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Season ranking is live" />
          </label>
          <div className="news-editor__row">
            <label className="news-editor__field">
              <span>Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as NewsCategory })}>
                {newsCategories.map((c) => (
                  <option key={c} value={c}>
                    {n.categories[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="news-editor__field news-editor__cover">
              <span>Cover image</span>
              <span className="news-editor__drop" style={form.cover ? { backgroundImage: `url("${form.cover}")` } : undefined}>
                {form.cover ? "Replace" : "Upload"}
                <input type="file" accept={imageTypes.join(",")} disabled={!uploads} onChange={(e) => pickCover(e.target.files?.[0])} />
              </span>
            </label>
          </div>
          <label className="news-editor__field">
            <span>Summary (cards, previews and Discord, up to 300 characters)</span>
            <textarea rows={2} maxLength={300} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </label>
          <label className="news-editor__field">
            <span className="news-editor__bodyhead">
              Text: ## heading, **bold**, *italic*, - list, [link](https://…)
              <span className="news-editor__insert">
                <Icon name="attach" /> Insert picture
                <input type="file" accept={imageTypes.join(",")} disabled={!uploads} onChange={(e) => insertImage(e.target.files?.[0])} />
              </span>
            </span>
            <textarea ref={body} className="news-editor__body" rows={16} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          {status !== "published" && (
            <label className="news-editor__check">
              <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
              Also post it to the community Discord channel when publishing
            </label>
          )}
          <div className="news-editor__actions">
            {status === "published" && slug && (
              <a className="btn btn--sm" href={`/news/${slug}`} target="_blank" rel="noreferrer">
                View
              </a>
            )}
            {form.id && (
              <button type="button" className="btn btn--sm" onClick={remove} disabled={!!busy}>
                <Icon name="trash" /> Delete
              </button>
            )}
            {status === "published" ? (
              <>
                <button type="button" className="btn btn--sm" onClick={() => pin(!pinned)} disabled={!!busy}>
                  {pinned ? "Unpin" : "Pin to top"}
                </button>
                <button type="button" className="btn btn--sm" onClick={unpublish} disabled={!!busy}>
                  Unpublish
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => save(false)} disabled={!valid || !!busy}>
                  Save changes
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--sm" onClick={() => save(false)} disabled={!valid || !!busy}>
                  Save draft
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={() => save(true)} disabled={!valid || !!busy}>
                  Publish
                </button>
              </>
            )}
          </div>
          {(busy || message) && <p className={`news-editor__message${message?.error ? " is-error" : ""}`}>{busy ?? message?.text}</p>}
        </div>

        <div className="news-editor__preview">
          <span className="news-editor__label">Preview</span>
          <article className="panel news-post news-post--preview">
            {form.cover && <div className="news-post__cover" style={{ backgroundImage: `url("${form.cover}")` }} />}
            <div className="news-post__inner">
              <span className={`news-kind news-kind--${form.category}`}>{n.categories[form.category]}</span>
              <h1>{form.title || "Title"}</h1>
              {form.summary && <p className="news-post__summary">{form.summary}</p>}
              <Markdown text={form.body} />
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
