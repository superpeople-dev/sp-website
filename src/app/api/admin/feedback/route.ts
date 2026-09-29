import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { FeedbackStatus } from "reflet-sdk";
import {
  createIdea,
  deleteIdea,
  failure,
  getIdea,
  getTags,
  refletTag,
  setStatus,
  updateIdea,
  updateTags,
  userToken,
} from "@/lib/reflet";
import { can } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { readSession, sameOrigin, type SessionUser } from "@/lib/session";
import { ideaLimits } from "@/lib/site";
import { profileOf, rememberAuthor } from "@/lib/store";

const statuses: FeedbackStatus[] = ["open", "under_review", "planned", "in_progress", "completed", "closed"];
const boardStatuses: FeedbackStatus[] = ["planned", "in_progress", "completed"];

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

async function create(user: SessionUser, body: Body) {
  const title = text(body.title);
  const status = body.status as FeedbackStatus;
  if (title.length < 3 || title.length > ideaLimits.title || !boardStatuses.includes(status)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  try {
    // Reflet no longer creates an item without a description, and a roadmap task has only a title:
    // it is created with the title as its description, which is then cleared (kept if Reflet refuses).
    const { feedbackId } = await createIdea(title, title, await userToken(user));
    await Promise.all([
      setStatus(feedbackId, status),
      rememberAuthor(feedbackId, profileOf(user)),
      updateIdea(feedbackId, title, "").catch(() => null),
    ]);
    revalidateTag(refletTag, { expire: 0 });
    await logEvent(user, { type: "item.created", item: { id: feedbackId, title, status }, to: status });
    const item = await getIdea(feedbackId);
    return Response.json({ item: { ...item, status } });
  } catch (error) {
    return failure("create task", error);
  }
}

async function edit(feedbackId: string, body: Body) {
  const title = text(body.title);
  const description = text(body.description);
  if (title.length < 3 || title.length > ideaLimits.titleMax || description.length > ideaLimits.description) return false;
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

// Approving or rejecting a new idea (still under review) needs "review"; anything else "manage".
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.action === "create") {
    return can(user, "manage") ? create(user, body) : Response.json({ error: "forbidden" }, { status: 403 });
  }
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  if (!feedbackId) return Response.json({ error: "invalid" }, { status: 400 });

  try {
    const item = await getIdea(feedbackId);
    const inReview = item.status === "under_review";
    const to = body.status as FeedbackStatus;
    const approving = inReview && body.action === "status" && to === "open";
    const rejecting = inReview && body.action === "delete";
    if (!can(user, approving || rejecting ? "review" : "manage")) return Response.json({ error: "forbidden" }, { status: 403 });
    const target = { id: feedbackId, title: item.title, status: item.status };

    if (body.action === "status" && statuses.includes(to)) {
      await setStatus(feedbackId, to);
      await logEvent(user, approving ? { type: "idea.approved", item: target } : { type: "item.moved", item: target, to });
    } else if (body.action === "delete") {
      await deleteIdea(feedbackId);
      await logEvent(user, { type: rejecting ? "idea.rejected" : "item.deleted", item: target });
    } else if (body.action === "edit" && (await edit(feedbackId, body))) {
      await logEvent(user, { type: "item.edited", item: { ...target, title: text(body.title) } });
    } else {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    revalidateTag(refletTag, { expire: 0 });
    return Response.json({ ok: true });
  } catch (error) {
    return failure("admin action", error);
  }
}
