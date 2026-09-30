import type { NextRequest } from "next/server";
import { canHaveKeys, createApiKey, maxKeysPerAdmin, myApiKeys, revokeApiKey } from "@/lib/apikeys";
import { readSession, sameOrigin } from "@/lib/session";

// The admin panel's API tab: an admin's own API keys for the developer API (lib/apikeys.ts). Signed
// in with Discord on the site (the session cookie; an API key cannot make keys).

const nameMax = 40;

async function admin(request: NextRequest) {
  const user = await readSession(request);
  return user?.admin ? user : null;
}

export async function GET(request: NextRequest) {
  const user = await admin(request);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const [keys, allowed] = await Promise.all([myApiKeys(user.id), canHaveKeys(user.id)]);
  return Response.json({ keys, allowed, max: maxKeysPerAdmin }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await admin(request);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; name?: unknown; id?: unknown };

  if (body.action === "create") {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > nameMax) return Response.json({ error: "invalid" }, { status: 400 });
    if (!(await canHaveKeys(user.id))) return Response.json({ error: "role" }, { status: 403 });
    if ((await myApiKeys(user.id)).length >= maxKeysPerAdmin) return Response.json({ error: "limit" }, { status: 409 });
    const { key, view } = await createApiKey(user, name);
    return Response.json({ key, view }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "revoke" && typeof body.id === "string") {
    return (await revokeApiKey(user.id, body.id)) ? Response.json({ ok: true }) : Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ error: "invalid" }, { status: 400 });
}
