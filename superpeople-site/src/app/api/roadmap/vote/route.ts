import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { failure, refletTag, userToken, voteIdea } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { isBanned } from "@/lib/store";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (await isBanned(user.id)) return Response.json({ error: "banned" }, { status: 403 });
  const { feedbackId } = (await request.json().catch(() => ({}))) as { feedbackId?: unknown };
  if (typeof feedbackId !== "string" || !feedbackId) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    const result = await voteIdea(feedbackId, await userToken(user));
    revalidateTag(refletTag, "max");
    return Response.json(result);
  } catch (error) {
    return failure("vote", error);
  }
}
