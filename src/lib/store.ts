import { Redis } from "@upstash/redis";
import type { FeedbackStatus } from "reflet-sdk";
import type { ActivityEvent, Notice, Permission } from "./board";
import type { SessionUser } from "./session";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const storeReady = redis !== null;

export type Profile = { id: string; name: string; username: string; avatar: string; admin: boolean };
export type Ban = Omit<Profile, "admin"> & { by: string; at: number; reason?: string };

const bansKey = "sp:bans";
const authorsKey = "sp:authors";

export const profileOf = (user: SessionUser): Profile => ({
  id: user.id,
  name: user.name,
  username: user.username,
  avatar: user.avatar,
  admin: user.admin,
});

async function attempt<T>(action: string, fallback: T, run: (client: Redis) => Promise<T>): Promise<T> {
  if (!redis) return fallback;
  try {
    return await run(redis);
  } catch (error) {
    console.error(`[store] ${action} failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

export const isBanned = (id: string) => attempt("ban check", false, async (client) => (await client.hexists(bansKey, id)) === 1);

export const listBans = () =>
  attempt("ban list", [] as Ban[], async (client) =>
    Object.values((await client.hgetall<Record<string, Ban>>(bansKey)) ?? {}).sort((a, b) => b.at - a.at),
  );

export async function ban(entry: Ban) {
  if (!redis) throw new Error("Store is not configured");
  await redis.hset(bansKey, { [entry.id]: entry });
}

export async function unban(id: string) {
  if (!redis) throw new Error("Store is not configured");
  await redis.hdel(bansKey, id);
}

export const rememberAuthor = (itemId: string, profile: Profile) =>
  attempt("author save", undefined, async (client) => {
    await client.hset(authorsKey, { [itemId]: profile });
  });

export const authorsOf = (ids: string[]) =>
  attempt("author lookup", {} as Record<string, Profile>, async (client) => {
    if (!ids.length) return {};
    const found = await client.hmget<Record<string, Profile | null>>(authorsKey, ...ids);
    return Object.fromEntries(Object.entries(found ?? {}).filter((entry): entry is [string, Profile] => entry[1] !== null));
  });

// Downvotes. Reflet keeps the upvotes; a downvote is stored here: who downvoted each item (a set per
// item), what each user downvoted (a set per user, to show their choice) and a count per item (to
// read many items at once). The score shown everywhere is upvotes minus downvotes.
const downCountKey = "sp:downvotes";
const downByItem = (itemId: string) => `sp:downvoters:${itemId}`;
const downByUser = (userId: string) => `sp:downvoted:${userId}`;

export const downvoteCounts = (ids: string[]) =>
  attempt("downvote counts", {} as Record<string, number>, async (client) => {
    if (!ids.length) return {};
    const found = await client.hmget<Record<string, number | null>>(downCountKey, ...ids);
    return Object.fromEntries(
      Object.entries(found ?? {}).flatMap(([id, count]) => (Number(count) > 0 ? [[id, Number(count)]] : [])),
    );
  });

export const downvotedBy = (userId: string) =>
  attempt("user downvotes", [] as string[], (client) => client.smembers(downByUser(userId)));

export const hasDownvoted = (itemId: string, userId: string) =>
  attempt("downvote check", false, async (client) => (await client.sismember(downByItem(itemId), userId)) === 1);

// Adds or removes one user's downvote; returns the item's downvote count afterwards.
export async function setDownvote(itemId: string, userId: string, on: boolean) {
  if (!redis) throw new Error("Store is not configured");
  const changed = on ? await redis.sadd(downByItem(itemId), userId) : await redis.srem(downByItem(itemId), userId);
  if (changed) {
    await Promise.all([
      on ? redis.sadd(downByUser(userId), itemId) : redis.srem(downByUser(userId), itemId),
      redis.hincrby(downCountKey, itemId, on ? 1 : -1),
    ]);
  }
  return redis.scard(downByItem(itemId));
}

// Admins as the owners set them (lib/staff.ts): their permissions, or "removed" for someone who is
// no longer an admin even if they are on the list in lib/admins.ts or have the Discord role.
export type StaffEntry = { id: string; name: string; permissions: Permission[]; removed?: boolean; by: string; at: number };
const staffKey = "sp:staff";

export const staffEntry = (id: string) =>
  attempt("staff lookup", null as StaffEntry | null, (client) => client.hget<StaffEntry>(staffKey, id));

export const staffEntries = () =>
  attempt("staff list", {} as Record<string, StaffEntry>, async (client) => (await client.hgetall<Record<string, StaffEntry>>(staffKey)) ?? {});

export async function saveStaff(entry: StaffEntry) {
  if (!redis) throw new Error("Store is not configured");
  await redis.hset(staffKey, { [entry.id]: entry });
}

// Everyone's Discord profile as of their last sign-in, for the admins list's pictures.
const profilesKey = "sp:profiles";

export const rememberProfile = (profile: Profile) =>
  attempt("profile save", undefined, async (client) => {
    await client.hset(profilesKey, { [profile.id]: profile });
  });

export const profilesOf = (ids: string[]) =>
  attempt("profile lookup", {} as Record<string, Profile>, async (client) => {
    if (!ids.length) return {};
    const found = await client.hmget<Record<string, Profile | null>>(profilesKey, ...ids);
    return Object.fromEntries(Object.entries(found ?? {}).filter((entry): entry is [string, Profile] => entry[1] !== null));
  });

// The profiles saved with ideas and comments (older than sp:profiles), to find someone's picture.
export const allAuthors = () =>
  attempt("author list", [] as Profile[], async (client) => Object.values((await client.hgetall<Record<string, Profile>>(authorsKey)) ?? {}));

// The activity log: newest first, the last 5,000 events.
const eventsKey = "sp:events";
const keptEvents = 5000;

export const saveEvent = (event: ActivityEvent) =>
  attempt("event save", undefined, async (client) => {
    await client.lpush(eventsKey, event);
    await client.ltrim(eventsKey, 0, keptEvents - 1);
  });

export const readEvents = () =>
  attempt("event list", [] as ActivityEvent[], (client) => client.lrange<ActivityEvent>(eventsKey, 0, keptEvents - 1));

// Items whose comments an admin turned off: nobody but admins can add more.
const lockedKey = "sp:comments-off";

export const commentsOff = (itemId: string) =>
  attempt("comments lock check", false, async (client) => (await client.sismember(lockedKey, itemId)) === 1);

export async function setCommentsOff(itemId: string, off: boolean) {
  if (!redis) throw new Error("Store is not configured");
  if (off) await redis.sadd(lockedKey, itemId);
  else await redis.srem(lockedKey, itemId);
}

// Who works on an item: an admin (their Discord id). Not set, it is the whole team's. Kept as an
// object: Upstash reads a bare numeric string back as a number, and a Discord id is too long for one.
const assigneesKey = "sp:assignees";
type Assignment = { id: string; by: string; at: number };

export const assigneeOf = (itemId: string) =>
  attempt("assignee lookup", null as string | null, async (client) => (await client.hget<Assignment>(assigneesKey, itemId))?.id ?? null);

export async function setAssignee(itemId: string, staffId: string | null, by: string) {
  if (!redis) throw new Error("Store is not configured");
  if (staffId) await redis.hset(assigneesKey, { [itemId]: { id: staffId, by, at: Date.now() } satisfies Assignment });
  else await redis.hdel(assigneesKey, itemId);
}

// Someone's notifications, newest first, the last 50; and when they last opened the list (what came
// after is new).
const noticesKey = (userId: string) => `sp:notices:${userId}`;
const noticesSeenKey = (userId: string) => `sp:notices-seen:${userId}`;
const keptNotices = 50;

export const addNotice = (userId: string, notice: Omit<Notice, "id" | "at">) =>
  attempt("notice save", undefined, async (client) => {
    await client.lpush(noticesKey(userId), { id: crypto.randomUUID(), at: Date.now(), ...notice } satisfies Notice);
    await client.ltrim(noticesKey(userId), 0, keptNotices - 1);
  });

export const readNotices = (userId: string) =>
  attempt("notice list", { notices: [] as Notice[], seen: 0 }, async (client) => {
    const [notices, seen] = await Promise.all([client.lrange<Notice>(noticesKey(userId), 0, keptNotices - 1), client.get<number>(noticesSeenKey(userId))]);
    return { notices, seen: Number(seen) || 0 };
  });

export const markNoticesSeen = (userId: string) =>
  attempt("notice seen", undefined, async (client) => {
    await client.set(noticesSeenKey(userId), Date.now());
  });

// Who changed an item's status on the site (app/api/admin/feedback), for the Reflet webhook's Discord
// post to name them ("Approved by", "Moved by"): kept 10 minutes, the webhook comes within seconds.
export type StatusChange = { id: string; name: string; to: FeedbackStatus };
const changedByKey = (itemId: string) => `sp:changed-by:${itemId}`;
export const markChangedBy = (itemId: string, change: StatusChange) =>
  attempt("status change mark", null, (client) => client.set(changedByKey(itemId), change, { ex: 600 }));
export const changedBy = (itemId: string) =>
  attempt("status change check", null as StatusChange | null, (client) => client.get<StatusChange>(changedByKey(itemId)));

// Tasks an admin just created on the site (app/api/admin/feedback): Reflet reports the status the task
// was created in as a status change, and the Discord post should say "New task", not "Moved to".
const createdKey = (itemId: string) => `sp:created:${itemId}`;
export const markCreated = (itemId: string) =>
  attempt("created mark", null, (client) => client.set(createdKey(itemId), 1, { ex: 600 }));
export const justCreated = (itemId: string) =>
  attempt("created check", false, async (client) => (await client.exists(createdKey(itemId))) === 1);

// Launcher sign-in (app/api/auth/launcher): the Discord callback leaves the sealed session here under a
// one-time code, for two minutes, until the launcher trades the code (and its PKCE verifier) for it.
export type LauncherLogin = { token: string; challenge: string };
const launcherLoginKey = (code: string) => `sp:launcher-login:${code}`;
export async function saveLauncherLogin(code: string, login: LauncherLogin) {
  if (!redis) throw new Error("Store is not configured");
  await redis.set(launcherLoginKey(code), login, { ex: 120 });
}
export const takeLauncherLogin = (code: string) =>
  attempt("launcher login", null as LauncherLogin | null, (client) => client.getdel<LauncherLogin>(launcherLoginKey(code)));
