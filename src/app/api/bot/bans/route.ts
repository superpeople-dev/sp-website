import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { banUser, unbanUser, type BanTarget } from "@/lib/bans";
import { accessOf, hasAdminRole } from "@/lib/staff";
import { isBanned, storeReady } from "@/lib/store";

// The Discord bot's /ban and /unban (sp-bot, src/commands/ban.js). The bot sends BOT_API_SECRET and
// who ran the command: their Discord id and the roles the bot saw on them. The site decides, as in
// the admin panel, whether they may: an admin with the "bans" permission (lib/staff.ts). Without
// BOT_API_SECRET this route is off.
//
// POST { action: "ban" | "unban", user: { id, name, username, avatar }, reason, actor: { id, name, avatar, roles } }
//  -> { ok: true, already }  already: they were banned (ban) or not banned (unban) before; nothing changed.
//     401 unauthorized, 403 forbidden (not an admin with "bans"), 400 invalid / reason / protected, 503 disabled / store

const secret = process.env.BOT_API_SECRET ?? "";
const digest = (value: string) => createHash("sha256").update(value).digest();
const authorized = (request: NextRequest) =>
  timingSafeEqual(digest((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")), digest(secret));

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const personOf = (value: Record<string, unknown> | undefined): BanTarget => {
  const id = text(value?.id, 32);
  return { id, name: text(value?.name, 100) || id, username: text(value?.username, 100), avatar: text(value?.avatar, 300) };
};

export async function POST(request: NextRequest) {
  if (!secret) return Response.json({ error: "disabled" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!storeReady) return Response.json({ error: "store" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    user?: Record<string, unknown>;
    actor?: Record<string, unknown>;
    reason?: unknown;
  };
  const target = personOf(body.user);
  const actor = personOf(body.actor);
  if (!/^\d{5,32}$/.test(target.id) || !/^\d{5,32}$/.test(actor.id)) return Response.json({ error: "invalid" }, { status: 400 });

  const roles = Array.isArray(body.actor?.roles) ? body.actor.roles.filter((role): role is string => typeof role === "string").slice(0, 250) : [];
  const access = await accessOf(actor.id, hasAdminRole(roles));
  if (!access?.permissions.includes("bans")) return Response.json({ error: "forbidden" }, { status: 403 });

  try {
    if (body.action === "ban") {
      // Already banned: the ban that is there stays as it is (who, when and why).
      if (await isBanned(target.id)) return Response.json({ ok: true, already: true });
      const result = await banUser(actor, target, text(body.reason, 300));
      if (result !== "ok") return Response.json({ error: result }, { status: 400 });
      return Response.json({ ok: true, already: false });
    }
    if (body.action === "unban") {
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
