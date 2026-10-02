import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { banUser, unbanUser, type BanTarget } from "@/lib/bans";
import { accessOf, hasAdminRole, hasModeratorRole } from "@/lib/staff";
import { banOf, isBanned, listBansStrict, storeReady } from "@/lib/store";

// The Discord bot's /ban, /tempban and /unban (sp-bot, src/commands). The bot sends BOT_API_SECRET and
// who ran the command: their Discord id and the roles the bot saw on them. The site decides whether
// they may (lib/staff.ts): an admin with the "bans" permission may do all of it, as in the admin
// panel. A moderator (a DISCORD_MODERATOR_ROLE_IDS role, Moderator and Developer) may ban for a
// while and lift a ban that ends by itself, nothing that lasts until lifted. Without BOT_API_SECRET
// this route is off.
//
// POST { action: "ban" | "unban", user: { id, name, username, avatar }, reason, until?, actor: { id, name, avatar, roles } }
//  until: when a temporary ban ends (epoch ms or an ISO date), at most a year ahead; none: until lifted.
//  -> { ok: true, already }  already: they were banned (ban) or not banned (unban) before; nothing changed.
//     A ban that ends sooner than the new one is replaced by it (a /ban after a /tempban is for good).
//     401 unauthorized, 400 invalid / reason / protected, 503 disabled / store,
//     403 forbidden (neither an admin with "bans" nor a moderator), admin_only (a moderator asking
//     for a ban until lifted, or to lift one, or to lift a ban the site does not have)
//
// GET -> { ok: true, bans: [{ id, name, username, at, until?, reason, by, lockout? }] }
//  The bans in force, newest first: the bot (src/banmirror.js) bans on the Discord server whoever
//  was banned here in the admin panel, and lifts that when the ban is lifted. lockout: a honeypot's
//  ban (lib/honeypot.ts), which the bot leaves alone. 401 unauthorized, 503 disabled / store.

const secret = process.env.BOT_API_SECRET ?? "";
const digest = (value: string) => createHash("sha256").update(value).digest();
const authorized = (request: NextRequest) =>
  timingSafeEqual(digest((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")), digest(secret));

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const YEAR = 366 * 24 * 3600 * 1000;
// undefined: until lifted. null: not a usable end (in the past, or more than a year ahead).
function endOf(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const ms = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && ms > Date.now() && ms <= Date.now() + YEAR ? Math.round(ms) : null;
}
const personOf = (value: Record<string, unknown> | undefined): BanTarget => {
  const id = text(value?.id, 32);
  return { id, name: text(value?.name, 100) || id, username: text(value?.username, 100), avatar: text(value?.avatar, 300) };
};

export async function GET(request: NextRequest) {
  if (!secret) return Response.json({ error: "disabled" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!storeReady) return Response.json({ error: "store" }, { status: 503 });
  const list = await listBansStrict().catch((error: unknown) => {
    console.error(`[store] bot ban list failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  if (!list) return Response.json({ error: "store" }, { status: 502 });
  const bans = list.map((entry) => ({
    id: entry.id,
    name: entry.name,
    username: entry.username,
    at: entry.at,
    ...(entry.until ? { until: entry.until } : {}),
    reason: entry.reason ?? "",
    by: entry.by,
    ...(entry.lockout ? { lockout: true } : {}),
  }));
  return Response.json({ ok: true, bans }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!secret) return Response.json({ error: "disabled" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!storeReady) return Response.json({ error: "store" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    user?: Record<string, unknown>;
    actor?: Record<string, unknown>;
    reason?: unknown;
    until?: unknown;
  };
  const target = personOf(body.user);
  const actor = personOf(body.actor);
  if (!/^\d{5,32}$/.test(target.id) || !/^\d{5,32}$/.test(actor.id)) return Response.json({ error: "invalid" }, { status: 400 });

  const roles = Array.isArray(body.actor?.roles) ? body.actor.roles.filter((role): role is string => typeof role === "string").slice(0, 250) : [];
  const access = await accessOf(actor.id, hasAdminRole(roles));
  const admin = !!access?.permissions.includes("bans");
  if (!admin && !hasModeratorRole(roles)) return Response.json({ error: "forbidden" }, { status: 403 });
  const adminOnly = () => Response.json({ error: "admin_only" }, { status: 403 });

  try {
    if (body.action === "ban") {
      const until = endOf(body.until);
      if (until === null) return Response.json({ error: "until" }, { status: 400 });
      if (!admin && until === undefined) return adminOnly();
      // Already banned: the ban that is there stays as it is (who, when and why), unless it ends sooner.
      const current = await banOf(target.id);
      if (current && !(current.until && (!until || until > current.until))) return Response.json({ ok: true, already: true });
      const result = await banUser(actor, target, text(body.reason, 300), until);
      if (result !== "ok") return Response.json({ error: result }, { status: 400 });
      return Response.json({ ok: true, already: false });
    }
    if (body.action === "unban") {
      // A moderator lifts only a ban that would end by itself. Not one until lifted, and not when the
      // site has none: the bot then lifts the launcher's and Discord's, which may be for good.
      if (!admin && !(await banOf(target.id))?.until) return adminOnly();
      if (!(await isBanned(target.id))) return Response.json({ ok: true, already: true });
      await unbanUser(actor, target);
      return Response.json({ ok: true, already: false });
    }
    return Response.json({ error: "invalid" }, { status: 400 });
  } catch (error) {
    console.error(`[store] bot ban update failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
