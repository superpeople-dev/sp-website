import type { NextRequest } from "next/server";
import { allPermissions, type Permission } from "@/lib/board";
import { logEvent } from "@/lib/events";
import { readSession, sameOrigin } from "@/lib/session";
import { isOwner } from "@/lib/staff";
import { saveStaff, staffEntry, storeReady } from "@/lib/store";

// Owners only: add an admin, change what they may do, or remove them. Owners themselves can't be
// changed here.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user?.owner) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  if (!storeReady) return Response.json({ error: "store" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; id?: unknown; name?: unknown; permissions?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!/^\d{5,32}$/.test(id) || isOwner(id)) return Response.json({ error: "invalid" }, { status: 400 });
  const before = await staffEntry(id);
  const name = (typeof body.name === "string" ? body.name.trim().slice(0, 100) : "") || before?.name || id;

  try {
    if (body.action === "remove") {
      await saveStaff({ id, name, permissions: [], removed: true, by: user.name, at: Date.now() });
      await logEvent(user, { type: "staff.removed", user: { id, name } });
    } else if (body.action === "save") {
      const wanted = Array.isArray(body.permissions) ? body.permissions : [];
      const permissions = allPermissions.filter((permission) => wanted.includes(permission)) as Permission[];
      const adding = !before || before.removed === true;
      await saveStaff({ id, name, permissions, by: user.name, at: Date.now(), v: 2 });
      await logEvent(user, { type: adding ? "staff.added" : "staff.changed", user: { id, name }, permissions });
    } else {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[store] staff update failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
