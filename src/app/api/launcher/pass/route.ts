import type { NextRequest } from "next/server";
import { gamePass, passReady, termsRequired, termsVersion } from "@/lib/launcher";
import { readSession, sameOrigin } from "@/lib/session";
import { isBanned, termsAcceptanceOf } from "@/lib/store";

// A game pass for the player pressing Play (lib/launcher.ts): the backend lets the game in with it.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  // Banned on the website: no game through the launcher either.
  if (!user.admin && (await isBanned(user.id))) return Response.json({ error: "banned" }, { status: 403 });
  if (!passReady) return Response.json({ error: "unavailable" }, { status: 503 });
  // The launcher's terms, once LAUNCHER_TERMS_REQUIRED is on. A store that cannot answer stops no one.
  if (termsRequired) {
    const acceptance = await termsAcceptanceOf(user.id);
    if (acceptance !== undefined && acceptance?.version !== termsVersion) {
      return Response.json({ error: "terms", version: termsVersion }, { status: 403 });
    }
  }
  return Response.json({ pass: gamePass(user) }, { headers: { "Cache-Control": "no-store" } });
}
