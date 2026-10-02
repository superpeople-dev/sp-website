import type { NextRequest } from "next/server";
import { profileOfSession } from "@/lib/launcher";
import { playBanOf } from "@/lib/playban";
import { readSession } from "@/lib/session";

// Who the launcher's session belongs to; 401 once it has expired, so the launcher asks to connect again.
// ban: what stops them playing (lib/playban.ts), or null. A ban until lifted (permanent) signs the
// launcher out; a temporary one stays on its main page and answers Play. inMatch: the launcher lets the
// round they are in finish before it closes the game.
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const ban = user.admin ? null : await playBanOf(user.id);
  return Response.json(
    { profile: profileOfSession(user), banned: ban !== null, ban: ban && { ...ban, permanent: ban.until === null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
