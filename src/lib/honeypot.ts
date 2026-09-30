import { NextResponse, type NextRequest } from "next/server";
import { apiUser } from "./apikeys";
import { logEvent } from "./events";
import { readSession, sessionCookie, sessionCookieOptions } from "./session";
import { ban, banOf } from "./store";

// Decoy admin routes (app/api/{admin,dev}/[...trap], app/api/{internal,debug,users,v1}/[[...trap]]):
// nothing on the site or in the launcher calls them, so a player who does is probing. They are
// banned from everything (a lockout ban, lib/store.ts): no sign-in on the website or in the launcher
// until an admin unbans them in the admin panel's Bans tab. Admins are never touched.
//
// Only a request nobody can be tricked into sending counts. A link (in Discord, on another site)
// opens as a GET navigation that carries the player's cookie, so it would ban whoever clicks it.
// What counts: another method than GET (a form on another site can't send our cookie with it), a
// request with an Authorization header (the launcher's session, an API key: a link can't add one),
// or a script on our own pages (the browser console). Everything else gets the same "forbidden"
// and nothing happens.
//
// Someone probing before signing in gets a mark (a cookie) and is banned the moment they sign in
// with Discord (app/api/auth/discord/callback).

export const trapCookie = "sp_trap";
const trapCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };
const honeypot = { id: "honeypot", name: "Honeypot" };

// Could this request have come from a link or a page on another site? Then it proves nothing.
function deliberate(request: NextRequest) {
  const method = request.method.toUpperCase();
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const mode = request.headers.get("sec-fetch-mode");
  if (origin && origin !== request.nextUrl.origin) return false;
  if (site === "cross-site" || site === "same-site") return false;
  if (request.headers.has("authorization")) return true;
  if (method !== "GET" && method !== "HEAD") return true;
  // A GET: only a script on our own pages (fetch in the console), never a navigation.
  return site === "same-origin" && mode !== null && mode !== "navigate";
}

const what = (request: NextRequest) => `${request.method.toUpperCase()} ${request.nextUrl.pathname}`.slice(0, 200);

// Bans a player from everything, once (a second trap changes nothing), and says so in the activity
// log and on the staff channel (lib/discord.ts posts "User banned").
export async function lockOut(user: { id: string; name: string; username: string; avatar: string }, reason: string) {
  const current = await banOf(user.id);
  if (current?.lockout) return;
  await ban({ id: user.id, name: user.name, username: user.username, avatar: user.avatar, by: honeypot.name, at: Date.now(), reason, lockout: true });
  await logEvent({ ...honeypot, avatar: "" }, { type: "user.banned", user: { id: user.id, name: user.name }, text: reason });
}

const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

export async function trap(request: NextRequest): Promise<Response> {
  // Admins (and the agents' API keys, which are admins') only get told it doesn't exist.
  if (await apiUser(request)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await readSession(request);
  if (user?.admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!deliberate(request)) return forbidden();

  const response = forbidden();
  if (user) {
    await lockOut(user, `Honeypot: ${what(request)}`);
    response.cookies.set(sessionCookie, "", { ...sessionCookieOptions, maxAge: 0 });
  } else {
    response.cookies.set(trapCookie, Buffer.from(what(request)).toString("base64url"), trapCookieOptions);
  }
  return response;
}

// The mark left before signing in, as "POST /api/admin/users", or null.
export function trapMark(request: NextRequest) {
  const value = request.cookies.get(trapCookie)?.value;
  if (!value) return null;
  try {
    return Buffer.from(value, "base64url").toString("utf8").slice(0, 200) || null;
  } catch {
    return null;
  }
}

export const clearTrapMark = (response: NextResponse) => response.cookies.set(trapCookie, "", { ...trapCookieOptions, maxAge: 0 });
