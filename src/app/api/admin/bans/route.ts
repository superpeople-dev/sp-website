import type { NextRequest } from "next/server";
import { can } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { readSession, sameOrigin } from "@/lib/session";
import { accessOf } from "@/lib/staff";
import { ban, listBans, storeReady, unban } from "@/lib/store";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!can(user, "bans")) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  return Response.json({ bans: await listBans() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user || !can(user, "bans")) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  if (!storeReady) return Response.json({ error: "store" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; user?: Record<string, unknown>; reason?: unknown };
  const id = text(body.user?.id, 32);
  if (!/^\d{5,32}$/.test(id)) return Response.json({ error: "invalid" }, { status: 400 });
  const name = text(body.user?.name, 100) || id;

  try {
    if (body.action === "unban") {
      await unban(id);
      await logEvent(user, { type: "user.unbanned", user: { id, name } });
    } else if (body.action === "ban") {
      // A ban needs a reason, which other admins see.
      const reason = text(body.reason, 300).trim();
      if (reason.length < 3) return Response.json({ error: "reason" }, { status: 400 });
      // Admins can't be banned (an owner removes them from the admins first).
      if (id === user.id || (await accessOf(id))) return Response.json({ error: "protected" }, { status: 400 });
      await ban({
        id,
        name,
        username: text(body.user?.username, 100),
        avatar: text(body.user?.avatar, 300),
        by: user.name,
        at: Date.now(),
        reason,
      });
      await logEvent(user, { type: "user.banned", user: { id, name }, text: reason });
    } else {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[store] ban update failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
