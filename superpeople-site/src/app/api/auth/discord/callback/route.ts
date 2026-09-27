import { NextResponse, type NextRequest } from "next/server";
import {
  authReady,
  oauthCookie,
  oauthCookieOptions,
  safeNext,
  sealSession,
  sessionCookie,
  sessionCookieOptions,
  type SessionUser,
} from "@/lib/session";

type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

async function hasAdminRole(accessToken: string) {
  const guild = process.env.DISCORD_GUILD_ID;
  const adminRoles = list(process.env.DISCORD_ADMIN_ROLE_IDS);
  if (!guild || !adminRoles.length) return false;
  const response = await fetch(`https://discord.com/api/users/@me/guilds/${guild}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const { roles = [] } = (await response.json()) as { roles?: string[] };
  return roles.some((role) => adminRoles.includes(role));
}

async function discordUser(code: string, redirectUri: string): Promise<SessionUser | null> {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.DISCORD_CLIENT_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return null;
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) return null;
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as DiscordUser;
  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> BigInt(22)) % BigInt(6))}.png`;
  return {
    id: user.id,
    name: user.global_name || user.username,
    username: user.username,
    avatar,
    admin: await hasAdminRole(accessToken),
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [state, storedNext] = (request.cookies.get(oauthCookie)?.value ?? "").split("|");
  const next = safeNext(storedNext);
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(oauthCookie, "", { ...oauthCookieOptions, maxAge: 0 });

  const code = params.get("code");
  if (!authReady || !state || !code || params.get("state") !== state) return response;

  const user = await discordUser(code, `${request.nextUrl.origin}/api/auth/discord/callback`).catch(() => null);
  if (user) response.cookies.set(sessionCookie, await sealSession(user), sessionCookieOptions);
  return response;
}
