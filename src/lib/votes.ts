import type { FeedbackItem } from "reflet-sdk";
import type { BoardItem } from "./board";
import { authorsOf, downvoteCounts, downvotedBy, listBans } from "./store";

// Items from Reflet as the boards show them: voteCount becomes upvotes minus this site's downvotes,
// hasDownvoted says whether this user downvoted the item, and authorBanned marks an item whose
// author is banned (their name is shown struck through).
export async function forBoard<T extends FeedbackItem>(items: T[], userId?: string): Promise<(T & BoardItem)[]> {
  if (!items.length) return items;
  const ids = items.map((item) => item.id);
  const [counts, mine, authors, bans] = await Promise.all([
    downvoteCounts(ids),
    userId ? downvotedBy(userId) : Promise.resolve([] as string[]),
    authorsOf(ids),
    listBans(),
  ]);
  const own = new Set(mine);
  const banned = new Set(bans.map((ban) => ban.id));
  return items.map((item) => ({
    ...item,
    voteCount: item.voteCount - (counts[item.id] ?? 0),
    hasDownvoted: own.has(item.id),
    authorBanned: Boolean(authors[item.id] && banned.has(authors[item.id].id)),
  }));
}
