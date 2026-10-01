import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { can } from "@/lib/board";
import { devError, devJson, devUser } from "@/lib/devapi";
import { logEvent } from "@/lib/events";
import { addComment, failure, getIdea, refletTag, RefletRequestError, userToken } from "@/lib/reflet";
import { ideaLimits } from "@/lib/site";
import { commentsOff } from "@/lib/store";

// A comment as the key's admin: where an agent says what was done.
export async function POST(request: NextRequest, { params }: RouteContext<"/api/dev/items/[id]/comments">) {
  const { user, error } = await devUser(request);
  if (error) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text || text.length > ideaLimits.comment) return devError("invalid", 400, `body is 1 to ${ideaLimits.comment} characters`);
  try {
    const item = await getIdea(id).catch((err: unknown) => {
      if (err instanceof RefletRequestError && err.status === 404) return null;
      throw err;
    });
    if (!item) return devError("not_found", 404, "No item with this id.");
    if (!can(user, "comments") && (await commentsOff(id))) return devError("forbidden", 403, "Comments are turned off on this item.");
    const commentId = await addComment(id, text, await userToken(user));
    await logEvent(user, { type: "comment.posted", item: { id, title: item.title, status: item.status }, text, via: user.via });
    revalidateTag(refletTag, { expire: 0 });
    return devJson({ ok: true, id: commentId }, 201);
  } catch (err) {
    return failure("dev comment", err);
  }
}
