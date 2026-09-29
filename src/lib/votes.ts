import type { FeedbackItem } from "reflet-sdk";
import type { BoardItem } from "./board";
import { downvoteCounts, downvotedBy } from "./store";

// Folds this site's downvotes into items from Reflet: voteCount becomes upvotes minus downvotes, and
// hasDownvoted says whether this user downvoted the item.
export async function withDownvotes<T extends FeedbackItem>(items: T[], userId?: string): Promise<(T & BoardItem)[]> {
  if (!items.length) return items;
  const [counts, mine] = await Promise.all([
    downvoteCounts(items.map((item) => item.id)),
    userId ? downvotedBy(userId) : Promise.resolve([] as string[]),
  ]);
  const own = new Set(mine);
  return items.map((item) => ({ ...item, voteCount: item.voteCount - (counts[item.id] ?? 0), hasDownvoted: own.has(item.id) }));
}
