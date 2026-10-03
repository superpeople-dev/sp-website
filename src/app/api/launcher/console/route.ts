import type { NextRequest } from "next/server";
import { consoleToken, passReady } from "@/lib/launcher";
import { readSession, sameOrigin } from "@/lib/session";

// The game's console for an admin (lib/launcher.ts consoleToken): the launcher hands this token to
// the game, and SPClientFixes keeps the console on only with it. Everyone else gets none.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!user.staff.includes("admin")) return Response.json({ error: "not-admin" }, { status: 403 });
  if (!passReady) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ token: consoleToken(user) }, { headers: { "Cache-Control": "no-store" } });
}
