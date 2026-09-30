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
  RefletRequestError,
  setStatus,
  updateIdea,
  updateTags,
  userToken,
} from "@/lib/reflet";
import { can } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { typeAndPlatforms } from "@/lib/kinds";
import { readSession, sameOrigin, type SessionUser } from "@/lib/session";
import { ideaLimits } from "@/lib/site";
import { listStaff } from "@/lib/staff";
import { addNotice, markChangedBy, markCreated, profileOf, rememberAuthor, setAssignee } from "@/lib/store";

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
  // create: the type's slug and the platform (a category id, or "other"), as the idea form sends them.
  type?: unknown;
  platform?: unknown;
  // assign: an admin's Discord id, or null for the whole team.
  assignee?: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

async function create(user: SessionUser, body: Body) {
  const title = text(body.title);
  const description = text(body.description);
  const status = body.status as FeedbackStatus;
  if (title.length < 3 || title.length > ideaLimits.title || description.length > ideaLimits.description || !boardStatuses.includes(status)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const { types, categories } = await getTags().catch(() => ({ types: [], categories: [] }));
    const typeId = types.find((type) => type.slug === body.type)?.id;
    const platformId = categories.find((category) => category.id === body.platform)?.id;
    // Reflet no longer creates an item without a description: a task without details is created with
    // its title as the description, which is then cleared (kept if Reflet refuses).
    const { feedbackId } = await createIdea(title, description || title, await userToken(user), typeId);
    // Before the status is set: Reflet reports it as a status change (api/webhooks/reflet).
    await markCreated(feedbackId);
    await Promise.all([
      setStatus(feedbackId, status),
      rememberAuthor(feedbackId, profileOf(user)),
      platformId ? updateTags(feedbackId, [platformId], []).catch(() => null) : null,
      description ? null : updateIdea(feedbackId, title, "").catch(() => null),
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
    // Deleting something Reflet no longer has is done already (it can remove an item on its own).
    const item = await getIdea(feedbackId).catch((error: unknown) => {
      if (body.action === "delete" && error instanceof RefletRequestError && error.status === 404) return null;
      throw error;
    });
    if (!item) {
      if (!can(user, "manage") && !can(user, "review")) return Response.json({ error: "forbidden" }, { status: 403 });
      revalidateTag(refletTag, { expire: 0 });
      return Response.json({ ok: true });
    }
    const inReview = item.status === "under_review";
    const to = body.status as FeedbackStatus;
    const approving = inReview && body.action === "status" && to === "open";
    const rejecting = inReview && body.action === "delete";
    if (!can(user, approving || rejecting ? "review" : "manage")) return Response.json({ error: "forbidden" }, { status: 403 });
    const target = { id: feedbackId, title: item.title, status: item.status };

    if (body.action === "status" && statuses.includes(to)) {
      // Before the status is set: Reflet's webhook posts the change on Discord and names who did it.
      await markChangedBy(feedbackId, { id: user.id, name: user.name, to });
      await setStatus(feedbackId, to);
      await logEvent(user, approving ? { type: "idea.approved", item: target } : { type: "item.moved", item: target, to });
    } else if (body.action === "delete") {
      await deleteIdea(feedbackId);
      // Its Discord post says what it was ("Bug report rejected") and for which platform.
      const { type: kind, platforms } = typeAndPlatforms(item.tags);
      await logEvent(user, { type: rejecting ? "idea.rejected" : "item.deleted", item: target, kind, platform: platforms.join(", ") || "Other" });
    } else if (body.action === "edit" && (await edit(feedbackId, body))) {
      await logEvent(user, { type: "item.edited", item: { ...target, title: text(body.title) } });
    } else if (body.action === "assign" && (body.assignee === null || typeof body.assignee === "string")) {
      // Only to someone who is an admin now.
      const assignee = body.assignee === null ? null : ((await listStaff()).find((member) => member.id === body.assignee) ?? null);
      if (body.assignee !== null && !assignee) return Response.json({ error: "invalid" }, { status: 400 });
      await setAssignee(feedbackId, assignee?.id ?? null, user.id);
      // The admin it is given to finds it under their bell (not when they took it themselves).
      if (assignee && assignee.id !== user.id) {
        await addNotice(assignee.id, { type: "assigned", actor: { name: user.name, avatar: user.avatar }, item: target });
      }
      await logEvent(
        user,
        assignee ? { type: "item.assigned", item: target, user: { id: assignee.id, name: assignee.name } } : { type: "item.unassigned", item: target },
      );
      return Response.json({ ok: true });
    } else {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    revalidateTag(refletTag, { expire: 0 });
    return Response.json({ ok: true });
  } catch (error) {
    return failure("admin action", error);
  }
}
