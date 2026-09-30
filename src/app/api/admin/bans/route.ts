import type { NextRequest } from "next/server";
import { banUser, unbanUser } from "@/lib/bans";
import { can } from "@/lib/board";
import { readSession, sameOrigin } from "@/lib/session";
import { listBans, storeReady } from "@/lib/store";

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
      await unbanUser(user, { id, name });
    } else if (body.action === "ban") {
      const target = { id, name, username: text(body.user?.username, 100), avatar: text(body.user?.avatar, 300) };
      const result = await banUser(user, target, text(body.reason, 300));
      if (result !== "ok") return Response.json({ error: result }, { status: 400 });
    } else {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[store] ban update failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
