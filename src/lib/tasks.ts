import { revalidateTag } from "next/cache";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { logEvent } from "./events";
import { createIdea, getAnyIdea, getTags, refletTag, setPublication, setStatus, updateIdea, updateTags, userToken, type Publication } from "./reflet";
import type { SessionUser } from "./session";
import { ideaLimits } from "./site";
import type { StaffMember } from "./staff";
import { addNotice, markChangedBy, markCreated, profileOf, rememberAuthor, setAssignee } from "./store";

// What admins do to items, from the admin panel and the item dialog (app/api/admin/feedback) and
// from the developer API (app/api/dev): create a task or an idea, edit one, move one, assign one. Each is posted
// on Discord (lib/announce.ts, when its status changes) and written to the activity log.

export const statuses: FeedbackStatus[] = ["open", "under_review", "planned", "in_progress", "completed", "closed"];
// Where an admin may create something: straight onto Bugs & Ideas (open, no review) or the roadmap.
export const createStatuses: FeedbackStatus[] = ["open", "planned", "in_progress", "completed"];

// via: the API key's name when it came through the developer API (the activity log shows it).
type Actor = SessionUser & { via?: string };

export type NewTask = { title: string; description: string; type?: string; platform?: string; status: FeedbackStatus };

// null when the task is valid, else why not.
export function checkNewTask(task: NewTask) {
  if (task.title.length < 3 || task.title.length > ideaLimits.titleMax) return "title";
  if (task.description.length > ideaLimits.description) return "description";
  if (!createStatuses.includes(task.status)) return "status";
  return null;
}

// type: an ideaTypes slug; platform: a category id (or anything else for none).
// pending: a new item waits for review until it is published (lib/reflet.ts). What an admin makes
// is published at once; pending is true only when that failed: the item exists all the same (so it is
// not created again) and shows on the site once it is approved.
export async function createTask(user: Actor, task: NewTask): Promise<{ item: FeedbackItem; pending: boolean }> {
  const { title, description, status } = task;
  const { types, categories } = await getTags().catch(() => ({ types: [], categories: [] }));
  const type = types.find((entry) => entry.slug === task.type);
  const platform = categories.find((category) => category.id === task.platform);
  const { feedbackId, isApproved } = await createIdea(title, description, await userToken(user), type?.id);
  // Before the status is set: its Discord post says it is new (lib/announce.ts).
  await markCreated(feedbackId);
  const pending = isApproved === false && !(await setPublication(feedbackId, "approved").then(() => true, () => false));
  await Promise.all([
    setStatus(feedbackId, status),
    rememberAuthor(feedbackId, profileOf(user)),
    platform ? updateTags(feedbackId, [platform.id], []).catch(() => null) : null,
  ]);
  revalidateTag(refletTag, { expire: 0 });
  await logEvent(user, { type: "item.created", item: { id: feedbackId, title, status }, to: status, via: user.via });
  return { item: { ...(await getAnyIdea(feedbackId)), status }, pending };
}

// A new title and description, and the type and platform (tag ids; an empty one takes it off).
// False when the title or the description does not fit.
export async function editTask(feedbackId: string, edit: { title: string; description: string; typeId?: unknown; categoryId?: unknown }) {
  const { title, description } = edit;
  if (title.length < 3 || title.length > ideaLimits.titleMax || description.length > ideaLimits.description) return false;
  const [{ categories, types }, item] = await Promise.all([getTags(), getAnyIdea(feedbackId)]);
  const managed = new Set([...categories, ...types].map((tag) => tag.id));
  const wanted = [
    types.find((type) => type.id === edit.typeId)?.id,
    categories.find((category) => category.id === edit.categoryId)?.id,
  ].filter((id): id is string => Boolean(id));
  const current = item.tags.map((tag) => tag.id).filter((id) => managed.has(id));
  const add = wanted.filter((id) => !current.includes(id));
  const remove = current.filter((id) => !wanted.includes(id));
  await updateIdea(feedbackId, title, description);
  if (add.length || remove.length) await updateTags(feedbackId, add, remove);
  return true;
}

// Moves an item; from "under review" to "open" is approving it. Approving an idea, or moving one still
// held for review out of it, publishes it (lib/reflet.ts): else nobody but the admins would see it.
export async function moveTask(user: Actor, item: FeedbackItem & { publication?: Publication }, to: FeedbackStatus) {
  const target = { id: item.id, title: item.title, status: item.status };
  // Before the status is set: its Discord post (lib/announce.ts) names who did it.
  await markChangedBy(item.id, { id: user.id, name: user.name, to });
  await setStatus(item.id, to);
  const approving = item.status === "under_review" && to === "open";
  if (to !== "under_review" && (approving || item.publication === "pending")) await setPublication(item.id, "approved");
  await logEvent(user, approving ? { type: "idea.approved", item: target, via: user.via } : { type: "item.moved", item: target, to, via: user.via });
}

// Gives an item to an admin (one of listStaff()), or back to the whole team (null). The admin it is
// given to finds it under their bell (not when they took it themselves).
export async function assignTask(user: Actor, item: Pick<FeedbackItem, "id" | "title" | "status">, assignee: Pick<StaffMember, "id" | "name"> | null) {
  const target = { id: item.id, title: item.title, status: item.status };
  await setAssignee(item.id, assignee?.id ?? null, user.id);
  if (assignee && assignee.id !== user.id) {
    await addNotice(assignee.id, { type: "assigned", actor: { name: user.name, avatar: user.avatar }, item: target });
  }
  await logEvent(
    user,
    assignee
      ? { type: "item.assigned", item: target, user: { id: assignee.id, name: assignee.name }, via: user.via }
      : { type: "item.unassigned", item: target, via: user.via },
  );
}
