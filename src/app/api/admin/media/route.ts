import type { NextRequest } from "next/server";
import { can } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { deleteMedia, failure, getIdea } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user || !can(user, "manage")) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const { mediaId, feedbackId } = (await request.json().catch(() => ({}))) as { mediaId?: unknown; feedbackId?: unknown };
  if (typeof mediaId !== "string" || !mediaId) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await deleteMedia(mediaId);
    const item = typeof feedbackId === "string" && feedbackId ? await getIdea(feedbackId, 60).catch(() => null) : null;
    await logEvent(user, { type: "media.deleted", item: item ? { id: item.id, title: item.title, status: item.status } : undefined });
    return Response.json({ ok: true });
  } catch (error) {
    return failure("media delete", error);
  }
}
