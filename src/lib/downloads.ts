import { addHourly, dbReady, getExpiring, query, setExpiring } from "./db";
import list from "./game-files.json";

// The game's files, which the launcher downloads one by one (app/api/launcher/game). Made by
// scripts/game-files.mjs from the files in the Storj bucket.
export type GameFile = { path: string; size: number; sha256: string };
export const gameFiles: GameFile[] = list.files;
export const gameSize = gameFiles.reduce((sum, file) => sum + file.size, 0);
const byPath = new Map(gameFiles.map((file) => [file.path, file]));
export const gameFile = (path: string) => byPath.get(path) ?? null;

// The backup copy (app/api/launcher/game): the same files in one 7z on archive.org, which the
// launchers before 0.4.3 downloaded whole, under \`folder\` inside it. The launcher checks what it
// unpacks against the list above, like any other download. Every file of the list is in it at the
// same size (checked against archive.org's listing of the archive).
export const backup = {
  url: "https://archive.org/download/SPShippingDev/Manifest%20%232065353802481281242.7z",
  folder: "Manifest #2065353802481281242/",
  size: 29_710_037_796,
};

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

// In Postgres (lib/db.ts): the bytes per account and IP and hour in `hourly`, the blocks in
// `download_blocks`, the links handed out in `expiring`.
export const limitsReady = dbReady;

const usedKey = (who: string) => `dl:${who}`;
// Per deployment: a link signed before a fix (a key changed in Vercel) is not handed out again.
const linkKey = (userId: string, sha256: string) => `dl-link:${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}:${userId}:${sha256}`;

// Kept under both the account and the IP, so either one stops the next link.
type Stored = { account: string; name: string; ip: string; bytes: number; at: number; until: number };
// What admins see: whose download was stopped, not from which IP.
export type Block = Omit<Stored, "ip">;

function required() {
  if (!dbReady) throw new Error("Store is not configured");
}

// Bytes counted for each of `whos` over the last hour: this hour's count plus the part of the
// previous hour's that still falls inside the window.
async function usedLastHour(whos: string[], now: number) {
  const hour = Math.floor(now / HOUR);
  const rows = await query<{ key: string; hour: number; amount: number }>(
    "select key, hour, amount from hourly where key = any($1) and hour = any($2)",
    [whos.map(usedKey), [hour, hour - 1]],
  );
  const left = 1 - (now % HOUR) / HOUR;
  const used = new Map(whos.map((who) => [who, 0]));
  for (const row of rows) {
    const who = row.key.slice("dl:".length);
    used.set(who, (used.get(who) ?? 0) + (row.hour === hour ? row.amount : row.amount * left));
  }
  return used;
}

// The block that stops this account or IP, if one still runs.
export async function blockOf(accountId: string, ip: string, now = Date.now()) {
  required();
  const [row] = await query<{ data: Stored }>("select data from download_blocks where key = any($1) and until > $2 limit 1", [
    [`account:${accountId}`, `ip:${ip}`],
    now,
  ]);
  return row?.data ?? null;
}

export const reusedLink = (userId: string, sha256: string) => getExpiring<string>(linkKey(userId, sha256));
export const keepLink = (userId: string, sha256: string, link: string) => setExpiring(linkKey(userId, sha256), link, LINK_REUSE_SECONDS);

// Counts a link for this account and IP. Returns the block it caused when it goes past the limit
// (the link is then not handed out).
export async function spend(account: { id: string; name: string }, ip: string, bytes: number, now = Date.now()) {
  required();
  const whos = [`account:${account.id}`, `ip:${ip}`];
  const usedBy = await usedLastHour(whos, now);
  for (const who of whos) {
    const used = usedBy.get(who) ?? 0;
    if (used + bytes > HOURLY_LIMIT) {
      const block: Stored = { account: account.id, name: account.name, ip, bytes: Math.round(used), at: now, until: now + BLOCK_MS };
      await query(
        `insert into download_blocks (key, data, until) select key, $2, $3 from unnest($1::text[]) as key
         on conflict (key) do update set data = excluded.data, until = excluded.until`,
        [whos, block, block.until],
      );
      console.warn(`[downloads] blocked account ${account.id}: ${Math.round(used / 1e9)} GB in the last hour (${who.split(":")[0]})`);
      return block;
    }
  }
  const hour = Math.floor(now / HOUR);
  await Promise.all(whos.map((who) => addHourly(usedKey(who), hour, bytes)));
  return null;
}

// For the admin panel: blocks still running, newest first, once each.
export async function listBlocks(now = Date.now()): Promise<Block[]> {
  required();
  await query("delete from download_blocks where until <= $1", [now]);
  const rows = await query<{ data: Stored }>("select data from download_blocks where key like 'account:%'");
  return rows
    .map(({ data: block }) => ({ account: block.account, name: block.name, bytes: block.bytes, at: block.at, until: block.until }))
    .sort((a, b) => b.at - a.at);
}

// Lifts an account's block, and the one on the IP it downloaded from.
// How many times `key` was counted this hour, this time included (the launcher's reports to
// #launcher-logs are capped with it).
export async function countThisHour(key: string, now = Date.now()) {
  required();
  return addHourly(`count:${key}`, Math.floor(now / HOUR), 1);
}

export async function unblock(accountId: string) {
  required();
  await query(
    `delete from download_blocks where key = $1
       or (key = 'ip:' || (select data->>'ip' from download_blocks where key = $1) and data->>'account' = $2)`,
    [`account:${accountId}`, accountId],
  );
}
