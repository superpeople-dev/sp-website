import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { deleteComment, failure, refletTag } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const { commentId } = (await request.json().catch(() => ({}))) as { commentId?: unknown };
  if (typeof commentId !== "string" || !commentId) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await deleteComment(commentId);
    revalidateTag(refletTag, { expire: 0 });
    return Response.json({ ok: true });
  } catch (error) {
    return failure("comment delete", error);
  }
}
