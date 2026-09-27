import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { Comment, FeedbackAuthor } from "reflet-sdk";
import type { Author, CommentView, MediaView } from "@/lib/board";
import { addComment, failure, listComments, listMedia, refletTag, userToken } from "@/lib/reflet";
import { isListedAdmin, readSession, sameOrigin } from "@/lib/session";
import { ideaLimits, mediaLimits } from "@/lib/site";
import { authorsOf, isBanned, profileOf, rememberAuthor, type Profile } from "@/lib/store";

const noStore = { "Cache-Control": "no-store" };

const authorView = (profile: Profile | undefined, fallback: FeedbackAuthor | null, showId: boolean): Author | null => {
  if (profile) {
    return {
      ...(showId && { id: profile.id }),
      name: profile.name,
      username: profile.username,
      avatar: profile.avatar,
      admin: profile.admin || isListedAdmin(profile.id),
    };
  }
  return fallback?.name ? { name: fallback.name, avatar: fallback.avatar } : null;
};

export async function GET(request: NextRequest) {
  const feedbackId = request.nextUrl.searchParams.get("feedbackId") ?? "";
  if (!feedbackId) return Response.json({ error: "invalid" }, { status: 400 });
  const viewer = await readSession(request);
  try {
    const [comments, files] = await Promise.all([listComments(feedbackId), listMedia(feedbackId).catch(() => [])]);
    const media: MediaView[] = files
      .filter((file) => file.url && mediaLimits.types.includes(file.mimeType))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((file) => ({ id: file._id, url: file.url ?? "", type: file.mimeType, name: file.filename }));
    const authors = await authorsOf([feedbackId, ...comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)])]);
    const showId = viewer?.admin === true;
    const view = (comment: Omit<Comment, "replies"> & { replies?: Comment["replies"] }): CommentView => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: authorView(authors[comment.id], comment.author, showId),
      replies: (comment.replies ?? []).map(view),
    });
    return Response.json(
      { author: authorView(authors[feedbackId], null, showId), comments: comments.map(view), media },
      { headers: noStore },
    );
  } catch (error) {
    return failure("comments", error);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (await isBanned(user.id)) return Response.json({ error: "banned" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { feedbackId?: unknown; body?: unknown };
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!feedbackId || !text || text.length > ideaLimits.comment) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    const id = await addComment(feedbackId, text, await userToken(user));
    const profile = profileOf(user);
    await rememberAuthor(id, profile);
    revalidateTag(refletTag, "max");
    const comment: CommentView = {
      id,
      body: text,
      createdAt: Date.now(),
      author: authorView(profile, null, true),
      replies: [],
    };
    return Response.json({ comment });
  } catch (error) {
    return failure("comment", error);
  }
}
