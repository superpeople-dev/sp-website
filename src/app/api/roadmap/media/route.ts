import type { NextRequest } from "next/server";
import { ownsIdea } from "@/lib/authorship";
import { failure, listMedia, mediaUploadUrl, saveMedia } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { mediaLimits } from "@/lib/site";
import { isBanned } from "@/lib/store";

type Body = {
  action?: unknown;
  feedbackId?: unknown;
  storageId?: unknown;
  mimeType?: unknown;
  size?: unknown;
  filename?: unknown;
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (await isBanned(user.id)) return Response.json({ error: "banned" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Body;
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  if (!feedbackId) return Response.json({ error: "invalid" }, { status: 400 });

  try {
    if (!(await ownsIdea(user, feedbackId))) return Response.json({ error: "forbidden" }, { status: 403 });

    if (body.action === "url") {
      if ((await listMedia(feedbackId)).length >= mediaLimits.files) {
        return Response.json({ error: "limit" }, { status: 429 });
      }
      return Response.json({ uploadUrl: await mediaUploadUrl() });
    }

    if (body.action === "save") {
      const storageId = typeof body.storageId === "string" ? body.storageId : "";
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
      const size = typeof body.size === "number" ? body.size : -1;
      const filename = typeof body.filename === "string" ? body.filename.trim().slice(0, 120) : "";
      const max = mimeType.startsWith("video/") ? mediaLimits.video : mediaLimits.image;
      if (!/^[\w-]+$/.test(storageId) || !mediaLimits.types.includes(mimeType) || size < 0 || size > max) {
        return Response.json({ error: "invalid" }, { status: 400 });
      }
      await saveMedia(feedbackId, storageId, mimeType, size, filename || "attachment");
      return Response.json({ ok: true });
    }

    return Response.json({ error: "invalid" }, { status: 400 });
  } catch (error) {
    return failure("media", error);
  }
}
