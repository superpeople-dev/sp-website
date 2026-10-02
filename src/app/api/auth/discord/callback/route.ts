import { after, NextResponse, type NextRequest } from "next/server";
import { allPermissions, shownName } from "@/lib/board";
import { consentCookie, parseChoice } from "@/lib/consent";
import { saveChoice } from "@/lib/consentstore";
import { logAuth } from "@/lib/discord";
import { clearTrapMark, lockOut, trapMark } from "@/lib/honeypot";
import { connectedPath, isChallenge } from "@/lib/launcher";
import {
  authReady,
  launcherCookie,
  oauthCookie,
  oauthCookieOptions,
  safeNext,
  sealSession,
  sessionCookie,
  sessionCookieOptions,
  type SessionUser,
} from "@/lib/session";
import { accessOf, hasAdminRole, isOwner, staffKindsOf } from "@/lib/staff";
import { banOf, profileOf, rememberProfile, saveLauncherLogin, saveStaff, staffEntry } from "@/lib/store";

type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

// Their roles on the SUPER PEOPLE Discord server (DISCORD_GUILD_ID), none when it is not set, they are not
// on it, or Discord does not answer: what makes them an admin, a moderator or a developer (lib/staff.ts).
async function memberRoles(accessToken: string): Promise<string[]> {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return [];
  const response = await fetch(`https://discord.com/api/users/@me/guilds/${guild}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const { roles } = (await response.json()) as { roles?: unknown };
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
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
  const roles = await memberRoles(accessToken).catch(() => []);
  return {
    id: user.id,
    name: shownName(user.global_name || user.username, user.username),
    username: user.username,
    avatar,
    admin: hasAdminRole(roles),
    owner: false,
    permissions: [],
    // Kept in the cookie; lib/session.ts adds admin for the site's owners and admins on every request.
    staff: staffKindsOf(roles),
  };
}

// Their Discord profile is kept for the admins list's pictures; someone with the Discord admin role
// gets an entry in the admins list the first time, which owners can then change or remove.
async function remember(user: SessionUser) {
  await rememberProfile(profileOf(user));
  if (user.admin && !isOwner(user.id) && !(await staffEntry(user.id))) {
    await saveStaff({ id: user.id, name: user.name, permissions: allPermissions, by: "Discord role", at: Date.now(), v: 2 }).catch(() => null);
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [state, storedNext] = (request.cookies.get(oauthCookie)?.value ?? "").split("|");
  const next = safeNext(storedNext);
  // The launcher signing in (app/api/auth/launcher): it gets a one-time code, not a cookie.
  const challenge = request.cookies.get(launcherCookie)?.value ?? null;
  const launcher = isChallenge(challenge);
  const response = NextResponse.redirect(new URL(launcher ? `${connectedPath}?error=failed` : next, request.url));
  response.cookies.set(oauthCookie, "", { ...oauthCookieOptions, maxAge: 0 });
  if (launcher) response.cookies.set(launcherCookie, "", { ...oauthCookieOptions, maxAge: 0 });

  const code = params.get("code");
  if (!authReady || !state || !code || params.get("state") !== state) return response;

  const user = await discordUser(code, `${request.nextUrl.origin}/api/auth/discord/callback`).catch(() => null);
  if (!user) return response;
  // Bans (never an admin's): probing the decoy routes before signing in (lib/honeypot.ts) bans them
  // from everything now. Banned from everything: no sign-in at all. A ban until lifted: not into the
  // launcher either. A temporary ban (/tempban): the launcher signs in, shows the ban and refuses Play.
  const mark = trapMark(request);
  if (mark) clearTrapMark(response);
  const admin = (await accessOf(user.id, user.admin)) !== null;
  if (!admin && mark) await lockOut(user, `Honeypot (before signing in): ${mark}`);
  const ban = admin ? null : await banOf(user.id);
  if (ban && (ban.lockout || (launcher && !ban.until))) {
    after(() => logAuth("refused", user, launcher ? "launcher" : "website", ban.lockout ? "Locked out (honeypot)" : "Banned"));
    response.headers.set("Location", new URL(launcher ? `${connectedPath}?error=banned` : "/banned", request.url).toString());
    return response;
  }
  await remember(user).catch(() => null);
  // The data choice made on this device before signing in now belongs to the account too.
  const choice = parseChoice(request.cookies.get(consentCookie)?.value);
  if (choice) await saveChoice(user.id, choice).catch(() => null);
  if (launcher) {
    const handoff = crypto.randomUUID();
    const saved = await saveLauncherLogin(handoff, { token: await sealSession(user), challenge })
      .then(() => true)
      .catch(() => false);
    if (saved) response.headers.set("Location", new URL(`${connectedPath}?code=${handoff}`, request.url).toString());
    return response;
  }
  response.cookies.set(sessionCookie, await sealSession(user), sessionCookieOptions);
  // #discord-auth-logs. The launcher's sign-in is logged when it takes its session (api/launcher/token).
  after(() => logAuth("signed_in", user, "website"));
  return response;
}
