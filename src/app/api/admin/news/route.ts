import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { can } from "@/lib/board";
import { announceNews } from "@/lib/discord";
import {
  deleteNews,
  getNewsSource,
  isNewsCategory,
  isNewsKey,
  listDrafts,
  newsImageStored,
  newsImageUrl,
  newsReady,
  newsTag,
  newsUploadUrl,
  saveNews,
  setNewsPinned,
  setNewsStatus,
  type NewsInput,
} from "@/lib/news";
import { objectsReady } from "@/lib/objects";
import { readSession, sameOrigin } from "@/lib/session";

// Posts are read through the "news" cache tag: pages that show them (the home page's "Latest news"
// row, /news) pick up a change on their next visit.
function refresh() {
  revalidateTag(newsTag, { expire: 0 });
}

// The news editor (components/news/Editor.tsx): admins with the "manage" permission write, publish and
// delete posts; the first publish can also post it to Discord.

const limits = { title: 140, summary: 300, body: 40_000 };

async function editor(request: NextRequest) {
  const user = await readSession(request);
  return user && can(user, "manage") ? user : null;
}

function inputOf(value: unknown): NewsInput | null {
  const v = (value ?? {}) as Record<string, unknown>;
  const text = (field: unknown, max: number) => (typeof field === "string" && field.trim().length <= max ? field.trim() : null);
  const title = text(v.title, limits.title);
  const summary = text(v.summary, limits.summary);
  const body = typeof v.body === "string" && v.body.length <= limits.body ? v.body.replace(/\r\n/g, "\n").trim() : null;
  const coverKey = v.coverKey === null || v.coverKey === undefined ? null : isNewsKey(v.coverKey) ? v.coverKey : undefined;
  if (!title || summary === null || body === null || !isNewsCategory(v.category) || coverKey === undefined) return null;
  return { title, summary, body, category: v.category, coverKey };
}

export async function GET(request: NextRequest) {
  const user = await editor(request);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!newsReady) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ posts: await listDrafts(), uploads: objectsReady }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await editor(request);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!newsReady) return Response.json({ error: "unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; id?: unknown; post?: unknown; publish?: unknown; announce?: unknown };
  const id = typeof body.id === "string" && body.id ? body.id : null;

  try {
    if (body.action === "upload") {
      if (!objectsReady) return Response.json({ error: "unavailable" }, { status: 503 });
      const { uploadUrl, key } = newsUploadUrl();
      return Response.json({ uploadUrl, key, url: newsImageUrl(key) });
    }

    if (body.action === "save") {
      const input = inputOf(body.post);
      if (!input) return Response.json({ error: "invalid" }, { status: 400 });
      if (input.coverKey && !(await newsImageStored(input.coverKey))) return Response.json({ error: "cover" }, { status: 400 });
      const before = id ? await getNewsSource(id) : null;
      if (id && !before) return Response.json({ error: "not found" }, { status: 404 });
      const saved = await saveNews(id, input, user);
      const publish = body.publish === true || before?.status === "published";
      if (publish) await setNewsStatus(saved, "published");
      refresh();
      const after = await getNewsSource(saved);
      if (publish && before?.status !== "published" && body.announce === true && after) {
        await announceNews({ title: after.title, summary: after.summary, slug: after.slug, cover: after.cover_key ? newsImageUrl(after.cover_key) : null });
      }
      return Response.json({ id: saved, slug: after?.slug, status: after?.status });
    }

    if (body.action === "unpublish" && id) {
      await setNewsStatus(id, "draft");
      refresh();
      return Response.json({ ok: true });
    }

    if ((body.action === "pin" || body.action === "unpin") && id) {
      await setNewsPinned(id, body.action === "pin");
      refresh();
      return Response.json({ ok: true });
    }

    if (body.action === "delete" && id) {
      await deleteNews(id);
      refresh();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "invalid" }, { status: 400 });
  } catch (error) {
    console.error(`[news] ${String(body.action)} failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
