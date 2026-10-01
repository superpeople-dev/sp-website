import { Redis } from "@upstash/redis";
import { CONSENT_VERSION, type Choice } from "./consent";

// Each Discord account's data choice (lib/consent.ts), for the launcher's logs to follow.

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const choicesKey = "sp:consent";

type Stored = { choice: Choice; version: number; at: number };

export async function saveChoice(userId: string, choice: Choice) {
  if (!redis) return;
  await redis.hset(choicesKey, { [userId]: { choice, version: CONSENT_VERSION, at: Date.now() } satisfies Stored });
}

// The account's choice; null when it never chose (or the store is down).
export async function choiceOf(userId: string): Promise<Choice | null> {
  if (!redis) return null;
  const stored = await redis.hget<Stored>(choicesKey, userId).catch(() => null);
  return stored?.version === CONSENT_VERSION ? stored.choice : null;
}
