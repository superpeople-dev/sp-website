import type { NextRequest } from "next/server";
import { deleteMedia, failure } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const { mediaId } = (await request.json().catch(() => ({}))) as { mediaId?: unknown };
  if (typeof mediaId !== "string" || !mediaId) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await deleteMedia(mediaId);
    return Response.json({ ok: true });
  } catch (error) {
    return failure("media delete", error);
  }
}
