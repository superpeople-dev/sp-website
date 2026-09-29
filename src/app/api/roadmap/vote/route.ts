import { revalidateTag } from "next/cache";
import { after, type NextRequest } from "next/server";
import { announceVote } from "@/lib/discord";
import { failure, getIdeaFor, refletTag, userToken, voteIdea } from "@/lib/reflet";
import { readSession, sameOrigin } from "@/lib/session";
import { downvoteCounts, hasDownvoted, isBanned, setDownvote, storeReady } from "@/lib/store";

// Upvotes live in Reflet (its vote toggles), downvotes in our store. Voting one way takes back a
// vote the other way; the same way again takes the vote back. Answers the new score (upvotes minus
// downvotes) and where this user stands.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (await isBanned(user.id)) return Response.json({ error: "banned" }, { status: 403 });
  const { feedbackId, direction = "up" } = (await request.json().catch(() => ({}))) as { feedbackId?: unknown; direction?: unknown };
  if (typeof feedbackId !== "string" || !feedbackId || (direction !== "up" && direction !== "down")) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  if (direction === "down" && !storeReady) return Response.json({ error: "unavailable" }, { status: 503 });
  try {
    const token = await userToken(user);
    const [item, wasDown] = await Promise.all([getIdeaFor(feedbackId, token), hasDownvoted(feedbackId, user.id)]);
    let up = item.hasVoted;
    let upvotes = item.voteCount;
    let down = wasDown;
    let downvotes: number | null = null;
    const toggleUp = async () => {
      const result = await voteIdea(feedbackId, token);
      up = result.voted;
      upvotes = result.voteCount;
    };
    if (down) {
      downvotes = await setDownvote(feedbackId, user.id, false);
      down = false;
      if (direction === "up") await toggleUp();
    } else if (direction === "up") {
      await toggleUp();
    } else {
      if (up) await toggleUp();
      downvotes = await setDownvote(feedbackId, user.id, true);
      down = true;
    }
    downvotes ??= (await downvoteCounts([feedbackId]))[feedbackId] ?? 0;
    revalidateTag(refletTag, "max");
    const score = upvotes - downvotes;
    // Discord hears about votes given, not taken back.
    if ((direction === "up" && up) || (direction === "down" && down)) {
      after(() => announceVote(user, { id: feedbackId, title: item.title, status: item.status }, direction, score));
    }
    return Response.json({ voteCount: score, voted: up, downvoted: down });
  } catch (error) {
    return failure("vote", error);
  }
}
