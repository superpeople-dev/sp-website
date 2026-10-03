import { randomBytes } from "node:crypto";
import { getExpiring, setExpiring } from "./db";
import { deleteObject, listObjects, objectSize, uploadLink, viewLink } from "./objects";
import { siteUrl } from "./seo";

// Replays of reported matches. When a player reports someone in the game, the launcher (sp-launcher
// replays.rs) zips the game's recording of that match and uploads it straight into object storage
// (bucket "media", replays/<id>/<recording>.zip) with a short-lived PUT link from here. The report in
// #in-game-report then links the replay's page, https://superpeople.dev/replays/<id>: Open in the
// launcher, or download the zip.
//
// The id is 128 random bits, so the page needs no sign-in: nobody finds a replay without its link, and
// only the staff's channel shows links. Each replay is kept KEEP_DAYS: its record (a value that expires,
// lib/db.ts) is gone after that, so its page and download say so, and the daily cleanup
// (app/api/cron/replays) deletes the file. A replay shows every player of its match.

export const KEEP_DAYS = 30;
const KEEP_MS = KEEP_DAYS * 86_400_000;
// A whole match zips to 2-15 MB.
export const MAX_BYTES = 64 * 1024 * 1024;
const ID_RE = /^[0-9a-f]{32}$/;
// An upload link works this long; a record never confirmed is dropped by the cleanup after a day.
const UPLOAD_SECONDS = 15 * 60;

export type Replay = {
  id: string;
  discordId: string;
  // The recording's folder name ("<player>_2026-10-01_20-25"): the zip is saved under it.
  name: string;
  bytes: number;
  at: number;
  uploaded: boolean;
};

const recordKey = (id: string) => `replay:${id}`;
export const isReplayId = (id: string) => ID_RE.test(id);
// Only what a file name can hold.
export const replayName = (name: unknown) =>
  (typeof name === "string" ? name : "").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(0, 80) || "replay";
const objectKey = (replay: Pick<Replay, "id" | "name">) => `replays/${replay.id}/${replay.name}.zip`;
export const replayPage = (id: string) => `${siteUrl}/replays/${id}`;
export const expiresAt = (replay: Pick<Replay, "at">) => replay.at + KEEP_MS;

async function save(replay: Replay) {
  const seconds = Math.ceil((expiresAt(replay) - Date.now()) / 1000);
  if (seconds > 0) await setExpiring(recordKey(replay.id), replay, seconds);
}

// A new replay for `discordId` and where the launcher puts its zip.
export async function startReplay(discordId: string, name: unknown) {
  const replay: Replay = { id: randomBytes(16).toString("hex"), discordId, name: replayName(name), bytes: 0, at: Date.now(), uploaded: false };
  await save(replay);
  return { id: replay.id, uploadUrl: uploadLink(objectKey(replay), UPLOAD_SECONDS), url: replayPage(replay.id) };
}

// A replay younger than KEEP_DAYS, or null.
export async function replayOf(id: string) {
  if (!isReplayId(id)) return null;
  const replay = await getExpiring<Replay>(recordKey(id));
  return replay && Date.now() < expiresAt(replay) ? replay : null;
}

// The reporter's launcher says it uploaded the zip: true once the file is there, theirs and not too big.
// A file over the limit is deleted.
export async function confirmReplay(id: string, discordId: string) {
  const replay = await replayOf(id);
  if (!replay || replay.discordId !== discordId) return null;
  if (replay.uploaded) return replay;
  const bytes = await objectSize(objectKey(replay));
  if (!bytes) return null;
  if (bytes > MAX_BYTES) {
    await deleteObject(objectKey(replay)).catch(() => {});
    return null;
  }
  const done = { ...replay, bytes, uploaded: true };
  await save(done);
  return done;
}

// A short-lived link to the zip, saved as "<recording>.zip".
export const downloadLink = (replay: Replay) => viewLink(objectKey(replay), 10 * 60);

// The daily cleanup: every file older than KEEP_DAYS, and every file whose record is gone (expired, or
// an upload never confirmed), is deleted. Returns how many files were looked at and deleted.
export async function sweepReplays(now = Date.now()) {
  const files = await listObjects("replays/");
  let deleted = 0;
  for (const file of files) {
    const id = /^replays\/([0-9a-f]{32})\//.exec(file.key)?.[1];
    const replay = id ? await getExpiring<Replay>(recordKey(id)) : null;
    const old = now - file.storedAt > KEEP_MS;
    const orphan = !replay || (!replay.uploaded && now - replay.at > 86_400_000);
    if (old || orphan) {
      await deleteObject(file.key);
      deleted++;
    }
  }
  return { files: files.length, deleted };
}
