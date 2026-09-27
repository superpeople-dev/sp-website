import { NextResponse, type NextRequest } from "next/server";
import { authReady, oauthCookie, oauthCookieOptions, safeNext } from "@/lib/session";

export function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!authReady) return NextResponse.redirect(new URL(next, request.url));
  const state = crypto.randomUUID();
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    scope: process.env.DISCORD_GUILD_ID ? "identify guilds.members.read" : "identify",
    redirect_uri: `${request.nextUrl.origin}/api/auth/discord/callback`,
    state,
    prompt: "none",
  }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set(oauthCookie, `${state}|${next}`, oauthCookieOptions);
  return response;
}
