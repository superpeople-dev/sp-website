import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SessionUser } from "./session";
import { accessOf } from "./staff";
import { deleteApiKey, listApiKeys, readApiKey, saveApiKey, touchApiKey, type ApiKeyRecord } from "./store";

// Personal API keys for the developer API (app/api/dev): an admin makes one in the admin panel while
// signed in with Discord, and an agent sends it as "Authorization: Bearer spk_…". A key acts as the
// admin who made it, with the permissions they have now (lib/staff.ts, checked on every call), so
// removing an admin or a permission applies to their keys at once. Only the SHA-256 of a key is
// stored: it is shown once, when it is made, and can be revoked from the panel. Keys open only
// /api/dev, never the site's own routes.
//
// Keys need the "api" permission, which owners give or take in the Admins tab: without it an admin
// can't make keys and the ones they have stop working. Admin rights that come only from the Discord
// role are not enough either: the role is known from a sign-in, and a key never signs in again.

export const maxKeysPerAdmin = 10;
const keyPattern = /^spk_[A-Za-z0-9_-]{43}$/;

const hashOf = (key: string) => createHash("sha256").update(key).digest("hex");

export type ApiKeyView = { id: string; name: string; createdAt: number; lastUsedAt: number | null };
const viewOf = (record: ApiKeyRecord): ApiKeyView => ({
  id: record.id,
  name: record.name,
  createdAt: record.createdAt,
  lastUsedAt: record.lastUsedAt ?? null,
});

export const myApiKeys = async (userId: string) =>
  (await listApiKeys()).filter((record) => record.owner.id === userId).sort((a, b) => b.createdAt - a.createdAt).map(viewOf);

// Whether this admin may have keys: an owner, or an admin by the Admins tab or the list in the code.
export const canHaveKeys = async (userId: string) => (await accessOf(userId, false))?.permissions.includes("api") ?? false;

// A new key for this admin; the key itself is in the answer and nowhere else.
export async function createApiKey(user: SessionUser, name: string) {
  const key = `spk_${randomBytes(32).toString("base64url")}`;
  const record: ApiKeyRecord = {
    id: randomBytes(6).toString("hex"),
    hash: hashOf(key),
    name,
    owner: { id: user.id, name: user.name, username: user.username, avatar: user.avatar },
    createdAt: Date.now(),
  };
  await saveApiKey(record);
  return { key, view: viewOf(record) };
}

// Only the owner of a key revokes it (an owner removing an admin makes all their keys useless).
export async function revokeApiKey(userId: string, id: string) {
  const record = (await listApiKeys()).find((entry) => entry.id === id && entry.owner.id === userId);
  if (!record) return false;
  await deleteApiKey(record.hash);
  return true;
}

// The admin behind a request's key, or null (no key, an unknown or revoked one, or its admin is not
// an admin any more). via: the key's name, for the activity log.
export async function apiUser(request: NextRequest): Promise<(SessionUser & { via: string }) | null> {
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key || !keyPattern.test(key)) return null;
  const record = await readApiKey(hashOf(key));
  if (!record) return null;
  const access = await accessOf(record.owner.id, false);
  if (!access?.permissions.includes("api")) return null;
  await touchApiKey(record.hash);
  return {
    ...record.owner,
    admin: true,
    owner: access.owner,
    permissions: access.permissions,
    via: record.name,
  };
}
