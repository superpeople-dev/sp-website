import { logEvent } from "./events";
import type { SessionUser } from "./session";
import { accessOf } from "./staff";
import { ban, unban } from "./store";

// Banning someone from the site, for the admin panel (app/api/admin/bans) and the Discord bot's
// /ban, /tempban and /unban (app/api/bot/bans). A ban also stops the launcher: a banned player gets no
// game pass (app/api/launcher/pass). With `until` (epoch ms) it is temporary and ends by itself.
// The caller has checked the "bans" permission.

export type BanTarget = { id: string; name: string; username: string; avatar: string };
type Actor = Pick<SessionUser, "id" | "name" | "avatar">;

// "reason": a ban needs a reason, which other admins see. "protected": admins can't be banned (an
// owner removes them from the admins first), and nobody bans themselves.
export async function banUser(actor: Actor, target: BanTarget, reason: string, until?: number): Promise<"ok" | "reason" | "protected"> {
  const why = reason.trim();
  if (why.length < 3) return "reason";
  if (target.id === actor.id || (await accessOf(target.id))) return "protected";
  await ban({ ...target, by: actor.name, at: Date.now(), reason: why, ...(until ? { until } : {}) });
  const ends = until ? ` (until ${new Date(until).toISOString().slice(0, 16).replace("T", " ")} UTC)` : "";
  await logEvent(actor, { type: "user.banned", user: { id: target.id, name: target.name }, text: `${why}${ends}` });
  return "ok";
}

export async function unbanUser(actor: Actor, target: Pick<BanTarget, "id" | "name">) {
  await unban(target.id);
  await logEvent(actor, { type: "user.unbanned", user: { id: target.id, name: target.name } });
}
