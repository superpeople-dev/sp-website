import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { FeedbackStatus } from "reflet-sdk";
import { deleteIdea, failure, getIdea, refletTag, RefletRequestError } from "@/lib/reflet";
import { can } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { typeAndPlatforms } from "@/lib/kinds";
import { readSession, sameOrigin, type SessionUser } from "@/lib/session";
import { ideaLimits } from "@/lib/site";
import { listStaff } from "@/lib/staff";
import { assignTask, createTask, editTask, moveTask, statuses } from "@/lib/tasks";

// The admin panel and the item dialog create tasks on the roadmap (the developer API may also create ideas).
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
    const item = await createTask(user, { title, description, status, type: String(body.type ?? ""), platform: String(body.platform ?? "") });
    return Response.json({ item });
  } catch (error) {
    return failure("create task", error);
  }
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
      await moveTask(user, item, to);
    } else if (body.action === "delete") {
      await deleteIdea(feedbackId);
      // Its Discord post says what it was ("Bug report rejected") and for which platform.
      const { type: kind, platforms } = typeAndPlatforms(item.tags);
      await logEvent(user, { type: rejecting ? "idea.rejected" : "item.deleted", item: target, kind, platform: platforms.join(", ") || "Other" });
    } else if (body.action === "edit" && (await editTask(feedbackId, { ...body, title: text(body.title), description: text(body.description) }))) {
      await logEvent(user, { type: "item.edited", item: { ...target, title: text(body.title) } });
    } else if (body.action === "assign" && (body.assignee === null || typeof body.assignee === "string")) {
      // Only to someone who is an admin now.
      const assignee = body.assignee === null ? null : ((await listStaff()).find((member) => member.id === body.assignee) ?? null);
      if (body.assignee !== null && !assignee) return Response.json({ error: "invalid" }, { status: 400 });
      await assignTask(user, item, assignee);
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
