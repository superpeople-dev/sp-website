import { Redis } from "@upstash/redis";
import type { SessionUser } from "./session";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const storeReady = redis !== null;

export type Profile = { id: string; name: string; username: string; avatar: string; admin: boolean };
export type Ban = Omit<Profile, "admin"> & { by: string; at: number };

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
