import { after, type NextRequest } from "next/server";
import {
  LINK_SECONDS,
  blockOf,
  clientIp,
  gameFile,
  keepLink,
  limitsReady,
  reusedLink,
  spend,
} from "@/lib/downloads";
import { logLauncher } from "@/lib/discord";
import { gameFileLink, signingReady } from "@/lib/s3";
import { readSession, sameOrigin } from "@/lib/session";
import { isBanned } from "@/lib/store";

const noStore = { "Cache-Control": "no-store" };

// A 15-minute download link for one of the game's files (lib/game-files.json), for the launcher's
// Download tab, signed in with Discord. The limits are lib/downloads.ts's: past twice the game in
// an hour, the account and the IP get no link for a day, and the answer says until when.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401, headers: noStore });
  // Banned on the website: no game through the launcher either (as ../../pass).
  if (!user.admin && (await isBanned(user.id))) return Response.json({ error: "banned" }, { status: 403, headers: noStore });
  if (!signingReady || !limitsReady) return Response.json({ error: "setup" }, { status: 503, headers: noStore });

  const body = (await request.json().catch(() => ({}))) as { path?: unknown };
  const file = typeof body.path === "string" ? gameFile(body.path) : null;
  if (!file) return Response.json({ error: "missing" }, { status: 404, headers: noStore });

  const ip = clientIp(request);
  try {
    // Admins test downloads again and again: no limit for them.
    if (!user.admin) {
      const blocked = await blockOf(user.id, ip);
      if (blocked) return Response.json({ error: "limit", until: blocked.until }, { status: 429, headers: noStore });
    }
    const reused = await reusedLink(user.id, file.sha256);
    if (reused) return Response.json({ url: reused }, { headers: noStore });
    if (!user.admin) {
      const blocked = await spend(user, ip, file.size);
      if (blocked) after(() => logLauncher("limit", user, { bytes: blocked.bytes, until: blocked.until }));
      if (blocked) return Response.json({ error: "limit", until: blocked.until }, { status: 429, headers: noStore });
    }
    const url = gameFileLink(file.path, LINK_SECONDS);
    await keepLink(user.id, file.sha256, url);
    return Response.json({ url }, { headers: noStore });
  } catch (error) {
    console.error(`[downloads] link failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "store" }, { status: 502, headers: noStore });
  }
}
