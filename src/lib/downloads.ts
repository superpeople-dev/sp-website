import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import list from "./game-files.json";

// The game's files, which the launcher downloads one by one (app/api/launcher/game). Made by
// scripts/game-files.mjs from the files in the Storj bucket.
export type GameFile = { path: string; size: number; sha256: string };
export const gameFiles: GameFile[] = list.files;
export const gameSize = gameFiles.reduce((sum, file) => sum + file.size, 0);
const byPath = new Map(gameFiles.map((file) => [file.path, file]));
export const gameFile = (path: string) => byPath.get(path) ?? null;

// Download limits. Links are handed out per file, to signed-in players; what they add up to is
// counted per Discord account and per IP over the last hour. Past twice the whole game, that
// account and that IP get no more links for a day (an admin can lift it sooner). A link works for
// 15 minutes, and asking for the same file again meanwhile gives the same link without counting it
// twice, so the launcher's retries cost nothing.
const HOUR = 3_600_000;
export const HOURLY_LIMIT = 2 * gameSize;
const BLOCK_MS = 24 * HOUR;
export const LINK_SECONDS = 15 * 60;
const LINK_REUSE_SECONDS = LINK_SECONDS - 60;

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
export const limitsReady = redis !== null;

const blocksKey = "sp:dl:blocks";
const usedKey = (who: string, hour: number) => `sp:dl:used:${who}:${hour}`;
const linkKey = (userId: string, sha256: string) => `sp:dl:link:${userId}:${sha256}`;

// Kept under both the account and the IP, so either one stops the next link.
type Stored = { account: string; name: string; ip: string; bytes: number; at: number; until: number };
// What admins see: whose download was stopped, not from which IP.
export type Block = Omit<Stored, "ip">;

// The player's IP as Vercel saw it (its own headers, which a client cannot set).
export function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

function client() {
  if (!redis) throw new Error("Store is not configured");
  return redis;
}

// Bytes counted for `who` over the last hour: this hour's count plus the part of the previous
// hour's that still falls inside the window.
async function usedLastHour(who: string, now: number) {
  const hour = Math.floor(now / HOUR);
  const [current, previous] = await client().mget<(number | null)[]>(usedKey(who, hour), usedKey(who, hour - 1));
  const left = 1 - (now % HOUR) / HOUR;
  return (current ?? 0) + (previous ?? 0) * left;
}

async function count(who: string, bytes: number, now: number) {
  const key = usedKey(who, Math.floor(now / HOUR));
  await client().multi().incrby(key, bytes).expire(key, 3 * 3600).exec();
}

// The block that stops this account or IP, if one still runs.
export async function blockOf(accountId: string, ip: string, now = Date.now()) {
  const found = await client().hmget<Record<string, Stored>>(blocksKey, `account:${accountId}`, `ip:${ip}`);
  return Object.values(found ?? {}).find((block) => block && block.until > now) ?? null;
}

export const reusedLink = (userId: string, sha256: string) => client().get<string>(linkKey(userId, sha256));
export const keepLink = (userId: string, sha256: string, link: string) =>
  client().set(linkKey(userId, sha256), link, { ex: LINK_REUSE_SECONDS });

// Counts a link for this account and IP. Returns the block it caused when it goes past the limit
// (the link is then not handed out).
export async function spend(account: { id: string; name: string }, ip: string, bytes: number, now = Date.now()) {
  const whos = [`account:${account.id}`, `ip:${ip}`];
  for (const who of whos) {
    const used = await usedLastHour(who, now);
    if (used + bytes > HOURLY_LIMIT) {
      const block: Stored = { account: account.id, name: account.name, ip, bytes: Math.round(used), at: now, until: now + BLOCK_MS };
      await client().hset(blocksKey, Object.fromEntries(whos.map((key) => [key, block])));
      console.warn(`[downloads] blocked account ${account.id}: ${Math.round(used / 1e9)} GB in the last hour (${who.split(":")[0]})`);
      return block;
    }
  }
  await Promise.all(whos.map((who) => count(who, bytes, now)));
  return null;
}

// For the admin panel: blocks still running, newest first, once each.
export async function listBlocks(now = Date.now()): Promise<Block[]> {
  const entries = Object.entries((await client().hgetall<Record<string, Stored>>(blocksKey)) ?? {});
  const expired = entries.filter(([, block]) => block.until <= now).map(([key]) => key);
  if (expired.length) await client().hdel(blocksKey, ...expired);
  const running = new Map<string, Block>();
  for (const [key, block] of entries) {
    if (block.until > now && key.startsWith("account:")) {
      running.set(block.account, { account: block.account, name: block.name, bytes: block.bytes, at: block.at, until: block.until });
    }
  }
  return [...running.values()].sort((a, b) => b.at - a.at);
}

// Lifts an account's block, and the one on the IP it downloaded from.
// How many times `key` was counted this hour, this time included (the launcher's reports to
// #launcher-logs are capped with it).
export async function countThisHour(key: string, now = Date.now()) {
  const counter = `sp:count:${key}:${Math.floor(now / HOUR)}`;
  const [count] = await client().multi().incr(counter).expire(counter, 2 * 3600).exec<[number, number]>();
  return count;
}

export async function unblock(accountId: string) {
  const block = await client().hget<Stored>(blocksKey, `account:${accountId}`);
  const keys = [`account:${accountId}`];
  if (block) {
    const onIp = await client().hget<Stored>(blocksKey, `ip:${block.ip}`);
    if (onIp?.account === accountId) keys.push(`ip:${block.ip}`);
  }
  await client().hdel(blocksKey, ...keys);
}
