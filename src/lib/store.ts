import type { FeedbackStatus } from "reflet-sdk";
import type { ActivityEvent, Notice, Permission } from "./board";
import { dbReady, getExpiring, query, setExpiring, takeExpiring } from "./db";
import type { SessionUser } from "./session";

// The site's own records, in Postgres (lib/db.ts, tables in db/migrations). Upstash Redis until
// 02.10.2026.
export const storeReady = dbReady;

export type Profile = { id: string; name: string; username: string; avatar: string; admin: boolean };
// lockout: banned from everything (lib/honeypot.ts), not only from posting and voting: no sign-in on the
// website or in the launcher, and any session they had stops working.
// until: a temporary ban (the bot's /tempban), which ends by itself then (epoch ms). Without it a ban
// lasts until it is lifted. A temporary ban stops posting, voting and playing, but the launcher stays
// signed in to show it (app/api/launcher/me).
export type Ban = Omit<Profile, "admin"> & { by: string; at: number; reason?: string; lockout?: boolean; until?: number };

export const profileOf = (user: SessionUser): Profile => ({
  id: user.id,
  name: user.name,
  username: user.username,
  avatar: user.avatar,
  admin: user.admin,
});

async function attempt<T>(action: string, fallback: T, run: () => Promise<T>): Promise<T> {
  if (!dbReady) return fallback;
  try {
    return await run();
  } catch (error) {
    console.error(`[store] ${action} failed: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

function required() {
  if (!dbReady) throw new Error("Store is not configured");
}

// Rows of (id, data) as an object by id, for the given ids (missing ones left out).
async function byIds<T>(table: string, key: string, ids: string[]): Promise<Record<string, T>> {
  if (!ids.length) return {};
  const rows = await query<{ id: string; data: T }>(`select ${key} as id, data from ${table} where ${key} = any($1)`, [ids]);
  return Object.fromEntries(rows.map((row) => [row.id, row.data]));
}

// A temporary ban that has run out counts as none; it stays stored until a new ban or an unban replaces it.
const inForce = (entry: Ban | null) => (entry && !(entry.until && entry.until <= Date.now()) ? entry : null);

export const banOf = (id: string) =>
  attempt("ban lookup", null as Ban | null, async () => {
    const [row] = await query<{ data: Ban }>("select data from bans where id = $1", [id]);
    return inForce(row?.data ?? null);
  });
export const isBanned = async (id: string) => (await banOf(id)) !== null;

const bansInForce = async () =>
  (await query<{ data: Ban }>("select data from bans"))
    .map((row) => row.data)
    .filter((entry) => inForce(entry))
    .sort((a, b) => b.at - a.at);

export const listBans = () => attempt("ban list", [] as Ban[], bansInForce);

// The same, but a store that fails throws instead of answering "nobody": the Discord bot lifts its
// Discord bans for bans that are gone (app/api/bot/bans GET), so an outage must not read as none.
export async function listBansStrict() {
  required();
  return bansInForce();
}

export async function ban(entry: Ban) {
  required();
  await query("insert into bans (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data", [entry.id, entry]);
}

export async function unban(id: string) {
  required();
  await query("delete from bans where id = $1", [id]);
}

export const rememberAuthor = (itemId: string, profile: Profile) =>
  attempt("author save", undefined, async () => {
    await query("insert into authors (item_id, data) values ($1, $2) on conflict (item_id) do update set data = excluded.data", [itemId, profile]);
  });

export const authorsOf = (ids: string[]) => attempt("author lookup", {} as Record<string, Profile>, () => byIds<Profile>("authors", "item_id", ids));

// Downvotes. Reflet keeps the upvotes; a downvote is a row here (item, user). The score shown
// everywhere is upvotes minus downvotes.
export const downvoteCounts = (ids: string[]) =>
  attempt("downvote counts", {} as Record<string, number>, async () => {
    if (!ids.length) return {};
    const rows = await query<{ item_id: string; count: number }>(
      "select item_id, count(*)::int as count from downvotes where item_id = any($1) group by item_id",
      [ids],
    );
    return Object.fromEntries(rows.map((row) => [row.item_id, row.count]));
  });

export const downvotedBy = (userId: string) =>
  attempt("user downvotes", [] as string[], async () =>
    (await query<{ item_id: string }>("select item_id from downvotes where user_id = $1", [userId])).map((row) => row.item_id),
  );

export const hasDownvoted = (itemId: string, userId: string) =>
  attempt("downvote check", false, async () => (await query("select 1 from downvotes where item_id = $1 and user_id = $2", [itemId, userId])).length > 0);

// Adds or removes one user's downvote; returns the item's downvote count afterwards.
export async function setDownvote(itemId: string, userId: string, on: boolean) {
  required();
  await query(
    on
      ? "insert into downvotes (item_id, user_id) values ($1, $2) on conflict do nothing"
      : "delete from downvotes where item_id = $1 and user_id = $2",
    [itemId, userId],
  );
  const [row] = await query<{ count: number }>("select count(*)::int as count from downvotes where item_id = $1", [itemId]);
  return row.count;
}

// Admins as the owners set them (lib/staff.ts): their permissions, or "removed" for someone who is
// no longer an admin even if they are on the list in lib/admins.ts or have the Discord role.
// v 2: saved since the activity and api permissions exist, so its list says whether it has them.
export type StaffEntry = { id: string; name: string; permissions: Permission[]; removed?: boolean; by: string; at: number; v?: 2 };

export const staffEntry = (id: string) =>
  attempt("staff lookup", null as StaffEntry | null, async () => {
    const [row] = await query<{ data: StaffEntry }>("select data from staff where id = $1", [id]);
    return row?.data ?? null;
  });

export const staffEntries = () =>
  attempt("staff list", {} as Record<string, StaffEntry>, async () =>
    Object.fromEntries((await query<{ id: string; data: StaffEntry }>("select id, data from staff")).map((row) => [row.id, row.data])),
  );

export async function saveStaff(entry: StaffEntry) {
  required();
  await query("insert into staff (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data", [entry.id, entry]);
}

// Everyone's Discord profile as of their last sign-in, for the admins list's pictures.
export const rememberProfile = (profile: Profile) =>
  attempt("profile save", undefined, async () => {
    await query("insert into profiles (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data", [profile.id, profile]);
  });

export const profilesOf = (ids: string[]) => attempt("profile lookup", {} as Record<string, Profile>, () => byIds<Profile>("profiles", "id", ids));

// The profiles saved with ideas and comments (older than the profiles table), to find someone's picture.
export const allAuthors = () =>
  attempt("author list", [] as Profile[], async () => (await query<{ data: Profile }>("select data from authors")).map((row) => row.data));

// The activity log: newest first, the last 5,000 events.
const keptEvents = 5000;

export const saveEvent = (event: ActivityEvent) =>
  attempt("event save", undefined, async () => {
    await query("insert into events (data) values ($1)", [event]);
    await query("delete from events where seq <= (select max(seq) from events) - $1", [keptEvents]);
  });

export const readEvents = () =>
  attempt("event list", [] as ActivityEvent[], async () =>
    (await query<{ data: ActivityEvent }>("select data from events order by seq desc limit $1", [keptEvents])).map((row) => row.data),
  );

// Items whose comments an admin turned off: nobody but admins can add more.
export const commentsOff = (itemId: string) =>
  attempt("comments lock check", false, async () => (await query("select 1 from comments_off where item_id = $1", [itemId])).length > 0);

export async function setCommentsOff(itemId: string, off: boolean) {
  required();
  await query(off ? "insert into comments_off (item_id) values ($1) on conflict do nothing" : "delete from comments_off where item_id = $1", [itemId]);
}

// Who works on an item: an admin (their Discord id). Not set, it is the whole team's.
export const assigneeOf = (itemId: string) =>
  attempt("assignee lookup", null as string | null, async () => {
    const [row] = await query<{ staff_id: string }>("select staff_id from assignees where item_id = $1", [itemId]);
    return row?.staff_id ?? null;
  });

// Every item that is assigned, and to whom (item id: Discord id), in one read (the developer API's lists).
export const allAssignees = () =>
  attempt("assignee list", {} as Record<string, string>, async () =>
    Object.fromEntries((await query<{ item_id: string; staff_id: string }>("select item_id, staff_id from assignees")).map((row) => [row.item_id, row.staff_id])),
  );

export async function setAssignee(itemId: string, staffId: string | null, by: string) {
  required();
  if (staffId) {
    await query(
      `insert into assignees (item_id, staff_id, by_id, at) values ($1, $2, $3, $4)
       on conflict (item_id) do update set staff_id = excluded.staff_id, by_id = excluded.by_id, at = excluded.at`,
      [itemId, staffId, by, Date.now()],
    );
  } else await query("delete from assignees where item_id = $1", [itemId]);
}

// Someone's notifications, newest first, the last 50; and when they last opened the list (what came
// after is new).
const keptNotices = 50;

export const addNotice = (userId: string, notice: Omit<Notice, "id" | "at">) =>
  attempt("notice save", undefined, async () => {
    await query("insert into notices (user_id, data) values ($1, $2)", [userId, { id: crypto.randomUUID(), at: Date.now(), ...notice } satisfies Notice]);
    await query(
      `delete from notices where user_id = $1 and seq < (
         select seq from notices where user_id = $1 order by seq desc offset $2 limit 1)`,
      [userId, keptNotices - 1],
    );
  });

export const readNotices = (userId: string) =>
  attempt("notice list", { notices: [] as Notice[], seen: 0 }, async () => {
    const [notices, seen] = await Promise.all([
      query<{ data: Notice }>("select data from notices where user_id = $1 order by seq desc limit $2", [userId, keptNotices]),
      query<{ at: number }>("select at from notices_seen where user_id = $1", [userId]),
    ]);
    return { notices: notices.map((row) => row.data), seen: seen[0]?.at ?? 0 };
  });

export const markNoticesSeen = (userId: string) =>
  attempt("notice seen", undefined, async () => {
    await query("insert into notices_seen (user_id, at) values ($1, $2) on conflict (user_id) do update set at = excluded.at", [userId, Date.now()]);
  });

// Who changed an item's status on the site (app/api/admin/feedback), for the Reflet webhook's Discord
// post to name them ("Approved by", "Moved by"): kept 10 minutes, the webhook comes within seconds.
export type StatusChange = { id: string; name: string; to: FeedbackStatus };
export const markChangedBy = (itemId: string, change: StatusChange) =>
  attempt("status change mark", null, () => setExpiring(`changed-by:${itemId}`, change, 600));
export const changedBy = (itemId: string) =>
  attempt("status change check", null as StatusChange | null, () => getExpiring<StatusChange>(`changed-by:${itemId}`));

// Admins' API keys (lib/apikeys.ts), by the SHA-256 of the key: the key itself is never stored.
export type ApiKeyRecord = {
  id: string;
  hash: string;
  name: string;
  owner: { id: string; name: string; username: string; avatar: string };
  createdAt: number;
  lastUsedAt?: number;
};
// When each key was last used is a column of its own: a use that races a revoke finds no row and
// writes nothing back.
export const saveApiKey = (record: ApiKeyRecord) =>
  attempt("api key save", null, () =>
    query("insert into api_keys (hash, data) values ($1, $2) on conflict (hash) do update set data = excluded.data", [record.hash, record]),
  );
export const readApiKey = (hash: string) =>
  attempt("api key lookup", null as ApiKeyRecord | null, async () => {
    const [row] = await query<{ data: ApiKeyRecord }>("select data from api_keys where hash = $1", [hash]);
    return row?.data ?? null;
  });
export const listApiKeys = () =>
  attempt("api key list", [] as ApiKeyRecord[], async () =>
    (await query<{ data: ApiKeyRecord; last_used_at: number | null }>("select data, last_used_at from api_keys")).map((row) => ({
      ...row.data,
      lastUsedAt: row.last_used_at || undefined,
    })),
  );
export const deleteApiKey = (hash: string) => attempt("api key delete", null, () => query("delete from api_keys where hash = $1", [hash]));
export const touchApiKey = (hash: string) =>
  attempt("api key use", null, () => query("update api_keys set last_used_at = $2 where hash = $1", [hash, Date.now()]));

// Tasks an admin just created on the site (app/api/admin/feedback): Reflet reports the status the task
// was created in as a status change, and the Discord post should say "New task", not "Moved to".
export const markCreated = (itemId: string) => attempt("created mark", null, () => setExpiring(`created:${itemId}`, 1, 600));
export const justCreated = (itemId: string) => attempt("created check", false, async () => (await getExpiring(`created:${itemId}`)) !== null);

// The terms each player accepted in the launcher (lib/launcher.ts), by Discord id: the version and when.
// undefined when the store cannot say, which the game pass treats as "don't stop the player".
export type TermsAcceptance = { version: string; at: number };
export const termsAcceptanceOf = (id: string) =>
  attempt("terms lookup", undefined as TermsAcceptance | null | undefined, async () => {
    const [row] = await query<TermsAcceptance>("select version, at from launcher_terms where id = $1", [id]);
    return row ? { version: row.version, at: row.at } : null;
  });
export async function acceptTerms(id: string, acceptance: TermsAcceptance) {
  required();
  await query(
    "insert into launcher_terms (id, version, at) values ($1, $2, $3) on conflict (id) do update set version = excluded.version, at = excluded.at",
    [id, acceptance.version, acceptance.at],
  );
}

// Launcher sign-in (app/api/auth/launcher): the Discord callback leaves the sealed session here under a
// one-time code, for two minutes, until the launcher trades the code (and its PKCE verifier) for it.
export type LauncherLogin = { token: string; challenge: string };
export async function saveLauncherLogin(code: string, login: LauncherLogin) {
  required();
  await setExpiring(`launcher-login:${code}`, login, 120);
}
export const takeLauncherLogin = (code: string) =>
  attempt("launcher login", null as LauncherLogin | null, () => takeExpiring<LauncherLogin>(`launcher-login:${code}`));
