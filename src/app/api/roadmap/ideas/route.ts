import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { pendingCount } from "@/lib/authorship";
import { logEvent } from "@/lib/events";
import { createIdea, failure, getIdeaFor, getTags, refletTag, setStatus, userToken, voteIdea } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { ideaLimits } from "@/lib/site";
import { isBanned, profileOf, rememberAuthor } from "@/lib/store";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (await isBanned(user.id)) return Response.json({ error: "banned" }, { status: 403 });
  if (!user.admin && (await pendingCount(user).catch(() => 0)) >= ideaLimits.pending) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; description?: unknown; type?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (title.length < 3 || title.length > ideaLimits.title || description.length > ideaLimits.description) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const { types } = await getTags().catch(() => ({ types: [] }));
    const tagId = types.find((type) => type.slug === body.type)?.id;
    const token = await userToken(user);
    const { feedbackId } = await createIdea(title, description, token, tagId);
    await Promise.all([setStatus(feedbackId, "under_review"), rememberAuthor(feedbackId, profileOf(user))]);
    // Like Reddit, a post starts with its author's upvote. Reflet's vote toggles, so only when the
    // author has none yet; a failure here doesn't fail the post.
    await getIdeaFor(feedbackId, token)
      .then((item) => (item.hasVoted ? null : voteIdea(feedbackId, token)))
      .catch(() => null);
    await logEvent(user, { type: "idea.posted", item: { id: feedbackId, title, status: "under_review" } });
    revalidateTag(refletTag, { expire: 0 });
    return Response.json({ pending: true, feedbackId });
  } catch (error) {
    return failure("new idea", error);
  }
}
