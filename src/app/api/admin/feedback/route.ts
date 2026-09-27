import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { FeedbackStatus } from "reflet-sdk";
import { deleteIdea, failure, getIdea, getTags, refletTag, setStatus, updateIdea, updateTags } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { ideaLimits } from "@/lib/site";

const statuses: FeedbackStatus[] = ["open", "under_review", "planned", "in_progress", "completed", "closed"];

type Body = {
  feedbackId?: unknown;
  action?: unknown;
  status?: unknown;
  title?: unknown;
  description?: unknown;
  typeId?: unknown;
  categoryId?: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

async function edit(feedbackId: string, body: Body) {
  const title = text(body.title);
  const description = text(body.description);
  if (title.length < 3 || title.length > ideaLimits.title || description.length > ideaLimits.description) return false;
  const [{ categories, types }, item] = await Promise.all([getTags(), getIdea(feedbackId)]);
  const managed = new Set([...categories, ...types].map((tag) => tag.id));
  const wanted = [
    types.find((type) => type.id === body.typeId)?.id,
    categories.find((category) => category.id === body.categoryId)?.id,
  ].filter((id): id is string => Boolean(id));
  const current = item.tags.map((tag) => tag.id).filter((id) => managed.has(id));
  const add = wanted.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !wanted.includes(id));
  await updateIdea(feedbackId, title, description);
  if (add.length || remove.length) await updateTags(feedbackId, add, remove);
  return true;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  if (!feedbackId) return Response.json({ error: "invalid" }, { status: 400 });

  try {
    if (body.action === "status" && statuses.includes(body.status as FeedbackStatus)) {
      await setStatus(feedbackId, body.status as FeedbackStatus);
    } else if (body.action === "delete") {
      await deleteIdea(feedbackId);
    } else if (body.action !== "edit" || !(await edit(feedbackId, body))) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    revalidateTag(refletTag, { expire: 0 });
    return Response.json({ ok: true });
  } catch (error) {
    return failure("admin action", error);
  }
}
