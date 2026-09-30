import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { Comment, FeedbackAuthor } from "reflet-sdk";
import { can, type Author, type CommentView, type MediaView } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { isOffensive, offensiveName } from "@/lib/moderation";
import { addComment, deleteComment, failure, getIdea, listComments, listMedia, refletTag, userToken } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { ideaLimits, mediaLimits } from "@/lib/site";
import { adminCheck, listStaff, type StaffMember } from "@/lib/staff";
import {
  assigneeOf,
  authorsOf,
  commentsOff,
  isBanned,
  listBans,
  profileOf,
  rememberAuthor,
  setCommentsOff,
  storeReady,
  type Profile,
} from "@/lib/store";

const noStore = { "Cache-Control": "no-store" };

type Checks = { admin: (id: string, roleAdmin?: boolean) => boolean; banned: Set<string> };

const authorView = (profile: Profile | undefined, fallback: FeedbackAuthor | null, showId: boolean, checks: Checks): Author | null => {
  if (profile) {
    return {
      ...(showId && { id: profile.id }),
      name: profile.name,
      username: profile.username,
      avatar: profile.avatar,
      admin: checks.admin(profile.id, profile.admin),
      banned: checks.banned.has(profile.id),
    };
  }
  return fallback?.name ? { name: fallback.name, avatar: fallback.avatar } : null;
};

const checks = async (): Promise<Checks> => {
  const [admin, bans] = await Promise.all([adminCheck(), listBans()]);
  return { admin, banned: new Set(bans.map((ban) => ban.id)) };
};

type AnyComment = Omit<Comment, "replies"> & { replies?: Comment["replies"] };
const flatten = (comments: AnyComment[]): AnyComment[] => comments.flatMap((comment) => [comment, ...flatten(comment.replies ?? [])]);

export async function GET(request: NextRequest) {
  const feedbackId = request.nextUrl.searchParams.get("feedbackId") ?? "";
  if (!feedbackId) return Response.json({ error: "invalid" }, { status: 400 });
  const viewer = await readSession(request);
  try {
    const [comments, files, people, off, assignedId] = await Promise.all([
      listComments(feedbackId),
      listMedia(feedbackId).catch(() => []),
      checks(),
      commentsOff(feedbackId),
      assigneeOf(feedbackId),
    ]);
    // Who the item is assigned to (none: the whole team), and for the admins who manage items, the
    // admins they can assign it to. An admin removed since then leaves it to the team again.
    const manager = viewer !== null && can(viewer, "manage");
    const staff = assignedId || manager ? await listStaff() : [];
    const member = (m: StaffMember): Author => ({ ...(manager && { id: m.id }), name: m.name, username: m.username, avatar: m.avatar, admin: true });
    const assigned = staff.find((m) => m.id === assignedId);
    const media: MediaView[] = files
      .filter((file) => file.url && mediaLimits.types.includes(file.mimeType))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((file) => ({ id: file._id, url: file.url ?? "", type: file.mimeType, name: file.filename }));
    const authors = await authorsOf([feedbackId, ...flatten(comments).map((comment) => comment.id)]);
    const showId = viewer?.admin === true;
    const view = (comment: AnyComment): CommentView => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: authorView(authors[comment.id], comment.author, showId, people),
      mine: viewer !== null && authors[comment.id]?.id === viewer.id,
      replies: (comment.replies ?? []).map(view),
    });
    return Response.json(
      {
        author: authorView(authors[feedbackId], null, showId, people),
        comments: comments.map(view),
        media,
        off,
        assignee: assigned ? member(assigned) : null,
        ...(manager && { staff: staff.map(member) }),
      },
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
  if (offensiveName(user)) return Response.json({ error: "name" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { feedbackId?: unknown; body?: unknown };
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!feedbackId || !text || text.length > ideaLimits.comment) return Response.json({ error: "invalid" }, { status: 400 });
  if (isOffensive(text)) return Response.json({ error: "offensive" }, { status: 422 });
  // Comments turned off: only admins who moderate comments can still answer.
  if (!can(user, "comments") && (await commentsOff(feedbackId))) return Response.json({ error: "off" }, { status: 403 });
  try {
    const id = await addComment(feedbackId, text, await userToken(user));
    const profile = profileOf(user);
    await rememberAuthor(id, profile);
    revalidateTag(refletTag, "max");
    const item = await getIdea(feedbackId, 60).catch(() => null);
    await logEvent(user, { type: "comment.posted", item: item ? { id: feedbackId, title: item.title, status: item.status } : undefined, text });
    const comment: CommentView = {
      id,
      body: text,
      createdAt: Date.now(),
      author: { id: user.id, name: user.name, username: user.username, avatar: user.avatar, admin: user.admin },
      mine: true,
      replies: [],
    };
    return Response.json({ comment });
  } catch (error) {
    return failure("comment", error);
  }
}

// Turning an item's comments off (or back on): admins who moderate comments or manage items.
export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user || !(can(user, "comments") || can(user, "manage"))) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  if (!storeReady) return Response.json({ error: "store" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { feedbackId?: unknown; off?: unknown };
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  if (!feedbackId || typeof body.off !== "boolean") return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await setCommentsOff(feedbackId, body.off);
    const item = await getIdea(feedbackId, 60).catch(() => null);
    await logEvent(user, {
      type: body.off ? "comments.off" : "comments.on",
      item: item ? { id: feedbackId, title: item.title, status: item.status } : undefined,
    });
    return Response.json({ off: body.off });
  } catch (error) {
    return failure("comments switch", error);
  }
}

// Deleting a comment, for good: its author, or an admin allowed to ("comments"). The text is kept in
// the activity log.
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { feedbackId?: unknown; commentId?: unknown };
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : "";
  const commentId = typeof body.commentId === "string" ? body.commentId : "";
  if (!feedbackId || !commentId) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    const [comments, authors, item] = await Promise.all([
      listComments(feedbackId),
      authorsOf([commentId]),
      getIdea(feedbackId, 60).catch(() => null),
    ]);
    const comment = flatten(comments).find((entry) => entry.id === commentId);
    if (!comment) return Response.json({ error: "missing" }, { status: 404 });
    const author = authors[commentId];
    const own = author?.id === user.id;
    if (!own && !can(user, "comments")) return Response.json({ error: "forbidden" }, { status: 403 });
    await deleteComment(commentId);
    revalidateTag(refletTag, { expire: 0 });
    await logEvent(user, {
      type: "comment.deleted",
      item: item ? { id: feedbackId, title: item.title, status: item.status } : undefined,
      user: author ? { id: author.id, name: author.name } : comment.author?.name ? { id: "", name: comment.author.name } : undefined,
      text: comment.body,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return failure("comment delete", error);
  }
}
