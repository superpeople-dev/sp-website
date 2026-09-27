import { getIdea, listPending } from "./reflet";
import type { SessionUser } from "./session";
import { authorsOf, storeReady } from "./store";

const recent = 15 * 60 * 1000;

export async function pendingCount(user: SessionUser) {
  const pending = await listPending();
  if (!storeReady) return pending.filter((item) => item.author?.name === user.name).length;
  const authors = await authorsOf(pending.map((item) => item.id));
  return pending.filter((item) => authors[item.id]?.id === user.id).length;
}

export async function ownsIdea(user: SessionUser, feedbackId: string) {
  if (user.admin) return true;
  if (storeReady) return (await authorsOf([feedbackId]))[feedbackId]?.id === user.id;
  const item = await getIdea(feedbackId);
  return item.author?.name === user.name && Date.now() - item.createdAt < recent;
}
