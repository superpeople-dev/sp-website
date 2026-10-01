import { timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { logAuth } from "@/lib/discord";
import { challengeOf, profileOfSession } from "@/lib/launcher";
import { verifySession } from "@/lib/session";
import { isBanned, takeLauncherLogin } from "@/lib/store";

// The launcher trades the one-time code from /launcher/connected, with the PKCE verifier behind its
// challenge, for the player's session (lib/launcher.ts). Each code works once, for two minutes.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; verifier?: unknown };
  if (typeof body.code !== "string" || typeof body.verifier !== "string" || body.verifier.length < 43) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const login = await takeLauncherLogin(body.code);
  const expected = Buffer.from(login?.challenge ?? "");
  const given = Buffer.from(challengeOf(body.verifier));
  if (!login || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const user = await verifySession(login.token);
  if (!user) return Response.json({ error: "invalid" }, { status: 400 });
  // Banned on the website since the code was made: not into the launcher either.
  if (!user.admin && (await isBanned(user.id))) {
    after(() => logAuth("refused", user, "launcher", "Banned"));
    return Response.json({ error: "banned" }, { status: 403 });
  }
  after(() => logAuth("signed_in", user, "launcher"));
  return Response.json({ token: login.token, profile: profileOfSession(user) }, { headers: { "Cache-Control": "no-store" } });
}
