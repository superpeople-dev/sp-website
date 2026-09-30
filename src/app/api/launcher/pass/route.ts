import type { NextRequest } from "next/server";
import { gamePass, passReady } from "@/lib/launcher";
import { readSession, sameOrigin } from "@/lib/session";

// A game pass for the player pressing Play (lib/launcher.ts): the backend lets the game in with it.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!passReady) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ pass: gamePass(user) }, { headers: { "Cache-Control": "no-store" } });
}
