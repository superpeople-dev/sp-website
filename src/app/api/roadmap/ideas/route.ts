import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { pendingCount } from "@/lib/authorship";
import { readsAsEnglish } from "@/lib/english";
import { logEvent } from "@/lib/events";
import { createIdea, failure, getAnyIdea, getTags, refletTag, setStatus, updateTags, userToken, voteIdea } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { isOffensive, offensiveName } from "@/lib/moderation";
import { ideaLimits, ideaTypes } from "@/lib/site";
import { isBanned, profileOf, rememberAuthor } from "@/lib/store";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (await isBanned(user.id)) return Response.json({ error: "banned" }, { status: 403 });
  if (offensiveName(user)) return Response.json({ error: "name" }, { status: 403 });
  if (!user.admin && (await pendingCount(user).catch(() => 0)) >= ideaLimits.pending) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; description?: unknown; type?: unknown; platform?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (title.length < 3 || title.length > ideaLimits.title || description.length > ideaLimits.description) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  // A type and a platform are both required: one of lib/site.ts ideaTypes, and a category id or "other".
  const kind = ideaTypes.find((type) => type.slug === body.type)?.slug;
  if (!kind || typeof body.platform !== "string" || !body.platform) return Response.json({ error: "invalid" }, { status: 400 });
  if (isOffensive(title) || isOffensive(description)) return Response.json({ error: "offensive" }, { status: 422 });
  // In English, the one language the whole team reads (lib/english.ts).
  if (!readsAsEnglish(`${title}\n${description}`)) return Response.json({ error: "english" }, { status: 422 });
  try {
    const { types, categories } = await getTags().catch(() => ({ types: [], categories: [] }));
    const tagId = types.find((type) => type.slug === kind)?.id;
    // The platform (Launcher, Game, …) is one of Reflet's categories; "other" is none of them. Without
    // the categories (Reflet didn't answer), any platform goes through untagged.
    const platform = categories.find((category) => category.id === body.platform);
    const platformId = platform?.id;
    if (!platformId && body.platform !== "other" && categories.length) return Response.json({ error: "invalid" }, { status: 400 });
    const token = await userToken(user);
    const { feedbackId } = await createIdea(title, description, token, tagId);
    await Promise.all([
      setStatus(feedbackId, "under_review"),
      rememberAuthor(feedbackId, profileOf(user)),
      platformId ? updateTags(feedbackId, [platformId], []).catch(() => null) : null,
    ]);
    // Like Reddit, a post starts with its author's upvote. Reflet's vote toggles, so only when it has
    // no vote yet (nobody else can see it: Reflet holds a new idea, which is also why it is read with
    // the secret key); a failure here doesn't fail the post.
    await getAnyIdea(feedbackId)
      .then((item) => (item.voteCount ? null : voteIdea(feedbackId, token)))
      .catch(() => null);
    await logEvent(user, {
      type: "idea.posted",
      item: { id: feedbackId, title, status: "under_review" },
      kind,
      platform: platform?.name ?? "Other",
      text: description || undefined,
    });
    revalidateTag(refletTag, { expire: 0 });
    return Response.json({ pending: true, feedbackId });
  } catch (error) {
    return failure("new idea", error);
  }
}
